import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import PhoneInput from '../../components/common/PhoneInput';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import {
  UserPlus,
  Briefcase,
  CheckCircle2,
  Clock,
  ArrowRight,
  Star,
  Users,
  Building,
  XCircle,
  RotateCcw,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Check
} from 'lucide-react';

function extractRecruitmentError(error, fallback) {
  const fieldErrors = error?.data?.errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  return error?.data?.message || error?.message || fallback;
}

export default function RecruitmentView() {
  const { currentUser } = useAuth();
  const {
    recruitment,
    branches,
    syncWithBackend,
    updateCandidateStage,
    updateRecruitmentJobStatus,
    convertCandidate,
    createRecruitmentJob,
    createCandidate,
    evaluateCandidate,
  } = useHRMS();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canManageRecruitment = ['super_admin', 'hr_admin', 'recruiter'].includes(currentUser?.role);

  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'signoffs' | 'jobs'
  const [convertFeedback, setConvertFeedback] = useState(null);
  const [workflowError, setWorkflowError] = useState('');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluationCandidate, setEvaluationCandidate] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState({ rating: '3', evaluation_note: '' });
  const [savingRecord, setSavingRecord] = useState(false);

  const [jobForm, setJobForm] = useState({
    title: '',
    department: '',
    branch_id: '',
    vacancies: 1,
    experience: '',
  });

  const [candidateForm, setCandidateForm] = useState({
    job_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    current_ctc: '',
    expected_ctc: '',
    notice_period: '',
  });

  const candidates = recruitment.candidates || [];
  const jobs = recruitment.jobs || [];
  const openJobs = jobs.filter((job) => job.status === 'Open');

  const appliedCandidates = candidates.filter((c) => c.stage === 'Applied');
  const screeningCandidates = candidates.filter((c) => c.stage === 'Screening');
  const interviewCandidates = candidates.filter((c) => c.stage === 'Interview');
  const offeredCandidates = candidates.filter((c) => c.stage === 'Offered');
  const hiredCandidates = candidates.filter((c) => c.stage === 'Hired');
  const rejectedCandidates = candidates.filter((c) => c.stage === 'Rejected');

  const activeCandidatesCount = appliedCandidates.length + screeningCandidates.length + interviewCandidates.length;
  const totalVacancies = openJobs.reduce((acc, j) => acc + (Number(j.vacancies) || 1), 0);
  const totalApplicants = jobs.reduce((acc, j) => acc + (Number(j.applicants_count) || 0), 0);
  const openDepartmentsCount = new Set(openJobs.map((j) => j.department)).size;

  useEffect(() => {
    if (!branches || branches.length === 0) {
      syncWithBackend?.('recruitment');
    }
  }, [branches, syncWithBackend]);

  const stages = ['Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected'];

  const handleStageMove = async (candidateId, newStage) => {
    setWorkflowError('');
    setSavingRecord(true);
    try {
      await updateCandidateStage(candidateId, newStage);
    } catch (error) {
      setWorkflowError(extractRecruitmentError(error, 'Unable to save the candidate stage.'));
    } finally {
      setSavingRecord(false);
    }
  };

  const handleRejectCandidate = async (candidate) => {
    if (!window.confirm(`Are you sure you want to reject candidate ${candidate.name}?`)) return;
    setWorkflowError('');
    try {
      await updateCandidateStage(candidate.id, 'Rejected');
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to reject candidate.');
    }
  };

  const handleConvertToEmployee = async (candidate) => {
    setWorkflowError('');
    setSavingRecord(true);
    try {
      const newEmployee = await convertCandidate(candidate.id);
      setConvertFeedback(`Candidate ${candidate.name} officially converted to employee ${newEmployee.employee_code}.`);
    } catch (err) {
      setWorkflowError(extractRecruitmentError(err, 'Unable to convert this candidate.'));
    } finally {
      setSavingRecord(false);
    }
    setTimeout(() => setConvertFeedback(null), 5000);
  };

  const handleUpdateJobStatus = async (job) => {
    const nextStatus = job.status === 'Open' ? 'Closed' : 'Open';
    const confirmation = nextStatus === 'Closed'
      ? `Close the ${job.title} requisition? New candidates can no longer be added.`
      : `Reopen the ${job.title} requisition? Candidate intake will resume.`;
    if (!window.confirm(confirmation)) return;
    setWorkflowError('');
    setSavingRecord(true);
    try {
      await updateRecruitmentJobStatus(job.id, nextStatus);
      setConvertFeedback(`${job.title} requisition marked as ${nextStatus.toLowerCase()}.`);
      setTimeout(() => setConvertFeedback(null), 5000);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to update this job opening.');
    } finally {
      setSavingRecord(false);
    }
  };

  const openEvaluation = (candidate) => {
    setEvaluationCandidate(candidate);
    setEvaluationForm({
      rating: String(Number(candidate.rating) > 0 ? candidate.rating : 3),
      evaluation_note: candidate.evaluation_note || '',
    });
    setShowEvaluationModal(true);
  };

  const handleEvaluationSubmit = async (event) => {
    event.preventDefault();
    if (!evaluationCandidate) return;
    setWorkflowError('');
    setSavingRecord(true);
    try {
      await evaluateCandidate(
        evaluationCandidate.id,
        Number(evaluationForm.rating),
        evaluationForm.evaluation_note
      );
      setShowEvaluationModal(false);
      setEvaluationCandidate(null);
      setConvertFeedback(`Interview evaluation saved for ${evaluationCandidate.name}.`);
      setTimeout(() => setConvertFeedback(null), 5000);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the interview evaluation.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleCreateJob = async (event) => {
    event.preventDefault();
    setWorkflowError('');
    setSavingRecord(true);
    try {
      await createRecruitmentJob({
        ...jobForm,
        branch_id: Number(jobForm.branch_id),
        vacancies: Number(jobForm.vacancies),
      });
      setShowJobModal(false);
      setJobForm({ title: '', department: '', branch_id: '', vacancies: 1, experience: '' });
      setConvertFeedback('New job requisition successfully created.');
      setTimeout(() => setConvertFeedback(null), 5000);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the job opening.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleCreateCandidate = async (event) => {
    event.preventDefault();
    setWorkflowError('');

    if (candidateForm.phone) {
      const cleanCandPhone = candidateForm.phone.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanCandPhone)) {
        setWorkflowError('Phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return;
      }
    }

    if (candidateForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateForm.email.trim())) {
      setWorkflowError('Please enter a valid candidate email address.');
      return;
    }

    setSavingRecord(true);
    try {
      await createCandidate({
        ...candidateForm,
        job_id: Number(candidateForm.job_id),
        phone: candidateForm.phone ? candidateForm.phone.replace(/\D/g, '') : null,
      });
      setShowCandidateModal(false);
      setCandidateForm({
        job_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        current_ctc: '',
        expected_ctc: '',
        notice_period: '',
      });
      setConvertFeedback('New candidate successfully added to pipeline.');
      setTimeout(() => setConvertFeedback(null), 5000);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the candidate.');
    } finally {
      setSavingRecord(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide flex items-center gap-1.5">
              {isSuperAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Executive Recruitment Desk
                </>
              ) : (
                'Talent Acquisition'
              )}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {isSuperAdmin
                ? 'Headcount control, pipeline oversight & final hiring sign-off'
                : 'ATS pipeline and onboarding conversion'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {isSuperAdmin ? 'Recruitment & Talent Oversight' : 'Recruitment & Applicant Tracking (ATS)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdmin
              ? 'Review hiring velocity across departments, monitor candidate progression, and provide final sign-off to convert selected candidates into active employees.'
              : 'Manage requisitions, evaluate interview-stage candidates, and convert offered candidates to employee records.'}
          </p>
        </div>

        {canManageRecruitment && (
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin ? (
              <>
                <Button variant="secondary" icon={Briefcase} onClick={() => setShowJobModal(true)}>
                  Open Requisition
                </Button>
                <button
                  type="button"
                  disabled={openJobs.length === 0}
                  onClick={() => setShowCandidateModal(true)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Direct candidate intake (typically handled by HR recruiter)"
                >
                  <UserPlus className="w-3.5 h-3.5 text-slate-500" /> Direct Candidate Entry
                </button>
              </>
            ) : (
              <>
                <Button variant="secondary" icon={Briefcase} onClick={() => setShowJobModal(true)}>
                  Add Job Opening
                </Button>
                <Button
                  variant="primary"
                  icon={UserPlus}
                  disabled={openJobs.length === 0}
                  onClick={() => setShowCandidateModal(true)}
                >
                  Add Candidate
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {convertFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {convertFeedback}
        </div>
      )}

      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {workflowError}
        </div>
      )}

      {/* Executive KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Open Requisitions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Open Requisitions</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{openJobs.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {totalVacancies} vacancies across {openDepartmentsCount || 0} depts
            </p>
          </div>
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Active Pipeline Inflow */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Pipeline</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeCandidatesCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Applied, screening & interview</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Pending Sign-Off */}
        <div
          className={`p-4 rounded-xl border shadow-xs flex items-center justify-between transition ${
            offeredCandidates.length > 0
              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  offeredCandidates.length > 0 ? 'text-amber-800' : 'text-slate-500'
                }`}
              >
                Pending Sign-Off
              </p>
              {offeredCandidates.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p
              className={`text-2xl font-black mt-1 ${
                offeredCandidates.length > 0 ? 'text-amber-900' : 'text-slate-900'
              }`}
            >
              {offeredCandidates.length}
            </p>
            <p
              className={`text-[11px] mt-0.5 ${
                offeredCandidates.length > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'
              }`}
            >
              {offeredCandidates.length > 0 ? 'Ready for conversion to employee' : 'No offers awaiting sign-off'}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${
              offeredCandidates.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-500'
            }`}
          >
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Converted to Team */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Converted to Team</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{hiredCandidates.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Active onboarded hires</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* High-Priority Sign-Off Alert (Visible for Super Admin when offers are pending) */}
      {isSuperAdmin && offeredCandidates.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-amber-200 text-amber-900">
                <UserCheck className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Final Offer Sign-Off Required ({offeredCandidates.length})
                </h2>
                <p className="text-xs text-slate-600">
                  These candidates have cleared interview evaluations and received offers. Sign off to officially onboard them as active employees.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('signoffs')}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline flex items-center gap-1 self-start sm:self-auto"
            >
              View Full Sign-Off Desk <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offeredCandidates.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{cand.name}</h3>
                      <p className="text-xs font-semibold text-teal-700">{cand.job_title || 'General Opening'}</p>
                      <p className="text-[11px] text-slate-500">{cand.department || 'General'}</p>
                    </div>
                    <Badge variant="warning" size="sm">
                      Offered
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Offered / Exp. CTC:</span>
                      <span className="font-semibold text-slate-900">{cand.expected_ctc || 'Negotiated'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Notice Period:</span>
                      <span className="font-medium text-slate-800">{cand.notice_period || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="text-slate-400">Evaluation:</span>
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {Number(cand.rating) > 0 ? `${Number(cand.rating).toFixed(1)} / 5` : 'Not rated'}
                      </span>
                    </div>
                    {cand.evaluation_note && (
                      <p className="mt-1 text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{cand.evaluation_note}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingRecord}
                    onClick={() => handleConvertToEmployee(cand)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {savingRecord ? 'Onboarding...' : 'Sign-Off & Onboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEvaluation(cand)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
                    title="Review or edit evaluation"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectCandidate(cand)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                    title="Reject candidate"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'kanban'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Candidate Pipeline Kanban ({candidates.length})
        </button>

        <button
          onClick={() => setActiveTab('signoffs')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'signoffs'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          {isSuperAdmin ? 'Executive Sign-Offs & Hires' : 'Offers & Converted Hires'}
          {offeredCandidates.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              {offeredCandidates.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'jobs'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Department Vacancies & Jobs ({openJobs.length} open)
        </button>
      </div>

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === 'kanban' && (
        <div className="flex lg:grid lg:grid-cols-6 gap-4 overflow-x-auto pb-4 snap-x">
          {stages.map((stage) => {
            const stageCandidates = candidates.filter((c) => c.stage === stage);
            const isRejectedCol = stage === 'Rejected';
            const isOfferedCol = stage === 'Offered';
            const isHiredCol = stage === 'Hired';

            return (
              <div
                key={stage}
                className={`min-w-[270px] lg:min-w-0 flex-1 snap-start rounded-xl p-3 border flex flex-col justify-between ${
                  isRejectedCol
                    ? 'bg-rose-50/50 border-rose-200'
                    : isOfferedCol
                    ? 'bg-amber-50/40 border-amber-200'
                    : isHiredCol
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-100/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                    <h3
                      className={`font-bold text-xs ${
                        isRejectedCol
                          ? 'text-rose-700'
                          : isOfferedCol
                          ? 'text-amber-800'
                          : isHiredCol
                          ? 'text-emerald-800'
                          : 'text-slate-800'
                      }`}
                    >
                      {stage}
                    </h3>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                        isRejectedCol
                          ? 'bg-rose-100 text-rose-700'
                          : isOfferedCol
                          ? 'bg-amber-100 text-amber-800'
                          : isHiredCol
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white text-slate-600'
                      }`}
                    >
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {stageCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        className={`bg-white rounded-lg p-3 border shadow-xs space-y-2 text-xs min-w-0 ${
                          isRejectedCol
                            ? 'border-rose-200/80'
                            : isOfferedCol
                            ? 'border-amber-300 ring-1 ring-amber-200'
                            : isHiredCol
                            ? 'border-emerald-300'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1.5 min-w-0">
                          <div>
                            <h4 className="font-bold text-slate-900 truncate" title={cand.name}>
                              {cand.name}
                            </h4>
                            <p className="text-[10px] text-teal-700 font-medium truncate" title={cand.job_title}>
                              {cand.job_title || 'Requisition'}
                            </p>
                          </div>
                          {isRejectedCol ? (
                            <Badge variant="danger" size="sm">
                              Rejected
                            </Badge>
                          ) : isHiredCol ? (
                            <Badge variant="success" size="sm">
                              Hired
                            </Badge>
                          ) : (
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold text-[11px] shrink-0">
                              <Star className="h-3 w-3 fill-amber-400" />
                              {Number(cand.rating) > 0 ? `${Number(cand.rating).toFixed(1)}/5` : 'Not rated'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 truncate" title={cand.email}>
                          {cand.email}
                        </p>

                        {cand.evaluation_note && (
                          <p className="line-clamp-2 text-[11px] text-slate-600 break-words bg-slate-50 p-1.5 rounded">
                            {cand.evaluation_note}
                          </p>
                        )}

                        <div className="text-[10px] text-slate-500 flex justify-between gap-1 pt-1 border-t border-slate-100">
                          <span className="truncate">Notice: {cand.notice_period || 'Standard'}</span>
                          <span className="shrink-0 font-medium text-slate-700">CTC: {cand.expected_ctc || 'Negotiated'}</span>
                        </div>

                        {/* Stage actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                          {stage === 'Offered' && canManageRecruitment && (
                            <button
                              type="button"
                              disabled={savingRecord}
                              onClick={() => handleConvertToEmployee(cand)}
                              className="w-full text-center py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-[11px] transition mb-1 shadow-xs flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isSuperAdmin ? '✓ Sign-Off & Convert to Employee' : '+ Convert to Employee'}
                            </button>
                          )}

                          {stage !== 'Offered' && stage !== 'Hired' && stage !== 'Rejected' && canManageRecruitment && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextStageIndex = stages.indexOf(stage) + 1;
                                if (nextStageIndex < stages.length && stages[nextStageIndex] !== 'Rejected') {
                                  handleStageMove(cand.id, stages[nextStageIndex]);
                                }
                              }}
                              className="text-teal-600 font-semibold hover:underline text-[11px] inline-flex items-center gap-1"
                            >
                              Advance Stage <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {['Interview', 'Offered'].includes(stage) && canManageRecruitment && (
                            <button
                              type="button"
                              onClick={() => openEvaluation(cand)}
                              className="text-teal-600 font-semibold hover:underline text-[11px]"
                            >
                              {Number(cand.rating) > 0 ? 'Update Evaluation' : 'Evaluate'}
                            </button>
                          )}

                          {stage !== 'Hired' && stage !== 'Rejected' && canManageRecruitment && (
                            <button
                              type="button"
                              onClick={() => handleRejectCandidate(cand)}
                              className="text-rose-600 font-semibold hover:text-rose-800 hover:underline text-[11px] inline-flex items-center gap-1 ml-auto"
                              title="Reject candidate"
                            >
                              <XCircle className="w-3 h-3 text-rose-500" /> Reject
                            </button>
                          )}

                          {stage === 'Rejected' && canManageRecruitment && (
                            <button
                              type="button"
                              onClick={() => handleStageMove(cand.id, 'Applied')}
                              className="text-teal-600 font-semibold hover:underline text-[11px] inline-flex items-center gap-1"
                              title="Reopen candidate back to Applied"
                            >
                              <RotateCcw className="w-3 h-3 text-teal-600" /> Reopen to Applied
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {stageCandidates.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic text-center py-6">No candidates in {stage}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: EXECUTIVE SIGN-OFFS & CONVERTED HIRES */}
      {activeTab === 'signoffs' && (
        <div className="space-y-6">
          {/* Section A: Offers Awaiting Sign-Off */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" /> Offers Awaiting Final Sign-Off & Conversion
                </h3>
                <p className="text-xs text-slate-500">
                  {isSuperAdmin
                    ? 'Candidates who passed interviews and are ready to be onboarded as active employees.'
                    : 'Candidates with offers awaiting super admin sign-off or conversion to employee profile.'}
                </p>
              </div>
              <Badge variant={offeredCandidates.length > 0 ? 'warning' : 'neutral'}>
                {offeredCandidates.length} Pending
              </Badge>
            </div>

            {offeredCandidates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offeredCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="bg-white rounded-xl p-4 border border-amber-300 ring-1 ring-amber-200 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base">{cand.name}</h4>
                          <p className="text-xs font-semibold text-teal-700">{cand.job_title || 'General Opening'}</p>
                          <p className="text-xs text-slate-500">{cand.department || 'General'}</p>
                        </div>
                        <Badge variant="warning">Offered</Badge>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-medium text-slate-900 truncate max-w-[180px]">{cand.email}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-400">Phone:</span>
                          <span className="font-medium text-slate-900">{cand.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-400">Offered / Exp. CTC:</span>
                          <span className="font-bold text-slate-900">{cand.expected_ctc || 'Negotiated'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-400">Notice Period:</span>
                          <span className="font-medium text-slate-800">{cand.notice_period || 'Standard'}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="text-slate-400">Interview Rating:</span>
                          <span className="font-bold text-amber-600 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {Number(cand.rating) > 0 ? `${Number(cand.rating).toFixed(1)} / 5` : 'Not rated'}
                          </span>
                        </div>
                        {cand.evaluated_by_name && (
                          <div className="flex justify-between text-slate-600">
                            <span className="text-slate-400">Evaluated By:</span>
                            <span className="text-slate-700">{cand.evaluated_by_name}</span>
                          </div>
                        )}
                        {cand.evaluation_note && (
                          <div className="mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Interview Notes
                            </p>
                            <p className="text-xs text-slate-700 italic">"{cand.evaluation_note}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingRecord}
                        onClick={() => handleConvertToEmployee(cand)}
                        className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {savingRecord ? 'Onboarding...' : '✓ Sign-Off & Convert to Employee'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEvaluation(cand)}
                        className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
                      >
                        Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectCandidate(cand)}
                        className="px-3 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-semibold transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">All Offer Sign-Offs Are Clear</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There are currently no candidates awaiting offer sign-off. When candidates reach the "Offered" stage in the ATS pipeline, they will appear here for 1-click employee conversion.
                </p>
              </div>
            )}
          </div>

          {/* Section B: Successfully Converted & Hired Candidates */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Onboarded Team Members ({hiredCandidates.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Talent successfully converted from the applicant pipeline into active employee records.
                </p>
              </div>
              <Badge variant="success">{hiredCandidates.length} Active Hires</Badge>
            </div>

            {hiredCandidates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hiredCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{cand.name}</h4>
                          <p className="text-xs font-semibold text-teal-700">{cand.job_title || 'Team Member'}</p>
                          <p className="text-[11px] text-slate-500">{cand.department || 'General'}</p>
                        </div>
                        <Badge variant="success" size="sm">
                          Active Employee
                        </Badge>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-medium text-slate-800 truncate max-w-[170px]">{cand.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Final CTC:</span>
                          <span className="font-semibold text-slate-800">{cand.expected_ctc || 'Standard'}</span>
                        </div>
                        {cand.rating && Number(cand.rating) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Hiring Rating:</span>
                            <span className="font-bold text-amber-600 flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-amber-400" /> {Number(cand.rating).toFixed(1)} / 5
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                <p className="text-xs text-slate-400 italic">No candidates converted to employees yet in this cycle.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE REQUISITIONS & VACANCIES */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {/* Headcount Summary Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Requisitions</span>
                <span className="font-bold text-slate-900 text-base">{jobs.length} Positions</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-slate-400 block text-[11px]">Open & Active</span>
                <span className="font-bold text-teal-600 text-base">{openJobs.length} Requisitions</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-slate-400 block text-[11px]">Total Headcount Vacancies</span>
                <span className="font-bold text-slate-900 text-base">{totalVacancies} Openings</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-slate-400 block text-[11px]">Total Profiles Inflow</span>
                <span className="font-bold text-slate-900 text-base">{totalApplicants} Candidates</span>
              </div>
            </div>

            {canManageRecruitment && (
              <Button variant="primary" icon={Briefcase} onClick={() => setShowJobModal(true)}>
                {isSuperAdmin ? 'Open Headcount Requisition' : 'Add Job Opening'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <Card
                key={job.id}
                title={job.title}
                subtitle={job.department}
                action={<Badge variant={job.status === 'Open' ? 'success' : 'neutral'} size="sm">{job.status}</Badge>}
              >
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Location</span>
                    <span className="font-semibold text-slate-800">{job.branch || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Vacancies</span>
                    <span className="font-bold text-teal-600">{job.vacancies} Positions</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Experience Needed</span>
                    <span className="font-semibold text-slate-800">{job.experience || 'Flexible'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Applicants Received</span>
                    <span className="font-bold text-slate-800">{job.applicants_count} Profiles</span>
                  </div>
                  {canManageRecruitment && (
                    <div className="flex justify-end border-t border-slate-100 pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={savingRecord}
                        onClick={() => handleUpdateJobStatus(job)}
                      >
                        {job.status === 'Open' ? 'Close Requisition' : 'Reopen Requisition'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {jobs.length === 0 && (
              <div className="col-span-full bg-white rounded-xl p-8 border border-slate-200 text-center space-y-3">
                <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">No Active Job Requisitions</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no open job openings registered in the system yet. Click below to declare a new headcount requisition.
                </p>
                {canManageRecruitment && (
                  <Button variant="primary" icon={Briefcase} onClick={() => setShowJobModal(true)}>
                    Create First Requisition
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD JOB REQUISITION */}
      <Modal
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        title={isSuperAdmin ? 'Open Headcount Requisition' : 'Add Job Opening'}
        subtitle="Save a new requisition to the HRMS database"
      >
        <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <label className="block font-semibold text-slate-700">
            Job title
            <input
              required
              placeholder="e.g. Senior Frontend Engineer"
              value={jobForm.title}
              onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <label className="block font-semibold text-slate-700">
            Department
            <input
              required
              placeholder="e.g. Engineering, Sales, Operations"
              value={jobForm.department}
              onChange={(event) => setJobForm({ ...jobForm, department: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <label className="block font-semibold text-slate-700">
            Branch
            <select
              required
              value={jobForm.branch_id}
              onChange={(event) => setJobForm({ ...jobForm, branch_id: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} {branch.city ? `(${branch.city})` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              Vacancies
              <input
                type="number"
                required
                min="1"
                value={jobForm.vacancies}
                onChange={(event) => setJobForm({ ...jobForm, vacancies: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
            <label className="block font-semibold text-slate-700">
              Experience needed
              <input
                placeholder="e.g. 2-4 years"
                value={jobForm.experience}
                onChange={(event) => setJobForm({ ...jobForm, experience: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setShowJobModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingRecord}>
              {savingRecord ? 'Saving...' : 'Save Requisition'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: INTERVIEW EVALUATION */}
      <Modal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        title={`Interview Evaluation${evaluationCandidate ? ` · ${evaluationCandidate.name}` : ''}`}
        subtitle="Record candidate assessment for Interview or Offered stages."
      >
        <form onSubmit={handleEvaluationSubmit} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <label className="block font-semibold text-slate-700">
            Candidate rating (1–5)
            <select
              required
              min="1"
              max="5"
              value={evaluationForm.rating}
              onChange={(event) => setEvaluationForm((previous) => ({ ...previous, rating: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} Star{rating > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold text-slate-700">
            Evaluation notes
            <textarea
              rows="4"
              maxLength="2000"
              placeholder="Summary of candidate technical skills, cultural fit, and offer recommendation..."
              value={evaluationForm.evaluation_note}
              onChange={(event) => setEvaluationForm((previous) => ({ ...previous, evaluation_note: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" disabled={savingRecord} onClick={() => setShowEvaluationModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingRecord}>
              {savingRecord ? 'Saving...' : 'Save Evaluation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ADD CANDIDATE */}
      <Modal
        isOpen={showCandidateModal}
        onClose={() => setShowCandidateModal(false)}
        title="Add Candidate to Pipeline"
        subtitle="Save applicant details to the recruitment pipeline"
      >
        <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          <label className="block font-semibold text-slate-700">
            Job opening
            <select
              required
              value={candidateForm.job_id}
              onChange={(event) => setCandidateForm({ ...candidateForm, job_id: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"
            >
              <option value="">Select an opening</option>
              {openJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.department})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              First name
              <input
                required
                value={candidateForm.first_name}
                onChange={(event) => setCandidateForm({ ...candidateForm, first_name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
            <label className="block font-semibold text-slate-700">
              Last name
              <input
                value={candidateForm.last_name}
                onChange={(event) => setCandidateForm({ ...candidateForm, last_name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
          </div>
          <label className="block font-semibold text-slate-700">
            Email
            <input
              type="email"
              required
              value={candidateForm.email}
              onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              Phone
              <PhoneInput
                autoComplete="tel-national"
                placeholder="Enter 10-digit number"
                value={candidateForm.phone}
                onChange={(phone) => setCandidateForm({ ...candidateForm, phone })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
            <label className="block font-semibold text-slate-700">
              Notice period
              <input
                placeholder="e.g. Immediate, 30 days"
                value={candidateForm.notice_period}
                onChange={(event) => setCandidateForm({ ...candidateForm, notice_period: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              Current CTC
              <input
                placeholder="e.g. 6 LPA"
                value={candidateForm.current_ctc}
                onChange={(event) => setCandidateForm({ ...candidateForm, current_ctc: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
            <label className="block font-semibold text-slate-700">
              Expected / Offered CTC
              <input
                placeholder="e.g. 8 LPA"
                value={candidateForm.expected_ctc}
                onChange={(event) => setCandidateForm({ ...candidateForm, expected_ctc: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setShowCandidateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingRecord}>
              {savingRecord ? 'Saving...' : 'Add Candidate'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
