import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentFinesView({ user, data, fetchDashboardData }) {
  const [payingFine, setPayingFine] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [transactionId, setTransactionId] = useState('');
  const [paidDate, setPaidDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copyToast, setCopyToast] = useState('');
  
  // Payment Config from admin/institute
  const [paymentConfig, setPaymentConfig] = useState(null);

  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        const res = await fetch('/student/payment-config', {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (res.ok) {
          const config = await res.json();
          setPaymentConfig(config);
        }
      } catch (err) {
        console.error('Failed to load payment config', err);
      }
    };
    if (user?.token) {
      fetchPaymentConfig();
    }
  }, [user]);

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

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyToast(`Copied ${label}!`);
    setTimeout(() => setCopyToast(''), 2500);
  };

  const handleOpenPaymentModal = (fine) => {
    setPayingFine(fine);
    setPaymentMethod('UPI');
    setTransactionId('');
    setNotes('');
    const d = new Date();
    setPaidDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setErrorMsg('');
  };

  const handleSubmitFinePayment = async (e) => {
    e.preventDefault();
    if (!payingFine) return;

    if (paymentMethod !== 'Cash' && !transactionId.trim()) {
      setErrorMsg('Please enter your UPI / Bank Transaction ID or Reference Number.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch(`/student/fine/${payingFine._id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod,
          transactionId: transactionId.trim() || 'CASH_PAYMENT',
          paidDate,
          notes: notes.trim()
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to submit fine payment');
      }

      setSuccessMsg(result.message || 'Fine payment details submitted! Admin will verify and approve shortly.');
      setPayingFine(null);
      if (typeof fetchDashboardData === 'function') {
        await fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPI Payment Link
  const upiId = paymentConfig?.upiId || 'charteredmentor@upi';
  const accountName = paymentConfig?.accountName || 'Chartered Mentor';
  const fineAmount = payingFine?.amount || 0;
  const upiPayUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(accountName)}&am=${fineAmount}&cu=INR&tn=${encodeURIComponent(`Fine-${payingFine?.reason || 'Settlement'}`)}`;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 0' }}>
      
      {/* Alert Banners */}
      {copyToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 10000,
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          background: '#0f172a',
          color: '#ffffff',
          fontWeight: '600',
          fontSize: '0.9rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📋 {copyToast}
        </div>
      )}

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
          border: '1px solid #10b981',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📋 Fine Statement & Payment History
          </h3>
        </div>

        {fines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            🎉 No fine records found for your account. Keep up the good work!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border, #cbd5e1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fine Date / Period</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment Method</th>
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
                        {fine.reason === 'Study Hours Deficit' ? '⏰ Study Hours Deficit' : '🏖️ Excess Leaves'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1rem' }}>
                      ₹{fine.amount}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {fine.paymentMethod ? (
                        <div>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: fine.paymentMethod === 'UPI' ? 'rgba(16, 185, 129, 0.15)' : fine.paymentMethod === 'Bank Transfer' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: fine.paymentMethod === 'UPI' ? '#10b981' : fine.paymentMethod === 'Bank Transfer' ? '#3b82f6' : '#64748b'
                          }}>
                            {fine.paymentMethod === 'UPI' ? '📱 UPI' : fine.paymentMethod === 'Bank Transfer' ? '🏦 Bank Transfer' : '💵 Cash'}
                          </span>
                          {fine.transactionId && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                              Ref: <strong style={{ color: 'var(--text-main)' }}>{fine.transactionId}</strong>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.12)'
                          : fine.status === 'Pending Approval' ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                        color: fine.status === 'Paid' ? '#10b981'
                          : fine.status === 'Pending Approval' ? '#d97706'
                          : '#ef4444',
                        border: `1px solid ${fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.3)'
                          : fine.status === 'Pending Approval' ? 'rgba(245, 158, 11, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {fine.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {fine.status === 'Paid' ? (
                        <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          Settled ✓
                        </span>
                      ) : fine.status === 'Pending Approval' ? (
                        <span style={{ color: '#d97706', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                          🕒 Pending Approval
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenPaymentModal(fine)}
                          style={{
                            padding: '0.45rem 1rem',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                            transition: 'all 0.2s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          💳 Pay Fine
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FINE PAYMENT PORTAL MODAL */}
      {payingFine && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setPayingFine(null)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '650px',
            width: '100%',
            background: 'var(--surface-color, #ffffff)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
            border: '1px solid var(--glass-border, rgba(0,0,0,0.1))'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💳 Fine Payment Portal
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Select your preferred payment method and submit verification reference.
                </p>
              </div>
              <button onClick={() => !isSubmitting && setPayingFine(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            {/* Fine Summary Highlight */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  Fine Reason & Period
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1rem', marginTop: '2px' }}>
                  {payingFine.reason === 'Study Hours Deficit' ? '⏰ Study Hours Deficit' : '🏖️ Excess Leaves'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {formatFinePeriod(payingFine)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Payable Amount
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444' }}>
                  ₹{payingFine.amount}
                </div>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.6rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                1. Choose Payment Method
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  style={{
                    padding: '0.85rem 0.5rem',
                    borderRadius: '10px',
                    border: paymentMethod === 'UPI' ? '2px solid #10b981' : '1px solid var(--glass-border, #cbd5e1)',
                    background: paymentMethod === 'UPI' ? 'rgba(16, 185, 129, 0.12)' : 'var(--card-bg, #ffffff)',
                    color: paymentMethod === 'UPI' ? '#10b981' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>📱</span>
                  <span>UPI / QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Bank Transfer')}
                  style={{
                    padding: '0.85rem 0.5rem',
                    borderRadius: '10px',
                    border: paymentMethod === 'Bank Transfer' ? '2px solid #3b82f6' : '1px solid var(--glass-border, #cbd5e1)',
                    background: paymentMethod === 'Bank Transfer' ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg, #ffffff)',
                    color: paymentMethod === 'Bank Transfer' ? '#3b82f6' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>🏦</span>
                  <span>Bank Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  style={{
                    padding: '0.85rem 0.5rem',
                    borderRadius: '10px',
                    border: paymentMethod === 'Cash' ? '2px solid #f59e0b' : '1px solid var(--glass-border, #cbd5e1)',
                    background: paymentMethod === 'Cash' ? 'rgba(245, 158, 11, 0.12)' : 'var(--card-bg, #ffffff)',
                    color: paymentMethod === 'Cash' ? '#f59e0b' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>💵</span>
                  <span>Cash Payment</span>
                </button>
              </div>
            </div>

            {/* Method Details Box */}
            <div style={{
              background: 'var(--card-bg, #f8fafc)',
              borderRadius: '12px',
              border: '1px solid var(--glass-border, #e2e8f0)',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              {paymentMethod === 'UPI' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Dynamic QR Code */}
                  <div style={{
                    background: '#ffffff',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <QRCodeSVG value={upiPayUrl} size={150} />
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>
                      Scan with any UPI App
                    </span>
                  </div>

                  {/* UPI Details & Copy */}
                  <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                        Institute UPI ID
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#10b981' }}>{upiId}</strong>
                        <button
                          type="button"
                          onClick={() => handleCopy(upiId, 'UPI ID')}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                        Payee Name
                      </span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {accountName}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(16, 185, 129, 0.08)', padding: '8px', borderRadius: '6px' }}>
                      💡 <strong>Note:</strong> Scanning this QR code will automatically pre-fill the exact fine amount of <strong>₹{payingFine.amount}</strong>.
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'Bank Transfer' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Account Name</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{paymentConfig?.accountName || 'Chartered Mentor'}</strong>
                      <button type="button" onClick={() => handleCopy(paymentConfig?.accountName || 'Chartered Mentor', 'Account Name')} style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>📋</button>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Account Number</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '1rem', letterSpacing: '1px' }}>{paymentConfig?.accountNumber || '000000000000'}</strong>
                      <button type="button" onClick={() => handleCopy(paymentConfig?.accountNumber || '', 'Account Number')} style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>📋</button>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Bank Name</span>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '2px' }}>
                      {paymentConfig?.bankName || 'State Bank'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>IFSC Code</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{paymentConfig?.ifscCode || 'IFSC0000'}</strong>
                      <button type="button" onClick={() => handleCopy(paymentConfig?.ifscCode || '', 'IFSC Code')} style={{ padding: '2px 6px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>📋</button>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'Cash' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>🏢</span>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>Campus Accounts Office</h4>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      You can pay the fine amount of <strong>₹{payingFine.amount}</strong> directly in cash at the accounts counter and enter your receipt number below for instant record matching.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Payment Verification Form */}
            <form onSubmit={handleSubmitFinePayment}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.6rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                2. Enter Payment Verification Details
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {paymentMethod === 'UPI' ? 'UPI Reference / UTR Number' : paymentMethod === 'Bank Transfer' ? 'Bank Transfer UTR / Ref No' : 'Cash Receipt No'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={paymentMethod === 'UPI' ? 'e.g. 423987123456 (12-digit UTR)' : paymentMethod === 'Bank Transfer' ? 'e.g. IMPS/NEFT Ref Number' : 'e.g. RCP-2026-001'}
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border, #cbd5e1)',
                      background: 'var(--card-bg, #ffffff)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Payment Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border, #cbd5e1)',
                      background: 'var(--card-bg, #ffffff)',
                      color: 'var(--text-main)',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via Google Pay from John's Account"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPayingFine(null)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    color: 'var(--text-muted)',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.75rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Submitting Payment Proof...' : '✓ Submit Payment Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
