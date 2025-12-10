import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

/**
 * URDF 加载器
 * 负责解析 URDF 文件并构建 Three.js 3D 模型（支持STL mesh文件加载）
 */

interface URDFJoint {
  name: string;
  type: 'revolute' | 'continuous' | 'prismatic' | 'fixed' | 'floating' | 'planar';
  parent: string;
  child: string;
  origin: {
    xyz: THREE.Vector3;
    rpy: THREE.Euler;
  };
  axis: THREE.Vector3;
  limit?: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  };
}

interface URDFLink {
  name: string;
  visual?: {
    origin: {
      xyz: THREE.Vector3;
      rpy: THREE.Euler;
    };
    geometry: {
      type: 'box' | 'cylinder' | 'sphere' | 'mesh';
      size?: THREE.Vector3; // for box
      radius?: number; // for cylinder/sphere
      length?: number; // for cylinder
      filename?: string; // for mesh
    };
    material?: {
      name: string;
      color: THREE.Color;
    };
  };
  inertial?: {
    mass: number;
    origin: {
      xyz: THREE.Vector3;
      rpy: THREE.Euler;
    };
  };
}

interface URDFRobot {
  name: string;
  links: Map<string, URDFLink>;
  joints: Map<string, URDFJoint>;
  rootLink: string;
}

