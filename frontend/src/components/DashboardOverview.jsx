import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';

export default function DashboardOverview({
  user,
  data,
  students,
  calculateStudentStats,
  resolveGoalForStudentOnDate,
  formatLocalDate,
  getLocalDateString,
  scanning,
  setScanning,
  handleManualAttendance,
  motivationalQuote,
  liveStudyHours,
  isCurrentlyCheckedIn,
  progressPercent,
  formatLiveStudyTime,
  formatStudyTime,
  todayTarget,
  stats,
  setActiveTab,
  todayAttendanceFilter,
  setTodayAttendanceFilter,
  getStaffNotifications,
  getStudentNotifications
}) {
  return (
    <>
      {user.role === 'student' && (() => {
        const stats = calculateStudentStats();
        const todayDayIndex = new Date().getDay();
        const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];
        const resolvedConfig = resolveGoalForStudentOnDate(user.userId, formatLocalDate(new Date()));
        const todayTarget = resolvedConfig[todayKey] !== undefined ? resolvedConfig[todayKey] : 12;

        const todayLogs = data?.todayLogs || [];
        const lastLog = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null;
        const isCurrentlyCheckedIn = lastLog && lastLog.type === 'IN';

        return (
          <>
            {data?.mode === 'online' ? (
              <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem', color: 'var(--text-main)' }}>Online Attendance</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manually check in when you start studying and check out when you finish.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => handleManualAttendance('IN')} style={{ padding: '0.8rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ✅ Check-In
                  </button>
                  <button onClick={() => handleManualAttendance('OUT')} style={{ padding: '0.8rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ❌ Check-Out
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem', color: 'var(--text-main)' }}>Attend Class via QR</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Align the campus dynamic QR code to securely log your attendance duration.</p>
                  </div>
                  {!scanning ? (
                    <button onClick={() => setScanning(true)} style={{ padding: '0.8rem 1.5rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      📷 Scan QR Code
                    </button>
                  ) : (
                    <button onClick={() => setScanning(false)} style={{ padding: '0.8rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Cancel Scanning
                    </button>
                  )}
                </div>

                {scanning && (
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px' }}></div>
                  </div>
                )}
              </>
            )}

            {motivationalQuote && (
              <div className="card" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.03))',
                borderLeft: '5px solid var(--primary-color)',
                padding: '1.25rem 1.5rem',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.05)'
              }}>
                <span style={{ fontSize: '2rem' }}>✨</span>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--primary-color)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Today's Motivation</h4>
                  <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontStyle: 'italic', lineHeight: '1.4' }}>
                    "{motivationalQuote}"
                  </p>
                </div>
              </div>
            )}

            <div className="dashboard-cards" style={{ marginBottom: '2rem' }}>
              {(() => {
                const progressPercent = todayTarget > 0 ? Math.min(100, (liveStudyHours / todayTarget) * 100) : 0;
                return (
                  <div className={`card ${isCurrentlyCheckedIn ? 'card-live' : ''}`} style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem',
                    padding: '1.75rem',
                    background: isCurrentlyCheckedIn
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(255, 255, 255, 0.9))'
                      : 'white',
                    border: isCurrentlyCheckedIn ? '1.5px solid #10b981' : '1px solid var(--glass-border)',
                    boxShadow: isCurrentlyCheckedIn ? '0 12px 30px rgba(16, 185, 129, 0.12)' : '0 8px 24px var(--shadow-color)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>⏱️</span>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                          TODAY'S STUDY HOURS
                        </h3>
                      </div>
                      <div className="value" style={{
                        fontSize: '2.6rem',
                        fontWeight: '800',
                        fontFamily: 'monospace, var(--font-mono)',
                        letterSpacing: '-1px',
                        background: isCurrentlyCheckedIn
                          ? 'linear-gradient(to right, #10b981, #047857)'
                          : 'linear-gradient(to right, var(--text-main), #475569)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: isCurrentlyCheckedIn ? '0 2px 10px rgba(16, 185, 129, 0.15)' : 'none',
                        marginTop: '0.2rem'
                      }}>
                        {formatLiveStudyTime(liveStudyHours)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        {isCurrentlyCheckedIn ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                            Active Ticking
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: '#64748b',
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Paused
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          Target: {todayTarget > 0 ? `${todayTarget}h` : 'Holiday'}
                        </span>
                      </div>
                    </div>

                    {/* SVG Circular Progress Ring */}
                    <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                        <circle
                          cx="45"
                          cy="45"
                          r="38"
                          fill="transparent"
                          stroke="rgba(226, 232, 240, 0.8)"
                          strokeWidth="6"
                        />
                        <circle
                          cx="45"
                          cy="45"
                          r="38"
                          fill="transparent"
                          stroke={isCurrentlyCheckedIn ? '#10b981' : 'var(--primary-color)'}
                          strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 38}
                          strokeDashoffset={2 * Math.PI * 38 - (progressPercent / 100) * 2 * Math.PI * 38}
                          strokeLinecap="round"
                          style={{
                            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                            filter: isCurrentlyCheckedIn ? 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' : 'none'
                          }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: '800', color: isCurrentlyCheckedIn ? '#10b981' : 'var(--text-main)' }}>
                          {Math.round(progressPercent)}%
                        </span>
                        <span style={{ fontSize: '0.55rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2px', marginTop: '-2px' }}>
                          Done
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {data?.mode === 'residential' && (
                <div className="card" style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(255, 255, 255, 0.9))',
                  border: '1.5px solid rgba(99, 102, 241, 0.15)',
                }}>
                  <div className="card-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)' }}>🪑</div>
                  <h3>Allocated Study Seat</h3>
                  <div className="value" style={{ 
                    fontSize: '2.5rem', 
                    fontWeight: '800', 
                    color: data?.seatNumber ? 'var(--primary-color)' : 'var(--text-muted)' 
                  }}>
                    {data?.seatNumber || 'Not Allotted'}
                  </div>
                </div>
              )}
              <div className="card">
                <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📅</div>
                <h3>Weekly Study Hours</h3>
                <div className="value">{formatStudyTime(stats.weekHours)}</div>
              </div>
              <div className="card">
                <div className="card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>📊</div>
                <h3>Monthly Study Hours</h3>
                <div className="value">{formatStudyTime(stats.monthHours)}</div>
              </div>
              <div className="card">
                <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🚨</div>
                <h3>Absent Days (This Month)</h3>
                <div className="value">{stats.monthAbsentCount} {stats.monthAbsentCount === 1 ? 'day' : 'days'}</div>
              </div>
              <div className="card">
                <div className="card-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: 'var(--secondary-color)' }}>📉</div>
                <h3>Shortfall Days (This Month)</h3>
                <div className="value">{stats.lowHoursMonth.length} {stats.lowHoursMonth.length === 1 ? 'day' : 'days'}</div>
              </div>
            </div>
          </>
        );
      })()}

      {(user.role === 'admin' || user.role === 'staff') && (() => {
        const todayStr = getLocalDateString();
        const todayData = Array.isArray(data) ? data.filter(d => d.date === todayStr) : [];
        const totalStudents = Array.isArray(students) ? students.length : 0;
        const presentCount = todayData.length;
        const absentCount = Math.max(0, totalStudents - presentCount);

        return (
          <div className="dashboard-cards" style={{ marginBottom: '2rem' }}>
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('students')}>
              <div className="card-icon">👨‍🎓</div>
              <h3>Total Registered Students</h3>
              <div className="value">{totalStudents}</div>
            </div>
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => { setTodayAttendanceFilter('present'); const el = document.getElementById('today-summary-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>
              <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📊</div>
              <h3>Active Check-ins Today</h3>
              <div className="value">{presentCount}</div>
            </div>
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => { setTodayAttendanceFilter('absent'); const el = document.getElementById('today-summary-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>
              <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🚨</div>
              <h3>Absentees Today</h3>
              <div className="value">{absentCount}</div>
            </div>
          </div>
        );
      })()}

      {(user.role === 'admin' || user.role === 'staff') && (() => {
        const alerts = getStaffNotifications();
        return (
          <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                🔔 Staff Alerts & Notifications
              </h3>
              <span style={{ fontSize: '0.85rem', background: 'var(--primary-color)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                {alerts.length} Active
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem 1.25rem',
                      borderRadius: '12px',
                      background: alert.severity === 'warning' ? 'rgba(239, 68, 68, 0.04)'
                        : alert.severity === 'success' ? 'rgba(16, 185, 129, 0.04)'
                          : alert.severity === 'info' ? 'rgba(59, 130, 246, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                      border: alert.severity === 'warning' ? '1px solid rgba(239, 68, 68, 0.15)'
                        : alert.severity === 'success' ? '1px solid rgba(16, 185, 129, 0.15)'
                          : alert.severity === 'info' ? '1px solid rgba(59, 130, 246, 0.15)'
                            : '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{alert.icon}</span>
                    <div style={{ flexGrow: 1, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                      {alert.message}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✨</span>
                  No notifications or alerts today. Everything is running smoothly!
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {user.role === 'student' && (() => {
        const alerts = getStudentNotifications();
        return (
          <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                🔔 My Alerts & Notifications
              </h3>
              <span style={{ fontSize: '0.85rem', background: 'var(--primary-color)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                {alerts.length} Active
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem 1.25rem',
                      borderRadius: '12px',
                      background: alert.severity === 'warning' ? 'rgba(239, 68, 68, 0.04)'
                        : alert.severity === 'success' ? 'rgba(16, 185, 129, 0.04)'
                          : alert.severity === 'info' ? 'rgba(59, 130, 246, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                      border: alert.severity === 'warning' ? '1px solid rgba(239, 68, 68, 0.15)'
                        : alert.severity === 'success' ? '1px solid rgba(16, 185, 129, 0.15)'
                          : alert.severity === 'info' ? '1px solid rgba(59, 130, 246, 0.15)'
                            : '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{alert.icon}</span>
                    <div style={{ flexGrow: 1, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                      {alert.message}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✨</span>
                  No notifications or alerts today. Everything is running smoothly!
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {(user.role === 'admin' || user.role === 'staff') && (
        <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '600' }}>Attendance Distribution</h3>
            <div style={{ position: 'relative', height: '220px', display: 'flex', justifyContent: 'center' }}>
              {Array.isArray(data) && data.length > 0 ? (() => {
                const todayDate = getLocalDateString();
                const todayData = data.filter(d => d.date === todayDate);
                const present = todayData.length;
                const absent = Math.max(0, (Array.isArray(students) ? students.length : 0) - present);
                return <Doughnut
                  data={{
                    labels: ['Present', 'Absent'],
                    datasets: [{ data: [present, absent], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, cutout: '75%' }]
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />;
              })() : <p style={{ color: 'var(--text-muted)', margin: 'auto' }}>No attendance logged today.</p>}
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '600' }}>Students by Course</h3>
            <div style={{ position: 'relative', height: '220px' }}>
              {Array.isArray(students) && students.length > 0 ? (() => {
                const interCount = students.filter(s => s.course === 'INTER').length;
                const finalCount = students.filter(s => s.course === 'FINAL').length;
                return <Bar
                  data={{
                    labels: ['INTER', 'FINAL'],
                    datasets: [{ label: 'Students', data: [interCount, finalCount], backgroundColor: ['var(--primary-color)', 'var(--secondary-color)'], borderRadius: 6 }]
                  }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }}
                />;
              })() : <p style={{ color: 'var(--text-muted)', margin: 'auto', textAlign: 'center' }}>No students found.</p>}
            </div>
          </div>
        </div>
      )}

      <section className="recent-activity" id="today-summary-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>{(user.role === 'admin' || user.role === 'staff') ? 'Today\'s Attendance Summary' : 'Your Check-ins'}</h2>
          {(user.role === 'admin' || user.role === 'staff') && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              {['all', 'present', 'absent'].map((filterVal) => (
                <button
                  key={filterVal}
                  type="button"
                  onClick={() => setTodayAttendanceFilter(filterVal)}
                  style={{
                    padding: '0.4rem 1rem',
                    border: 'none',
                    background: todayAttendanceFilter === filterVal ? 'var(--surface-solid)' : 'transparent',
                    color: todayAttendanceFilter === filterVal ? 'var(--primary-color)' : 'var(--text-muted)',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    boxShadow: todayAttendanceFilter === filterVal ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s',
                    textTransform: 'capitalize'
                  }}
                >
                  {filterVal}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="activity-list">
          {(user.role === 'admin' || user.role === 'staff') ? (() => {
            const studentMap = {};
            if (Array.isArray(students)) {
              students.forEach(s => {
                studentMap[s.userId] = s.name;
              });
            }

            const todayStr = getLocalDateString();
            const todayData = Array.isArray(data) ? data.filter(d => d.date === todayStr) : [];
            const attendedMap = {};
            todayData.forEach(r => {
              attendedMap[r.studentId] = r;
            });

            const mergedRecords = Array.isArray(students) ? students.map(student => {
              if (attendedMap[student.userId]) {
                return {
                  ...attendedMap[student.userId],
                  studentName: student.name || attendedMap[student.userId].studentName || studentMap[student.userId] || 'Unknown Student',
                  isAbsent: false,
                  currentStatus: student.currentStatus
                };
              } else {
                return {
                  studentId: student.userId,
                  studentName: student.name || 'Unknown Student',
                  course: student.course,
                  date: todayStr,
                  status: 'Absent',
                  totalHours: 0,
                  firstIn: null,
                  isAbsent: true,
                  currentStatus: student.currentStatus
                };
              }
            }) : [];

            const filteredRecords = mergedRecords.filter(r => {
              if (todayAttendanceFilter === 'present') return !r.isAbsent;
              if (todayAttendanceFilter === 'absent') return r.isAbsent;
              return true;
            });

            if (filteredRecords.length === 0) {
              return <p style={{ color: 'var(--text-muted)' }}>No records found matching criteria.</p>;
            }

            return filteredRecords.map((record, idx) => (
              <div key={idx} className="activity-item" style={{ borderLeft: record.isAbsent ? '4px solid #ef4444' : '4px solid #10b981' }}>
                <div className="activity-info">
                  <div className="activity-dot" style={{ background: record.isAbsent ? '#ef4444' : '#10b981' }}></div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong>{record.studentName}</strong>
                      <span style={{
                        background: record.currentStatus === 'Inside' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        color: record.currentStatus === 'Inside' ? '#10b981' : '#ef4444',
                        border: record.currentStatus === 'Inside' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {record.currentStatus === 'Inside' ? '🟢 Inside' : '🔴 Outside'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                      ID: {record.studentId} • Course: {record.course || '-'}
                      {record.firstIn && (
                        <span style={{ marginLeft: '10px', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' }}>
                          🕒 First Log In: {new Date(record.firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="activity-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 'bold', color: record.isAbsent ? '#ef4444' : '#10b981' }}>
                    {record.status}
                  </span>
                  {!record.isAbsent && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Study: {formatStudyTime(record.totalHours)}
                    </span>
                  )}
                </div>
              </div>
            ));
          })() : (
            data?.todayLogs?.map((log, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-info">
                  <div className="activity-dot" style={{ background: log.type === 'IN' ? '#10b981' : '#ef4444' }}></div>
                  <div><strong>{log.type === 'IN' ? 'Checked IN' : 'Checked OUT'}</strong></div>
                </div>
                <div className="activity-date">{new Date(log.createdAt).toLocaleTimeString()}</div>
              </div>
            ))
          )}
          {(!data || (user.role === 'student' && data?.todayLogs?.length === 0)) && (
            <p style={{ color: 'var(--text-muted)' }}>No records found for today.</p>
          )}
        </div>
      </section>
    </>
  );
}
