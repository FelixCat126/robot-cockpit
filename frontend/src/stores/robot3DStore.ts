/**
 * robot3DStore - 3D机器人状态管理
 * 用于控制面板和3D机器人之间的通信
 */

import { create } from 'zustand';

interface Robot3DVelocity {
  linear: number;   // 线速度（前后）
  angular: number;  // 角速度（转向）
}

interface MoveVelocity {
  linearX: number;  // 前后速度
  linearY: number;  // 左右速度
  angularZ: number; // 转向速度
}

interface Robot3DState {
  currentCommand: string | null;
  speed: number;
  direction: number;
  isMoving: boolean;
  velocity: Robot3DVelocity;
  moveVelocity: MoveVelocity; // 新增：多向移动速度
  
  // 动作
  setCommand: (command: string) => void;
  setSpeed: (speed: number) => void;
  setDirection: (direction: number) => void;
  setIsMoving: (isMoving: boolean) => void;
  setVelocity: (velocity: Robot3DVelocity) => void;
  setMoveVelocity: (velocity: MoveVelocity) => void; // 新增：设置移动速度
  reset: () => void;
}

export const useRobot3DStore = create<Robot3DState>((set) => ({
  currentCommand: null,
  speed: 1.0,
  direction: 0,
  isMoving: true,
  velocity: { linear: 0, angular: 0 },
  moveVelocity: { linearX: 0, linearY: 0, angularZ: 0 }, // 新增
  
  setCommand: (command) => set({ currentCommand: command }),
  setSpeed: (speed) => set({ speed }),
  setDirection: (direction) => set({ direction }),
  setIsMoving: (isMoving) => set({ isMoving }),
  setVelocity: (velocity) => set({ velocity }),
  setMoveVelocity: (velocity) => set({ moveVelocity: velocity }), // 新增
  reset: () => set({
    currentCommand: null,
    speed: 1.0,
    direction: 0,
    isMoving: true,
    velocity: { linear: 0, angular: 0 },
    moveVelocity: { linearX: 0, linearY: 0, angularZ: 0 }, // 新增
  }),
}));

