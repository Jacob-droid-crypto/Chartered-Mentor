import React from 'react';

export default function SeatsTab({
  residentialStudents,
  totalAllotted,
  ALL_SEATS,
  remainingSeats,
  classroomAAllotted,
  classroomBAllotted,
  classroomCAllotted,
  seatSearch,
  setSeatSearch,
  filteredResidentialStudents,
  getAvailableSeatsForStudent,
  students,
  handleAllocateSeat
}) {
  return (
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
  );
}
