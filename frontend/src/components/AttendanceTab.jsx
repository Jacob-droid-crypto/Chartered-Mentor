import React from 'react';

export default function AttendanceTab({
  user,
  data,
  students,
  attendanceSearch,
  setAttendanceSearch,
  attendanceView,
  setAttendanceView,
  selectedAttendanceStudentId,
  setSelectedAttendanceStudentId,
  attendanceStartDate,
  setAttendanceStartDate,
  attendanceEndDate,
  setAttendanceEndDate,
  attendanceDate,
  setAttendanceDate,
  handleExportExcel,
  studentLogs,
  getAggregatedAttendance,
  resolveGoalForStudentOnDate,
  formatStudyTime,
  handleOpenManualCheckin,
  handleOpenManualCheckout,
  handleOpenDeductHours
}) {
  const [searchStudentTerm, setSearchStudentTerm] = React.useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = React.useState(false);
  const selectedStudent = Array.isArray(students) ? students.find(s => s.userId === selectedAttendanceStudentId) : null;
  const filteredStudentsForSelect = Array.isArray(students) ? students.filter(s => {
    const term = searchStudentTerm.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(term) ||
      (s.userId || '').toLowerCase().includes(term)
    );
  }) : [];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Attendance Records</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user.role === 'admin' && (
            <input
              type="text"
              placeholder="Search by student name..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}
            />
          )}
          <select
            value={attendanceView}
            onChange={(e) => setAttendanceView(e.target.value)}
            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
          >
            <option value="daily">Daily View</option>
            <option value="weekly">Weekly Total</option>
            {(user.role === 'admin' || user.role === 'staff' || user.role === 'student') && (
              <option value="student">Student Log History</option>
            )}
            {(user.role === 'admin' || user.role === 'staff' || user.role === 'student') && (
              <option value="range">Custom Date Range</option>
            )}
          </select>
          {attendanceView === 'student' && (user.role === 'admin' || user.role === 'staff') && (
            <div style={{ position: 'relative', minWidth: '220px', maxWidth: '300px' }}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
              >
                <input
                  type="text"
                  placeholder={selectedStudent ? `${selectedStudent.name} (${selectedStudent.userId})` : "Select Student..."}
                  value={isStudentDropdownOpen ? searchStudentTerm : (selectedStudent ? `${selectedStudent.name} (${selectedStudent.userId})` : '')}
                  onChange={(e) => setSearchStudentTerm(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStudentDropdownOpen(true);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    cursor: 'text'
                  }}
                />
                {selectedAttendanceStudentId && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAttendanceStudentId('');
                      setSearchStudentTerm('');
                      setIsStudentDropdownOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      padding: '0 4px',
                      fontWeight: 'bold'
                    }}
                    title="Clear Selection"
                  >
                    ✕
                  </button>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>▼</span>
              </div>

              {isStudentDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '105%',
                  left: 0,
                  width: '100%',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0'
                }}>
                  {filteredStudentsForSelect.length === 0 ? (
                    <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                      No matching students found
                    </div>
                  ) : (
                    filteredStudentsForSelect.map((s) => (
                      <div
                        key={s.userId}
                        onClick={() => {
                          setSelectedAttendanceStudentId(s.userId);
                          setSearchStudentTerm('');
                          setIsStudentDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: 'var(--text-main)',
                          background: selectedAttendanceStudentId === s.userId ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent',
                          fontWeight: selectedAttendanceStudentId === s.userId ? 'bold' : 'normal',
                          textAlign: 'left',
                          transition: 'background 0.2s',
                          borderBottom: '1px solid rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--primary-color-light, rgba(79, 70, 229, 0.04))'}
                        onMouseLeave={(e) => e.target.style.background = selectedAttendanceStudentId === s.userId ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent'}
                      >
                        {s.name} ({s.userId})
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {(attendanceView === 'student' || attendanceView === 'range') && (
            <>
              <input
                type="date"
                placeholder="Start Date"
                title="Start Date"
                value={attendanceStartDate}
                onChange={(e) => setAttendanceStartDate(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
              />
              <input
                type="date"
                placeholder="End Date"
                title="End Date"
                value={attendanceEndDate}
                onChange={(e) => setAttendanceEndDate(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
              />
            </>
          )}
          {(attendanceView === 'daily' || attendanceView === 'weekly') && (
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
            />
          )}
          {attendanceView !== 'student' && (
            <button onClick={handleExportExcel} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
              📥 Export Excel
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {attendanceView === 'daily' ? 'Showing attendance details for selected date.' :
            attendanceView === 'student' ? 'Showing detailed check-in and check-out history.' :
              `Showing detailed check-in and check-out history for the selected period.`}
        </p>
        <div className="activity-list">
          {attendanceView === 'student' ? (() => {
            const targetId = (user.role === 'student') ? user.userId : selectedAttendanceStudentId;
            if (!targetId) {
              return <p style={{ color: 'var(--text-muted)' }}>Please select a student to view their history.</p>;
            }
            const filteredLogs = studentLogs.filter(log => {
              if (attendanceStartDate && log.date < attendanceStartDate) return false;
              if (attendanceEndDate && log.date > attendanceEndDate) return false;
              return true;
            });
            if (filteredLogs.length === 0) {
              return <p style={{ color: 'var(--text-muted)' }}>No logs found for this student in the selected period.</p>;
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Found {filteredLogs.length} activity records:
                </p>
                {filteredLogs.map((log, index) => {
                  const logDate = new Date(log.timestamp);
                  return (
                    <div key={index} className="activity-item" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.4)',
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div className="activity-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="activity-dot" style={{
                          background: log.type === 'IN' ? '#10b981' : '#ef4444',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%'
                        }}></div>
                        <div>
                          <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>
                            {log.type === 'IN' ? '🟢 Checked IN' : '🔴 Checked OUT'}
                          </strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Course: {log.course || '-'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                          {isNaN(logDate.getTime()) ? (log.time || '-') : logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {log.date}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })() : (() => {
            // Render aggregated data
            const aggregatedData = getAggregatedAttendance();
            if (aggregatedData.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No records found for the selected criteria.</p>;

            return aggregatedData.map((record, idx) => (
              <div key={idx} className="activity-item" style={{ flexWrap: 'wrap' }}>
                <div className="activity-info">
                  <div className="activity-dot" style={{ background: attendanceView === 'daily' ? (record.status === 'Present' ? '#10b981' : '#ef4444') : '#3b82f6' }}></div>
                  <div>
                    <strong>{user.role === 'student' ? 'My Attendance Summary' : (record.studentName || record.studentId || 'Unknown Student')}</strong>
                    {(() => {
                      const studentInfo = Array.isArray(students) ? students.find(s => s.userId === record.studentId) : null;
                      const joiningDateStr = studentInfo?.joiningDate || (record.studentId === user.userId ? data?.joiningDate : null);
                      return (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          ID: {record.studentId} • Course: {record.course || '-'}
                          {joiningDateStr && ` • DOJ: ${new Date(joiningDateStr).toLocaleDateString()}`}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {attendanceView === 'daily' ? (() => {
                  const recDate = new Date(record.date);
                  const dayOfWeek = recDate.getDay();
                  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const dayKey = dayKeys[dayOfWeek];
                  const resolvedConfig = resolveGoalForStudentOnDate(record.studentId, record.date);
                  const targetHours = resolvedConfig[dayKey] !== undefined ? resolvedConfig[dayKey] : 12;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div className="activity-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : '#ef4444' }}>
                            {record.status} ({formatStudyTime(record.totalHours)})
                          </span>
                          {record.deductionMinutes > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 'bold' }}>
                              Penalty: -{formatStudyTime(record.deductionHours)} ({record.deductionReason || 'Deduction'})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          {record.deductionMinutes > 0 && `Tracked: ${formatStudyTime(record.rawHours)} • `}
                          {record.firstIn && `First Log In: ${new Date(record.firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • `}Target: {targetHours > 0 ? `${targetHours} hrs` : 'Holiday'} • {record.date}
                        </span>
                      </div>
                      {user.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {record.status === 'Present' ? (
                            <>
                              {handleOpenDeductHours && (
                                <button
                                  onClick={() => handleOpenDeductHours(record)}
                                  style={{
                                    padding: '0.45rem 0.9rem',
                                    background: record.deductionMinutes > 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                    border: '1px solid #ef4444',
                                    color: '#ef4444',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  title={record.deductionMinutes > 0 ? "Edit Penalty Deduction" : "Deduct Study Hours"}
                                >
                                  {record.deductionMinutes > 0 ? 'Edit Penalty ✂️' : 'Deduct Hours ✂️'}
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenManualCheckin(record)}
                                style={{
                                  padding: '0.45rem 0.9rem',
                                  background: 'transparent',
                                  border: '1px solid #10b981',
                                  color: '#10b981',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Edit IN ✏️
                              </button>
                              <button
                                onClick={() => handleOpenManualCheckout(record)}
                                style={{
                                  padding: '0.45rem 0.9rem',
                                  background: !record.hasOUT ? '#f59e0b' : 'transparent',
                                  border: !record.hasOUT ? 'none' : '1px solid #3b82f6',
                                  color: !record.hasOUT ? 'white' : '#3b82f6',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  boxShadow: !record.hasOUT ? '0 4px 10px rgba(245, 158, 11, 0.2)' : 'none'
                                }}
                              >
                                {!record.hasOUT ? 'Mark OUT 🕒' : 'Edit OUT ✏️'}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenManualCheckin(record)}
                              style={{
                                padding: '0.45rem 0.9rem',
                                background: '#10b981',
                                border: 'none',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              Mark IN 🕒
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>Present: {record.totalPresent}</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                      Absent: {record.totalAbsent}
                    </span>
                    {(attendanceView === 'weekly' || attendanceView === 'range') && (
                      <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Late Logins: {record.lateCount || 0}</span>
                    )}
                    <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Study: {formatStudyTime(record.totalHours)}</span>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
    </>
  );
}
