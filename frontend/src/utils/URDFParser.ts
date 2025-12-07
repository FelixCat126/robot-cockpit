/**
 * URDF解析器
 * 解析URDF (Unified Robot Description Format) 文件，提取关节信息
 */

import * as THREE from 'three';
import { JointMapping } from './JointStateManager';

export interface URDFJoint {
  name: string;
  type: 'revolute' | 'continuous' | 'prismatic' | 'fixed' | 'floating' | 'planar';
  axis: { x: number; y: number; z: number };
  parent: string;
  child: string;
  origin?: {
    xyz: { x: number; y: number; z: number };
    rpy: { roll: number; pitch: number; yaw: number };
  };
  limit?: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  };
  dynamics?: {
    damping: number;
    friction: number;
  };
}

export interface URDFLink {
  name: string;
  visual?: any;
  collision?: any;
  inertial?: any;
}

export class URDFParser {
  /**
   * 从URDF XML字符串解析关节信息
   */
  static parseJoints(urdfXml: string): URDFJoint[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(urdfXml, 'text/xml');
    
    // 检查解析错误
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('[URDFParser] XML parse error:', parseError.textContent);
      return [];
    }

    const jointElements = xmlDoc.querySelectorAll('joint');
    const joints: URDFJoint[] = [];

    jointElements.forEach((jointEl) => {
      try {
        const joint = this.parseJointElement(jointEl);
        joints.push(joint);
      } catch (error) {
        console.error('[URDFParser] Failed to parse joint:', error);
      }
    });

