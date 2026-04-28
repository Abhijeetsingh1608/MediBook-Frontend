import React, { useState, useEffect } from 'react';
import { PatientSidebar, Topbar, Loader } from '../../components/Layout';
import { recordAPI, getUser, formatDate, appointmentAPI, providerAPI } from '../../utils/api';

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  if (!provider) return 'Doctor';
  if (provider.fullName && !provider.fullName.includes('Provider')) return provider.fullName;
  if (provider.name && !provider.name.includes('Provider')) return provider.name;
  if (provider.firstName && !provider.firstName.includes('Provider')) return provider.firstName;
  if (provider.doctorName && !provider.doctorName.includes('Provider')) return provider.doctorName;
  return 'Doctor';
};

function RecordDetailModal({ record, onClose, provider }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <span className="modal-title">Medical Record #{record.recordId}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {provider && (
            <div className="record-field">
              <span className="record-field-label">Doctor:</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>👨‍⚕️ {getDoctorName(provider)}</span>
            </div>
          )}
          {[
            { label: 'Diagnosis', value: record.diagnosis },
            { label: 'Prescription', value: record.prescription },
            { label: 'Clinical Notes', value: record.notes },
            { label: 'Follow-Up Date', value: formatDate(record.followUpDate) },
            { label: 'Created', value: formatDate(record.createdAt) },
          ].map(f => f.value && (
            <div key={f.label} className="record-field">
              <span className="record-field-label">{f.label}:</span>
              <span style={{ fontSize: 14, lineHeight: 1.6 }}>{f.value}</span>
            </div>
          ))}
          {record.attachmentUrl && (
            <div style={{ marginTop: 8 }}>
              <a href={record.attachmentUrl} target="_blank" rel="noreferrer"
                className="btn btn-outline btn-sm">📎 View Attachment</a>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function PatientMedicalRecords() {
  const user = getUser();
  const [records, setRecords] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [recordProviders, setRecordProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('records');

  useEffect(() => {
    const load = async () => {
      try {
        const [rec, fu] = await Promise.all([
          recordAPI.getByPatient(user.userId),
          recordAPI.getFollowUps(user.userId),
        ]);
        const recordsData = rec.data || [];
        setRecords(recordsData);
        setFollowUps(fu.data || []);

        // Fetch provider details for records
        const appointmentIds = [...new Set(recordsData.map(r => r.appointmentId))];
        const recordProviderMap = {};
        for (const appointmentId of appointmentIds) {
          try {
            const apptRes = await appointmentAPI.getById(appointmentId);
            const providerId = apptRes.data?.providerId;
            if (providerId) {
              const provRes = await providerAPI.getById(providerId);
              recordProviderMap[appointmentId] = provRes.data;
            }
          } catch (err) {
            console.warn(`Failed to fetch details for appointment ${appointmentId}`);
            recordProviderMap[appointmentId] = null;
          }
        }
        setRecordProviders(recordProviderMap);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main">
        <Topbar title="Medical Records" />
        <div className="page-content fade-in">
          <p className="page-title">My Medical Records</p>
          <p className="page-subtitle">Complete health history from all your consultations</p>

          <div className="tabs">
            <div className={`tab ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>
              All Records ({records.length})
            </div>
            <div className={`tab ${tab === 'followups' ? 'active' : ''}`} onClick={() => setTab('followups')}>
              Upcoming Follow-ups ({followUps.length})
            </div>
          </div>

          {loading ? <Loader /> : tab === 'records' ? (
            records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No medical records yet</div>
                <p>Records are created by your doctor after each completed appointment.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {records.map(r => {
                  // Find provider for this record by fetching from providers map if we have it
                  const getProviderForRecord = () => {
                    // We'll need to get provider from appointments, for now show appointment id
                    return null;
                  };
                  
                  return (
                  <div key={r.recordId} className="record-card" style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div className="record-card-title">🩺 {r.diagnosis || 'General Consultation'}</div>
                        {r.prescription && (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                            💊 {r.prescription.slice(0, 80)}{r.prescription.length > 80 ? '...' : ''}
                          </div>
                        )}
                        {r.notes && (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            📝 {r.notes.slice(0, 80)}{r.notes.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</div>
                        {r.followUpDate && (
                          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                            Follow-up: {formatDate(r.followUpDate)}
                          </div>
                        )}
                        {r.attachmentUrl && (
                          <span className="badge badge-blue" style={{ marginTop: 6 }}>📎 Attachment</span>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">Record #{r.recordId}</span>
                      <span className="badge badge-gray">Appt #{r.appointmentId}</span>
                    </div>
                  </div>
                );
                })}
              </div>
            )
          ) : (
            followUps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📆</div>
                <div className="empty-state-title">No upcoming follow-ups</div>
                <p>You're all caught up! No follow-up appointments scheduled.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {followUps.map(r => (
                  <div key={r.recordId} className="card" style={{ padding: 20, borderLeft: '4px solid var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>🔔 Follow-up Required</div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
                          Diagnosis: {r.diagnosis}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="badge badge-yellow">📅 {formatDate(r.followUpDate)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      {selected && (
        <RecordDetailModal 
          record={selected} 
          onClose={() => setSelected(null)} 
          provider={recordProviders[selected.appointmentId]}
        />
      )}
    </div>
  );
}
