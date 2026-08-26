import React, { useState } from 'react';

export default function StudentFinesView({ user, data, fetchDashboardData }) {
  const [payingId, setPayingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fines = data?.fines || [];

  const unpaidFines = fines.filter(f => f.status !== 'Paid');
  const paidFines = fines.filter(f => f.status === 'Paid');

  const totalUnpaidAmount = unpaidFines.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalPaidAmount = paidFines.reduce((sum, f) => sum + (f.amount || 0), 0);

  const formatFinePeriod = (fine) => {
    if (fine.startDate && fine.endDate) {
      const start = new Date(fine.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const end = new Date(fine.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      if (start === end) return start;
      return `${start} - ${end}`;
    }
    return new Date(fine.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleMarkAsPaid = async (fineId) => {
    try {
      setPayingId(fineId);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch(`/student/fine/${fineId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to mark fine as paid');
      }

      setSuccessMsg(result.message || 'Fine marked as paid successfully!');
      if (typeof fetchDashboardData === 'function') {
        await fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 0' }}>
      
      {/* Alert Banners */}
      {errorMsg && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontWeight: '600',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          border: '1px solid #ef4444'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontWeight: '600',
          background: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: '1px solid #10b981'
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Summary Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Unpaid Fines
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444', marginTop: '0.4rem' }}>
            {unpaidFines.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Outstanding Balance
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444', marginTop: '0.4rem' }}>
            ₹{totalUnpaidAmount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Fines Settled (Paid)
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', marginTop: '0.4rem' }}>
            ₹{totalPaidAmount}
          </div>
        </div>
      </div>

      {/* Fines Ledger Card */}
      <div className="card" style={{ padding: '1.5rem 2rem' }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Fine Statement History
        </h3>

        {fines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            No fine history found for your account. Keep up the good work!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border, #cbd5e1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fine Date / Period</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((fine, idx) => (
                  <tr key={fine._id || idx} style={{ borderBottom: '1px solid var(--glass-border, #e2e8f0)' }}>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)' }}>
                      <div>{new Date(fine.date || fine.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Period: {formatFinePeriod(fine)}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: fine.reason === 'Study Hours Deficit' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        color: fine.reason === 'Study Hours Deficit' ? '#d97706' : '#7c3aed',
                        border: `1px solid ${fine.reason === 'Study Hours Deficit' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
                      }}>
                        {fine.reason === 'Over Leaves' ? 'Excess Leaves' : fine.reason}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      ₹{fine.amount}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: fine.status === 'Paid' ? '#10b981' : '#ef4444',
                        border: `1px solid ${fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {fine.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {fine.status !== 'Paid' ? (
                        <button
                          disabled={payingId === fine._id}
                          onClick={() => handleMarkAsPaid(fine._id)}
                          style={{
                            padding: '0.4rem 0.9rem',
                            background: 'var(--primary-color, #4f46e5)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            opacity: payingId === fine._id ? 0.7 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {payingId === fine._id ? 'Processing...' : 'Mark Paid'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>
                          Settled ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
