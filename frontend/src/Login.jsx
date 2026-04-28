import React, { useState, useEffect } from 'react';

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

    try {
      const endpoint = role === 'admin' ? '/admin/login' : '/student/login';
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Pass token and user data back to App
      onLoginSuccess({
        token: data.token,
        role: role,
        userId: data.studentId || userId,
        name: data.name || 'Admin',
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
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

      const data = await response.json();
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

      const data = await response.json();
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100vw', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Chartered Mentor Logo" style={{ width: '180px', height: 'auto', margin: '0 auto 1rem auto', display: 'block' }} />
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            {view === 'login' ? 'Welcome Back' : view === 'forgot' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            {view === 'login' ? 'Login to access your dashboard' : view === 'forgot' ? 'Enter your User ID to receive a reset link' : 'Enter your new password below'}
          </p>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
        {msg && <div style={{ background: '#d1fae5', color: '#059669', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{msg}</div>}

        {view === 'login' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', padding: '0.25rem' }}>
              <button 
                type="button"
                onClick={() => setRole('student')}
                style={{ flex: 1, padding: '0.5rem', border: 'none', background: role === 'student' ? 'white' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: role === 'student' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: role === 'student' ? '600' : '500', boxShadow: role === 'student' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Student</button>
              <button 
                type="button"
                onClick={() => setRole('admin')}
                style={{ flex: 1, padding: '0.5rem', border: 'none', background: role === 'admin' ? 'white' : 'transparent', borderRadius: '6px', cursor: 'pointer', color: role === 'admin' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: role === 'admin' ? '600' : '500', boxShadow: role === 'admin' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
              >Admin</button>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>User ID</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={role === 'admin' ? 'e.g. ADMIN001' : 'Student ID'}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', outline: 'none', color: 'var(--text-main)', fontSize: '1rem' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', outline: 'none', color: 'var(--text-main)', fontSize: '1rem' }}
                required
              />
              {role === 'student' && (
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setView('forgot')} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.3s' }}
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>User ID</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Student ID"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', outline: 'none', color: 'var(--text-main)', fontSize: '1rem' }}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.3s' }}
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.5)', outline: 'none', color: 'var(--text-main)', fontSize: '1rem' }}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.3s' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
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
