// Trigger Vercel redeploy
import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.removeItem('cmTheme');
  }, []);

  const clearReminderPopupFlags = () => {
    sessionStorage.removeItem('feePopupShown');
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('finePopupShown_')) {
        sessionStorage.removeItem(key);
      }
    }
  };

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('cmUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        clearReminderPopupFlags(); // Clear popups on auto-login
      } catch (e) {
        console.error('Failed to parse user from local storage');
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    clearReminderPopupFlags(); // Clear popups on manual login
    setUser(userData);
    localStorage.setItem('cmUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cmUser');
    clearReminderPopupFlags(); // Clear popups on logout
    // Clear URL hash from the browser history/address bar
    if (window.location.hash) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
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
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
