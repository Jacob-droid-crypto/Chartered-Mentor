import React, { useEffect, useState, useCallback } from 'react';
import FinesTab from './components/FinesTab';
import StudentFinesView from './components/StudentFinesView';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStudentCustomMonthRange = (joiningDateStr, targetDateStr) => {
  const jDate = new Date(joiningDateStr);
  const targetDate = new Date(targetDateStr);

  if (isNaN(jDate.getTime()) || isNaN(targetDate.getTime())) {
    return null;
  }

  jDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth(); // 0-11
  const dojDay = jDate.getDate();

  let startYear = targetYear;
  let startMonth = targetMonth;

  const lastDayOfTargetMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const startDay = Math.min(dojDay, lastDayOfTargetMonth);

  let startDate = new Date(startYear, startMonth, startDay);
  startDate.setHours(0, 0, 0, 0);

  if (targetDate < startDate) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
    const lastDayOfPrevMonth = new Date(startYear, startMonth + 1, 0).getDate();
    const prevStartDay = Math.min(dojDay, lastDayOfPrevMonth);
    startDate = new Date(startYear, startMonth, prevStartDay);
    startDate.setHours(0, 0, 0, 0);
  }

  let endYear = startDate.getFullYear();
  let endMonth = startDate.getMonth() + 1;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }
  const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
  const endDay = Math.min(dojDay, lastDayOfEndMonth);
  const endDate = new Date(endYear, endMonth, endDay);
  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

const ALL_SEATS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'
];
const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1600;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const getSyncedNow = () => {
  const offset = window.serverTimeOffset || 0;
  return new Date(Date.now() - offset);
};

