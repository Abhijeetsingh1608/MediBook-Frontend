import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { AdminSidebar, Topbar, Loader, StatusBadge } from '../../components/Layout';
import { paymentAPI, formatDate } from '../../utils/api';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState({});
  const [alert, setAlert] = useState(null);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [revRes, sRes, fRes, rRes, pRes] = await Promise.allSettled([
          paymentAPI.getTotalRevenue(),
          paymentAPI.getByStatus('SUCCESS'),
          paymentAPI.getByStatus('FAILED'),
          paymentAPI.getByStatus('REFUNDED'),
          paymentAPI.getByStatus('PENDING'),
        ]);

        if (revRes.status === 'fulfilled') setTotalRevenue(revRes.value.data?.totalRevenue || 0);

        const all = [
          ...(sRes.status === 'fulfilled' ? sRes.value.data || [] : []),
          ...(fRes.status === 'fulfilled' ? fRes.value.data || [] : []),
          ...(rRes.status === 'fulfilled' ? rRes.value.data || [] : []),
          ...(pRes.status === 'fulfilled' ? pRes.value.data || [] : []),
        ].sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0));

        setPayments(all);
      } catch {
        showAlert('error', 'Failed to load payment data.');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      String(p.paymentId).includes(q) ||
      String(p.appointmentId).includes(q) ||
      String(p.patientId).includes(q) ||
      (p.transactionId || '').toLowerCase().includes(q) ||
      (p.mode || p.paymentMethod || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const initiateRefund = async (paymentId) => {
    if (!window.confirm('Initiate a refund for this payment? This cannot be undone.')) return;
    setProcessing(u => ({ ...u, [paymentId]: 'refund' }));
    try {
      await paymentAPI.refund(paymentId);
      setPayments(prev => prev.map(p => p.paymentId === paymentId ? { ...p, status: 'REFUNDED' } : p));
      showAlert('success', `Refund initiated for Payment #${paymentId}.`);
    } catch (e) {
      showAlert('error', e.response?.data?.message || 'Refund failed.');
    } finally { setProcessing(u => ({ ...u, [paymentId]: null })); }
  };

  const markPaid = async (paymentId) => {
    setProcessing(u => ({ ...u, [paymentId]: 'status' }));
    try {
      await paymentAPI.updateStatus(paymentId, 'SUCCESS');
      setPayments(prev => prev.map(p => p.paymentId === paymentId ? { ...p, status: 'SUCCESS' } : p));
      showAlert('success', `Payment #${paymentId} marked as SUCCESS.`);
    } catch {
      showAlert('error', 'Failed to update status.');
    } finally { setProcessing(u => ({ ...u, [paymentId]: null })); }
  };

  // Computed stats
  const successPay  = payments.filter(p => p.status === 'SUCCESS');
  const refundedPay = payments.filter(p => p.status === 'REFUNDED');
  const failedPay   = payments.filter(p => p.status === 'FAILED');
  const pendingPay  = payments.filter(p => p.status === 'PENDING');
  const refundedAmt = refundedPay.reduce((s, p) => s + (p.amount || 0), 0);

  const stats = [
    { label: 'Total Revenue',     value: `₹${totalRevenue.toLocaleString('en-IN')}`,  icon: <DollarSign size={22} />,   color: 'stat-icon-green' },
    { label: 'Successful',        value: successPay.length,                             icon: <CheckCircle size={22} />,  color: 'stat-icon-blue'  },
    { label: 'Total Refunded',    value: `₹${refundedAmt.toLocaleString('en-IN')}`,    icon: <RefreshCw size={22} />,    color: 'stat-icon-yellow' },
    { label: 'Failed / Pending',  value: failedPay.length + pendingPay.length,          icon: <AlertCircle size={22} />,  color: 'stat-icon-red'   },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-main">
        <Topbar title="Payments" />
        <div className="page-content fade-in">
          <p className="page-title">Payment Management</p>
          <p className="page-subtitle">All transactions, refunds, and revenue analytics</p>

          {alert && (
            <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
              {alert.type === 'success' ? '✓' : '✕'} {alert.msg}
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                <div>
                  <div className="stat-value">{loading ? '—' : s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 38 }}
                placeholder="Search by payment ID, appointment, patient, or transaction ID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','All'],['SUCCESS','Success'],['PENDING','Pending'],['FAILED','Failed'],['REFUNDED','Refunded']].map(([v,l]) => (
                <button key={v} className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setStatusFilter(v)}>{l}
                </button>
              ))}
            </div>
          </div>

          {loading ? <Loader text="Loading transactions..." /> : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
                <span className="badge badge-gray">{payments.length} total</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pay #</th>
                      <th>Appointment</th>
                      <th>Patient</th>
                      <th>Amount</th>
                      <th>Mode</th>
                      <th>Transaction ID</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state">
                            <div className="empty-state-icon">💳</div>
                            <div className="empty-state-title">No transactions found</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Transactions appear here when patients make payments.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.map(p => (
                      <tr key={p.paymentId}>
                        <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>#{p.paymentId}</td>
                        <td style={{ fontSize: 13 }}>#{p.appointmentId}</td>
                        <td style={{ fontSize: 13 }}>#{p.patientId}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 15,
                            color: p.status === 'REFUNDED' ? 'var(--danger)' : p.status === 'SUCCESS' ? 'var(--secondary)' : 'var(--text-muted)' }}>
                            ₹{(p.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>
                            {p.mode || p.paymentMethod || '—'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.transactionId || '—'}
                        </td>
                        <td><StatusBadge status={p.status} /></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatDate(p.paidAt || p.createdAt)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {p.status === 'SUCCESS' && (
                              <button className="btn btn-outline btn-sm"
                                disabled={processing[p.paymentId] === 'refund'}
                                onClick={() => initiateRefund(p.paymentId)}>
                                {processing[p.paymentId] === 'refund' ? <span className="spinner spinner-dark" style={{ width: 14, height: 14 }} /> : 'Refund'}
                              </button>
                            )}
                            {p.status === 'PENDING' && (
                              <button className="btn btn-secondary btn-sm"
                                disabled={processing[p.paymentId] === 'status'}
                                onClick={() => markPaid(p.paymentId)}>
                                {processing[p.paymentId] === 'status' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Mark Paid'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}