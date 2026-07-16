import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function CampusQRTab({
  autoRotate,
  setAutoRotate,
  campusQRConfig,
  refreshCampusQR
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Campus Attendance QR Codes</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>Display these codes at the reception or front desk. They change dynamically to prevent student spoofing.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
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

      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
          <h3 style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>LOG IN</h3>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
            <QRCodeSVG value={campusQRConfig.activeInToken || 'CM-ATTENDANCE-IN'} size={220} />
          </div>
          <button
            onClick={() => refreshCampusQR('IN')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
          >
            🔄 Refresh Check-IN QR
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Students scan this to mark their arrival.</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
          <h3 style={{ color: '#ef4444', fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>LOG OUT</h3>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
            <QRCodeSVG value={campusQRConfig.activeOutToken || 'CM-ATTENDANCE-OUT'} size={220} />
          </div>
          <button
            onClick={() => refreshCampusQR('OUT')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
          >
            🔄 Refresh Check-OUT QR
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Students scan this when leaving the campus.</p>
        </div>
      </div>
    </>
  );
}
