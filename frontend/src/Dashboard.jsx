import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';

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

  // Attendance Filters
  const [attendanceView, setAttendanceView] = useState('daily'); // daily, weekly, monthly
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  // Profile State
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', course: '', profilePhoto: '' });
  const [profileData, setProfileData] = useState(null);

  // Payment UI States
  const [showPayModal, setShowPayModal] = useState(false);
  const [feeSetupStudent, setFeeSetupStudent] = useState(null);

  // Reusable submit logic for attendance
  const submitAttendance = async (qrData) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`/student/scan-qr`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            studentId: user.userId, 
            qrValue: qrData,
            lat: latitude,
            lng: longitude
          })
        });
        const d = await response.json();
        alert(d.message);
        fetchDashboardData(); // Refresh their dashboard
      } catch (err) {
        alert('Failed to log attendance');
      }
    }, (error) => {
      alert("Please allow location access to mark attendance.");
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
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

  const [papers, setPapers] = useState([]);
  
  const fetchPapers = async () => {
    try {
      const endpoint = user.role === 'admin' ? '/admin/papers' : '/student/papers';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (response.ok) setPapers(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      if (user.role === 'admin') fetchStudentsData();
    }
    if (activeTab === 'students' && user.role === 'admin') {
      fetchStudentsData();
    }
    if (activeTab === 'attendance') {
      fetchDashboardData(); // Fetches daily-summary (admin) or dashboard (student)
    }
    if (activeTab === 'profile') {
      fetchProfileData();
    }
    if (activeTab === 'papers') {
      fetchPapers();
      if (user.role === 'admin') fetchStudentsData();
    }
    if (activeTab === 'payments') {
      fetchPaymentConfig();
      if (user.role === 'admin') fetchStudentsData();
    }
  }, [user, activeTab]);

  const [paymentConfig, setPaymentConfig] = useState(null);
  const fetchPaymentConfig = async () => {
    try {
      const endpoint = user.role === 'admin' ? '/admin/payment-config' : '/student/payment-config';
      const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${user.token}` } });
      const result = await res.json();
      if (res.ok) setPaymentConfig(result);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const url = user.role === 'admin' ? '/admin/profile' : `/student/dashboard/${user.userId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${user.token}` } });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message);
      setProfileData(resData);
      setProfileForm({
        name: resData.name || '',
        email: resData.email || '',
        phone: resData.phone || '',
        course: resData.course || '',
        profilePhoto: resData.profilePhoto || ''
      });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = user.role === 'admin' ? '/admin/profile' : '/student/profile';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, ...profileForm })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      alert('Profile updated successfully!');
      fetchProfileData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm({ ...profileForm, profilePhoto: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const formatStudyTime = (hrs) => {
    if (!hrs || hrs === 0) return '0 min';
    const totalMins = Math.round(parseFloat(hrs) * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Attendance Aggregation Logic
  const getAggregatedAttendance = () => {
    const sourceData = Array.isArray(data) ? data : (data?.attendanceSummary || []);
    if (!Array.isArray(sourceData)) return [];

    let filtered = sourceData;

    if (attendanceView === 'daily') {
      // Get attendance records for the specific date
      let dailyRecords = filtered.filter(item => item.date === attendanceDate);

      // If admin, merge with the full student list to show completely absent students
      if (user.role === 'admin' && Array.isArray(students) && students.length > 0) {
        const attendedMap = {};
        dailyRecords.forEach(r => attendedMap[r.studentId] = r);

        dailyRecords = students.map(student => {
          if (attendedMap[student.userId]) {
            return attendedMap[student.userId];
          } else {
            // Student has no logs for today, so they are genuinely absent
            return {
              studentId: student.userId,
              course: student.course,
              date: attendanceDate,
              status: 'Absent',
              totalHours: 0
            };
          }
        });
      }

      // Apply search filter if any
      if (attendanceSearch.trim() !== '') {
        const q = attendanceSearch.toLowerCase();
        dailyRecords = dailyRecords.filter(item =>
          (item.studentId && item.studentId.toLowerCase().includes(q))
        );
      }

      return dailyRecords;
    }

    // Apply search filter for weekly/monthly
    if (attendanceSearch.trim() !== '') {
      const q = attendanceSearch.toLowerCase();
      filtered = filtered.filter(item =>
        (item.studentId && item.studentId.toLowerCase().includes(q))
      );
    }

    // Weekly and Monthly: aggregate totals
    const aggregatedMap = {};

    // Pre-populate with all students so even those with 0 attendance show up
    if (user.role === 'admin' && Array.isArray(students)) {
      students.forEach(student => {
        // Apply search filter if any
        if (attendanceSearch.trim() !== '' && !student.userId.toLowerCase().includes(attendanceSearch.toLowerCase())) {
          return; // Skip if it doesn't match search
        }
        aggregatedMap[student.userId] = {
          studentId: student.userId,
          course: student.course,
          totalPresent: 0,
          totalPartial: 0,
          totalAbsent: 0,
          presentDates: [],
          totalHours: 0
        };
      });
    }

    filtered.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;

      let keyToMatch = false;
      if (attendanceView === 'monthly') {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const targetMonthKey = attendanceDate.substring(0, 7);
        if (monthKey === targetMonthKey) keyToMatch = true;
      } else if (attendanceView === 'weekly') {
        const targetDate = new Date(attendanceDate);
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        if (d >= startOfWeek && d <= endOfWeek) keyToMatch = true;
      }

      if (keyToMatch) {
        if (!aggregatedMap[item.studentId]) {
          aggregatedMap[item.studentId] = { studentId: item.studentId, course: item.course, totalPresent: 0, totalPartial: 0, totalAbsent: 0, presentDates: [], totalHours: 0 };
        }
        if (item.status === 'Present') aggregatedMap[item.studentId].totalPresent++;
        else if (item.status === 'Partial') aggregatedMap[item.studentId].totalPartial++;
        else aggregatedMap[item.studentId].totalAbsent++;

        aggregatedMap[item.studentId].totalHours += parseFloat(item.totalHours || 0);

        if (item.status === 'Present' || item.status === 'Partial') {
          aggregatedMap[item.studentId].presentDates.push(item.date);
        }
      }
    });

    return Object.values(aggregatedMap).map(record => {
      let expectedDays = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (attendanceView === 'weekly') {
        const targetDate = new Date(attendanceDate);
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        if (today > endOfWeek) {
          expectedDays = 7;
        } else if (today < startOfWeek) {
          expectedDays = 0;
        } else {
          expectedDays = today.getDay() + 1; // days elapsed in current week
        }
      } else if (attendanceView === 'monthly') {
        const [year, month] = attendanceDate.split('-');
        const y = parseInt(year);
        const m = parseInt(month) - 1;

        if (today.getFullYear() > y || (today.getFullYear() === y && today.getMonth() > m)) {
          expectedDays = new Date(y, m + 1, 0).getDate();
        } else if (today.getFullYear() < y || (today.getFullYear() === y && today.getMonth() < m)) {
          expectedDays = 0;
        } else {
          expectedDays = today.getDate(); // days elapsed in current month
        }
      }

      if (expectedDays > 0) {
        record.totalAbsent = Math.max(0, expectedDays - record.totalPresent - record.totalPartial);
      } else {
        record.totalAbsent = 0;
      }
      return record;
    }).sort((a, b) => b.totalPresent - a.totalPresent);
  };

  const handleExportExcel = () => {
    const aggregatedData = getAggregatedAttendance();
    if (aggregatedData.length === 0) {
      alert("No data available to export.");
      return;
    }

    let exportData = [];
    if (attendanceView === 'daily') {
      exportData = aggregatedData.map(record => ({
        "Student ID": record.studentId,
        "Course": record.course || "-",
        "Status": record.status,
        "Total Hours": formatStudyTime(record.totalHours),
        "Date": record.date
      }));
    } else {
      exportData = aggregatedData.map(record => ({
        "Student ID": record.studentId,
        "Course": record.course || "-",
        "Total Present": record.totalPresent,
        "Total Partial": record.totalPartial,
        "Total Absent": record.totalAbsent,
        "Study Hours": formatStudyTime(record.totalHours)
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${attendanceView}_${attendanceDate.substring(0, 10)}.xlsx`);
  };

  useEffect(() => {
    let html5QrCode;

    if (scanning) {
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            html5QrCode.stop().then(() => {
              setScanning(false);
            });
            await submitAttendance(decodedText);
          },
          (errorMessage) => {
            // ignore normal frame errors
          }
        ).catch((err) => {
          alert("Camera Permission Denied or Not Available. Please allow camera access in your browser settings.");
          setScanning(false);
        });
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error(e));
      }
    };
  }, [scanning]);

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
      {/* Aesthetic Sparkles */}
      <div className="sparkle" style={{ top: '15%', left: '10%', animationDelay: '0.2s' }}></div>
      <div className="sparkle" style={{ top: '65%', left: '5%', animationDelay: '1.7s' }}></div>
      <div className="sparkle" style={{ top: '25%', right: '10%', animationDelay: '0.8s' }}></div>
      <div className="sparkle" style={{ top: '80%', right: '8%', animationDelay: '2.5s' }}></div>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-section" style={{ textAlign: 'center', padding: '1rem 0' }}>
          <img src="/logo.png" alt="Chartered Mentor Logo" style={{ width: '80%', maxWidth: '160px', height: 'auto', margin: '0 auto', display: 'block' }} />
        </div>
        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span>📊</span> Dashboard
          </li>
          {user.role === 'admin' ? (
            <>
              <li className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <span>👤</span> Profile
              </li>
              <li className={`nav-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
                <span>🎓</span> Students
              </li>
              <li className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                <span>📅</span> Attendance
              </li>
              <li className={`nav-item ${activeTab === 'papers' ? 'active' : ''}`} onClick={() => setActiveTab('papers')}>
                <span>📄</span> Papers
              </li>
              <li className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
                <span>💳</span> Payments
              </li>
              <li className={`nav-item ${activeTab === 'campus_qr' ? 'active' : ''}`} onClick={() => setActiveTab('campus_qr')}>
                <span>🔲</span> Campus QR
              </li>
            </>
          ) : (
            <>
              <li className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
                <span>📅</span> Attendance Records
              </li>
              <li className={`nav-item ${activeTab === 'papers' ? 'active' : ''}`} onClick={() => setActiveTab('papers')}>
                <span>📄</span> Exam Papers
              </li>
              <li className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
                <span>💳</span> Payments
              </li>
              <li className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                <span>👤</span> Profile
              </li>
            </>
          )}
        </ul>
        <div className="logout-container" style={{ marginTop: 'auto' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="welcome-text">
            <h1>
              {activeTab === 'dashboard' ? `Welcome back, ${user.name} 👋`
                : activeTab === 'students' ? 'Manage Students'
                  : activeTab === 'attendance' ? 'Attendance Records'
                    : activeTab === 'profile' ? 'My Profile'
                      : 'Campus QR'}
            </h1>
            <p>
              {activeTab === 'dashboard' ? `Role: ${user.role === 'admin' ? 'Administrator' : 'Student (ID: ' + user.userId + ')'}`
                : activeTab === 'students' ? 'Add new students or remove existing ones from the system.'
                  : activeTab === 'attendance' ? 'View and track your attendance logs.'
                    : activeTab === 'profile' ? 'Update your personal details and photo.'
                      : 'Display the active QR code for students to scan.'}
            </p>
          </div>
          <div className="header-actions">
            <div className="mobile-header-logout" onClick={onLogout} title="Logout">
              <span>🚪</span>
            </div>
            <div className="profile-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>{user.name}</span>
              {profileData?.profilePhoto || user.profilePhoto ? (
                <img src={profileData?.profilePhoto || user.profilePhoto} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} />
              ) : (
                <div className="avatar" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>
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
                  <div className="value">{Array.isArray(data) ? data.filter(d => d.date === new Date().toISOString().split('T')[0]).length : 0}</div>
                </div>
              )}
            </div>

            {user.role === 'admin' && (
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: '600' }}>Attendance Distribution</h3>
                  <div style={{ position: 'relative', height: '220px', display: 'flex', justifyContent: 'center' }}>
                    {Array.isArray(data) && data.length > 0 ? (() => {
                      const todayDate = new Date().toISOString().split('T')[0];
                      const todayData = data.filter(d => d.date === todayDate);
                      if (todayData.length === 0) return <p style={{ color: 'var(--text-muted)', margin: 'auto' }}>No attendance logged today.</p>;
                      const present = todayData.filter(d => d.status === 'Present').length;
                      const partial = todayData.filter(d => d.status === 'Partial').length;
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


                  </div>
                )}
              </>
            )}

            <section className="recent-activity">
              <h2>{user.role === 'admin' ? 'Today\'s Attendance Summary' : 'Your Check-ins'}</h2>
              <div className="activity-list">
                {user.role === 'admin' && Array.isArray(data) ? (
                  data.filter(d => d.date === new Date().toISOString().split('T')[0]).map((record, idx) => (
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
        ) : activeTab === 'profile' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Your Profile</h2>
            </div>
            <div className="card" style={{ maxWidth: '600px' }}>
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Profile Photo</label>
                  <label style={{ display: 'inline-block', padding: '0.6rem 1.2rem', background: '#eef2ff', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Choose Image / Take Photo
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                  {profileForm.profilePhoto && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img src={profileForm.profilePhoto} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-color)' }} />
                      <button type="button" onClick={() => setProfileForm({ ...profileForm, profilePhoto: '' })} style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Full Name</label>
                  <input type="text" required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email ID</label>
                  <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Phone Number</label>
                  <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                </div>
                {user.role === 'student' && (
                  <div style={{ opacity: 0.6 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Enrolled Course</label>
                    <input type="text" readOnly value={profileForm.course} onChange={(e) => setProfileForm({ ...profileForm, course: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                )}
                <button type="submit" style={{ marginTop: '1rem', padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Update Profile</button>
              </form>
            </div>
          </>
        ) : activeTab === 'attendance' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>Attendance Records</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {user.role === 'admin' && (
                  <input
                    type="text"
                    placeholder="Search Student ID..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}
                  />
                )}
                <select
                  value={attendanceView}
                  onChange={(e) => setAttendanceView(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}
                >
                  <option value="daily">Daily View</option>
                  <option value="weekly">Weekly Total</option>
                  <option value="monthly">Monthly Total</option>
                </select>
                {attendanceView === 'monthly' ? (
                  <input
                    type="month"
                    value={attendanceDate.substring(0, 7)}
                    onChange={(e) => setAttendanceDate(e.target.value + '-01')}
                    style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}
                  />
                ) : (
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}
                  />
                )}
                {user.role === 'admin' && (
                  <button onClick={handleExportExcel} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                    📥 Export Excel
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {attendanceView === 'daily' ? 'Showing attendance details for selected date.' : `Showing aggregated ${attendanceView} attendance for the selected period.`}
              </p>
              <div className="activity-list">
                {(() => {
                  // Render aggregated data
                  const aggregatedData = getAggregatedAttendance();
                  if (aggregatedData.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No records found for the selected criteria.</p>;

                  return aggregatedData.map((record, idx) => (
                    <div key={idx} className="activity-item" style={{ flexWrap: 'wrap' }}>
                      <div className="activity-info">
                        <div className="activity-dot" style={{ background: attendanceView === 'daily' ? (record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444') : '#3b82f6' }}></div>
                        <div>
                          <strong>{record.studentId}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course: {record.course || '-'}</div>
                        </div>
                      </div>

                      {attendanceView === 'daily' ? (
                        <div className="activity-date" style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}>
                          {record.status} ({formatStudyTime(record.totalHours)}) • {record.date}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>Present: {record.totalPresent}</span>
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Partial: {record.totalPartial}</span>
                          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Absent: {record.totalAbsent}</span>
                          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Study: {formatStudyTime(record.totalHours)}</span>
                        </div>
                      )}
                    </div>
                  ));
                })()}
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
        ) : activeTab === 'papers' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>{user.role === 'admin' ? 'Manage Exam Papers' : 'Your Exam Papers'}</h2>
            </div>
            
            {user.role === 'admin' && (
              <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Upload New Paper for Student</h3>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData();
                    formData.append('title', e.target.title.value);
                    formData.append('target', e.target.target.value);
                    
                    // Convert local datetime-local value to ISO string to preserve exact time across timezones
                    const localDate = new Date(e.target.scheduledTime.value);
                    formData.append('scheduledTime', localDate.toISOString());
                    
                    formData.append('file', e.target.file.files[0]);

                    try {
                      setLoading(true);
                      const res = await fetch('/admin/upload-paper', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${user.token}` },
                        body: formData
                      });
                      if(!res.ok) throw new Error(await res.text());
                      alert('Paper scheduled successfully!');
                      e.target.reset();
                      fetchPapers();
                    } catch(err) {
                      alert('Upload failed: ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <input type="text" name="title" placeholder="Paper Title (e.g. Midterm Physics)" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  
                  <select name="target" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}>
                    <option value="">Select a Student...</option>
                    {students && students.map(s => (
                      <option key={s.userId} value={s.userId}>{s.name} ({s.userId})</option>
                    ))}
                  </select>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Schedule Time (When will this be visible?)</label>
                    <input type="datetime-local" name="scheduledTime" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.docx" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
                  <button type="submit" style={{ padding: '0.75rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Upload & Schedule</button>
                </form>
              </div>
            )}

            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>{user.role === 'admin' ? 'Scheduled Papers' : 'Available Papers'}</h3>
              <div className="activity-list">
                {papers.map((paper) => (
                  <div key={paper._id} className="activity-item" style={{ alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1.1rem' }}>{paper.title}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                        {user.role === 'admin' && <span style={{ marginRight: '1rem' }}>Target Student ID: <strong>{paper.target}</strong></span>}
                        <span>Scheduled: {new Date(paper.scheduledTime).toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={async () => {
                        try {
                          const res = await fetch(`/student/paper/${paper._id}/download`, {
                            headers: { 'Authorization': `Bearer ${user.token}` }
                          });
                          if (!res.ok) throw new Error("Failed to download");
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = paper.fileName || 'document.pdf';
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        } catch(err) {
                          alert("Error downloading file");
                        }
                      }} style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Download
                      </button>
                      
                      {user.role === 'admin' && (
                        <button onClick={async () => {
                          if(!window.confirm('Delete this paper?')) return;
                          await fetch(`/admin/paper/${paper._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }});
                          fetchPapers();
                        }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
                {papers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No papers available.</p>}
              </div>
            </div>
          </>
        ) : activeTab === 'payments' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>{user.role === 'admin' ? 'Payment Settings & Tracking' : 'Fee Payments'}</h2>
            </div>
            
            {user.role === 'admin' ? (
              <>
                <div className="card" style={{ marginBottom: '2rem', maxWidth: '800px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '50%', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🏦
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>Institute Payment Account Setup</h3>
                    <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Configure the bank and UPI details where students will remit their fees.</p>
                  </div>
                </div>
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = {
                      accountName: e.target.accountName.value,
                      accountNumber: e.target.accountNumber.value,
                      bankName: e.target.bankName.value,
                      ifscCode: e.target.ifscCode.value,
                      upiId: e.target.upiId.value
                    };
                    try {
                      setLoading(true);
                      const res = await fetch('/admin/payment-config', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                      });
                      if(!res.ok) throw new Error(await res.text());
                      alert('Payment configuration saved!');
                      fetchPaymentConfig();
                    } catch(err) {
                      alert('Error: ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }} 
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Institute/Account Name</label>
                      <input type="text" name="accountName" placeholder="e.g. Chartered Mentor Pvt Ltd" defaultValue={paymentConfig?.accountName || ''} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Account Number</label>
                      <input type="text" name="accountNumber" placeholder="e.g. 123456789012" defaultValue={paymentConfig?.accountNumber || ''} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Bank Name</label>
                      <input type="text" name="bankName" placeholder="e.g. HDFC Bank" defaultValue={paymentConfig?.bankName || ''} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>IFSC Code</label>
                      <input type="text" name="ifscCode" placeholder="e.g. HDFC0001234" defaultValue={paymentConfig?.ifscCode || ''} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }} />
                    </div>
                  </div>
                  
                  <div style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px dashed rgba(59, 130, 246, 0.3)' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#3b82f6', fontSize: '0.95rem', fontWeight: 'bold' }}>📱 UPI ID (Optional but recommended)</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Adding a UPI ID will automatically generate a scannable QR code on the student's dashboard.</p>
                    <input type="text" name="upiId" placeholder="e.g. institute@upi" defaultValue={paymentConfig?.upiId || ''} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '1rem' }} />
                  </div>
                  
                  <button type="submit" style={{ padding: '1rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>Save Payment Settings</button>
                </form>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Recent Received Payments</h3>
                <div className="activity-list">
                  {students && students.flatMap(s => (s.feeHistory || []).map(f => ({ ...f, studentName: s.name, studentId: s.userId })))
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 50)
                    .map((fee, idx) => (
                      <div key={idx} className="activity-item" style={{ alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>+ ₹{fee.amount}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                            <span>From: <strong>{fee.studentName}</strong> (#{fee.studentId})</span>
                            <span style={{ marginLeft: '1rem' }}>Receipt: {fee.receiptNo || 'N/A'}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: fee.status === 'Pending' ? '#f59e0b' : (fee.status === 'Rejected' ? '#ef4444' : '#10b981') }}>{fee.status}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(fee.date).toLocaleDateString()}</div>
                          {fee.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={async () => {
                                try {
                                  const res = await fetch(`/admin/student/${fee.studentId}/payment/${fee._id}/approve`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if (!res.ok) throw new Error(await res.text());
                                  fetchStudentsData();
                                } catch(e) { alert('Error: ' + e.message); }
                              }} style={{ padding: '0.3rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Approve</button>
                              <button onClick={async () => {
                                try {
                                  const res = await fetch(`/admin/student/${fee.studentId}/payment/${fee._id}/reject`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if (!res.ok) throw new Error(await res.text());
                                  fetchStudentsData();
                                } catch(e) { alert('Error: ' + e.message); }
                              }} style={{ padding: '0.3rem 0.8rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Reject</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  {(!students || students.flatMap(s => s.feeHistory || []).length === 0) && (
                    <p style={{ color: 'var(--text-muted)' }}>No payment history available.</p>
                  )}
                </div>
              </div>
              </>
            ) : (
              <>
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Your Fee Status</h3>
                    <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Fees</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>₹{profileData?.totalFees || 0}</div>
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fees Paid</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>₹{profileData?.feesPaid || 0}</div>
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Remaining Balance</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>₹{(profileData?.totalFees || 0) - (profileData?.feesPaid || 0)}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Next Payment Due</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {profileData?.nextPaymentDueDate ? new Date(profileData.nextPaymentDueDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1.5, minWidth: '300px' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Payment Instructions</h3>
                    {paymentConfig ? (
                      <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Please remit your fee payments using the details or QR code below:</p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Account Name</div>
                              <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>{paymentConfig.accountName}</strong>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Account Number</div>
                              <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem', letterSpacing: '2px' }}>{paymentConfig.accountNumber}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem' }}>
                              <div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Bank Name</div>
                                <strong style={{ color: 'var(--text-main)' }}>{paymentConfig.bankName}</strong>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>IFSC Code</div>
                                <strong style={{ color: 'var(--text-main)' }}>{paymentConfig.ifscCode}</strong>
                              </div>
                            </div>
                            {paymentConfig.upiId && (
                              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>UPI ID</div>
                                <strong style={{ color: 'var(--text-main)' }}>{paymentConfig.upiId}</strong>
                              </div>
                            )}
                          </div>
                          
                          {paymentConfig.upiId && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', width: '100%', maxWidth: '250px' }}>
                              <span style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Ready to Pay?</span>
                              <button onClick={() => setShowPayModal(true)} style={{ width: '100%', padding: '1rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
                                Pay Now
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309' }}>
                            <strong>Note:</strong> After making a payment, please ensure you save the transaction screenshot or receipt number and notify the administration to get it updated on your portal.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>⏳</span>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>The institute has not configured online payment details yet. Please contact administration.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="card">
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Payment History</h3>
                  <div className="activity-list">
                    {profileData?.feeHistory && profileData.feeHistory.length > 0 ? (
                      profileData.feeHistory.map((fee, idx) => (
                        <div key={idx} className="activity-item" style={{ alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>+ ₹{fee.amount}</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                              <span>Receipt No: {fee.receiptNo || 'N/A'}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold' }}>{fee.status}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(fee.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>No payment history available.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* STUDENTS TAB (Admin Only) */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>All Students</h2>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setAddMsg(''); }}
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
                    <input type="text" required value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email</label>
                    <input type="email" required value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 0.5, minWidth: '80px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Age</label>
                    <input type="number" required value={newStudent.age} onChange={e => setNewStudent({ ...newStudent, age: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <div style={{ flex: 0.8, minWidth: '120px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course</label>
                    <select value={newStudent.course} onChange={e => setNewStudent({ ...newStudent, course: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
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
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                          <span style={{
                            background: student.currentStatus === 'Inside' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: student.currentStatus === 'Inside' ? '#10b981' : '#ef4444',
                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.5rem'
                          }}>
                            {student.currentStatus === 'Inside' ? '🟢 Inside' : '🔴 Outside'}
                          </span>
                          {student.age || 'N/A'} years old • {student.email || 'No email'}
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                            <span>Total Fee: ₹{student.totalFees || 0}</span>
                            <span style={{ color: '#10b981' }}>Paid: ₹{student.feesPaid || 0}</span>
                            <span style={{ color: '#ef4444' }}>Due: ₹{(student.totalFees || 0) - (student.feesPaid || 0)}</span>
                          </div>
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
                          <button onClick={() => { handleResetPassword(student.userId); setOpenMenuId(null); }} className="dropdown-item">
                            🔄 Reset Password
                          </button>
                          <button onClick={() => { 
                            setFeeSetupStudent({ 
                              userId: student.userId, 
                              name: student.name, 
                              totalFees: student.totalFees || '', 
                              nextPaymentDueDate: student.nextPaymentDueDate ? new Date(student.nextPaymentDueDate).toISOString().split('T')[0] : '' 
                            }); 
                            setOpenMenuId(null); 
                          }} className="dropdown-item">
                            💰 Set Fee Structure
                          </button>
                          <button onClick={async () => {
                            const amount = prompt('Enter Payment Amount Received', '0');
                            if (!amount || isNaN(amount)) return;
                            const receipt = prompt('Enter Receipt/Transaction No.', '');
                            try {
                              const res = await fetch(`/admin/student/${student.userId}/payment`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ amount: Number(amount), receiptNo: receipt, date: new Date().toISOString() })
                              });
                              if (!res.ok) throw new Error(await res.text());
                              alert('Payment recorded!');
                              fetchStudentsData();
                            } catch(err) { alert('Error: ' + err.message); }
                            setOpenMenuId(null);
                          }} className="dropdown-item">
                            💸 Add Payment Received
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

      {/* ADMIN FEE SETUP MODAL */}
      {feeSetupStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Set Fee Structure</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Configuring fees for <strong>{feeSetupStudent.name}</strong></p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch(`/admin/student/${feeSetupStudent.userId}/fees`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    totalFees: Number(feeSetupStudent.totalFees), 
                    nextPaymentDueDate: feeSetupStudent.nextPaymentDueDate ? new Date(feeSetupStudent.nextPaymentDueDate).toISOString() : null 
                  })
                });
                if (!res.ok) throw new Error(await res.text());
                alert('Fee structure updated successfully!');
                fetchStudentsData();
                setFeeSetupStudent(null);
              } catch(err) { alert('Error: ' + err.message); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Total Course Fee (₹)</label>
                <input type="number" required min="0" value={feeSetupStudent.totalFees} onChange={e => setFeeSetupStudent({...feeSetupStudent, totalFees: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Next Payment Due Date</label>
                <input type="date" required value={feeSetupStudent.nextPaymentDueDate} onChange={e => setFeeSetupStudent({...feeSetupStudent, nextPaymentDueDate: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setFeeSetupStudent(null)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Fees</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT PAY NOW MODAL */}
      {showPayModal && paymentConfig && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>Make a Payment</h2>
            
            <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
              <QRCodeSVG value={`upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.accountName)}`} size={200} />
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>Scan the QR code above using any UPI app (GPay, PhonePe, Paytm). After payment, enter the details below to update your ledger.</p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const amount = e.target.amount.value;
                const receipt = e.target.receipt.value;
                const res = await fetch('/student/payment', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ amount, receiptNo: receipt })
                });
                if (!res.ok) throw new Error(await res.text());
                alert('Payment verified and updated successfully!');
                setShowPayModal(false);
                fetchProfileData();
              } catch(err) { alert('Error: ' + err.message); }
            }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'left' }}>Amount Paid (₹)</label>
                <input type="number" name="amount" required min="1" placeholder="e.g. 5000" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'left' }}>UTR / Transaction ID</label>
                <input type="text" name="receipt" required placeholder="Enter 12-digit UPI Ref Number" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowPayModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Verify Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
