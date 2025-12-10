/**
 * VideoPlayer - 视频播放器共享组件
 * 支持真实摄像头和模拟视频
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { formatNetworkSpeed } from '../../utils/formatNetworkSpeed';
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
  const [useSimulation, setUseSimulation] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [cameraInfo, setCameraInfo] = useState({
    width: 1920,
    height: 1080,
    fps: 30,
    deviceLabel: '初始化中...',
  });
  
  // 视频流统计信息
  const [videoStats, setVideoStats] = useState({
    bitrate: 0,
    networkSpeed: 0,
    frameCount: 0,
  });
  const lastStatsUpdateRef = useRef(Date.now());
  const frameCountRef = useRef(0);

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

  // 使用ref存储isPaused，避免drawSimulatedVideo重新创建
  const isPausedRef = useRef(false);

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

  // 主初始化 - 移除依赖,使用最新的函数引用
  const initializeVideo = useCallback(async () => {
    // 开始初始化视频流
    setIsVideoLoading(true);
    setVideoError(null);
    
    // 先清理现有资源
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      // 停止现有视频流轨道
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      // 强制重置视频元素
      videoRef.current.load();
    }
    
    // 等待一小段时间确保资源完全释放
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 尝试初始化真实摄像头
    try {
      console.log('[VideoPlayer] 请求摄像头访问...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      // 摄像头访问成功
      streamRef.current = stream;
    
      if (videoRef.current) {
        // 设置video元素srcObject
        videoRef.current.srcObject = stream;
        
        // 确保视频元素准备好
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('videoRef丢失'));
            return;
          }
          
          const video = videoRef.current;
          
          const onLoadedMetadata = () => {
            // 视频元数据加载完成
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          
          // 超时保护
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve(); // 即使超时也继续
          }, 3000);
        });
        
        // 开始播放视频
        await videoRef.current.play();
        // 视频播放成功
      }

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // 摄像头设置完成
      
      setCameraInfo({
        width: settings.width || 1920,
        height: settings.height || 1080,
        fps: settings.frameRate || 30,
        deviceLabel: videoTrack.label || '真实摄像头',
      });

      setUseSimulation(false);
      setIsVideoLoading(false);
      setVideoError(null);
      // 真实摄像头初始化完成
    } catch (error: any) {
      console.error('[VideoPlayer] 摄像头初始化失败,切换到模拟视频:', error);
      console.error('[VideoPlayer] 错误详情:', error?.message, error?.name);

  // 初始化模拟视频
      try {
        // 开始初始化模拟视频
    const canvas = canvasRef.current;
    if (!canvas) {
          throw new Error('canvas元素未找到');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
          throw new Error('无法获取canvas 2d context');
    }

    // 设置canvas尺寸
    canvas.width = 1920;
    canvas.height = 1080;

    // 先绘制一帧，确保canvas有内容
    drawSimulatedVideo(ctx, canvas.width, canvas.height);

    // 创建视频流（30fps）
    const stream = canvas.captureStream(30);
    streamRef.current = stream;
        // 模拟视频流创建成功

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      
      // 等待视频元数据加载
      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('videoRef丢失'));
          return;
        }
        
        const video = videoRef.current;
        
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        
        // 超时保护
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve(); // 即使超时也继续
        }, 3000);
      });
      
      // 开始播放视频
      await videoRef.current.play();
          // 模拟视频播放成功
    }

    setCameraInfo({
      width: 1920,
      height: 1080,
      fps: 30,
      deviceLabel: '模拟机器人视角',
    });

    setUseSimulation(true);
    setIsVideoLoading(false);
    setVideoError(null);
        // 模拟视频初始化完成
      } catch (simError: any) {
        console.error('[VideoPlayer] 模拟视频初始化也失败:', simError);
        setVideoError(`视频初始化失败: ${simError?.message || '未知错误'}`);
        setIsVideoLoading(false);
      }
    }
  }, [drawSimulatedVideo]);

  // 组件挂载时初始化 - 使用 useLayoutEffect 确保 refs 已绑定
  useLayoutEffect(() => {
    if (isVideoEnabled) {
      initializeVideo();
    }
    
    return () => {
      cleanupResources();
    };
  }, [isVideoEnabled]); // 只依赖 isVideoEnabled

  // 时钟更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 视频统计信息更新（模拟）
  useEffect(() => {
    if (!isVideoEnabled || isVideoLoading || videoError) return;
    
    const statsTimer = setInterval(() => {
      frameCountRef.current++;
      
      // 模拟码率和网速计算
      const now = Date.now();
      const elapsed = (now - lastStatsUpdateRef.current) / 1000;
      
      if (elapsed >= 1) {
        const fps = cameraInfo.fps || 30;
        const resolution = cameraInfo.width * cameraInfo.height;
        // 估算码率（基于分辨率和帧率）
        const estimatedBitrate = (resolution * fps * 0.15) / 1000; // kbps
        // 模拟网速变化
        const networkSpeed = estimatedBitrate * (0.9 + Math.random() * 0.2);
        
        setVideoStats({
          bitrate: Math.round(estimatedBitrate),
          networkSpeed: Math.round(networkSpeed),
          frameCount: frameCountRef.current,
        });
        
        lastStatsUpdateRef.current = now;
      }
    }, 100);
    
    return () => clearInterval(statsTimer);
  }, [isVideoEnabled, isVideoLoading, videoError, cameraInfo]);


  // 切换视频流开启/关闭
  const handleToggleVideo = () => {
    if (isVideoEnabled) {
      // 关闭视频流
      cleanupResources();
      setIsVideoEnabled(false);
      setIsVideoLoading(false);
      setVideoError(null);
    } else {
      // 开启视频流
      setIsVideoEnabled(true);
      initializeVideo();
    }
  };

  return (
    <div className={`video-player ${compact ? 'compact' : ''} ${className}`}>
      <div className="video-container" style={{ position: 'relative', backgroundColor: '#000' }}>
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
            display: isVideoLoading || videoError || !isVideoEnabled ? 'none' : 'block',
            backgroundColor: '#000' // 确保背景是黑色，避免显示空白
          }}
        />
        <canvas 
          ref={canvasRef} 
          style={{ 
            display: useSimulation ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1
          }}
        />
        
        {/* 视频叠加层 - 始终显示 */}
        <div className="video-overlay">
          {/* 仅在视频播放时显示顶部信息 */}
          {!isVideoLoading && !videoError && isVideoEnabled && (
            <div className="overlay-info">
              <span className="live-badge">🔴 LIVE</span>
              <span className="timestamp">{currentTime}</span>
            </div>
          )}
          
          {/* 底部控制条 - 始终显示，包含统计信息和开关按钮 */}
          {showControls && (
            <div className="video-overlay-controls">
              {/* 视频统计信息 - 仅在视频播放时显示 */}
              {!isVideoLoading && !videoError && isVideoEnabled && (
                <div className="video-stats-inline">
                  <span className="stat-item-inline">
                    <span className="stat-label">网速</span>
                    <span className="stat-value">{formatNetworkSpeed(videoStats.networkSpeed)}</span>
                  </span>
                  <span className="stat-item-inline">
                    <span className="stat-label">帧率</span>
                    <span className="stat-value">{cameraInfo.fps}fps</span>
                  </span>
                </div>
              )}
              
              {/* 占位符，保持按钮在右边 */}
              {(isVideoLoading || videoError || !isVideoEnabled) && <div style={{ flex: 1 }} />}
              
              <button 
                className={`overlay-control-btn ${isVideoEnabled ? 'close-btn' : 'start-btn'}`}
                onClick={handleToggleVideo}
                title={isVideoEnabled ? "关闭视频流" : "开启视频流"}
              >
                {isVideoEnabled ? '📴' : '📹'}
              </button>
            </div>
          )}
        </div>
        
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
        {videoError && isVideoEnabled && (
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
        
        {/* 视频已关闭覆盖层 */}
        {!isVideoEnabled && (
          <div className="video-placeholder disabled" style={{
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
              <div className="placeholder-icon">📴</div>
              <p className="placeholder-title">视频流已关闭</p>
              <p style={{ 
                fontSize: '14px', 
                color: '#64748b', 
                marginTop: '10px',
                marginBottom: '20px'
              }}>
                点击下方按钮重新开启视频流
              </p>
            </div>
          </div>
        )}
      </div>


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

