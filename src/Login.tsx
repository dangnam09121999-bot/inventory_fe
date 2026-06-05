import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { saveAuth, type AuthUserInfo } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

type LoginProps = {
  onLoginSuccess: (user: AuthUserInfo) => void;
};

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user as AuthUserInfo;
        saveAuth(data.access_token, user);
        onLoginSuccess(user);
        navigate('/inventory', { replace: true });
      } else {
        setError('Sai tên đăng nhập hoặc mật khẩu');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">📦</div>
        <h1>Quản lý tồn kho</h1>
        <p className="login-subtitle">Đăng nhập để tiếp tục</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="login-username">Tên đăng nhập</label>
            <div className="login-input-wrap">
              <span className="login-icon" aria-hidden="true">👤</span>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="login-input-wrap">
              <span className="login-icon" aria-hidden="true">🔒</span>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </div>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-footer">© {new Date().getFullYear()} Inventory System</p>
      </div>
    </div>
  );
};

export default Login;
