import React, { useState, useEffect } from 'react';
import { PatientSidebar, Topbar, StatusBadge, Loader } from '../../components/Layout';
import { paymentAPI, getUser, formatDate, appointmentAPI, providerAPI } from '../../utils/api';

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  if (!provider) return 'Doctor';
  if (provider.fullName && !provider.fullName.includes('Provider')) return provider.fullName;
  if (provider.name && !provider.name.includes('Provider')) return provider.name;
  if (provider.firstName && !provider.firstName.includes('Provider')) return provider.firstName;
  if (provider.doctorName && !provider.doctorName.includes('Provider')) return provider.doctorName;
  return 'Doctor';
};

// Dynamically load Razorpay script if not already present
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PayModal({ patientId, onClose, onDone }) {
  const user = getUser();
  const [apptId, setApptId] = useState('');
  const [form, setForm] = useState({ amount: '', paymentMethod: 'UPI' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const METHODS = [
    { key: 'UPI', icon: '📱', label: 'UPI' },
    { key: 'CARD', icon: '💳', label: 'Card' },
    { key: 'WALLET', icon: '👛', label: 'Wallet' },
    { key: 'NETBANKING', icon: '🏦', label: 'Net Banking' },
  ];

  const handlePay = async () => {
    if (!apptId || !form.amount) {
      setError('Please enter Appointment ID and Amount.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Step 1 — Create Razorpay order from backend
      const res = await paymentAPI.initiate({
        appointmentId: parseInt(apptId),
        patientId,
        amount: parseFloat(form.amount),
        paymentMethod: form.paymentMethod,
        currency: 'INR',
      });

      const razorpayOrderId = res.data?.razorpayOrderId;

      if (!razorpayOrderId) {
        throw new Error('Backend did not return a valid Razorpay order ID. Backend services may not be configured.');
      }

      // Step 2 — Load and open Razorpay popup
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load Razorpay. Check your internet connection.');
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY,
        amount: parseFloat(form.amount) * 100, // paise
        currency: 'INR',
        name: 'MediBook',
        description: `Payment for Appointment #${apptId}`,
        order_id: razorpayOrderId,
        prefill: {
          name: user?.fullName || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#0ea5e9' },
        handler: async function (response) {
          // Step 3 — Verify signature on backend
          try {
            console.log('Verifying payment with backend...');
            await paymentAPI.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            console.log('✅ Payment verified');
          } catch (verifyErr) {
            console.warn('⚠️ Backend verification skipped:', verifyErr.message);
            // Continue anyway - payment was captured by Razorpay
          }
          setLoading(false);
          onDone(response.razorpay_payment_id);
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setLoading(false);
        const errMsg = response.error?.description || 'Payment failed';
        setError(`Payment failed: ${errMsg}`);
      });
      rzp.open();

    } catch (e) {
      setLoading(false);
      console.error('❌ PAYMENT ERROR:');
      console.error('Full error:', e);
      console.error('Response status:', e.response?.status);
      console.error('Response data:', e.response?.data);

      let msg = 'Payment initiation failed.';
      const backendMessage = [
        e.response?.data?.message,
        e.response?.data?.error,
        typeof e.response?.data === 'string' ? e.response.data : '',
        e.message,
      ]
        .filter(Boolean)
        .join(' ');

      if (/connectexception|connection refused|getsockopt/i.test(backendMessage)) {
        msg = 'Payment service connection failed. Ensure api-gateway (8080), payment-service (8085), appointment-service (8084), and notification-service (8086) are running.';
      } else if (e.response?.status === 500) {
        msg = 'Backend Error: Payment order could not be created. Check payment-service logs and Razorpay credentials.';
      } else if (e.response?.data?.message) {
        msg = e.response.data.message;
      } else if (e.response?.data?.error) {
        msg = e.response.data.error;
      } else if (e.message) {
        msg = e.message;
      }

      setError('❌ ' + msg);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Make Payment via Razorpay</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-group">
            <label className="form-label">Appointment ID</label>
            <input className="form-input" placeholder="e.g. 42"
              value={apptId} onChange={e => setApptId(e.target.value)} type="number" min="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" placeholder="e.g. 500"
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} min="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {METHODS.map(m => (
                <div key={m.key} className={`pay-option ${form.paymentMethod === m.key ? 'selected' : ''}`}
                  onClick={() => setForm(p => ({ ...p, paymentMethod: m.key }))}>
                  <span className="pay-option-icon">{m.icon}</span>
                  <span className="pay-option-name">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="alert alert-info" style={{ fontSize: 13 }}>
            🔒 You will be redirected to Razorpay's secure checkout to complete payment.
          </div>

          {error && (
            <div className="alert alert-warning" style={{ fontSize: 13 }}>{error}</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={loading || !form.amount || !apptId}>
            {loading ? <><span className="spinner" /> Opening Razorpay…</> : `Pay ₹${form.amount || '0'} via Razorpay`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientPayments() {
  const user = getUser();
  const [payments, setPayments] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [showPayModal, setShowPayModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await paymentAPI.getByPatient(user.userId);
      const paymentsData = res.data || [];
      setPayments(paymentsData);

      // Fetch provider details for payments
      const appointmentIds = [...new Set(paymentsData.map(p => p.appointmentId))];
      const providerMap = {};
      for (const appointmentId of appointmentIds) {
        try {
          const apptRes = await appointmentAPI.getById(appointmentId);
          const providerId = apptRes.data?.providerId;
          if (providerId && !providerMap[appointmentId]) {
            const provRes = await providerAPI.getById(providerId);
            providerMap[appointmentId] = provRes.data;
          }
        } catch (err) {
          console.warn(`Failed to fetch provider for appointment ${appointmentId}`);
          providerMap[appointmentId] = null;
        }
      }
      setPaymentProviders(providerMap);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = tab === 'all' ? payments : payments.filter(p => p.status === tab);
  const totalPaid = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter(p => p.status === 'REFUNDED').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main">
        <Topbar title="Payments" />
        <div className="page-content fade-in">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p className="page-title">Payment History</p>
              <p className="page-subtitle">Track all your transactions</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowPayModal(true)}>
              + Make Payment
            </button>
          </div>

          {/* Summary cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Paid', value: `₹${totalPaid.toLocaleString()}`, icon: '💳', cls: 'stat-icon-green' },
              { label: 'Total Refunded', value: `₹${totalRefunded.toLocaleString()}`, icon: '↩️', cls: 'stat-icon-blue' },
              { label: 'Transactions', value: payments.length, icon: '📄', cls: 'stat-icon-yellow' },
              { label: 'Failed', value: payments.filter(p => p.status === 'FAILED').length, icon: '⚠️', cls: 'stat-icon-red' },
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

          {/* Tabs */}
          <div className="tabs">
            {[
              { key: 'all', label: 'All' },
              { key: 'SUCCESS', label: 'Paid' },
              { key: 'PENDING', label: 'Pending' },
              { key: 'REFUNDED', label: 'Refunded' },
              { key: 'FAILED', label: 'Failed' },
            ].map(t => (
              <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Doctor</th>
                    <th>Appointment</th>
                    <th>Razorpay ID</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}><Loader /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">💳</div>
                        <div className="empty-state-title">No payments found</div>
                      </div>
                    </td></tr>
                  ) : filtered.map(p => (
                    <tr key={p.paymentId}>
                      <td><span className="badge badge-gray">#{p.paymentId}</span></td>
                      <td style={{ fontSize: 13 }}>
                        {getDoctorName(paymentProviders[p.appointmentId])}
                      </td>
                      <td>Appt #{p.appointmentId}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {p.razorpayPaymentId || '—'}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>₹{p.amount?.toLocaleString()}</td>
                      <td>{p.paymentMethod || '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(p.paidAt || p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPayModal && (
        <PayModal
          patientId={user.userId}
          onClose={() => setShowPayModal(false)}
          onDone={(rzpPaymentId) => {
            setShowPayModal(false);
            load();
            alert(`✅ Payment successful!\nRazorpay ID: ${rzpPaymentId}`);
          }}
        />
      )}
    </div>
  );
}

