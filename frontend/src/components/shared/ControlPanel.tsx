/**
 * ControlPanel - 控制面板共享组件
 * 可在多屏模式和单屏模式中复用
 */

import { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getIcon } from '../ControlIcons';
import { useRobot3DStore } from '../../stores/robot3DStore';
import { PeripheralController } from './PeripheralController';
import { PeripheralDebugPanel } from './PeripheralDebugPanel';
import { RobotCommand } from '../../types/peripheral.types';
import './CompactStyles.css';

interface ControlPanelProps {
  screenId?: number;
  compact?: boolean;
  className?: string;
  onRobotControl?: (command: string) => void; // 机器人控制回调
  enablePeripherals?: boolean; // 是否启用外设控制
  showPeripheralDebug?: boolean; // 是否显示外设调试面板
  connected?: boolean; // 外部传入的WebSocket连接状态
  publish?: (topic: string, message: any, type?: string) => void; // 外部传入的发布函数
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  screenId = 0, 
  compact = false,
  className = '',
  onRobotControl,
  enablePeripherals = false,
  showPeripheralDebug = false,
  connected: externalConnected,
  publish: externalPublish,
}) => {
  // 如果外部传入了connected和publish，使用外部的；否则自己创建
  const internalWebSocket = useWebSocket({
    screenId,
    topics: ['/robot/commands'],
    autoConnect: !externalConnected, // 如果外部有连接，就不自动连接
  });
  
  const connected = externalConnected !== undefined ? externalConnected : internalWebSocket.connected;
  const publish = externalPublish || internalWebSocket.publish;
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const { setCommand } = useRobot3DStore();
  const [peripheralManager, setPeripheralManager] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(showPeripheralDebug);


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
      title: '动作控制',
      commands: [
        { id: 'Wave', label: '挥手', color: '#06b6d4' },
        { id: 'ThumbsUp', label: '点赞', color: '#06b6d4' },
        { id: 'WalkJump', label: '跨栏', color: '#14b8a6' },
        { id: 'Jump', label: '跳跃', color: '#14b8a6' },
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
    console.log('[ControlPanel] Web按钮点击:', commandId);
    const command = {
      type: commandId,
      timestamp: new Date().toISOString(),
      screenId: screenId,
    };
    
    // 1. 发送到后端（将来用于真实机器人）
    if (connected && publish) {
      publish('/robot/commands', command);
      
      // 广播到其他屏幕（用于多屏3D同步）
      publish('robot_3d_command', { command: commandId, timestamp: Date.now() }, 'std_msgs/String');
    } else {
      console.warn('[ControlPanel] WebSocket未连接，无法发送命令');
    }
    
    // 2. 触发本地3D机器人控制（通过Zustand状态）
    // 添加时间戳确保每次点击都触发，即使是相同的命令
    console.log('[ControlPanel] 调用setCommand:', commandId);
    setCommand(commandId + '_' + Date.now());
    if (onRobotControl) {
      onRobotControl(commandId);
    }
    
    // 更新选中命令显示（不自动清除，避免与外设控制冲突）
    setSelectedCommand(commandId);
  };

  // 处理外设命令
  const handlePeripheralCommand = (cmd: RobotCommand) => {
    
    // 更新选中命令显示
    if (cmd.type === 'velocity') {
      setSelectedCommand('external_control');
    } else if (cmd.type === 'action') {
      // 提取命令ID，用于高亮对应的web按钮
      const commandId = cmd.payload?.data || 'external_action';
      setSelectedCommand(commandId);
      
      // 同时发送命令（确保与web按钮行为一致）
      if (connected && publish) {
        publish('/robot/commands', {
          type: commandId,
          timestamp: new Date().toISOString(),
          screenId: screenId,
        });
      }
    }
  };

  return (
    <div className={`control-panel ${compact ? 'compact' : ''} ${className}`}>
      {/* 外设控制器（隐藏组件，仅处理逻辑） */}
      {enablePeripherals && (
        <PeripheralController 
          enabled={enablePeripherals} 
          onCommandSent={handlePeripheralCommand}
          onManagerReady={setPeripheralManager}
        />
      )}

      {/* 外设调试面板切换按钮 */}
      {enablePeripherals && !compact && (
        <div className="peripheral-controls">
          <button 
            className="debug-toggle-btn"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? '🎮 隐藏外设调试' : '🎮 显示外设调试'}
          </button>
        </div>
      )}

      {/* 外设调试面板 */}
      {enablePeripherals && showDebug && (
        <PeripheralDebugPanel 
          manager={peripheralManager} 
          compact={compact}
        />
      )}

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

