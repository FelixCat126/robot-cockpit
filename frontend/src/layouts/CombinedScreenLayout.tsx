/**
 * CombinedScreenLayout - 单屏组合布局
 * 将多屏模式的内容组合到一个屏幕上显示
 * 布局：
 * - 左上角：主控屏（Screen0）
 * - 左下角：状态屏（Screen2）
 * - 中间大部分：视频视角屏（Screen1）
 * - 右侧：3D屏（Screen3）
 */

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import websocketService from '../services/websocket';
import communicationFactory from '../services/communicationFactory';
import remoteLogger from '../utils/remoteLogger';
import LoginPage from '../components/LoginPage';
import RobotList from '../components/RobotList';
import Screen0 from '../screens/Screen0';
import Screen1 from '../screens/Screen1';
import Screen2 from '../screens/Screen2';
import Screen3 from '../screens/Screen3';
import { getScreenResolution, calculateCombinedLayoutProportions, logScreenInfo } from '../utils/screenResolution';
import './CombinedScreenLayout.css';

export const CombinedScreenLayout: React.FC = () => {
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(() => {
    const saved = localStorage.getItem('robot_cockpit_selected_robot');
    return saved || null;
  });
  const [layoutProportions, setLayoutProportions] = useState(() => {
    const resolution = getScreenResolution();
    return calculateCombinedLayoutProportions(resolution);
  });
  const { isAuthenticated, checkAuth } = useAuthStore();
  const checkAuthRef = useRef(checkAuth);
  
  checkAuthRef.current = checkAuth;

  useEffect(() => {
    remoteLogger.setScreenId(0); // 组合布局使用屏幕0
    checkAuthRef.current();
    
    // 检测屏幕分辨率并调整布局
    const resolution = getScreenResolution();
    logScreenInfo();
    const proportions = calculateCombinedLayoutProportions(resolution);
    setLayoutProportions(proportions);
    
    // 监听窗口大小变化
    const handleResize = () => {
      const newResolution = getScreenResolution();
      const newProportions = calculateCombinedLayoutProportions(newResolution);
      setLayoutProportions(newProportions);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    websocketService.connect();
    
    const handleConnected = () => {
      websocketService.registerScreen(0); // 组合布局注册为屏幕0
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
    
    websocketService.on('auth_status_change', handleAuthStatusChange);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'robot_cockpit_logged_in' || e.key === 'robot_cockpit_auth_updated') {
        checkAuthRef.current();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    const handleRobotSelected = (data: { robotId: string; timestamp: number }) => {
      setSelectedRobotId(() => data.robotId);
      localStorage.setItem('robot_cockpit_selected_robot', data.robotId);
      localStorage.setItem('robot_cockpit_robot_updated', Date.now().toString());
    };

    const handleUserLoggedOut = () => {
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
      localStorage.removeItem('robot_cockpit_logged_in');
      localStorage.removeItem('robot_cockpit_token');
      localStorage.setItem('robot_cockpit_auth_updated', Date.now().toString());
      
      checkAuthRef.current();
    };

    const handleRobotDeselected = () => {
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
    };

    websocketService.on('robot_selected', handleRobotSelected);
    websocketService.on('user_logged_out', handleUserLoggedOut);
    websocketService.on('robot_deselected', handleRobotDeselected);

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('auth_status_change', handleAuthStatusChange);
      window.removeEventListener('storage', handleStorageChange);
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
      
      console.log(`[CombinedScreenLayout] Connected to robot: ${robotId} via ${communicationFactory.getCurrentMode()}`);
    } catch (error) {
      console.error('[CombinedScreenLayout] Failed to connect to robot:', error);
      // TODO: 临时禁用错误处理，允许进入界面
      console.warn('[CombinedScreenLayout] Connection failed, but allowing UI access for development');
    }
  };

  const handleDeselectRobot = () => {
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

  // 已登录且已选择机器人：显示组合布局
  return (
    <div className="combined-screen-layout">
      <div 
        className="combined-grid"
        style={{
          gridTemplateColumns: `${layoutProportions.controlWidth} ${layoutProportions.videoWidth} ${layoutProportions.statusWidth}`,
          gridTemplateRows: `${layoutProportions.controlHeight} ${layoutProportions.statusHeight}`,
        }}
      >
        {/* 左上角：主控屏（Screen0） */}
        <div className="combined-panel combined-panel-control">
          <Screen0 screenId={0} onDeselectRobot={handleDeselectRobot} />
        </div>

        {/* 中间大部分：视频视角屏（Screen1） */}
        <div className="combined-panel combined-panel-video">
          <Screen1 screenId={1} />
        </div>

        {/* 左下角：状态屏（Screen2） */}
        <div className="combined-panel combined-panel-status">
          <Screen2 screenId={2} />
        </div>

        {/* 右侧：3D屏（Screen3） */}
        <div className="combined-panel combined-panel-3d">
          <Screen3 screenId={3} />
        </div>
      </div>
    </div>
  );
};
