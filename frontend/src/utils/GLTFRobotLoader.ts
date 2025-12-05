/**
 * GLTFRobotLoader - 加载Three.js官方机器人模型
 * 使用RobotExpressive模型
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface GLTFRobotModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer;
}

export class GLTFRobotLoader {
  private loader: GLTFLoader;
  
  constructor() {
    this.loader = new GLTFLoader();
  }
  
  /**
   * 加载官方RobotExpressive模型
   */
  async load(): Promise<GLTFRobotModel> {
    // Three.js官方CDN上的RobotExpressive模型
    const modelUrl = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
    
    return new Promise((resolve, reject) => {
      this.loader.load(
        modelUrl,
        (gltf: any) => {
          console.log('[GLTFRobotLoader] 模型加载成功');
          console.log('[GLTFRobotLoader] 动画数量:', gltf.animations.length);
          
          // 创建动画混合器
          const mixer = new THREE.AnimationMixer(gltf.scene);
          
          // 调整模型大小和位置
          gltf.scene.scale.set(0.5, 0.5, 0.5);  // 缩小到0.5倍
          gltf.scene.position.y = 0;
          
          // 启用阴影
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          resolve({
            scene: gltf.scene,
            animations: gltf.animations,
            mixer: mixer,
          });
        },
        (progress: any) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`[GLTFRobotLoader] 加载进度: ${percent.toFixed(1)}%`);
        },
        (error: any) => {
          console.error('[GLTFRobotLoader] 模型加载失败:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * 播放指定动画
   */
  playAnimation(
    mixer: THREE.AnimationMixer,
    animations: THREE.AnimationClip[],
    animationName: string,
    loop: boolean = true
  ): THREE.AnimationAction | null {
    const clip = animations.find(clip => clip.name === animationName);
    
    if (!clip) {
      console.warn(`[GLTFRobotLoader] 未找到动画: ${animationName}`);
      console.log('[GLTFRobotLoader] 可用动画:', animations.map(a => a.name));
      return null;
    }
    
    const action = mixer.clipAction(clip);
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    action.play();
    
    console.log(`[GLTFRobotLoader] 播放动画: ${animationName}`);
    return action;
  }
  
  /**
   * 停止所有动画
   */
  stopAllAnimations(mixer: THREE.AnimationMixer): void {
    mixer.stopAllAction();
  }
  
  /**
   * 获取所有可用动画名称
   */
  getAnimationNames(animations: THREE.AnimationClip[]): string[] {
    return animations.map(clip => clip.name);
  }
}

