/**
 * WalkingAnimation - 走路动画控制器
 * 实现自然的人形机器人走路动画
 */

import { HumanoidRobot } from './HumanoidRobotGenerator';

export interface WalkingAnimationConfig {
  walkSpeed?: number;        // 行走速度 (0.5 - 2.0)
  stepHeight?: number;       // 步高 (0.1 - 0.3)
  armSwing?: number;         // 手臂摆动幅度 (0.3 - 1.0)
  bodyBob?: number;          // 躯干上下晃动幅度 (0.02 - 0.1)
}

export class WalkingAnimation {
  private robot: HumanoidRobot;
  private config: Required<WalkingAnimationConfig>;
  private time: number = 0;
  private isRunning: boolean = false;
  private animationId: number | null = null;
  private lastFrameTime: number = 0;

  constructor(robot: HumanoidRobot, config: WalkingAnimationConfig = {}) {
    this.robot = robot;
    this.config = {
      walkSpeed: config.walkSpeed || 1.0,
      stepHeight: config.stepHeight || 0.2,
      armSwing: config.armSwing || 0.6,
      bodyBob: config.bodyBob || 0.05,
    };
  }

  /**
   * 启动动画
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animate();
  }

  /**
   * 停止动画
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 设置行走速度
   */
  setWalkSpeed(speed: number): void {
    this.config.walkSpeed = Math.max(0.5, Math.min(2.0, speed));
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // 转换为秒
    this.lastFrameTime = currentTime;

    this.update(deltaTime);
    
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * 更新动画状态
   */
  update(deltaTime: number): void {
    this.time += deltaTime * this.config.walkSpeed;

    // 计算各个关节的角度
    const angles = this.calculateJointAngles(this.time);
    
    // 应用到机器人模型
    this.applyJointAngles(angles);
  }

  /**
   * 计算关节角度
   */
  private calculateJointAngles(time: number): Record<string, number> {
    const cycleFrequency = 2.0; // 一个完整步态周期的频率
    const phase = time * cycleFrequency;

    // 左右腿相位相反（差180度）
    const leftLegPhase = phase * Math.PI;
    const rightLegPhase = (phase + 1) * Math.PI;

    // 手臂相位与对侧腿相同（走路时右腿前左臂前）
    const leftArmPhase = rightLegPhase;
    const rightArmPhase = leftLegPhase;

    return {
      // 左腿
      leftHipX: Math.sin(leftLegPhase) * 0.5,
      leftKneeX: Math.max(0, Math.sin(leftLegPhase * 2) * 0.3),
      
      // 右腿
      rightHipX: Math.sin(rightLegPhase) * 0.5,
      rightKneeX: Math.max(0, Math.sin(rightLegPhase * 2) * 0.3),
      
      // 左臂
      leftShoulderX: Math.sin(leftArmPhase) * this.config.armSwing * 0.4,
      leftElbowX: Math.max(0, -Math.sin(leftArmPhase) * this.config.armSwing * 0.3),
      
      // 右臂
      rightShoulderX: Math.sin(rightArmPhase) * this.config.armSwing * 0.4,
      rightElbowX: Math.max(0, -Math.sin(rightArmPhase) * this.config.armSwing * 0.3),
      
      // 躯干轻微晃动（垂直）
      bodyBob: Math.sin(phase * Math.PI * 2) * this.config.bodyBob,
      
      // 头部轻微点头
      neckX: Math.sin(phase * Math.PI * 2) * 0.05,
    };
  }

  /**
   * 应用关节角度到机器人模型
   */
  private applyJointAngles(angles: Record<string, number>): void {
    const { joints, limbs } = this.robot;

    // 左腿
    if (joints.leftHip) {
      joints.leftHip.rotation.x = angles.leftHipX;
    }
    if (joints.leftKnee) {
      joints.leftKnee.rotation.x = angles.leftKneeX;
    }

    // 右腿
    if (joints.rightHip) {
      joints.rightHip.rotation.x = angles.rightHipX;
    }
    if (joints.rightKnee) {
      joints.rightKnee.rotation.x = angles.rightKneeX;
    }

    // 左臂
    if (joints.leftShoulder) {
      joints.leftShoulder.rotation.x = angles.leftShoulderX;
    }
    if (joints.leftElbow) {
      joints.leftElbow.rotation.x = angles.leftElbowX;
    }

    // 右臂
    if (joints.rightShoulder) {
      joints.rightShoulder.rotation.x = angles.rightShoulderX;
    }
    if (joints.rightElbow) {
      joints.rightElbow.rotation.x = angles.rightElbowX;
    }

    // 躯干上下晃动
    if (limbs.torso) {
      limbs.torso.position.y = 1.2 + angles.bodyBob;
    }

    // 头部点头
    if (joints.neck) {
      joints.neck.rotation.x = angles.neckX;
    }

    // 整个机器人前进（在地面上行走的效果）
    this.robot.group.position.z = Math.sin(this.time * 2) * 0.1;
  }

  /**
   * 重置动画到初始状态
   */
  reset(): void {
    this.time = 0;
    this.update(0);
  }

  /**
   * 获取当前动画时间
   */
  getTime(): number {
    return this.time;
  }

  /**
   * 获取动画是否正在运行
   */
  isPlaying(): boolean {
    return this.isRunning;
  }
}

