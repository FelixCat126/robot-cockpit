/**
 * 认证状态管理
 * 使用简单的状态管理，不依赖外部库
 */

import { create } from 'zustand';
import authService from '../services/auth';
import websocketService from '../services/websocket';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  username: localStorage.getItem('robot_cockpit_username'),

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await authService.login({ username, password });
      
      if (result.success) {
        // 保存用户名
        localStorage.setItem('robot_cockpit_username', username);
        set({ isAuthenticated: true, isLoading: false, error: null, username });
        
        // 通过WebSocket发送认证状态变化（主要机制）
        // 后端会广播到所有客户端，包括其他窗口
        // 注意：这里不需要手动发送，因为后端登录API会自动广播
        // 但为了确保同窗口内立即更新，我们触发自定义事件
        
        // 触发自定义事件，通知同窗口内的其他组件
        window.dispatchEvent(new CustomEvent('robot_cockpit_auth_update'));
        
        // 更新localStorage，这会自动触发其他窗口的storage事件（备用机制）
        const updateKey = 'robot_cockpit_auth_updated';
        window.localStorage.setItem(updateKey, Date.now().toString());
        
        return true;
      } else {
        set({ 
          isAuthenticated: false, 
          isLoading: false, 
          error: result.message || '手机号或验证码错误' 
        });
        return false;
      }
    } catch (error: any) {
      set({ 
        isAuthenticated: false, 
        isLoading: false, 
        error: error.message || '手机号或验证码错误' 
      });
      return false;
    }
  },

  logout: () => {
    authService.logout();
    set({ isAuthenticated: false, error: null, username: null });
    
    // 清除机器人选择状态和用户名
    window.localStorage.removeItem('robot_cockpit_selected_robot');
    window.localStorage.removeItem('robot_cockpit_robot_updated');
    window.localStorage.removeItem('robot_cockpit_username');
    
    // 通过WebSocket发送登出状态到后端，让后端广播到所有屏幕
    websocketService.logout();
    
    // 通过localStorage和storage事件同步（备用机制）
    window.localStorage.setItem('robot_cockpit_auth_updated', Date.now().toString());
    
    // 触发自定义事件，通知同窗口内的其他组件
    window.dispatchEvent(new CustomEvent('robot_cockpit_auth_update'));
  },

  checkAuth: () => {
    const isAuth = authService.isAuthenticated();
    set({ isAuthenticated: isAuth });
    return isAuth;
  },
}));

