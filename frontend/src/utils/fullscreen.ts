/**
 * 全屏控制工具
 * 提供跨浏览器的全屏API封装
 */

export class FullscreenManager {
  private element: HTMLElement;

  constructor(element: HTMLElement = document.documentElement) {
    this.element = element;
  }

  /**
   * 进入全屏
   */
  async requestFullscreen(): Promise<void> {
    try {
      if (this.element.requestFullscreen) {
        await this.element.requestFullscreen();
      } else if ((this.element as any).webkitRequestFullscreen) {
        await (this.element as any).webkitRequestFullscreen();
      } else if ((this.element as any).mozRequestFullScreen) {
        await (this.element as any).mozRequestFullScreen();
      } else if ((this.element as any).msRequestFullscreen) {
        await (this.element as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      throw error;
    }
  }

  /**
   * 退出全屏
   */
  async exitFullscreen(): Promise<void> {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      throw error;
    }
  }

  /**
   * 检查是否处于全屏状态
   */
  isFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  /**
   * 监听全屏状态变化
   */
  onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void {
    const handler = () => {
      callback(this.isFullscreen());
    };

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
      document.removeEventListener('MSFullscreenChange', handler);
    };
  }
}

/**
 * 自动进入全屏的Hook
 */
export function useAutoFullscreen(enabled: boolean = true) {
  const fullscreenManager = new FullscreenManager();

  const enterFullscreen = async () => {
    if (enabled && !fullscreenManager.isFullscreen()) {
      try {
        await fullscreenManager.requestFullscreen();
      } catch (error) {
        console.warn('Failed to enter fullscreen automatically:', error);
      }
    }
  };

  return { enterFullscreen, isFullscreen: () => fullscreenManager.isFullscreen() };
}

