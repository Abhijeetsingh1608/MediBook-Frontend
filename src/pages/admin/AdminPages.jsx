import React, { useState, useEffect } from 'react';
import { AdminSidebar, Topbar, StatusBadge, Stars, Loader } from '../../components/Layout';
import { appointmentAPI, paymentAPI, reviewAPI, formatDate, formatTime } from '../../utils/api';

// ── Admin Appointments ────────────────────────────────────
export function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    Promise.all(
      [1,2,3,4,5].map(id => appointmentAPI.getByProvider(id).catch(() => ({ data: [] })))
    ).then(results => {
      const all = results.flatMap(r => r.data || []);
      const unique = all.filter((a, i, arr) => arr.findIndex(x => x.appointmentId === a.appointmentId) === i);
      setAppointments(unique);
    }).finally(() => setLoading(false));
  }, []);

  const cancelAppt = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await appointmentAPI.cancel(id);
      setAppointments(prev => prev.map(a => a.appointmentId === id ? { ...a, status: 'CANCELLED' } : a));
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
  };

  const markNoShow = async (id) => {
    try {
      await appointmentAPI.updateStatus(id, 'NO_SHOW');
      setAppointments(prev => prev.map(a => a.appointmentId === id ? { ...a, status: 'NO_SHOW' } : a));
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
  };

  const filtered = tab === 'all' ? appointments : appointments.filter(a => a.status === tab);

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="All Appointments" />
        <div className="page-content fade-in">
          <p className="page-title">All Appointments</p>
          <p className="page-subtitle">Platform-wide appointment oversight</p>

          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total', value: appointments.length, icon: '📅', cls: 'stat-icon-blue' },
              { label: 'Scheduled', value: appointments.filter(a => a.status === 'SCHEDULED').length, icon: '⏰', cls: 'stat-icon-yellow' },
              { label: 'Completed', value: appointments.filter(a => a.status === 'COMPLETED').length, icon: '✅', cls: 'stat-icon-green' },
              { label: 'Cancelled', value: appointments.filter(a => a.status === 'CANCELLED').length, icon: '❌', cls: 'stat-icon-red' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.cls}`} style={{ fontSize: 20 }}>{s.icon}</div>
                <div><div className="stat-value">{loading ? '—' : s.value}</div><div className="stat-label">{s.label}</div></div>
              </div>
            ))}
          </div>

          <div className="tabs">
            {['all', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'all' ? 'All' : t.replace('_', ' ')}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Patient</th><th>Provider</th><th>Date & Time</th><th>Service</th><th>Mode</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center' }}><Loader /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">No appointments</div></div></td></tr>
                  ) : filtered.map(a => (
                    <tr key={a.appointmentId}>
                      <td><span className="badge badge-gray">#{a.appointmentId}</span></td>
                      <td style={{ fontSize: 13 }}>Patient #{a.patientId}</td>
                      <td style={{ fontSize: 13 }}>Provider #{a.providerId}</td>
                      <td style={{ fontSize: 13 }}>
                        {formatDate(a.appointmentDate)}<br />
                        <span style={{ color: 'var(--text-muted)' }}>{formatTime(a.startTime)}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{a.serviceType}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{a.modeOfConsultation}</span></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {(a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => markNoShow(a.appointmentId)}>No-Show</button>
                            <button className="btn btn-danger btn-sm" onClick={() => cancelAppt(a.appointmentId)}>Cancel</button>
                          </div>
                        )}
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

// ── Admin Payments ────────────────────────────────────────
export function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    Promise.all([
      paymentAPI.getByStatus('SUCCESS').catch(() => ({ data: [] })),
      paymentAPI.getByStatus('PENDING').catch(() => ({ data: [] })),
      paymentAPI.getByStatus('FAILED').catch(() => ({ data: [] })),
      paymentAPI.getByStatus('REFUNDED').catch(() => ({ data: [] })),
      paymentAPI.getTotalRevenue().catch(() => ({ data: { totalRevenue: 0 } })),
    ]).then(([s, p, f, r, rev]) => {
      setPayments([...(s.data || []), ...(p.data || []), ...(f.data || []), ...(r.data || [])]);
      setRevenue(rev.data.totalRevenue || 0);
    }).finally(() => setLoading(false));
  }, []);

  const refund = async (id) => {
    if (!confirm('Process refund for this payment?')) return;
    setActionLoading(id);
    try {
      await paymentAPI.refund(id);
      setPayments(prev => prev.map(p => p.paymentId === id ? { ...p, status: 'REFUNDED' } : p));
    } catch (e) { alert(e.response?.data?.message || 'Refund failed.'); }
    finally { setActionLoading(null); }
  };

  const markPaid = async (id) => {
    try {
      await paymentAPI.updateStatus(id, 'SUCCESS');
      setPayments(prev => prev.map(p => p.paymentId === id ? { ...p, status: 'SUCCESS' } : p));
    } catch (e) { alert('Error updating status.'); }
  };

  const filtered = tab === 'all' ? payments : payments.filter(p => p.status === tab);
  const totalPaid = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefunded = payments.filter(p => p.status === 'REFUNDED').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Payments" />
        <div className="page-content fade-in">
          <p className="page-title">Payment Management</p>
          <p className="page-subtitle">All platform transactions and refund processing</p>

          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total Revenue', value: `₹${totalPaid.toLocaleString()}`, icon: '💰', cls: 'stat-icon-green' },
              { label: 'Successful', value: payments.filter(p => p.status === 'SUCCESS').length, icon: '✅', cls: 'stat-icon-blue' },
              { label: 'Pending', value: payments.filter(p => p.status === 'PENDING').length, icon: '⏳', cls: 'stat-icon-yellow' },
              { label: 'Refunded', value: `₹${totalRefunded.toLocaleString()}`, icon: '↩️', cls: 'stat-icon-red' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.cls}`} style={{ fontSize: 20 }}>{s.icon}</div>
                <div><div className="stat-value">{loading ? '—' : s.value}</div><div className="stat-label">{s.label}</div></div>
              </div>
            ))}
          </div>

          <div className="tabs">
            {['all', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map(t => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t === 'all' ? 'All' : t}</div>
            ))}
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pay ID</th><th>Appointment</th><th>Patient</th><th>Amount</th><th>Mode</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: 32 }}><Loader /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">💳</div><div className="empty-state-title">No payments</div></div></td></tr>
                  ) : filtered.map(p => (
                    <tr key={p.paymentId}>
                      <td><span className="badge badge-gray">#{p.paymentId}</span></td>
                      <td>Appt #{p.appointmentId}</td>
                      <td>Patient #{p.patientId}</td>
                      <td style={{ fontWeight: 700, color: p.status === 'SUCCESS' ? 'var(--secondary)' : 'var(--text)' }}>
                        ₹{p.amount?.toLocaleString()}
                      </td>
                      <td style={{ fontSize: 13 }}>{p.mode || '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {p.status === 'SUCCESS' && (
                            <button className="btn btn-outline btn-sm" disabled={actionLoading === p.paymentId}
                              onClick={() => refund(p.paymentId)}>
                              {actionLoading === p.paymentId ? <span className="spinner" /> : '↩ Refund'}
                            </button>
                          )}
                          {p.status === 'PENDING' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => markPaid(p.paymentId)}>
                              Mark Paid
                            </button>
                          )}
                        </div>
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

