import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AdminSidebar, Topbar, Loader } from '../../components/Layout';
import { authAPI, providerAPI, paymentAPI, notifAPI } from '../../utils/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notifForm, setNotifForm] = useState({ title: '', message: '' });
  const [sending, setSending] = useState(false);
  const isVerifiedProvider = (provider) => provider?.verified ?? provider?.isVerified ?? false;

  useEffect(() => {
    Promise.all([
      authAPI.getAllUsers(),
      providerAPI.getAll(),
      paymentAPI.getTotalRevenue(),
    ])
      .then(([usersRes, provRes, revRes]) => {
        setUserCount((usersRes.data || []).length);
        setProviders(provRes.data || []);
        setRevenue(revRes.data?.totalRevenue || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sendPlatformNotif = async () => {
    if (!notifForm.title || !notifForm.message) return;

    setSending(true);
    try {
      const usersRes = await authAPI.getAllUsers();
      const activeUsers = (usersRes.data || []).filter((account) => account.isActive !== false);

      if (activeUsers.length === 0) {
        throw new Error('No active users found to receive this notification.');
      }

      await Promise.all(
        activeUsers.map((account) =>
          notifAPI.send({
            recipientId: account.userId,
            recipientName: account.fullName,
            title: notifForm.title,
            message: notifForm.message,
            channel: 'APP',
          })
        )
      );

      setNotifForm({ title: '', message: '' });
      alert(`Platform notification sent to ${activeUsers.length} users!`);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const pendingVerification = providers.filter((provider) => !isVerifiedProvider(provider));

  const stats = [
    { icon: 'Users', label: 'Total Users', value: userCount, cls: 'stat-icon-blue', path: '/admin/users' },
    { icon: 'Pending', label: 'Pending Verification', value: pendingVerification.length, cls: 'stat-icon-yellow', path: '/admin/providers' },
    { icon: 'Revenue', label: 'Total Revenue', value: `Rs ${revenue.toLocaleString()}`, cls: 'stat-icon-green', path: '/admin/payments' },
    { icon: 'Platform', label: 'Platform Revenue', value: `Rs ${Math.round(revenue * 0.1).toLocaleString()}`, cls: 'stat-icon-red', path: '/admin/payments' },
  ];

  const quickLinks = [
    { icon: 'Users', label: 'Manage Users', sub: 'View, suspend, or delete users', path: '/admin/users' },
    { icon: 'Providers', label: 'Verify Providers', sub: 'Review and approve providers', path: '/admin/providers' },
    { icon: 'Appointments', label: 'All Appointments', sub: 'Platform-wide appointments', path: '/admin/appointments' },
    { icon: 'Payments', label: 'Payments and Refunds', sub: 'Transaction management', path: '/admin/payments' },
    { icon: 'Reviews', label: 'Moderate Reviews', sub: 'Remove inappropriate content', path: '/admin/reviews' },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Admin Dashboard" />
        <div className="page-content fade-in">
          <p className="page-title">Admin Dashboard</p>
          <p className="page-subtitle">Platform overview and management</p>

          <div className="stats-grid">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="stat-card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(stat.path)}
              >
                <div className={`stat-icon ${stat.cls}`} style={{ fontSize: 18 }}>{stat.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '-' : stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Pending Verifications</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/providers')}>
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div style={{ padding: 0 }}>
                {loading ? (
                  <Loader />
                ) : pendingVerification.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">Done</div>
                    <div className="empty-state-title">All providers verified</div>
                  </div>
                ) : (
                  pendingVerification.slice(0, 5).map((provider) => (
                    <div
                      key={provider.providerId}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          Dr. {provider.fullName || `User #${provider.userId}`}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {provider.specialization} · {provider.qualification}
                        </div>
                      </div>
                      <span className="badge badge-yellow">Pending</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header"><span className="card-title">Management</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quickLinks.map((item) => (
                    <div
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1.5px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.sub}</div>
                      </div>
                      <ArrowRight
                        size={16}
                        style={{ marginLeft: 'auto', color: 'var(--text-muted)', alignSelf: 'center' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Send Platform Notification</span></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Notification title"
                    value={notifForm.title}
                    onChange={(e) => setNotifForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <textarea
                    className="form-textarea"
                    placeholder="Message content..."
                    value={notifForm.message}
                    onChange={(e) => setNotifForm((prev) => ({ ...prev, message: e.target.value }))}
                    style={{ minHeight: 70 }}
                  />
                  <button
                    className="btn btn-primary btn-sm w-full"
                    style={{ justifyContent: 'center' }}
                    onClick={sendPlatformNotif}
                    disabled={sending || !notifForm.title || !notifForm.message}
                  >
                    {sending ? <span className="spinner" /> : 'Send Notification to All Users'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

