/**
 * 键盘设备适配器
 * 提供键盘作为备用控制方案（开发/调试）
 */

import { BasePeripheralDevice } from './BasePeripheralDevice';
import {
  PeripheralType,
  PeripheralStatus,
  PeripheralState,
  PeripheralConfig,
  InputEvent,
  InputEventType,
} from '../../types/peripheral.types';

export class KeyboardDevice extends BasePeripheralDevice {
  private pressedKeys: Set<string> = new Set();
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config?: PeripheralConfig) {
    super('keyboard', PeripheralType.KEYBOARD, 'Keyboard', config);
  }

  async connect(): Promise<void> {
    this.updateStatus(PeripheralStatus.CONNECTING);

    // 键盘按下
    this.keyDownHandler = (e: KeyboardEvent) => {
      // 避免重复触发（长按）
      if (this.pressedKeys.has(e.key)) {
        return;
      }

      this.pressedKeys.add(e.key);

      const event: InputEvent = {
        type: InputEventType.KEY_DOWN,
        timestamp: Date.now(),
        deviceId: this.id,
        deviceType: this.type,
        key: e.key,
      };

      this.emitInputEvent(event);
    };

    // 键盘松开
    this.keyUpHandler = (e: KeyboardEvent) => {
      this.pressedKeys.delete(e.key);

      const event: InputEvent = {
        type: InputEventType.KEY_UP,
        timestamp: Date.now(),
        deviceId: this.id,
        deviceType: this.type,
        key: e.key,
      };

      this.emitInputEvent(event);
    };

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    this.updateStatus(PeripheralStatus.CONNECTED);
    console.log('✅ [Keyboard] 键盘控制已启用');
  }

  async disconnect(): Promise<void> {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }

    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler);
      this.keyUpHandler = null;
    }

    this.pressedKeys.clear();
    this.updateStatus(PeripheralStatus.DISCONNECTED);
    console.log('❌ [Keyboard] 键盘控制已禁用');
  }

  getState(): PeripheralState {
    return {
      deviceId: this.id,
      deviceType: this.type,
      deviceName: this.name,
      status: this._status,
      timestamp: Date.now(),
      axes: [],
      buttons: [],
      keys: new Set(this.pressedKeys),
    };
  }
}

