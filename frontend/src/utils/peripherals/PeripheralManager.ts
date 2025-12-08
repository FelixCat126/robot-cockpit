/**
 * 外设管理器
 * 统一管理多个外设设备，协调输入事件
 */

import {
  IPeripheralDevice,
  PeripheralType,
  InputEvent,
  PeripheralState,
} from '../../types/peripheral.types';
import { GamepadDevice } from './GamepadDevice';
import { KeyboardDevice } from './KeyboardDevice';

export class PeripheralManager {
  private devices: Map<string, IPeripheralDevice> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isRunning: boolean = false;
  
  // 设备健康检查
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 添加设备
   */
  addDevice(device: IPeripheralDevice): void {
    if (this.devices.has(device.id)) {
      console.warn(`[PeripheralManager] 设备已存在: ${device.id}`);
      return;
    }

    this.devices.set(device.id, device);

    // 监听设备输入事件
    device.on('input', (event: InputEvent) => {
      this.handleInputEvent(event);
    });

    // 监听设备状态变化
    device.on('stateChange', (state: PeripheralState) => {
      const status = state.status;
      
      // 通知外部
      this.emit('deviceStateChange', { deviceId: device.id, state });
      
      // 记录关键状态变化
      if (status === 'error') {
        console.error(`[PeripheralManager] 设备 ${device.name} 出现错误`);
      }
    });

    // 监听设备错误
    device.on('error', (error: Error) => {
      this.emit('deviceError', { deviceId: device.id, error });
    });

  }

  /**
   * 移除设备
   */
  async removeDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      console.warn(`[PeripheralManager] 设备不存在: ${deviceId}`);
      return;
    }

    await device.disconnect();
    this.devices.delete(deviceId);
  }

  /**
   * 获取设备
   */
  getDevice(deviceId: string): IPeripheralDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * 获取所有设备
   */
  getAllDevices(): IPeripheralDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * 按类型获取设备
   */
  getDevicesByType(type: PeripheralType): IPeripheralDevice[] {
    return this.getAllDevices().filter(device => device.type === type);
  }

  /**
   * 启动所有设备
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[PeripheralManager] 已经在运行中');
      return;
    }

    const connectPromises = Array.from(this.devices.values()).map(device =>
      device.connect().catch(error => {
        console.error(`[PeripheralManager] 设备连接失败: ${device.name}`, error);
        return null;
      })
    );

    await Promise.all(connectPromises);
    this.isRunning = true;
    
    // 启动健康检查
    this.startHealthCheck();
    
    this.emit('started', {});
  }

  /**
   * 停止所有设备
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 停止健康检查
    this.stopHealthCheck();

    const disconnectPromises = Array.from(this.devices.values()).map(device =>
      device.disconnect().catch(error => {
        console.error(`[PeripheralManager] 设备断开失败: ${device.name}`, error);
        return null;
      })
    );

    await Promise.all(disconnectPromises);
    this.isRunning = false;

    this.emit('stopped', {});
  }

  /**
   * 获取所有设备的状态
   */
  getAllStates(): Map<string, PeripheralState> {
    const states = new Map<string, PeripheralState>();
    this.devices.forEach((device, id) => {
      states.set(id, device.getState());
    });
    return states;
  }

  /**
   * 处理输入事件
   */
  private handleInputEvent(event: InputEvent): void {
    // 转发输入事件
    this.emit('input', event);
  }

  /**
   * 事件监听
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 移除监听
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('[PeripheralManager] Event listener error:', error);
        }
      });
    }
  }

  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.devices.clear();
    this.eventListeners.clear();
  }

  /**
   * 启动健康检查（每10秒检查一次）
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const states = this.getAllStates();
      
      states.forEach((state, deviceId) => {
        if (state.status === 'error') {
          console.warn(`[PeripheralManager] 设备 ${deviceId} 状态异常`);
        }
      });
    }, 10000);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

/**
 * 外设管理器工厂函数
 * 创建预配置的管理器实例
 */
export function createDefaultPeripheralManager(): PeripheralManager {
  const manager = new PeripheralManager();

  // 添加Gamepad设备（索引0）
  const gamepad = new GamepadDevice(0, {
    deadzone: 0.15,
    sampleRate: 60,
    axisMapping: {
      0: 'leftStickX',
      1: 'leftStickY',
      2: 'rightStickX',
      3: 'rightStickY',
      4: 'gasPedal',
      5: 'brakePedal',
    },
    buttonMapping: {
      0: 'A',
      1: 'B',
      2: 'X',
      3: 'Y',
      4: 'LB',
      5: 'RB',
      6: 'LT',
      7: 'RT',
      8: 'Select',
      9: 'Start',
      10: 'LS',
      11: 'RS',
      12: 'DPadUp',
      13: 'DPadDown',
      14: 'DPadLeft',
      15: 'DPadRight',
    },
  });
  manager.addDevice(gamepad);

  // 添加键盘设备（备用）
  const keyboard = new KeyboardDevice();
  manager.addDevice(keyboard);

  return manager;
}

