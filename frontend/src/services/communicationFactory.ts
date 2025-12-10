/**
 * 通信服务工厂
 * 支持运行时动态切换通信方式（WebSocket/WebRTC）
 * 根据机器人配置自动选择最佳通信方式
 */

import { ICommunicationService, WebRTCConfig } from './communication.interface';
import websocketService from './websocket';
import webrtcService from './webrtc';
import { RobotConfig, getRobotConfig, fetchRobotConfigFromCloud } from '../config/robots';

export type CommunicationMode = 'websocket' | 'webrtc';

class CommunicationFactory {
  private currentMode: CommunicationMode = 'websocket';
  private currentService: ICommunicationService = websocketService;
  private currentRobotId: string | null = null;

  /**
   * 获取当前使用的通信服务
   */
  getService(): ICommunicationService {
    return this.currentService;
  }

  /**
   * 获取当前通信模式
   */
  getCurrentMode(): CommunicationMode {
    return this.currentMode;
  }

  /**
   * 获取当前连接的机器人ID
   */
  getCurrentRobotId(): string | null {
    return this.currentRobotId;
  }

  /**
   * 切换到指定的通信模式
   */
  async switchMode(mode: CommunicationMode): Promise<void> {
    if (this.currentMode === mode) {
      console.log(`[CommunicationFactory] Already in ${mode} mode`);
      return;
    }

    console.log(`[CommunicationFactory] Switching from ${this.currentMode} to ${mode}`);

    // 断开当前连接
    if (this.currentService.isConnected()) {
      this.currentService.disconnect();
    }

    // 切换服务
    this.currentMode = mode;
    this.currentService = mode === 'webrtc' ? webrtcService : websocketService;

    console.log(`[CommunicationFactory] Switched to ${mode} mode`);
  }

  /**
   * 为指定机器人创建连接
   * 自动根据机器人配置选择通信方式
   * 
   * TODO: 临时跳过实际连接，待远端机器人就绪后启用
   */
  async connectToRobot(robotId: string, preferredMode?: CommunicationMode): Promise<void> {
    console.log(`[CommunicationFactory] Connecting to robot: ${robotId}`);

    // ========== 临时方案：跳过实际连接 ==========
    // TODO: 远端机器人就绪后，删除此段代码，启用下方的完整连接流程
    console.log(`[CommunicationFactory] [DEV MODE] Skipping actual connection, robot selected: ${robotId}`);
    this.currentRobotId = robotId;
    this.currentMode = 'websocket'; // 默认标记为 websocket 模式
    return;
    // ========== 临时方案结束 ==========

    // ========== 完整连接流程（暂时禁用）==========
    // eslint-disable-next-line no-unreachable
    try {
      // 1. 获取机器人配置（优先从云端获取）
      let robotConfig = await fetchRobotConfigFromCloud(robotId);
      if (!robotConfig) {
        robotConfig = getRobotConfig(robotId);
      }

      if (!robotConfig) {
        throw new Error(`Robot configuration not found: ${robotId}`);
      }

      // 2. 确定通信模式
      const mode = preferredMode || this.detectBestMode(robotConfig);
      console.log(`[CommunicationFactory] Using ${mode} mode for robot ${robotId}`);

      // 3. 切换到对应模式
      await this.switchMode(mode);

      // 4. 配置并连接服务
      if (mode === 'webrtc') {
        // 配置 WebRTC
        const webrtcConfig: Partial<WebRTCConfig> = {
          signalingUrl: robotConfig.webrtc.signalingUrl,
          iceServers: robotConfig.webrtc.iceServers,
          robotId: robotConfig.id,
        };
        webrtcService.updateConfig(webrtcConfig);
        webrtcService.connect();
      } else {
        // 配置 WebSocket
        // WebSocket 会自动连接到后端，后端负责与机器人通信
        websocketService.connect();
      }

      this.currentRobotId = robotId;
      console.log(`[CommunicationFactory] Connected to robot: ${robotId}`);
    } catch (error) {
      console.error('[CommunicationFactory] Failed to connect to robot:', error);
      throw error;
    }
    // ========== 完整连接流程结束 ==========
  }

  /**
   * 断开当前机器人连接
   */
  disconnectRobot(): void {
    console.log(`[CommunicationFactory] Disconnecting from robot: ${this.currentRobotId}`);
    
    if (this.currentService.isConnected()) {
      this.currentService.disconnect();
    }
    
    this.currentRobotId = null;
  }

  /**
   * 检测最佳通信模式
   * 根据机器人配置和环境变量自动选择
   */
  private detectBestMode(robotConfig: RobotConfig): CommunicationMode {
    // 1. 检查环境变量
    const forceMode = import.meta.env.VITE_COMMUNICATION_MODE as CommunicationMode | undefined;
    if (forceMode === 'webrtc' || forceMode === 'websocket') {
      console.log(`[CommunicationFactory] Using forced mode from env: ${forceMode}`);
      return forceMode;
    }

    // 2. 检查机器人配置
    if (robotConfig.webrtc) {
      console.log('[CommunicationFactory] Robot supports WebRTC, using WebRTC mode');
      return 'webrtc';
    }

    // 3. 默认使用 WebSocket
    console.log('[CommunicationFactory] Defaulting to WebSocket mode');
    return 'websocket';
  }

  /**
   * 获取连接统计信息
   */
  async getConnectionStats(): Promise<any> {
    if (this.currentMode === 'webrtc' && webrtcService.getStats) {
      return await webrtcService.getStats();
    }
    return null;
  }
}

// 导出单例
const communicationFactory = new CommunicationFactory();
export default communicationFactory;

// 向后兼容：导出当前服务
export const getCommunicationService = () => communicationFactory.getService();
