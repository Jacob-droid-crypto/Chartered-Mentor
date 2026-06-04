import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

function StudentPaperCard({ paper, user, onRefresh }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Parse time
  const scheduledDate = new Date(paper.scheduledTime);
  const todayStr = new Date().toISOString().split("T")[0];
  const scheduledStr = scheduledDate.toISOString().split("T")[0];
  const isLocked = todayStr < scheduledStr;

  const totalDurationMins = paper.examDuration + paper.uploadDuration;
  const totalDurationMs = totalDurationMins * 60 * 1000;
  const isTimeExpired = paper.startTime && (new Date(paper.startTime).getTime() + totalDurationMs < new Date().getTime());

  useEffect(() => {
    if (!paper.startTime || paper.answerUploadedAt) return;

    const totalDurationMins = paper.examDuration + paper.uploadDuration;
    const totalDurationMs = totalDurationMins * 60 * 1000;
    const endMs = new Date(paper.startTime).getTime() + totalDurationMs;

    const updateTimer = () => {
      const remainingMs = endMs - new Date().getTime();
      if (remainingMs <= 0) {
        setTimeLeft(0);
      } else {
        setTimeLeft(remainingMs);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [paper.startTime, paper.answerUploadedAt, paper.examDuration, paper.uploadDuration]);

  const handleStartExam = async () => {
    if (!window.confirm("Are you sure you want to start the exam? Your individual timer will begin immediately.")) return;
    try {
      // 1. Call Start API
      const res = await fetch(`/student/paper/${paper._id}/start`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${user.token}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) throw new Error(await res.text());
      
      // 2. Trigger automatic download of the question paper
      const downloadRes = await fetch(`/student/paper/${paper._id}/download`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!downloadRes.ok) throw new Error("Failed to download question paper");
      const blob = await downloadRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = paper.fileName || 'question-paper.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();

      onRefresh();
    } catch (err) {
      alert("Error starting exam: " + err.message);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.size > 3.2 * 1024 * 1024) {
      alert("File size exceeds Vercel's 4.5MB serverless upload limit (max file size is ~3.2MB). Please compress your PDF/images or upload a smaller file.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        const res = await fetch(`/student/paper/${paper._id}/submit-answer`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${user.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            answerFileName: file.name,
            answerFileType: file.type,
            answerFileData: base64Data
          })
        });

        const text = await res.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch(e) {
          throw new Error(res.status === 413 
            ? "File is too large for the hosting platform (limit is 4.5MB total). Please compress your file." 
            : "Server error: " + text.slice(0, 100)
          );
        }
        if (!res.ok) throw new Error(result.message);
        
        alert("Answer sheets uploaded successfully!");
        onRefresh();
      } catch (err) {
        alert("Upload failed: " + err.message);
      } finally {
        setUploading(false);
      }
    };
  };

  const formatTimeLeft = (ms) => {
    if (ms === null) return "";
    if (ms <= 0) return "00h 00m 00s";
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Render Lock State
  if (isLocked) {
    return (
      <div className="activity-item" style={{ opacity: 0.8, background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>🔒 {paper.title}</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Locked until: <strong>{new Date(paper.scheduledTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </div>
          </div>
          <span style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.08)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
            Locked
          </span>
        </div>
      </div>
    );
  }

  // Render Submissions Completed
  if (paper.answerUploadedAt) {
    return (
      <div className="activity-item" style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>📄 {paper.title}</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Exam started: {new Date(paper.startTime).toLocaleString()}
            </div>
            <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
              ✅ Submitted: {paper.answerFileName} ({new Date(paper.answerUploadedAt).toLocaleString()})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            <button onClick={async () => {
              try {
                const res = await fetch(`/student/paper/${paper._id}/download-answer`, {
                  headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!res.ok) throw new Error();
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = paper.answerFileName || 'answer-sheet.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
              } catch(err) {
                alert("Error downloading answer sheet");
              }
            }} style={{ padding: '0.55rem 1.2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              View Submission
            </button>
            {!isTimeExpired && (
              <>
                <input 
                  type="file" 
                  id={`re-upload-${paper._id}`}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      if (window.confirm(`Are you sure you want to overwrite your previous submission with "${e.target.files[0].name}"?`)) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor={`re-upload-${paper._id}`}
                  style={{
                    display: 'inline-block',
                    padding: '0.55rem 1.2rem',
                    background: 'transparent',
                    color: 'var(--primary-color)',
                    border: '1px solid var(--primary-color)',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {uploading ? "Uploading..." : "🔄 Re-upload"}
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Time Expired State
  if (timeLeft === 0) {
    return (
      <div className="activity-item" style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>⚠️ {paper.title}</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Exam started: {new Date(paper.startTime).toLocaleString()}
            </div>
          </div>
          <span style={{ fontSize: '0.85rem', background: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
            Expired
          </span>
        </div>
        <div style={{ color: '#ef4444', fontSize: '0.95rem', fontWeight: 'bold', padding: '0.8rem', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', textAlign: 'center' }}>
          🚨 Exam Closed: The combined writing and upload time has expired. Submissions are no longer accepted.
        </div>
      </div>
    );
  }

  // Render Active / In Progress countdown and upload
  if (paper.startTime) {
    return (
      <div className="activity-item" style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.2rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>✍️ {paper.title}</strong>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Exam Started: {new Date(paper.startTime).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', marginBottom: '0.3rem' }}>
              Exam In Progress
            </span>
            <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
              ⏳ Time Left: {formatTimeLeft(timeLeft)}
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          📌 <strong>Exam Rules:</strong> Please write your answers on paper, scan them into a single PDF or image file, and upload it below before the timer runs out. You have <strong>{paper.examDuration} minutes</strong> to write and <strong>{paper.uploadDuration} minutes</strong> to upload.
        </div>

        {/* Upload Answer Form */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            border: dragActive ? '2px dashed var(--primary-color)' : '2px dashed var(--glass-border)',
            background: dragActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0,0,0,0.01)',
            padding: '1.5rem',
            borderRadius: '10px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          {uploading ? (
            <div style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>📤 Uploading answer sheets...</div>
          ) : (
            <div>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontWeight: 'bold' }}>
                Drag & Drop your scanned Answer Sheets here
              </p>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                or click below to choose a file (PDF or Images, Max 10MB)
              </p>
              <input 
                type="file" 
                id={`ans-upload-${paper._id}`}
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }}
              />
              <label 
                htmlFor={`ans-upload-${paper._id}`}
                style={{
                  display: 'inline-block',
                  padding: '0.55rem 1.5rem',
                  background: 'var(--primary-color)',
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Select Answer Sheet
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Ready state (Midnight scheduled reached, not started)
  return (
    <div className="activity-item" style={{ background: 'white', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>📖 {paper.title}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Scheduled Date: <strong>{new Date(paper.scheduledTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Combined Time: <strong>{paper.examDuration + paper.uploadDuration} minutes</strong> ({paper.examDuration}m exam + {paper.uploadDuration}m upload grace)
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={handleStartExam}
            style={{
              padding: '0.65rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
            }}
          >
            ▶️ Start Exam
          </button>
          <input 
            type="file" 
            id={`direct-upload-${paper._id}`}
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                if (file.size > 3.2 * 1024 * 1024) {
                  alert("File size exceeds Vercel's 4.5MB serverless upload limit (max file size is ~3.2MB). Please compress your PDF/images or upload a smaller file.");
                  return;
                }
                if (!window.confirm(`Start exam and upload "${file.name}" directly?`)) return;
                try {
                  setUploading(true);
                  // 1. Call Start API
                  const startRes = await fetch(`/student/paper/${paper._id}/start`, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${user.token}`,
                      "Content-Type": "application/json"
                    }
                  });
                  if (!startRes.ok) throw new Error(await startRes.text());
                  
                  // 2. Upload file
                  await handleFileUpload(file);
                } catch(err) {
                  alert("Failed to start/upload: " + err.message);
                } finally {
                  setUploading(false);
                }
              }
            }}
            style={{ display: 'none' }}
          />
          <label 
            htmlFor={`direct-upload-${paper._id}`}
            style={{
              display: 'inline-block',
              padding: '0.65rem 1.5rem',
              background: 'transparent',
              color: 'var(--primary-color)',
              border: '1px solid var(--primary-color)',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            {uploading ? "Uploading..." : "📤 Upload Answer Directly"}
          </label>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [studyTrackerPeriod, setStudyTrackerPeriod] = useState('week');
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [goalConfig, setGoalConfig] = useState({ monday: 12, tuesday: 12, wednesday: 12, thursday: 12, friday: 12, saturday: 12, sunday: 0 });
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);

  const quotesList = [
    "Focus on your goal. Don't look in any direction but ahead.",
    "Success is the sum of small efforts, repeated day in and day out.",
    "Believe you can and you're halfway there.",
    "The secret of getting ahead is getting started.",
    "It always seems impossible until it's done.",
    "Don't wish it were easier. Wish you were better.",
    "The only limit to our realization of tomorrow is our doubts of today.",
    "There are no shortcuts to any place worth going.",
    "Work hard in silence, let your success be your noise.",
    "Attitude determines how well you do it.",
    "Your future is created by what you do today, not tomorrow.",
    "Today a reader, tomorrow a leader.",
    "The expert in anything was once a beginner.",
    "Procrastination makes easy things hard and hard things harder.",
    "You don't have to be great to start, but you have to start to be great."
  ];

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * quotesList.length);
    setMotivationalQuote(quotesList[randomIndex]);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add student form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', course: 'INTER', mode: 'residential', batch: 'September 2026' });
  const [newStudentDetails, setNewStudentDetails] = useState(null);
  const [viewingProfileStudent, setViewingProfileStudent] = useState(null);

  // Student options dropdown state
  const [openMenuId, setOpenMenuId] = useState(null);

  // QR Scanning State
  const [scanning, setScanning] = useState(false);

  // Attendance Filters
  const [attendanceView, setAttendanceView] = useState('daily'); // daily, weekly, monthly
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  // Profile State
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', phone: '', course: '', profilePhoto: '',
    address: '', group: '', aadharNumber: '', dob: '', joiningDate: '',
    fatherName: '', fatherPhone: '', fatherOccupation: '',
    motherName: '', motherPhone: '', motherOccupation: '',
    mode: '', batch: ''
  });
  const [profileData, setProfileData] = useState(null);

  // Payment UI States
  const [showPayModal, setShowPayModal] = useState(false);
  const [feeSetupStudent, setFeeSetupStudent] = useState(null);
  const [showFeeDuePopup, setShowFeeDuePopup] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  // Manual Checkout UI States
  const [showManualCheckoutModal, setShowManualCheckoutModal] = useState(false);
  const [manualCheckoutData, setManualCheckoutData] = useState({ studentId: '', studentName: '', date: '', checkoutTime: '18:00', checkInTimeDisplay: '' });

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

  const handleManualAttendance = async (action) => {
    try {
      const response = await fetch(`/student/manual-attendance`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.userId, action })
      });
      const d = await response.json();
      alert(d.message);
      if (response.ok) fetchDashboardData();
    } catch (err) {
      alert('Failed to log attendance');
    }
  };

  const handleOpenManualCheckout = async (record) => {
    setManualCheckoutData({
      studentId: record.studentId,
      studentName: record.studentName || 'Unknown Student',
      date: record.date,
      checkoutTime: '18:00',
      checkInTimeDisplay: 'Loading...',
    });
    setShowManualCheckoutModal(true);

    try {
      const res = await fetch(`/admin/attendance`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const logs = await res.json();
        const dailyLogs = logs.filter(log => log.studentId === record.studentId && log.date === record.date);
        
        const inLog = dailyLogs.find(log => log.type === 'IN');
        const outLog = dailyLogs.find(log => log.type === 'OUT');
        
        let checkInDisplay = 'No Check-In record found';
        if (inLog) {
          const inDate = new Date(inLog.timestamp);
          checkInDisplay = isNaN(inDate.getTime()) ? (inLog.time || '-') : inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        let initialCheckoutTime = '18:00';
        if (outLog) {
          const outDate = new Date(outLog.timestamp);
          if (!isNaN(outDate.getTime())) {
            const h = String(outDate.getHours()).padStart(2, '0');
            const m = String(outDate.getMinutes()).padStart(2, '0');
            initialCheckoutTime = `${h}:${m}`;
          }
        } else if (inLog) {
          const inDate = new Date(inLog.timestamp);
          if (!isNaN(inDate.getTime())) {
            const defaultOut = new Date(inDate.getTime() + 9 * 60 * 60 * 1000);
            const h = String(defaultOut.getHours()).padStart(2, '0');
            const m = String(defaultOut.getMinutes()).padStart(2, '0');
            initialCheckoutTime = `${h}:${m}`;
          }
        }
        
        setManualCheckoutData(prev => ({
          ...prev,
          checkInTimeDisplay: checkInDisplay,
          checkoutTime: initialCheckoutTime
        }));
      } else {
        setManualCheckoutData(prev => ({
          ...prev,
          checkInTimeDisplay: 'Error loading check-in time'
        }));
      }
    } catch (err) {
      console.error("Error fetching check-in time:", err);
      setManualCheckoutData(prev => ({
        ...prev,
        checkInTimeDisplay: 'Error loading check-in time'
      }));
    }
  };

  const handleManualCheckoutSubmit = async (e) => {
    e.preventDefault();
    try {
      const { studentId, date, checkoutTime } = manualCheckoutData;
      const res = await fetch(`/admin/attendance/manual-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId, date, checkoutTime })
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.message || 'Failed to submit manual checkout');
      }
      alert(d.message || 'Check-out marked successfully!');
      setShowManualCheckoutModal(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      let endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/daily-summary' : `/student/dashboard/${user.userId}`;
      const response = await fetch(`${endpoint}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch dashboard data');
      setData(result);

      if (user.role === 'student' && !result.profileCompleted) {
        setActiveTab('profile');
      }

      if (user.role === 'student' && result.nextPaymentDueDate && result.totalFees > (result.feesPaid || 0)) {
        const today = new Date();
        const dueDate = new Date(result.nextPaymentDueDate);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 3600 * 24));
        if (daysDiff <= 2 && !sessionStorage.getItem('feePopupShown')) {
          setShowFeeDuePopup(true);
          sessionStorage.setItem('feePopupShown', 'true');
        }
      }
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
      if (viewingProfileStudent) {
        const updated = result.find(s => s.userId === viewingProfileStudent.userId);
        if (updated) {
          setViewingProfileStudent(updated);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [papers, setPapers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  const fetchPapers = async () => {
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/papers' : '/student/papers';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (response.ok) setPapers(result);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/schedules' : '/student/schedules';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (response.ok) setSchedules(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const isAdminOrStaff = user.role === 'admin' || user.role === 'staff';
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      if (isAdminOrStaff) fetchStudentsData();
      if (user.role === 'student') {
        fetchPaymentConfig();
        fetchGoalConfig();
      }
    }
    if (activeTab === 'students' && isAdminOrStaff) {
      fetchStudentsData();
    }
    if (activeTab === 'attendance') {
      fetchDashboardData(); // Fetches daily-summary (admin) or dashboard (student)
      fetchGoalConfig();
      if (isAdminOrStaff) fetchStudentsData();
    }
    if (activeTab === 'profile') {
      fetchProfileData();
    }
    if (activeTab === 'papers') {
      fetchPapers();
      if (isAdminOrStaff) fetchStudentsData();
    }
    if (activeTab === 'schedules') {
      fetchSchedules();
      if (isAdminOrStaff) fetchStudentsData();
    }
    if (activeTab === 'payments') {
      fetchPaymentConfig();
      if (isAdminOrStaff) fetchStudentsData();
      if (user.role === 'student') fetchProfileData();
    }
    if (activeTab === 'study_tracker') {
      fetchGoalConfig();
    }
    if (activeTab === 'goal_settings') {
      fetchGoalConfig();
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

  const fetchGoalConfig = async () => {
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/goal-config' : '/student/goal-config';
      const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${user.token}` } });
      const result = await res.json();
      if (res.ok) setGoalConfig(result);
    } catch (err) {
      console.error("Fetch goal config error:", err);
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const url = (user.role === 'admin' || user.role === 'staff') ? '/admin/profile' : `/student/dashboard/${user.userId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${user.token}` } });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message);
      setProfileData(resData);
      setProfileForm({
        name: resData.name || '',
        email: resData.email || '',
        phone: resData.phone || '',
        course: resData.course || '',
        profilePhoto: resData.profilePhoto || '',
        address: resData.address || '',
        group: resData.group || '',
        aadharNumber: resData.aadharNumber || '',
        dob: resData.dob ? new Date(resData.dob).toISOString().split('T')[0] : '',
        fatherName: resData.fatherName || '',
        fatherPhone: resData.fatherPhone || '',
        fatherOccupation: resData.fatherOccupation || '',
        motherName: resData.motherName || '',
        motherPhone: resData.motherPhone || '',
        motherOccupation: resData.motherOccupation || '',
        mode: resData.mode || '',
        batch: resData.batch || '',
        joiningDate: resData.joiningDate ? new Date(resData.joiningDate).toISOString().split('T')[0] : ''
      });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/profile' : '/student/profile';
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
      fetchDashboardData();
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

  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    
    let temp = new Date(sunday);
    while (temp <= today) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const getMonthDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let temp = new Date(firstOfMonth);
    while (temp <= today) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const calculateStudentStats = () => {
    const stats = {
      todayHours: 0,
      weekHours: 0,
      monthHours: 0,
      weekAbsentCount: 0,
      monthAbsentCount: 0,
      lowHoursWeek: [],
      lowHoursMonth: [],
    };

    if (!data || !data.attendanceSummary) return stats;

    const todayStr = formatLocalDate(new Date());
    
    const summaryMap = {};
    data.attendanceSummary.forEach(item => {
      summaryMap[item.date] = item;
    });

    if (summaryMap[todayStr]) {
      stats.todayHours = parseFloat(summaryMap[todayStr].totalHours || 0);
    }

    const joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
    if (joiningDate) {
      joiningDate.setHours(0, 0, 0, 0);
    }

    const weekDays = getWeekDays();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    weekDays.forEach(day => {
      const dateStr = formatLocalDate(day);
      if (joiningDate && day < joiningDate) return;

      const log = summaryMap[dateStr];
      const dayKey = dayKeys[day.getDay()];
      const targetHours = goalConfig[dayKey] !== undefined ? parseFloat(goalConfig[dayKey]) : 12;

      if (log) {
        stats.weekHours += parseFloat(log.totalHours || 0);
        const hours = parseFloat(log.totalHours || 0);
        if (targetHours > 0 && hours < targetHours) {
          stats.lowHoursWeek.push({
            date: dateStr,
            hours: hours,
            status: log.status,
            target: targetHours
          });
        }
      } else {
        stats.weekAbsentCount++;
      }
    });

    const monthDays = getMonthDays();
    monthDays.forEach(day => {
      const dateStr = formatLocalDate(day);
      if (joiningDate && day < joiningDate) return;

      const log = summaryMap[dateStr];
      const dayKey = dayKeys[day.getDay()];
      const targetHours = goalConfig[dayKey] !== undefined ? parseFloat(goalConfig[dayKey]) : 12;

      if (log) {
        stats.monthHours += parseFloat(log.totalHours || 0);
        const hours = parseFloat(log.totalHours || 0);
        if (targetHours > 0 && hours < targetHours) {
          stats.lowHoursMonth.push({
            date: dateStr,
            hours: hours,
            status: log.status,
            target: targetHours
          });
        }
      } else {
        stats.monthAbsentCount++;
      }
    });

    return stats;
  };

  // Attendance Aggregation Logic
  const getAggregatedAttendance = () => {
    const sourceData = Array.isArray(data) ? data : (data?.attendanceSummary || []);
    if (!Array.isArray(sourceData)) return [];

    let filtered = sourceData;

    // Create a student map of userId -> name for fast lookup
    const studentMap = {};
    if (Array.isArray(students)) {
      students.forEach(s => {
        studentMap[s.userId] = s.name;
      });
    }

    if (attendanceView === 'daily') {
      // Get attendance records for the specific date
      let dailyRecords = filtered.filter(item => item.date === attendanceDate);

      // If admin, merge with the full student list to show completely absent students
      if (user.role === 'admin' && Array.isArray(students) && students.length > 0) {
        const attendedMap = {};
        dailyRecords.forEach(r => attendedMap[r.studentId] = r);

        dailyRecords = students.map(student => {
          if (attendedMap[student.userId]) {
            return {
              ...attendedMap[student.userId],
              studentName: student.name || attendedMap[student.userId].studentName || studentMap[student.userId] || 'Unknown Student'
            };
          } else {
            // Student has no logs for today, so they are genuinely absent
            return {
              studentId: student.userId,
              studentName: student.name || 'Unknown Student',
              course: student.course,
              date: attendanceDate,
              status: 'Absent',
              totalHours: 0
            };
          }
        });
      } else {
        // Map student name for non-admin view
        dailyRecords = dailyRecords.map(item => ({
          ...item,
          studentName: item.studentName || studentMap[item.studentId] || 'Unknown Student'
        }));
      }

      // Apply search filter by name if search is populated
      if (attendanceSearch.trim() !== '') {
        const q = attendanceSearch.toLowerCase();
        dailyRecords = dailyRecords.filter(item =>
          (item.studentName && item.studentName.toLowerCase().includes(q))
        );
      }

      return dailyRecords;
    }

    // Map names for the source weekly/monthly logs
    const mappedFiltered = filtered.map(item => ({
      ...item,
      studentName: item.studentName || studentMap[item.studentId] || 'Unknown Student'
    }));

    let toProcess = mappedFiltered;

    // Apply search filter by student's name for weekly/monthly
    if (attendanceSearch.trim() !== '') {
      const q = attendanceSearch.toLowerCase();
      toProcess = toProcess.filter(item =>
        (item.studentName && item.studentName.toLowerCase().includes(q))
      );
    }

    // Weekly and Monthly: aggregate totals
    const aggregatedMap = {};

    // Pre-populate with all students so even those with 0 attendance show up
    if (user.role === 'admin' && Array.isArray(students)) {
      students.forEach(student => {
        // Apply search filter by student's name
        if (attendanceSearch.trim() !== '' && !student.name.toLowerCase().includes(attendanceSearch.toLowerCase())) {
          return; // Skip if it doesn't match search
        }
        aggregatedMap[student.userId] = {
          studentId: student.userId,
          studentName: student.name || 'Unknown Student',
          course: student.course,
          totalPresent: 0,
          totalPartial: 0,
          totalAbsent: 0,
          presentDates: [],
          totalHours: 0
        };
      });
    }

    toProcess.forEach(item => {
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
          aggregatedMap[item.studentId] = { 
            studentId: item.studentId, 
            studentName: item.studentName || studentMap[item.studentId] || 'Unknown Student', 
            course: item.course, 
            totalPresent: 0, 
            totalPartial: 0, 
            totalAbsent: 0, 
            presentDates: [], 
            totalHours: 0 
          };
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
        "Student Name": record.studentName || record.studentId || "-",
        "Course": record.course || "-",
        "Status": record.status,
        "Total Hours": formatStudyTime(record.totalHours),
        "Date": record.date
      }));
    } else {
      // 1. Generate date list dynamically
      const dateList = [];
      if (attendanceView === 'weekly') {
        const targetDate = new Date(attendanceDate);
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          dateList.push(d.toISOString().split('T')[0]);
        }
      } else if (attendanceView === 'monthly') {
        const [year, month] = attendanceDate.split('-');
        const y = parseInt(year);
        const m = parseInt(month) - 1;
        const numDays = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= numDays; i++) {
          const dayStr = String(i).padStart(2, '0');
          const monthStr = String(m + 1).padStart(2, '0');
          dateList.push(`${y}-${monthStr}-${dayStr}`);
        }
      }

      // 2. Build map of student date logs
      const studentDateLogs = {};
      const sourceData = Array.isArray(data) ? data : (data?.attendanceSummary || []);
      sourceData.forEach(item => {
        if (!studentDateLogs[item.studentId]) {
          studentDateLogs[item.studentId] = {};
        }
        studentDateLogs[item.studentId][item.date] = item;
      });

      // 3. Construct rows
      exportData = aggregatedData.map(record => {
        const row = {
          "Student Name": record.studentName || record.studentId || "-",
          "Course": record.course || "-",
          "Total Present": record.totalPresent,
          "Total Partial": record.totalPartial,
          "Total Absent": record.totalAbsent,
          "Total Study Hours": formatStudyTime(record.totalHours)
        };

        // Add dynamically generated date columns chronologically
        dateList.forEach(dateStr => {
          const logsForDate = studentDateLogs[record.studentId] || {};
          const log = logsForDate[dateStr];
          
          if (log && (log.status === 'Present' || log.status === 'Partial')) {
            row[dateStr] = formatStudyTime(log.totalHours);
          } else {
            row[dateStr] = "Leave";
          }
        });

        return row;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${attendanceView}_${attendanceDate.substring(0, 10)}.xlsx`);
  };

  const handleExportStudentsLedger = () => {
    if (!Array.isArray(students) || students.length === 0) {
      alert("No students data available to export.");
      return;
    }

    const isStaff = user.role === 'staff';

    const exportData = students.map(student => {
      const row = {
        "Student Name": student.name || "-",
        "Student ID": student.userId || "-",
        "Email": student.email || "-",
        "Phone": student.phone || "-",
        "Course": student.course || "-",
        "Mode": student.mode || "-",
        "Batch": student.batch || "-",
        "Joining Date": student.joiningDate ? new Date(student.joiningDate).toLocaleDateString() : "-",
      };

      if (!isStaff) {
        row["Total Course Fee"] = student.totalFees || 0;
        row["Fees Paid"] = student.feesPaid || 0;
        row["Remaining Balance"] = (student.totalFees || 0) - (student.feesPaid || 0);

        let maxInstallments = 0;
        students.forEach(s => {
          if (Array.isArray(s.installments) && s.installments.length > maxInstallments) {
            maxInstallments = s.installments.length;
          }
        });

        const sortedInstallments = Array.isArray(student.installments)
          ? [...student.installments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          : [];

        for (let i = 0; i < maxInstallments; i++) {
          const inst = sortedInstallments[i] || null;
          row[`Inst ${i + 1} Amount (₹)`] = inst ? inst.amount : "-";
          row[`Inst ${i + 1} Status`] = inst ? inst.status : "-";
          row[`Inst ${i + 1} Due Date`] = inst && inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : "-";
          row[`Inst ${i + 1} Payment Date`] = inst && inst.status === 'Paid' && inst.paidDate ? new Date(inst.paidDate).toLocaleDateString() : "-";
        }
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const sheetName = isStaff ? "Students" : "Fee Ledger";
    const fileName = isStaff ? `Students_List_${new Date().toISOString().split('T')[0]}.xlsx` : `Student_Fee_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
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
        batch: newStudent.batch
      });

      setNewStudent({ name: '', email: '', course: 'INTER', batch: 'September 2026' });
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
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => {
            if (user.role === 'student' && data && !data.profileCompleted) {
              alert('Please complete your profile details first to unlock all dashboard features.');
              return;
            }
            setActiveTab('dashboard');
          }}>
            <span>📊</span> Dashboard
          </li>
          {(user.role === 'admin' || user.role === 'staff') ? (
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
              <li className={`nav-item ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>
                <span>🗓️</span> Schedules
              </li>
              {user.role === 'admin' && (
                <li className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
                  <span>💳</span> Payments
                </li>
              )}
              <li className={`nav-item ${activeTab === 'campus_qr' ? 'active' : ''}`} onClick={() => setActiveTab('campus_qr')}>
                <span>🔲</span> Campus QR
              </li>
              <li className={`nav-item ${activeTab === 'goal_settings' ? 'active' : ''}`} onClick={() => setActiveTab('goal_settings')}>
                <span>🎯</span> Goal Settings
              </li>
            </>
          ) : (
            <>
              <li className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => {
                if (data && !data.profileCompleted) {
                  alert('Please complete your profile details first to unlock all dashboard features.');
                  return;
                }
                setActiveTab('attendance');
              }}>
                <span>📅</span> Attendance Records
              </li>
              <li className={`nav-item ${activeTab === 'papers' ? 'active' : ''}`} onClick={() => {
                if (data && !data.profileCompleted) {
                  alert('Please complete your profile details first to unlock all dashboard features.');
                  return;
                }
                setActiveTab('papers');
              }}>
                <span>📄</span> Exam Papers
              </li>
              <li className={`nav-item ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => {
                if (data && !data.profileCompleted) {
                  alert('Please complete your profile details first to unlock all dashboard features.');
                  return;
                }
                setActiveTab('schedules');
              }}>
                <span>🗓️</span> My Schedule
              </li>
              <li className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => {
                if (data && !data.profileCompleted) {
                  alert('Please complete your profile details first to unlock all dashboard features.');
                  return;
                }
                setActiveTab('payments');
              }}>
                <span>💳</span> Payments
              </li>
              <li className={`nav-item ${activeTab === 'study_tracker' ? 'active' : ''}`} onClick={() => {
                if (data && !data.profileCompleted) {
                  alert('Please complete your profile details first to unlock all dashboard features.');
                  return;
                }
                setActiveTab('study_tracker');
              }}>
                <span>⏱️</span> Study Goal Tracker
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
                : activeTab === 'papers' ? 'Question Papers'
                : activeTab === 'schedules' ? (user.role === 'admin' ? 'Student Schedules' : 'My Study Schedule')
                : activeTab === 'payments' ? (user.role === 'admin' ? 'Fee Ledger' : 'My Payments')
                : activeTab === 'feeSetup' && feeSetupStudent ? `Fee Structure: ${feeSetupStudent.name}`
                : activeTab === 'study_tracker' ? 'Study Goal Tracker'
                : activeTab === 'goal_settings' ? 'Study Goal Settings'
                : 'Campus QR'}
            </h1>
            <p>
              {activeTab === 'dashboard' ? `Role: ${user.role === 'admin' ? 'Administrator' : 'Student (ID: ' + user.userId + ')'}`
                : activeTab === 'students' ? 'Add new students or remove existing ones from the system.'
                : activeTab === 'attendance' ? 'View and track your attendance logs.'
                : activeTab === 'profile' ? 'Update your personal details and photo.'
                : activeTab === 'papers' ? 'Manage and download scheduled question papers.'
                : activeTab === 'schedules' ? (user.role === 'admin' ? 'Create and manage study plans, classes, and tests for students.' : 'Track your study checklist, scheduled classes, and exams.')
                : activeTab === 'payments' ? 'View fee payment history and balances.'
                : activeTab === 'feeSetup' ? 'Configure total fees and next due date.'
                : activeTab === 'study_tracker' ? 'Track days where you studied less than your configured daily target hours.'
                : activeTab === 'goal_settings' ? 'Configure the mandatory study hours for each day of the week.'
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
            {user.role === 'student' && (() => {
              const stats = calculateStudentStats();
              const todayDayIndex = new Date().getDay();
              const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];
              const todayTarget = goalConfig[todayKey] !== undefined ? goalConfig[todayKey] : 12;

              return (
                <>
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
                    <div className="card">
                      <div className="card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>⏱️</div>
                      <h3>Today's Study Hours</h3>
                      <div className="value">{formatStudyTime(stats.todayHours)}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 'bold' }}>
                        Target Today: {todayTarget > 0 ? `${todayTarget} hrs` : 'No Target (Holiday)'}
                      </div>
                    </div>
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

            {user.role === 'admin' && (
              <div className="dashboard-cards" style={{ marginBottom: '2rem' }}>
                <div className="card">
                  <div className="card-icon">👨‍🎓</div>
                  <h3>Total Registered Students</h3>
                  <div className="value">{Array.isArray(students) ? students.length : 0}</div>
                </div>
                <div className="card">
                  <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📊</div>
                  <h3>Active Check-ins Today</h3>
                  <div className="value">{Array.isArray(data) ? data.filter(d => d.date === new Date().toISOString().split('T')[0]).length : 0}</div>
                </div>
              </div>
            )}

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
              </>
            )}

            <section className="recent-activity">
              <h2>{user.role === 'admin' ? 'Today\'s Attendance Summary' : 'Your Check-ins'}</h2>
              <div className="activity-list">
                {user.role === 'admin' && Array.isArray(data) ? (() => {
                  const studentMap = {};
                  if (Array.isArray(students)) {
                    students.forEach(s => {
                      studentMap[s.userId] = s.name;
                    });
                  }
                  return data.filter(d => d.date === new Date().toISOString().split('T')[0]).map((record, idx) => (
                    <div key={idx} className="activity-item">
                      <div className="activity-info">
                        <div className="activity-dot" style={{ background: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}></div>
                        <div>
                          <strong>{record.studentName || studentMap[record.studentId] || record.studentId || 'Unknown Student'}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ID: {record.studentId} • Course: {record.course || '-'}</div>
                        </div>
                      </div>
                      <div className="activity-date" style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}>{record.status}</div>
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
            
            {user.role === 'student' && data && !data.profileCompleted && (
              <div style={{ 
                padding: '1.5rem', 
                background: 'rgba(239, 68, 68, 0.08)', 
                borderLeft: '4px solid #ef4444', 
                borderRadius: '8px', 
                marginBottom: '2rem', 
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.05)',
                maxWidth: '800px'
              }}>
                <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚠️ Complete Your Profile Details
                </h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                  Please complete all profile details below (including Address, Group Selection, Aadhaar Number, and Parent details) to unlock all dashboard features and services.
                </p>
              </div>
            )}

            <div className="card" style={{ maxWidth: '800px', padding: '2rem' }}>
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* SECTION 1: Personal & Account Details */}
                <div>
                  <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>👤 Personal Details</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.2rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.04)', borderRadius: '12px', border: '1px dashed rgba(59, 130, 246, 0.2)' }}>
                      <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', borderRadius: '50%', background: 'var(--primary-color)' }}>
                        {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 'bold' }}>{user.name}</h4>
                        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          🎓 {user.role} Account
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.2rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Full Name</label>
                        <input type="text" required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Email ID</label>
                        <input type="email" required value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.2rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Phone Number</label>
                        <input type="tel" required value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                      </div>
                      {user.role === 'student' ? (
                        <div style={{ opacity: 0.7 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Enrolled Course</label>
                          <input type="text" readOnly value={profileForm.course} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--text-muted)', fontSize: '1rem' }} />
                        </div>
                      ) : null}
                    </div>

                    {user.role === 'student' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.2rem' }}>
                        <div style={{ opacity: 0.7 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Study Mode</label>
                          <input type="text" readOnly value={profileForm.mode || 'residential'} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'capitalize' }} />
                        </div>
                        <div style={{ opacity: 0.7 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Enrolled Batch</label>
                          <input type="text" readOnly value={profileForm.batch || 'September 2026'} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--text-muted)', fontSize: '1rem' }} />
                        </div>
                      </div>
                    )}

                    {user.role === 'student' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.2rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Group Choice</label>
                          <select required value={profileForm.group || ''} onChange={(e) => setProfileForm({ ...profileForm, group: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', outline: 'none', fontSize: '1rem' }}>
                            <option value="">Select Group...</option>
                            <option value="Group 1">Group 1</option>
                            <option value="Group 2">Group 2</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Aadhaar Number</label>
                          <input type="text" required pattern="\d{12}" title="Aadhaar must be a 12-digit number" placeholder="Enter 12-digit Aadhaar" value={profileForm.aadharNumber || ''} onChange={(e) => setProfileForm({ ...profileForm, aadharNumber: e.target.value.replace(/\D/g, '').substring(0, 12) })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Date of Birth</label>
                          <input type="date" required value={profileForm.dob || ''} onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Date of Joining</label>
                          <input type="date" required value={profileForm.joiningDate || ''} onChange={(e) => setProfileForm({ ...profileForm, joiningDate: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} />
                        </div>
                      </div>
                    )}

                    {user.role === 'student' && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>Permanent Address</label>
                        <textarea required placeholder="Enter full permanent address" value={profileForm.address || ''} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem', minHeight: '80px', fontFamily: 'inherit' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: Parents Information (Student Only) */}
                {user.role === 'student' && (
                  <div>
                    <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>👨‍👩‍👧 Parents Information</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
                      {/* Father's Details */}
                      <div style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>🧔 Father's Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Father's Name</label>
                            <input type="text" required value={profileForm.fatherName || ''} onChange={(e) => setProfileForm({ ...profileForm, fatherName: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Father's Contact Number</label>
                            <input type="tel" required value={profileForm.fatherPhone || ''} onChange={(e) => setProfileForm({ ...profileForm, fatherPhone: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Occupation</label>
                            <input type="text" required value={profileForm.fatherOccupation || ''} onChange={(e) => setProfileForm({ ...profileForm, fatherOccupation: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                        </div>
                      </div>

                      {/* Mother's Details */}
                      <div style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>👩 Mother's Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Mother's Name</label>
                            <input type="text" required value={profileForm.motherName || ''} onChange={(e) => setProfileForm({ ...profileForm, motherName: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Mother's Contact Number</label>
                            <input type="tel" required value={profileForm.motherPhone || ''} onChange={(e) => setProfileForm({ ...profileForm, motherPhone: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Occupation</label>
                            <input type="text" required value={profileForm.motherOccupation || ''} onChange={(e) => setProfileForm({ ...profileForm, motherOccupation: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }} />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                <button type="submit" style={{ 
                  marginTop: '1rem', 
                  padding: '1rem', 
                  background: '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.2s'
                }}>
                  💾 Save Profile Details
                </button>
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
                    placeholder="Search by student name..."
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
                          <strong>{record.studentName || record.studentId || 'Unknown Student'}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ID: {record.studentId} • Course: {record.course || '-'}</div>
                        </div>
                      </div>

                      {attendanceView === 'daily' ? (() => {
                        const recDate = new Date(record.date);
                        const dayOfWeek = recDate.getDay();
                        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const dayKey = dayKeys[dayOfWeek];
                        const targetHours = goalConfig[dayKey] !== undefined ? goalConfig[dayKey] : 12;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="activity-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                              <span style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : record.status === 'Partial' ? '#f59e0b' : '#ef4444' }}>
                                {record.status} ({formatStudyTime(record.totalHours)})
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                Target: {targetHours > 0 ? `${targetHours} hrs` : 'Holiday'} • {record.date}
                              </span>
                            </div>
                            {user.role === 'admin' && (record.status === 'Partial' || record.status === 'Present') && (
                              <button
                                onClick={() => handleOpenManualCheckout(record)}
                                style={{
                                  padding: '0.45rem 0.9rem',
                                  background: record.status === 'Partial' ? '#f59e0b' : 'transparent',
                                  border: record.status === 'Partial' ? 'none' : '1px solid #3b82f6',
                                  color: record.status === 'Partial' ? 'white' : '#3b82f6',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  boxShadow: record.status === 'Partial' ? '0 4px 10px rgba(245, 158, 11, 0.2)' : 'none'
                                }}
                              >
                                {record.status === 'Partial' ? 'Mark OUT 🕒' : 'Edit OUT ✏️'}
                              </button>
                            )}
                          </div>
                        );
                      })() : (
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
                    formData.append('examDuration', e.target.examDuration.value);
                    formData.append('uploadDuration', e.target.uploadDuration.value);
                    
                    // Convert local date value (midnight) to ISO string
                    const localDate = new Date(e.target.scheduledTime.value + "T00:00:00");
                    formData.append('scheduledTime', localDate.toISOString());
                    
                    const file = e.target.file.files[0];
                    if (file && file.size > 4 * 1024 * 1024) {
                      alert("File size exceeds Vercel's 4.5MB upload limit. Please upload a smaller file under 4MB.");
                      return;
                    }
                    formData.append('file', file);

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
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Exam Duration (minutes)</label>
                      <input type="number" name="examDuration" placeholder="e.g. 180" defaultValue="180" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Upload Time (minutes)</label>
                      <input type="number" name="uploadDuration" placeholder="e.g. 15" defaultValue="15" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Schedule Date (When will this be visible?)</label>
                    <input type="date" name="scheduledTime" required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
                  </div>
                  <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.docx" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
                  <button type="submit" style={{ padding: '0.75rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Upload & Schedule</button>
                </form>
              </div>
            )}

            <div className="card">
              <h3 style={{ marginBottom: '1.5rem' }}>{user.role === 'admin' ? 'Scheduled Papers' : 'Available Papers'}</h3>
              <div className="activity-list">
                {papers.map((paper) => {
                  if (user.role === 'student') {
                    return (
                      <StudentPaperCard 
                        key={paper._id} 
                        paper={paper} 
                        user={user} 
                        onRefresh={fetchPapers} 
                      />
                    );
                  }

                  // Admin View
                  const totalDurationMins = (paper.examDuration || 180) + (paper.uploadDuration || 15);
                  const totalDurationMs = totalDurationMins * 60 * 1000;
                  const hasExpired = paper.startTime && (new Date(paper.startTime).getTime() + totalDurationMs < new Date().getTime());

                  let statusText = "Not Started";
                  let statusColor = "var(--text-muted)";
                  let statusBg = "rgba(0,0,0,0.06)";

                  if (paper.answerUploadedAt) {
                    statusText = "Submitted";
                    statusColor = "#10b981";
                    statusBg = "rgba(16, 185, 129, 0.1)";
                  } else if (hasExpired) {
                    statusText = "Expired";
                    statusColor = "#ef4444";
                    statusBg = "rgba(239, 68, 68, 0.1)";
                  } else if (paper.startTime) {
                    statusText = "In Progress";
                    statusColor = "var(--primary-color)";
                    statusBg = "rgba(59, 130, 246, 0.1)";
                  }

                  return (
                    <div key={paper._id} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem', padding: '1.2rem', background: 'white', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{paper.title}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          <span>Target: <strong>{paper.target}</strong></span>
                          <span>Scheduled Date: <strong>{new Date(paper.scheduledTime).toLocaleDateString()}</strong></span>
                          <span>Exam: <strong>{paper.examDuration || 180}m</strong> | Upload: <strong>{paper.uploadDuration || 15}m</strong></span>
                        </div>
                        {paper.startTime && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                            Started: {new Date(paper.startTime).toLocaleString()} 
                            {paper.answerUploadedAt && ` • Submitted: ${new Date(paper.answerUploadedAt).toLocaleString()}`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <span style={{ fontSize: '0.8rem', color: statusColor, background: statusBg, padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {statusText}
                        </span>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                              a.download = paper.fileName || 'question-paper.pdf';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            } catch(err) {
                              alert("Error downloading QP");
                            }
                          }} style={{ padding: '0.45rem 0.9rem', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }} title="Download Question Paper">
                            QP 📥
                          </button>

                          {paper.answerUploadedAt && (
                            <button onClick={async () => {
                              try {
                                const res = await fetch(`/admin/paper/${paper._id}/download-answer`, {
                                  headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                                if (!res.ok) throw new Error();
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = paper.answerFileName || 'answer-sheet.pdf';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                              } catch(err) {
                                alert("Error downloading answer sheet");
                              }
                            }} style={{ padding: '0.45rem 0.9rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }} title="Download Scanned Answer Sheet">
                              Answer 📥
                            </button>
                          )}

                          <button onClick={async () => {
                            if(!window.confirm('Delete this paper?')) return;
                            await fetch(`/admin/paper/${paper._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }});
                            fetchPapers();
                          }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {papers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No papers available.</p>}
              </div>
            </div>
          </>
        ) : activeTab === 'schedules' ? (
          <>
            {user.role === 'admin' ? (
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
                      if (file && file.size > 4 * 1024 * 1024) {
                        alert("File size exceeds Vercel's 4.5MB upload limit. Please upload a smaller file under 4MB.");
                        return;
                      }

                      const formData = new FormData();
                      formData.append('title', e.target.title.value);
                      formData.append('target', e.target.target.value);
                      formData.append('date', e.target.date.value);
                      if (file) {
                        formData.append('file', file);
                      }

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
                        if(!res.ok) throw new Error(resData.message);
                        alert('Schedule created successfully!');
                        e.target.reset();
                        fetchSchedules();
                      } catch(err) {
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
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Upload Document / File</label>
                        <input type="file" name="file" required style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />
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
                        <div key={sched._id} className="activity-item" style={{ 
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
                                    a.download = sched.fileName || 'file';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                  } catch(err) {
                                    alert("Error downloading file: " + err.message);
                                  }
                                }}
                                style={{ padding: '0.45rem 0.9rem', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary-color)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                                title="Download Attached File"
                              >
                                Attachment 📥
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
                            <button 
                              onClick={async () => {
                                if(!window.confirm('Delete this schedule?')) return;
                                try {
                                  const res = await fetch(`/admin/schedule/${sched._id}`, { 
                                    method: 'DELETE', 
                                    headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if(res.ok) fetchSchedules();
                                } catch(e) {
                                  console.error(e);
                                }
                              }} 
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}
                              title="Delete Schedule"
                            >
                              🗑️
                            </button>
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
                  <div className="activity-list">
                    {schedules.map((sched) => {
                      return (
                        <div key={sched._id} className="activity-item" style={{ 
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
                                    a.download = sched.fileName || 'file';
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    fetchSchedules();
                                  } catch(err) {
                                    alert("Error downloading file: " + err.message);
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
                                Download File 📥
                              </button>
                            )}
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
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingPayment({
                              studentId: fee.studentId,
                              studentName: fee.studentName,
                              paymentId: fee._id,
                              amount: fee.amount,
                              date: fee.date,
                              receiptNo: fee.receiptNo || '',
                              status: fee.status
                            })} style={{ padding: '0.3rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>✏️ Edit</button>
                            {fee.status === 'Pending' && (
                              <>
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
                              </>
                            )}
                            {(fee.status === 'Verified' || fee.status === 'Paid') && (
                              <button onClick={async () => {
                                if (!window.confirm(`Are you sure you want to revert this payment of ₹${fee.amount}? This will mark it as Pending (unmarked), subtract the amount from the student's total paid fees, and update their installment statuses.`)) return;
                                try {
                                  const res = await fetch(`/admin/student/${fee.studentId}/payment/${fee._id}/revert`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if (!res.ok) throw new Error(await res.text());
                                  fetchStudentsData();
                                } catch(e) { alert('Error: ' + e.message); }
                              }} style={{ padding: '0.3rem 0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Revert</button>
                            )}
                          </div>
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
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Next Payment Due</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {profileData?.nextPaymentDueDate ? new Date(profileData.nextPaymentDueDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>

                      {profileData?.installments && profileData.installments.length > 0 && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(0, 0, 0, 0.1)' }}>
                          <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 'bold', display: 'block', marginBottom: '0.75rem' }}>📅 Installment Schedule</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {profileData.installments.map((inst, idx) => (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'white', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem' }}>Installment {idx + 1}: ₹{inst.amount}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                  <span>Due: {new Date(inst.dueDate).toLocaleDateString()}</span>
                                  {inst.status === 'Paid' ? (
                                    <span style={{ color: '#10b981', fontWeight: 'bold', padding: '0.1rem 0.4rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px' }}>
                                      ✓ Paid {inst.paidDate ? `on ${new Date(inst.paidDate).toLocaleDateString()}` : ''}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#ef4444', fontWeight: 'bold', padding: '0.1rem 0.4rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}>
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
        ) : activeTab === 'study_tracker' ? (
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

            {(() => {
              const stats = calculateStudentStats();
              const shortfallDays = studyTrackerPeriod === 'week' ? stats.lowHoursWeek : stats.lowHoursMonth;
              const totalDaysCount = shortfallDays.length;
              const todayDayIndex = new Date().getDay();
              const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];
              const todayTarget = goalConfig[todayKey] !== undefined ? goalConfig[todayKey] : 12;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Weekly Target Goals Schedule */}
                  <div className="card" style={{ padding: '1.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🎯 Weekly Target Goals Schedule
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                        const target = goalConfig[day] !== undefined ? goalConfig[day] : (day === 'sunday' ? 0 : 12);
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
                      <h3>Shortfall Days</h3>
                      <div className="value" style={{ fontSize: '2rem', color: totalDaysCount > 0 ? '#ef4444' : '#10b981' }}>
                        {totalDaysCount} {totalDaysCount === 1 ? 'Day' : 'Days'}
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="card">
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '1rem' }}>
                      📋 Shortfall Days Details (Excluding Holidays)
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
              );
            })()}
          </>
        ) : activeTab === 'goal_settings' ? (
          <div className="card" style={{ maxWidth: '600px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>⚙️ Configure Daily Study Target Hours</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Set the target study hours for students for each day of the week. Setting target hours to 0 will mark that day as a holiday and exclude it from student shortfall calculations.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = {
                  sunday: parseFloat(e.target.sunday.value),
                  monday: parseFloat(e.target.monday.value),
                  tuesday: parseFloat(e.target.tuesday.value),
                  wednesday: parseFloat(e.target.wednesday.value),
                  thursday: parseFloat(e.target.thursday.value),
                  friday: parseFloat(e.target.friday.value),
                  saturday: parseFloat(e.target.saturday.value)
                };
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
                } catch(err) {
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
                      defaultValue={goalConfig[day] !== undefined ? goalConfig[day] : (day === 'sunday' ? 0 : 12)}
                      required
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.5)', color: 'var(--text-main)', fontSize: '1rem' }}
                    />
                  </div>
                ))}
              </div>
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
          </div>
        ) : activeTab === 'feeSetup' && feeSetupStudent ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Set Fee Structure for {feeSetupStudent.name}</h2>
              <button onClick={() => { setActiveTab('students'); setFeeSetupStudent(null); }} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>← Back to Students</button>
            </div>
            <div className="card" style={{ maxWidth: '700px' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                
                const insts = feeSetupStudent.installments || [];
                const totalCourseFee = Number(feeSetupStudent.totalFees);
                const sumInstallments = insts.reduce((sum, inst) => sum + Number(inst.amount || 0), 0);

                if (sumInstallments !== totalCourseFee) {
                  alert(`The sum of installment amounts (₹${sumInstallments}) must exactly equal the Total Course Fee (₹${totalCourseFee}). Please adjust installment values.`);
                  return;
                }

                const missingDates = insts.some(inst => !inst.dueDate);
                if (missingDates) {
                  alert("Please enter due dates for all configured installments.");
                  return;
                }

                try {
                  const res = await fetch(`/admin/student/${feeSetupStudent.userId}/fees`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      totalFees: totalCourseFee, 
                      installments: insts
                    })
                  });
                  if (!res.ok) throw new Error(await res.text());
                  alert('Fee structure updated successfully!');
                  fetchStudentsData();
                  setActiveTab('students');
                  setFeeSetupStudent(null);
                } catch(err) { alert('Error: ' + err.message); }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Total Course Fee (₹)</label>
                  <input 
                    type="number" 
                    required 
                    min="0" 
                    value={feeSetupStudent.totalFees} 
                    onChange={e => {
                      const newTotal = e.target.value;
                      setFeeSetupStudent({
                        ...feeSetupStudent,
                        totalFees: newTotal
                      });
                    }} 
                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '1.1rem', background: 'transparent', color: 'var(--text-main)' }} 
                  />
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📅 Installments Configuration</h3>
                    <button 
                      type="button" 
                      onClick={() => {
                        const currentInsts = feeSetupStudent.installments || [];
                        setFeeSetupStudent({
                          ...feeSetupStudent,
                          installments: [...currentInsts, { amount: '', dueDate: '', status: 'Unpaid' }]
                        });
                      }}
                      style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ➕ Add Installment
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(feeSetupStudent.installments || []).map((inst, index) => (
                      <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ flex: '1', minWidth: '120px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Installment {index + 1} Amount (₹)</label>
                          <input 
                            type="number" 
                            required 
                            min="1" 
                            placeholder="Amount"
                            value={inst.amount}
                            onChange={e => {
                              const updated = [...feeSetupStudent.installments];
                              updated[index].amount = e.target.value;
                              setFeeSetupStudent({ ...feeSetupStudent, installments: updated });
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', background: 'transparent' }}
                          />
                        </div>
                        <div style={{ flex: '1.2', minWidth: '160px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Due Date</label>
                          <input 
                            type="date" 
                            required 
                            value={inst.dueDate}
                            onChange={e => {
                              const updated = [...feeSetupStudent.installments];
                              updated[index].dueDate = e.target.value;
                              setFeeSetupStudent({ ...feeSetupStudent, installments: updated });
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', background: 'transparent' }}
                          />
                        </div>
                        {(feeSetupStudent.installments || []).length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = (feeSetupStudent.installments || []).filter((_, i) => i !== index);
                              setFeeSetupStudent({ ...feeSetupStudent, installments: updated });
                            }}
                            style={{ alignSelf: 'flex-end', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Remove Installment"
                          >
                            ❌ Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary Metrics */}
                  {(() => {
                    const totalCourseFee = Number(feeSetupStudent.totalFees || 0);
                    const allocatedSum = (feeSetupStudent.installments || []).reduce((sum, inst) => sum + Number(inst.amount || 0), 0);
                    const remainingVal = totalCourseFee - allocatedSum;
                    const isFullyAllocated = remainingVal === 0;

                    return (
                      <div style={{ marginTop: '1.5rem', padding: '1rem', background: isFullyAllocated ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)', borderRadius: '8px', border: `1px dashed ${isFullyAllocated ? '#10b981' : '#f59e0b'}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--text-main)' }}>Allocated: ₹{allocatedSum} / ₹{totalCourseFee}</span>
                        <span style={{ color: isFullyAllocated ? '#10b981' : '#f59e0b' }}>
                          {isFullyAllocated ? '✓ Fees Fully Allocated' : `Remaining: ₹${remainingVal}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => { setActiveTab('students'); setFeeSetupStudent(null); }} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>Save Fee Structure</button>
                </div>
              </form>
            </div>
          </>
        ) : (
          /* STUDENTS TAB (Admin Only) */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>All Students</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleExportStudentsLedger}
                  style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  {user.role === 'staff' ? '📥 Export Students' : '📥 Export Fee Ledger'}
                </button>
                <button
                  onClick={() => { setShowAddForm(!showAddForm); setAddMsg(''); }}
                  style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  {showAddForm ? 'Close Form' : '+ Add Student'}
                </button>
              </div>
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
                    <select value={newStudent.batch || 'September 2026'} onChange={e => setNewStudent({ ...newStudent, batch: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.8)', color: 'var(--text-main)', outline: 'none' }}>
                      <option value="September 2026">September 2026</option>
                      <option value="November 2026">November 2026</option>
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
                            <>
                              <button onClick={() => { 
                                 const existingInstallments = Array.isArray(student.installments) && student.installments.length > 0 
                                   ? student.installments.map(inst => ({
                                       amount: inst.amount || '',
                                       dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString().split('T')[0] : '',
                                       status: inst.status || 'Unpaid'
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
                                   nextPaymentDueDate: student.nextPaymentDueDate ? new Date(student.nextPaymentDueDate).toISOString().split('T')[0] : '',
                                   installments: existingInstallments
                                 }); 
                                 setActiveTab('feeSetup');
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
                            </>
                          )}
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
                <span className="detail-label">Batch</span>
                <span className="detail-value">{newStudentDetails.batch}</span>
              </div>

            </div>

            <button className="modal-btn" onClick={() => setNewStudentDetails(null)}>
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}

      {/* STUDENT FEE DUE POPUP MODAL */}
      {showFeeDuePopup && data && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Fee Installment Due</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              A gentle reminder that your upcoming course fee installment is due.
            </p>
            {(() => {
              const unpaidInst = Array.isArray(data.installments) 
                ? data.installments.find(inst => inst.status === 'Unpaid') 
                : null;
              
              const dueAmount = unpaidInst ? unpaidInst.amount : ((data.totalFees || 0) - (data.feesPaid || 0));

              return (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block' }}>
                      {unpaidInst ? 'Upcoming Installment Due' : 'Remaining Balance'}
                    </span>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ef4444' }}>₹{dueAmount}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block' }}>Due Date</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      {data.nextPaymentDueDate ? new Date(data.nextPaymentDueDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowFeeDuePopup(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}>Remind Me Later</button>
              <button onClick={() => { setShowFeeDuePopup(false); setActiveTab('payments'); }} style={{ flex: 1, padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Pay Now</button>
            </div>
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

      {/* STUDENT PROFILE VIEW MODAL */}
      {viewingProfileStudent && (
        <div className="modal-overlay" onClick={() => setViewingProfileStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Student Profile: {viewingProfileStudent.name}</h2>
              <button onClick={() => setViewingProfileStudent(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem', textAlign: 'left' }}>
              {/* Personal Section */}
              <div>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>👤 Personal Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Student ID</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.userId}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Course & Mode</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.course} ({viewingProfileStudent.mode || 'residential'})</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Email</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.email || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Phone</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.phone || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Date of Birth</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.dob ? new Date(viewingProfileStudent.dob).toLocaleDateString() : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Batch</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.batch || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Group Choice</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.group || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Aadhaar Number</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.aadharNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Date of Joining</span>
                    {user.role === 'admin' ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <input
                          type="date"
                          value={viewingProfileStudent.joiningDate ? new Date(viewingProfileStudent.joiningDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const newDoj = e.target.value;
                            setViewingProfileStudent({ ...viewingProfileStudent, joiningDate: newDoj });
                          }}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', width: '135px' }}
                        />
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/profile`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${user.token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ joiningDate: viewingProfileStudent.joiningDate })
                              });
                              if (!res.ok) throw new Error(await res.text());
                              alert('Date of Joining saved!');
                              fetchStudentsData();
                            } catch(err) {
                              alert('Error saving date of joining: ' + err.message);
                            }
                          }}
                          style={{ padding: '4px 8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <strong style={{ color: 'var(--text-main)' }}>
                        {viewingProfileStudent.joiningDate ? new Date(viewingProfileStudent.joiningDate).toLocaleDateString() : 'N/A'}
                      </strong>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>📍 Permanent Address</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.4' }}>{viewingProfileStudent.address || 'N/A'}</p>
              </div>

              {/* Parents Section */}
              <div>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>🧔 Father's Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Father's Name</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.fatherName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Father's Phone</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.fatherPhone || 'N/A'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Occupation</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.fatherOccupation || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>👩 Mother's Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Mother's Name</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.motherName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Mother's Phone</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.motherPhone || 'N/A'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>Occupation</span>
                    <strong style={{ color: 'var(--text-main)' }}>{viewingProfileStudent.motherOccupation || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Profile Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: viewingProfileStudent.profileCompleted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: viewingProfileStudent.profileCompleted ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span>{viewingProfileStudent.profileCompleted ? '✅ Profile Completed' : '⚠️ Profile Incomplete'}</span>
              </div>

              {/* Fees & Payments Section */}
              {user.role === 'admin' && (
                <div>
                  <h3 style={{ margin: '1rem 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>💳 Fees & Payments</h3>
                  
                  {/* Fee Status Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Total Fee</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>₹{viewingProfileStudent.totalFees || 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Paid</span>
                      <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>₹{viewingProfileStudent.feesPaid || 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Remaining</span>
                      <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>₹{(viewingProfileStudent.totalFees || 0) - (viewingProfileStudent.feesPaid || 0)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Next Due</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {viewingProfileStudent.nextPaymentDueDate ? new Date(viewingProfileStudent.nextPaymentDueDate).toLocaleDateString() : 'N/A'}
                      </strong>
                    </div>
                  </div>

                  {/* Installments Schedule */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>📅 Installment Schedule</h4>
                    {viewingProfileStudent.installments && viewingProfileStudent.installments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewingProfileStudent.installments.map((inst, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Installment {idx + 1}: ₹{inst.amount}</span>
                            <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Due: {new Date(inst.dueDate).toLocaleDateString()}</span>
                              {inst.status === 'Paid' ? (
                                <span style={{ color: '#10b981', fontWeight: 'bold', padding: '0.1rem 0.4rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px' }}>Paid</span>
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: 'bold', padding: '0.1rem 0.4rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px' }}>Unpaid</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No installments configured yet.</p>
                    )}
                  </div>

                  {/* Payment History */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>💸 Payment History</h4>
                    {viewingProfileStudent.feeHistory && viewingProfileStudent.feeHistory.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewingProfileStudent.feeHistory.map((fee, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <div>
                              <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>+ ₹{fee.amount}</strong>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                <span>Receipt: {fee.receiptNo || 'N/A'}</span>
                                <span style={{ marginLeft: '10px' }}>Date: {new Date(fee.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: fee.status === 'Pending' ? '#f59e0b' : (fee.status === 'Rejected' ? '#ef4444' : '#10b981') }}>
                                {fee.status}
                              </span>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => setEditingPayment({
                                    studentId: viewingProfileStudent.userId,
                                    studentName: viewingProfileStudent.name,
                                    paymentId: fee._id,
                                    amount: fee.amount,
                                    date: fee.date,
                                    receiptNo: fee.receiptNo || '',
                                    status: fee.status
                                  })}
                                  style={{ padding: '2px 6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                >
                                  Edit
                                </button>
                                {fee.status === 'Pending' && (
                                  <>
                                    <button onClick={async () => {
                                      try {
                                        const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/payment/${fee._id}/approve`, {
                                          method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                        });
                                        if (!res.ok) throw new Error(await res.text());
                                        fetchStudentsData();
                                      } catch(e) { alert('Error: ' + e.message); }
                                    }} style={{ padding: '2px 6px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Approve</button>
                                    <button onClick={async () => {
                                      try {
                                        const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/payment/${fee._id}/reject`, {
                                          method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                        });
                                        if (!res.ok) throw new Error(await res.text());
                                        fetchStudentsData();
                                      } catch(e) { alert('Error: ' + e.message); }
                                    }} style={{ padding: '2px 6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Reject</button>
                                  </>
                                )}
                                {(fee.status === 'Verified' || fee.status === 'Paid') && (
                                  <button onClick={async () => {
                                    if (!window.confirm(`Revert payment of ₹${fee.amount} to Pending (unmarked)?`)) return;
                                    try {
                                      const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/payment/${fee._id}/revert`, {
                                        method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                      });
                                      if (!res.ok) throw new Error(await res.text());
                                      fetchStudentsData();
                                    } catch(e) { alert('Error: ' + e.message); }
                                  }} style={{ padding: '2px 6px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Revert</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No payment history available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <button className="modal-btn" onClick={() => setViewingProfileStudent(null)} style={{ margin: 0, padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT MODAL */}
      {editingPayment && (
        <div className="modal-overlay" onClick={() => setEditingPayment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '95%', padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Edit Payment</h2>
              <button onClick={() => setEditingPayment(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const res = await fetch(`/admin/student/${editingPayment.studentId}/payment/${editingPayment.paymentId}/edit`, {
                  method: 'POST',
                  headers: { 
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    amount: Number(e.target.amount.value),
                    receiptNo: e.target.receiptNo.value,
                    date: new Date(e.target.date.value).toISOString(),
                    status: e.target.status.value
                  })
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.message || 'Failed to update payment');
                alert('Payment updated successfully!');
                fetchStudentsData();
                setEditingPayment(null);
              } catch(err) {
                alert('Error updating payment: ' + err.message);
              } finally {
                setLoading(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Student</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{editingPayment.studentName} ({editingPayment.studentId})</strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Amount (₹)</label>
                <input 
                  type="number" 
                  name="amount" 
                  defaultValue={editingPayment.amount} 
                  required 
                  min="0"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Receipt / Transaction No.</label>
                <input 
                  type="text" 
                  name="receiptNo" 
                  defaultValue={editingPayment.receiptNo} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Date</label>
                <input 
                  type="date" 
                  name="date" 
                  defaultValue={editingPayment.date ? new Date(editingPayment.date).toISOString().split('T')[0] : ''} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Status</label>
                <select 
                  name="status" 
                  defaultValue={editingPayment.status} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Paid">Paid</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingPayment(null)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL CHECK-OUT MODAL */}
      {showManualCheckoutModal && manualCheckoutData && (
        <div className="modal-overlay" onClick={() => setShowManualCheckoutModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>🕒 Manual Check-Out</h2>
            <p className="subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              Set check-out time for the student's daily record.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Student</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{manualCheckoutData.studentName} ({manualCheckoutData.studentId})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Date</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{manualCheckoutData.date}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--glass-border)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Recorded Check-In</span>
                <strong style={{ color: '#10b981', fontSize: '0.85rem' }}>{manualCheckoutData.checkInTimeDisplay}</strong>
              </div>
            </div>

            <form onSubmit={handleManualCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Check-Out Time</label>
                <input 
                  type="time" 
                  value={manualCheckoutData.checkoutTime} 
                  onChange={(e) => setManualCheckoutData({ ...manualCheckoutData, checkoutTime: e.target.value })}
                  required 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowManualCheckoutModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)' }}>Confirm Check-Out</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
