/**
 * WebSocket服务
 * 负责与后端WebSocket服务器通信
 * 设计为独立服务，可替换不同的WebSocket实现
 */

import { io, Socket } from 'socket.io-client';

export interface TopicData {
  topic: string;
  data: any;
  timestamp: number;
}

/**
 * 简单的事件发射器实现（浏览器环境）
 */
class EventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }
}

class WebSocketService extends EventEmitter {
  private socket: Socket | null = null;
  private isConnectedFlag: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:3000') {
    super();
    this.serverUrl = serverUrl;
  }

  /**
   * 连接到WebSocket服务器
   */
  connect(): void {
    if (this.isConnectedFlag) {
      console.warn('[WebSocket] Already connected');
      return;
    }

    // 连接WebSocket
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnectedFlag = true;
      this.reconnectAttempts = 0;
      // WebSocket已连接
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnectedFlag = false;
      console.log(`[WebSocket] Disconnected: ${reason}`);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error('[WebSocket] Connection error:', error.message);
      this.emit('error', error);
    });

    // 接收话题数据
    this.socket.on('topic_data', (data: TopicData) => {
      this.emit('topic_data', data);
      // 也发送特定话题的事件
      this.emit(`topic:${data.topic}`, data.data);
    });

    // 屏幕注册响应
    this.socket.on('screen_registered', (data: { screenId: number; success: boolean; error?: string }) => {
      if (data.success) {
        // 屏幕已注册
        this.emit('screen_registered', data);
      } else {
        console.error(`[WebSocket] Screen registration failed: ${data.error}`);
        this.emit('screen_registration_error', data);
      }
    });

    // 心跳响应
    this.socket.on('pong', (data: { timestamp: number }) => {
      this.emit('pong', data);
    });

    // 认证状态变化事件
    this.socket.on('auth_status_change', (data: { isAuthenticated: boolean; username?: string; timestamp: number }) => {
      // 收到认证状态变更事件
      this.emit('auth_status_change', data);
    });

    // 机器人选择事件
    this.socket.on('robot_selected', (data: { robotId: string; timestamp: number }) => {
      // 收到机器人选择事件
      this.emit('robot_selected', data);
    });

    // 用户退出登录事件
    this.socket.on('user_logged_out', (data: { timestamp: number }) => {
      // 收到用户登出事件
      this.emit('user_logged_out', data);
    });

    // 取消机器人选择事件
    this.socket.on('robot_deselected', (data: { timestamp: number }) => {
      // 收到机器人取消选择事件
      this.emit('robot_deselected', data);
    });
  }

  /**
   * 注册屏幕ID
   */
  registerScreen(screenId: number): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot register screen: not connected');
      return;
    }

    this.socket.emit('register_screen', { screenId });
  }

  /**
   * 订阅ROS2话题
   */
  subscribeTopic(topic: string, type?: string): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot subscribe: not connected');
      return;
    }

    this.socket.emit('subscribe_topic', { topic, type });
    // 已订阅话题
  }

  /**
   * 取消订阅ROS2话题
   */
  unsubscribeTopic(topic: string): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot unsubscribe: not connected');
      return;
    }

    this.socket.emit('unsubscribe_topic', { topic });
    // 已取消订阅话题
  }

  /**
   * 发布消息到ROS2话题
   */
  publishTopic(topic: string, message: any, type: string = 'std_msgs/String'): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot publish: not connected');
      return;
    }

    this.socket.emit('publish_topic', { topic, message, type });
  }

  /**
   * 发送心跳
   */
  ping(): void {
    if (!this.socket || !this.isConnectedFlag) {
      return;
    }

    this.socket.emit('ping');
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnectedFlag = false;
      // WebSocket已断开
    }
  }

  /**
   * 选择机器人（发送到后端）
   */
  selectRobot(robotId: string): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot select robot: not connected');
      return;
    }

    // 发送选择机器人事件
    this.socket.emit('select_robot', { robotId, timestamp: Date.now() });
  }

  /**
   * 退出登录（发送到后端）
   */
  logout(): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot logout: not connected');
      return;
    }

    // 发送登出事件
    this.socket.emit('user_logout', { timestamp: Date.now() });
  }

  /**
   * 取消机器人选择（发送到后端）
   */
  deselectRobot(): void {
    if (!this.socket || !this.isConnectedFlag) {
      console.warn('[WebSocket] Cannot deselect robot: not connected');
      return;
    }

    // 发送取消选择机器人事件
    this.socket.emit('deselect_robot', { timestamp: Date.now() });
  }

  /**
   * 获取连接状态
   */
  getStatus(): { connected: boolean; serverUrl: string } {
    return {
      connected: this.isConnectedFlag,
      serverUrl: this.serverUrl,
    };
  }
}

// 创建单例实例
const getServerUrl = (): string => {
  // 使用类型断言访问环境变量
  const env = (import.meta as any).env;
  return env?.VITE_WS_SERVER_URL || 'http://localhost:3000';
};

const websocketService = new WebSocketService(getServerUrl());

export default websocketService;

