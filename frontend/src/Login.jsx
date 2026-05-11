import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' or 'admin'
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // States for new flows
  const [view, setView] = useState('login'); // login, google_verify, force_reset
  const [newPassword, setNewPassword] = useState('');
  const [tempToken, setTempToken] = useState(null);

  useEffect(() => {
    // Check if user is clicking a setup link from their email
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'true') {
       setView('google_verify');
       if (params.get('userId')) setUserId(params.get('userId'));
       setMsg('Welcome! Please verify your identity with Google to set up your account.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

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
      
      if (data.firstLogin && role === 'student') {
        setView('force_reset');
        setMsg('This is your first login. Please set a new password to continue.');
        setLoading(false);
        return;
      }

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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Google Verification failed');
      }

      setUserId(data.userId);
      setTempToken(data.tempToken);
      setView('force_reset');
      setMsg('Identity verified! You can now set a new password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Server took too long to respond. The backend may be waking up, please try again.');
      }
      
      if (!response.ok) throw new Error(data.message || 'Failed to update password');

      setMsg('Password saved successfully! Logging you in...');
      
      // Attempt to login automatically
      setTimeout(async () => {
        try {
          const loginResponse = await fetch('/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password: newPassword }),
          });
          const loginData = await loginResponse.json();
          if (loginResponse.ok) {
            // Remove URL params if they existed
            window.history.replaceState({}, document.title, window.location.pathname);
            
            onLoginSuccess({
              token: loginData.token,
              role: role,
              userId: loginData.studentId || userId,
              name: loginData.name || 'Admin',
            });
          } else {
            setView('login');
            setPassword('');
          }
        } catch (err) {
          setView('login');
          setPassword('');
        }
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="sparkle" style={{ top: '20%', left: '15%', animationDelay: '0s' }}></div>
      <div className="sparkle" style={{ top: '60%', left: '10%', animationDelay: '1.5s' }}></div>
      <div className="sparkle" style={{ top: '30%', right: '20%', animationDelay: '0.5s' }}></div>
      <div className="sparkle" style={{ top: '75%', right: '15%', animationDelay: '2s' }}></div>
      
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Chartered Mentor Logo" style={{ width: '180px', height: 'auto', margin: '0 auto 1rem auto', display: 'block' }} />
          <h2>
            {view === 'login' ? 'Welcome Back ✨' : view === 'google_verify' ? 'Verify Identity' : 'Set New Password'}
          </h2>
          <p>
            {view === 'login' ? 'Sign in to your beautiful dashboard' : view === 'google_verify' ? 'Use your registered Google account to verify.' : 'Create a secure password to use for login.'}
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
                  <button type="button" onClick={() => setView('google_verify')} className="forgot-link">
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

        {view === 'google_verify' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Google Login Failed. Please try again.');
              }}
              useOneTap
              theme="filled_blue"
              shape="pill"
              text="continue_with"
            />
            <div style={{ textAlign: 'center', marginTop: '1.5rem', width: '100%' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Back to Login
              </button>
            </div>
          </div>
        )}

        {view === 'force_reset' && (
          <form onSubmit={handleForceResetPassword}>
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
              {loading ? 'Processing...' : 'Save Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
