# 开机自启动 - 快速参考

> 封闭式服务器环境 - 3分钟完成部署

---

## ⚡ 超快部署

### systemd方式（推荐）

```bash
# 1. 复制到服务器
scp -r robot-cockpit user@server:/opt/

# 2. SSH登录
ssh user@server

# 3. 运行一键安装
cd /opt/robot-cockpit
sudo bash deploy/install-systemd.sh

# 4. 完成！
sudo reboot
```

### PM2方式（更简单）

```bash
# 1. 安装PM2
npm install -g pm2

# 2. 运行脚本
bash deploy/install-pm2.sh

# 3. 完成！
sudo reboot
```

---

## 🔧 常用命令

### systemd

```bash
sudo systemctl start robot-cockpit     # 启动
sudo systemctl stop robot-cockpit      # 停止
sudo systemctl restart robot-cockpit   # 重启
sudo systemctl status robot-cockpit    # 状态
sudo journalctl -u robot-cockpit -f    # 日志
```

### PM2

```bash
pm2 status                             # 状态
pm2 logs robot-cockpit                 # 日志
pm2 restart robot-cockpit              # 重启
pm2 stop robot-cockpit                 # 停止
```

---

## 🔄 切换模式

### systemd

```bash
sudo vim /etc/systemd/system/robot-cockpit.service
# 修改: Environment="DISPLAY_MODE=single"  # 或 multi
sudo systemctl daemon-reload
sudo systemctl restart robot-cockpit
```

### PM2

```bash
pm2 restart robot-cockpit --env single  # 单屏
pm2 restart robot-cockpit --env multi   # 多屏
pm2 save                                # 保存
```

---

## ✅ 验证

```bash
# 1. 检查服务
systemctl status robot-cockpit  # 或 pm2 status

# 2. 访问应用
curl http://localhost:3000/api/config/display-mode

# 3. 浏览器测试
# 单屏: 应看到1个浏览器窗口
# 多屏: 应看到3个浏览器窗口
```

---

## 📁 文件结构

```
deploy/
├── robot-cockpit.service    # systemd服务文件
├── install-systemd.sh       # systemd安装脚本
├── ecosystem.config.js      # PM2配置文件
├── install-pm2.sh           # PM2安装脚本
├── AUTO_START_GUIDE.md      # 完整指南
└── QUICK_START.md           # 本文件
```

---

## 🆘 故障排查

```bash
# 查看日志
sudo journalctl -u robot-cockpit -n 100

# 检查端口
sudo lsof -i:3000

# 检查Chrome
which google-chrome

# 手动测试
cd /opt/robot-cockpit
node backend/server.js
```

---

完整文档: `cat deploy/AUTO_START_GUIDE.md`

