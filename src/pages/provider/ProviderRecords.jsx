import React, { useState, useEffect } from 'react';
import { ProviderSidebar, Topbar, Loader } from '../../components/Layout';
import { recordAPI, paymentAPI, providerAPI, getUser, formatDate } from '../../utils/api';

// ── Provider Medical Records ────────────────────────────
export function ProviderRecords() {
  const user = getUser();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRecord, setEditRecord] = useState(null);
  const [providerId, setProviderId] = useState(null);

  useEffect(() => {
    providerAPI.getByUserId(user.userId).then(r => {
      setProviderId(r.data.providerId);
      return recordAPI.getByProvider(r.data.providerId);
    }).then(r => setRecords(r.data || []))
    .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveEdit = async () => {
    try {
      await recordAPI.update(editRecord.recordId, {
        appointmentId: editRecord.appointmentId,
        patientId: editRecord.patientId,
        providerId,
        diagnosis: editRecord.diagnosis,
        prescription: editRecord.prescription,
        notes: editRecord.notes,
        followUpDate: editRecord.followUpDate || null,
      });
      setRecords(prev => prev.map(r => r.recordId === editRecord.recordId ? editRecord : r));
      setEditRecord(null);
    } catch (e) { alert(e.response?.data?.message || 'Update failed.'); }
  };

  return (
    <div className="dashboard-layout">
      <ProviderSidebar />
      <div className="dashboard-main">
        <Topbar title="Medical Records" />
        <div className="page-content fade-in">
          <p className="page-title">Medical Records</p>
          <p className="page-subtitle">Records you've created for patients</p>

          {loading ? <Loader /> : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No records yet</div>
              <p>Create records after completing appointments</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {records.map(r => (
                <div key={r.recordId} className="record-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <div>
                      <span className="badge badge-gray" style={{ marginBottom: 6 }}>Record #{r.recordId} · Appt #{r.appointmentId}</span>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{r.diagnosis}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</span>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditRecord({ ...r })}>✏️ Edit</button>
                    </div>
                  </div>
                  {r.prescription && (
                    <div className="record-field">
                      <span className="record-field-label">💊 Prescription:</span>
                      <span style={{ fontSize: 14 }}>{r.prescription}</span>
                    </div>
                  )}
                  {r.notes && (
                    <div className="record-field">
                      <span className="record-field-label">📝 Notes:</span>
                      <span style={{ fontSize: 14 }}>{r.notes}</span>
                    </div>
                  )}
                  {r.followUpDate && (
                    <div style={{ marginTop: 8 }}>
                      <span className="badge badge-yellow">📅 Follow-up: {formatDate(r.followUpDate)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <span className="modal-title">Edit Record #{editRecord.recordId}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditRecord(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['diagnosis', 'prescription', 'notes'].map(f => (
                <div key={f} className="form-group">
                  <label className="form-label">{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                  {f === 'notes' || f === 'prescription' ? (
                    <textarea className="form-textarea" value={editRecord[f] || ''}
                      onChange={e => setEditRecord(p => ({ ...p, [f]: e.target.value }))} />
                  ) : (
                    <input className="form-input" value={editRecord[f] || ''}
                      onChange={e => setEditRecord(p => ({ ...p, [f]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input className="form-input" type="date" value={editRecord.followUpDate || ''}
                  onChange={e => setEditRecord(p => ({ ...p, followUpDate: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditRecord(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Provider Earnings ────────────────────────────────────
export function ProviderEarnings() {
  const user = getUser();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Get provider ID first
        const provRes = await providerAPI.getByUserId(user.userId);
        const pId = provRes.data.providerId;
        setProviderId(pId);
        
        // Get ONLY payments for this doctor's appointments
        const paymentsRes = await paymentAPI.getByProvider(pId);
        setPayments(paymentsRes.data || []);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const paid = payments.filter(p => p.status === 'SUCCESS');
  const pending = payments.filter(p => p.status === 'PENDING');
  const refunded = payments.filter(p => p.status === 'REFUNDED');
  const paidTotal = paid.reduce((s, p) => s + (p.amount || 0), 0);
  const pendingTotal = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const refundedTotal = refunded.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="dashboard-layout">
      <ProviderSidebar />
      <div className="dashboard-main">
        <Topbar title="Earnings" />
        <div className="page-content fade-in">
          <p className="page-title">Earnings & Analytics</p>
          <p className="page-subtitle">Track your revenue and payment history</p>

          <div className="stats-grid mb-4">
            {[
              { label: 'Total Revenue', value: `₹${paidTotal.toLocaleString()}`, icon: '💰', cls: 'stat-icon-green' },
              { label: 'Pending', value: `₹${pendingTotal.toLocaleString()}`, icon: '⏳', cls: 'stat-icon-yellow' },
              { label: 'Refunded', value: `₹${refundedTotal.toLocaleString()}`, icon: '↩️', cls: 'stat-icon-blue' },
              { label: 'Transactions', value: paid.length, icon: '📊', cls: 'stat-icon-red' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.cls}`} style={{ fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '—' : s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Payment Transactions</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th><th>Appointment</th><th>Amount</th><th>Mode</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><Loader /></td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon">💰</div><div className="empty-state-title">No payments yet</div></div></td></tr>
                  ) : payments.slice(0, 30).map(p => (
                    <tr key={p.paymentId}>
                      <td><span className="badge badge-gray">#{p.paymentId}</span></td>
                      <td>Appt #{p.appointmentId}</td>
                      <td style={{ fontWeight: 700, color: p.status === 'SUCCESS' ? 'var(--secondary)' : 'var(--text-muted)' }}>₹{p.amount?.toLocaleString()}</td>
                      <td>{p.mode || '—'}</td>
                      <td>
                        <span className={`badge ${p.status === 'SUCCESS' ? 'badge-green' : p.status === 'REFUNDED' ? 'badge-gray' : 'badge-yellow'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProviderRecords;
