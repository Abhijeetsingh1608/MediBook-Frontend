import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Key, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

export default function AdminSetup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', adminCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!form.fullName || !form.email || !form.password || !form.adminCode) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/admin/register`, {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        adminCode: form.adminCode,
      });

      setSuccess('✅ Admin account created successfully!');
      setForm({ fullName: '', email: '', password: '', adminCode: '' });
      
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create admin. Check the secret code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'white',
        padding: 40,
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: 400,
        width: '100%',
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Admin Setup</h1>
          <p style={{ fontSize: 14, color: '#666' }}>Create the first admin account</p>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            border: '1px solid #fcc',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            color: '#3c3',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            border: '1px solid #cfc',
          }}>
            {success}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handle}
                placeholder="Owner Name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
                required
              />
              <span style={{ position: 'absolute', left: 10, top: 10, color: '#999' }}>👤</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handle}
                placeholder="admin@medibook.com"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
                required
              />
              <Mail size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#999' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handle}
                placeholder="Min 6 characters"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#999' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#333' }}>
              Admin Secret Code
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                name="adminCode"
                value={form.adminCode}
                onChange={handle}
                placeholder="Enter secret code"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
                required
              />
              <Key size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#999' }} />
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              Only the owner knows this code
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = '#5568d3';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.background = '#667eea';
            }}
          >
            {loading ? '⏳ Creating...' : <><ArrowRight size={16} /> Create Admin Account</>}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#999' }}>
          This page is hidden and only accessible via direct URL.
        </div>
      </div>
    </div>
  );
}