export class URDFLoader {
  private parser: DOMParser;
  private stlLoader: STLLoader;
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.parser = new DOMParser();
    this.stlLoader = new STLLoader();
    this.baseUrl = baseUrl;
  }

  /**
   * 从 URL 加载 URDF 文件
   */
  async load(url: string): Promise<THREE.Group> {
    const response = await fetch(url);
    const urdfText = await response.text();
    
    // 从URL中提取基础路径
    const urlParts = url.split('/');
    urlParts.pop(); // 移除文件名
    this.baseUrl = urlParts.join('/');
    
    return this.parse(urdfText);
  }

  /**
   * 解析 URDF XML 并构建 Three.js 模型
   */
  async parse(urdfText: string): Promise<THREE.Group> {
    const xmlDoc = this.parser.parseFromString(urdfText, 'text/xml');
    const robotElement = xmlDoc.querySelector('robot');

    if (!robotElement) {
      throw new Error('Invalid URDF: No robot element found');
    }

    const robot = this.parseRobot(robotElement);
    return this.buildRobotModel(robot);
  }

  /**
   * 解析 robot 元素
   */
  private parseRobot(robotElement: Element): URDFRobot {
    const name = robotElement.getAttribute('name') || 'robot';
    const links = new Map<string, URDFLink>();
    const joints = new Map<string, URDFJoint>();

    // 解析所有 link
    robotElement.querySelectorAll('link').forEach((linkElement) => {
      const link = this.parseLink(linkElement);
      links.set(link.name, link);
    });

    // 解析所有 joint
    robotElement.querySelectorAll('joint').forEach((jointElement) => {
      const joint = this.parseJoint(jointElement);
      joints.set(joint.name, joint);
    });

    // 找到根 link（没有父 joint 的 link）
    const childLinks = new Set<string>();
    joints.forEach((joint) => {
      childLinks.add(joint.child);
    });

    let rootLink = '';
    links.forEach((_link, name) => {
      if (!childLinks.has(name)) {
        rootLink = name;
      }
    });

    return { name, links, joints, rootLink };
  }

  /**
   * 解析 link 元素
   */
  private parseLink(linkElement: Element): URDFLink {
    const name = linkElement.getAttribute('name') || '';
    const link: URDFLink = { name };

    // 解析 visual
    const visualElement = linkElement.querySelector('visual');
    if (visualElement) {
      const origin = this.parseOrigin(visualElement.querySelector('origin'));
      const geometry = this.parseGeometry(visualElement.querySelector('geometry'));
      const material = this.parseMaterial(visualElement.querySelector('material'));

      link.visual = { origin, geometry, material };
    }

    // 解析 inertial
    const inertialElement = linkElement.querySelector('inertial');
    if (inertialElement) {
      const massElement = inertialElement.querySelector('mass');
      const mass = massElement ? parseFloat(massElement.getAttribute('value') || '1') : 1;
      const origin = this.parseOrigin(inertialElement.querySelector('origin'));
      link.inertial = { mass, origin };
    }

    return link;
  }

  /**
   * 解析 joint 元素
   */
  private parseJoint(jointElement: Element): URDFJoint {
    const name = jointElement.getAttribute('name') || '';
    const type = (jointElement.getAttribute('type') || 'fixed') as URDFJoint['type'];

    const parentElement = jointElement.querySelector('parent');
    const childElement = jointElement.querySelector('child');
    const parent = parentElement?.getAttribute('link') || '';
    const child = childElement?.getAttribute('link') || '';

    const origin = this.parseOrigin(jointElement.querySelector('origin'));
    const axis = this.parseAxis(jointElement.querySelector('axis'));

    const joint: URDFJoint = { name, type, parent, child, origin, axis };

    // 解析 limit（对于 revolute 和 prismatic joint）
    const limitElement = jointElement.querySelector('limit');
    if (limitElement && (type === 'revolute' || type === 'prismatic')) {
      joint.limit = {
        lower: parseFloat(limitElement.getAttribute('lower') || '-3.14'),
        upper: parseFloat(limitElement.getAttribute('upper') || '3.14'),
        effort: parseFloat(limitElement.getAttribute('effort') || '100'),
        velocity: parseFloat(limitElement.getAttribute('velocity') || '1'),
      };
    }

    return joint;
  }

  /**
   * 解析 origin 元素
   */
  private parseOrigin(originElement: Element | null): {
    xyz: THREE.Vector3;
    rpy: THREE.Euler;
  } {
    if (!originElement) {
      return {
        xyz: new THREE.Vector3(0, 0, 0),
        rpy: new THREE.Euler(0, 0, 0, 'XYZ'),
      };
    }

    const xyzStr = originElement.getAttribute('xyz') || '0 0 0';
    const rpyStr = originElement.getAttribute('rpy') || '0 0 0';

    const xyz = xyzStr.split(/\s+/).map(parseFloat);
    const rpy = rpyStr.split(/\s+/).map(parseFloat);

    return {
      xyz: new THREE.Vector3(xyz[0], xyz[1], xyz[2]),
      rpy: new THREE.Euler(rpy[0], rpy[1], rpy[2], 'XYZ'),
    };
  }

  /**
   * 解析 axis 元素
   */
  private parseAxis(axisElement: Element | null): THREE.Vector3 {
    if (!axisElement) {
      return new THREE.Vector3(1, 0, 0);
    }

    const xyzStr = axisElement.getAttribute('xyz') || '1 0 0';
    const xyz = xyzStr.split(/\s+/).map(parseFloat);
    return new THREE.Vector3(xyz[0], xyz[1], xyz[2]);
  }

  /**
   * 解析 geometry 元素
   */
  private parseGeometry(geometryElement: Element | null): NonNullable<URDFLink['visual']>['geometry'] {
    if (!geometryElement) {
      return { type: 'box', size: new THREE.Vector3(0.1, 0.1, 0.1) };
    }

    const boxElement = geometryElement.querySelector('box');
    if (boxElement) {
      const sizeStr = boxElement.getAttribute('size') || '0.1 0.1 0.1';
      const size = sizeStr.split(/\s+/).map(parseFloat);
      return { type: 'box', size: new THREE.Vector3(size[0], size[1], size[2]) };
    }

    const cylinderElement = geometryElement.querySelector('cylinder');
    if (cylinderElement) {
      return {
        type: 'cylinder',
        radius: parseFloat(cylinderElement.getAttribute('radius') || '0.05'),
        length: parseFloat(cylinderElement.getAttribute('length') || '0.1'),
      };
    }

    const sphereElement = geometryElement.querySelector('sphere');
    if (sphereElement) {
      return {
        type: 'sphere',
        radius: parseFloat(sphereElement.getAttribute('radius') || '0.05'),
      };
    }

    const meshElement = geometryElement.querySelector('mesh');
    if (meshElement) {
      return {
        type: 'mesh',
        filename: meshElement.getAttribute('filename') || '',
      };
    }

    return { type: 'box', size: new THREE.Vector3(0.1, 0.1, 0.1) };
  }

  /**
   * 解析 material 元素
   */
  private parseMaterial(materialElement: Element | null): NonNullable<URDFLink['visual']>['material'] {
    if (!materialElement) {
      return { name: 'default', color: new THREE.Color(0.7, 0.7, 0.7) };
    }

    const name = materialElement.getAttribute('name') || 'default';
    const colorElement = materialElement.querySelector('color');

    if (colorElement) {
      const rgbaStr = colorElement.getAttribute('rgba') || '0.7 0.7 0.7 1';
      const rgba = rgbaStr.split(/\s+/).map(parseFloat);
      return { name, color: new THREE.Color(rgba[0], rgba[1], rgba[2]) };
    }

    return { name, color: new THREE.Color(0.7, 0.7, 0.7) };
  }

  /**
   * 构建 Three.js 机器人模型
   */
  private async buildRobotModel(robot: URDFRobot): Promise<THREE.Group> {
    const rootGroup = new THREE.Group();
    rootGroup.name = robot.name;

    // 创建所有 link 的 3D 对象
    const linkObjects = new Map<string, THREE.Group>();

    // 使用 Promise.all 并行加载所有 mesh
    const linkPromises = Array.from(robot.links.entries()).map(async ([linkName, link]) => {
      const linkGroup = new THREE.Group();
      linkGroup.name = linkName;

      // 如果有 visual，创建几何体
      if (link.visual) {
        const mesh = await this.createLinkMesh(link);
        if (mesh) {
          // 应用 visual origin
          mesh.position.copy(link.visual.origin.xyz);
          mesh.rotation.copy(link.visual.origin.rpy);
          linkGroup.add(mesh);
        }
      }

      return [linkName, linkGroup] as const;
    });

    const links = await Promise.all(linkPromises);
    links.forEach(([linkName, linkGroup]) => {
      linkObjects.set(linkName, linkGroup);
    });

    // 根据 joint 关系构建层级结构
    const addedLinks = new Set<string>();

    const addLinkRecursive = (linkName: string, parent: THREE.Group) => {
      if (addedLinks.has(linkName)) return;
      addedLinks.add(linkName);

      const linkGroup = linkObjects.get(linkName);
      if (!linkGroup) return;

      parent.add(linkGroup);

      // 找到所有以当前 link 为父的 joint
      robot.joints.forEach((joint, jointName) => {
        if (joint.parent === linkName) {
          // 创建 joint 对象
          const jointGroup = new THREE.Group();
          jointGroup.name = jointName;

          // 应用 joint origin
          jointGroup.position.copy(joint.origin.xyz);
          jointGroup.rotation.copy(joint.origin.rpy);

          // 存储 joint 信息用于后续动画
          (jointGroup as any).jointType = joint.type;
          (jointGroup as any).jointAxis = joint.axis;
          (jointGroup as any).jointLimit = joint.limit;

          linkGroup.add(jointGroup);

          // 递归添加子 link
          addLinkRecursive(joint.child, jointGroup);
        }
      });
    };

    // 从根 link 开始构建
    if (robot.rootLink) {
      addLinkRecursive(robot.rootLink, rootGroup);
    }

    return rootGroup;
  }

  /**
   * 为 link 创建 mesh
   */
  private async createLinkMesh(link: URDFLink): Promise<THREE.Mesh | null> {
    if (!link.visual) return null;

    const geometry = link.visual.geometry;
    let threeGeometry: THREE.BufferGeometry | null = null;

    switch (geometry.type) {
      case 'box':
        if (geometry.size) {
          threeGeometry = new THREE.BoxGeometry(
            geometry.size.x,
            geometry.size.y,
            geometry.size.z
          );
        }
        break;

      case 'cylinder':
        if (geometry.radius !== undefined && geometry.length !== undefined) {
          threeGeometry = new THREE.CylinderGeometry(
            geometry.radius,
            geometry.radius,
            geometry.length,
            16
          );
          // URDF cylinder 是沿 Z 轴，Three.js 是沿 Y 轴，需要旋转
          threeGeometry.rotateX(Math.PI / 2);
        }
        break;

      case 'sphere':
        if (geometry.radius !== undefined) {
          threeGeometry = new THREE.SphereGeometry(geometry.radius, 16, 16);
        }
        break;

      case 'mesh':
        // 加载 STL mesh 文件
        if (geometry.filename) {
          try {
            // 处理相对路径和绝对路径
            let meshUrl = geometry.filename;
            if (!meshUrl.startsWith('http') && !meshUrl.startsWith('/')) {
              meshUrl = `${this.baseUrl}/${geometry.filename}`;
            } else if (meshUrl.startsWith('/')) {
              meshUrl = meshUrl; // 已经是绝对路径
            }
            
            // 检查是否是足部相关mesh
            const isFootMesh = geometry.filename.toLowerCase().includes('ankle') || 
                              geometry.filename.toLowerCase().includes('foot');
            
            if (isFootMesh) {
              console.log(`[URDFLoader] 🔍 检测到足部mesh: ${geometry.filename}, 完整URL: ${meshUrl}`);
            }
            
            console.log(`[URDFLoader] 加载mesh: ${meshUrl} (link: ${link.name})`);
            threeGeometry = await this.loadSTL(meshUrl);
            
            if (isFootMesh) {
              console.log(`[URDFLoader] ✅ 足部mesh加载成功: ${geometry.filename}`);
            }
          } catch (error) {
            const isFootMesh = geometry.filename.toLowerCase().includes('ankle') || 
                              geometry.filename.toLowerCase().includes('foot');
            if (isFootMesh) {
              console.error(`[URDFLoader] ❌ 足部mesh加载失败 ${geometry.filename}:`, error);
            } else {
              console.warn(`[URDFLoader] 无法加载mesh文件 ${geometry.filename}:`, error);
            }
            // 降级为小盒子
            threeGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
          }
        }
        break;
    }

    if (!threeGeometry) return null;

    const color = link.visual.material?.color || new THREE.Color(0.7, 0.7, 0.7);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });

    return new THREE.Mesh(threeGeometry, material);
  }

  /**
   * 加载 STL 文件
   */
  private loadSTL(url: string): Promise<THREE.BufferGeometry> {
    return new Promise((resolve, reject) => {
      this.stlLoader.load(
        url,
        (geometry: THREE.BufferGeometry) => {
          // STL 文件通常需要计算法线
          geometry.computeVertexNormals();
          resolve(geometry);
        },
        undefined,
        (error: unknown) => {
          reject(error);
        }
      );
    });
  }

  /**
   * 获取所有关节的映射（用于动画控制）
   */
  static getJointMap(robotGroup: THREE.Group): Map<string, THREE.Group> {
    const jointMap = new Map<string, THREE.Group>();

    robotGroup.traverse((object) => {
      if (object instanceof THREE.Group && (object as any).jointType) {
        jointMap.set(object.name, object);
      }
    });

    return jointMap;
  }

  /**
   * 设置关节角度
   */
  static setJointAngle(joint: THREE.Group, angle: number) {
    const jointType = (joint as any).jointType;
    const jointAxis = (joint as any).jointAxis as THREE.Vector3;

    if (jointType === 'revolute' || jointType === 'continuous') {
      // 旋转关节
      const rotationAxis = jointAxis.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
      joint.quaternion.copy(quaternion);
    } else if (jointType === 'prismatic') {
      // 平移关节
      const translation = jointAxis.clone().multiplyScalar(angle);
      joint.position.copy(translation);
    }
  }
}

export default URDFLoader;

