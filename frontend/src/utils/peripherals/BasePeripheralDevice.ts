/**
 * 外设设备基类
 * 提供事件管理和通用功能
 */

import {
  IPeripheralDevice,
  PeripheralType,
  PeripheralStatus,
  PeripheralState,
  PeripheralConfig,
  InputEvent,
} from '../../types/peripheral.types';

export abstract class BasePeripheralDevice implements IPeripheralDevice {
  protected _id: string;
  protected _type: PeripheralType;
  protected _name: string;
  protected _status: PeripheralStatus = PeripheralStatus.DISCONNECTED;
  protected _config: PeripheralConfig;
  
  // 事件监听器
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(id: string, type: PeripheralType, name: string, config?: PeripheralConfig) {
    this._id = id;
    this._type = type;
    this._name = name;
    this._config = {
      deadzone: 0.1,
      sampleRate: 60,
      buttonDebounce: 50,
      ...config,
    };
  }

  get id(): string {
    return this._id;
  }

  get type(): PeripheralType {
    return this._type;
  }

  get name(): string {
    return this._name;
  }

  get status(): PeripheralStatus {
    return this._status;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getState(): PeripheralState;

  setConfig(config: Partial<PeripheralConfig>): void {
    this._config = { ...this._config, ...config };
    this.onConfigChange(config);
  }

  /**
   * 配置变更回调（子类可重写）
   */
  protected onConfigChange(_config: Partial<PeripheralConfig>): void {
    // 子类实现
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
  protected emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[${this.name}] Event listener error:`, error);
        }
      });
    }
  }

  /**
   * 更新状态
   */
  protected updateStatus(status: PeripheralStatus): void {
    if (this._status !== status) {
      this._status = status;
      console.log(`[${this.name}] Status changed: ${status}`);
    }
  }

  /**
   * 应用死区
   */
  protected applyDeadzone(value: number, deadzone?: number): number {
    const dz = deadzone ?? this._config.deadzone ?? 0.1;
    
    if (Math.abs(value) < dz) {
      return 0;
    }
    
    // 重新映射到 [-1, 1] 或 [0, 1]
    const sign = value >= 0 ? 1 : -1;
    const normalized = (Math.abs(value) - dz) / (1 - dz);
    return sign * Math.min(normalized, 1);
  }

  /**
   * 将轴值从 [-1, 1] 转换为 [0, 1]
   */
  protected normalizeToPositive(value: number): number {
    return (value + 1) / 2;
  }

  /**
   * 发射输入事件
   */
  protected emitInputEvent(event: InputEvent): void {
    this.emit('input', event);
  }

  /**
   * 发射状态变更事件
   */
  protected emitStateChange(): void {
    this.emit('stateChange', this.getState());
  }

  /**
   * 发射错误事件
   */
  protected emitError(error: Error): void {
    console.error(`[${this.name}] Error:`, error);
    this.emit('error', error);
  }
}

