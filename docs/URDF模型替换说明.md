# URDF模型替换说明

**日期**: 2024-12-09  
**版本**: v1.0

## 📋 更新概述

成功将3D机器人模型替换为**宇树（Unitree）G1人形机器人**的完整URDF模型，包含所有STL mesh文件。

## ✅ 完成的工作

### 1. 下载宇树G1机器人模型文件

从官方GitHub仓库下载了完整的模型文件：
- **来源**: [unitreerobotics/unitree_ros](https://github.com/unitreerobotics/unitree_ros/tree/master/robots/g1_description)
- **URDF文件**: `g1_29dof_rev_1_0.urdf` (34KB)
- **STL mesh文件**: 35个部件文件 (约20MB)

**文件位置**:
```
frontend/public/models/g1_robot/
├── g1_29dof_rev_1_0.urdf        # 主URDF文件
├── g1_29dof_rev_1_0_old.urdf    # 备份的旧版本
├── files.json                    # 文件清单
└── meshes/                       # STL mesh文件目录
    ├── pelvis.STL
    ├── torso_link_rev_1_0.STL
    ├── head_link.STL
    ├── left_hip_pitch_link.STL
    ├── right_hip_pitch_link.STL
    └── ... (共35个STL文件)
```

### 2. 更新URDFLoader.ts

**新增功能**:
- ✅ 导入Three.js STLLoader
- ✅ 支持异步加载STL mesh文件
- ✅ 并行加载多个mesh文件（提高性能）
- ✅ 自动计算STL法线
- ✅ 错误处理和降级机制（mesh加载失败时使用简单几何体）

**关键代码**:
```typescript
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export class URDFLoader {
  private stlLoader: STLLoader;
  private baseUrl: string;
  
  async load(url: string): Promise<THREE.Group>
  private async buildRobotModel(robot: URDFRobot): Promise<THREE.Group>
  private async createLinkMesh(link: URDFLink): Promise<THREE.Mesh | null>
  private loadSTL(url: string): Promise<THREE.BufferGeometry>
}
```

### 3. 更新Robot3DViewer.tsx

**修改内容**:
- 更新URDFLoader初始化，传入正确的baseUrl
- 调整机器人缩放比例（改为1:1原始比例）
- 调整机器人位置（Y轴设为0.7，让机器人站在地面上）
- 添加详细的日志输出
- 优化错误提示信息

**关键代码**:
```typescript
const urdfLoader = new URDFLoader('/models/g1_robot');

urdfLoader.load('/models/g1_robot/g1_29dof_rev_1_0.urdf')
  .then((robotModel) => {
    robotModel.scale.set(1, 1, 1);      // 原始比例
    robotModel.position.set(0, 0.7, 0); // 站在地面上
    scene.add(robotModel);
  });
```

### 4. 更新文档

更新了 `docs/3D机器人可视化说明.md`:
- 添加宇树G1机器人模型信息
- 添加URDFLoader架构说明
- 更新关节系统说明（29自由度）
- 标记URDF支持功能为已完成

### 5. 创建配置文件

创建 `files.json` 记录模型信息:
```json
{
  "robot": {
    "name": "Unitree G1 Robot",
    "version": "29DOF Rev 1.0",
    "urdf": "g1_29dof_rev_1_0.urdf",
    "source": "https://github.com/..."
  },
  "meshes": [...35个mesh文件路径...],
  "stats": {
    "totalMeshFiles": 35,
    "totalSize": "~20MB"
  }
}
```

## 🤖 宇树G1机器人规格

### 基本参数
- **名称**: Unitree G1
- **型号**: 29DOF Rev 1.0
- **高度**: 约1.27米
- **自由度**: 29个关节

### 关节分布
| 部位 | 关节数 | 说明 |
|------|--------|------|
| 左腿 | 6 | 髋关节(pitch/roll/yaw) + 膝关节 + 踝关节(pitch/roll) |
| 右腿 | 6 | 同左腿 |
| 躯干 | 2 | 腰部(roll/yaw) |
| 左臂 | 7 | 肩部(pitch/roll/yaw) + 肘部 + 腕部(pitch/roll/yaw) |
| 右臂 | 7 | 同左臂 |
| 头部 | 1 | 头部转动 |
| **总计** | **29** | |

### Mesh文件统计
```
35个STL文件:
- 躯干部分: 5个 (pelvis, torso, waist等)
- 腿部: 12个 (左右各6个)
- 手臂: 16个 (左右各8个)
- 头部: 2个 (head, logo)
```

## 🔧 技术细节

### STL文件加载流程
```
1. Robot3DViewer初始化
   ↓
2. URDFLoader.load('/models/g1_robot/g1_29dof_rev_1_0.urdf')
   ↓
3. 解析URDF XML文件
   ↓
4. 并行加载所有35个STL文件
   ├─ STLLoader.load('meshes/pelvis.STL')
   ├─ STLLoader.load('meshes/torso_link_rev_1_0.STL')
   └─ ... (共35个)
   ↓
5. 构建Three.js场景图（关节层级结构）
   ↓
6. 渲染完整的3D机器人模型
```

### 性能优化
- ✅ 使用`Promise.all`并行加载多个STL文件
- ✅ STL几何体自动计算顶点法线
- ✅ 使用MeshStandardMaterial实现PBR渲染
- ✅ 错误处理：加载失败时降级为简单几何体

## 📊 编译结果

```bash
✓ TypeScript编译通过
✓ Vite构建成功
✓ 生成文件: dist/index.html (464B)
✓ 生成文件: dist/assets/index-Dh6sweWw.js (835KB)
```

## 🚀 如何使用

### 开发模式
```bash
npm run dev
```
访问 `http://localhost:5173` 查看3D机器人

### 生产模式
```bash
npm run build
npm start
```

### 验证加载
打开浏览器控制台，应该看到：
```
[Robot3DViewer] 开始加载宇树G1机器人URDF模型...
[URDFLoader] 加载mesh: /models/g1_robot/meshes/pelvis.STL
[URDFLoader] 加载mesh: /models/g1_robot/meshes/torso_link_rev_1_0.STL
...
[Robot3DViewer] URDF模型加载成功，包含STL mesh
[Robot3DViewer] 关节数量: 29
[Robot3DViewer] 关节状态管理器初始化成功
```

## 🔍 故障排查

### 问题1: mesh文件加载失败
**现象**: 控制台显示 `无法加载mesh文件`  
**原因**: mesh文件路径错误或文件不存在  
**解决**: 
1. 检查 `frontend/public/models/g1_robot/meshes/` 目录是否包含35个STL文件
2. 检查文件权限
3. 查看浏览器Network标签，确认文件是否正确请求

### 问题2: 机器人模型不显示
**现象**: 3D场景空白  
**原因**: URDF文件解析失败  
**解决**:
1. 检查URDF文件路径: `/models/g1_robot/g1_29dof_rev_1_0.urdf`
2. 查看控制台错误信息
3. 验证WebGL支持: 访问 `https://get.webgl.org/`

### 问题3: 机器人位置不正确
**现象**: 机器人悬空或陷入地面  
**原因**: 位置/缩放参数不合适  
**解决**: 调整Robot3DViewer中的位置参数:
```typescript
robotModel.position.set(0, 0.7, 0); // 调整Y值
robotModel.scale.set(1, 1, 1);      // 调整缩放
```

## 📝 文件清单

### 新增文件
- `frontend/src/utils/URDFLoader.ts` - URDF加载器
- `frontend/public/models/g1_robot/g1_29dof_rev_1_0.urdf` - URDF文件
- `frontend/public/models/g1_robot/meshes/*.STL` - 35个STL文件
- `frontend/public/models/g1_robot/files.json` - 配置文件
- `docs/URDF模型替换说明.md` - 本文档

### 修改文件
- `frontend/src/components/shared/Robot3DViewer.tsx` - 更新模型加载逻辑
- `docs/3D机器人可视化说明.md` - 更新文档

### 备份文件
- `frontend/public/models/g1_robot/g1_29dof_rev_1_0_old.urdf` - 旧版URDF

## 🎯 下一步工作

### 短期目标
- [ ] 实现关节状态实时同步（订阅ROS `/joint_states`话题）
- [ ] 添加关节角度可视化指示器
- [ ] 优化mesh加载性能（考虑使用压缩格式）

### 长期目标
- [ ] 支持多机器人模型切换
- [ ] 添加模型编辑功能
- [ ] 实现IK（逆运动学）可视化
- [ ] 支持自定义URDF上传

## 📚 参考资源

- [宇树科技官网](https://www.unitree.com/)
- [unitree_ros GitHub仓库](https://github.com/unitreerobotics/unitree_ros)
- [Three.js文档](https://threejs.org/docs/)
- [URDF规范](http://wiki.ros.org/urdf/XML)
- [STLLoader文档](https://threejs.org/docs/#examples/en/loaders/STLLoader)

## 💡 技术亮点

1. **异步并行加载**: 使用`Promise.all`并行加载35个STL文件，大幅提升加载速度
2. **错误降级**: mesh加载失败时自动使用简单几何体替代，确保系统稳定性
3. **类型安全**: 完整的TypeScript类型定义，避免运行时错误
4. **模块化设计**: URDFLoader独立模块，易于测试和维护
5. **性能优化**: STL几何体自动计算法线，PBR材质渲染

---

**完成时间**: 2024-12-09  
**作者**: Robot Cockpit Team  
**状态**: ✅ 已完成并测试通过
