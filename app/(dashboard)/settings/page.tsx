'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { useSeries } from '@/hooks/useSeries';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/apiFetch';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
  phone: string;
  role: string;
  is_super_admin: boolean;
  invited_by: string | null;
  invited_at: string | null;
  last_login: string | null;
  last_password_change: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  last_login: string | null;
  created_at: string;
  status?: 'pending' | 'active' | 'suspended' | 'expired';
  invite_expires_at?: string | null;
}

export default function SettingsPage() {
  const { user, logout, isSuperAdmin } = useAuth();
  const { products } = useProducts();
  const { series } = useSeries();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Admin users management
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Invite user
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitingUser, setInvitingUser] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Remove admin
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<AdminUser | null>(null);

  // Transfer super admin
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [adminToTransfer, setAdminToTransfer] = useState<AdminUser | null>(null);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState('');

  // Reset password state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Destructive action confirmations
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);

  const loadProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
    }

    if (data) {
      setProfile(data);
    } else {
      // Create profile from auth metadata
      const newProfile = {
        id: user.id,
        email: user.username,
        full_name: user.name || '',
        display_name: user.name || '',
        role: 'admin',
        is_super_admin: false,
      };
      await supabase.from('user_profiles').insert(newProfile);
      setProfile(newProfile as UserProfile);
    }

    setLoadingProfile(false);
  };

  const loadAdminUsers = async () => {
    setLoadingAdmins(true);
    const response = await authFetch('/api/admin?action=listAdminUsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listAdminUsers' }),
    });
    const data = await response.json();
    if (data.users) {
      setAdminUsers(data.users as AdminUser[]);
    }
    setLoadingAdmins(false);
  };

  useEffect(() => {
    loadProfile();
    if (isSuperAdmin) {
      loadAdminUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loaders are recreated each render; rerun only when user/role changes
  }, [user, isSuperAdmin]);

  const saveProfile = async () => {
    if (!user || !profile) return;
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        full_name: profile.full_name,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
        role: profile.role,
        is_super_admin: profile.is_super_admin,
      });

    if (error) {
      setProfileError('Failed to save profile. Please try again.');
      console.error('Error saving profile:', error);
    } else {
      setProfileSuccess('Profile saved successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    }

    setSavingProfile(false);
  };

  const handleInviteUser = async () => {
    setInviteError('');
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setInvitingUser(true);

    const response = await authFetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'inviteUser',
        email: inviteEmail,
        fullName: inviteName || inviteEmail.split('@')[0],
        invitedBy: user?.id,
      }),
    });

    const data = await response.json();

    if (data.error) {
      setInviteError('Failed to create invitation: ' + data.error);
    } else {
      setInviteSuccess(data.message || `Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      loadAdminUsers();
    }

    setInvitingUser(false);
  };

  const setInviteSuccess = (message: string) => {
    setProfileSuccess(message);
    setTimeout(() => setProfileSuccess(''), 5000);
  };

  const handleRemoveAdmin = async () => {
    if (!adminToRemove) return;

    const response = await authFetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'removeAdmin',
        userId: adminToRemove.id,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setProfileSuccess(`Admin "${adminToRemove.full_name || adminToRemove.email}" removed`);
      setShowRemoveConfirm(false);
      setAdminToRemove(null);
      loadAdminUsers();
    } else {
      setProfileError('Failed to remove admin: ' + data.error);
    }
  };

  const handleResendInvite = async (admin: AdminUser) => {
    const response = await authFetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resendInvite',
        userId: admin.id,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setProfileSuccess(data.message);
      loadAdminUsers();
    } else {
      setProfileError('Failed to resend invite: ' + data.error);
    }
  };

  const handleTransferSuperAdmin = async () => {
    if (!adminToTransfer || !user) return;

    // Transfer super admin role
    const { error: error1 } = await supabase
      .from('user_profiles')
      .update({ is_super_admin: false })
      .eq('id', user.id);

    const { error: error2 } = await supabase
      .from('user_profiles')
      .update({ is_super_admin: true })
      .eq('id', adminToTransfer.id);

    if (!error1 && !error2) {
      setProfileSuccess(`Super admin role transferred to "${adminToTransfer.full_name || adminToTransfer.email}"`);
      setShowTransferConfirm(false);
      setAdminToTransfer(null);
      loadAdminUsers();
      loadProfile();
      // Current user becomes regular admin
      logout();
    } else {
      setProfileError('Failed to transfer super admin role');
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setChangingPassword('Verifying current password...');

    // Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user?.username || '',
      password: currentPassword,
    });

    if (verifyError) {
      setPasswordError('Current password is incorrect');
      setChangingPassword('');
      return;
    }

    setChangingPassword('Updating password...');

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setPasswordError('Failed to update password: ' + updateError.message);
      setChangingPassword('');
      return;
    }

    // Record password change in profile
    await supabase
      .from('user_profiles')
      .update({ last_password_change: new Date().toISOString() })
      .eq('id', user?.id);

    setPasswordSuccess('Password changed successfully!');
    setChangingPassword('');
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setResettingPassword(true);

    const { error } = await supabase.auth.resetPasswordForEmail(user.username, {
      redirectTo: `${window.location.origin}/login?mode=reset`,
    });

    if (error) {
      setPasswordError('Failed to send reset email: ' + error.message);
    } else {
      // Record reset request
      await supabase
        .from('user_profiles')
        .update({ password_reset_requested_at: new Date().toISOString() })
        .eq('id', user?.id);

      setPasswordSuccess('Password reset email sent! Check your inbox.');
      setShowResetConfirm(false);
    }

    setResettingPassword(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'welkinrim-session=; path=/; max-age=0; SameSite=Strict';
    logout();
    setShowLogoutConfirm(false);
  };

  const handleClearCache = async () => {
    localStorage.clear();
    sessionStorage.clear();
    setShowClearCacheConfirm(false);
    window.location.reload();
  };

  // Calculate stats
  const publishedCount = products.filter(p => p.is_published).length;
  const draftCount = products.filter(p => !p.is_published).length;
  const deletedCount = products.filter(p => p.is_deleted).length;

  // Profile completion percentage
  const profileFields = profile ? ['full_name', 'display_name', 'phone'] : [];
  const filledFields = profileFields.filter(f => {
    const value = profile?.[f as keyof UserProfile];
    return typeof value === 'string' && value.trim();
  }).length;
  const profileCompletion = Math.round((filledFields / profileFields.length) * 100);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      <div className="settings-sections">
        {/* Profile Section */}
        <section className="settings-section">
          <h2 className="section-title">Profile</h2>

          {/* Profile Completion */}
          <div className="completion-bar">
            <div className="completion-header">
              <span className="completion-label">Profile Completion</span>
              <span className="completion-percent">{profileCompletion}%</span>
            </div>
            <div className="completion-track">
              <div className="completion-fill" style={{ width: `${profileCompletion}%` }} />
            </div>
            {profileCompletion < 100 && (
              <p className="completion-hint">Complete your profile for better account management</p>
            )}
          </div>

          {loadingProfile ? (
            <div className="loading">Loading profile...</div>
          ) : (
            <>
              {profileError && <div className="alert alert-error">{profileError}</div>}
              {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile?.full_name || ''}
                    onChange={(e) => setProfile(p => p ? { ...p, full_name: e.target.value } : null)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile?.display_name || ''}
                    onChange={(e) => setProfile(p => p ? { ...p, display_name: e.target.value } : null)}
                    placeholder="Enter display name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={profile?.phone || ''}
                    onChange={(e) => setProfile(p => p ? { ...p, phone: e.target.value } : null)}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input disabled"
                    value={user?.username || ''}
                    disabled
                  />
                  <span className="form-hint">Email is managed by authentication system</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div className="role-badge">
                    {isSuperAdmin ? (
                      <span className="badge badge-super-admin">SUPER ADMIN</span>
                    ) : (
                      <span className="badge badge-admin">ADMIN</span>
                    )}
                  </div>
                  <span className="form-hint">
                    {isSuperAdmin
                      ? 'You have full access to all features including user management'
                      : 'You can manage products and series. User management is restricted to super admins'}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">User ID</label>
                  <input
                    type="text"
                    className="form-input disabled mono"
                    value={user?.id || ''}
                    disabled
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Admin Users Section - Only for Super Admin */}
        {isSuperAdmin && (
          <section className="settings-section">
            <h2 className="section-title">
              Admin Users
              <span className="section-badge">{adminUsers.length}</span>
            </h2>

            <div className="section-actions">
              <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                <InviteIcon />
                Invite Admins
              </button>
            </div>

            {loadingAdmins ? (
              <div className="loading">Loading admin users...</div>
            ) : (
              <div className="admin-users-list">
                {adminUsers.map((admin) => (
                  <div key={admin.id} className="admin-user-card">
                    <div className="admin-info">
                      <div className="admin-avatar">
                        {admin.full_name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="admin-details">
                        <span className="admin-name">{admin.full_name || 'Unnamed'}</span>
                        <span className="admin-email">{admin.email}</span>
                        <div className="admin-meta">
                          {admin.is_super_admin && (
                            <span className="badge badge-super-admin small">SUPER ADMIN</span>
                          )}
                          {admin.status === 'pending' && (
                            <span className="badge badge-pending small">PENDING</span>
                          )}
                          {admin.status === 'expired' && (
                            <span className="badge badge-expired small">EXPIRED</span>
                          )}
                          {admin.status === 'active' && !admin.is_super_admin && (
                            <span className="badge badge-active small">ACTIVE</span>
                          )}
                          <span className="admin-date">
                            {admin.status === 'pending' || admin.status === 'expired' ? 'Invited: ' : 'Joined: '}
                            {new Date(admin.created_at).toLocaleDateString()}
                          </span>
                          {admin.status === 'pending' && admin.invite_expires_at && (
                            <span className="admin-date warning">
                              Expires: {new Date(admin.invite_expires_at).toLocaleDateString()}
                            </span>
                          )}
                          {admin.last_login && admin.status === 'active' && (
                            <span className="admin-date">
                              Last login: {new Date(admin.last_login).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="admin-actions">
                      {!admin.is_super_admin && admin.id !== user?.id && (
                        <>
                          {(admin.status === 'pending' || admin.status === 'expired') && (
                            <button
                              className="btn btn-secondary small"
                              onClick={() => handleResendInvite(admin)}
                              title="Resend invitation"
                            >
                              <ResendIcon />
                              Resend
                            </button>
                          )}
                          <button
                            className="btn btn-outline small"
                            onClick={() => {
                              setAdminToTransfer(admin);
                              setShowTransferConfirm(true);
                            }}
                            title="Transfer super admin role"
                          >
                            <TransferIcon />
                            Transfer
                          </button>
                          <button
                            className="btn btn-danger small"
                            onClick={() => {
                              setAdminToRemove(admin);
                              setShowRemoveConfirm(true);
                            }}
                            title="Remove admin"
                          >
                            <RemoveIcon />
                            Remove
                          </button>
                        </>
                      )}
                      {admin.id === user?.id && (
                        <span className="self-indicator">You</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Security Section */}
        <section className="settings-section">
          <h2 className="section-title">Security</h2>

          <div className="security-items">
            <div className="security-item">
              <div className="security-info">
                <span className="security-label">Password</span>
                <span className="security-status">
                  {profile?.last_password_change
                    ? `Last changed: ${new Date(profile.last_password_change).toLocaleDateString()}`
                    : 'Not recorded'}
                </span>
              </div>
              <div className="security-actions">
                <button className="btn btn-secondary" onClick={() => setShowPasswordModal(true)}>
                  Change Password
                </button>
                <button className="btn btn-outline" onClick={() => setShowResetConfirm(true)}>
                  Reset via Email
                </button>
              </div>
            </div>

            <div className="security-item">
              <div className="security-info">
                <span className="security-label">Session</span>
                <span className="security-status status-ok">Active</span>
              </div>
              <div className="security-actions">
                <button className="btn btn-outline" onClick={() => setShowLogoutConfirm(true)}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
          {passwordError && !showPasswordModal && <div className="alert alert-error">{passwordError}</div>}
        </section>

        {/* Database Stats Section */}
        <section className="settings-section">
          <h2 className="section-title">Database Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{products.length}</div>
              <div className="stat-label">Total Products</div>
              <div className="stat-breakdown">
                <span className="stat-item">{publishedCount} published</span>
                <span className="stat-item">{draftCount} drafts</span>
                {deletedCount > 0 && <span className="stat-item stat-warning">{deletedCount} in trash</span>}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{series.length}</div>
              <div className="stat-label">Product Series</div>
            </div>
            {isSuperAdmin && (
              <div className="stat-card">
                <div className="stat-value">{adminUsers.length}</div>
                <div className="stat-label">Admin Users</div>
                <div className="stat-breakdown">
                  <span className="stat-item">{adminUsers.filter(a => a.is_super_admin).length} super admin</span>
                  <span className="stat-item">{adminUsers.filter(a => !a.is_super_admin).length} admin</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Website Links Section */}
        <section className="settings-section">
          <h2 className="section-title">Website URLs</h2>
          <div className="links-list">
            <a href="https://www.welkinrim.com" target="_blank" rel="noopener noreferrer" className="link-item primary">
              <span className="link-label">Primary URL</span>
              <span className="link-url">www.welkinrim.com</span>
              <span className="link-arrow">→</span>
            </a>
            <a href="https://welkinrim-tech-one.vercel.app" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">Secondary URL</span>
              <span className="link-url">welkinrim-tech-one.vercel.app</span>
              <span className="link-arrow">→</span>
            </a>
          </div>
        </section>

        {/* Quick Links Section */}
        <section className="settings-section">
          <h2 className="section-title">Database</h2>
          <div className="links-list">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">Dashboard</span>
              <span className="link-arrow">→</span>
            </a>
            <a href="https://supabase.com/dashboard/project/axjomaehmyohlnbyekjr/sql" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">SQL Editor</span>
              <span className="link-arrow">→</span>
            </a>
            <a href="https://supabase.com/dashboard/project/axjomaehmyohlnbyekjr/editor" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">Table Editor</span>
              <span className="link-arrow">→</span>
            </a>
            <a href="https://supabase.com/dashboard/project/axjomaehmyohlnbyekjr/storage/buckets" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">Storage</span>
              <span className="link-arrow">→</span>
            </a>
            <a href="https://supabase.com/dashboard/project/axjomaehmyohlnbyekjr/auth/users" target="_blank" rel="noopener noreferrer" className="link-item">
              <span className="link-label">Auth Users</span>
              <span className="link-arrow">→</span>
            </a>
          </div>
        </section>

        {/* Actions Section */}
        <section className="settings-section">
          <h2 className="section-title">Actions</h2>
          <div className="actions-list">
            <button className="btn btn-outline" onClick={() => setShowClearCacheConfirm(true)}>
              Clear Local Cache
            </button>
            <button className="btn btn-danger" onClick={() => setShowLogoutConfirm(true)}>
              Sign Out
            </button>
          </div>
        </section>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Invite Admin User</h3>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {inviteError && <div className="alert alert-error">{inviteError}</div>}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                />
                <span className="form-hint">An invitation will be sent to this email</span>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Enter full name (optional)"
                />
              </div>

              <p className="modal-hint">
                The invited user will receive an email with instructions to set up their account.
                They will be assigned the <strong>Admin</strong> role.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleInviteUser}
                disabled={invitingUser}
              >
                {invitingUser ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {passwordError && <div className="alert alert-error">{passwordError}</div>}

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>

              <p className="modal-hint">After changing your password, you&apos;ll need to sign in again.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={!!changingPassword}
              >
                {changingPassword || 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Password"
        message="A password reset link will be sent to your email address. You'll need to click the link to set a new password."
        confirmText="Send Reset Email"
        cancelText="Cancel"
        confirmType="primary"
        onConfirm={handleResetPassword}
        onCancel={() => setShowResetConfirm(false)}
        isLoading={resettingPassword}
      />

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out? You'll need to log in again to access the admin console."
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showClearCacheConfirm}
        title="Clear Local Cache"
        message="This will clear all locally stored data and reload the page. Any unsaved changes will be lost."
        confirmText="Clear Cache"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleClearCache}
        onCancel={() => setShowClearCacheConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Admin User"
        message={`Are you sure you want to remove "${adminToRemove?.full_name || adminToRemove?.email}"? They will no longer have access to the admin console.`}
        confirmText="Remove"
        cancelText="Cancel"
        confirmType="danger"
        onConfirm={handleRemoveAdmin}
        onCancel={() => {
          setShowRemoveConfirm(false);
          setAdminToRemove(null);
        }}
      />

      <ConfirmDialog
        isOpen={showTransferConfirm}
        title="Transfer Super Admin Role"
        message={`Are you sure you want to transfer the super admin role to "${adminToTransfer?.full_name || adminToTransfer?.email}"? You will become a regular admin and lose super admin privileges. You will need to sign in again.`}
        confirmText="Transfer Role"
        cancelText="Cancel"
        confirmType="warning"
        onConfirm={handleTransferSuperAdmin}
        onCancel={() => {
          setShowTransferConfirm(false);
          setAdminToTransfer(null);
        }}
      />

      <style jsx>{`
        .settings-page {
          padding: 24px;
          max-width: 900px;
        }

        .settings-header {
          margin-bottom: 32px;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: 28px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin-bottom: 4px;
        }

        .page-subtitle {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-ink-mid);
        }

        .settings-sections {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .settings-section {
          background: var(--color-white-pure);
          border: 1px solid var(--color-white-border);
          border-radius: 8px;
          padding: 24px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0 0 20px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--color-white-border);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-badge {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          background: var(--color-gold);
          color: var(--color-ink);
          padding: 4px 10px;
          border-radius: 12px;
        }

        .section-actions {
          margin-bottom: 16px;
        }

        /* Profile Completion */
        .completion-bar {
          margin-bottom: 24px;
        }

        .completion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .completion-label {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .completion-percent {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          color: var(--color-ink);
        }

        .completion-track {
          height: 8px;
          background: var(--color-white-grey);
          border-radius: 4px;
          overflow: hidden;
        }

        .completion-fill {
          height: 100%;
          background: var(--color-gold);
          border-radius: 4px;
          transition: width 300ms ease;
        }

        .completion-hint {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-ink-soft);
          margin: 8px 0 0 0;
        }

        /* Form */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
        }

        .form-input {
          padding: 10px 14px;
          border: 1px solid var(--color-white-border);
          border-radius: 4px;
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-ink);
          background: var(--color-white-pure);
          transition: border-color 150ms, box-shadow 150ms;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--color-gold);
          box-shadow: 0 0 0 3px rgba(232, 168, 0, 0.1);
        }

        .form-input.disabled {
          background: var(--color-white-grey);
          color: var(--color-ink-soft);
          cursor: not-allowed;
        }

        .form-input.mono {
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .form-hint {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .form-actions {
          margin-top: 20px;
        }

        /* Role Badge */
        .role-badge {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 6px 12px;
          border-radius: 4px;
        }

        .badge-super-admin {
          background: var(--color-gold);
          color: var(--color-ink);
        }

        .badge-admin {
          background: var(--color-white-grey);
          color: var(--color-ink);
          border: 1px solid var(--color-white-border);
        }

        .badge-pending {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fbbf24;
        }

        .badge-expired {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }

        .badge-active {
          background: #d1fae5;
          color: #065f46;
        }

        .admin-date.warning {
          color: #b45309;
        }

        .badge.small {
          font-size: 10px;
          padding: 4px 8px;
        }

        /* Admin Users List */
        .admin-users-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .admin-user-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: var(--color-white-grey);
          border-radius: 6px;
          border: 1px solid var(--color-white-border);
        }

        .admin-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-avatar {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-gold);
          color: var(--color-ink);
          border-radius: 8px;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
        }

        .admin-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .admin-name {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .admin-email {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .admin-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .admin-date {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-soft);
        }

        .admin-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .self-indicator {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-gold);
          background: rgba(232, 168, 0, 0.1);
          padding: 6px 12px;
          border-radius: 4px;
        }

        /* Alerts */
        .alert {
          padding: 12px 16px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 13px;
          margin-bottom: 16px;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        /* Security */
        .security-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .security-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: var(--color-white-grey);
          border-radius: 6px;
        }

        .security-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .security-label {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .security-status {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .security-status.status-ok {
          color: #166534;
        }

        .security-actions {
          display: flex;
          gap: 8px;
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .stat-card {
          background: var(--color-white-grey);
          border-radius: 6px;
          padding: 20px;
          text-align: center;
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 700;
          color: var(--color-ink);
        }

        .stat-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-soft);
          margin-top: 4px;
        }

        .stat-breakdown {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
        }

        .stat-item {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-ink-mid);
          background: var(--color-white-pure);
          padding: 4px 8px;
          border-radius: 3px;
        }

        .stat-item.stat-warning {
          color: #dc2626;
          background: #fef2f2;
        }

        /* Links */
        .links-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .link-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-white-grey);
          border-radius: 4px;
          color: var(--color-ink);
          text-decoration: none;
          transition: all 150ms ease;
        }

        .link-item:hover {
          background: var(--color-gold);
        }

        .link-item.primary {
          border: 1px solid var(--color-gold);
        }

        .link-label {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
        }

        .link-url {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-ink-soft);
        }

        .link-arrow {
          font-family: var(--font-mono);
          font-size: 16px;
        }

        /* Buttons */
        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms ease;
          border: 1px solid transparent;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn.small {
          padding: 6px 12px;
          font-size: 11px;
        }

        .btn-primary {
          background: var(--color-gold);
          border-color: var(--color-gold);
          color: var(--color-ink);
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .btn-secondary {
          background: var(--color-white-pure);
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--color-white-grey);
        }

        .btn-outline {
          background: transparent;
          border-color: var(--color-white-border);
          color: var(--color-ink);
        }

        .btn-outline:hover:not(:disabled) {
          background: var(--color-white-grey);
        }

        .btn-danger {
          background: #dc2626;
          border-color: #dc2626;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #b91c1c;
        }

        .actions-list {
          display: flex;
          gap: 12px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(14, 14, 15, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal {
          background: var(--color-white-pure);
          border-radius: 8px;
          width: 100%;
          max-width: 420px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-white-border);
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 18px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink);
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          font-size: 20px;
          color: var(--color-ink-soft);
          cursor: pointer;
          border-radius: 4px;
        }

        .modal-close:hover {
          background: var(--color-white-grey);
        }

        .modal-body {
          padding: 24px;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-white-border);
          justify-content: flex-end;
        }

        .modal-hint {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-ink-soft);
          margin: 16px 0 0 0;
        }

        .loading {
          text-align: center;
          padding: 40px;
          font-family: var(--font-mono);
          color: var(--color-ink-soft);
        }
      `}</style>
    </div>
  );
}

function InviteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 8a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M1 14v-1a4 4 0 014-4h2" strokeLinecap="round" />
      <path d="M11 6h4M13 4v4" strokeLinecap="round" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 7h12M10 4l3 3-3 3M4 10l-3-3 3-3" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

function ResendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7a5 5 0 1 1 5 5" />
      <path d="M2 7V4M2 7H5" />
    </svg>
  );
}