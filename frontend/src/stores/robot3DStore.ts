/**
 * robot3DStore - 3D机器人状态管理
 * 用于控制面板和3D机器人之间的通信
 */

import { create } from 'zustand';

interface Robot3DState {
  currentCommand: string | null;
  speed: number;
  direction: number;
  isMoving: boolean;
  
  // 动作
  setCommand: (command: string) => void;
  setSpeed: (speed: number) => void;
  setDirection: (direction: number) => void;
  setIsMoving: (isMoving: boolean) => void;
  reset: () => void;
}

export const useRobot3DStore = create<Robot3DState>((set) => ({
  currentCommand: null,
  speed: 1.0,
  direction: 0,
  isMoving: true,
  
  setCommand: (command) => set({ currentCommand: command }),
  setSpeed: (speed) => set({ speed }),
  setDirection: (direction) => set({ direction }),
  setIsMoving: (isMoving) => set({ isMoving }),
  reset: () => set({
    currentCommand: null,
    speed: 1.0,
    direction: 0,
    isMoving: true,
  }),
}));

