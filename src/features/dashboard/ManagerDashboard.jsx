import React from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  FolderKanban,
  Megaphone,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { canReviewLeave } from '../../utils/leaveApproval';

const dateKey = (date) => String(date || '').slice(0, 10);

const formatDate = (date) => {
  const parsedDate = new Date(`${dateKey(date)}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? 'Date not set'
    : parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function ManagerStatCard({ title, value, note, badge, icon: Icon, tone, module, onNavigate }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <article className="flex min-h-[178px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}>{badge}</span>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-slate-900">{value}</p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <p className="text-[11px] text-slate-500">{note}</p>
        <button
          type="button"
          onClick={() => onNavigate(module)}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-700 transition hover:text-teal-900 focus:outline-none focus-visible:underline"
        >
          View
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function PanelHeader({ icon: Icon, title, action, onAction }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{title}</span>
      </h2>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 focus:outline-none focus-visible:underline"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function ManagerDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const { employees, projects, attendance, leaveRequests, announcements } = useHRMS();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const firstName = currentUser.first_name || currentUser.name?.split(' ')[0] || 'Manager';
  const teamMembers = employees.filter(
    (employee) => String(employee.status || '').toLowerCase() === 'active'
  );
  const teamMemberIds = new Set(teamMembers.map((employee) => Number(employee.id)));
  const teamProjects = projects.filter(
    (project) => teamMemberIds.has(Number(project.assigned_employee_id))
  );
  const activeTeamProjects = teamProjects.filter(
    (project) => !['completed', 'cancelled'].includes(String(project.status || '').toLowerCase())
  );
  const pendingTeamLeaves = leaveRequests.filter((leave) => canReviewLeave(leave, currentUser));
  const presentToday = attendance.filter(
    (record) => teamMemberIds.has(Number(record.employee_id))
      && dateKey(record.date) === todayKey
      && String(record.status || '').toLowerCase() === 'present'
  ).length;
  const latestAnnouncements = announcements.slice(0, 4);
  const upcomingDeadlines = activeTeamProjects
    .map((project) => ({
      ...project,
      deadline: dateKey(project.active_due_date || project.planned_end_date),
    }))
    .filter((project) => project.deadline && project.deadline >= todayKey)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4);

  const stats = [
    {
      title: 'Team Members',
      value: teamMembers.length,
      note: 'Active direct reports',
      badge: 'Team',
      icon: UsersRound,
      tone: 'teal',
      module: 'employees',
    },
    {
      title: 'Team Projects',
      value: activeTeamProjects.length,
      note: 'Assigned active projects',
      badge: 'Projects',
      icon: FolderKanban,
      tone: 'blue',
      module: 'projects',
    },
    {
      title: 'Pending Leave Requests',
      value: pendingTeamLeaves.length,
      note: 'Awaiting your review',
      badge: 'Review',
      icon: FileText,
      tone: 'amber',
      module: 'leaves',
    },
    {
      title: 'Present Today',
      value: presentToday,
      note: 'Team attendance records',
      badge: 'Today',
      icon: Clock3,
      tone: 'rose',
      module: 'attendance',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-5">
      <section className="hrms-dashboard-hero relative isolate flex min-h-[160px] items-center justify-between overflow-hidden rounded-2xl px-6 py-6 text-white shadow-md sm:px-8">
        <div aria-hidden="true" className="absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-2 -bottom-36 -z-10 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-medium text-teal-50">Manager workspace</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[30px]">
            Welcome, {firstName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-sm text-teal-50">
            Review your team, project delivery, and requests from one place.
          </p>
        </div>
        <div aria-hidden="true" className="relative z-10 mr-2 hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white sm:flex">
          <Building2 className="h-10 w-10" strokeWidth={1.6} />
        </div>
      </section>

      <section aria-label="Team overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <ManagerStatCard key={stat.title} {...stat} onNavigate={onNavigate} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <PanelHeader
            icon={Megaphone}
            title="Recent Notices"
            action="View All"
            onAction={() => onNavigate('announcements')}
          />
          <p className="mt-1 text-xs text-slate-500">Latest company announcements for your team</p>
          {latestAnnouncements.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {latestAnnouncements.map((announcement) => (
                <div key={announcement.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{announcement.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{announcement.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p role="status" className="mt-4 rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
              No announcements available.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <PanelHeader
            icon={CalendarDays}
            title="Upcoming Team Deadlines"
            action="View Projects"
            onAction={() => onNavigate('projects')}
          />
          <p className="mt-1 text-xs text-slate-500">Due dates from active projects assigned to your direct reports</p>
          {upcomingDeadlines.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {upcomingDeadlines.map((project) => (
                <div key={`${project.id}-${project.assignment_id || project.assigned_employee_id}`} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-50 text-[9px] font-bold leading-tight text-teal-800">
                    <span>{formatDate(project.deadline).split(' ')[0]}</span>
                    <span>{formatDate(project.deadline).split(' ')[1]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{project.name || 'Team project'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {project.assigned_employee_name || 'Team member'} · Due {formatDate(project.deadline)}
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-teal-800">
                    {String(project.status || 'Active').replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p role="status" className="mt-4 rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
              No upcoming deadlines found for active team projects.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
