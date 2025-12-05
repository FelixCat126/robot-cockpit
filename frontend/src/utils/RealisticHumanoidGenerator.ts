/**
 * RealisticHumanoidGenerator - 更真实的人形机器人生成器
 * 改进版：更符合人体比例，添加更多细节
 */

import * as THREE from 'three';

export interface HumanoidRobot {
  group: THREE.Group;
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
}

export class RealisticHumanoidGenerator {
  private scale: number;

  constructor(scale: number = 1) {
    this.scale = scale;
  }

  generate(): HumanoidRobot {
    const group = new THREE.Group();
    const joints: any = {};

    // 材质定义（移到方法内，供子方法调用）
    const shirtMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x4a90e2,
      shininess: 60
    });

    // ==================== 躯干 ====================
    const torso = new THREE.Group();
    torso.position.y = 1.0 * this.scale;
    
    // 胸部（梯形效果）
    const chestGeometry = new THREE.CylinderGeometry(
      0.22 * this.scale, 
      0.25 * this.scale, 
      0.5 * this.scale, 
      32
    );
    const chest = new THREE.Mesh(chestGeometry, shirtMaterial);
    chest.position.y = 0.15 * this.scale;
    chest.castShadow = true;
    torso.add(chest);
    
    // 腰部
    const waistGeometry = new THREE.CylinderGeometry(
      0.18 * this.scale,
      0.20 * this.scale,
      0.25 * this.scale,
      32
    );
    const waist = new THREE.Mesh(waistGeometry, shirtMaterial);
    waist.position.y = -0.175 * this.scale;
    waist.castShadow = true;
    torso.add(waist);
    
    group.add(torso);

    // ==================== 头部 ====================
    joints.neck = new THREE.Object3D();
    joints.neck.position.set(0, 1.4 * this.scale, 0);
    group.add(joints.neck);

    const head = this.createDetailedHead();
    head.position.y = 0.3 * this.scale;
    joints.neck.add(head);

    // ==================== 手臂 ====================
    const { shoulder: leftShoulder, elbow: leftElbow } = this.createDetailedArm(true);
    joints.leftShoulder = new THREE.Object3D();
    joints.leftShoulder.position.set(-0.3 * this.scale, 1.3 * this.scale, 0);
    joints.leftShoulder.add(leftShoulder);
    group.add(joints.leftShoulder);
    joints.leftElbow = leftElbow;

    const { shoulder: rightShoulder, elbow: rightElbow } = this.createDetailedArm(false);
    joints.rightShoulder = new THREE.Object3D();
    joints.rightShoulder.position.set(0.3 * this.scale, 1.3 * this.scale, 0);
    joints.rightShoulder.add(rightShoulder);
    group.add(joints.rightShoulder);
    joints.rightElbow = rightElbow;

    // ==================== 腿部 ====================
    const { hip: leftHip, knee: leftKnee } = this.createDetailedLeg(true);
    joints.leftHip = new THREE.Object3D();
    joints.leftHip.position.set(-0.12 * this.scale, 0.7 * this.scale, 0);
    joints.leftHip.add(leftHip);
    group.add(joints.leftHip);
    joints.leftKnee = leftKnee;

    const { hip: rightHip, knee: rightKnee } = this.createDetailedLeg(false);
    joints.rightHip = new THREE.Object3D();
    joints.rightHip.position.set(0.12 * this.scale, 0.7 * this.scale, 0);
    joints.rightHip.add(rightHip);
    group.add(joints.rightHip);
    joints.rightKnee = rightKnee;

    return { group, joints };
  }

  private createDetailedHead(): THREE.Group {
    const head = new THREE.Group();
    
    const skinMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffdbac,
      shininess: 30
    });
    
    // 头部 - 椭球形
    const headGeometry = new THREE.SphereGeometry(0.2 * this.scale, 32, 32);
    headGeometry.scale(1, 1.2, 1);
    const headMesh = new THREE.Mesh(headGeometry, skinMaterial);
    headMesh.castShadow = true;
    head.add(headMesh);
    
    // 颈部
    const neckGeometry = new THREE.CylinderGeometry(
      0.06 * this.scale,
      0.08 * this.scale,
      0.12 * this.scale,
      16
    );
    const neck = new THREE.Mesh(neckGeometry, skinMaterial);
    neck.position.y = -0.16 * this.scale;
    neck.castShadow = true;
    head.add(neck);
    
    // 眼睛组
    const eyeWhite = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const irisMaterial = new THREE.MeshPhongMaterial({ color: 0x2c5aa0 });
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    const eyeRadius = 0.03 * this.scale;
    const eyeY = 0.05 * this.scale;
    const eyeZ = 0.18 * this.scale;
    
    // 左眼
    const leftEyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius, 16, 16),
      eyeWhite
    );
    leftEyeWhite.position.set(-0.08 * this.scale, eyeY, eyeZ);
    head.add(leftEyeWhite);
    
    const leftIris = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.6, 16, 16),
      irisMaterial
    );
    leftIris.position.set(-0.08 * this.scale, eyeY, eyeZ + eyeRadius * 0.5);
    head.add(leftIris);
    
    const leftPupil = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.4, 16, 16),
      pupilMaterial
    );
    leftPupil.position.set(-0.08 * this.scale, eyeY, eyeZ + eyeRadius * 0.7);
    head.add(leftPupil);
    
    // 右眼
    const rightEyeWhite = leftEyeWhite.clone();
    rightEyeWhite.position.x = 0.08 * this.scale;
    head.add(rightEyeWhite);
    
    const rightIris = leftIris.clone();
    rightIris.position.x = 0.08 * this.scale;
    head.add(rightIris);
    
    const rightPupil = leftPupil.clone();
    rightPupil.position.x = 0.08 * this.scale;
    head.add(rightPupil);
    
    // 鼻子
    const noseGeometry = new THREE.ConeGeometry(
      0.025 * this.scale,
      0.06 * this.scale,
      16
    );
    const nose = new THREE.Mesh(noseGeometry, skinMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 0.2 * this.scale);
    head.add(nose);
    
    // 嘴巴 - 使用曲线
    const mouthCurve = new THREE.EllipseCurve(
      0, 0,
      0.09 * this.scale, 0.04 * this.scale,
      0, Math.PI,
      false,
      0
    );
    const mouthPoints = mouthCurve.getPoints(32);
    const mouthGeometry = new THREE.BufferGeometry().setFromPoints(mouthPoints);
    const mouthMaterial = new THREE.LineBasicMaterial({ 
      color: 0x8b4513,
      linewidth: 2
    });
    const mouth = new THREE.Line(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.06 * this.scale, 0.19 * this.scale);
    mouth.rotation.x = -Math.PI / 2;
    head.add(mouth);
    
    // 耳朵
    const earGeometry = new THREE.SphereGeometry(0.04 * this.scale, 16, 16);
    earGeometry.scale(0.5, 1, 1);
    
    const leftEar = new THREE.Mesh(earGeometry, skinMaterial);
    leftEar.position.set(-0.19 * this.scale, 0, 0);
    leftEar.castShadow = true;
    head.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeometry, skinMaterial);
    rightEar.position.set(0.19 * this.scale, 0, 0);
    rightEar.castShadow = true;
    head.add(rightEar);
    
    // 头发
    const hairGeometry = new THREE.SphereGeometry(0.21 * this.scale, 32, 32);
    hairGeometry.scale(1, 0.6, 1);
    const hairMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x3d2817,
      shininess: 80
    });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 0.12 * this.scale;
    hair.castShadow = true;
    head.add(hair);
    
    return head;
  }

  private createDetailedArm(isLeft: boolean): { shoulder: THREE.Group; elbow: THREE.Group } {
    const shoulder = new THREE.Group();
    
    const skinMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffdbac,
      shininess: 30
    });
    
    const sleeveMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x4a90e2,
      shininess: 60
    });
    
    // 肩部关节球
    const shoulderJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 * this.scale, 16, 16),
      sleeveMaterial
    );
    shoulderJoint.castShadow = true;
    shoulder.add(shoulderJoint);
    
    // 上臂 - 有衣袖
    const upperArmGeometry = new THREE.CylinderGeometry(
      0.07 * this.scale,
      0.06 * this.scale,
      0.3 * this.scale,
      16
    );
    const upperArm = new THREE.Mesh(upperArmGeometry, sleeveMaterial);
    upperArm.position.y = -0.15 * this.scale;
    upperArm.castShadow = true;
    shoulder.add(upperArm);
    
    // 肘关节
    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 * this.scale, 16, 16),
      skinMaterial
    );
    elbowJoint.position.y = -0.3 * this.scale;
    elbowJoint.castShadow = true;
    shoulder.add(elbowJoint);
    
    const elbow = new THREE.Group();
    elbow.position.y = -0.3 * this.scale;
    shoulder.add(elbow);
    
    // 前臂 - 皮肤
    const lowerArmGeometry = new THREE.CylinderGeometry(
      0.055 * this.scale,
      0.05 * this.scale,
      0.28 * this.scale,
      16
    );
    const lowerArm = new THREE.Mesh(lowerArmGeometry, skinMaterial);
    lowerArm.position.y = -0.14 * this.scale;
    lowerArm.castShadow = true;
    elbow.add(lowerArm);
    
    // 手腕
    const wrist = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 * this.scale, 16, 16),
      skinMaterial
    );
    wrist.position.y = -0.28 * this.scale;
    wrist.castShadow = true;
    elbow.add(wrist);
    
    // 手掌
    const handGeometry = new THREE.BoxGeometry(
      0.08 * this.scale,
      0.12 * this.scale,
      0.03 * this.scale
    );
    const hand = new THREE.Mesh(handGeometry, skinMaterial);
    hand.position.y = -0.34 * this.scale;
    hand.castShadow = true;
    elbow.add(hand);
    
    // 手指（4根）
    const fingerGeometry = new THREE.BoxGeometry(
      0.015 * this.scale,
      0.06 * this.scale,
      0.015 * this.scale
    );
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
      finger.position.set(
        -0.03 * this.scale + i * 0.02 * this.scale,
        -0.43 * this.scale,
        0
      );
      finger.castShadow = true;
      elbow.add(finger);
    }
    
    // 拇指
    const thumb = new THREE.Mesh(fingerGeometry, skinMaterial);
    thumb.position.set(
      (isLeft ? -0.05 : 0.05) * this.scale,
      -0.36 * this.scale,
      0.02 * this.scale
    );
    thumb.rotation.z = (isLeft ? 0.5 : -0.5);
    thumb.castShadow = true;
    elbow.add(thumb);
    
    return { shoulder, elbow };
  }

  private createDetailedLeg(_isLeft: boolean): { hip: THREE.Group; knee: THREE.Group } {
    const hip = new THREE.Group();
    
    const skinMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffdbac,
      shininess: 30
    });
    
    const pantsMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2c3e50,
      shininess: 40
    });
    
    const shoeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1a252f,
      shininess: 80
    });
    
    // 髋关节
    const hipJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.09 * this.scale, 16, 16),
      pantsMaterial
    );
    hipJoint.castShadow = true;
    hip.add(hipJoint);
    
    // 大腿 - 裤子
    const thighGeometry = new THREE.CylinderGeometry(
      0.095 * this.scale,
      0.08 * this.scale,
      0.4 * this.scale,
      16
    );
    const thigh = new THREE.Mesh(thighGeometry, pantsMaterial);
    thigh.position.y = -0.2 * this.scale;
    thigh.castShadow = true;
    hip.add(thigh);
    
    // 膝盖关节
    const kneeJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 * this.scale, 16, 16),
      pantsMaterial
    );
    kneeJoint.position.y = -0.4 * this.scale;
    kneeJoint.castShadow = true;
    hip.add(kneeJoint);
    
    const knee = new THREE.Group();
    knee.position.y = -0.4 * this.scale;
    hip.add(knee);
    
    // 小腿 - 裤子
    const calfGeometry = new THREE.CylinderGeometry(
      0.075 * this.scale,
      0.065 * this.scale,
      0.4 * this.scale,
      16
    );
    const calf = new THREE.Mesh(calfGeometry, pantsMaterial);
    calf.position.y = -0.2 * this.scale;
    calf.castShadow = true;
    knee.add(calf);
    
    // 脚踝
    const ankle = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 * this.scale, 16, 16),
      skinMaterial
    );
    ankle.position.y = -0.4 * this.scale;
    ankle.castShadow = true;
    knee.add(ankle);
    
    // 鞋子主体
    const shoeGeometry = new THREE.BoxGeometry(
      0.12 * this.scale,
      0.08 * this.scale,
      0.24 * this.scale
    );
    const shoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    shoe.position.set(0, -0.46 * this.scale, 0.04 * this.scale);
    shoe.castShadow = true;
    knee.add(shoe);
    
    // 鞋底
    const soleGeometry = new THREE.BoxGeometry(
      0.13 * this.scale,
      0.025 * this.scale,
      0.26 * this.scale
    );
    const soleMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x000000,
      shininess: 90
    });
    const sole = new THREE.Mesh(soleGeometry, soleMaterial);
    sole.position.set(0, -0.5025 * this.scale, 0.04 * this.scale);
    sole.castShadow = true;
    knee.add(sole);
    
    // 鞋头装饰
    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 * this.scale, 16, 16),
      soleMaterial
    );
    toeCap.scale.set(1, 0.5, 1.5);
    toeCap.position.set(0, -0.44 * this.scale, 0.14 * this.scale);
    toeCap.castShadow = true;
    knee.add(toeCap);
    
    return { hip, knee };
  }
}

