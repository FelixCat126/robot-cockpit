/**
 * SpeedGauge - 速度仪表盘组件
 * 仿汽车仪表盘样式显示机器人速度
 */

import { useEffect, useRef } from 'react';

interface SpeedGaugeProps {
  label: string;
  value: number; // 0-100
  maxValue?: number;
  unit?: string;
  color?: string;
  size?: number;
}

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({
  label,
  value,
  maxValue = 100,
  unit = 'rpm',
  color = '#10b981',
  size = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = (canvas.width / 2) - 10;

    // 绘制外圈
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制刻度
    const startAngle = Math.PI * 0.75; // 从135度开始
    const endAngle = Math.PI * 2.25; // 到405度结束
    const totalAngle = endAngle - startAngle;
    const tickCount = 10;

    for (let i = 0; i <= tickCount; i++) {
      const angle = startAngle + (totalAngle * i) / tickCount;
      const tickLength = i % 2 === 0 ? 8 : 5;
      const outerRadius = radius - 2;
      const innerRadius = outerRadius - tickLength;

      const x1 = centerX + Math.cos(angle) * outerRadius;
      const y1 = centerY + Math.sin(angle) * outerRadius;
      const x2 = centerX + Math.cos(angle) * innerRadius;
      const y2 = centerY + Math.sin(angle) * innerRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = i % 2 === 0 ? 2 : 1;
      ctx.stroke();
    }

    // 绘制进度弧
    const percentage = Math.min(Math.max(value / maxValue, 0), 1);
    const progressAngle = startAngle + totalAngle * percentage;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 5, startAngle, progressAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制指针
    const needleLength = radius - 15;
    const needleX = centerX + Math.cos(progressAngle) * needleLength;
    const needleY = centerY + Math.sin(progressAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 绘制中心点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [value, maxValue, color, size]);

  return (
    <div className="speed-gauge" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '8px'
    }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: 'block' }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          color: color,
          fontFamily: 'monospace'
        }}>
          {value.toFixed(0)} {unit}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: '#94a3b8',
          marginTop: '2px'
        }}>
          {label}
        </div>
      </div>
    </div>
  );
};
