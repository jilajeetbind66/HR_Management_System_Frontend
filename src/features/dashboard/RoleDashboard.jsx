import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import EmployeeDashboard from './EmployeeDashboard';
import ManagerDashboard from './ManagerDashboard';
import RecruiterDashboard from './RecruiterDashboard';
import { canAccessModule, getPanelName } from '../../config/roleAccess';
import { canReviewLeave } from '../../utils/leaveApproval';
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  Clock,
  FolderKanban,
  Megaphone,
  ShieldCheck,
  Users,
} from 'lucide-react';

const panelCopy = {
  employee: {
    title: 'Your Employee Workspace',
    description: 'View your assigned work, attendance, and leave information.',
    links: [['developer_space', 'Open My Workspace'], ['leaves', 'View Leave']],
  },
  manager: {
    title: 'Team Manager Panel',
    description: 'Monitor your direct team, project delivery, and pending requests.',
    links: [['employees', 'View My Team'], ['projects', 'Review Projects'], ['leaves', 'Review Leave']],
  },
  hr_admin: {
    title: 'HR Operations Panel',
    description: 'Manage workforce records, HR operations, and recruitment.',
    links: [['employees', 'Employee Directory'], ['recruitment', 'Recruitment'], ['attendance', 'Attendance']],
  },
  hr_executive: {
    title: 'HR Operations Panel',
    description: 'Manage employee records, documents, and day-to-day HR operations.',
    links: [['employees', 'Employee Directory'], ['documents', 'Employee Documents'], ['leaves', 'Leave Requests']],
  },
  recruiter: {
    title: 'Recruitment Panel',
    description: 'Work with recruitment and candidate pipelines.',
    links: [['recruitment', 'Open Recruitment']],
  },
  payroll_admin: {
    title: 'Payroll Administration Panel',
    description: 'Review payroll runs and perform authorized payroll operations.',
    links: [['payroll', 'Open Payroll'], ['reports', 'View Reports']],
  },
  auditor: {
    title: 'Audit & Compliance Panel',
    description: 'Review audit activity and payroll records without changing them.',
    links: [['platform', 'Audit Logs'], ['reports', 'View Reports'], ['payroll', 'Payroll Records']],
  },
};

