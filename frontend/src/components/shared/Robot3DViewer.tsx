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
  
  // 从全局状态获取控制指令和移动速度（使用选择器确保正确订阅）
  const currentCommand = useRobot3DStore((state) => state.currentCommand);
  // 分别订阅每个属性，确保任何变化都能触发更新
  const linearX = useRobot3DStore((state) => state.moveVelocity.linearX);
  const linearY = useRobot3DStore((state) => state.moveVelocity.linearY);
  const angularZ = useRobot3DStore((state) => state.moveVelocity.angularZ);

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
  
  // 用于存储摇头动画状态
  const headShakeAnimationRef = useRef({
    isShaking: false,
    shakeCycle: 0, // 摇头周期（0-1）
    shakeDirection: 1, // 摇头方向（1或-1）
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
      camera.position.set(2.5, 0.3, 4.5); // 降低相机高度到0.3，从更低的角度看
      camera.lookAt(0, 0.4, 0); // 看向机器人脚部附近（y=0.4），确保能看到足部
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
      
      // 开始加载宇树G1机器人URDF模型
      
      urdfLoader.load('/models/g1_robot/g1_29dof_rev_1_0.urdf')
        .then((robotModel) => {
          // URDF模型加载成功
          
          // 检查所有link，特别关注足部
          const linkNames: string[] = [];
          robotModel.traverse((obj) => {
            if (obj instanceof THREE.Group) {
              linkNames.push(obj.name);
            }
          });
          
          // 调整机器人大小和位置（宇树G1机器人约1.27m高）
          robotModel.scale.set(3, 3, 3); // 放大3倍便于查看
          
          // 机器人倒立了,需要绕X轴旋转180度翻转过来,再绕X轴90度调整姿态
          // 总共需要旋转270度 = 90度 + 180度
          robotModel.rotation.x = -Math.PI / 2; // -90度,让机器人正立
          
          // 调整位置：让机器人站在地面上，居中显示
          // 机器人高度约1.27m，原点在骨盆中心（约0.6m高），所以需要抬高0.6m让脚着地
          // 地面在y=-0.01，机器人原点在y=0.6，这样脚部在y=0，正好站在地面上
          robotModel.position.set(0, 1.0, 0);
          // 确保所有mesh（包括足部）都后渲染，在地面之上
          robotModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.renderOrder = 1; // 所有mesh后渲染
              // 确保足部mesh可见
              const childName = child.name.toLowerCase();
              if (childName.includes('ankle') || childName.includes('foot')) {
                child.renderOrder = 2; // 足部mesh优先级更高
                child.material = (child.material as THREE.Material).clone();
                (child.material as THREE.Material).depthWrite = true;
                (child.material as THREE.Material).depthTest = true;
              }
            }
          });
          robotModel.renderOrder = 1; // 机器人后渲染，确保在地面之上
          
          scene.add(robotModel);
          robotGroupRef.current = robotModel;
          
          // 机器人已添加到场景
          
          // 获取关节映射（用于后续动画）
          const jointMap = URDFLoader.getJointMap(robotModel);
          (robotModel as any).jointMap = jointMap;
          

          // 设置默认姿态：双臂自然下垂（所有关节角度为0，但肘关节需要特殊处理）
          // 确保无论单屏还是多屏，默认都是自然下垂状态
          // 注意：根据URDF定义和代码分析：
          // - 0度 = 90度弯曲（大臂小臂90度）
          // - 负值（如-Math.PI/4, -Math.PI/3）= 更弯曲
          // - 要让大臂小臂在一条直线（180度伸直），需要从90度再转90度
          // - 根据limit upper=2.0944（约120度），正值方向是伸直方向
          // - 要让手臂完全伸直，需要设置为正值，约π/2 = 1.5708（90度）
          const elbowStraightAngle = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
          
          // 设置所有关节的默认角度
          const defaultJoints: Array<{ name: string; angle: number }> = [
            // 左臂所有关节（7个）
            { name: 'left_shoulder_pitch_joint', angle: 0 },
            { name: 'left_shoulder_roll_joint', angle: 0 },
            { name: 'left_shoulder_yaw_joint', angle: 0 },
            { name: 'left_elbow_joint', angle: elbowStraightAngle }, // 肘关节伸直
            { name: 'left_wrist_roll_joint', angle: 0 },
            { name: 'left_wrist_pitch_joint', angle: 0 },
            { name: 'left_wrist_yaw_joint', angle: 0 },
            // 右臂所有关节（7个）
            { name: 'right_shoulder_pitch_joint', angle: 0 },
            { name: 'right_shoulder_roll_joint', angle: 0 },
            { name: 'right_shoulder_yaw_joint', angle: 0 },
            { name: 'right_elbow_joint', angle: elbowStraightAngle }, // 肘关节伸直
            { name: 'right_wrist_roll_joint', angle: 0 },
            { name: 'right_wrist_pitch_joint', angle: 0 },
            { name: 'right_wrist_yaw_joint', angle: 0 },
            // 左腿关节
            { name: 'left_hip_pitch_joint', angle: 0 },
            { name: 'left_hip_roll_joint', angle: 0 },
            { name: 'left_hip_yaw_joint', angle: 0 },
            { name: 'left_knee_joint', angle: 0 },
            { name: 'left_ankle_pitch_joint', angle: 0 },
            { name: 'left_ankle_roll_joint', angle: 0 },
            // 右腿关节
            { name: 'right_hip_pitch_joint', angle: 0 },
            { name: 'right_hip_roll_joint', angle: 0 },
            { name: 'right_hip_yaw_joint', angle: 0 },
            { name: 'right_knee_joint', angle: 0 },
            { name: 'right_ankle_pitch_joint', angle: 0 },
            { name: 'right_ankle_roll_joint', angle: 0 },
            // 腰部关节
            { name: 'waist_pitch_joint', angle: 0 },
            { name: 'waist_yaw_joint', angle: 0 },
            { name: 'waist_roll_joint', angle: 0 }
          ];
          
          let setCount = 0;
          defaultJoints.forEach(({ name, angle }) => {
            const joint = jointMap.get(name);
            if (joint) {
              URDFLoader.setJointAngle(joint, angle);
              setCount++;
            } else {
              console.log(`[Robot3DViewer] ⚠️ 未找到关节: ${name}`);
            }
          });
          
          // 已设置默认姿态：双臂自然下垂

          // 新增：初始化关节状态管理器（用于实时同步）
          try {
            jointManagerRef.current = new JointStateManager();
            jointManagerRef.current.mapJointsFromScene(robotModel);
            jointManagerRef.current.setInterpolation(true, 0.3); // 启用平滑插值
            // 关节状态管理器初始化成功
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
        // 同时处理摇头动画
        if (robotGroupRef.current) {
          // 在动画循环中，直接从store获取最新值（不依赖ref，确保立即响应）
          // 这是关键：每帧都直接从store读取，确保松开摇杆后立即检测到0值
          const storeState = useRobot3DStore.getState();
          const velocity = storeState.moveVelocity;
          
          // 同步更新ref（用于其他地方）
          moveVelocityRef.current = { ...velocity };
          
          const walkingAnim = walkingAnimationRef.current;
          const headShakeAnim = headShakeAnimationRef.current;
          
          // 处理摇头动画
          if (headShakeAnim.isShaking) {
            const shakeSpeed = 3.0; // 摇头速度（周期/秒）
            headShakeAnim.shakeCycle += shakeSpeed * deltaTime;
            
            // 使用正弦波实现左右摆动
            const shakeAngle = Math.sin(headShakeAnim.shakeCycle * Math.PI * 2) * (Math.PI / 3); // 左右各60度
            setJointAngle('waist_yaw_joint', shakeAngle);
          }
          
          // 计算移动速度大小（只考虑前后左右，不考虑转向）
          const speed = Math.sqrt(velocity.linearX * velocity.linearX + velocity.linearY * velocity.linearY);
          const hasMovement = speed > 0.01; // 只检查线速度，不检查角速度
          
          // 如果没有移动输入，立即停止并重置姿态（优先级最高，确保立即停止）
          if (!hasMovement) {
            // 立即停止步行动画（无论之前是否在行走）
            walkingAnim.isWalking = false;
            walkingAnim.walkCycle = 0;
            walkingAnim.leftLegPhase = 0;
            walkingAnim.rightLegPhase = 0;
            
            // 立即重置所有腿部关节到站立姿态（角度为0）
            // 每帧都重置，确保即使有其他逻辑干扰也能恢复站立
            const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
            if (jointMap) {
              const leftHipPitch = jointMap.get('left_hip_pitch_joint');
              const leftKnee = jointMap.get('left_knee_joint');
              const leftAnklePitch = jointMap.get('left_ankle_pitch_joint');
              const rightHipPitch = jointMap.get('right_hip_pitch_joint');
              const rightKnee = jointMap.get('right_knee_joint');
              const rightAnklePitch = jointMap.get('right_ankle_pitch_joint');
              
              // 强制重置所有腿部关节到站立姿态（角度为0）
              // 每帧都执行，确保立即停止
              if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, 0);
              if (leftKnee) URDFLoader.setJointAngle(leftKnee, 0);
              if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, 0);
              if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, 0);
              if (rightKnee) URDFLoader.setJointAngle(rightKnee, 0);
              if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, 0);
            }
            // 跳过步行动画应用，直接渲染（不执行下面的hasMovement分支）
          } else {
            // 有移动输入，应用步行动画
            // 更新步行动画
            // 前进时（linearX > 0）：walkCycle增加
            // 后退时（linearX < 0）：walkCycle减少（反向）
            const walkSpeed = speed * 3; // 步行动画速度（根据速度大小调整动画速度）
            const direction = velocity.linearX >= 0 ? 1 : -1; // 前进为1，后退为-1
            walkingAnim.walkCycle += walkSpeed * deltaTime * direction;
            
            // 保持walkCycle在[0, 1]范围内
            if (walkingAnim.walkCycle >= 1) {
              walkingAnim.walkCycle -= 1;
            }
            if (walkingAnim.walkCycle < 0) {
              walkingAnim.walkCycle += 1;
            }
            
            // 左右腿相位差180度（始终保持）
            // 确保右腿相位始终比左腿多0.5（180度）
            walkingAnim.leftLegPhase = walkingAnim.walkCycle;
            walkingAnim.rightLegPhase = walkingAnim.walkCycle + 0.5;
            // 归一化到[0, 1)范围
            if (walkingAnim.rightLegPhase >= 1) {
              walkingAnim.rightLegPhase -= 1;
            }
            
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
              // 左腿相位：直接使用walkCycle
              const leftPhase = walkingAnim.leftLegPhase * Math.PI * 2;
              const legSwing = Math.sin(leftPhase) * 0.3; // 摆动幅度30度
              const legLift = Math.max(0, Math.sin(leftPhase)) * 0.4; // 抬腿幅度40度
              const kneeBend = Math.max(0, Math.sin(leftPhase)) * 0.5; // 膝盖弯曲50度
              
              // 右腿相位：比左腿多180度（0.5个周期），确保交替动作
              const rightPhase = walkingAnim.rightLegPhase * Math.PI * 2;
              const rightLegSwing = Math.sin(rightPhase) * 0.3;
              const rightLegLift = Math.max(0, Math.sin(rightPhase)) * 0.4;
              const rightKneeBend = Math.max(0, Math.sin(rightPhase)) * 0.5;
              
              // 应用步行动画
              // 注意：legSwing是前后摆动（可正可负），legLift是抬腿（只有正值）
              // 左右腿相位差180度，所以当左腿抬起时（legLift > 0），右腿应该放下（rightLegLift = 0）
              // 当左腿向前摆动时（legSwing > 0），右腿应该向后摆动（rightLegSwing < 0）
              
              // 如果有左右移动，调整摆动方向
              if (Math.abs(velocity.linearY) > 0.01) {
                // 斜向移动时，摆动幅度减小
                const sideFactor = velocity.linearY > 0 ? 0.7 : -0.7; // 右为正，左为负
                // 左腿：前后摆动 + 抬腿 + 侧向调整
                if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, legSwing + legLift + sideFactor * 0.2);
                // 右腿：前后摆动 + 抬腿 - 侧向调整（与左腿相反）
                if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, rightLegSwing + rightLegLift - sideFactor * 0.2);
              } else {
                // 纯前后移动
                // 左腿：前后摆动 + 抬腿
                if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, legSwing + legLift);
                // 右腿：前后摆动 + 抬腿（相位差180度，自动交替）
                if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, rightLegSwing + rightLegLift);
              }
              
              if (leftKnee) URDFLoader.setJointAngle(leftKnee, -kneeBend);
              if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, -legLift * 0.5);
              
              if (rightKnee) URDFLoader.setJointAngle(rightKnee, -rightKneeBend);
              if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, -rightLegLift * 0.5);
            }
            
            walkingAnim.isWalking = true;
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
    // 从store获取移动速度（已经通过选择器分别订阅）
    const velX = linearX || 0;
    const velY = linearY || 0;
    const velZ = angularZ || 0;
    
    // 计算是否有移动
    const speed = Math.sqrt(velX * velX + velY * velY);
    const hasMovement = speed > 0.01;
    
    // 更新速度ref（立即更新，确保动画循环能获取最新值）
    moveVelocityRef.current = { linearX: velX, linearY: velY, angularZ: velZ };
    
    // 更新步行动画状态（立即更新，不等待动画循环）
    if (!hasMovement) {
      // 没有移动输入，立即停止步行动画并重置姿态（无论之前是否在行走）
      walkingAnimationRef.current.isWalking = false;
      walkingAnimationRef.current.walkCycle = 0;
      walkingAnimationRef.current.leftLegPhase = 0;
      walkingAnimationRef.current.rightLegPhase = 0;
      
      // 立即重置所有腿部关节到站立姿态（角度为0）
      if (robotGroupRef.current) {
        const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
        if (jointMap) {
          const leftHipPitch = jointMap.get('left_hip_pitch_joint');
          const leftKnee = jointMap.get('left_knee_joint');
          const leftAnklePitch = jointMap.get('left_ankle_pitch_joint');
          const rightHipPitch = jointMap.get('right_hip_pitch_joint');
          const rightKnee = jointMap.get('right_knee_joint');
          const rightAnklePitch = jointMap.get('right_ankle_pitch_joint');
          
          // 强制重置所有腿部关节到站立姿态（角度为0）
          if (leftHipPitch) URDFLoader.setJointAngle(leftHipPitch, 0);
          if (leftKnee) URDFLoader.setJointAngle(leftKnee, 0);
          if (leftAnklePitch) URDFLoader.setJointAngle(leftAnklePitch, 0);
          if (rightHipPitch) URDFLoader.setJointAngle(rightHipPitch, 0);
          if (rightKnee) URDFLoader.setJointAngle(rightKnee, 0);
          if (rightAnklePitch) URDFLoader.setJointAngle(rightAnklePitch, 0);
        }
      }
    } else {
      // 有移动时，立即启动步行动画
      walkingAnimationRef.current.isWalking = true;
      
      // 如果机器人模型已加载，立即应用一次初始动画状态（确保立即响应）
      if (robotGroupRef.current) {
        const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
        if (jointMap && walkingAnimationRef.current.walkCycle === 0) {
          // 初始化一个小的walkCycle值，让动画立即开始
          walkingAnimationRef.current.walkCycle = 0.01;
          walkingAnimationRef.current.leftLegPhase = 0.01;
          walkingAnimationRef.current.rightLegPhase = 0.51;
        }
      }
    }
  }, [linearX, linearY, angularZ]);
  
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
    
    switch (commandId) {
      case 'left':
        // 左转：旋转机器人（每次都旋转45°）
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z += Math.PI / 4;
        }
        break;
        
      case 'right':
        // 右转：旋转机器人（每次都旋转45°）
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z -= Math.PI / 4;
        }
        break;
        
      case 'forward':
        // 前进：让机器人向前移动（仅按钮触发）
        if (robotGroupRef.current) {
          // 在当前朝向方向前进0.5个单位
          const direction = new THREE.Vector3(0, 0, -0.5);
          direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), robotGroupRef.current.rotation.z);
          robotGroupRef.current.position.add(direction);
        }
        break;
        
      case 'backward':
        // 后退：让机器人向后移动（仅按钮触发）
        if (robotGroupRef.current) {
          // 在当前朝向方向后退0.5个单位
          const direction = new THREE.Vector3(0, 0, 0.5);
          direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), robotGroupRef.current.rotation.z);
          robotGroupRef.current.position.add(direction);
        }
        break;
        
      case 'Running':
      case 'Walking':
        // 摇杆触发的步行/跑步动画 - 不改变位置，只显示腿部动画
        // 实际的腿部动画由动画循环中的 moveVelocityRef 控制
        break;
        
      case 'Wave':
        // 挥手：抬起右手并摆动
        const waveElbowAngle = -Math.PI / 4; // 弯曲肘部45度
        setJointAngle('right_shoulder_pitch_joint', -Math.PI / 3); // 抬手约60度
        setJointAngle('right_shoulder_roll_joint', Math.PI / 6);  // 外展30度
        setJointAngle('right_shoulder_yaw_joint', 0);  // 右肩不旋转
        setJointAngle('right_elbow_joint', waveElbowAngle);         // 弯曲肘部45度
        break;
        
      case 'Wave_release':
        // 挥手松开：重置右手关节（肘关节伸直）
        const elbowStraightAngleWave = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
        setJointAngle('right_shoulder_pitch_joint', 0);
        setJointAngle('right_shoulder_roll_joint', 0);
        setJointAngle('right_elbow_joint', elbowStraightAngleWave); // 肘关节伸直
        break;
        
      case 'ThumbsUp':
        // 点赞：平举左手（手臂伸直）
        const thumbsUpElbowAngle = Math.PI / 2;
        setJointAngle('left_shoulder_pitch_joint', -Math.PI / 2); // 抬手90度
        setJointAngle('left_shoulder_roll_joint', 0);  // 不内收，保持平举
        setJointAngle('left_shoulder_yaw_joint', 0);  // 左肩不旋转
        setJointAngle('left_elbow_joint', thumbsUpElbowAngle);  // 肘关节伸直（平举）
        break;
        
      case 'ThumbsUp_release':
        // 点赞松开：重置左手关节（肘关节伸直）
        const elbowStraightAngleThumbs = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
        setJointAngle('left_shoulder_pitch_joint', 0);
        setJointAngle('left_shoulder_roll_joint', 0);
        setJointAngle('left_elbow_joint', elbowStraightAngleThumbs); // 肘关节伸直
        break;
        
      case 'WalkJump':
        // 跨栏：抬起右腿
        setJointAngle('right_hip_pitch_joint', -Math.PI / 3);  // 抬腿60度
        setJointAngle('right_knee_joint', Math.PI / 4);        // 弯曲膝盖45度
        break;
        
      case 'WalkJump_release':
        // 抬右腿松开：重置右腿关节
        setJointAngle('right_hip_pitch_joint', 0);
        setJointAngle('right_knee_joint', 0);
        break;
        
      case 'Jump':
        // 跳跃：抬起左腿
        setJointAngle('left_hip_pitch_joint', -Math.PI / 3);   // 抬腿60度
        setJointAngle('left_knee_joint', Math.PI / 4);         // 弯曲膝盖45度
        break;
        
      case 'Jump_release':
        // 抬左腿松开：重置左腿关节
        setJointAngle('left_hip_pitch_joint', 0);
        setJointAngle('left_knee_joint', 0);
        break;
        
      case 'reset':
      case 'Idle':
        // 重置姿态：所有关节归零，但肘关节需要特殊处理（设置为伸直状态）
        if (robotGroupRef.current) {
          robotGroupRef.current.rotation.z = 0;
          robotGroupRef.current.position.set(0, 1.0, 0); // 机器人原点在y=1.0，确保脚部在地面之上 // 机器人原点在y=0.6，脚部在y=0，与地面对齐
          
          // 重置所有主要关节
          const jointMap = (robotGroupRef.current as any).jointMap as Map<string, THREE.Group>;
          if (jointMap) {
            const elbowStraightAngle = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
            jointMap.forEach((joint, jointName) => {
              // 肘关节设置为伸直状态，其他关节设置为0
              if (jointName === 'left_elbow_joint' || jointName === 'right_elbow_joint') {
                URDFLoader.setJointAngle(joint, elbowStraightAngle);
              } else {
                URDFLoader.setJointAngle(joint, 0);
              }
            });
          }
        }
        break;
        
      case 'Bow':
        // 鞠躬：弯腰
        setJointAngle('waist_pitch_joint', Math.PI / 4); // 向前弯腰45度
        break;
        
      case 'Bow_release':
        // 鞠躬松开：重置腰部
        setJointAngle('waist_pitch_joint', 0);
        break;
        
      case 'RaiseArms':
        // 双臂平举：同时平举双臂（手臂伸直）
        // 左臂平举
        const leftElbowAngle = Math.PI / 2;
        setJointAngle('left_shoulder_pitch_joint', -Math.PI / 2);  // 左臂抬起90度
        setJointAngle('left_shoulder_roll_joint', 0);  // 左肩不侧摆，保持平举
        setJointAngle('left_shoulder_yaw_joint', 0);  // 左肩不旋转
        setJointAngle('left_elbow_joint', leftElbowAngle);  // 左肘伸直（平举）
        
        // 右臂平举（确保所有关节都设置）
        const rightElbowAngle = Math.PI / 2;
        setJointAngle('right_shoulder_pitch_joint', -Math.PI / 2); // 右臂抬起90度
        setJointAngle('right_shoulder_roll_joint', 0); // 右肩不侧摆，保持平举
        setJointAngle('right_shoulder_yaw_joint', 0); // 右肩不旋转
        setJointAngle('right_elbow_joint', rightElbowAngle); // 右肘伸直（平举）
        break;
        
      case 'RaiseArms_release':
        // 双臂举起松开：重置双臂（包括所有手臂关节，确保完全自然下垂）
        // 肘关节需要设置为正值才能让大臂小臂在一条直线
        const elbowStraightAngle = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
        setJointAngle('left_shoulder_pitch_joint', 0);
        setJointAngle('left_shoulder_roll_joint', 0);
        setJointAngle('left_shoulder_yaw_joint', 0);
        setJointAngle('left_elbow_joint', elbowStraightAngle); // 肘关节伸直
        setJointAngle('left_wrist_roll_joint', 0);
        setJointAngle('left_wrist_pitch_joint', 0);
        setJointAngle('left_wrist_yaw_joint', 0);
        setJointAngle('right_shoulder_pitch_joint', 0);
        setJointAngle('right_shoulder_roll_joint', 0);
        setJointAngle('right_shoulder_yaw_joint', 0);
        setJointAngle('right_elbow_joint', elbowStraightAngle); // 肘关节伸直
        setJointAngle('right_wrist_roll_joint', 0);
        setJointAngle('right_wrist_pitch_joint', 0);
        setJointAngle('right_wrist_yaw_joint', 0);
        break;
        
      case 'RaiseRightArm':
        // 右臂平举：只平举右臂（手臂伸直）
        const rightArmElbowAngle = Math.PI / 2;
        setJointAngle('right_shoulder_pitch_joint', -Math.PI / 2); // 右臂抬起90度
        setJointAngle('right_shoulder_roll_joint', 0); // 右肩不侧摆，保持平举
        setJointAngle('right_shoulder_yaw_joint', 0); // 右肩不旋转
        setJointAngle('right_elbow_joint', rightArmElbowAngle); // 右肘伸直（平举）
        break;
        
      case 'RaiseRightArm_release':
        // 右臂举起松开：重置右臂（包括所有右臂关节，确保完全自然下垂）
        const rightArmElbowStraightAngle = Math.PI / 2; // π/2 ≈ 1.5708弧度（90度），让大臂小臂在一条直线
        setJointAngle('right_shoulder_pitch_joint', 0);
        setJointAngle('right_shoulder_roll_joint', 0);
        setJointAngle('right_shoulder_yaw_joint', 0);
        setJointAngle('right_elbow_joint', rightArmElbowStraightAngle); // 肘关节伸直
        setJointAngle('right_wrist_roll_joint', 0);
        setJointAngle('right_wrist_pitch_joint', 0);
        setJointAngle('right_wrist_yaw_joint', 0);
        break;
        
      case 'Squat':
        // 下蹲：弯曲双腿
        setJointAngle('left_hip_pitch_joint', Math.PI / 3);   // 左髋弯曲60度
        setJointAngle('right_hip_pitch_joint', Math.PI / 3);  // 右髋弯曲60度
        setJointAngle('left_knee_joint', -Math.PI / 3);       // 左膝弯曲60度
        setJointAngle('right_knee_joint', -Math.PI / 3);      // 右膝弯曲60度
        break;
        
      case 'Squat_release':
        // 下蹲松开：重置双腿
        setJointAngle('left_hip_pitch_joint', 0);
        setJointAngle('right_hip_pitch_joint', 0);
        setJointAngle('left_knee_joint', 0);
        setJointAngle('right_knee_joint', 0);
        break;
        
      case 'TurnHead':
        // 摇头：启动摇头动画（左右摆动）
        headShakeAnimationRef.current.isShaking = true;
        headShakeAnimationRef.current.shakeCycle = 0;
        headShakeAnimationRef.current.shakeDirection = 1;
        break;
        
      case 'TurnHead_release':
        // 摇头松开：停止摇头并重置腰部
        headShakeAnimationRef.current.isShaking = false;
        headShakeAnimationRef.current.shakeCycle = 0;
        setJointAngle('waist_yaw_joint', 0);
        break;
        
      case 'move':
        // 移动命令 - 不做任何处理，移动由动画循环中的速度更新处理
        break;
        
      default:
        // 未知命令 - 静默忽略
        break;
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

