/**
 * 通信服务统一接口
 * WebSocket和WebRTC都必须实现这个接口，保证应用层API一致性
 */

export interface ICommunicationService {
  // ========== 连接管理 ==========
  /**
   * 连接到服务器/远端机器人
   */
  connect(): void;

  /**
   * 断开连接
   */
  disconnect(): void;

  /**
   * 获取连接状态
   */
  isConnected(): boolean;

  // ========== 事件系统 ==========
  /**
   * 注册事件监听器
   * @param event 事件名称 (connected, disconnected, topic_data, error等)
   * @param callback 回调函数
   */
  on(event: string, callback: Function): void;

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param callback 回调函数
   */
  off(event: string, callback: Function): void;

  /**
   * 触发事件
   * @param event 事件名称
   * @param args 事件参数
   */
  emit(event: string, ...args: any[]): void;

  // ========== ROS话题操作 ==========
  /**
   * 订阅ROS话题
   * @param topic 话题名称 (如 /robot/status)
   * @param type 消息类型 (可选)
   */
  subscribeTopic(topic: string, type?: string): void;

  /**
   * 取消订阅ROS话题
   * @param topic 话题名称
   */
  unsubscribeTopic(topic: string): void;

  /**
   * 发布消息到ROS话题
   * @param topic 话题名称
   * @param message 消息内容
   * @param type 消息类型 (可选)
   */
  publishTopic(topic: string, message: any, type?: string): void;

  // ========== 屏幕管理 ==========
  /**
   * 注册屏幕ID (用于多屏同步)
   * @param screenId 屏幕编号
   */
  registerScreen(screenId: number): void;

  // ========== 视频流管理 (WebRTC专用) ==========
  /**
   * 绑定视频元素 (WebRTC模式下使用)
   * @param videoElement HTML视频元素
   */
  attachVideoElement?(videoElement: HTMLVideoElement): void;

  /**
   * 获取连接统计信息
   */
  getStats?(): Promise<any>;
}

/**
 * 话题数据接口
 */
export interface TopicData {
  topic: string;
  data: any;
  timestamp: number;
}

/**
 * WebRTC配置接口
 */
export interface WebRTCConfig {
  signalingUrl: string;
  iceServers: RTCIceServer[];
  robotId?: string;
}

