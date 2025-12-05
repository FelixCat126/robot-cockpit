/**
 * HumanoidRobotGenerator - 人形机器人模型生成器
 * 使用Three.js创建双足人形机器人模型，支持关节动画
 */

import * as THREE from 'three';

export interface HumanoidRobot {
  group: THREE.Group;           // 根节点
  joints: {
    neck: THREE.Object3D;
    leftShoulder: THREE.Object3D;
    rightShoulder: THREE.Object3D;
    leftElbow: THREE.Object3D;
    rightElbow: THREE.Object3D;
    leftHip: THREE.Object3D;
    rightHip: THREE.Object3D;
    leftKnee: THREE.Object3D;
    rightKnee: THREE.Object3D;
  };
  limbs: {
    head: THREE.Mesh;
    torso: THREE.Mesh;
    leftUpperArm: THREE.Mesh;
    leftLowerArm: THREE.Mesh;
    rightUpperArm: THREE.Mesh;
    rightLowerArm: THREE.Mesh;
    leftUpperLeg: THREE.Mesh;
    leftLowerLeg: THREE.Mesh;
    rightUpperLeg: THREE.Mesh;
    rightLowerLeg: THREE.Mesh;
  };
}

export interface RobotConfig {
  scale?: number;
  colors?: {
    head?: number;
    torso?: number;
    limbs?: number;
    joints?: number;
  };
}

export class HumanoidRobotGenerator {
  private config: RobotConfig;

  constructor(config: RobotConfig = {}) {
    this.config = {
      scale: config.scale || 1,
      colors: {
        head: config.colors?.head || 0xffcc99,      // 浅肤色
        torso: config.colors?.torso || 0x4a90e2,    // 蓝色
        limbs: config.colors?.limbs || 0x66cdaa,    // 浅绿色
        joints: config.colors?.joints || 0x888888,  // 灰色
      },
    };
  }

  /**
   * 生成完整的人形机器人模型
   */
  generate(): HumanoidRobot {
    const scale = this.config.scale!;
    const colors = this.config.colors!;

    // 创建根节点
    const robotGroup = new THREE.Group();
    robotGroup.name = 'HumanoidRobot';

    // 存储关节和肢体引用
    const joints: any = {};
    const limbs: any = {};

    // ==================== 躯干 ====================
    const torsoGeometry = new THREE.BoxGeometry(0.5 * scale, 0.8 * scale, 0.3 * scale);
    const torsoMaterial = new THREE.MeshLambertMaterial({ color: colors.torso });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 1.2 * scale;
    torso.castShadow = true;
    torso.receiveShadow = true;
    torso.name = 'torso';
    robotGroup.add(torso);
    limbs.torso = torso;

    // ==================== 头部 ====================
    const neckJoint = new THREE.Object3D();
    neckJoint.position.set(0, 1.6 * scale, 0);
    neckJoint.name = 'neckJoint';
    robotGroup.add(neckJoint);
    joints.neck = neckJoint;

    const headGeometry = new THREE.SphereGeometry(0.25 * scale, 16, 16);
    const headMaterial = new THREE.MeshLambertMaterial({ color: colors.head });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.25 * scale;
    head.castShadow = true;
    head.receiveShadow = true;
    head.name = 'head';
    neckJoint.add(head);
    limbs.head = head;

    // 眼睛
    const eyeGeometry = new THREE.SphereGeometry(0.05 * scale, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.08 * scale, 0.25 * scale, 0.2 * scale);
    neckJoint.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.08 * scale, 0.25 * scale, 0.2 * scale);
    neckJoint.add(rightEye);

    // ==================== 左臂 ====================
    // 左肩关节
    const leftShoulderJoint = new THREE.Object3D();
    leftShoulderJoint.position.set(-0.35 * scale, 1.5 * scale, 0);
    leftShoulderJoint.name = 'leftShoulderJoint';
    robotGroup.add(leftShoulderJoint);
    joints.leftShoulder = leftShoulderJoint;

