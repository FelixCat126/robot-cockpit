/**
 * 通信服务统一导出
 * 根据配置选择WebSocket或WebRTC，对应用层透明
 */

import { ICommunicationService } from './communication.interface';
import websocketService from './websocket';
import webrtcService from './webrtc';

// 从环境变量读取配置
const USE_WEBRTC = import.meta.env.VITE_USE_WEBRTC === 'true';

// 导出统一的服务实例
export const communicationService: ICommunicationService = USE_WEBRTC 
  ? webrtcService 
  : websocketService;

// 打印当前使用的通信方式
console.log(`[CommunicationService] Using ${USE_WEBRTC ? 'WebRTC' : 'WebSocket'} mode`);

// 默认导出（向后兼容）
export default communicationService;

// 同时导出两种实现，方便测试和切换
export { websocketService, webrtcService };

// 导出接口和类型
export type { ICommunicationService, TopicData, WebRTCConfig } from './communication.interface';

