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
  CalendarClock
} from 'lucide-react';

export default function ProjectsView() {
  const { currentUser, hasPermission } = useAuth();
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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const [showReviewExtModal, setShowReviewExtModal] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [extDecisionNote, setExtDecisionNote] = useState('');

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
  const [projectSuccessToast, setProjectSuccessToast] = useState(null);

  // Create Project Form
  const initialProjectState = {
    name: '',
    description: '',
    deliverable: '',
    assigned_employee_id: employees.find(e => e.role === 'employee')?.id || employees[0]?.id || 1,
    priority: 'High',
    start_date: new Date().toISOString().substring(0, 10),
    planned_end_date: ''
  };

  const [newProject, setNewProject] = useState(initialProjectState);

  const canManageProjects = hasPermission('projects.manage');

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
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.project_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.assigned_employee_name || '')?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level stats
  const totalProjects = projects.length;
  const inProgressCount = projects.filter(p => p.status === 'in_progress').length;
  const underReviewCount = projects.filter(p => p.status === 'under_review').length;
  const overdueCount = projects.filter(p => p.status === 'overdue').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;

  // Pending extensions across all projects
  const allPendingExtensions = projects.flatMap(p => 
    (p.extensions || [])
      .filter(e => e.status === 'pending')
      .map(e => ({ ...e, projectId: p.id, projectCode: p.project_code, projectName: p.name }))
  );

  // Form Handlers
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newProject.name || !newProject.planned_end_date) return;
    setProjectFormError(null);
    setSubmittingProject(true);

    try {
      const saved = await createProject(
        {
          ...newProject,
          assigned_employee_id: Number(newProject.assigned_employee_id) || employees[0]?.id || 1
        },
        `${currentUser.first_name} ${currentUser.last_name} (${currentUser.role})`
      );

      setProjectSuccessToast(`Project ${saved?.project_code || ''} (${newProject.name}) created & assigned successfully in database!`);
      setTimeout(() => setProjectSuccessToast(null), 4000);
      setShowCreateModal(false);
      setNewProject(initialProjectState);
    } catch (err) {
      console.error("Project create error:", err);
      const msg = err?.data?.message || err.message || "Failed to save project to database. Ensure Laravel server is running.";
      setProjectFormError(msg);
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleUpdateProgressSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setProjectFormError(null);
    try {
      await updateProjectProgress(selectedProject.id, progressVal, progressNote);
      setShowProgressModal(false);
      setProgressNote('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to save project progress.');
    }
  };

  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject || !requestedDate || !extensionReason) return;
    setProjectFormError(null);
    try {
      await requestExtension(selectedProject.id, requestedDate, extensionReason);
      setShowExtensionModal(false);
      setRequestedDate('');
      setExtensionReason('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to save the extension request.');
    }
  };

  const handleReviewExtension = async (decision) => {
    if (!selectedProject || !selectedExtension) return;
    setProjectFormError(null);
    try {
      await reviewExtension(selectedProject.id, selectedExtension.id, decision, extDecisionNote);
      setShowReviewExtModal(false);
      setExtDecisionNote('');
    } catch (error) {
      setProjectFormError(error?.data?.message || error.message || 'Unable to review the extension request.');
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
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
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
          {canManageProjects && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setShowCreateModal(true)}
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

      {/* Sub-Tabs: List View vs Pending Extensions vs Policy Safeguards */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Assigned Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('extensions')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'extensions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
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
              activeTab === 'policy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Penalty Policy & India Legal Safeguards
          </button>
        </div>
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
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
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
              const isOverdue = project.status === 'overdue';
              const isUnderReview = project.status === 'under_review';
              const isCompleted = project.status === 'completed';

              const hasPendingExtension = project.extensions?.some(e => e.status === 'pending');
              const activeExtension = project.extensions?.find(e => e.status === 'pending');

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
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {project.project_code}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{project.name}</h3>
                        <Badge
                          variant={
                            project.priority === 'Urgent' ? 'danger' :
                            project.priority === 'High' ? 'warning' : 'neutral'
                          }
                          size="sm"
                        >
                          {project.priority} Priority
                        </Badge>
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
                    <span className="text-slate-600">{project.deliverable}</span>
                    {project.submission_note && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-slate-700">
                        <span className="font-semibold text-indigo-700">Developer Submission Note: </span>
                        <span>"{project.submission_note}"</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar & Slider */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        Progress Update (v{project.version || 1})
                      </span>
                      <span className="font-bold text-indigo-600">{project.progress_percent}% Complete</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${project.progress_percent}%` }}
                      />
                    </div>
                  </div>

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
                      <span className="text-[10px] text-slate-400">Assigned by {project.assigned_by}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Baseline Date</span>
                      <span className="font-semibold text-slate-800 block mt-1">{project.planned_end_date}</span>
                      <span className="text-[10px] text-slate-400 italic">Immutable baseline</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Deadline</span>
                      <span className={`font-bold block mt-1 ${isOverdue ? "text-rose-600" : "text-indigo-600"}`}>
                        {project.active_due_date}
                      </span>
                      {project.actual_completed_at && (
                        <span className="text-[10px] text-emerald-600 block">Accepted on {project.actual_completed_at.substring(0, 10)}</span>
                      )}
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
                        <p className="text-[11px] text-amber-800 mt-0.5">"{activeExtension.reason}"</p>
                      </div>
                      {canManageProjects && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedProject(project);
                            setSelectedExtension(activeExtension);
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
                        {canManageProjects && project.penalties[0].status !== 'waived' && (
                          <button
                            onClick={() => {
                              setSelectedProject(project);
                              setSelectedPenalty(project.penalties[0]);
                              setShowWaiveModal(true);
                            }}
                            className="text-xs text-indigo-700 font-bold hover:underline"
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
                      <span>{project.extensions?.length || 0} Extension(s)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Developer Buttons */}
                      {!isCompleted && (
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

                      {/* HR / Reviewer Buttons */}
                      {canManageProjects && isUnderReview && (
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
                      {canManageProjects && isOverdue && (!project.penalties || project.penalties.length === 0) && (
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
        <Card title="Pending Deadline Extension Requests" subtitle="Formal HR & Manager review workflow">
          {allPendingExtensions.length > 0 ? (
            <div className="space-y-4">
              {allPendingExtensions.map((ext) => (
                <div key={ext.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {ext.projectCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{ext.projectName}</h4>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Requested by <strong className="text-slate-800">{ext.requested_by}</strong> on {ext.requested_at}
                    </p>
                    <p className="text-slate-700 mt-2 p-2.5 rounded-lg bg-white border border-slate-200/80 italic">
                      "{ext.reason}"
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                      <span>Original/Active Due: <strong className="text-slate-800">{ext.old_due_date}</strong></span>
                      <span>Proposed New Due: <strong className="text-indigo-600">{ext.requested_due_date}</strong></span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        const targetProj = projects.find(p => p.id === ext.projectId);
                        setSelectedProject(targetProj);
                        setSelectedExtension(ext);
                        setShowReviewExtModal(true);
                      }}
                    >
                      Approve / Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              No pending extension requests at this moment.
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
                    In compliance with Indian employment laws and Section 9 of the HRMS Architecture proposal, automated salary deductions for project delays are <strong>strictly disabled</strong>. Default penalties are non-monetary (formal escalation email, manager notice, and performance cycle review remark).
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
                  <p className="text-2xl font-black text-indigo-600 mt-1">
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
                  <p className="text-[11px] text-slate-500 mt-1">Requires explicit management sign-off and legal payroll review.</p>
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
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assign Developer:</label>
              <select
                value={newProject.assigned_employee_id}
                onChange={(e) => setNewProject({ ...newProject, assigned_employee_id: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.designation}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority:</label>
              <select
                value={newProject.priority}
                onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date:</label>
              <input
                type="date"
                required
                value={newProject.start_date}
                onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Planned Baseline End Date:</label>
              <input
                type="date"
                required
                value={newProject.planned_end_date}
                onChange={(e) => setNewProject({ ...newProject, planned_end_date: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">This initial due date is immutable in history.</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" disabled={submittingProject} onClick={() => { setShowCreateModal(false); setProjectFormError(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submittingProject}>
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
        onClose={() => setShowProgressModal(false)}
        title="Update Project Progress"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-slate-700 mb-1">
              <span>Progress Percentage:</span>
              <span className="text-indigo-600 font-bold text-sm">{progressVal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressVal}
              onChange={(e) => setProgressVal(e.target.value)}
              className="w-full accent-indigo-600 cursor-pointer"
            />
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
        onClose={() => setShowExtensionModal(false)}
        title="Request Deadline Extension"
        subtitle={selectedProject ? `Active Due Date: ${selectedProject.active_due_date}` : ""}
      >
        <form onSubmit={handleExtensionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requested New Due Date:</label>
            <input
              type="date"
              required
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200"
            />
          </div>

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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowExtensionModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Extension Request</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Review Extension Request (HR / Manager) */}
      <Modal
        isOpen={showReviewExtModal}
        onClose={() => setShowReviewExtModal(false)}
        title="Review Extension Request"
        subtitle={selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : ""}
      >
        <div className="space-y-4 text-xs">
          {selectedExtension && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <p><strong>Requested By:</strong> {selectedExtension.requested_by}</p>
              <p><strong>Current Active Due Date:</strong> {selectedExtension.old_due_date}</p>
              <p><strong>Proposed New Due Date:</strong> <span className="font-bold text-indigo-600">{selectedExtension.requested_due_date}</span></p>
              <p><strong>Reason:</strong> "{selectedExtension.reason}"</p>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Decision Remarks / Notes:</label>
            <textarea
              rows="3"
              value={extDecisionNote}
              onChange={(e) => setExtDecisionNote(e.target.value)}
              placeholder="Add feedback for the developer regarding this decision..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

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
                  className="block text-left font-semibold text-indigo-600 hover:underline"
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
            <p className="mt-1"><strong>Submission Note:</strong> "{selectedProject?.submission_note}"</p>
            {selectedProject?.deliverable_link && (
              <p className="mt-1">
                <strong>Link: </strong>
                <a href={selectedProject.deliverable_link} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                  {selectedProject.deliverable_link}
                </a>
              </p>
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
