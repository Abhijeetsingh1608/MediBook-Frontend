import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, AlertCircle, UploadCloud, FileText, XCircle } from 'lucide-react';
import { ProviderSidebar, Topbar, StatusBadge, Loader } from '../../components/Layout';
import { appointmentAPI, providerAPI, paymentAPI, getUser, formatTime, formatDate, authAPI } from '../../utils/api';

// Helper to get patient name
const getPatientName = (patient) => {
  if (!patient) return 'Patient';
  if (patient.fullName && !patient.fullName.includes('Patient')) return patient.fullName;
  if (patient.name && !patient.name.includes('Patient')) return patient.name;
  if (patient.firstName && !patient.firstName.includes('Patient')) return patient.firstName;
  return 'Patient';
};

export default function ProviderDashboard() {
  const user = getUser();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [allAppts, setAllAppts] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [cancelledAppts, setCancelledAppts] = useState([]);
  const [patientMap, setPatientMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Document upload state
  const docInputRef = useRef();
  const [docFile, setDocFile] = useState(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const load = async () => {
      try {
        const prov = await providerAPI.getByUserId(user.userId);
        setProvider(prov.data);
        const pid = prov.data.providerId;
        const [todayR, allR, revR] = await Promise.all([
          appointmentAPI.getByProviderDate(pid, today),
          appointmentAPI.getByProvider(pid),
          paymentAPI.getTotalRevenue(),
        ]);
        
        const allApptsList = allR.data || [];
        setTodayAppts(todayR.data || []);
        setAllAppts(allApptsList);
        setRevenue(revR.data.totalRevenue || 0);
        
        // Get cancelled appointments (for refund notifications)
        const cancelled = allApptsList.filter(a => a.status === 'CANCELLED');
        setCancelledAppts(cancelled);
        
        // Fetch patient details for cancelled appointments
        const uniquePatientIds = [...new Set(cancelled.map(a => a.patientId))];
        const pMap = {};
        for (const patientId of uniquePatientIds) {
          try {
            const patRes = await authAPI.getProfile(patientId);
            pMap[patientId] = patRes.data;
          } catch (err) {
            console.warn(`Failed to fetch patient ${patientId}`);
            pMap[patientId] = { userId: patientId, fullName: `Patient #${patientId}` };
          }
        }
        setPatientMap(pMap);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  const completeAppt = async (id) => {
    setActionLoading(id);
    try {
      await appointmentAPI.complete(id);
      setTodayAppts(prev => prev.map(a => a.appointmentId === id ? { ...a, status: 'COMPLETED' } : a));
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const handleDocSelect = (e) => {
    const file = e.target.files?.[0];
    setDocError('');
    if (!file) return;
    if (file.type !== 'application/pdf') { setDocError('Only PDF files are allowed.'); return; }
    if (file.size > 10 * 1024 * 1024) { setDocError('File must be under 10MB.'); return; }
    setDocFile(file);
  };

  const handleDocUpload = async () => {
    if (!docFile) return;
    setDocUploading(true);
    setDocError('');
    try {
      // Step 1: Upload PDF to Cloudinary
      const url = await providerAPI.uploadDocument(docFile);
      // Step 2: Save the URL to backend (only updates documentUrl, nothing else)
      await providerAPI.updateDocumentUrl(provider.providerId, url);
      setProvider(prev => ({ ...prev, documentUrl: url }));
      setDocFile(null);
      alert('✅ Document uploaded successfully! Admin will review it shortly.');
    } catch (err) {
      const msg = err.message || 'Upload failed. Please try again.';
      // Give helpful hint if it looks like a Cloudinary preset issue
      if (msg.toLowerCase().includes('upload preset') || msg.toLowerCase().includes('401') || msg.includes('400')) {
        setDocError(`Upload failed: ${msg}. Make sure your Cloudinary preset "medibook_docs" is set to Unsigned and allows Raw/Auto uploads.`);
      } else {
        setDocError(msg);
      }
    } finally {
      setDocUploading(false);
    }
  };

  const stats = [
    { icon: '📅', label: "Today's Appointments", value: todayAppts.length, cls: 'stat-icon-blue' },
    { icon: '📊', label: 'Total Appointments', value: allAppts.length, cls: 'stat-icon-green' },
    { icon: '✅', label: 'Completed', value: allAppts.filter(a => a.status === 'COMPLETED').length, cls: 'stat-icon-yellow' },
    { icon: '💰', label: 'Total Revenue', value: `₹${revenue.toLocaleString()}`, cls: 'stat-icon-red' },
  ];

  return (
    <div className="dashboard-layout">
      <ProviderSidebar />
      <div className="dashboard-main">
        <Topbar title="Provider Dashboard" />
        <div className="page-content fade-in">

          {/* Rejection notice */}
          {provider && !provider.verified && provider.verificationNote && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1.5px solid var(--danger,#ef4444)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <XCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Profile Not Approved</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Admin note: {provider.verificationNote}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Please re-upload your documents and wait for re-review.</p>
              </div>
            </div>
          )}

          {/* Pending verification warning */}
          {provider && !(provider.verified ?? provider.isVerified) && !provider.verificationNote && (
            <div className="alert alert-warning mb-4">
              ⚠️ Your profile is pending admin verification. You won't appear in patient searches until verified.
            </div>
          )}

          <p className="page-title">Welcome, Dr. {user?.fullName?.split(' ')[0]} 👨‍⚕️</p>
          <p className="page-subtitle">{formatDate(new Date().toISOString())} — {provider?.specialization}</p>

          <div className="stats-grid">
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.cls}`} style={{ fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '—' : s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Today's appointments */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Today's Schedule</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/provider/appointments')}>
                  All <ArrowRight size={14} />
                </button>
              </div>
              <div style={{ padding: 0 }}>
                {loading ? <Loader /> : todayAppts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎉</div>
                    <div className="empty-state-title">No appointments today</div>
                    <p>Enjoy your free day!</p>
                  </div>
                ) : todayAppts.map(a => (
                  <div key={a.appointmentId} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 56 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>{formatTime(a.startTime)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Patient #{a.patientId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.serviceType} · {a.modeOfConsultation}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <StatusBadge status={a.status} />
                      {(a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && (
                        <button className="btn btn-secondary btn-sm" disabled={actionLoading === a.appointmentId}
                          onClick={() => completeAppt(a.appointmentId)}>
                          {actionLoading === a.appointmentId ? <span className="spinner" /> : '✓ Done'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Refund Notifications */}
              {cancelledAppts.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">💰 Refund Notifications ({cancelledAppts.length})</span>
                  </div>
                  <div className="card-body" style={{ padding: 0, maxHeight: 250, overflowY: 'auto' }}>
                    {cancelledAppts.map(appt => (
                      <div key={appt.appointmentId} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {getPatientName(patientMap[appt.patientId])} cancelled Appt #{appt.appointmentId}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            🗓️ {formatDate(appt.appointmentDate)} {formatTime(appt.startTime)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                            ✅ Refund Auto-Processed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-header"><span className="card-title">Quick Actions</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: '📅', label: 'Manage Schedule', sub: 'Add or block time slots', path: '/provider/schedule' },
                    { icon: '📋', label: 'Appointments', sub: 'View all appointments', path: '/provider/appointments' },
                    { icon: '📄', label: 'Medical Records', sub: 'Create & edit records', path: '/provider/records' },
                    { icon: '💳', label: 'Earnings', sub: 'Revenue analytics', path: '/provider/earnings' },
                  ].map(a => (
                    <div key={a.label} onClick={() => navigate(a.path)}
                      style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <span style={{ fontSize: 22 }}>{a.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Upload Card — shown when pending */}
              {provider && !(provider.verified ?? provider.isVerified) && (
                <div className="card" style={{ border: provider.documentUrl ? '1.5px solid var(--success, #22c55e)' : '1.5px solid var(--primary)' }}>
                  <div className="card-header">
                    <span className="card-title">📄 Verification Documents</span>
                    {provider.documentUrl && <span className="badge badge-green">✓ Uploaded</span>}
                  </div>
                  <div className="card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                      Upload your medical license, degree certificate, or experience letter (PDF only, max 10MB) for admin verification.
                    </p>

                    {/* Existing doc */}
                    {provider.documentUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 14, border: '1px solid var(--border)' }}>
                        <FileText size={18} color="var(--primary)" />
                        <span style={{ fontSize: 13, flex: 1 }}>Document uploaded</span>
                        <a href={provider.documentUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>View PDF</a>
                      </div>
                    )}

                    {/* File picker */}
                    <input
                      ref={docInputRef}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={handleDocSelect}
                    />

                    {docFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 12, border: '1px dashed var(--primary)' }}>
                        <FileText size={18} color="var(--primary)" />
                        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docFile.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(docFile.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setDocFile(null)}>
                          <XCircle size={16} color="var(--text-muted)" />
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-outline btn-sm" style={{ width: '100%', marginBottom: 12, gap: 8 }}
                        onClick={() => docInputRef.current?.click()}>
                        <UploadCloud size={16} /> Choose PDF File
                      </button>
                    )}

                    {docError && <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginBottom: 10 }}>⚠️ {docError}</p>}

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={!docFile || docUploading}
                      onClick={handleDocUpload}
                    >
                      {docUploading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Uploading...</> : <><UploadCloud size={16} /> Upload Document</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Profile snippet */}
              {provider && (
                <div className="card">
                  <div className="card-body">
                    <p style={{ fontWeight: 700, marginBottom: 12 }}>My Profile</p>
                    {[
                      { label: 'Specialization', value: provider.specialization },
                      { label: 'Qualification', value: provider.qualification },
                      { label: 'Clinic', value: provider.clinicName },
                      { label: 'Rating', value: provider.avgRating ? `${provider.avgRating.toFixed(1)} ⭐` : 'No ratings yet' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600 }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

