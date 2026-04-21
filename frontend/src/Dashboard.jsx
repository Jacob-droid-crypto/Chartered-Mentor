import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add student form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', age: '', course: 'INTER' });
  const [newStudentDetails, setNewStudentDetails] = useState(null);
  
  // Student options dropdown state
  const [openMenuId, setOpenMenuId] = useState(null);

  // QR Scanning State
  const [scanning, setScanning] = useState(false);

  // Reusable submit logic for attendance
  const submitAttendance = async (qrData) => {
    try {
      const response = await fetch(`/student/scan-qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.userId, qrValue: qrData })
      });
      const d = await response.json();
      alert(d.message);
      fetchDashboardData(); // Refresh their dashboard
    } catch (err) {
      alert('Failed to log attendance');
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      let endpoint = user.role === 'admin' ? '/admin/daily-summary' : `/student/dashboard/${user.userId}`;
      const response = await fetch(`${endpoint}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch dashboard data');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/admin/students`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch students');
      setStudents(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      if (user.role === 'admin') fetchStudentsData(); // fetch students to build charts
    }
    if (activeTab === 'students' && user.role === 'admin') {
      fetchStudentsData();
    }
    if (activeTab === 'attendance' && user.role === 'admin') {
      fetchDashboardData(); // For today's attendance data currently mapped
    }
  }, [user, activeTab]);

  useEffect(() => {
    let scanner = null;
    if (scanning) {
      scanner = new Html5QrcodeScanner("reader", { qrbox: { width: 250, height: 250 }, fps: 5 });
      
      const success = async (result) => {
        scanner.clear();
        setScanning(false);
        await submitAttendance(result);
      };

      scanner.render(success, (err) => { /* ignore normal scanning errors */ });
    }

    return () => {
      if (scanner) {
        try { scanner.clear(); } catch(e) {}
      }
    };
  }, [scanning, user]);

  const handleDelete = async (studentId) => {
    if (!window.confirm(`Are you sure you want to delete student ${studentId}?`)) return;
    try {
      const response = await fetch(`/admin/student/${studentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      // Refresh list
      fetchStudentsData();
    } catch (err) {
      alert("Error deleting student: " + err.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/admin/add-student`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newStudent)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setNewStudentDetails({
        name: newStudent.name,
        email: newStudent.email,
        userId: result.userId,
        password: result.password
      });

      setNewStudent({ name: '', email: '', age: '', course: 'INTER' });
      setShowAddForm(false);
      fetchStudentsData();
    } catch (err) {
      alert("Error creating student: " + err.message);
    }
  };

  const handleResetPassword = async (studentId) => {
    if (!window.confirm(`Reset password for student ${studentId}?`)) return;
    try {
      const response = await fetch(`/admin/student/${studentId}/reset-password`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      alert(`Password has been reset!\nNew Password: ${result.newPassword}`);
    } catch (err) {
      alert("Error resetting password: " + err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">CM</div>
          <div className="logo-text">Chartered Mentor</div>
        </div>
        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span>📊</span> Dashboard
          </li>
          {user.role === 'admin' && (
            <>
              <li className={`nav-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
                <span>🎓</span> Students
              </li>
              <li className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                <span>📅</span> Attendance
              </li>
              <li className={`nav-item ${activeTab === 'campus_qr' ? 'active' : ''}`} onClick={() => setActiveTab('campus_qr')}>
                <span>🔲</span> Campus QR
              </li>
            </>
          )}
        </ul>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="welcome-text">
            <h1>{activeTab === 'dashboard' ? `Welcome back, ${user.name} 👋` : 'Manage Students'}</h1>
            <p>{activeTab === 'dashboard' 
              ? `Role: ${user.role === 'admin' ? 'Administrator' : 'Student (ID: ' + user.userId + ')'}` 
              : 'Add new students or remove existing ones from the system.'}</p>
          </div>
          <div className="profile-section">
            <span>{user.name}</span>
            <div className="avatar"></div>
          </div>
        </header>

        {loading ? (
          <div>Loading your data...</div>
        ) : error ? (
          <div style={{ color: 'red' }}>Error: {error}</div>
        ) : activeTab === 'dashboard' ? (
          <>
            <div className="dashboard-cards" style={{ marginBottom: '2rem' }}>
              <div className="card">
                <div className="card-icon">👨‍🎓</div>
                <h3>{user.role === 'admin' ? 'Total Registered Students' : 'Today Attendance'}</h3>
                <div className="value">{user.role === 'admin' && Array.isArray(students) ? students.length : (data?.todayLogs?.length || 0)}</div>
              </div>
              {user.role === 'admin' && (
                <div className="card">
                  <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📊</div>
                  <h3>Active Check-ins Today</h3>
                  <div className="value">{Array.isArray(data) ? data.length : 0}</div>
                </div>
              )}
            </div>

            {user.role === 'admin' && (
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '600' }}>Attendance Distribution</h3>
                  <div style={{ position: 'relative', height: '220px', display: 'flex', justifyContent: 'center' }}>
                    {Array.isArray(data) && data.length > 0 ? (() => {
                      const present = data.filter(d => d.status === 'Present').length;
                      const partial = data.filter(d => d.status === 'Partial').length;
                      return <Doughnut 
                        data={{
                          labels: ['Present', 'Partial'],
                          datasets: [{ data: [present, partial], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0, cutout: '75%' }]
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

            {user.role === 'student' && (
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
                    
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Laptop / Test Mode (No Camera Required):</p>
                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => { setScanning(false); submitAttendance('CM-ATTENDANCE-IN'); }} style={{ padding: '0.6rem 1.2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Simulate LOG IN
                        </button>
                        <button onClick={() => { setScanning(false); submitAttendance('CM-ATTENDANCE-OUT'); }} style={{ padding: '0.6rem 1.2rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Simulate LOG OUT
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <section className="recent-activity">
              <h2>{user.role === 'admin' ? 'Today\'s Attendance Summary' : 'Your Check-ins'}</h2>
              <div className="activity-list">
                {user.role === 'admin' && Array.isArray(data) ? (
                  data.map((record, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-info">
                        <div className="activity-dot" style={{ background: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}></div>
                        <div>
                          <strong>{record.studentId}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course: {record.course || '-'}</div>
                        </div>
                      </div>
                      <div className="activity-date" style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}>{record.status}</div>
                    </div>
                  ))
                ) : (
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
                {(!data || (Array.isArray(data) && data.length === 0) || (data.todayLogs && data.todayLogs.length === 0)) && (
                   <p style={{ color: 'var(--text-muted)' }}>No records found for today.</p>
                )}
              </div>
            </section>
          </>
        ) : activeTab === 'attendance' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Attendance Records</h2>
            </div>
            <div className="card">
               <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Detailed historical tracking and export features will go here!</p>
               <div className="activity-list">
                 {Array.isArray(data) && data.map((record, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-info">
                        <div className="activity-dot" style={{ background: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}></div>
                        <div>
                          <strong>{record.studentId}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course: {record.course || '-'}</div>
                        </div>
                      </div>
                      <div className="activity-date" style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}>{record.status} • {record.date}</div>
                    </div>
                 ))}
                 {(!data || (Array.isArray(data) && data.length === 0)) && (
                   <p style={{ color: 'var(--text-muted)' }}>No historical records currently available.</p>
                 )}
               </div>
            </div>
          </>
        ) : activeTab === 'campus_qr' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2>Campus QR Codes</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Full-screen these codes at the front desk or reception area for students to scan.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '3rem' }}>
              <div className="card" style={{ textAlign: 'center', padding: '3rem', width: '100%', maxWidth: '380px' }}>
                <h3 style={{ color: '#10b981', fontSize: '2rem', marginBottom: '2rem', fontWeight: 'bold' }}>LOG IN</h3>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                  <QRCodeSVG value="CM-ATTENDANCE-IN" size={240} />
                </div>
                <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>Students scan this to mark their arrival.</p>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '3rem', width: '100%', maxWidth: '380px' }}>
                <h3 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '2rem', fontWeight: 'bold' }}>LOG OUT</h3>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                  <QRCodeSVG value="CM-ATTENDANCE-OUT" size={240} />
                </div>
                <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>Students scan this when leaving the campus.</p>
              </div>
            </div>
          </>
        ) : (
          /* STUDENTS TAB (Admin Only) */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>All Students</h2>
              <button 
                onClick={() => {setShowAddForm(!showAddForm); setAddMsg('');}}
                style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                {showAddForm ? 'Close Form' : '+ Add Student'}
              </button>
            </div>

            {showAddForm && (
              <div className="card" style={{ marginBottom: '2rem', overflow: 'visible' }}>
                <h3>Add New Student</h3>
                <form onSubmit={handleAddSubmit} style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Name</label>
                    <input type="text" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email</label>
                    <input type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 0.5, minWidth: '80px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Age</label>
                    <input type="number" required value={newStudent.age} onChange={e => setNewStudent({...newStudent, age: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 0.8, minWidth: '120px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course</label>
                    <select value={newStudent.course} onChange={e => setNewStudent({...newStudent, course: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
                      <option value="INTER">INTER</option>
                      <option value="FINAL">FINAL</option>
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
                {Array.isArray(students) && students.map((student) => (
                  <div key={student.userId || Math.random()} className="activity-item" style={{ position: 'relative' }}>
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
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>{student.age || 'N/A'} years old • {student.email || 'No email'}</div>
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
                          <button onClick={() => { handleResetPassword(student.userId); setOpenMenuId(null); }} className="dropdown-item">
                            🔄 Reset Password
                          </button>
                          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }}></div>
                          <button onClick={() => { handleDelete(student.userId); setOpenMenuId(null); }} className="dropdown-item danger">
                            🗑️ Delete Student
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(!Array.isArray(students) || students.length === 0) && <p style={{ color: 'var(--text-muted)' }}>No students found.</p>}
              </div>
            </section>
          </>
        )}
      </main>

      {/* SUCCESS MODAL */}
      {newStudentDetails && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>🎉 Student Added!</h2>
            <p className="subtitle">The account has been created successfully.</p>
            
            <div className="student-details-card">
              <div className="detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{newStudentDetails.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{newStudentDetails.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">User ID</span>
                <span className="detail-value highlight">{newStudentDetails.userId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Password</span>
                <span className="detail-value highlight">{newStudentDetails.password}</span>
              </div>
            </div>

            <button className="modal-btn" onClick={() => setNewStudentDetails(null)}>
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
