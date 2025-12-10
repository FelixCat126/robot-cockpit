/**
 * SingleScreenLayout - 单屏Grid模式布局
 * 在一个屏幕上以Grid布局展示所有功能
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import websocketService from '../services/websocket';
import communicationFactory from '../services/communicationFactory';
import remoteLogger from '../utils/remoteLogger';
import LoginPage from '../components/LoginPage';
import RobotList from '../components/RobotList';
import { ControlPanel } from '../components/shared/ControlPanel';
import { VideoPlayer } from '../components/shared/VideoPlayer';
import { AudioPlayer } from '../components/shared/AudioPlayer';
import { Robot3DViewer } from '../components/shared/Robot3DViewer';
import { SpeedGauge } from '../components/shared/SpeedGauge';
import './SingleScreenLayout.css';

export const SingleScreenLayout: React.FC = () => {
  const { logout, checkAuth, isAuthenticated, username } = useAuthStore();
  const checkAuthRef = useRef(checkAuth);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(() => {
    return localStorage.getItem('robot_cockpit_selected_robot') || null;
  });
  const [connected, setConnected] = useState(false);
  
  // 公司名称
  const companyName = '麦擎科技';
  
  checkAuthRef.current = checkAuth;

  useEffect(() => {
    // 设置remoteLogger的screenId
    remoteLogger.setScreenId(0);
    
    // 检查初始认证状态
    checkAuthRef.current();
    
    // 窗口自动最大化（非全屏）- 改进版，更可靠
    // 注意：后端已通过CDP设置窗口最大化，前端代码作为备用方案
    const maximizeWindow = () => {
      // 获取屏幕可用尺寸（排除任务栏等）
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      
      // 检查当前窗口大小
      const currentWidth = window.outerWidth || window.innerWidth;
      const currentHeight = window.outerHeight || window.innerHeight;
      
      // 如果窗口已经接近最大化，不需要再次调整
      if (Math.abs(currentWidth - screenWidth) < 50 && Math.abs(currentHeight - screenHeight) < 50) {
        return;
      }
      
      // 设置窗口大小和位置（备用方案，如果后端CDP失败）
      const tryMaximize = () => {
        try {
          // 先移动到左上角
          window.moveTo(0, 0);
          // 然后调整大小到屏幕尺寸
          window.resizeTo(screenWidth, screenHeight);
          
          const newWidth = window.outerWidth || window.innerWidth;
          const newHeight = window.outerHeight || window.innerHeight;
          
          
          // 如果调整成功，返回true
          return Math.abs(newWidth - screenWidth) < 50 && Math.abs(newHeight - screenHeight) < 50;
        } catch (error) {
          console.warn('[SingleScreenLayout] 窗口调整失败（浏览器可能限制）:', error);
          return false;
        }
      };
      
      // 延迟尝试（给后端CDP时间先执行）
      setTimeout(() => {
        const currentWidth2 = window.outerWidth || window.innerWidth;
        const currentHeight2 = window.outerHeight || window.innerHeight;
        
        // 如果窗口还没有最大化，尝试前端方法
        if (Math.abs(currentWidth2 - screenWidth) > 50 || Math.abs(currentHeight2 - screenHeight) > 50) {
          tryMaximize();
        }
      }, 500); // 延迟500ms，等待后端CDP执行
    };
    
    // 延迟执行，确保DOM已加载
    setTimeout(maximizeWindow, 100);
    
    // 如果窗口已经加载完成，立即执行
    if (document.readyState === 'complete') {
      maximizeWindow();
    } else {
      window.addEventListener('load', maximizeWindow);
      // 也监听DOMContentLoaded
      document.addEventListener('DOMContentLoaded', maximizeWindow);
    }
    
    // 清理函数：移除事件监听器
    return () => {
      window.removeEventListener('load', maximizeWindow);
      document.removeEventListener('DOMContentLoaded', maximizeWindow);
    };
  }, []);
  

  useEffect(() => {
    websocketService.connect();
    
    const handleConnected = () => {
      // 单屏模式使用screenId=0
      websocketService.registerScreen(0);
      setConnected(true);
    };
    
    const handleDisconnected = () => {
      setConnected(false);
    };
    
    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    
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
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('auth_status_change', handleAuthStatusChange);
      websocketService.off('robot_selected', handleRobotSelected);
      websocketService.off('user_logged_out', handleUserLoggedOut);
      websocketService.off('robot_deselected', handleRobotDeselected);
    };
  }, []);

  const handleSelectRobot = async (robotId: string) => {
    try {
      setSelectedRobotId(robotId);
      localStorage.setItem('robot_cockpit_selected_robot', robotId);
      localStorage.setItem('robot_cockpit_robot_updated', Date.now().toString());
      
      // 使用通信工厂连接到机器人（自动选择 WebSocket 或 WebRTC）
      // TODO: 临时跳过实际连接，待远端机器人就绪后正常连接
      await communicationFactory.connectToRobot(robotId);
      
      // 同时保持 WebSocket 连接用于多屏同步
      websocketService.selectRobot(robotId);
      
      console.log(`[SingleScreenLayout] Connected to robot: ${robotId} via ${communicationFactory.getCurrentMode()}`);
    } catch (error) {
      console.error('[SingleScreenLayout] Failed to connect to robot:', error);
      // TODO: 临时禁用错误提示，允许进入界面
      // alert(`连接机器人失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.warn('[SingleScreenLayout] Connection failed, but allowing UI access for development');
      // 连接失败也允许进入（开发阶段）
      // setSelectedRobotId(null);
      // localStorage.removeItem('robot_cockpit_selected_robot');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleChangeRobot = () => {
    // 断开当前机器人连接
    communicationFactory.disconnectRobot();
    
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
          <div className="company-section">
            <h1>{companyName}</h1>
            <span className="subtitle">机器人驾驶舱</span>
          </div>
          <span className="robot-info">
            {selectedRobotId ? `控制中: ${selectedRobotId} (${communicationFactory.getCurrentMode().toUpperCase()})` : '系统就绪'}
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
          <div className="user-info">
            <span className="user-icon">👤</span>
            <span className="username">{username || '用户'}</span>
          </div>
          <button className="header-btn" onClick={handleChangeRobot}>
            🔄 更换机器人
          </button>
          <button className="header-btn logout-btn" onClick={handleLogout}>
            🚪 退出登录
          </button>
        </div>
      </header>

      {/* 新布局：上下分区 */}
      <main className="layout-main">
        {/* 上半部分：视频流区域 */}
        <section className="view-section">
          {/* 左侧：左臂视角 */}
          <div className="view-left-arm">
            <VideoPlayer compact={true} screenId={0} showControls={true} />
          </div>
          
          {/* 中间：主控视频视角 */}
          <div className="view-main">
            <VideoPlayer compact={true} screenId={2} showControls={true} />
          </div>
          
          {/* 右侧：右臂视角 */}
          <div className="view-right-arm">
            <VideoPlayer compact={true} screenId={1} showControls={true} />
          </div>
        </section>
        
        {/* 下半部分：控制区域（三列布局） */}
        <section className="control-section">
          {/* 左侧：控制按钮 */}
          <div className="control-buttons">
            <ControlPanel 
              compact={false}
              screenId={0}
              enablePeripherals={true}
              connected={connected}
              publish={(topic, message, type) => websocketService.publishTopic(topic, message, type)}
            />
          </div>
          
          {/* 中间：音频和仪表盘 - 整体用大画布包起来 */}
          <div className="control-middle">
            <div className="control-middle-canvas">
              {/* 上面一行：音频控制 */}
              <div className="control-audio-inline">
                <AudioPlayer compact={true} screenId={0} enableMicrophone={true} />
              </div>
              
              {/* 下面一行：速度仪表盘 */}
              <div className="control-gauges">
                <SpeedGauge 
                  label="左臂速度" 
                  value={35} 
                  maxValue={100} 
                  unit="rpm"
                  color="#3b82f6"
                  size={110}
                />
                <SpeedGauge 
                  label="右臂速度" 
                  value={42} 
                  maxValue={100} 
                  unit="rpm"
                  color="#10b981"
                  size={110}
                />
                <SpeedGauge 
                  label="轮移动速度" 
                  value={28} 
                  maxValue={100} 
                  unit="rpm"
                  color="#f59e0b"
                  size={110}
                />
              </div>
            </div>
          </div>
          
          {/* 右侧：3D机器人 */}
          <div className="control-robot3d">
            <Robot3DViewer 
              width={100}
              height={100}
              enableAutoRotate={true}
              showGrid={true}
              showAxes={false}
              backgroundColor="#000011"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

