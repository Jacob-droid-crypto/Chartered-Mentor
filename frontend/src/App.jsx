import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('cmTheme');
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cmTheme', theme);
  }, [theme]);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('cmUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user from local storage');
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    sessionStorage.removeItem('feePopupShown');
    setUser(userData);
    localStorage.setItem('cmUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cmUser');
    sessionStorage.removeItem('feePopupShown');
  };

  // Intercept all fetch requests to catch 401 Unauthorized responses (invalid/expired tokens)
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (resource, config) => {
      try {
        const response = await originalFetch(resource, config);
        if (response.status === 401) {
          const urlStr = typeof resource === 'string' ? resource : resource?.url || '';
          // Avoid logging out on failed login attempts or Google verification
          const isAuthRoute = urlStr.includes('/login') || urlStr.includes('/verify-google');
          if (!isAuthRoute && localStorage.getItem('cmUser')) {
            handleLogout();
          }
        }
        return response;
      } catch (err) {
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId="229928991678-vi5f91bp2o0b0vm2cboef14659a7gm6a.apps.googleusercontent.com">
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
