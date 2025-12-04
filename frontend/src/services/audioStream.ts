/**
 * 音频流服务
 * 处理音频采集、编码、传输和播放
 */

import websocketService from './websocket';

class AudioStreamService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isRecording: boolean = false;
  private audioChunks: Blob[] = [];

  /**
   * 初始化音频流（采集端）
   */
  async initializeAudioCapture(): Promise<{
    stream: MediaStream;
    analyser: AnalyserNode;
  }> {
    try {
      // 请求麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
        },
      });

      // 创建音频上下文
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      
      // 创建音频源节点
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // 创建分析器节点（用于可视化）
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 64; // 32个频段
      this.analyserNode.smoothingTimeConstant = 0.8;
      
      // 连接音频节点
      this.sourceNode.connect(this.analyserNode);

      console.log('[AudioStream] Audio capture initialized');
      
      return {
        stream: this.mediaStream,
        analyser: this.analyserNode,
      };
    } catch (error) {
      console.error('[AudioStream] Failed to initialize audio capture:', error);
      throw error;
    }
  }

  /**
   * 开始音频流传输
   */
  startStreaming(robotId: string): void {
    if (!this.mediaStream) {
      console.error('[AudioStream] No media stream available');
      return;
    }

    try {
      // 使用 MediaRecorder 录制音频
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus', // 优先使用 Opus 编码
        audioBitsPerSecond: 128000, // 128 kbps
      };

      // 检查浏览器支持
      if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      this.audioChunks = [];

      // 监听数据可用事件
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          
          // 将音频数据通过 WebSocket 发送
          this.sendAudioData(event.data, robotId);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('[AudioStream] MediaRecorder error:', event);
      };

      // 每 100ms 生成一次数据
      this.mediaRecorder.start(100);
      this.isRecording = true;

      console.log('[AudioStream] Streaming started');
    } catch (error) {
      console.error('[AudioStream] Failed to start streaming:', error);
    }
  }

  /**
   * 停止音频流传输
   */
  stopStreaming(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('[AudioStream] Streaming stopped');
    }
  }

  /**
   * 发送音频数据
   */
  private async sendAudioData(audioBlob: Blob, robotId: string): Promise<void> {
    try {
      // 将 Blob 转换为 Base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      if (!base64Audio) {
        console.warn('[AudioStream] Empty audio data, skipping');
        return;
      }
      
      // 通过 WebSocket 发送
      const topic = '/robot/audio/stream';
      const messageType = 'robot_msgs/AudioStream';
      const message = {
        robotId,
        audio: base64Audio,
        timestamp: Date.now(),
        encoding: 'webm/opus',
        sampleRate: 48000,
        channels: 2,
      };
      websocketService.publishTopic(topic, message, messageType);
    } catch (error) {
      console.error('[AudioStream] Failed to send audio data:', error);
    }
  }

  /**
   * Blob 转 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const parts = reader.result.split(',');
          const base64 = parts.length > 1 ? parts[1] : '';
          resolve(base64);
        } else {
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 获取分析器节点（用于可视化）
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    this.mediaStream = null;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.isRecording = false;

    console.log('[AudioStream] Cleanup completed');
  }
}

// 音频播放服务
class AudioPlaybackService {
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;

  /**
   * 初始化音频播放
   */
  initialize(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      console.log('[AudioPlayback] Initialized');
    }
  }

  /**
   * 播放接收到的音频数据
   */
  async playAudioData(base64Audio: string, encoding: string = 'webm/opus'): Promise<void> {
    if (!this.audioContext) {
      console.log('[AudioPlayback] Initializing audio context...');
      this.initialize();
    }

    try {
      console.log('[AudioPlayback] Processing audio data:', {
        dataLength: base64Audio.length,
        encoding: encoding,
        contextState: this.audioContext?.state
      });

      // 确保 AudioContext 处于运行状态
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('[AudioPlayback] Resuming suspended audio context...');
        await this.audioContext.resume();
      }

      // Base64 转 Blob
      const mimeType = encoding.includes('/') ? `audio/${encoding}` : `audio/${encoding}`;
      const audioBlob = this.base64ToBlob(base64Audio, mimeType);
      console.log('[AudioPlayback] Created audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Blob 转 ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[AudioPlayback] Converted to ArrayBuffer:', arrayBuffer.byteLength, 'bytes');
      
      // 解码音频
      console.log('[AudioPlayback] Decoding audio data...');
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      console.log('[AudioPlayback] Audio decoded:', {
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length
      });
      
      // 播放音频
      this.playBuffer(audioBuffer);
    } catch (error) {
      console.error('[AudioPlayback] Failed to play audio:', error);
      console.error('[AudioPlayback] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }

  /**
   * 播放音频缓冲区
   */
  private playBuffer(buffer: AudioBuffer): void {
    if (!this.audioContext) {
      console.error('[AudioPlayback] Cannot play: no audio context');
      return;
    }

    console.log('[AudioPlayback] Playing buffer:', {
      duration: buffer.duration,
      isPlaying: this.isPlaying,
      queueLength: this.audioQueue.length
    });

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    source.onended = () => {
      console.log('[AudioPlayback] Buffer playback ended');
      this.isPlaying = false;
      // 播放队列中的下一个音频
      if (this.audioQueue.length > 0) {
        console.log('[AudioPlayback] Playing next buffer from queue');
        const nextBuffer = this.audioQueue.shift()!;
        this.playBuffer(nextBuffer);
      }
    };

    if (this.isPlaying) {
      // 如果正在播放，加入队列
      console.log('[AudioPlayback] Adding to queue (currently playing)');
      this.audioQueue.push(buffer);
    } else {
      // 立即播放
      console.log('[AudioPlayback] Starting playback immediately');
      source.start(0);
      this.isPlaying = true;
      this.currentSource = source;
    }
  }

  /**
   * Base64 转 Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * 停止播放
   */
  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('[AudioPlayback] Cleanup completed');
  }
}

// 导出单例
export const audioStreamService = new AudioStreamService();
export const audioPlaybackService = new AudioPlaybackService();