export default function RoleDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const {
    employees,
    projects,
    attendance,
    leaveRequests,
    payrollRuns,
    auditLogs,
    branches,
    announcements,
  } = useHRMS();
  const role = currentUser.role;
  if (role === 'employee') {
    return <EmployeeDashboard onNavigate={onNavigate} />;
  }
  if (role === 'manager') {
    return <ManagerDashboard onNavigate={onNavigate} />;
  }
  if (role === 'recruiter') {
    return <RecruiterDashboard onNavigate={onNavigate} />;
  }

  const panel = panelCopy[role] || panelCopy.employee;
  const myProjects = projects.filter(project => Number(project.assigned_employee_id) === Number(currentUser.employee_id));
  const myAttendance = attendance.filter(record => Number(record.employee_id) === Number(currentUser.employee_id));
  const pendingLeaves = leaveRequests.filter(leave => canReviewLeave(leave, currentUser));
  const employeeCount = employees.filter(employee => employee.status === 'active').length;
  const today = new Date().toISOString().slice(0, 10);
  const presentToday = attendance.filter(record => record.date === today && record.status === 'Present').length;
  const isHrRole = ['hr_admin', 'hr_executive'].includes(role);
  const absentToday = attendance.filter(
    record => record.date === today && String(record.status || '').toLowerCase() === 'absent'
  ).length;
  const latestPendingLeaves = pendingLeaves.slice(0, 4);
  const latestAnnouncements = announcements.slice(0, 3);
  const attendanceByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const records = attendance.filter(record => record.date === dateKey);
    return {
      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      present: records.filter(record => String(record.status || '').toLowerCase() === 'present').length,
      absent: records.filter(record => String(record.status || '').toLowerCase() === 'absent').length,
    };
  });
  const maxAttendance = Math.max(1, ...attendanceByDay.map(day => day.present + day.absent));
  const statCards = role === 'employee'
    ? [
      { title: 'My Active Projects', value: myProjects.filter(project => project.status !== 'completed').length, icon: FolderKanban, color: 'indigo' },
      { title: 'My Attendance Records', value: myAttendance.length, icon: Clock, color: 'blue' },
      { title: 'My Pending Leave', value: leaveRequests.filter(leave => leave.status === 'pending').length, icon: CalendarCheck, color: 'amber' },
    ]
    : role === 'manager'
    ? [
      { title: 'Direct Reports', value: employeeCount, icon: Users, color: 'indigo' },
      { title: 'Team Projects', value: projects.length, icon: FolderKanban, color: 'blue' },
      { title: 'Pending Leave Requests', value: pendingLeaves.length, icon: CalendarCheck, color: 'amber' },
    ]
    : role === 'hr_admin' || role === 'hr_executive' || role === 'recruiter'
    ? [
      { title: 'Active Employees', value: employeeCount, icon: Users, color: 'indigo' },
      { title: 'Pending HR Requests', value: pendingLeaves.length, icon: CalendarCheck, color: 'amber' },
      { title: 'Branches', value: branches.length, icon: Building2, color: 'blue' },
    ]
    : role === 'payroll_admin'
    ? [
      { title: 'Payroll Runs', value: payrollRuns.length, icon: Banknote, color: 'indigo' },
      { title: 'Runs Awaiting Review', value: payrollRuns.filter(run => run.status === 'review').length, icon: CalendarCheck, color: 'amber' },
    ]
    : [
      { title: 'Audit Events', value: auditLogs.length, icon: ShieldCheck, color: 'indigo' },
      { title: 'Payroll Records', value: payrollRuns.length, icon: Banknote, color: 'blue' },
    ];
  const availableLinks = panel.links.filter(([module]) => canAccessModule(role, module));

  if (isHrRole) {
    const hrStats = [
      { title: 'Total Employees', value: employeeCount, icon: Users, tone: 'emerald' },
      { title: 'Today Presents', value: presentToday, icon: CalendarCheck, tone: 'emerald' },
      { title: 'Today Absents', value: absentToday, icon: CircleAlert, tone: 'amber' },
      { title: 'Pending Leave', value: pendingLeaves.length, icon: CalendarDays, tone: 'rose' },
    ];

    return (
      <div className="space-y-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">HR workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{panel.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{panel.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableLinks.map(([module, label]) => (
              <button
                key={module}
                type="button"
                onClick={() => onNavigate(module)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {label}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </section>

        <section aria-label="HR overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {hrStats.map(({ title, value, icon: Icon, tone }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-500">{title}</h2>
                <span className={`rounded-lg p-2 ${
                  tone === 'emerald' ? 'bg-emerald-50 text-emerald-700'
                    : tone === 'amber' ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-[11px] text-slate-400">From current HRMS records</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Daily Attendance Statistics</h2>
                <p className="mt-1 text-xs text-slate-500">Present and absent records over the last 7 days</p>
              </div>
              <span className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Present</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Absent</span>
              </span>
            </div>
            {attendanceByDay.some(day => day.present || day.absent) ? (
              <div className="mt-5 grid h-40 grid-cols-7 gap-3 border-b border-slate-100">
                {attendanceByDay.map(day => (
                  <div key={day.label} className="flex min-w-0 flex-col items-center justify-end">
                    <div className="flex h-32 w-full items-end justify-center gap-1">
                      <div
                        title={`${day.present} present`}
                        className="w-3 max-w-[35%] rounded-t bg-emerald-500 transition-all"
                        style={{ height: `${Math.max(day.present ? 8 : 0, (day.present / maxAttendance) * 100)}%` }}
                      />
                      <div
                        title={`${day.absent} absent`}
                        className="w-3 max-w-[35%] rounded-t bg-amber-400 transition-all"
                        style={{ height: `${Math.max(day.absent ? 8 : 0, (day.absent / maxAttendance) * 100)}%` }}
                      />
                    </div>
                    <span className="py-2 text-[10px] font-medium text-slate-400">{day.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p role="status" className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                No attendance records available for the last 7 days.
              </p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Leave Applications</h2>
                <p className="mt-1 text-xs text-slate-500">Recent requests awaiting review</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('leaves')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                View all
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {latestPendingLeaves.length ? latestPendingLeaves.map(leave => (
                <div key={leave.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 rounded-full bg-emerald-50 p-2 text-emerald-700">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{leave.employee_name || 'Employee'}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {leave.leave_type || 'Leave'} · {leave.from_date || 'Date not set'}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Pending</span>
                </div>
              )) : (
                <p className="py-8 text-center text-xs text-slate-500">No pending leave applications.</p>
              )}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Latest Announcements</h2>
                <p className="mt-1 text-xs text-slate-500">Updates published for your organization</p>
              </div>
              <Megaphone className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-4 space-y-3">
              {latestAnnouncements.length ? latestAnnouncements.map(announcement => (
                <div key={announcement.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-800">{announcement.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{announcement.content}</p>
                </div>
              )) : (
                <p className="rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                  No announcements available.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">HR Quick Access</h2>
                <p className="mt-1 text-xs text-slate-500">Open your regular HR workflows</p>
              </div>
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availableLinks.map(([module, label]) => (
                <button
                  key={module}
                  type="button"
                  onClick={() => onNavigate(module)}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  {label}
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                </button>
              ))}
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="hrms-dashboard-hero rounded-2xl p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-50">
          {getPanelName(role)} workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold">{panel.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">{panel.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {availableLinks.map(([module, label]) => (
            <Button key={module} size="sm" variant="secondary" onClick={() => onNavigate(module)}>
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section aria-label={`${getPanelName(role)} overview`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(card => (
          <StatCard key={card.title} {...card} />
        ))}
        {role === 'manager' && (
          <StatCard title="Present Today" value={presentToday} icon={Clock} color="emerald" />
        )}
      </section>
    </div>
  );
}
