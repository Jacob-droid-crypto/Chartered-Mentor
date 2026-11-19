import React from 'react';

export default function StudyTrackerTab({
  user,
  studyTrackerPeriod,
  setStudyTrackerPeriod,
  calculateStudentStats,
  resolveGoalForStudentOnDate,
  formatLocalDate,
  formatStudyTime
}) {
  const stats = calculateStudentStats();
  const shortfallDays = studyTrackerPeriod === 'week' ? stats.lowHoursWeek : stats.lowHoursMonth;
  const totalDaysCount = shortfallDays.length;
  const todayDayIndex = new Date().getDay();
  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];
  const resolvedConfig = resolveGoalForStudentOnDate(user.userId, formatLocalDate(new Date()));
  const todayTarget = resolvedConfig[todayKey] !== undefined ? resolvedConfig[todayKey] : 12;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>⏱️ Study Goal Tracker</h2>
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.4)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setStudyTrackerPeriod('week')}
            style={{
              padding: '0.5rem 1.2rem',
              background: studyTrackerPeriod === 'week' ? 'var(--primary-color)' : 'transparent',
              color: studyTrackerPeriod === 'week' ? 'white' : 'var(--text-main)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            This Week
          </button>
          <button
            onClick={() => setStudyTrackerPeriod('month')}
            style={{
              padding: '0.5rem 1.2rem',
              background: studyTrackerPeriod === 'month' ? 'var(--primary-color)' : 'transparent',
              color: studyTrackerPeriod === 'month' ? 'white' : 'var(--text-main)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            This Month
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Weekly Target Goals Schedule */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎯 Weekly Target Goals Schedule
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
              const resolvedConfig = resolveGoalForStudentOnDate(user.userId, formatLocalDate(new Date()));
              const target = resolvedConfig[day] !== undefined ? resolvedConfig[day] : (day === 'sunday' ? 0 : 12);
              const isToday = new Date().toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase() === day;
              return (
                <div key={day} style={{
                  padding: '0.75rem',
                  background: isToday ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.05))' : 'rgba(255, 255, 255, 0.4)',
                  border: isToday ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  boxShadow: isToday ? '0 4px 12px rgba(99, 102, 241, 0.1)' : 'none'
                }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'capitalize', color: isToday ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                    {day}
                  </span>
                  <strong style={{ display: 'block', fontSize: '1.25rem', marginTop: '0.25rem', color: 'var(--text-main)' }}>
                    {target > 0 ? `${target} hrs` : 'OFF'}
                  </strong>
                  {isToday && <span style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 'bold', display: 'block', marginTop: '0.25rem' }}>Today</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="dashboard-cards">
          <div className="card">
            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>🎯</div>
            <h3>Target Today</h3>
            <div className="value" style={{ fontSize: '2rem' }}>
              {todayTarget > 0 ? `${todayTarget} Hours` : 'Holiday'}
            </div>
          </div>
          <div className="card">
            <div className="card-icon" style={{ background: totalDaysCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: totalDaysCount > 0 ? '#ef4444' : '#10b981' }}>🚨</div>
            <h3>Shortfall Days (Excluding Absent days)</h3>
            <div className="value" style={{ fontSize: '2rem', color: totalDaysCount > 0 ? '#ef4444' : '#10b981' }}>
              {totalDaysCount} {totalDaysCount === 1 ? 'Day' : 'Days'}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '1rem' }}>
            📋 Shortfall Days (Excluding Absent days)
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Showing days where you studied less than your configured target hours.
          </p>

          {totalDaysCount === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '12px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
              <strong style={{ color: '#10b981', display: 'block', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Perfect Attendance!</strong>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                You have met your daily study goals on all tracked days in this period. Keep it up!
              </p>
            </div>
          ) : (
            <div className="activity-list">
              {shortfallDays.map((day, idx) => {
                const dateObj = new Date(day.date);
                const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
                const shortfallHours = Math.max(0, day.target - day.hours);

                return (
                  <div key={idx} className="activity-item" style={{ alignItems: 'center' }}>
                    <div className="activity-info">
                      <div className="activity-dot" style={{ background: day.status === 'Absent' ? '#ef4444' : '#f59e0b' }}></div>
                      <div>
                        <strong style={{ fontSize: '1.05rem' }}>{day.date} ({dayName})</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                          Status: <span style={{ fontWeight: 'bold', color: day.status === 'Absent' ? '#ef4444' : '#f59e0b' }}>{day.status}</span>
                          <span style={{ marginLeft: '1rem' }}>Target: <strong>{day.target} hrs</strong></span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: day.hours > 0 ? '#f59e0b' : '#ef4444' }}>
                        {formatStudyTime(day.hours)} studied
                      </div>
                      <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.2rem' }}>
                        ⚠️ Shortfall: -{formatStudyTime(shortfallHours)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
