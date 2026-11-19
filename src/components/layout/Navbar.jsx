import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { initialBranches } from '../../data/mockData';
import {
  Bell,
  Clock,
  Building2,
  CheckCircle2,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { getIndiaDateString } from '../../utils/date';

export default function Navbar({ onMenuToggle, onNavigate }) {
  const { currentUser, activeBranch, setActiveBranch, logout } = useAuth();
  const {
    punchAttendance,
    attendance,
    branches,
    announcements,
    employees,
    notifications,
    refreshNotifications,
    markNotificationRead,
    selectedPersonaId,
    setSelectedPersonaId,
  } = useHRMS();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [punchFeedback, setPunchFeedback] = useState(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const availableBranches = Array.isArray(branches) && branches.length > 0 ? branches : initialBranches;
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser.role);
  const isManagerWorkspace = currentUser.role === 'manager';
  const isAdminWorkspace = currentUser.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const initials = `${currentUser?.first_name?.[0] || ''}${currentUser?.last_name?.[0] || ''}`.toUpperCase()
    || currentUser?.name?.slice(0, 2).toUpperCase()
    || 'U';

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [currentUser?.avatar]);

  // Check today's punch for current user
  const today = getIndiaDateString();
  const hasEmployeeProfile = Boolean(currentUser?.employee_id);
  const todayPunch = hasEmployeeProfile
    ? attendance.find(a => Number(a.employee_id) === Number(currentUser.employee_id) && a.date === today)
    : null;
  const hasPunchedIn = Boolean(todayPunch?.punch_in);
  const isPunchComplete = Boolean(todayPunch?.punch_in && todayPunch?.punch_out);
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;

  const handlePunch = async () => {
    if (!hasEmployeeProfile || isPunchComplete) return;

    try {
      const res = await punchAttendance(currentUser.employee_id, `${currentUser.branch_name || 'Web Portal'}`);
      if (res?.type === 'in') {
        setPunchFeedback(`Punched IN at ${res.punch?.punch_in || 'now'}`);
      } else if (res?.type === 'out') {
        setPunchFeedback(`Punched OUT at ${res.punch?.punch_out || 'now'}`);
      } else {
        setPunchFeedback(`Already completed attendance for today`);
      }
    } catch (err) {
      setPunchFeedback(`Punch error: ${err.message || 'Failed'}`);
    }
    setTimeout(() => setPunchFeedback(null), 3500);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-2 px-3 sm:px-6">
        {/* Left: Mobile hamburger & Brand */}
        <div className={`flex min-w-0 items-center gap-1.5 sm:gap-4 ${isAdminWorkspace ? 'flex-1' : ''}`}>
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700 lg:hidden shrink-0"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>

          {/* Desktop Branch Selector (Super Admin Only) */}
          {currentUser?.role === 'super_admin' && (
            <div className="hidden sm:flex items-center gap-2 border border-slate-200 bg-slate-50/80 rounded-lg px-3 py-1.5 text-xs text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-teal-600" />
              <span className="font-semibold text-slate-500">Branch:</span>
              <select
                value={activeBranch}
                onChange={(e) => setActiveBranch(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="All Branches">All Branches (Prayagraj & Kaushambi)</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.name}>{b.name} ({b.city})</option>
                ))}
              </select>
            </div>
          )}
          {isAdminWorkspace && (
            <label className="flex min-w-0 max-w-[128px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 sm:max-w-none sm:px-2.5">
              <span className="hidden md:inline font-semibold">Workspace</span>
              <span className="sr-only">View workspace as employee</span>
              <select
                value={selectedPersonaId || ''}
                onChange={(event) => {
                  setSelectedPersonaId(event.target.value ? Number(event.target.value) : null);
                  onNavigate?.('developer_space');
                }}
                className="min-w-0 max-w-[100px] bg-transparent font-medium text-slate-800 focus:outline-none max-[380px]:max-w-[76px] sm:max-w-36"
              >
                <option value="">My Workspace</option>
                {employees
                  .filter((employee) => employee.status === 'active')
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} · {employee.employee_code}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>

      {/* Right Controls */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {/* Quick Web Punch Clock */}
        <div className="relative">
          <Button
            size="sm"
            variant={isPunchComplete
              ? 'secondary'
              : hasPunchedIn
              ? 'danger'
              : 'orange'}
            disabled={!hasEmployeeProfile || isPunchComplete}
            title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
            onClick={handlePunch}
            icon={Clock}
            className="shadow-sm font-medium"
          >
            {isPunchComplete ? "Punch Completed" : hasPunchedIn ? "Punch Out" : "Punch In"}
          </Button>

          {punchFeedback && (
            <div className="absolute right-0 top-10 z-50 rounded-lg bg-slate-900 text-white text-xs px-3 py-1.5 shadow-xl whitespace-nowrap animate-fade-in flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {punchFeedback}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 sm:flex">
          <span className="font-bold uppercase tracking-wider text-teal-700">
            {currentUser.role.replace('_', ' ')}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={async () => {
              const nextOpen = !showNotifications;
              setShowNotifications(nextOpen);
              if (nextOpen) {
                setNotificationError('');
                try {
                  await refreshNotifications();
                } catch (error) {
                  setNotificationError(error?.data?.message || error.message || 'Unable to load notifications.');
                }
              }
            }}
            className="relative rounded-lg p-2 text-teal-600 focus:outline-none hover:bg-teal-50 focus:ring-2 focus:ring-teal-300"
            aria-label={`Notifications${unreadNotifications ? ` (${unreadNotifications} unread)` : ''}`}
            aria-expanded={showNotifications}
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-xl bg-white p-3 shadow-2xl border border-slate-200 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800">Notifications & Alerts</span>
                <Badge variant="neutral" size="sm">{unreadNotifications} New</Badge>
              </div>
              {notificationError && <p role="alert" className="py-2 text-xs text-rose-700">{notificationError}</p>}
              {notifications.length ? notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={async () => {
                    if (notification.read_at) return;
                    try {
                      await markNotificationRead(notification.id);
                    } catch (error) {
                      setNotificationError(error?.data?.message || error.message || 'Unable to mark notification as read.');
                    }
                  }}
                  className={`block w-full rounded-lg px-2.5 py-2 text-left ${notification.read_at ? 'bg-white' : 'bg-teal-50/70'} hover:bg-slate-50`}
                >
                  <span className="block text-xs font-semibold text-slate-800">{notification.title}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{notification.message}</span>
                </button>
              )) : !notificationError ? (
                <p className="py-5 text-center text-xs text-slate-500">No notifications yet.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Current User Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          {currentUser?.avatar && !avatarLoadFailed ? (
            <img
              src={currentUser.avatar}
              alt=""
              onError={() => setAvatarLoadFailed(true)}
              className="h-8 w-8 rounded-full border border-slate-300 object-cover ring-2 ring-teal-50"
            />
          ) : (
            <span
              aria-label={`${currentUser?.name || 'User'} profile initials`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-200 bg-[#0f172a] text-[10px] font-bold text-white ring-2 ring-teal-50"
            >
              {initials}
            </span>
          )}
          <div className="hidden xl:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {currentUser?.first_name} {currentUser?.last_name}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {[currentUser?.employee_code, currentUser?.branch_name?.split(' ')[0]].filter(Boolean).join(' • ') || currentUser?.email}
            </p>
          </div>

          {!isNavyWorkspace && !isHrWorkspace && (
            <button
              onClick={() => logout().catch((error) => console.error('Sign-out failed:', error))}
              className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign out of HRMS"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Dedicated Mobile Branch Strip (Super Admin Only) */}
      {currentUser?.role === 'super_admin' && (
        <div className="flex sm:hidden items-center justify-between border-t border-slate-200/80 bg-slate-50/95 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Building2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span>Branch:</span>
          </div>
          <select
            value={activeBranch}
            onChange={(e) => setActiveBranch(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 max-w-[210px] truncate cursor-pointer"
          >
            <option value="All Branches">All Branches (Prayagraj & Kaushambi)</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}
