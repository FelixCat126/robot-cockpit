/**
 * 远程日志记录器
 * 用于将前端日志发送到后端，便于调试
 */

const BACKEND_URL = 'http://localhost:3000';
let screenId: number | null = null;

// 设置屏幕ID
export function setRemoteLoggerScreenId(id: number) {
  screenId = id;
}

// 发送日志到后端
async function sendLogToBackend(level: string, message: string, data?: any) {
  try {
    await fetch(`${BACKEND_URL}/api/debug/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level,
        message,
        data,
        screenId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    // 静默失败，避免日志发送失败影响应用
  }
}

// 拦截console方法
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// 重写console.log
console.log = function (...args: any[]) {
  originalConsoleLog.apply(console, args);
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  sendLogToBackend('log', message);
};

// 重写console.error
console.error = function (...args: any[]) {
  originalConsoleError.apply(console, args);
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  sendLogToBackend('error', message);
};

// 重写console.warn
console.warn = function (...args: any[]) {
  originalConsoleWarn.apply(console, args);
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  sendLogToBackend('warn', message);
};

// 重写console.info
console.info = function (...args: any[]) {
  originalConsoleInfo.apply(console, args);
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  sendLogToBackend('info', message);
};

export default {
  setScreenId: setRemoteLoggerScreenId,
};

