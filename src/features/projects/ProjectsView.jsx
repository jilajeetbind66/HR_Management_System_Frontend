import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import CloudinaryUpload from '../../components/common/CloudinaryUpload';
import api from '../../services/api';
import {
  FolderGit2,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Sliders,
  Send,
  UserCheck,
  FileText,
  History,
  Info,
  CalendarClock,
  Building2
} from 'lucide-react';

const PROJECT_PRIORITY_PRESENTATION = {
  low: { label: 'Low Priority', variant: 'neutral' },
  medium: { label: 'Medium Priority', variant: 'neutral' },
  high: { label: 'High Priority', variant: 'warning' },
  urgent: { label: 'Urgent Priority', variant: 'danger' },
};
const PROJECT_TYPES = ['Feature', 'Bug Fix', 'Integration', 'Report', 'Migration', 'Support'];

const nextDate = (date) => {
  if (!date) return '';
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const extensionStatusClass = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

const formatRoleLabel = (role) => role
  ? role.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  : '';

const isDateSunday = (dateStr) => {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDay() === 0;
};

const getNextMonday = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const daysToAdd = day === 0 ? 1 : (8 - day);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().substring(0, 10);
};

export const calculateProjectWorkingDays = (startDateStr, endDateStr, isEmergency = false) => {
  if (!startDateStr || !endDateStr || endDateStr < startDateStr) return null;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let calendarDays = 0;
  let sundaysCount = 0;
  const curr = new Date(start);

  while (curr <= end) {
    calendarDays++;
    if (curr.getDay() === 0) {
      sundaysCount++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const workingDays = isEmergency ? calendarDays : Math.max(1, calendarDays - sundaysCount);

  return {
    calendarDays,
    workingDays,
    sundaysCount,
    isEmergency,
  };
};

const validateProjectDates = (
  { start_date, planned_end_date, is_weekend_emergency, emergency_reason },
  showRequiredErrors = false
) => {
  const errors = {};
  if (showRequiredErrors && !start_date) errors.start_date = 'Start Date is required.';
  if (showRequiredErrors && !planned_end_date) {
    errors.planned_end_date = 'Planned Baseline End Date is required.';
  } else if (start_date && planned_end_date && planned_end_date < start_date) {
    errors.planned_end_date = 'Planned Baseline End Date must be on or after Start Date.';
  }

  if (!is_weekend_emergency) {
    if (isDateSunday(start_date)) {
      errors.start_date = 'Start Date is on a Sunday (Weekly Off). Shift to Monday or enable Emergency Weekend Assignment.';
    }
    if (isDateSunday(planned_end_date)) {
      errors.planned_end_date = 'Deadline cannot be on a Sunday (Weekly Off). Shift to Friday/Monday or enable Emergency Weekend Assignment.';
    }
  } else if (showRequiredErrors && !emergency_reason?.trim()) {
    errors.emergency_reason = 'An emergency reason/justification is required for weekend assignments.';
  }

  return errors;
};

export default function ProjectsView() {
  const { currentUser, hasPermission, activeBranch } = useAuth();
  const {
    projects,
    employees,
    penaltyPolicy,
    createProject,
    updateProjectProgress,
    requestExtension,
    reviewExtension,
    submitProjectCompletion,
    reviewProjectCompletion,
    assessPenalty,
    waivePenalty
  } = useHRMS();

  const isBranchScoped = Boolean(activeBranch && activeBranch !== 'All Branches');

  const branchProjects = React.useMemo(() => {
    if (!isBranchScoped) return projects;
    return projects.filter((p) => {
      const emp = employees.find((e) => Number(e.id) === Number(p.assigned_employee_id));
      const branchName = emp?.branch_name || p.assigned_employee_branch_name;
      if (!branchName) return false;
      return (
        branchName === activeBranch ||
        (activeBranch.includes('Prayagraj') && branchName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && branchName.includes('Kaushambi'))
      );
    });
  }, [projects, employees, activeBranch, isBranchScoped]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'extensions' | 'policy'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressVal, setProgressVal] = useState(50);
  const [progressNote, setProgressNote] = useState('');

  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [requestedDate, setRequestedDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionRequestError, setExtensionRequestError] = useState('');

  const [showReviewExtModal, setShowReviewExtModal] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [extDecisionNote, setExtDecisionNote] = useState('');
  const [extensionReviewError, setExtensionReviewError] = useState('');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionDeliverable, setSubmissionDeliverable] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');

  const [showReviewCompletionModal, setShowReviewCompletionModal] = useState(false);
  const [completionReviewNote, setCompletionReviewNote] = useState('');
  const [deliverableUploads, setDeliverableUploads] = useState([]);
  const [deliverableUploadError, setDeliverableUploadError] = useState('');
  const [deliverableUploadRefresh, setDeliverableUploadRefresh] = useState(0);

  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyReason, setPenaltyReason] = useState('');

  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [waiverReason, setWaiverReason] = useState('');

  const [submittingProject, setSubmittingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState(null);
  const [projectFieldErrors, setProjectFieldErrors] = useState({});
  const [projectSuccessToast, setProjectSuccessToast] = useState(null);

  // Create Project Form
  const initialProjectState = {
    name: '',
    description: '',
    deliverable: '',
    project_type: '',
    assigned_employee_id: '',
    priority: 'Medium',
    start_date: new Date().toISOString().substring(0, 10),
    planned_end_date: '',
    is_weekend_emergency: false,
    emergency_reason: '',
    weekend_benefit_type: 'comp_off',
    weekend_benefit_amount: '',
  };

  const [newProject, setNewProject] = useState(initialProjectState);

  const canManageProjects = hasPermission('projects.manage');
  const canCreateProjects = hasPermission('projects.create');
  const activeEmployees = employees.filter(
    (employee) => employee.status?.toLowerCase() === 'active' && !employee.deleted_at
  );
  const canUpdateProject = (project) => Boolean(project?.assignment_id) && Boolean(
    currentUser?.employee_id
    && Number(project.assigned_employee_id) === Number(currentUser.employee_id)
  );
  const canReviewProject = (project) => Boolean(project?.assignment_id) && (
    ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role)
    || (
      currentUser?.role === 'manager'
      && Number(project.assigned_employee_reporting_manager_id) === Number(currentUser.employee_id)
    )
  );
  const canRecordPenaltyReview = ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role);
  const canWaivePenaltyReview = ['super_admin', 'manager'].includes(currentUser?.role);

  useEffect(() => {
    if (!selectedProject?.assignment_id) {
      setDeliverableUploads([]);
      return;
    }

    api.getUploads('project_deliverables', selectedProject.assignment_id)
      .then((response) => setDeliverableUploads(response?.data || []))
      .catch((error) => setDeliverableUploadError(error?.data?.message || error.message || 'Unable to load project files.'));
  }, [selectedProject?.assignment_id, deliverableUploadRefresh]);

  const openProjectFile = async (uploadId) => {
    const newWindow = window.open('about:blank', '_blank');
    try {
      const response = await api.getUploadDownload(uploadId);
      if (newWindow) newWindow.location.href = response.data.url;
    } catch (error) {
      newWindow?.close();
      setDeliverableUploadError(error?.data?.message || error.message || 'Unable to open project file.');
    }
  };

  // Filter projects
  const filteredProjects = branchProjects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.project_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.assigned_employee_name || '')?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType = projectTypeFilter === 'all' || p.project_type === projectTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate high-level stats
  const totalProjects = branchProjects.length;
  const inProgressCount = branchProjects.filter(p => p.status === 'in_progress').length;
  const underReviewCount = branchProjects.filter(p => p.status === 'under_review').length;
  const overdueCount = branchProjects.filter(p => p.is_overdue || p.status === 'overdue').length;
  const completedCount = branchProjects.filter(p => p.status === 'completed').length;

  const allExtensionRequests = branchProjects.flatMap(p =>
    (p.extensions || [])
      .map(e => ({
        ...e,
        projectId: p.id,
        projectCode: p.project_code,
        projectName: p.name,
        canReview: canReviewProject(p),
      }))
  );
  const allPendingExtensions = allExtensionRequests.filter(extension => extension.status === 'pending');
  const extensionStatusCounts = allExtensionRequests.reduce((counts, extension) => {
    counts[extension.status] = (counts[extension.status] || 0) + 1;
    return counts;
  }, {});

  // Form Handlers
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const dateErrors = validateProjectDates(newProject, true);
    setProjectFieldErrors(dateErrors);
    if (Object.keys(dateErrors).length > 0) return;

    if (!newProject.name || !newProject.assigned_employee_id || !newProject.project_type || !newProject.planned_end_date) {
      setProjectFormError('Select an active developer and project type, then complete the required project fields.');
      return;
    }
    setProjectFormError(null);
    setSubmittingProject(true);

    try {
      const saved = await createProject(
        {
          ...newProject,
          assigned_employee_id: Number(newProject.assigned_employee_id),
          is_weekend_emergency: Boolean(newProject.is_weekend_emergency),
          emergency_reason: newProject.is_weekend_emergency ? newProject.emergency_reason.trim() : null,
          weekend_benefit_type: newProject.is_weekend_emergency ? newProject.weekend_benefit_type : null,
          weekend_benefit_amount: newProject.is_weekend_emergency && newProject.weekend_benefit_type === 'allowance'
            ? Number(newProject.weekend_benefit_amount)
            : null,
        },
        `${currentUser.first_name} ${currentUser.last_name} (${currentUser.role})`
      );

      const successPrefix = newProject.is_weekend_emergency ? '🚨 Emergency Weekend Project' : 'Project';
      setProjectSuccessToast(`${successPrefix} ${saved?.project_code || ''} (${newProject.name}) created & assigned successfully!`);
      setTimeout(() => setProjectSuccessToast(null), 4000);
      setShowCreateModal(false);
      setNewProject(initialProjectState);
      setProjectFieldErrors({});
    } catch (err) {
      console.error("Project create error:", err);
      const backendErrors = err?.data?.errors || {};
      setProjectFieldErrors({
        ...validateProjectDates(newProject, true),
        ...(backendErrors.start_date ? { start_date: backendErrors.start_date[0] } : {}),
        ...(backendErrors.planned_end_date ? { planned_end_date: backendErrors.planned_end_date[0] } : {}),
        ...(backendErrors.emergency_reason ? { emergency_reason: backendErrors.emergency_reason[0] } : {}),
      });
      const msg = err?.data?.message || err.message || "Failed to save project to database. Ensure Laravel server is running.";
      setProjectFormError(msg);
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleUpdateProgressSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (Number(progressVal) < Number(selectedProject.progress_percent || 0)) {
      setProjectFormError(`Progress cannot be reduced from ${selectedProject.progress_percent}% to ${progressVal}%. Milestone progress can only advance forward.`);
      return;
    }
    setProjectFormError(null);
    try {
      await updateProjectProgress(selectedProject.id, Number(progressVal), progressNote);
      setShowProgressModal(false);
      setProgressNote('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to save project progress.');
    }
  };

  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject || !requestedDate || !extensionReason) return;
    setExtensionRequestError('');
    try {
      await requestExtension(selectedProject.id, requestedDate, extensionReason);
      setShowExtensionModal(false);
      setRequestedDate('');
      setExtensionReason('');
      setExtensionRequestError('');
    } catch (error) {
      const validationMessage = Object.values(error?.data?.errors || {}).flat()[0];
      setExtensionRequestError(validationMessage || error?.data?.message || error.message || 'Unable to save the extension request.');
    }
  };

  const handleReviewExtension = async (decision) => {
    if (!selectedProject || !selectedExtension) return;
    if (decision === 'rejected' && !extDecisionNote.trim()) {
      setExtensionReviewError('Decision remarks are required when rejecting an extension request.');
      return;
    }
    setExtensionReviewError('');
    setProjectFormError(null);
    try {
      await reviewExtension(selectedProject.id, selectedExtension.id, decision, extDecisionNote);
      setShowReviewExtModal(false);
      setExtDecisionNote('');
      setExtensionReviewError('');
    } catch (error) {
      const validationMessage = Object.values(error?.data?.errors || {}).flat()[0];
      setExtensionReviewError(validationMessage || error?.data?.message || error.message || 'Unable to review the extension request.');
    }
  };

  const handleSubmitCompletion = async (e) => {
    e.preventDefault();
    if (!selectedProject || !submissionNote) return;
    setProjectFormError(null);
    try {
      await submitProjectCompletion(selectedProject.id, submissionNote, submissionDeliverable);
      setShowSubmitModal(false);
      setSubmissionNote('');
      setSubmissionDeliverable('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to submit project completion.');
    }
  };

  const handleReviewCompletion = async (decision) => {
    // decision: 'accept' | 'return'
    if (!selectedProject) return;
    setProjectFormError(null);
    try {
      await reviewProjectCompletion(selectedProject.id, decision, completionReviewNote);
      setShowReviewCompletionModal(false);
      setCompletionReviewNote('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to review project completion.');
    }
  };

  const handleAssessPenalty = async (e) => {
    e.preventDefault();
    if (!selectedProject || !penaltyReason) return;
    setProjectFormError(null);
    try {
      await assessPenalty(selectedProject.id, {
        penalty_type: 'non_monetary',
        reason: penaltyReason,
        amount: null
      });
      setShowPenaltyModal(false);
      setPenaltyReason('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to save the project penalty.');
    }
  };

  const handleWaivePenalty = async (e) => {
    e.preventDefault();
    if (!selectedProject || !selectedPenalty || !waiverReason) return;
    setProjectFormError(null);
    try {
      await waivePenalty(selectedProject.id, selectedPenalty.id, waiverReason);
      setShowWaiveModal(false);
      setWaiverReason('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to waive the project penalty.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Workforce Operations
            </span>
            <span className="text-xs text-slate-500 font-medium">Delivery & Deadline Management</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Project Assignment & Deadline Controls</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single developer assignment, progress updates, approval loops, immutable baseline deadlines, and lawful penalty safeguards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canCreateProjects && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => {
                setProjectFormError(null);
                setProjectFieldErrors({});
                setShowCreateModal(true);
              }}
            >
              Assign New Project
            </Button>
          )}
        </div>
      </div>

      {projectFormError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {projectFormError}
        </div>
      )}

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Total Projects" value={totalProjects} color="indigo" />
        <StatCard title="In Progress" value={inProgressCount} color="blue" />
        <StatCard title="Under Review" value={underReviewCount} color="purple" badge="Needs HR Action" />
        <StatCard
          title="Overdue"
          value={overdueCount}
          color={overdueCount > 0 ? "rose" : "emerald"}
          badge={overdueCount > 0 ? "Immediate Attention" : "All on Track"}
        />
        <StatCard title="Completed" value={completedCount} color="emerald" />
      </div>

      {/* Sub-Tabs: List View vs Extension History vs Policy Safeguards */}
      <div className="border-b border-slate-200 flex items-center justify-between overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'list' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Assigned Projects ({branchProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'extensions' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Extension Requests
            {allPendingExtensions.length > 0 && (
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {allPendingExtensions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'policy' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Penalty Policy & India Legal Safeguards
          </button>
        </div>

        {isBranchScoped && (
          <div className="pb-2 hidden sm:flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Branch: {activeBranch}</span>
          </div>
        )}
      </div>

      {/* TAB 1: ALL PROJECTS LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by project name, PRJ code, or developer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
              <span className="text-xs text-slate-500 font-medium">Type:</span>
              <select
                aria-label="Filter by project type"
                value={projectTypeFilter}
                onChange={(e) => setProjectTypeFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                {PROJECT_TYPES.map((projectType) => (
                  <option key={projectType} value={projectType}>{projectType}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Cards */}
          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
              <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                {projects.length === 0
                  ? 'No projects have been assigned yet.'
                  : 'No projects match your current search and status filters.'}
              </div>
            ) : filteredProjects.map((project) => {
              const isOverdue = Boolean(project.is_overdue || project.status === 'overdue');
              const isUnderReview = project.status === 'under_review' || project.assignment_status === 'under_review';
              const isCompleted = project.status === 'completed';
              const isAssignedDeveloper = canUpdateProject(project);
              const priorityPresentation = PROJECT_PRIORITY_PRESENTATION[String(project.priority || '').toLowerCase()]
                || { label: `${project.priority || 'Unknown'} Priority`, variant: 'neutral' };

              const hasPendingExtension = project.extensions?.some(e => e.status === 'pending');
              const activeExtension = project.extensions?.find(e => e.status === 'pending');
              const projectExtensionCounts = (project.extensions || []).reduce((counts, extension) => {
                counts[extension.status] = (counts[extension.status] || 0) + 1;
                return counts;
              }, {});

              return (
                <div
                  key={project.id}
                  className={`bg-white rounded-xl border p-5 shadow-sm transition hover:shadow-md ${
                    isOverdue ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'
                  }`}
                >
                  {/* Top Row: Code, Name, Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                          {project.project_code}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{project.name}</h3>
                        <Badge variant={priorityPresentation.variant} size="sm">
                          {priorityPresentation.label}
                        </Badge>
                        {project.project_type && (
                          <Badge variant="neutral" size="sm">{project.project_type}</Badge>
                        )}
                        {Boolean(project.is_weekend_emergency) && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            🚨 Weekend Emergency
                          </span>
                        )}
                        {Boolean(project.is_weekend_emergency) && project.weekend_benefit_type === 'comp_off' && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            project.benefit_credited_at
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {project.benefit_credited_at ? '✓ +1 Comp-Off Credited' : '🎁 +1 Comp-Off on Delivery'}
                          </span>
                        )}
                        {Boolean(project.is_weekend_emergency) && project.weekend_benefit_type === 'allowance' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            💰 Allowance ₹{project.weekend_benefit_amount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">{project.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isOverdue && (
                        <Badge variant="danger" size="md">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Overdue ({project.overdue_days} Days)
                        </Badge>
                      )}
                      {isUnderReview && (
                        <Badge variant="warning" size="md">
                          <Clock className="w-3.5 h-3.5" /> Under HR Review
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="success" size="md">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed & Accepted
                        </Badge>
                      )}
                      {!isOverdue && !isUnderReview && !isCompleted && (
                        <Badge variant="primary" size="md">In Progress</Badge>
                      )}
                    </div>
                  </div>

                  {/* Deliverable Box */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-50/90 border border-slate-200/80 text-xs">
                    <span className="font-semibold text-slate-800">Target Deliverable: </span>
                    <span className="whitespace-pre-line text-slate-600">{project.deliverable}</span>
                    {project.submission_note && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-slate-700">
                        <span className="font-semibold text-teal-700">Developer Submission Note: </span>
                        <span className="whitespace-pre-line">"{project.submission_note}"</span>
                      </div>
                    )}
                    {project.review_note && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-slate-700">
                        <span className="font-semibold text-emerald-700">Review Notes{project.accepted_by ? ` (${project.accepted_by})` : ''}: </span>
                        <span className="whitespace-pre-line">"{project.review_note}"</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar & Slider */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        Progress Update (v{project.version || 1})
                      </span>
                      <span className="font-bold text-teal-600">{project.progress_percent}% Complete</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-teal-600'
                        }`}
                        style={{ width: `${project.progress_percent}%` }}
                      />
                    </div>
                  </div>
                  {project.updates?.length > 0 && (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Progress history ({project.updates.length})
                      </summary>
                      <ol className="mt-2 space-y-2">
                        {[...project.updates].reverse().map((update) => (
                          <li key={update.id} className="border-t border-slate-100 pt-2">
                            <p className="font-medium text-slate-800">
                              {update.progress_percent}% — {update.note}
                            </p>
                            <p className="mt-1 text-slate-500">
                              Updated by <strong className="text-slate-700">{update.updated_by}</strong>
                              {update.created_at && ` · ${new Date(update.created_at).toLocaleString()}`}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {project.extensions?.length > 0 && (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-slate-700">
                        Extension history ({project.extensions.length})
                      </summary>
                      <ol className="mt-2 space-y-2">
                        {project.extensions.map((extension) => (
                          <li key={extension.id} className="border-t border-slate-100 pt-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${extensionStatusClass[extension.status] || 'bg-slate-100 text-slate-700'}`}>
                                {extension.status}
                              </span>
                              <span className="text-slate-600">
                                {extension.old_due_date} → {extension.requested_due_date}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600">{extension.reason}</p>
                            {extension.decision_note && (
                              <p className="mt-1 text-slate-600">
                                Decision remarks: {extension.decision_note}
                              </p>
                            )}
                            {extension.decided_by && (
                              <p className="mt-1 text-slate-500">
                                Decided by <strong className="text-slate-700">{extension.decided_by}</strong>
                                {extension.decided_at && ` · ${new Date(extension.decided_at).toLocaleString()}`}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  {/* Metadata Grid (Section 9 Specs) */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 text-xs border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Developer</span>
                      <div className="flex items-center gap-2 mt-1">
                        <img src={project.assigned_employee_avatar} alt="" className="w-6 h-6 rounded-full object-cover border" />
                        <div>
                          <p className="font-semibold text-slate-800 leading-tight">{project.assigned_employee_name}</p>
                          <p className="text-[10px] text-slate-400">{project.assigned_employee_code}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Start Date</span>
                      <span className="font-semibold text-slate-800 block mt-1">{project.start_date}</span>
                      <span className="text-[10px] text-slate-400">
                        Assigned by {project.assigned_by || 'Unknown'}
                        {project.assigned_by_role && ` (${formatRoleLabel(project.assigned_by_role)})`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Baseline Date</span>
                      <span className="font-semibold text-slate-800 block mt-1">{project.planned_end_date}</span>
                      <span className="text-[10px] text-slate-400 italic">Immutable baseline</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Deadline</span>
                      <span className={`font-bold block mt-1 ${isOverdue ? "text-rose-600" : "text-teal-600"}`}>
                        {project.active_due_date}
                      </span>
                      {project.actual_completed_at && (
                        <span className="text-[10px] text-emerald-600 block">Accepted on {project.actual_completed_at.substring(0, 10)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Working Days Effort</span>
                      <span className="font-bold text-teal-800 block mt-1">
                        {calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency))?.workingDays ?? '—'} Working Days
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency))?.sundaysCount > 0
                          ? `Excludes ${calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency)).sundaysCount} Sun off`
                          : (project.is_weekend_emergency ? 'Emergency Weekend' : 'Full schedule')}
                      </span>
                    </div>
                  </div>

                  {/* Pending Extension Notice if any */}
                  {hasPendingExtension && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                      <div>
                        <span className="font-bold flex items-center gap-1.5 text-amber-800">
                          <CalendarClock className="w-4 h-4 text-amber-600" />
                          Extension Requested to {activeExtension.requested_due_date}
                        </span>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Requested by <strong>{activeExtension.requested_by}</strong>
                          {activeExtension.on_behalf_of && (
                            <> · Submitted on behalf by <strong>{activeExtension.on_behalf_of}</strong></>
                          )}
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">"{activeExtension.reason}"</p>
                      </div>
                      {canReviewProject(project) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedProject(project);
                            setSelectedExtension(activeExtension);
                            setExtDecisionNote('');
                            setExtensionReviewError('');
                            setShowReviewExtModal(true);
                          }}
                        >
                          Review Request
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Penalties Notice if any */}
                  {project.penalties && project.penalties.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5 text-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Assessed Penalty Record (Non-Monetary Baseline)
                        </span>
                        {canWaivePenaltyReview && canReviewProject(project) && project.penalties[0].status !== 'waived' && Number(project.assigned_employee_id) !== Number(currentUser?.employee_id) && (
                          <button
                            onClick={() => {
                              setSelectedProject(project);
                              setSelectedPenalty(project.penalties[0]);
                              setShowWaiveModal(true);
                            }}
                            className="text-xs text-teal-700 font-bold hover:underline"
                          >
                            Waive Penalty
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-800">
                        <span>Reason: {project.penalties[0].reason}</span>
                        <span>Status: <strong className="uppercase font-bold">{project.penalties[0].status}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>{project.updates?.length || 0} Progress Log(s)</span>
                      <span>•</span>
                      <span>
                        Extensions: {projectExtensionCounts.pending || 0} pending · {projectExtensionCounts.approved || 0} approved · {projectExtensionCounts.rejected || 0} rejected
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Developer Buttons */}
                      {isAssignedDeveloper && !isCompleted && (
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
                              setRequestedDate(nextDate(project.active_due_date || project.planned_end_date));
                              setExtensionReason('');
                              setExtensionRequestError('');
                              setShowExtensionModal(true);
                            }}
                          >
                            Request Extension
                          </Button>

                          {!isUnderReview && (
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
                          )}
                        </>
                      )}

                      {/* HR / Reviewer Buttons */}
                      {hasPendingExtension && canReviewProject(project) && (
                        <Button
                          size="sm"
                          variant="warning"
                          icon={Calendar}
                          onClick={() => {
                            const ext = activeExtension || (project.extensions || []).find(e => e.status === 'pending');
                            setSelectedProject(project);
                            setSelectedExtension(ext);
                            setExtDecisionNote('');
                            setExtensionReviewError('');
                            setShowReviewExtModal(true);
                          }}
                        >
                          Review Extension
                        </Button>
                      )}

                      {canReviewProject(project) && isUnderReview && (
                        <Button
                          size="sm"
                          variant="success"
                          icon={UserCheck}
                          onClick={() => {
                            setSelectedProject(project);
                            setShowReviewCompletionModal(true);
                          }}
                        >
                          Review Completion
                        </Button>
                      )}

                      {/* HR Non-Monetary Penalty Assessment */}
                      {canRecordPenaltyReview && canReviewProject(project) && isOverdue && (!project.penalties || project.penalties.length === 0) && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={ShieldAlert}
                          onClick={() => {
                            setSelectedProject(project);
                            setShowPenaltyModal(true);
                          }}
                        >
                          Assess Penalty
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: EXTENSIONS REVIEW LIST */}
      {activeTab === 'extensions' && (
        <Card
          title="Deadline Extension History"
          subtitle={`${allPendingExtensions.length} pending · ${extensionStatusCounts.approved || 0} approved · ${extensionStatusCounts.rejected || 0} rejected`}
        >
          {allExtensionRequests.length > 0 ? (
            <div className="space-y-4">
              {allExtensionRequests.map((ext) => (
                <div key={ext.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {ext.projectCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{ext.projectName}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${extensionStatusClass[ext.status] || 'bg-slate-100 text-slate-700'}`}>
                        {ext.status}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Requested by <strong className="text-slate-800">{ext.requested_by}</strong>
                      {ext.created_at && ` on ${new Date(ext.created_at).toLocaleString()}`}
                      {ext.on_behalf_of && (
                        <> · Submitted on behalf by <strong className="text-slate-800">{ext.on_behalf_of}</strong></>
                      )}
                    </p>
                    <p className="text-slate-700 mt-2 p-2.5 rounded-lg bg-white border border-slate-200/80 italic">
                      "{ext.reason}"
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                      <span>Active deadline at request: <strong className="text-slate-800">{ext.old_due_date}</strong></span>
                      <span>Proposed New Due: <strong className="text-teal-600">{ext.requested_due_date}</strong></span>
                    </div>
                    {ext.decision_note && (
                      <p className="mt-2 text-slate-600">Decision remarks: {ext.decision_note}</p>
                    )}
                    {ext.decided_by && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Decided by <strong className="text-slate-700">{ext.decided_by}</strong>
                        {ext.decided_at && ` · ${new Date(ext.decided_at).toLocaleString()}`}
                      </p>
                    )}
                  </div>

                  {ext.status === 'pending' && ext.canReview && (
                    <div className="flex sm:flex-col gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => {
                          const targetProj = projects.find(p => p.id === ext.projectId);
                          setSelectedProject(targetProj);
                          setSelectedExtension(ext);
                          setExtDecisionNote('');
                          setExtensionReviewError('');
                          setShowReviewExtModal(true);
                        }}
                      >
                        Approve / Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              No extension requests have been submitted.
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: PENALTY POLICY & LEGAL SAFEGUARDS */}
      {activeTab === 'policy' && (
        <div className="space-y-6">
          <Card title="Indian Labor Law Compliance & Penalty Safeguards" subtitle="Architecture Section 9 Mandatory Controls">
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">Non-Monetary Default Safeguard Active</h4>
                  <p className="text-emerald-800 text-xs mt-1">
                    Automated salary deductions for project delays are <strong>strictly disabled</strong>. Only HR or super-admin can record a non-monetary notice after reviewing the documented reason; every record is attributed to the reviewer and audit-logged. Managers cannot apply a penalty independently.
                  </p>
                </div>
              </div>

              {!penaltyPolicy && (
                <p role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  No active penalty policy is configured. Grace-period settings are unavailable.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-800 text-sm block">Grace Period</span>
                  <p className="text-2xl font-black text-teal-600 mt-1">
                    {penaltyPolicy ? `${penaltyPolicy.grace_days} Days` : 'Not Configured'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {penaltyPolicy
                      ? 'No penalty or overdue flags trigger during configured grace days.'
                      : 'Configure an active policy to define the grace period.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-800 text-sm block">Monetary Deductions</span>
                  <p className="text-2xl font-black text-rose-600 mt-1">DISABLED</p>
                  <p className="text-[11px] text-slate-500 mt-1">Any monetary change is disabled here; this workflow records only HR-reviewed non-monetary notices.</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-800 text-sm block">Excused Conditions</span>
                  <p className="text-xs font-semibold text-slate-700 mt-2">
                    • Approved Extension<br/>
                    • HR / Client Blocker<br/>
                    • Force Majeure
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* MODAL 1: Create / Assign Project */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { if (!submittingProject) { setShowCreateModal(false); setProjectFormError(null); } }}
        title="Assign Project to Developer"
        subtitle="Specify project deliverable, single developer ownership, and baseline planned deadline"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {projectFormError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-bold">⚠️ Error:</span>
              <span>{projectFormError}</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Project Name:</label>
            <input
              type="text"
              required
              placeholder="e.g. UPI QR Payment Processing API"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description:</label>
            <textarea
              required
              rows="2"
              placeholder="Detailed description of features, technical stack..."
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Deliverable & Acceptance Criteria:</label>
            <textarea
              required
              rows="2"
              placeholder="Exact deliverables required for HR / Manager sign-off..."
              value={newProject.deliverable}
              onChange={(e) => setNewProject({ ...newProject, deliverable: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assign Developer:</label>
              <select
                required
                value={newProject.assigned_employee_id}
                onChange={(e) => setNewProject({ ...newProject, assigned_employee_id: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Select developer</option>
                {activeEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.designation}
                  </option>
                ))}
              </select>
              {activeEmployees.length === 0 && (
                <p role="status" className="mt-1 text-xs text-amber-700">No active employees are available for assignment.</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority:</label>
              <select
                value={newProject.priority}
                onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Project Type:</label>
              <select
                required
                value={newProject.project_type}
                onChange={(e) => setNewProject({ ...newProject, project_type: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Select project type</option>
                {PROJECT_TYPES.map((projectType) => (
                  <option key={projectType} value={projectType}>{projectType}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date:</label>
              <input
                aria-describedby={projectFieldErrors.start_date ? 'project-start-date-error' : undefined}
                aria-invalid={Boolean(projectFieldErrors.start_date)}
                type="date"
                value={newProject.start_date}
                onBlur={() => setProjectFieldErrors(validateProjectDates(newProject, true))}
                onChange={(e) => {
                  const updatedProject = { ...newProject, start_date: e.target.value };
                  setNewProject(updatedProject);
                  setProjectFieldErrors(validateProjectDates(updatedProject));
                }}
                className={`w-full p-2 rounded-lg border ${projectFieldErrors.start_date ? 'border-rose-500' : 'border-slate-200'}`}
              />
              {projectFieldErrors.start_date && (
                <p id="project-start-date-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {projectFieldErrors.start_date}
                </p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Planned Baseline End Date:</label>
              <input
                aria-describedby={projectFieldErrors.planned_end_date ? 'project-end-date-error' : undefined}
                aria-invalid={Boolean(projectFieldErrors.planned_end_date)}
                type="date"
                min={newProject.start_date || undefined}
                value={newProject.planned_end_date}
                onBlur={() => setProjectFieldErrors(validateProjectDates(newProject, true))}
                onChange={(e) => {
                  const updatedProject = { ...newProject, planned_end_date: e.target.value };
                  setNewProject(updatedProject);
                  setProjectFieldErrors(validateProjectDates(updatedProject));
                }}
                className={`w-full p-2 rounded-lg border ${projectFieldErrors.planned_end_date ? 'border-rose-500' : 'border-slate-200'}`}
              />
              {projectFieldErrors.planned_end_date && (
                <p id="project-end-date-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {projectFieldErrors.planned_end_date}
                </p>
              )}
              <span className="text-[10px] text-slate-400 mt-0.5 block">This initial due date is immutable in history.</span>
            </div>
          </div>

          {/* Live Working Days Duration Counter */}
          {calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency) && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-3 text-xs text-teal-950 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-teal-600 p-1.5 text-white shadow-xs">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Allocated Working Days: <span className="text-teal-700 text-sm font-extrabold">{calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).workingDays} Working Day{calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).workingDays > 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Total Span: {calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).calendarDays} Calendar Days ({newProject.start_date} → {newProject.planned_end_date})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).sundaysCount > 0 && !newProject.is_weekend_emergency && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      ☕ {calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).sundaysCount} Sunday{calculateProjectWorkingDays(newProject.start_date, newProject.planned_end_date, newProject.is_weekend_emergency).sundaysCount > 1 ? 's' : ''} (Week Off) Excluded
                    </span>
                  )}
                  {newProject.is_weekend_emergency && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                      🚨 Includes Emergency Weekend Duty
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sunday / Non-Working Day Warning Banner */}
          {(isDateSunday(newProject.start_date) || isDateSunday(newProject.planned_end_date)) && !newProject.is_weekend_emergency && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="font-bold">
                    Sunday Detected (Company Weekly Off):
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {isDateSunday(newProject.start_date) && isDateSunday(newProject.planned_end_date)
                      ? 'Both Start Date and Deadline fall on a Sunday. Standard company practice is to schedule work across business days.'
                      : isDateSunday(newProject.start_date)
                      ? 'Start Date falls on a Sunday. Standard company policy is to schedule tasks starting on Monday.'
                      : 'Deadline falls on a Sunday. Setting deadlines on week-offs creates unfair overdue pressure on employees.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isDateSunday(newProject.start_date) && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMon = getNextMonday(newProject.start_date);
                          const updated = { ...newProject, start_date: nextMon };
                          setNewProject(updated);
                          setProjectFieldErrors(validateProjectDates(updated));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300 transition"
                      >
                        Shift Start to Monday ({getNextMonday(newProject.start_date)})
                      </button>
                    )}
                    {isDateSunday(newProject.planned_end_date) && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMon = getNextMonday(newProject.planned_end_date);
                          const updated = { ...newProject, planned_end_date: nextMon };
                          setNewProject(updated);
                          setProjectFieldErrors(validateProjectDates(updated));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300 transition"
                      >
                        Shift Deadline to Monday ({getNextMonday(newProject.planned_end_date)})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...newProject,
                          is_weekend_emergency: true,
                          priority: 'Urgent',
                        };
                        setNewProject(updated);
                        setProjectFieldErrors(validateProjectDates(updated));
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition"
                    >
                      🚨 Enable Emergency Weekend Assignment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Weekend Assignment Protocol Box */}
          {newProject.is_weekend_emergency && (
            <div className="rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 via-amber-50/40 to-white p-3.5 text-xs space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs shrink-0">
                    🚨
                  </span>
                  <div>
                    <span className="font-bold text-rose-900 uppercase tracking-wide text-[11px] block">
                      Emergency Weekend Assignment Protocol Active
                    </span>
                    <span className="text-[10px] text-rose-700 block">
                      Work scheduled on weekly off. Priority is set to Urgent and employee compensation is enabled.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...newProject, is_weekend_emergency: false };
                    setNewProject(updated);
                    setProjectFieldErrors(validateProjectDates(updated));
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline shrink-0"
                >
                  Cancel Weekend Emergency
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Emergency Justification / Reason <span className="text-rose-600">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={newProject.emergency_reason}
                  placeholder="e.g. Critical production bug patch, server migration, or urgent client release"
                  onChange={(e) => {
                    const updated = { ...newProject, emergency_reason: e.target.value };
                    setNewProject(updated);
                    setProjectFieldErrors(validateProjectDates(updated));
                  }}
                  className={`w-full p-2 rounded-lg border bg-white ${projectFieldErrors.emergency_reason ? 'border-rose-500' : 'border-slate-300'}`}
                />
                {projectFieldErrors.emergency_reason && (
                  <p className="mt-1 text-xs text-rose-700">{projectFieldErrors.emergency_reason}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Employee Weekend Compensation & Benefit:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${newProject.weekend_benefit_type === 'comp_off' ? 'border-teal-500 bg-teal-50/80 text-teal-900 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="weekend_benefit"
                      checked={newProject.weekend_benefit_type === 'comp_off'}
                      onChange={() => setNewProject({ ...newProject, weekend_benefit_type: 'comp_off' })}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="block text-xs">Compensatory Off</span>
                      <span className="block text-[10px] font-normal text-slate-500">+1 Day Leave auto-credited upon completion</span>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${newProject.weekend_benefit_type === 'allowance' ? 'border-teal-500 bg-teal-50/80 text-teal-900 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="weekend_benefit"
                      checked={newProject.weekend_benefit_type === 'allowance'}
                      onChange={() => setNewProject({ ...newProject, weekend_benefit_type: 'allowance' })}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="block text-xs">Weekend Allowance</span>
                      <span className="block text-[10px] font-normal text-slate-500">Financial stipend in monthly payroll</span>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${newProject.weekend_benefit_type === 'recognition' ? 'border-teal-500 bg-teal-50/80 text-teal-900 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="weekend_benefit"
                      checked={newProject.weekend_benefit_type === 'recognition'}
                      onChange={() => setNewProject({ ...newProject, weekend_benefit_type: 'recognition' })}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="block text-xs">Special Recognition</span>
                      <span className="block text-[10px] font-normal text-slate-500">Ownership honor & appraisal points</span>
                    </div>
                  </label>
                </div>
                {newProject.weekend_benefit_type === 'allowance' && (
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Allowance Amount (₹):</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      value={newProject.weekend_benefit_amount}
                      onChange={(e) => setNewProject({ ...newProject, weekend_benefit_amount: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              disabled={submittingProject}
              onClick={() => {
                setShowCreateModal(false);
                setProjectFormError(null);
                setProjectFieldErrors({});
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submittingProject || activeEmployees.length === 0}>
              {submittingProject ? 'Saving to Database...' : 'Create & Assign Project'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Floating Project Success Toast */}
      {projectSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{projectSuccessToast}</span>
        </div>
      )}

      {/* MODAL 2: Update Progress */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {
          setShowProgressModal(false);
          setProjectFormError(null);
        }}
        title="Update Project Progress"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs">
          {projectFormError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {projectFormError}
            </div>
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
              placeholder="Detail what components were created, bugfixes, test coverage, and current milestone..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowProgressModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Progress Update</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Request Extension */}
      <Modal
        isOpen={showExtensionModal}
        onClose={() => {
          setShowExtensionModal(false);
          setExtensionRequestError('');
        }}
        title="Request Deadline Extension"
        subtitle={selectedProject ? `Active Due Date: ${selectedProject.active_due_date}` : ""}
      >
        <form onSubmit={handleExtensionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requested New Due Date:</label>
            <input
              type="date"
              required
              min={nextDate(selectedProject?.active_due_date || selectedProject?.planned_end_date)}
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200"
            />
          </div>
          {currentUser?.role === 'super_admin'
            && Number(selectedProject?.assigned_employee_id) !== Number(currentUser.employee_id) && (
              <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
                This request will be recorded for {selectedProject?.assigned_employee_name}, submitted on behalf by {currentUser.name}.
              </p>
            )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Extension Request:</label>
            <textarea
              required
              rows="4"
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              placeholder="Provide technical justifications, scope additions, or external dependencies..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>
          {extensionRequestError && <p role="alert" className="text-rose-700">{extensionRequestError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowExtensionModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Extension Request</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Review Extension Request (HR / Manager) */}
      <Modal
        isOpen={showReviewExtModal}
        onClose={() => {
          setShowReviewExtModal(false);
          setExtensionReviewError('');
        }}
        title="Review Extension Request"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <div className="space-y-4 text-xs">
          {selectedExtension && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <p><strong>Requested By:</strong> {selectedExtension.requested_by}</p>
              {selectedExtension.on_behalf_of && (
                <p><strong>Submitted on behalf by:</strong> {selectedExtension.on_behalf_of}</p>
              )}
              <p><strong>Current Active Due Date:</strong> {selectedExtension.old_due_date}</p>
              <p><strong>Proposed New Due Date:</strong> <span className="font-bold text-teal-600">{selectedExtension.requested_due_date}</span></p>
              <p><strong>Reason:</strong> "{selectedExtension.reason}"</p>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Decision Remarks / Notes (required for rejection):</label>
            <textarea
              rows="3"
              value={extDecisionNote}
              onChange={(e) => {
                setExtDecisionNote(e.target.value);
                setExtensionReviewError('');
              }}
              placeholder="Add feedback for the developer regarding this decision..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>
          {extensionReviewError && <p role="alert" className="text-rose-700">{extensionReviewError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="danger" onClick={() => handleReviewExtension('rejected')}>
              Reject Extension
            </Button>
            <Button variant="success" onClick={() => handleReviewExtension('approved')}>
              Approve Extension
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: Submit Project Completion */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Deliverable for Final Review"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleSubmitCompletion} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deliverable Link / Artifact URL:</label>
            <input
              type="text"
              placeholder="e.g. GitHub Pull Request link, test staging build, or documentation doc"
              value={submissionDeliverable}
              onChange={(e) => setSubmissionDeliverable(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200"
            />
          </div>

          {selectedProject?.assignment_id && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="font-semibold text-slate-700">Or upload a private deliverable (PDF, ZIP, image, Office document)</p>
              <CloudinaryUpload
                module="project_deliverables"
                employeeId={selectedProject.assigned_employee_id || currentUser.employee_id}
                recordId={selectedProject.assignment_id}
                accept=".pdf,.zip,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onUploaded={() => setDeliverableUploadRefresh((value) => value + 1)}
              />
              {deliverableUploadError && <p role="alert" className="text-rose-700">{deliverableUploadError}</p>}
              {deliverableUploads.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  onClick={() => openProjectFile(file.id)}
                  className="block text-left font-semibold text-teal-600 hover:underline"
                >
                  {file.original_filename} · Download securely
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Submission Notes:</label>
            <textarea
              required
              rows="4"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              placeholder="Highlight completed test suites, acceptance criteria, and operational readiness..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit for Review</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: Review Completion (Accept / Return) */}
      <Modal
        isOpen={showReviewCompletionModal}
        onClose={() => setShowReviewCompletionModal(false)}
        title="Review Project Completion & Acceptance"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p><strong>Assigned Developer:</strong> {selectedProject?.assigned_employee_name}</p>
            <p className="mt-1">
              <strong>Target Deliverable:</strong>
              <span className="mt-1 block whitespace-pre-line">{selectedProject?.deliverable || 'No target deliverable specified.'}</span>
            </p>
            <p className="mt-1">
              <strong>Submission Note:</strong>
              <span className="mt-1 block whitespace-pre-line">"{selectedProject?.submission_note}"</span>
            </p>
            {selectedProject?.deliverable_link && (
              <p className="mt-1">
                <strong>Link: </strong>
                <a href={selectedProject.deliverable_link} target="_blank" rel="noreferrer" className="text-teal-600 underline">
                  {selectedProject.deliverable_link}
                </a>
              </p>
            )}
            {deliverableUploads.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <strong>Attached Deliverable Files ({deliverableUploads.length}):</strong>
                <ul className="mt-1 space-y-1">
                  {deliverableUploads.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        onClick={() => openProjectFile(file.id)}
                        className="text-teal-600 underline hover:text-teal-800"
                      >
                        {file.original_filename} ({Math.round(file.file_size / 1024)} KB)
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Review Feedback Note:</label>
            <textarea
              rows="3"
              value={completionReviewNote}
              onChange={(e) => setCompletionReviewNote(e.target.value)}
              placeholder="Feedback notes upon acceptance or revision instructions if returning..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => handleReviewCompletion('return')}>
              Return for Revisions
            </Button>
            <Button variant="success" onClick={() => handleReviewCompletion('accept')}>
              Accept Deliverable & Mark Completed
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: Assess Non-Monetary Penalty */}
      <Modal
        isOpen={showPenaltyModal}
        onClose={() => setShowPenaltyModal(false)}
        title="Assess Overdue Penalty Record"
        subtitle={selectedProject ? `${selectedProject.project_code} is overdue by ${selectedProject.overdue_days} days` : ""}
      >
        <form onSubmit={handleAssessPenalty} className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <p className="font-semibold">Statutory Compliance Safeguard:</p>
            <p className="text-[11px] mt-0.5">
              Assessed record is strictly non-monetary (formal escalation and review notice). No automatic salary deduction.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assessment Reason & Escalation Note:</label>
            <textarea
              required
              rows="4"
              value={penaltyReason}
              onChange={(e) => setPenaltyReason(e.target.value)}
              placeholder="Document the delay reasons, notice communicated to developer, and required action..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowPenaltyModal(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Record Penalty Notice</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: Waive Penalty */}
      <Modal
        isOpen={showWaiveModal}
        onClose={() => setShowWaiveModal(false)}
        title="Waive Project Penalty"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleWaivePenalty} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Waiver Reason / Justification:</label>
            <textarea
              required
              rows="4"
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="e.g. Unforeseen server outage, dependency resolved, authorized executive waiver..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowWaiveModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Confirm Waiver</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
