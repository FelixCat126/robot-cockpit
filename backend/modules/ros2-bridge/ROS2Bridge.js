/**
 * ROS2 Bridge集成模块
 * 负责与ROS2 Bridge (rosbridge_suite) 通信
 * 设计为独立模块，可替换不同的ROS2 Bridge实现
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class ROS2Bridge extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.subscriptions = new Map(); // 存储订阅ID和话题的映射
  }

  /**
   * 连接到ROS2 Bridge
   */
  async connect() {
    if (this.isConnected) {
      this.log('warn', 'Already connected to ROS2 Bridge');
      return;
    }

    try {
      this.log('info', `Connecting to ROS2 Bridge at ${this.config.url}`);
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        this.handleOpen();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.handleError(error);
      });

      this.ws.on('close', () => {
        this.handleClose();
      });
    } catch (error) {
      this.log('error', `Failed to connect to ROS2 Bridge: ${error.message}`);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理WebSocket连接打开
   */
  handleOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.log('info', 'Connected to ROS2 Bridge');
    this.emit('connected');

    // 重新订阅之前的话题
    this.resubscribeAll();
  }

  /**
   * 处理WebSocket消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.processMessage(message);
    } catch (error) {
      this.log('error', `Failed to parse ROS2 Bridge message: ${error.message}`);
    }
  }

  /**
   * 处理ROS2 Bridge消息
   */
  processMessage(message) {
    // rosbridge_suite的消息格式
    if (message.op === 'publish') {
      // 收到话题发布消息
      this.emit('topic', {
        topic: message.topic,
        msg: message.msg,
        timestamp: Date.now(),
      });
    } else if (message.op === 'service_response') {
      // 服务响应
      this.emit('service_response', message);
    } else if (message.op === 'status') {
      // 状态消息
      this.log('debug', `ROS2 Bridge status: ${message.level} - ${message.msg}`);
    }
  }

  /**
   * 订阅ROS2话题
   * @param {string} topic - 话题名称
   * @param {string} type - 消息类型（可选）
   */
  subscribe(topic, type = null) {
    if (!this.isConnected) {
      this.log('warn', `Cannot subscribe to ${topic}: not connected`);
      return;
    }

    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      op: 'subscribe',
      id: id,
      topic: topic,
    };

    if (type) {
      message.type = type;
    }

    this.send(message);
    this.subscriptions.set(id, { topic, type });
    this.log('info', `Subscribed to topic: ${topic} (id: ${id})`);

    return id;
  }

  /**
   * 取消订阅ROS2话题
   * @param {string} subscriptionId - 订阅ID
   */
  unsubscribe(subscriptionId) {
    if (!this.isConnected) {
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.log('warn', `Subscription ${subscriptionId} not found`);
      return;
    }

    const message = {
      op: 'unsubscribe',
      id: subscriptionId,
      topic: subscription.topic,
    };

    this.send(message);
    this.subscriptions.delete(subscriptionId);
    this.log('info', `Unsubscribed from topic: ${subscription.topic}`);
  }

  /**
   * 发布消息到ROS2话题
   * @param {string} topic - 话题名称
   * @param {object} message - 消息内容
   * @param {string} type - 消息类型
   */
  publish(topic, message, type) {
    if (!this.isConnected) {
      this.log('warn', `Cannot publish to ${topic}: not connected`);
      return;
    }

    const msg = {
      op: 'publish',
      topic: topic,
      msg: message,
    };

    if (type) {
      msg.type = type;
    }

    this.send(msg);
  }

  /**
   * 调用ROS2服务
   * @param {string} service - 服务名称
   * @param {object} args - 服务参数
   * @param {string} type - 服务类型
   */
  callService(service, args, type) {
    if (!this.isConnected) {
      this.log('warn', `Cannot call service ${service}: not connected`);
      return;
    }

    const id = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      op: 'call_service',
      id: id,
      service: service,
      args: args,
    };

    if (type) {
      message.type = type;
    }

    this.send(message);
    return id;
  }

  /**
   * 发送消息到ROS2 Bridge
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      this.log('warn', 'Cannot send message: not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.log('error', `Failed to send message: ${error.message}`);
      this.emit('error', error);
    }
  }

  /**
   * 重新订阅所有话题
   */
  resubscribeAll() {
    for (const [id, { topic, type }] of this.subscriptions) {
      this.subscribe(topic, type);
    }
  }

  /**
   * 处理WebSocket错误
   */
  handleError(error) {
    this.log('error', `ROS2 Bridge WebSocket error: ${error.message}`);
    this.emit('error', error);
  }

  /**
   * 处理WebSocket关闭
   */
  handleClose() {
    this.isConnected = false;
    this.log('warn', 'ROS2 Bridge connection closed');
    this.emit('disconnected');

    if (this.config.reconnect.enabled) {
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.config.reconnect.maxAttempts > 0 && 
        this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      this.log('error', 'Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnect.interval;
    this.log('info', `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.log('info', 'Disconnected from ROS2 Bridge');
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      connected: this.isConnected,
      url: this.config.url,
      subscriptions: Array.from(this.subscriptions.values()).map(s => s.topic),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * 日志记录
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ROS2Bridge] [${level.toUpperCase()}] ${message}`);
  }
}

module.exports = ROS2Bridge;

