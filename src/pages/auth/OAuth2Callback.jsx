import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, saveAuth, clearAuth } from '../../utils/api';

export default function OAuth2Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const processOAuthLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const userId = params.get('userId');
      const role = params.get('role');
      const name = params.get('name');

      if (!token) {
        setError('Missing authentication token. Please try logging in again.');
        return;
      }

      try {
        if (userId && role) {
          const user = {
            userId: parseInt(userId, 10),
            fullName: decodeURIComponent(name || ''),
            role,
          };
          saveAuth(token, user);
        } else {
          saveAuth(token, {});
          const meResponse = await authAPI.getCurrentUser();
          const me = meResponse.data;

          if (!me?.userId || !me?.role) {
            throw new Error('Authenticated user details could not be loaded');
          }

          saveAuth(token, {
            userId: me.userId,
            fullName: me.fullName || decodeURIComponent(name || ''),
            email: me.email,
            role: me.role,
          });
        }

        const storedUser = JSON.parse(localStorage.getItem('medibook_user') || '{}');

        if (storedUser.role === 'Patient') {
          navigate('/patient', { replace: true });
        } else if (storedUser.role === 'Provider') {
          navigate('/provider', { replace: true });
        } else if (storedUser.role === 'Admin') {
          navigate('/admin', { replace: true });
        } else {
          clearAuth();
          setError('Unknown role returned from Google login.');
        }
      } catch (err) {
        clearAuth();
        setError('Failed to process login: ' + err.message);
      }
    };

    processOAuthLogin();
  }, [navigate]);

  if (error) {
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
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
            Authentication Failed
          </h2>
          <div className="alert alert-error" style={{ marginBottom: '20px', fontSize: '13px' }}>
            {error}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/login', { replace: true })}
            style={{ width: '100%' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

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
      <div style={{ textAlign: 'center' }}>
        <span className="spinner" style={{ marginBottom: '20px', display: 'block' }} />
        <p style={{ fontSize: '16px', color: 'var(--text)', fontWeight: 500 }}>
          Signing you in with Google...
        </p>
      </div>
    </div>
  );
}
