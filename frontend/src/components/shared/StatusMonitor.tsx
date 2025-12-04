/**
 * StatusMonitor - 状态监控共享组件
 * 显示机器人状态、传感器和日志
 */

import { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import './CompactStyles.css';

interface StatusMonitorProps {
  screenId?: number;
  compact?: boolean;
  className?: string;
}

export const StatusMonitor: React.FC<StatusMonitorProps> = ({
  screenId = 0,
  compact = false,
  className = ''
}) => {
  const { } = useWebSocket({
    screenId,
    topics: ['/robot/status', '/robot/telemetry', '/robot/diagnostics'],
  });

  // 模拟状态数据
  const [robotStatus] = useState({
    name: '巡检机器人 #002',
    id: 'robot-002',
    mode: '自动模式',
    battery: 85,
    location: { x: 12.5, y: 8.3, theta: 45 },
    speed: 1.2,
    temperature: 42,
    uptime: '2天 15小时',
  });

  const [systemMetrics] = useState({
    cpu: 45,
    memory: 68,
    disk: 32,
    network: 95,
  });

  const [sensors] = useState([
    { name: 'LiDAR', status: '正常', value: '360° 扫描', icon: '📡' },
    { name: '前置摄像头', status: '正常', value: '1920x1080 @30fps', icon: '📹' },
    { name: 'IMU', status: '正常', value: '9轴数据', icon: '🧭' },
    { name: '超声波', status: '正常', value: '8个传感器', icon: '📊' },
    { name: 'GPS', status: '警告', value: '信号弱', icon: '🛰️' },
    { name: '电机驱动', status: '正常', value: '4个轮毂电机', icon: '⚙️' },
  ]);

  const [recentLogs] = useState([
    { time: '14:23:45', level: 'INFO', message: '导航任务开始执行' },
    { time: '14:23:12', level: 'WARN', message: 'GPS信号弱，切换到视觉定位' },
    { time: '14:22:58', level: 'INFO', message: '避障系统检测到障碍物' },
    { time: '14:22:30', level: 'INFO', message: '路径规划完成' },
    { time: '14:22:15', level: 'ERROR', message: '网络延迟较高' },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '正常':
        return '#10b981';
      case '警告':
        return '#f59e0b';
      case '错误':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return '#3b82f6';
      case 'WARN':
        return '#f59e0b';
      case 'ERROR':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className={`status-monitor ${compact ? 'compact' : ''} ${className}`}>
      <div className="status-content">
        {/* 基本信息卡片 */}
        <div className="status-card primary-card">
          <h2>🤖 {compact ? '状态' : '基本信息'}</h2>
          <div className={compact ? "basic-info-compact" : "basic-info-grid"}>
            {compact ? (
              // 紧凑模式：只显示关键指标
              <>
                <div className="info-item">
                  <span className="icon">🔋</span>
                  <span className="value">{robotStatus.battery}%</span>
                </div>
                <div className="info-item">
                  <span className="icon">🌡️</span>
                  <span className="value">{robotStatus.temperature}°C</span>
                </div>
                <div className="info-item">
                  <span className="icon">⚡</span>
                  <span className="value">{robotStatus.speed} m/s</span>
                </div>
              </>
            ) : (
              // 完整模式
              <>
                <div className="info-item">
                  <span className="label">机器人名称:</span>
                  <span className="value">{robotStatus.name}</span>
                </div>
                <div className="info-item">
                  <span className="label">ID:</span>
                  <span className="value">{robotStatus.id}</span>
                </div>
                <div className="info-item">
                  <span className="label">运行模式:</span>
                  <span className="value">{robotStatus.mode}</span>
                </div>
                <div className="info-item">
                  <span className="label">电池电量:</span>
                  <span className="value">{robotStatus.battery}%</span>
                </div>
                <div className="info-item">
                  <span className="label">当前速度:</span>
                  <span className="value">{robotStatus.speed} m/s</span>
                </div>
                <div className="info-item">
                  <span className="label">设备温度:</span>
                  <span className="value">{robotStatus.temperature}°C</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 系统指标 */}
        {!compact && (
          <div className="status-card">
            <h2>💻 系统性能</h2>
            <div className="metrics-grid">
              <div className="metric-item">
                <div className="metric-label">CPU</div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${systemMetrics.cpu}%`, backgroundColor: '#3b82f6' }}></div>
                </div>
                <div className="metric-value">{systemMetrics.cpu}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">内存</div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${systemMetrics.memory}%`, backgroundColor: '#10b981' }}></div>
                </div>
                <div className="metric-value">{systemMetrics.memory}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">磁盘</div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${systemMetrics.disk}%`, backgroundColor: '#f59e0b' }}></div>
                </div>
                <div className="metric-value">{systemMetrics.disk}%</div>
              </div>
              <div className="metric-item">
                <div className="metric-label">网络</div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${systemMetrics.network}%`, backgroundColor: '#8b5cf6' }}></div>
                </div>
                <div className="metric-value">{systemMetrics.network}%</div>
              </div>
            </div>
          </div>
        )}

        {/* 传感器状态 */}
        <div className="status-card">
          <h2>🔍 {compact ? '传感器' : '传感器状态'}</h2>
          <div className={compact ? "sensors-compact" : "sensors-list"}>
            {sensors.map((sensor) => (
              <div key={sensor.name} className="sensor-item">
                {compact ? (
                  // 紧凑模式：图标化显示
                  <div className="sensor-icon" title={`${sensor.name}: ${sensor.status}`}>
                    <span style={{ color: getStatusColor(sensor.status) }}>
                      {sensor.icon}
                    </span>
                  </div>
                ) : (
                  // 完整模式
                  <>
                    <div className="sensor-info">
                      <span className="sensor-icon">{sensor.icon}</span>
                      <span className="sensor-name">{sensor.name}</span>
                    </div>
                    <div className="sensor-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(sensor.status) }}
                      >
                        {sensor.status}
                      </span>
                      <span className="sensor-value">{sensor.value}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 日志 */}
        {!compact && (
          <div className="status-card logs-card">
            <h2>📝 诊断日志</h2>
            <div className="logs-container">
              {recentLogs.map((log, index) => (
                <div key={index} className="log-entry">
                  <span className="log-time">{log.time}</span>
                  <span 
                    className="log-level"
                    style={{ color: getLogLevelColor(log.level) }}
                  >
                    {log.level}
                  </span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

