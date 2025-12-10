/**
 * 机器人云端 API 服务
 * 从云端获取当前用户绑定的机器人列表及配置
 */

export interface RobotWebRTCInfo {
  // 信令服务器地址（通过我们的后端中转）
  signalingUrl: string;
  // 远端机器人的 IP 地址
  robotIp: string;
  // 远端机器人的端口
  robotPort: number;
  // 协议（http/https）
  protocol?: string;
  // STUN/TURN 服务器配置
  iceServers: RTCIceServer[];
}

export interface CloudRobotConfig {
  id: string;
  name: string;
  description?: string;
  status?: 'online' | 'offline' | 'busy';
  // WebRTC 连接信息
  webrtc: RobotWebRTCInfo;
  // 可选的备用 WebSocket 配置
  websocket?: {
    url: string;
  };
  // 其他扩展信息
  [key: string]: any;
}

export interface RobotListResponse {
  success: boolean;
  data: CloudRobotConfig[];
  message?: string;
}

/**
 * 机器人 API 配置
 */
const API_CONFIG = {
  // 云端 API 基础地址（从环境变量读取）
  baseUrl: import.meta.env.VITE_ROBOT_API_URL || 'http://localhost:3000/api',
  // 超时时间（毫秒）
  timeout: 10000,
};

/**
 * HTTP 请求工具（带超时）
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = API_CONFIG.timeout): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 从云端获取当前用户绑定的机器人列表
 */
export async function fetchRobotList(): Promise<CloudRobotConfig[]> {
  try {
    console.log('[RobotAPI] Fetching robot list from cloud...');

    // 从 localStorage 获取用户 token
    const token = localStorage.getItem('robot_cockpit_token');
    if (!token) {
      console.warn('[RobotAPI] No token found, using empty list');
      return [];
    }

    const response = await fetchWithTimeout(`${API_CONFIG.baseUrl}/robots`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: RobotListResponse = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Invalid response format');
    }

    console.log(`[RobotAPI] Fetched ${result.data.length} robots from cloud`);
    
    // 缓存到 localStorage（可选）
    localStorage.setItem('robot_cockpit_robot_list_cache', JSON.stringify({
      data: result.data,
      timestamp: Date.now(),
    }));

    return result.data;
  } catch (error) {
    console.error('[RobotAPI] Failed to fetch robot list:', error);
    
    // 尝试从缓存读取
    const cached = getCachedRobotList();
    if (cached.length > 0) {
      console.log(`[RobotAPI] Using cached robot list (${cached.length} robots)`);
      return cached;
    }
    
    throw error;
  }
}

/**
 * 获取指定机器人的详细配置
 */
export async function fetchRobotConfig(robotId: string): Promise<CloudRobotConfig | null> {
  try {
    console.log(`[RobotAPI] Fetching config for robot: ${robotId}`);

    const token = localStorage.getItem('robot_cockpit_token');
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetchWithTimeout(`${API_CONFIG.baseUrl}/robots/${robotId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Invalid response format');
    }

    console.log(`[RobotAPI] Fetched config for robot: ${robotId}`);
    return result.data;
  } catch (error) {
    console.error(`[RobotAPI] Failed to fetch config for robot ${robotId}:`, error);
    
    // 尝试从缓存的列表中查找
    const cached = getCachedRobotList();
    const robot = cached.find(r => r.id === robotId);
    if (robot) {
      console.log(`[RobotAPI] Using cached config for robot: ${robotId}`);
      return robot;
    }
    
    return null;
  }
}

/**
 * 从缓存读取机器人列表
 */
function getCachedRobotList(): CloudRobotConfig[] {
  try {
    const cached = localStorage.getItem('robot_cockpit_robot_list_cache');
    if (!cached) return [];

    const { data, timestamp } = JSON.parse(cached);
    
    // 缓存有效期：5分钟
    const CACHE_VALIDITY = 5 * 60 * 1000;
    if (Date.now() - timestamp > CACHE_VALIDITY) {
      console.log('[RobotAPI] Cache expired');
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[RobotAPI] Failed to read cache:', error);
    return [];
  }
}

/**
 * 清除缓存的机器人列表
 */
export function clearRobotListCache(): void {
  localStorage.removeItem('robot_cockpit_robot_list_cache');
  console.log('[RobotAPI] Cache cleared');
}

/**
 * 注册机器人到后端（用于 WebRTC 信令代理）
 */
export async function registerRobotToBackend(robotConfig: CloudRobotConfig): Promise<void> {
  try {
    console.log(`[RobotAPI] Registering robot to backend: ${robotConfig.id}`);

    const response = await fetchWithTimeout(`${API_CONFIG.baseUrl}/webrtc/register-robot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        robotId: robotConfig.id,
        ip: robotConfig.webrtc.robotIp,
        port: robotConfig.webrtc.robotPort,
        protocol: robotConfig.webrtc.protocol || 'http',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`[RobotAPI] Robot registered to backend: ${robotConfig.id}`);
  } catch (error) {
    console.error(`[RobotAPI] Failed to register robot to backend:`, error);
    throw error;
  }
}
