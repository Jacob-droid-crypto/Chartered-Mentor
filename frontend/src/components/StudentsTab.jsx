import React from 'react';

export default function StudentsTab({
  user,
  handleExportStudentsLedger,
  handleExportStudentInfo,
  showAddForm,
  setShowAddForm,
  studentSearch,
  setStudentSearch,
  filteredStudents,
  students,
  newStudent,
  setNewStudent,
  handleAddSubmit,
  openMenuId,
  setOpenMenuId,
  setViewingProfileStudent,
  handleResetPassword,
  handleResetDevice,
  setFeeSetupStudent,
  setActiveTab,
  handleDelete,
  batches = []
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>All Students</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportStudentsLedger}
            style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            {user.role === 'staff' ? '📥 Export Students' : '📥 Export Fee Ledger'}
          </button>
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={handleExportStudentInfo}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
              📥 Export Student Info
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            {showAddForm ? 'Close Form' : '+ Add Student'}
          </button>
        </div>
      </div>

      {/* Search Box */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px', minWidth: '280px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Search students by name, ID, email, course, batch..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 2.5rem 0.65rem 2.5rem',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              background: 'var(--surface-color)',
              backdropFilter: 'blur(8px)',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px var(--shadow-color)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-color)';
              e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--glass-border)';
              e.target.style.boxShadow = '0 4px 12px var(--shadow-color)';
            }}
          />
          {studentSearch && (
            <button
              onClick={() => setStudentSearch('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
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
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500' }}>
          Found {filteredStudents.length} of {students.length} students
        </span>
      </div>

      {showAddForm && (
        <div className="card" style={{ marginBottom: '2rem', overflow: 'visible' }}>
          <h3>Add New Student</h3>
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Name</label>
              <input type="text" required value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email</label>
              <input type="email" required value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
            </div>

            <div style={{ flex: 0.8, minWidth: '120px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course</label>
              <select value={newStudent.course} onChange={e => setNewStudent({ ...newStudent, course: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
                <option value="INTER">INTER</option>
                <option value="FINAL">FINAL</option>
              </select>
            </div>
            <div style={{ flex: 0.8, minWidth: '120px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Mode</label>
              <select value={newStudent.mode || 'residential'} onChange={e => setNewStudent({ ...newStudent, mode: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
                <option value="residential">Residential</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Batch</label>
              <select value={newStudent.batch || (batches.length > 0 ? batches[0].name : '')} onChange={e => setNewStudent({ ...newStudent, batch: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
                {batches.map(b => (
                  <option key={b._id} value={b.name}>{b.name}</option>
                ))}
                {batches.length === 0 && (
                  <>
                    <option value="September 2026">September 2026</option>
                    <option value="November 2026">November 2026</option>
                  </>
                )}
              </select>
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" style={{ padding: '0.65rem 1.5rem', background: '#10b981', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
            </div>
          </form>
        </div>
      )}

      <section className="recent-activity" onClick={() => setOpenMenuId(null)}>
        <div className="activity-list">
          {Array.isArray(filteredStudents) && filteredStudents.map((student) => (
            <div key={student.userId || Math.random()} className="activity-item" style={{ position: 'relative', zIndex: openMenuId === student.userId ? 50 : 1 }}>
              <div className="activity-info">
                <div className="avatar" style={{ width: '35px', height: '35px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {student.name ? student.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                  <strong>
                    {student.name || 'Unknown Student'}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                      #{student.userId}
                    </span>
                  </strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                    <span style={{
                      background: student.currentStatus === 'Inside' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: student.currentStatus === 'Inside' ? '#10b981' : '#ef4444',
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.5rem'
                    }}>
                      {student.currentStatus === 'Inside' ? '🟢 Inside' : '🔴 Outside'}
                    </span>
                    {student.email || 'No email'} • Batch: {student.batch || 'N/A'} • Mode: <span style={{ textTransform: 'capitalize' }}>{student.mode || 'N/A'}</span>
                    {student.joiningDate && ` • Joined: ${new Date(student.joiningDate).toLocaleDateString()}`}
                    {user.role === 'admin' && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                        <span>Total Fee: ₹{student.totalFees || 0}</span>
                        <span style={{ color: '#10b981' }}>Paid: ₹{student.feesPaid || 0}</span>
                        <span style={{ color: '#ef4444' }}>Due: ₹{(student.totalFees || 0) - (student.feesPaid || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === student.userId ? null : student.userId); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem' }}>
                  ⋮
                </button>

                {openMenuId === student.userId && (
                  <div className="options-dropdown" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setViewingProfileStudent(student); setOpenMenuId(null); }} className="dropdown-item">
                      👁️ View Full Profile
                    </button>
                    <button onClick={() => { handleResetPassword(student.userId); setOpenMenuId(null); }} className="dropdown-item">
                      🔄 Reset Password
                    </button>
                    {user.role === 'admin' && (
                      <button onClick={() => { handleResetDevice(student.userId); setOpenMenuId(null); }} className="dropdown-item">
                        📱 Reset Device Lock {student.deviceFingerprint ? "🔐" : "🔓"}
                      </button>
                    )}
                    {user.role === 'admin' && (
                      <>
                        <button onClick={() => {
                          const formatInputDate = (d) => {
                            if (!d) return '';
                            const dateObj = new Date(d);
                            if (isNaN(dateObj.getTime())) return '';
                            const year = dateObj.getFullYear();
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                          };

                          const existingInstallments = Array.isArray(student.installments) && student.installments.length > 0
                            ? student.installments.map(inst => ({
                              amount: inst.amount || '',
                              dueDate: formatInputDate(inst.dueDate),
                              status: inst.status || 'Unpaid',
                              paidDate: formatInputDate(inst.paidDate)
                            }))
                            : [
                              { amount: student.totalFees ? Math.round(Number(student.totalFees) / 3) : '', dueDate: '', status: 'Unpaid' },
                              { amount: student.totalFees ? Math.round(Number(student.totalFees) / 3) : '', dueDate: '', status: 'Unpaid' },
                              { amount: student.totalFees ? (Number(student.totalFees) - 2 * Math.round(Number(student.totalFees) / 3)) : '', dueDate: '', status: 'Unpaid' }
                            ];

                          setFeeSetupStudent({
                            userId: student.userId,
                            name: student.name,
                            totalFees: student.totalFees || '',
                            nextPaymentDueDate: formatInputDate(student.nextPaymentDueDate),
                            installments: existingInstallments,
                            feeHistory: student.feeHistory || [],
                            feesPaid: student.feesPaid || 0
                          });
                          setActiveTab('feeSetup');
                          setOpenMenuId(null);
                        }} className="dropdown-item">
                          💰 Set Fee Structure
                        </button>

                      </>
                    )}
                    {user.role === 'admin' && (
                      <>
                        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }}></div>
                        <button onClick={() => { handleDelete(student.userId); setOpenMenuId(null); }} className="dropdown-item danger">
                          🗑️ Delete Student
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(!Array.isArray(filteredStudents) || filteredStudents.length === 0) && <p style={{ color: 'var(--text-muted)' }}>No students found.</p>}
        </div>
      </section>
    </>
  );
}
