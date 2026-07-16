import React from 'react';

export default function SchedulesTab({
  user,
  students,
  schedules,
  fetchSchedules,
  showConfirm,
  loading,
  setLoading
}) {
  return (
    <>
      {(user.role === 'admin' || user.role === 'staff') ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2>Manage Student Schedules</h2>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Schedule New Activity</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const file = e.target.file.files[0];
                if (!file) {
                  alert("Please upload a PDF file.");
                  return;
                }
                if (file.type !== 'application/pdf') {
                  alert("Only PDF files are allowed for schedules.");
                  return;
                }
                if (file.size > 4 * 1024 * 1024) {
                  alert("File size exceeds Vercel's 4.5MB upload limit. Please upload a smaller file under 4MB.");
                  return;
                }

                const formData = new FormData();
                formData.append('title', e.target.title.value);
                formData.append('target', e.target.target.value);
                formData.append('date', e.target.date.value);
                formData.append('file', file);

                try {
                  setLoading(true);
                  const res = await fetch('/admin/schedule', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${user.token}`
                    },
                    body: formData
                  });
                  const resData = await res.json();
                  if (!res.ok) throw new Error(resData.message);
                  alert('Schedule created successfully!');
                  e.target.reset();
                  fetchSchedules();
                } catch (err) {
                  alert('Scheduling failed: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Task Title / Heading</label>
                  <input type="text" name="title" placeholder="e.g. Weekly Study Plan" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Target Student</label>
                  <select name="target" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}>
                    <option value="">Select a Student...</option>
                    {students && students.map(s => (
                      <option key={s.userId} value={s.userId}>{s.name} ({s.userId})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Start Date</label>
                  <input type="date" name="date" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Upload Schedule PDF</label>
                  <input type="file" name="file" accept=".pdf" required style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
              </div>

              <button type="submit" style={{ padding: '0.75rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>Schedule Activity</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>All Scheduled Activities</h3>
            <div className="activity-list">
              {schedules.map(sched => {
                const isCompleted = sched.status === 'Completed';
                const targetStudent = students.find(s => s.userId === sched.target);
                const studentName = targetStudent ? targetStudent.name : sched.target;

                return (
                  <div key={sched._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                    <div className="activity-item" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1.2rem',
                      background: 'white',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                    }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{sched.title}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          <span>Target: <strong>{studentName} ({sched.target})</strong></span>
                          <span>Start Date: <strong>{new Date(sched.date).toLocaleDateString()}</strong></span>
                          {sched.openedAt ? (
                            <span style={{ color: '#10b981', fontWeight: '500' }}>
                              👁️ Opened: {new Date(sched.openedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>💤 Unopened</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {sched.fileName && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/admin/schedule/${sched._id}/download`, {
                                  headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                                if (!res.ok) throw new Error("Failed to download");
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = sched.fileName || 'file.pdf';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                              } catch (err) {
                                alert("Error downloading schedule: " + err.message);
                              }
                            }}
                            style={{ padding: '0.45rem 0.9rem', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Download PDF Schedule"
                          >
                            Download PDF 📥
                          </button>
                        )}
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          color: isCompleted ? '#10b981' : '#f59e0b',
                          background: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                        }}>
                          {sched.status}
                        </span>
                        {user.role === 'admin' && (
                          <button
                            onClick={async () => {
                              if (!await showConfirm('Delete this schedule?')) return;
                              try {
                                const res = await fetch(`/admin/schedule/${sched._id}`, {
                                  method: 'DELETE',
                                  headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                                if (res.ok) fetchSchedules();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}
                            title="Delete Schedule"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {schedules.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No scheduled activities found.</p>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2>My Study Schedules</h2>
          </div>

          <div className="card">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Below are your scheduled study guides/plans. Click download to access the files.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.08)',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#d97706',
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.05)',
              animation: 'fadeIn 0.5s ease-out'
            }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <span>Schedules are automatically deleted from the system <strong>10 days</strong> after you open them.</span>
            </div>

            <div className="activity-list">
              {schedules.map((sched) => {
                return (
                  <div key={sched._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                    <div className="activity-item" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1.2rem',
                      background: 'white',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                            {sched.title}
                          </strong>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <span>📅 Start Date: {new Date(sched.date).toLocaleDateString()}</span>
                            {sched.openedAt && (
                              <span style={{ color: '#10b981', fontWeight: '500' }}>
                                👁️ Opened: {new Date(sched.openedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {sched.fileName && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/student/schedule/${sched._id}/download`, {
                                  headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                                if (!res.ok) throw new Error("Failed to download");
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = sched.fileName || 'schedule.pdf';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                fetchSchedules();
                              } catch (err) {
                                alert("Error downloading schedule: " + err.message);
                              }
                            }}
                            style={{
                              padding: '0.55rem 1.2rem',
                              background: 'var(--primary-color)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
                            }}
                          >
                            Download PDF 📥
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {schedules.length === 0 && (
                <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No schedules available to download.</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
