import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientSidebar, Topbar, StatusBadge, Loader } from '../../components/Layout';
import { appointmentAPI, reviewAPI, getUser, formatDate, formatTime, providerAPI } from '../../utils/api';

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  if (!provider) return 'Doctor';
  if (provider.fullName && !provider.fullName.includes('Provider')) return provider.fullName;
  if (provider.name && !provider.name.includes('Provider')) return provider.name;
  if (provider.firstName && !provider.firstName.includes('Provider')) return provider.firstName;
  if (provider.doctorName && !provider.doctorName.includes('Provider')) return provider.doctorName;
  return 'Doctor';
};

function ReviewModal({ appointment, onClose, onSubmit }) {
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await reviewAPI.submit({
        appointmentId: appointment.appointmentId,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        rating: form.rating,
        comment: form.comment,
      });
      onSubmit();
    } catch (e) {
      alert(e.response?.data?.message || 'Already reviewed or error occurred.');
    } finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Rate Your Experience</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
            How was your appointment #{appointment.appointmentId}?
          </p>
          <div className="form-group">
            <label className="form-label">Rating</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setForm(p => ({ ...p, rating: n }))}
                  style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: n <= form.rating ? 1 : 0.3 }}>★</button>
              ))}
            </div>
          </div>
          <div className="form-group mt-4">
            <label className="form-label">Comment (optional)</label>
            <textarea className="form-textarea" placeholder="Share your experience..."
              value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ appointment, onClose, onDone }) {
  const [newSlotId, setNewSlotId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await appointmentAPI.reschedule(appointment.appointmentId, {
        newSlotId, newDate, newStartTime: newStart, newEndTime: newEnd
      });
      onDone();
    } catch (e) { alert(e.response?.data?.message || 'Reschedule failed.'); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Reschedule Appointment</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">New Slot ID</label>
            <input className="form-input" type="number" placeholder="Enter new slot ID"
              value={newSlotId} onChange={e => setNewSlotId(e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">New Date</label>
              <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input className="form-input" type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input className="form-input" type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientAppointments() {
  const user = getUser();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [reviewAppt, setReviewAppt] = useState(null);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await appointmentAPI.getByPatient(user.userId);
      const appts = res.data || [];
      setAppointments(appts);

      // Fetch provider details for all unique provider IDs
      const uniqueProviderIds = [...new Set(appts.map(a => a.providerId))];
      const providerMap = {};
      for (const providerId of uniqueProviderIds) {
        try {
          const provRes = await providerAPI.getById(providerId);
          providerMap[providerId] = provRes.data;
        } catch (err) {
          console.warn(`Failed to fetch provider ${providerId}`);
          providerMap[providerId] = { providerId, fullName: `Doctor #${providerId}` };
        }
      }
      setProviders(providerMap);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => {
    load();

    const refreshAppointments = () => load();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    window.addEventListener('focus', refreshAppointments);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshAppointments);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    setActionLoading(id);
    try {
      await appointmentAPI.cancel(id);
      await load();
      alert('Appointment cancelled successfully.');
    } catch (e) {
      alert(e.response?.data?.message || 'Cancel failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tab === 'all' ? appointments
    : appointments.filter(a => a.status === tab);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'SCHEDULED', label: 'Upcoming' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main">
        <Topbar title="My Appointments" />
        <div className="page-content fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p className="page-title">My Appointments</p>
              <p className="page-subtitle">{appointments.length} total appointments</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/find-doctors')}>+ Book New</button>
          </div>

          <div className="tabs">
            {tabs.map(t => (
              <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label} {tab === t.key && `(${filtered.length})`}
              </div>
            ))}
          </div>

          {loading ? <Loader /> : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">No appointments found</div>
              <button className="btn btn-primary mt-2" onClick={() => navigate('/find-doctors')}>Find a Doctor</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(a => {
                const d = new Date(a.appointmentDate);
                return (
                  <div key={a.appointmentId} className="card">
                    <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="appt-date-box">
                        <div className="appt-day">{d.getDate()}</div>
                        <div className="appt-month">{d.toLocaleString('en', { month: 'short' })}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Appointment #{a.appointmentId}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, marginBottom: 6 }}>
                          👨‍⚕️ {getDoctorName(providers[a.providerId])}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>⏰ {formatTime(a.startTime)} – {formatTime(a.endTime)}</span>
                          <span>📍 {a.modeOfConsultation}</span>
                          <span>🩺 {a.serviceType}</span>
                        </div>
                        {a.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Note: {a.notes}</div>}
                      </div>
                      <div className="appt-actions">
                        {(a.status === 'BOOKED' || a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => setRescheduleAppt(a)}>Reschedule</button>
                            <button className="btn btn-danger btn-sm" disabled={actionLoading === a.appointmentId}
                              onClick={() => cancel(a.appointmentId)}>
                              {actionLoading === a.appointmentId ? <span className="spinner" /> : 'Cancel'}
                            </button>
                          </>
                        )}
                        {a.status === 'COMPLETED' && (
                          <button className="btn btn-outline btn-sm" onClick={() => setReviewAppt(a)}>
                            ⭐ Review
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {reviewAppt && (
        <ReviewModal appointment={reviewAppt} onClose={() => setReviewAppt(null)}
          onSubmit={() => { setReviewAppt(null); alert('Review submitted!'); }} />
      )}
      {rescheduleAppt && (
        <RescheduleModal appointment={rescheduleAppt} onClose={() => setRescheduleAppt(null)}
          onDone={() => { setRescheduleAppt(null); load(); }} />
      )}
    </div>
  );
}



