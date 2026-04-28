import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { authAPI } from '../../utils/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      await authAPI.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>
            <Lock size={48} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Forgot Password?</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 32 }}>
            Enter your registered email and we'll send you a reset link with OTP.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Reset link sent to your email', 'OTP verification for security', 'Link valid for 15 minutes'].map(f => (
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
          {!sent ? (
            <>
              <div style={{ marginBottom: 32 }}>
                <div className="topnav-logo" style={{ marginBottom: 24, cursor: 'pointer' }} onClick={() => navigate('/')}>
                  🏥 Medi<span style={{ color: 'var(--primary)' }}>Book</span>
                </div>
                <h2 className="auth-title">Reset Your Password</h2>
                <p className="auth-sub">We'll send a reset link to your email</p>
              </div>

              {error && <div className="alert alert-error mb-4">{error}</div>}

              <form onSubmit={handleSendReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 40 }}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
                  {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Send Reset Link</>}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
                Remember your password?{' '}
                <a href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Back to Login
                </a>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 56, marginBottom: 16, display: 'flex', justifyContent: 'center', color: 'var(--primary)' }}>
                  <CheckCircle size={56} />
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Check Your Email!</h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
                  We've sent a password reset OTP to <strong>{email}</strong>. Use it on the next screen to set a new password.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Also check your spam folder. OTP is valid for a limited time.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
                className="btn btn-primary w-full"
                style={{ justifyContent: 'center', padding: '12px' }}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
