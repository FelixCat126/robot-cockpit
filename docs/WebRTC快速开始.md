# WebRTC 快速开始指南

## 🎯 核心要点

### 1. 已实现的功能
✅ **通信工厂** - 自动选择 WebSocket 或 WebRTC  
✅ **多机器人支持** - 切换机器人自动切换配置  
✅ **信令代理** - 后端转发信令到远端机器人  
✅ **不影响现有功能** - WebSocket 模式完全保留  

### 2. 关键概念
- **双方都需要 WebRTC** - Web 端和远端机器人都要实现
- **信令交换** - 通过后端中转 Offer/Answer/ICE
- **P2P 连接** - 建立后数据直接在双方之间传输
- **自动切换** - 根据机器人配置自动选择通信方式

## 🚀 快速开始

### 步骤 1: 配置机器人信息

编辑 `frontend/src/config/robots.ts`：

```typescript
export const robotConfigs = {
  'robot-beijing-01': {
    id: 'robot-beijing-01',
    name: '北京机器人-01',
    webrtc: {
      signalingUrl: 'http://localhost:3000',
      robotIp: '192.168.1.100',  // ← 改成你的机器人IP
      robotPort: 8080,            // ← 改成你的机器人端口
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    },
  },
};
```

### 步骤 2: 启用 WebRTC 模式

**方式 1: 环境变量（推荐）**
```bash
# 前端
export VITE_COMMUNICATION_MODE=webrtc

# 后端
export WEBRTC_ENABLED=true
```

**方式 2: 修改代码**
```typescript
// frontend/src/services/communicationFactory.ts
// 已自动根据机器人配置选择，无需修改
```

### 步骤 3: 注册机器人到后端（可选）

```bash
curl -X POST http://localhost:3000/api/webrtc/register-robot \
  -H "Content-Type: application/json" \
  -d '{
    "robotId": "robot-beijing-01",
    "ip": "192.168.1.100",
    "port": 8080
  }'
```

### 步骤 4: 启动项目

```bash
# 启动后端
cd backend
npm start

# 启动前端
cd frontend
npm run dev
```

### 步骤 5: 使用

1. 打开浏览器访问 `http://localhost:5173`
2. 登录（手机号: `13800138000`, 验证码: `123456`）
3. 选择机器人 `robot-beijing-01`
4. 系统自动通过 WebRTC 连接
5. 查看页面标题栏显示 `(WEBRTC)` 表示已连接

## 📋 核心文件说明

### 前端

| 文件 | 说明 |
|------|------|
| `config/robots.ts` | 机器人配置（IP、端口等）|
| `services/communicationFactory.ts` | 通信工厂（自动切换）|
| `services/webrtc.ts` | WebRTC 服务实现 |
| `services/websocket.ts` | WebSocket 服务（保留不变）|

### 后端

| 文件 | 说明 |
|------|------|
| `modules/webrtc-proxy/WebRTCProxy.js` | 信令代理 |
| `server.js` | 集成信令代理 |
| `config/index.js` | WebRTC 配置 |

## ⚙️ 配置说明

### 通信模式

```env
# WebSocket 模式（默认，通过 ROS2 Bridge）
VITE_COMMUNICATION_MODE=websocket

# WebRTC 模式（直连远端机器人）
VITE_COMMUNICATION_MODE=webrtc
```

### 机器人配置来源

**当前：本地硬编码**
```typescript
// frontend/src/config/robots.ts
export const robotConfigs = { ... };
```

**未来：云端 API**
```typescript
// TODO: 实现
const config = await fetchRobotConfigFromCloud(robotId);
```

## 🔧 远端机器人要求

远端机器人必须实现以下接口：

### 1. WebRTC 信令接口

```
POST /webrtc/offer
{
  "sdp": { ... },
  "timestamp": 1234567890
}

响应:
{
  "sdp": { ... }  // Answer
}
```

```
POST /webrtc/ice
{
  "candidate": { ... },
  "timestamp": 1234567890
}
```

### 2. WebRTC 协议栈

- RTCPeerConnection
- RTCDataChannel (通道名: `robot-data`)
- 音视频轨道

### 3. 推荐实现

**Python (推荐)**
```python
pip install aiortc

from aiortc import RTCPeerConnection, RTCSessionDescription
# ... 实现代码
```

**Node.js**
```bash
npm install wrtc

const { RTCPeerConnection } = require('wrtc');
# ... 实现代码
```

## 🔄 工作流程

### 连接流程

```
1. 用户选择机器人 → robot-beijing-01

2. 通信工厂获取机器人配置
   - IP: 192.168.1.100
   - Port: 8080
   - 通信方式: WebRTC

3. 前端 WebRTC 创建 Offer

4. 通过后端信令代理发送到远端机器人
   后端 → HTTP POST → 192.168.1.100:8080/webrtc/offer

5. 远端机器人返回 Answer

6. 后端转发 Answer 到前端

7. 交换 ICE 候选

8. WebRTC P2P 连接建立

9. 数据直接在 Web 端和机器人之间传输
```

### 数据传输

**控制指令（Web → 机器人）**
```json
{
  "op": "publish",
  "topic": "/cmd_vel",
  "msg": { "linear": {"x": 1.0}, "angular": {"z": 0.5} }
}
```

**机器人状态（机器人 → Web）**
```json
{
  "op": "publish",
  "topic": "/robot/status",
  "msg": { "battery": 85, "temperature": 42 }
}
```

**音视频流**
- 通过 WebRTC MediaStream
- 自动附加到 VideoPlayer/AudioPlayer

## 🐛 常见问题

### Q1: 选择机器人后无法连接

**检查：**
1. 机器人 IP/端口是否正确？
2. 远端机器人是否支持 WebRTC？
3. 网络是否可达？

```bash
# 测试连通性
ping 192.168.1.100
curl http://192.168.1.100:8080/webrtc/offer
```

### Q2: 显示 WebSocket 而不是 WebRTC

**原因：**
- 环境变量未设置
- 或机器人配置缺少 WebRTC 配置

**解决：**
```bash
export VITE_COMMUNICATION_MODE=webrtc
```

### Q3: WebSocket 模式不工作了

**确认：**
- WebSocket 模式完全独立
- 不受 WebRTC 代码影响

**测试：**
```bash
export VITE_COMMUNICATION_MODE=websocket
npm run dev
```

### Q4: 北京到南京延迟多少？

**预期：**
- 距离: 约 900-1000 公里
- 延迟: 20-50ms（完全可接受）
- 丢包: <1%

## 📚 相关文档

- [WebRTC配置说明.md](./WebRTC配置说明.md) - 详细配置
- [WebRTC实现说明.md](./WebRTC实现说明.md) - 技术实现

## 🎉 总结

✅ **现在你可以：**
1. 通过 WebRTC 连接远端机器人
2. 自动在 WebSocket/WebRTC 之间切换
3. 支持多个机器人（不同 IP/端口）
4. 不影响任何现有功能

✅ **下一步：**
1. 在远端机器人实现 WebRTC 服务
2. 配置机器人 IP 和端口
3. 启用 WebRTC 模式
4. 测试连接
