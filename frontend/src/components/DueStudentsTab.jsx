import React from 'react';

export default function DueStudentsTab({
  user,
  students,
  dueSearchQuery,
  setDueSearchQuery,
  dueFilterType,
  setDueFilterType,
  upcomingStartDate,
  setUpcomingStartDate,
  upcomingEndDate,
  setUpcomingEndDate,
  setViewingProfileStudent,
  getLocalDateString,
  handleExportDueStudents
}) {
  const todayStr = getLocalDateString();
  const dueItems = [];

  if (Array.isArray(students)) {
    students.forEach(student => {
      if (student.role !== 'student') return;
      const remainingBalance = student.totalFees !== undefined
        ? (student.totalFees || 0) - (student.feesPaid || 0)
        : undefined;
      const insts = student.installments || [];
      const unpaidInsts = insts.filter(inst => inst.status !== 'Paid');
      
      const addRow = (instIndex, instAmt, originalAmt, dueDate) => {
        const dueDateStr = dueDate ? getLocalDateString(new Date(dueDate)) : '';
        let dueStatus = 'upcoming';
        let dueStatusLabel = 'Upcoming';
        let daysDiff = 0;
        
        if (dueDateStr) {
          const dueDateTime = new Date(dueDateStr).getTime();
          const todayTime = new Date(todayStr).getTime();
          const diffTime = dueDateTime - todayTime;
          daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (dueDateStr === todayStr) {
            dueStatus = 'due_today';
            dueStatusLabel = 'Due Today';
          } else if (dueDateStr < todayStr) {
            dueStatus = 'overdue';
            dueStatusLabel = 'Overdue';
          }
        }

        dueItems.push({
          studentId: student.userId,
          studentName: student.name,
          email: student.email,
          phone: student.phone,
          course: student.course,
          batch: student.batch,
          installmentIndex: instIndex,
          installmentAmount: instAmt,
          originalAmount: originalAmt,
          dueDate,
          dueDateStr,
          dueStatus,
          dueStatusLabel,
          daysDiff,
          remainingBalance,
          studentObj: student
        });
      };

      if (unpaidInsts.length > 0) {
        unpaidInsts.forEach((inst) => {
          const idx = insts.indexOf(inst);
          addRow(idx, inst.adjustedAmount !== undefined ? inst.adjustedAmount : inst.amount, inst.amount, inst.dueDate);
        });
      } else if (remainingBalance > 0 && student.nextPaymentDueDate) {
        addRow(-1, remainingBalance, remainingBalance, student.nextPaymentDueDate);
      }
    });
  }

  // Sort dueItems by dueDate in ascending order (oldest due date / most overdue first, leading up to current day and future)
  dueItems.sort((a, b) => {
    const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return timeA - timeB;
  });

  // Compute counts for filter sub-tabs (filtering upcoming by custom range)
  const totalCount = dueItems.length;
  const overdueCount = dueItems.filter(item => item.dueStatus === 'overdue').length;
  const dueTodayCount = dueItems.filter(item => item.dueStatus === 'due_today').length;
  const upcomingCount = dueItems.filter(item => 
    item.dueStatus === 'upcoming' && 
    (!upcomingStartDate || item.dueDateStr >= upcomingStartDate) && 
    (!upcomingEndDate || item.dueDateStr <= upcomingEndDate)
  ).length;

  // Filter list based on search, filter, and calendar selections
  const filteredDueItems = dueItems.filter(item => {
    if (dueFilterType === 'overdue' && item.dueStatus !== 'overdue') return false;
    if (dueFilterType === 'due_today' && item.dueStatus !== 'due_today') return false;
    if (dueFilterType === 'upcoming') {
      if (item.dueStatus !== 'upcoming') return false;
      if (upcomingStartDate && item.dueDateStr < upcomingStartDate) return false;
      if (upcomingEndDate && item.dueDateStr > upcomingEndDate) return false;
    }

    const q = dueSearchQuery.toLowerCase().trim();
    if (q) {
      return (
        (item.studentName && item.studentName.toLowerCase().includes(q)) ||
        (item.studentId && item.studentId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const isStaff = user.role === 'staff';

  return (
    <>
      {/* Top Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #ef4444' }}>
          <div style={{ fontSize: '2rem' }}>🚨</div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Overdue Accounts</div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#ef4444' }}>{overdueCount}</h3>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ fontSize: '2rem' }}>📅</div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Due Today</div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#f59e0b' }}>{dueTodayCount}</h3>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #3b82f6' }}>
          <div style={{ fontSize: '2rem' }}>⌛</div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upcoming Dues</div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#3b82f6' }}>{upcomingCount}</h3>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #10b981' }}>
          <div style={{ fontSize: '2rem' }}>💳</div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Pending</div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#10b981' }}>{totalCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setDueFilterType('all')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: dueFilterType === 'all' ? 'var(--primary-color)' : 'rgba(255,255,255,0.4)',
                color: dueFilterType === 'all' ? 'white' : 'var(--text-main)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setDueFilterType('overdue')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: dueFilterType === 'overdue' ? '#ef4444' : 'rgba(255,255,255,0.4)',
                color: dueFilterType === 'overdue' ? 'white' : 'var(--text-main)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Overdue ({overdueCount})
            </button>
            <button
              onClick={() => setDueFilterType('due_today')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: dueFilterType === 'due_today' ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                color: dueFilterType === 'due_today' ? 'white' : 'var(--text-main)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Due Today ({dueTodayCount})
            </button>
            <button
              onClick={() => setDueFilterType('upcoming')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: dueFilterType === 'upcoming' ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                color: dueFilterType === 'upcoming' ? 'white' : 'var(--text-main)',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Upcoming ({upcomingCount})
            </button>
          </div>

          {/* Date Range Picker for Upcoming */}
          {dueFilterType === 'upcoming' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.4)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Upcoming Calendar Range:</span>
              <input
                type="date"
                value={upcomingStartDate}
                onChange={(e) => setUpcomingStartDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', background: 'white', color: 'var(--text-main)' }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={upcomingEndDate}
                onChange={(e) => setUpcomingEndDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', background: 'white', color: 'var(--text-main)' }}
              />
            </div>
          )}

          {/* Export button */}
          <button
            onClick={() => handleExportDueStudents(filteredDueItems)}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#10b981',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            📥 Export Dues List
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', position: 'relative', width: '100%', maxWidth: '500px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by student name or ID..."
            value={dueSearchQuery}
            onChange={(e) => setDueSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 2.5rem 0.65rem 2.5rem',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              background: 'white',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'all 0.2s'
            }}
          />
          {dueSearchQuery && (
            <button
              onClick={() => setDueSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Dues List Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Student</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Due Item</th>
                {!isStaff && <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Amount Due</th>}
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Due Date</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDueItems.length > 0 ? (
                <>
                  {filteredDueItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.studentName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {item.studentId}</div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div>{item.installmentIndex === -1 ? 'Pending Balance' : `Installment ${item.installmentIndex + 1}`}</div>
                        {!isStaff && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total Bal: ₹{item.remainingBalance}</div>
                        )}
                      </td>
                      {!isStaff && (
                        <td style={{ padding: '1rem 0.75rem' }}>
                          <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>₹{item.installmentAmount}</strong>
                        </td>
                      )}
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ fontWeight: '500' }}>
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          color: item.dueStatus === 'overdue' ? '#ef4444' : item.dueStatus === 'due_today' ? '#f59e0b' : '#3b82f6',
                          marginTop: '2px'
                        }}>
                          {item.dueStatus === 'due_today' ? 'Due today' : 
                           item.dueStatus === 'overdue' ? `${Math.abs(item.daysDiff)} days overdue` : 
                           `Due in ${item.daysDiff} days`}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          background: item.dueStatus === 'overdue' ? 'rgba(239, 68, 68, 0.1)' : 
                                      item.dueStatus === 'due_today' ? 'rgba(245, 158, 11, 0.1)' : 
                                      'rgba(59, 130, 246, 0.1)',
                          color: item.dueStatus === 'overdue' ? '#ef4444' : 
                                 item.dueStatus === 'due_today' ? '#f59e0b' : 
                                 '#3b82f6'
                        }}>
                          {item.dueStatusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setViewingProfileStudent(item.studentObj)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--primary-color)';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                            e.currentTarget.style.color = 'var(--primary-color)';
                          }}
                        >
                          {isStaff ? '🔍 View Details' : '🔍 View Ledger'}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Sum Total Row (Only for admin) */}
                  {!isStaff && (
                    <tr style={{ borderTop: '2px solid var(--glass-border)', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)' }}>
                      <td colSpan="2" style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>Total Due Amount</td>
                      <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                        ₹{filteredDueItems.reduce((sum, item) => sum + (item.installmentAmount || 0), 0)}
                      </td>
                      <td colSpan="3"></td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={isStaff ? 5 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍃</div>
                    <div>No students with due fees match the current search or filters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
