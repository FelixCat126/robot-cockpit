#!/bin/bash
#
# Robot Cockpit - PM2服务安装脚本
# 用于开机自启动（更简单的方案）
#

set -e

echo "========================================================="
echo "Robot Cockpit - PM2服务安装"
echo "========================================================="
echo ""

# 检查PM2是否安装
if ! command -v pm2 &>/dev/null; then
    echo "❌ PM2未安装"
    echo "   请先安装PM2: npm install -g pm2"
    exit 1
fi

# 配置变量
INSTALL_DIR="/opt/robot-cockpit"

echo "1️⃣  选择显示模式..."
echo ""
read -p "   选择显示模式 [single/multi] (默认: single): " DISPLAY_MODE
DISPLAY_MODE=${DISPLAY_MODE:-single}
echo "   ✓ 显示模式: $DISPLAY_MODE"

echo ""
echo "2️⃣  停止旧服务..."
pm2 delete robot-cockpit 2>/dev/null || echo "   (无旧服务)"

echo ""
echo "3️⃣  启动PM2服务..."
cd $INSTALL_DIR
pm2 start deploy/ecosystem.config.js --env $DISPLAY_MODE
pm2 save
echo "   ✓ PM2服务已启动"

echo ""
echo "4️⃣  设置开机自启动..."
# 生成启动脚本
pm2 startup | tail -1 | bash || true
pm2 save
echo "   ✓ 开机自启动已设置"

echo ""
echo "========================================================="
echo "✅ 安装完成！"
echo "========================================================="
echo ""
echo "服务状态:"
pm2 status
echo ""
echo "========================================================="
echo ""
echo "常用命令:"
echo "  查看状态:   pm2 status"
echo "  查看日志:   pm2 logs robot-cockpit"
echo "  重启服务:   pm2 restart robot-cockpit"
echo "  停止服务:   pm2 stop robot-cockpit"
echo "  开机自启:   pm2 startup && pm2 save"
echo ""
echo "切换模式:"
echo "  单屏模式:   pm2 restart robot-cockpit --env single"
echo "  多屏模式:   pm2 restart robot-cockpit --env multi"
echo ""
echo "访问地址:   http://localhost:3000"
echo ""
echo "========================================================="

