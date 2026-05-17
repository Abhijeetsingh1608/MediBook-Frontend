import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, ArrowRight } from 'lucide-react';
import { authAPI, OAUTH_GOOGLE_URL } from '../../utils/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('Patient');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [providerForm, setProviderForm] = useState({
    specialization: '', qualification: '', experienceYears: 0,
    bio: '', clinicName: '', clinicAddress: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleProv = (e) => setProviderForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const registerUser = async (e) => {
    e.preventDefault();
    if (role === 'Provider') {
      setStep(2);
      return;
    }

    setError(''); setLoading(true);
    try {
      await authAPI.register({ ...form, role });
      const encodedEmail = encodeURIComponent(form.email.trim());
      navigate(`/otp?email=${encodedEmail}&source=email-verification`, { replace: true });
    } catch (err) {
      if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to the server. Make sure your local backend is running!');
      } else if (err.response?.status >= 500) {
        setError('The server encountered an error (500). Please check backend logs.');
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please check your details and try again.');
      }
    } finally { setLoading(false); }
  };

  const registerProvider = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // Step 1: Create Auth Account (triggers OTP)
      await authAPI.register({ ...form, role });

      // Step 2: Store provider details in session for OtpPage to pick up after verification
      sessionStorage.setItem('medibook_pending_provider_profile', JSON.stringify({
        ...providerForm,
        fullName: form.fullName,
        experienceYears: parseInt(providerForm.experienceYears || 0, 10),
      }));

      const encodedEmail = encodeURIComponent(form.email.trim());
      navigate(`/otp?email=${encodedEmail}&source=email-verification`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed at Step 2.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🏥</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Join MediBook</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 28 }}>
            Whether you're a patient seeking care or a healthcare professional, MediBook has you covered.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { emoji: '🏥', title: 'For Patients', desc: 'Book appointments instantly' },
              { emoji: '👨‍⚕️', title: 'For Doctors', desc: 'Manage your practice online' },
              { emoji: '🔒', title: 'Secure', desc: 'HIPAA compliant platform' },
              { emoji: '📱', title: 'Anywhere', desc: 'Access on any device' },
            ].map(c => (
              <div key={c.title} style={{ background: 'rgba(255,255,255,0.12)', padding: 16, borderRadius: 10, textAlign: 'left' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <div style={{ marginBottom: 24 }}>
            <div className="topnav-logo" style={{ marginBottom: 24, cursor: 'pointer' }} onClick={() => navigate('/')}>
              🏥 Medi<span style={{ color: 'var(--primary)' }}>Book</span>
            </div>
            <h2 className="auth-title">
              {step === 1 ? 'Create your account' : 'Complete Provider Profile'}
            </h2>
            <p className="auth-sub">
              {step === 1 ? 'Fill in your details to get started' : 'Tell us about your medical practice'}
            </p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {step === 1 && (
            <form onSubmit={registerUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Role Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['Patient', 'Provider'].map(r => (
                  <div key={r} onClick={() => setRole(r)}
                    style={{ padding: '12px 16px', borderRadius: 8, border: `2px solid ${role === r ? 'var(--primary)' : 'var(--border)'}`,
                      background: role === r ? 'var(--primary-light)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{r === 'Patient' ? '🤒' : '👨‍⚕️'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: role === r ? 'var(--primary)' : 'var(--text)' }}>{r}</div>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 40 }} type="text" name="fullName"
                    placeholder="John Doe" value={form.fullName} onChange={handle} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 40 }} type="email" name="email"
                    placeholder="you@example.com" value={form.email} onChange={handle} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 40 }} type="tel" name="phone"
                    placeholder="+91 9999999999" value={form.phone} onChange={handle} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 40 }} type="password" name="password"
                    placeholder="Min 8 characters" value={form.password} onChange={handle} required minLength={6} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
                {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> {role === 'Provider' ? 'Continue' : 'Create Account'}</>}
              </button>

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
            </form>
          )}

          {step === 2 && (
            <form onSubmit={registerProvider} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Specialization *</label>
                  <input className="form-input" name="specialization" placeholder="e.g. Cardiologist"
                    value={providerForm.specialization} onChange={handleProv} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Qualification *</label>
                  <input className="form-input" name="qualification" placeholder="e.g. MBBS, MD"
                    value={providerForm.qualification} onChange={handleProv} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Experience (years)</label>
                <input className="form-input" type="number" name="experienceYears" min="0"
                  value={providerForm.experienceYears} onChange={handleProv} />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Name *</label>
                <input className="form-input" name="clinicName" placeholder="Apollo Hospital"
                  value={providerForm.clinicName} onChange={handleProv} required />
              </div>

              <div className="form-group">
                <label className="form-label">Clinic Address *</label>
                <input className="form-input" name="clinicAddress" placeholder="123 MG Road, Bangalore"
                  value={providerForm.clinicAddress} onChange={handleProv} required />
              </div>

              <div className="form-group">
                <label className="form-label">Bio (optional)</label>
                <textarea className="form-textarea" name="bio" placeholder="Brief description about yourself..."
                  value={providerForm.bio} onChange={handleProv} style={{ minHeight: 70 }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={loading} style={{ justifyContent: 'center' }}>
                  {loading ? <span className="spinner" /> : 'Complete Registration'}
                </button>
              </div>

              <div className="alert alert-info" style={{ fontSize: 13 }}>
                ℹ Your profile will be reviewed by an admin before appearing in search results.
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
