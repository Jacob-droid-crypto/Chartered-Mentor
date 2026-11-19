import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function PaymentsTab({
  user,
  students,
  paymentConfig,
  fetchPaymentConfig,
  fetchStudentsData,
  fetchProfileData,
  loading,
  setLoading,
  profileData
}) {
  return (
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
  );
}
