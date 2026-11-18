import React from 'react';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  FolderKanban,
  Megaphone,
  ReceiptText,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';

const getDateKey = (date) => String(date || '').slice(0, 10);

const formatDate = (date) => {
  if (!date) return 'Date not set';
  const parsedDate = new Date(`${getDateKey(date)}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? 'Date not set'
    : parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatTimestamp = (date) => {
  if (!date) return '';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
};

const getInitials = (user) => {
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.trim();
  return initials || user?.name?.slice(0, 1) || 'E';
};

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved' || normalized === 'completed' || normalized === 'present') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'rejected' || normalized === 'overdue' || normalized === 'absent') {
    return 'bg-rose-50 text-rose-700';
  }
  if (normalized === 'pending' || normalized === 'in progress' || normalized === 'in_progress') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-blue-50 text-blue-700';
};

function EmployeeHero({ firstName }) {
  return (
    <section className="hrms-dashboard-hero relative isolate flex min-h-[130px] overflow-hidden rounded-2xl px-5 py-5 text-white shadow-sm sm:px-7">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-r from-[#0f766e] via-[#0f9488] to-[#059669]" />
      <svg
        aria-hidden="true"
        viewBox="0 0 480 180"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute -right-1 bottom-0 -z-10 h-full w-[58%] min-w-[300px] opacity-90"
      >
        <defs>
          <linearGradient id="employee-building-sky" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#5de0cb" />
            <stop offset="1" stopColor="#176c63" />
          </linearGradient>
          <pattern id="employee-building-windows" width="17" height="16" patternUnits="userSpaceOnUse">
            <rect x="3" y="3" width="8" height="8" rx="1" fill="#9fefe1" fillOpacity=".52" />
          </pattern>
        </defs>
        <path d="M170 180 294 24l186 19v137Z" fill="#0b6257" />
        <path d="M235 180V61l122-44 123 26v137Z" fill="url(#employee-building-sky)" />
        <path d="M249 180V69l104-37v148Z" fill="url(#employee-building-windows)" />
        <path d="M371 180V48l90 18v114Z" fill="#168b79" />
        <path d="M383 180V57l70 14v109Z" fill="url(#employee-building-windows)" />
        <path d="M205 180 274 82v98Z" fill="#0f766e" fillOpacity=".85" />
        <path d="M211 180h269" stroke="#a7f3e7" strokeOpacity=".6" strokeWidth="2" />
      </svg>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0f766e] via-[#0f766e]/95 to-transparent" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-semibold tracking-wide text-teal-50">Welcome back,</p>
        <h1 className="mt-0.5 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="text-teal-100">{firstName}!</span>
          <span aria-hidden="true" className="ml-2">👋</span>
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-200">Keep up the great work!</p>
      </div>
      <div className="relative z-10 hidden w-[34%] items-center justify-center pr-2 text-center md:flex">
        <p className="text-sm font-bold italic leading-snug text-white drop-shadow sm:text-base">
          “Dream Big,<br />Work Smart”
          <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-12 -skew-x-12 rounded-full bg-teal-300" />
        </p>
      </div>
      <span aria-hidden="true" className="absolute bottom-0 left-7 h-1 w-16 bg-teal-300" />
    </section>
  );
}

function AttendanceDonut({ summary, total, percentage }) {
  const colors = ['#08b981', '#237bf4', '#ff8b16', '#c4cee0'];
  let runningPercent = 0;
  const slices = summary.map((item, index) => {
    const start = runningPercent;
    runningPercent += total ? (item.count / total) * 100 : 0;
    return `${colors[index]} ${start}% ${runningPercent}%`;
  });
  const donutStyle = {
    background: total ? `conic-gradient(${slices.join(', ')})` : 'conic-gradient(#e9edf5 0% 100%)',
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
      <div
        role="img"
        aria-label={total ? `${percentage}% present this month` : 'No attendance records this month'}
        className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full p-3"
        style={donutStyle}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">{percentage}%</span>
          <span className="text-[10px] font-medium text-slate-500">Present</span>
        </div>
      </div>
      <ul className="w-full space-y-2 sm:max-w-[170px]">
        {summary.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-800">{item.count} {item.count === 1 ? 'Day' : 'Days'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttendanceTrend({ months, maxCount }) {
  const chartWidth = 360;
  const chartHeight = 160;
  const plot = { left: 32, right: 12, top: 16, bottom: 32 };
  const plotWidth = chartWidth - plot.left - plot.right;
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const points = months.map((month, index) => ({
    x: plot.left + (months.length > 1 ? (index / (months.length - 1)) * plotWidth : plotWidth / 2),
    y: plot.top + plotHeight - (month.count / maxCount) * plotHeight,
  }));
  const pointList = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaList = `${plot.left},${plot.top + plotHeight} ${pointList} ${plot.left + plotWidth},${plot.top + plotHeight}`;
  const ticks = [0, Math.ceil(maxCount / 2), maxCount];

  return (
    <svg
      role="img"
      aria-label={`Present attendance over the last ${months.length} months`}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="mt-2 h-40 w-full overflow-visible"
    >
      <defs>
        <linearGradient id="employee-attendance-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#267cf6" stopOpacity=".25" />
          <stop offset="1" stopColor="#267cf6" stopOpacity=".02" />
        </linearGradient>
      </defs>
      {ticks.map((tick, index) => {
        const y = plot.top + plotHeight - (index / 2) * plotHeight;
        return (
          <g key={`${tick}-${index}`}>
            <line x1={plot.left} x2={plot.left + plotWidth} y1={y} y2={y} stroke="#e7edf7" strokeWidth="1" />
            <text x="20" y={y + 3} textAnchor="end" fill="#748098" fontSize="9">{tick}</text>
          </g>
        );
      })}
      {months.map((month, index) => {
        const x = points[index].x;
        return (
          <g key={month.key}>
            <line x1={x} x2={x} y1={plot.top} y2={plot.top + plotHeight} stroke="#eff2f8" strokeWidth="1" />
            <text x={x} y={chartHeight - 8} textAnchor="middle" fill="#647089" fontSize="9">{month.label}</text>
          </g>
        );
      })}
      {months.some((month) => month.count > 0) && (
        <>
          <polygon points={areaList} fill="url(#employee-attendance-fill)" />
          <polyline points={pointList} fill="none" stroke="#2478f5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {points.map((point, index) => (
            <circle
              key={months[index].key}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#2478f5"
              stroke="white"
              strokeWidth="2"
            >
              <title>{`${months[index].label}: ${months[index].count} present days`}</title>
            </circle>
          ))}
        </>
      )}
    </svg>
  );
}

function PanelHeading({ icon: Icon, title, action, onAction, tone = 'blue' }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-50',
    teal: 'text-teal-700 bg-teal-50',
    green: 'text-emerald-600 bg-emerald-50',
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{title}</span>
      </h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
        >
          {action}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function EmployeeDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const {
    myProjects: projects,
    attendance,
    leaveRequests,
    leaveBalances,
    regularizationRequests,
    announcements,
  } = useHRMS();
  const employeeId = Number(currentUser?.employee_id);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const firstName = currentUser?.first_name || currentUser?.name?.split(' ')[0] || 'there';
  const myProjects = projects.filter((project) => Number(project.assigned_employee_id) === employeeId);
  const myAttendance = attendance.filter((record) => Number(record.employee_id) === employeeId);
  const myLeaves = leaveRequests.filter((leave) => Number(leave.employee_id) === employeeId);
  const myRegularizations = regularizationRequests.filter(
    (request) => Number(request.employee_id) === employeeId
  );
  const monthAttendance = myAttendance.filter((record) => getDateKey(record.date).startsWith(monthKey));
  const getStatusCount = (status) => monthAttendance.filter(
    (record) => String(record.status || '').toLowerCase() === status
  ).length;
  const presentDays = getStatusCount('present');
  const absentDays = getStatusCount('absent');
  const halfDays = monthAttendance.filter(
    (record) => String(record.status || '').toLowerCase().includes('half')
  ).length;
  const shortHoursDays = getStatusCount('short hours');
  const otherDays = Math.max(0, monthAttendance.length - presentDays - absentDays - halfDays - shortHoursDays);
  const attendancePercentage = monthAttendance.length
    ? Math.round((presentDays / monthAttendance.length) * 100)
    : 0;
  const myBalance = leaveBalances?.[employeeId] || leaveBalances?.[String(employeeId)] || null;
  const balanceFields = ['cl', 'sl', 'pl', 'comp_off'];
  const hasLeaveBalance = Boolean(myBalance);
  const leaveDays = hasLeaveBalance
    ? balanceFields.reduce((total, key) => total + (Number(myBalance[key]) || 0), 0)
    : 0;
  const pendingLeaveCount = myLeaves.filter(
    (leave) => String(leave.status || '').toLowerCase() === 'pending'
  ).length;
  const pendingRegularizationCount = myRegularizations.filter(
    (request) => String(request.status || '').toLowerCase() === 'pending'
  ).length;
  const pendingRequests = pendingLeaveCount + pendingRegularizationCount;
  const activeProjects = myProjects.filter(
    (project) => !['completed', 'cancelled'].includes(String(project.status || '').toLowerCase())
  ).length;
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      count: myAttendance.filter((record) =>
        getDateKey(record.date).startsWith(key)
        && String(record.status || '').toLowerCase() === 'present'
      ).length,
    };
  });
  const maxMonthlyAttendance = Math.max(1, ...monthlyTrend.map((month) => month.count));
  const attendanceSummary = [
    { label: 'Present', count: presentDays },
    { label: 'Absent', count: absentDays },
    { label: 'Half Day', count: halfDays },
    { label: 'Short Hours', count: shortHoursDays },
    { label: 'Other', count: otherDays },
  ];

  const todayDate = new Date(`${todayKey}T00:00:00`);
  const upcomingEvents = [
    ...myProjects
      .filter((project) => !['completed', 'cancelled'].includes(String(project.status || '').toLowerCase()))
      .map((project) => ({
        id: `project-${project.id}`,
        title: project.name || 'Project deadline',
        type: 'Project deadline',
        date: getDateKey(project.active_due_date || project.planned_end_date),
        status: project.status || 'In progress',
      })),
    ...myLeaves
      .filter((leave) => String(leave.status || '').toLowerCase() === 'approved')
      .map((leave) => ({
        id: `leave-${leave.id}`,
        title: `${leave.leave_type || 'Approved leave'}`,
        type: 'Approved leave',
        date: getDateKey(leave.from_date),
        status: 'Approved',
      })),
  ]
    .filter((event) => {
      if (!event.date) return false;
      const date = new Date(`${event.date}T00:00:00`);
      return !Number.isNaN(date.getTime()) && date >= todayDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const activities = [
    ...myLeaves.map((leave) => ({
      id: `leave-${leave.id}`,
      title: `${leave.leave_type || 'Leave'} request`,
      detail: `${formatDate(leave.from_date)} · ${leave.days || 1} ${Number(leave.days || 1) === 1 ? 'day' : 'days'}`,
      status: leave.status,
      date: leave.updated_at || leave.created_at || leave.from_date,
      icon: CalendarDays,
    })),
    ...myAttendance.slice(0, 4).map((record) => ({
      id: `attendance-${record.id || record.date}`,
      title: `${record.status || 'Attendance'} attendance`,
      detail: record.punch_in ? `Check in at ${record.punch_in}` : formatDate(record.date),
      status: record.status,
      date: record.date,
      icon: Clock3,
    })),
    ...myProjects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name || 'Assigned project',
      detail: `${project.progress_percent ?? 0}% complete`,
      status: project.status || 'In progress',
      date: project.updated_at || project.start_date,
      icon: FolderKanban,
    })),
    ...announcements.map((announcement) => ({
      id: `announcement-${announcement.id}`,
      title: announcement.title || 'Company update',
      detail: announcement.category || 'Announcement',
      status: 'Update',
      date: announcement.published_at || announcement.created_at,
      icon: Megaphone,
    })),
  ]
    .sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0))
    .slice(0, 3);

  const quickActions = [
    { label: 'Apply Leave', module: 'leaves', icon: CalendarDays, color: 'bg-blue-50 text-blue-600' },
    { label: 'My Attendance', module: 'attendance', icon: Clock3, color: 'bg-violet-50 text-violet-600' },
    { label: 'My Payslips', module: 'payslips', icon: WalletCards, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Raise Request', module: 'expenses', icon: ReceiptText, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'My Projects', module: 'my_projects', icon: FolderKanban, color: 'bg-teal-50 text-teal-700' },
    { label: 'View Policies', module: 'documents', icon: FileText, color: 'bg-purple-50 text-purple-600' },
    { label: 'Get Support', module: 'helpdesk', icon: CircleHelp, color: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-4 sm:space-y-5">
      <EmployeeHero firstName={firstName} />

      <section aria-label="Employee overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-[#e9f1ff] p-4 shadow-sm">
          <CalendarDays aria-hidden="true" className="absolute -right-2 -top-1 h-20 w-20 text-blue-200/50" />
          <div className="relative flex items-start justify-between gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-blue-700">
              {attendancePercentage}% this month
            </span>
          </div>
          <h2 className="relative mt-3 text-xs font-bold text-slate-900">Total Attendance</h2>
          <p className="relative mt-0.5 text-[11px] text-slate-600">This month</p>
          <div className="relative mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">{presentDays}</span>
            <span className="text-sm font-semibold text-slate-500">/ {monthAttendance.length} records</span>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-[#ddfff2] p-4 shadow-sm">
          <WalletCards aria-hidden="true" className="absolute -right-2 -top-1 h-20 w-20 text-emerald-200/50" />
          <div className="relative flex items-start justify-between gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <WalletCards className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-emerald-700">Annual balance</span>
          </div>
          <h2 className="relative mt-3 text-xs font-bold text-slate-900">Leave Balance</h2>
          <p className="relative mt-0.5 text-[11px] text-slate-600">Available across leave types</p>
          <p className="relative mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            {hasLeaveBalance ? `${leaveDays} Days` : '—'}
          </p>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-[#f1e9ff] p-4 shadow-sm">
          <Bell aria-hidden="true" className="absolute -right-2 -top-1 h-20 w-20 text-violet-200/60" />
          <div className="relative flex items-start justify-between gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <FileText className="h-5 w-5" />
            </span>
            <button type="button" onClick={() => onNavigate('leaves')} className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-white">
              View requests <ArrowRight className="ml-0.5 inline h-3 w-3" />
            </button>
          </div>
          <h2 className="relative mt-3 text-xs font-bold text-slate-900">Pending Requests</h2>
          <p className="relative mt-0.5 text-[11px] text-slate-600">Leave & attendance review</p>
          <p className="relative mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{pendingRequests}</p>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-[#d9f7f1] p-4 shadow-sm">
          <ChartNoAxesColumnIncreasing aria-hidden="true" className="absolute -right-2 -top-1 h-20 w-20 text-teal-200/60" />
          <div className="relative flex items-start justify-between gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-teal-700">{activeProjects} active</span>
          </div>
          <h2 className="relative mt-3 text-xs font-bold text-slate-900">Performance & Goals</h2>
          <p className="relative mt-0.5 text-[11px] text-slate-600">Your assigned work</p>
          <button
            type="button"
            onClick={() => onNavigate('performance')}
            className="relative mt-1 text-left text-sm font-extrabold text-slate-900 hover:text-teal-700"
          >
            View progress <ArrowRight className="ml-1 inline h-3.5 w-3.5 text-teal-700" />
          </button>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1.2fr_0.95fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PanelHeading icon={ChartNoAxesColumnIncreasing} title="Attendance Overview" tone="teal" />
          <p className="mt-1 text-[10px] text-slate-500">This month · {monthAttendance.length} recorded days</p>
          <div className="mt-4">
            <AttendanceDonut
              summary={attendanceSummary}
              total={monthAttendance.length}
              percentage={attendancePercentage}
            />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PanelHeading icon={CalendarDays} title="Monthly Attendance Trend" />
          <p className="mt-1 text-[10px] text-slate-500">Present days recorded over the last six months</p>
          {monthlyTrend.some((month) => month.count > 0) ? (
            <AttendanceTrend months={monthlyTrend} maxCount={maxMonthlyAttendance} />
          ) : (
            <div role="status" className="flex h-40 items-center justify-center px-4 text-center text-xs text-slate-500">
              Attendance history will appear here when available.
            </div>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#0f172a] px-4 py-3 text-white">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xs font-bold">
                <CalendarDays className="h-4 w-4 text-blue-300" />
                Upcoming Events
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-100 hover:text-white"
              >
                View calendar <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          {upcomingEvents.length ? (
            <div className="divide-y divide-slate-100 px-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-2.5 py-3">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-[9px] font-bold leading-tight text-blue-700">
                    <span>{formatDate(event.date).split(' ')[0]}</span>
                    <span>{formatDate(event.date).split(' ')[1]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-slate-800">{event.title}</p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-500">{event.type} · {formatDate(event.date)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${statusClass(event.status)}`}>
                    {event.type === 'Project deadline' ? 'Due' : 'Approved'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p role="status" className="px-4 py-10 text-center text-xs text-slate-500">
              No upcoming events in your records.
            </p>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1.35fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PanelHeading icon={Sparkles} title="Quick Actions" tone="teal" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {quickActions.map(({ label, module, icon: Icon, color }) => (
              <button
                type="button"
                key={module}
                onClick={() => onNavigate(module)}
                className="group flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-2 text-center transition hover:border-teal-200 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} transition group-hover:scale-105`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[10px] font-bold text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PanelHeading
            icon={Bell}
            title="Recent Activities"
            action="View all"
            onAction={() => onNavigate('developer_space')}
            tone="teal"
          />
          {activities.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {activities.map(({ id, title, detail, status, date, icon: Icon }) => (
                <div key={id} className="flex items-start gap-2.5 py-3 first:pt-2 last:pb-1">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[11px] font-semibold text-slate-800">{title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{detail}</p>
                    {date && <p className="mt-0.5 text-[9px] text-slate-400">{formatTimestamp(date)}</p>}
                  </div>
                  {status && (
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${statusClass(status)}`}>
                      {String(status).replaceAll('_', ' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p role="status" className="py-9 text-center text-xs text-slate-500">Your latest updates will appear here.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PanelHeading
            icon={UserRound}
            title="Your Profile"
            action="Open workspace"
            onAction={() => onNavigate('developer_space')}
          />
          <div className="mt-4 flex items-center gap-3">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="h-20 w-20 shrink-0 rounded-full border-4 border-slate-100 object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-slate-100 bg-[#0f172a] text-xl font-bold text-white">
                {getInitials(currentUser)}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-slate-900">{currentUser?.name}</h3>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{currentUser?.designation || 'Employee'}</p>
              <p className="mt-2 flex items-center gap-1.5 truncate text-[10px] text-slate-600">
                <BriefcaseBusiness className="h-3 w-3 shrink-0 text-blue-600" />
                Employee ID: {currentUser?.employee_code || 'Not available'}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-slate-600">
                <UserRound className="h-3 w-3 shrink-0 text-blue-600" />
                {currentUser?.email || 'Email not available'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="truncate text-[10px] text-slate-500">{currentUser?.branch_name || 'Branch not set'}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
              Employee account
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
