/**
 * WebSocket Hook
 * 提供React Hook接口访问WebSocket服务
 */

import { useEffect, useRef, useState } from 'react';
import websocketService, { TopicData } from '../services/websocket';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  screenId?: number;
  topics?: string[];
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    screenId,
    topics = [],
  } = options;

  const [connected, setConnected] = useState(false);
  const [topicData, setTopicData] = useState<Map<string, any>>(new Map());
  const topicsRef = useRef<string[]>(topics);

  useEffect(() => {
    topicsRef.current = topics;
  }, [topics]);

  useEffect(() => {
    if (!autoConnect) return;

    // 连接WebSocket
    websocketService.connect();

    // 注册屏幕ID
    if (screenId !== undefined) {
      websocketService.registerScreen(screenId);
    }

    // 设置事件监听器
    const handleConnected = () => {
      setConnected(true);
      
      // 订阅话题
      topicsRef.current.forEach(topic => {
        websocketService.subscribeTopic(topic);
      });
    };

    const handleDisconnected = () => {
      setConnected(false);
    };

    const handleTopicData = (data: TopicData) => {
      setTopicData(prev => {
        const newMap = new Map(prev);
        newMap.set(data.topic, data.data);
        return newMap;
      });
    };

    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    websocketService.on('topic_data', handleTopicData);

    // 清理函数
    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('topic_data', handleTopicData);
      
      // 取消订阅所有话题
      topicsRef.current.forEach(topic => {
        websocketService.unsubscribeTopic(topic);
      });
    };
  }, [autoConnect, screenId]);

  // 订阅话题的辅助函数
  const subscribe = (topic: string, type?: string) => {
    websocketService.subscribeTopic(topic, type);
    if (!topicsRef.current.includes(topic)) {
      topicsRef.current.push(topic);
    }
  };

  // 取消订阅话题的辅助函数
  const unsubscribe = (topic: string) => {
    websocketService.unsubscribeTopic(topic);
    topicsRef.current = topicsRef.current.filter(t => t !== topic);
    setTopicData(prev => {
      const newMap = new Map(prev);
      newMap.delete(topic);
      return newMap;
    });
  };

  // 发布消息的辅助函数
  const publish = (topic: string, message: any, type?: string) => {
    websocketService.publishTopic(topic, message, type);
  };

  // 获取特定话题的数据
  const getTopicData = (topic: string) => {
    return topicData.get(topic);
  };

  return {
    connected,
    topicData,
    subscribe,
    unsubscribe,
    publish,
    getTopicData,
  };
}

