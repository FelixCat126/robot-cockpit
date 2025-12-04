/**
 * App.tsx - 应用主入口
 * 运行时从后端API获取显示模式配置，无需重新编译即可切换
 */

import { useState, useEffect } from 'react';
import { MultiScreenLayout } from './layouts/MultiScreenLayout';
import { SingleScreenLayout } from './layouts/SingleScreenLayout';
import './App.css';

function App() {
  const [displayMode, setDisplayMode] = useState<'single' | 'multi' | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // 运行时从后端获取显示模式配置
  useEffect(() => {
    // 方法1：从URL参数读取displayMode
    const urlParams = new URLSearchParams(window.location.search);
    const urlDisplayMode = urlParams.get('displayMode');
    
    if (urlDisplayMode === 'single' || urlDisplayMode === 'multi') {
      console.log('[App] Using URL param displayMode:', urlDisplayMode);
      setDisplayMode(urlDisplayMode);
      setConfigLoading(false);
      return;
    }
    
    // 方法2：如果URL中有screen参数，说明是多屏模式
    const screenParam = urlParams.get('screen');
    if (screenParam !== null) {
      console.log('[App] Detected screen param, using multi-screen mode');
      setDisplayMode('multi');
      setConfigLoading(false);
      return;
    }
    
    console.log('[App] No URL params found, fetching from API...');
    
    // 降级：通过API获取
    const fetchDisplayMode = async () => {
      try {
        console.log('[App] Fetching display mode from backend API...');
        const response = await fetch('/api/config/display-mode');
        console.log('[App] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[App] Display mode config:', data);
        setDisplayMode(data.mode);
        setConfigLoading(false);
      } catch (error) {
        console.error('[App] Failed to load display mode config:', {
          message: error instanceof Error ? error.message : String(error),
          type: error instanceof TypeError ? 'TypeError (network)' : 'Other'
        });
        console.warn('[App] Falling back to multi-screen mode');
        // 降级到多屏模式
        setDisplayMode('multi');
        setConfigLoading(false);
      }
    };

    fetchDisplayMode();
  }, []);

  // 配置加载中
  if (configLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>正在加载配置...</h2>
          <p>请稍候</p>
        </div>
      </div>
    );
  }

  // 根据运行时配置选择布局模式
  // MultiScreenLayout和SingleScreenLayout各自管理自己的状态和逻辑
  if (displayMode === 'single') {
    return <SingleScreenLayout />;
  } else {
    return <MultiScreenLayout />;
  }
}

export default App;
