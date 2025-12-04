import { useState, FormEvent } from 'react';
import { useAuthStore } from '../stores/authStore';
import './LoginPage.css';

interface LoginPageProps {
  screenId: number;
  isInputEnabled: boolean; // 是否允许输入（只有触摸屏可以）
}

function LoginPage({ screenId, isInputEnabled }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();

  // screenId 用于区分不同屏幕，虽然不显示但保留参数
  console.log('[LoginPage] Screen', screenId, 'isInputEnabled:', isInputEnabled);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isInputEnabled) {
      return; // 非触摸屏不允许提交
    }

    if (!username.trim() || !password.trim()) {
      return;
    }

    await login(username, password);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Robot Cockpit</h1>
          <p>机器人驾驶舱系统</p>
        </div>

        <div className="login-content">
          {isInputEnabled ? (
            // 触摸屏：显示登录表单
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username">用户名</label>
                <div className="input-with-suffix">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入手机号"
                  disabled={isLoading}
                  autoFocus
                    className="username-input"
                />
                  <span className="input-suffix">@麦擎科技</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">密码</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="error-message">{error}</div>
              )}

              <button 
                type="submit" 
                className="login-button"
                disabled={isLoading || !username.trim() || !password.trim()}
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            </form>
          ) : (
            // 非触摸屏：显示等待登录提示
            <div className="login-waiting">
              <div className="waiting-icon">🔒</div>
              <h2>请登录</h2>
              <p>请在控制屏上输入用户名和密码</p>
            </div>
          )}
        </div>

        <div className="login-footer">
          <p>系统版本 1.0.0</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

