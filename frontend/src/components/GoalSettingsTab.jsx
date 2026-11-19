import React from 'react';

export default function GoalSettingsTab({
  user,
  selectedGoalStudent,
  setSelectedGoalStudent,
  students,
  resolveGoalForStudentOnDate,
  formatLocalDate,
  setLoading,
  fetchGoalConfig,
  goalConfig,
  goalConfigs
}) {
  const [searchStudentTerm, setSearchStudentTerm] = React.useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = React.useState(false);
  const selectedStudent = Array.isArray(students) ? students.find(s => s.userId === selectedGoalStudent) : null;
  const filteredStudentsForSelect = Array.isArray(students) ? students.filter(s => {
    const term = searchStudentTerm.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(term) ||
      (s.userId || '').toLowerCase().includes(term)
    );
  }) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>⚙️ Configure Daily Study Target Hours</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Set the target study hours for students for each day of the week. Setting target hours to 0 will mark that day as a holiday and exclude it from student shortfall calculations.
        </p>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Select Target Student
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--glass-border, #cbd5e1)',
                borderRadius: '8px',
                padding: '0.8rem',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
            >
              <input
                type="text"
                placeholder={selectedStudent ? `${selectedStudent.name} (${selectedStudent.userId}) - ${selectedStudent.course || ''}` : "All Students (Default)"}
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
                  fontSize: '1rem',
                  cursor: 'text'
                }}
              />
              {selectedGoalStudent && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGoalStudent('');
                    setSearchStudentTerm('');
                    setIsStudentDropdownOpen(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0 6px',
                    fontWeight: 'bold'
                  }}
                  title="Reset to All Students"
                >
                  ✕
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>▼</span>
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
                <div
                  onClick={() => {
                    setSelectedGoalStudent('');
                    setSearchStudentTerm('');
                    setIsStudentDropdownOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                    background: !selectedGoalStudent ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent',
                    fontWeight: !selectedGoalStudent ? 'bold' : 'normal',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--primary-color-light, rgba(79, 70, 229, 0.04))'}
                  onMouseLeave={(e) => e.target.style.background = !selectedGoalStudent ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent'}
                >
                  All Students (Default)
                </div>
                {filteredStudentsForSelect.length === 0 ? (
                  <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                    No matching students found
                  </div>
                ) : (
                  filteredStudentsForSelect.map((s) => (
                    <div
                      key={s.userId}
                      onClick={() => {
                        setSelectedGoalStudent(s.userId);
                        setSearchStudentTerm('');
                        setIsStudentDropdownOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        background: selectedGoalStudent === s.userId ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent',
                        fontWeight: selectedGoalStudent === s.userId ? 'bold' : 'normal',
                        textAlign: 'left',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'var(--primary-color-light, rgba(79, 70, 229, 0.04))'}
                      onMouseLeave={(e) => e.target.style.background = selectedGoalStudent === s.userId ? 'var(--primary-color-light, rgba(79, 70, 229, 0.08))' : 'transparent'}
                    >
                      {s.name} ({s.userId}) - {s.course}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {(() => {
          const activeConfForSelected = resolveGoalForStudentOnDate(selectedGoalStudent, formatLocalDate(new Date()));
          return (
            <form
              key={selectedGoalStudent}
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = {
                  studentId: selectedGoalStudent || null,
                  sunday: parseFloat(e.target.sunday.value),
                  monday: parseFloat(e.target.monday.value),
                  tuesday: parseFloat(e.target.tuesday.value),
                  wednesday: parseFloat(e.target.wednesday.value),
                  thursday: parseFloat(e.target.thursday.value),
                  friday: parseFloat(e.target.friday.value),
                  saturday: parseFloat(e.target.saturday.value)
                };
                if (!selectedGoalStudent) {
                  formData.autoLogoutEnabled = e.target.autoLogoutEnabled.checked;
                  formData.autoLogoutTime = e.target.autoLogoutTime.value;
                }
                try {
                  setLoading(true);
                  const res = await fetch('/admin/goal-config', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                  });
                  if (!res.ok) throw new Error(await res.text());
                  alert('Study target configuration saved successfully!');
                  fetchGoalConfig();
                } catch (err) {
                  alert('Error: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'capitalize' }}>
                      {day} Target (hrs)
                    </label>
                    <input
                      type="number"
                      name={day}
                      min="0"
                      max="24"
                      step="0.5"
                      defaultValue={activeConfForSelected[day] !== undefined ? activeConfForSelected[day] : (day === 'sunday' ? 0 : 12)}
                      required
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }}
                    />
                  </div>
                ))}
              </div>

              {!selectedGoalStudent && (
                <>
                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: 'var(--text-main)', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', fontSize: '1.2rem', fontWeight: '600' }}>⏰ Auto Logout Configuration</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    Automatically log out students who forgot to check out at a specific time of day.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', background: 'rgba(255, 255, 255, 0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' }}>
                      <input
                        type="checkbox"
                        name="autoLogoutEnabled"
                        defaultChecked={goalConfig.autoLogoutEnabled !== undefined ? goalConfig.autoLogoutEnabled : true}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Enable Auto Logout for Students
                    </label>
                    <div style={{ maxWidth: '220px' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        Auto Logout Time (IST)
                      </label>
                      <input
                        type="time"
                        name="autoLogoutTime"
                        defaultValue={goalConfig.autoLogoutTime || "22:00"}
                        required
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '1rem' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
                }}
              >
                Save Study Goals
              </button>
            </form>
          );
        })()}
      </div>

      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Goal Configurations History
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          This history shows all goal configurations set over time. Attendance stats are calculated using the target hours active at the time.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {goalConfigs.map((c) => {
            const isFallback = !c.studentId && c.effectiveFrom === '1970-01-01';
            const studentName = c.studentId 
              ? (students.find(s => s.userId === c.studentId)?.name || c.studentId)
              : 'All Students (Default)';
            
            return (
              <div 
                key={c._id} 
                style={{ 
                  background: c.studentId ? 'rgba(59, 130, 246, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ 
                      padding: '0.3rem 0.75rem', 
                      borderRadius: '20px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      background: c.studentId ? '#3b82f6' : '#10b981',
                      color: 'white',
                      display: 'inline-block',
                      marginBottom: '0.4rem'
                    }}>
                      {studentName}
                    </span>
                    {c.studentId && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8' }}>(ID: {c.studentId})</span>}
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      Effective From: <strong>{c.effectiveFrom === '1970-01-01' ? 'Initial Setup (Always Active)' : c.effectiveFrom}</strong>
                    </div>
                  </div>
                  
                  {!isFallback && user.role === 'admin' && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete this configuration for ${studentName} effective from ${c.effectiveFrom}?`)) {
                          try {
                            setLoading(true);
                            const res = await fetch(`/admin/goal-config/${c._id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${user.token}` }
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.message);
                            alert('Configuration deleted successfully!');
                            fetchGoalConfig();
                          } catch (err) {
                            alert('Error deleting: ' + err.message);
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      style={{ 
                        padding: '0.4rem 0.8rem', 
                        background: '#ef4444', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem', 
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(7, 1fr)', 
                  gap: '0.4rem', 
                  background: 'rgba(255, 255, 255, 0.3)', 
                  padding: '0.6rem', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '0.75rem'
                }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
                    const dayKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][idx];
                    const val = c[dayKey] !== undefined ? c[dayKey] : (dayKey === 'sunday' ? 0 : 12);
                    return (
                      <div key={dayName}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontWeight: 'bold' }}>{dayName}</span>
                        <strong style={{ color: 'var(--text-main)' }}>{val}h</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
