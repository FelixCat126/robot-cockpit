/**
 * VideoPlayer - 视频播放器共享组件
 * 支持真实摄像头和模拟视频
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import './CompactStyles.css';

interface VideoPlayerProps {
  screenId?: number;
  compact?: boolean;
  showControls?: boolean;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  screenId: _screenId = 0,
  compact = false,
  showControls = true,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [useSimulation, setUseSimulation] = useState(false);
  const [cameraInfo, setCameraInfo] = useState({
    width: 1920,
    height: 1080,
    fps: 30,
    deviceLabel: '初始化中...',
  });

  // 清理资源
  const cleanupResources = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 初始化真实摄像头
  const initRealCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      setCameraInfo({
        width: settings.width || 1920,
        height: settings.height || 1080,
        fps: settings.frameRate || 30,
        deviceLabel: videoTrack.label || '真实摄像头',
      });

      setUseSimulation(false);
      setIsVideoLoading(false);
      setVideoError(null);
      
      return true;
    } catch (error) {
      console.error('[VideoPlayer] 摄像头初始化失败:', error);
      setVideoError('无法访问摄像头');
      return false;
    }
  }, []);

  // 使用ref存储isPaused，避免drawSimulatedVideo重新创建
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // 绘制模拟视频
  const drawSimulatedVideo = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    let frame = 0;
    let hue = 0;

    const draw = () => {
      if (isPausedRef.current) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      // 背景渐变
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, `hsl(${hue}, 60%, 15%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 60%, 10%)`);
      gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 60%, 15%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 网格线
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i + (frame % 40));
        ctx.lineTo(width, i + (frame % 40));
        ctx.stroke();
      }

      // 中心准星
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(centerX - 50, centerY);
      ctx.lineTo(centerX + 50, centerY);
      ctx.moveTo(centerX, centerY - 50);
      ctx.lineTo(centerX, centerY + 50);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.stroke();

      // 信息文字
      ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`FRAME: ${String(frame).padStart(6, '0')}`, 50, 80);
      ctx.fillText(`TIME: ${new Date().toLocaleTimeString()}`, 50, 120);

      frame++;
      hue = (hue + 0.5) % 360;

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []); // 移除isPaused依赖，使用ref代替

  // 初始化模拟视频
  const initSimulatedVideo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('[VideoPlayer] 模拟视频初始化失败: canvasRef为null');
      return false;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[VideoPlayer] 模拟视频初始化失败: 无法获取2D context');
      return false;
    }

    canvas.width = 1920;
    canvas.height = 1080;

    const stream = canvas.captureStream(30);
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.error('[VideoPlayer] 模拟视频播放失败:', e);
      });
    }

    drawSimulatedVideo(ctx, canvas.width, canvas.height);

    setCameraInfo({
      width: 1920,
      height: 1080,
      fps: 30,
      deviceLabel: '模拟机器人视角',
    });

    setUseSimulation(true);
    setIsVideoLoading(false);
    setVideoError(null);
    
    return true;
  }, [drawSimulatedVideo]);

  // 主初始化
  const initializeVideo = useCallback(async () => {
    setIsVideoLoading(true);
    setVideoError(null);
    
    cleanupResources();
    
    const cameraSuccess = await initRealCamera();
    
    if (!cameraSuccess) {
      initSimulatedVideo();
    }
  }, [cleanupResources, initRealCamera, initSimulatedVideo]);

  // 组件挂载时初始化 - 使用 useLayoutEffect 确保 refs 已绑定
  useLayoutEffect(() => {
    initializeVideo();
    
    return () => {
      cleanupResources();
    };
  }, [initializeVideo, cleanupResources]);

  // 播放/暂停
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  // 截图
  const handleScreenshot = () => {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    if (!video) return;

    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `robot-camera-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    }
  };

  // 全屏
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className={`video-player ${compact ? 'compact' : ''} ${className}`}>
      <div className="video-container" style={{ position: 'relative' }}>
        {/* 视频和Canvas元素 - 始终渲染 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-stream"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: isVideoLoading || videoError ? 'none' : 'block'
          }}
        />
        <canvas 
          ref={canvasRef} 
          style={{ display: 'none' }}
        />
        
        {/* 视频叠加层 - 仅在正常播放时显示 */}
        {!isVideoLoading && !videoError && (
          <div className="video-overlay">
            <div className="overlay-info">
              <span className="live-badge">🔴 LIVE</span>
              <span className="timestamp">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
        
        {/* 加载状态覆盖层 */}
        {isVideoLoading && (
          <div className="video-placeholder" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            zIndex: 10
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="placeholder-icon loading">📹</div>
              <p className="placeholder-title">正在初始化视频流...</p>
            </div>
          </div>
        )}
        
        {/* 错误状态覆盖层 */}
        {videoError && (
          <div className="video-placeholder error" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            zIndex: 10
          }}>
            <div style={{ textAlign: 'center' }}>
              <div className="placeholder-icon">❌</div>
              <p className="placeholder-title">{videoError}</p>
              <button className="retry-btn" onClick={initializeVideo}>
                🔄 重试
              </button>
            </div>
          </div>
        )}
      </div>

      {showControls && !isVideoLoading && !videoError && (
        <div className="video-controls">
          <button 
            className="control-btn" 
            onClick={handlePlayPause}
            title={isPaused ? '播放' : '暂停'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
          <button 
            className="control-btn" 
            onClick={handleScreenshot}
            title="截图"
          >
            📸
          </button>
          <button 
            className="control-btn" 
            onClick={handleFullscreen}
            title="全屏"
          >
            ⛶
          </button>
          <button 
            className="control-btn" 
            onClick={initializeVideo}
            title="刷新"
          >
            🔄
          </button>
        </div>
      )}

      {!compact && (
        <div className="camera-info-panel">
          <h3>📷 相机参数</h3>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">🎥</div>
              <div className="info-content">
                <div className="info-title">视频源</div>
                <div className="info-value">{cameraInfo.deviceLabel}</div>
              </div>
            </div>
            <div className="info-card">
              <div className="info-icon">📐</div>
              <div className="info-content">
                <div className="info-title">分辨率</div>
                <div className="info-value">{cameraInfo.width}x{cameraInfo.height}</div>
              </div>
            </div>
            <div className="info-card">
              <div className="info-icon">🎞️</div>
              <div className="info-content">
                <div className="info-title">帧率</div>
                <div className="info-value">{cameraInfo.fps} FPS</div>
              </div>
            </div>
            <div className="info-card">
              <div className="info-icon">🎨</div>
              <div className="info-content">
                <div className="info-title">模式</div>
                <div className="info-value">{useSimulation ? '模拟' : '实时'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

