import React, { useState } from 'react';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PasswordInput from '../../components/common/PasswordInput';
import { userRoleLabels } from '../../config/userRoles';

export default function AccountSettingsView() {
  const { currentUser, changePassword } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    password: '',
    confirmation: '',
  });
  const [emailForm, setEmailForm] = useState({
    currentPassword: '',
    email: '',
    confirmation: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isRequestingEmail, setIsRequestingEmail] = useState(false);

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordStatus('');

    if (passwordForm.password !== passwordForm.confirmation) {
      setPasswordError('New password and confirmation must match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const result = await changePassword(
        passwordForm.currentPassword,
        passwordForm.password,
        passwordForm.confirmation
      );
      if (!result.success) {
        setPasswordError(result.message);
        return;
      }

      setPasswordForm({ currentPassword: '', password: '', confirmation: '' });
      setPasswordStatus('Password changed successfully. Other active sessions have been signed out.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const submitEmailChange = async (event) => {
    event.preventDefault();
    setEmailError('');
    setEmailStatus('');

    if (emailForm.email.trim().toLowerCase() !== emailForm.confirmation.trim().toLowerCase()) {
      setEmailError('New email and confirmation must match.');
      return;
    }

    setIsRequestingEmail(true);
    try {
      const response = await api.requestOwnEmailChange(
        emailForm.currentPassword,
        emailForm.email,
        emailForm.confirmation
      );
      setEmailForm({ currentPassword: '', email: '', confirmation: '' });
      setEmailStatus(response?.message || 'Check the new email address for a verification link.');
    } catch (error) {
      const errors = error?.data?.errors || {};
      setEmailError(
        errors.current_password?.[0]
        || errors.email?.[0]
        || errors.email_confirmation?.[0]
        || error?.message
        || 'Could not request an email change.'
      );
    } finally {
      setIsRequestingEmail(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Account & Security</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your own sign-in credentials. Changes are recorded and verified.</p>
      </header>

      <Card title="Account profile" subtitle="Your HRMS access identity and assigned role.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Name</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{currentUser?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Role</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{userRoleLabels[currentUser?.role] || currentUser?.role}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Login email</p>
            <p className="mt-1 break-all text-sm font-semibold text-slate-800">{currentUser?.email || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Email verification</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {currentUser?.email_verified_at ? 'Verified' : 'Not verified'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Employee code</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{currentUser?.employee_code || 'Not linked to an employee record'}</p>
          </div>
        </div>
      </Card>

      <Card title="Change password" subtitle="Use your current password and choose a new password with at least 12 characters.">
        <form onSubmit={submitPasswordChange} className="space-y-4">
          {passwordError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{passwordError}</p>}
          {passwordStatus && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{passwordStatus}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              Current password
              <PasswordInput
                autoComplete="current-password"
                required
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              New password
              <PasswordInput
                autoComplete="new-password"
                minLength={12}
                maxLength={255}
                required
                value={passwordForm.password}
                onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Confirm new password
              <PasswordInput
                autoComplete="new-password"
                minLength={12}
                maxLength={255}
                required
                value={passwordForm.confirmation}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmation: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <button type="submit" disabled={isSavingPassword} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
            <KeyRound className="h-4 w-4" />
            {isSavingPassword ? 'Changing password...' : 'Change password'}
          </button>
        </form>
      </Card>

      <Card title="Change login email" subtitle="The email changes only after you confirm the verification link sent to the new address.">
        <form onSubmit={submitEmailChange} className="space-y-4">
          {emailError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{emailError}</p>}
          {emailStatus && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{emailStatus}</p>}
          <label className="block text-xs font-medium text-slate-700">
            Confirm with current password
            <PasswordInput
              autoComplete="current-password"
              required
              value={emailForm.currentPassword}
              onChange={(event) => setEmailForm({ ...emailForm, currentPassword: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              New login email
              <input
                type="email"
                autoComplete="email"
                maxLength={255}
                required
                value={emailForm.email}
                onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Confirm new login email
              <input
                type="email"
                autoComplete="email"
                maxLength={255}
                required
                value={emailForm.confirmation}
                onChange={(event) => setEmailForm({ ...emailForm, confirmation: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Your existing login email remains active until verification succeeds. Confirming the new address signs out all your sessions.
          </p>
          <button type="submit" disabled={isRequestingEmail} className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">
            <Mail className="h-4 w-4" />
            {isRequestingEmail ? 'Sending verification...' : 'Send verification link'}
          </button>
        </form>
      </Card>
    </div>
  );
}