// ── Admin Reviews ─────────────────────────────────────────
export function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filterRating, setFilterRating] = useState(0);

  useEffect(() => {
    Promise.all(
      [1,2,3,4,5].map(id => reviewAPI.getByProvider(id).catch(() => ({ data: [] })))
    ).then(results => {
      const all = results.flatMap(r => r.data || []);
      const unique = all.filter((r, i, arr) => arr.findIndex(x => x.reviewId === r.reviewId) === i);
      setReviews(unique);
    }).finally(() => setLoading(false));
  }, []);

  const deleteReview = async (id) => {
    if (!confirm('Remove this review permanently?')) return;
    setActionLoading(id);
    try {
      await reviewAPI.delete(id);
      setReviews(prev => prev.filter(r => r.reviewId !== id));
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const filtered = filterRating ? reviews.filter(r => r.rating <= filterRating) : reviews;

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Review Moderation" />
        <div className="page-content fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <p className="page-title">Review Moderation</p>
              <p className="page-subtitle">{reviews.length} total reviews</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Filter low ratings (≤):</span>
              <select className="form-select" style={{ width: 100 }} value={filterRating}
                onChange={e => setFilterRating(parseInt(e.target.value))}>
                <option value={0}>All</option>
                {[1,2,3].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
          </div>

          {loading ? <Loader /> : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⭐</div>
              <div className="empty-state-title">No reviews found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(r => (
                <div key={r.reviewId} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                        <Stars rating={r.rating} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{r.rating}/5</span>
                        <span className="badge badge-gray">Review #{r.reviewId}</span>
                        <span className="badge badge-blue">Provider #{r.providerId}</span>
                        {r.isAnonymous && <span className="badge badge-gray">👤 Anonymous</span>}
                        {r.rating <= 2 && <span className="badge badge-red">⚠️ Low Rating</span>}
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.7 }}>{r.comment || '(No written review)'}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                        Patient #{r.patientId} · Appointment #{r.appointmentId} · {formatDate(r.reviewDate)}
                      </p>
                    </div>
                    <button className="btn btn-danger btn-sm" disabled={actionLoading === r.reviewId}
                      onClick={() => deleteReview(r.reviewId)}>
                      {actionLoading === r.reviewId ? <span className="spinner" /> : '🗑 Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminAppointments;
