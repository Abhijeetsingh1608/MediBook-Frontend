import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Stethoscope } from 'lucide-react';
import { API_BASE_URL, saveAuth } from '../../utils/api';

export default function OAuth2SelectRole() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');
  const name = params.get('name');
  const picture = params.get('picture');
  const provider = params.get('provider');

  const handleContinue = async () => {
    if (!selectedRole) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName: name,
          picture,
          provider,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete registration');
      }

      const data = await response.json();

      // Navigate to OTP verification instead of direct login
      const encodedEmail = encodeURIComponent(email);
      const encodedName = encodeURIComponent(name);
      navigate(`/otp?email=${encodedEmail}&source=google&name=${encodedName}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to complete registration');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        {/* Profile section */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          {picture && (
            <img
              src={picture}
              alt={name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                marginBottom: '16px',
                border: '3px solid var(--primary)',
              }}
            />
          )}
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: 'var(--text)' }}>
            Welcome, {name}!
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {email}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            How would you like to use MediBook?
          </p>
        </div>

        {/* Role selection cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* Patient card */}
          <div
            onClick={() => setSelectedRole('Patient')}
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-sm)',
              border: `3px solid ${selectedRole === 'Patient' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'Patient' ? 'var(--primary-light)' : '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              <User size={40} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
              I am a Patient
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Book appointments, manage records, track payments
            </p>
          </div>

          {/* Provider card */}
          <div
            onClick={() => setSelectedRole('Provider')}
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-sm)',
              border: `3px solid ${selectedRole === 'Provider' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'Provider' ? 'var(--primary-light)' : '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              <Stethoscope size={40} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
              I am a Doctor / Provider
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Manage schedule, appointments, and patient records
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Continue button */}
        <button
          className="btn btn-primary"
          onClick={handleContinue}
          disabled={!selectedRole || loading}
          style={{
            width: '100%',
            fontSize: '15px',
            fontWeight: 600,
            padding: '12px 16px',
          }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ marginRight: '8px' }} /> Processing...
            </>
          ) : (
            'Continue'
          )}
        </button>

        {/* Back to login */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a
            href="/login"
            style={{
              fontSize: '13px',
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
