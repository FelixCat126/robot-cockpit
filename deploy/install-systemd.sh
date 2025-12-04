#!/bin/bash
#
# Robot Cockpit - systemd服务安装脚本
# 用于封闭式服务器环境的开机自启动
#

set -e

echo "========================================================="
echo "Robot Cockpit - systemd服务安装"
echo "========================================================="
echo ""

# 检查是否以root运行
if [ "$EUID" -ne 0 ]; then 
  echo "❌ 请使用root权限运行此脚本"
  echo "   sudo bash deploy/install-systemd.sh"
  exit 1
fi

# 配置变量
SERVICE_NAME="robot-cockpit"
INSTALL_DIR="/opt/robot-cockpit"
SERVICE_USER="robot"
SERVICE_GROUP="robot"

echo "1️⃣  创建服务用户..."
if id "$SERVICE_USER" &>/dev/null; then
    echo "   ✓ 用户 $SERVICE_USER 已存在"
else
    useradd -r -s /bin/false -d $INSTALL_DIR $SERVICE_USER
    echo "   ✓ 已创建用户 $SERVICE_USER"
fi

echo ""
echo "2️⃣  创建安装目录..."
mkdir -p $INSTALL_DIR
mkdir -p /var/log/robot-cockpit
chown -R $SERVICE_USER:$SERVICE_GROUP $INSTALL_DIR
chown -R $SERVICE_USER:$SERVICE_GROUP /var/log/robot-cockpit
echo "   ✓ 目录已创建: $INSTALL_DIR"

echo ""
echo "3️⃣  复制应用文件..."
cp -r backend $INSTALL_DIR/
cp -r frontend/dist $INSTALL_DIR/frontend/
cp -r node_modules $INSTALL_DIR/
cp package.json $INSTALL_DIR/
chown -R $SERVICE_USER:$SERVICE_GROUP $INSTALL_DIR
echo "   ✓ 应用文件已复制"

echo ""
echo "4️⃣  安装systemd服务..."
cp deploy/robot-cockpit.service /etc/systemd/system/
systemctl daemon-reload
echo "   ✓ systemd服务已安装"

echo ""
echo "5️⃣  配置显示模式..."
echo "   当前模式: $(grep 'mode:' backend/config/index.js | head -1)"
echo ""
read -p "   选择显示模式 [single/multi] (默认: single): " DISPLAY_MODE
DISPLAY_MODE=${DISPLAY_MODE:-single}

# 更新服务文件中的DISPLAY_MODE
sed -i "s/DISPLAY_MODE=single/DISPLAY_MODE=$DISPLAY_MODE/" /etc/systemd/system/robot-cockpit.service
systemctl daemon-reload
echo "   ✓ 显示模式已设置为: $DISPLAY_MODE"

echo ""
echo "6️⃣  检查Chrome浏览器..."
if command -v google-chrome &>/dev/null; then
    CHROME_PATH=$(command -v google-chrome)
    echo "   ✓ 找到Chrome: $CHROME_PATH"
elif command -v chromium-browser &>/dev/null; then
    CHROME_PATH=$(command -v chromium-browser)
    echo "   ✓ 找到Chromium: $CHROME_PATH"
elif command -v chromium &>/dev/null; then
    CHROME_PATH=$(command -v chromium)
    echo "   ✓ 找到Chromium: $CHROME_PATH"
else
    echo "   ⚠️  未找到Chrome/Chromium"
    echo "   请手动安装或指定路径"
    CHROME_PATH="/usr/bin/google-chrome"
fi

# 更新Chrome路径
sed -i "s|PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome|PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH|" /etc/systemd/system/robot-cockpit.service
systemctl daemon-reload

echo ""
echo "7️⃣  启用并启动服务..."
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME
echo "   ✓ 服务已启动"

echo ""
echo "========================================================="
echo "✅ 安装完成！"
echo "========================================================="
echo ""
echo "服务状态:"
systemctl status $SERVICE_NAME --no-pager -l || true
echo ""
echo "========================================================="
echo ""
echo "常用命令:"
echo "  查看状态:   sudo systemctl status robot-cockpit"
echo "  启动服务:   sudo systemctl start robot-cockpit"
echo "  停止服务:   sudo systemctl stop robot-cockpit"
echo "  重启服务:   sudo systemctl restart robot-cockpit"
echo "  查看日志:   sudo journalctl -u robot-cockpit -f"
echo "  禁用自启:   sudo systemctl disable robot-cockpit"
echo ""
echo "访问地址:   http://localhost:3000"
echo ""
echo "========================================================="

