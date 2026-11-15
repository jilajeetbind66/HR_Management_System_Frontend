import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Mail, Search, ShieldCheck, UserRound } from 'lucide-react';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';

export default function UserAccessManagement() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmailUser, setSelectedEmailUser] = useState(null);
  const [email, setEmail] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailFormError, setEmailFormError] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const usersResponse = await api.getAdminUsers();
      setUsers(usersResponse?.data || []);
    } catch (error) {
      setLoadError(error?.message || 'Could not load user accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => (
      [user.name, user.email, user.role, user.employee_code]
        .some((value) => String(value || '').toLowerCase().includes(query))
    ));
  }, [search, users]);

  const closeResetDialog = () => {
    if (isSaving) return;
    setSelectedUser(null);
    setPassword('');
    setPasswordConfirmation('');
    setFormError('');
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    setIsSaving(true);
    setFormError('');

    try {
      await api.resetUserPassword(selectedUser.id, password, passwordConfirmation);
      setStatusMessage(`Password reset successfully for ${selectedUser.name}.`);
      setSelectedUser(null);
      setPassword('');
      setPasswordConfirmation('');
    } catch (error) {
      const validationMessage = error?.data?.errors?.password?.[0];
      setFormError(validationMessage || error?.message || 'Could not reset this password.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeEmailDialog = () => {
    if (isSavingEmail) return;
    setSelectedEmailUser(null);
    setEmail('');
    setEmailConfirmation('');
    setEmailCurrentPassword('');
    setEmailFormError('');
  };

  const submitEmailUpdate = async (event) => {
    event.preventDefault();
    if (!selectedEmailUser) return;

    setIsSavingEmail(true);
    setEmailFormError('');

    try {
      const response = await api.updateUserEmail(
        selectedEmailUser.id,
        emailCurrentPassword,
        email,
        emailConfirmation
      );
      setStatusMessage(response?.message || `A verification link was sent to ${email.trim().toLowerCase()}.`);
      setSelectedEmailUser(null);
      setEmail('');
      setEmailConfirmation('');
      setEmailCurrentPassword('');
    } catch (error) {
      const validationMessage = error?.data?.errors?.email?.[0]
        || error?.data?.errors?.email_confirmation?.[0]
        || error?.data?.errors?.current_password?.[0];
      setEmailFormError(validationMessage || error?.message || 'Could not update this email.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="User access"
        subtitle="Manage login emails and passwords. Existing passwords are never displayed."
        action={
          <label className="relative block w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users"
              aria-label="Search users"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        }
        bodyClassName="p-0"
      >
        {statusMessage && (
          <p role="status" className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {statusMessage}
          </p>
        )}

        {loadError ? (
          <div role="alert" className="p-6 text-center">
            <p className="text-sm text-rose-700">{loadError}</p>
            <button
              type="button"
              onClick={loadUsers}
              className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <p role="status" className="p-8 text-center text-sm text-slate-500">Loading user accounts...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {users.length ? 'No accounts match your search.' : 'No user accounts found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Login status</th>
                  <th className="px-5 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">{user.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">{user.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{user.role?.replace(/_/g, ' ') || 'User'}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{user.employee_code || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmailUser(user);
                            setEmail('');
                            setEmailConfirmation('');
                            setEmailCurrentPassword('');
                            setEmailFormError('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Change email
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setPassword('');
                            setPasswordConfirmation('');
                            setFormError('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Passwords are securely hashed. Changing another account's credentials signs out its active sessions.
      </p>

      <Modal
        isOpen={Boolean(selectedEmailUser)}
        onClose={closeEmailDialog}
        title={`Change login email${selectedEmailUser ? `: ${selectedEmailUser.name}` : ''}`}
        subtitle="The login email changes only after the new address is verified."
        maxWidth="max-w-md"
      >
        <form onSubmit={submitEmailUpdate} className="space-y-4">
          {emailFormError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {emailFormError}
            </p>
          )}
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Current email</p>
            <p className="mt-0.5 break-all text-sm text-slate-800">{selectedEmailUser?.email}</p>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            New email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Confirm new email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={emailConfirmation}
              onChange={(event) => setEmailConfirmation(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Your current password
            <PasswordInput
              autoComplete="current-password"
              required
              value={emailCurrentPassword}
              onChange={(event) => setEmailCurrentPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            {selectedEmailUser?.id === currentUser?.user_id
              ? 'This account stays on the current email until verified. Confirming the new address signs out all sessions.'
              : 'The account keeps its existing email until confirmed. The target user is signed out after the change takes effect.'}
            {' '}You must confirm your own current password to request this change.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeEmailDialog}
              disabled={isSavingEmail}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEmail}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {isSavingEmail ? 'Sending...' : 'Send verification'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={closeResetDialog}
        title={`Reset password${selectedUser ? `: ${selectedUser.name}` : ''}`}
        subtitle="Set a new password. The existing password cannot be viewed."
        maxWidth="max-w-md"
      >
        <form onSubmit={submitPasswordReset} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {formError}
            </p>
          )}
          <label className="block text-xs font-medium text-slate-700">
            New password
            <PasswordInput
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={255}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Confirm new password
            <PasswordInput
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={255}
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Use at least 12 characters. {selectedUser?.id === currentUser?.user_id
              ? 'Other sessions will be signed out; this admin session will stay active.'
              : "The account's active sessions will be signed out."}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeResetDialog}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? 'Resetting...' : 'Set new password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
