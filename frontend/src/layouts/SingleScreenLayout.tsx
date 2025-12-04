/**
 * SingleScreenLayout - 单屏Grid模式布局
 * 在一个屏幕上以Grid布局展示所有功能
 */

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import websocketService from '../services/websocket';
import remoteLogger from '../utils/remoteLogger';
import LoginPage from '../components/LoginPage';
import RobotList from '../components/RobotList';
import { ControlPanel } from '../components/shared/ControlPanel';
import { VideoPlayer } from '../components/shared/VideoPlayer';
import { AudioPlayer } from '../components/shared/AudioPlayer';
import { StatusMonitor } from '../components/shared/StatusMonitor';
import './SingleScreenLayout.css';

export const SingleScreenLayout: React.FC = () => {
  const { logout, checkAuth, isAuthenticated } = useAuthStore();
  const checkAuthRef = useRef(checkAuth);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(() => {
    return localStorage.getItem('robot_cockpit_selected_robot') || null;
  });
  
  checkAuthRef.current = checkAuth;

  useEffect(() => {
    // 设置remoteLogger的screenId
    remoteLogger.setScreenId(0);
    
    // 检查初始认证状态
    checkAuthRef.current();
  }, []);
  
  // PIP视频功能（暂时隐藏，为未来第三视角预留）
  const showPIP = false;

  useEffect(() => {
    websocketService.connect();
    
    const handleConnected = () => {
      // 单屏模式使用screenId=0
      websocketService.registerScreen(0);
    };
    
    websocketService.on('connected', handleConnected);
    
    if (websocketService.getStatus().connected) {
      websocketService.registerScreen(0);
    }

    const handleAuthStatusChange = (data: { isAuthenticated: boolean; username?: string; timestamp: number }) => {
      if (data.isAuthenticated) {
        localStorage.setItem('robot_cockpit_logged_in', 'true');
        localStorage.setItem('robot_cockpit_auth_updated', Date.now().toString());
      } else {
        localStorage.removeItem('robot_cockpit_logged_in');
        localStorage.removeItem('robot_cockpit_token');
        localStorage.setItem('robot_cockpit_auth_updated', Date.now().toString());
      }
      
      checkAuthRef.current();
    };
    
    const handleRobotSelected = (data: { robotId: string; timestamp: number }) => {
      setSelectedRobotId(data.robotId);
      localStorage.setItem('robot_cockpit_selected_robot', data.robotId);
      localStorage.setItem('robot_cockpit_robot_updated', Date.now().toString());
    };

    const handleUserLoggedOut = () => {
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
      localStorage.removeItem('robot_cockpit_logged_in');
      localStorage.removeItem('robot_cockpit_token');
      checkAuthRef.current();
    };

    const handleRobotDeselected = () => {
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
    };
    
    websocketService.on('auth_status_change', handleAuthStatusChange);
    websocketService.on('robot_selected', handleRobotSelected);
    websocketService.on('user_logged_out', handleUserLoggedOut);
    websocketService.on('robot_deselected', handleRobotDeselected);

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('auth_status_change', handleAuthStatusChange);
      websocketService.off('robot_selected', handleRobotSelected);
      websocketService.off('user_logged_out', handleUserLoggedOut);
      websocketService.off('robot_deselected', handleRobotDeselected);
    };
  }, []);

  const handleSelectRobot = (robotId: string) => {
    setSelectedRobotId(robotId);
    localStorage.setItem('robot_cockpit_selected_robot', robotId);
    localStorage.setItem('robot_cockpit_robot_updated', Date.now().toString());
    websocketService.selectRobot(robotId);
  };

  const handleLogout = () => {
    logout();
  };

  const handleChangeRobot = () => {
    setSelectedRobotId(null);
    localStorage.removeItem('robot_cockpit_selected_robot');
    localStorage.removeItem('robot_cockpit_robot_updated');
    websocketService.deselectRobot();
  };

  // 未登录：显示登录页
  if (!isAuthenticated) {
    return <LoginPage screenId={0} isInputEnabled={true} />;
  }

  // 已登录但未选择机器人：显示机器人列表
  if (!selectedRobotId) {
    return <RobotList onSelectRobot={handleSelectRobot} />;
  }

  // 已登录且已选择机器人：显示Grid布局操作界面
  return (
    <div className="single-screen-layout">
      {/* 顶部导航栏 */}
      <header className="layout-header">
        <div className="header-left">
          <h1>🤖 机器人驾驶舱</h1>
          <span className="robot-info">
            {selectedRobotId ? `控制中: ${selectedRobotId}` : '系统就绪'}
          </span>
        </div>
        
        <div className="quick-info">
          {/* 关键状态图标 */}
          <div className="quick-status">
            <span className="status-icon" title="电池电量">🔋 85%</span>
            <span className="status-icon" title="连接状态">🟢 已连接</span>
            <span className="status-icon" title="温度">🌡️ 42°C</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="header-btn" onClick={handleChangeRobot}>
            🔄 更换机器人
          </button>
          <button className="header-btn logout-btn" onClick={handleLogout}>
            🚪 退出登录
          </button>
        </div>
      </header>

      {/* Grid主体 */}
      <main className="layout-grid">
        {/* 左上：控制面板（紧凑） */}
        <section className="grid-control">
          <ControlPanel compact={true} screenId={0} />
        </section>
        
        {/* 中间大区域：视频流 */}
        <section className="grid-video">
          <VideoPlayer compact={true} screenId={0} showControls={true} />
          
          {/* 预留第三视角位置（PIP） */}
          {showPIP && (
            <div className="pip-video">
              <div className="pip-placeholder">
                <span>📹</span>
                <p>第三视角</p>
              </div>
            </div>
          )}
        </section>
        
        {/* 右侧：状态监控（紧凑） */}
        <section className="grid-status">
          <StatusMonitor compact={true} screenId={0} />
        </section>
        
        {/* 底部：音频可视化 */}
        <section className="grid-audio">
          <AudioPlayer compact={true} screenId={0} />
        </section>
      </main>
    </div>
  );
};

