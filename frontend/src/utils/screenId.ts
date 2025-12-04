/**
 * 屏幕ID工具
 * 从URL参数中获取屏幕ID
 */

export function getScreenIdFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const screenId = params.get('screen');
  
  if (screenId === null) {
    return null;
  }

  const id = parseInt(screenId, 10);
  if (isNaN(id) || id < 0 || id > 2) {
    console.warn(`Invalid screen ID: ${screenId}`);
    return null;
  }

  return id;
}

