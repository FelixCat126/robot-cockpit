/**
 * 主服务器文件
 * 整合所有模块，提供统一的Web服务
 */

const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const ROS2Bridge = require('./modules/ros2-bridge/ROS2Bridge');
const WebSocketService = require('./modules/websocket/WebSocketService');
const ScreenManager = require('./modules/screen-manager/ScreenManager');

class RobotCockpitServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: config.websocket.cors,
      pingTimeout: config.websocket.pingTimeout,
      pingInterval: config.websocket.pingInterval,
    });

    // 初始化模块
    this.ros2Bridge = new ROS2Bridge(config.ros2Bridge);
    this.webSocketService = new WebSocketService(this.io);
    this.screenManager = new ScreenManager(config.screen);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupModuleIntegration();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    // 注意：静态文件中间件将在setupRoutes中的API路由之后设置
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        modules: {
          ros2Bridge: this.ros2Bridge.getStatus(),
          screens: this.screenManager.getAllBrowserStatus(),
          websocket: {
            clients: this.webSocketService.getClients().length,
          },
        },
      });
    });

    // ROS2 Bridge状态
    this.app.get('/api/ros2/status', (req, res) => {
      res.json(this.ros2Bridge.getStatus());
    });

    // 屏幕状态
    this.app.get('/api/screens', (req, res) => {
      res.json({
        screens: this.screenManager.getAllScreens(),
        browsers: this.screenManager.getAllBrowserStatus(),
      });
    });

    // 获取显示模式配置（供前端运行时读取）
    this.app.get('/api/config/display-mode', (req, res) => {
      res.json({
        mode: config.display.mode,
        timestamp: Date.now(),
        description: config.display.mode === 'single' ? '单屏Grid模式' : '多屏模式'
      });
    });

    // 前端日志收集API（用于调试）
    this.app.post('/api/debug/log', (req, res) => {
      try {
        const { level, message, data, screenId, timestamp } = req.body;
        const logPrefix = `[Frontend-Screen${screenId}] [${level.toUpperCase()}]`;
        console.log(`${logPrefix} ${message}`, data ? JSON.stringify(data) : '');
        res.json({ success: true });
      } catch (error) {
        console.error('[Debug API] Error logging frontend message:', error);
        res.status(500).json({ success: false, message: 'Log failed' });
      }
    });

    // 认证API
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          return res.status(400).json({
            success: false,
            message: '用户名和密码不能为空',
          });
        }

        // 模拟认证：调用远端API或使用模拟逻辑
        // 这里使用一个公开的测试API来模拟远端认证
        const authResult = await this.authenticateUser(username, password);

        if (authResult.success) {
          // 生成一个简单的token（实际应该使用JWT等）
          const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
          
          // 通过WebSocket广播认证状态变化到所有客户端
          this.webSocketService.broadcastAuthStatus(true, username);
          
          return res.json({
            success: true,
            token: token,
            message: '登录成功',
          });
        } else {
          return res.status(401).json({
            success: false,
            message: authResult.message || '用户名或密码错误',
          });
        }
      } catch (error) {
        console.error('[Auth] Login error:', error);
        return res.status(500).json({
          success: false,
          message: '认证服务错误，请稍后重试',
        });
      }
    });

    // 屏幕控制API
    this.app.post('/api/screens/:screenId/start', async (req, res) => {
      try {
        const screenId = parseInt(req.params.screenId, 10);
        await this.screenManager.startScreen(screenId);
        res.json({ success: true, screenId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/screens/:screenId/stop', async (req, res) => {
      try {
        const screenId = parseInt(req.params.screenId, 10);
        await this.screenManager.stopScreen(screenId);
        res.json({ success: true, screenId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/screens/:screenId/restart', async (req, res) => {
      try {
        const screenId = parseInt(req.params.screenId, 10);
        await this.screenManager.restartScreen(screenId);
        res.json({ success: true, screenId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 静态文件服务（在API路由之后，但排除index.html）
    this.app.use(express.static(path.join(__dirname, '../frontend/dist'), {
      index: false  // 不自动服务index.html
    }));

    // 前端应用路由（SPA支持 - 必须在最后，动态注入配置）
    this.app.get('*', (req, res) => {
      const fs = require('fs');
      const indexPath = path.join(__dirname, '../frontend/dist/index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      
      // 通过meta标签注入配置（更可靠）
      const configMeta = `
    <meta name="robot-cockpit-config" content='${JSON.stringify({
      displayMode: config.display.mode,
      timestamp: Date.now()
    })}'>
      `;
      
      // 在</head>之前注入
      html = html.replace('</head>', `${configMeta}</head>`);
      
      res.send(html);
    });
  }

  /**
   * 模拟用户认证（调用远端API）
   * 这里使用公开的测试API来模拟远端认证服务
   */
  async authenticateUser(username, password) {
    // 配置：使用公开的测试API或模拟认证
    const USE_MOCK = config.auth.useMock;
    const AUTH_API_URL = config.auth.apiUrl;

    if (USE_MOCK) {
      // 模拟认证逻辑
      // 配置测试账号
      const MOCK_CREDENTIALS = {
        admin: '123456',
        user: 'user123',
        test: 'test123',
      };

      // 检查是否是测试账号
      if (MOCK_CREDENTIALS[username] === password) {
        return { success: true };
      }

      // 认证失败
        return { success: false, message: '用户名或密码错误' };
    } else {
      // 调用真实的远端认证API
      return new Promise((resolve, reject) => {
        try {
          const url = new URL(AUTH_API_URL);
          const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          };

          const request = (url.protocol === 'https:' ? https : http).request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                try {
                  const jsonData = JSON.parse(data);
                  resolve({ success: true, data: jsonData });
                } catch (e) {
                  resolve({ success: true });
                }
              } else {
                resolve({ 
                  success: false, 
                  message: `认证失败: ${response.statusCode}` 
                });
              }
            });
          });

          request.on('error', (error) => {
            reject(new Error('认证服务连接失败'));
          });

          request.write(JSON.stringify({ username, password }));
          request.end();
        } catch (error) {
          reject(new Error('认证服务配置错误'));
        }
      });
    }
  }

  /**
   * 设置模块集成
   * 连接ROS2 Bridge和WebSocket服务
   */
  setupModuleIntegration() {
    // ROS2 Bridge事件处理
    this.ros2Bridge.on('connected', () => {
      console.log('[Server] ROS2 Bridge connected');
      
      // 订阅配置的话题
      config.ros2Bridge.topics.forEach(topic => {
        this.ros2Bridge.subscribe(topic);
      });
    });

    this.ros2Bridge.on('topic', ({ topic, msg, timestamp }) => {
      // 将ROS2话题数据转发到WebSocket服务
      this.webSocketService.broadcastTopicData(topic, msg);
    });

    this.ros2Bridge.on('error', (error) => {
      console.error('[Server] ROS2 Bridge error:', error);
    });

    this.ros2Bridge.on('disconnected', () => {
      console.log('[Server] ROS2 Bridge disconnected');
    });

    // WebSocket服务事件处理
    this.webSocketService.on('subscribe_topic', ({ socketId, topic, type }) => {
      // 客户端请求订阅话题
      this.ros2Bridge.subscribe(topic, type);
    });

    this.webSocketService.on('unsubscribe_topic', ({ socketId, topic }) => {
      // 客户端请求取消订阅（这里简化处理，实际应该跟踪订阅ID）
      // 注意：rosbridge_suite不支持按客户端取消订阅，这里是简化实现
    });

    this.webSocketService.on('publish_topic', ({ socketId, topic, message, type }) => {
      // 客户端请求发布消息到ROS2
      this.ros2Bridge.publish(topic, message, type);
    });

    this.webSocketService.on('client_connected', ({ socketId }) => {
      console.log(`[Server] WebSocket client connected: ${socketId}`);
    });

    this.webSocketService.on('client_disconnected', ({ socketId }) => {
      console.log(`[Server] WebSocket client disconnected: ${socketId}`);
    });
  }

  /**
   * 启动服务器
   */
  async start() {
    try {
      // 初始化屏幕管理器
      await this.screenManager.initialize();

      // 连接ROS2 Bridge
      await this.ros2Bridge.connect();

      // 启动HTTP服务器
      this.server.listen(config.server.port, config.server.host, () => {
        console.log(`[Server] HTTP server started on ${config.server.host}:${config.server.port}`);
      });

      // 根据配置启动屏幕（单屏或多屏模式）
        // 延迟启动，确保服务器完全启动
        setTimeout(async () => {
          try {
          if (config.display.mode === 'single') {
            console.log('[Server] Starting in SINGLE screen mode...');
            await this.startSingleScreenMode();
          } else {
            console.log('[Server] Starting in MULTI screen mode...');
            await this.startMultiScreenMode();
          }
          } catch (error) {
            console.error('[Server] Failed to start screens:', error);
          }
        }, 2000); // 延迟2秒

      console.log('[Server] Robot Cockpit Server started successfully');
    } catch (error) {
      console.error('[Server] Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * 启动单屏模式
   * 只启动一个浏览器窗口，显示单屏Grid布局
   */
  async startSingleScreenMode() {
    console.log('[Server] Launching single screen browser...');
    await this.screenManager.launchBrowser({
      screenId: 0,
      url: `${config.screen.frontendUrl}`,
      displayMode: 'single',
      // 居中显示，尺寸适中
      x: 100,
      y: 50,
      width: 1400,
      height: 900,
    });
    console.log('[Server] Single screen launched successfully!');
  }

  /**
   * 启动多屏模式
   * 自动启动多个浏览器窗口
   */
  async startMultiScreenMode() {
    console.log('[Server] Auto-starting multiple screens...');
    await this.screenManager.startAllScreens();
    console.log('[Server] All screens started successfully');
  }

  /**
   * 停止服务器
   */
  async stop() {
    console.log('[Server] Stopping server...');
    
    // 停止所有屏幕
    await this.screenManager.stopAllScreens();
    
    // 断开ROS2 Bridge
    this.ros2Bridge.disconnect();
    
    // 关闭HTTP服务器
    this.server.close(() => {
      console.log('[Server] Server stopped');
      process.exit(0);
    });
  }
}

// 启动服务器
const server = new RobotCockpitServer();

// 处理进程信号
process.on('SIGINT', async () => {
  await server.stop();
});

process.on('SIGTERM', async () => {
  await server.stop();
});

// 启动
server.start();

module.exports = RobotCockpitServer;

