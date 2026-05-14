import React, { useState, useEffect } from 'react';
import { AdminSidebar, Topbar, Stars, Loader } from '../../components/Layout';
import { providerAPI, formatDate } from '../../utils/api';
import { Search, ShieldCheck, ShieldOff, Trash2, FileText, XCircle } from 'lucide-react';

export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selected, setSelected] = useState(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const isVerifiedProvider = (provider) => provider?.verified ?? provider?.isVerified ?? false;
  const isAvailableProvider = (provider) => provider?.available ?? provider?.isAvailable ?? false;

  const load = async () => {
    setLoading(true);
    try {
      const res = await providerAPI.getAll();
      setProviders(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const refreshInterval = setInterval(load, 30000);
    const handleVisibilityChange = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const verify = async (id) => {
    setActionLoading(id + 'v');
    try {
      await providerAPI.verify(id);
      setProviders(prev =>
        prev.map(p =>
          p.providerId === id ? { ...p, verified: true, isVerified: true, verificationNote: null } : p
        )
      );
      alert('Provider verified successfully!');
    } catch (e) {
      console.error('Verify error:', e);
      alert(e.response?.data?.message || 'Failed to verify provider');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (provider) => {
    setRejectTarget(provider);
    setRejectNote('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await providerAPI.reject(rejectTarget.providerId, rejectNote);
      setProviders(prev =>
        prev.map(p =>
          p.providerId === rejectTarget.providerId
            ? { ...p, verified: false, isVerified: false, verificationNote: rejectNote }
            : p
        )
      );
      setRejectTarget(null);
      setRejectNote('');
      alert('Provider rejected. They will see your note on their dashboard.');
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to reject provider');
    } finally {
      setRejecting(false);
    }
  };

  const toggleAvailability = async (id, current) => {
    setActionLoading(id + 'a');
    try {
      await providerAPI.setAvailability(id, !current);
      setProviders(prev =>
        prev.map(p =>
          p.providerId === id ? { ...p, available: !current, isAvailable: !current } : p
        )
      );
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const deleteProvider = async (id) => {
    if (!confirm('Delete this provider permanently?')) return;
    setActionLoading(id + 'd');
    try {
      await providerAPI.delete(id);
      setProviders(prev => prev.filter(p => p.providerId !== id));
    } catch (e) { alert(e.response?.data?.message || 'Error'); }
    finally { setActionLoading(null); }
  };

  const filtered = providers.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = !search || (p.specialization || '').toLowerCase().includes(q) ||
      (p.clinicName || '').toLowerCase().includes(q) ||
      (p.fullName || '').toLowerCase().includes(q);

    const matchesTab = tab === 'all' ||
      (tab === 'pending' && !isVerifiedProvider(p)) ||
      (tab === 'verified' && isVerifiedProvider(p));

    return matchesSearch && matchesTab;
  });

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Provider Management" />

        <div className="page-content fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p className="page-title">Provider Management</p>
              <p className="page-subtitle">{providers.length} providers registered</p>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Providers', value: providers.length, icon: '👨‍⚕️', cls: 'stat-icon-blue' },
              { label: 'Verified', value: providers.filter((p) => isVerifiedProvider(p)).length, icon: '✅', cls: 'stat-icon-green' },
              { label: 'Pending', value: providers.filter((p) => !isVerifiedProvider(p)).length, icon: '⏳', cls: 'stat-icon-yellow' },
              { label: 'Available', value: providers.filter((p) => isAvailableProvider(p)).length, icon: '🟢', cls: 'stat-icon-red' },
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

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 38 }}
                placeholder="Search by name, specialization or clinic..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'pending', 'verified'].map(t => (
                <button key={t}
                  className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? <Loader /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👨‍⚕️</div>
                  <div className="empty-state-title">No providers found</div>
                </div>
              ) : filtered.map(p => (
                <div key={p.providerId} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                    <div className="provider-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                      {p.specialization?.[0] || 'D'}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>{p.fullName || `Provider #${p.providerId}`}</span>

                        <span className={`badge ${isVerifiedProvider(p) ? 'badge-green' : 'badge-yellow'}`}>
                          {isVerifiedProvider(p) ? '✓ Verified' : '⏳ Pending'}
                        </span>

                        <span className={`badge ${isAvailableProvider(p) ? 'badge-blue' : 'badge-gray'}`}>
                          {isAvailableProvider(p) ? '● Available' : '● Unavailable'}
                        </span>

                        {/* Document badge */}
                        {p.documentUrl
                          ? <span className="badge badge-green" style={{ cursor: 'pointer' }}
                              onClick={() => window.open(p.documentUrl, '_blank')}>
                              📄 Doc Uploaded
                            </span>
                          : <span className="badge badge-red">⚠ No Document</span>
                        }
                      </div>

                      <p style={{ color: 'var(--primary)' }}>{p.specialization}</p>
                      <p>{p.qualification} · {p.experienceYears} yrs exp</p>
                      <p>🏥 {p.clinicName} · {p.clinicAddress}</p>

                      {/* Rejection note if exists */}
                      {p.verificationNote && (
                        <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginTop: 6 }}>
                          ❌ Rejection note: {p.verificationNote}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {/* View document */}
                      {p.documentUrl && (
                        <a href={p.documentUrl} target="_blank" rel="noreferrer"
                          className="btn btn-outline btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={14} /> View Doc
                        </a>
                      )}

                      {/* Verify */}
                      {!isVerifiedProvider(p) && (
                        <button className="btn btn-secondary btn-sm"
                          disabled={actionLoading === p.providerId + 'v'}
                          onClick={() => verify(p.providerId)}>
                          {actionLoading === p.providerId + 'v' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✓ Verify'}
                        </button>
                      )}

                      {/* Reject */}
                      {!isVerifiedProvider(p) && (
                        <button className="btn btn-sm"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
                          onClick={() => openRejectModal(p)}>
                          <XCircle size={14} /> Reject
                        </button>
                      )}

                      <button className="btn btn-outline btn-sm"
                        onClick={() => toggleAvailability(p.providerId, isAvailableProvider(p))}>
                        {isAvailableProvider(p) ? 'Disable' : 'Enable'}
                      </button>

                      <button className="btn btn-danger btn-sm"
                        onClick={() => deleteProvider(p.providerId)}>
                        Delete
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── REJECT MODAL ── */}
      {rejectTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 0 }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="card-title">❌ Reject Provider</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setRejectTarget(null)}>✕</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, marginBottom: 6 }}>
                Rejecting: <strong>{rejectTarget.fullName || `Provider #${rejectTarget.providerId}`}</strong>
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                The provider will see this note on their dashboard explaining why they were rejected.
              </p>
              <div className="form-group">
                <label className="form-label">Rejection Reason (shown to provider)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Document is unclear, please re-upload a valid medical license."
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ background: '#ef4444', color: 'white', border: 'none' }}
                  onClick={handleReject}
                  disabled={rejecting}
                >
                  {rejecting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
