/**
 * Screen2 - 机器人状态展示界面
 * 2号屏（右侧）：显示机器人的详细状态信息
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { StatusMonitor } from '../components/shared/StatusMonitor';
import './Screen.css';

interface Screen2Props {
  screenId: number;
}

function Screen2({ screenId }: Screen2Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: ['/robot/status', '/robot/telemetry', '/robot/diagnostics'],
  });

  return (
    <div className="screen screen-2">
      <div className="screen-header">
        <h1>📊 机器人状态监控</h1>
        <div className="header-status">
          <span className="connection-status">
            {connected ? '🟢 实时更新' : '🔴 连接断开'}
          </span>
        </div>
      </div>

      <div className="screen-content status-content">
        <StatusMonitor screenId={screenId} />
      </div>
    </div>
  );
}

export default Screen2;
