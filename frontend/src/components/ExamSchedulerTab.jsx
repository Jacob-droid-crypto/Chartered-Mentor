import React from 'react';

export default function ExamSchedulerTab({
  students,
  user,
  schedulerStudentId,
  setSchedulerStudentId,
  schedulerType,
  setSchedulerType,
  schedulerDate,
  setSchedulerDate,
  schedulerExamName,
  setSchedulerExamName,
  schedulerFilterDate,
  setSchedulerFilterDate,
  examSchedules,
  showEditModal,
  setShowEditModal,
  editingSchedule,
  setEditingSchedule,
  editDate,
  setEditDate,
  editExamName,
  setEditExamName,
  handleCreateExamSchedule,
  handleDeleteExamSchedule,
  handleUpdateExamSchedule,
  getLocalDateString
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Add Details Card */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📝 Add Details
          </h3>
          <form onSubmit={handleCreateExamSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Student Name</label>
              <select
                value={schedulerStudentId}
                onChange={(e) => setSchedulerStudentId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
              >
                <option value="" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>Select Student...</option>
                {students && students.map(s => (
                  <option key={s.userId} value={s.userId} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                    {s.name} ({s.userId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Exam/Schedule</label>
              <select
                value={schedulerType}
                onChange={(e) => setSchedulerType(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
              >
                <option value="Exam" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>Exam</option>
                <option value="Schedule" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>Schedule</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Date</label>
              <input
                type="date"
                value={schedulerDate}
                onChange={(e) => setSchedulerDate(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
              />
            </div>

            {schedulerType === "Exam" && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Exam Name</label>
                <input
                  type="text"
                  value={schedulerExamName}
                  onChange={(e) => setSchedulerExamName(e.target.value)}
                  placeholder="e.g. CA Final Audit"
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
                />
              </div>
            )}

            <button type="submit" style={{ padding: '0.8rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>
              Save Entry
            </button>
          </form>
        </div>

        {/* View / Date Filter Card */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🔍 View to admin/staff</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Date Filter</label>
              <input
                type="date"
                value={schedulerFilterDate}
                onChange={(e) => setSchedulerFilterDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', marginBottom: '0.5rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSchedulerFilterDate(getLocalDateString(yesterday));
                }}
                style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}
              >
                Yesterday
              </button>
              <button
                onClick={() => setSchedulerFilterDate(getLocalDateString(new Date()))}
                style={{ flex: 1, padding: '0.5rem', background: 'var(--primary-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 'bold' }}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setSchedulerFilterDate(getLocalDateString(tomorrow));
                }}
                style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}
              >
                Tomorrow
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {/* Exams Section */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
                📝 Exams on {schedulerFilterDate}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {examSchedules.filter(item => item.type === "Exam" && getLocalDateString(new Date(item.date)) === schedulerFilterDate).map(item => (
                  <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '500' }}>{item.studentName}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{item.examName}</span>
                  </div>
                ))}
                {examSchedules.filter(item => item.type === "Exam" && getLocalDateString(new Date(item.date)) === schedulerFilterDate).length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No exams scheduled for this date.</p>
                )}
              </div>
            </div>

            {/* Schedule Section */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
                🗓️ Schedule Ending on {schedulerFilterDate}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {examSchedules.filter(item => item.type === "Schedule" && getLocalDateString(new Date(item.date)) === schedulerFilterDate).map(item => (
                  <div key={item._id} style={{ padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                    <span style={{ fontWeight: '500' }}>{item.studentName}</span>
                  </div>
                ))}
                {examSchedules.filter(item => item.type === "Schedule" && getLocalDateString(new Date(item.date)) === schedulerFilterDate).length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No schedules ending on this date.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List of All Schedules & Exams */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>📋 All Scheduled Exams & Study Schedules</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Complete list of exams and schedules. Use the action buttons to edit dates or remove entries.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Student Name</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Type</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Scheduled Date</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Exam Name</th>
                <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const todayStr = getLocalDateString();
                const activeExamSchedules = examSchedules.filter(item => {
                  const itemDateStr = getLocalDateString(new Date(item.date));
                  return itemDateStr >= todayStr;
                });

                return activeExamSchedules.map((item) => (
                  <tr key={item._id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: '500' }}>{item.studentName}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: item.type === "Exam" ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: item.type === "Exam" ? '#ef4444' : '#3b82f6'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      {new Date(item.date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', color: item.type === 'Exam' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {item.type === 'Exam' ? item.examName : '-'}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingSchedule(item);
                            setEditDate(getLocalDateString(new Date(item.date)));
                            setEditExamName(item.examName || "");
                            setShowEditModal(true);
                          }}
                          style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                        >
                          Edit
                        </button>
                        {user.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteExamSchedule(item._id)}
                            style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
              {(() => {
                const todayStr = getLocalDateString();
                const activeCount = examSchedules.filter(item => getLocalDateString(new Date(item.date)) >= todayStr).length;
                return activeCount === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No scheduled exams or ending study schedules yet.
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingSchedule && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Edit Entry: {editingSchedule.type}</h3>
            <form onSubmit={handleUpdateExamSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Student Name</label>
                <input
                  type="text"
                  value={editingSchedule.studentName}
                  disabled
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Scheduled Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
                />
              </div>

              {editingSchedule.type === "Exam" && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Exam Name</label>
                  <input
                    type="text"
                    value={editExamName}
                    onChange={(e) => setEditExamName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                  }}
                  style={{ padding: '0.6rem 1.2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.6rem 1.2rem', background: '#10b981', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
