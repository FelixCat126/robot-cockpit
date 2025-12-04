/**
 * Screen1 - 机器人音视频流展示界面
 * 1号屏（中间）：显示机器人的视频流和音频流
 * - 视频：显示机器人摄像头画面
 * - 音频：播放机器人现场声音
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { VideoPlayer } from '../components/shared/VideoPlayer';
import { AudioPlayer } from '../components/shared/AudioPlayer';
import './Screen.css';

interface Screen1Props {
  screenId: number;
}

function Screen1({ screenId }: Screen1Props) {
  const { connected } = useWebSocket({
    screenId,
    topics: ['/robot/camera', '/robot/audio/stream'],
  });

  return (
    <div className="screen screen-1">
      <div className="screen-header">
        <h1>📹 机器人视角</h1>
        <div className="header-status">
          <span className="connection-status">
            {connected ? '🟢 实时连接' : '🔴 连接断开'}
          </span>
        </div>
      </div>

      <div className="screen-content video-content">
        {/* 主视频显示区域 */}
        <div className="main-video-panel">
          <VideoPlayer screenId={screenId} showControls={true} />
        </div>

        {/* 音频可视化区域 */}
        <div className="audio-panel">
          <AudioPlayer screenId={screenId} />
        </div>
      </div>
    </div>
  );
}

export default Screen1;
