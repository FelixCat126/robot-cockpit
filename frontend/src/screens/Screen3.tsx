/**
 * Screen3 - 3D机器人可视化屏幕
 * 显示行走中的3D人形机器人模型
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { Robot3DViewer } from '../components/shared/Robot3DViewer';
import './Screen.css';

interface Screen3Props {
  screenId: number;
}

function Screen3({ screenId }: Screen3Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: [],  // 暂不订阅ROS话题，仅显示动画
  });

  return (
    <div className="screen screen-3">
      <div className="screen-header">
        <h1>🤖 3D机器人可视化</h1>
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'WebSocket已连接' : 'WebSocket未连接'}
        </div>
      </div>
      <div className="screen-content robot-3d-content">
        <Robot3DViewer 
          width={640}
          height={1000}
          enableAutoRotate={true}
          showGrid={true}
          showAxes={true}
          backgroundColor="#0f172a"
        />
      </div>
    </div>
  );
}

export default Screen3;