    // 左上臂
    const upperArmGeometry = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.4 * scale, 8);
    const limbMaterial = new THREE.MeshLambertMaterial({ color: colors.limbs });
    
    const leftUpperArm = new THREE.Mesh(upperArmGeometry, limbMaterial);
    leftUpperArm.position.y = -0.2 * scale;
    leftUpperArm.castShadow = true;
    leftUpperArm.receiveShadow = true;
    leftUpperArm.name = 'leftUpperArm';
    leftShoulderJoint.add(leftUpperArm);
    limbs.leftUpperArm = leftUpperArm;

    // 左肘关节
    const leftElbowJoint = new THREE.Object3D();
    leftElbowJoint.position.y = -0.4 * scale;
    leftElbowJoint.name = 'leftElbowJoint';
    leftShoulderJoint.add(leftElbowJoint);
    joints.leftElbow = leftElbowJoint;

    // 左前臂
    const leftLowerArm = new THREE.Mesh(upperArmGeometry, limbMaterial);
    leftLowerArm.position.y = -0.2 * scale;
    leftLowerArm.castShadow = true;
    leftLowerArm.receiveShadow = true;
    leftLowerArm.name = 'leftLowerArm';
    leftElbowJoint.add(leftLowerArm);
    limbs.leftLowerArm = leftLowerArm;

    // ==================== 右臂 ====================
    // 右肩关节
    const rightShoulderJoint = new THREE.Object3D();
    rightShoulderJoint.position.set(0.35 * scale, 1.5 * scale, 0);
    rightShoulderJoint.name = 'rightShoulderJoint';
    robotGroup.add(rightShoulderJoint);
    joints.rightShoulder = rightShoulderJoint;

    // 右上臂
    const rightUpperArm = new THREE.Mesh(upperArmGeometry, limbMaterial);
    rightUpperArm.position.y = -0.2 * scale;
    rightUpperArm.castShadow = true;
    rightUpperArm.receiveShadow = true;
    rightUpperArm.name = 'rightUpperArm';
    rightShoulderJoint.add(rightUpperArm);
    limbs.rightUpperArm = rightUpperArm;

    // 右肘关节
    const rightElbowJoint = new THREE.Object3D();
    rightElbowJoint.position.y = -0.4 * scale;
    rightElbowJoint.name = 'rightElbowJoint';
    rightShoulderJoint.add(rightElbowJoint);
    joints.rightElbow = rightElbowJoint;

    // 右前臂
    const rightLowerArm = new THREE.Mesh(upperArmGeometry, limbMaterial);
    rightLowerArm.position.y = -0.2 * scale;
    rightLowerArm.castShadow = true;
    rightLowerArm.receiveShadow = true;
    rightLowerArm.name = 'rightLowerArm';
    rightElbowJoint.add(rightLowerArm);
    limbs.rightLowerArm = rightLowerArm;

    // ==================== 左腿 ====================
    // 左髋关节
    const leftHipJoint = new THREE.Object3D();
    leftHipJoint.position.set(-0.15 * scale, 0.8 * scale, 0);
    leftHipJoint.name = 'leftHipJoint';
    robotGroup.add(leftHipJoint);
    joints.leftHip = leftHipJoint;

    // 左大腿
    const upperLegGeometry = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.5 * scale, 8);
    
    const leftUpperLeg = new THREE.Mesh(upperLegGeometry, limbMaterial);
    leftUpperLeg.position.y = -0.25 * scale;
    leftUpperLeg.castShadow = true;
    leftUpperLeg.receiveShadow = true;
    leftUpperLeg.name = 'leftUpperLeg';
    leftHipJoint.add(leftUpperLeg);
    limbs.leftUpperLeg = leftUpperLeg;

    // 左膝关节
    const leftKneeJoint = new THREE.Object3D();
    leftKneeJoint.position.y = -0.5 * scale;
    leftKneeJoint.name = 'leftKneeJoint';
    leftHipJoint.add(leftKneeJoint);
    joints.leftKnee = leftKneeJoint;

    // 左小腿
    const leftLowerLeg = new THREE.Mesh(upperLegGeometry, limbMaterial);
    leftLowerLeg.position.y = -0.25 * scale;
    leftLowerLeg.castShadow = true;
    leftLowerLeg.receiveShadow = true;
    leftLowerLeg.name = 'leftLowerLeg';
    leftKneeJoint.add(leftLowerLeg);
    limbs.leftLowerLeg = leftLowerLeg;

    // 左脚
    const footGeometry = new THREE.BoxGeometry(0.12 * scale, 0.05 * scale, 0.2 * scale);
    const leftFoot = new THREE.Mesh(footGeometry, limbMaterial);
    leftFoot.position.set(0, -0.5 * scale, 0.05 * scale);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    leftKneeJoint.add(leftFoot);

    // ==================== 右腿 ====================
    // 右髋关节
    const rightHipJoint = new THREE.Object3D();
    rightHipJoint.position.set(0.15 * scale, 0.8 * scale, 0);
    rightHipJoint.name = 'rightHipJoint';
    robotGroup.add(rightHipJoint);
    joints.rightHip = rightHipJoint;

    // 右大腿
    const rightUpperLeg = new THREE.Mesh(upperLegGeometry, limbMaterial);
    rightUpperLeg.position.y = -0.25 * scale;
    rightUpperLeg.castShadow = true;
    rightUpperLeg.receiveShadow = true;
    rightUpperLeg.name = 'rightUpperLeg';
    rightHipJoint.add(rightUpperLeg);
    limbs.rightUpperLeg = rightUpperLeg;

    // 右膝关节
    const rightKneeJoint = new THREE.Object3D();
    rightKneeJoint.position.y = -0.5 * scale;
    rightKneeJoint.name = 'rightKneeJoint';
    rightHipJoint.add(rightKneeJoint);
    joints.rightKnee = rightKneeJoint;

    // 右小腿
    const rightLowerLeg = new THREE.Mesh(upperLegGeometry, limbMaterial);
    rightLowerLeg.position.y = -0.25 * scale;
    rightLowerLeg.castShadow = true;
    rightLowerLeg.receiveShadow = true;
    rightLowerLeg.name = 'rightLowerLeg';
    rightKneeJoint.add(rightLowerLeg);
    limbs.rightLowerLeg = rightLowerLeg;

    // 右脚
    const rightFoot = new THREE.Mesh(footGeometry, limbMaterial);
    rightFoot.position.set(0, -0.5 * scale, 0.05 * scale);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    rightKneeJoint.add(rightFoot);

    return {
      group: robotGroup,
      joints,
      limbs,
    };
  }

  /**
   * 清理资源
   */
  dispose(robot: HumanoidRobot): void {
    robot.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}

