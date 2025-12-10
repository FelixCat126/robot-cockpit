/**
 * Robot3DViewer - 3D机器人查看器组件
 * 使用Three.js渲染行走中的人形机器人
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { URDFLoader } from '../../utils/URDFLoader';
import { useRobot3DStore } from '../../stores/robot3DStore';
import { JointStateManager } from '../../utils/JointStateManager';
import { useWebSocket } from '../../hooks/useWebSocket';

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
  const animationIdRef = useRef<number>();
  const robotGroupRef = useRef<THREE.Group>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 从全局状态获取控制指令和移动速度
  const { currentCommand, moveVelocity: storeMoveVelocity } = useRobot3DStore();

  // 新增：关节状态管理器
  const jointManagerRef = useRef<JointStateManager>();

  // 新增：订阅关节状态话题
  const { getTopicData } = useWebSocket({
    topics: ['/joint_states'], // 订阅机器人关节状态
    autoConnect: false, // 不自动连接，避免影响现有逻辑
  });
  
  // 用于存储移动速度的ref（支持多向运动）
  const moveVelocityRef = useRef({ linearX: 0, linearY: 0, angularZ: 0 });
  
  // 用于存储步行动画状态
  const walkingAnimationRef = useRef({
    isWalking: false,
    walkCycle: 0, // 步行周期（0-1）
    leftLegPhase: 0, // 左腿相位
    rightLegPhase: 0, // 右腿相位
  });

  // 获取实际容器尺寸
  const getContainerSize = () => {
    if (width === 100 && height === 100 && mountRef.current?.parentElement) {
      // 自适应模式：使用父容器尺寸
      const parent = mountRef.current.parentElement;
      return {
        width: parent.clientWidth || 800,
        height: parent.clientHeight || 600
      };
    }
    return { width, height };
  };

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

      // 获取实际尺寸
      const containerSize = getContainerSize();
      const actualWidth = containerSize.width;
      const actualHeight = containerSize.height;

      // 创建场景 - 星空背景
      const scene = new THREE.Scene();
      
      // 创建星空背景
      const starsGeometry = new THREE.BufferGeometry();
      const starsCount = 5000;
      const starsPositions = new Float32Array(starsCount * 3);
      
      for (let i = 0; i < starsCount * 3; i += 3) {
        // 在球面上随机分布星星
        const radius = 100 + Math.random() * 900; // 100-1000单位距离
        const theta = Math.random() * Math.PI * 2; // 方位角
        const phi = Math.acos(2 * Math.random() - 1); // 极角
        
        starsPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starsPositions[i + 2] = radius * Math.cos(phi);
      }
      
      starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
      
      const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: true,
      });
      
      const stars = new THREE.Points(starsGeometry, starsMaterial);
      scene.add(stars);
      
      // 深色背景
      scene.background = new THREE.Color(0x000011); // 深蓝色背景
      
      sceneRef.current = scene;

      // 创建相机 - 调整视角使机器人居中
      const camera = new THREE.PerspectiveCamera(50, actualWidth / actualHeight, 0.1, 1000);
      camera.position.set(2.5, 1.0, 4.5); // 调整相机位置，使机器人更居中
      camera.lookAt(0, 0.6, 0); // 看向机器人中心（骨盆位置）
      cameraRef.current = camera;

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(actualWidth, actualHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      mountRef.current.appendChild(renderer.domElement);

      // 工业风格光照系统
      const ambientLight = new THREE.AmbientLight(0x606060, 0.5); // 中性灰环境光
      scene.add(ambientLight);

      // 主光源（自然白光）
      const mainLight = new THREE.DirectionalLight(0xffffff, 0.8); // 白色主光
      mainLight.position.set(5, 10, 7.5);
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      scene.add(mainLight);
      
      // 辅助光源（暖黄色）
      const rimLight = new THREE.DirectionalLight(0xffaa00, 0.3); // 暖黄色
      rimLight.position.set(-5, 5, -5);
      scene.add(rimLight);

      // 创建地面网格（固定，不旋转）
      if (showGrid) {
        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
        gridHelper.position.y = 0;
        (gridHelper.material as THREE.Material).opacity = 0.3;
        (gridHelper.material as THREE.Material).transparent = true;
        scene.add(gridHelper); // 直接添加到场景，不旋转
      }
      
      // 添加坐标轴
      if (showAxes) {
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);
      }

      // 加载宇树G1机器人URDF模型（包含完整的STL mesh）
      const urdfLoader = new URDFLoader('/models/g1_robot');
      
      console.log('[Robot3DViewer] 开始加载宇树G1机器人URDF模型...');
      
      urdfLoader.load('/models/g1_robot/g1_29dof_rev_1_0.urdf')
        .then((robotModel) => {
          console.log('[Robot3DViewer] URDF模型加载成功，包含STL mesh');
          
          // 检查所有link，特别关注足部
          const linkNames: string[] = [];
          robotModel.traverse((obj) => {
            if (obj instanceof THREE.Group) {
              linkNames.push(obj.name);
              if (obj.name.toLowerCase().includes('ankle') || obj.name.toLowerCase().includes('foot')) {
                console.log(`[Robot3DViewer] 🔍 发现足部link: ${obj.name}, children:`, obj.children.length);
                obj.children.forEach((child, idx) => {
                  console.log(`[Robot3DViewer]   - child[${idx}]:`, child.constructor.name, child.name);
                });
              }
            }
          });
          console.log(`[Robot3DViewer] 所有link名称:`, linkNames);
          
          // 调整机器人大小和位置（宇树G1机器人约1.27m高）
          robotModel.scale.set(3, 3, 3); // 放大3倍便于查看
          
          // 机器人倒立了,需要绕X轴旋转180度翻转过来,再绕X轴90度调整姿态
          // 总共需要旋转270度 = 90度 + 180度
          robotModel.rotation.x = -Math.PI / 2; // -90度,让机器人正立
          
          // 调整位置：让机器人站在地面上，居中显示
          // 机器人高度约1.27m，原点在骨盆中心（约0.6m高），所以需要抬高0.6m让脚着地
          robotModel.position.set(0, 0.6, 0);
          
          scene.add(robotModel);
          robotGroupRef.current = robotModel;
          
          console.log('[Robot3DViewer] 机器人已添加到场景');
          console.log('[Robot3DViewer] 最终rotation:', robotModel.rotation);
          console.log('[Robot3DViewer] 最终position:', robotModel.position);
          
          // 获取关节映射（用于后续动画）
          const jointMap = URDFLoader.getJointMap(robotModel);
          (robotModel as any).jointMap = jointMap;
          
          console.log(`[Robot3DViewer] 关节数量: ${jointMap.size}`);

          // 新增：初始化关节状态管理器（用于实时同步）
          try {
            jointManagerRef.current = new JointStateManager();
            jointManagerRef.current.mapJointsFromScene(robotModel);
            jointManagerRef.current.setInterpolation(true, 0.3); // 启用平滑插值
            console.log('[Robot3DViewer] 关节状态管理器初始化成功');
          } catch (err) {
            console.error('[Robot3DViewer] 关节管理器初始化失败:', err);
          }
          
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('[Robot3DViewer] URDF模型加载失败:', error);
          setError(`无法加载宇树G1机器人模型: ${error.message || '未知错误'}`);
          setIsLoading(false);
        });

      // 动画循环
      let lastTime = performance.now();
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // 转换为秒
        lastTime = currentTime;

        // 背景固定不动（不再旋转）
        
        // 根据摇杆输入更新步行动画（不改变位置，只显示动画）
        if (robotGroupRef.current) {
          const velocity = moveVelocityRef.current;
          const walkingAnim = walkingAnimationRef.current;
          
          // 计算移动速度大小（只考虑前后左右，不考虑转向）
          const speed = Math.sqrt(velocity.linearX * velocity.linearX + velocity.linearY * velocity.linearY);
          const hasMovement = speed > 0.01; // 只检查线速度，不检查角速度
          
          if (hasMovement) {
            // 更新步行动画
            const walkSpeed = speed * 3; // 步行动画速度（根据速度大小调整动画速度）
            walkingAnim.walkCycle += walkSpeed * deltaTime;
            if (walkingAnim.walkCycle > 1) {
              walkingAnim.walkCycle -= 1;
            }
            
            // 左右腿相位差180度
            walkingAnim.leftLegPhase = walkingAnim.walkCycle;
            walkingAnim.rightLegPhase = (walkingAnim.walkCycle + 0.5) % 1;
            
            // 应用步行动画到腿部关节
            const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
            if (jointMap) {
              // 左腿步行动画
              const leftHipPitch = jointMap.get('left_hip_pitch_joint');
              const leftKnee = jointMap.get('left_knee_joint');
              const leftAnklePitch = jointMap.get('left_ankle_pitch_joint');
              
              // 右腿步行动画
              const rightHipPitch = jointMap.get('right_hip_pitch_joint');
              const rightKnee = jointMap.get('right_knee_joint');
              const rightAnklePitch = jointMap.get('right_ankle_pitch_joint');
              
              // 计算步行时的关节角度（正弦波）
              const legSwing = Math.sin(walkingAnim.leftLegPhase * Math.PI * 2) * 0.3; // 摆动幅度30度
              const legLift = Math.max(0, Math.sin(walkingAnim.leftLegPhase * Math.PI * 2)) * 0.4; // 抬腿幅度40度
              const kneeBend = Math.max(0, Math.sin(walkingAnim.leftLegPhase * Math.PI * 2)) * 0.5; // 膝盖弯曲50度
              
              const rightLegSwing = Math.sin(walkingAnim.rightLegPhase * Math.PI * 2) * 0.3;
              const rightLegLift = Math.max(0, Math.sin(walkingAnim.rightLegPhase * Math.PI * 2)) * 0.4;
              const rightKneeBend = Math.max(0, Math.sin(walkingAnim.rightLegPhase * Math.PI * 2)) * 0.5;
              
              // 根据移动方向调整摆动
              // linearX > 0 为前进，linearX < 0 为后退
              const forwardFactor = velocity.linearX > 0 ? 1 : (velocity.linearX < 0 ? -1 : 0);
              
              // 如果有左右移动，调整摆动方向
              if (Math.abs(velocity.linearY) > 0.01) {
                // 斜向移动时，摆动幅度减小
                const sideFactor = velocity.linearY > 0 ? 0.7 : -0.7; // 右为正，左为负
                if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, legSwing * forwardFactor + legLift + sideFactor * 0.2);
                if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, rightLegSwing * forwardFactor + rightLegLift - sideFactor * 0.2);
              } else {
                // 纯前后移动
                if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, legSwing * forwardFactor + legLift);
                if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, rightLegSwing * forwardFactor + rightLegLift);
              }
              
              if (leftKnee) URDFLoader.setJointAngle(leftKnee, -kneeBend);
              if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, -legLift * 0.5);
              
              if (rightKnee) URDFLoader.setJointAngle(rightKnee, -rightKneeBend);
              if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, -rightLegLift * 0.5);
            }
            
            walkingAnim.isWalking = true;
          } else {
            // 没有移动输入，停止步行并立即重置姿态
            if (walkingAnim.isWalking) {
              walkingAnim.isWalking = false;
              walkingAnim.walkCycle = 0;
              walkingAnim.leftLegPhase = 0;
              walkingAnim.rightLegPhase = 0;
              
              // 立即重置腿部姿态
              const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
              if (jointMap) {
                const leftHipPitch = jointMap.get('left_hip_pitch_joint');
                const leftKnee = jointMap.get('left_knee_joint');
                const leftAnklePitch = jointMap.get('left_ankle_pitch_joint');
                const rightHipPitch = jointMap.get('right_hip_pitch_joint');
                const rightKnee = jointMap.get('right_knee_joint');
                const rightAnklePitch = jointMap.get('right_ankle_pitch_joint');
                
                if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, 0);
                if (leftKnee) URDFLoader.setJointAngle(leftKnee, 0);
                if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, 0);
                if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, 0);
                if (rightKnee) URDFLoader.setJointAngle(rightKnee, 0);
                if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, 0);
              }
            }
          }
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
        // RealisticHumanoidGenerator 不需要dispose方法
        
        // 清理关节管理器
        if (jointManagerRef.current) {
          jointManagerRef.current.clear();
        }
      };
    } catch (err) {
      console.error('[Robot3DViewer] 初始化失败:', err);
      setError('3D场景初始化失败，请刷新页面重试');
      setIsLoading(false);
    }
  }, [width, height, enableAutoRotate, showGrid, showAxes, backgroundColor]);

  // 新增：监听关节状态数据并更新机器人姿态
  useEffect(() => {
    // 获取最新的关节状态数据
    const jointStateData = getTopicData('/joint_states');
    
    // 如果有数据且关节管理器已初始化，则更新关节
    if (jointStateData && jointManagerRef.current) {
      try {
        jointManagerRef.current.updateJointStates(jointStateData);
        // 注意：不打印日志避免刷屏，关节管理器内部已有统计
      } catch (err) {
        console.error('[Robot3DViewer] 更新关节状态失败:', err);
      }
    }
    // 如果没有关节状态数据，Walking动画会继续播放（现有功能不受影响）
  }, [getTopicData]);
  
  // 新增：监听移动控制数据 - 直接从Zustand store获取（更可靠）
  useEffect(() => {
    // 从store获取移动速度
    const newVelocity = {
      linearX: storeMoveVelocity.linearX || 0,
      linearY: storeMoveVelocity.linearY || 0,
      angularZ: storeMoveVelocity.angularZ || 0
    };
    
    // 计算是否有移动
    const speed = Math.sqrt(newVelocity.linearX * newVelocity.linearX + newVelocity.linearY * newVelocity.linearY);
    const hasMovement = speed > 0.01;
    
    // 更新速度ref
    moveVelocityRef.current = newVelocity;
    
    // 更新步行动画状态（立即更新，不等待动画循环）
    if (!hasMovement && walkingAnimationRef.current.isWalking) {
      // 立即停止步行动画并重置姿态
      walkingAnimationRef.current.isWalking = false;
      walkingAnimationRef.current.walkCycle = 0;
      walkingAnimationRef.current.leftLegPhase = 0;
      walkingAnimationRef.current.rightLegPhase = 0;
      
      // 立即重置腿部姿态
      if (robotGroupRef.current) {
        const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
        if (jointMap) {
          const leftHipPitch = jointMap.get('left_hip_pitch_joint');
          const leftKnee = jointMap.get('left_knee_joint');
          const leftAnklePitch = jointMap.get('left_ankle_pitch_joint');
          const rightHipPitch = jointMap.get('right_hip_pitch_joint');
          const rightKnee = jointMap.get('right_knee_joint');
          const rightAnklePitch = jointMap.get('right_ankle_pitch_joint');
          
          if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, 0);
          if (leftKnee) URDFLoader.setJointAngle(leftKnee, 0);
          if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, 0);
          if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, 0);
          if (rightKnee) URDFLoader.setJointAngle(rightKnee, 0);
          if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, 0);
        }
      }
      console.log('[Robot3DViewer] 🛑 停止移动（立即重置姿态）');
    } else if (hasMovement) {
      walkingAnimationRef.current.isWalking = true;
      console.log('[Robot3DViewer] ✅ 更新移动速度:', moveVelocityRef.current);
    }
  }, [storeMoveVelocity]);
  
  // 辅助函数：根据关节名称设置关节角度
  const setJointAngle = (jointName: string, angle: number) => {
    if (!robotGroupRef.current) return;
    
    const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
    if (!jointMap) return;
    
    const joint = jointMap.get(jointName);
    if (joint) {
      URDFLoader.setJointAngle(joint, angle);
    }
  };

  // 监听控制指令并执行动作（URDF模型版本）
  useEffect(() => {
    if (!currentCommand) {
      return;
    }
    
    // 提取纯命令ID（去掉时间戳）
    // 命令格式: Wave_1234567890 或 Wave_release_1234567890
    const parts = currentCommand.split('_');
    // 如果倒数第二部分是 'release',则命令是 XXX_release
    // 否则就是普通命令 XXX
    let commandId: string;
    if (parts.length >= 2 && parts[parts.length - 2] === 'release') {
      // 命令是: XXX_release_timestamp
      commandId = parts.slice(0, -1).join('_'); // 去掉最后的timestamp,保留 XXX_release
    } else {
      // 命令是: XXX_timestamp
      commandId = parts[0]; // 只取第一部分
    }
    
    console.log('[Robot3DViewer] 收到命令:', currentCommand, '-> 解析为:', commandId);
    
    switch (commandId) {
      case 'left':
        // 左转：旋转机器人（每次都旋转45°）
        console.log('[Robot3DViewer] 执行左转45°');
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z += Math.PI / 4;
        }
        break;
        
      case 'right':
        // 右转：旋转机器人（每次都旋转45°）
        console.log('[Robot3DViewer] 执行右转45°');
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z -= Math.PI / 4;
        }
        break;
        
      case 'forward':
      case 'Running':
        // 前进：让机器人向前移动
        console.log('[Robot3DViewer] 执行前进');
        if (robotGroupRef.current) {
          // 在当前朝向方向前进0.5个单位
          const direction = new THREE.Vector3(0, 0, -0.5);
          direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), robotGroupRef.current.rotation.z);
          robotGroupRef.current.position.add(direction);
        }
        break;
        
      case 'backward':
        // 后退：让机器人向后移动
        console.log('[Robot3DViewer] 执行后退');
        if (robotGroupRef.current) {
          // 在当前朝向方向后退0.5个单位
          const direction = new THREE.Vector3(0, 0, 0.5);
          direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), robotGroupRef.current.rotation.z);
          robotGroupRef.current.position.add(direction);
        }
        break;
        
      case 'Wave':
        // 挥手：抬起右手并摆动
        console.log('[Robot3DViewer] 执行挥手动作');
        setJointAngle('right_shoulder_pitch_joint', -Math.PI / 3); // 抬手约60度
        setJointAngle('right_shoulder_roll_joint', Math.PI / 6);  // 外展30度
        setJointAngle('right_elbow_joint', -Math.PI / 4);         // 弯曲肘部45度
        break;
        
      case 'Wave_release':
        // 挥手松开：重置右手关节
        console.log('[Robot3DViewer] 重置右手');
        setJointAngle('right_shoulder_pitch_joint', 0);
        setJointAngle('right_shoulder_roll_joint', 0);
        setJointAngle('right_elbow_joint', 0);
        break;
        
      case 'ThumbsUp':
        // 点赞：抬起左手
        console.log('[Robot3DViewer] 执行点赞动作');
        setJointAngle('left_shoulder_pitch_joint', -Math.PI / 2); // 抬手90度
        setJointAngle('left_shoulder_roll_joint', -Math.PI / 6);  // 内收30度
        setJointAngle('left_elbow_joint', -Math.PI / 3);          // 弯曲肘部60度
        break;
        
      case 'ThumbsUp_release':
        // 点赞松开：重置左手关节
        console.log('[Robot3DViewer] 重置左手');
        setJointAngle('left_shoulder_pitch_joint', 0);
        setJointAngle('left_shoulder_roll_joint', 0);
        setJointAngle('left_elbow_joint', 0);
        break;
        
      case 'WalkJump':
        // 跨栏：抬起右腿
        console.log('[Robot3DViewer] 执行抬右腿动作');
        setJointAngle('right_hip_pitch_joint', -Math.PI / 3);  // 抬腿60度
        setJointAngle('right_knee_joint', Math.PI / 4);        // 弯曲膝盖45度
        break;
        
      case 'WalkJump_release':
        // 抬右腿松开：重置右腿关节
        console.log('[Robot3DViewer] 重置右腿');
        setJointAngle('right_hip_pitch_joint', 0);
        setJointAngle('right_knee_joint', 0);
        break;
        
      case 'Jump':
        // 跳跃：抬起左腿
        console.log('[Robot3DViewer] 执行抬左腿动作');
        setJointAngle('left_hip_pitch_joint', -Math.PI / 3);   // 抬腿60度
        setJointAngle('left_knee_joint', Math.PI / 4);         // 弯曲膝盖45度
        break;
        
      case 'Jump_release':
        // 抬左腿松开：重置左腿关节
        console.log('[Robot3DViewer] 重置左腿');
        setJointAngle('left_hip_pitch_joint', 0);
        setJointAngle('left_knee_joint', 0);
        break;
        
      case 'reset':
      case 'Idle':
        // 重置姿态：所有关节归零
        console.log('[Robot3DViewer] 重置姿态');
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z = 0;
          robotGroupRef.current.position.set(0, 0.6, 0); // 居中位置
          
          // 重置所有主要关节
          const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
          if (jointMap) {
            jointMap.forEach((joint) => {
              URDFLoader.setJointAngle(joint, 0);
            });
          }
        }
        break;
        
      case 'Bow':
        // 鞠躬：弯腰
        console.log('[Robot3DViewer] 执行鞠躬动作');
        setJointAngle('waist_pitch_joint', Math.PI / 4); // 向前弯腰45度
        break;
        
      case 'Bow_release':
        // 鞠躬松开：重置腰部
        console.log('[Robot3DViewer] 重置腰部');
        setJointAngle('waist_pitch_joint', 0);
        break;
        
      case 'RaiseArms':
        // 双臂举起：同时抬起双臂
        console.log('[Robot3DViewer] 执行双臂举起动作');
        setJointAngle('left_shoulder_pitch_joint', -Math.PI / 2);  // 左臂抬起90度
        setJointAngle('right_shoulder_pitch_joint', -Math.PI / 2); // 右臂抬起90度
        setJointAngle('left_elbow_joint', -Math.PI / 6);          // 左肘弯曲30度
        setJointAngle('right_elbow_joint', -Math.PI / 6);         // 右肘弯曲30度
        break;
        
      case 'RaiseArms_release':
        // 双臂举起松开：重置双臂
        console.log('[Robot3DViewer] 重置双臂');
        setJointAngle('left_shoulder_pitch_joint', 0);
        setJointAngle('right_shoulder_pitch_joint', 0);
        setJointAngle('left_elbow_joint', 0);
        setJointAngle('right_elbow_joint', 0);
        break;
        
      case 'Squat':
        // 下蹲：弯曲双腿
        console.log('[Robot3DViewer] 执行下蹲动作');
        setJointAngle('left_hip_pitch_joint', Math.PI / 3);   // 左髋弯曲60度
        setJointAngle('right_hip_pitch_joint', Math.PI / 3);  // 右髋弯曲60度
        setJointAngle('left_knee_joint', -Math.PI / 3);       // 左膝弯曲60度
        setJointAngle('right_knee_joint', -Math.PI / 3);      // 右膝弯曲60度
        break;
        
      case 'Squat_release':
        // 下蹲松开：重置双腿
        console.log('[Robot3DViewer] 重置双腿');
        setJointAngle('left_hip_pitch_joint', 0);
        setJointAngle('right_hip_pitch_joint', 0);
        setJointAngle('left_knee_joint', 0);
        setJointAngle('right_knee_joint', 0);
        break;
        
      case 'TurnHead':
        // 转头：转动腰部（模拟转头）
        console.log('[Robot3DViewer] 执行转头动作');
        setJointAngle('waist_yaw_joint', Math.PI / 4); // 向左转45度
        break;
        
      case 'TurnHead_release':
        // 转头松开：重置腰部
        console.log('[Robot3DViewer] 重置腰部旋转');
        setJointAngle('waist_yaw_joint', 0);
        break;
        
      case 'move':
        // 移动命令 - 不做任何处理，移动由动画循环中的速度更新处理
        // 这个case只是为了避免"未知命令"的日志
        break;
        
      default:
        console.log(`[Robot3DViewer] 未知命令: ${commandId}`);
    }
  }, [currentCommand]);

  // 响应窗口大小变化
  useEffect(() => {
    if (!cameraRef.current || !rendererRef.current || !mountRef.current) return;

    const containerSize = getContainerSize();
    const actualWidth = containerSize.width;
    const actualHeight = containerSize.height;

    cameraRef.current.aspect = actualWidth / actualHeight;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(actualWidth, actualHeight);
  }, [width, height]);

  // 监听容器尺寸变化（用于自适应模式）
  useEffect(() => {
    if (width !== 100 || height !== 100) return; // 只在自适应模式下监听
    
    if (!mountRef.current?.parentElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          cameraRef.current.aspect = newWidth / newHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newWidth, newHeight);
        }
      }
    });

    resizeObserver.observe(mountRef.current.parentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [width, height]);

  // 始终渲染容器div，loading和error状态作为覆盖层显示
  // 如果width或height为100，则使用100%自适应
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
  };
  
  if (width === 100 && height === 100) {
    // 自适应模式：使用100%填满父容器
    containerStyle.width = '100%';
    containerStyle.height = '100%';
  } else {
    // 固定尺寸模式
    containerStyle.width = `${width}px`;
    containerStyle.height = `${height}px`;
  }
  
  return (
    <div
      className={`robot-3d-container ${className}`}
      style={containerStyle}
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

