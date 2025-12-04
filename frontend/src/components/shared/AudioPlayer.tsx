/**
 * AudioPlayer - 音频播放器共享组件
 * 负责播放机器人音频流和可视化
 */

import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { audioPlaybackService } from '../../services/audioStream';
import './CompactStyles.css';

interface AudioPlayerProps {
  screenId?: number;
  compact?: boolean;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  screenId = 0,
  compact = false,
  className = ''
}) => {
  const { topicData } = useWebSocket({
    screenId,
    topics: ['/robot/audio/stream'],
  });

  const audioAnimationRef = useRef<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioReceiving, setAudioReceiving] = useState(false);

  // 音频可视化动画
  useEffect(() => {
    const animate = () => {
      const bars = document.querySelectorAll('.audio-bar');
      
      // 模拟音频数据（实际项目中可以连接真实的AnalyserNode）
      const time = Date.now() * 0.001;
      bars.forEach((bar, index) => {
        const value = Math.abs(Math.sin(time + index * 0.2)) * 128 + Math.random() * 50;
        const height = (value / 255) * 100;
        (bar as HTMLElement).style.height = `${Math.max(5, height)}%`;
      });

      audioAnimationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
    };
  }, []);

  // 监听并播放机器人音频流
  useEffect(() => {
    const audioData = topicData.get('/robot/audio/stream');
    
    if (audioData && !audioMuted) {
      setAudioReceiving(true);
      audioPlaybackService.playAudioData(audioData.audio, audioData.encoding || 'webm/opus');
    } else {
      setAudioReceiving(false);
    }
  }, [topicData, audioMuted]);

  // 初始化音频播放器
  useEffect(() => {
    audioPlaybackService.initialize();
    
    return () => {
      audioPlaybackService.cleanup();
    };
  }, []);

  // 切换静音
  const toggleAudioMute = () => {
    if (!audioMuted) {
      audioPlaybackService.stop();
    }
    setAudioMuted(!audioMuted);
  };

  return (
    <div className={`audio-player ${compact ? 'compact' : ''} ${className}`}>
      <div className="audio-header">
        <h3>🔊 机器人音频</h3>
        {audioReceiving && !audioMuted && (
          <span className="streaming-badge">● 接收中</span>
        )}
        <button 
          className={`control-btn ${audioMuted ? 'muted' : ''}`}
          onClick={toggleAudioMute}
          title={audioMuted ? '取消静音' : '静音'}
        >
          {audioMuted ? '🔇' : '🔊'}
        </button>
      </div>
      
      <div className="audio-visualizer">
        <div className="audio-bars">
          {[...Array(compact ? 16 : 32)].map((_, i) => (
            <div 
              key={i} 
              className="audio-bar"
              style={{ 
                height: '5%',
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      </div>
      
      {!compact && (
        <div className="audio-info">
          <div className="audio-metric">
            <span>采样率:</span>
            <span>48kHz</span>
          </div>
          <div className="audio-metric">
            <span>位深度:</span>
            <span>16-bit</span>
          </div>
          <div className="audio-metric">
            <span>声道:</span>
            <span>立体声</span>
          </div>
        </div>
      )}
    </div>
  );
};

