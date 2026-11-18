import React, { useState } from 'react';
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
  Building
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
    updateCandidateStage,
    updateRecruitmentJobStatus,
    convertCandidate,
    createRecruitmentJob,
    createCandidate,
    evaluateCandidate,
  } = useHRMS();
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'jobs'
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
  const canManageRecruitment = ['super_admin', 'hr_admin', 'recruiter'].includes(currentUser?.role);

  const stages = ["Applied", "Screening", "Interview", "Offered", "Hired"];

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

  const handleConvertToEmployee = async (candidate) => {
    setWorkflowError('');
    setSavingRecord(true);
    try {
      const newEmployee = await convertCandidate(candidate.id);
      setConvertFeedback(`Candidate ${candidate.name} converted to employee ${newEmployee.employee_code}.`);
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
      setConvertFeedback(`${job.title} requisition ${nextStatus.toLowerCase()}.`);
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
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the job opening.');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleCreateCandidate = async (event) => {
    event.preventDefault();
    setWorkflowError('');
    setSavingRecord(true);
    try {
      await createCandidate({ ...candidateForm, job_id: Number(candidateForm.job_id) });
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
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Talent Acquisition
            </span>
            <span className="text-xs text-slate-500 font-medium">ATS pipeline and onboarding conversion</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Recruitment & Applicant Tracking (ATS)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage requisitions, evaluate interview-stage candidates, and convert offered candidates to employee records.
          </p>
        </div>
        {canManageRecruitment && (
          <div className="flex flex-wrap gap-2">
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

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'kanban' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Candidate Pipeline Kanban
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'jobs' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Job Requisitions ({openJobs.length} open)
        </button>
      </div>

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stages.map(stage => {
            const stageCandidates = candidates.filter(c => c.stage === stage);

            return (
              <div key={stage} className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 text-xs">{stage}</h3>
                    <span className="font-mono text-xs bg-white px-2 py-0.5 rounded text-slate-600 font-bold">
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {stageCandidates.map(cand => (
                      <div key={cand.id} className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900">{cand.name}</h4>
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold text-[11px]">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {Number(cand.rating) > 0 ? `${Number(cand.rating).toFixed(1)}/5` : 'Not rated'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{cand.email}</p>
                        {cand.evaluation_note && (
                          <p className="line-clamp-2 text-[11px] text-slate-600">{cand.evaluation_note}</p>
                        )}
                        <div className="text-[10px] text-slate-400 flex justify-between">
                          <span>Notice: {cand.notice_period}</span>
                          <span>CTC: {cand.expected_ctc}</span>
                        </div>

                        {/* Stage actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          {stage === 'Offered' && canManageRecruitment && (
                            <button
                              onClick={() => handleConvertToEmployee(cand)}
                              className="w-full text-center py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] transition"
                            >
                              + Convert to Employee
                            </button>
                          )}
                          {stage !== 'Offered' && stage !== 'Hired' && canManageRecruitment && (
                            <button
                              onClick={() => {
                                const nextStageIndex = stages.indexOf(stage) + 1;
                                if (nextStageIndex < stages.length) handleStageMove(cand.id, stages[nextStageIndex]);
                              }}
                              className="text-teal-600 font-semibold hover:underline text-[11px] inline-flex items-center gap-1"
                            >
                              Advance Stage <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {['Interview', 'Offered'].includes(stage) && canManageRecruitment && (
                            <button
                              onClick={() => openEvaluation(cand)}
                              className="text-teal-600 font-semibold hover:underline text-[11px]"
                            >
                              {Number(cand.rating) > 0 ? 'Update Evaluation' : 'Evaluate'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: ACTIVE REQUISITIONS */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {jobs.map(job => (
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
                  <span className="font-semibold text-slate-800">{job.experience}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Applicants Received</span>
                  <span className="font-bold text-slate-800">{job.applicants_count} Profiles</span>
                </div>
                {canManageRecruitment && (
                  <div className="flex justify-end border-t border-slate-100 pt-2">
                    <Button size="sm" variant="secondary" disabled={savingRecord} onClick={() => handleUpdateJobStatus(job)}>
                      {job.status === 'Open' ? 'Close Requisition' : 'Reopen Requisition'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {jobs.length === 0 && (
            <Card title="No open positions" subtitle="Recruitment records will appear here after they are added to the database." />
          )}
        </div>
      )}

      <Modal
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        title="Add Job Opening"
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
              value={jobForm.title}
              onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
            />
          </label>
          <label className="block font-semibold text-slate-700">
            Department
            <input
              required
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
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
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
              Experience
              <input
                value={jobForm.experience}
                onChange={(event) => setJobForm({ ...jobForm, experience: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setShowJobModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingRecord}>
              {savingRecord ? 'Saving...' : 'Save Opening'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        title={`Interview Evaluation${evaluationCandidate ? ` · ${evaluationCandidate.name}` : ''}`}
        subtitle="Record a separate candidate assessment for Interview or Offered stages."
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
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5"
            >
              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
            </select>
          </label>
          <label className="block font-semibold text-slate-700">
            Evaluation notes
            <textarea
              rows="4"
              maxLength="2000"
              value={evaluationForm.evaluation_note}
              onChange={(event) => setEvaluationForm((previous) => ({ ...previous, evaluation_note: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5"
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

      <Modal
        isOpen={showCandidateModal}
        onClose={() => setShowCandidateModal(false)}
        title="Add Candidate"
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
              {openJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              First name
              <input required value={candidateForm.first_name} onChange={(event) => setCandidateForm({ ...candidateForm, first_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
            <label className="block font-semibold text-slate-700">
              Last name
              <input value={candidateForm.last_name} onChange={(event) => setCandidateForm({ ...candidateForm, last_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
          </div>
          <label className="block font-semibold text-slate-700">
            Email
            <input type="email" required value={candidateForm.email} onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              Phone
              <PhoneInput autoComplete="tel-national" placeholder="Enter 10-digit number" value={candidateForm.phone} onChange={(phone) => setCandidateForm({ ...candidateForm, phone })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
            <label className="block font-semibold text-slate-700">
              Notice period
              <input value={candidateForm.notice_period} onChange={(event) => setCandidateForm({ ...candidateForm, notice_period: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-semibold text-slate-700">
              Current CTC
              <input value={candidateForm.current_ctc} onChange={(event) => setCandidateForm({ ...candidateForm, current_ctc: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
            <label className="block font-semibold text-slate-700">
              Expected CTC
              <input value={candidateForm.expected_ctc} onChange={(event) => setCandidateForm({ ...candidateForm, expected_ctc: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal" />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setShowCandidateModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingRecord}>
              {savingRecord ? 'Saving...' : 'Add Candidate'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
