import React, { useMemo, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  UserRound,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';

const employeeLinks = [
  { label: 'Dashboard', module: 'dashboard' },
  { label: 'My Workspace', module: 'developer_space' },
  { label: 'Attendance', module: 'attendance' },
  { label: 'Leave Management', module: 'leaves' },
  { label: 'Projects', module: 'projects' },
  { label: 'Performance', module: 'performance' },
  { label: 'Training', module: 'training' },
  { label: 'Policies & Notices', module: 'documents' },
  { label: 'Expenses', module: 'expenses' },
  { label: 'Help & Support', module: 'helpdesk' },
  { label: 'Announcements', module: 'announcements' },
  { label: 'Account & Security', module: 'account' },
];

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
  const { announcements } = useHRMS();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return employeeLinks
      .filter((link) => link.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }, [query]);
  const recentAnnouncements = announcements.slice(0, 3);

  const navigateTo = (module) => {
    onNavigate(module);
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[68px] w-full items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur sm:px-5 lg:px-7">
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-slate-500 transition hover:bg-orange-50 hover:text-orange-600 lg:hidden"
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
          className="h-10 w-full rounded-xl border border-transparent bg-[#f0f2fb] pl-10 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-100"
        />
        {searchOpen && query.trim() && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {matches.length ? matches.map((link) => (
              <button
                type="button"
                key={link.module}
                onClick={() => navigateTo(link.module)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
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
        <div className="relative">
          <button
            type="button"
            aria-label={`Company updates${announcements.length ? ` (${announcements.length})` : ''}`}
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
              setSearchOpen(false);
            }}
            className="relative rounded-xl p-2 text-slate-600 transition hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            <Bell className="h-5 w-5" />
            {announcements.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">
                {announcements.length > 9 ? '9+' : announcements.length}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-xs font-bold text-slate-900">Company updates</h2>
                <button
                  type="button"
                  onClick={() => navigateTo('announcements')}
                  className="text-[10px] font-semibold text-orange-700 hover:text-orange-800"
                >
                  View all
                </button>
              </div>
              {recentAnnouncements.length ? (
                <div className="divide-y divide-slate-100">
                  {recentAnnouncements.map((announcement) => (
                    <button
                      type="button"
                      key={announcement.id}
                      onClick={() => navigateTo('announcements')}
                      className="block w-full px-4 py-3 text-left hover:bg-orange-50/60"
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
            className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101b3d] text-xs font-bold text-white">
                {getInitials(currentUser)}
              </span>
            )}
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-32 truncate text-xs font-bold leading-tight text-slate-900">
                {currentUser?.name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()}
              </span>
              <span className="mt-0.5 block max-w-32 truncate text-[10px] font-medium text-slate-500">
                {currentUser?.designation || 'Employee'}
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
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
              >
                <KeyRound className="h-4 w-4" />
                Account & security
              </button>
              <button
                type="button"
                onClick={() => navigateTo('developer_space')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
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
    </header>
  );
}
