/**
 * Screen0 - 控制指令界面
 * 0号屏（左侧）：登录控制屏，登录后显示机器人控制指令
 */

import { useState, useEffect } from 'react';
import websocketService from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import { ControlPanel } from '../components/shared/ControlPanel';
import './Screen.css';

interface Screen0Props {
  screenId: number;
  onDeselectRobot?: () => void;
}

function Screen0({ screenId, onDeselectRobot }: Screen0Props) {
  const [connected, setConnected] = useState(false);
  const { logout } = useAuthStore();

  useEffect(() => {
    // 监听WebSocket连接状态
    const handleConnected = () => {
      setConnected(true);
      console.log('[Screen0] WebSocket已连接');
    };
    
    const handleDisconnected = () => {
      setConnected(false);
      console.log('[Screen0] WebSocket已断开');
    };
    
    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    
    // 检查初始状态
    if (websocketService.getStatus().connected) {
      setConnected(true);
    }
    
    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
    };
  }, []);

  const handleLogout = () => {
    console.log('[Screen0] Logout clicked');
    logout();
  };

  const publish = (topic: string, message: any, type?: string) => {
    websocketService.publishTopic(topic, message, type);
  };

  return (
    <div className="screen screen-0">
      <div className="screen-header">
        <div className="header-left">
          <h1>🎮 机器人控制中心</h1>
          <span className="connection-status">
            {connected ? '🟢 ROS2已连接' : '🔴 ROS2未连接'}
          </span>
        </div>
        <div className="header-actions">
          {onDeselectRobot && (
            <button className="change-robot-btn" onClick={onDeselectRobot}>
              🔄 更换机器人
            </button>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </div>

      <div className="screen-content control-content">
        <ControlPanel 
          screenId={screenId}
          enablePeripherals={true}
          showPeripheralDebug={false}
          connected={connected}
          publish={publish}
        />
      </div>
    </div>
  );
}

export default Screen0;

