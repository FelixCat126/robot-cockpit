# WebRTC 配置和使用说明

## 功能概述

项目现已支持通过 WebRTC 与远端机器人直接通信，可自动在 WebSocket 和 WebRTC 之间切换。

## 架构说明

```
Web端 (前端)
  ↓
通信工厂 (CommunicationFactory)
  ↓
  ├─→ WebSocket 模式 (通过后端 ROS2 Bridge)
  │   Web端 ←→ 后端 ←→ ROS2 Bridge ←→ 本地机器人
  │
  └─→ WebRTC 模式 (P2P 直连远端机器人)
      Web端 ←→ 后端(信令) ←→ 远端机器人
              ↓
         WebRTC P2P 连接建立
              ↓
      Web端 ←====P2P====> 远端机器人
```

## 配置步骤

### 1. 前端配置

创建 `frontend/.env` 文件：

```env
# 通信模式: websocket | webrtc
VITE_COMMUNICATION_MODE=webrtc

# WebSocket 服务器地址
VITE_WS_SERVER_URL=http://localhost:3000

# WebRTC 信令服务器地址
VITE_WEBRTC_SIGNALING_URL=http://localhost:3000

# 机器人配置 API（可选，留空使用本地配置）
VITE_ROBOT_CONFIG_API=
```

### 2. 后端配置

创建 `backend/.env` 文件：

```env
# 服务器端口
PORT=3000

# 显示模式
DISPLAY_MODE=single

# 启用 WebRTC
WEBRTC_ENABLED=true

# ROS2 Bridge（WebSocket 模式需要）
ROS2_BRIDGE_URL=ws://localhost:9090
```

### 3. 机器人配置

编辑 `frontend/src/config/robots.ts`：

```typescript
export const robotConfigs: Record<string, RobotConfig> = {
  'robot-beijing-01': {
    id: 'robot-beijing-01',
    name: '北京机器人-01',
    webrtc: {
      signalingUrl: 'http://localhost:3000',
      robotIp: '192.168.1.100',  // ← 修改为实际 IP
      robotPort: 8080,            // ← 修改为实际端口
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    },
  },
};
```

## 使用方法

### 自动模式（推荐）

系统会自动根据机器人配置选择通信方式：

```typescript
// 选择机器人后自动连接
await communicationFactory.connectToRobot('robot-beijing-01');

// 自动选择：
// - 如果机器人配置了 WebRTC → 使用 WebRTC
// - 否则 → 使用 WebSocket
```

### 手动指定模式

```typescript
// 强制使用 WebRTC
await communicationFactory.connectToRobot('robot-beijing-01', 'webrtc');

// 强制使用 WebSocket
await communicationFactory.connectToRobot('robot-beijing-01', 'websocket');
```

### 切换机器人

```typescript
// 断开当前机器人
communicationFactory.disconnectRobot();

// 连接新机器人
await communicationFactory.connectToRobot('robot-beijing-02');
```

## 注册远端机器人

如果机器人配置动态变化，可通过 API 注册：

```bash
# 注册机器人到后端
curl -X POST http://localhost:3000/api/webrtc/register-robot \
  -H "Content-Type: application/json" \
  -d '{
    "robotId": "robot-beijing-01",
    "ip": "192.168.1.100",
    "port": 8080,
    "protocol": "http"
  }'
```

## 远端机器人要求

远端机器人需要实现以下 WebRTC 接口：

### 1. 接收 Offer（必需）

```
POST /webrtc/offer
Content-Type: application/json

{
  "sdp": { ... },
  "timestamp": 1234567890
}

响应:
{
  "sdp": { ... }  // Answer
}
```

### 2. 接收 ICE 候选（必需）

```
POST /webrtc/ice
Content-Type: application/json

{
  "candidate": { ... },
  "timestamp": 1234567890
}
```

### 3. WebRTC 数据通道

- 通道名称: `robot-data`
- 用途: 接收控制指令、发送机器人状态
- 消息格式: JSON

```json
// Web端 → 机器人（控制指令）
{
  "op": "publish",
  "topic": "/cmd_vel",
  "msg": { ... }
}

// 机器人 → Web端（状态数据）
{
  "op": "publish",
  "topic": "/robot/status",
  "msg": { ... }
}
```

### 4. 媒体流

- 视频流: 通过 WebRTC 发送
- 音频流: 通过 WebRTC 发送

## 测试

### 测试 WebSocket 模式（确保不受影响）

```bash
# 1. 设置环境变量
export VITE_COMMUNICATION_MODE=websocket

# 2. 启动前端
cd frontend
npm run dev

# 3. 启动后端（需要 ROS2 Bridge）
cd backend
npm start

# 4. 验证功能正常
```

### 测试 WebRTC 模式

```bash
# 1. 设置环境变量
export VITE_COMMUNICATION_MODE=webrtc

# 2. 启动前端
cd frontend
npm run dev

# 3. 启动后端
cd backend
npm start

# 4. 注册机器人
curl -X POST http://localhost:3000/api/webrtc/register-robot \
  -H "Content-Type: application/json" \
  -d '{"robotId": "robot-beijing-01", "ip": "192.168.1.100", "port": 8080}'

# 5. 登录并选择机器人
```

## 监控连接状态

```typescript
// 获取连接统计
const stats = await communicationFactory.getConnectionStats();

// 监听连接事件
const service = communicationFactory.getService();

service.on('connected', () => {
  console.log('已连接');
});

service.on('disconnected', () => {
  console.log('已断开');
});

service.on('error', (error) => {
  console.error('错误:', error);
});
```

## 故障排查

### 问题 1: WebRTC 连接失败

**症状:** 无法建立 WebRTC 连接

**解决:**
1. 检查远端机器人是否支持 WebRTC
2. 检查网络防火墙是否阻止 UDP
3. 尝试配置 TURN 服务器

### 问题 2: WebSocket 模式不工作

**症状:** 切换回 WebSocket 模式后无法连接

**解决:**
1. 确认 ROS2 Bridge 正在运行
2. 检查 `ROS2_BRIDGE_URL` 配置
3. 查看后端日志

### 问题 3: 切换机器人失败

**症状:** 无法切换到其他机器人

**解决:**
1. 先调用 `disconnectRobot()` 断开当前连接
2. 确保新机器人配置正确
3. 检查后端是否已注册新机器人

## 性能优化建议

1. **NAT 穿透:** 配置 STUN/TURN 服务器
2. **延迟优化:** 使用 H.264 编码（延迟最低）
3. **带宽控制:** 根据网络情况调整视频码率
4. **重连机制:** 已内置自动重连（最多 10 次）

## 安全注意事项

1. **信令安全:** 生产环境使用 HTTPS/WSS
2. **认证:** 建议在信令层添加认证
3. **加密:** WebRTC 默认加密（DTLS/SRTP）
