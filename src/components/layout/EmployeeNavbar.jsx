import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Clock,
  LogOut,
  Search,
  UserRound,
  KeyRound,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { getIndiaDateString } from '../../utils/date';
import { getRoleMenuItems } from '../../config/roleAccess';
import { getCurrentPositionAsync } from '../../utils/geolocation';

const employeeLinks = getRoleMenuItems('employee');

const getInitials = (user) => {
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.trim();
  return initials || user?.name?.slice(0, 1) || 'E';
};

const formatDate = (date) => {
  if (!date) return '';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function EmployeeNavbar({ onMenuToggle, onNavigate }) {
  const { currentUser, logout } = useAuth();
  const {
    announcements,
    attendance,
    punchAttendance,
    notifications,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    deleteNotification,
  } = useHRMS();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [punchFeedback, setPunchFeedback] = useState(null);
  const [isPunching, setIsPunching] = useState(false);
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return employeeLinks
      .filter((link) => link.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }, [query]);
  const recentAnnouncements = announcements.slice(0, 3);
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;
  const today = getIndiaDateString();
  const todayPunch = attendance.find((record) => (
    Number(record.employee_id) === Number(currentUser?.employee_id) && record.date === today
  ));
  const isPunchComplete = Boolean(todayPunch?.punch_out);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [currentUser?.avatar]);

  const navigateTo = (module) => {
    onNavigate(module);
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const handleNotificationClick = async (notification) => {
    // 1. Delete notification from database and list on click
    try {
      await deleteNotification(notification.id);
    } catch (err) {
      console.warn('Unable to delete notification:', err);
      try {
        await markNotificationRead(notification.id);
      } catch (_) {}
    }

    // 2. Redirect to exact module
    const eventKey = notification.event_key || '';
    if (eventKey.startsWith('attendance.')) {
      if (eventKey.includes('regularization')) {
        window.location.hash = 'regularization';
      }
      navigateTo('attendance');
    } else if (eventKey.startsWith('leave.')) {
      navigateTo('leaves');
    } else if (eventKey.startsWith('project.') || eventKey.startsWith('staffing.')) {
      navigateTo('my_projects');
    } else if (eventKey.startsWith('payroll.')) {
      navigateTo('payslips');
    } else if (eventKey.startsWith('training.')) {
      navigateTo('training');
    } else if (eventKey.startsWith('expense.')) {
      navigateTo('expenses');
    } else if (eventKey.startsWith('document.')) {
      navigateTo('documents');
    } else if (eventKey.startsWith('announcement.')) {
      navigateTo('announcements');
    } else if (eventKey.startsWith('performance.')) {
      navigateTo('performance');
    } else if (eventKey.startsWith('lifecycle.')) {
      navigateTo('lifecycle');
    } else if (eventKey.startsWith('helpdesk.')) {
      navigateTo('helpdesk');
    } else if (eventKey.startsWith('lead.')) {
      navigateTo('leads');
    } else {
      navigateTo('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  const handlePunch = async () => {
    if (isPunchComplete || !currentUser?.employee_id || isPunching) return;

    setIsPunching(true);
    setPunchFeedback({ text: 'Acquiring GPS location...', type: 'info' });

    let coords = null;
    try {
      coords = await getCurrentPositionAsync();
    } catch (geoErr) {
      console.warn('Geolocation warning:', geoErr.message);
    }

    try {
      const result = await punchAttendance(
        currentUser.employee_id,
        currentUser.branch_name || 'Web Portal',
        coords
      );
      if (result?.type === 'in') {
        const distStr = result.punch?.distance_meters != null ? ` (📍 ${Math.round(result.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched in at ${result.punch?.punch_in || 'now'}${distStr}`, type: 'success' });
      } else if (result?.type === 'out') {
        const distStr = result.punch?.distance_meters != null ? ` (📍 ${Math.round(result.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched out at ${result.punch?.punch_out || 'now'}${distStr}`, type: 'success' });
      } else {
        setPunchFeedback({ text: 'Attendance is already complete for today.', type: 'info' });
      }
    } catch (error) {
      setPunchFeedback({ text: error?.data?.message || error.message || 'Punch action failed.', type: 'error' });
    } finally {
      setIsPunching(false);
      setTimeout(() => setPunchFeedback(null), 4500);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex h-[68px] w-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-teal-50 hover:text-teal-600 lg:hidden"
        >
        <span className="block h-0.5 w-5 rounded bg-current before:block before:h-0.5 before:w-5 before:-translate-y-1.5 before:rounded before:bg-current after:block after:h-0.5 after:w-5 after:translate-y-1 after:rounded after:bg-current" />
      </button>

      <div className="relative w-full max-w-[460px]">
        <label htmlFor="employee-dashboard-search" className="sr-only">Search workspace</label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setSearchOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <input
          id="employee-dashboard-search"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Search attendance, leave, policies..."
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSearchOpen(false);
            if (event.key === 'Enter' && matches[0]) navigateTo(matches[0].module);
          }}
          className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-10 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-teal-200 focus:bg-white focus:ring-2 focus:ring-teal-100"
        />
        {searchOpen && query.trim() && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {matches.length ? matches.map((link) => (
              <button
                type="button"
                key={link.module}
                onClick={() => navigateTo(link.module)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
              >
                {link.label}
                <span className="text-[10px] text-slate-400">Open</span>
              </button>
            )) : (
              <p role="status" className="px-3 py-3 text-xs text-slate-500">No matching workspace sections.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div
          title={`Branch: ${currentUser?.branch_name || 'Not assigned'}`}
          className="hidden max-w-44 items-center gap-1.5 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-medium text-slate-600 lg:flex"
        >
          <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-teal-600" />
          <span className="shrink-0 font-semibold">Branch:</span>
          <span className="truncate">{currentUser?.branch_name || 'Not assigned'}</span>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={isPunchComplete || !currentUser?.employee_id || isPunching}
            onClick={handlePunch}
            aria-label={isPunchComplete ? 'Punch completed for today' : todayPunch ? 'Punch out' : 'Punch in'}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed ${
              isPunchComplete
                ? 'bg-slate-100 text-slate-500'
                : todayPunch
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {isPunchComplete ? (
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isPunching ? 'Locating...' : isPunchComplete ? 'Completed' : todayPunch ? 'Punch Out' : 'Punch In'}
            </span>
          </button>
          {punchFeedback && (
            <div
              role="status"
              className={`absolute right-0 top-full z-50 mt-2 max-w-xs sm:max-w-sm whitespace-normal rounded-lg px-3 py-2 text-xs shadow-xl animate-fade-in flex items-center gap-1.5 ${
                punchFeedback.type === 'error'
                  ? 'bg-rose-950 text-rose-100 border border-rose-800'
                  : punchFeedback.type === 'info'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
              }`}
            >
              {punchFeedback.type === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span>{punchFeedback.text}</span>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label={`Notifications and company updates${unreadNotifications ? ` (${unreadNotifications} unread)` : ''}`}
            aria-expanded={notificationsOpen}
            onClick={() => {
              const nextOpen = !notificationsOpen;
              setNotificationsOpen(nextOpen);
              setProfileOpen(false);
              setSearchOpen(false);
              if (nextOpen) {
                setNotificationError('');
                refreshNotifications().catch((error) => {
                  setNotificationError(error?.data?.message || error.message || 'Unable to load notifications.');
                });
              }
            }}
            className="relative rounded-xl p-2 text-slate-600 transition hover:bg-teal-50 hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-bold text-slate-900">Notifications</h2>
                  {unreadNotifications > 0 && (
                    <span className="rounded-full bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-700">
                      {unreadNotifications} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  {unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearAllNotifications().catch((error) => {
                          setNotificationError(error?.data?.message || error.message || 'Unable to mark all as read.');
                        });
                      }}
                      className="text-[10px] font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await clearAllNotifications();
                        } catch (error) {
                          setNotificationError(error?.data?.message || error.message || 'Unable to clear notifications.');
                        }
                      }}
                      className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              {notificationError && <p role="alert" className="px-4 py-2 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">{notificationError}</p>}
              <section aria-label="Notifications">
                <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Messages ({notifications.length})</span>
                  <span className="text-[9px] font-normal lowercase text-slate-400">Click to open & dismiss</span>
                </div>
                {notifications.length ? (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group flex items-start justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-teal-50/70 cursor-pointer ${
                          notification.read_at ? '' : 'bg-teal-50/40 border-l-2 border-teal-500'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-800 group-hover:text-teal-800">
                            {notification.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                            {notification.message}
                          </span>
                        </div>
                        <button
                          type="button"
                          title="Dismiss notification"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await deleteNotification(notification.id);
                            } catch (err) {
                              setNotificationError(err?.data?.message || err.message || 'Unable to delete notification.');
                            }
                          }}
                          className="shrink-0 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition mt-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : !notificationError ? (
                  <div className="px-4 py-5 text-center text-xs text-slate-400">
                    <p className="font-medium text-slate-600">No notifications</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">You're all caught up!</p>
                  </div>
                ) : null}
              </section>
              <section aria-label="Company updates" className="border-t border-slate-100">
                <h3 className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Company updates
                </h3>
              {recentAnnouncements.length ? (
                <div className="divide-y divide-slate-100">
                  {recentAnnouncements.map((announcement) => (
                    <button
                      type="button"
                      key={announcement.id}
                      onClick={() => navigateTo('announcements')}
                      className="block w-full px-4 py-3 text-left hover:bg-teal-50/60"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="line-clamp-1 text-xs font-semibold text-slate-800">{announcement.title}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatDate(announcement.published_at || announcement.created_at)}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">{announcement.content}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p role="status" className="px-4 py-6 text-center text-xs text-slate-500">No company updates yet.</p>
              )}
              </section>
            </div>
          )}
        </div>

        <span aria-hidden="true" className="hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="relative">
          <button
            type="button"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
              setSearchOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            {currentUser?.avatar && !avatarLoadFailed ? (
              <img
                src={currentUser.avatar}
                alt=""
                onError={() => setAvatarLoadFailed(true)}
                className="h-9 w-9 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f172a] text-xs font-bold text-white">
                {getInitials(currentUser)}
              </span>
            )}
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-32 truncate text-xs font-bold leading-tight text-slate-900">
                {currentUser?.name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()}
              </span>
              <span className="mt-0.5 block max-w-32 truncate text-[10px] font-medium text-slate-500">
                {currentUser?.branch_name || currentUser?.designation || 'Employee'}
              </span>
            </span>
            <ChevronDown className={`hidden h-4 w-4 text-slate-500 transition sm:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-xs font-semibold text-slate-800">{currentUser?.name}</p>
                <p className="truncate text-[10px] text-slate-500">{currentUser?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('account')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700"
              >
                <KeyRound className="h-4 w-4" />
                Account & security
              </button>
              <button
                type="button"
                onClick={() => navigateTo('developer_space')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700"
              >
                <UserRound className="h-4 w-4" />
                My workspace
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
