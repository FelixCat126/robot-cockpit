/**
 * 外设调试面板
 * 实时显示外设状态和输入数据
 */

import { useEffect, useState } from 'react';
import { PeripheralManager } from '../../utils/peripherals/PeripheralManager';
import { PeripheralState, InputEvent, PeripheralStatus } from '../../types/peripheral.types';
import './PeripheralDebugPanel.css';

interface PeripheralDebugPanelProps {
  manager: PeripheralManager | null;
  compact?: boolean;
}

export function PeripheralDebugPanel({ manager, compact = false }: PeripheralDebugPanelProps) {
  const [deviceStates, setDeviceStates] = useState<Map<string, PeripheralState>>(new Map());
  const [lastEvents, setLastEvents] = useState<InputEvent[]>([]);
  const maxEvents = compact ? 5 : 10;

  useEffect(() => {
    if (!manager) {
      return;
    }

    // 定时更新设备状态
    const updateInterval = setInterval(() => {
      const states = manager.getAllStates();
      setDeviceStates(new Map(states));
    }, 100); // 10Hz更新

    // 监听输入事件
    const handleInput = (event: InputEvent) => {
      setLastEvents(prev => {
        const newEvents = [event, ...prev];
        return newEvents.slice(0, maxEvents);
      });
    };

    manager.on('input', handleInput);

    return () => {
      clearInterval(updateInterval);
      manager.off('input', handleInput);
    };
  }, [manager, maxEvents]);

  if (!manager) {
    return (
      <div className="peripheral-debug-panel">
        <div className="debug-warning">
          ⚠️ 外设管理器未初始化
        </div>
      </div>
    );
  }

  const devices = Array.from(deviceStates.values());

  return (
    <div className={`peripheral-debug-panel ${compact ? 'compact' : ''}`}>
      <h3>🎮 外设实时状态</h3>

      {/* 设备列表 */}
      <div className="devices-section">
        {devices.length === 0 && (
          <div className="no-devices">
            ⏳ 等待外设连接...
          </div>
        )}

        {devices.map(device => (
          <DeviceStatus key={device.deviceId} state={device} compact={compact} />
        ))}
      </div>

      {/* 事件日志 */}
      {!compact && (
        <div className="events-section">
          <h4>📋 最近事件</h4>
          <div className="event-list">
            {lastEvents.length === 0 && (
              <div className="no-events">无事件</div>
            )}
            {lastEvents.map((event, index) => (
              <EventItem key={index} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 单个设备状态组件
 */
function DeviceStatus({ state, compact }: { state: PeripheralState; compact: boolean }) {
  const statusEmoji = {
    [PeripheralStatus.CONNECTED]: '🟢',
    [PeripheralStatus.CONNECTING]: '🟡',
    [PeripheralStatus.DISCONNECTED]: '🔴',
    [PeripheralStatus.ERROR]: '❌',
  };

  return (
    <div className={`device-status ${state.status}`}>
      <div className="device-header">
        <span className="device-name">
          {statusEmoji[state.status]} {state.deviceName}
        </span>
        <span className="device-type">{state.deviceType}</span>
      </div>

      {/* 断线重连提示 */}
      {state.status === PeripheralStatus.DISCONNECTED && (
        <div className="reconnect-notice">
          <p>⚠️ 设备已断开，正在尝试自动重连...</p>
          <p className="hint">💡 请按手柄上的任意按钮来唤醒设备</p>
        </div>
      )}

      {/* 错误状态提示 */}
      {state.status === PeripheralStatus.ERROR && (
        <div className="error-notice">
          <p>❌ 设备连接失败或重连次数超限</p>
          <p className="hint">请刷新页面重试</p>
        </div>
      )}

      {state.status === PeripheralStatus.CONNECTED && (
        <>
          {/* 轴向显示 */}
          {state.axes.length > 0 && (
            <div className="axes-display">
              <h5>轴向/摇杆</h5>
              {state.axes.map(axis => (
                <div key={axis.index} className="axis-item">
                  <span className="axis-label">
                    {axis.name || `Axis ${axis.index}`}
                  </span>
                  <div className="axis-bar">
                    <div
                      className="axis-value"
                      style={{
                        width: `${((axis.value + 1) / 2) * 100}%`,
                      }}
                    />
                  </div>
                  {!compact && (
                    <span className="axis-number">{axis.value.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 按钮显示 */}
          {state.buttons.length > 0 && (
            <div className="buttons-display">
              <h5>按钮</h5>
              <div className="button-grid">
                {state.buttons.map(button => (
                  button.pressed && (
                    <div key={button.index} className="button-item active">
                      {button.name || `Btn ${button.index}`}
                    </div>
                  )
                ))}
                {state.buttons.filter(b => b.pressed).length === 0 && (
                  <div className="no-press">无按钮按下</div>
                )}
              </div>
            </div>
          )}

          {/* 键盘按键显示 */}
          {state.keys && state.keys.size > 0 && (
            <div className="keys-display">
              <h5>按键</h5>
              <div className="key-grid">
                {Array.from(state.keys).map(key => (
                  <div key={key} className="key-item">
                    {key}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 单个事件显示
 */
function EventItem({ event }: { event: InputEvent }) {
  const getEventDescription = () => {
    switch (event.type) {
      case 'axis_change':
        return `轴 ${event.axis?.name || event.axis?.index}: ${event.axis?.value.toFixed(2)}`;
      case 'button_down':
        return `按钮 ${event.button?.name || event.button?.index} 按下`;
      case 'button_up':
        return `按钮 ${event.button?.name || event.button?.index} 松开`;
      case 'key_down':
        return `键 ${event.key} 按下`;
      case 'key_up':
        return `键 ${event.key} 松开`;
      default:
        return event.type;
    }
  };

  const date = new Date(event.timestamp);
  const time = date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');

  return (
    <div className="event-item">
      <span className="event-time">{time}</span>
      <span className="event-device">{event.deviceType}</span>
      <span className="event-desc">{getEventDescription()}</span>
    </div>
  );
}

