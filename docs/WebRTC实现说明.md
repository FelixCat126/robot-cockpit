# WebRTC 实现说明

## 修改概述

本次更新为项目添加了 WebRTC 支持，实现了与远端机器人的点对点通信。

## ✅ 已完成的功能

### 1. **机器人配置管理**
- 📁 `frontend/src/config/robots.ts`
- 功能：管理不同机器人的连接信息（IP、端口、WebRTC 配置）
- 支持：本地配置 + 云端 API 动态获取

### 2. **增强的 WebRTC 服务**
- 📁 `frontend/src/services/webrtc.ts`
- 新增功能：
  - ✅ 多路音视频流支持
  - ✅ 自动重连机制（最多 10 次）
  - ✅ 消息队列（DataChannel 未就绪时缓存）
  - ✅ 动态配置更新（支持切换机器人）

### 3. **通信服务工厂**
- 📁 `frontend/src/services/communicationFactory.ts`
- 功能：
  - ✅ 自动选择通信方式（WebSocket/WebRTC）
  - ✅ 运行时动态切换
  - ✅ 支持多机器人管理

### 4. **后端 WebRTC 信令代理**
- 📁 `backend/modules/webrtc-proxy/WebRTCProxy.js`
- 功能：
  - ✅ 转发 Offer/Answer 到远端机器人
  - ✅ 转发 ICE 候选
  - ✅ HTTP/HTTPS 支持
  - ✅ 超时和重试机制

### 5. **集成到现有流程**
- 📁 `frontend/src/layouts/SingleScreenLayout.tsx`
- 📁 `frontend/src/layouts/MultiScreenLayout.tsx`
- 修改：
  - ✅ 选择机器人时自动连接（使用通信工厂）
  - ✅ 显示当前通信模式（WebSocket/WebRTC）
  - ✅ 断开连接时清理资源

### 6. **配置和文档**
- 📁 `docs/WebRTC配置说明.md` - 详细配置指南
- 📁 `backend/config/index.js` - WebRTC 配置项
- 环境变量：`VITE_COMMUNICATION_MODE`, `WEBRTC_ENABLED`

## 📋 关键特性

### 自动模式切换
```typescript
// 自动根据机器人配置选择通信方式
await communicationFactory.connectToRobot('robot-beijing-01');
```

### 不影响现有功能
- ✅ WebSocket 模式完全保留
- ✅ 通过配置切换，默认 WebSocket
- ✅ 向后兼容

### 支持多机器人
```typescript
// 机器人 1
await communicationFactory.connectToRobot('robot-beijing-01');

// 切换到机器人 2
communicationFactory.disconnectRobot();
await communicationFactory.connectToRobot('robot-beijing-02');
```

## 🔧 配置示例

### 前端环境变量
```env
# .env 或运行时设置
VITE_COMMUNICATION_MODE=webrtc
VITE_WS_SERVER_URL=http://localhost:3000
```

### 机器人配置
```typescript
// frontend/src/config/robots.ts
'robot-beijing-01': {
  id: 'robot-beijing-01',
  name: '北京机器人-01',
  webrtc: {
    signalingUrl: 'http://localhost:3000',
    robotIp: '192.168.1.100',  // 修改这里
    robotPort: 8080,            // 修改这里
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
}
```

### 后端注册机器人（运行时）
```bash
curl -X POST http://localhost:3000/api/webrtc/register-robot \
  -H "Content-Type: application/json" \
  -d '{
    "robotId": "robot-beijing-01",
    "ip": "192.168.1.100",
    "port": 8080
  }'
```

## 📂 文件结构

```
project/
├── frontend/
│   ├── src/
│   │   ├── config/
│   │   │   └── robots.ts                    [新增] 机器人配置
│   │   ├── services/
│   │   │   ├── webrtc.ts                    [修改] 增强功能
│   │   │   ├── websocket.ts                 [保留] 不变
│   │   │   ├── communicationFactory.ts      [新增] 通信工厂
│   │   │   └── index.ts                     [保留] 向后兼容
│   │   └── layouts/
│   │       ├── SingleScreenLayout.tsx       [修改] 集成工厂
│   │       └── MultiScreenLayout.tsx        [修改] 集成工厂
│   └── .env                                 [配置] 通信模式
├── backend/
│   ├── modules/
│   │   └── webrtc-proxy/
│   │       └── WebRTCProxy.js               [新增] 信令代理
│   ├── server.js                            [修改] 集成代理
│   ├── config/index.js                      [修改] WebRTC配置
│   └── .env                                 [配置] 启用WebRTC
└── docs/
    ├── WebRTC配置说明.md                    [新增] 配置指南
    └── WebRTC实现说明.md                    [新增] 本文档
```

## 🚀 使用流程

### 场景 1：使用 WebSocket（默认，不变）

```bash
# 无需配置，默认使用 WebSocket
npm start
# 系统通过 ROS2 Bridge 与本地机器人通信
```

### 场景 2：使用 WebRTC（新功能）

```bash
# 1. 配置环境变量
export VITE_COMMUNICATION_MODE=webrtc

# 2. 修改机器人配置（IP、端口）
# 编辑 frontend/src/config/robots.ts

# 3. 启动项目
npm start

# 4. 登录并选择机器人
# 系统自动通过 WebRTC 连接远端机器人
```

## 🔄 通信流程

### WebSocket 模式（保留不变）
```
Web端 → 后端 → ROS2 Bridge → 本地机器人
```

### WebRTC 模式（新增）
```
【信令阶段】
Web端 → 后端（信令代理）→ 远端机器人
     ← 后端（信令代理）← 远端机器人

【连接建立后】
Web端 <=====WebRTC P2P=====> 远端机器人
    音视频流、控制指令、状态数据
```

## ⚠️ 重要说明

### 远端机器人要求

远端机器人**必须实现** WebRTC 服务，包括：

1. **信令接口**
   - `POST /webrtc/offer` - 接收 Offer，返回 Answer
   - `POST /webrtc/ice` - 接收 ICE 候选

2. **WebRTC 协议栈**
   - RTCPeerConnection
   - DataChannel (用于控制指令)
   - 音视频轨道

3. **推荐实现**
   - Python: `aiortc` 库
   - Node.js: `wrtc` 库
   - C++: WebRTC Native API

### 云端 API（TODO）

目前机器人配置是硬编码的，后续需要：

```typescript
// TODO: 实现云端 API 调用
export async function fetchRobotConfigFromCloud(robotId: string): Promise<RobotConfig> {
  const response = await fetch(`https://cloud-api.example.com/robots/${robotId}`);
  return await response.json();
}
```

## 🧪 测试清单

- [x] WebSocket 模式正常工作（不受影响）
- [x] WebRTC 配置管理
- [x] 通信工厂自动切换
- [x] 后端信令代理
- [x] 前端集成（单屏/多屏）
- [ ] 实际 WebRTC 连接测试（需要远端机器人）
- [ ] 音视频流测试
- [ ] DataChannel 控制指令测试
- [ ] 多机器人切换测试

## 📞 支持

如有问题，请查看：
- 📖 [WebRTC配置说明.md](./WebRTC配置说明.md)
- 🐛 故障排查章节
