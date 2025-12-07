/**
 * 关节状态缓冲器
 * 处理高频关节状态数据，提供平滑插值和降采样功能
 */

import { JointState } from './JointStateManager';

export class JointStateBuffer {
  private buffer: JointState[] = [];
  private maxBufferSize: number = 10;
  private targetFPS: number = 60;
  private lastProcessedTime: number = 0;
  private frameInterval: number;

  constructor(targetFPS: number = 60, bufferSize: number = 10) {
    this.targetFPS = targetFPS;
    this.maxBufferSize = bufferSize;
    this.frameInterval = 1000 / targetFPS; // 16.67ms for 60fps
  }

  /**
   * 添加新的关节状态到缓冲区
   */
  addState(state: JointState): void {
    // 确保有时间戳
    if (!state.timestamp) {
      state.timestamp = Date.now();
    }

    this.buffer.push(state);

    // 限制缓冲区大小
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * 获取当前应该使用的关节状态（带降采样）
   * @param currentTime 当前时间戳
   * @returns 关节状态或null
   */
  getState(currentTime: number = Date.now()): JointState | null {
    if (this.buffer.length === 0) {
      return null;
    }

    // 检查是否需要更新（降采样到目标FPS）
    if (currentTime - this.lastProcessedTime < this.frameInterval) {
      return null; // 跳过此帧
    }

    this.lastProcessedTime = currentTime;

    // 返回最新的状态
    return this.buffer[this.buffer.length - 1];
  }

  /**
   * 获取插值后的关节状态（时间插值）
   * @param currentTime 当前时间戳
   * @returns 插值后的状态或null
   */
  getInterpolatedState(currentTime: number = Date.now()): JointState | null {
    if (this.buffer.length < 2) {
      return this.buffer[0] || null;
    }

    // 检查降采样
    if (currentTime - this.lastProcessedTime < this.frameInterval) {
      return null;
    }

    this.lastProcessedTime = currentTime;

    // 获取最近的两个状态
    const latest = this.buffer[this.buffer.length - 1];
    const previous = this.buffer[this.buffer.length - 2];

    if (!latest.timestamp || !previous.timestamp) {
      return latest;
    }

    // 计算插值进度
    const timeDelta = latest.timestamp - previous.timestamp;
    if (timeDelta <= 0) {
      return latest;
    }

    const progress = Math.min((currentTime - previous.timestamp) / timeDelta, 1.0);

    // 对每个关节位置进行线性插值
    const interpolatedPosition = latest.position.map((pos, i) => {
      const prevPos = previous.position[i] || 0;
      return prevPos + (pos - prevPos) * progress;
    });

    // 对速度也进行插值（如果存在）
    let interpolatedVelocity: number[] | undefined;
    if (latest.velocity && previous.velocity) {
      interpolatedVelocity = latest.velocity.map((vel, i) => {
        const prevVel = previous.velocity![i] || 0;
        return prevVel + (vel - prevVel) * progress;
      });
    }

    return {
      name: latest.name,
      position: interpolatedPosition,
      velocity: interpolatedVelocity,
      effort: latest.effort,
      timestamp: currentTime,
    };
  }

  /**
   * 获取平均状态（对最近N个状态求平均，降噪）
   * @param count 平均的状态数量
   */
  getAveragedState(count: number = 3): JointState | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const statesToAverage = this.buffer.slice(-Math.min(count, this.buffer.length));
    if (statesToAverage.length === 0) {
      return null;
    }

    const firstState = statesToAverage[0];
    const numJoints = firstState.position.length;

    // 初始化累加器
    const sumPosition = new Array(numJoints).fill(0);
    const sumVelocity = firstState.velocity ? new Array(numJoints).fill(0) : undefined;
    const sumEffort = firstState.effort ? new Array(numJoints).fill(0) : undefined;

    // 累加
    statesToAverage.forEach((state) => {
      state.position.forEach((pos, i) => {
        sumPosition[i] += pos;
      });

      if (sumVelocity && state.velocity) {
        state.velocity.forEach((vel, i) => {
          sumVelocity[i] += vel;
        });
      }

      if (sumEffort && state.effort) {
        state.effort.forEach((eff, i) => {
          sumEffort[i] += eff;
        });
      }
    });

    // 求平均
    const avgCount = statesToAverage.length;
    const avgPosition = sumPosition.map((sum) => sum / avgCount);
    const avgVelocity = sumVelocity?.map((sum) => sum / avgCount);
    const avgEffort = sumEffort?.map((sum) => sum / avgCount);

    return {
      name: firstState.name,
      position: avgPosition,
      velocity: avgVelocity,
      effort: avgEffort,
      timestamp: Date.now(),
    };
  }

  /**
   * 检查缓冲区中是否有新数据
   */
  hasNewData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * 获取缓冲区中的数据数量
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * 获取最新的状态（不考虑降采样）
   */
  getLatestState(): JointState | null {
    return this.buffer[this.buffer.length - 1] || null;
  }

  /**
   * 获取最旧的状态
   */
  getOldestState(): JointState | null {
    return this.buffer[0] || null;
  }

  /**
   * 计算缓冲区时间跨度（毫秒）
   */
  getBufferTimeSpan(): number {
    if (this.buffer.length < 2) {
      return 0;
    }

    const oldest = this.buffer[0];
    const latest = this.buffer[this.buffer.length - 1];

    if (!oldest.timestamp || !latest.timestamp) {
      return 0;
    }

    return latest.timestamp - oldest.timestamp;
  }

  /**
   * 计算数据接收频率（Hz）
   */
  getReceiveRate(): number {
    const timeSpan = this.getBufferTimeSpan();
    if (timeSpan === 0 || this.buffer.length < 2) {
      return 0;
    }

    return ((this.buffer.length - 1) * 1000) / timeSpan;
  }

  /**
   * 设置目标FPS（降采样率）
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(1, fps);
    this.frameInterval = 1000 / this.targetFPS;
    console.log(`[JointStateBuffer] Target FPS set to ${this.targetFPS} (${this.frameInterval.toFixed(2)}ms interval)`);
  }

  /**
   * 设置缓冲区大小
   */
  setBufferSize(size: number): void {
    this.maxBufferSize = Math.max(2, size);
    
    // 裁剪现有缓冲区
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }
    
    console.log(`[JointStateBuffer] Buffer size set to ${this.maxBufferSize}`);
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = [];
    this.lastProcessedTime = 0;
    console.log('[JointStateBuffer] Buffer cleared');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      bufferSize: this.buffer.length,
      maxBufferSize: this.maxBufferSize,
      targetFPS: this.targetFPS,
      receiveRate: this.getReceiveRate().toFixed(2) + ' Hz',
      timeSpan: this.getBufferTimeSpan() + ' ms',
      lastProcessedTime: this.lastProcessedTime,
    };
  }

  /**
   * 检测数据延迟
   */
  getLatency(): number {
    const latest = this.getLatestState();
    if (!latest || !latest.timestamp) {
      return 0;
    }

    return Date.now() - latest.timestamp;
  }

  /**
   * 检查数据是否过时
   */
  isStale(threshold: number = 1000): boolean {
    const latency = this.getLatency();
    return latency > threshold;
  }
}

