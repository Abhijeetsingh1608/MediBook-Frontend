import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authAPI } from '../../utils/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  
  // Get email from URL
  const email = new URLSearchParams(window.location.search).get('email');
  
  // States
  const [step, setStep] = useState(1); // 1 = OTP, 2 = Password
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(900); // 15:00 in seconds
  const inputRefs = useRef([]);

  // Validate token on mount
  useEffect(() => {
    if (!email) {
      setError('Invalid password reset request');
    }
  }, [email]);

  // Countdown timer
  useEffect(() => {
    if (step !== 1 || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, step]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Password strength
  const getPasswordStrength = () => {
    if (newPassword.length < 6) return { color: '#ef4444', percent: 33 }; // Red
    if (newPassword.length < 9) return { color: '#eab308', percent: 66 }; // Yellow
    return { color: '#22c55e', percent: 100 }; // Green
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

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
      if (idx < 6) newOtp[idx] = digit;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authAPI.verifyOtp({ email, otp: otpCode });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword({
        email,
        otp: otp.join(''),
        newPassword,
      });
      navigate('/login?reset=success', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <div style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🔐</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Invalid Link</h1>
            <p style={{ opacity: 0.8, lineHeight: 1.7 }}>
              This password reset link is invalid or has expired.
            </p>
          </div>
        </div>

        <div className="auth-right">
              <div className="auth-box">
            <div style={{ marginBottom: 32 }}>
              <div className="topnav-logo" style={{ marginBottom: 24, cursor: 'pointer' }} onClick={() => navigate('/')}>
                🏥 Medi<span style={{ color: 'var(--primary)' }}>Book</span>
              </div>
              <h2 className="auth-title">Reset Password</h2>
              <p className="auth-sub">Invalid or expired link</p>
            </div>

            <div className="alert alert-error mb-4">
              This password reset link is invalid or has expired. Please request a new one.
            </div>

            <button
              onClick={() => navigate('/forgot-password')}
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>
            {step === 1 ? <ShieldCheck size={48} /> : <KeyRound size={48} />}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
            {step === 1 ? 'Verify Your Identity' : 'Create New Password'}
          </h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, marginBottom: 32 }}>
            {step === 1 ? 'Enter the 6-digit OTP sent to your email' : 'Choose a strong password for your account'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {step === 1
              ? ['Verify your identity', 'Secure your account', 'One-time password'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>✓</span>
                    <span style={{ fontWeight: 500 }}>{f}</span>
                  </div>
                ))
              : ['Strong password', 'Account secure', 'Ready to login'].map(f => (
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
            <h2 className="auth-title">{step === 1 ? 'Enter OTP' : 'Set New Password'}</h2>
            <p className="auth-sub">
              {step === 1 ? 'Check your email for the 6-digit verification code' : 'Create a strong password for your account'}
            </p>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {/* Step 1: OTP Verification */}
          {step === 1 && (
            <>
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

              {/* Timer or Expired Message */}
              <div style={{ textAlign: 'center', marginBottom: 24, fontSize: 14, color: 'var(--text-muted)' }}>
                {timeLeft > 0 ? (
                  <>OTP expires in <strong>{formatTime(timeLeft)}</strong></>
                ) : (
                  <div style={{ color: '#ef4444' }}>
                    <p>Password reset OTP expired. Please request a new one.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      style={{
                        marginTop: 12,
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Request New Link
                    </button>
                  </div>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otp.some(d => !d) || timeLeft <= 0}
                className="btn btn-primary w-full"
                style={{ justifyContent: 'center', padding: '12px' }}
              >
                {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Verify OTP</>}
              </button>
            </>
          )}

          {/* Step 2: New Password */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* New Password Input */}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 40, paddingRight: 40 }}
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                <div style={{ marginTop: 8, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${getPasswordStrength().percent}%`,
                      background: getPasswordStrength().color,
                      transition: 'all 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 40, paddingRight: 40 }}
                    type={showConfirmPass ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', padding: '12px' }}>
                {loading ? <span className="spinner" /> : <><ArrowRight size={16} /> Reset Password</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
