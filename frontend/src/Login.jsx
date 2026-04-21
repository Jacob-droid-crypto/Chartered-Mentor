import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' or 'admin'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1rem auto' }}>CM</div>
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)' }}>Login to access your dashboard</p>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

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
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.3s' }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
