import React from 'react';

export default function FeeSetupTab({
  feeSetupStudent,
  setFeeSetupStudent,
  setActiveTab,
  user,
  fetchStudentsData,
  getLocalDateString,
  showConfirm,
  setEditingPayment
}) {
  return (
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
  );
}
