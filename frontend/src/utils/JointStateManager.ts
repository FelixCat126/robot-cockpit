/**
 * 关节状态管理器
 * 接收ROS joint_states话题数据并更新Three.js模型关节
 */

import * as THREE from 'three';

export interface JointState {
  name: string[];
  position: number[];
  velocity?: number[];
  effort?: number[];
  timestamp?: number;
}

export interface JointMapping {
  object: THREE.Object3D;
  axis: THREE.Vector3;
  type: 'revolute' | 'continuous' | 'prismatic' | 'fixed';
}

export class JointStateManager {
  private jointMap: Map<string, JointMapping> = new Map();
  private lastState: JointState | null = null;
  private interpolationEnabled: boolean = true;
  private interpolationFactor: number = 0.3; // 平滑系数 (0-1)
  private updateCount: number = 0;

  /**
   * 从Three.js场景中自动查找并映射所有关节
   */
  mapJointsFromScene(scene: THREE.Group): void {
    this.jointMap.clear();
    let foundCount = 0;

    // 递归遍历场景
    scene.traverse((object) => {
      if (this.isJointObject(object)) {
        // 推断关节类型和旋转轴
        const mapping = this.createJointMapping(object);
        this.jointMap.set(object.name, mapping);
        foundCount++;
        
        console.log(`[JointStateManager] Mapped joint: ${object.name} (${mapping.type}, axis: ${mapping.axis.toArray()})`);
      }
    });

    console.log(`[JointStateManager] Total joints mapped: ${foundCount}`);
  }

  /**
   * 手动注册单个关节
   */
  registerJoint(
    jointName: string, 
    object: THREE.Object3D, 
    type: 'revolute' | 'continuous' | 'prismatic' | 'fixed' = 'revolute',
    axis: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ): void {
    this.jointMap.set(jointName, {
      object,
      axis,
      type,
    });
    console.log(`[JointStateManager] Manually registered joint: ${jointName}`);
  }

  /**
   * 批量注册关节（从URDF解析结果）
   */
  registerJointsFromURDF(urdfJoints: Map<string, JointMapping>): void {
    urdfJoints.forEach((mapping, name) => {
      this.jointMap.set(name, mapping);
    });
    console.log(`[JointStateManager] Registered ${urdfJoints.size} joints from URDF`);
  }

  /**
   * 更新关节状态 - 核心方法
   */
  updateJointStates(jointState: JointState): void {
    if (!jointState.name || !jointState.position) {
      console.warn('[JointStateManager] Invalid joint state data');
      return;
    }

    if (jointState.name.length !== jointState.position.length) {
      console.warn('[JointStateManager] Joint names and positions length mismatch');
      return;
    }

    this.updateCount++;

    // 遍历每个关节
    for (let i = 0; i < jointState.name.length; i++) {
      const jointName = jointState.name[i];
      const position = jointState.position[i];

      // 查找对应的Three.js对象
      const mapping = this.jointMap.get(jointName);
      
      if (mapping) {
        this.updateJointTransform(mapping, position);
      } else {
        // 尝试模糊匹配
        this.fuzzyMatchAndUpdate(jointName, position);
      }
    }

    this.lastState = {
      ...jointState,
      timestamp: jointState.timestamp || Date.now(),
    };

    // 每100次更新打印一次统计
    if (this.updateCount % 100 === 0) {
      console.log(`[JointStateManager] Updated ${this.updateCount} times, mapped ${this.jointMap.size} joints`);
    }
  }

  /**
   * 更新单个关节的变换
   */
  private updateJointTransform(
    mapping: JointMapping, 
    targetValue: number
  ): void {
    const { object, axis, type } = mapping;

    if (type === 'fixed') {
      // 固定关节不动
      return;
    }

    if (type === 'revolute' || type === 'continuous') {
      // 旋转关节
      this.updateRotation(object, axis, targetValue);
    } else if (type === 'prismatic') {
      // 平移关节
      this.updatePosition(object, axis, targetValue);
    }
  }

  /**
   * 更新旋转
   */
  private updateRotation(object: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
    // 根据轴向设置旋转
    if (axis.x !== 0) {
      const current = object.rotation.x;
      object.rotation.x = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, angle * axis.x, this.interpolationFactor)
        : angle * axis.x;
    }
    
