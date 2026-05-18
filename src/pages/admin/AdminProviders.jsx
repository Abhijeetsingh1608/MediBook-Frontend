import React, { useState, useEffect } from 'react';
import { AdminSidebar, Topbar, Loader } from '../../components/Layout';
import { providerAPI } from '../../utils/api';
import { Search, FileText, XCircle, ExternalLink } from 'lucide-react';

export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // PDF preview modal state
  const [pdfPreview, setPdfPreview] = useState(null); // { provider, url }

  const isVerifiedProvider = (p) => p?.verified ?? p?.isVerified ?? false;
  const isAvailableProvider = (p) => p?.available ?? p?.isAvailable ?? false;
  const hasDocPending = (p) => p.documentUrl && !isVerifiedProvider(p);

  const load = async () => {
    setLoading(true);
    try {
      const res = await providerAPI.getAll();
      setProviders(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const verify = async (id) => {
    setActionLoading(id + 'v');
    try {
      await providerAPI.verify(id);
      setProviders(prev => prev.map(p =>
        p.providerId === id ? { ...p, verified: true, isVerified: true, verificationNote: null } : p
      ));
      if (pdfPreview?.provider?.providerId === id) setPdfPreview(null);
      alert('Provider verified successfully!');
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to verify provider');
    } finally { setActionLoading(null); }
  };

  const openRejectModal = (provider) => {
    setPdfPreview(null);
    setRejectTarget(provider);
    setRejectNote('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await providerAPI.reject(rejectTarget.providerId, rejectNote);
      setProviders(prev => prev.map(p =>
        p.providerId === rejectTarget.providerId
          ? { ...p, verified: false, isVerified: false, verificationNote: rejectNote }
          : p
      ));
      setRejectTarget(null);
      setRejectNote('');
      alert('Provider rejected. They will see your note on their dashboard.');
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to reject provider');
    } finally { setRejecting(false); }
  };

  const toggleAvailability = async (id, current) => {
    setActionLoading(id + 'a');
    try {
      await providerAPI.setAvailability(id, !current);
      setProviders(prev => prev.map(p =>
        p.providerId === id ? { ...p, available: !current, isAvailable: !current } : p
      ));
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

  const docsAwaitingReview = providers.filter(hasDocPending);

  const filtered = providers.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (p.fullName || '').toLowerCase().includes(q) ||
      (p.specialization || '').toLowerCase().includes(q) ||
      (p.clinicName || '').toLowerCase().includes(q);
    const matchTab =
      tab === 'all' ||
      (tab === 'review' && hasDocPending(p)) ||
      (tab === 'pending' && !isVerifiedProvider(p)) ||
      (tab === 'verified' && isVerifiedProvider(p));
    return matchSearch && matchTab;
  });

  const securePdfUrl = pdfPreview?.url?.replace(/^http:\/\//i, 'https://') || '';

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

          {/* Docs awaiting review banner */}
          {docsAwaitingReview.length > 0 && (
            <div onClick={() => setTab('review')} style={{
              background: 'rgba(245,158,11,0.1)', border: '1.5px solid #f59e0b',
              borderRadius: 'var(--radius)', padding: '12px 18px', marginBottom: 20,
              display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer'
            }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#f59e0b' }}>
                  {docsAwaitingReview.length} provider{docsAwaitingReview.length > 1 ? 's' : ''} awaiting document review
                </strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {docsAwaitingReview.map(p => p.fullName || `#${p.providerId}`).join(', ')} — Click to review
                </p>
              </div>
              <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>View →</span>
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Providers', value: providers.length, icon: '👨‍⚕️', cls: 'stat-icon-blue' },
              { label: 'Verified', value: providers.filter(isVerifiedProvider).length, icon: '✅', cls: 'stat-icon-green' },
              { label: 'Pending', value: providers.filter(p => !isVerifiedProvider(p)).length, icon: '⏳', cls: 'stat-icon-yellow' },
              { label: 'Docs to Review', value: docsAwaitingReview.length, icon: '📄', cls: 'stat-icon-red' },
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

          {/* Search + Tabs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 38 }}
                placeholder="Search by name, specialization or clinic..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'review', label: `📋 Docs (${docsAwaitingReview.length})` },
                { key: 'pending', label: 'Pending' },
                { key: 'verified', label: 'Verified' },
              ].map(t => (
                <button key={t.key}
                  className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Provider list */}
          {loading ? <Loader /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👨‍⚕️</div>
                  <div className="empty-state-title">No providers found</div>
                </div>
              ) : filtered.map(p => (
                <div key={p.providerId} className="card" style={{
                  padding: 20,
                  border: hasDocPending(p) ? '2px solid #f59e0b' : undefined,
                }}>
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

                        {p.documentUrl
                          ? (
                            <span className="badge" style={{
                              background: hasDocPending(p) ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                              color: hasDocPending(p) ? '#f59e0b' : '#22c55e',
                              border: `1px solid ${hasDocPending(p) ? '#f59e0b' : '#22c55e'}`,
                              cursor: 'pointer',
                            }} onClick={() => setPdfPreview({ provider: p, url: p.documentUrl })}>
                              📄 {hasDocPending(p) ? 'Review Required' : 'Doc Verified'}
                            </span>
                          )
                          : <span className="badge badge-red">⚠ No Document</span>
                        }
                      </div>

                      <p style={{ color: 'var(--primary)' }}>{p.specialization}</p>
                      <p>{p.qualification} · {p.experienceYears} yrs exp</p>
                      <p>🏥 {p.clinicName} · {p.clinicAddress}</p>

                      {p.verificationNote && (
                        <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginTop: 6 }}>
                          ❌ Rejection note: {p.verificationNote}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {p.documentUrl && (
                        <button className="btn btn-outline btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => setPdfPreview({ provider: p, url: p.documentUrl })}>
                          <FileText size={14} /> View Doc
                        </button>
                      )}
                      {!isVerifiedProvider(p) && (
                        <button className="btn btn-secondary btn-sm"
                          disabled={actionLoading === p.providerId + 'v'}
                          onClick={() => verify(p.providerId)}>
                          {actionLoading === p.providerId + 'v'
                            ? <span className="spinner" style={{ width: 14, height: 14 }} />
                            : '✓ Verify'}
                        </button>
                      )}
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
                      <button className="btn btn-danger btn-sm" onClick={() => deleteProvider(p.providerId)}>
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

      {/* ── PDF PREVIEW MODAL ── */}
      {pdfPreview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 950, height: '90vh',
            padding: 0, display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <span className="card-title">📄 Verification Document</span>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {pdfPreview.provider.fullName} — {pdfPreview.provider.specialization}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={securePdfUrl} target="_blank" rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ExternalLink size={13} /> Open in Tab
                </a>
                <button className="btn btn-ghost btn-sm" onClick={() => setPdfPreview(null)}>✕</button>
              </div>
            </div>

            {/* PDF Preview (Using iframe for better PDF rendering) */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: '#e5e7eb' }}>
              <iframe
                src={securePdfUrl}
                title="Document Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: 20 }}>
                <p>Preview cannot be shown directly.</p>
                <a href={securePdfUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ marginTop: 12 }}>
                  Open Document in New Tab
                </a>
              </div>
            </div>

            {/* Action bar */}
            {!isVerifiedProvider(pdfPreview.provider) && (
              <div style={{
                padding: '14px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
                flexShrink: 0, background: 'var(--bg-secondary)',
              }}>
                <p style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Review the document above, then take action:
                </p>
                <button className="btn btn-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
                  onClick={() => openRejectModal(pdfPreview.provider)}>
                  <XCircle size={14} /> Reject
                </button>
                <button className="btn btn-secondary btn-sm"
                  disabled={actionLoading === pdfPreview.provider.providerId + 'v'}
                  onClick={() => verify(pdfPreview.provider.providerId)}>
                  {actionLoading === pdfPreview.provider.providerId + 'v'
                    ? <span className="spinner" style={{ width: 14, height: 14 }} />
                    : '✅ Verify Provider'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
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
                  className="form-input" rows={3}
                  placeholder="e.g. Document is unclear, please re-upload a valid medical license."
                  value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
                  Cancel
                </button>
                <button className="btn" style={{ background: '#ef4444', color: 'white', border: 'none' }}
                  onClick={handleReject} disabled={rejecting}>
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
