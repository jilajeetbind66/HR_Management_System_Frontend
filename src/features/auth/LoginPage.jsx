import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle,
  Banknote,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

const roleChoices = [
  { id: 'employee', label: 'Employee', icon: UserRound },
  { id: 'manager', label: 'Manager', icon: Users },
  { id: 'hr', label: 'HR', icon: Briefcase },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

const features = [
  { label: 'Employee Management', icon: Users },
  { label: 'Attendance & Leave', icon: CalendarDays },
  { label: 'Performance Tracking', icon: TrendingUp },
  { label: 'Payroll Management', icon: Banknote },
  { label: 'Reports & Analytics', icon: BarChart3 },
];

const hrContactEmail = 'hr@pinweb.in';
const hrContactHref = `mailto:${hrContactEmail}?subject=${encodeURIComponent('Request HRMS access')}&body=${encodeURIComponent(
  'Hello HR Department,\n\nI need help with HRMS account access.\n\nName:\nWork email or employee code:\n\nPlease do not include any password.'
)}`;

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [roleType, setRoleType] = useState('hr');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleOpenForgotModal = () => {
    setForgotEmail(identifier ? identifier.trim() : '');
    setForgotMessage('');
    setForgotError('');
    setShowForgotModal(true);
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your work email or employee code.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await api.forgotPassword(forgotEmail.trim());
      setForgotMessage(response?.message || 'A password reset link has been sent to your email.');
    } catch (err) {
      setForgotError(err?.message || 'Could not send reset link. Please verify your email or contact HR.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const result = await login(identifier.trim(), password, roleType, rememberMe);
      if (!result.success) {
        setErrorMessage(result.message || 'Sign-in failed. Check your credentials and account type.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="hrms-login-page min-h-screen bg-gradient-to-br from-emerald-100 via-slate-100 to-emerald-50 px-4 py-4 sm:px-4 sm:py-8 lg:items-center lg:px-[14px] lg:py-[13px] flex items-center justify-center font-sans selection:bg-emerald-500 selection:text-white">
      <div className="hrms-login-layout grid w-full max-w-[1360px] overflow-hidden rounded-[20px] border border-emerald-100/80 bg-[#eef7f5] shadow-[0_30px_90px_-35px_rgba(6,55,35,0.45)] lg:min-h-0 lg:grid-cols-2">
        <section className="hrms-login-hero relative isolate flex min-h-[430px] flex-col overflow-hidden px-7 py-8 text-white sm:px-10 sm:py-10 lg:min-h-0 lg:px-14 lg:py-7">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-25"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.55) 1px, transparent 0)',
              backgroundSize: '28px 28px',
              maskImage: 'linear-gradient(to bottom right, black, transparent 75%)',
            }}
          />
          <div aria-hidden="true" className="hrms-login-waves" />

          <div className="relative z-10 max-w-lg">
            <p className="text-xl font-black leading-tight tracking-wide sm:text-2xl">Human Resource Management System</p>
            <span aria-hidden="true" className="mt-3 block h-1 w-32 rounded-full bg-green-500" />
          </div>

          <div className="relative z-10 mt-10 max-w-lg sm:mt-12 lg:mt-8">
            <p className="text-base font-bold text-white sm:text-lg">Pioneers Workforce</p>
            <h1 className="mt-2 text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl">
              Smarter <span className="text-green-400">HR.</span>
              <br />
              Stronger <span className="text-green-400">Workforce.</span>
            </h1>
            <p className="mt-5 max-w-sm text-base leading-6 text-emerald-50 sm:text-lg">
              Manage your people, processes and performance — all in one place.
            </p>
          </div>

          <div className="relative z-10 mt-5 grid max-w-md grid-cols-1 gap-1.5">
            {features.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-4 text-lg text-white">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-700 text-white shadow-[0_0_16px_rgba(16,185,129,0.45)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-auto grid grid-cols-3 gap-3 border-t border-emerald-300/50 pt-5 sm:mt-8 sm:gap-5 sm:pt-6 lg:mt-auto lg:pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 shrink-0 text-green-400" />
              <div>
                <p className="text-sm font-bold sm:text-base">People</p>
                <p className="text-[10px] text-emerald-100 sm:text-xs">Employee records</p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-x border-emerald-300/40 px-3 sm:px-5">
              <Building2 className="h-6 w-6 shrink-0 text-green-400" />
              <div>
                <p className="text-sm font-bold sm:text-base">Branches</p>
                <p className="text-[10px] text-emerald-100 sm:text-xs">Multi location</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 shrink-0 text-green-400" />
              <div>
                <p className="text-sm font-bold sm:text-base">Secure</p>
                <p className="text-[10px] text-emerald-100 sm:text-xs">Role based access</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-9 sm:px-10 sm:py-12 lg:px-8 lg:py-3">
          <div className="w-full max-w-[474px] lg:translate-x-3 lg:translate-y-4">
            <div className="flex justify-center">
              <img src="/pinweb-logo-login.png" alt="Pinweb logo" className="h-20 w-auto object-contain lg:h-16" />
            </div>
            <h2 className="mt-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:mt-1">
              <span className="text-green-600">HR</span> Management System
            </h2>
            <h3 className="mt-2 text-center text-xl font-bold text-slate-900 sm:text-2xl lg:mt-1 lg:text-xl">Welcome Back!</h3>
            <p className="mt-2 text-center text-base text-slate-500 lg:mt-1 lg:text-sm">Sign in to your account to continue</p>

            <div className="mt-5 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 lg:mt-3 lg:rounded-2xl" role="group" aria-label="Account type">
              {roleChoices.map(({ id, label, icon: Icon }) => {
                const selected = roleType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRoleType(id)}
                    className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-semibold transition sm:gap-1.5 sm:px-2 sm:text-sm lg:min-h-11 lg:gap-1 lg:px-1 lg:text-xs lg:rounded-xl ${
                      selected
                        ? 'bg-gradient-to-r from-green-500 to-green-700 text-white shadow-md shadow-green-700/20'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {errorMessage && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 lg:mt-3 lg:p-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 lg:mt-3 lg:space-y-3">
              <label className="relative block">
                <span className="sr-only">Email address or employee ID</span>
                <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 lg:left-4 lg:h-4 lg:w-4" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Email Address / Employee ID"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-14 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-green-500 focus:ring-4 focus:ring-green-100 lg:h-11 lg:rounded-xl lg:pl-11 lg:pr-3 lg:text-sm"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Password</span>
                <Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 lg:left-4 lg:h-4 lg:w-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-14 pr-14 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 hover:border-slate-300 focus:border-green-500 focus:ring-4 focus:ring-green-100 lg:h-11 lg:rounded-xl lg:pl-11 lg:pr-11 lg:text-sm"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

              <div className="flex items-center justify-between gap-3 pt-0.5 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-green-600 focus:ring-green-500 lg:h-4 lg:w-4"
                  />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  className="text-sm font-semibold text-green-700 hover:text-green-800 hover:underline lg:text-xs"
                >
                  Forgot Password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="hrms-login-submit !mt-5 flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold shadow-lg shadow-green-700/20 transition focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-70 lg:!mt-3 lg:!h-11 lg:rounded-xl lg:text-sm"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {loading ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <p className="hrms-login-footer mt-4 text-center text-sm text-slate-600 lg:mt-2 lg:text-xs">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="font-semibold text-green-700 hover:text-green-800 hover:underline"
              >
                Contact HR Department
              </button>
            </p>
            <p className="hrms-login-footer mt-3 text-center text-xs text-slate-400 lg:mt-1">
              © 2026 Pinweb Private Limited. All rights reserved.
            </p>
          </div>
        </section>
      </div>

      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Reset Corporate Password"
        subtitle="Password recovery via Brevo SMTP"
      >
        <div className="space-y-4 text-xs">
          {forgotMessage ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-950 text-sm">Reset Link Sent</h4>
                    <p className="mt-1 text-emerald-800 text-xs leading-relaxed">
                      {forgotMessage}
                    </p>
                    <p className="mt-2 text-emerald-700 text-[11px]">
                      Please check your inbox (and spam/junk folder) for the password reset email. The link is valid for 60 minutes.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" onClick={() => setShowForgotModal(false)}>Back to Sign In</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Enter your registered corporate email address (or employee code). We will send a secure one-time link to reset your password.
              </p>

              {forgotError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-700">
                Work Email or Employee Code
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. employee@pinweb.in or EMP-001"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 shadow-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="secondary" onClick={() => setShowForgotModal(false)} disabled={forgotLoading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={forgotLoading} className="flex items-center gap-1.5">
                  {forgotLoading ? (
                    <>
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Request HRMS Access"
        subtitle="New employee accounts are provisioned by HR"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            HR will create your employee record and linked login account, then send a one-time password setup link to your work email.
            Use that link to create your password, then sign in with your work email or employee code.
          </p>
          <a
            href={hrContactHref}
            className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <Mail className="h-4 w-4" />
            Email HR Department ({hrContactEmail})
          </a>
          <p className="text-center text-[11px] text-slate-500">Do not include your password in the email.</p>
          <div className="flex justify-end border-t border-slate-100 pt-2">
            <Button variant="secondary" onClick={() => setShowHelpModal(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
