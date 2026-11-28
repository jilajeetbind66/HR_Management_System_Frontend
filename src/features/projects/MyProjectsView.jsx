import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { Award, Calendar, Search, Send, Sliders, Star } from 'lucide-react';
import { calculateProjectWorkingDays } from './ProjectsView';

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

export default function MyProjectsView() {
  const { currentUser } = useAuth();
  const {
    myProjects,
    updateProjectProgress,
    requestExtension,
    submitProjectCompletion,
  } = useHRMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [action, setAction] = useState(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressNote, setProgressNote] = useState('');
  const [requestedDueDate, setRequestedDueDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [deliverableLink, setDeliverableLink] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const projects = useMemo(() => myProjects
    .filter((project) => Number(project.assigned_employee_id) === Number(currentUser.employee_id))
    .filter((project) => (
      !normalizedSearch
      || project.name?.toLowerCase().includes(normalizedSearch)
      || project.project_code?.toLowerCase().includes(normalizedSearch)
    )), [currentUser.employee_id, myProjects, normalizedSearch]);

  const openAction = (project, nextAction) => {
    setSelectedProject(project);
    setAction(nextAction);
    setActionError('');
    setProgressPercent(Number(project.progress_percent) || 0);
    setProgressNote('');
    setRequestedDueDate(nextDate(project.active_due_date || project.planned_end_date || ''));
    setExtensionReason('');
    setSubmissionNote('');
    setDeliverableLink('');
  };

  const closeAction = () => {
    setSelectedProject(null);
    setAction(null);
    setActionError('');
  };

  const handleActionSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProject || !action) return;
    setActionError('');

    if (action === 'progress') {
      const currentBaseline = Number(selectedProject?.progress_percent) || 0;
      const parsed = Number(progressPercent);
      if (isNaN(parsed) || parsed < currentBaseline || parsed > 100) {
        setActionError(`Progress must be between current baseline (${currentBaseline}%) and 100%.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      if (action === 'progress') {
        const currentBaseline = Number(selectedProject?.progress_percent) || 0;
        const validPercent = Math.min(100, Math.max(currentBaseline, Number(progressPercent) || 0));
        await updateProjectProgress(selectedProject.id, validPercent, progressNote);
      } else if (action === 'extension') {
        await requestExtension(selectedProject.id, requestedDueDate, extensionReason);
      } else {
        await submitProjectCompletion(selectedProject.id, submissionNote, deliverableLink);
      }
      closeAction();
    } catch (error) {
      const validationMessage = Object.values(error?.data?.errors || {}).flat()[0];
      setActionError(validationMessage || error?.data?.message || error.message || 'Unable to save this project update.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your assigned projects, delivery progress, and deadlines.
        </p>
      </header>

      <label className="relative block max-w-lg">
        <span className="sr-only">Search my projects</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search my projects"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      {projects.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const hasPendingExtension = project.extensions?.some((extension) => extension.status === 'pending');
            const extensionCounts = (project.extensions || []).reduce((counts, extension) => {
              counts[extension.status] = (counts[extension.status] || 0) + 1;
              return counts;
            }, {});
            return (
            <article key={project.assignment_id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-teal-600">{project.project_code}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{project.name}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                  {(project.status || 'unassigned').replaceAll('_', ' ')}
                </span>
              </div>
              {Boolean(project.is_weekend_emergency) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    🚨 Emergency Weekend Task
                  </span>
                  {project.weekend_benefit_type === 'comp_off' && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      project.benefit_credited_at
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {project.benefit_credited_at ? '✓ +1 Comp-Off Leave Credited' : '🎁 Benefit: +1 Comp-Off Leave on Delivery'}
                    </span>
                  )}
                  {project.weekend_benefit_type === 'allowance' && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      💰 Weekend Allowance: ₹{project.weekend_benefit_amount}
                    </span>
                  )}
                </div>
              )}
              {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
              {project.assigned_by && (
                <p className="mt-2 text-xs text-slate-500">
                  Assigned by <strong className="text-slate-700">{project.assigned_by}</strong>
                  {project.assigned_by_role && ` (${formatRoleLabel(project.assigned_by_role)})`}
                </p>
              )}
              {project.deliverable && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <strong className="text-slate-800">Target deliverable: </strong>
                  {project.deliverable}
                </p>
              )}
              {project.review_note && (
                <p className="mt-3 whitespace-pre-line rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <strong>
                    {project.returned_by
                      ? `Revision Instructions${project.returned_by ? ` (${project.returned_by})` : ''}`
                      : `Reviewer Feedback${project.accepted_by ? ` (${project.accepted_by})` : ''}`}:{' '}
                  </strong>
                  {project.review_note}
                </p>
              )}
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{project.progress_percent || 0}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.min(100, Math.max(0, Number(project.progress_percent) || 0))}%` }}
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
                          <p className="mt-1 text-slate-600">Decision remarks: {extension.decision_note}</p>
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
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <div>
                  <dt className="text-slate-400 font-bold uppercase text-[10px]">Start date</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{project.start_date || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-bold uppercase text-[10px]">Active deadline</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{project.active_due_date || project.planned_end_date || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-bold uppercase text-[10px]">Working Days Effort</dt>
                  <dd className="mt-1 font-bold text-teal-800">
                    {calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency))?.workingDays ?? '—'} Working Days
                    {calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency))?.sundaysCount > 0 && (
                      <span className="block text-[10px] font-normal text-slate-500">
                        ({calculateProjectWorkingDays(project.start_date, project.active_due_date || project.planned_end_date, Boolean(project.is_weekend_emergency)).sundaysCount} Sun off excluded)
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Extensions: {extensionCounts.pending || 0} pending · {extensionCounts.approved || 0} approved · {extensionCounts.rejected || 0} rejected
              </p>

              {project.status === 'completed' && (project.delivery_timeliness || project.appreciation_rating || project.appreciation_badge || project.appreciation_note) && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-amber-50/50 p-3 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {project.delivery_timeliness === 'early' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold">
                          ⚡ Early Delivery ({project.days_ahead_or_late}d ahead)
                        </span>
                      )}
                      {project.delivery_timeliness === 'on_time' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 text-white px-2.5 py-0.5 text-[10px] font-bold">
                          ✅ On-Time Delivery
                        </span>
                      )}
                      {project.appreciation_badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold">
                          <Award className="h-3 w-3 text-amber-600" />
                          {project.appreciation_badge}
                        </span>
                      )}
                    </div>
                    {project.appreciation_rating && (
                      <div className="flex items-center gap-0.5" title={`${project.appreciation_rating}/5 Stars`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${star <= Number(project.appreciation_rating) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {project.appreciation_note && (
                    <p className="text-[11px] text-slate-700 italic">
                      "{project.appreciation_note}"
                      {project.appreciated_by && (
                        <span className="not-italic text-slate-500 font-semibold"> — {project.appreciated_by}</span>
                      )}
                    </p>
                  )}
                </div>
              )}
              {(currentUser.role === 'super_admin'
                || Number(project.assigned_employee_id) === Number(currentUser.employee_id))
                && !['completed', 'cancelled'].includes(project.status) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {['in_progress', 'overdue'].includes(project.status) && (
                      <>
                        <Button size="sm" variant="secondary" icon={Sliders} onClick={() => openAction(project, 'progress')}>
                          Update Progress
                        </Button>
                        <Button size="sm" variant="secondary" icon={Calendar} disabled={hasPendingExtension} onClick={() => openAction(project, 'extension')}>
                          Request Extension
                        </Button>
                        <Button size="sm" variant="primary" icon={Send} onClick={() => openAction(project, 'completion')}>
                          Submit Completion
                        </Button>
                      </>
                    )}
                    {project.status === 'under_review' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        Deliverable Submitted — Awaiting Review
                      </span>
                    )}
                  </div>
                )}
            </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold text-slate-800">
            {normalizedSearch ? 'No matching projects' : 'No projects assigned yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {normalizedSearch
              ? 'Try another project name or project code.'
              : 'Your assigned projects will appear here.'}
          </p>
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedProject && action)}
        onClose={closeAction}
        title={
          action === 'progress' ? 'Update Project Progress'
            : action === 'extension' ? 'Request Deadline Extension'
              : 'Submit Project Completion'
        }
        subtitle={selectedProject?.name}
      >
        <form onSubmit={handleActionSubmit} className="space-y-4">
          {action === 'progress' && (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>Progress percentage</span>
                  <span className="font-bold text-teal-600">{progressPercent === '' ? 0 : progressPercent}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={Number(selectedProject?.progress_percent) || 0}
                    max="100"
                    step="1"
                    value={progressPercent === '' ? (Number(selectedProject?.progress_percent) || 0) : Number(progressPercent)}
                    onChange={(event) => setProgressPercent(Number(event.target.value))}
                    className="flex-1 accent-teal-600 cursor-pointer"
                  />
                  <div className="relative w-24">
                    <input
                      type="number"
                      min={Number(selectedProject?.progress_percent) || 0}
                      max="100"
                      required
                      value={progressPercent}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === '') {
                          setProgressPercent('');
                          return;
                        }
                        const num = Number(raw);
                        if (num > 100) {
                          setProgressPercent(100);
                        } else if (num < 0) {
                          setProgressPercent(0);
                        } else {
                          setProgressPercent(num);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-center text-sm font-semibold text-slate-800 focus:border-teal-500 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                  <span>Current baseline: {selectedProject?.progress_percent || 0}%</span>
                  <span>Target: 100% (cannot exceed 100%)</span>
                </div>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Progress note
                <textarea
                  required
                  value={progressNote}
                  onChange={(event) => setProgressNote(event.target.value)}
                  placeholder="Describe progress, updates, deliverables or milestone status..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows="3"
                />
              </label>
            </>
          )}

          {action === 'extension' && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Requested deadline
                <input
                  type="date"
                  required
                  min={nextDate(selectedProject?.active_due_date || selectedProject?.planned_end_date || '')}
                  value={requestedDueDate}
                  onChange={(event) => setRequestedDueDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Reason
                <textarea
                  required
                  value={extensionReason}
                  onChange={(event) => setExtensionReason(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows="3"
                />
              </label>
            </>
          )}

          {action === 'completion' && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Completion notes
                <textarea
                  required
                  value={submissionNote}
                  onChange={(event) => setSubmissionNote(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows="3"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Deliverable link (optional)
                <input
                  type="url"
                  value={deliverableLink}
                  onChange={(event) => setDeliverableLink(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </>
          )}

          {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={submitting} onClick={closeAction}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save update'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
