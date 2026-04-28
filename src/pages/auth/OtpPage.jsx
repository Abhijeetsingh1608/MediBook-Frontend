import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { authAPI, providerAPI, saveAuth, getUser } from '../../utils/api';

export default function OtpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const source = params.get('source') || 'normal';
  const name = params.get('name') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5:00 in seconds
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  const normalizeAuthResponse = (data) => {
    const nestedUser = data?.user || {};
    return {
      token: data?.token,
      userId: data?.userId || nestedUser.userId,
      fullName: data?.fullName || nestedUser.fullName || name || 'User',
      role: data?.role || nestedUser.role,
      email: data?.email || nestedUser.email || email,
    };
  };

  const finishLogin = async (data) => {
    const authData = normalizeAuthResponse(data);
    const rawUser = {
      userId: authData.userId,
      fullName: authData.fullName,
      role: authData.role,
      email: authData.email,
    };

    saveAuth(authData.token, rawUser);
    const user = getUser() || rawUser;

    const pendingProviderProfile = sessionStorage.getItem('medibook_pending_provider_profile');
    if (user.role === 'Provider' && pendingProviderProfile) {
      try {
        await providerAPI.register(JSON.parse(pendingProviderProfile));
        sessionStorage.removeItem('medibook_pending_provider_profile');
      } catch (providerErr) {
        console.warn('Provider profile could not be created immediately:', providerErr);
      }
    }

    setSuccess('OTP verified! Redirecting...');

    setTimeout(() => {
      if (user.role === 'Patient') {
        navigate('/patient', { replace: true });
      } else if (user.role === 'Provider') {
        navigate('/provider', { replace: true });
      } else if (user.role === 'Admin') {
        navigate('/admin', { replace: true });
      }
    }, 1000);
  };

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Unmask email for display
  const maskEmail = (emailStr) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [local, domain] = emailStr.split('@');
    if (local.length <= 2) return emailStr;
    return local.substring(0, 2) + '*****@' + domain;
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last character
    setOtp(newOtp);

    // Auto-focus next input
    if (newOtp[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);

      // Focus previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);

    const newOtp = [...otp];
    digits.split('').forEach((digit, idx) => {
      if (idx < 6) {
        newOtp[idx] = digit;
      }
    });
    setOtp(newOtp);

    // Focus on the last filled input or the next empty one
    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Verify OTP
  const handleVerify = async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const request =
        source === 'email-verification'
          ? authAPI.verifyEmail({ email, otp: otpCode })
          : authAPI.verifyLoginOtp({ email, otp: otpCode });

      const res = await request;
      const data = res.data;
      const authData = normalizeAuthResponse(data);

      if (!authData.token || !authData.userId || !authData.role) {
        throw new Error('Invalid response from server');
      }

      await finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setLoading(true);
    setError('');

    try {
      if (source === 'email-verification') {
        await authAPI.resendVerificationOtp({ email });
      } else {
        const raw = sessionStorage.getItem('medibook_pending_login');
        if (!raw) {
          throw new Error('Please go back and login again to get a new OTP.');
        }
        const payload = JSON.parse(raw);
        await authAPI.login(payload);
      }

      setOtp(['', '', '', '', '', '']);
      setTimeLeft(300);
      setCanResend(false);
      setSuccess('OTP resent! Check your email');
      setTimeout(() => setSuccess(''), 3000);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔐</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Verify Your Identity</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 32 }}>
            We've sent a 6-digit code to your email to complete your sign in securely.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Secure Login', 'One-Time Code', 'Quick Verification', 'Your Privacy Protected'].map(f => (
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
            <h2 className="auth-title">Enter Verification Code</h2>
            <p className="auth-sub">Sent to: {maskEmail(email)}</p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}
          {success && <div className="alert alert-success mb-4">{success}</div>}

          {/* OTP Input Boxes */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={el => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength="1"
                value={digit}
                onChange={e => handleOtpChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                style={{
                  width: 50,
                  height: 50,
                  fontSize: 24,
                  fontWeight: 700,
                  textAlign: 'center',
                  border: `2px solid ${digit ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  transition: 'all 0.2s',
                }}
                disabled={loading}
                autoFocus={idx === 0}
              />
            ))}
          </div>

          {/* Timer or Resend Button */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            {!canResend ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)' }}>
                <Clock size={14} />
                Resend OTP in <strong>{formatTime(timeLeft)}</strong>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Resend OTP
              </button>
            )}
          </div>

          {/* Verify Button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading || otp.some(d => !d)}
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '12px' }}
          >
            {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Verify & Continue</>}
          </button>
        </div>
      </div>
    </div>
  );
}


