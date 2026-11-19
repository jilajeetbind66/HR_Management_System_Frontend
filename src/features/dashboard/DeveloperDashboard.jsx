import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { getIndiaDateString } from '../../utils/date';
import {
  FolderGit2,
  Clock,
  CalendarCheck,
  Send,
  CalendarPlus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sliders,
  Sparkles,
  Link2,
  Calendar
} from 'lucide-react';

export default function DeveloperDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const {
    employees,
    projects,
    myProjects: assignedProjects,
    updateProjectProgress,
    requestExtension,
    submitProjectCompletion,
    attendance,
    punchAttendance,
    leaveRequests,
    leaveBalances,
    applyLeave,
    selectedPersonaId,
  } = useHRMS();

  const selectedPersona = currentUser.role === 'super_admin' && selectedPersonaId
    ? employees.find((employee) => Number(employee.id) === Number(selectedPersonaId))
    : null;
  const workspaceUser = selectedPersona
    ? { ...currentUser, ...selectedPersona, employee_id: selectedPersona.id }
    : currentUser;
  const workspaceEmployeeId = Number(workspaceUser.employee_id);
  const isViewingOwnWorkspace = workspaceEmployeeId === Number(currentUser.employee_id);
  const projectSource = currentUser.role === 'super_admin' ? projects : assignedProjects;
  const myProjects = projectSource.filter(
    (project) => Number(project.assigned_employee_id) === workspaceEmployeeId
  );
  const myLeaveRequests = leaveRequests.filter(
    (leave) => Number(leave.employee_id) === workspaceEmployeeId
  );
  const canUpdateMyProjects = ['employee', 'manager', 'super_admin'].includes(currentUser.role);
  const openMyLeave = () => setShowMyLeaveRequests(true);

  // Today's punch
  const today = getIndiaDateString();
  const myPunch = attendance.find(a => Number(a.employee_id) === workspaceEmployeeId && a.date === today);
  const isPunchComplete = Boolean(myPunch?.punch_out);

  // Balances
  const myBalance = { cl: 0, sl: 0, pl: 0, comp_off: 0, ...leaveBalances[workspaceEmployeeId] };

  // Modals state
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressVal, setProgressVal] = useState(50);
  const [progressNote, setProgressNote] = useState('');

  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [requestedDate, setRequestedDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionDeliverable, setSubmissionDeliverable] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMyLeaveRequests, setShowMyLeaveRequests] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave (CL)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState('first_half');
  const [sickCertificateFile, setSickCertificateFile] = useState(null);
  const [leaveWarning, setLeaveWarning] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [workflowError, setWorkflowError] = useState('');

  const handleUpdateProgressSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (Number(progressVal) < Number(selectedProject.progress_percent || 0)) {
      setWorkflowError(`Progress cannot be reduced from ${selectedProject.progress_percent}% to ${progressVal}%. Milestone progress can only advance forward.`);
      return;
    }
    setWorkflowError('');
    try {
      await updateProjectProgress(selectedProject.id, Number(progressVal), progressNote);
      setShowProgressModal(false);
      setProgressNote('');
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save project progress.');
    }
  };

  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject || !requestedDate || !extensionReason) return;
    setWorkflowError('');
    try {
      await requestExtension(selectedProject.id, requestedDate, extensionReason);
      setShowExtensionModal(false);
      setRequestedDate('');
      setExtensionReason('');
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the extension request.');
    }
  };

  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    if (!selectedProject || !submissionNote) return;
    setWorkflowError('');
    try {
      await submitProjectCompletion(selectedProject.id, submissionNote, submissionDeliverable);
      setShowSubmitModal(false);
      setSubmissionNote('');
      setSubmissionDeliverable('');
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to submit project completion.');
    }
  };

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !leaveReason) return;
    try {
      const saved = await applyLeave({
        employee_id: workspaceEmployeeId,
        employee_name: `${workspaceUser.first_name} ${workspaceUser.last_name}`,
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        certificate_file: sickCertificateFile,
        reason: leaveReason,
      }, `${workspaceUser.first_name} ${workspaceUser.last_name}`);
      setLeaveWarning(saved?.warnings?.join(' ') || '');
      setShowLeaveModal(false);
      setFromDate('');
      setToDate('');
      setLeaveReason('');
      setSickCertificateFile(null);
      setIsHalfDay(false);
    } catch (err) {
      setWorkflowError(err?.data?.message || err.message || 'Unable to save the leave request.');
    }
  };

  const handleDeveloperPunch = async () => {
    if (!isViewingOwnWorkspace) return;
    if (isPunchComplete) return;

    try {
      setWorkflowError('');
      await punchAttendance(workspaceEmployeeId, workspaceUser.branch_name || 'Web Portal');
    } catch (err) {
      setWorkflowError(err?.data?.message || err.message || 'Unable to save the attendance punch.');
    }
  };

  return (
    <div className="space-y-6">
      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {workflowError}
        </div>
      )}
      {leaveWarning && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {leaveWarning}
        </div>
      )}
      {/* Developer Hero */}
      <div className="hrms-dashboard-hero rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {workspaceUser.avatar ? (
            <img
              src={workspaceUser.avatar}
              alt=""
              className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-400 shadow-lg"
            />
          ) : (
            <div className="flex w-16 h-16 items-center justify-center rounded-2xl bg-slate-900 border-2 border-teal-400 text-lg font-bold text-white shadow-lg">
              {`${workspaceUser.first_name?.[0] || ''}${workspaceUser.last_name?.[0] || ''}`.toUpperCase() || 'EMP'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-50">My Workspace</span>
              <span className="text-xs bg-white/15 text-teal-50 px-2 py-0.5 rounded-full">{workspaceUser.employee_code}</span>
            </div>
            <h1 className="text-2xl font-bold mt-0.5 text-white">{workspaceUser.first_name} {workspaceUser.last_name}</h1>
            <p className="text-xs text-teal-50">{workspaceUser.designation} • {workspaceUser.branch_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={CalendarCheck}
            onClick={openMyLeave}
          >
            My Leave
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            disabled={!isViewingOwnWorkspace}
            title={!isViewingOwnWorkspace ? 'Payslips are available only for your signed-in account.' : undefined}
            onClick={() => onNavigate('payslips')}
          >
            My Payslips
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={CalendarPlus}
            disabled={!isViewingOwnWorkspace}
            onClick={() => setShowLeaveModal(true)}
          >
            Apply Leave
          </Button>
          <Button
            variant={isPunchComplete ? "secondary" : "primary"}
            size="sm"
            icon={Clock}
            disabled={!isViewingOwnWorkspace || isPunchComplete}
            title={!isViewingOwnWorkspace ? 'Punch actions are available only for your signed-in account.' : undefined}
            onClick={handleDeveloperPunch}
            className={isPunchComplete ? '' : 'bg-teal-600 hover:bg-teal-500 shadow'}
          >
            {isPunchComplete ? "Punch Completed" : myPunch ? "Punch Out" : "Punch In"}
          </Button>
        </div>
      </div>

      {/* Grid: Left 2 Cols (My Projects), Right 1 Col (Attendance & Leaves) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Assigned Projects */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="My Assigned Projects & Deliverables"
            subtitle="Real-time progress reporting, deadline adherence, and extension requests"
          >
            {myProjects.length > 0 ? (
              <div className="space-y-4">
                {myProjects.map(project => {
                  const isOverdue = project.status === 'overdue';
                  const isComplete = project.status === 'completed';
                  const isUnderReview = project.status === 'under_review';

                  return (
                    <div key={project.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                              {project.project_code}
                            </span>
                            <h3 className="font-bold text-slate-900 text-base">{project.name}</h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{project.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOverdue && (
                            <Badge variant="danger" size="md">
                              <AlertTriangle className="w-3.5 h-3.5" /> Overdue by {project.overdue_days} Days
                            </Badge>
                          )}
                          {isUnderReview && <Badge variant="warning" size="md">Submitted for Review</Badge>}
                          {isComplete && <Badge variant="success" size="md"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</Badge>}
                          {!isOverdue && !isUnderReview && !isComplete && (
                            <Badge variant="primary" size="md">In Progress</Badge>
                          )}
                        </div>
                      </div>

                      {/* Deliverable Box */}
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                        <strong className="text-slate-900 font-semibold">Deliverable Objective: </strong>
                        {project.deliverable}
                      </div>

                      {/* Progress Bar & Slider */}
                      <div>
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                          <span>Delivery Progress</span>
                          <span className="text-teal-600 font-bold">{project.progress_percent}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isComplete ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-teal-600'
                            }`}
                            style={{ width: `${project.progress_percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Timeline Dates */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/80 p-3 rounded-lg border border-slate-200/60">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Start Date</span>
                          <span className="font-semibold text-slate-700">{project.start_date}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Baseline Due (Original)</span>
                          <span className="font-semibold text-slate-700">{project.planned_end_date}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Deadline</span>
                          <span className={`font-bold ${isOverdue ? "text-rose-600" : "text-teal-600"}`}>
                            {project.active_due_date}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned By</span>
                          <span className="font-semibold text-slate-700">{project.assigned_by}</span>
                        </div>
                      </div>

                      {/* Review Feedback Note */}
                      {project.review_note && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                          <strong className="font-semibold">
                            {project.returned_by
                              ? `Revision Instructions${project.returned_by ? ` (${project.returned_by})` : ''}`
                              : `Reviewer Feedback${project.accepted_by ? ` (${project.accepted_by})` : ''}`}:{' '}
                          </strong>
                          {project.review_note}
                        </div>
                      )}

                      {/* Developer Actions (Buttons) */}
                      {!isComplete && canUpdateMyProjects && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          {isUnderReview ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              <Clock className="w-3.5 h-3.5" />
                              Deliverable Submitted — Awaiting Review
                            </span>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={Sliders}
                                onClick={() => {
                                  setSelectedProject(project);
                                  setProgressVal(project.progress_percent);
                                  setShowProgressModal(true);
                                }}
                              >
                                Update Progress
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                icon={Calendar}
                                disabled={hasPendingExtension}
                                onClick={() => {
                                  setSelectedProject(project);
                                  setShowExtensionModal(true);
                                }}
                              >
                                Request Extension
                              </Button>

                              <Button
                                size="sm"
                                variant="primary"
                                icon={Send}
                                onClick={() => {
                                  setSelectedProject(project);
                                  setShowSubmitModal(true);
                                }}
                              >
                                Submit Completion
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                <FolderGit2 className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                No projects are currently assigned to you.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Attendance & Leaves Snapshot */}
        <div className="space-y-6">
          {/* Today's Punch Status */}
          <Card title="Today's Web Attendance" subtitle="Web Punch Clock">
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-center">
                <p className="text-slate-500 font-medium">Status for {today}</p>
                <div className="my-2">
                  {myPunch ? (
                    <span className="text-lg font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      {myPunch.status} ({myPunch.punch_in})
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-slate-400">Not Punched In</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {myPunch?.punch_out ? `Punched out at ${myPunch.punch_out}` : myPunch ? `Punched in via ${myPunch.location}` : "Click below to clock in for today's work shift"}
                </p>
              </div>

              <Button
                variant={isPunchComplete ? "secondary" : hasPunchedIn ? "danger" : "primary"}
                className="w-full"
                disabled={!isViewingOwnWorkspace || !workspaceEmployeeId || isPunchComplete}
                onClick={handleDeveloperPunch}
              >
                {isPunchComplete ? "Punch Completed" : hasPunchedIn ? "Punch Out Now" : "Punch In Now"}
              </Button>
            </div>
          </Card>

          {/* Leave Balances */}
          <Card
            title="Leave Balances"
            subtitle="Accrued Leave Balance"
            action={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openMyLeave}
                  className="text-xs text-teal-600 font-semibold hover:underline"
                >
                  {myLeaveRequests.length ? `${myLeaveRequests.length} leave request(s)` : 'My Leave'}
                </button>
                <button
                  type="button"
                  disabled={!isViewingOwnWorkspace || !workspaceEmployeeId}
                  onClick={() => setShowLeaveModal(true)}
                  className="text-xs text-teal-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Apply
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-500 font-medium">Casual Leave (CL)</span>
                <p className="text-xl font-bold text-slate-800 mt-1">{myBalance.cl} Days</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-500 font-medium">Sick Leave (SL)</span>
                <p className="text-xl font-bold text-slate-800 mt-1">{myBalance.sl} Days</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-500 font-medium">Privilege Leave (PL)</span>
                <p className="text-xl font-bold text-slate-800 mt-1">{myBalance.pl} Days</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-slate-500 font-medium">Comp-Off</span>
                <p className="text-xl font-bold text-slate-800 mt-1">{myBalance.comp_off} Days</p>
              </div>
            </div>
          </Card>

          {/* India Statutory & Tax Summary for Employee */}
          <Card title="Statutory & Tax Info" subtitle="Masked statutory details">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">PAN Number</span>
                <span className="font-mono font-semibold text-slate-800">{workspaceUser.pan || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">EPF UAN</span>
                <span className="font-mono font-semibold text-slate-800">{workspaceUser.uan || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tax Regime</span>
                <span className="font-semibold text-teal-600">{workspaceUser.tax_regime ? `${workspaceUser.tax_regime} Regime` : '—'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Salary Bank</span>
                <span className="font-semibold text-slate-800">{workspaceUser.bank_name || '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL 1: Update Progress */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="Update Project Progress"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>Progress Percentage:</span>
              <span className="text-teal-600 font-bold text-sm">{progressVal}%</span>
            </div>
            <input
              type="range"
              min={selectedProject ? (selectedProject.progress_percent || 0) : 0}
              max="100"
              step="5"
              value={progressVal}
              onChange={(e) => setProgressVal(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>Current Baseline: {selectedProject?.progress_percent || 0}%</span>
              <span>Target Deliverable: 100%</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Progress Notes / Changelog:</label>
            <textarea
              required
              rows="4"
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Detail what was built, modules tested, blockers resolved..."
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowProgressModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Progress Update</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showMyLeaveRequests}
        onClose={() => setShowMyLeaveRequests(false)}
        title="My Leave Requests"
        subtitle="Your personal leave history"
      >
        {myLeaveRequests.length ? (
          <div className="space-y-3">
            {myLeaveRequests.map((leave) => (
              <article key={leave.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{leave.leave_type}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {leave.from_date} to {leave.to_date} · {leave.days} day(s)
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700">
                    {leave.status}
                  </span>
                </div>
                {leave.reason && <p className="mt-2 text-xs text-slate-600">{leave.reason}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">You have no leave requests yet.</p>
        )}
      </Modal>

      {/* MODAL 2: Request Extension */}
      <Modal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        title="Request Deadline Extension"
        subtitle={selectedProject ? `Current Active Deadline: ${selectedProject.active_due_date}` : ""}
      >
        <form onSubmit={handleExtensionSubmit} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <p className="font-semibold">Company Delivery Policy:</p>
            <p className="text-[11px] mt-0.5">
              Original planned due date is immutable in history. If approved by HR/Manager, the active deadline is updated without penalty.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Proposed New Due Date:</label>
            <input
              type="date"
              required
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Extension Request:</label>
            <textarea
              required
              rows="4"
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              placeholder="Explain technical impediments, third-party API dependencies, scope expansions..."
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowExtensionModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Extension Request</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Submit Project Completion */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Project Completion for Review"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleSubmitCompletion} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deliverable Link / Git Repository PR:</label>
            <input
              type="text"
              value={submissionDeliverable}
              onChange={(e) => setSubmissionDeliverable(e.target.value)}
              placeholder="e.g. https://github.com/company/repo/pull/42 or staging URL"
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Final Submission Notes for HR Reviewer:</label>
            <textarea
              required
              rows="4"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              placeholder="Highlight deliverable acceptance criteria met, test coverage, and documentation..."
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit For Final Review</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Apply Leave */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Apply for Leave"
        subtitle="Accrued Leave Policy"
      >
        <form onSubmit={handleApplyLeaveSubmit} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Leave Type:</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Casual Leave (CL)">Casual Leave (CL) - {myBalance.cl} available</option>
              <option value="Sick Leave (SL)">Sick Leave (SL) - {myBalance.sl} available</option>
              <option value="Privilege Leave (PL)">Privilege Leave (PL) - {myBalance.pl} available</option>
              <option value="Comp-Off">Comp-Off - {myBalance.comp_off} available</option>
              <option value="Leave Without Pay (LOP)">Leave Without Pay (LOP) - unpaid</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">From Date:</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">To Date:</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(event) => setIsHalfDay(event.target.checked)}
              />
              Request half-day leave
            </label>
            {isHalfDay && (
              <label className="mt-3 block font-semibold text-slate-700">
                Half-day period
                <select
                  value={halfDayPeriod}
                  onChange={(event) => setHalfDayPeriod(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                >
                  <option value="first_half">First half</option>
                  <option value="second_half">Second half</option>
                </select>
              </label>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Days are calculated from working days, applicable holidays, and the sandwich rule.
            </p>
          </div>

          <label className="block font-semibold text-slate-700">
            Medical certificate (required for sick leave over 2 days)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) {
                  setSickCertificateFile(null);
                  return;
                }
                const extension = file.name.split('.').pop()?.toLowerCase();
                if (file.size > 10 * 1024 * 1024 || !['pdf', 'jpg', 'jpeg', 'png'].includes(extension)) {
                  setWorkflowError('Choose a PDF, JPG, or PNG certificate up to 10 MB.');
                  event.target.value = '';
                  setSickCertificateFile(null);
                  return;
                }
                setWorkflowError('');
                setSickCertificateFile(file);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              PDF/JPG/PNG only; maximum 10 MB. The uploaded file is private.
            </span>
          </label>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Leave:</label>
            <textarea
              required
              rows="3"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="Reason for leave and emergency contact if applicable..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Leave Application</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
