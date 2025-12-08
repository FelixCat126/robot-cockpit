/**
 * 输入映射器
 * 将外设输入事件映射为机器人控制命令
 */

import {
  InputEvent,
  InputEventType,
  InputMappingRule,
  RobotCommand,
  RobotCommandType,
} from '../../types/peripheral.types';

export class InputMapper {
  private rules: Map<string, InputMappingRule> = new Map();
  private commandCallback: ((command: RobotCommand) => void) | null = null;

  /**
   * 添加映射规则
   */
  addRule(rule: InputMappingRule): void {
    if (rule.enabled === undefined) {
      rule.enabled = true;
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * 移除映射规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): InputMappingRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 清空所有规则
   */
  clearRules(): void {
    this.rules.clear();
  }

  /**
   * 设置命令回调
   */
  setCommandCallback(callback: (command: RobotCommand) => void): void {
    this.commandCallback = callback;
  }

  /**
   * 处理输入事件
   */
  processInput(event: InputEvent): void {
    // 遍历所有规则，找到匹配的
    this.rules.forEach(rule => {
      if (!rule.enabled) {
        return;
      }

      if (this.matchesTrigger(event, rule)) {
        // 生成命令
        const command = this.generateCommand(event, rule);
        
        if (command && this.commandCallback) {
          this.commandCallback(command);
        }
      }
    });
  }

  /**
   * 检查事件是否匹配触发条件
   */
  private matchesTrigger(event: InputEvent, rule: InputMappingRule): boolean {
    const trigger = rule.trigger;

    // 检查事件类型
    if (trigger.type !== event.type) {
      return false;
    }

    // 检查设备类型（可选）
    if (trigger.deviceType && trigger.deviceType !== event.deviceType) {
      return false;
    }

    // 根据事件类型检查具体条件
    switch (event.type) {
      case InputEventType.AXIS_CHANGE:
        if (trigger.axisIndex !== undefined && event.axis) {
          if (trigger.axisIndex !== event.axis.index) {
            return false;
          }
          // 检查阈值
          if (trigger.threshold !== undefined) {
            return Math.abs(event.axis.value) >= trigger.threshold;
          }
        }
        return true;

      case InputEventType.BUTTON_DOWN:
      case InputEventType.BUTTON_UP:
        if (trigger.buttonIndex !== undefined && event.button) {
          return trigger.buttonIndex === event.button.index;
        }
        return true;

      case InputEventType.KEY_DOWN:
      case InputEventType.KEY_UP:
        if (trigger.key !== undefined && event.key) {
          return trigger.key === event.key;
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * 生成机器人命令
   */
  private generateCommand(event: InputEvent, rule: InputMappingRule): RobotCommand | null {
    if (typeof rule.command === 'function') {
      // 动态命令生成
      try {
        return rule.command(event);
      } catch (error) {
        console.error(`[InputMapper] 命令生成失败: ${rule.name}`, error);
        return null;
      }
    } else {
      // 静态命令
      return rule.command;
    }
  }
}

/**
 * 创建默认的输入映射配置
 */
export function createDefaultInputMapping(): InputMapper {
  const mapper = new InputMapper();

  // ===== 摇杆控制机器人移动 =====
  mapper.addRule({
    id: 'joystick-move',
    name: '摇杆控制移动',
    description: '左摇杆控制机器人前后左右移动和转向',
    trigger: {
      type: InputEventType.AXIS_CHANGE,
    },
    command: (event: InputEvent) => {
      // 需要获取当前所有轴的状态
      // 这里简化处理，实际应该从设备状态获取
      const axisValue = event.axis?.value || 0;
      const axisIndex = event.axis?.index || 0;

      let linearX = 0;
      let angularZ = 0;

      // 左摇杆Y轴 → 前后移动
      if (axisIndex === 1) {
        linearX = -axisValue * 0.5; // 前后速度（反向）
      }

      // 左摇杆X轴 → 转向
      if (axisIndex === 0) {
        angularZ = axisValue * 1.0; // 转向速度
      }

      return {
        type: RobotCommandType.VELOCITY,
        topic: '/cmd_vel',
        messageType: 'geometry_msgs/Twist',
        payload: {
          linear: { x: linearX, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: angularZ },
        },
        priority: 5,
      };
    },
  });

  // ===== 按钮A：挥手 =====
  mapper.addRule({
    id: 'button-a-wave',
    name: 'A按钮挥手',
    description: '按下A按钮机器人挥手',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 0,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'Wave' },
      priority: 8,
    },
  });

  // ===== 按钮B：点赞 =====
  mapper.addRule({
    id: 'button-b-thumbs-up',
    name: 'B按钮点赞',
    description: '按下B按钮机器人点赞',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 1,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'ThumbsUp' },
      priority: 8,
    },
  });
  
