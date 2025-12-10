/**
 * 屏幕分辨率检测工具
 * 获取当前显示器的实际分辨率，用于动态调整布局
 */

export interface ScreenResolution {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  pixelRatio: number;
}

/**
 * 获取当前屏幕分辨率
 */
export function getScreenResolution(): ScreenResolution {
  return {
    width: window.screen.width,
    height: window.screen.height,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * 获取视口大小（实际显示区域）
 */
export function getViewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * 根据分辨率计算组合布局的最佳比例
 */
export function calculateCombinedLayoutProportions(
  resolution: ScreenResolution
): {
  controlWidth: string;
  videoWidth: string;
  statusWidth: string;
  controlHeight: string;
  statusHeight: string;
} {
  const { width } = resolution;

  // 根据宽高比和分辨率调整布局
  if (width >= 3840) {
    // 4K显示器：更宽的布局
    return {
      controlWidth: '20%',
      videoWidth: '55%',
      statusWidth: '25%',
      controlHeight: '35%',
      statusHeight: '65%',
    };
  } else if (width >= 2560) {
    // 2K显示器：标准布局
    return {
      controlWidth: '22%',
      videoWidth: '53%',
      statusWidth: '25%',
      controlHeight: '38%',
      statusHeight: '62%',
    };
  } else if (width >= 1920) {
    // 1080p显示器：紧凑布局
    return {
      controlWidth: '25%',
      videoWidth: '50%',
      statusWidth: '25%',
      controlHeight: '40%',
      statusHeight: '60%',
    };
  } else {
    // 小屏幕：更紧凑的布局
    return {
      controlWidth: '28%',
      videoWidth: '44%',
      statusWidth: '28%',
      controlHeight: '42%',
      statusHeight: '58%',
    };
  }
}

/**
 * 打印当前屏幕信息（调试用）
 */
export function logScreenInfo(): void {
  const resolution = getScreenResolution();
  const viewport = getViewportSize();
  const proportions = calculateCombinedLayoutProportions(resolution);

  console.log('[ScreenResolution] Screen Info:', {
    screen: `${resolution.width}x${resolution.height}`,
    available: `${resolution.availWidth}x${resolution.availHeight}`,
    viewport: `${viewport.width}x${viewport.height}`,
    pixelRatio: resolution.pixelRatio,
    layoutProportions: proportions,
  });
}
