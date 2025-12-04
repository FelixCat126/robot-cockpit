# 开机自启动配置指南

> 适用于封闭式服务器环境，确保系统开机后自动启动机器人驾驶舱

---

## 🎯 方案选择

| 方案 | 优势 | 适用场景 |
|-----|------|---------|
| **systemd** | 系统级服务，更稳定 | Linux生产服务器（推荐） |
| **PM2** | 配置简单，易于管理 | 开发环境或小型部署 |

---

## 方案1: systemd服务（推荐）

### 特点
- ✅ 系统级服务，开机自动启动
- ✅ 进程守护，崩溃自动重启
- ✅ 完整的日志管理
- ✅ 资源限制和安全控制

### 安装步骤

#### 1. 准备环境

```bash
# 确保Chrome已安装
google-chrome --version
# 或
chromium-browser --version

# 如果未安装，根据系统安装
# Ubuntu/Debian:
sudo apt-get install google-chrome-stable
# 或
sudo apt-get install chromium-browser

# CentOS/RHEL:
sudo yum install google-chrome-stable
```

#### 2. 运行安装脚本

```bash
cd /path/to/robot-cockpit
sudo bash deploy/install-systemd.sh
```

安装脚本会自动：
- 创建服务用户（robot）
- 复制应用文件到 `/opt/robot-cockpit`
- 安装systemd服务
- 检测Chrome路径
- 设置开机自启动

#### 3. 验证安装

```bash
# 查看服务状态
sudo systemctl status robot-cockpit

# 查看日志
sudo journalctl -u robot-cockpit -f

# 测试重启
sudo systemctl restart robot-cockpit
```

### 常用命令

```bash
# 服务管理
sudo systemctl start robot-cockpit      # 启动
sudo systemctl stop robot-cockpit       # 停止
sudo systemctl restart robot-cockpit    # 重启
sudo systemctl status robot-cockpit     # 状态

# 开机自启
sudo systemctl enable robot-cockpit     # 启用
sudo systemctl disable robot-cockpit    # 禁用

# 日志查看
sudo journalctl -u robot-cockpit -f     # 实时日志
sudo journalctl -u robot-cockpit -n 100 # 最近100行
sudo journalctl -u robot-cockpit --since "1 hour ago"  # 最近1小时
```

### 修改配置

#### 切换显示模式

编辑服务文件：
```bash
sudo vim /etc/systemd/system/robot-cockpit.service
```

修改环境变量：
```ini
Environment="DISPLAY_MODE=single"  # 或 multi
```

重载并重启：
```bash
sudo systemctl daemon-reload
sudo systemctl restart robot-cockpit
```

#### 修改Chrome路径

如果Chrome在非标准位置：
```ini
Environment="PUPPETEER_EXECUTABLE_PATH=/custom/path/to/chrome"
```

---

## 方案2: PM2进程管理

### 特点
- ✅ 安装配置简单
- ✅ 跨平台支持
- ✅ 实时监控面板
- ✅ 零停机重载

### 安装步骤

#### 1. 安装PM2

```bash
npm install -g pm2
```

#### 2. 运行安装脚本

```bash
cd /opt/robot-cockpit
bash deploy/install-pm2.sh
```

#### 3. 验证安装

```bash
pm2 status
pm2 logs robot-cockpit
```

### 常用命令

```bash
# 进程管理
pm2 start ecosystem.config.js           # 启动
pm2 stop robot-cockpit                  # 停止
pm2 restart robot-cockpit               # 重启
pm2 reload robot-cockpit                # 零停机重载
pm2 delete robot-cockpit                # 删除

# 日志管理
pm2 logs robot-cockpit                  # 查看日志
pm2 logs robot-cockpit --lines 100      # 最近100行
pm2 flush robot-cockpit                 # 清空日志

# 监控
pm2 monit                               # 实时监控
pm2 status                              # 状态列表

# 开机自启
pm2 startup                             # 生成启动脚本
pm2 save                                # 保存当前进程列表
```

### 切换显示模式

```bash
# 单屏模式
pm2 restart robot-cockpit --env single
pm2 save

# 多屏模式
pm2 restart robot-cockpit --env multi
pm2 save
```

