import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, CreditCard, Clock, Search, ArrowRight, CheckCircle, XCircle, Star } from 'lucide-react';
import { PatientSidebar, Topbar, Stars, StatusBadge, Loader } from '../../components/Layout';
import { appointmentAPI, recordAPI, paymentAPI, getUser, formatDate, formatTime, providerAPI, reviewAPI } from '../../utils/api';

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  if (!provider) return 'Doctor';
  if (provider.fullName && !provider.fullName.includes('Provider')) return provider.fullName;
  if (provider.name && !provider.name.includes('Provider')) return provider.name;
  if (provider.firstName && !provider.firstName.includes('Provider')) return provider.firstName;
  if (provider.doctorName && !provider.doctorName.includes('Provider')) return provider.doctorName;
  return 'Doctor';
};

export default function PatientDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [upcoming, setUpcoming] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [providers, setProviders] = useState({});
  const [reviewableAppts, setReviewableAppts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ua, rec, pay, allAppts] = await Promise.all([
          appointmentAPI.getUpcoming(user.userId),
          recordAPI.getByPatient(user.userId),
          paymentAPI.getByPatient(user.userId),
          appointmentAPI.getByPatient(user.userId),
        ]);
        const upcomingAppts = ua.data || [];
        const allAppointments = allAppts.data || [];
        const completedAppts = allAppointments.filter(a => a.status === 'COMPLETED');
        
        setUpcoming(upcomingAppts);
        setCompleted(completedAppts);
        setRecords(rec.data || []);
        setPayments(pay.data || []);

        // Fetch provider details for all unique provider IDs
        const allProviderIds = [...new Set([
          ...upcomingAppts.map(a => a.providerId),
          ...completedAppts.map(a => a.providerId)
        ])];
        const providerMap = {};
        for (const providerId of allProviderIds) {
          try {
            const provRes = await providerAPI.getById(providerId);
            providerMap[providerId] = provRes.data;
          } catch (err) {
            console.warn(`Failed to fetch provider ${providerId}`);
            providerMap[providerId] = { providerId, fullName: `Doctor #${providerId}` };
          }
        }
        setProviders(providerMap);
        
        // Find completed appointments that patient can review (those without a review)
        const userReviews = await reviewAPI.getByPatient(user.userId).catch(() => ({ data: [] }));
        const reviewedApptIds = new Set(userReviews.data?.map(r => r.appointmentId) || []);
        const reviewable = completedAppts.filter(a => !reviewedApptIds.has(a.appointmentId));
        setReviewableAppts(reviewable);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const totalSpent = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main">
        <Topbar title="Patient Dashboard" />
        <div className="page-content fade-in">
          <p className="page-title">Good day, {user?.fullName?.split(' ')[0]} 👋</p>
          <p className="page-subtitle">Here's your health summary for today</p>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { icon: '📅', label: 'Upcoming', value: upcoming.length, cls: 'stat-icon-blue', action: () => navigate('/patient/appointments') },
              { icon: '📋', label: 'Medical Records', value: records.length, cls: 'stat-icon-green', action: () => navigate('/patient/records') },
              { icon: '💳', label: 'Payments', value: payments.length, cls: 'stat-icon-yellow', action: () => navigate('/patient/payments') },
              { icon: '💰', label: 'Total Spent', value: `₹${totalSpent.toLocaleString()}`, cls: 'stat-icon-red', action: () => navigate('/patient/payments') },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ cursor: 'pointer' }} onClick={s.action}>
                <div className={`stat-icon ${s.cls}`} style={{ fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '—' : s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Review Unlock Notifications */}
          {reviewableAppts.length > 0 && (
            <div className="alert" style={{ background: 'linear-gradient(135deg, #fef08a 0%, #fcd34d 100%)', borderColor: '#facc15', marginBottom: 24, borderLeft: '4px solid #facc15' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Star size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14, marginBottom: 6 }}>
                    ⭐ Review Unlocked! ({reviewableAppts.length})
                  </div>
                  <div style={{ color: '#b45309', fontSize: 13, marginBottom: 10 }}>
                    You completed {reviewableAppts.length} appointment{reviewableAppts.length > 1 ? 's' : ''} and can now share your feedback:
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {reviewableAppts.slice(0, 2).map(appt => (
                      <button
                        key={appt.appointmentId}
                        className="btn"
                        style={{
                          background: '#fff3cd',
                          border: '1px solid #d97706',
                          color: '#d97706',
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate('/patient/appointments')}
                      >
                        Review Dr. {getDoctorName(providers[appt.providerId])}
                      </button>
                    ))}
                    {reviewableAppts.length > 2 && (
                      <button
                        className="btn"
                        style={{
                          background: '#fff3cd',
                          border: '1px solid #d97706',
                          color: '#d97706',
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate('/patient/appointments')}
                      >
                        +{reviewableAppts.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Upcoming Appointments */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Upcoming Appointments</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patient/appointments')}>
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {loading ? <Loader text="Loading..." /> : upcoming.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-title">No upcoming appointments</div>
                    <button className="btn btn-primary btn-sm mt-2" onClick={() => navigate('/find-doctors')}>
                      Find a Doctor
                    </button>
                  </div>
                ) : upcoming.slice(0, 4).map(a => {
                  const d = new Date(a.appointmentDate);
                  return (
                    <div key={a.appointmentId} className="appt-card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
                      <div className="appt-date-box">
                        <div className="appt-day">{d.getDate()}</div>
                        <div className="appt-month">{d.toLocaleString('en', { month: 'short' })}</div>
                      </div>
                      <div className="appt-info">
                        <div className="appt-doctor">👨‍⚕️ {getDoctorName(providers[a.providerId])}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Appointment #{a.appointmentId}</div>
                        <div className="appt-meta">
                          <span>⏰ {formatTime(a.startTime)}</span>
                          <span>📍 {a.modeOfConsultation}</span>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Records */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent Medical Records</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patient/records')}>
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {loading ? <Loader text="Loading..." /> : records.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">No records yet</div>
                    <p>Records appear after completed consultations</p>
                  </div>
                ) : records.slice(0, 4).map(r => (
                  <div key={r.recordId} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.diagnosis || 'Diagnosis N/A'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {formatDate(r.createdAt)}
                      {r.followUpDate && <span style={{ marginLeft: 10, color: 'var(--primary)' }}>Follow-up: {formatDate(r.followUpDate)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card mt-6">
            <div className="card-header"><span className="card-title">Quick Actions</span></div>
            <div className="card-body">
              <div className="grid-4" style={{ gap: 12 }}>
                {[
                  { icon: '🔍', label: 'Find a Doctor', sub: 'Browse 500+ specialists', action: () => navigate('/find-doctors') },
                  { icon: '📅', label: 'My Appointments', sub: 'View & manage bookings', action: () => navigate('/patient/appointments') },
                  { icon: '📋', label: 'Medical Records', sub: 'Access health history', action: () => navigate('/patient/records') },
                  { icon: '💳', label: 'Payment History', sub: 'View transactions', action: () => navigate('/patient/payments') },
                ].map(a => (
                  <div key={a.label} onClick={a.action} style={{ padding: 20, borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ fontSize: 30, marginBottom: 10 }}>{a.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{a.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
