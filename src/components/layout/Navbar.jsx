import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
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

export default function Navbar({ onMenuToggle }) {
  const { currentUser, activeBranch, setActiveBranch, logout } = useAuth();
  const { punchAttendance, attendance, branches, announcements } = useHRMS();

  const [showNotifications, setShowNotifications] = useState(false);
  const [punchFeedback, setPunchFeedback] = useState(null);
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser.role);
  const isManagerWorkspace = currentUser.role === 'manager';
  const isAdminWorkspace = currentUser.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const isEmployeeWorkspace = currentUser.role === 'employee';

  // Check today's punch for current user
  const today = getIndiaDateString();
  const todayPunch = attendance.find(a => Number(a.employee_id) === Number(currentUser.employee_id) && a.date === today);
  const isPunchComplete = Boolean(todayPunch?.punch_out);

  const handlePunch = async () => {
    if (isPunchComplete) return;

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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur">
      {/* Left: Mobile hamburger & Brand */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className={`rounded-lg p-2 lg:hidden ${
            isEmployeeWorkspace ? 'text-orange-600 hover:bg-orange-50' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>

        {/* Branch Selector */}
        <div className="hidden sm:flex items-center gap-2 border border-slate-200 bg-slate-50/80 rounded-lg px-3 py-1.5 text-xs text-slate-700">
          <Building2 className={`w-3.5 h-3.5 ${
            isHrWorkspace ? 'text-emerald-600' : isEmployeeWorkspace ? 'text-orange-600' : isNavyWorkspace ? 'text-teal-700' : 'text-indigo-600'
          }`} />
          <span className="font-semibold text-slate-500">Branch:</span>
          <select
            value={activeBranch}
            onChange={(e) => setActiveBranch(e.target.value)}
            className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="All Branches">All Branches (Prayagraj & Kaushambi)</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>{b.name} ({b.city})</option>
            ))}
          </select>
        </div>

        {/* Backend API Connection Status Pill */}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Web Punch Clock */}
        <div className="relative">
          <Button
            size="sm"
            variant={isPunchComplete
              ? 'secondary'
              : todayPunch
              ? 'danger'
              : isEmployeeWorkspace ? 'orange' : isNavyWorkspace ? 'teal' : 'success'}
            disabled={isPunchComplete}
            onClick={handlePunch}
            icon={Clock}
            className="shadow-sm font-medium"
          >
            {isPunchComplete ? "Punch Completed" : todayPunch ? "Punch Out" : "Punch In"}
          </Button>

          {punchFeedback && (
            <div className="absolute right-0 top-10 z-50 rounded-lg bg-slate-900 text-white text-xs px-3 py-1.5 shadow-xl whitespace-nowrap animate-fade-in flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {punchFeedback}
            </div>
          )}
        </div>

        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
          isHrWorkspace
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : isEmployeeWorkspace
              ? 'bg-orange-50 border border-orange-200 text-orange-800'
              : isNavyWorkspace ? 'bg-teal-50 border border-teal-200 text-teal-800' : 'bg-indigo-50/80 border border-indigo-200/80 text-indigo-800'
        }`}>
          <span className={`uppercase tracking-wider font-bold ${
            isHrWorkspace ? 'text-emerald-700' : isEmployeeWorkspace ? 'text-orange-700' : isNavyWorkspace ? 'text-teal-700' : 'text-indigo-700'
          }`}>
            {currentUser.role.replace('_', ' ')}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative rounded-lg p-2 focus:outline-none ${
              isEmployeeWorkspace
                ? 'text-orange-600 hover:bg-orange-50 focus:ring-2 focus:ring-orange-300'
                : isNavyWorkspace ? 'text-teal-700 hover:bg-teal-50 focus:ring-2 focus:ring-teal-300' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Bell className="h-5 w-5" />
            <span className={`absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full animate-pulse ${
              isEmployeeWorkspace ? 'bg-orange-500' : isNavyWorkspace ? 'bg-teal-500' : 'bg-rose-500'
            }`} />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white p-3 shadow-2xl border border-slate-200 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800">Notifications & Alerts</span>
                <Badge variant="neutral" size="sm">0 New</Badge>
              </div>
              <p className="py-5 text-center text-xs text-slate-500">No notifications yet.</p>
            </div>
          )}
        </div>

        {/* Current User Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <img
            src={currentUser?.avatar}
            alt={currentUser?.first_name}
            className={`w-8 h-8 rounded-full object-cover border border-slate-300 ring-2 ${
              isHrWorkspace ? 'ring-emerald-50' : isEmployeeWorkspace ? 'ring-orange-50' : isNavyWorkspace ? 'ring-teal-50' : 'ring-indigo-50'
            }`}
          />
          <div className="hidden xl:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {currentUser?.first_name} {currentUser?.last_name}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {currentUser?.employee_code} • {currentUser?.branch_name?.split(' ')[0]}
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
    </header>
  );
}