    console.log(`[URDFParser] Parsed ${joints.length} joints from URDF`);
    return joints;
  }

  /**
   * 解析单个关节元素
   */
  private static parseJointElement(jointEl: Element): URDFJoint {
    const name = jointEl.getAttribute('name') || '';
    const type = jointEl.getAttribute('type') as URDFJoint['type'] || 'revolute';

    // 解析轴（默认Z轴）
    const axisEl = jointEl.querySelector('axis');
    const axisXyz = axisEl?.getAttribute('xyz') || '0 0 1';
    const [x, y, z] = axisXyz.split(' ').map(Number);
    const axis = { x, y, z };

    // 解析父子连接
    const parentEl = jointEl.querySelector('parent');
    const childEl = jointEl.querySelector('child');
    const parent = parentEl?.getAttribute('link') || '';
    const child = childEl?.getAttribute('link') || '';

    // 解析原点
    const originEl = jointEl.querySelector('origin');
    let origin = undefined;
    if (originEl) {
      const xyz = originEl.getAttribute('xyz') || '0 0 0';
      const rpy = originEl.getAttribute('rpy') || '0 0 0';
      const [px, py, pz] = xyz.split(' ').map(Number);
      const [roll, pitch, yaw] = rpy.split(' ').map(Number);
      origin = {
        xyz: { x: px, y: py, z: pz },
        rpy: { roll, pitch, yaw },
      };
    }

    // 解析限位
    const limitEl = jointEl.querySelector('limit');
    let limit = undefined;
    if (limitEl) {
      limit = {
        lower: parseFloat(limitEl.getAttribute('lower') || '0'),
        upper: parseFloat(limitEl.getAttribute('upper') || '0'),
        effort: parseFloat(limitEl.getAttribute('effort') || '0'),
        velocity: parseFloat(limitEl.getAttribute('velocity') || '0'),
      };
    }

    // 解析动力学参数
    const dynamicsEl = jointEl.querySelector('dynamics');
    let dynamics = undefined;
    if (dynamicsEl) {
      dynamics = {
        damping: parseFloat(dynamicsEl.getAttribute('damping') || '0'),
        friction: parseFloat(dynamicsEl.getAttribute('friction') || '0'),
      };
    }

    return {
      name,
      type,
      axis,
      parent,
      child,
      origin,
      limit,
      dynamics,
    };
  }

  /**
   * 从URDF XML解析连杆信息
   */
  static parseLinks(urdfXml: string): URDFLink[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(urdfXml, 'text/xml');
    const linkElements = xmlDoc.querySelectorAll('link');
    const links: URDFLink[] = [];

    linkElements.forEach((linkEl) => {
      const name = linkEl.getAttribute('name') || '';
      links.push({ name });
    });

    console.log(`[URDFParser] Parsed ${links.length} links from URDF`);
    return links;
  }

  /**
   * 创建Three.js关节映射
   * @param urdfJoints URDF关节定义
   * @param scene Three.js场景
   * @returns 关节名称到JointMapping的映射
   */
  static createJointMapping(
    urdfJoints: URDFJoint[],
    scene: THREE.Group
  ): Map<string, JointMapping> {
    const mapping = new Map<string, JointMapping>();

    urdfJoints.forEach((joint) => {
      // 在场景中查找对应的对象（通常是child link）
      const object = this.findObjectByName(scene, joint.child);

      if (object) {
        const axis = new THREE.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
        
        // 归一化轴向量
        if (axis.length() > 0) {
          axis.normalize();
        }

        // 转换关节类型
        let type: JointMapping['type'] = 'revolute';
        if (joint.type === 'continuous' || joint.type === 'revolute') {
          type = joint.type;
        } else if (joint.type === 'prismatic') {
          type = 'prismatic';
        } else if (joint.type === 'fixed') {
          type = 'fixed';
        }

        mapping.set(joint.name, {
          object,
          axis,
          type,
        });

        // 存储URDF信息到userData
        object.userData = {
          ...object.userData,
          urdfJoint: joint,
          jointType: type,
          axis: { x: axis.x, y: axis.y, z: axis.z },
        };

        console.log(`[URDFParser] Mapped joint "${joint.name}" to object "${object.name}"`);
      } else {
        console.warn(`[URDFParser] Object not found for joint "${joint.name}" (child: "${joint.child}")`);
      }
    });

    console.log(`[URDFParser] Created ${mapping.size} joint mappings`);
    return mapping;
  }

  /**
   * 在场景中查找对象（递归搜索，支持模糊匹配）
   */
  private static findObjectByName(scene: THREE.Group, name: string): THREE.Object3D | null {
    // 精确匹配
    let found = scene.getObjectByName(name);
    if (found) return found;

    // 模糊匹配
    const normalized = name.toLowerCase().replace(/[_-]/g, '');
    
    let result: THREE.Object3D | null = null;
    scene.traverse((object) => {
      if (result) return; // 已找到
      
      const objNormalized = object.name.toLowerCase().replace(/[_-]/g, '');
      if (objNormalized === normalized || 
          objNormalized.includes(normalized) || 
          normalized.includes(objNormalized)) {
        result = object;
      }
    });

    return result;
  }

  /**
   * 从URL加载URDF文件
   */
  static async loadFromURL(url: string): Promise<{ joints: URDFJoint[]; links: URDFLink[] }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load URDF: ${response.statusText}`);
      }

      const urdfXml = await response.text();
      const joints = this.parseJoints(urdfXml);
      const links = this.parseLinks(urdfXml);

      return { joints, links };
    } catch (error) {
      console.error('[URDFParser] Failed to load URDF from URL:', error);
      throw error;
    }
  }

  /**
   * 验证URDF关节配置
   */
  static validateJoints(joints: URDFJoint[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    joints.forEach((joint, index) => {
      if (!joint.name) {
        errors.push(`Joint ${index}: Missing name`);
      }
      if (!joint.parent) {
        errors.push(`Joint ${joint.name}: Missing parent link`);
      }
      if (!joint.child) {
        errors.push(`Joint ${joint.name}: Missing child link`);
      }
      if (joint.axis.x === 0 && joint.axis.y === 0 && joint.axis.z === 0) {
        errors.push(`Joint ${joint.name}: Invalid axis (all zeros)`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 打印关节树结构（用于调试）
   */
  static printJointTree(joints: URDFJoint[]): void {
    console.log('[URDFParser] Joint Tree:');
    
    // 构建父子关系图
    const childrenMap = new Map<string, URDFJoint[]>();
    joints.forEach((joint) => {
      if (!childrenMap.has(joint.parent)) {
        childrenMap.set(joint.parent, []);
      }
      childrenMap.get(joint.parent)!.push(joint);
    });

    // 递归打印
    const printNode = (linkName: string, indent: string = '') => {
      const children = childrenMap.get(linkName) || [];
      children.forEach((joint, index) => {
        const isLast = index === children.length - 1;
        const prefix = indent + (isLast ? '└─ ' : '├─ ');
        const nextIndent = indent + (isLast ? '   ' : '│  ');
        
        console.log(`${prefix}${joint.name} (${joint.type}) → ${joint.child}`);
        printNode(joint.child, nextIndent);
      });
    };

    // 找根节点
    const allChildren = new Set(joints.map(j => j.child));
    const rootLinks = joints
      .map(j => j.parent)
      .filter(p => !allChildren.has(p));

    rootLinks.forEach(root => {
      console.log(`Root: ${root}`);
      printNode(root);
    });
  }
}

