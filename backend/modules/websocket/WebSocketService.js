/**
 * WebSocket服务模块
 * 负责前端与后端之间的实时通信
 * 作为ROS2数据和前端之间的桥梁
 */

const EventEmitter = require('events');

class WebSocketService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.clients = new Map(); // 存储客户端信息：socketId -> {screenId, connectedAt}
    this.setupSocketHandlers();
  }

  /**
   * 设置Socket.io事件处理器
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * 处理新客户端连接
   */
  handleConnection(socket) {
    const clientInfo = {
      screenId: null,
      connectedAt: new Date(),
    };
    this.clients.set(socket.id, clientInfo);

    this.log('info', `Client connected: ${socket.id}`);

    // 客户端注册屏幕ID
    socket.on('register_screen', (data) => {
      this.handleRegisterScreen(socket, data);
    });

    // 客户端请求ROS2数据
    socket.on('subscribe_topic', (data) => {
      this.handleSubscribeTopic(socket, data);
    });

    // 客户端取消订阅
    socket.on('unsubscribe_topic', (data) => {
      this.handleUnsubscribeTopic(socket, data);
    });

    // 客户端发布消息到ROS2
    socket.on('publish_topic', (data) => {
      this.handlePublishTopic(socket, data);
    });

    // 监听机器人选择事件
    socket.on('select_robot', (data) => {
      const { robotId, timestamp } = data;
      this.log('info', `Client ${socket.id} selected robot: ${robotId}`);
      // 广播机器人选择事件到所有客户端
      this.io.emit('robot_selected', { robotId, timestamp });
      this.log('info', `Broadcasted robot selection: ${robotId} to all clients`);
    });

    // 监听用户退出登录事件
    socket.on('user_logout', (data) => {
      const { timestamp } = data;
      this.log('info', `Client ${socket.id} logged out`);
      // 广播退出登录事件到所有客户端
      this.io.emit('user_logged_out', { timestamp });
      this.log('info', `Broadcasted user_logged_out to all clients`);
    });

    // 监听取消机器人选择事件
    socket.on('deselect_robot', (data) => {
      const { timestamp } = data || {};
      this.log('info', `Client ${socket.id} deselected robot`);
      // 广播取消选择事件到所有客户端
      this.io.emit('robot_deselected', { timestamp: timestamp || Date.now() });
      this.log('info', `Broadcasted robot_deselected to all clients`);
    });
    
    // ========== WebRTC信令处理（新增，不影响现有功能） ==========
    
    // WebRTC客户端/机器人注册
    socket.on('register', (data) => {
      this.handleWebRTCRegister(socket, data);
    });

    // 转发Offer（从客户端到机器人）
    socket.on('offer', (data) => {
      this.handleWebRTCOffer(socket, data);
    });

    // 转发Answer（从机器人到客户端）
    socket.on('answer', (data) => {
      this.handleWebRTCAnswer(socket, data);
    });

    // 转发ICE候选
    socket.on('ice-candidate', (data) => {
      this.handleWebRTCIceCandidate(socket, data);
    });
    
    // ========== 现有事件处理器 ==========
    
    // 客户端断开连接
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });

    // 心跳检测
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    this.emit('client_connected', { socketId: socket.id, clientInfo });
  }

  /**
   * 处理屏幕注册
   */
  handleRegisterScreen(socket, data) {
    const { screenId } = data;
    const clientInfo = this.clients.get(socket.id);

    if (clientInfo) {
      clientInfo.screenId = screenId;
      this.log('info', `Screen ${screenId} registered for client ${socket.id}`);
      socket.emit('screen_registered', { screenId, success: true });
      this.emit('screen_registered', { socketId: socket.id, screenId });
    } else {
      socket.emit('screen_registered', { success: false, error: 'Client not found' });
    }
  }

  /**
   * 处理话题订阅请求
   */
  handleSubscribeTopic(socket, data) {
    const { topic, type } = data;
    this.log('info', `Client ${socket.id} requested subscription to topic: ${topic}`);
    this.emit('subscribe_topic', { socketId: socket.id, topic, type });
  }

  /**
   * 处理取消订阅请求
   */
  handleUnsubscribeTopic(socket, data) {
    const { topic } = data;
    this.log('info', `Client ${socket.id} requested unsubscription from topic: ${topic}`);
    this.emit('unsubscribe_topic', { socketId: socket.id, topic });
  }

  /**
   * 处理发布消息请求
   */
  handlePublishTopic(socket, data) {
    const { topic, message, type } = data;
    this.log('debug', `Client ${socket.id} requested publish to topic: ${topic}`);
    
    // 触发内部事件（给ROS2Bridge等模块使用）
    this.emit('publish_topic', { socketId: socket.id, topic, message, type });
    
    // 对于音频流等实时数据，直接转发给所有订阅该话题的客户端
    // 这样即使ROS2Bridge未运行，音频流也能在前端之间传输
    if (topic === '/robot/audio/stream' || topic.includes('/audio/') || topic.includes('/video/')) {
      this.log('debug', `Broadcasting real-time data for topic: ${topic}`);
      this.broadcastTopicData(topic, message);
    }
  }

  /**
   * 处理客户端断开
   */
  handleDisconnect(socket) {
    const clientInfo = this.clients.get(socket.id);
    this.clients.delete(socket.id);
    this.log('info', `Client disconnected: ${socket.id} (Screen: ${clientInfo?.screenId || 'unknown'})`);
    this.emit('client_disconnected', { socketId: socket.id, clientInfo });
  }

  /**
   * 广播ROS2话题数据到所有客户端
   * @param {string} topic - 话题名称
   * @param {object} data - 数据内容
   */
  broadcastTopicData(topic, data) {
    this.io.emit('topic_data', {
      topic,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 广播认证状态变化到所有客户端
   * @param {boolean} isAuthenticated - 是否已认证
   * @param {string} username - 用户名（可选）
   */
  broadcastAuthStatus(isAuthenticated, username = null) {
    const authData = {
      isAuthenticated,
      username,
      timestamp: Date.now(),
    };
    
    // 详细日志：显示当前连接的所有客户端
    const connectedClients = Array.from(this.io.sockets.sockets.keys());
    this.log('info', `🔔 Broadcasting auth_status_change to ${connectedClients.length} clients: [${connectedClients.join(', ')}]`);
    this.log('info', `🔔 Auth data: isAuthenticated=${authData.isAuthenticated}, username=${authData.username}, timestamp=${authData.timestamp}`);
    
    // 广播到所有连接的客户端
    this.io.emit('auth_status_change', authData);
    
    this.log('info', `✅ Auth status broadcast completed`);
  }

  /**
   * 发送话题数据到特定屏幕
   * @param {number} screenId - 屏幕ID
   * @param {string} topic - 话题名称
   * @param {object} data - 数据内容
   */
  sendToScreen(screenId, topic, data) {
    // 找到对应屏幕的socket
    for (const [socketId, clientInfo] of this.clients) {
      if (clientInfo.screenId === screenId) {
        this.io.to(socketId).emit('topic_data', {
          topic,
          data,
          timestamp: Date.now(),
        });
        return;
      }
    }
    this.log('warn', `Screen ${screenId} not found for topic ${topic}`);
  }

  /**
   * 发送消息到特定客户端
   * @param {string} socketId - Socket ID
   * @param {string} event - 事件名称
   * @param {object} data - 数据内容
   */
  sendToClient(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * 获取所有连接的客户端信息
   */
  getClients() {
    return Array.from(this.clients.entries()).map(([socketId, info]) => ({
      socketId,
      ...info,
    }));
  }

  /**
   * 获取特定屏幕的客户端
   */
  getScreenClient(screenId) {
    for (const [socketId, clientInfo] of this.clients) {
      if (clientInfo.screenId === screenId) {
        return { socketId, ...clientInfo };
      }
    }
    return null;
  }

  /**
   * 日志记录
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WebSocketService] [${level.toUpperCase()}] ${message}`);
  }

  // ========== WebRTC信令处理方法（新增） ==========

  /**
   * 处理WebRTC注册（客户端或机器人）
   */
  handleWebRTCRegister(socket, data) {
    const { role, robotId } = data; // role: 'client' | 'robot'
    
    // 扩展客户端信息，存储WebRTC相关数据
    const clientInfo = this.clients.get(socket.id);
    if (clientInfo) {
      clientInfo.webrtcRole = role;
      clientInfo.robotId = robotId;
      this.log('info', `[WebRTC] ${role} registered: ${robotId} (socket: ${socket.id})`);
      socket.emit('registered', { success: true, role, robotId });
    } else {
      socket.emit('registered', { success: false, error: 'Client not found' });
    }
  }

  /**
   * 处理WebRTC Offer（从客户端到机器人）
   */
  handleWebRTCOffer(socket, data) {
    const { sdp, robotId } = data;
    this.log('info', `[WebRTC] Received offer for robot: ${robotId}`);

    // 查找对应的机器人socket
    const robotSocket = this.findWebRTCPeer(robotId, 'robot');
    
    if (robotSocket) {
      // 转发Offer到机器人，附上客户端ID
      robotSocket.emit('offer', {
        sdp,
        clientId: socket.id,
      });
      this.log('info', `[WebRTC] Forwarded offer to robot ${robotId}`);
    } else {
      this.log('warn', `[WebRTC] Robot not found: ${robotId}`);
      socket.emit('error', { message: `Robot ${robotId} not connected` });
    }
  }

  /**
   * 处理WebRTC Answer（从机器人到客户端）
   */
  handleWebRTCAnswer(socket, data) {
    const { sdp, clientId } = data;
    this.log('info', `[WebRTC] Received answer for client: ${clientId}`);

    // 查找对应的客户端socket
    const clientSocket = this.io.sockets.sockets.get(clientId);
    
    if (clientSocket) {
      // 转发Answer到客户端
      clientSocket.emit('answer', { sdp });
      this.log('info', `[WebRTC] Forwarded answer to client ${clientId}`);
    } else {
      this.log('warn', `[WebRTC] Client not found: ${clientId}`);
    }
  }

  /**
   * 处理ICE候选（双向转发）
   */
  handleWebRTCIceCandidate(socket, data) {
    const { candidate, robotId, targetId } = data;

    // 如果指定了targetId，直接转发到该socket
    if (targetId) {
      const targetSocket = this.io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit('ice-candidate', { candidate });
        this.log('debug', `[WebRTC] Forwarded ICE candidate to ${targetId}`);
      }
      return;
    }

    // 如果指定了robotId，查找对应的机器人或客户端
    if (robotId) {
      const clientInfo = this.clients.get(socket.id);
      const targetRole = clientInfo?.webrtcRole === 'client' ? 'robot' : 'client';
      const targetSocket = this.findWebRTCPeer(robotId, targetRole);
      
      if (targetSocket) {
        targetSocket.emit('ice-candidate', { candidate });
        this.log('debug', `[WebRTC] Forwarded ICE candidate to ${targetRole} ${robotId}`);
      }
    }
  }

  /**
   * 查找WebRTC对等端（客户端或机器人）
   */
  findWebRTCPeer(robotId, role) {
    for (const [socketId, clientInfo] of this.clients) {
      if (clientInfo.robotId === robotId && clientInfo.webrtcRole === role) {
        return this.io.sockets.sockets.get(socketId);
      }
    }
    return null;
  }

  /**
   * 获取WebRTC连接统计
   */
  getWebRTCStats() {
    const stats = {
      clients: 0,
      robots: 0,
      connections: [],
    };

    for (const [socketId, clientInfo] of this.clients) {
      if (clientInfo.webrtcRole === 'client') {
        stats.clients++;
      } else if (clientInfo.webrtcRole === 'robot') {
        stats.robots++;
      }

      if (clientInfo.webrtcRole && clientInfo.robotId) {
        stats.connections.push({
          socketId,
          role: clientInfo.webrtcRole,
          robotId: clientInfo.robotId,
          connectedAt: clientInfo.connectedAt,
        });
      }
    }

    return stats;
  }
}

module.exports = WebSocketService;

