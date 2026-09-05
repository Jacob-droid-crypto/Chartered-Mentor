import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentFinesView({ user, data, fetchDashboardData, paymentConfig: propPaymentConfig }) {
  const [selectedFineId, setSelectedFineId] = useState('');
  const [activeMethodTab, setActiveMethodTab] = useState('UPI'); // 'UPI' | 'Bank' | 'Cash'
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
  
  // Payment Config from institute (Synced with Fees & Fines)
  const [paymentConfig, setPaymentConfig] = useState(propPaymentConfig || null);

  useEffect(() => {
    if (propPaymentConfig) {
      setPaymentConfig(propPaymentConfig);
      return;
    }
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
  }, [user, propPaymentConfig]);

  const fines = data?.fines || [];
  const unpaidFines = fines.filter(f => f.status !== 'Paid' && f.status !== 'Pending Approval');
  const pendingFines = fines.filter(f => f.status === 'Pending Approval');
  const paidFines = fines.filter(f => f.status === 'Paid');

  const totalUnpaidAmount = unpaidFines.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalPendingAmount = pendingFines.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalPaidAmount = paidFines.reduce((sum, f) => sum + (f.amount || 0), 0);

  // Auto-select first unpaid fine if none selected
  useEffect(() => {
    if (unpaidFines.length > 0 && !selectedFineId) {
      setSelectedFineId(unpaidFines[0]._id);
    }
  }, [unpaidFines, selectedFineId]);

  const currentSelectedFine = fines.find(f => f._id === selectedFineId) || unpaidFines[0] || null;

  const formatFinePeriod = (fine) => {
    if (!fine) return '';
    if (fine.startDate && fine.endDate) {
      const start = new Date(fine.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const end = new Date(fine.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      if (start === end) return start;
      return `${start} – ${end}`;
    }
    return new Date(fine.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyToast(`Copied ${label}!`);
    setTimeout(() => setCopyToast(''), 2500);
  };

  const handleSelectFineToPay = (fine) => {
    setSelectedFineId(fine._id);
    setPaymentMethod('UPI');
    setActiveMethodTab('UPI');
    setErrorMsg('');
    // Smooth scroll to payment section
    const el = document.getElementById('fine-payment-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmitFinePayment = async (e) => {
    e.preventDefault();
    if (!selectedFineId) {
      setErrorMsg('Please select a fine record to settle.');
      return;
    }

    if (paymentMethod !== 'Cash' && !transactionId.trim()) {
      setErrorMsg('Please enter your UPI / Bank Transaction ID or Reference Number.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch(`/student/fine/${selectedFineId}/pay`, {
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
      setTransactionId('');
      setNotes('');
      if (typeof fetchDashboardData === 'function') {
        await fetchDashboardData();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPI Link Details
  const upiId = paymentConfig?.upiId || 'charteredmentor@upi';
  const accountName = paymentConfig?.accountName || 'Chartered Mentor';
  const fineAmount = currentSelectedFine?.amount || totalUnpaidAmount || 0;
  const upiPayUrl = fineAmount > 0
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(accountName)}&am=${fineAmount}&cu=INR&tn=${encodeURIComponent(`Fine-${currentSelectedFine?.reason || 'Payment'}`)}`
    : `upi://pay?pa=${upiId}&pn=${encodeURIComponent(accountName)}&cu=INR`;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0.5rem 0' }}>
      
      {/* Toast Notification */}
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

      {/* Alert Banners */}
      {errorMsg && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          fontWeight: '600',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          border: '1px solid #ef4444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
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

      {/* Summary Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Unpaid Fines
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444', marginTop: '0.4rem' }}>
            {unpaidFines.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Due: ₹{totalUnpaidAmount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pending Verification
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d97706', marginTop: '0.4rem' }}>
            {pendingFines.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Amount: ₹{totalPendingAmount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Fines Settled (Paid)
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', marginTop: '0.4rem' }}>
            ₹{totalPaidAmount}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {paidFines.length} record(s) completed
          </div>
        </div>
      </div>

      {/* PAYMENT METHODS & REMITTANCE SECTION (Always Visible) */}
      <div id="fine-payment-section" className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        marginBottom: '2.5rem',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💳 Fine Payment Methods & Remittance
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.3rem 0 0 0' }}>
              Scan the QR code, use UPI ID, or transfer to the institute bank account to settle your fines.
            </p>
          </div>

          {unpaidFines.length > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>
                Outstanding: ₹{totalUnpaidAmount}
              </span>
            </div>
          )}
        </div>

        {/* Method Toggle Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setActiveMethodTab('UPI');
              setPaymentMethod('UPI');
            }}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: activeMethodTab === 'UPI' ? '2px solid #10b981' : '1px solid var(--glass-border, #cbd5e1)',
              background: activeMethodTab === 'UPI' ? 'rgba(16, 185, 129, 0.12)' : 'var(--card-bg, #ffffff)',
              color: activeMethodTab === 'UPI' ? '#10b981' : 'var(--text-main)',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>📱</span>
            <span>UPI / QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMethodTab('Bank');
              setPaymentMethod('Bank Transfer');
            }}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: activeMethodTab === 'Bank' ? '2px solid #3b82f6' : '1px solid var(--glass-border, #cbd5e1)',
              background: activeMethodTab === 'Bank' ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg, #ffffff)',
              color: activeMethodTab === 'Bank' ? '#3b82f6' : 'var(--text-main)',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>🏦</span>
            <span>Bank Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMethodTab('Cash');
              setPaymentMethod('Cash');
            }}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: activeMethodTab === 'Cash' ? '2px solid #f59e0b' : '1px solid var(--glass-border, #cbd5e1)',
              background: activeMethodTab === 'Cash' ? 'rgba(245, 158, 11, 0.12)' : 'var(--card-bg, #ffffff)',
              color: activeMethodTab === 'Cash' ? '#f59e0b' : 'var(--text-main)',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>💵</span>
            <span>Cash Desk</span>
          </button>
        </div>

        {/* Selected Method Details Box */}
        <div style={{
          background: 'var(--card-bg, #f8fafc)',
          borderRadius: '14px',
          border: '1px solid var(--glass-border, #e2e8f0)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          {activeMethodTab === 'UPI' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'center' }}>
              {/* Dynamic QR Code Card */}
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <QRCodeSVG value={upiPayUrl} size={170} />
                <span style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '8px', fontWeight: 'bold' }}>
                  {fineAmount > 0 ? `Pay exact ₹${fineAmount}` : 'Scan with any UPI App'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  GPay • PhonePe • Paytm • BHIM
                </span>
              </div>

              {/* UPI ID and Copy Details */}
              <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    Institute Official UPI ID
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <strong style={{ fontSize: '1.2rem', color: '#10b981', letterSpacing: '0.5px' }}>{upiId}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiId, 'UPI ID')}
                      style={{
                        padding: '5px 12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      📋 Copy UPI ID
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    Payee Name / Account Holder
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '2px' }}>
                    {accountName}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                  💡 <strong>How to Pay:</strong> Open Google Pay, PhonePe, or Paytm, scan the QR code above or send money to <strong>{upiId}</strong>, then enter the 12-digit UTR / Reference ID in the verification form below.
                </div>
              </div>
            </div>
          )}

          {activeMethodTab === 'Bank' && (
            <div>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                Bank Account Remittance Details (IMPS / NEFT / RTGS)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div style={{ background: 'var(--surface-color, #ffffff)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Account Name</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{paymentConfig?.accountName || 'Chartered Mentor'}</strong>
                    <button type="button" onClick={() => handleCopy(paymentConfig?.accountName || 'Chartered Mentor', 'Account Name')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color, #ffffff)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Account Number</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '1px' }}>{paymentConfig?.accountNumber || '000000000000'}</strong>
                    <button type="button" onClick={() => handleCopy(paymentConfig?.accountNumber || '', 'Account Number')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color, #ffffff)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Bank Name</span>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '4px' }}>
                    {paymentConfig?.bankName || 'State Bank of India'}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color, #ffffff)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>IFSC Code</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{paymentConfig?.ifscCode || 'SBIN0000000'}</strong>
                    <button type="button" onClick={() => handleCopy(paymentConfig?.ifscCode || '', 'IFSC Code')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMethodTab === 'Cash' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '3rem' }}>🏢</span>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Campus Accounts Office Desk Settlement</h4>
                <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  You can walk up to the campus administrative accounts desk to pay your fine in cash. Receive your printed cash receipt and enter the receipt number below to mark your record as paid.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PROOF SUBMISSION FORM */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✍️ Report & Verify Your Fine Payment
          </h4>

          <form onSubmit={handleSubmitFinePayment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Select Fine Record */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Select Fine Record to Settle <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {unpaidFines.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {fines.length === 0 ? 'No fines on record' : 'All current fines are already settled or pending approval!'}
                  </div>
                ) : (
                  <select
                    value={selectedFineId}
                    onChange={(e) => setSelectedFineId(e.target.value)}
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
                  >
                    {unpaidFines.map(f => (
                      <option key={f._id} value={f._id}>
                        {f.reason === 'Study Hours Deficit' ? '⏰ Hours Deficit' : '🏖️ Excess Leaves'} — ₹{f.amount} ({formatFinePeriod(f)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Payment Method Used */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Payment Method Used <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value === 'UPI') setActiveMethodTab('UPI');
                    else if (e.target.value === 'Bank Transfer') setActiveMethodTab('Bank');
                    else if (e.target.value === 'Cash') setActiveMethodTab('Cash');
                  }}
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
                >
                  <option value="UPI">📱 UPI / QR Code</option>
                  <option value="Bank Transfer">🏦 Bank Transfer (IMPS/NEFT)</option>
                  <option value="Cash">💵 Cash at Office Desk</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Transaction ID */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                  {paymentMethod === 'UPI' ? 'UPI 12-Digit Reference / UTR Number' : paymentMethod === 'Bank Transfer' ? 'Bank Transfer UTR / Ref No' : 'Cash Receipt No'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={paymentMethod === 'UPI' ? 'e.g. 423987123456' : paymentMethod === 'Bank Transfer' ? 'e.g. IMPS/NEFT Ref Number' : 'e.g. RCP-2026-001'}
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

              {/* Payment Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
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

            {/* Remarks */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                Remarks / Sender Details (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Paid from Google Pay (John Doe)"
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

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSubmitting || unpaidFines.length === 0}
                style={{
                  padding: '0.85rem 2.2rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: (isSubmitting || unpaidFines.length === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isSubmitting || unpaidFines.length === 0) ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {isSubmitting ? 'Submitting Payment Proof...' : '✓ Submit Fine Payment Proof'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* FINES STATEMENT & HISTORY TABLE */}
      <div className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Fine Statement & Payment History
        </h3>

        {fines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            🎉 No fine history found for your account. You have zero fines!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border, #cbd5e1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fine Date / Period</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment Method & Ref</th>
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
                      {(() => {
                        let icon = '📝';
                        let bg = 'rgba(99, 102, 241, 0.15)';
                        let color = '#4f46e5';
                        let border = 'rgba(99, 102, 241, 0.3)';

                        if (fine.reason === 'Study Hours Deficit') {
                          icon = '⏰'; bg = 'rgba(245, 158, 11, 0.15)'; color = '#d97706'; border = 'rgba(245, 158, 11, 0.3)';
                        } else if (fine.reason === 'Excess Leaves') {
                          icon = '🏖️'; bg = 'rgba(139, 92, 246, 0.15)'; color = '#7c3aed'; border = 'rgba(139, 92, 246, 0.3)';
                        } else if (fine.reason === 'Mobile Phone Violation') {
                          icon = '📱'; bg = 'rgba(244, 63, 94, 0.15)'; color = '#e11d48'; border = 'rgba(244, 63, 94, 0.3)';
                        } else if (fine.reason && (fine.reason.includes('Indiscipline') || fine.reason.includes('Noise'))) {
                          icon = '🤫'; bg = 'rgba(234, 88, 12, 0.15)'; color = '#ea580c'; border = 'rgba(234, 88, 12, 0.3)';
                        } else if (fine.reason && (fine.reason.includes('Late') || fine.reason.includes('Attendance') || fine.reason.includes('Checkout'))) {
                          icon = '🚪'; bg = 'rgba(14, 165, 233, 0.15)'; color = '#0284c7'; border = 'rgba(14, 165, 233, 0.3)';
                        }

                        return (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            background: bg,
                            color: color,
                            border: `1px solid ${border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>{icon}</span>
                            <span>{fine.reason}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unsettled</span>
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
                        <span style={{ color: '#d97706', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          🕒 Pending Approval
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectFineToPay(fine)}
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
                          💳 Settle Fine
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

    </div>
  );
}
