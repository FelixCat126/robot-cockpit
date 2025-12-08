/**
 * 外设输入系统类型定义
 * 支持多种外设类型的统一接口
 */

/**
 * 外设类型枚举
 */
export enum PeripheralType {
  GAMEPAD = 'gamepad',      // 游戏手柄/飞行摇杆
  KEYBOARD = 'keyboard',    // 键盘（备用/调试）
  HID = 'hid',             // 通用HID设备
  SERIAL = 'serial',       // 串口设备
  USB = 'usb',             // USB设备
  CUSTOM = 'custom',       // 自定义设备
}

/**
 * 外设连接状态
 */
export enum PeripheralStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 输入事件类型
 */
export enum InputEventType {
  AXIS_CHANGE = 'axis_change',      // 轴向变化（摇杆/踏板）
  BUTTON_DOWN = 'button_down',      // 按钮按下
  BUTTON_UP = 'button_up',          // 按钮松开
  BUTTON_HOLD = 'button_hold',      // 按钮持续按住
  KEY_DOWN = 'key_down',            // 键盘按下
  KEY_UP = 'key_up',                // 键盘松开
}

/**
 * 轴向输入数据
 */
export interface AxisInput {
  index: number;           // 轴索引
  value: number;           // 值 [-1.0, 1.0] 或 [0.0, 1.0]
  rawValue: number;        // 原始值（未处理死区）
  name?: string;           // 轴名称（如 'leftStickX'）
}

/**
 * 按钮输入数据
 */
export interface ButtonInput {
  index: number;           // 按钮索引
  pressed: boolean;        // 是否按下
  value: number;           // 按压力度 [0.0, 1.0]
  touched?: boolean;       // 是否触摸（部分设备支持）
  name?: string;           // 按钮名称（如 'A', 'B'）
}

/**
 * 输入事件
 */
export interface InputEvent {
  type: InputEventType;
  timestamp: number;
  deviceId: string;
  deviceType: PeripheralType;
  
  // 可选数据（根据事件类型）
  axis?: AxisInput;
  button?: ButtonInput;
  key?: string;
}

/**
 * 外设状态快照
 */
export interface PeripheralState {
  deviceId: string;
  deviceType: PeripheralType;
  deviceName: string;
  status: PeripheralStatus;
  timestamp: number;
  
  // 输入状态
  axes: AxisInput[];
  buttons: ButtonInput[];
  keys?: Set<string>;       // 当前按下的键（仅键盘）
}

/**
 * 外设配置
 */
export interface PeripheralConfig {
  deadzone?: number;        // 死区阈值 [0.0, 1.0]
  sampleRate?: number;      // 采样频率 (Hz)
  buttonDebounce?: number;  // 按钮防抖时间 (ms)
  axisMapping?: Record<number, string>;    // 轴映射（索引→名称）
  buttonMapping?: Record<number, string>;  // 按钮映射（索引→名称）
}

/**
 * 机器人命令类型
 */
export enum RobotCommandType {
  VELOCITY = 'velocity',          // 速度控制
  POSITION = 'position',          // 位置控制
  ACTION = 'action',              // 动作触发
  EMERGENCY_STOP = 'emergency',   // 急停
  CUSTOM = 'custom',              // 自定义命令
}

/**
 * 机器人命令
 */
export interface RobotCommand {
  type: RobotCommandType;
  topic: string;              // ROS话题
  messageType: string;        // ROS消息类型
  payload: any;               // 消息内容
  priority?: number;          // 优先级（0-10，越大越高）
}

/**
 * 输入映射规则
 */
export interface InputMappingRule {
  id: string;
  name: string;
  description?: string;
  
  // 触发条件
  trigger: {
    type: InputEventType;
    deviceType?: PeripheralType;  // 可选：限定设备类型
    axisIndex?: number;            // 轴索引
    buttonIndex?: number;          // 按钮索引
    key?: string;                  // 键盘按键
    threshold?: number;            // 阈值（用于轴触发）
  };
  
  // 生成的命令
  command: RobotCommand | ((event: InputEvent) => RobotCommand);
  
  // 是否启用
  enabled?: boolean;
}

/**
 * 外设设备接口（抽象）
 */
export interface IPeripheralDevice {
  readonly id: string;
  readonly type: PeripheralType;
  readonly name: string;
  readonly status: PeripheralStatus;
  
  /**
   * 连接设备
   */
  connect(): Promise<void>;
  
  /**
   * 断开设备
   */
  disconnect(): Promise<void>;
  
  /**
   * 获取当前状态
   */
  getState(): PeripheralState;
  
  /**
   * 设置配置
   */
  setConfig(config: Partial<PeripheralConfig>): void;
  
  /**
   * 监听事件
   */
  on(event: 'input', listener: (event: InputEvent) => void): void;
  on(event: 'stateChange', listener: (state: PeripheralState) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  
  /**
   * 移除监听
   */
  off(event: string, listener: Function): void;
}

