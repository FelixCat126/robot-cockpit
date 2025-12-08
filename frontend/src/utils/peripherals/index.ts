/**
 * 外设控制系统统一导出
 */

// 类型定义
export * from '../../types/peripheral.types';

// 设备类
export { BasePeripheralDevice } from './BasePeripheralDevice';
export { GamepadDevice } from './GamepadDevice';
export { KeyboardDevice } from './KeyboardDevice';

// 管理器
export { PeripheralManager, createDefaultPeripheralManager } from './PeripheralManager';

// 输入映射
export { InputMapper, createDefaultInputMapping } from './InputMapper';

