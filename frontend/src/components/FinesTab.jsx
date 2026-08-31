import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function FinesTab({
  user,
  students = [],
  fetchStudentsData,
  paymentConfig: propPaymentConfig,
  fetchPaymentConfig: propFetchPaymentConfig
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reason, setReason] = useState('Study Hours Deficit');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  // Payment Config State for Fines & Fees
  const [paymentConfig, setPaymentConfig] = useState(propPaymentConfig || null);
  const [isEditingPaymentConfig, setIsEditingPaymentConfig] = useState(false);
  const [paymentConfigForm, setPaymentConfigForm] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    upiId: ''
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState({ type: '', text: '' });
  const [copyToast, setCopyToast] = useState('');

  // Fetch payment config if not provided
  const fetchPaymentDetails = useCallback(async () => {
    try {
      const res = await fetch('/admin/payment-config', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentConfig(data);
        setPaymentConfigForm({
          accountName: data.accountName || '',
          accountNumber: data.accountNumber || '',
          bankName: data.bankName || '',
          ifscCode: data.ifscCode || '',
          upiId: data.upiId || ''
        });
      }
    } catch (err) {
      console.error('Failed to load payment config in fines tab:', err);
    }
  }, [user?.token]);

  useEffect(() => {
    if (propPaymentConfig) {
      setPaymentConfig(propPaymentConfig);
      setPaymentConfigForm({
        accountName: propPaymentConfig.accountName || '',
        accountNumber: propPaymentConfig.accountNumber || '',
        bankName: propPaymentConfig.bankName || '',
        ifscCode: propPaymentConfig.ifscCode || '',
        upiId: propPaymentConfig.upiId || ''
      });
    } else if (user?.token) {
      fetchPaymentDetails();
    }
  }, [propPaymentConfig, user, fetchPaymentDetails]);

  const handleSavePaymentConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigMsg({ type: '', text: '' });
    try {
      const res = await fetch('/admin/payment-config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentConfigForm)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = data.config || paymentConfigForm;
      setPaymentConfig(updated);
      setConfigMsg({ type: 'success', text: 'Institute payment details saved successfully! Students will now see these updated payment schemes in their Fines and Fees tab.' });
      setIsEditingPaymentConfig(false);
      if (propFetchPaymentConfig) propFetchPaymentConfig();
    } catch (err) {
      setConfigMsg({ type: 'error', text: 'Failed to save payment details: ' + err.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyToast(`Copied ${label}!`);
    setTimeout(() => setCopyToast(''), 2500);
  };
  
  // Direct settlement state when creating fine
  const [initialStatus, setInitialStatus] = useState('Unpaid'); // 'Unpaid' or 'Paid'
  const [applyPaymentMethod, setApplyPaymentMethod] = useState('Cash');
  const [applyTransactionId, setApplyTransactionId] = useState('');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // States for searchable student dropdown
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  
  // Search & Filter state for fines ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');

  // Admin Quick Settle Modal State
  const [settlingFine, setSettlingFine] = useState(null); // { studentId, fineId, studentName, amount }
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [settleTransactionId, setSettleTransactionId] = useState('');
  const [settleDate, setSettleDate] = useState(getTodayStr());
  const [settleNotes, setSettleNotes] = useState('');

  // Handle fine submission
  const handleApplyFine = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    if (!selectedStudentId) {
      setStatusMsg({ type: 'error', text: 'Please select a student from the dropdown.' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid positive fine amount.' });
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setStatusMsg({ type: 'error', text: 'End Date cannot be earlier than Start Date.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/admin/student/${selectedStudentId}/fine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          amount: Number(amount),
          reason,
          startDate,
          endDate,
          status: initialStatus,
          paymentMethod: initialStatus === 'Paid' ? applyPaymentMethod : null,
          transactionId: initialStatus === 'Paid' ? (applyTransactionId.trim() || 'DIRECT_SETTLEMENT') : null
        })
      });

      const contentType = res.headers.get('content-type');
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404 || text.includes('Cannot POST') || text.includes('<!DOCTYPE')) {
          throw new Error('Backend deployment in progress on Vercel. Please wait 1 minute for Vercel to finish updating the server.');
        }
        throw new Error('Server error: Non-JSON response received.');
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to apply fine');
      }

      setStatusMsg({
        type: 'success',
        text: `Fine of ₹${amount} for '${reason}' ${initialStatus === 'Paid' ? 'applied and marked as Paid' : 'applied'} successfully!`
      });
      setAmount('');
      setStartDate(getTodayStr());
      setEndDate(getTodayStr());
      setInitialStatus('Unpaid');
      setApplyTransactionId('');
      if (fetchStudentsData) fetchStudentsData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle fine deletion
  const handleDeleteFine = async (studentId, fineId) => {
    if (!window.confirm('Are you sure you want to delete this fine record?')) return;
    try {
      const res = await fetch(`/admin/student/${studentId}/fine/${fineId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const contentTypeDelete = res.headers.get('content-type');
      let dataDelete = {};
      if (contentTypeDelete && contentTypeDelete.includes('application/json')) {
        dataDelete = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404 || text.includes('Cannot DELETE') || text.includes('<!DOCTYPE')) {
          throw new Error('Backend deployment in progress on Vercel. Please wait 1 minute for Vercel to finish updating the server.');
        }
        throw new Error('Server error: Non-JSON response received.');
      }

      if (!res.ok) {
        throw new Error(dataDelete.message || 'Failed to delete fine');
      }
      setStatusMsg({ type: 'success', text: 'Fine record removed successfully.' });
      if (fetchStudentsData) fetchStudentsData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Handle fine payment approval or manual settlement
  const handleConfirmSettleFine = async (e) => {
    if (e) e.preventDefault();
    if (!settlingFine) return;

    setLoading(true);
    try {
      const res = await fetch(`/admin/student/${settlingFine.studentId}/fine/${settlingFine.fineId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: settleMethod,
          transactionId: settleTransactionId.trim() || 'ADMIN_SETTLEMENT',
          paidDate: settleDate,
          notes: settleNotes.trim()
        })
      });
      const contentTypePay = res.headers.get('content-type');
      let dataPay = {};
      if (contentTypePay && contentTypePay.includes('application/json')) {
        dataPay = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404 || text.includes('Cannot POST') || text.includes('<!DOCTYPE')) {
          throw new Error('Backend deployment in progress on Vercel. Please wait 1 minute for Vercel to finish updating the server.');
        }
        throw new Error('Server error: Non-JSON response received.');
      }

      if (!res.ok) {
        throw new Error(dataPay.message || 'Failed to mark fine as paid');
      }
      setStatusMsg({ type: 'success', text: `Fine payment settled successfully (${settleMethod}).` });
      setSettlingFine(null);
      if (fetchStudentsData) fetchStudentsData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle direct approval for Pending Approval fine
  const handleApprovePendingFine = async (fine) => {
    if (!window.confirm(`Approve payment of ₹${fine.amount} for ${fine.studentName} via ${fine.paymentMethod || 'reported method'}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/student/${fine.studentId}/fine/${fine._id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: fine.paymentMethod || 'UPI',
          transactionId: fine.transactionId || null,
          paidDate: fine.paidDate || new Date()
        })
      });
      const contentTypePay = res.headers.get('content-type');
      let dataPay = {};
      if (contentTypePay && contentTypePay.includes('application/json')) {
        dataPay = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404 || text.includes('Cannot POST') || text.includes('<!DOCTYPE')) {
          throw new Error('Backend deployment in progress on Vercel. Please wait 1 minute for Vercel to finish updating the server.');
        }
        throw new Error('Server error: Non-JSON response received.');
      }

      if (!res.ok) {
        throw new Error(dataPay.message || 'Failed to approve fine payment');
      }
      setStatusMsg({ type: 'success', text: 'Fine payment approved and marked as Paid.' });
      if (fetchStudentsData) fetchStudentsData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle fine payment rejection
  const handleRejectFine = async (studentId, fineId) => {
    if (!window.confirm('Reject this fine payment and mark it as unpaid?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/student/${studentId}/fine/${fineId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const contentTypePay = res.headers.get('content-type');
      let dataPay = {};
      if (contentTypePay && contentTypePay.includes('application/json')) {
        dataPay = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404 || text.includes('Cannot POST') || text.includes('<!DOCTYPE')) {
          throw new Error('Backend deployment in progress on Vercel. Please wait 1 minute for Vercel to finish updating the server.');
        }
        throw new Error('Server error: Non-JSON response received.');
      }

      if (!res.ok) {
        throw new Error(dataPay.message || 'Failed to reject fine payment');
      }
      setStatusMsg({ type: 'success', text: 'Fine payment rejected successfully.' });
      if (fetchStudentsData) fetchStudentsData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Helper to format fine date or range
  const formatFinePeriod = (fine) => {
    const s = fine.startDate || fine.date;
    const e = fine.endDate || fine.date;
    if (!s) return 'N/A';
    const sStr = new Date(s).toLocaleDateString([], { dateStyle: 'medium' });
    const eStr = new Date(e).toLocaleDateString([], { dateStyle: 'medium' });
    if (sStr === eStr) {
      return sStr;
    }
    return `${sStr} – ${eStr}`;
  };

  // Compile all fines from students array
  const allFines = [];
  if (Array.isArray(students)) {
    students.forEach((stud) => {
      if (Array.isArray(stud.fines)) {
        stud.fines.forEach((fine) => {
          allFines.push({
            ...fine,
            studentId: stud.userId,
            studentName: stud.name || stud.userId,
            course: stud.course || ''
          });
        });
      }
    });
  }

  // Sort fines newest first
  allFines.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter fines
  const filteredFines = allFines.filter((f) => {
    const matchesReason = reasonFilter === 'All' || f.reason === reasonFilter;
    const matchesStatus = statusFilter === 'All' || f.status === statusFilter;
    const matchesMethod = methodFilter === 'All' || f.paymentMethod === methodFilter;
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q ||
      f.studentName.toLowerCase().includes(q) ||
      f.studentId.toLowerCase().includes(q) ||
      (f.transactionId && f.transactionId.toLowerCase().includes(q));
    return matchesReason && matchesStatus && matchesMethod && matchesQuery;
  });

  const selectedStudent = Array.isArray(students) ? students.find(s => s.userId === selectedStudentId) : null;
  const filteredStudentsForSelect = Array.isArray(students) ? students.filter(s => {
    const term = searchStudentTerm.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(term) ||
      (s.userId || '').toLowerCase().includes(term)
    );
  }) : [];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💸 Student Fine Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.3rem' }}>
            Issue fines, review student payment proofs (UPI / Bank / Cash), and track fine settlements.
          </p>
        </div>
      </div>

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

      {/* Payment Config Status Messages */}
      {configMsg.text && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontWeight: '600',
          background: configMsg.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          color: configMsg.type === 'error' ? '#ef4444' : '#10b981',
          border: `1px solid ${configMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{configMsg.type === 'error' ? '⚠️ ' : '✅ '}{configMsg.text}</span>
          <button onClick={() => setConfigMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Institute Fine & Fee Payment Remittance Details Card */}
      <div className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              padding: '0.85rem',
              borderRadius: '12px',
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🏦
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Fine & Fee Payment Details
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  Visible to Students
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                Official institute payment scheme details (UPI & Bank Account) configured for student fine and fee remittance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsEditingPaymentConfig(!isEditingPaymentConfig);
              if (!isEditingPaymentConfig && paymentConfig) {
                setPaymentConfigForm({
                  accountName: paymentConfig.accountName || '',
                  accountNumber: paymentConfig.accountNumber || '',
                  bankName: paymentConfig.bankName || '',
                  ifscCode: paymentConfig.ifscCode || '',
                  upiId: paymentConfig.upiId || ''
                });
              }
            }}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              background: isEditingPaymentConfig ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              color: isEditingPaymentConfig ? '#ef4444' : '#3b82f6',
              border: isEditingPaymentConfig ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
              fontWeight: 'bold',
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {isEditingPaymentConfig ? '✕ Cancel Editing' : '✏️ Change Payment Details'}
          </button>
        </div>

        {/* EDIT PAYMENT CONFIG FORM */}
        {isEditingPaymentConfig ? (
          <form onSubmit={handleSavePaymentConfig} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  Institute / Account Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chartered Mentor Pvt Ltd"
                  value={paymentConfigForm.accountName}
                  onChange={(e) => setPaymentConfigForm({ ...paymentConfigForm, accountName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  Account Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 123456789012"
                  value={paymentConfigForm.accountNumber}
                  onChange={(e) => setPaymentConfigForm({ ...paymentConfigForm, accountNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  Bank Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank / SBI"
                  value={paymentConfigForm.bankName}
                  onChange={(e) => setPaymentConfigForm({ ...paymentConfigForm, bankName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  IFSC Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0001234"
                  value={paymentConfigForm.ifscCode}
                  onChange={(e) => setPaymentConfigForm({ ...paymentConfigForm, ifscCode: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '1.25rem',
              background: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '12px',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              marginBottom: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1.5rem'
            }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  📱 UPI ID (Optional / Recommended)
                </label>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.8rem 0' }}>
                  Adding a valid UPI ID automatically renders a scan-and-pay QR code for students across both fines and fee payments.
                </p>
                <input
                  type="text"
                  placeholder="e.g. institute@upi or mobile@okhdfcbank"
                  value={paymentConfigForm.upiId}
                  onChange={(e) => setPaymentConfigForm({ ...paymentConfigForm, upiId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'white',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {paymentConfigForm.upiId && (
                <div style={{
                  background: '#ffffff',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <QRCodeSVG value={`upi://pay?pa=${paymentConfigForm.upiId}&pn=${encodeURIComponent(paymentConfigForm.accountName || 'Institute')}`} size={100} />
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold', marginTop: '4px' }}>Live QR Preview</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsEditingPaymentConfig(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingConfig}
                style={{
                  padding: '0.75rem 1.75rem',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                {isSavingConfig ? 'Saving...' : '💾 Save Payment Details'}
              </button>
            </div>
          </form>
        ) : (
          /* VIEW PAYMENT CONFIG DETAILS */
          <div>
            {paymentConfig ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                {/* Bank Details Grid */}
                <div style={{ flex: 2, minWidth: '280px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Account Name</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{paymentConfig.accountName || 'N/A'}</strong>
                      {paymentConfig.accountName && (
                        <button type="button" onClick={() => handleCopy(paymentConfig.accountName, 'Account Name')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                      )}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Account Number</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '1rem', letterSpacing: '1px' }}>{paymentConfig.accountNumber || 'N/A'}</strong>
                      {paymentConfig.accountNumber && (
                        <button type="button" onClick={() => handleCopy(paymentConfig.accountNumber, 'Account Number')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                      )}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Bank Name</span>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '4px' }}>
                      {paymentConfig.bankName || 'N/A'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '0.9rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>IFSC Code</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{paymentConfig.ifscCode || 'N/A'}</strong>
                      {paymentConfig.ifscCode && (
                        <button type="button" onClick={() => handleCopy(paymentConfig.ifscCode, 'IFSC Code')} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* UPI & QR Code Preview */}
                {paymentConfig.upiId && (
                  <div style={{
                    flex: 1,
                    minWidth: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: '#f8fafc',
                    padding: '0.9rem 1.2rem',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)'
                  }}>
                    <div style={{ background: 'white', padding: '0.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <QRCodeSVG value={`upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.accountName || 'Institute')}`} size={80} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Active UPI ID</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{paymentConfig.upiId}</strong>
                        <button type="button" onClick={() => handleCopy(paymentConfig.upiId, 'UPI ID')} style={{ padding: '2px 6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>📋</button>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Scan with GPay, PhonePe, Paytm</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px' }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 0.8rem 0' }}>No payment details configured yet. Configure details so students can remit payments.</p>
                <button
                  type="button"
                  onClick={() => setIsEditingPaymentConfig(true)}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Add Payment Details
                </button>
              </div>
            )}

            <div style={{
              marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'rgba(16, 185, 129, 0.06)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>💡</span>
              <span><strong>Unified Remittance:</strong> These payment schemes are synced across both student <strong>Fines</strong> and <strong>Course Fees</strong>. When students settle a fine, they will view this exact account & QR code to remit payments.</span>
            </div>
          </div>
        )}
      </div>

      {/* Fine Status Alert Messages */}
      {statusMsg.text && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontWeight: '600',
          background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          color: statusMsg.type === 'error' ? '#ef4444' : '#10b981',
          border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{statusMsg.type === 'error' ? '⚠️ ' : '✅ '}{statusMsg.text}</span>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Main Fine Form Card */}
      <div className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        marginBottom: '2.5rem',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📝 Apply Fine
        </h3>

        <form onSubmit={handleApplyFine}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Student Dropdown Selector */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Select Student <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={selectedStudent ? `${selectedStudent.name} (${selectedStudent.userId})` : "-- Search and choose a student --"}
                  value={isStudentDropdownOpen ? searchStudentTerm : (selectedStudent ? `${selectedStudent.name} (${selectedStudent.userId})` : '')}
                  onFocus={() => {
                    setIsStudentDropdownOpen(true);
                    setSearchStudentTerm('');
                  }}
                  onChange={(e) => setSearchStudentTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1.8rem 0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'text'
                  }}
                />
                {selectedStudent && !isStudentDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId('');
                      setSearchStudentTerm('');
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #64748b)',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
                {isStudentDropdownOpen && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 998
                      }}
                      onClick={() => setIsStudentDropdownOpen(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--glass-border, #cbd5e1)',
                        borderRadius: '10px',
                        marginTop: '4px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        zIndex: 999,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        padding: '4px'
                      }}
                    >
                      {filteredStudentsForSelect.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>
                          No students found
                        </div>
                      ) : (
                        filteredStudentsForSelect.map((s) => (
                          <div
                            key={s.userId}
                            onClick={() => {
                              setSelectedStudentId(s.userId);
                              setIsStudentDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.6rem 1rem',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              background: selectedStudentId === s.userId ? 'var(--primary-color, #4f46e5)' : 'transparent',
                              color: selectedStudentId === s.userId ? '#ffffff' : 'var(--text-main, #0f172a)',
                              fontSize: '0.9rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedStudentId !== s.userId) {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedStudentId !== s.userId) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <span>{s.name || 'Unnamed'}</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{s.userId}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fine Reason Scheme */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Reason for Fine <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `2px solid ${reason === 'Study Hours Deficit' ? '#f59e0b' : 'var(--glass-border, #cbd5e1)'}`,
                  background: reason === 'Study Hours Deficit' ? 'rgba(245, 158, 11, 0.12)' : 'var(--card-bg, #ffffff)',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'var(--text-main, #0f172a)',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="reason"
                    value="Study Hours Deficit"
                    checked={reason === 'Study Hours Deficit'}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <span>⏰ Study Hours Deficit</span>
                </label>

                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `2px solid ${reason === 'Excess Leaves' ? '#8b5cf6' : 'var(--glass-border, #cbd5e1)'}`,
                  background: reason === 'Excess Leaves' ? 'rgba(139, 92, 246, 0.12)' : 'var(--card-bg, #ffffff)',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'var(--text-main, #0f172a)',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="reason"
                    value="Excess Leaves"
                    checked={reason === 'Excess Leaves'}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ accentColor: '#8b5cf6' }}
                  />
                  <span>🏖️ Excess Leaves</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Fine Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Start Date */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Applicable From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* End Date */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Applicable To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Payment Method Direct Entry */}
          <div style={{
            background: 'var(--card-bg, #f8fafc)',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--glass-border, #e2e8f0)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                Payment Status:
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <input
                  type="radio"
                  name="initialStatus"
                  value="Unpaid"
                  checked={initialStatus === 'Unpaid'}
                  onChange={() => setInitialStatus('Unpaid')}
                />
                <span>Unpaid (Student will settle)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <input
                  type="radio"
                  name="initialStatus"
                  value="Paid"
                  checked={initialStatus === 'Paid'}
                  onChange={() => setInitialStatus('Paid')}
                />
                <span>Already Paid (Direct Cash / UPI Desk Settlement)</span>
              </label>
            </div>

            {initialStatus === 'Paid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--glass-border)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={applyPaymentMethod}
                    onChange={(e) => setApplyPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border, #cbd5e1)',
                      background: 'var(--surface-color, #ffffff)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / QR Code</option>
                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Receipt / Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RCP-001 or UTR No"
                    value={applyTransactionId}
                    onChange={(e) => setApplyTransactionId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border, #cbd5e1)',
                      background: 'var(--surface-color, #ffffff)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.8rem 2rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary-color, #4f46e5) 0%, #3b82f6 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {loading ? 'Processing...' : '✓ Issue & Save Fine'}
            </button>
          </div>
        </form>
      </div>

      {/* Fines Ledger Section */}
      <div className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📋 Fine History Log ({filteredFines.length})
          </h3>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search student, ID or Ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.85rem'
              }}
            />

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.85rem'
              }}
            >
              <option value="All">All Reasons</option>
              <option value="Study Hours Deficit">Study Hours Deficit</option>
              <option value="Excess Leaves">Excess Leaves</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.85rem'
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending Approval">Pending Approval</option>
            </select>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.85rem'
              }}
            >
              <option value="All">All Methods</option>
              <option value="UPI">📱 UPI</option>
              <option value="Bank Transfer">🏦 Bank Transfer</option>
              <option value="Cash">💵 Cash</option>
            </select>
          </div>
        </div>

        {filteredFines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            No fine records found matching your filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border, #cbd5e1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Student</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Period</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment Method & Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFines.map((fine, idx) => (
                  <tr key={fine._id || idx} style={{ borderBottom: '1px solid var(--glass-border, #e2e8f0)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{fine.studentName}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {fine.studentId}</div>
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
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: '#ef4444', fontSize: '1rem' }}>
                      ₹{fine.amount}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: '500' }}>
                      📅 {formatFinePeriod(fine)}
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
                          {fine.paidDate && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Paid: {new Date(fine.paidDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        background: fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)'
                          : fine.status === 'Pending Approval' ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
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
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {fine.status === 'Pending Approval' && (
                          <>
                            <button
                              onClick={() => handleApprovePendingFine(fine)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              title="Approve Payment"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleRejectFine(fine.studentId, fine._id)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#d97706',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              title="Reject Payment"
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}
                        {fine.status === 'Unpaid' && (
                          <button
                            onClick={() => {
                              setSettlingFine({
                                studentId: fine.studentId,
                                fineId: fine._id,
                                studentName: fine.studentName,
                                amount: fine.amount
                              });
                              setSettleMethod('Cash');
                              setSettleTransactionId('');
                              setSettleDate(getTodayStr());
                              setSettleNotes('');
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              transition: 'all 0.2s'
                            }}
                            title="Settle & Mark as Paid"
                          >
                            ✓ Settle Fine
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFine(fine.studentId, fine._id)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            transition: 'all 0.2s'
                          }}
                          title="Delete Fine"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADMIN QUICK SETTLEMENT MODAL */}
      {settlingFine && (
        <div className="modal-overlay" onClick={() => !loading && setSettlingFine(null)} style={{
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
            maxWidth: '500px',
            width: '100%',
            background: 'var(--surface-color, #ffffff)',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '2rem',
            border: '1px solid var(--glass-border, rgba(0,0,0,0.1))'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>
                💰 Settle Fine Payment
              </h3>
              <button onClick={() => !loading && setSettlingFine(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Student: <strong>{settlingFine.studentName}</strong> ({settlingFine.studentId})</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>Amount: ₹{settlingFine.amount}</div>
            </div>

            <form onSubmit={handleConfirmSettleFine}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Payment Method Received
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['Cash', 'UPI', 'Bank Transfer'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettleMethod(m)}
                      style={{
                        padding: '0.6rem 0.4rem',
                        borderRadius: '8px',
                        border: settleMethod === m ? '2px solid var(--primary-color, #4f46e5)' : '1px solid var(--glass-border)',
                        background: settleMethod === m ? 'rgba(79, 70, 229, 0.12)' : 'var(--surface-color)',
                        color: settleMethod === m ? 'var(--primary-color, #4f46e5)' : 'var(--text-main)',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      {m === 'Cash' ? '💵 Cash' : m === 'UPI' ? '📱 UPI' : '🏦 Bank'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Transaction / Receipt Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash Receipt #124 or UTR No"
                  value={settleTransactionId}
                  onChange={(e) => setSettleTransactionId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSettlingFine(null)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {loading ? 'Settling...' : '✓ Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