function StudentPaperCard({ paper, user, onRefresh, showConfirm }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Parse time
  const scheduledDate = new Date(paper.scheduledTime);
  const todayStr = getLocalDateString(getSyncedNow());
  const scheduledStr = scheduledDate.toISOString().split("T")[0];
  const isLocked = todayStr < scheduledStr;

  const totalDurationMins = paper.examDuration + paper.uploadDuration;
  const totalDurationMs = totalDurationMins * 60 * 1000;
  const isTimeExpired = paper.startTime && (new Date(paper.startTime).getTime() + totalDurationMs < getSyncedNow().getTime());

  useEffect(() => {
    if (!paper.startTime || paper.answerUploadedAt) return;

    const totalDurationMins = paper.examDuration + paper.uploadDuration;
    const totalDurationMs = totalDurationMins * 60 * 1000;
    const endMs = new Date(paper.startTime).getTime() + totalDurationMs;

    const updateTimer = () => {
      const remainingMs = endMs - getSyncedNow().getTime();
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
    if (!await showConfirm("Are you sure you want to start the exam? Your individual timer will begin immediately.")) return;
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

    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      try {
        setUploading(true);
        fileToUpload = await compressImage(file);
      } catch (err) {
        console.error("Compression failed, uploading original", err);
      }
    }

    if (fileToUpload.size > 3.2 * 1024 * 1024) {
      alert(`Only files below 3.2 MB are allowed. Selected file size is ${(fileToUpload.size / (1024 * 1024)).toFixed(2)}MB. Please compress your file or upload a smaller file.`);
      setUploading(false);
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(fileToUpload);
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
        } catch (e) {
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
              } catch (err) {
                alert("Error downloading answer sheet");
              }
            }} style={{ padding: '0.55rem 1.2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              View Submission
            </button>
            <button onClick={async () => {
              try {
                const res = await fetch(`/student/paper/${paper._id}/download`, {
                  headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (!res.ok) throw new Error();
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = paper.fileName || 'question-paper.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
              } catch (err) {
                alert("Error downloading question paper");
              }
            }} style={{ padding: '0.55rem 1.2rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              View Question Paper
            </button>
            {!isTimeExpired && (
              <>
                <input
                  type="file"
                  id={`re-upload-${paper._id}`}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 3.2 * 1024 * 1024) {
                        alert("Only files below 3.2 MB are allowed.");
                        return;
                      }
                      if (await showConfirm(`Are you sure you want to overwrite your previous submission with "${file.name}"?`)) {
                        handleFileUpload(file);
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

        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          📌 <strong>Exam Rules:</strong> Please write your answers on paper, scan them into a single PDF or image file, and upload it below before the timer runs out. You have <strong>{paper.examDuration} minutes</strong> to write and <strong>{paper.uploadDuration} minutes</strong> to upload.
        </div>

        {/* Download Question Paper Button */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
          <button
            onClick={async () => {
              try {
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
              } catch (err) {
                alert("Error downloading question paper: " + err.message);
              }
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            📥 Download Question Paper
          </button>
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
                or click below to choose a file (PDF or Images, Max 3.2 MB)
              </p>
              <div style={{ margin: '0.5rem 0', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                ⚠️ Notice: Only files below 3.2 MB are allowed.
              </div>
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
    <div className="activity-item" style={{ background: 'var(--surface-solid)', border: '1px solid var(--glass-border)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
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
                  alert("Only files below 3.2 MB are allowed.");
                  return;
                }
                if (!await showConfirm(`Start exam and upload "${file.name}" directly?`)) return;
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
                } catch (err) {
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

function Dashboard({ user, onLogout, theme, setTheme }) {
  const isAdminOrStaff = user.role === 'admin' || user.role === 'staff';

  // Helper to parse tab from hash
  const getTabFromHash = () => {
    const hash = window.location.hash; // e.g. "#/attendance"
    if (hash && hash.startsWith('#/')) {
      return hash.substring(2);
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState(getTabFromHash);

  // Wrapper to set state and update URL hash
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    window.location.hash = `#/${tab}`;
  }, []);

  // Listen to hash changes (for browser back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromHash();
      setActiveTabState(tab);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    
    window.alert = (message) => {
      let type = 'info';
      const msgLower = String(message).toLowerCase();
      if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('denied') || msgLower.includes('invalid') || msgLower.includes('expired')) {
        type = 'error';
      } else if (msgLower.includes('success') || msgLower.includes('saved') || msgLower.includes('approved') || msgLower.includes('completed') || msgLower.includes('uploaded')) {
        type = 'success';
      }
      showToast(message, type);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [liveStudyHours, setLiveStudyHours] = useState(0);
  const [studyTrackerPeriod, setStudyTrackerPeriod] = useState('week');
  const [todayAttendanceFilter, setTodayAttendanceFilter] = useState('all'); // all, present, absent
  const [motivationalQuote, setMotivationalQuote] = useState('');
  const [goalConfig, setGoalConfig] = useState({ monday: 12, tuesday: 12, wednesday: 12, thursday: 12, friday: 12, saturday: 12, sunday: 0, autoLogoutTime: '22:00', autoLogoutEnabled: true });
  const [goalConfigs, setGoalConfigs] = useState([]);
  const [selectedGoalStudent, setSelectedGoalStudent] = useState('');
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [seatSearch, setSeatSearch] = useState('');
  const [showFineAlertModal, setShowFineAlertModal] = useState(false);

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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({});

  // Batch Management State
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState(null);
  const [newBatchName, setNewBatchName] = useState('');
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editingBatchName, setEditingBatchName] = useState('');

  // Student options dropdown state
  const [openMenuId, setOpenMenuId] = useState(null);

  // QR Scanning State
  const [scanning, setScanning] = useState(false);

  // Attendance Filters
  const [attendanceView, setAttendanceView] = useState('daily'); // daily, weekly, monthly, student
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(getLocalDateString());
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAttendanceStudentId, setSelectedAttendanceStudentId] = useState('');
  const [studentLogs, setStudentLogs] = useState([]);

  // Exam Scheduler State
  const [examSchedules, setExamSchedules] = useState([]);
  const [schedulerStudentId, setSchedulerStudentId] = useState("");
  const [schedulerType, setSchedulerType] = useState("Exam");
  const [schedulerDate, setSchedulerDate] = useState("");
  const [schedulerExamName, setSchedulerExamName] = useState("");
  const [schedulerFilterDate, setSchedulerFilterDate] = useState(getLocalDateString());

  // Exam Scheduler Editing State
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editExamName, setEditExamName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

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

  // Due Students Tab States
  const [dueSearchQuery, setDueSearchQuery] = useState('');
  const [dueFilterType, setDueFilterType] = useState('all'); // all, overdue, due_today, upcoming
  const [upcomingStartDate, setUpcomingStartDate] = useState(getLocalDateString());
  const [upcomingEndDate, setUpcomingEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return getLocalDateString(d);
  });

  // Campus QR Rotation States
  const [campusQRConfig, setCampusQRConfig] = useState({
    activeInToken: "CM-ATTENDANCE-IN",
    activeOutToken: "CM-ATTENDANCE-OUT"
  });
  const [autoRotate, setAutoRotate] = useState(false);

  // Manual Checkout UI States
  const [showManualCheckoutModal, setShowManualCheckoutModal] = useState(false);
  const [manualCheckoutData, setManualCheckoutData] = useState({ studentId: '', studentName: '', date: '', checkoutTime: '18:00', checkInTimeDisplay: '' });

  // Manual Checkin UI States
  const [showManualCheckinModal, setShowManualCheckinModal] = useState(false);
  const [manualCheckinData, setManualCheckinData] = useState({ studentId: '', studentName: '', date: '', checkinTime: '09:00' });

  // Reusable submit logic for attendance
  const submitAttendance = async (qrData) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    // Retrieve or generate persistent device ID
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("device_id", deviceId);
    }

    const optionsHigh = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const optionsLow = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000 // Allow cached locations up to 1 minute
    };

    const sendRequest = async (lat, lng) => {
      try {
        const response = await fetch(`/student/scan-qr`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: user.userId,
            qrValue: qrData,
            lat: lat,
            lng: lng,
            deviceId: deviceId
          })
        });
        const d = await response.json();
        alert(d.message);
        fetchDashboardData(); // Refresh their dashboard
      } catch (err) {
        alert('Failed to log attendance');
      }
    };

    const handleGeoError = (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        alert("Location access denied. Please enable location permissions for this site in your browser/device settings to mark attendance.");
      } else if (error.code === error.TIMEOUT) {
        alert("Location request timed out. Please ensure GPS/location is enabled and try again, or move closer to a window.");
      } else {
        alert("Unable to retrieve location. Please check your device location settings and try again.");
      }
    };

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendRequest(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn("High accuracy geolocation failed, trying low accuracy...", error);
        // Fall back to low accuracy on timeout or position unavailable
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              sendRequest(position.coords.latitude, position.coords.longitude);
            },
            (err2) => {
              handleGeoError(err2);
            },
            optionsLow
          );
        } else {
          handleGeoError(error);
        }
      },
      optionsHigh
    );
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

  const handleOpenManualCheckin = async (record) => {
    let initialCheckinTime = '09:00';
    if (record.firstIn) {
      const inDate = new Date(record.firstIn);
      if (!isNaN(inDate.getTime())) {
        const h = String(inDate.getHours()).padStart(2, '0');
        const m = String(inDate.getMinutes()).padStart(2, '0');
        initialCheckinTime = `${h}:${m}`;
      }
    }

    setManualCheckinData({
      studentId: record.studentId,
      studentName: record.studentName || 'Unknown Student',
      date: record.date,
      checkinTime: initialCheckinTime,
    });
    setShowManualCheckinModal(true);
  };

  const handleManualCheckinSubmit = async (e) => {
    e.preventDefault();
    try {
      const { studentId, date, checkinTime } = manualCheckinData;
      const res = await fetch(`/admin/attendance/manual-checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentId, date, checkinTime })
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.message || 'Failed to submit manual checkin');
      }
      alert(d.message || 'Check-in marked successfully!');
      setShowManualCheckinModal(false);
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

      // Synced Server Time
      const serverDateHeader = response.headers.get('Date');
      const serverTimeVal = result.serverTime || serverDateHeader;
      if (serverTimeVal) {
        window.serverTimeOffset = Date.now() - new Date(serverTimeVal).getTime();
      }

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

      if (user.role === 'student' && result.fines && result.fines.some(fine => fine.status !== 'Paid')) {
        const studentIdKey = result.userId || user.userId || 'student';
        if (!sessionStorage.getItem('finePopupShown_' + studentIdKey)) {
          setShowFineAlertModal(true);
          sessionStorage.setItem('finePopupShown_' + studentIdKey, 'true');
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

  const fetchBatches = async () => {
    try {
      setBatchesLoading(true);
      setBatchesError(null);
      const response = await fetch(`/admin/batches`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch batches');
      setBatches(result);
      
      // Auto-set the new student batch if it's currently empty or has the old hardcoded default
      if (result.length > 0) {
        setNewStudent(prev => {
          if (!prev.batch || prev.batch === 'September 2026') {
            return { ...prev, batch: result[0].name };
          }
          return prev;
        });
      }
    } catch (err) {
      setBatchesError(err.message);
    } finally {
      setBatchesLoading(false);
    }
  };


  const fetchStudentLogs = async (studentId) => {
    if (user.role !== 'student' && !studentId) {
      setStudentLogs([]);
      return;
    }
    try {
      setLoading(true);
      const endpoint = (user.role === 'student')
        ? '/student/attendance-history'
        : `/admin/attendance?studentId=${studentId}`;
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await res.json();
      if (res.ok) {
        setStudentLogs(result);
      } else {
        throw new Error(result.message || 'Failed to fetch student logs');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && attendanceView === 'student') {
      if (user.role === 'student') {
        fetchStudentLogs(user.userId);
      } else if (selectedAttendanceStudentId) {
        fetchStudentLogs(selectedAttendanceStudentId);
      } else {
        setStudentLogs([]);
      }
    }
  }, [selectedAttendanceStudentId, attendanceView, activeTab, user.role, user.userId]);

  const [papers, setPapers] = useState([]);
  const [schedules, setSchedules] = useState([]);

  const fetchPapers = async () => {
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/papers' : '/student/papers';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();

      const serverDateHeader = response.headers.get('Date');
      if (serverDateHeader) {
        window.serverTimeOffset = Date.now() - new Date(serverDateHeader).getTime();
      }

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

  const fetchExamSchedules = async () => {
    try {
      const endpoint = (user.role === 'admin' || user.role === 'staff') ? '/admin/exam-schedules' : '/student/exam-schedules';
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (response.ok) setExamSchedules(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateExamSchedule = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/admin/exam-schedules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: schedulerStudentId,
          type: schedulerType,
          date: schedulerDate,
          examName: schedulerExamName
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      alert(d.message || "Scheduled successfully!");
      setSchedulerStudentId("");
      setSchedulerType("Exam");
      setSchedulerDate("");
      setSchedulerExamName("");
      e.target.reset();
      fetchExamSchedules();
    } catch (err) {
      alert("Failed to schedule: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExamSchedule = async (id) => {
    if (!await showConfirm("Are you sure you want to delete this scheduled item?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/admin/exam-schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      alert(d.message || "Deleted successfully!");
      fetchExamSchedules();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExamSchedule = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`/admin/exam-schedules/${editingSchedule._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: editDate,
          examName: editExamName
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      alert(d.message || "Updated successfully!");
      setShowEditModal(false);
      setEditingSchedule(null);
      fetchExamSchedules();
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      if (isAdminOrStaff) {
        fetchStudentsData();
        fetchPapers();
      }
      if (user.role === 'student') {
        fetchPaymentConfig();
        fetchGoalConfig();
        fetchPapers();
        fetchSchedules();
        fetchExamSchedules();
      }
    }
    if ((activeTab === 'students' || activeTab === 'seats' || activeTab === 'fines' || activeTab === 'batches') && isAdminOrStaff) {
      fetchStudentsData();
      fetchBatches();
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
    if (activeTab === 'exam_scheduler' && isAdminOrStaff) {
      fetchExamSchedules();
      fetchStudentsData();
    }
    if (activeTab === 'payments' || activeTab === 'due_students') {
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
    if (activeTab === 'campus_qr' && isAdminOrStaff) {
      fetchCampusQR();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user.role !== 'student') return;

    const updateLiveHours = () => {
      if (!data) {
        setLiveStudyHours(0);
        return;
      }
      const todayLogs = data.todayLogs || [];
      if (todayLogs.length === 0) {
        setLiveStudyHours(0);
        return;
      }

      // Sort logs by timestamp/createdAt ascending to ensure correct order
      const sortedLogs = [...todayLogs].sort((a, b) => {
        const tA = new Date(a.timestamp || a.createdAt).getTime();
        const tB = new Date(b.timestamp || b.createdAt).getTime();
        return tA - tB;
      });

      let totalMs = 0;
      let lastInTime = null;

      sortedLogs.forEach(log => {
        const logTime = new Date(log.timestamp || log.createdAt).getTime();
        if (log.type === "IN") {
          if (lastInTime === null) {
            lastInTime = logTime;
          }
        } else if (log.type === "OUT") {
          if (lastInTime !== null) {
            totalMs += Math.max(0, logTime - lastInTime);
            lastInTime = null;
          }
        }
      });

      if (lastInTime !== null) {
        totalMs += Math.max(0, Date.now() - lastInTime);
      }

      setLiveStudyHours(Math.max(0, totalMs / 3600000));
    };

    updateLiveHours();
    const interval = setInterval(updateLiveHours, 1000);
    return () => clearInterval(interval);
  }, [user, data, goalConfig, goalConfigs]);

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
      if (res.ok) {
        setGoalConfig(result.active || { monday: 12, tuesday: 12, wednesday: 12, thursday: 12, friday: 12, saturday: 12, sunday: 0, autoLogoutTime: '22:00', autoLogoutEnabled: true });
        setGoalConfigs(result.configs || []);
      }
    } catch (err) {
      console.error("Fetch goal config error:", err);
    }
  };

  const getStaffNotifications = () => {
    const notifications = [];

    // Create a student map of userId -> name for fast lookup
    const studentMap = {};
    if (Array.isArray(students)) {
      students.forEach(s => {
        studentMap[s.userId] = s.name;
      });
    }

    // Check for student birthdays today
    if (Array.isArray(students)) {
      const today = new Date();
      const localMonth = today.getMonth();
      const localDay = today.getDate();

      students.forEach(student => {
        if (student.dob) {
          const dobDate = new Date(student.dob);
          if (!isNaN(dobDate.getTime())) {
            // Using getUTCMonth and getUTCDate to match the exact calendar date saved in the database
            if (dobDate.getUTCMonth() === localMonth && dobDate.getUTCDate() === localDay) {
              notifications.push({
                id: `birthday-${student.userId}`,
                type: 'birthday',
                icon: '🎂',
                message: `🎂 Birthday Today: Student ${student.name} (${student.userId}) has their birthday today!`,
                severity: 'info',
                rawTime: Date.now() // Sort at the top of the alerts list
              });
            }
          }
        }
      });
    }

    // Only Exams / Answer Sheet Uploads (within last 48 hours)
    if (Array.isArray(papers)) {
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
      papers.forEach(paper => {
        if (paper.answerUploadedAt) {
          const uploadTime = new Date(paper.answerUploadedAt).getTime();
          if (uploadTime >= fortyEightHoursAgo) {
            const studentName = studentMap[paper.target] || paper.target;
            const timeStr = new Date(paper.answerUploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = new Date(paper.answerUploadedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
            notifications.push({
              id: `paper-${paper._id}`,
              type: 'exam',
              icon: '📄',
              message: `Answer Sheet Uploaded: Student ${studentName} (${paper.target}) uploaded answer sheet for "${paper.title}" on ${dateStr} at ${timeStr}.`,
              severity: 'neutral',
              rawTime: uploadTime
            });
          }
        }
      });
    }

    // Sort notifications by time desc
    return notifications.sort((a, b) => b.rawTime - a.rawTime);
  };

  const getStudentNotifications = () => {
    const notifications = [];
    const today = new Date();
    const todayStr = getLocalDateString(today);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    // 1. Exam Notifications from Exam Schedules
    if (Array.isArray(examSchedules)) {
      examSchedules.forEach(item => {
        if (item.type === "Exam") {
          const examDateStr = getLocalDateString(new Date(item.date));
          if (examDateStr === todayStr) {
            notifications.push({
              id: `exam-today-${item._id}`,
              type: 'exam_today',
              icon: '🚨',
              message: `Exam Today: "${item.examName}" is scheduled for today!`,
              severity: 'warning',
              rawTime: new Date(item.date).getTime()
            });
          } else if (examDateStr === tomorrowStr) {
            notifications.push({
              id: `exam-tomorrow-${item._id}`,
              type: 'exam_tomorrow',
              icon: '⏳',
              message: `Exam Tomorrow: "${item.examName}" is scheduled for tomorrow (${examDateStr}).`,
              severity: 'info',
              rawTime: new Date(item.date).getTime()
            });
          }
        }
      });
    }

    // 2. Question Paper Upload Notifications (within last 48 hours)
    if (Array.isArray(papers)) {
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
      papers.forEach(paper => {
        const uploadTime = new Date(paper.createdAt).getTime();
        if (uploadTime >= fortyEightHoursAgo) {
          const dateStr = new Date(paper.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
          const timeStr = new Date(paper.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          notifications.push({
            id: `qp-upload-${paper._id}`,
            type: 'qp_upload',
            icon: '📄',
            message: `New Question Paper Uploaded: Admin uploaded "${paper.title}" on ${dateStr} at ${timeStr}.`,
            severity: 'success',
            rawTime: uploadTime
          });
        }
      });
    }

    // 3. Schedule Upload Notifications (within last 48 hours)
    if (Array.isArray(schedules)) {
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
      schedules.forEach(sch => {
        const uploadTime = new Date(sch.createdAt).getTime();
        if (uploadTime >= fortyEightHoursAgo) {
          const dateStr = new Date(sch.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
          const timeStr = new Date(sch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          notifications.push({
            id: `sch-upload-${sch._id}`,
            type: 'sch_upload',
            icon: '🗓️',
            message: `New Schedule Uploaded: Admin uploaded study schedule "${sch.title}" on ${dateStr} at ${timeStr}.`,
            severity: 'success',
            rawTime: uploadTime
          });
        }
      });
    }

    // 4. Unpaid Fines Notifications
    if (data?.fines && Array.isArray(data.fines)) {
      data.fines.forEach((fine, index) => {
        if (fine.status !== 'Paid') {
          notifications.push({
            id: `fine-${fine._id || index}`,
            type: 'fine_unpaid',
            icon: '💸',
            message: `Fine Pending: A fine of ₹${fine.amount} for "${fine.reason === 'Over Leaves' ? 'Excess Leaves' : fine.reason}" is recorded on your account.`,
            severity: 'warning',
            rawTime: new Date(fine.date || fine.startDate || today).getTime()
          });
        }
      });
    }

    return notifications.sort((a, b) => b.rawTime - a.rawTime);
  };

  const fetchCampusQR = async () => {
    try {
      const res = await fetch('/admin/campus-qr', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCampusQRConfig(data);
    } catch (err) {
      console.error('Error fetching QR config:', err.message);
    }
  };

  const refreshCampusQR = async (type) => {
    try {
      const res = await fetch('/admin/campus-qr/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCampusQRConfig(data);
    } catch (err) {
      console.error('Error refreshing QR code:', err.message);
    }
  };

  useEffect(() => {
    if (activeTab !== 'campus_qr' || !autoRotate || user.role !== 'admin') return;

    const interval = setInterval(() => {
      refreshCampusQR('IN');
      refreshCampusQR('OUT');
    }, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, [activeTab, autoRotate, user]);

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

  const formatLiveStudyTime = (hrs) => {
    if (!hrs || hrs === 0) return '0h 0m 0s';
    const totalSecs = Math.round(parseFloat(hrs) * 3600);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}h ${m}m ${s}s`;
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

  const getCurrentAttendanceMonthStart = (joiningDateStr, today = new Date()) => {
    if (!joiningDateStr) {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const jDate = new Date(joiningDateStr);
    if (isNaN(jDate.getTime())) {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
    jDate.setHours(0, 0, 0, 0);
    const joinDay = jDate.getDate();

    let startYear = today.getFullYear();
    let startMonth = today.getMonth();

    let candidate = new Date(startYear, startMonth, joinDay);
    candidate.setHours(0, 0, 0, 0);

    if (candidate.getMonth() !== startMonth) {
      candidate = new Date(startYear, startMonth + 1, 0);
      candidate.setHours(0, 0, 0, 0);
    }

    if (candidate > today) {
      startMonth -= 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
      candidate = new Date(startYear, startMonth, joinDay);
      candidate.setHours(0, 0, 0, 0);
      if (candidate.getMonth() !== startMonth) {
        candidate = new Date(startYear, startMonth + 1, 0);
        candidate.setHours(0, 0, 0, 0);
      }
    }

    if (candidate < jDate) {
      return new Date(jDate);
    }

    return candidate;
  };

  const getStudentMonthDays = (joiningDateStr) => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfPeriod = getCurrentAttendanceMonthStart(joiningDateStr, today);

    let temp = new Date(startOfPeriod);
    while (temp <= today) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const resolveGoalForStudentOnDate = (studentId, dateStr) => {
    if (!Array.isArray(goalConfigs) || goalConfigs.length === 0) {
      return goalConfig;
    }

    const cleanStudentId = studentId ? studentId.trim().toUpperCase() : null;

    if (cleanStudentId) {
      const studentConfs = goalConfigs.filter(c => c.studentId === cleanStudentId);
      if (studentConfs.length > 0) {
        const sorted = [...studentConfs].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        const customMatch = sorted.find(c => c.effectiveFrom <= dateStr);
        if (customMatch) return customMatch;
      }
    }

    const defaultConfs = goalConfigs.filter(c => !c.studentId);
    if (defaultConfs.length > 0) {
      const sorted = [...defaultConfs].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      const defaultMatch = sorted.find(c => c.effectiveFrom <= dateStr);
      if (defaultMatch) return defaultMatch;
      return sorted[sorted.length - 1];
    }

    return goalConfig || { monday: 12, tuesday: 12, wednesday: 12, thursday: 12, friday: 12, saturday: 12, sunday: 0 };
  };

  const calculateStudentStatsForId = (studentId, joiningDateStr) => {
    const stats = {
      todayHours: 0,
      weekHours: 0,
      monthHours: 0,
      weekAbsentCount: 0,
      monthAbsentCount: 0,
      lowHoursWeek: [],
      lowHoursMonth: [],
    };

    let studentLogs = [];
    if (Array.isArray(data)) {
      studentLogs = data.filter(item => item.studentId === studentId);
    } else if (data && data.studentId === studentId) {
      studentLogs = data.attendanceSummary || [];
    } else if (data && user.userId === studentId) {
      studentLogs = data.attendanceSummary || [];
    }

    const todayStr = formatLocalDate(new Date());

    const summaryMap = {};
    studentLogs.forEach(item => {
      summaryMap[item.date] = item;
    });

    if (summaryMap[todayStr]) {
      stats.todayHours = parseFloat(summaryMap[todayStr].totalHours || 0);
    }

    const joiningDate = joiningDateStr ? new Date(joiningDateStr) : null;
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
      const resolvedConfig = resolveGoalForStudentOnDate(studentId, dateStr);
      const targetHours = resolvedConfig[dayKey] !== undefined ? parseFloat(resolvedConfig[dayKey]) : 12;

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

    const monthDays = getStudentMonthDays(joiningDateStr);
    monthDays.forEach(day => {
      const dateStr = formatLocalDate(day);
      if (joiningDate && day < joiningDate) return;

      const log = summaryMap[dateStr];
      const dayKey = dayKeys[day.getDay()];
      const resolvedConfig = resolveGoalForStudentOnDate(studentId, dateStr);
      const targetHours = resolvedConfig[dayKey] !== undefined ? parseFloat(resolvedConfig[dayKey]) : 12;

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

  const calculateStudentStats = () => {
    return calculateStudentStatsForId(user.userId, data?.joiningDate);
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
          totalAbsent: 0,
          presentDates: [],
          totalHours: 0,
          lateCount: 0
        };
      });
    }

    toProcess.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;

      const studentInfo = Array.isArray(students) ? students.find(s => s.userId === item.studentId) : null;
      const joiningDateStr = studentInfo?.joiningDate || (item.studentId === user.userId ? data?.joiningDate : null);
      if (joiningDateStr) {
        const jDate = new Date(joiningDateStr);
        jDate.setHours(0, 0, 0, 0);
        if (d < jDate) return;
      }

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
      } else if (attendanceView === 'range') {
        const start = attendanceStartDate ? new Date(attendanceStartDate) : null;
        const end = attendanceEndDate ? new Date(attendanceEndDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        const dMidnight = new Date(d);
        dMidnight.setHours(0, 0, 0, 0);

        if ((!start || dMidnight >= start) && (!end || dMidnight <= end)) {
          keyToMatch = true;
        }
      }

      if (keyToMatch) {
        if (!aggregatedMap[item.studentId]) {
          aggregatedMap[item.studentId] = {
            studentId: item.studentId,
            studentName: item.studentName || studentMap[item.studentId] || 'Unknown Student',
            course: item.course,
            totalPresent: 0,
            totalAbsent: 0,
            presentDates: [],
            totalHours: 0,
            lateCount: 0
          };
        }
        if (aggregatedMap[item.studentId].lateCount === undefined) {
          aggregatedMap[item.studentId].lateCount = 0;
        }

        let isLate = false;
        if (item.firstIn) {
          const firstInDate = new Date(item.firstIn);
          if (!isNaN(firstInDate.getTime())) {
            const hours = firstInDate.getHours();
            const minutes = firstInDate.getMinutes();
            if (hours > 8 || (hours === 8 && minutes > 30)) {
              isLate = true;
            }
          }
        }

        if (item.status === 'Present') {
          aggregatedMap[item.studentId].totalPresent++;
          if (isLate) {
            aggregatedMap[item.studentId].lateCount++;
          }
        }
        else aggregatedMap[item.studentId].totalAbsent++;

        aggregatedMap[item.studentId].totalHours += parseFloat(item.totalHours || 0);

        if (item.status === 'Present') {
          aggregatedMap[item.studentId].presentDates.push(item.date);
        }
      }
    });

    return Object.values(aggregatedMap).map(record => {
      let expectedDays = 0;
      const today = getSyncedNow();
      today.setHours(0, 0, 0, 0);

      const studentInfo = Array.isArray(students) ? students.find(s => s.userId === record.studentId) : null;
      const joiningDateStr = studentInfo?.joiningDate || (record.studentId === user.userId ? data?.joiningDate : null);
      let jDate = null;
      if (joiningDateStr) {
        jDate = new Date(joiningDateStr);
        jDate.setHours(0, 0, 0, 0);
      }

      if (attendanceView === 'weekly') {
        const targetDate = new Date(attendanceDate);
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(0, 0, 0, 0);

        const activeStart = jDate && jDate > startOfWeek ? jDate : startOfWeek;
        const activeEnd = today < endOfWeek ? today : endOfWeek;

        if (activeStart > activeEnd) {
          expectedDays = 0;
        } else {
          expectedDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
      } else if (attendanceView === 'monthly') {
        const [year, month] = attendanceDate.split('-');
        const y = parseInt(year);
        const m = parseInt(month) - 1;

        const startOfMonth = new Date(y, m, 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(y, m + 1, 0);
        endOfMonth.setHours(0, 0, 0, 0);

        const activeStart = jDate && jDate > startOfMonth ? jDate : startOfMonth;
        const activeEnd = today < endOfMonth ? today : endOfMonth;

        if (activeStart > activeEnd) {
          expectedDays = 0;
        } else {
          expectedDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
      }

      if (attendanceView === 'range') {
        const start = attendanceStartDate ? new Date(attendanceStartDate) : new Date();
        const end = attendanceEndDate ? new Date(attendanceEndDate) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const activeStart = jDate && jDate > start ? jDate : start;
        const activeEnd = today < end ? today : end;

        if (activeStart > activeEnd) {
          expectedDays = 0;
        } else {
          expectedDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
      }

      if (expectedDays > 0) {
        record.totalAbsent = Math.max(0, expectedDays - record.totalPresent);
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

    const todayStr = getLocalDateString(getSyncedNow());

    let exportData = [];
    if (attendanceView === 'daily') {
      exportData = aggregatedData.map(record => {
        const studentInfo = Array.isArray(students) ? students.find(s => s.userId === record.studentId) : null;
        const joiningDateStr = studentInfo?.joiningDate || (record.studentId === user.userId ? data?.joiningDate : null);
        const studyMode = studentInfo?.mode || (record.studentId === user.userId ? data?.mode : null);
        const formattedStudyMode = studyMode ? studyMode.charAt(0).toUpperCase() + studyMode.slice(1) : "-";
        return {
          "Student Name": record.studentName || record.studentId || "-",
          "Course": record.course || "-",
          "Study Mode": formattedStudyMode,
          "DOJ": joiningDateStr ? new Date(joiningDateStr).toLocaleDateString() : "-",
          "Status": record.status,
          "First Log In Time": record.firstIn ? new Date(record.firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
          "Total Hours": formatStudyTime(record.totalHours),
          "Date": record.date
        };
      });
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
          const dateStr = d.toISOString().split('T')[0];
          if (dateStr <= todayStr) {
            dateList.push(dateStr);
          }
        }
      } else if (attendanceView === 'monthly') {
        const [year, month] = attendanceDate.split('-');
        const y = parseInt(year);
        const m = parseInt(month) - 1;
        const numDays = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= numDays; i++) {
          const dayStr = String(i).padStart(2, '0');
          const monthStr = String(m + 1).padStart(2, '0');
          const dateStr = `${y}-${monthStr}-${dayStr}`;
          if (dateStr <= todayStr) {
            dateList.push(dateStr);
          }
        }
      } else if (attendanceView === 'range') {
        const start = attendanceStartDate ? new Date(attendanceStartDate) : getSyncedNow();
        const end = attendanceEndDate ? new Date(attendanceEndDate) : getSyncedNow();

        let curr = new Date(start);
        while (curr <= end) {
          const dateStr = curr.toISOString().split('T')[0];
          if (dateStr <= todayStr) {
            dateList.push(dateStr);
          }
          curr.setDate(curr.getDate() + 1);
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
        const studentInfo = Array.isArray(students) ? students.find(s => s.userId === record.studentId) : null;
        const joiningDateStr = studentInfo?.joiningDate || (record.studentId === user.userId ? data?.joiningDate : null);
        const studyMode = studentInfo?.mode || (record.studentId === user.userId ? data?.mode : null);
        const formattedStudyMode = studyMode ? studyMode.charAt(0).toUpperCase() + studyMode.slice(1) : "-";

        const row = {
          "Student Name": record.studentName || record.studentId || "-",
          "Course": record.course || "-",
          "Study Mode": formattedStudyMode,
          "DOJ": joiningDateStr ? new Date(joiningDateStr).toLocaleDateString() : "-",
          "Total Present": record.totalPresent,
          "Total Absent (Leaves)": record.totalAbsent,
        };

        if (attendanceView === 'weekly' || attendanceView === 'monthly' || attendanceView === 'range') {
          row["Late Logins"] = record.lateCount || 0;
        }

        row["Total Study Hours"] = formatStudyTime(record.totalHours);

        // Add dynamically generated date columns chronologically
        dateList.forEach(dateStr => {
          let isBeforeJoining = false;
          if (joiningDateStr) {
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            const jDate = new Date(joiningDateStr);
            jDate.setHours(0, 0, 0, 0);
            if (d < jDate) {
              isBeforeJoining = true;
            }
          }

          const logsForDate = studentDateLogs[record.studentId] || {};
          const log = logsForDate[dateStr];

          if (isBeforeJoining) {
            row[dateStr] = ""; // Keep as blank
          } else if (log && log.status === 'Present') {
            row[dateStr] = `Present (${formatStudyTime(log.totalHours)})`;
          } else {
            row[dateStr] = "Absent";
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
    const targetStudents = studentSearch.trim() ? filteredStudents : students;

    if (!Array.isArray(targetStudents) || targetStudents.length === 0) {
      alert("No students data available to export.");
      return;
    }

    const isStaff = user.role === 'staff';

    const safeFormatDate = (dateVal) => {
      if (!dateVal) return "-";
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
    };

    const exportData = targetStudents.map(student => {
      const row = {
        "Student Name": student.name || "-",
        "Student ID": student.userId || "-",
        "Email": student.email || "-",
        "Phone": student.phone || "-",
        "Course": student.course || "-",
        "Mode": student.mode || "-",
        "Batch": student.batch || "-",
        "Joining Date": safeFormatDate(student.joiningDate),
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

        // Build linkage map for this student
        const sortedInsts = Array.isArray(student.installments)
          ? [...student.installments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          : [];

        const validPayments = (student.feeHistory || [])
          .filter(p => p.status === 'Verified' || p.status === 'Paid' || p.status === 'Received')
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const instPayments = {};

        // 1. Explicitly linked payments
        validPayments.forEach(p => {
          if (p.installmentNumber && p.installmentNumber > 0) {
            const idx = p.installmentNumber - 1;
            if (!instPayments[idx]) {
              instPayments[idx] = [];
            }
            instPayments[idx].push(p);
          }
        });

        // 2. Unlinked payments allocation
        const unlinkedPayments = validPayments.filter(p => !p.installmentNumber || p.installmentNumber <= 0);
        const sumInstallments = sortedInsts.reduce((sum, inst) => sum + inst.amount, 0);
        const implicitInitialFee = Math.max(0, (student.totalFees || 0) - sumInstallments);

        let remainingPaid = Math.max(0, unlinkedPayments.reduce((sum, p) => sum + p.amount, 0) - implicitInitialFee);

        sortedInsts.forEach((inst, idx) => {
          if (instPayments[idx] && instPayments[idx].length > 0) {
            return;
          }
          if (remainingPaid <= 0) {
            return;
          }

          let cumulativeUnlinked = 0;
          let payingPayment = null;
          for (const p of unlinkedPayments) {
            cumulativeUnlinked += p.amount;
            if (cumulativeUnlinked >= implicitInitialFee) {
              payingPayment = p;
            }
          }

          if (remainingPaid >= inst.amount) {
            instPayments[idx] = payingPayment ? [payingPayment] : [];
            remainingPaid -= inst.amount;
          } else {
            instPayments[idx] = payingPayment ? [payingPayment] : [];
            remainingPaid = 0;
          }
        });

        for (let i = 0; i < maxInstallments; i++) {
          const inst = sortedInsts[i] || null;
          const pays = instPayments[i] || [];

          row[`Inst ${i + 1} Amount (₹)`] = inst ? inst.amount : "-";
          row[`Inst ${i + 1} Status`] = inst ? inst.status : "-";
          row[`Inst ${i + 1} Due Date`] = inst && inst.dueDate ? safeFormatDate(inst.dueDate) : "-";
          
          if (pays.length > 0) {
            row[`Inst ${i + 1} Paid Amount (₹)`] = pays.reduce((sum, p) => sum + p.amount, 0);
            row[`Inst ${i + 1} Payment Date`] = safeFormatDate(pays[pays.length - 1].date);
            row[`Inst ${i + 1} Receipt`] = pays.map(p => p.receiptNo || "Self-Reported").join(", ");
          } else {
            row[`Inst ${i + 1} Paid Amount (₹)`] = "-";
            row[`Inst ${i + 1} Payment Date`] = inst && inst.status === 'Paid' && inst.paidDate ? safeFormatDate(inst.paidDate) : "-";
            row[`Inst ${i + 1} Receipt`] = "-";
          }
        }
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const sheetName = isStaff ? "Students" : "Fee Ledger";
    const fileName = isStaff ? `Students_List_${getLocalDateString()}.xlsx` : `Student_Fee_Ledger_${getLocalDateString()}.xlsx`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  };

  const handleExportStudentInfo = () => {
    if (!Array.isArray(students) || students.length === 0) {
      alert("No students data available to export.");
      return;
    }

    const safeFormatDate = (dateVal) => {
      if (!dateVal) return "-";
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
    };

    const exportData = students.map(student => ({
      "Student ID": student.userId || "-",
      "Student Name": student.name || "-",
      "Email": student.email || "-",
      "Phone": student.phone || "-",
      "Date of Birth": student.dob ? safeFormatDate(student.dob) : "-",
      "Age": student.age || "-",
      "Aadhar Number": student.aadharNumber || "-",
      "Course": student.course || "-",
      "Mode": student.mode || "-",
      "Seat Number": student.seatNumber || "-",
      "Batch": student.batch || "-",
      "Group": student.group || "-",
      "Joining Date": student.joiningDate ? safeFormatDate(student.joiningDate) : "-",
      "Father's Name": student.fatherName || "-",
      "Father's Phone": student.fatherPhone || "-",
      "Father's Occupation": student.fatherOccupation || "-",
      "Mother's Name": student.motherName || "-",
      "Mother's Phone": student.motherPhone || "-",
      "Mother's Occupation": student.motherOccupation || "-",
      "Profile Completed": student.profileCompleted ? "Yes" : "No"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Info");
    XLSX.writeFile(workbook, `Student_Info_${getLocalDateString()}.xlsx`);
  };

  const handleExportDueStudents = (itemsToExport) => {
    if (!Array.isArray(itemsToExport) || itemsToExport.length === 0) {
      alert("No due fee records match the current filters to export.");
      return;
    }

    const isStaff = user.role === 'staff';

    const exportData = itemsToExport.map(item => {
      const daysText = item.dueStatus === 'due_today'
        ? 'Today'
        : item.dueStatus === 'overdue'
          ? `${Math.abs(item.daysDiff)} days overdue`
          : `${item.daysDiff} days remaining`;

      const row = {
        "Student ID": item.studentId || "-",
        "Student Name": item.studentName || "-",
        "Email": item.email || "-",
        "Phone": item.phone || "-",
        "Course": item.course || "-",
        "Batch": item.batch || "-",
        "Installment": item.installmentIndex === -1 ? "Pending Balance" : `Installment ${item.installmentIndex + 1}`,
        "Due Date": item.dueDateStr || "-",
        "Due Status": item.dueStatusLabel,
        "Timeline": daysText,
      };

      // Only show amount columns if user is admin
      if (!isStaff) {
        row["Original Amount (₹)"] = item.originalAmount || 0;
        row["Adjusted Amount Due (₹)"] = item.installmentAmount || 0;
        row["Remaining Student Balance (₹)"] = item.remainingBalance || 0;
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Due Students");
    XLSX.writeFile(workbook, `Due_Students_${dueFilterType}_${getLocalDateString()}.xlsx`);
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
    if (!await showConfirm(`Are you sure you want to delete student ${studentId}?`)) return;
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
    if (!await showConfirm(`Reset password for student ${studentId}?`)) return;
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

  const handleResetDevice = async (studentId) => {
    if (!await showConfirm(`Reset device lock for student ${studentId}?`)) return;
    try {
      const response = await fetch(`/admin/student/${studentId}/reset-device`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert(result.message);
      fetchStudentsData();
      if (viewingProfileStudent && viewingProfileStudent.userId === studentId) {
        setViewingProfileStudent({ ...viewingProfileStudent, deviceFingerprint: null });
      }
    } catch (err) {
      alert("Error resetting device lock: " + err.message);
    }
  };

  const handleAllocateSeat = async (studentId, seatNumber) => {
    try {
      setLoading(true);
      const res = await fetch(`/admin/student/${studentId}/profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ seatNumber })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || 'Failed to allot seat');
      alert(seatNumber ? `Seat ${seatNumber} allotted successfully!` : 'Seat unallotted successfully!');
      fetchStudentsData();
    } catch (err) {
      alert('Allocation failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableSeatsForStudent = (currentSeat, allStudents) => {
    const occupiedSeats = allStudents
      .filter(s => s.seatNumber && s.seatNumber !== currentSeat)
      .map(s => s.seatNumber);
    return ALL_SEATS.filter(seat => !occupiedSeats.includes(seat));
  };

  const residentialStudents = Array.isArray(students) ? students.filter(s => s.mode === 'residential') : [];
  const totalAllotted = residentialStudents.filter(s => s.seatNumber).length;
  const remainingSeats = ALL_SEATS.length - totalAllotted;

  const classroomAAllotted = residentialStudents.filter(s => s.seatNumber && s.seatNumber.startsWith('A')).length;
  const classroomBAllotted = residentialStudents.filter(s => s.seatNumber && s.seatNumber.startsWith('B')).length;
  const classroomCAllotted = residentialStudents.filter(s => s.seatNumber && s.seatNumber.startsWith('C')).length;

  const filteredResidentialStudents = residentialStudents.filter(student => {
    const query = seatSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (student.name && student.name.toLowerCase().includes(query)) ||
      (student.userId && student.userId.toLowerCase().includes(query)) ||
      (student.email && student.email.toLowerCase().includes(query)) ||
      (student.course && student.course.toLowerCase().includes(query)) ||
      (student.batch && student.batch.toLowerCase().includes(query)) ||
      (student.seatNumber && student.seatNumber.toLowerCase().includes(query))
    );
  });

  const filteredStudents = Array.isArray(students)
    ? students.filter(student => {
        const query = studentSearch.toLowerCase().trim();
        const matchesQuery = !query || (
          (student.name && student.name.toLowerCase().includes(query)) ||
          (student.userId && student.userId.toLowerCase().includes(query)) ||
          (student.email && student.email.toLowerCase().includes(query)) ||
          (student.course && student.course.toLowerCase().includes(query)) ||
          (student.batch && student.batch.toLowerCase().includes(query))
        );

        if (!matchesQuery) return false;

        if (paymentFilter === 'paid') {
          return (student.totalFees || 0) > 0 && (student.feesPaid || 0) >= (student.totalFees || 0);
        }
        if (paymentFilter === 'unpaid') {
          return ((student.totalFees || 0) - (student.feesPaid || 0)) > 0;
        }

        return true;
      })
    : [];

  return (
    <div className="app-container">
      {/* Aesthetic Sparkles */}
      <div className="sparkle" style={{ top: '15%', left: '10%', animationDelay: '0.2s' }}></div>
      <div className="sparkle" style={{ top: '65%', left: '5%', animationDelay: '1.7s' }}></div>
      <div className="sparkle" style={{ top: '25%', right: '10%', animationDelay: '0.8s' }}></div>
      <div className="sparkle" style={{ top: '80%', right: '8%', animationDelay: '2.5s' }}></div>

      {/* Main Content */}
      <main className="main-content">
        {localStorage.getItem('cmDemoMode') === 'true' && (
          <div style={{
            background: 'linear-gradient(90deg, #3b82f6, #10b981)',
            color: 'white',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            borderRadius: '12px',
            margin: '0 0 1.5rem 0',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <span>✨ <strong>Demo Mode Active:</strong> Showing rich, realistic mock data for preview.</span>
            <button 
              onClick={() => {
                localStorage.removeItem('cmDemoMode');
                localStorage.removeItem('cmUser');
                window.location.href = '/';
              }} 
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                padding: '2px 8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              Exit Demo
            </button>
          </div>
        )}
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Navigation Menu (Three Bars Hamburger) */}
            <div className="header-nav-menu-container" style={{ position: 'relative' }}>
              <button
                className={`three-bars-btn ${showNavDropdown ? 'open' : ''}`}
                onClick={() => setShowNavDropdown(!showNavDropdown)}
                title="Navigation Menu"
                aria-label="Navigation Menu"
                style={{ position: 'relative', zIndex: 1000 }}
              >
                <div className="bar-line"></div>
                <div className="bar-line"></div>
                <div className="bar-line"></div>
              </button>
              {showNavDropdown && (
                <>
                  <div
                    className="nav-dropdown-backdrop"
                    onClick={() => setShowNavDropdown(false)}
                  />
                  <div className="nav-dropdown-menu">
                    <div className="mobile-drag-handle" />
                    <div className="nav-dropdown-header">Navigation</div>
                    <ul className="nav-dropdown-list">
                      <li
                        className={`nav-dropdown-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => {
                          setShowNavDropdown(false);
                          if (user.role === 'student' && data && !data.profileCompleted) {
                            alert('Please complete your profile details first to unlock all dashboard features.');
                            return;
                          }
                          setActiveTab('dashboard');
                        }}
                      >
                        <span>📊</span> Dashboard
                      </li>
                      {(user.role === 'admin' || user.role === 'staff') ? (
                        <>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('profile');
                            }}
                          >
                            <span>👤</span> Profile
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'students' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('students');
                            }}
                          >
                            <span>🎓</span> Students
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'seats' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('seats');
                            }}
                          >
                            <span>🪑</span> Seats
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'attendance' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('attendance');
                            }}
                          >
                            <span>📅</span> Attendance
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'papers' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('papers');
                            }}
                          >
                            <span>📄</span> Question Papers
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'schedules' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('schedules');
                            }}
                          >
                            <span>🗓️</span> Schedules
                          </li>
                          <li
                             className={`nav-dropdown-item ${activeTab === 'exam_scheduler' ? 'active' : ''}`}
                             onClick={() => {
                               setShowNavDropdown(false);
                               setActiveTab('exam_scheduler');
                             }}
                           >
                             <span>📅</span> Exam Scheduler
                           </li>
                           <li
                             className={`nav-dropdown-item ${activeTab === 'due_students' ? 'active' : ''}`}
                             onClick={() => {
                               setShowNavDropdown(false);
                               setActiveTab('due_students');
                             }}
                           >
                             <span>⏳</span> Due Students
                           </li>
                           <li
                             className={`nav-dropdown-item ${activeTab === 'fines' ? 'active' : ''}`}
                             onClick={() => {
                               setShowNavDropdown(false);
                               setActiveTab('fines');
                             }}
                           >
                             <span>💸</span> Fines
                           </li>
                           <li
                             className={`nav-dropdown-item ${activeTab === 'batches' ? 'active' : ''}`}
                             onClick={() => {
                               setShowNavDropdown(false);
                               setActiveTab('batches');
                             }}
                           >
                             <span>📦</span> Batches
                           </li>
                          {user.role === 'admin' && (
                            <>
                              <li
                                className={`nav-dropdown-item ${activeTab === 'payments' ? 'active' : ''}`}
                                onClick={() => {
                                  setShowNavDropdown(false);
                                  setActiveTab('payments');
                                }}
                              >
                                <span>💳</span> Payments
                              </li>
                              <li
                                className={`nav-dropdown-item ${activeTab === 'campus_qr' ? 'active' : ''}`}
                                onClick={() => {
                                  setShowNavDropdown(false);
                                  setActiveTab('campus_qr');
                                }}
                              >
                                <span>🔲</span> Campus QR
                              </li>
                              <li
                                className={`nav-dropdown-item ${activeTab === 'goal_settings' ? 'active' : ''}`}
                                onClick={() => {
                                  setShowNavDropdown(false);
                                  setActiveTab('goal_settings');
                                }}
                              >
                                <span>🎯</span> Goal Settings
                              </li>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'attendance' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('attendance');
                            }}
                          >
                            <span>📅</span> Attendance Records
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'papers' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('papers');
                            }}
                          >
                            <span>📄</span> Question Papers
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'schedules' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('schedules');
                            }}
                          >
                            <span>🗓️</span> My Schedule
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'payments' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('payments');
                            }}
                          >
                            <span>💳</span> Payments
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'fines' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('fines');
                            }}
                          >
                            <span>💸</span> Fines
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'study_tracker' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('study_tracker');
                            }}
                          >
                            <span>⏱️</span> Study Goal Tracker
                          </li>
                          <li
                            className={`nav-dropdown-item ${activeTab === 'notifications' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              if (data && !data.profileCompleted) {
                                alert('Please complete your profile details first to unlock all dashboard features.');
                                return;
                              }
                              setActiveTab('notifications');
                            }}
                          >
                            <span>🕒</span> Check-In Options
                          </li>
                          {data?.mode !== 'online' && (
                            <li
                              className={`nav-dropdown-item ${activeTab === 'scan_qr' ? 'active' : ''}`}
                              onClick={() => {
                                setShowNavDropdown(false);
                                if (data && !data.profileCompleted) {
                                  alert('Please complete your profile details first to unlock all dashboard features.');
                                  return;
                                }
                                setActiveTab('scan_qr');
                              }}
                            >
                              <span>📷</span> Scan QR Code
                            </li>
                          )}
                          <li
                            className={`nav-dropdown-item ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => {
                              setShowNavDropdown(false);
                              setActiveTab('profile');
                            }}
                          >
                            <span>👤</span> Profile
                          </li>
                        </>
                      )}

                      {/* Divider */}
                      <li style={{ height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.08)', margin: '0.25rem 0' }} />

                       {/* Logout Button */}
                       <li 
                         className="nav-dropdown-item danger" 
                         onClick={() => {
                          setShowNavDropdown(false);
                          onLogout();
                        }}
                      >
                        <span>🚪</span> Logout
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="welcome-text">
              <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: '600', color: 'var(--text-main)' }}>
                {activeTab === 'dashboard' ? `Welcome back, ${user.name} 👋`
                  : activeTab === 'students' ? 'Manage Students'
                  : activeTab === 'attendance' ? 'Attendance Records'
                  : activeTab === 'profile' ? 'My Profile'
                  : activeTab === 'papers' ? 'Question Papers'
                  : activeTab === 'schedules' ? ((user.role === 'admin' || user.role === 'staff') ? 'Student Schedules' : 'My Study Schedule')
                  : activeTab === 'payments' ? (user.role === 'admin' ? 'Fee Ledger' : 'My Payments')
                  : activeTab === 'due_students' ? 'Due Students'
                  : activeTab === 'feeSetup' && feeSetupStudent ? `Fee Structure: ${feeSetupStudent.name}`
                  : activeTab === 'study_tracker' ? 'Study Goal Tracker'
                  : activeTab === 'goal_settings' ? 'Study Goal Settings'
                  : activeTab === 'seats' ? 'Seats Allocation'
                  : activeTab === 'fines' ? ((user.role === 'admin' || user.role === 'staff') ? 'Student Fine Management' : 'My Fines')
                  : activeTab === 'exam_scheduler' ? 'Exam Scheduler'
                  : activeTab === 'notifications' ? ((user.role === 'admin' || user.role === 'staff') ? 'Staff Alerts & Notifications' : 'Check-In & Check-Out')
                  : activeTab === 'scan_qr' ? 'Scan Attendance QR Code'
                  : 'Campus QR'}
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                {activeTab === 'dashboard' ? `Role: ${user.role === 'admin' ? 'Administrator' : user.role === 'staff' ? 'Staff' : 'Student (ID: ' + user.userId + ')' }`
                  : activeTab === 'students' ? 'Add new students or remove existing ones from the system.'
                  : activeTab === 'attendance' ? 'View and track your attendance logs.'
                  : activeTab === 'profile' ? 'Update your personal details and photo.'
                  : activeTab === 'papers' ? 'Manage and download scheduled question papers.'
                  : activeTab === 'schedules' ? ((user.role === 'admin' || user.role === 'staff') ? 'Create and manage study plans, classes, and tests for students.' : 'Track your study checklist, scheduled classes, and exams.')
                  : activeTab === 'payments' ? 'View fee payment history and balances.'
                  : activeTab === 'due_students' ? 'View students whose fees are due today, overdue, or upcoming.'
                  : activeTab === 'feeSetup' ? 'Configure total fees and next due date.'
                  : activeTab === 'study_tracker' ? 'Track days where you studied less than your configured daily target hours.'
                  : activeTab === 'goal_settings' ? 'Configure the mandatory study hours for each day of the week.'
                  : activeTab === 'seats' ? 'Allot and manage classroom seat allocations for residential students.'
                  : activeTab === 'fines' ? ((user.role === 'admin' || user.role === 'staff') ? 'Apply and manage fines issued to students.' : 'View your fine history and mark payments as done.')
                  : activeTab === 'exam_scheduler' ? 'Manually schedule exam dates and study schedule ending dates for students.'
                  : activeTab === 'notifications' ? ((user.role === 'admin' || user.role === 'staff') ? 'View warnings and notifications.' : 'Perform manual check-in or scan campus QR code to log your attendance.')
                  : activeTab === 'scan_qr' ? 'Scan the dynamic class QR code to mark your check-in or check-out.'
                  : 'Display the active QR code for students to scan.'}
              </p>
            </div>
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div 
              className="header-logo" 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setActiveTab('dashboard')}
              title="Go to Dashboard"
            >
              <img 
                src="/logo.png" 
                alt="Chartered Mentor Logo" 
                className="header-logo-img"
                style={{ 
                  width: 'auto', 
                  filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.12))',
                  transition: 'transform 0.3s ease, filter 0.3s ease'
                }} 
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.07)';
                  e.currentTarget.style.filter = 'drop-shadow(0 8px 20px rgba(0,0,0,0.18))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.filter = 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.12))';
                }}
              />
            </div>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--glass-border)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                boxShadow: '0 4px 15px var(--shadow-color)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                outline: 'none',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(99, 102, 241, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                e.currentTarget.style.boxShadow = '0 4px 15px var(--shadow-color)';
              }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

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
              const resolvedConfig = resolveGoalForStudentOnDate(user.userId, formatLocalDate(new Date()));
              const todayTarget = resolvedConfig[todayKey] !== undefined ? resolvedConfig[todayKey] : 12;

              const todayLogs = data?.todayLogs || [];
              const lastLog = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null;
              const isCurrentlyCheckedIn = lastLog && lastLog.type === 'IN';
              const unpaidFinesList = (data?.fines || []).filter(f => !f.status || f.status === 'Unpaid');

              return (
                <>
                  {unpaidFinesList.length > 0 && (
                    <div className="card" style={{
                      marginBottom: '2rem',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.08) 100%)',
                      border: '1px solid #ef4444',
                      borderRadius: '16px',
                      padding: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h3 style={{ color: '#ef4444', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            ⚠️ Fine Notice ({unpaidFinesList.length})
                          </h3>
                          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginTop: '0.4rem', marginBottom: 0 }}>
                            You have fine(s) recorded on your account. Please contact administration for details.
                          </p>
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ef4444' }}>
                          Total: ₹{unpaidFinesList.reduce((sum, f) => sum + (f.amount || 0), 0)}
                        </div>
                      </div>
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {unpaidFinesList.map((fine, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            background: 'var(--surface-color)',
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            fontSize: '0.9rem'
                          }}>
                            <span>
                              <strong>{fine.reason === 'Over Leaves' ? 'Excess Leaves' : fine.reason}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                                ({fine.startDate && fine.endDate && new Date(fine.startDate).toLocaleDateString() !== new Date(fine.endDate).toLocaleDateString() ? `${new Date(fine.startDate).toLocaleDateString()} – ${new Date(fine.endDate).toLocaleDateString()}` : new Date(fine.startDate || fine.date).toLocaleDateString()})
                              </span>
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>₹{fine.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

                  {(() => {
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
              const attendedIds = new Set(todayData.map(d => d.studentId));
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
                  <select
                    value={selectedAttendanceStudentId}
                    onChange={(e) => setSelectedAttendanceStudentId(e.target.value)}
                    style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', maxWidth: '200px' }}
                  >
                    <option value="">Select Student...</option>
                    {students.map(s => (
                      <option key={s.userId} value={s.userId}>{s.name} ({s.userId})</option>
                    ))}
                  </select>
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
                    `Showing aggregated ${attendanceView} attendance for the selected period.`}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="activity-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                              <span style={{ fontWeight: 'bold', color: record.status === 'Present' ? '#10b981' : '#ef4444' }}>
                                {record.status} ({formatStudyTime(record.totalHours)})
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                {record.firstIn && `First Log In: ${new Date(record.firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • `}Target: {targetHours > 0 ? `${targetHours} hrs` : 'Holiday'} • {record.date}
                              </span>
                            </div>
                            {user.role === 'admin' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {record.status === 'Present' ? (
                                  <>
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
        ) : activeTab === 'campus_qr' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2>Campus Attendance QR Codes</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>Display these codes at the reception or front desk. They change dynamically to prevent student spoofing.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  🔄 Auto-rotate codes (15s)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2rem' }}>
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
                <h3 style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>LOG IN</h3>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
                  <QRCodeSVG value={campusQRConfig.activeInToken || 'CM-ATTENDANCE-IN'} size={220} />
                </div>
                <button
                  onClick={() => refreshCampusQR('IN')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  🔄 Refresh Check-IN QR
                </button>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Students scan this to mark their arrival.</p>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '2.5rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
                <h3 style={{ color: '#ef4444', fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>LOG OUT</h3>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid var(--glass-border)' }}>
                  <QRCodeSVG value={campusQRConfig.activeOutToken || 'CM-ATTENDANCE-OUT'} size={220} />
                </div>
                <button
                  onClick={() => refreshCampusQR('OUT')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  🔄 Refresh Check-OUT QR
                </button>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>Students scan this when leaving the campus.</p>
              </div>
            </div>
          </>
        ) : activeTab === 'papers' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>{(user.role === 'admin' || user.role === 'staff') ? 'Manage Question Papers' : 'Your Question Papers'}</h2>
            </div>

            {(user.role === 'admin' || user.role === 'staff') && (
              <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Upload New Question Paper for Student</h3>
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
                      if (!res.ok) throw new Error(await res.text());
                      alert('Question Paper scheduled successfully!');
                      e.target.reset();
                      fetchPapers();
                    } catch (err) {
                      alert('Upload failed: ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <input type="text" name="title" placeholder="Question Paper Title (e.g. Midterm Physics)" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }} />

                  <select name="target" required style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent' }}>
                    <option value="">Select a Student...</option>
                    {students && students.map(s => (
                      <option key={s.userId} value={s.userId}>{s.name} ({s.userId})</option>
                    ))}
                  </select>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Exam Duration Including Reading Time (minutes)</label>
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
              <h3 style={{ marginBottom: '1.5rem' }}>{(user.role === 'admin' || user.role === 'staff') ? 'Scheduled Question Papers' : 'Available Question Papers'}</h3>
              
              {user.role !== 'admin' && user.role !== 'staff' && (
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
                  <span>Question papers (without uploaded answer sheets) are automatically deleted from the system <strong>3 days</strong> after you start (open) them.</span>
                </div>
              )}

              <div className="activity-list">
                {papers.map((paper) => {
                  if (user.role === 'student') {
                    return (
                      <StudentPaperCard
                        key={paper._id}
                        paper={paper}
                        user={user}
                        onRefresh={fetchPapers}
                        showConfirm={showConfirm}
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

                  const targetStudent = students.find(s => s.userId === paper.target);
                  const studentDisplayName = targetStudent ? `${targetStudent.name} (${paper.target})` : paper.target;

                  return (
                    <div key={paper._id} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.2rem', padding: '1.2rem', background: 'white', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{paper.title}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          <span>Target: <strong>{studentDisplayName}</strong></span>
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
                            } catch (err) {
                              alert("Error downloading question paper");
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
                              } catch (err) {
                                alert("Error downloading answer sheet");
                              }
                            }} style={{ padding: '0.45rem 0.9rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }} title="Download Scanned Answer Sheet">
                              Answer 📥
                            </button>
                          )}

                          {user.role === 'admin' && (
                            <button onClick={async () => {
                              if (!await showConfirm('Delete this question paper?')) return;
                              await fetch(`/admin/paper/${paper._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } });
                              fetchPapers();
                            }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>🗑️</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {papers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No question papers available.</p>}
              </div>
            </div>
          </>
        ) : activeTab === 'schedules' ? (
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
        ) : activeTab === 'exam_scheduler' ? (
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
                        if (!res.ok) throw new Error(await res.text());
                        alert('Payment configuration saved!');
                        fetchPaymentConfig();
                      } catch (err) {
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
                    {students && students.flatMap(s => (s.feeHistory || []).map(f => ({ ...f, studentObj: s, studentName: s.name, studentId: s.userId })))
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 50)
                      .map((fee, idx) => (
                        <div key={idx} className="activity-item" style={{ alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>+ ₹{fee.amount}</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                              <span>From: <strong>{fee.studentName}</strong> (#{fee.studentId})</span>
                              <span>Receipt: {fee.receiptNo || 'N/A'}</span>
                              {fee.installmentNumber && (
                                <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  Installment {fee.installmentNumber}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <div style={{ fontWeight: 'bold', color: fee.status === 'Pending' ? '#f59e0b' : (fee.status === 'Rejected' ? '#ef4444' : '#10b981') }}>{fee.status}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(fee.date).toLocaleDateString()}</div>
                            {fee.status === 'Pending' && (() => {
                              const unpaidInstallments = fee.studentObj?.installments || [];
                              return (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <select
                                    id={`assign-installment-${fee._id}`}
                                    defaultValue=""
                                    style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--glass-border)', fontSize: '0.85rem', background: 'white', color: 'var(--text-main)' }}
                                  >
                                    <option value="">-- Select Installment --</option>
                                    {unpaidInstallments.map((inst, uIdx) => (
                                      <option key={uIdx} value={uIdx}>
                                        Inst {uIdx + 1} (₹{inst.amount}) - {inst.status}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const selectEl = document.getElementById(`assign-installment-${fee._id}`);
                                      const selectedIdxStr = selectEl ? selectEl.value : '';
                                      const bodyData = {};
                                      if (selectedIdxStr !== '') {
                                        bodyData.installmentIndex = Number(selectedIdxStr);
                                      }
                                      try {
                                        setLoading(true);
                                        const res = await fetch(`/admin/student/${fee.studentId}/payment/${fee._id}/approve`, {
                                          method: 'POST',
                                          headers: {
                                            'Authorization': `Bearer ${user.token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify(bodyData)
                                        });
                                        if (!res.ok) throw new Error(await res.text());
                                        alert('Payment verified successfully!');
                                        fetchStudentsData();
                                      } catch (e) {
                                        alert('Error: ' + e.message);
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    style={{ padding: '0.3rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        setLoading(true);
                                        const res = await fetch(`/admin/student/${fee.studentId}/payment/${fee._id}/reject`, {
                                          method: 'POST',
                                          headers: { 'Authorization': `Bearer ${user.token}` }
                                        });
                                        if (!res.ok) throw new Error(await res.text());
                                        alert('Payment rejected successfully!');
                                        fetchStudentsData();
                                      } catch (e) {
                                        alert('Error: ' + e.message);
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    style={{ padding: '0.3rem 0.8rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              );
                            })()}
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
                          <span style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>📅 Installment Schedule</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {profileData.installments.map((inst, idx) => {
                              const isPaid = inst.status === 'Paid';
                              return (
                                <div key={idx} style={{ background: 'white', padding: '0.8rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid rgba(0,0,0,0.01)', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                                  <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', display: 'block' }}>
                                    Installment {idx + 1}: ₹{isPaid ? inst.amount : (inst.adjustedAmount !== undefined ? inst.adjustedAmount : inst.amount)}
                                  </strong>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <span>Due: {new Date(inst.dueDate).toLocaleDateString()}</span>
                                    {isPaid ? (
                                      <span style={{ color: '#10b981', fontWeight: 'bold', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                                        Paid
                                      </span>
                                    ) : (
                                      <span style={{ color: '#ef4444', fontWeight: 'bold', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--glass-border)', width: '100%', maxWidth: '220px', margin: '0 auto' }}>
                              <span style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Scan to Pay</span>
                              <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                                <QRCodeSVG value={`upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.accountName)}`} size={160} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan with any UPI App</span>
                            </div>
                          )}
                        </div>

                        {/* Direct Payment Entry Form */}
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                          <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ✍️ Report Your Payment
                          </h4>
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const amountInput = e.target.amount.value;
                              const receiptInput = e.target.receipt.value;
                              const installmentSelect = e.target.installmentNumber.value;

                              if (!amountInput || !receiptInput || !installmentSelect) {
                                alert('Please fill in all payment details');
                                return;
                              }

                              const enteredAmt = Number(amountInput);
                              const selectedIdx = Number(installmentSelect) - 1;
                              const instObj = profileData?.installments?.[selectedIdx];
                              const expectedAmt = instObj?.adjustedAmount !== undefined ? instObj.adjustedAmount : instObj?.amount;

                              if (expectedAmt !== undefined && enteredAmt !== expectedAmt) {
                                alert(`Error: The payment amount (₹${enteredAmt}) does not match the amount required for Installment ${installmentSelect} (₹${expectedAmt}).`);
                                return;
                              }

                              try {
                                setLoading(true);
                                const res = await fetch('/student/payment', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${user.token}`,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    amount: enteredAmt,
                                    receiptNo: `Inst ${installmentSelect} - ${receiptInput}`
                                  })
                                });
                                if (!res.ok) throw new Error(await res.text());
                                alert('Payment report submitted and is pending admin approval.');
                                e.target.reset();
                                fetchProfileData();
                              } catch (err) {
                                alert('Error: ' + err.message);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}
                          >
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Installment Number
                              </label>
                              <select
                                name="installmentNumber"
                                required
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const idx = Number(val) - 1;
                                    const instObj = profileData?.installments?.[idx];
                                    const expected = instObj?.adjustedAmount !== undefined ? instObj.adjustedAmount : instObj?.amount;
                                    if (expected && e.target.form.amount) {
                                      e.target.form.amount.value = expected;
                                    }
                                  }
                                }}
                                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.9rem' }}
                              >
                                <option value="">-- Select --</option>
                                {profileData?.installments?.map((inst, idx) => (
                                  <option key={idx} value={idx + 1}>
                                    Installment {idx + 1} (₹{inst.adjustedAmount !== undefined ? inst.adjustedAmount : inst.amount}) - {inst.status}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Payment Amount (₹)
                              </label>
                              <input
                                type="number"
                                name="amount"
                                required
                                min="1"
                                placeholder="e.g. 10000"
                                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.9rem' }}
                              />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Transaction ID / Reference ID
                              </label>
                              <input
                                type="text"
                                name="receipt"
                                required
                                placeholder="Enter UPI Reference / UTR Number"
                                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.9rem' }}
                              />
                            </div>
                            <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                              <button
                                type="submit"
                                style={{ width: '100%', padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.15)' }}
                              >
                                Submit Payment Report
                              </button>
                            </div>
                          </form>
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px' }}>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309' }}>
                            <strong>Note:</strong> After reporting payment details, the administration will verify the reference ID and update your ledger.
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
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                              <span>Receipt No: {fee.receiptNo || 'N/A'}</span>
                              {fee.installmentNumber && (
                                <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  Installment {fee.installmentNumber}
                                </span>
                              )}
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
        ) : activeTab === 'due_students' ? (
          <>
            {(() => {
              const todayStr = getLocalDateString();
              const dueItems = [];

              if (Array.isArray(students)) {
                students.forEach(student => {
                  if (student.role !== 'student') return;
                  const remainingBalance = student.totalFees !== undefined
                    ? (student.totalFees || 0) - (student.feesPaid || 0)
                    : undefined;
                  const insts = student.installments || [];
                  const unpaidInsts = insts.filter(inst => inst.status !== 'Paid');
                  
                  const addRow = (instIndex, instAmt, originalAmt, dueDate, isFallback = false) => {
                    const dueDateStr = dueDate ? getLocalDateString(new Date(dueDate)) : '';
                    let dueStatus = 'upcoming';
                    let dueStatusLabel = 'Upcoming';
                    let daysDiff = 0;
                    
                    if (dueDateStr) {
                      const dueDateTime = new Date(dueDateStr).getTime();
                      const todayTime = new Date(todayStr).getTime();
                      const diffTime = dueDateTime - todayTime;
                      daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (dueDateStr === todayStr) {
                        dueStatus = 'due_today';
                        dueStatusLabel = 'Due Today';
                      } else if (dueDateStr < todayStr) {
                        dueStatus = 'overdue';
                        dueStatusLabel = 'Overdue';
                      }
                    }

                    dueItems.push({
                      studentId: student.userId,
                      studentName: student.name,
                      email: student.email,
                      phone: student.phone,
                      course: student.course,
                      batch: student.batch,
                      installmentIndex: instIndex,
                      installmentAmount: instAmt,
                      originalAmount: originalAmt,
                      dueDate,
                      dueDateStr,
                      dueStatus,
                      dueStatusLabel,
                      daysDiff,
                      remainingBalance,
                      studentObj: student
                    });
                  };

                  if (unpaidInsts.length > 0) {
                    unpaidInsts.forEach((inst) => {
                      const idx = insts.indexOf(inst);
                      addRow(idx, inst.adjustedAmount !== undefined ? inst.adjustedAmount : inst.amount, inst.amount, inst.dueDate);
                    });
                  } else if (remainingBalance > 0 && student.nextPaymentDueDate) {
                    addRow(-1, remainingBalance, remainingBalance, student.nextPaymentDueDate, true);
                  }
                });
              }

              // Sort dueItems by dueDate in ascending order (oldest due date / most overdue first, leading up to current day and future)
              dueItems.sort((a, b) => {
                const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                return timeA - timeB;
              });

              // Compute counts for filter sub-tabs (filtering upcoming by custom range)
              const totalCount = dueItems.length;
              const overdueCount = dueItems.filter(item => item.dueStatus === 'overdue').length;
              const dueTodayCount = dueItems.filter(item => item.dueStatus === 'due_today').length;
              const upcomingCount = dueItems.filter(item => 
                item.dueStatus === 'upcoming' && 
                (!upcomingStartDate || item.dueDateStr >= upcomingStartDate) && 
                (!upcomingEndDate || item.dueDateStr <= upcomingEndDate)
              ).length;

              // Filter list based on search, filter, and calendar selections
              const filteredDueItems = dueItems.filter(item => {
                if (dueFilterType === 'overdue' && item.dueStatus !== 'overdue') return false;
                if (dueFilterType === 'due_today' && item.dueStatus !== 'due_today') return false;
                if (dueFilterType === 'upcoming') {
                  if (item.dueStatus !== 'upcoming') return false;
                  if (upcomingStartDate && item.dueDateStr < upcomingStartDate) return false;
                  if (upcomingEndDate && item.dueDateStr > upcomingEndDate) return false;
                }

                const q = dueSearchQuery.toLowerCase().trim();
                if (q) {
                  return (
                    (item.studentName && item.studentName.toLowerCase().includes(q)) ||
                    (item.studentId && item.studentId.toLowerCase().includes(q))
                  );
                }
                return true;
              });

              const isStaff = user.role === 'staff';

              return (
                <>
                  {/* Top Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #ef4444' }}>
                      <div style={{ fontSize: '2rem' }}>🚨</div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Overdue Accounts</div>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#ef4444' }}>{overdueCount}</h3>
                      </div>
                    </div>
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #f59e0b' }}>
                      <div style={{ fontSize: '2rem' }}>📅</div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Due Today</div>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#f59e0b' }}>{dueTodayCount}</h3>
                      </div>
                    </div>
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #3b82f6' }}>
                      <div style={{ fontSize: '2rem' }}>⌛</div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upcoming Dues</div>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#3b82f6' }}>{upcomingCount}</h3>
                      </div>
                    </div>
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '5px solid #10b981' }}>
                      <div style={{ fontSize: '2rem' }}>💳</div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Pending</div>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '1.5rem', color: '#10b981' }}>{totalCount}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      
                      {/* Sub-tabs */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setDueFilterType('all')}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: dueFilterType === 'all' ? 'var(--primary-color)' : 'rgba(255,255,255,0.4)',
                            color: dueFilterType === 'all' ? 'white' : 'var(--text-main)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          All ({totalCount})
                        </button>
                        <button
                          onClick={() => setDueFilterType('overdue')}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: dueFilterType === 'overdue' ? '#ef4444' : 'rgba(255,255,255,0.4)',
                            color: dueFilterType === 'overdue' ? 'white' : 'var(--text-main)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Overdue ({overdueCount})
                        </button>
                        <button
                          onClick={() => setDueFilterType('due_today')}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: dueFilterType === 'due_today' ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                            color: dueFilterType === 'due_today' ? 'white' : 'var(--text-main)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Due Today ({dueTodayCount})
                        </button>
                        <button
                          onClick={() => setDueFilterType('upcoming')}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: dueFilterType === 'upcoming' ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                            color: dueFilterType === 'upcoming' ? 'white' : 'var(--text-main)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Upcoming ({upcomingCount})
                        </button>
                      </div>

                      {/* Date Range Picker for Upcoming */}
                      {dueFilterType === 'upcoming' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.4)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Upcoming Calendar Range:</span>
                          <input
                            type="date"
                            value={upcomingStartDate}
                            onChange={(e) => setUpcomingStartDate(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', background: 'white', color: 'var(--text-main)' }}
                          />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>to</span>
                          <input
                            type="date"
                            value={upcomingEndDate}
                            onChange={(e) => setUpcomingEndDate(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', background: 'white', color: 'var(--text-main)' }}
                          />
                        </div>
                      )}

                      {/* Export button */}
                      <button
                        onClick={() => handleExportDueStudents(filteredDueItems)}
                        style={{
                          padding: '0.6rem 1.2rem',
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        📥 Export Dues List
                      </button>
                    </div>

                    <div style={{ marginTop: '1.5rem', position: 'relative', width: '100%', maxWidth: '500px' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search by student name or ID..."
                        value={dueSearchQuery}
                        onChange={(e) => setDueSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 2.5rem 0.65rem 2.5rem',
                          borderRadius: '10px',
                          border: '1px solid var(--glass-border)',
                          background: 'white',
                          color: 'var(--text-main)',
                          fontSize: '0.95rem',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                      {dueSearchQuery && (
                        <button
                          onClick={() => setDueSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1.1rem'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dues List Table */}
                  <div className="card">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                            <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Student</th>
                            <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Due Item</th>
                            {!isStaff && <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Amount Due</th>}
                            <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Due Date</th>
                            <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>Status</th>
                            <th style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDueItems.length > 0 ? (
                            <>
                              {filteredDueItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                                  <td style={{ padding: '1rem 0.75rem' }}>
                                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.studentName}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {item.studentId}</div>
                                  </td>
                                  <td style={{ padding: '1rem 0.75rem' }}>
                                    <div>{item.installmentIndex === -1 ? 'Pending Balance' : `Installment ${item.installmentIndex + 1}`}</div>
                                    {!isStaff && (
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total Bal: ₹{item.remainingBalance}</div>
                                    )}
                                  </td>
                                  {!isStaff && (
                                    <td style={{ padding: '1rem 0.75rem' }}>
                                      <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>₹{item.installmentAmount}</strong>
                                    </td>
                                  )}
                                  <td style={{ padding: '1rem 0.75rem' }}>
                                    <div style={{ fontWeight: '500' }}>
                                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                    </div>
                                    <div style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 'bold',
                                      color: item.dueStatus === 'overdue' ? '#ef4444' : item.dueStatus === 'due_today' ? '#f59e0b' : '#3b82f6',
                                      marginTop: '2px'
                                    }}>
                                      {item.dueStatus === 'due_today' ? 'Due today' : 
                                       item.dueStatus === 'overdue' ? `${Math.abs(item.daysDiff)} days overdue` : 
                                       `Due in ${item.daysDiff} days`}
                                    </div>
                                  </td>
                                  <td style={{ padding: '1rem 0.75rem' }}>
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontSize: '0.8rem',
                                      fontWeight: 'bold',
                                      background: item.dueStatus === 'overdue' ? 'rgba(239, 68, 68, 0.1)' : 
                                                  item.dueStatus === 'due_today' ? 'rgba(245, 158, 11, 0.1)' : 
                                                  'rgba(59, 130, 246, 0.1)',
                                      color: item.dueStatus === 'overdue' ? '#ef4444' : 
                                             item.dueStatus === 'due_today' ? '#f59e0b' : 
                                             '#3b82f6'
                                    }}>
                                      {item.dueStatusLabel}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                                    <button
                                      onClick={() => setViewingProfileStudent(item.studentObj)}
                                      style={{
                                        padding: '0.4rem 0.8rem',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary-color)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--primary-color)';
                                        e.currentTarget.style.color = 'white';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                        e.currentTarget.style.color = 'var(--primary-color)';
                                      }}
                                    >
                                      {isStaff ? '🔍 View Details' : '🔍 View Ledger'}
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              {/* Sum Total Row (Only for admin) */}
                              {!isStaff && (
                                <tr style={{ borderTop: '2px solid var(--glass-border)', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)' }}>
                                  <td colSpan="2" style={{ padding: '1rem 0.75rem', color: 'var(--text-main)' }}>Total Due Amount</td>
                                  <td style={{ padding: '1rem 0.75rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                    ₹{filteredDueItems.reduce((sum, item) => sum + (item.installmentAmount || 0), 0)}
                                  </td>
                                  <td colSpan="3"></td>
                                </tr>
                              )}
                            </>
                          ) : (
                            <tr>
                              <td colSpan={isStaff ? 5 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍃</div>
                                <div>No students with due fees match the current search or filters.</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
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
              const resolvedConfig = resolveGoalForStudentOnDate(user.userId, formatLocalDate(new Date()));
              const todayTarget = resolvedConfig[todayKey] !== undefined ? resolvedConfig[todayKey] : 12;

              return (
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
              );
            })()}
          </>
        ) : activeTab === 'goal_settings' ? (
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
                <select
                  value={selectedGoalStudent}
                  onChange={(e) => setSelectedGoalStudent(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '1rem', cursor: 'pointer' }}
                >
                  <option value="">All Students (Default)</option>
                  {Array.isArray(students) && students.map(student => (
                    <option key={student.userId} value={student.userId}>
                      {student.name} ({student.userId}) - {student.course}
                    </option>
                  ))}
                </select>
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
                          {c.studentId && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>(ID: {c.studentId})</span>}
                          
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

                const payments = (feeSetupStudent.feeHistory || [])
                  .filter(p => p.status === 'Verified' || p.status === 'Paid' || p.status === 'Received');
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

                const allowedMin = totalCourseFee - totalPaid;

                if (sumInstallments < allowedMin || sumInstallments > totalCourseFee) {
                  alert(`The sum of installment amounts (₹${sumInstallments}) must be between ₹${allowedMin} (accounting for paid fees of ₹${totalPaid}) and ₹${totalCourseFee}. Please adjust installment values.`);
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
                } catch (err) { alert('Error: ' + err.message); }
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
                        <div style={{ flex: '1', minWidth: '130px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Verification Status</label>
                          <select
                            value={inst.status || 'Unpaid'}
                            onChange={e => {
                              const updated = [...feeSetupStudent.installments];
                              const newStatus = e.target.value;
                              updated[index].status = newStatus;
                              if (newStatus === 'Paid') {
                                if (!updated[index].paidDate) {
                                  updated[index].paidDate = getLocalDateString();
                                }
                              } else {
                                updated[index].paidDate = '';
                              }
                              setFeeSetupStudent({ ...feeSetupStudent, installments: updated });
                            }}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-main)', background: 'transparent' }}
                          >
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </div>
                        <div style={{ flex: '1.2', minWidth: '160px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Date of Payment</label>
                          <input
                            type="date"
                            disabled={inst.status !== 'Paid'}
                            required={inst.status === 'Paid'}
                            value={inst.paidDate || ''}
                            onChange={e => {
                              const updated = [...feeSetupStudent.installments];
                              updated[index].paidDate = e.target.value;
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

                  {(() => {
                    const totalCourseFee = Number(feeSetupStudent.totalFees || 0);
                    const allocatedSum = (feeSetupStudent.installments || []).reduce((sum, inst) => sum + Number(inst.amount || 0), 0);

                    const payments = (feeSetupStudent.feeHistory || [])
                      .filter(p => p.status === 'Verified' || p.status === 'Paid' || p.status === 'Received');
                    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

                    const unpaidInstallmentsSum = (feeSetupStudent.installments || [])
                      .filter(inst => inst.status !== 'Paid')
                      .reduce((sum, inst) => sum + Number(inst.amount || 0), 0);

                    const remainingVal = totalCourseFee - totalPaid - unpaidInstallmentsSum;
                    const isFullyAllocated = remainingVal === 0;

                    return (
                      <div style={{ marginTop: '1.5rem', padding: '1rem', background: isFullyAllocated ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)', borderRadius: '8px', border: `1px dashed ${isFullyAllocated ? '#10b981' : '#f59e0b'}`, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-main)' }}>Allocated: ₹{allocatedSum} / ₹{totalCourseFee}</span>
                          <span style={{ color: isFullyAllocated ? '#10b981' : '#f59e0b' }}>
                            {isFullyAllocated ? '✓ Fees Fully Allocated' : `Remaining: ₹${remainingVal}`}
                          </span>
                        </div>
                        {totalPaid > 0 && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '0.4rem' }}>
                            <span>Fees Paid So Far: ₹{totalPaid}</span>
                            <span>Unpaid Balance: ₹{totalCourseFee - totalPaid}</span>
                          </div>
                        )}
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

            <div className="card" style={{ maxWidth: '700px', marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>💰 Payment History & Verification</h3>
              {feeSetupStudent.feeHistory && feeSetupStudent.feeHistory.length > 0 ? (
                <div className="activity-list">
                  {feeSetupStudent.feeHistory.map((fee, idx) => (
                    <div key={idx} className="activity-item" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>+ ₹{fee.amount}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <span>Receipt: {fee.receiptNo || 'N/A'}</span>
                          <span>Date: {new Date(fee.date).toLocaleDateString()}</span>
                          {fee.installmentNumber && (
                            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              Installment {fee.installmentNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: fee.status === 'Pending' ? '#f59e0b' : (fee.status === 'Rejected' ? '#ef4444' : '#10b981') }}>{fee.status}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => setEditingPayment({
                            studentId: feeSetupStudent.userId,
                            studentName: feeSetupStudent.name,
                            paymentId: fee._id,
                            amount: fee.amount,
                            date: fee.date,
                            receiptNo: fee.receiptNo || '',
                            status: fee.status,
                            installmentNumber: fee.installmentNumber || ''
                          })} style={{ padding: '0.3rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>✏️ Edit</button>
                          {fee.status === 'Pending' && (
                            <>
                              <button type="button" onClick={async () => {
                                try {
                                  const res = await fetch(`/admin/student/${feeSetupStudent.userId}/payment/${fee._id}/approve`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if (!res.ok) throw new Error(await res.text());
                                  const resData = await res.json();
                                  setFeeSetupStudent(resData.user);
                                  fetchStudentsData();
                                } catch (e) { alert('Error: ' + e.message); }
                              }} style={{ padding: '0.3rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Approve</button>
                              <button type="button" onClick={async () => {
                                try {
                                  const res = await fetch(`/admin/student/${feeSetupStudent.userId}/payment/${fee._id}/reject`, {
                                    method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                  });
                                  if (!res.ok) throw new Error(await res.text());
                                  const resData = await res.json();
                                  setFeeSetupStudent(resData.user);
                                  fetchStudentsData();
                                } catch (e) { alert('Error: ' + e.message); }
                              }} style={{ padding: '0.3rem 0.8rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Reject</button>
                            </>
                          )}
                          {(fee.status === 'Verified' || fee.status === 'Paid' || fee.status === 'Received') && (
                            <button type="button" onClick={async () => {
                              if (!await showConfirm(`Are you sure you want to revert this payment of ₹${fee.amount}? This will mark it as Pending (unmarked), subtract the amount from the student's total paid fees, and update their installment statuses.`)) return;
                              try {
                                const res = await fetch(`/admin/student/${feeSetupStudent.userId}/payment/${fee._id}/revert`, {
                                  method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                });
                                if (!res.ok) throw new Error(await res.text());
                                const resData = await res.json();
                                setFeeSetupStudent(resData.user);
                                fetchStudentsData();
                              } catch (e) { alert('Error: ' + e.message); }
                            }} style={{ padding: '0.3rem 0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Revert</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No payment history available for this student.</p>
              )}
            </div>
          </>
        ) : activeTab === 'fines' ? (
          user.role === 'student' ? (
            <StudentFinesView user={user} data={data} fetchDashboardData={fetchDashboardData} />
          ) : (
            <FinesTab user={user} students={students} fetchStudentsData={fetchStudentsData} />
          )
        ) : (activeTab === 'notifications' || activeTab === 'scan_qr') && user.role === 'student' ? (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {data?.mode === 'online' ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', color: 'var(--text-main)' }}>Online Attendance</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '2rem' }}>
                  Manually check in when you start studying and check out when you finish.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleManualAttendance('IN')}
                    style={{
                      padding: '1rem 2rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    ✅ Check-In
                  </button>
                  <button
                    onClick={() => handleManualAttendance('OUT')}
                    style={{
                      padding: '1rem 2rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    ❌ Check-Out
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.4rem', color: 'var(--text-main)' }}>Attend Class via QR</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      Align the campus dynamic QR code to securely log your attendance duration.
                    </p>
                  </div>
                  {!scanning ? (
                    <button
                      onClick={() => setScanning(true)}
                      style={{
                        padding: '1rem 2rem',
                        background: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                      }}
                    >
                      📷 Scan Campus QR
                    </button>
                  ) : (
                    <button
                      onClick={() => setScanning(false)}
                      style={{
                        padding: '1rem 2rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      Cancel Scan
                    </button>
                  )}
                </div>

                {scanning && (
                  <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                    <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px' }}></div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'seats' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>Seats Allocation & Management</h2>
            </div>

            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem', marginBottom: '2rem' }}>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary-color)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Residential</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.4rem' }}>
                  {residentialStudents.length}
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seats Allotted</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', marginTop: '0.4rem' }}>
                  {totalAllotted} / {ALL_SEATS.length}
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seats Remaining</span>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b', marginTop: '0.4rem' }}>
                  {remainingSeats}
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--secondary-color)', display: 'flex', flexDirection: 'column', gap: '0.3rem', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classroom Occupancy</span>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', marginTop: '0.2rem' }}>
                  A: <strong style={{ color: 'var(--primary-color)' }}>{classroomAAllotted}/9</strong> | 
                  B: <strong style={{ color: 'var(--primary-color)' }}>{classroomBAllotted}/12</strong> | 
                  C: <strong style={{ color: 'var(--primary-color)' }}>{classroomCAllotted}/9</strong>
                </div>
              </div>
            </div>

            {/* Search Input Container */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px', minWidth: '280px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, ID, batch or seat..."
                  value={seatSearch}
                  onChange={(e) => setSeatSearch(e.target.value)}
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
                {seatSearch && (
                  <button
                    onClick={() => setSeatSearch('')}
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
                Showing {filteredResidentialStudents.length} of {residentialStudents.length} residential students
              </span>
            </div>

            {/* Students List with Seat Dropdowns */}
            <section className="recent-activity">
              <div className="activity-list">
                {filteredResidentialStudents.map((student) => {
                  const availableSeats = getAvailableSeatsForStudent(student.seatNumber, students);
                  const isInside = student.currentStatus === 'Inside';
                  return (
                    <div key={student.userId} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.2rem', background: 'white', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                      <div className="activity-info" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                          {student.name ? student.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <strong>
                            {student.name || 'Unknown Student'}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                              #{student.userId}
                            </span>
                          </strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                            Course: <strong>{student.course || 'N/A'}</strong> | Batch: <strong>{student.batch || 'N/A'}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Inside/Outside Campus Badge */}
                        <span style={{
                          background: isInside ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: isInside ? '#10b981' : '#ef4444',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isInside ? '🟢 Inside Campus' : '🔴 Outside Campus'}
                        </span>

                        {/* Seat Selector Dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Seat:</span>
                          <select
                            value={student.seatNumber || ''}
                            onChange={(e) => handleAllocateSeat(student.userId, e.target.value)}
                            style={{
                              padding: '0.5rem 1.8rem 0.5rem 0.8rem',
                              borderRadius: '8px',
                              border: '1px solid var(--glass-border)',
                              background: student.seatNumber ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-color)',
                              color: student.seatNumber ? '#10b981' : 'var(--text-main)',
                              fontWeight: 'bold',
                              outline: 'none',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s ease',
                              borderRight: '8px solid transparent'
                            }}
                          >
                            <option value="">-- Unallotted --</option>
                            {student.seatNumber && (
                              <option value={student.seatNumber}>{student.seatNumber}</option>
                            )}
                            {availableSeats.map(seat => (
                              <option key={seat} value={seat}>{seat}</option>
                            ))}
                          </select>

                          {student.seatNumber && (
                            <button
                              onClick={() => handleAllocateSeat(student.userId, '')}
                              title="Unallot Seat"
                              style={{
                                padding: '0.5rem',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredResidentialStudents.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No residential students found matching the query.</p>
                )}
              </div>
            </section>
          </>
        ) : activeTab === 'batches' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2>Batch Management & Settings</h2>
            </div>

            {/* Add Batch Card */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>➕ Add New Batch</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newBatchName.trim()) {
                    alert('Please enter a valid batch name.');
                    return;
                  }
                  try {
                    setLoading(true);
                    const res = await fetch('/admin/batches', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${user.token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ name: newBatchName.trim() })
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.message || 'Failed to create batch');
                    alert('Batch created successfully!');
                    setNewBatchName('');
                    fetchBatches();
                  } catch (err) {
                    alert('Error creating batch: ' + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <input
                    type="text"
                    placeholder="e.g. January 2027"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '0.75rem 1.8rem', background: '#10b981', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  Create Batch
                </button>
              </form>
            </div>

            {/* Batches List Card */}
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>📋 All Batches</h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Total: {batches.length}</span>
              </div>

              {batchesLoading && batches.length === 0 ? (
                <div>Loading batches...</div>
              ) : batchesError ? (
                <div style={{ color: '#ef4444' }}>Error: {batchesError}</div>
              ) : batches.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No batches configured yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {batches.map((batch) => {
                    const studentCount = Array.isArray(students) ? students.filter(s => s.batch === batch.name).length : 0;
                    const isEditing = editingBatchId === batch._id;

                    return (
                      <div
                        key={batch._id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.4)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isEditing ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!editingBatchName.trim()) {
                                alert('Please enter a valid batch name.');
                                return;
                              }
                              if (editingBatchName.trim() === batch.name) {
                                setEditingBatchId(null);
                                return;
                              }
                              try {
                                setLoading(true);
                                const res = await fetch(`/admin/batches/${batch._id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Authorization': `Bearer ${user.token}`,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({ name: editingBatchName.trim() })
                                });
                                const d = await res.json();
                                if (!res.ok) throw new Error(d.message || 'Failed to rename batch');
                                alert('Batch renamed successfully! All associated student profiles have been updated.');
                                setEditingBatchId(null);
                                fetchBatches();
                                fetchStudentsData();
                              } catch (err) {
                                alert('Error renaming batch: ' + err.message);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}
                          >
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <input
                                type="text"
                                value={editingBatchName}
                                onChange={(e) => setEditingBatchName(e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'block', marginTop: '4px' }}>
                                ⚠️ Renaming will update {studentCount} associated student(s).
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button type="submit" style={{ padding: '0.45rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>Save</button>
                              <button type="button" onClick={() => setEditingBatchId(null)} style={{ padding: '0.45rem 1rem', background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{batch.name}</span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Assigned Students: <strong style={{ color: 'var(--primary-color)' }}>{studentCount}</strong>
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button
                                onClick={() => {
                                  setEditingBatchId(batch._id);
                                  setEditingBatchName(batch.name);
                                }}
                                style={{ padding: '0.45rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                ✏️ Rename
                              </button>
                              <button
                                onClick={async () => {
                                  const confirmMsg = `Are you sure you want to delete the batch "${batch.name}"?\n` +
                                    `This will disassociate all ${studentCount} student(s) currently in this batch.`;
                                  if (!window.confirm(confirmMsg)) return;
                                  try {
                                    setLoading(true);
                                    const res = await fetch(`/admin/batches/${batch._id}`, {
                                      method: 'DELETE',
                                      headers: { 'Authorization': `Bearer ${user.token}` }
                                    });
                                    const d = await res.json();
                                    if (!res.ok) throw new Error(d.message || 'Failed to delete batch');
                                    alert('Batch deleted successfully!');
                                    fetchBatches();
                                    fetchStudentsData();
                                  } catch (err) {
                                    alert('Error deleting batch: ' + err.message);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                style={{ padding: '0.45rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : isAdminOrStaff ? (
          /* STUDENTS TAB (Admin Only) */
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
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '600px', minWidth: '280px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
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
                      boxShadow: '0 4px 12px var(--shadow-color)',
                      boxSizing: 'border-box'
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

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--surface-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px var(--shadow-color)'
                  }}
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="paid">Fully Paid</option>
                  <option value="unpaid">Has Dues (Unpaid)</option>
                </select>
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
                                const existingInstallments = Array.isArray(student.installments) && student.installments.length > 0
                                  ? student.installments.map(inst => ({
                                    amount: inst.amount || '',
                                    dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString().split('T')[0] : '',
                                    status: inst.status || 'Unpaid',
                                    paidDate: inst.paidDate ? new Date(inst.paidDate).toISOString().split('T')[0] : ''
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
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h3>Access Restricted</h3>
            <p>This panel is only accessible by administrators and coordinators.</p>
          </div>
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
              } catch (err) { alert('Error: ' + err.message); }
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
        <div className="modal-overlay" onClick={() => { setViewingProfileStudent(null); setIsEditingProfile(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%', padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Student Profile: {viewingProfileStudent.name}</h2>
                {(user.role === 'admin' || user.role === 'staff') && !isEditingProfile && (
                  <button
                    onClick={() => {
                      setEditProfileData({
                        name: viewingProfileStudent.name || '',
                        email: viewingProfileStudent.email || '',
                        phone: viewingProfileStudent.phone || '',
                        course: viewingProfileStudent.course || 'INTER',
                        mode: viewingProfileStudent.mode || 'residential',
                        batch: viewingProfileStudent.batch || 'September 2026',
                        group: viewingProfileStudent.group || 'Group 1',
                        aadharNumber: viewingProfileStudent.aadharNumber || '',
                        dob: viewingProfileStudent.dob ? new Date(viewingProfileStudent.dob).toISOString().split('T')[0] : '',
                        joiningDate: viewingProfileStudent.joiningDate ? new Date(viewingProfileStudent.joiningDate).toISOString().split('T')[0] : '',
                        address: viewingProfileStudent.address || '',
                        fatherName: viewingProfileStudent.fatherName || '',
                        fatherPhone: viewingProfileStudent.fatherPhone || '',
                        fatherOccupation: viewingProfileStudent.fatherOccupation || '',
                        motherName: viewingProfileStudent.motherName || '',
                        motherPhone: viewingProfileStudent.motherPhone || '',
                        motherOccupation: viewingProfileStudent.motherOccupation || ''
                      });
                      setIsEditingProfile(true);
                    }}
                    style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                  >
                    ✏️ Edit Profile
                  </button>
                )}
              </div>
              <button onClick={() => { setViewingProfileStudent(null); setIsEditingProfile(false); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem', textAlign: 'left' }}>
              {isEditingProfile ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setLoading(true);
                    const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/profile`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${user.token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(editProfileData)
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message || 'Failed to update profile');
                    alert('Profile updated successfully!');
                    setIsEditingProfile(false);
                    setViewingProfileStudent(result.student);
                    fetchStudentsData();
                  } catch (err) {
                    alert('Error updating profile: ' + err.message);
                  } finally {
                    setLoading(false);
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>

                  {/* Personal Section Edit */}
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>👤 Personal Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Student ID (Non-editable)</span>
                        <input type="text" value={viewingProfileStudent.userId} disabled style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Name</span>
                        <input type="text" value={editProfileData.name} onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })} required style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Course</span>
                        <select value={editProfileData.course} onChange={(e) => setEditProfileData({ ...editProfileData, course: e.target.value })} required style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }}>
                          <option value="INTER">INTER</option>
                          <option value="FINAL">FINAL</option>
                        </select>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Mode</span>
                        <select value={editProfileData.mode} onChange={(e) => setEditProfileData({ ...editProfileData, mode: e.target.value })} required style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }}>
                          <option value="residential">residential</option>
                          <option value="online">online</option>
                        </select>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Email</span>
                        <input type="email" value={editProfileData.email} onChange={(e) => setEditProfileData({ ...editProfileData, email: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Phone</span>
                        <input type="text" value={editProfileData.phone} onChange={(e) => setEditProfileData({ ...editProfileData, phone: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Date of Birth</span>
                        <input type="date" value={editProfileData.dob} onChange={(e) => setEditProfileData({ ...editProfileData, dob: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Batch</span>
                        <select value={editProfileData.batch} onChange={(e) => setEditProfileData({ ...editProfileData, batch: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }}>
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
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Group Choice</span>
                        <select value={editProfileData.group} onChange={(e) => setEditProfileData({ ...editProfileData, group: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }}>
                          <option value="Group 1">Group 1</option>
                          <option value="Group 2">Group 2</option>
                          <option value="Both">Both</option>
                        </select>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Aadhaar Number</span>
                        <input type="text" value={editProfileData.aadharNumber} onChange={(e) => setEditProfileData({ ...editProfileData, aadharNumber: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Date of Joining</span>
                        <input type="date" value={editProfileData.joiningDate} onChange={(e) => setEditProfileData({ ...editProfileData, joiningDate: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Address Section Edit */}
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>📍 Permanent Address</h3>
                    <textarea value={editProfileData.address} onChange={(e) => setEditProfileData({ ...editProfileData, address: e.target.value })} rows="3" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)', fontSize: '0.95rem' }}></textarea>
                  </div>

                  {/* Father's Details Edit */}
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>🧔 Father's Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Father's Name</span>
                        <input type="text" value={editProfileData.fatherName} onChange={(e) => setEditProfileData({ ...editProfileData, fatherName: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Father's Phone</span>
                        <input type="text" value={editProfileData.fatherPhone} onChange={(e) => setEditProfileData({ ...editProfileData, fatherPhone: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Occupation</span>
                        <input type="text" value={editProfileData.fatherOccupation} onChange={(e) => setEditProfileData({ ...editProfileData, fatherOccupation: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Mother's Details Edit */}
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>👩 Mother's Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Mother's Name</span>
                        <input type="text" value={editProfileData.motherName} onChange={(e) => setEditProfileData({ ...editProfileData, motherName: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Mother's Phone</span>
                        <input type="text" value={editProfileData.motherPhone} onChange={(e) => setEditProfileData({ ...editProfileData, motherPhone: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Occupation</span>
                        <input type="text" value={editProfileData.motherOccupation} onChange={(e) => setEditProfileData({ ...editProfileData, motherOccupation: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'white', color: 'var(--text-main)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="button" onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}>Cancel</button>
                    <button type="submit" style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                  </div>
                </form>
              ) : (
                <>
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
                        <strong style={{ color: 'var(--text-main)' }}>
                          {viewingProfileStudent.joiningDate ? new Date(viewingProfileStudent.joiningDate).toLocaleDateString() : 'N/A'}
                        </strong>
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

                  {/* Profile Status & Device Lock */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: viewingProfileStudent.profileCompleted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: viewingProfileStudent.profileCompleted ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      <span>{viewingProfileStudent.profileCompleted ? '✅ Profile Completed' : '⚠️ Profile Incomplete'}</span>
                    </div>
                    <div style={{ flex: '1', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: viewingProfileStudent.deviceFingerprint ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', color: viewingProfileStudent.deviceFingerprint ? '#ef4444' : '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      <span>{viewingProfileStudent.deviceFingerprint ? '🔐 Device Locked' : '🔓 Device Unlocked'}</span>
                      {viewingProfileStudent.deviceFingerprint && user.role === 'admin' && (
                        <button 
                          onClick={() => { handleResetDevice(viewingProfileStudent.userId); }} 
                          style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
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
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Installment {idx + 1}: ₹{inst.adjustedAmount !== undefined ? inst.adjustedAmount : inst.amount}</span>
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
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span>Receipt: {fee.receiptNo || 'N/A'}</span>
                                    <span>Date: {new Date(fee.date).toLocaleDateString()}</span>
                                    {fee.installmentNumber && (
                                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '1px 5px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        Inst {fee.installmentNumber}
                                      </span>
                                    )}
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
                                        status: fee.status,
                                        installmentNumber: fee.installmentNumber || ''
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
                                          } catch (e) { alert('Error: ' + e.message); }
                                        }} style={{ padding: '2px 6px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Approve</button>
                                        <button onClick={async () => {
                                          try {
                                            const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/payment/${fee._id}/reject`, {
                                              method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                            });
                                            if (!res.ok) throw new Error(await res.text());
                                            fetchStudentsData();
                                          } catch (e) { alert('Error: ' + e.message); }
                                        }} style={{ padding: '2px 6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Reject</button>
                                      </>
                                    )}
                                    {(fee.status === 'Verified' || fee.status === 'Paid') && (
                                      <button onClick={async () => {
                                        if (!await showConfirm(`Revert payment of ₹${fee.amount} to Pending (unmarked)?`)) return;
                                        try {
                                          const res = await fetch(`/admin/student/${viewingProfileStudent.userId}/payment/${fee._id}/revert`, {
                                            method: 'POST', headers: { 'Authorization': `Bearer ${user.token}` }
                                          });
                                          if (!res.ok) throw new Error(await res.text());
                                          fetchStudentsData();
                                        } catch (e) { alert('Error: ' + e.message); }
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

                  {/* Attendance & Study Tracker Statistics Section */}
                  <div style={{ marginTop: '1.5rem', borderTop: '1px dashed var(--glass-border)', paddingTop: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '4px' }}>📈 Attendance & Study Statistics</h3>
                    {(() => {
                      const stats = calculateStudentStatsForId(viewingProfileStudent.userId, viewingProfileStudent.joiningDate);

                      const expectedDays = getStudentMonthDays(viewingProfileStudent.joiningDate).length;
                      const presentDays = Math.max(0, expectedDays - stats.monthAbsentCount);
                      const attendanceRate = expectedDays > 0
                        ? Math.min(100, Math.round((presentDays / expectedDays) * 100))
                        : 100;

                      const cycleStart = getCurrentAttendanceMonthStart(viewingProfileStudent.joiningDate);
                      const cycleStartStr = cycleStart ? cycleStart.toLocaleDateString() : 'N/A';
                      const todayStr = new Date().toLocaleDateString();

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Current Cycle: <strong>{cycleStartStr}</strong> to <strong>{todayStr}</strong> ({expectedDays} elapsed days)
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Attendance Rate</span>
                              <strong style={{ fontSize: '1.1rem', color: attendanceRate >= 75 ? '#10b981' : '#ef4444' }}>{attendanceRate}%</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Cycle Study Duration</span>
                              <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{formatStudyTime(stats.monthHours)}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Absent Days</span>
                              <strong style={{ fontSize: '1.1rem', color: stats.monthAbsentCount > 0 ? '#ef4444' : '#10b981' }}>{stats.monthAbsentCount} days</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Shortfall Days</span>
                              <strong style={{ fontSize: '1.1rem', color: stats.lowHoursMonth.length > 0 ? '#ef4444' : '#10b981' }}>{stats.lowHoursMonth.length} days</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>

            {!isEditingProfile && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <button className="modal-btn" onClick={() => setViewingProfileStudent(null)} style={{ margin: 0, padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>
                  Close
                </button>
              </div>
            )}
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
                    status: e.target.status.value,
                    installmentNumber: e.target.installmentNumber.value ? Number(e.target.installmentNumber.value) : null
                  })
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.message || 'Failed to update payment');
                alert('Payment updated successfully!');
                fetchStudentsData();
                if (feeSetupStudent && feeSetupStudent.userId === editingPayment.studentId) {
                  setFeeSetupStudent(resData.user);
                }
                setEditingPayment(null);
              } catch (err) {
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

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Installment Number</label>
                <select
                  name="installmentNumber"
                  defaultValue={editingPayment.installmentNumber || ''}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)' }}
                >
                  <option value="">None / Auto-allocated</option>
                  {(() => {
                    const stud = students && students.find(s => s.userId === editingPayment.studentId);
                    if (stud && Array.isArray(stud.installments) && stud.installments.length > 0) {
                      return stud.installments.map((inst, idx) => (
                        <option key={idx} value={idx + 1}>
                          Installment {idx + 1} (₹{inst.amount})
                        </option>
                      ));
                    } else {
                      return Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          Installment {i + 1}
                        </option>
                      ));
                    }
                  })()}
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

      {/* MANUAL CHECK-IN MODAL */}
      {showManualCheckinModal && manualCheckinData && (
        <div className="modal-overlay" onClick={() => setShowManualCheckinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>🕒 Manual Check-In</h2>
            <p className="subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              Set check-in time for the student's daily record.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Student</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{manualCheckinData.studentName} ({manualCheckinData.studentId})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Date</span>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{manualCheckinData.date}</strong>
              </div>
            </div>

            <form onSubmit={handleManualCheckinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Check-In Time</label>
                <input
                  type="time"
                  value={manualCheckinData.checkinTime}
                  onChange={(e) => setManualCheckinData({ ...manualCheckinData, checkinTime: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowManualCheckinModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}>Confirm Check-In</button>
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
      {/* Student Fine Alert Modal */}
      {showFineAlertModal && user.role === 'student' && data?.fines && data.fines.some(f => f.status !== 'Paid') && (() => {
        const unpaidFines = data.fines.filter(f => f.status !== 'Paid');
        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              background: 'var(--surface-color)',
              border: '2px solid #ef4444',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 20px 50px rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                <h2 style={{ color: '#ef4444', fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>
                  Fine Notification
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                  Administration has recorded fine(s) for your account.
                </p>
              </div>

              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {unpaidFines.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: i < unpaidFines.length - 1 ? '1px solid rgba(239, 68, 68, 0.2)' : 'none'
                  }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', display: 'block' }}>{f.reason}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Period: {f.startDate && f.endDate && new Date(f.startDate).toLocaleDateString() !== new Date(f.endDate).toLocaleDateString() ? `${new Date(f.startDate).toLocaleDateString()} – ${new Date(f.endDate).toLocaleDateString()}` : new Date(f.startDate || f.date).toLocaleDateString()}</span>
                    </div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444' }}>₹{f.amount}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowFineAlertModal(false)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                }}
              >
                Acknowledge & Dismiss
              </button>
            </div>
          </div>
        );
      })()}
      
{/* Mobile Bottom Navigation Bar (app-like structure) */}
      <nav className="mobile-bottom-nav">
        <ul className="mobile-bottom-nav-list">
          <li
            className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              if (user.role === 'student' && data && !data.profileCompleted) {
                alert('Please complete your profile details first to unlock all dashboard features.');
                return;
              }
              setActiveTab('dashboard');
            }}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Dashboard</span>
          </li>

          {(user.role === 'admin' || user.role === 'staff') ? (
            <>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Profile</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <span className="nav-icon">🎓</span>
                <span className="nav-text">Students</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'seats' ? 'active' : ''}`}
                onClick={() => setActiveTab('seats')}
              >
                <span className="nav-icon">🪑</span>
                <span className="nav-text">Seats</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => setActiveTab('attendance')}
              >
                <span className="nav-icon">📅</span>
                <span className="nav-text">Attendance</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'papers' ? 'active' : ''}`}
                onClick={() => setActiveTab('papers')}
              >
                <span className="nav-icon">📄</span>
                <span className="nav-text">Question Papers</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'schedules' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedules')}
              >
                <span className="nav-icon">🗓️</span>
                <span className="nav-text">Schedules</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'exam_scheduler' ? 'active' : ''}`}
                onClick={() => setActiveTab('exam_scheduler')}
              >
                <span className="nav-icon">📅</span>
                <span className="nav-text">Scheduler</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'due_students' ? 'active' : ''}`}
                onClick={() => setActiveTab('due_students')}
              >
                <span className="nav-icon">⏳</span>
                <span className="nav-text">Dues</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'fines' ? 'active' : ''}`}
                onClick={() => setActiveTab('fines')}
              >
                <span className="nav-icon">💸</span>
                <span className="nav-text">Fines</span>
              </li>
              {user.role === 'admin' && (
                <>
                  <li
                    className={`mobile-bottom-nav-item ${activeTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payments')}
                  >
                    <span className="nav-icon">💳</span>
                    <span className="nav-text">Payments</span>
                  </li>
                  <li
                    className={`mobile-bottom-nav-item ${activeTab === 'campus_qr' ? 'active' : ''}`}
                    onClick={() => setActiveTab('campus_qr')}
                  >
                    <span className="nav-icon">🔲</span>
                    <span className="nav-text">Campus QR</span>
                  </li>
                  <li
                    className={`mobile-bottom-nav-item ${activeTab === 'goal_settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('goal_settings')}
                  >
                    <span className="nav-icon">🎯</span>
                    <span className="nav-text">Goal Set</span>
                  </li>
                </>
              )}
            </>
          ) : (
            <>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('attendance');
                }}
              >
                <span className="nav-icon">📅</span>
                <span className="nav-text">Attendance</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'papers' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('papers');
                }}
              >
                <span className="nav-icon">📄</span>
                <span className="nav-text">Question Papers</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'schedules' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('schedules');
                }}
              >
                <span className="nav-icon">🗓️</span>
                <span className="nav-text">Schedules</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'payments' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('payments');
                }}
              >
                <span className="nav-icon">💳</span>
                <span className="nav-text">Payments</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'study_tracker' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('study_tracker');
                }}
              >
                <span className="nav-icon">⏱️</span>
                <span className="nav-text">Goal Tracker</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'scan_qr' ? 'active' : ''}`}
                onClick={() => {
                  if (data && !data.profileCompleted) {
                    alert('Please complete your profile details first to unlock all dashboard features.');
                    return;
                  }
                  setActiveTab('scan_qr');
                }}
              >
                <span className="nav-icon">📷</span>
                <span className="nav-text">Scan QR</span>
              </li>
              <li
                className={`mobile-bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Profile</span>
              </li>
            </>
          )}

          <li
            className="mobile-bottom-nav-item danger"
            onClick={onLogout}
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logout</span>
          </li>
        </ul>
      </nav>

      {/* Custom Toasts Container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none',
        maxWidth: '380px',
        width: 'calc(100% - 48px)'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: 'var(--surface-color)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: `5px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6'}`,
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              border: '1px solid var(--glass-border)',
              animation: 'slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>
                {toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : 'ℹ️'}
              </span>
              <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: '500', lineHeight: '1.4', wordBreak: 'break-word' }}>
                {toast.message}
              </span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 100000 }}>
          <div className="modal-content" style={{
            background: 'var(--surface-solid)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 25px 50px rgba(15, 23, 42, 0.15)',
            borderRadius: '24px',
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '440px',
            width: '90%'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❓</div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '600', lineHeight: '1.4' }}>
              Confirm Action
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background 0.2s'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.resolve(true);
                  setConfirmDialog(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)',
                  transition: 'transform 0.2s'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
