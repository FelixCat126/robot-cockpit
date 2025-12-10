/**
 * Gamepad设备适配器
 * 支持游戏手柄、飞行摇杆、方向盘等标准Gamepad API设备
 */

import { BasePeripheralDevice } from './BasePeripheralDevice';
import {
  PeripheralType,
  PeripheralStatus,
  PeripheralState,
  PeripheralConfig,
  InputEvent,
  InputEventType,
  AxisInput,
  ButtonInput,
} from '../../types/peripheral.types';

export class GamepadDevice extends BasePeripheralDevice {
  private gamepad: Gamepad | null = null;
  private gamepadIndex: number = -1;
  private animationFrameId: number | null = null;
  
  // 上一帧的按钮状态（用于边缘检测）
  private previousButtonStates: boolean[] = [];
  
  // 上一帧的轴状态（用于变化检测）
  private previousAxisValues: number[] = [];

  // 自动重连机制
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 2000; // 初始2秒
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting: boolean = false;
  
  // 断线检测
  private lastSeenTimestamp: number = 0;
  private disconnectCheckInterval: number = 5000; // 5秒无数据视为断线

  constructor(gamepadIndex: number = 0, config?: PeripheralConfig) {
    super(
      `gamepad-${gamepadIndex}`,
      PeripheralType.GAMEPAD,
      'Gamepad Device',
      config
    );
    this.gamepadIndex = gamepadIndex;
  }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.updateStatus(PeripheralStatus.CONNECTING);

      // 监听手柄连接
      const onConnected = (e: GamepadEvent) => {
        if (e.gamepad.index === this.gamepadIndex) {
          this.handleConnection(e.gamepad);
          window.removeEventListener('gamepadconnected', onConnected);
          resolve();
        }
      };

      // 持久监听断开事件（不要在这里移除监听器）
      const onDisconnected = (e: GamepadEvent) => {
        if (e.gamepad.index === this.gamepadIndex) {
          this.handleDisconnect();
        }
      };

      window.addEventListener('gamepadconnected', onConnected);
      window.addEventListener('gamepaddisconnected', onDisconnected);

      // 持续轮询检测手柄（不依赖用户激活）
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        const gamepads = navigator.getGamepads();
        const existingGamepad = gamepads[this.gamepadIndex];
        
