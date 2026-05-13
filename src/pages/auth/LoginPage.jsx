import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authAPI, OAUTH_GOOGLE_URL } from '../../utils/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Check for reset success message
  useEffect(() => {
    if (params.get('reset') === 'success') {
      setResetSuccess(true);
      const timer = setTimeout(() => setResetSuccess(false), 5000);
      return () => clearTimeout(timer);
    }

    const oauthError = params.get('error');
    const oauthMessage = params.get('message');
    if (oauthError) {
      setError(oauthMessage || 'Google login failed. Please try again.');
    }
  }, [params]);

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); 
    setLoading(true);
    
    // Trim whitespace from email and password
    const email = form.email.trim();
    const password = form.password.trim();
    
    // Verify inputs are not empty
    if (!email || !password) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }
    
    // Debug: Log exact payload before sending
    const payload = {
      email,
      password,
      ...(form.adminSecretKey ? { adminSecretKey: form.adminSecretKey.trim() } : {}),
    };
    
    try {
      const res = await authAPI.login(payload);
      
      // Handle OTP requirement
      if (res.data.otpSent === true) {
        const encodedEmail = encodeURIComponent(form.email);
        navigate(`/otp?email=${encodedEmail}&source=normal`, { replace: true });
        return;
      }
      
      setError('Login OTP was not started. Please try again.');
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid email or password.';
      if (message.toLowerCase().includes('verify your email')) {
        const encodedEmail = encodeURIComponent(email);
        navigate(`/otp?email=${encodedEmail}&source=email-verification`, { replace: true });
        return;
      }
      setError(message);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left" style={{ background: 'linear-gradient(135deg,#14532d,#22c55e)', color: '#fff' }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🩺</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Welcome Again</h1>
          <p style={{ opacity: 0.9, lineHeight: 1.7, marginBottom: 32 }}>
            Your modern health companion. Book appointments, access records, and manage your wellbeing journey.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['700+ Expert Providers', 'Private Medical Records', 'Instant Booking', '24/7 Support'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.14)', padding: '12px 16px', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>✔️</span>
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
              🩺 Health<span style={{ color: 'var(--primary)' }}>Sync</span>
            </div>
            <h2 className="auth-title">Sign in to your account</h2>
            <p className="auth-sub">Enter your credentials to continue</p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}
          {resetSuccess && <div className="alert alert-success mb-4">Password reset successful! Please login with your new password.</div>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 40 }} type="email" name="email"
                  placeholder="you@example.com" value={form.email} onChange={handle} required />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                  Forgot Password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ paddingLeft: 40, paddingRight: 40 }}
                  type={showPass ? 'text' : 'password'} name="password"
                  placeholder="Your password" value={form.password} onChange={handle} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', paddingLeft: 0 }}
                onClick={() => setShowAdminSecret((value) => !value)}
              >
                {showAdminSecret ? 'Hide Admin Secret Key' : 'Admin Login'}
              </button>
            </div>

            {showAdminSecret && (
              <div className="form-group">
                <label className="form-label">Admin Secret Key</label>
                <input
                  className="form-input"
                  type="password"
                  name="adminSecretKey"
                  placeholder="Enter admin secret key"
                  value={form.adminSecretKey || ''}
                  onChange={handle}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
              {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Sign In</>}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', opacity: 0.6 }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* Google Sign-In Button */}
          <a
            href={OAUTH_GOOGLE_URL}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 16px',
              background: '#fff',
              border: `2px solid var(--border)`,
              borderRadius: 'var(--radius-sm)',
              color: '#333',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Google logo: 4-color design */}
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </a>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create Account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
