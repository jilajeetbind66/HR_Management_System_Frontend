import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { initialBranches } from '../../data/mockData';
import {
  Bell,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { getIndiaDateString } from '../../utils/date';
import { getCurrentPositionAsync } from '../../utils/geolocation';

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
    markAllNotificationsRead,
    clearAllNotifications,
    deleteNotification,
    selectedPersonaId,
    setSelectedPersonaId,
  } = useHRMS();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationTab, setNotificationTab] = useState('unread');
  const [notificationError, setNotificationError] = useState('');
  const [punchFeedback, setPunchFeedback] = useState(null);
  const [isPunching, setIsPunching] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const handleNotificationClick = async (notification) => {
    try {
      await deleteNotification(notification.id);
    } catch (error) {
      console.warn('Unable to delete notification:', error);
      try { await markNotificationRead(notification.id); } catch (_) {}
    }
    setShowNotifications(false);
    if (typeof onNavigate === 'function') {
      const eventKey = notification.event_key || '';
      if (eventKey.startsWith('attendance.')) {
        if (eventKey.includes('regularization')) {
          window.location.hash = 'regularization';
        }
        onNavigate('attendance');
      } else if (eventKey.startsWith('project.') || eventKey.startsWith('staffing.')) {
        onNavigate(currentUser?.role === 'employee' ? 'my_projects' : 'projects');
      } else if (eventKey.startsWith('leave.')) {
        onNavigate('leaves');
      } else if (eventKey.startsWith('payroll.')) {
        onNavigate(['super_admin', 'payroll_admin', 'auditor'].includes(currentUser?.role) ? 'payroll' : 'payslips');
      } else if (eventKey.startsWith('lead.')) {
        onNavigate('leads');
      } else if (eventKey.startsWith('training.')) {
        onNavigate('training');
      } else if (eventKey.startsWith('expense.')) {
        onNavigate('expenses');
      } else if (eventKey.startsWith('document.')) {
        onNavigate('documents');
      } else if (eventKey.startsWith('announcement.')) {
        onNavigate('announcements');
      } else if (eventKey.startsWith('performance.')) {
        onNavigate('performance');
      } else if (eventKey.startsWith('lifecycle.')) {
        onNavigate('lifecycle');
      } else if (eventKey.startsWith('helpdesk.')) {
        onNavigate('helpdesk');
      } else {
        onNavigate('dashboard');
      }
    }
  };
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
  const totalUnreadBadge = unreadNotifications;

  const handlePunch = async () => {
    if (!hasEmployeeProfile || isPunchComplete || isPunching) return;

    setIsPunching(true);
    setPunchFeedback({ text: 'Acquiring GPS location...', type: 'info' });

    let coords = null;
    try {
      coords = await getCurrentPositionAsync();
    } catch (geoErr) {
      console.warn('Geolocation acquisition warning:', geoErr.message);
    }

    try {
      const res = await punchAttendance(
        currentUser.employee_id,
        `${currentUser.branch_name || 'Web Portal'}`,
        coords
      );
      if (res?.type === 'in') {
        const distStr = res.punch?.distance_meters != null ? ` (📍 ${Math.round(res.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched IN at ${res.punch?.punch_in || 'now'}${distStr}`, type: 'success' });
      } else if (res?.type === 'out') {
        const distStr = res.punch?.distance_meters != null ? ` (📍 ${Math.round(res.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched OUT at ${res.punch?.punch_out || 'now'}${distStr}`, type: 'success' });
      } else {
        setPunchFeedback({ text: `Already completed attendance for today`, type: 'info' });
      }
    } catch (err) {
      const errorMsg = err?.data?.message || err?.message || 'Punch action failed';
      setPunchFeedback({ text: errorMsg, type: 'error' });
    } finally {
      setIsPunching(false);
      setTimeout(() => setPunchFeedback(null), 4500);
    }
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
        {/* Quick Web Punch Clock (Only for staff whose attendance is tracked, NOT for Super Admin/Founder) */}
        {currentUser?.role !== 'super_admin' && (
          <div className="relative">
            <Button
              size="sm"
              variant={isPunchComplete
                ? 'secondary'
                : hasPunchedIn
                ? 'danger'
                : 'orange'}
              disabled={!hasEmployeeProfile || isPunchComplete || isPunching}
              title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
              onClick={handlePunch}
              icon={Clock}
              className="shadow-sm font-medium"
            >
              {isPunching ? "Locating GPS..." : isPunchComplete ? "Punch Completed" : hasPunchedIn ? "Punch Out" : "Punch In"}
            </Button>

            {punchFeedback && (
              <div className={`absolute right-0 top-10 z-50 rounded-lg text-xs px-3 py-2 shadow-xl animate-fade-in flex items-center gap-1.5 max-w-xs sm:max-w-sm whitespace-normal ${
                punchFeedback.type === 'error'
                  ? 'bg-rose-950 text-rose-100 border border-rose-800'
                  : punchFeedback.type === 'info'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
              }`}>
                {punchFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{punchFeedback.text}</span>
              </div>
            )}
          </div>
        )}

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
                  if (unreadNotifications > 0) {
                    markAllNotificationsRead().catch(() => {});
                  } else {
                    await refreshNotifications();
                  }
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
            {totalUnreadBadge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
                {totalUnreadBadge > 9 ? '9+' : totalUnreadBadge}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 max-h-[30rem] overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200 z-50 flex flex-col">
              {/* Dropdown Header */}
              <div className="border-b border-slate-100 p-3 bg-slate-50/70">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Notifications & Alerts</span>
                    {totalUnreadBadge > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {totalUnreadBadge} New
                      </span>
                    )}
                  </div>
                  {notificationTab === 'unread' && unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await clearAllNotifications();
                        } catch (err) {
                          setNotificationError(err?.data?.message || err.message || 'Unable to mark all as read.');
                        }
                      }}
                      className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  {notificationTab === 'all' && notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await clearAllNotifications();
                        } catch (err) {
                          setNotificationError(err?.data?.message || err.message || 'Unable to clear notifications.');
                        }
                      }}
                      className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setNotificationTab('unread')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${
                      notificationTab === 'unread'
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Unread {unreadNotifications > 0 ? `(${unreadNotifications})` : '(0)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationTab('all')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition ${
                      notificationTab === 'all'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                </div>
              </div>

              {notificationError && (
                <p role="alert" className="p-2 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">
                  {notificationError}
                </p>
              )}

              {/* Notifications List */}
              <div className="overflow-y-auto p-2 divide-y divide-slate-100 max-h-80">
                {notificationTab === 'unread' ? (
                  notifications.filter((n) => !n.read_at).length > 0 ? (
                    notifications
                      .filter((n) => !n.read_at)
                      .map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left transition bg-teal-50/60 border-l-2 border-teal-500 hover:bg-teal-50 my-1 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className="block text-xs font-bold text-slate-900 leading-tight">
                                {notification.title}
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0 mt-1" />
                            </div>
                            <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">
                              {notification.message}
                            </span>
                          </div>
                          <button
                            type="button"
                            title="Delete notification"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await deleteNotification(notification.id);
                              } catch (err) {
                                setNotificationError(err?.data?.message || err.message || 'Unable to delete notification.');
                              }
                            }}
                            className="shrink-0 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">You're all caught up!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No unread notifications.</p>
                    </div>
                  )
                ) : notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition my-0.5 cursor-pointer ${
                        notification.read_at
                          ? 'bg-white opacity-85 hover:bg-slate-50'
                          : 'bg-teal-50/60 border-l-2 border-teal-500 hover:bg-teal-50 font-medium'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className={`block text-xs leading-tight ${notification.read_at ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}>
                            {notification.title}
                          </span>
                          {!notification.read_at && (
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0 mt-1" />
                          )}
                        </div>
                        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                          {notification.message}
                        </span>
                      </div>
                      <button
                        type="button"
                        title="Delete notification"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await deleteNotification(notification.id);
                          } catch (err) {
                            setNotificationError(err?.data?.message || err.message || 'Unable to delete notification.');
                          }
                        }}
                        className="shrink-0 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-500">No notifications history.</p>
                  </div>
                )}
              </div>
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
