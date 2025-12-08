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
  const { setCommand } = useRobot3DStore();
  const managerRef = useRef<PeripheralManager | null>(null);
  const mapperRef = useRef<InputMapper | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用ref存储回调，避免依赖变化
  const publishRef = useRef(publish);
  const onCommandSentRef = useRef(onCommandSent);
  const setCommandRef = useRef(setCommand);
  
  // 更新refs
  publishRef.current = publish;
  onCommandSentRef.current = onCommandSent;
  setCommandRef.current = setCommand;
  
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
        
        // 节流发送（避免过于频繁）
        const now = Date.now();
        if (now - lastSendTimeRef.current >= sendIntervalMs) {
          lastSendTimeRef.current = now;
          
          // 合并所有轴的值发送命令
          const leftStickX = axisStateRef.current[0] || 0;
          const leftStickY = axisStateRef.current[1] || 0;
          
          // 计算速度（添加死区）
          const deadzone = 0.15;
          
          // 前后速度：前推为正，后拉为负
          const linearX = Math.abs(leftStickY) > deadzone ? -leftStickY * 0.5 : 0;
          
          // 转向速度：左推为正，右推为负（可与前后组合）
          const angularZ = Math.abs(leftStickX) > deadzone ? leftStickX * 1.0 : 0;
          
          // 根据线速度和角速度决定动画
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
          
          // 判断是否有实际输入
          const hasInput = Math.abs(linearX) > 0.01 || Math.abs(angularZ) > 0.01;
          
          // 发送命令到ROS（有输入时发送速度，无输入但之前在移动时发送停止命令）
          if (hasInput || isMovingRef.current) {
            const command: RobotCommand = {
              type: 'velocity' as any,
              topic: '/cmd_vel',
              messageType: 'geometry_msgs/Twist',
              payload: {
                linear: { x: linearX, y: 0, z: 0 },
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
          console.log(`[PeripheralController] 按钮${buttonIndex}防抖过滤（距上次${now - lastButtonTimeRef.current[buttonIndex]}ms）`);
          return;
        }
        console.log(`[PeripheralController] 按钮${buttonIndex}按下`);
        lastButtonTimeRef.current[buttonIndex] = now;
        
        let command3D: string | null = null;
        
        // 为所有按钮统一生成时间戳，避免重复触发
        const timestamp = Date.now();
        
        if (buttonIndex === 0) {
          command3D = 'Wave';  // 按钮A - 挥手
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
        // 按钮松开事件 - ABCD按钮不需要处理（动作会自动结束）
        // 只处理映射器中定义的其他按钮松开事件
        mapper.processInput(event);
      } else {
        // 其他事件交给映射器处理
        mapper.processInput(event);
      }
    });

    // 监听管理器启动
    manager.on('started', () => {
      setIsActive(true);
      console.log('[PeripheralController] 外设控制系统已启动');
    });

    // 监听管理器停止
    manager.on('stopped', () => {
      setIsActive(false);
      console.log('[PeripheralController] 外设控制系统已停止');
    });

    // 监听设备错误
    manager.on('deviceError', ({ deviceId, error }: any) => {
      console.error(`[PeripheralController] 设备错误 (${deviceId}):`, error);
      setError(`设备错误: ${error.message}`);
    });

    // 启动管理器
    manager.start().catch(err => {
      console.error('[PeripheralController] 启动失败:', err);
      const errorMsg = err.message || '未知错误';
      
      if (errorMsg.includes('Gamepad连接超时')) {
        setError('手柄未激活 - 请按下手柄按钮');
        console.log('💡 [提示] 请按下蓝牙手柄的任意按钮来激活它');
      } else {
        setError(`启动失败: ${errorMsg}`);
      }
    });

    // 清理
    return () => {
      console.log('[PeripheralController] 清理资源...');
      manager.cleanup();
    };
  }, [enabled]); // 只依赖enabled，其他使用ref

  if (!enabled) {
    return null;
  }

  return (
    <div className="peripheral-controller-status">
      {isActive && (
        <div className="status-indicator active">
          🎮 外设控制已启用
        </div>
      )}
      {error && (
        <div className="status-indicator error">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

