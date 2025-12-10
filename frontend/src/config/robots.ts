/**
 * 机器人配置管理
 * 管理不同机器人的连接信息（IP、端口、WebRTC配置等）
 */

export interface RobotConfig {
  id: string;
  name: string;
  description?: string;
  // WebRTC 连接配置
  webrtc: {
    // 远端机器人的信令服务器地址
    signalingUrl: string;
    // 远端机器人的 IP 地址
    robotIp: string;
    // 远端机器人的端口
    robotPort: number;
    // STUN/TURN 服务器配置
    iceServers: RTCIceServer[];
  };
  // 备用：WebSocket 连接配置（如果 WebRTC 不可用）
  websocket?: {
    url: string;
  };
}

/**
 * 机器人配置列表
 * TODO: 后续从云端 API 获取
 */
export const robotConfigs: Record<string, RobotConfig> = {
  'robot-beijing-01': {
    id: 'robot-beijing-01',
    name: '北京机器人-01',
    description: '测试机器人（北京）',
    webrtc: {
      // 信令服务器地址（通过我们的后端中转）
      signalingUrl: 'http://localhost:3000',
      // 远端机器人的实际地址（暂时写死，后续从 API 获取）
      robotIp: '192.168.1.100',
      robotPort: 8080,
      // STUN/TURN 服务器
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // TURN 服务器（如果需要）
        // {
        //   urls: 'turn:turn-server.com:3478',
        //   username: 'user',
        //   credential: 'pass',
        // },
      ],
    },
    websocket: {
      url: 'http://localhost:3000',
    },
  },
  
  'robot-beijing-02': {
    id: 'robot-beijing-02',
    name: '北京机器人-02',
    description: '备用机器人（北京）',
    webrtc: {
      signalingUrl: 'http://localhost:3000',
      robotIp: '192.168.1.101',
      robotPort: 8080,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
    websocket: {
      url: 'http://localhost:3000',
    },
  },
};

/**
 * 获取机器人配置
 */
export function getRobotConfig(robotId: string): RobotConfig | null {
  return robotConfigs[robotId] || null;
}

/**
 * 从云端 API 获取机器人配置
 * TODO: 实现云端 API 调用
 */
export async function fetchRobotConfigFromCloud(robotId: string): Promise<RobotConfig | null> {
  try {
    // TODO: 替换为实际的云端 API 地址
    const apiUrl = import.meta.env.VITE_ROBOT_CONFIG_API || 'http://cloud-api.example.com/robots';
    
    const response = await fetch(`${apiUrl}/${robotId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch robot config: ${response.status}`);
    }
    
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('[RobotConfig] Failed to fetch from cloud:', error);
    // 降级到本地配置
    return getRobotConfig(robotId);
  }
}

/**
 * 获取所有可用的机器人列表
 */
export function getAllRobots(): RobotConfig[] {
  return Object.values(robotConfigs);
}

/**
 * 添加或更新机器人配置（运行时动态添加）
 */
export function updateRobotConfig(config: RobotConfig): void {
  robotConfigs[config.id] = config;
  console.log(`[RobotConfig] Updated config for robot: ${config.id}`);
}
