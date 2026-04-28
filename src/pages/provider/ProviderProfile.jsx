import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { ProviderSidebar, Topbar, Loader } from '../../components/Layout';
import { getUser, saveAuth, getToken, authAPI, getInitials, clearAuth } from '../../utils/api';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;
const IMGBB_URL = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

export default function ProviderProfile() {
  const navigate = useNavigate();
  const user = getUser();
  const fileInputRef = useRef();

  // Profile form state
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Deactivation state
  const [confirming, setConfirming] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await authAPI.getProfile(user.userId);
        setProfile(res.data);
        setFullName(res.data.fullName || '');
        setPhone(res.data.phone || '');
        setProfilePicUrl(res.data.profilePicUrl || '');
      } catch (err) {
        alert('Failed to load profile.');
      }
    };
    if (user?.userId) loadProfile();
  }, []);

  // Avatar upload to ImgBB
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(IMGBB_URL, { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        setProfilePicUrl(data.data.url);
        alert('Photo uploaded!');
      } else {
        alert('Upload failed. Try again.');
      }
    } catch (err) {
      alert('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      alert('Full Name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      await authAPI.updateProfile(user.userId, {
        fullName,
        phone,
        profilePicUrl,
      });

      // Update localStorage
      const token = getToken();
      saveAuth(token, { ...user, fullName });

      alert('Profile updated successfully!');
    } catch (err) {
      alert('Failed to update profile. Try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = () => {
    const pwd = newPassword;
    if (pwd.length < 6) return { color: 'var(--danger, #ef4444)', percent: 33 };
    if (pwd.length < 9) return { color: '#eab308', percent: 66 };
    return { color: 'var(--success, #22c55e)', percent: 100 };
  };

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      alert('Current password is required.');
      return;
    }
    if (!newPassword.trim()) {
      alert('New password is required.');
      return;
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await authAPI.changePassword(user.userId, newPassword);
      alert('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert('Failed to update password. Try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Deactivate account
  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await authAPI.deactivate(user.userId);
      clearAuth();
      navigate('/login', { replace: true });
    } catch (err) {
      alert('Failed to deactivate account. Try again.');
      setConfirming(false);
      setDeactivating(false);
    }
  };

  if (!profile) {
    return (
      <div className="dashboard-layout">
        <ProviderSidebar />
        <div className="dashboard-main">
          <Topbar title="My Profile" />
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <ProviderSidebar />
      <div className="dashboard-main">
        <Topbar title="My Profile" />
        <div className="page-content fade-in">
          <p className="page-title">My Profile</p>
          <p className="page-subtitle">Manage your personal information and settings</p>

          {/* ── PROFILE INFO ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Profile Information</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 32, alignItems: 'start' }}>
              {/* Avatar Section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: profilePicUrl ? `url(${profilePicUrl})` : 'var(--primary)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: profilePicUrl ? 'block' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 32,
                    fontWeight: 700,
                    position: 'relative',
                  }}
                >
                  {!profilePicUrl && getInitials(fullName)}
                  {uploading && (
                    <div className="spinner" style={{ position: 'absolute', width: 20, height: 20 }} />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                  disabled={uploading}
                />
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Change Photo
                </button>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={user?.email || ''}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Email cannot be changed
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {savingProfile ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* ── CHANGE PASSWORD ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Change Password</span>
            </div>
            <div className="card-body" style={{ maxWidth: 400 }}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password Strength Bar */}
              {newPassword && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    height: 6,
                    background: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${getPasswordStrength().percent}%`,
                      background: getPasswordStrength().color,
                      transition: 'all 0.2s',
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {newPassword.length < 6 ? 'Too weak' : newPassword.length < 9 ? 'Medium' : 'Strong'}
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Update Password'}
              </button>
            </div>
          </div>

          {/* ── DANGER ZONE ── */}
          <div className="card" style={{ border: '1.5px solid var(--danger, #ef4444)' }}>
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--danger, #ef4444)' }}>
                Danger Zone
              </span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                Deactivating your account will disable your login. Your data will be preserved but you won't be able to access MediBook until an admin reactivates your account.
              </p>

              {!confirming ? (
                <button
                  className="btn"
                  style={{
                    background: 'var(--danger, #ef4444)',
                    color: 'white',
                    border: 'none',
                  }}
                  onClick={() => setConfirming(true)}
                >
                  Deactivate My Account
                </button>
              ) : (
                <div style={{
                  padding: 16,
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--danger, #ef4444)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  <AlertTriangle size={20} style={{ color: 'var(--danger, #ef4444)', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, marginBottom: 12 }}>
                      Are you sure you want to deactivate your account?
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn"
                        style={{
                          background: 'var(--danger, #ef4444)',
                          color: 'white',
                          border: 'none',
                        }}
                        onClick={handleDeactivate}
                        disabled={deactivating}
                      >
                        {deactivating ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Yes, Deactivate'}
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => setConfirming(false)}
                        disabled={deactivating}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
