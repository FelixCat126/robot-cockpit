import { useWebSocket } from '../hooks/useWebSocket';
import './Screen.css';

interface Screen6Props {
  screenId: number;
}

function Screen6({ screenId }: Screen6Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: [],
  });

  return (
    <div className="screen screen-6">
      <div className="screen-header">
        <h1>屏幕 6 - 预留</h1>
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '已连接' : '未连接'}
        </div>
      </div>
      <div className="screen-content">
        <div className="placeholder">
          <p>此屏幕预留用于未来功能扩展</p>
        </div>
      </div>
    </div>
  );
}

export default Screen6;

