/**
 * Screen3 - 3D机器人可视化屏幕
 * 显示行走中的3D人形机器人模型
 * 通过WebSocket接收来自Screen0的控制命令
 */

import { useEffect, useState } from 'react';
import websocketService from '../services/websocket';
import { useRobot3DStore } from '../stores/robot3DStore';
import { Robot3DViewer } from '../components/shared/Robot3DViewer';
import './Screen.css';

interface Screen3Props {
  screenId: number;
}

function Screen3({ screenId }: Screen3Props) {
  const [connected, setConnected] = useState(false);
  const { setCommand } = useRobot3DStore();

  useEffect(() => {
    // 连接WebSocket
    websocketService.connect();
    websocketService.registerScreen(screenId);
    
    // 监听连接状态
    const handleConnected = () => {
      setConnected(true);
    };
    
    const handleDisconnected = () => {
      setConnected(false);
    };
    
    // 监听3D控制命令（直接监听事件）
    const handle3DCommand = (data: any) => {
      if (data && data.topic === 'robot_3d_command' && data.data && data.data.command) {
        // 添加时间戳确保相同命令也能触发（关键修复！）
        setCommand(data.data.command + '_' + Date.now());
      }
    };
    
    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    websocketService.on('topic_data', handle3DCommand);
    
    // 订阅3D控制命令话题
    if (websocketService.getStatus().connected) {
      websocketService.subscribeTopic('robot_3d_command');
    }
    
    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('topic_data', handle3DCommand);
      websocketService.unsubscribeTopic('robot_3d_command');
    };
  }, [screenId, setCommand]);

  return (
    <div className="screen screen-3">
      <div className="screen-header">
        <h1>🤖 3D机器人可视化</h1>
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '已连接' : '未连接'} | Screen {screenId}
        </div>
      </div>
      <div className="screen-content robot-3d-content">
        <Robot3DViewer 
          width={640}
          height={1000}
          enableAutoRotate={false}
          showGrid={false}
          showAxes={false}
          backgroundColor="#0f172a"
        />
      </div>
    </div>
  );
}

export default Screen3;

