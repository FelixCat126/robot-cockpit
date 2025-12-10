/**
 * MultiScreenLayout - 多屏模式布局
 * 从App.tsx迁移的现有多屏逻辑
 */

import { useEffect, useState, useRef } from 'react';
import { getScreenIdFromUrl } from '../utils/screenId';
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

const TOUCH_SCREEN_ID = parseInt(import.meta.env.VITE_TOUCH_SCREEN_ID || '0', 10);

export const MultiScreenLayout: React.FC = () => {
  const [screenId, setScreenId] = useState<number | null>(null);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(() => {
    const saved = localStorage.getItem('robot_cockpit_selected_robot');
    return saved || null;
  });
  const { isAuthenticated, checkAuth } = useAuthStore();
  const checkAuthRef = useRef(checkAuth);
  
  checkAuthRef.current = checkAuth;

  useEffect(() => {
    const id = getScreenIdFromUrl();
    setScreenId(id);
    
    if (id !== null) {
      remoteLogger.setScreenId(id);
    }

    checkAuthRef.current();
  }, []);

  useEffect(() => {
    websocketService.connect();
    
    const handleConnected = () => {
      if (screenId !== null) {
        websocketService.registerScreen(screenId);
      }
    };
    
    websocketService.on('connected', handleConnected);
    
    if (websocketService.getStatus().connected && screenId !== null) {
      websocketService.registerScreen(screenId);
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
      if (e.key === 'robot_cockpit_selected_robot' || e.key === 'robot_cockpit_robot_updated') {
        const saved = localStorage.getItem('robot_cockpit_selected_robot');
        setSelectedRobotId(saved || null);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 监听自定义事件（同一窗口内的同步）
    const handleAuthUpdate = () => {
      checkAuthRef.current();
    };
    
    const handleRobotUpdate = () => {
      const saved = localStorage.getItem('robot_cockpit_selected_robot');
      setSelectedRobotId(saved || null);
    };
    
    window.addEventListener('robot_cockpit_auth_update', handleAuthUpdate);
    window.addEventListener('robot_cockpit_robot_update', handleRobotUpdate);
    
    const handleRobotSelected = (data: { robotId: string; timestamp: number }) => {
      setSelectedRobotId(() => data.robotId);
      localStorage.setItem('robot_cockpit_selected_robot', data.robotId);
      localStorage.setItem('robot_cockpit_robot_updated', Date.now().toString());
      // 触发自定义事件，通知同窗口内的其他组件
      window.dispatchEvent(new CustomEvent('robot_cockpit_robot_update'));
    };

    const handleUserLoggedOut = () => {
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
      localStorage.removeItem('robot_cockpit_logged_in');
      localStorage.removeItem('robot_cockpit_token');
      localStorage.setItem('robot_cockpit_auth_updated', Date.now().toString());
      
      // 触发自定义事件，通知同窗口内的其他组件
      window.dispatchEvent(new CustomEvent('robot_cockpit_auth_update'));
      window.dispatchEvent(new CustomEvent('robot_cockpit_robot_update'));
      
      checkAuthRef.current();
    };

    const handleRobotDeselected = () => {
      console.log('[MultiScreenLayout] Robot deselected, clearing state for screen:', screenId);
      setSelectedRobotId(null);
      localStorage.removeItem('robot_cockpit_selected_robot');
      localStorage.removeItem('robot_cockpit_robot_updated');
      // 触发自定义事件，通知同窗口内的其他组件
      window.dispatchEvent(new CustomEvent('robot_cockpit_robot_update'));
    };

    websocketService.on('robot_selected', handleRobotSelected);
    websocketService.on('user_logged_out', handleUserLoggedOut);
    websocketService.on('robot_deselected', handleRobotDeselected);

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('auth_status_change', handleAuthStatusChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('robot_cockpit_auth_update', handleAuthUpdate);
      window.removeEventListener('robot_cockpit_robot_update', handleRobotUpdate);
      websocketService.off('robot_selected', handleRobotSelected);
      websocketService.off('user_logged_out', handleUserLoggedOut);
      websocketService.off('robot_deselected', handleRobotDeselected);
    };
  }, [screenId]);

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
      
      console.log(`[MultiScreenLayout] Connected to robot: ${robotId} via ${communicationFactory.getCurrentMode()}`);
    } catch (error) {
      console.error('[MultiScreenLayout] Failed to connect to robot:', error);
      // TODO: 临时禁用错误处理，允许进入界面
      console.warn('[MultiScreenLayout] Connection failed, but allowing UI access for development');
      // 连接失败也允许进入（开发阶段）
      // setSelectedRobotId(null);
      // localStorage.removeItem('robot_cockpit_selected_robot');
    }
  };

  const handleDeselectRobot = () => {
    console.log('[MultiScreenLayout] Deselecting robot from screen:', screenId);
    
    // 断开当前机器人连接
    communicationFactory.disconnectRobot();
    
    // 先更新本地状态
    setSelectedRobotId(null);
    localStorage.removeItem('robot_cockpit_selected_robot');
    localStorage.removeItem('robot_cockpit_robot_updated');
    
    // 发送取消选择事件到后端（会广播到所有屏幕）
    websocketService.deselectRobot();
    
    // 触发自定义事件，通知同窗口内的其他组件（备用机制）
    window.dispatchEvent(new CustomEvent('robot_cockpit_robot_update'));
    
    console.log('[MultiScreenLayout] Robot deselected, state cleared');
  };

  const renderScreen = () => {
    if (screenId === null) {
      return <div className="error-screen">未指定屏幕ID，请在URL中添加 ?screen=0-3</div>;
    }

    if (screenId < 0 || screenId > 3) {
      return <div className="error-screen">无效的屏幕ID: {screenId}，有效范围: 0-3</div>;
    }

    if (!isAuthenticated) {
      const isInputEnabled = screenId === TOUCH_SCREEN_ID;
      return <LoginPage screenId={screenId} isInputEnabled={isInputEnabled} />;
    }

    if (!selectedRobotId) {
      if (screenId === TOUCH_SCREEN_ID) {
        return <RobotList onSelectRobot={handleSelectRobot} />;
      } else {
        return (
          <div className="waiting-screen">
            <div className="waiting-content">
              <h2>等待选择机器人</h2>
              <p>请在操作屏选择要监控的机器人</p>
              <div className="spinner"></div>
            </div>
          </div>
        );
      }
    }

    switch (screenId) {
      case 0:
        // Screen0可以切换查看其他屏幕，传递isViewingOtherScreen=false（因为这是真正的Screen0，不是切换后的视图）
        return <Screen0 screenId={screenId} onDeselectRobot={handleDeselectRobot} isViewingOtherScreen={false} />;
      case 1:
        return <Screen1 screenId={screenId} />;
      case 2:
        return <Screen2 screenId={screenId} />;
      case 3:
        return <Screen3 screenId={screenId} />;
      default:
        return <div className="error-screen">无效的屏幕ID: {screenId}</div>;
    }
  };

  return <div className="app multi-screen-layout">{renderScreen()}</div>;
};

