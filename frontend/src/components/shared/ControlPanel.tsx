/**
 * ControlPanel - 控制面板共享组件
 * 可在多屏模式和单屏模式中复用
 */

import { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getIcon } from '../ControlIcons';
import { useRobot3DStore } from '../../stores/robot3DStore';
import { PeripheralController } from './PeripheralController';
import { RobotCommand } from '../../types/peripheral.types';
import './CompactStyles.css';

interface ControlPanelProps {
  screenId?: number;
  compact?: boolean;
  className?: string;
  onRobotControl?: (command: string) => void; // 机器人控制回调
  enablePeripherals?: boolean; // 是否启用外设控制
  connected?: boolean; // 外部传入的WebSocket连接状态
  publish?: (topic: string, message: any, type?: string) => void; // 外部传入的发布函数
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  screenId = 0, 
  compact = false,
  className = '',
  onRobotControl,
  enablePeripherals = false, // 单屏模式启用，多屏模式在Screen0顶层已渲染
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

  // 处理外设命令（单屏模式使用）
  const handlePeripheralCommand = (_cmd: RobotCommand) => {
    // 外设命令已通过PeripheralController内部处理
    // 这里可以添加额外的处理逻辑（如果需要）
  };

  // 控制命令列表 - 只保留基本功能
  const commandCategories = [
    {
      title: '基本控制',
      commands: [
        { id: 'start', label: '启动', color: '#10b981' },
        { id: 'stop', label: '停止', color: '#ef4444' },
        { id: 'emergency_stop', label: '紧急停止', color: '#dc2626' },
        { id: 'reset', label: '系统重置', color: '#f59e0b' },
      ],
    },
  ];

  // 发送命令 (按下)
  const handleSendCommand = (commandId: string) => {
    const timestamp = Date.now();
    const command = {
      type: commandId,
      timestamp: new Date().toISOString(),
      screenId: screenId,
    };
    
    // 1. 发送到后端（将来用于真实机器人）
    if (connected && publish) {
      publish('/robot/commands', command);
      
      // 广播到其他屏幕（用于多屏3D同步）
      publish('robot_3d_command', { command: commandId, timestamp }, 'std_msgs/String');
    } else {
      console.warn('[ControlPanel] WebSocket未连接，无法发送命令');
    }
    
    // 2. 触发本地3D机器人控制（通过Zustand状态）
    setCommand(commandId + '_' + timestamp);
    if (onRobotControl) {
      onRobotControl(commandId);
    }
    
    // 更新选中命令显示
    setSelectedCommand(commandId);
  };

  return (
    <div className={`control-panel ${compact ? 'compact' : ''} ${className}`}>
      {/* 单屏模式：在ControlPanel中渲染PeripheralController */}
      {/* 多屏模式：enablePeripherals=false，PeripheralController在Screen0顶层渲染 */}
      {enablePeripherals && (
        <PeripheralController 
          enabled={true} 
          onCommandSent={handlePeripheralCommand}
          onManagerReady={() => {}}
        />
      )}

      <div className="control-content">
        {commandCategories.map((category) => (
          <div key={category.title} className="command-category">
            {!compact && <h2 className="category-title" style={{ fontSize: '14px', marginBottom: '8px' }}>{category.title}</h2>}
            <div className="command-grid" style={{ 
              display: 'flex', 
              flexWrap: 'nowrap', 
              gap: '8px', 
              justifyContent: 'flex-start',
              width: '100%'
            }}>
              {category.commands.map((cmd) => {
                const IconComponent = getIcon(cmd.id);
                
                return (
                  <button
                    key={cmd.id}
                    className={`command-button ${selectedCommand === cmd.id ? 'active' : ''}`}
                    style={{
                      borderColor: cmd.color,
                      backgroundColor: selectedCommand === cmd.id ? cmd.color : 'transparent',
                      minWidth: compact ? '50px' : '60px',
                      minHeight: compact ? '50px' : '60px',
                      maxWidth: compact ? '50px' : 'none',
                      maxHeight: compact ? '50px' : 'none',
                      padding: compact ? '6px' : '8px',
                      flex: '1 1 0',
                      width: '0'
                    }}
                    onClick={() => handleSendCommand(cmd.id)}
                    title={cmd.label}
                  >
                    <span className="command-icon">
                      <IconComponent 
                        size={compact ? 20 : 24} 
                        color={selectedCommand === cmd.id ? 'white' : cmd.color} 
                      />
                    </span>
                    {!compact && <span className="command-label" style={{ fontSize: '11px', fontWeight: 'bold' }}>{cmd.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}


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

