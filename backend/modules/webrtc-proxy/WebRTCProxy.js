/**
 * WebRTC信令代理模块
 * 负责在Web端和远端机器人之间转发WebRTC信令
 * 支持通过HTTP或WebSocket与远端机器人通信
 */

const EventEmitter = require('events');
const http = require('http');
const https = require('https');

class WebRTCProxy extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      timeout: config.timeout || 10000, // 10秒超时
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };
    
    // 存储机器人信息（robotId -> {ip, port, protocol}）
    this.robots = new Map();
  }

  /**
   * 注册机器人信息
   */
  registerRobot(robotId, robotInfo) {
    const { ip, port, protocol = 'http' } = robotInfo;
    this.robots.set(robotId, { ip, port, protocol });
    this.log('info', `Registered robot: ${robotId} at ${protocol}://${ip}:${port}`);
  }

  /**
   * 获取机器人信息
   */
  getRobotInfo(robotId) {
    return this.robots.get(robotId);
  }

  /**
   * 转发Offer到远端机器人
   */
  async forwardOffer(robotId, offer) {
    const robotInfo = this.robots.get(robotId);
    if (!robotInfo) {
      throw new Error(`Robot not found: ${robotId}`);
    }

    this.log('info', `Forwarding offer to robot: ${robotId}`);

    try {
      const response = await this.sendToRobot(robotInfo, '/webrtc/offer', {
        sdp: offer,
        timestamp: Date.now(),
      });

      this.log('info', `Received answer from robot: ${robotId}`);
      return response;
    } catch (error) {
      this.log('error', `Failed to forward offer to robot ${robotId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 转发Answer到远端机器人（如果机器人是Offer发起方）
   */
  async forwardAnswer(robotId, answer) {
    const robotInfo = this.robots.get(robotId);
    if (!robotInfo) {
      throw new Error(`Robot not found: ${robotId}`);
    }

    this.log('info', `Forwarding answer to robot: ${robotId}`);

    try {
      await this.sendToRobot(robotInfo, '/webrtc/answer', {
        sdp: answer,
        timestamp: Date.now(),
      });

      this.log('info', `Answer forwarded to robot: ${robotId}`);
    } catch (error) {
      this.log('error', `Failed to forward answer to robot ${robotId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 转发ICE候选到远端机器人
   */
  async forwardIceCandidate(robotId, candidate) {
    const robotInfo = this.robots.get(robotId);
    if (!robotInfo) {
      this.log('warn', `Robot not found for ICE candidate: ${robotId}`);
      return;
    }

    try {
      await this.sendToRobot(robotInfo, '/webrtc/ice', {
        candidate,
        timestamp: Date.now(),
      });

      this.log('debug', `ICE candidate forwarded to robot: ${robotId}`);
    } catch (error) {
      this.log('error', `Failed to forward ICE candidate to robot ${robotId}: ${error.message}`);
    }
  }

  /**
   * 发送HTTP请求到远端机器人
   */
  sendToRobot(robotInfo, path, data) {
    return new Promise((resolve, reject) => {
      const { ip, port, protocol } = robotInfo;
      const httpModule = protocol === 'https' ? https : http;

      const postData = JSON.stringify(data);
      
      const options = {
        hostname: ip,
        port: port,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: this.config.timeout,
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const jsonData = JSON.parse(responseData);
              resolve(jsonData);
            } catch (error) {
              resolve({ success: true, data: responseData });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 日志记录
   */
  log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WebRTCProxy] [${level.toUpperCase()}] ${message}`);
  }
}

module.exports = WebRTCProxy;
