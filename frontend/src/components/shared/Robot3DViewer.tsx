/**
 * Robot3DViewer - 3D机器人查看器组件
 * 使用Three.js渲染行走中的人形机器人
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HumanoidRobotGenerator } from '../../utils/HumanoidRobotGenerator';
import { WalkingAnimation } from '../../utils/WalkingAnimation';

export interface Robot3DViewerProps {
  width: number;
  height: number;
  enableAutoRotate?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
  backgroundColor?: string;
  className?: string;
}

export const Robot3DViewer: React.FC<Robot3DViewerProps> = ({
  width,
  height,
  enableAutoRotate = false,
  showGrid = true,
  showAxes = false,
  backgroundColor = '#1a1a2e',
  className = '',
}) => {
  
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const animationRef = useRef<WalkingAnimation>();
  const animationIdRef = useRef<number>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!mountRef.current) {
      console.error('[Robot3DViewer] 初始化失败: mountRef为null');
      setError('3D容器加载失败，请刷新页面');
      setIsLoading(false);
      return;
    }

    try {
      
      // 检查WebGL支持
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.error('[Robot3DViewer] 初始化失败: 浏览器不支持WebGL');
        setError('您的浏览器不支持WebGL，无法显示3D内容');
        setIsLoading(false);
        return;
      }

      // 创建场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);
      sceneRef.current = scene;

      // 创建相机
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(3, 2, 5);
      camera.lookAt(0, 1, 0);
      cameraRef.current = camera;

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      mountRef.current.appendChild(renderer.domElement);

      // 添加环境光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      // 添加方向光
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.camera.left = -5;
      directionalLight.shadow.camera.right = 5;
      directionalLight.shadow.camera.top = 5;
      directionalLight.shadow.camera.bottom = -5;
      directionalLight.shadow.camera.near = 0.1;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);

      // 添加地面
      if (showGrid) {
        const groundGeometry = new THREE.PlaneGeometry(10, 10);
        const groundMaterial = new THREE.MeshLambertMaterial({
          color: 0x333333,
          side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        scene.add(ground);

        // 添加网格线
        const gridHelper = new THREE.GridHelper(10, 20, 0x666666, 0x444444);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);
      }

      // 添加坐标轴
      if (showAxes) {
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);
      }

      // 创建人形机器人
      const robotGenerator = new HumanoidRobotGenerator({
        scale: 0.8,
      });
      const robot = robotGenerator.generate();
      scene.add(robot.group);

      // 创建走路动画
      const walkAnimation = new WalkingAnimation(robot, {
        walkSpeed: 1.0,
        stepHeight: 0.2,
        armSwing: 0.6,
        bodyBob: 0.05,
      });
      animationRef.current = walkAnimation;
      walkAnimation.start();

      // 相机自动旋转
      let cameraAngle = 0;

      // 动画循环
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        // 相机旋转
        if (enableAutoRotate) {
          cameraAngle += 0.003;
          camera.position.x = Math.cos(cameraAngle) * 5;
          camera.position.z = Math.sin(cameraAngle) * 5;
          camera.lookAt(0, 1, 0);
        }

        renderer.render(scene, camera);
      };
      animate();

      setIsLoading(false);

      // 清理函数
      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        if (animationRef.current) {
          animationRef.current.stop();
        }
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        
        // 清理Three.js资源
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });
        
        renderer.dispose();
        robotGenerator.dispose(robot);
      };
    } catch (err) {
      console.error('[Robot3DViewer] 初始化失败:', err);
      setError('3D场景初始化失败，请刷新页面重试');
      setIsLoading(false);
    }
  }, [width, height, enableAutoRotate, showGrid, showAxes, backgroundColor]);

  // 响应窗口大小变化
  useEffect(() => {
    if (!cameraRef.current || !rendererRef.current) return;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, [width, height]);

  // 始终渲染容器div，loading和error状态作为覆盖层显示
  return (
    <div
      className={`robot-3d-container ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 3D场景容器 - 始终渲染 */}
      <div
        ref={mountRef}
        className="robot-3d-viewer"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />

      {/* 加载状态覆盖层 */}
      {isLoading && (
        <div
          className="robot-3d-loading"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: backgroundColor,
            color: '#94a3b8',
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(148, 163, 184, 0.2)',
                borderTop: '4px solid #10b981',
                borderRadius: '50%',
                margin: '0 auto 10px',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ margin: 0, fontSize: '12px' }}>加载3D场景中...</p>
          </div>
        </div>
      )}

      {/* 错误状态覆盖层 */}
      {error && (
        <div
          className="robot-3d-error"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: backgroundColor,
            color: '#ef4444',
            padding: '20px',
            textAlign: 'center',
            borderRadius: '8px',
            zIndex: 10,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>⚠️ {error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