  // ===== 按钮C：跨栏 =====
  mapper.addRule({
    id: 'button-c-walk-jump',
    name: 'C按钮跨栏',
    description: '按下C按钮机器人跨栏',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 2,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'WalkJump' },
      priority: 8,
    },
  });
  
  // ===== 按钮D：跳跃 =====
  mapper.addRule({
    id: 'button-d-jump',
    name: 'D按钮跳跃',
    description: '按下D按钮机器人跳跃',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 3,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'Jump' },
      priority: 8,
    },
  });

  // ===== LB按钮（button 4）：左转 =====
  mapper.addRule({
    id: 'button-lb-turn-left',
    name: 'LB按钮左转',
    description: '按下LB按钮机器人左转',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 4,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'left' },
      priority: 8,
    },
  });

  // ===== RB按钮（button 5）：右转 =====
  mapper.addRule({
    id: 'button-rb-turn-right',
    name: 'RB按钮右转',
    description: '按下RB按钮机器人右转',
    trigger: {
      type: InputEventType.BUTTON_DOWN,
      buttonIndex: 5,
    },
    command: {
      type: RobotCommandType.ACTION,
      topic: '/robot/action',
      messageType: 'std_msgs/String',
      payload: { data: 'right' },
      priority: 8,
    },
  });

  // ===== 键盘W：前进 =====
  mapper.addRule({
    id: 'key-w-forward',
    name: 'W键前进',
    description: '按下W键机器人前进',
    trigger: {
      type: InputEventType.KEY_DOWN,
      key: 'w',
    },
    command: {
      type: RobotCommandType.VELOCITY,
      topic: '/cmd_vel',
      messageType: 'geometry_msgs/Twist',
      payload: {
        linear: { x: 0.5, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      },
      priority: 5,
    },
  });

  // ===== 键盘S：后退 =====
  mapper.addRule({
    id: 'key-s-backward',
    name: 'S键后退',
    description: '按下S键机器人后退',
    trigger: {
      type: InputEventType.KEY_DOWN,
      key: 's',
    },
    command: {
      type: RobotCommandType.VELOCITY,
      topic: '/cmd_vel',
      messageType: 'geometry_msgs/Twist',
      payload: {
        linear: { x: -0.5, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      },
      priority: 5,
    },
  });

  // ===== 键盘A：左转 =====
  mapper.addRule({
    id: 'key-a-left',
    name: 'A键左转',
    description: '按下A键机器人左转',
    trigger: {
      type: InputEventType.KEY_DOWN,
      key: 'a',
    },
    command: {
      type: RobotCommandType.VELOCITY,
      topic: '/cmd_vel',
      messageType: 'geometry_msgs/Twist',
      payload: {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0.5 },
      },
      priority: 5,
    },
  });

  // ===== 键盘D：右转 =====
  mapper.addRule({
    id: 'key-d-right',
    name: 'D键右转',
    description: '按下D键机器人右转',
    trigger: {
      type: InputEventType.KEY_DOWN,
      key: 'd',
    },
    command: {
      type: RobotCommandType.VELOCITY,
      topic: '/cmd_vel',
      messageType: 'geometry_msgs/Twist',
      payload: {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: -0.5 },
      },
      priority: 5,
    },
  });

  // ===== 键盘松开：停止 =====
  const stopCommand = {
    type: RobotCommandType.VELOCITY,
    topic: '/cmd_vel',
    messageType: 'geometry_msgs/Twist',
    payload: {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    },
    priority: 5,
  };

  ['w', 's', 'a', 'd'].forEach(key => {
    mapper.addRule({
      id: `key-${key}-stop`,
      name: `${key.toUpperCase()}键松开停止`,
      description: `松开${key.toUpperCase()}键停止移动`,
      trigger: {
        type: InputEventType.KEY_UP,
        key,
      },
      command: stopCommand,
    });
  });

  // ===== 键盘空格：急停 =====
  mapper.addRule({
    id: 'key-space-emergency',
    name: '空格键急停',
    description: '按下空格键触发急停',
    trigger: {
      type: InputEventType.KEY_DOWN,
      key: ' ',
    },
    command: {
      type: RobotCommandType.EMERGENCY_STOP,
      topic: '/emergency_stop',
      messageType: 'std_msgs/Bool',
      payload: { data: true },
      priority: 10,
    },
  });

  return mapper;
}

