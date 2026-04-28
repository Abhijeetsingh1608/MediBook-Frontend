import React, { useState, useEffect } from 'react';
import { Search, Trash2, Star, RefreshCw } from 'lucide-react';
import { AdminSidebar, Topbar, Loader, Stars } from '../../components/Layout';
import { reviewAPI, providerAPI, formatDate } from '../../utils/api';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [providerMap, setProviderMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState(0);   // 0 = all
  const [deleting, setDeleting] = useState({});
  const [alert, setAlert] = useState(null);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const provRes = await providerAPI.getAll();
        const provList = provRes.data || [];

        // map providerId -> name & specialization
        const pMap = {};
        provList.forEach(p => {
          pMap[p.providerId] = { fullName: p.fullName, specialization: p.specialization };
        });
        setProviderMap(pMap);

        // fetch reviews for every provider
        const allReviews = [];
        await Promise.allSettled(
          provList.map(p =>
            reviewAPI.getByProvider(p.providerId).then(r =>
              (r.data || []).forEach(rv => allReviews.push({
                ...rv,
                providerName: p.fullName,
                specialization: p.specialization,
              }))
            )
          )
        );

        // deduplicate & sort newest first
        const seen = new Set();
        const deduped = allReviews
          .filter(r => { if (seen.has(r.reviewId)) return false; seen.add(r.reviewId); return true; })
          .sort((a, b) => new Date(b.reviewDate || 0) - new Date(a.reviewDate || 0));

        setReviews(deduped);
      } catch {
        showAlert('error', 'Failed to load reviews.');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = reviews.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      String(r.reviewId).includes(q) ||
      (r.comment || '').toLowerCase().includes(q) ||
      (r.providerName || '').toLowerCase().includes(q) ||
      String(r.patientId).includes(q);
    const matchRating = ratingFilter === 0 || r.rating === ratingFilter;
    return matchSearch && matchRating;
  });

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Permanently delete this review?')) return;
    setDeleting(d => ({ ...d, [reviewId]: true }));
    try {
      await reviewAPI.delete(reviewId);
      setReviews(prev => prev.filter(r => r.reviewId !== reviewId));
      showAlert('success', `Review #${reviewId} deleted.`);
    } catch (e) {
      showAlert('error', e.response?.data?.message || 'Failed to delete review.');
    } finally { setDeleting(d => ({ ...d, [reviewId]: false })); }
  };

  // Stats
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '—';
  const lowRated   = reviews.filter(r => r.rating <= 2).length;
  const highRated  = reviews.filter(r => r.rating >= 4).length;

  const ratingColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6', 4: '#10b981', 5: '#10b981' };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Reviews" />
        <div className="page-content fade-in">
          <p className="page-title">Review Moderation</p>
          <p className="page-subtitle">View, filter, and remove inappropriate or fraudulent patient reviews</p>

          {alert && (
            <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
              {alert.type === 'success' ? '✓' : '✕'} {alert.msg}
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Reviews',   value: reviews.length,  icon: '⭐', color: 'stat-icon-blue'   },
              { label: 'Avg Rating',      value: avg,             icon: '📊', color: 'stat-icon-green'  },
              { label: 'High Rated (4–5)', value: highRated,      icon: '👍', color: 'stat-icon-yellow' },
              { label: 'Low Rated (1–2)', value: lowRated,        icon: '⚠',  color: 'stat-icon-red'   },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.color}`} style={{ fontSize: 22 }}>{s.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '—' : s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 38 }}
                placeholder="Search by patient, doctor, or review content..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Rating filter buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Rating:</span>
              <button className={`btn btn-sm ${ratingFilter === 0 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRatingFilter(0)}>All</button>
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r}
                  className={`btn btn-sm ${ratingFilter === r ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setRatingFilter(ratingFilter === r ? 0 : r)}>
                  {'★'.repeat(r)}
                </button>
              ))}
            </div>

            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setRatingFilter(0); }}>
              <RefreshCw size={14} /> Reset
            </button>
          </div>

          {loading ? <Loader text="Loading reviews..." /> : (
            <>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">{filtered.length} review{filtered.length !== 1 ? 's' : ''}</span>
                  <span className="badge badge-gray">{reviews.length} total</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">⭐</div>
                    <div className="empty-state-title">No reviews found</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No patient reviews match your current filters.</p>
                  </div>
                ) : (
                  <div>
                    {filtered.map(r => (
                      <div key={r.reviewId}
                        style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                        {/* Rating circle */}
                        <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                          background: `${ratingColors[r.rating]}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 800, color: ratingColors[r.rating] }}>
                          {r.rating}
                        </div>

                        <div style={{ flex: 1 }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                            <Stars rating={r.rating} size={14} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                              {r.providerName ? `Dr. ${r.providerName}` : `Provider #${r.providerId}`}
                            </span>
                            {r.specialization && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {r.specialization}</span>
                            )}
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                              Patient #{r.patientId} · {formatDate(r.reviewDate)}
                            </span>
                          </div>

                          {/* Review text */}
                          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65,
                            background: r.rating <= 2 ? 'var(--danger-light)' : 'var(--bg)',
                            padding: '10px 14px', borderRadius: 8, margin: 0 }}>
                            {r.comment || <em style={{ color: 'var(--text-muted)' }}>No comment provided.</em>}
                          </p>

                          {/* Flags */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {r.isAnonymous && (
                              <span className="badge badge-gray" style={{ fontSize: 11 }}>Anonymous</span>
                            )}
                            {!r.isVerified && (
                              <span className="badge badge-yellow" style={{ fontSize: 11 }}>Unverified</span>
                            )}
                            {r.rating <= 2 && (
                              <span className="badge badge-red" style={{ fontSize: 11 }}>⚠ Low Rating</span>
                            )}
                            <span className="badge badge-gray" style={{ fontSize: 11 }}>Review #{r.reviewId}</span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ flexShrink: 0 }}
                          disabled={!!deleting[r.reviewId]}
                          onClick={() => deleteReview(r.reviewId)}
                          title="Delete this review">
                          {deleting[r.reviewId]
                            ? <span className="spinner" style={{ width: 14, height: 14 }} />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Per-provider rating summary */}
              {reviews.length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                  <div className="card-header">
                    <span className="card-title">Provider Rating Summary</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Doctor</th><th>Specialization</th><th>Reviews</th><th>Avg Rating</th><th>Lowest</th></tr>
                      </thead>
                      <tbody>
                        {Object.entries(
                          reviews.reduce((acc, r) => {
                            const key = r.providerId;
                            if (!acc[key]) acc[key] = { name: r.providerName, spec: r.specialization, ratings: [] };
                            acc[key].ratings.push(r.rating);
                            return acc;
                          }, {})
                        ).map(([pid, data]) => {
                          const avg = (data.ratings.reduce((s, n) => s + n, 0) / data.ratings.length);
                          const min = Math.min(...data.ratings);
                          return (
                            <tr key={pid}>
                              <td style={{ fontWeight: 600, fontSize: 13 }}>
                                {data.name ? `Dr. ${data.name}` : `Provider #${pid}`}
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.spec || '—'}</td>
                              <td style={{ fontSize: 13 }}>{data.ratings.length}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Stars rating={Math.round(avg)} size={13} />
                                  <span style={{ fontSize: 13, fontWeight: 700 }}>{avg.toFixed(1)}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: 13, fontWeight: 700, color: ratingColors[min] }}>
                                  {'★'.repeat(min)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}