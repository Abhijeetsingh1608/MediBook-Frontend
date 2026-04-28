import React, { useState, useEffect } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { AdminSidebar, Topbar, Loader, StatusBadge } from '../../components/Layout';
import { providerAPI, appointmentAPI, formatDate, formatTime } from '../../utils/api';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [providerMap, setProviderMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const provRes = await providerAPI.getAll();
        const provList = provRes.data || [];

        // Build a map: providerId -> { fullName, specialization }
        const pMap = {};
        provList.forEach(p => { pMap[p.providerId] = { fullName: p.fullName, specialization: p.specialization }; });
        setProviderMap(pMap);

        // Load appointments for each provider (up to 30 providers)
        const all = [];
        await Promise.allSettled(
          provList.slice(0, 30).map(p =>
            appointmentAPI.getByProvider(p.providerId).then(r =>
              (r.data || []).forEach(a => all.push({ ...a, providerName: p.fullName, specialization: p.specialization }))
            )
          )
        );

        // Deduplicate by appointmentId
        const seen = new Set();
        const deduped = all.filter(a => { if (seen.has(a.appointmentId)) return false; seen.add(a.appointmentId); return true; });
        deduped.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));
        setAppointments(deduped);
      } catch (e) {
        setAlert({ type: 'error', msg: 'Failed to load appointments.' });
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = appointments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      String(a.appointmentId).includes(q) ||
      String(a.patientId).includes(q) ||
      (a.providerName || '').toLowerCase().includes(q) ||
      (a.serviceType || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const setStatus = async (id, status) => {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      await appointmentAPI.updateStatus(id, status);
      setAppointments(prev => prev.map(a => a.appointmentId === id ? { ...a, status } : a));
      setAlert({ type: 'success', msg: `Appointment #${id} marked as ${status}.` });
    } catch {
      setAlert({ type: 'error', msg: 'Failed to update status.' });
    } finally { setUpdating(u => ({ ...u, [id]: false })); }
    setTimeout(() => setAlert(null), 3000);
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this appointment? The slot will be released.')) return;
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      await appointmentAPI.cancel(id);
      setAppointments(prev => prev.map(a => a.appointmentId === id ? { ...a, status: 'CANCELLED' } : a));
      setAlert({ type: 'success', msg: `Appointment #${id} cancelled.` });
    } catch {
      setAlert({ type: 'error', msg: 'Failed to cancel appointment.' });
    } finally { setUpdating(u => ({ ...u, [id]: false })); }
    setTimeout(() => setAlert(null), 3000);
  };

  const counts = {
    SCHEDULED: appointments.filter(a => a.status === 'SCHEDULED').length,
    COMPLETED: appointments.filter(a => a.status === 'COMPLETED').length,
    CANCELLED: appointments.filter(a => a.status === 'CANCELLED').length,
    NO_SHOW:   appointments.filter(a => a.status === 'NO_SHOW').length,
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="All Appointments" />
        <div className="page-content fade-in">
          <p className="page-title">Appointment Management</p>
          <p className="page-subtitle">Monitor and manage every booking across the platform</p>

          {alert && (
            <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
              {alert.type === 'success' ? '✓' : '✕'} {alert.msg}
            </div>
          )}

          {/* Status Summary Pills */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Scheduled', key: 'SCHEDULED', bg: 'var(--primary-light)', color: 'var(--primary)' },
              { label: 'Completed', key: 'COMPLETED', bg: 'var(--success-light)', color: 'var(--secondary)' },
              { label: 'Cancelled', key: 'CANCELLED', bg: 'var(--danger-light)', color: 'var(--danger)' },
              { label: 'No-Show',   key: 'NO_SHOW',   bg: 'var(--warning-light)', color: '#92400e' },
            ].map(s => (
              <div key={s.key}
                onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
                style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, cursor: 'pointer',
                  display: 'flex', gap: 8, alignItems: 'center', border: `2px solid ${statusFilter === s.key ? s.color : 'transparent'}`,
                  transition: 'all 0.15s' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{counts[s.key]}</span>
                <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Filters Row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 38 }}
                placeholder="Search by ID, patient, doctor, or service type..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              <RefreshCw size={14} /> Reset
            </button>
          </div>

          {loading ? <Loader text="Loading appointments..." /> : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{filtered.length} appointment{filtered.length !== 1 ? 's' : ''}</span>
                <span className="badge badge-gray">{appointments.length} total</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Service</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state">
                            <div className="empty-state-icon">📅</div>
                            <div className="empty-state-title">No appointments found</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Try adjusting your search or filter.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.map(a => (
                      <tr key={a.appointmentId}>
                        <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>#{a.appointmentId}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Patient #{a.patientId}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {a.providerName ? `Dr. ${a.providerName}` : `Provider #${a.providerId}`}
                          </div>
                          {a.specialization && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.specialization}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 13 }}>{formatDate(a.appointmentDate)}</td>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                          {formatTime(a.startTime)}
                        </td>
                        <td style={{ fontSize: 13 }}>{a.serviceType || '—'}</td>
                        <td>
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>
                            {a.modeOfConsultation === 'TELECONSULTATION' ? '🎥 Video' : '🏥 In-person'}
                          </span>
                        </td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                              <>
                                <button
                                  className="btn btn-outline btn-sm"
                                  disabled={!!updating[a.appointmentId]}
                                  onClick={() => setStatus(a.appointmentId, 'NO_SHOW')}
                                  title="Mark as No-Show">
                                  No-Show
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  disabled={!!updating[a.appointmentId]}
                                  onClick={() => cancel(a.appointmentId)}
                                  title="Cancel Appointment">
                                  <X size={13} />
                                </button>
                              </>
                            )}
                            {a.status === 'NO_SHOW' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={!!updating[a.appointmentId]}
                                onClick={() => setStatus(a.appointmentId, 'CANCELLED')}>
                                Cancel
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
          )}
        </div>
      </div>
    </div>
  );
}
