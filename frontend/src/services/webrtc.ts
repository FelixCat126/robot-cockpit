/**
 * WebRTC通信服务
 * 实现ICommunicationService接口，与远端ROS机器人建立P2P连接
 */

import { io, Socket } from 'socket.io-client';
import { ICommunicationService, TopicData, WebRTCConfig } from './communication.interface';

class WebRTCService implements ICommunicationService {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingSocket: Socket | null = null;
  private config: WebRTCConfig;
  private eventCallbacks: Map<string, Function[]> = new Map();
  private isConnectedFlag: boolean = false;
  private videoElements: Map<string, HTMLVideoElement> = new Map(); // 支持多路视频
  private audioElements: Map<string, HTMLAudioElement> = new Map(); // 支持多路音频
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private pendingMessages: any[] = []; // 队列待发送的消息

  constructor(config?: Partial<WebRTCConfig>) {
    this.config = {
      signalingUrl: config?.signalingUrl || 'http://localhost:3000',
      iceServers: config?.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      robotId: config?.robotId || 'default-robot',
    };
  }

  // ========== 连接管理 ==========

  connect(): void {
    if (this.isConnectedFlag) {
      console.warn('[WebRTC] Already connected');
      return;
    }

    console.log('[WebRTC] Starting connection...');
    this.connectSignaling();
  }

