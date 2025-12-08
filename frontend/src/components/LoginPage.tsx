import { useState, FormEvent, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import './LoginPage.css';

interface LoginPageProps {
  screenId: number;
  isInputEnabled: boolean;
}

function LoginPage({ screenId: _, isInputEnabled }: LoginPageProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const { login, isLoading, error } = useAuthStore();

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 获取验证码
  const handleGetCode = async () => {
    if (!phone.trim()) {
      alert('请输入手机号');
      return;
    }

    // 验证手机号格式（11位数字）
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      alert('请输入正确的手机号');
      return;
    }

    try {
      // TODO: 调用远端接口获取验证码
      // const response = await fetch('/api/auth/send-code', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ phone: `${phone}@麦擎科技` })
      // });
      
      // 模拟发送成功
      setCodeSent(true);
      setCountdown(60);
      alert(`验证码已发送到手机 ${phone}\n（调试模式：验证码为 123456）`);
    } catch (err) {
      alert('验证码发送失败，请重试');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isInputEnabled) {
      return;
    }

    if (!phone.trim() || !code.trim()) {
      return;
    }

    // 调试模式：支持 13800138000 + 123456
    const username = `${phone}@麦擎科技`;
    
    // TODO: 调用远端认证接口
    // const response = await fetch('/api/auth/verify', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone: username, code })
    // });
    
    // 暂时使用密码登录逻辑，将验证码作为密码传入
    await login(username, code);
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
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="phone">手机号</label>
                <div className="input-with-suffix">
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="请输入手机号"
                    disabled={isLoading}
                    autoFocus
                    className="phone-input"
                    maxLength={11}
                  />
                  <span className="input-suffix">@麦擎科技</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="code">验证码</label>
                <div className="code-input-group">
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入验证码"
                    disabled={isLoading}
                    maxLength={6}
                    className="code-input"
                  />
                  <button
                    type="button"
                    className="get-code-btn"
                    onClick={handleGetCode}
                    disabled={countdown > 0 || !phone || isLoading}
                  >
                    {countdown > 0 ? `${countdown}秒后重试` : (codeSent ? '重新获取' : '获取验证码')}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">{error}</div>
              )}

              <button 
                type="submit" 
                className="login-button"
                disabled={isLoading || !phone.trim() || !code.trim()}
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            </form>
          ) : (
            <div className="login-waiting">
              <div className="waiting-icon">🔒</div>
              <h2>请登录</h2>
              <p>请在控制屏上输入手机号和验证码</p>
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

