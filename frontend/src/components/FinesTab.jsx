import React, { useState } from 'react';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function FinesTab({ user, students = [], fetchStudentsData }) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reason, setReason] = useState('Study Hours Deficit');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // States for searchable student dropdown
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  
  // Search & Filter state for fines ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

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
          endDate
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

      setStatusMsg({ type: 'success', text: `Fine of ₹${amount} for '${reason}' applied successfully!` });
      setAmount('');
      setStartDate(getTodayStr());
      setEndDate(getTodayStr());
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

  // Handle fine payment status update
  const handlePayFine = async (studentId, fineId) => {
    if (!window.confirm('Mark this fine as paid?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/student/${studentId}/fine/${fineId}/pay`, {
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
        throw new Error(dataPay.message || 'Failed to mark fine as paid');
      }
      setStatusMsg({ type: 'success', text: 'Fine marked as Paid successfully.' });
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
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Paid' ? f.status === 'Paid' : f.status !== 'Paid');
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || f.studentName.toLowerCase().includes(q) || f.studentId.toLowerCase().includes(q);
    return matchesReason && matchesStatus && matchesQuery;
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
        justify: 'space-between',
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
            Apply fines to students for Study Hours Deficit or Excess Leaves with date range selection.
          </p>
        </div>
      </div>

      {/* Status Messages */}
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
          justify: 'space-between',
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
                    setSearchStudentTerm(''); // Clear term to show all on focus
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
                    onChange={() => setReason('Study Hours Deficit')}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  ⏰ Study Hours Deficit
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
                    onChange={() => setReason('Excess Leaves')}
                    style={{ accentColor: '#8b5cf6' }}
                  />
                  🏖️ Excess Leaves
                </label>
              </div>
            </div>

            {/* Fine Amount Input */}
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
                required
              />
            </div>

            {/* Date Range Selection (Calendar Pickers) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                📅 Fine Period / Date Range <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                    Start Date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (new Date(endDate) < new Date(e.target.value)) {
                        setEndDate(e.target.value);
                      }
                    }}
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
                    required
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                    End Date
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
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
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.8rem 2rem',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Processing...' : '🚨 Apply Fine'}
          </button>
        </form>
      </div>

      {/* Applied Fines History Table */}
      <div className="card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--glass-border, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0, 0, 0, 0.05))'
      }}>
        <div style={{
          display: 'flex',
          justify: 'space-between',
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
              placeholder="Search student or ID..."
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
              <option value="All" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>All Reasons</option>
              <option value="Study Hours Deficit" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>Study Hours Deficit</option>
              <option value="Excess Leaves" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>Excess Leaves</option>
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
              <option value="All" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>All Statuses</option>
              <option value="Paid" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>Paid</option>
              <option value="Unpaid" style={{ background: 'var(--card-bg, #ffffff)', color: 'var(--text-main, #0f172a)' }}>Unpaid</option>
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
                  <th style={{ padding: '0.75rem 1rem' }}>Applicable Period</th>
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
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: '#ef4444' }}>
                      ₹{fine.amount}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: '500' }}>
                      📅 {formatFinePeriod(fine)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        background: fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: fine.status === 'Paid' ? '#10b981' : '#ef4444',
                        border: `1px solid ${fine.status === 'Paid' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {fine.status === 'Paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {fine.status !== 'Paid' && (
                          <button
                            onClick={() => handlePayFine(fine.studentId, fine._id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              transition: 'all 0.2s'
                            }}
                            title="Mark as Paid"
                          >
                            ✓ Mark Paid
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
                          🗑️ Delete
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
    </div>
  );
}
