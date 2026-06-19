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
