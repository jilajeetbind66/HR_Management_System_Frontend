import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  User,
  Phone,
  Calendar,
  Building2,
  Briefcase,
  CreditCard,
  Lock,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  FileBadge,
  Sparkles,
} from 'lucide-react';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PasswordInput from '../../components/common/PasswordInput';
import PhoneInput from '../../components/common/PhoneInput';
import { userRoleLabels } from '../../config/userRoles';

export default function AccountSettingsView() {
  const { currentUser, changePassword, updateUserProfile } = useAuth();

  // Active view tab
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'job' | 'statutory' | 'security'

  // Personal profile form state
  const [personalForm, setPersonalForm] = useState({
    phone: '',
    gender: 'Other',
    date_of_birth: '',
    avatar: '',
    name: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  // Sync profile form with currentUser data
  useEffect(() => {
    if (currentUser) {
      setPersonalForm({
        phone: currentUser.phone || '',
        gender: currentUser.gender || 'Other',
        date_of_birth: currentUser.date_of_birth || '',
        avatar: currentUser.avatar || '',
        name: currentUser.name || '',
      });
      setAvatarPreview(currentUser.avatar || '');
    }
  }, [currentUser]);

  // Security forms
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

  // Handle personal profile submission
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const cleanPhone = personalForm.phone.replace(/\D/g, '');
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setProfileError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setIsSavingProfile(true);

    try {
      const payload = {
        phone: cleanPhone || null,
        gender: personalForm.gender || 'Other',
        date_of_birth: personalForm.date_of_birth || null,
        avatar: personalForm.avatar ? personalForm.avatar.trim() : null,
      };

      if (currentUser?.role === 'super_admin' && personalForm.name?.trim()) {
        payload.name = personalForm.name.trim();
      }

      const result = await updateUserProfile(payload);
      if (result.success) {
        setProfileSuccess('Personal profile updated successfully!');
        setTimeout(() => setProfileSuccess(''), 4000);
      } else {
        setProfileError(result.message || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError(err?.message || 'Failed to save changes.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Avatar file upload handler (Uploads to Cloudinary or falls back to base64)
  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Photo size must be less than 5MB.');
      return;
    }

    setProfileError('');
    setIsUploadingAvatar(true);

    // Instant local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      const targetEmpId = currentUser?.employee_id || (currentUser?.role === 'super_admin' ? currentUser?.id : null);
      const response = await api.uploadFile(file, 'employee_photos', {
        employeeId: targetEmpId,
      });

      const uploadedUrl =
        response?.data?.file_url ||
        response?.data?.url ||
        response?.data?.secure_url ||
        response?.file_url ||
        response?.url;

      if (uploadedUrl) {
        setAvatarPreview(uploadedUrl);
        setPersonalForm((prev) => ({ ...prev, avatar: uploadedUrl }));
        // Automatically save the avatar into the user profile for seamless instant update
        try {
          await updateUserProfile({ avatar: uploadedUrl });
          setProfileSuccess('Profile photo uploaded and saved successfully!');
        } catch {
          setProfileSuccess('Photo uploaded successfully! Click Save to apply.');
        }
        setTimeout(() => setProfileSuccess(''), 4000);
      } else {
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setPersonalForm((prev) => ({ ...prev, avatar: base64Reader.result }));
        };
        base64Reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn('Direct upload fallback:', err);
      const base64Reader = new FileReader();
      base64Reader.onloadend = () => {
        const dataUri = base64Reader.result;
        setAvatarPreview(dataUri);
        setPersonalForm((prev) => ({ ...prev, avatar: dataUri }));
      };
      base64Reader.readAsDataURL(file);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
        errors.current_password?.[0] ||
        errors.email?.[0] ||
        errors.email_confirmation?.[0] ||
        error?.message ||
        'Could not request an email change.'
      );
    } finally {
      setIsRequestingEmail(false);
    }
  };

  const initials =
    `${currentUser?.first_name?.[0] || ''}${currentUser?.last_name?.[0] || ''}`.toUpperCase() ||
    currentUser?.name?.slice(0, 2).toUpperCase() ||
    'U';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Profile Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-gradient-to-br from-teal-100/60 to-emerald-100/40 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with Camera Overlay */}
          <div className="relative group shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={currentUser?.name}
                className="h-20 w-20 rounded-2xl object-cover border-2 border-white shadow-md ring-2 ring-slate-100"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 text-xl font-bold text-white shadow-md">
                {initials}
              </div>
            )}
            <label
              htmlFor="avatar-upload"
              className={`absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition ${
                isUploadingAvatar ? 'animate-pulse opacity-70' : ''
              }`}
              title="Upload new profile photo"
            >
              <Camera className="h-3.5 w-3.5" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
            </label>
          </div>

          {/* User Details & Badges */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl font-bold text-slate-900">{currentUser?.name}</h1>
              {currentUser?.role === 'super_admin' ? (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
                  Founder & System Owner
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200/70">
                  {userRoleLabels[currentUser?.role] || currentUser?.role}
                </span>
              )}
              {currentUser?.role !== 'super_admin' && currentUser?.employee_code && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {currentUser.employee_code}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {currentUser?.role === 'super_admin'
                ? 'Primary Organization Founder & Super Administrator'
                : [currentUser?.designation, currentUser?.department, currentUser?.branch_name]
                    .filter(Boolean)
                    .join(' • ') || 'Employee Portal'}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {currentUser?.email}
              </span>
              {currentUser?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {currentUser.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex border-b border-slate-100 overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'personal'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="h-4 w-4" />
            Personal Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('job')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'job'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            {currentUser?.role === 'super_admin' ? 'System Governance' : 'Job & Hierarchy'}
          </button>
          {currentUser?.role !== 'super_admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('statutory')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition shrink-0 ${
                activeTab === 'statutory'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Statutory & Tax
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition shrink-0 ${
              activeTab === 'security'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Security & Login
          </button>
        </div>
      </div>

      {/* Tab 1: Personal Profile (Editable) */}
      {activeTab === 'personal' && (
        <Card
          title="Personal Profile & Contact"
          subtitle="Manage your contact and personal information. These updates are reflected across all employee channels."
        >
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                {profileError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {currentUser?.role === 'super_admin' && (
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  Full Name
                  <input
                    type="text"
                    value={personalForm.name}
                    onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </label>
              )}

              <label className="block text-xs font-medium text-slate-700">
                Phone / Mobile Number
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <PhoneInput
                    placeholder="Enter 10-digit mobile number"
                    value={personalForm.phone}
                    onChange={(val) => setPersonalForm({ ...personalForm, phone: val })}
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Gender
                <select
                  value={personalForm.gender}
                  onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Date of Birth
                <div className="relative mt-1.5">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={personalForm.date_of_birth}
                    onChange={(e) => setPersonalForm({ ...personalForm, date_of_birth: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </label>

              <div className="block text-xs font-medium text-slate-700">
                <span className="flex items-center justify-between">
                  <span>Profile Photo</span>
                  <label
                    htmlFor="avatar-form-upload"
                    className="cursor-pointer text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Upload from device</span>
                    <input
                      id="avatar-form-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </label>
                </span>
                <div className="relative mt-1.5 flex gap-2">
                  <input
                    type="text"
                    placeholder="Image URL or click Upload"
                    value={personalForm.avatar}
                    onChange={(e) => {
                      setPersonalForm({ ...personalForm, avatar: e.target.value });
                      setAvatarPreview(e.target.value);
                    }}
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <label
                    htmlFor="avatar-form-upload"
                    className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs transition ${
                      isUploadingAvatar ? 'opacity-60 cursor-wait' : ''
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isUploadingAvatar ? 'Uploading...' : 'Browse'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 transition"
              >
                <Save className="h-4 w-4" />
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Job & Hierarchy (or System Governance for Super Admin) */}
      {activeTab === 'job' && (
        currentUser?.role === 'super_admin' ? (
          <Card
            title="System Authority & Organization Governance"
            subtitle="Root organization leadership and system ownership profile."
          >
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-900">
              <ShieldCheck className="h-4 w-4 shrink-0 text-purple-700" />
              <span>You are authenticated as the Primary Organization Founder & Super Administrator with full unrestricted governance.</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="font-medium text-slate-500">Ownership Authority</p>
                <p className="mt-1 font-bold text-slate-900">Primary Founder & System Owner</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Organization Scope</p>
                <p className="mt-1 font-bold text-teal-800">All Branches (Organization-Wide / HQ)</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">System Role</p>
                <p className="mt-1 font-bold text-purple-700 uppercase">SUPER ADMIN (ROOT OWNER)</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Module Access</p>
                <p className="mt-1 font-bold text-slate-800">All 25 System Modules (Full Control)</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Workforce Status</p>
                <p className="mt-1 font-bold text-emerald-700">Executive Master (Independent of Staff Punching)</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">Reporting Chain</p>
                <p className="mt-1 font-bold text-slate-800">Board of Directors / Primary Ownership</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card
            title="Employment & Organization Details"
            subtitle="Official company records maintained by HR. Changes require HR administrator verification."
          >
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
              <span>These official employment fields are locked for self-editing to maintain organizational compliance.</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500">Employee Code</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.employee_code || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Official Designation</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.designation || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Department</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.department || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Branch Office</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.branch_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Employment Type</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.employment_type || 'Full-Time Permanent'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Date of Joining</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.date_of_joining || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Probation Status</p>
                <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.probation_status || 'Confirmed'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">System Access Role</p>
                <p className="mt-1 text-xs font-bold text-teal-800">{userRoleLabels[currentUser?.role] || currentUser?.role}</p>
              </div>
            </div>
          </Card>
        )
      )}

      {/* Tab 3: Statutory & Tax (Read-Only) */}
      {activeTab === 'statutory' && (
        <Card
          title="Statutory, Tax & Banking Information"
          subtitle="Confidential compliance details linked to monthly payroll disbursements."
        >
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            <span>Statutory records are masked for privacy. To update bank account details or submit declarations, contact HR.</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">Permanent Account Number (PAN)</p>
              <p className="mt-1 text-xs font-bold font-mono text-slate-800">{currentUser?.pan || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Universal Account Number (UAN)</p>
              <p className="mt-1 text-xs font-bold font-mono text-slate-800">{currentUser?.uan || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Income Tax Regime</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.tax_regime || 'New'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Disbursement Bank</p>
              <p className="mt-1 text-xs font-bold text-slate-800">{currentUser?.bank_name || 'Primary Corporate Bank'}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Security & Login */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card title="Change password" subtitle="Use your current password and choose a new password with at least 12 characters.">
            <form onSubmit={submitPasswordChange} className="space-y-4">
              {passwordError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {passwordError}
                </p>
              )}
              {passwordStatus && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {passwordStatus}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  Current password
                  <PasswordInput
                    autoComplete="current-password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 transition"
              >
                <KeyRound className="h-4 w-4" />
                {isSavingPassword ? 'Changing password...' : 'Change password'}
              </button>
            </form>
          </Card>

          <Card title="Change login email" subtitle="The email changes only after you confirm the verification link sent to the new address.">
            <form onSubmit={submitEmailChange} className="space-y-4">
              {emailError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {emailError}
                </p>
              )}
              {emailStatus && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {emailStatus}
                </p>
              )}
              <label className="block text-xs font-medium text-slate-700">
                Confirm with current password
                <PasswordInput
                  autoComplete="current-password"
                  required
                  value={emailForm.currentPassword}
                  onChange={(event) => setEmailForm({ ...emailForm, currentPassword: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
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
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-100"
                  />
                </label>
              </div>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Your existing login email remains active until verification succeeds. Confirming the new address signs out all your sessions.
              </p>
              <button
                type="submit"
                disabled={isRequestingEmail}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60 transition"
              >
                <Mail className="h-4 w-4" />
                {isRequestingEmail ? 'Sending verification...' : 'Send verification link'}
              </button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
