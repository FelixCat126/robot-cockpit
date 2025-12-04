#!/bin/bash

# Robot Cockpit 启动脚本

set -e

echo "=========================================="
echo "Robot Cockpit 启动脚本"
echo "=========================================="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

echo "Node.js版本: $(node --version)"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "安装前端依赖..."
    cd frontend && npm install && cd ..
fi

# 构建前端（如果dist目录不存在）
if [ ! -d "frontend/dist" ]; then
    echo "构建前端应用..."
    cd frontend && npm run build && cd ..
fi

# 启动服务器
echo "启动Robot Cockpit服务器..."
node backend/server.js

