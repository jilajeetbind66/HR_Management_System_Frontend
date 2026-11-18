import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { getIndiaDateString } from '../../utils/date';
import { canReviewLeave } from '../../utils/leaveApproval';
import {
  Users,
  FolderGit2,
  AlertTriangle,
  Clock,
  Banknote,
  CheckCircle2,
  TrendingUp,
  Building,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function ExecutiveDashboard({ onNavigate }) {
  const { currentUser, activeBranch } = useAuth();
  const { employees, projects, attendance, leaveRequests, payrollRuns, branches } = useHRMS();

  // Branch-scoped metrics
  const selectedBranchObj = activeBranch && activeBranch !== 'All Branches'
    ? branches.find((b) => b.name === activeBranch)
    : null;
  const scopedEmployees = selectedBranchObj
    ? employees.filter((e) => Number(e.branch_id) === Number(selectedBranchObj.id))
    : employees;
  const scopedEmployeeIds = new Set(scopedEmployees.map((e) => Number(e.id)));
  const scopedProjects = selectedBranchObj
    ? projects.filter((p) => scopedEmployeeIds.has(Number(p.assigned_employee_id)))
    : projects;
  const scopedAttendance = selectedBranchObj
    ? attendance.filter((a) => scopedEmployeeIds.has(Number(a.employee_id)))
    : attendance;

  const activeEmployees = scopedEmployees.filter(e => e.status === 'active');
  const activeProjects = scopedProjects.filter(p => p.status === 'in_progress' || p.status === 'under_review' || p.status === 'overdue');
  const overdueProjects = scopedProjects.filter(p => p.status === 'overdue');
  const completedProjects = scopedProjects.filter(p => p.status === 'completed');
  const pendingLeaves = leaveRequests.filter((leave) => (
    canReviewLeave(leave, currentUser)
    && (!selectedBranchObj || scopedEmployeeIds.has(Number(leave.employee_id)))
  ));

  const today = getIndiaDateString();
  const currentMonthPrefix = today.slice(0, 7);
  const joinedThisMonth = activeEmployees.filter((e) => String(e.date_of_joining || '').startsWith(currentMonthPrefix)).length;
  const presentToday = scopedAttendance.filter(a => a.date === today && ['Present', 'Short Hours', 'Half Day', 'Late'].includes(a.status)).length;
  const attendanceRate = activeEmployees.length > 0
    ? Math.round((presentToday / activeEmployees.length) * 100)
    : 0;

  const lastPayroll = payrollRuns.find(p => ['published', 'locked'].includes(p.status)) || payrollRuns[0] || null;
  const lastPayrollBadge = lastPayroll
    ? `${lastPayroll.status.charAt(0).toUpperCase()}${lastPayroll.status.slice(1)}`
    : 'No Data';

  return (
    <div className="space-y-5">
      {/* Top Banner / Welcome */}
      <div className="hrms-dashboard-hero relative isolate flex min-h-[160px] items-center justify-between overflow-hidden rounded-2xl px-6 py-6 text-white shadow-md sm:px-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-50">Pinweb Enterprise HRMS</span>
              <span className="text-xs rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-teal-50">Prayagraj & Kaushambi</span>
            </div>
            <h1 className="text-2xl font-bold mt-1 tracking-tight text-white">
              Welcome back, {currentUser.first_name}!
            </h1>
            <p className="text-xs text-teal-50 mt-1 max-w-2xl leading-relaxed">
              Consolidated workforce, India statutory compliance (PF, ESI, PT), and Project Assignment & Deadline Monitoring.
            </p>
          </div>
          
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="teal"
              size="sm"
              icon={FolderGit2}
              onClick={() => onNavigate('projects')}
              className="min-w-[8rem] flex-1 whitespace-normal border border-white/25 text-center leading-tight"
            >
              Active Projects ({activeProjects.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Users}
              onClick={() => onNavigate('employees')}
              className="min-w-[8rem] flex-1 whitespace-normal text-center leading-tight"
            >
              Employee Directory
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div aria-hidden="true" className="absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-2 -bottom-36 -z-10 h-72 w-72 rounded-full bg-white/5" />
      </div>

      {/* Critical Alert Bar if any Overdue projects exist */}
      {overdueProjects.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm animate-pulse-slow">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {overdueProjects.length} Project Assignment Deadline{overdueProjects.length > 1 ? 's are' : ' is'} Overdue
              </p>
              <p className="text-xs text-rose-700">
                Action required: Review developer extension requests or assess non-monetary escalation notice.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onNavigate('projects')}
            icon={ArrowRight}
          >
            Review Overdue Projects
          </Button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Workforce"
          value={activeEmployees.length}
          subvalue={`${scopedEmployees.length} total in ${selectedBranchObj ? selectedBranchObj.name : 'all branches'}`}
          trend={joinedThisMonth > 0 ? `+${joinedThisMonth} joined this month` : `${branches.length} branches active`}
          icon={Users}
          color="teal"
          badge="Permanent"
          className="!min-h-[178px] !rounded-2xl"
        />

        <StatCard
          title="Projects in Delivery"
          value={activeProjects.length}
          subvalue={`${completedProjects.length} completed this cycle`}
          trend={overdueProjects.length > 0 ? `${overdueProjects.length} overdue` : "100% on schedule"}
          trendPositive={overdueProjects.length === 0}
          icon={FolderGit2}
          color={overdueProjects.length > 0 ? "rose" : "blue"}
          badge="Active Track"
          className="!min-h-[178px] !rounded-2xl"
        />

        <StatCard
          title="Today's Attendance"
          value={`${presentToday} Present`}
          subvalue={`Out of ${activeEmployees.length} active staff`}
          trend={`${attendanceRate}% checked in`}
          icon={Clock}
          color="rose"
          badge="Live"
          className="!min-h-[178px] !rounded-2xl"
        />

        <StatCard
          title="Latest Net Payroll"
          value={lastPayroll ? `₹${(Number(lastPayroll.net_payout_inr || 0) / 100000).toFixed(2)} Lakh` : 'Not run yet'}
          subvalue={lastPayroll?.month_name || 'No payroll runs'}
          trend={lastPayroll ? `${lastPayroll.total_employees || 0} employees in run` : 'Add employee records, then run payroll'}
          icon={Banknote}
          color={lastPayroll && ['published', 'locked'].includes(lastPayroll.status) ? 'teal' : 'amber'}
          badge={lastPayrollBadge}
          className="!min-h-[178px] !rounded-2xl"
        />
      </div>

      {/* Main Content Split: Projects Summary & Operations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left 2 Cols: Project Assignments & Deliverables */}
        <div className="space-y-4 lg:col-span-2">
          <Card
            className="!rounded-2xl"
            title="Project Assignments & Deadlines"
            subtitle="Developer assignment tracking, progress updates, and deadline compliance"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('projects')} icon={ArrowRight}>
                View All
              </Button>
            }
          >
            <div className="space-y-4">
              {scopedProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                  No project assignments found{selectedBranchObj ? ` for ${selectedBranchObj.name}` : ''}.
                </div>
              ) : scopedProjects.map(project => {
                const isOverdue = project.status === 'overdue';
                const isComplete = project.status === 'completed';
                const isReview = project.status === 'under_review';
                const assigneeInitials = String(project.assigned_employee_name || 'E')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div key={project.id} className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition bg-slate-50/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">{project.project_code}</span>
                          <h4 className="font-semibold text-slate-900 text-sm">{project.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{project.deliverable}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <Badge variant="danger" size="sm">
                            <AlertTriangle className="w-3 h-3" /> Overdue by {project.overdue_days}d
                          </Badge>
                        )}
                        {isReview && <Badge variant="warning" size="sm">Under Review</Badge>}
                        {isComplete && <Badge variant="success" size="sm">Completed</Badge>}
                        {!isOverdue && !isReview && !isComplete && (
                          <Badge variant="teal" size="sm">In Progress</Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold">{project.progress_percent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isComplete ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-teal-600'
                          }`}
                          style={{ width: `${project.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer: Assigned developer & Dates */}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        {project.assigned_employee_avatar ? (
                          <img src={project.assigned_employee_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700">
                            {assigneeInitials}
                          </span>
                        )}
                        <span className="font-medium text-slate-700">{project.assigned_employee_name}</span>
                        <span className="text-[11px] text-slate-400">({project.assigned_employee_code})</span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px]">
                        <span>Baseline Due: <strong className="text-slate-700">{project.planned_end_date}</strong></span>
                        <span>Active Due: <strong className={isOverdue ? "text-rose-600" : "text-teal-700"}>{project.active_due_date}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Branch Distribution */}
          <Card className="!rounded-2xl" title="India Branches & Headcount" subtitle="Multi-branch organization structure">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {branches.map(branch => (
                <div key={branch.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700">
                      <Building className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">{branch.name}</p>
                      <p className="text-[11px] text-slate-400">{branch.city}, {branch.state}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700">{branch.employees_count}</span>
                    <p className="text-[10px] text-slate-400">staff</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Pending Actions & Today Summary */}
        <div className="space-y-4">
          {/* Pending Approval Requests */}
          <Card className="!rounded-2xl" title="Pending Approvals" subtitle="Multi-level workflow queue">
            <div className="space-y-3">
              {pendingLeaves.length > 0 ? (
                pendingLeaves.map(leave => (
                  <div key={leave.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{leave.employee_name}</span>
                      <Badge variant="warning" size="sm">{leave.days} Day(s)</Badge>
                    </div>
                    <p className="text-slate-600 mt-1 font-medium">{leave.leave_type}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 italic">"{leave.reason}"</p>
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onNavigate('leaves')}>
                        Review in Leaves
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-80" />
                  All leave requests cleared
                </div>
              )}
            </div>
          </Card>

          {/* India Statutory Compliance Snapshot */}
          <Card className="!rounded-2xl" title="India Statutory Setup" subtitle="Payroll statutory compliance status">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">EPF / UAN Registration</span>
                <Badge variant="success" size="sm">Active (12%)</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">ESI Applicability</span>
                <Badge variant="success" size="sm">Configured (0.75%)</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">Professional Tax (PT)</span>
                <Badge variant="teal" size="sm">State Configured</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-slate-600">Income Tax (TDS)</span>
                <Badge variant="cyan" size="sm">New & Old Regimes</Badge>
              </div>
            </div>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="!rounded-2xl" title="Quick Management" subtitle="Frequent Admin actions">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onNavigate('projects')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
              >
                <FolderGit2 className="w-4 h-4 text-teal-600 mb-1.5" />
                <p className="font-semibold text-slate-800">Assign Project</p>
                <p className="text-[10px] text-slate-400">Deliverables</p>
              </button>

              <button
                onClick={() => onNavigate('attendance')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
              >
                <Clock className="w-4 h-4 text-blue-600 mb-1.5" />
                <p className="font-semibold text-slate-800">Punches Log</p>
                <p className="text-[10px] text-slate-400">Regularization</p>
              </button>

              <button
                onClick={() => onNavigate('payroll')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
              >
                <Banknote className="w-4 h-4 text-teal-600 mb-1.5" />
                <p className="font-semibold text-slate-800">Run Payroll</p>
                <p className="text-[10px] text-slate-400">Generate Payslips</p>
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="p-3 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
              >
                <TrendingUp className="w-4 h-4 text-amber-600 mb-1.5" />
                <p className="font-semibold text-slate-800">Export CSV</p>
                <p className="text-[10px] text-slate-400">Compliance Audit</p>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
