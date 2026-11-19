import React, { useState, useEffect } from 'react';

function StudentPaperCard({ paper, user, onRefresh, showConfirm, getLocalDateString, getSyncedNow, compressImage }) {
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

export default function PapersTab({
  user,
  students,
  papers,
  fetchPapers,
  showConfirm,
  loading,
  setLoading,
  getLocalDateString,
  getSyncedNow,
  compressImage
}) {
  return (
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
                  getLocalDateString={getLocalDateString}
                  getSyncedNow={getSyncedNow}
                  compressImage={compressImage}
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
  );
}
