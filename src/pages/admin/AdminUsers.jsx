import React, { useEffect, useMemo, useState } from 'react';
import { AdminSidebar, Topbar } from '../../components/Layout';
import { authAPI, formatDate } from '../../utils/api';
import { Search, UserX } from 'lucide-react';

const normalizeRole = (role) => {
  const upper = String(role || '').toUpperCase();
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'PROVIDER') return 'Provider';
  if (upper === 'PATIENT') return 'Patient';
  return role || 'Unknown';
};

const toViewUser = (user) => ({
  userId: user.userId,
  fullName: user.fullName || 'Unknown User',
  email: user.email || '-',
  role: normalizeRole(user.role),
  isActive: Boolean(user.active),
  createdAt: user.createdAt,
});

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await authAPI.getAllUsers();
        setUsers((response.data || []).map(toViewUser));
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        user.fullName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q);
      const matchesTab = tab === 'all' || user.role === tab;
      return matchesSearch && matchesTab;
    });
  }, [users, search, tab]);

  const deactivate = async (userId) => {
    if (!confirm('Deactivate this user account?')) return;
    setActionLoading(`${userId}-deactivate`);
    try {
      await authAPI.deactivate(userId);
      setUsers((prev) => prev.map((user) => (
        user.userId === userId ? { ...user, isActive: false } : user
      )));
    } catch (error) {
      alert(error.response?.data?.message || 'Error deactivating user.');
    } finally {
      setActionLoading(null);
    }
  };

  const changePassword = async (userId) => {
    const password = prompt('Enter new password:');
    if (!password) return;
    try {
      await authAPI.changePassword(userId, password);
      alert('Password updated!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating password.');
    }
  };

  const roleColor = {
    Admin: 'badge-red',
    Provider: 'badge-blue',
    Patient: 'badge-green',
  };

  const stats = [
    { label: 'Total Users', value: users.length, icon: '??', cls: 'stat-icon-blue' },
    { label: 'Patients', value: users.filter((user) => user.role === 'Patient').length, icon: '??', cls: 'stat-icon-green' },
    { label: 'Providers', value: users.filter((user) => user.role === 'Provider').length, icon: '??', cls: 'stat-icon-yellow' },
    { label: 'Inactive', value: users.filter((user) => !user.isActive).length, icon: '??', cls: 'stat-icon-red' },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="User Management" />
        <div className="page-content fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p className="page-title">User Management</p>
              <p className="page-subtitle">{users.length} total users on the platform</p>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className={`stat-icon ${stat.cls}`} style={{ fontSize: 22 }}>{stat.icon}</div>
                <div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="Search by name or email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', background: 'var(--bg)', borderRadius: 8, padding: '4px' }}>
              {['all', 'Patient', 'Provider', 'Admin'].map((value) => (
                <div
                  key={value}
                  className={`tab ${tab === value ? 'active' : ''}`}
                  style={{ borderRadius: 6 }}
                  onClick={() => setTab(value)}
                >
                  {value === 'all' ? 'All' : value}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading users...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-state-icon">??</div>
                          <div className="empty-state-title">No users found</div>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((user) => (
                    <tr key={user.userId}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                            {user.fullName[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{user.fullName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {user.userId}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 14 }}>{user.email}</td>
                      <td>
                        <span className={`badge ${roleColor[user.role] || 'badge-gray'}`}>{user.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}>
                          {user.isActive ? '? Active' : '? Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(user.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {user.isActive && user.role !== 'Admin' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => deactivate(user.userId)}
                              disabled={actionLoading === `${user.userId}-deactivate`}
                              title="Deactivate"
                            >
                              <UserX size={13} />
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => changePassword(user.userId)}
                            title="Reset Password"
                          >
                            ??
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
