import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function SettingsTab({
  user,
  campusQRConfig,
  refreshCampusQR,
  autoRotate,
  setAutoRotate,
}) {
  const [subTab, setSubTab] = useState('networks'); // 'networks' | 'qr' | 'system'
  const [networks, setNetworks] = useState([]);
  const [currentClientIp, setCurrentClientIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [serverOnline, setServerOnline] = useState(null); // null = checking, true = online, false = offline
  const [loadError, setLoadError] = useState('');

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNetName, setNewNetName] = useState('');
  const [newNetIp, setNewNetIp] = useState('');
  const [newNetDesc, setNewNetDesc] = useState('');

  // Restart states
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState(0);

  // Get active token safely
  const getToken = useCallback(() => {
    if (user?.token) return user.token;
    try {
      const stored = localStorage.getItem('cmUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.token || '';
      }
    } catch (e) {
      // ignore
    }
    return '';
  }, [user]);

  // Fetch networks and verify server connectivity
  const fetchNetworks = useCallback(async (isManualRetry = false) => {
    const token = getToken();
    if (!token) {
      setLoadError('Admin authentication token is missing. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setLoadError('');
      const res = await fetch('/admin/networks', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch (_) {
          // not JSON
        }
        setServerOnline(false);
        setLoadError(errMsg);
        if (isManualRetry) {
          showNotification('error', errMsg);
        }
        return;
      }

      const data = await res.json();
      setNetworks(data.networks || []);
      setServerOnline(true);
      if (data.currentClientIp) {
        setCurrentClientIp(data.currentClientIp);
      }
      if (isManualRetry) {
        showNotification('success', 'Connected to backend successfully!');
      }
    } catch (err) {
      console.error('Fetch networks error:', err);
      setServerOnline(false);
      setLoadError('Unable to connect to backend server. Please verify backend service is running.');
      if (isManualRetry) {
        showNotification('error', 'Backend is currently offline or unreachable.');
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  const showNotification = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg({ type: '', text: '' });
    }, 4500);
  };

  // Add new network
  const handleAddNetwork = async (e) => {
    if (e) e.preventDefault();
    const token = getToken();
    if (!newNetName.trim() || !newNetIp.trim()) {
      showNotification('error', 'Network name and IP / Subnet pattern are required.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch('/admin/networks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newNetName.trim(),
          ipOrRange: newNetIp.trim(),
          description: newNetDesc.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', `Network "${newNetName}" added successfully!`);
        setNewNetName('');
        setNewNetIp('');
        setNewNetDesc('');
        setShowAddModal(false);
        fetchNetworks();
      } else {
        showNotification('error', data.message || 'Failed to add network.');
      }
    } catch (err) {
      console.error('Add network error:', err);
      showNotification('error', 'Network error while adding authorized IP.');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick add current IP
  const handleQuickAddCurrentIp = () => {
    if (!currentClientIp) {
      showNotification('error', 'Could not detect your current IP address.');
      return;
    }
    setNewNetName('Admin Campus Wi-Fi');
    setNewNetIp(currentClientIp);
    setNewNetDesc('Auto-detected current connected IP');
    setShowAddModal(true);
  };

  // Toggle active/inactive
  const handleToggleActive = async (net) => {
    const token = getToken();
    try {
      setActionLoading(true);
      const res = await fetch(`/admin/networks/${net._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !net.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNetworks((prev) =>
          prev.map((n) => (n._id === net._id ? { ...n, isActive: !net.isActive } : n))
        );
        showNotification(
          'success',
          `Network "${net.name}" is now ${!net.isActive ? 'Active' : 'Disabled'}.`
        );
      } else {
        showNotification('error', data.message || 'Failed to update network status.');
      }
    } catch (err) {
      console.error('Toggle network error:', err);
      showNotification('error', 'Error updating network.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete network
  const handleDeleteNetwork = async (id, name) => {
    const token = getToken();
    if (!window.confirm(`Are you sure you want to remove network "${name}" from authorized list?`)) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`/admin/networks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setNetworks((prev) => prev.filter((n) => n._id !== id));
        showNotification('success', `Network "${name}" removed successfully.`);
      } else {
        showNotification('error', data.message || 'Failed to delete network.');
      }
    } catch (err) {
      console.error('Delete network error:', err);
      showNotification('error', 'Error deleting network.');
    } finally {
      setActionLoading(false);
    }
  };

  // Restart backend
  const handleRestartBackend = async () => {
    const token = getToken();
    try {
      setIsRestarting(true);
      setRestartCountdown(5);
      const res = await fetch('/admin/system/restart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowRestartModal(false);

      if (res.ok) {
        showNotification('success', 'Backend restart signal sent! Reconnecting in a few seconds...');
        const timer = setInterval(() => {
          setRestartCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setIsRestarting(false);
              fetchNetworks();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setIsRestarting(false);
        showNotification('error', 'Failed to trigger backend restart.');
      }
    } catch (err) {
      console.error('Restart error:', err);
      setIsRestarting(false);
      showNotification('success', 'Restart initiated. Server is reloading...');
      setTimeout(() => {
        fetchNetworks();
      }, 3500);
    }
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>⚙️</span> Institute Settings & Access Control
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.95rem' }}>
            Configure authorized Wi-Fi networks for student attendance, dynamic campus QR codes, and system operations.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-bg, #f1f5f9)', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--glass-border, #e2e8f0)' }}>
          <button
            type="button"
            onClick={() => setSubTab('networks')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: subTab === 'networks' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: subTab === 'networks' ? '#ffffff' : 'var(--text-main, #334155)',
              boxShadow: subTab === 'networks' ? '0 2px 6px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            📶 Campus Wi-Fi & IPs
          </button>
          <button
            type="button"
            onClick={() => setSubTab('qr')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: subTab === 'qr' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: subTab === 'qr' ? '#ffffff' : 'var(--text-main, #334155)',
              boxShadow: subTab === 'qr' ? '0 2px 6px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            🔲 Attendance QR Codes
          </button>
          <button
            type="button"
            onClick={() => setSubTab('system')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              background: subTab === 'system' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: subTab === 'system' ? '#ffffff' : 'var(--text-main, #334155)',
              boxShadow: subTab === 'system' ? '0 2px 6px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            ⚡ System & Restart
          </button>
        </div>
      </div>

      {/* Action Toast / Status Alert */}
      {statusMsg.text && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: statusMsg.type === 'error' ? '#dc2626' : '#059669',
            border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <span>{statusMsg.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* SUB-TAB 1: CAMPUS WI-FI & IP MANAGEMENT */}
      {subTab === 'networks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Info & Action Bar */}
          <div
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.2rem',
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                📡
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                  Current Connected Admin IP
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', fontFamily: 'monospace', marginTop: '2px' }}>
                  {currentClientIp || (serverOnline === false ? 'Offline / Not Connected' : 'Detecting...')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {currentClientIp && (
                <button
                  type="button"
                  onClick={handleQuickAddCurrentIp}
                  disabled={actionLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.15rem',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                  }}
                >
                  ⚡ Quick Add My IP ({currentClientIp})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewNetName('');
                  setNewNetIp('');
                  setNewNetDesc('');
                  setShowAddModal(true);
                }}
                disabled={actionLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  background: 'var(--primary, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                ➕ Add New Wi-Fi / IP Range
              </button>
            </div>
          </div>

          {/* Guidelines info card */}
          <div
            style={{
              padding: '0.9rem 1.2rem',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px dashed rgba(59, 130, 246, 0.25)',
              fontSize: '0.88rem',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}
          >
            <strong style={{ color: 'var(--text-main)' }}>💡 How Attendance Wi-Fi Validation Works:</strong> When students scan the campus QR code, their device IP is instantly matched against the active rules below. You can specify single public/private IPs (e.g. <code>103.182.166.206</code>), wildcard subnets (e.g. <code>103.182.166.*</code>), prefixes (e.g. <code>103.182.166.</code>), or CIDR subnets (e.g. <code>192.168.1.0/24</code>).
          </div>

          {/* Networks List Card */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span> Authorized Wi-Fi Networks ({networks.length})
              </h3>
              <button
                type="button"
                onClick={() => fetchNetworks(true)}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border, #e2e8f0)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}
              >
                🔄 Refresh List
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                Loading authorized networks...
              </div>
            ) : loadError ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(239, 68, 68, 0.04)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                <h4 style={{ margin: '0 0 0.4rem 0', color: '#dc2626' }}>Backend Connection Notice</h4>
                <p style={{ maxWidth: '500px', margin: '0 auto 1.2rem auto', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => fetchNetworks(true)}
                  style={{
                    padding: '0.55rem 1.2rem',
                    background: 'var(--primary, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                  }}
                >
                  🔄 Retry Connection
                </button>
              </div>
            ) : networks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📶</div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>No custom Wi-Fi networks configured yet</h4>
                <p style={{ maxWidth: '480px', margin: '0 auto 1.2rem auto', fontSize: '0.9rem' }}>
                  The backend is currently using default institutional fallback ranges. Add your campus Wi-Fi router's public or local IP here to ensure seamless attendance marking.
                </p>
                {currentClientIp && (
                  <button
                    type="button"
                    onClick={handleQuickAddCurrentIp}
                    style={{
                      padding: '0.65rem 1.25rem',
                      background: 'var(--primary, #3b82f6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    ⚡ Authorize Current Wi-Fi IP ({currentClientIp})
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border, #e2e8f0)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Network / Wi-Fi Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>IP / Subnet Range</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Description</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Added By / Date</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networks.map((net) => (
                      <tr
                        key={net._id}
                        style={{
                          borderBottom: '1px solid var(--glass-border, #f1f5f9)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>📶</span> {net.name}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              fontSize: '0.92rem',
                              background: 'rgba(59, 130, 246, 0.08)',
                              color: '#2563eb',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                            }}
                          >
                            {net.ipOrRange}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {net.description || '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(net)}
                            disabled={actionLoading}
                            style={{
                              padding: '0.3rem 0.75rem',
                              borderRadius: '20px',
                              border: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: net.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                              color: net.isActive ? '#059669' : '#64748b',
                              transition: 'all 0.2s',
                            }}
                            title="Click to toggle active status"
                          >
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: net.isActive ? '#10b981' : '#94a3b8' }}></span>
                            {net.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <div>{net.addedBy || 'Admin'}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                            {net.createdAt ? new Date(net.createdAt).toLocaleDateString() : ''}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteNetwork(net._id, net.name)}
                            disabled={actionLoading}
                            style={{
                              padding: '0.45rem 0.85rem',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#dc2626',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.82rem',
                              transition: 'all 0.2s',
                            }}
                            title="Delete this network"
                          >
                            🗑️ Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CAMPUS ATTENDANCE QR CODES */}
      {subTab === 'qr' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Dynamic Campus Attendance QR Codes</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.9rem' }}>
                Display these codes at reception / front desk. Codes change dynamically to prevent off-campus spoofing.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--card-bg, white)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                🔄 Auto-rotate codes (15s)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem' }}>
            {/* LOG IN QR */}
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative', borderRadius: '20px' }}>
              <div style={{ display: 'inline-flex', padding: '0.35rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                ARRIVAL (CHECK-IN)
              </div>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
                <QRCodeSVG value={campusQRConfig?.activeInToken || 'CM-ATTENDANCE-IN'} size={220} />
              </div>
              <button
                type="button"
                onClick={() => refreshCampusQR('IN')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
              >
                🔄 Rotate Check-IN QR
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Students scan this at reception to mark their morning/arrival time.
              </p>
            </div>

            {/* LOG OUT QR */}
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative', borderRadius: '20px' }}>
              <div style={{ display: 'inline-flex', padding: '0.35rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                DEPARTURE (CHECK-OUT)
              </div>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
                <QRCodeSVG value={campusQRConfig?.activeOutToken || 'CM-ATTENDANCE-OUT'} size={220} />
              </div>
              <button
                type="button"
                onClick={() => refreshCampusQR('OUT')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
              >
                🔄 Rotate Check-OUT QR
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Students scan this when exiting the campus to calculate daily hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SERVER OPERATIONS & RESTART */}
      {subTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '2rem', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                🔄
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Backend Server Maintenance</h3>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Reload backend services, flush stale memory caches, and refresh server processes.
                </p>
              </div>
            </div>

            {/* Health / Info Box */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.75rem',
                padding: '1.25rem',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: '12px',
                border: '1px solid var(--glass-border, #e2e8f0)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Server Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', color: isRestarting ? '#f59e0b' : serverOnline === true ? '#10b981' : serverOnline === false ? '#dc2626' : '#64748b', marginTop: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRestarting ? '#f59e0b' : serverOnline === true ? '#10b981' : serverOnline === false ? '#dc2626' : '#94a3b8' }}></span>
                  {isRestarting ? `Restarting (${restartCountdown}s)...` : serverOnline === true ? 'Online & Healthy' : serverOnline === false ? 'Offline / Unreachable' : 'Checking Connection...'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configured Wi-Fi Rules</div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
                  {serverOnline === false ? '—' : `${networks.length} Active Rules`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Timezone</div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
                  Asia/Kolkata (IST +5:30)
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #ef4444', borderRadius: '8px', marginBottom: '1.75rem', fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
              <strong>⚠️ Administrator Notice:</strong> Triggering a server restart will gracefully restart the Node.js backend instance. Active student connections will seamlessly reconnect within 1–2 seconds.
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowRestartModal(true)}
                disabled={isRestarting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.85rem 1.6rem',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isRestarting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.2s',
                  opacity: isRestarting ? 0.6 : 1,
                }}
              >
                <span>{isRestarting ? '⏳' : '🔄'}</span>
                <span>{isRestarting ? `Server Reloading (${restartCountdown}s)...` : 'Restart Backend Server'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchNetworks(true)}
                disabled={loading || isRestarting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.85rem 1.25rem',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                }}
              >
                🔄 Test Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NETWORK MODAL */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '2rem',
              borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📶</span> Add Authorized Wi-Fi Network
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNetwork}>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Network / Location Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Main Campus Jio Fiber 5G, Reception Wi-Fi"
                  value={newNetName}
                  onChange={(e) => setNewNetName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'var(--input-bg, #ffffff)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    IP Address or Subnet Pattern *
                  </label>
                  {currentClientIp && (
                    <button
                      type="button"
                      onClick={() => setNewNetIp(currentClientIp)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary, #3b82f6)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        padding: 0,
                      }}
                    >
                      Use detected IP: {currentClientIp}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 103.182.166.206 or 103.182.166.* or 192.168.1.0/24"
                  value={newNetIp}
                  onChange={(e) => setNewNetIp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'var(--input-bg, #ffffff)',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Accepts single IP (<code>103.182.166.206</code>), wildcard subnet (<code>103.182.166.*</code>), or CIDR notation (<code>192.168.1.0/24</code>).
                </div>
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Optional Note / ISP Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary router at 2nd floor library"
                  value={newNetDesc}
                  onChange={(e) => setNewNetDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'var(--input-bg, #ffffff)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                  style={{
                    padding: '0.7rem 1.25rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '0.7rem 1.5rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary, #3b82f6)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Save Authorized Network'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM RESTART MODAL */}
      {showRestartModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              borderRadius: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 1.25rem auto',
              }}
            >
              🔄
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem' }}>Confirm Backend Restart</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 1.75rem 0' }}>
              Are you sure you want to restart the backend server now? The server will gracefully recycle and reconnect automatically in 1–2 seconds.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                style={{
                  padding: '0.75rem 1.4rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'var(--text-main)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestartBackend}
                style={{
                  padding: '0.75rem 1.6rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                }}
              >
                Yes, Restart Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
