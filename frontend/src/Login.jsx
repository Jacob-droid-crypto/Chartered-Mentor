import React, { useState, useEffect } from 'react';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' or 'admin'
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password states
  const [view, setView] = useState('login'); // login, forgot, reset
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('resetToken');
    const userParam = params.get('userId');

    if (tokenParam && userParam) {
      setUserId(userParam);
      setOtp(tokenParam);
      setView('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    // If it takes more than 3 seconds, it's likely a Render cold start. Let's tell the user.
    const slowLoadingTimer = setTimeout(() => {
      setMsg('Waking up the server... This might take up to 30 seconds on the first login. Please wait.');
    }, 3000);

    try {
      const endpoint = role === 'admin' ? '/admin/login' : '/student/login';
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error('Server took too long to respond. The backend may be waking up, please try again.');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      clearTimeout(slowLoadingTimer);
      
      // Pass token and user data back to App
      onLoginSuccess({
        token: data.token,
        role: role,
        userId: data.studentId || userId,
        name: data.name || 'Admin',
      });
      
    } catch (err) {
      clearTimeout(slowLoadingTimer);
      setError(err.message);
      setMsg('');
    } finally {
      clearTimeout(slowLoadingTimer);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Server took too long to respond. The backend may be waking up, please try again.');
      }
      
      if (!response.ok) throw new Error(data.message || 'Failed to request password reset');

      setMsg(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token: otp, newPassword }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Server took too long to respond. The backend may be waking up, please try again.');
      }
      if (!response.ok) throw new Error(data.message || 'Failed to reset password');

      setMsg(data.message);
      setTimeout(() => {
        setView('login');
        setPassword('');
        setOtp('');
        setNewPassword('');
        setMsg('');
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Aesthetic Sparkles */}
      <div className="sparkle" style={{ top: '20%', left: '15%', animationDelay: '0s' }}></div>
      <div className="sparkle" style={{ top: '60%', left: '10%', animationDelay: '1.5s' }}></div>
      <div className="sparkle" style={{ top: '30%', right: '20%', animationDelay: '0.5s' }}></div>
      <div className="sparkle" style={{ top: '75%', right: '15%', animationDelay: '2s' }}></div>
      
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Chartered Mentor Logo" style={{ width: '180px', height: 'auto', margin: '0 auto 1rem auto', display: 'block' }} />
          <h2>
            {view === 'login' ? 'Welcome Back ✨' : view === 'forgot' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p>
            {view === 'login' ? 'Sign in to your beautiful dashboard' : view === 'forgot' ? 'Enter your User ID to receive a reset link' : 'Enter your new secure password'}
          </p>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {msg && <div className="success-msg">{msg}</div>}

        {view === 'login' && (
          <form onSubmit={handleSubmit}>
            <div className="role-toggle">
              <button 
                type="button"
                className={`role-btn ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >Student</button>
              <button 
                type="button"
                className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                onClick={() => setRole('admin')}
              >Admin</button>
            </div>

            <div className="input-group">
              <label>User ID</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={role === 'admin' ? 'e.g. ADMIN001' : 'Student ID'}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {role === 'student' && (
                <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => setView('forgot')} className="forgot-link">
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div className="input-group">
              <label>User ID</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter Student ID"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="input-group">
              <label>New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Processing...' : 'Reset Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
