import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, MailCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function EmailChangeVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, logout } = useAuth();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'ready' : 'error');
  const [message, setMessage] = useState(
    token
      ? 'Review and confirm this request to change the login email for your HRMS account.'
      : 'This verification link is incomplete.'
  );
  const isPending = status === 'checking';

  const confirmEmailChange = async () => {
    if (!token || isPending) return;
    setStatus('checking');
    setMessage('Verifying your email change...');

    try {
      const response = await api.confirmEmailChange(token);
      setStatus('success');
      setMessage(response?.message || 'Your login email has been verified.');
      navigate('/verify-email-change', { replace: true });

      if (
        isAuthenticated
        && String(currentUser?.user_id) === String(response?.data?.target_user_id)
      ) {
        try {
          await logout();
        } catch {
          setMessage('Your login email is verified. Sign in again with the new email address.');
        }
      }
    } catch (error) {
      setStatus('error');
      setMessage(error?.message || 'This verification link is invalid, expired, or already used.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg sm:p-9">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
          status === 'success'
            ? 'bg-emerald-50 text-emerald-700'
            : status === 'error'
              ? 'bg-rose-50 text-rose-700'
              : status === 'ready'
                ? 'bg-teal-50 text-teal-700'
                : 'bg-slate-100 text-slate-600'
        }`}>
          {isPending ? (
            <LoaderCircle className="h-6 w-6 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : status === 'ready' ? (
            <MailCheck className="h-6 w-6" />
          ) : (
            <ShieldAlert className="h-6 w-6" />
          )}
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {isPending
            ? 'Verifying email'
            : status === 'success'
              ? 'Email verified'
              : status === 'ready'
                ? 'Confirm email change'
                : 'Verification failed'}
        </h1>
        <p role="status" className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        {status === 'ready' && (
          <button
            type="button"
            onClick={confirmEmailChange}
            className="mt-6 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Confirm email change
          </button>
        )}
        {status !== 'ready' && !isPending && (
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/', { replace: true })}
            className="mt-6 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {isAuthenticated ? 'Return to HRMS' : 'Continue to sign in'}
          </button>
        )}
      </section>
    </main>
  );
}
