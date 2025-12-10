/**
 * 网速格式化工具
 * 智能换算kbps和mbps
 */

/**
 * 格式化网速，自动在kbps和mbps之间切换
 * @param speedKbps 网速（kbps）
 * @returns 格式化后的网速字符串
 */
export function formatNetworkSpeed(speedKbps: number): string {
  if (speedKbps < 0) {
    return '0 kbps';
  }
  
  // 如果网速大于等于1000 kbps，转换为mbps
  if (speedKbps >= 1000) {
    const speedMbps = speedKbps / 1000;
    // 如果mbps小于10，保留2位小数；否则保留1位小数
    if (speedMbps < 10) {
      return `${speedMbps.toFixed(2)} Mbps`;
    } else {
      return `${speedMbps.toFixed(1)} Mbps`;
    }
  }
  
  // 小于1000 kbps，直接显示kbps，保留整数
  return `${Math.round(speedKbps)} kbps`;
}
