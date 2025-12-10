/**
 * 外设控制器组件
 * 管理外设输入并发送机器人命令
 */

import { useEffect, useRef, useState } from 'react';
import { PeripheralManager, createDefaultPeripheralManager } from '../../utils/peripherals/PeripheralManager';
import { InputMapper, createDefaultInputMapping } from '../../utils/peripherals/InputMapper';
import { RobotCommand } from '../../types/peripheral.types';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRobot3DStore } from '../../stores/robot3DStore';

interface PeripheralControllerProps {
  enabled?: boolean;
  onCommandSent?: (command: RobotCommand) => void;
  onManagerReady?: (manager: PeripheralManager) => void;
}

export function PeripheralController({ enabled = true, onCommandSent, onManagerReady }: PeripheralControllerProps) {
  const { publish } = useWebSocket();
  const { setCommand, setMoveVelocity } = useRobot3DStore();
  const managerRef = useRef<PeripheralManager | null>(null);
  const mapperRef = useRef<InputMapper | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 使用ref存储回调，避免依赖变化
  const publishRef = useRef(publish);
  const onCommandSentRef = useRef(onCommandSent);
  const setCommandRef = useRef(setCommand);
  const setMoveVelocityRef = useRef(setMoveVelocity);
  
  // 更新refs
  publishRef.current = publish;
  onCommandSentRef.current = onCommandSent;
  setCommandRef.current = setCommand;
  setMoveVelocityRef.current = setMoveVelocity;
  
  // 维护当前轴状态
  const axisStateRef = useRef<Record<number, number>>({});
  const lastSendTimeRef = useRef<number>(0);
  const sendIntervalMs = 100; // 10Hz发送频率
  
  // 维护当前动画状态，避免频繁切换
  const currentAnimationRef = useRef<string>('Idle');
  
  // 跟踪是否正在移动（用于发送停止命令）
  const isMovingRef = useRef<boolean>(false);
  
  // 防抖：记录最后一次按钮触发的时间
  const lastButtonTimeRef = useRef<Record<number, number>>({});
  const buttonDebounceMs = 300; // 300ms 防抖时间

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 创建外设管理器
    const manager = createDefaultPeripheralManager();
    managerRef.current = manager;
    
    // 通知外部manager已准备好
    onManagerReady?.(manager);

    // 创建输入映射器（用于按钮等非轴事件）
    const mapper = createDefaultInputMapping();
    mapperRef.current = mapper;

    // 设置命令回调
    mapper.setCommandCallback((command: RobotCommand) => {
      // 发送到ROS
      try {
        publishRef.current(command.topic, command.payload, command.messageType);
        onCommandSentRef.current?.(command);
      } catch (err) {
        console.error('[PeripheralController] 命令发送失败:', err);
      }
    });

    // 监听输入事件
    manager.on('input', (event: any) => {
      // 处理轴输入（摇杆）
      if (event.type === 'axis_change' && event.axis) {
        // 更新轴状态
        axisStateRef.current[event.axis.index] = event.axis.value;
        
        // 调试日志：显示所有轴的状态（每100ms打印一次）
        const now = Date.now();
        
        // 立即处理速度更新（不节流），确保松开时立即停止
        // 合并所有轴的值发送命令（支持多向运动）
        // 街机摇杆通常只有2个轴（X和Y），索引可能是0和1
        const leftStickX = axisStateRef.current[0] || 0;
        const leftStickY = axisStateRef.current[1] || 0;
        
        // 计算速度（减小死区，适配街机摇杆）
        const deadzone = 0.05; // 从0.15减小到0.05，更敏感
        
        // 前后速度：前推为正，后拉为负
        // 注意：Gamepad API中，Y轴向下为正，所以需要取反
        // 左摇杆Y轴（axisIndex 1）→ 前后移动
        const linearX = Math.abs(leftStickY) > deadzone ? -leftStickY * 0.5 : 0; // 与InputMapper保持一致：0.5速度系数
        
        // 转向速度：左摇杆X轴（axisIndex 0）→ 转向
        // 与单屏模式保持一致：X轴控制转向，不是左右位移
        const angularZ = Math.abs(leftStickX) > deadzone ? leftStickX * 1.0 : 0; // 与InputMapper保持一致：1.0转向速度
        
        // 左右速度：不使用linearY（与单屏模式一致）
        const linearY = 0; // 单屏模式不使用左右位移，只使用前后+转向
        
        // 判断是否有实际输入（与单屏模式一致）
        const hasInput = Math.abs(linearX) > 0.01 || Math.abs(angularZ) > 0.01;
        
        // 立即更新Zustand store（不节流，确保松开时立即停止）
        // 注意：只使用linearX（前后）和angularZ（转向），不使用linearY（左右位移）
        setMoveVelocityRef.current({
          linearX: linearX,
          linearY: 0, // 不使用左右位移，只使用前后+转向
          angularZ: angularZ
        });
        
        // 节流发送其他命令（避免过于频繁）
        if (now - lastSendTimeRef.current >= sendIntervalMs) {
          lastSendTimeRef.current = now;
          
          
          // 根据线速度和角速度决定动画（与单屏模式一致）
          const totalSpeed = Math.sqrt(linearX * linearX + angularZ * angularZ);
          
          let targetAnimation = 'Idle';
          
          // 判断运动状态
          if (totalSpeed > 0.3) {
            targetAnimation = 'Running'; // 快速移动
          } else if (totalSpeed > 0.05) {
            targetAnimation = 'Walking'; // 慢速移动/转向
          } else {
            targetAnimation = 'Idle'; // 静止
          }
          
          // 只在动画切换时才更新状态（避免频繁重渲染）
          if (currentAnimationRef.current !== targetAnimation) {
            currentAnimationRef.current = targetAnimation;
            // 添加时间戳确保状态更新
            setCommandRef.current(targetAnimation + '_' + Date.now());
            
            // 广播到其他屏幕（用于多屏同步）
            publishRef.current('robot_3d_command', { command: targetAnimation, timestamp: Date.now() }, 'std_msgs/String');
          }
          
          // 发送实时移动控制命令（用于3D模型的足部动画）
          // 注意：只使用linearX（前后）和angularZ（转向），不使用linearY（左右位移）
          // 前进后退通过足部动画（Walking/Running）表示，不是位移
          // 无论是否有输入，都要发送移动数据（包括停止命令）
            const moveCommand = {
              command: 'move',
              linearX: linearX,
              linearY: 0, // 不使用左右位移，只使用前后+转向
              angularZ: angularZ,
              timestamp: Date.now()
            };
          
          // 发送到WebSocket（用于ROS2后端）
          publishRef.current('robot_3d_move', moveCommand, 'std_msgs/String');
          
          // 同时通过setCommand触发更新（作为备用）
          if (hasInput) {
            setCommandRef.current('move_' + moveCommand.timestamp);
          }
          
          // 发送命令到ROS（有输入时发送速度，无输入但之前在移动时发送停止命令）
          // 注意：只使用linearX（前后）和angularZ（转向），不使用linearY（左右位移）
          // 前进后退通过足部动画（Walking/Running）表示，不是位移
          if (hasInput || isMovingRef.current) {
            const command: RobotCommand = {
              type: 'velocity' as any,
              topic: '/cmd_vel',
              messageType: 'geometry_msgs/Twist',
              payload: {
                linear: { x: linearX, y: 0, z: 0 }, // 不使用linearY，避免位移
                angular: { x: 0, y: 0, z: angularZ },
              },
              priority: 5,
            };
            
            try {
              publishRef.current(command.topic, command.payload, command.messageType);
              onCommandSentRef.current?.(command);
              
              // 更新移动状态
              isMovingRef.current = hasInput;
            } catch (err) {
              console.error('[PeripheralController] 命令发送失败:', err);
            }
          }
        }
      } else if (event.type === 'button_down' && event.button) {
        const buttonIndex = event.button.index;
        const now = Date.now();
        
        // 防抖检查：如果距离上次触发时间太短，忽略
        if (lastButtonTimeRef.current[buttonIndex] && 
            now - lastButtonTimeRef.current[buttonIndex] < buttonDebounceMs) {
          return;
        }
        lastButtonTimeRef.current[buttonIndex] = now;
        
        let command3D: string | null = null;
        
        // 为所有按钮统一生成时间戳，避免重复触发
        const timestamp = Date.now();
        
        if (buttonIndex === 0) {
          command3D = 'RaiseRightArm';  // 按钮A - 右臂平举
          setCommandRef.current(command3D + '_' + timestamp);
        } else if (buttonIndex === 1) {
          command3D = 'ThumbsUp';  // 按钮B - 点赞
          setCommandRef.current(command3D + '_' + timestamp);
        } else if (buttonIndex === 2) {
          command3D = 'WalkJump';  // 按钮C - 跨栏
          setCommandRef.current(command3D + '_' + timestamp);
        } else if (buttonIndex === 3) {
          command3D = 'Jump';  // 按钮D - 跳跃
          setCommandRef.current(command3D + '_' + timestamp);
        } else if (buttonIndex === 4) {
          // LB按钮 - 左转（与web按钮一致）
          command3D = 'left';
          const timestamp = Date.now();  // 统一使用同一个时间戳
          const turnLeftCommand: RobotCommand = {
            type: 'action' as any,
            topic: '/robot/action',
            messageType: 'std_msgs/String',
            payload: { data: 'left' },
            priority: 8,
          };
          publishRef.current(turnLeftCommand.topic, turnLeftCommand.payload, turnLeftCommand.messageType);
          onCommandSentRef.current?.(turnLeftCommand);
          setCommandRef.current(command3D + '_' + timestamp);
          // 广播到其他屏幕（使用同一个时间戳）
          publishRef.current('robot_3d_command', { command: command3D, timestamp }, 'std_msgs/String');
          // 跳过后续的广播逻辑
          command3D = null;
        } else if (buttonIndex === 5) {
          // RB按钮 - 右转（与web按钮一致）
          command3D = 'right';
          const timestamp = Date.now();  // 统一使用同一个时间戳
          const turnRightCommand: RobotCommand = {
            type: 'action' as any,
            topic: '/robot/action',
            messageType: 'std_msgs/String',
            payload: { data: 'right' },
            priority: 8,
          };
          publishRef.current(turnRightCommand.topic, turnRightCommand.payload, turnRightCommand.messageType);
          onCommandSentRef.current?.(turnRightCommand);
          setCommandRef.current(command3D + '_' + timestamp);
          // 广播到其他屏幕（使用同一个时间戳）
          publishRef.current('robot_3d_command', { command: command3D, timestamp }, 'std_msgs/String');
          // 跳过后续的广播逻辑
          command3D = null;
        } else if (buttonIndex === 6) {
          // 按钮6 - 摇头动作
          command3D = 'TurnHead';
          setCommandRef.current(command3D + '_' + timestamp);
        }
        
        // 广播3D命令到其他屏幕（ABCD按钮，使用同一个时间戳）
        if (command3D) {
          publishRef.current('robot_3d_command', { command: command3D, timestamp }, 'std_msgs/String');
        }
        
        // 同时发送到ROS（对于ABCD按钮）
        if (buttonIndex <= 3) {
          mapper.processInput(event);
        }
      } else if (event.type === 'button_up' && event.button) {
        const buttonIndex = event.button.index;
        
        // 处理按钮松开事件 - 重置对应的关节
        if (buttonIndex >= 0 && buttonIndex <= 6) {
          const timestamp = Date.now();
          let releaseCommand: string | null = null;
          
          if (buttonIndex === 0) {
            releaseCommand = 'RaiseRightArm_release';  // 按钮A松开 - 重置右臂
          } else if (buttonIndex === 1) {
            releaseCommand = 'ThumbsUp_release';  // 按钮B松开 - 重置左手
          } else if (buttonIndex === 2) {
            releaseCommand = 'WalkJump_release';  // 按钮C松开 - 重置右腿
          } else if (buttonIndex === 3) {
            releaseCommand = 'Jump_release';  // 按钮D松开 - 重置左腿
          } else if (buttonIndex === 6) {
            releaseCommand = 'TurnHead_release';  // 按钮6松开 - 重置头部（腰部）
          }
          
          if (releaseCommand) {
            setCommandRef.current(releaseCommand + '_' + timestamp);
            // 广播到其他屏幕
            publishRef.current('robot_3d_command', { command: releaseCommand, timestamp }, 'std_msgs/String');
          }
        }
        
        // 处理映射器中定义的其他按钮松开事件
        mapper.processInput(event);
      } else {
        // 其他事件交给映射器处理
        mapper.processInput(event);
      }
    });

    // 监听管理器启动
    manager.on('started', () => {
      setIsActive(true);
      // 外设控制系统已启动
    });

    // 监听管理器停止
    manager.on('stopped', () => {
      setIsActive(false);
      // 外设控制系统已停止
    });

    // 监听设备错误
    manager.on('deviceError', ({ deviceId, error }: any) => {
      console.error(`[PeripheralController] 设备错误 (${deviceId}):`, error);
      setError(`设备错误: ${error.message}`);
    });

    // 启动管理器，并在失败时自动重试
    const startWithRetry = () => {
      manager.start()
        .then(() => {
          // 启动成功
          setError(null);
          // 清除重试定时器
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        })
        .catch(err => {
          console.warn('[PeripheralController] 启动失败，5秒后重试...', err);
          const errorMsg = err.message || '未知错误';
          
          if (errorMsg.includes('Gamepad连接超时')) {
            setError('等待手柄连接...');
          } else {
            setError('等待外设连接...');
          }
          
          // 5秒后重试
          retryTimerRef.current = setTimeout(() => {
            startWithRetry();
          }, 5000);
        });
    };
    
    // 首次启动
    startWithRetry();

    // 清理
    return () => {
      // 清理资源
      // 清除重试定时器
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      manager.cleanup();
    };
  }, [enabled]); // 只依赖enabled，其他使用ref

  if (!enabled) {
    return null;
  }

  return (
    <div className="peripheral-controller-status">
      {isActive ? (
        <div className="status-indicator active">
          🎮 外设控制已启用
        </div>
      ) : error ? (
        <div className="status-indicator connecting">
          🔄 {error}
        </div>
      ) : (
        <div className="status-indicator connecting">
          🔄 正在连接外设...
        </div>
      )}
    </div>
  );
}

