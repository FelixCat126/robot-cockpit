/**
 * Screen0 - 控制指令界面
 * 0号屏（左侧）：登录控制屏，登录后显示机器人控制指令
 * 支持切换到其他屏幕内容显示
 */

import { useState, useEffect } from 'react';
import websocketService from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import { ControlPanel } from '../components/shared/ControlPanel';
import Screen1 from './Screen1';
import Screen2 from './Screen2';
import Screen3 from './Screen3';
import './Screen.css';

interface Screen0Props {
  screenId: number;
  onDeselectRobot?: () => void;
  isViewingOtherScreen?: boolean; // 是否正在查看其他屏幕（用于隐藏返回按钮）
}

function Screen0({ screenId, onDeselectRobot, isViewingOtherScreen = false }: Screen0Props) {
  const [connected, setConnected] = useState(false);
  const [viewingScreen, setViewingScreen] = useState<number | null>(null); // 当前查看的屏幕ID，null表示显示控制面板
  const { logout } = useAuthStore();

  useEffect(() => {
    // 监听WebSocket连接状态
    const handleConnected = () => {
      setConnected(true);
      // WebSocket已连接
    };
    
    const handleDisconnected = () => {
      setConnected(false);
      // WebSocket已断开
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
    // 登出
    logout();
  };

  const publish = (topic: string, message: any, type?: string) => {
    websocketService.publishTopic(topic, message, type);
  };

  const handleSwitchScreen = (targetScreenId: number) => {
    setViewingScreen(targetScreenId);
  };

  const handleBackToControl = () => {
    setViewingScreen(null);
  };

  // 如果正在查看其他屏幕，显示该屏幕的内容
  if (viewingScreen !== null) {
    const screenComponents: Record<number, React.ReactNode> = {
      1: <Screen1 screenId={1} />,
      2: <Screen2 screenId={2} />,
      3: <Screen3 screenId={3} />,
    };

    return (
      <div className="screen screen-0 screen-viewing-other">
        <div className="screen-header">
          <div className="header-left">
            <h1>
              {viewingScreen === 1 && '📹 视频视角屏'}
              {viewingScreen === 2 && '📊 状态监控屏'}
              {viewingScreen === 3 && '🤖 3D可视化屏'}
            </h1>
            <span className="connection-status">
              {connected ? '🟢 ROS2已连接' : '🔴 ROS2未连接'}
            </span>
          </div>
          <div className="header-actions">
            {/* 主控屏切换后显示返回按钮（isViewingOtherScreen=false表示这是真正的Screen0，所以显示返回按钮） */}
            {!isViewingOtherScreen && (
              <button className="back-to-control-btn" onClick={handleBackToControl}>
                ← 返回控制中心
              </button>
            )}
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
        <div className="screen-content">
          {screenComponents[viewingScreen]}
        </div>
      </div>
    );
  }

  // 默认显示控制面板
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
        {/* 屏幕选择按钮 */}
        <div className="screen-selector">
          <h2 className="selector-title">切换屏幕视图</h2>
          <div className="screen-selector-buttons">
            <button 
              className="screen-select-btn" 
              onClick={() => handleSwitchScreen(1)}
              title="查看视频视角屏"
            >
              <span className="screen-icon">📹</span>
              <span className="screen-label">视频视角</span>
            </button>
            <button 
              className="screen-select-btn" 
              onClick={() => handleSwitchScreen(2)}
              title="查看状态监控屏"
            >
              <span className="screen-icon">📊</span>
              <span className="screen-label">状态监控</span>
            </button>
            <button 
              className="screen-select-btn" 
              onClick={() => handleSwitchScreen(3)}
              title="查看3D可视化屏"
            >
              <span className="screen-icon">🤖</span>
              <span className="screen-label">3D可视化</span>
            </button>
          </div>
        </div>

        <ControlPanel 
          screenId={screenId}
          enablePeripherals={true}
          connected={connected}
          publish={publish}
        />
      </div>
    </div>
  );
}

export default Screen0;

