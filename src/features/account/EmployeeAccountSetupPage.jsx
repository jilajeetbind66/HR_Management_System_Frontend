import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/common/PasswordInput';
import api from '../../services/api';

export default function EmployeeAccountSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const token = searchParams.get('token') || '';
  const emailFromLink = searchParams.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.completeAccountSetup(emailFromLink, token, password, confirmation);
      setIsComplete(true);
      setMessage(response?.message || 'Your password is set. You can now sign in to Pinweb HRMS.');
      navigate('/setup-password', { replace: true });
    } catch (requestError) {
      setError(requestError?.data?.message || requestError.message || 'Could not set your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueToSignIn = async () => {
    if (isAuthenticated) {
      try {
        await logout();
      } catch (logoutError) {
        setError(logoutError?.message || 'Could not sign out. Please sign out before switching accounts.');
        return;
      }
    }
    navigate('/', { replace: true });
  };

  const hasValidLink = Boolean(token && emailFromLink);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-lg sm:p-9">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
          isComplete ? 'bg-emerald-50 text-emerald-700' : hasValidLink ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {isComplete
            ? <CheckCircle2 className="h-6 w-6" />
            : hasValidLink
              ? <KeyRound className="h-6 w-6" />
              : <ShieldAlert className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-center text-xl font-bold text-slate-900">
          {isComplete ? 'Account setup complete' : 'Set up your HRMS password'}
        </h1>
        <p role="status" className="mt-2 text-center text-sm leading-6 text-slate-600">
          {isComplete
            ? message
            : hasValidLink
              ? `Create a password for ${emailFromLink}.`
              : 'This setup link is incomplete. Ask your HR team to send a new one.'}
        </p>

        {isComplete ? (
          <div className="mt-6">
            {error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <button
              type="button"
              onClick={continueToSignIn}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {isAuthenticated ? 'Sign out and continue to sign in' : 'Continue to sign in'}
            </button>
          </div>
        ) : hasValidLink ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <label className="block text-xs font-medium text-slate-700">
              New password (at least 12 characters)
              <PasswordInput
                autoComplete="new-password"
                minLength={12}
                maxLength={255}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Confirm new password
              <PasswordInput
                autoComplete="new-password"
                minLength={12}
                maxLength={255}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              This one-time link expires. If it has expired, ask your HR team to send a new one.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {isSubmitting && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Setting password...' : 'Set password'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