        if (existingGamepad) {
          console.log('✅ [Gamepad] 检测到手柄连接:', existingGamepad.id);
          clearInterval(pollInterval);
          this.handleConnection(existingGamepad);
          window.removeEventListener('gamepadconnected', onConnected);
          resolve();
        } else {
          pollCount++;
          if (pollCount === 1) {
            console.log('⏳ [Gamepad] 正在持续检测手柄连接...');
          }
          // 不设置超时，持续检测
          if (pollCount > 150) { // 30秒后降低检测频率
            clearInterval(pollInterval);
            // 改为每秒检测一次
            const slowPoll = setInterval(() => {
              const gamepads = navigator.getGamepads();
              const gp = gamepads[this.gamepadIndex];
              if (gp) {
                console.log('✅ [Gamepad] 检测到手柄连接:', gp.id);
                clearInterval(slowPoll);
                this.handleConnection(gp);
                resolve();
              }
            }, 1000);
            // 首次resolve，但保持后台检测
            resolve();
          }
        }
      }, 200); // 每200ms检测一次
    });
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.stopReconnect();
    this.gamepad = null;
    this.updateStatus(PeripheralStatus.DISCONNECTED);
    console.log('❌ [Gamepad] 已主动断开');
  }

  /**
   * 处理连接成功
   */
  private handleConnection(gamepad: Gamepad): void {
    this.gamepad = gamepad;
    this._name = gamepad.id;
    this.lastSeenTimestamp = Date.now();
    this.reconnectAttempts = 0; // 重置重连计数
    this.isReconnecting = false;
    
    this.updateStatus(PeripheralStatus.CONNECTED);
    this.startPolling();
    
    console.log(`✅ [Gamepad] 已连接: ${this._name}`);
    console.log(`   - 轴数量: ${gamepad.axes.length}`);
    console.log(`   - 按钮数量: ${gamepad.buttons.length}`);
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    if (this.isReconnecting) {
      return; // 避免重复触发
    }
    
    console.warn('⚠️ [Gamepad] 设备断开，尝试自动重连...');
    this.stopPolling();
    this.updateStatus(PeripheralStatus.DISCONNECTED);
    this.gamepad = null;
    
    // 启动自动重连
    this.startReconnect();
  }

  /**
   * 开始自动重连
   */
  private startReconnect(): void {
    if (this.isReconnecting) {
      return;
    }
    
    this.isReconnecting = true;
    this.attemptReconnect();
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [Gamepad] 重连失败，已达最大尝试次数');
      this.updateStatus(PeripheralStatus.ERROR);
      this.isReconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    
    // 指数退避策略
    const backoff = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      15000 // 最长15秒
    );

    console.log(
      `🔄 [Gamepad] 第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次重连尝试` +
      ` (${Math.round(backoff / 1000)}秒后)`
    );
    console.log('💡 [Gamepad] 请按一下手柄上的任意按钮来唤醒设备');

    this.reconnectTimeoutId = setTimeout(() => {
      // 检查是否已重新连接
      const gamepads = navigator.getGamepads();
      const reconnectedGamepad = gamepads[this.gamepadIndex];

      if (reconnectedGamepad) {
        console.log('✅ [Gamepad] 重连成功！');
        this.handleConnection(reconnectedGamepad);
      } else {
        // 继续尝试
        this.attemptReconnect();
      }
    }, backoff);
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  getState(): PeripheralState {
    const gamepads = navigator.getGamepads();
    this.gamepad = gamepads[this.gamepadIndex];

    if (!this.gamepad) {
      return {
        deviceId: this.id,
        deviceType: this.type,
        deviceName: this.name,
        status: PeripheralStatus.DISCONNECTED,
        timestamp: Date.now(),
        axes: [],
        buttons: [],
      };
    }

    // 构建轴状态
    const axes: AxisInput[] = this.gamepad.axes.map((rawValue, index) => ({
      index,
      rawValue,
      value: this.applyDeadzone(rawValue),
      name: this._config.axisMapping?.[index],
    }));

    // 构建按钮状态
    const buttons: ButtonInput[] = this.gamepad.buttons.map((button, index) => ({
      index,
      pressed: button.pressed,
      value: button.value,
      touched: button.touched,
      name: this._config.buttonMapping?.[index],
    }));

    return {
      deviceId: this.id,
      deviceType: this.type,
      deviceName: this.name,
      status: this._status,
      timestamp: this.gamepad.timestamp || Date.now(),
      axes,
      buttons,
    };
  }

  /**
   * 开始轮询手柄状态
   */
  private startPolling(): void {
    const poll = () => {
      if (this._status !== PeripheralStatus.CONNECTED) {
        return;
      }

      // 更新手柄引用（必须每帧重新获取）
      const gamepads = navigator.getGamepads();
      this.gamepad = gamepads[this.gamepadIndex];

      if (this.gamepad) {
        // 检查是否有新数据（某些浏览器/手柄 timestamp 不更新）
        const now = Date.now();
        if (this.gamepad.timestamp > 0) {
          // 记录最后看到的时间戳
          if (this.gamepad.timestamp !== this.lastSeenTimestamp) {
            this.lastSeenTimestamp = now;
          } else {
            // timestamp 没有更新，检查是否超时
            if (now - this.lastSeenTimestamp > this.disconnectCheckInterval) {
              console.warn('⚠️ [Gamepad] 检测到设备无响应，可能已断开');
              this.handleDisconnect();
              return;
            }
          }
        } else {
          // 有些手柄不支持 timestamp，用当前时间
          this.lastSeenTimestamp = now;
        }
        
        this.processInput();
      } else {
        // 手柄对象丢失
        this.handleDisconnect();
        return;
      }

      this.animationFrameId = requestAnimationFrame(poll);
    };

    poll();
  }

  /**
   * 停止轮询
   */
  private stopPolling(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 处理输入数据
   */
  private processInput(): void {
    if (!this.gamepad) return;

    const timestamp = this.gamepad.timestamp || Date.now();

    // 处理轴输入
    this.gamepad.axes.forEach((rawValue, index) => {
      const value = this.applyDeadzone(rawValue);
      const prevValue = this.previousAxisValues[index] || 0;

      // 只有变化时才发送事件
      if (Math.abs(value - prevValue) > 0.001) {
        const event: InputEvent = {
          type: InputEventType.AXIS_CHANGE,
          timestamp,
          deviceId: this.id,
          deviceType: this.type,
          axis: {
            index,
            rawValue,
            value,
            name: this._config.axisMapping?.[index],
          },
        };

        this.emitInputEvent(event);
        this.previousAxisValues[index] = value;
      }
    });

    // 处理按钮输入（边缘检测）
    this.gamepad.buttons.forEach((button, index) => {
      const wasPressed = this.previousButtonStates[index] || false;
      const isPressed = button.pressed;

      if (isPressed && !wasPressed) {
        // 按钮按下
        const event: InputEvent = {
          type: InputEventType.BUTTON_DOWN,
          timestamp,
          deviceId: this.id,
          deviceType: this.type,
          button: {
            index,
            pressed: true,
            value: button.value,
            touched: button.touched,
            name: this._config.buttonMapping?.[index],
          },
        };
        this.emitInputEvent(event);
      } else if (!isPressed && wasPressed) {
        // 按钮松开
        const event: InputEvent = {
          type: InputEventType.BUTTON_UP,
          timestamp,
          deviceId: this.id,
          deviceType: this.type,
          button: {
            index,
            pressed: false,
            value: button.value,
            touched: button.touched,
            name: this._config.buttonMapping?.[index],
          },
        };
        this.emitInputEvent(event);
      } else if (isPressed && wasPressed) {
        // 按钮持续按住（可选，降低频率）
        // 可以添加节流逻辑
      }

      this.previousButtonStates[index] = isPressed;
    });
  }
}