  disconnect(): void {
    console.log('[WebRTC] Disconnecting...');
    
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.dataChannel?.close();
    this.pc?.close();
    this.signalingSocket?.disconnect();
    
    // 清理视频和音频元素
    this.videoElements.clear();
    this.audioElements.clear();
    
    this.isConnectedFlag = false;
    this.reconnectAttempts = 0;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  // ========== 事件系统 ==========

  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(...args);
        } catch (error) {
          console.error(`[WebRTC] Error in ${event} callback:`, error);
        }
      });
    }
  }

  // ========== ROS话题操作 ==========

  subscribeTopic(topic: string, type?: string): void {
    console.log(`[WebRTC] Subscribing to topic: ${topic}`);
    
    // 通过DataChannel告诉远端需要订阅这个话题
    if (this.dataChannel?.readyState === 'open') {
      this.sendViaDataChannel({
        op: 'subscribe',
        topic,
        type,
        id: `sub_${Date.now()}`,
      });
    } else {
      console.warn('[WebRTC] DataChannel not ready, queuing subscription');
      // 可以实现队列机制，等DataChannel打开后再发送
    }
  }

  unsubscribeTopic(topic: string): void {
    console.log(`[WebRTC] Unsubscribing from topic: ${topic}`);
    
    if (this.dataChannel?.readyState === 'open') {
      this.sendViaDataChannel({
        op: 'unsubscribe',
        topic,
      });
    }
  }

  publishTopic(topic: string, message: any, type?: string): void {
    if (this.dataChannel?.readyState === 'open') {
      this.sendViaDataChannel({
        op: 'publish',
        topic,
        msg: message,
        type,
      });
    } else {
      console.warn('[WebRTC] Cannot publish: DataChannel not ready');
    }
  }

  // ========== 屏幕管理 ==========

  registerScreen(_screenId: number): void {
    // WebRTC模式下，screenId不需要存储（只用于多屏WebSocket同步）
    console.log(`[WebRTC] Screen registration acknowledged (not used in WebRTC mode)`);
  }

  // ========== 视频流管理 ==========

  attachVideoElement(videoElement: HTMLVideoElement, streamId: string = 'default'): void {
    this.videoElements.set(streamId, videoElement);
    console.log(`[WebRTC] Video element attached: ${streamId}`);
  }

  detachVideoElement(streamId: string = 'default'): void {
    this.videoElements.delete(streamId);
    console.log(`[WebRTC] Video element detached: ${streamId}`);
  }

  // ========== 音频流管理 ==========

  attachAudioElement(audioElement: HTMLAudioElement, streamId: string = 'default'): void {
    this.audioElements.set(streamId, audioElement);
    console.log(`[WebRTC] Audio element attached: ${streamId}`);
  }

  detachAudioElement(streamId: string = 'default'): void {
    this.audioElements.delete(streamId);
    console.log(`[WebRTC] Audio element detached: ${streamId}`);
  }

  async getStats(): Promise<any> {
    if (!this.pc) return null;

    const stats = await this.pc.getStats();
    const result: any = {};

    stats.forEach((report) => {
      result[report.id] = report;
    });

    return result;
  }

  // ========== 私有方法：信令交换 ==========

  private connectSignaling(): void {
    console.log(`[WebRTC] Connecting to signaling server: ${this.config.signalingUrl}`);
    
    this.signalingSocket = io(this.config.signalingUrl, {
      transports: ['websocket', 'polling'],
    });

    this.signalingSocket.on('connect', () => {
      console.log('[WebRTC] Signaling connected');
      
      // 注册为客户端
      this.signalingSocket!.emit('register', {
        role: 'client',
        robotId: this.config.robotId,
      });

      // 创建PeerConnection
      this.createPeerConnection();
    });

    this.signalingSocket.on('answer', async (data: any) => {
      console.log('[WebRTC] Received answer from robot');
      try {
        await this.pc!.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (error) {
        console.error('[WebRTC] Failed to set remote description:', error);
      }
    });

    this.signalingSocket.on('ice-candidate', async (data: any) => {
      if (data.candidate && this.pc) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('[WebRTC] Failed to add ICE candidate:', error);
        }
      }
    });

    this.signalingSocket.on('disconnect', () => {
      console.log('[WebRTC] Signaling disconnected');
      this.isConnectedFlag = false;
      this.emit('disconnected');
      
      // 尝试重连
      this.attemptReconnect();
    });

    this.signalingSocket.on('error', (error: any) => {
      console.error('[WebRTC] Signaling error:', error);
      this.emit('error', error);
    });
  }

  // ========== 私有方法：PeerConnection ==========

  private createPeerConnection(): void {
    console.log('[WebRTC] Creating PeerConnection');

    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // ICE候选事件
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingSocket?.emit('ice-candidate', {
          candidate: event.candidate,
          robotId: this.config.robotId,
        });
      }
    };

    // 连接状态变化
    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc?.connectionState);
      
      if (this.pc?.connectionState === 'connected') {
        this.isConnectedFlag = true;
        this.emit('connected');
      } else if (this.pc?.connectionState === 'disconnected' || 
                 this.pc?.connectionState === 'failed') {
        this.isConnectedFlag = false;
        this.emit('disconnected');
      }
    };

    // ICE连接状态
    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.pc?.iceConnectionState);
    };

    // 接收远端视频流和音频流
    this.pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind, 'streamId:', event.streams[0]?.id);
      
      if (event.streams[0]) {
        const stream = event.streams[0];
        const streamId = stream.id;
        
        if (event.track.kind === 'video') {
          // 视频流
          const videoElement = this.videoElements.get('default') || this.videoElements.get(streamId);
          if (videoElement) {
            videoElement.srcObject = stream;
            console.log('[WebRTC] Video stream attached to element');
          }
          this.emit('video_stream', { stream, streamId, track: event.track });
        } else if (event.track.kind === 'audio') {
          // 音频流
          const audioElement = this.audioElements.get('default') || this.audioElements.get(streamId);
          if (audioElement) {
            audioElement.srcObject = stream;
            console.log('[WebRTC] Audio stream attached to element');
          }
          this.emit('audio_stream', { stream, streamId, track: event.track });
        }
      }
    };

    // 创建数据通道
    this.createDataChannel();

    // 创建Offer
    this.createOffer();
  }

  private createDataChannel(): void {
    if (!this.pc) return;

    this.dataChannel = this.pc.createDataChannel('robot-data', {
      ordered: true,
      maxRetransmits: 3,
    });

    this.dataChannel.onopen = () => {
      console.log('[WebRTC] DataChannel opened');
      this.emit('datachannel_open');
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
      this.emit('datachannel_close');
    };

    this.dataChannel.onerror = (error) => {
      console.error('[WebRTC] DataChannel error:', error);
      this.emit('datachannel_error', error);
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleDataChannelMessage(message);
      } catch (error) {
        console.error('[WebRTC] Failed to parse DataChannel message:', error);
      }
    };
  }

  private async createOffer(): Promise<void> {
    if (!this.pc) return;

    try {
      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });

      await this.pc.setLocalDescription(offer);

      // 通过信令服务器发送Offer
      this.signalingSocket?.emit('offer', {
        sdp: offer,
        robotId: this.config.robotId,
      });

      console.log('[WebRTC] Offer sent');
    } catch (error) {
      console.error('[WebRTC] Failed to create offer:', error);
      this.emit('error', error);
    }
  }

  // ========== 私有方法：数据通道消息处理 ==========

  private handleDataChannelMessage(message: any): void {
    // 处理来自远端机器人的消息
    if (message.op === 'publish') {
      // ROS话题数据
      const topicData: TopicData = {
        topic: message.topic,
        data: message.msg,
        timestamp: message.timestamp || Date.now(),
      };

      this.emit('topic_data', topicData);
    } else if (message.op === 'status') {
      // 状态消息
      console.log('[WebRTC] Robot status:', message.level, message.msg);
    }
  }

  private sendViaDataChannel(message: any): void {
    if (this.dataChannel?.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message));
        // 发送成功后清理队列
        this.flushPendingMessages();
      } catch (error) {
        console.error('[WebRTC] Failed to send via DataChannel:', error);
      }
    } else {
      // DataChannel 未就绪，加入队列
      console.warn('[WebRTC] DataChannel not ready, queueing message');
      this.pendingMessages.push(message);
    }
  }

  // ========== 私有方法：重连和队列管理 ==========

  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebRTC] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`[WebRTC] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      console.log('[WebRTC] Reconnecting...');
      this.connect();
    }, delay);
  }

  /**
   * 刷新待发送消息队列
   */
  private flushPendingMessages(): void {
    if (this.pendingMessages.length === 0) return;
    
    console.log(`[WebRTC] Flushing ${this.pendingMessages.length} pending messages`);
    
    while (this.pendingMessages.length > 0 && this.dataChannel?.readyState === 'open') {
      const message = this.pendingMessages.shift();
      try {
        this.dataChannel.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebRTC] Failed to send pending message:', error);
        // 重新加入队列
        this.pendingMessages.unshift(message);
        break;
      }
    }
  }

  // ========== 公共方法：配置管理 ==========

  /**
   * 更新配置（支持动态切换机器人）
   */
  updateConfig(config: Partial<WebRTCConfig>): void {
    console.log('[WebRTC] Updating configuration:', config);
    
    const wasConnected = this.isConnectedFlag;
    
    // 如果正在连接，先断开
    if (wasConnected) {
      this.disconnect();
    }
    
    // 更新配置
    this.config = {
      ...this.config,
      ...config,
    };
    
    // 如果之前已连接，重新连接
    if (wasConnected) {
      setTimeout(() => {
        this.connect();
      }, 1000);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): WebRTCConfig {
    return { ...this.config };
  }
}

// 导出单例
export default new WebRTCService();

