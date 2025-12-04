/**
 * PM2 Ecosystem配置文件
 * 用于开机自启动和进程管理（推荐用于开发和小型部署）
 */

module.exports = {
  apps: [{
    name: 'robot-cockpit',
    script: './backend/server.js',
    cwd: '/opt/robot-cockpit',
    
    // 实例配置
    instances: 1,
    exec_mode: 'fork',
    
    // 自动重启
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DISPLAY_MODE: 'single',  // 或 'multi'
    },
    
    // 单屏模式环境变量
    env_single: {
      NODE_ENV: 'production',
      PORT: 3000,
      DISPLAY_MODE: 'single',
    },
    
    // 多屏模式环境变量
    env_multi: {
      NODE_ENV: 'production',
      PORT: 3000,
      DISPLAY_MODE: 'multi',
    },
    
    // 日志配置
    error_file: '/var/log/robot-cockpit/error.log',
    out_file: '/var/log/robot-cockpit/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 启动延迟
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000,
    
    // 资源限制
    max_restarts: 10,
    min_uptime: '10s',
  }]
};

