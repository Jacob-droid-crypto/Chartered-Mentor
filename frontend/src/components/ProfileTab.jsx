import React from 'react';

export default function ProfileTab({
  user,
  data,
  profileForm,
  setProfileForm,
  handleProfileSubmit
}) {
  return (
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
  );
}
