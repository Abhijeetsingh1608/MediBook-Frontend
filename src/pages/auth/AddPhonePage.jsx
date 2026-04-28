import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ArrowRight } from 'lucide-react';

export default function AddPhonePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '';

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 10) {
      setPhone(value);
    }
  };

  const handleSavePhone = async () => {
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setError('Phone setup is handled after login in the current backend.');
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to add phone number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📱</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>One More Step</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 32 }}>
            Add your phone number to enable secure OTP verification on every login.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Enhanced Security', 'Quick Verification', 'Recovery Option', 'Always Protected'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <span style={{ fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-box">
          <div style={{ marginBottom: 32 }}>
            <div className="topnav-logo" style={{ marginBottom: 24, cursor: 'pointer' }} onClick={() => navigate('/')}>
              🏥 Medi<span style={{ color: 'var(--primary)' }}>Book</span>
            </div>
            <h2 className="auth-title">Add Your Phone Number</h2>
            <p className="auth-sub">Required for OTP verification</p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Phone Number</label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                <Phone size={16} />
                +91
              </div>
              <input
                className="form-input"
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={handlePhoneChange}
                maxLength="10"
                inputMode="numeric"
                style={{ paddingLeft: 60 }}
                disabled={loading}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              {phone.length}/10 digits entered
            </p>
          </div>

          <button
            type="button"
            onClick={handleSavePhone}
            disabled={loading || phone.length !== 10}
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '12px' }}
          >
            {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Save & Continue</>}
          </button>
        </div>
      </div>
    </div>
  );
}
