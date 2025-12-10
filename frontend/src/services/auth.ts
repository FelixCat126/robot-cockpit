/**
 * 认证服务
 * 负责用户登录、登出和认证状态管理
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'robot_cockpit_token';
  private readonly AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3000/api/auth/login';

  /**
   * 登录
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(this.AUTH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存token
        if (data.token) {
          localStorage.setItem(this.TOKEN_KEY, data.token);
        }
        // 保存登录状态
        localStorage.setItem('robot_cockpit_logged_in', 'true');
        return { success: true, token: data.token };
      } else {
        return { 
          success: false, 
          message: data.message || '手机号或验证码错误' 
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: '手机号或验证码错误' 
      };
    }
  }

  /**
   * 登出
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('robot_cockpit_logged_in');
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return localStorage.getItem('robot_cockpit_logged_in') === 'true';
  }

  /**
   * 获取token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
}

// 创建单例
const authService = new AuthService();

export default authService;

