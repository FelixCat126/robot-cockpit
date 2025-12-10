/**
 * 配置管理模块
 * 统一管理应用配置，支持环境变量覆盖
 */

require('dotenv').config();

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // ROS2 Bridge配置
  ros2Bridge: {
    // rosbridge_suite的WebSocket地址
    url: process.env.ROS2_BRIDGE_URL || 'ws://localhost:9090',
    // 重连配置
    reconnect: {
      enabled: true,
      interval: 3000,
      maxAttempts: 10,
    },
    // 订阅的ROS2话题列表
    topics: process.env.ROS2_TOPICS 
      ? process.env.ROS2_TOPICS.split(',')
      : [
          '/robot/status',
          '/robot/telemetry',
          '/robot/commands',
        ],
  },

  // WebSocket服务配置
  websocket: {
    // Socket.io配置
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    // 心跳配置
    pingTimeout: 60000,
    pingInterval: 25000,
  },

  // 显示模式配置
  display: {
    // 显示模式：'single' | 'multi'
    mode: process.env.DISPLAY_MODE || 'single',
    
    // 单屏模式配置
    single: {
      layout: 'grid',  // 固定为grid布局
      enablePIP: true, // 是否支持画中画（第三视角）
    },
    
    // 多屏模式配置
    multi: {
      count: parseInt(process.env.SCREEN_COUNT || '4', 10),
      // 混合显示器模式：笔记本+外接显示器
      singleDisplayMode: process.env.SINGLE_DISPLAY_MODE === 'true',
      // 笔记本屏幕宽度（自动检测或手动配置）
      // 常见分辨率：MacBook Pro 13"=2560, 14"=3024, 16"=3456
      laptopWidth: parseInt(process.env.LAPTOP_WIDTH || '0', 10), // 0 = 自动检测
      // 外接显示器窗口配置（Screen 1、2、3 并排显示）
      singleDisplayWindow: {
        width: 640,  // 每个窗口的宽度（1920/3 = 640）
        height: 1080, // 每个窗口的高度
        spacing: 0,   // 窗口之间的间距
        gap: 0,      // 窗口间隙
      },
    },
  },

  // 屏幕管理配置（兼容旧代码）
  screen: {
    // 屏幕数量
    count: parseInt(process.env.SCREEN_COUNT || '4', 10),
    // 混合显示器模式：笔记本+外接显示器
    singleDisplayMode: process.env.SINGLE_DISPLAY_MODE === 'true',
    // 笔记本屏幕宽度（自动检测或手动配置）
    laptopWidth: parseInt(process.env.LAPTOP_WIDTH || '0', 10), // 0 = 自动检测
    // 外接显示器窗口配置（Screen 1、2、3 并排显示）
    singleDisplayWindow: {
      width: 640,
      height: 1080,
      spacing: 0,
      gap: 0,
    },
    // 浏览器启动参数
    browser: {
      headless: false,
      args: [
        // 只保留最基础的参数，其他功能通过CDP实现
        
        // Ubuntu/Linux生产环境必需参数
        ...(process.platform === 'linux' ? [
          '--no-sandbox',  // Linux容器环境必需
          '--disable-dev-shm-usage',  // 防止共享内存不足
        ] : []),
      ],
    },
    // 前端应用URL
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    // 屏幕检测命令
    detectCommand: 'xrandr --listmonitors',
  },

  // 认证配置
  auth: {
    // 是否使用模拟认证（true=使用模拟，false=调用远端API）
    useMock: process.env.USE_MOCK_AUTH !== 'false',
    // 远端认证API地址（如果useMock=false）
    apiUrl: process.env.AUTH_API_URL || 'https://httpbin.org/status/200',
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
  },

  // WebRTC配置
  webrtc: {
    // WebRTC功能开关（默认关闭，不影响现有功能）
    enabled: process.env.WEBRTC_ENABLED === 'true',
    
    // 信令服务器URL（通常就是本地Express服务器）
    signalingUrl: process.env.SIGNALING_URL || 'ws://localhost:3000',
    
    // STUN/TURN服务器配置（用于NAT穿透）
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
      // TURN服务器配置（如果需要）
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: process.env.TURN_USERNAME || 'username',
      //   credential: process.env.TURN_PASSWORD || 'password',
      // },
    ],
    
    // 视频编码配置
    video: {
      codec: process.env.VIDEO_CODEC || 'H264', // H264, VP8, VP9
      maxBitrate: parseInt(process.env.VIDEO_MAX_BITRATE || '2000', 10), // kbps
      maxFrameRate: parseInt(process.env.VIDEO_MAX_FPS || '30', 10),
    },
    
    // DataChannel配置
    dataChannel: {
      ordered: true, // 保证消息顺序
      maxRetransmits: 3, // 最大重传次数
    },
  },
};

module.exports = config;

