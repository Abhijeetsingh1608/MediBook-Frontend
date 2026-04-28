import React, { useState, useEffect } from 'react';
import { ProviderSidebar, Topbar, StatusBadge, Loader } from '../../components/Layout';
import { slotAPI, providerAPI, getUser, formatTime, formatDate } from '../../utils/api';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';

function AddSlotModal({ providerId, onClose, onDone }) {
  const [form, setForm] = useState({
    date: '', startTime: '', endTime: '', durationMinutes: 30, recurrence: 'NONE', recurrenceEndDate: ''
  });
  const [mode, setMode] = useState('single'); // single | bulk | recurring
  const [loading, setLoading] = useState(false);
  
  // Auto-calculate duration when start or end time changes
  useEffect(() => {
    if (form.startTime && form.endTime && form.endTime > form.startTime) {
      const [startHour, startMin] = form.startTime.split(':').map(Number);
      const [endHour, endMin] = form.endTime.split(':').map(Number);
      const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      setForm(p => ({ ...p, durationMinutes: duration }));
    }
  }, [form.startTime, form.endTime]);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

const submit = async () => {
    if (!providerId || Number(providerId) <= 0) {
      alert('Provider profile is not loaded yet. Please refresh and try again.');
      return;
    }

    // ── Validation ──
    const today = new Date().toISOString().split('T')[0];

    if (!form.date) { alert('Please select a date.'); return; }
    if (form.date < today) { alert('Date is in the past. Choose today or a future date.'); return; }

    if (!form.startTime) { alert('Please enter a start time.'); return; }
    if (form.date === today) {
      const [h, m] = form.startTime.split(':').map(Number);
      const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
      if (slotTime <= new Date()) { alert('Start time is already in the past. Choose a future time.'); return; }
    }

    if (!form.endTime) { alert('Please enter an end time.'); return; }
    if (form.endTime <= form.startTime) { alert('End time must be after start time.'); return; }

    if (mode === 'recurring') {
      if (!form.recurrenceEndDate) { alert('Please select a recurrence end date.'); return; }
      if (form.recurrenceEndDate < form.date) { alert('Recurrence end date must be on or after start date.'); return; }
    }
    // ── End Validation ──

    setLoading(true);
    
    const payload = { ...form, providerId, durationMinutes: parseInt(form.durationMinutes) };
    try {
      if (mode === 'single') await slotAPI.add(payload);
      else if (mode === 'recurring') await slotAPI.generateRecurring({ ...payload, recurrence: form.recurrence || 'DAILY' });
      onDone();
    } catch (e) { alert(e.response?.data?.message || 'Failed to add slot.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">Add Availability Slots</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{ key: 'single', label: 'Single Slot' }, { key: 'recurring', label: 'Recurring' }].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`btn btn-sm ${mode === m.key ? 'btn-primary' : 'btn-outline'}`}>{m.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Date</label>
             <input className="form-input" type="date" name="date" value={form.date}
  min={new Date().toISOString().split('T')[0]}
  onChange={handle} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input className="form-input" type="time" name="startTime" value={form.startTime}
  min={form.date === new Date().toISOString().split('T')[0]
    ? new Date(Date.now() + 60000).toTimeString().slice(0,5)
    : undefined}
  onChange={handle} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
               <input className="form-input" type="time" name="endTime" value={form.endTime}
  min={form.startTime || undefined}
  onChange={handle} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input className="form-input" type="number" name="durationMinutes" value={form.durationMinutes} readOnly disabled style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
              <small style={{ color: '#888', marginTop: 4, display: 'block' }}>Auto-calculated from start and end time</small>
            </div>

            {mode === 'recurring' && (
              <>
                <div className="form-group">
                  <label className="form-label">Recurrence Pattern</label>
                  <select className="form-select" name="recurrence" value={form.recurrence} onChange={handle}>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                 <input className="form-input" type="date" name="recurrenceEndDate" value={form.recurrenceEndDate}
  min={form.date || new Date().toISOString().split('T')[0]}
  onChange={handle} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Add Slot(s)'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProviderSchedule() {
  const user = getUser();
  const [providerId, setProviderId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProvider = async () => {
      try {
        const provRes = await providerAPI.getByUserId(user.userId);
        const pid = Number(provRes.data?.providerId || 0);
        if (pid <= 0) throw new Error('Invalid provider mapping');
        setProviderId(pid);
        
        const slotsRes = await slotAPI.getByProvider(pid);
        setSlots(slotsRes.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to load provider or slots:', err);
        setProviderId(null);
        setSlots([]);
        setError('Failed to load your schedule. Retrying in a moment...');
        // Auto-retry after 3 seconds
        setTimeout(() => loadProvider(), 3000);
      } finally {
        setLoading(false);
      }
    };
    
    loadProvider();
  }, [user.userId]);

  const reload = () => {
    if (!providerId) return;
    slotAPI.getByProvider(providerId).then(r => setSlots(r.data || [])).catch(() => {});
  };

  const blockSlot = async (id) => {
    setActionLoading(id + '_block');
    try { await slotAPI.block(id); reload(); } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const unblockSlot = async (id) => {
    setActionLoading(id + '_unblock');
    try { await slotAPI.unblock(id); reload(); } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const deleteSlot = async (id) => {
    if (!confirm('Delete this slot?')) return;
    setActionLoading(id + '_del');
    try { await slotAPI.delete(id); reload(); } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const filtered = filterDate ? slots.filter(s => s.date === filterDate) : slots;

  const grouped = filtered.reduce((acc, s) => {
    const key = s.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="dashboard-layout">
      <ProviderSidebar />
      <div className="dashboard-main">
        <Topbar title="My Schedule" />
        <div className="page-content fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p className="page-title">Manage Schedule</p>
              <p className="page-subtitle">{slots.length} total slots</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="form-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                style={{ width: 170 }} placeholder="Filter by date" />
              <button className="btn btn-primary" onClick={() => setShowModal(true)} disabled={!providerId}>
                <Plus size={16} /> Add Slots
              </button>
            </div>
          </div>

          {!providerId && !loading && (
            <div className="alert alert-danger mb-3" style={{ padding: 16, borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>⚠️ Unable to load your profile</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#7f1d1d' }}>{error || 'Please log out and log in again.'}</p>
                </div>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => window.location.reload()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { color: 'var(--primary-light)', border: 'var(--primary)', label: 'Available' },
              { color: '#dcfce7', border: 'var(--secondary)', label: 'Booked' },
              { color: '#f1f5f9', border: '#94a3b8', label: 'Blocked' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: `2px solid ${l.border}` }} />
                {l.label}
              </div>
            ))}
          </div>

          {loading ? <Loader /> : Object.keys(grouped).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">No slots configured</div>
              <p>Add your availability so patients can book appointments</p>
              <button className="btn btn-primary mt-2" onClick={() => setShowModal(true)}>+ Add First Slot</button>
            </div>
          ) : (
            Object.keys(grouped).sort().map(date => (
              <div key={date} className="card mb-4">
                <div className="card-header">
                  <span className="card-title">📅 {formatDate(date)}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{grouped[date].length} slots</span>
                </div>
                <div className="card-body">
                  <div className="slot-grid">
                    {grouped[date].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => {
                      const isBlocked = s.isBlocked;
                      const isBooked = s.isBooked;
                      return (
                        <div key={s.slotId} style={{
                          padding: '10px 12px', borderRadius: 8,
                          border: `2px solid ${isBooked ? 'var(--secondary)' : isBlocked ? '#94a3b8' : 'var(--primary)'}`,
                          background: isBooked ? '#dcfce7' : isBlocked ? '#f1f5f9' : 'var(--primary-light)',
                          fontSize: 13, fontWeight: 600, textAlign: 'center',
                        }}>
                          <div style={{ marginBottom: 6 }}>{formatTime(s.startTime)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{s.durationMinutes}min</div>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {!isBooked && (
                              <>
                                {isBlocked ? (
                                  <button title="Unblock" onClick={() => unblockSlot(s.slotId)}
                                    disabled={actionLoading === s.slotId + '_unblock'}
                                    style={{ background: 'var(--secondary)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>
                                    <Unlock size={10} />
                                  </button>
                                ) : (
                                  <button title="Block" onClick={() => blockSlot(s.slotId)}
                                    disabled={actionLoading === s.slotId + '_block'}
                                    style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>
                                    <Lock size={10} />
                                  </button>
                                )}
                                <button title="Delete" onClick={() => deleteSlot(s.slotId)}
                                  disabled={actionLoading === s.slotId + '_del'}
                                  style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>
                                  <Trash2 size={10} />
                                </button>
                              </>
                            )}
                            {isBooked && <span style={{ fontSize: 10, color: 'var(--secondary)' }}>BOOKED</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {showModal && <AddSlotModal providerId={providerId} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); reload(); }} />}
    </div>
  );
}
