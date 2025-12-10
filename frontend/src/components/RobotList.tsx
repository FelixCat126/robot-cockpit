/**
 * 机器人列表组件
 * 登录后在操作屏显示，用于选择要操作的机器人
 */

import { useState } from 'react';
import './RobotList.css';

interface Robot {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  battery: number;
  location: string;
  lastSeen: string;
}

interface RobotListProps {
  onSelectRobot: (robotId: string) => void;
}

// 模拟机器人数据
const mockRobots: Robot[] = [
  {
    id: 'robot-001',
    name: '巡检机器人 #001',
    status: 'online',
    battery: 85,
    location: '1号厂房',
    lastSeen: '刚刚',
  },
  {
    id: 'robot-002',
    name: '运输机器人 #002',
    status: 'online',
    battery: 92,
    location: '2号厂房',
    lastSeen: '2分钟前',
  },
  {
    id: 'robot-003',
    name: '巡检机器人 #003',
    status: 'busy',
    battery: 68,
    location: '3号厂房',
    lastSeen: '5分钟前',
  },
  {
    id: 'robot-004',
    name: '清洁机器人 #004',
    status: 'offline',
    battery: 15,
    location: '充电站',
    lastSeen: '30分钟前',
  },
];

function RobotList({ onSelectRobot }: RobotListProps) {
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);

  const handleSelectRobot = (robotId: string) => {
    setSelectedRobotId(robotId);
    onSelectRobot(robotId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#4ade80'; // 绿色
      case 'offline':
        return '#6b7280'; // 灰色
      case 'busy':
        return '#fbbf24'; // 黄色
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'busy':
        return '忙碌';
      default:
        return '未知';
    }
  };

  return (
    <div className="robot-list-container">
      <div className="robot-list-header">
        <h1>连接机器人</h1>
        <p className="subtitle">请选择要连接的机器人</p>
      </div>

      <div className="robot-grid">
        {mockRobots.map((robot) => (
          <div
            key={robot.id}
            className={`robot-card ${selectedRobotId === robot.id ? 'selected' : ''} ${robot.status}`}
            onClick={() => robot.status !== 'offline' && handleSelectRobot(robot.id)}
          >
            <div className="robot-card-header">
              <h3>{robot.name}</h3>
              <div className="status-badge" style={{ backgroundColor: getStatusColor(robot.status) }}>
                {getStatusText(robot.status)}
              </div>
            </div>

            <div className="robot-card-body">
              <div className="info-row">
                <span className="label">电量:</span>
                <div className="battery-container">
                  <div className="battery-bar" style={{ width: `${robot.battery}%` }}>
                    <span className="battery-text">{robot.battery}%</span>
                  </div>
                </div>
              </div>

              <div className="info-row">
                <span className="label">位置:</span>
                <span className="value">{robot.location}</span>
              </div>

              <div className="info-row">
                <span className="label">最后通信:</span>
                <span className="value">{robot.lastSeen}</span>
              </div>
            </div>

            <div className="robot-card-footer">
              <button
                className="select-button"
                disabled={robot.status === 'offline'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectRobot(robot.id);
                }}
              >
                {robot.status === 'offline' ? '不可用' : selectedRobotId === robot.id ? '已连接' : '连接'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RobotList;

