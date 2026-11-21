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

  // Dynamic Daily Ads & Spotlight Carousel
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const instituteAds = [
    {
      badge: '🚀 ADMISSIONS OPEN 2026–27',
      badgeColor: '#38bdf8',
      title: 'Target CA Intermediate & Final: Fast-Track Mentorship Batches',
      desc: 'Join South India\'s premier CA mentoring ecosystem with personalized 1-on-1 faculty guidance, daily chapter-wise test series, and dedicated study cabins.',
      features: [
        '✨ Dedicated Personal Study Cabins',
        '📚 Curated ICAI Question Bank & Notes',
        '🎯 100% Supervised Daily Study Hours'
      ],
      tag: '🔥 Limited Seats Remaining'
    },
    {
      badge: '🏆 PROVEN TRACK RECORD',
      badgeColor: '#facc15',
      title: 'Over 95% Pass Rate in Chartered Mentor Test Series',
      desc: 'Our disciplined 3-tier revision blueprint has consistently produced All India Rank holders and first-attempt qualifiers across CA Foundation, Inter, and Final.',
      features: [
        '🥇 Mentoring from Qualified Chartered Accountants',
        '📈 Continuous Performance & Percentile Analytics',
        '🎯 Targeted Rank Improvement Masterclasses'
      ],
      tag: '⭐ Excellence in CA Coaching'
    },
    {
      badge: '✍️ SAME-DAY PAPER EVALUATION',
      badgeColor: '#4ade80',
      title: 'Daily Answer Writing Evaluated Within 24 Hours',
      desc: 'Every mock exam paper is meticulously evaluated with step-wise marks, presentation critiques, and actionable feedback before your next study session.',
      features: [
        '📝 ICAI Standard Step-by-Step Marking',
        '💡 Presentation & Working Note Polishing',
        '🔍 Direct 1-on-1 Error Rectification'
      ],
      tag: '⚡ 24-Hour Feedback Turnaround'
    },
    {
      badge: '💺 WORLD-CLASS STUDY ENVIRONMENT',
      badgeColor: '#c084fc',
      title: 'Silent Individual Cabins & Full Campus Amenities',
      desc: 'Experience complete focus in ergonomic air-conditioned cabins, high-speed fiber internet, reference libraries, and hygienic dining facilities.',
      features: [
        '🤫 100% Distraction-Free Silent Study Zones',
        '🌐 High-Speed Research WiFi & Power Hubs',
        '☕ Refreshment Lounges & Break Areas'
      ],
      tag: '📍 Elite Campus Infrastructure'
    },
    {
      badge: '🎯 ICAI EXAM SIMULATION',
      badgeColor: '#fb923c',
      title: 'Full-Length 3-Hour Mock Exams with Invigilation',
      desc: 'Master exam temperament with exact hall simulation, strict invigilation, suggested answer keys, and comparative rank lists.',
      features: [
        '⏱️ Authentic 3-Hour Exam Hall Environment',
        '📊 Percentile Benchmarking Across Cohorts',
        '🏅 Model Answer Sheets for High Scorers'
      ],
      tag: '📅 Scheduled Exam Simulation'
    }
  ];

  // Auto-rotate ads every 5.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % instituteAds.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [instituteAds.length]);

  // Daily Date & Google-Style Day-of-the-Week Focus
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentDayName = dayNames[today.getDay()];
  const formattedDate = `${currentDayName}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

  const dailyThemes = {
    Sunday: '✨ Sunday Master Strategy: Concept Consolidation & Target Setting',
    Monday: '🚀 Monday Power Launch: High-Yield Chapter Targets for the Week',
    Tuesday: '💡 Tuesday Practical Drill: Problem Solving & Question Formulations',
    Wednesday: '⚡ Midweek Momentum: Intensive Answer Speed & Working Notes',
    Thursday: '🎯 Thursday Deep Dive: ICAI Case Scenarios & Standards on Auditing',
    Friday: '📊 Friday Review: Faculty Evaluation & 1-on-1 Feedback',
    Saturday: '📝 Saturday Mock Marathon: Full 3-Hour Exam Hall Simulation'
  };
  const todaySpecial = dailyThemes[currentDayName] || '🎯 Precision Mentorship & Daily Evaluation';

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
    <div className="login-split-layout">
      {/* Left Showcase Hero Panel (PC Only: >= 960px) */}
      <aside className="login-hero-panel">
        <div className="login-hero-circle login-hero-circle-1" />
        <div className="login-hero-circle login-hero-circle-2" />
        
        <div className="login-hero-inner">
          {/* Top Brand Bar: Prominent Official Logo & Dynamic Live Date */}
          <div className="login-hero-brand">
            <div className="login-hero-logo-box">
              <img 
                src="/logo.png" 
                alt="Chartered Mentor" 
                className="login-hero-brand-logo" 
              />
            </div>
            <div className="login-hero-daily-pill">
              <span className="live-pulse-dot" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Daily Google-Style Doodle / Today's Special Focus Banner */}
          <div className="login-hero-day-spotlight">
            <span className="spotlight-badge">Daily Focus</span>
            <span className="spotlight-text">{todaySpecial}</span>
          </div>

          {/* Dynamic Rotating Institute Ad Card */}
          <div className="login-hero-ad-container">
            <div className="ad-card-wrapper" key={currentAdIndex}>
              <div className="ad-card-header">
                <span 
                  className="ad-card-badge" 
                  style={{ color: instituteAds[currentAdIndex].badgeColor, borderColor: instituteAds[currentAdIndex].badgeColor }}
                >
                  {instituteAds[currentAdIndex].badge}
                </span>
                <span className="ad-card-tag">
                  {instituteAds[currentAdIndex].tag}
                </span>
              </div>

              <h2 className="ad-card-title">
                {instituteAds[currentAdIndex].title}
              </h2>
              
              <p className="ad-card-desc">
                {instituteAds[currentAdIndex].desc}
              </p>

              <div className="ad-card-features">
                {instituteAds[currentAdIndex].features.map((feat, idx) => (
                  <div key={idx} className="ad-feature-pill">
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            {/* Carousel Navigation: Dots & Manual Next */}
            <div className="ad-carousel-nav">
              <div className="ad-dots">
                {instituteAds.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`ad-dot ${idx === currentAdIndex ? 'active' : ''}`}
                    onClick={() => setCurrentAdIndex(idx)}
                    aria-label={`View Highlight ${idx + 1}`}
                  />
                ))}
              </div>
              <button 
                type="button" 
                className="ad-next-btn"
                onClick={() => setCurrentAdIndex((prev) => (prev + 1) % instituteAds.length)}
              >
                Next Highlight ❯
              </button>
            </div>
          </div>

          {/* Footer Note */}
          <div className="login-hero-footer-note">
            <span>Chartered Mentor • Educate. Elevate. Excel.</span>
            <span className="footer-contact">Admissions & Support: +91 90726 22204</span>
          </div>
        </div>
      </aside>

      {/* Right Form Panel (PC & Mobile) */}
      <main className="login-form-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-brand">
              <img 
                src="/logo.png" 
                alt="Chartered Mentor Logo" 
                className="login-card-logo-img" 
              />
            </div>
            <h2>
              {view === 'login' ? 'Welcome Back' 
                : view === 'google_verify' ? 'Verify Identity' 
                : view.startsWith('forgot') ? 'Reset Password' 
                : 'Set New Password'}
            </h2>
            <p>
              {view === 'login' ? 'Sign in to access your campus dashboard & study records' 
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
              >
                <span>🎓</span> Student
              </button>
              <button 
                type="button"
                className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                onClick={() => setRole('admin')}
              >
                <span>🛡️</span> Admin
              </button>
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
      </main>
    </div>
  );
}

export default Login;
