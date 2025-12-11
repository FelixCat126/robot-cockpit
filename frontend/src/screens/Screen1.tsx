/**
 * Screen1 - 机器人音视频流展示界面
 * 1号屏（中间）：显示机器人的视频流和音频流
 * - 视频：三列布局（左臂视角、主视角、右臂视角）
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

      <div className="screen-content video-content-multi">
        {/* 视频流区域：三列布局（与单屏模式一致） */}
        <section className="view-section-multi">
          {/* 左侧：左臂视角 */}
          <div className="view-left-arm-multi">
            <VideoPlayer compact={true} screenId={0} showControls={true} />
          </div>
          
          {/* 中间：主控视频视角 */}
          <div className="view-main-multi">
            <VideoPlayer compact={true} screenId={2} showControls={true} />
          </div>
          
          {/* 右侧：右臂视角 */}
          <div className="view-right-arm-multi">
            <VideoPlayer compact={true} screenId={1} showControls={true} />
          </div>
        </section>

        {/* 音频可视化区域 */}
        <div className="audio-panel-multi">
          <AudioPlayer compact={true} screenId={screenId} enableMicrophone={true} />
        </div>
      </div>
    </div>
  );
}

export default Screen1;
