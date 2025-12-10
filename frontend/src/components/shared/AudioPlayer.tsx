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
  enableMicrophone?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  screenId = 0,
  compact = false,
  className = '',
  enableMicrophone = false
}) => {
  const { topicData } = useWebSocket({
    screenId,
    topics: ['/robot/audio/stream'],
  });

  const audioAnimationRef = useRef<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioReceiving, setAudioReceiving] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true); // 默认开启麦克风
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micDataArrayRef = useRef<Uint8Array | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0); // 当前音量

  // 音频可视化动画
  useEffect(() => {
    const animate = () => {
      const bars = document.querySelectorAll('.audio-bar');
      const miniBars = document.querySelectorAll('.audio-bar-mini');
      
      // 如果麦克风启用且有分析器，使用真实数据
      if (micEnabled && analyserRef.current && micDataArrayRef.current) {
        try {
          const dataArray = new Uint8Array(micDataArrayRef.current.length);
          // 使用时域数据来获取音频波形（反映音量变化）
          analyserRef.current.getByteTimeDomainData(dataArray);
        
          // 计算平均音量（RMS）
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128; // 归一化到 -1 到 1
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const volume = rms * 100; // 转换为百分比
          
          // 更新当前音量状态
          setCurrentVolume(volume);
          
          // 设置音量阈值，低于阈值时不显示波形
          const volumeThreshold = 1.5; // 音量阈值
          
          if (volume > volumeThreshold) {
            // 有声音时，根据音量调整所有波形条的高度
            bars.forEach((bar) => {
              // 为每个条添加轻微的随机变化，使波形更自然
              const randomFactor = 0.8 + Math.random() * 0.4;
              const height = volume * randomFactor * 3; // 乘以3放大效果
              (bar as HTMLElement).style.height = `${Math.max(5, Math.min(100, height))}%`;
              (bar as HTMLElement).style.opacity = '1';
            });
            
            // 更新紧凑模式的波形条
            if (miniBars.length > 0) {
              const frequencyData = new Uint8Array(analyserRef.current!.frequencyBinCount);
              analyserRef.current!.getByteFrequencyData(frequencyData);
              
              miniBars.forEach((bar, index) => {
                // 将频率数据映射到波形条
                const barIndex = Math.floor((index / miniBars.length) * frequencyData.length);
                const frequencyValue = frequencyData[barIndex] || 0;
                const height = (frequencyValue / 255) * 100;
                
                (bar as HTMLElement).style.height = `${Math.max(10, Math.min(100, height))}%`;
                (bar as HTMLElement).style.opacity = height > 5 ? '1' : '0.3';
              });
            }
          } else {
            // 安静时，隐藏波形
            bars.forEach((bar) => {
              (bar as HTMLElement).style.height = '0%';
              (bar as HTMLElement).style.opacity = '0';
            });
            
            miniBars.forEach((bar) => {
              (bar as HTMLElement).style.height = '10%';
              (bar as HTMLElement).style.opacity = '0.3';
            });
          }
        } catch (error) {
          console.error('[AudioPlayer] 音频频谱分析错误:', error);
        }
      } else {
        // 麦克风未启用时，隐藏波形
        bars.forEach((bar) => {
          (bar as HTMLElement).style.height = '0%';
          (bar as HTMLElement).style.opacity = '0';
        });
        
        miniBars.forEach((bar) => {
          (bar as HTMLElement).style.height = '10%';
          (bar as HTMLElement).style.opacity = '0.3';
        });
      }

      audioAnimationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
    };
  }, [micEnabled]);

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

  // 切换麦克风
  const toggleMicrophone = async () => {
    if (!enableMicrophone) return;

    if (micEnabled) {
      // 关闭麦克风
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        setMicStream(null);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      micDataArrayRef.current = null;
      audioDestinationRef.current = null;
      setMicEnabled(false);
      setIsPlayingBack(false);
      setCurrentVolume(0);
    } else {
      // 开启麦克风
      await initializeMicrophone();
    }
  };

  // 初始化麦克风
  const initializeMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      
      // 创建音频上下文和分析器
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // 增大 FFT 以获得更精确的波形数据
      analyser.smoothingTimeConstant = 0.3; // 减小平滑以提高响应速度
      analyserRef.current = analyser;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      micDataArrayRef.current = dataArray;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // 创建音频目标节点（用于回放）
      const destination = audioContext.createMediaStreamDestination();
      audioDestinationRef.current = destination;
      
      // 连接到分析器和目标节点
      source.connect(destination);
      
      setMicEnabled(true);
      console.log('[AudioPlayer] 麦克风初始化成功');
    } catch (error) {
      console.error('[AudioPlayer] 麦克风访问失败:', error);
      setMicEnabled(false);
    }
  };

  // 切换回放（调试阶段：回放本地麦克风音频）
  const togglePlayback = () => {
    if (!micEnabled || !audioDestinationRef.current) {
      alert('请先开启麦克风');
      return;
    }
    
    if (isPlayingBack) {
      // 停止回放
      audioPlaybackService.stop();
      setIsPlayingBack(false);
    } else {
      // 开始回放本地麦克风音频
      try {
        const stream = audioDestinationRef.current.stream;
        const audioElement = new Audio();
        audioElement.srcObject = stream;
        audioElement.play();
        
        // 存储音频元素以便停止
        (window as any).__debugAudioElement = audioElement;
        
        setIsPlayingBack(true);
      } catch (error) {
        console.error('[AudioPlayer] 回放失败:', error);
        alert('音频回放失败');
      }
    }
  };

  // 组件挂载时自动初始化麦克风
  useEffect(() => {
    if (enableMicrophone && micEnabled) {
      initializeMicrophone();
    }
    
    return () => {
      // 组件卸载时清理麦克风
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // 清理回放音频
      if ((window as any).__debugAudioElement) {
        (window as any).__debugAudioElement.pause();
        (window as any).__debugAudioElement.srcObject = null;
        delete (window as any).__debugAudioElement;
      }
    };
  }, []); // 只在组件挂载时执行一次

  // 如果是紧凑模式，使用一行布局
  if (compact) {
    return (
      <div className="audio-player-inline">
        <span className="audio-inline-label">🔊 音频</span>
        
        {/* 波形图 - 始终显示，占据剩余空间 */}
        <div className="audio-inline-bars">
          {[...Array(24)].map((_, i) => (
            <div 
              key={i} 
              className="audio-bar-mini"
              style={{ 
                height: micEnabled && currentVolume > 1.5 ? `${Math.max(10, Math.min(100, currentVolume * 0.8 + Math.random() * 20))}%` : '10%',
                opacity: micEnabled && currentVolume > 1.5 ? '1' : '0.3',
                transition: 'height 0.05s ease-out, opacity 0.1s ease-out'
              }}
            />
          ))}
        </div>
        
        {micEnabled && (
          <span className="audio-inline-volume">{currentVolume.toFixed(0)}%</span>
        )}
        
        <div className="audio-inline-controls">
          {enableMicrophone && (
            <button 
              className={`control-btn-mini ${micEnabled ? 'active' : ''}`}
              onClick={toggleMicrophone}
              title={micEnabled ? '关闭麦克风' : '开启麦克风'}
            >
              {micEnabled ? '🎤' : '🎙️'}
            </button>
          )}
          <button 
            className={`control-btn-mini ${audioMuted ? 'muted' : ''}`}
            onClick={toggleAudioMute}
            title={audioMuted ? '取消静音' : '静音'}
          >
            {audioMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`audio-player ${className}`}>
      <div className="audio-header">
        <h3>🔊 音频通信</h3>
        {audioReceiving && !audioMuted && (
          <span className="streaming-badge">● 接收中</span>
        )}
        {isPlayingBack && (
          <span className="streaming-badge playback-active">🔊 播放中</span>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {enableMicrophone && (
            <>
              <button 
                className={`control-btn ${micEnabled ? 'active' : ''}`}
                onClick={toggleMicrophone}
                title={micEnabled ? '关闭麦克风' : '开启麦克风'}
              >
                {micEnabled ? '🎤' : '🎙️'}
              </button>
              <button 
                className={`control-btn ${isPlayingBack ? 'active' : ''}`}
                onClick={togglePlayback}
                title={isPlayingBack ? '停止播放' : '播放音频（调试：本地回放）'}
                disabled={!micEnabled}
              >
                {isPlayingBack ? '⏹️' : '▶️'}
              </button>
            </>
        )}
        <button 
          className={`control-btn ${audioMuted ? 'muted' : ''}`}
          onClick={toggleAudioMute}
          title={audioMuted ? '取消静音' : '静音'}
        >
          {audioMuted ? '🔇' : '🔊'}
        </button>
        </div>
      </div>
      
      <div className="audio-visualizer">
        {micEnabled && (
          <div className="audio-volume-indicator">
            <span className="volume-label">音量:</span>
            <span className="volume-value">{currentVolume.toFixed(1)}%</span>
          </div>
        )}
        <div className="audio-bars">
          {[...Array(32)].map((_, i) => (
            <div 
              key={i} 
              className="audio-bar"
              style={{ 
                height: '0%',
                opacity: '0',
                animationDelay: `${i * 0.05}s`,
                transition: 'height 0.05s ease-out, opacity 0.1s ease-out'
              }}
            />
          ))}
        </div>
      </div>
      
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
    </div>
  );
};

