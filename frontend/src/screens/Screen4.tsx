import { useWebSocket } from '../hooks/useWebSocket';
import './Screen.css';

interface Screen4Props {
  screenId: number;
}

function Screen4({ screenId }: Screen4Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: [],
  });

  return (
    <div className="screen screen-4">
      <div className="screen-header">
        <h1>屏幕 4 - 预留</h1>
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

export default Screen4;

