#!/bin/bash
# 重启机器人驾驶舱服务

echo "🛑 停止现有服务..."
lsof -ti:3000,3001,3002,5000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 2

echo "🚀 启动服务..."
cd /Users/Felix/robot-cockpit
npm start

echo "✅ 服务已重启"
