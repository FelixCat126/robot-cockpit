/**
 * 屏幕管理模块
 * 负责检测和管理多个显示器，启动和管理浏览器实例
 * 设计为独立模块，可替换不同的屏幕管理实现
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const puppeteer = require('puppeteer');
const EventEmitter = require('events');

const execAsync = promisify(exec);

class ScreenManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.browsers = new Map(); // screenId -> browser instance
    this.screens = []; // 检测到的屏幕信息
    this.isInitialized = false;
  }

  /**
   * 初始化屏幕管理器
   * 检测显示器并准备浏览器实例
   */
  async initialize() {
    if (this.isInitialized) {
      this.log('warn', 'ScreenManager already initialized');
      return;
    }

    try {
      this.log('info', 'Initializing ScreenManager...');
      
      // 检测显示器
      await this.detectScreens();
      
      // 验证屏幕数量
      if (this.screens.length < this.config.count) {
        this.log('warn', 
          `Detected ${this.screens.length} screens, but ${this.config.count} screens required`);
      }

      this.isInitialized = true;
      this.log('info', `ScreenManager initialized with ${this.screens.length} screens`);
      this.emit('initialized', { screens: this.screens });
    } catch (error) {
      this.log('error', `Failed to initialize ScreenManager: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 检测可用的显示器
   * 使用xrandr命令获取显示器信息
   */
  async detectScreens() {
    try {
      this.log('info', 'Detecting screens...');
      
      // 单显示器模式：直接创建虚拟屏幕配置
      if (this.config.singleDisplayMode) {
        this.log('info', 'Single display mode enabled - creating virtual screen configurations');
        this.createDefaultScreens();
        return;
      }
      
      // macOS和其他非Linux系统不支持xrandr，直接使用默认配置
      if (process.platform !== 'linux') {
        this.log('info', `Platform ${process.platform} detected - using default screen configurations`);
        this.createDefaultScreens();
        return;
      }
      
      // 执行xrandr命令获取显示器列表
      const { stdout } = await execAsync(this.config.detectCommand);
      
      // 解析xrandr输出
      // 示例输出格式：
      // Monitors: 2
      //  0: +*DP-4 1920/508x1080/286+0+0  DP-4
      //  1: +HDMI-0 1920/508x1080/286+1920+0  HDMI-0
      const lines = stdout.split('\n');
      const screenLines = lines.filter(line => 
        line.trim().match(/^\d+:/) && !line.includes('Monitors:')
      );

      this.screens = screenLines.map((line, index) => {
        // 解析显示器信息
        const match = line.match(/(\d+):\s+\+?\*?(\S+)\s+(\d+)\/(\d+)x(\d+)\/(\d+)\+(\d+)\+(\d+)/);
        if (match) {
          const [, monitorIndex, name, width, widthMm, height, heightMm, x, y] = match;
          return {
            id: parseInt(monitorIndex, 10),
            name: name,
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            x: parseInt(x, 10),
            y: parseInt(y, 10),
            widthMm: parseInt(widthMm, 10),
            heightMm: parseInt(heightMm, 10),
          };
        }
        // 如果解析失败，使用默认值
        return {
          id: index,
          name: `Screen-${index}`,
          width: 1920,
          height: 1080,
          x: index * 1920,
          y: 0,
        };
      });

      // 如果检测到的屏幕数量不足，创建虚拟屏幕配置
      while (this.screens.length < this.config.count) {
        const index = this.screens.length;
        this.screens.push({
          id: index,
          name: `Virtual-Screen-${index}`,
          width: 1920,
          height: 1080,
          x: index * 1920,
          y: 0,
        });
        this.log('warn', `Created virtual screen configuration for screen ${index}`);
      }

      this.log('info', `Detected ${this.screens.length} screens:`, 
        this.screens.map(s => `${s.id}:${s.name}(${s.width}x${s.height}@${s.x},${s.y})`).join(', '));
    } catch (error) {
      this.log('error', `Failed to detect screens: ${error.message}`);
      // 如果检测失败，创建默认配置
      this.createDefaultScreens();
      // 在非Linux系统或单显示器模式下不抛出错误
      if (process.platform === 'linux' && !this.config.singleDisplayMode) {
        throw error;
      } else {
        this.log('info', 'Using default screen configurations due to detection failure');
      }
    }
  }

  /**
   * 创建默认屏幕配置（当检测失败时使用）
   * macOS双显示器特殊配置：笔记本屏幕 + 外接显示器
   */
  createDefaultScreens() {
    this.log('warn', 'Creating default screen configurations');
    this.screens = [];
    
    // macOS双显示器模式：Screen 0在笔记本，Screen 1-3在外接显示器
    if (process.platform === 'darwin' && this.config.count === 4) {
      // 获取笔记本实际宽度
      let laptopWidth = this.config.laptopWidth || 0;
      
      if (laptopWidth === 0) {
        // 使用常见的 MacBook Pro 分辨率作为默认值
        // MacBook Pro 13" (M1/M2/M3): 2560
        // MacBook Pro 14": 3024
        // MacBook Pro 16": 3456
        laptopWidth = 2560; // 最常见的 13" MacBook Pro 分辨率
        this.log('info', `Using default laptop width: ${laptopWidth}px (可通过 LAPTOP_WIDTH 环境变量自定义)`);
      } else {
        this.log('info', `Using configured laptop width: ${laptopWidth}px`);
      }
      
      // Screen 0: 笔记本屏幕全屏（宽度自适应）
      this.screens.push({
        id: 0,
        name: 'Laptop-Screen',
        width: laptopWidth,
        height: 1080,
        x: 0,
        y: 0,
      });
      
      // Screen 1-3: 外接显示器，从左到右并排（每个640px宽）
      const externalDisplayStartX = laptopWidth; // 从笔记本屏幕右侧开始
      const windowWidth = 640; // 每个窗口宽度
      
      for (let i = 1; i < this.config.count; i++) {
        this.screens.push({
          id: i,
          name: `External-Screen-${i}`,
          width: windowWidth,
          height: 1080,
          x: externalDisplayStartX + (i - 1) * windowWidth,
          y: 0,
        });
      }
      
      this.log('info', `macOS dual-display mode: Laptop(${laptopWidth}px) + External display (3x${windowWidth}px windows)`);
    } else {
      // 默认配置：所有屏幕横向排列
      for (let i = 0; i < this.config.count; i++) {
        this.screens.push({
          id: i,
          name: `Default-Screen-${i}`,
          width: 1920,
          height: 1080,
          x: i * 1920,
          y: 0,
        });
      }
    }
  }

  /**
   * 检测系统Chrome路径
   * @returns {string|null} Chrome可执行文件路径
   */
  detectChromePath() {
    const fs = require('fs');
    let executablePath = null;
    
    if (process.platform === 'darwin') {
      // macOS
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
      for (const path of macPaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      }
    } else if (process.platform === 'linux') {
      // Linux
      const linuxPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
      ];
      for (const path of linuxPaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      }
    } else if (process.platform === 'win32') {
      // Windows
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const path of winPaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      }
    }
    
    if (executablePath) {
      this.log('info', `Found system Chrome at: ${executablePath}`);
    } else {
      this.log('warn', 'Could not find system Chrome, will use Puppeteer default');
    }
    
    return executablePath;
  }

  /**
   * 启动单个浏览器实例（单屏模式）
   * @param {Object} options - 浏览器启动选项
   * @param {number} options.screenId - 屏幕ID
   * @param {string} options.url - 要打开的URL
   * @param {number} options.x - 窗口X坐标
   * @param {number} options.y - 窗口Y坐标
   * @param {number} options.width - 窗口宽度
   * @param {number} options.height - 窗口高度
   */
  async launchBrowser(options) {
    const { screenId, url, x, y, width, height, displayMode } = options;

    this.log('info', `Launching browser for single screen mode...`);
    this.log('info', `Position: (${x}, ${y}), Size: ${width}x${height}`);

    try {
      // 检测系统Chrome路径
      const executablePath = this.detectChromePath();
      
      // 使用临时用户数据目录，确保每次启动都是干净的状态
      const os = require('os');
      const path = require('path');
      const userDataDir = path.join(os.tmpdir(), `robot-cockpit-single-${Date.now()}`);
      this.log('info', `Using temporary user data dir: ${userDataDir}`);
      
      const browser = await puppeteer.launch({
        headless: false,
        executablePath: executablePath,
        userDataDir: userDataDir,  // 使用临时目录，确保干净状态
        args: [
          ...this.config.browser.args,
          `--window-position=${x},${y}`,
          `--window-size=${width},${height}`,
        ],
        ignoreDefaultArgs: ['--enable-automation'],  // 移除自动化标识
        defaultViewport: null,
      });
      
      // 通过CDP注入脚本隐藏自动化特征并配置权限（更可靠的方法）
      const pages = await browser.pages();
      const page = pages[0];
      
      // 授予媒体权限（通过CDP，不使用命令行参数）
      const context = browser.defaultBrowserContext();
      const urlOrigin = new URL(url).origin;  // 动态获取URL的origin
      await context.overridePermissions(urlOrigin, [
        'camera',
        'microphone',
        'notifications',
      ]);
      
      await page.evaluateOnNewDocument(() => {
        // 删除 navigator.webdriver 标识
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // 伪装 Chrome 对象
        window.chrome = {
          runtime: {},
        };
        
        // 伪装 Permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // 覆盖 getUserMedia 以自动授权
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return originalGetUserMedia(constraints);
        };
      });

      // 在URL中添加displayMode参数
      const finalUrl = `${url}?displayMode=${displayMode || 'single'}`;
      this.log('info', `Navigating to: ${finalUrl}`);

      // 导航到URL（使用临时用户目录，自动是干净状态）
      await page.goto(finalUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 使用CDP协议设置窗口为最大化（参考多屏模式的实现）
      try {
        const client = await page.target().createCDPSession();
        const windowId = await client.send('Browser.getWindowForTarget', {
          targetId: page.target()._targetId
        });
        
        // 获取屏幕可用尺寸
        const screenInfo = await page.evaluate(() => {
          return {
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            width: window.screen.width,
            height: window.screen.height
          };
        });
        
        // 设置窗口为最大化（使用maximized状态，而不是fullscreen，避免ESC提示）
        await client.send('Browser.setWindowBounds', {
          windowId: windowId.windowId,
          bounds: {
            windowState: 'maximized',  // 最大化窗口，自适应屏幕大小
          }
        });
        
        this.log('info', `[Single Screen] Window maximized: ${screenInfo.availWidth}x${screenInfo.availHeight}`);
      } catch (e) {
        this.log('warn', `Could not maximize window using CDP: ${e.message}, falling back to manual resize`);
        // 降级方案：通过页面脚本尝试最大化
        try {
          await page.evaluate(() => {
            // 尝试使用window.resizeTo（可能被浏览器限制）
            const screenWidth = window.screen.availWidth;
            const screenHeight = window.screen.availHeight;
            try {
              window.resizeTo(screenWidth, screenHeight);
              window.moveTo(0, 0);
            } catch (err) {
              console.log('Window resize restricted by browser:', err);
            }
          });
        } catch (e2) {
          this.log('warn', `Fallback resize also failed: ${e2.message}`);
        }
      }

      // 存储浏览器实例
      this.browsers.set(screenId, browser);

      this.log('info', `Browser launched successfully for single screen mode`);
      this.emit('browser_launched', { screenId, url });

      return browser;
    } catch (error) {
      this.log('error', `Failed to launch browser: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 启动所有屏幕的浏览器实例
   */
  async startAllScreens() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.log('info', `Starting browsers for ${this.config.count} screens...`);

    // macOS 双显示器模式：先启动 Screen 0 以检测实际屏幕宽度
    if (process.platform === 'darwin' && this.config.singleDisplayMode && this.config.count === 4) {
      // 第一步：启动 Screen 0
      this.log('info', 'Step 1: Launching Screen 0 to detect actual screen width...');
      await this.startScreen(0);
      
      // 第二步：从 Screen 0 检测实际笔记本宽度
      try {
        const screen0Info = this.browsers.get(0);
        if (screen0Info && screen0Info.page) {
          const actualWidth = await screen0Info.page.evaluate(() => window.screen.width);
          this.log('info', `Detected actual screen width: ${actualWidth}px`);
          
          // 更新屏幕配置
          const windowWidth = 640;
          this.screens[1].x = actualWidth;
          this.screens[2].x = actualWidth + windowWidth;
          this.screens[3].x = actualWidth + windowWidth * 2;
          
          this.log('info', `Updated external display positions: ${this.screens[1].x}, ${this.screens[2].x}, ${this.screens[3].x}`);
        }
      } catch (e) {
        this.log('warn', `Failed to detect screen width: ${e.message}, using default positions`);
      }
      
      // 第三步：启动 Screen 1-3
      this.log('info', 'Step 2: Launching Screen 1-3...');
      const promises = [];
      for (let i = 1; i < this.config.count; i++) {
        promises.push(this.startScreen(i));
      }
      await Promise.all(promises);
    } else {
      // 默认模式：并行启动所有屏幕
      const promises = [];
      for (let i = 0; i < this.config.count; i++) {
        promises.push(this.startScreen(i));
      }
      await Promise.all(promises);
    }
    
    this.log('info', 'All screens started');
    this.emit('all_screens_started', { count: this.config.count });
  }

  /**
   * 启动指定屏幕的浏览器实例
   * @param {number} screenId - 屏幕ID (0-6)
   */
  async startScreen(screenId) {
    if (screenId < 0 || screenId >= this.config.count) {
      throw new Error(`Invalid screen ID: ${screenId}`);
    }

    if (this.browsers.has(screenId)) {
      this.log('warn', `Screen ${screenId} already started`);
      return this.browsers.get(screenId);
    }

    try {
      const screen = this.screens[screenId] || this.screens[0];
      const url = `${this.config.frontendUrl}?screen=${screenId}`;

      this.log('info', `Starting browser for screen ${screenId} at ${url}`);

      // 单显示器模式：使用窗口模式
      // 多显示器模式：使用全屏模式
      const isSingleDisplayMode = this.config.singleDisplayMode;
      let browserArgs = [...this.config.browser.args];
      let viewportConfig = {
        width: screen.width,
        height: screen.height,
      };

      if (isSingleDisplayMode) {
        // 单显示器模式：移除全屏参数，使用窗口模式
        browserArgs = browserArgs.filter(arg => 
          arg !== '--kiosk' && arg !== '--start-fullscreen'
        );
        
        // 对于 Screen 0（笔记本），不设置固定尺寸，为全屏做准备
        // 对于 Screen 1-3（外接显示器），设置窗口模式的固定尺寸
        if (screenId === 0) {
          // Screen 0: 保持原始分辨率，不限制窗口大小
          // 不添加 --window-size 参数，让全屏模式自适应
          this.log('info', `[Dual Display] Screen 0 using auto-size for fullscreen`);
        } else {
          // Screen 1-3: 使用固定的窗口尺寸
          const windowConfig = this.config.singleDisplayWindow;
          viewportConfig = {
            width: windowConfig.width,
            height: windowConfig.height,
          };
          
          // 使用从屏幕配置中获取的 X 坐标（已在 startAllScreens 中更新）
          const windowX = screen.x;
          const windowY = screen.y;
          
          browserArgs.push(`--window-position=${windowX},${windowY}`);
          browserArgs.push(`--window-size=${windowConfig.width},${windowConfig.height}`);
          
          this.log('info', `[Dual Display] Window ${screenId} at (${windowX}, ${windowY}), size ${viewportConfig.width}x${viewportConfig.height}`);
        }
      } else {
        // 多显示器模式：保留全屏参数，确保浏览器以全屏模式启动
        // 添加窗口位置参数（如果支持）
        browserArgs.push(`--window-position=${screen.x},${screen.y}`);
        browserArgs.push(`--window-size=${screen.width},${screen.height}`);
        
        this.log('info', `[Multi Display] Screen ${screenId} will launch at (${screen.x}, ${screen.y}) with size ${screen.width}x${screen.height}`);
      }

      // 检测并使用系统Chrome
      const executablePath = this.detectChromePath();

      // 启动浏览器
      const launchOptions = {
        ...this.config.browser,
        args: browserArgs,
        ignoreDefaultArgs: ['--enable-automation'],  // 移除自动化标识
        // Screen 0 使用 null viewport 以允许全屏自适应，其他屏幕使用固定 viewport
        defaultViewport: (screenId === 0 && isSingleDisplayMode) ? null : viewportConfig,
      };

      // 如果找到了系统Chrome，使用它
      if (executablePath) {
            launchOptions.executablePath = executablePath;
      }

      const browser = await puppeteer.launch(launchOptions);
      
      // 通过CDP授予权限和注入脚本隐藏自动化特征
      const context = browser.defaultBrowserContext();
      const frontendUrl = this.config.frontendUrl || 'http://localhost:5173';
      await context.overridePermissions(frontendUrl, [
        'camera',
        'microphone',
        'notifications',
      ]);
      
      const pages = await browser.pages();
      if (pages.length > 0) {
        const firstPage = pages[0];
        await firstPage.evaluateOnNewDocument(() => {
          // 删除 navigator.webdriver 标识
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          
          // 伪装 Chrome 对象
          window.chrome = {
            runtime: {},
          };
          
          // 伪装 Permissions
          const originalQuery = window.navigator.permissions.query;
          window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
          
          // 覆盖 getUserMedia 以自动授权
          const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return originalGetUserMedia(constraints);
          };
        });
      }

      // 创建新页面
      const page = await browser.newPage();
      
      // 设置视口大小
      // Screen 0 在单显示器模式下跳过 setViewport，让全屏模式自适应
      if (screenId === 0 && isSingleDisplayMode) {
        this.log('info', `[Dual Display] Screen 0 skipping viewport setting for fullscreen auto-adapt`);
        // 不调用 setViewport()，让浏览器使用默认（已设置 defaultViewport: null）
      } else {
        await page.setViewport(viewportConfig);
      }

      // 根据模式设置窗口位置和大小
      if (isSingleDisplayMode) {
        // 单显示器模式或混合显示器模式：使用预定义的屏幕坐标
        try {
          // 对于 Screen 0（笔记本），跳过固定尺寸设置，直接设置全屏
          // 对于 Screen 1-3（外接显示器），设置固定尺寸
          if (screenId !== 0) {
            // 直接使用 createDefaultScreens() 中定义的坐标
            const windowX = screen.x;
            const windowY = screen.y;
            const windowWidth = screen.width;
            const windowHeight = screen.height;
            
            // 使用CDP协议设置窗口位置
            const client = await page.target().createCDPSession();
            const windowId = await client.send('Browser.getWindowForTarget', {
              targetId: page.target()._targetId
            });
            
            try {
              await client.send('Browser.setWindowBounds', {
                windowId: windowId.windowId,
                bounds: {
                  left: windowX,
                  top: windowY,
                  width: windowWidth,
                  height: windowHeight,
                }
              });
              this.log('info', `[Dual Display] Window ${screenId} positioned at (${windowX}, ${windowY}), size ${windowWidth}x${windowHeight}`);
            } catch (e) {
              this.log('warn', `Could not set window position for screen ${screenId}: ${e.message}`);
            }
          } else {
            // Screen 0: 不设置固定尺寸，等待后面设置全屏
            this.log('info', `[Dual Display] Screen 0 will be set to fullscreen (skipping fixed size)`);
          }
        } catch (e) {
          this.log('warn', `CDP session failed for screen ${screenId}: ${e.message}`);
        }
      } else {
        // 多显示器模式：将窗口定位到对应的显示器并全屏
        try {
          // 使用检测到的显示器坐标
          const windowX = screen.x;
          const windowY = screen.y;
          
          this.log('info', `[Multi Display] Positioning window ${screenId} to display at (${windowX}, ${windowY}), size ${screen.width}x${screen.height}`);
          
          // 使用CDP协议设置窗口位置和大小
          const client = await page.target().createCDPSession();
          const windowId = await client.send('Browser.getWindowForTarget', {
            targetId: page.target()._targetId
          });
          
          try {
            // 先设置窗口位置和大小
            await client.send('Browser.setWindowBounds', {
              windowId: windowId.windowId,
              bounds: {
                left: windowX,
                top: windowY,
                width: screen.width,
                height: screen.height,
                windowState: 'normal', // 先设置为normal，然后通过全屏参数实现全屏
              }
            });
            this.log('info', `[Multi Display] Window ${screenId} positioned at display (${windowX}, ${windowY})`);
            
            // 延迟一下，确保窗口位置设置完成
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            this.log('warn', `Could not set window position for screen ${screenId}: ${e.message}`);
            // 如果设置失败，尝试使用全屏状态
            try {
              await client.send('Browser.setWindowBounds', {
                windowId: windowId.windowId,
                bounds: {
                  windowState: 'fullscreen',
                }
              });
            } catch (e2) {
              this.log('warn', `Could not set fullscreen for screen ${screenId}: ${e2.message}`);
            }
          }
        } catch (e) {
          this.log('warn', `CDP session failed for screen ${screenId}: ${e.message}`);
        }
      }

      // 导航到前端应用
      // 使用更宽松的等待策略，避免超时
      try {
        this.log('info', `Navigating to ${url} for screen ${screenId}...`);
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        this.log('info', `Page navigation completed for screen ${screenId}`);
        
        // 等待一小段时间让React应用初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查页面内容
        const pageContent = await page.content();
        const hasRoot = pageContent.includes('id="root"');
        this.log('info', `Screen ${screenId} - Root element exists: ${hasRoot}`);
        
        // 尝试等待React应用渲染（可选，不阻塞）
        try {
          await page.waitForFunction(
            () => {
              const root = document.getElementById('root');
              return root && (root.children.length > 0 || root.innerHTML.trim().length > 0);
            },
            { timeout: 5000 }
          );
          this.log('info', `Screen ${screenId} - React app rendered`);
        } catch (e) {
          this.log('warn', `Screen ${screenId} - React app may not be fully loaded: ${e.message}`);
        }
        
      } catch (error) {
        this.log('error', `Page navigation failed for screen ${screenId}: ${error.message}`);
        // 即使失败也继续，让用户能看到页面
      }

      // 根据模式决定是否请求全屏
      if (isSingleDisplayMode) {
        // 混合显示器模式：Screen 0 全屏（笔记本），Screen 1-3 窗口模式（外接显示器）
        if (screenId === 0) {
          try {
            // 使用 CDP 设置窗口为最大化+全屏状态（无提示，占满屏幕）
            const client = await page.target().createCDPSession();
            const windowId = await client.send('Browser.getWindowForTarget', {
              targetId: page.target()._targetId
            });
            
            // 先最大化窗口
            await client.send('Browser.setWindowBounds', {
              windowId: windowId.windowId,
              bounds: {
                windowState: 'fullscreen',  // 直接设置为 fullscreen 状态，无 ESC 提示
              }
            });
            
            this.log('info', `[Dual Display] Screen ${screenId} set to fullscreen mode (laptop, no ESC prompt)`);
          } catch (e) {
            this.log('warn', `Could not set fullscreen for screen ${screenId}: ${e.message}`);
          }
        } else {
          this.log('info', `[Dual Display] Screen ${screenId} running in window mode (external display)`);
        }
      } else {
        // 多显示器模式：请求全屏
        try {
          await page.evaluate(() => {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen request failed:', err);
              });
            }
          });
          this.log('info', `[Multi Display] Screen ${screenId} requested fullscreen`);
        } catch (e) {
          this.log('warn', `Could not request fullscreen for screen ${screenId}: ${e.message}`);
        }
      }

      // 存储浏览器实例
      this.browsers.set(screenId, {
        browser,
        page,
        screen,
        startedAt: new Date(),
      });

      this.log('info', `Screen ${screenId} browser started successfully`);
      this.emit('screen_started', { screenId, screen, url });

      // 监听浏览器关闭事件
      browser.on('disconnected', () => {
        this.handleBrowserDisconnected(screenId);
      });

      return { browser, page, screen };
    } catch (error) {
      this.log('error', `Failed to start screen ${screenId}: ${error.message}`);
      this.emit('error', { screenId, error });
      throw error;
    }
  }

  /**
   * 停止指定屏幕的浏览器
   */
  async stopScreen(screenId) {
    const browserInfo = this.browsers.get(screenId);
    if (!browserInfo) {
      this.log('warn', `Screen ${screenId} not running`);
      return;
    }

    try {
      await browserInfo.browser.close();
      this.browsers.delete(screenId);
      this.log('info', `Screen ${screenId} stopped`);
      this.emit('screen_stopped', { screenId });
    } catch (error) {
      this.log('error', `Failed to stop screen ${screenId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止所有屏幕
   */
  async stopAllScreens() {
    this.log('info', 'Stopping all screens...');
    const promises = Array.from(this.browsers.keys()).map(screenId => 
      this.stopScreen(screenId)
    );
    await Promise.all(promises);
    this.log('info', 'All screens stopped');
    this.emit('all_screens_stopped');
  }

  /**
   * 重启指定屏幕
   */
  async restartScreen(screenId) {
    this.log('info', `Restarting screen ${screenId}...`);
    await this.stopScreen(screenId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    await this.startScreen(screenId);
  }

  /**
   * 处理浏览器断开连接
   */
  handleBrowserDisconnected(screenId) {
    this.log('warn', `Browser for screen ${screenId} disconnected`);
    this.browsers.delete(screenId);
    this.emit('screen_disconnected', { screenId });
    
    // 可选：自动重启
    // this.startScreen(screenId);
  }

  /**
   * 获取屏幕信息
   */
  getScreen(screenId) {
    return this.screens[screenId] || null;
  }

  /**
   * 获取所有屏幕信息
   */
  getAllScreens() {
    return this.screens;
  }

  /**
   * 获取浏览器状态
   */
  getBrowserStatus(screenId) {
    const browserInfo = this.browsers.get(screenId);
    if (!browserInfo) {
      return null;
    }

    return {
      screenId,
      screen: browserInfo.screen,
      startedAt: browserInfo.startedAt,
      uptime: Date.now() - browserInfo.startedAt.getTime(),
    };
  }

  /**
   * 获取所有浏览器状态
   */
  getAllBrowserStatus() {
    const statuses = [];
    for (let i = 0; i < this.config.count; i++) {
      statuses.push(this.getBrowserStatus(i) || { screenId: i, status: 'stopped' });
    }
    return statuses;
  }

  /**
   * 日志记录
   */
  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const logMessage = args.length > 0 
      ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`
      : message;
    console.log(`[${timestamp}] [ScreenManager] [${level.toUpperCase()}] ${logMessage}`);
  }
}

module.exports = ScreenManager;

