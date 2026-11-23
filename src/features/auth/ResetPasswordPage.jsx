import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import api from '../../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const hasValidLink = Boolean(token && email);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.resetPassword(email, token, password, confirmation);
      setIsComplete(true);
      setMessage(response?.message || 'Your password has been successfully reset.');
    } catch (requestError) {
      setError(
        requestError?.message ||
        requestError?.data?.message ||
        'Could not reset your password. The link may have expired.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-100 via-slate-100 to-emerald-50 px-4 py-8 flex items-center justify-center font-sans selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-100/90 bg-white shadow-[0_20px_60px_-15px_rgba(6,55,35,0.25)] p-7 sm:p-9">
        
        {/* Brand / Icon header */}
        <div className="text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isComplete
              ? 'bg-emerald-100 text-emerald-700'
              : hasValidLink
                ? 'bg-gradient-to-br from-emerald-700 to-green-600 text-white shadow-md shadow-emerald-700/20'
                : 'bg-rose-100 text-rose-700'
          }`}>
            {isComplete ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : hasValidLink ? (
              <KeyRound className="h-7 w-7" />
            ) : (
              <AlertCircle className="h-7 w-7" />
            )}
          </div>

          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {isComplete ? 'Password Reset Complete' : 'Reset Your Password'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">Pinweb HRMS Enterprise Portal</p>
        </div>

        {/* State 1: Success Complete */}
        {isComplete ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <p className="font-semibold text-emerald-950">{message}</p>
              <p className="mt-1 text-emerald-800">You can now sign in to your HRMS dashboard using your new password.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 hover:from-emerald-800 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Sign In to Your Account
            </button>
          </div>
        ) : !hasValidLink ? (
          /* State 2: Invalid Link */
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <p className="font-semibold">Invalid or Incomplete Link</p>
              <p className="mt-1">
                This password reset link is missing required parameters or is invalid. Please request a new link from the login page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </div>
        ) : (
          /* State 3: Reset Form */
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
              Resetting password for: <strong className="text-slate-800">{email}</strong>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              New Password
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={255}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 shadow-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Confirm New Password
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showConfirmation ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={255}
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 shadow-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 hover:from-emerald-800 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Set New Password</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
