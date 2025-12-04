/**
 * 控制按钮图标组件
 * 使用 SVG 设计的专业图标集
 */

import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

// 启动图标
export const PlayIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <path d="M10 8L16 12L10 16V8Z" fill={color} />
  </svg>
);

// 停止图标
export const StopIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <rect x="8" y="8" width="8" height="8" fill={color} rx="1" />
  </svg>
);

// 暂停图标
export const PauseIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <rect x="9" y="7" width="2" height="10" fill={color} rx="0.5" />
    <rect x="13" y="7" width="2" height="10" fill={color} rx="0.5" />
  </svg>
);

// 继续/恢复图标
export const ResumeIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <path d="M9 8L13 12L9 16V8Z" fill={color} />
    <path d="M13 8L17 12L13 16V8Z" fill={color} />
  </svg>
);

// 前进图标
export const ForwardIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 4L12 20M12 4L8 8M12 4L16 8" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 18L16 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 后退图标
export const BackwardIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 20L12 4M12 20L8 16M12 20L16 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 6L16 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 左转图标
export const TurnLeftIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M20 12L4 12M4 12L8 8M4 12L8 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 8L18 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 右转图标
export const TurnRightIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 12L20 12M20 12L16 8M20 12L16 16" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 8L6 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 巡检任务图标
export const PatrolIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2" fill="none" />
    <path d="M12 13C9 13 6 15 6 17V19H18V17C18 15 15 13 12 13Z" stroke={color} strokeWidth="2" fill="none" />
    <path d="M15 7L17 5M17 5L19 7M17 5V9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 清洁任务图标
export const CleanIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 12L8 8L12 12L8 16L4 12Z" stroke={color} strokeWidth="2" fill="none" />
    <path d="M12 12L20 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="20" cy="4" r="2" fill={color} />
    <path d="M6 18L10 20L14 18L18 20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 运输任务图标
export const TransportIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="4" y="6" width="16" height="10" rx="1" stroke={color} strokeWidth="2" fill="none" />
    <path d="M4 10H20" stroke={color} strokeWidth="2" />
    <circle cx="8" cy="18" r="2" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="16" cy="18" r="2" stroke={color} strokeWidth="2" fill="none" />
    <path d="M10 18H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 返回基站图标
export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 12L12 3L21 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 10V19C5 19.5 5.5 20 6 20H10V15H14V20H18C18.5 20 19 19.5 19 19V10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="8" r="1.5" fill={color} />
  </svg>
);

// 紧急停止图标
export const EmergencyStopIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" fill={color} opacity="0.2" />
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" fill="none" />
    <path d="M12 7V13" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.5" fill="white" />
  </svg>
);

// 系统重置图标
export const ResetIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 12C4 7.58 7.58 4 12 4C14.5 4 16.7 5.2 18 7M20 12C20 16.42 16.42 20 12 20C9.5 20 7.3 18.8 6 17" 
          stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M18 4V7H15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 20V17H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 图标映射
export const iconMap = {
  start: PlayIcon,
  stop: StopIcon,
  pause: PauseIcon,
  resume: ResumeIcon,
  forward: ForwardIcon,
  backward: BackwardIcon,
  left: TurnLeftIcon,
  right: TurnRightIcon,
  patrol: PatrolIcon,
  clean: CleanIcon,
  transport: TransportIcon,
  return: HomeIcon,
  emergency_stop: EmergencyStopIcon,
  reset: ResetIcon,
};

// 获取图标组件
export const getIcon = (iconName: string) => {
  return iconMap[iconName as keyof typeof iconMap] || PlayIcon;
};

