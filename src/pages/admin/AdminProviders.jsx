import React, { useState, useEffect } from 'react';
import { AdminSidebar, Topbar, Stars, Loader } from '../../components/Layout';
import { providerAPI, formatDate } from '../../utils/api';
import { Search, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';

export default function AdminProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [selected, setSelected] = useState(null);
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
    
    const handleVisibilityChange = () => {
      if (!document.hidden) load();
    };

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
          p.providerId === id ? { ...p, verified: true, isVerified: true } : p
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
      (p.clinicName || '').toLowerCase().includes(q);

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
                placeholder="Search by specialization or clinic..."
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
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>Provider #{p.providerId}</span>

                        <span className={`badge ${isVerifiedProvider(p) ? 'badge-green' : 'badge-yellow'}`}>
                          {p.isVerified ? '✓ Verified' : '⏳ Pending'}
                        </span>

                        <span className={`badge ${isAvailableProvider(p) ? 'badge-blue' : 'badge-gray'}`}>
                          {p.isAvailable ? '● Available' : '● Unavailable'}
                        </span>
                      </div>

                      <p style={{ color: 'var(--primary)' }}>{p.specialization}</p>
                      <p>{p.qualification} · {p.experienceYears} yrs exp</p>
                      <p>🏥 {p.clinicName} · {p.clinicAddress}</p>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isVerifiedProvider(p) && (
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => verify(p.providerId)}>
                          Verify
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
    </div>
  );
}