    if (axis.y !== 0) {
      const current = object.rotation.y;
      object.rotation.y = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, angle * axis.y, this.interpolationFactor)
        : angle * axis.y;
    }
    
    if (axis.z !== 0) {
      const current = object.rotation.z;
      object.rotation.z = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, angle * axis.z, this.interpolationFactor)
        : angle * axis.z;
    }
  }

  /**
   * 更新位置（平移关节）
   */
  private updatePosition(object: THREE.Object3D, axis: THREE.Vector3, distance: number): void {
    if (axis.x !== 0) {
      const current = object.position.x;
      object.position.x = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, distance * axis.x, this.interpolationFactor)
        : distance * axis.x;
    }
    
    if (axis.y !== 0) {
      const current = object.position.y;
      object.position.y = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, distance * axis.y, this.interpolationFactor)
        : distance * axis.y;
    }
    
    if (axis.z !== 0) {
      const current = object.position.z;
      object.position.z = this.interpolationEnabled
        ? THREE.MathUtils.lerp(current, distance * axis.z, this.interpolationFactor)
        : distance * axis.z;
    }
  }

  /**
   * 模糊匹配关节名称（处理命名差异）
   */
  private fuzzyMatchAndUpdate(rosJointName: string, position: number): void {
    // ROS中可能是 "left_hip_joint"
    // Three.js中可能是 "leftHipJoint" 或 "left_hip" 或 "leftHip"
    
    const normalized = rosJointName
      .replace(/_/g, '')
      .replace(/joint/gi, '')
      .toLowerCase();

    for (const [threejsName, mapping] of this.jointMap) {
      const threejsNormalized = threejsName
        .replace(/joint/gi, '')
        .toLowerCase();

      if (threejsNormalized.includes(normalized) || 
          normalized.includes(threejsNormalized)) {
        console.log(`[JointStateManager] Fuzzy matched: ${rosJointName} → ${threejsName}`);
        this.updateJointTransform(mapping, position);
        
        // 记录匹配，下次直接使用
        this.jointMap.set(rosJointName, mapping);
        return;
      }
    }

    // 只在第一次找不到时警告
    if (this.updateCount === 1) {
      console.warn(`[JointStateManager] No match found for joint: ${rosJointName}`);
    }
  }

  /**
   * 判断是否为关节对象
   */
  private isJointObject(object: THREE.Object3D): boolean {
    const name = object.name.toLowerCase();
    return (
      name.includes('joint') ||
      name.includes('_j_') ||
      name.includes('hip') ||
      name.includes('knee') ||
      name.includes('shoulder') ||
      name.includes('elbow') ||
      name.includes('neck') ||
      name.includes('ankle') ||
      name.includes('wrist')
    );
  }

  /**
   * 创建关节映射（推断类型和轴）
   */
  private createJointMapping(object: THREE.Object3D): JointMapping {
    const name = object.name.toLowerCase();
    
    // 推断关节类型（默认旋转关节）
    let type: JointMapping['type'] = 'revolute';
    
    // 推断旋转轴
    let axis = new THREE.Vector3(0, 0, 1); // 默认Z轴
    
    // 根据关节名称推断常见的旋转轴
    if (name.includes('hip') || name.includes('shoulder')) {
      // 髋关节和肩关节通常绕X轴旋转
      axis = new THREE.Vector3(1, 0, 0);
    } else if (name.includes('knee') || name.includes('elbow')) {
      // 膝关节和肘关节通常绕X轴旋转
      axis = new THREE.Vector3(1, 0, 0);
    } else if (name.includes('neck') || name.includes('head')) {
      // 颈部关节可能绕Y轴旋转
      axis = new THREE.Vector3(0, 1, 0);
    }

    // 如果对象有userData，优先使用
    if (object.userData.jointType) {
      type = object.userData.jointType;
    }
    if (object.userData.axis) {
      const a = object.userData.axis;
      axis = new THREE.Vector3(a.x || 0, a.y || 0, a.z || 0);
    }

    return { object, axis, type };
  }

  /**
   * 启用/禁用插值平滑
   */
  setInterpolation(enabled: boolean, factor: number = 0.3): void {
    this.interpolationEnabled = enabled;
    this.interpolationFactor = THREE.MathUtils.clamp(factor, 0, 1);
    console.log(`[JointStateManager] Interpolation ${enabled ? 'enabled' : 'disabled'} (factor: ${this.interpolationFactor})`);
  }

  /**
   * 获取当前关节状态
   */
  getCurrentState(): JointState | null {
    return this.lastState;
  }

  /**
   * 获取映射的关节列表
   */
  getMappedJoints(): string[] {
    return Array.from(this.jointMap.keys());
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      mappedJoints: this.jointMap.size,
      updateCount: this.updateCount,
      lastUpdateTime: this.lastState?.timestamp,
      interpolationEnabled: this.interpolationEnabled,
      interpolationFactor: this.interpolationFactor,
    };
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.jointMap.clear();
    this.lastState = null;
    this.updateCount = 0;
    console.log('[JointStateManager] Cleared all joint mappings');
  }

  /**
   * 重置关节到初始位置
   */
  reset(): void {
    this.jointMap.forEach((mapping) => {
      if (mapping.type === 'revolute' || mapping.type === 'continuous') {
        mapping.object.rotation.set(0, 0, 0);
      } else if (mapping.type === 'prismatic') {
        // 不重置位置，避免影响模型结构
      }
    });
    console.log('[JointStateManager] Reset all joints to initial position');
  }
}

