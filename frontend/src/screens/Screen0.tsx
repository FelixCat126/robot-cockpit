/**
 * Screen0 - 控制指令界面
 * 0号屏（左侧）：登录控制屏，登录后显示机器人控制指令
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { useAuthStore } from '../stores/authStore';
import { ControlPanel } from '../components/shared/ControlPanel';
import './Screen.css';

interface Screen0Props {
  screenId: number;
  onDeselectRobot?: () => void;
}

function Screen0({ screenId, onDeselectRobot }: Screen0Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: ['/robot/commands'],
  });
  const { logout } = useAuthStore();

  const handleLogout = () => {
    console.log('[Screen0] Logout clicked');
    logout();
  };

  return (
    <div className="screen screen-0">
      <div className="screen-header">
        <div className="header-left">
          <h1>🎮 机器人控制中心</h1>
          <span className="connection-status">
            {connected ? '🟢 ROS2已连接' : '🔴 ROS2未连接'}
          </span>
        </div>
        <div className="header-actions">
          {onDeselectRobot && (
            <button className="change-robot-btn" onClick={onDeselectRobot}>
              🔄 更换机器人
            </button>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </div>

      <div className="screen-content control-content">
        <ControlPanel screenId={screenId} />
      </div>
    </div>
  );
}

export default Screen0;

