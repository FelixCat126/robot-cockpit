/**
 * ControlPanel - 控制面板共享组件
 * 可在多屏模式和单屏模式中复用
 */

import { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getIcon } from '../ControlIcons';
import './CompactStyles.css';

interface ControlPanelProps {
  screenId?: number;
  compact?: boolean;
  className?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  screenId = 0, 
  compact = false,
  className = ''
}) => {
  const { connected, publish } = useWebSocket({
    screenId,
    topics: ['/robot/commands'],
  });
  const [selectedCommand, setSelectedCommand] = useState<string>('');

  // 控制命令列表
  const commandCategories = [
    {
      title: '基本控制',
      commands: [
        { id: 'start', label: '启动', color: '#10b981' },
        { id: 'stop', label: '停止', color: '#ef4444' },
        { id: 'pause', label: '暂停', color: '#f59e0b' },
        { id: 'resume', label: '继续', color: '#3b82f6' },
      ],
    },
    {
      title: '运动控制',
      commands: [
        { id: 'forward', label: '前进', color: '#3b82f6' },
        { id: 'backward', label: '后退', color: '#3b82f6' },
        { id: 'left', label: '左转', color: '#3b82f6' },
        { id: 'right', label: '右转', color: '#3b82f6' },
      ],
    },
    {
      title: '任务控制',
      commands: [
        { id: 'patrol', label: '巡检任务', color: '#8b5cf6' },
        { id: 'clean', label: '清洁任务', color: '#8b5cf6' },
        { id: 'transport', label: '运输任务', color: '#8b5cf6' },
        { id: 'return', label: '返回基站', color: '#8b5cf6' },
      ],
    },
    {
      title: '紧急控制',
      commands: [
        { id: 'emergency_stop', label: '紧急停止', color: '#dc2626' },
        { id: 'reset', label: '系统重置', color: '#f59e0b' },
      ],
    },
  ];

  // 发送命令
  const handleSendCommand = (commandId: string) => {
    const command = {
      type: commandId,
      timestamp: new Date().toISOString(),
      screenId: screenId,
    };
    
    if (connected && publish) {
      publish('/robot/commands', command);
      console.log('[ControlPanel] 发送命令:', command);
    } else {
      console.warn('[ControlPanel] WebSocket未连接，无法发送命令');
    }
    
    setSelectedCommand(commandId);
  };

  return (
    <div className={`control-panel ${compact ? 'compact' : ''} ${className}`}>
      <div className="control-content">
        {commandCategories.map((category) => (
          <div key={category.title} className="command-category">
            {!compact && <h2 className="category-title">{category.title}</h2>}
            <div className="command-grid">
              {category.commands.map((cmd) => {
                const IconComponent = getIcon(cmd.id);
                return (
                  <button
                    key={cmd.id}
                    className={`command-button ${selectedCommand === cmd.id ? 'active' : ''}`}
                    style={{
                      borderColor: cmd.color,
                      backgroundColor: selectedCommand === cmd.id ? cmd.color : 'transparent',
                    }}
                    onClick={() => handleSendCommand(cmd.id)}
                    title={cmd.label}
                  >
                    <span className="command-icon">
                      <IconComponent 
                        size={compact ? 24 : 36} 
                        color={selectedCommand === cmd.id ? 'white' : cmd.color} 
                      />
                    </span>
                    {!compact && <span className="command-label">{cmd.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {selectedCommand && !compact && (
          <div className="command-feedback">
            <div className="feedback-icon">✅</div>
            <div className="feedback-text">
              命令已发送: <strong>{selectedCommand}</strong>
            </div>
          </div>
        )}

        {!connected && (
          <div className="warning-message">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              ROS2未连接
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

