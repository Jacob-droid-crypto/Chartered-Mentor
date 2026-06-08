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
  const [view, setView] = useState('login'); // login, google_verify, force_reset, forgot_role_select, forgot_email, forgot_otp
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState(null);
  const [resetRole, setResetRole] = useState('student');

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

    try {
      const endpoint = role === 'admin' ? '/admin/login' : '/student/login';
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      
      if (data.firstLogin && role === 'student') {
        setView('force_reset');
        setMsg('This is your first login. Please set a new password to continue.');
        setLoading(false);
        return;
      }

      // Pass token and user data back to App
      onLoginSuccess({
        token: data.token,
        role: data.role || role,
        userId: data.studentId || userId,
        name: data.name || (role === 'admin' ? 'Admin' : 'Student'),
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
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

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update password');

      setMsg('Password saved successfully! Logging you in...');
      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: resetRole }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send OTP');

      setView('forgot_otp');
      setMsg('OTP sent! Please check your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);

    try {
      const response = await fetch('/student/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp, newPassword, role: resetRole }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Reset failed');

      setMsg('Password reset successfully! Redirecting to login...');
      setTimeout(() => setView('login'), 2000);
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
          <img src="/logo.png" alt="Chartered Mentor Logo" style={{ width: '280px', height: 'auto', margin: '0 auto 1.5rem auto', display: 'block' }} />
          <h2>
            {view === 'login' ? 'Welcome Back ✨' 
              : view === 'google_verify' ? 'Verify Identity' 
              : view.startsWith('forgot') ? 'Reset Password' 
              : 'Set New Password'}
          </h2>
          <p>
            {view === 'login' ? 'Sign in to your beautiful dashboard' 
              : view === 'google_verify' ? 'Use your registered Google account to verify.' 
              : view === 'forgot_role_select' ? 'Who are you resetting the password for?'
              : view === 'forgot_email' ? 'Enter your ID to receive an OTP.'
              : view === 'forgot_otp' ? 'Enter the OTP sent to your email.'
              : 'Create a secure password to use for login.'}
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
              <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => {
                  if (role === 'admin') {
                    setView('forgot_role_select');
                  } else {
                    setResetRole('student');
                    setView('forgot_email');
                  }
                }} className="forgot-link">
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {view === 'forgot_role_select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button 
              type="button" 
              className="submit-btn" 
              onClick={() => { setResetRole('admin'); setView('forgot_email'); }}
              style={{ background: '#3b82f6' }}
            >
              Reset Admin Password
            </button>
            <button 
              type="button" 
              className="submit-btn" 
              onClick={() => { setResetRole('student'); setView('forgot_email'); }}
            >
              Reset Student Password
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Back to Login
              </button>
            </div>
          </div>
        )}

        {view === 'forgot_email' && (
          <form onSubmit={handleSendOtp}>
            <div className="input-group">
              <label>{resetRole === 'admin' ? 'Admin ID' : 'Student ID'}</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your ID"
                required
              />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending Email...' : 'Send OTP'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {view === 'forgot_otp' && (
          <form onSubmit={handleVerifyOtpAndReset}>
            <div className="input-group">
              <label>6-Digit OTP</label>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP from email"
                required
              />
            </div>
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
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" onClick={() => setView('login')} className="forgot-link" style={{ color: '#64748b' }}>
                Cancel
              </button>
            </div>
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