---

## 🔧 Chrome/Chromium配置

### 自动检测Chrome

Puppeteer会自动查找Chrome，按以下顺序：
1. `PUPPETEER_EXECUTABLE_PATH` 环境变量
2. `/usr/bin/google-chrome`
3. `/usr/bin/chromium-browser`
4. `/usr/bin/chromium`

### 手动指定Chrome路径

**systemd方式：**
```bash
sudo vim /etc/systemd/system/robot-cockpit.service
```

添加环境变量：
```ini
Environment="PUPPETEER_EXECUTABLE_PATH=/path/to/chrome"
```

**PM2方式：**

编辑 `deploy/ecosystem.config.js`：
```javascript
env: {
  PUPPETEER_EXECUTABLE_PATH: '/path/to/chrome',
  // ...
}
```

### 无头模式运行

如果服务器没有显示器，确保Chrome以无头模式运行（已默认配置）。

---

## 🚀 开机自启动测试

### 测试步骤

1. **重启服务器**
   ```bash
   sudo reboot
   ```

2. **等待启动**（约1-2分钟）

3. **验证服务**
   ```bash
   # systemd
   sudo systemctl status robot-cockpit
   
   # PM2
   pm2 status
   ```

4. **检查浏览器窗口**
   - 单屏模式：应该看到1个浏览器窗口
   - 多屏模式：应该看到3个浏览器窗口

5. **访问应用**
   ```
   http://localhost:3000
   ```

---

## 📊 开机启动流程

```
系统启动
  ↓
网络服务就绪
  ↓
systemd/PM2 启动服务
  ↓
Robot Cockpit后端启动
  ↓
HTTP服务器启动 (端口3000)
  ↓
延迟2秒
  ↓
读取display.mode配置
  ↓
自动启动浏览器窗口
  ↓
完成！
```

---

## 🐛 故障排查

### 问题1: 服务启动失败

```bash
# 查看详细日志
sudo journalctl -u robot-cockpit -n 100

# 检查端口占用
sudo lsof -i:3000

# 手动运行测试
cd /opt/robot-cockpit
node backend/server.js
```

### 问题2: Chrome未找到

```bash
# 检查Chrome是否安装
which google-chrome
which chromium-browser

# 手动指定路径
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### 问题3: 权限问题

```bash
# 检查文件权限
ls -la /opt/robot-cockpit

# 修复权限
sudo chown -R robot:robot /opt/robot-cockpit
```

### 问题4: 浏览器窗口未出现

```bash
# 检查显示环境
echo $DISPLAY

# 设置DISPLAY变量（如果需要）
export DISPLAY=:0

# 更新systemd服务
sudo vim /etc/systemd/system/robot-cockpit.service
# 添加: Environment="DISPLAY=:0"
```

---

## 📝 配置文件位置

```
/etc/systemd/system/robot-cockpit.service  # systemd服务文件
/opt/robot-cockpit/                        # 应用安装目录
/opt/robot-cockpit/backend/config/index.js # 配置文件
/var/log/robot-cockpit/                    # 日志目录
~/.pm2/                                    # PM2配置和日志
```

---

## 🔐 安全建议

1. **使用专用用户**
   - 不要使用root运行
   - 创建专用的robot用户

2. **限制文件权限**
   ```bash
   sudo chmod 750 /opt/robot-cockpit
   sudo chown -R robot:robot /opt/robot-cockpit
   ```

3. **配置防火墙**
   ```bash
   sudo ufw allow 3000/tcp
   ```

4. **定期更新**
   - 保持系统和依赖更新
   - 定期检查日志

---

## 📞 需要帮助？

如遇问题，请提供：
1. 系统信息：`uname -a`
2. 服务状态：`systemctl status robot-cockpit` 或 `pm2 status`
3. 错误日志：`journalctl -u robot-cockpit -n 100`
4. Chrome版本：`google-chrome --version`

---

**文档版本**: v1.0.0  
**最后更新**: 2025-12-03  
**适用系统**: Linux (Ubuntu/Debian/CentOS/RHEL)

