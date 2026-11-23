import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const emptyObjective = {
  title: '',
  description: '',
  weight_percent: '',
  key_result_titles: [''],
};

function currentDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.message || 'The request could not be completed.';
}

function formatDate(value) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : '—';
}

function cycleLabel(cycle) {
  return `Q${cycle.quarter} ${cycle.year}`;
}

function statusStyle(status) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'submitted') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'returned') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function normalizePerformance(response) {
  return {
    cycles: Array.isArray(response?.data?.cycles) ? response.data.cycles : [],
    objectives: Array.isArray(response?.data?.objectives) ? response.data.objectives : [],
  };
}

export default function PerformanceView() {
  const { currentUser } = useAuth();
  const [performance, setPerformance] = useState({ cycles: [], objectives: [] });
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [cycleForm, setCycleForm] = useState({
    year: new Date().getFullYear(),
    quarter: currentQuarter(),
  });
  const [objectiveForm, setObjectiveForm] = useState(emptyObjective);
  const [editingObjectiveId, setEditingObjectiveId] = useState(null);
  const [editingSelfRatingId, setEditingSelfRatingId] = useState(null);
  const [editingManagerRatingId, setEditingManagerRatingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [progressDrafts, setProgressDrafts] = useState({});
  const activeRef = useRef(true);

  const refreshPerformance = useCallback(async () => {
    const response = await api.getPerformance();
    const next = normalizePerformance(response);
    if (!activeRef.current) return next;

    setPerformance(next);
    setSelectedCycleId((previous) => {
      if (previous && next.cycles.some((cycle) => String(cycle.id) === previous)) return previous;
      const openCycle = next.cycles.find((cycle) => cycle.status === 'open');
      return openCycle ? String(openCycle.id) : (next.cycles[0] ? String(next.cycles[0].id) : '');
    });

    return next;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    refreshPerformance()
      .catch((error) => setFeedback({ type: 'error', text: errorText(error) }))
      .finally(() => {
        if (activeRef.current) setLoading(false);
      });

    return () => {
      activeRef.current = false;
    };
  }, [refreshPerformance]);

  const role = currentUser?.role;
  const isSuperAdmin = role === 'super_admin';
  const isManager = role === 'manager';
  const canCreateCycle = isSuperAdmin;
  const canCreateObjectives = ['employee', 'manager'].includes(role) && Boolean(currentUser?.employee_id);
  const selectedCycle = performance.cycles.find((cycle) => String(cycle.id) === selectedCycleId) || null;
  const today = currentDate();
  const isGoalWindowOpen = selectedCycle
    && selectedCycle.status === 'open'
    && selectedCycle.starts_on <= today
    && selectedCycle.ends_on >= today;
  const hasCycleEnded = selectedCycle && selectedCycle.ends_on < today;

  const cycleObjectives = useMemo(
    () => performance.objectives.filter((objective) => String(objective.cycle_id) === selectedCycleId),
    [performance.objectives, selectedCycleId]
  );
  const ownCycleObjectives = cycleObjectives.filter(
    (objective) => Number(objective.employee_id) === Number(currentUser?.employee_id)
  );
  const hasSubmittedGoals = ownCycleObjectives.some(
    (objective) => ['submitted', 'approved'].includes(objective.status)
  );
  const editableOwnGoals = ownCycleObjectives.filter(
    (objective) => ['draft', 'returned'].includes(objective.status)
  );
  const ownWeightTotal = ownCycleObjectives.reduce(
    (total, objective) => total + Number(objective.weight_percent || 0),
    0
  );
  const otherObjectivesWeight = ownCycleObjectives
    .filter((objective) => objective.id !== editingObjectiveId)
    .reduce((total, objective) => total + Number(objective.weight_percent || 0), 0);
  const remainingWeight = Math.max(0, Math.round((100 - otherObjectivesWeight) * 100) / 100);
  const canSubmitOwnGoals = isGoalWindowOpen
    && editableOwnGoals.length > 0
    && Math.abs(ownWeightTotal - 100) < 0.001;

  const withFeedback = async (operationKey, operation, successMessage) => {
    setBusy(operationKey);
    setFeedback(null);
    try {
      await operation();
      await refreshPerformance();
      setFeedback({ type: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusy('');
    }
  };

  const createCycle = (event) => {
    event.preventDefault();
    withFeedback('cycle', async () => {
      const response = await api.createPerformanceCycle(
        Number(cycleForm.year),
        Number(cycleForm.quarter)
      );
      setSelectedCycleId(String(response.data.id));
    }, 'Quarterly performance cycle created.');
  };

  const updateObjectiveForm = (field, value) => {
    setObjectiveForm((previous) => ({ ...previous, [field]: value }));
  };

  const updateKeyResultTitle = (index, value) => {
    setObjectiveForm((previous) => ({
      ...previous,
      key_result_titles: previous.key_result_titles.map((title, currentIndex) => (
        currentIndex === index ? value : title
      )),
    }));
  };

  const saveObjective = (event) => {
    event.preventDefault();
    const weightVal = Number(objectiveForm.weight_percent);
    if (isNaN(weightVal) || weightVal <= 0 || weightVal > 100) {
      setFeedback({ type: 'error', text: 'Weight must be greater than 0% and at most 100%.' });
      return;
    }
    const projectedTotal = Math.round((otherObjectivesWeight + weightVal) * 100) / 100;
    if (projectedTotal > 100.0) {
      setFeedback({
        type: 'error',
        text: `Total objective weights cannot exceed 100% for this cycle. Remaining available weight is ${remainingWeight.toFixed(2)}%.`,
      });
      return;
    }

    const payload = {
      title: objectiveForm.title.trim(),
      description: objectiveForm.description.trim() || null,
      weight_percent: weightVal,
      key_results: objectiveForm.key_result_titles
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => ({ title })),
    };

    withFeedback('objective', async () => {
      if (editingObjectiveId) {
        await api.updatePerformanceObjective(editingObjectiveId, payload);
      } else {
        await api.createPerformanceObjective(selectedCycleId, payload);
      }
      setObjectiveForm(emptyObjective);
      setEditingObjectiveId(null);
    }, editingObjectiveId ? 'Objective updated.' : 'Objective saved as a draft.');
  };

  const editObjective = (objective) => {
    setEditingObjectiveId(objective.id);
    setObjectiveForm({
      title: objective.title,
      description: objective.description || '',
      weight_percent: String(objective.weight_percent),
      key_result_titles: objective.key_results?.length
        ? objective.key_results.map((keyResult) => keyResult.title)
        : [''],
    });
    setFeedback(null);
  };

  const deleteObjective = (objective) => {
    if (!window.confirm('Delete this unsent objective draft?')) return;
    withFeedback(`delete:${objective.id}`, () => api.deletePerformanceObjective(objective.id), 'Draft objective deleted.');
  };

  const reviewObjective = (objective, decision) => {
    const note = reviewNotes[objective.id] || '';
    withFeedback(`review:${objective.id}`, () => (
      api.reviewPerformanceObjective(objective.id, decision, note)
    ), decision === 'approved' ? 'Objective approved.' : 'Objective returned with feedback.');
  };

  const saveKeyResultProgress = (keyResult) => {
    const progress = Number(progressDrafts[keyResult.id] ?? keyResult.progress_percent);
    withFeedback(`progress:${keyResult.id}`, () => (
      api.updatePerformanceKeyResultProgress(keyResult.id, progress)
    ), 'Key result progress saved.');
  };

  const saveSelfReview = (objective) => {
    const draft = ratingDrafts[objective.id] || {};
    withFeedback(`self-rating:${objective.id}`, () => (
      api.submitPerformanceSelfReview(
        objective.id,
        Number(draft.self_rating ?? objective.self_rating ?? 3),
        draft.self_review_note ?? objective.self_review_note ?? ''
      )
    ), 'Self-rating saved.');
  };

  const saveManagerReview = (objective) => {
    const draft = ratingDrafts[objective.id] || {};
    withFeedback(`manager-rating:${objective.id}`, () => (
      api.submitPerformanceManagerReview(
        objective.id,
        Number(draft.manager_rating ?? objective.manager_rating ?? 3),
        draft.manager_review_note ?? objective.manager_review_note ?? ''
      )
    ), 'Manager rating saved.');
  };

  const submitObjectives = () => {
    withFeedback('submit-objectives', () => (
      api.submitPerformanceObjectives(selectedCycleId)
    ), 'Objective set submitted to the manager.');
  };

  const closeCycle = () => {
    if (!window.confirm('Close this cycle? Ratings and progress will become read-only.')) return;
    withFeedback(`close:${selectedCycleId}`, () => (
      api.closePerformanceCycle(selectedCycleId)
    ), 'Performance cycle closed.');
  };

  const cycleProgress = ownCycleObjectives.reduce(
    (total, objective) => total + (Number(objective.weight_percent) * Number(objective.progress_percent || 0)) / 100,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">
            Talent &amp; Development
          </span>
          <span className="text-xs font-medium text-slate-500">Quarterly objectives and reviews</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Performance Management &amp; OKRs</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Employees draft weighted objectives and key results; managers review team goals and record separate ratings.
        </p>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {canCreateCycle && (
        <Card title="Quarterly Review Cycle" subtitle="Super Admin opens calendar-quarter review periods.">
          <form onSubmit={createCycle} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-xs font-semibold text-slate-700">
              Year
              <input
                type="number"
                min="2000"
                max="2100"
                required
                value={cycleForm.year}
                onChange={(event) => setCycleForm((previous) => ({ ...previous, year: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-32"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Quarter
              <select
                value={cycleForm.quarter}
                onChange={(event) => setCycleForm((previous) => ({ ...previous, quarter: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-36"
              >
                {[1, 2, 3, 4].map((quarter) => (
                  <option key={quarter} value={quarter}>Q{quarter}</option>
                ))}
              </select>
            </label>
            <Button type="submit" icon={Plus} disabled={busy !== ''}>
              Create Cycle
            </Button>
          </form>
        </Card>
      )}

      <Card title="Review Period" subtitle="Goal weights must total 100% before an employee can submit objectives.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label htmlFor="performance-cycle" className="text-xs font-semibold text-slate-700">
            Quarterly cycle
            <select
              id="performance-cycle"
              value={selectedCycleId}
              onChange={(event) => setSelectedCycleId(event.target.value)}
              disabled={performance.cycles.length === 0}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:min-w-72"
            >
              {performance.cycles.length === 0 && <option value="">No review cycles yet</option>}
              {performance.cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycleLabel(cycle)} · {cycle.status} · {formatDate(cycle.starts_on)}–{formatDate(cycle.ends_on)}
                </option>
              ))}
            </select>
          </label>
          {selectedCycle && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className={`rounded-full border px-2.5 py-1 font-semibold ${statusStyle(selectedCycle.status)}`}>
                {selectedCycle.status}
              </span>
              {canCreateCycle && selectedCycle.status === 'open' && hasCycleEnded && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== ''}
                  onClick={closeCycle}
                >
                  Close Cycle
                </Button>
              )}
            </div>
          )}
        </div>
        {selectedCycle && ownCycleObjectives.length > 0 && (
          <p className="mt-3 text-xs text-slate-600">
            Your weighted progress across this cycle: <strong>{Math.round(cycleProgress)}%</strong>
          </p>
        )}
      </Card>

      {loading && (
        <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading performance records…
        </p>
      )}

      {!loading && !selectedCycle && (
        <Card title="No review cycle is available" subtitle="A Super Admin must open a quarterly cycle before goals can be recorded.">
          <p className="py-4 text-center text-sm text-slate-500">
            No objectives or ratings have been created.
          </p>
        </Card>
      )}

      {!loading && selectedCycle && canCreateObjectives && isGoalWindowOpen
        && (!hasSubmittedGoals || Boolean(editingObjectiveId)) && (
        <Card
          title={editingObjectiveId ? 'Edit Returned Objective' : 'Draft an Objective'}
          subtitle="Add at least one key result. Objective weights must total 100% before submission."
        >
          <form onSubmit={saveObjective} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                Objective
                <input
                  required
                  maxLength="255"
                  value={objectiveForm.title}
                  onChange={(event) => updateObjectiveForm('title', event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="What outcome will you deliver?"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Weight (%)
                <input
                  required
                  type="number"
                  min="0.01"
                  max={remainingWeight > 0 ? remainingWeight : 100}
                  step="0.01"
                  value={objectiveForm.weight_percent}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '') {
                      updateObjectiveForm('weight_percent', '');
                      return;
                    }
                    const num = Number(raw);
                    if (num > 100) {
                      updateObjectiveForm('weight_percent', 100);
                    } else if (num < 0) {
                      updateObjectiveForm('weight_percent', 0);
                    } else {
                      updateObjectiveForm('weight_percent', raw);
                    }
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-500">
                  Remaining available: <strong>{remainingWeight.toFixed(2)}%</strong> (Max: 100%)
                </span>
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Description
              <textarea
                rows="2"
                maxLength="5000"
                value={objectiveForm.description}
                onChange={(event) => updateObjectiveForm('description', event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Key results</p>
              {objectiveForm.key_result_titles.map((title, index) => (
                <label key={index} className="sr-only" htmlFor={`key-result-${index}`}>
                  Key result {index + 1}
                </label>
              ))}
              {objectiveForm.key_result_titles.map((title, index) => (
                <div key={`input-${index}`} className="flex gap-2">
                  <input
                    id={`key-result-${index}`}
                    required
                    maxLength="255"
                    value={title}
                    onChange={(event) => updateKeyResultTitle(index, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder={`Key result ${index + 1}`}
                  />
                  {objectiveForm.key_result_titles.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove key result ${index + 1}`}
                      onClick={() => setObjectiveForm((previous) => ({
                        ...previous,
                        key_result_titles: previous.key_result_titles.filter((_, currentIndex) => currentIndex !== index),
                      }))}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
              {objectiveForm.key_result_titles.length < 10 && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setObjectiveForm((previous) => ({
                    ...previous,
                    key_result_titles: [...previous.key_result_titles, ''],
                  }))}
                >
                  Add Key Result
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== ''}>
                {editingObjectiveId ? 'Save Changes' : 'Save Draft'}
              </Button>
              {editingObjectiveId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingObjectiveId(null);
                    setObjectiveForm(emptyObjective);
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>

          {editableOwnGoals.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-600">
                  Current weight total: <strong className={ownWeightTotal > 100 ? 'text-rose-600' : 'text-slate-900'}>{ownWeightTotal.toFixed(2)}%</strong>
                  {Math.abs(ownWeightTotal - 100) >= 0.001 && (
                    <span className={ownWeightTotal > 100 ? 'font-semibold text-rose-600' : 'text-amber-700'}>
                      {ownWeightTotal > 100
                        ? ` — Exceeds 100% by ${(ownWeightTotal - 100).toFixed(2)}% (must equal 100% to submit)`
                        : ` — ${(100 - ownWeightTotal).toFixed(2)}% remaining (must equal 100% to submit)`}
                    </span>
                  )}
                </p>
                {!hasSubmittedGoals && (
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    disabled={!canSubmitOwnGoals || busy !== ''}
                    onClick={submitObjectives}
                  >
                    Submit Objectives
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {selectedCycle && canCreateObjectives && !isGoalWindowOpen && selectedCycle.status === 'open' && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {selectedCycle.starts_on > today
            ? `Objective entry opens on ${formatDate(selectedCycle.starts_on)}.`
            : 'Objective entry has ended. Self-ratings open after the quarter end date.'}
        </p>
      )}

      {selectedCycle && canCreateObjectives && hasSubmittedGoals && isGoalWindowOpen && editableOwnGoals.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">
            Returned drafts can be edited and resubmitted. Existing submitted or approved objectives are locked.
            Current total: <strong>{ownWeightTotal.toFixed(2)}%</strong>.
          </p>
          <Button
            variant="secondary"
            disabled={!canSubmitOwnGoals || busy !== ''}
            onClick={submitObjectives}
          >
            Resubmit Returned Objectives
          </Button>
        </div>
      )}

      <Card
        title="Objectives and Key Results"
        subtitle={selectedCycle
          ? `${cycleLabel(selectedCycle)} · ${cycleObjectives.length} objective(s) in your authorized view`
          : 'Select a quarterly cycle to view goals.'}
      >
        {cycleObjectives.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No objectives are recorded for this cycle and reporting scope.
          </p>
        ) : (
          <div className="space-y-4">
            {cycleObjectives.map((objective) => {
              const isOwner = Number(objective.employee_id) === Number(currentUser?.employee_id);
              const isDirectReport = objective.reporting_manager_id
                ? Number(objective.reporting_manager_id) === Number(currentUser?.employee_id)
                : false;
              // Direct reporting manager (or Super Admin only for their direct executive reports) can review & rate
              const canReviewThisObjective = (isManager && isDirectReport) || (isSuperAdmin && isDirectReport);
              const objectiveBusy = busy !== '' && (
                busy.endsWith(`:${objective.id}`)
                || busy === 'objective'
                || busy === 'submit-objectives'
              );
              const draft = ratingDrafts[objective.id] || {};
              const canEditThisObjective = isOwner
                && ['draft', 'returned'].includes(objective.status)
                && selectedCycle.status === 'open'
                && isGoalWindowOpen;

              return (
                <article key={objective.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">{objective.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(objective.status)}`}>
                          {objective.status}
                        </span>
                        <span className="text-xs font-semibold text-teal-700">{Number(objective.weight_percent)}% weight</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {objective.first_name} {objective.last_name} · {objective.employee_code}
                      </p>
                      {objective.description && <p className="mt-2 text-sm text-slate-700">{objective.description}</p>}
                    </div>
                    {canEditThisObjective && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Pencil}
                          onClick={() => editObjective(objective)}
                        >
                          Edit
                        </Button>
                        {!hasSubmittedGoals && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            aria-label="Delete draft objective"
                            disabled={objectiveBusy}
                            onClick={() => deleteObjective(objective)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {objective.manager_note && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Manager feedback: {objective.manager_note}
                    </p>
                  )}

                  <div className="mt-4 space-y-3">
                    {objective.key_results.map((keyResult) => {
                      const progress = Number(progressDrafts[keyResult.id] ?? keyResult.progress_percent);
                      const canUpdateProgress = isOwner
                        && objective.status === 'approved'
                        && isGoalWindowOpen;
                      return (
                        <div key={keyResult.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-medium text-slate-800">{keyResult.title}</span>
                            <span className="text-xs font-semibold text-slate-600">{keyResult.progress_percent}%</span>
                          </div>
                          {canUpdateProgress && (
                            <div className="mt-2 flex items-center gap-3">
                              <label className="sr-only" htmlFor={`progress-${keyResult.id}`}>Key result progress</label>
                              <input
                                id={`progress-${keyResult.id}`}
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={progress}
                                onChange={(event) => setProgressDrafts((previous) => ({
                                  ...previous,
                                  [keyResult.id]: event.target.value,
                                }))}
                                className="w-full accent-teal-600"
                              />
                              <span className="w-12 text-right text-xs text-slate-600">{progress}%</span>
                              {String(progress) !== String(keyResult.progress_percent) && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy !== ''}
                                  onClick={() => saveKeyResultProgress(keyResult)}
                                >
                                  Save
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Self-Rating Block */}
                    <div className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-bold text-slate-700">
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          {isOwner ? 'Self-rating' : 'Employee Rating'}
                        </p>
                        {isOwner && objective.self_rating != null && (
                          <button
                            type="button"
                            onClick={() => setEditingSelfRatingId(editingSelfRatingId === objective.id ? null : objective.id)}
                            className="text-[11px] text-teal-600 hover:text-teal-800 font-medium"
                          >
                            {editingSelfRatingId === objective.id ? 'Cancel' : 'Edit'}
                          </button>
                        )}
                      </div>

                      {objective.self_rating == null ? (
                        <p className="mt-1 text-xs text-slate-500">Not submitted</p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {objective.self_rating}/5
                          {objective.self_review_note ? ` · ${objective.self_review_note}` : ''}
                        </p>
                      )}

                      {isOwner && objective.status === 'approved' && selectedCycle.status === 'open' && (objective.self_rating == null || editingSelfRatingId === objective.id) && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                          <label className="block text-xs text-slate-600">
                            Rating (1–5)
                            <select
                              value={draft.self_rating ?? objective.self_rating ?? 3}
                              onChange={(event) => setRatingDrafts((previous) => ({
                                ...previous,
                                [objective.id]: { ...previous[objective.id], self_rating: event.target.value },
                              }))}
                              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                            >
                              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                            </select>
                          </label>
                          <label className="block text-xs text-slate-600">
                            Self-review note
                            <textarea
                              rows="2"
                              maxLength="2000"
                              value={draft.self_review_note ?? objective.self_review_note ?? ''}
                              onChange={(event) => setRatingDrafts((previous) => ({
                                ...previous,
                                [objective.id]: { ...previous[objective.id], self_review_note: event.target.value },
                              }))}
                              className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5"
                            />
                          </label>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy !== ''}
                            onClick={async () => {
                              await saveSelfReview(objective);
                              setEditingSelfRatingId(null);
                            }}
                          >
                            Save Self-rating
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Manager-Rating Block */}
                    <div className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-bold text-slate-700">
                          <ClipboardList className="h-3.5 w-3.5 text-teal-500" /> Manager-rating
                        </p>
                        {canReviewThisObjective && objective.manager_rating != null && (
                          <button
                            type="button"
                            onClick={() => setEditingManagerRatingId(editingManagerRatingId === objective.id ? null : objective.id)}
                            className="text-[11px] text-teal-600 hover:text-teal-800 font-medium"
                          >
                            {editingManagerRatingId === objective.id ? 'Cancel' : 'Edit'}
                          </button>
                        )}
                      </div>

                      {objective.manager_rating == null ? (
                        <p className="mt-1 text-xs text-slate-500">Not submitted</p>
                      ) : (
                        <div className="mt-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {objective.manager_rating}/5
                            {objective.manager_review_note ? ` · ${objective.manager_review_note}` : ''}
                          </p>
                          {objective.manager_rated_by_name && (
                            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                              Evaluated by {objective.manager_rated_by_name}
                            </p>
                          )}
                        </div>
                      )}

                      {canReviewThisObjective
                        && objective.status === 'approved'
                        && selectedCycle.status === 'open'
                        && objective.self_rating != null
                        && (objective.manager_rating == null || editingManagerRatingId === objective.id) && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                            <label className="block text-xs text-slate-600">
                              Rating (1–5)
                              <select
                                value={draft.manager_rating ?? objective.manager_rating ?? 3}
                                onChange={(event) => setRatingDrafts((previous) => ({
                                  ...previous,
                                  [objective.id]: { ...previous[objective.id], manager_rating: event.target.value },
                                }))}
                                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                              >
                                {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                              </select>
                            </label>
                            <label className="block text-xs text-slate-600">
                              Manager-review note
                              <textarea
                                rows="2"
                                maxLength="2000"
                                value={draft.manager_review_note ?? objective.manager_review_note ?? ''}
                                onChange={(event) => setRatingDrafts((previous) => ({
                                  ...previous,
                                  [objective.id]: { ...previous[objective.id], manager_review_note: event.target.value },
                                }))}
                                className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5"
                              />
                            </label>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy !== ''}
                              onClick={async () => {
                                await saveManagerReview(objective);
                                setEditingManagerRatingId(null);
                              }}
                            >
                              Save Manager-rating
                            </Button>
                          </div>
                        )}
                    </div>
                  </div>

                  {canReviewThisObjective && objective.status === 'submitted' && selectedCycle.status === 'open' && (
                    <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Manager feedback
                        <textarea
                          rows="2"
                          maxLength="2000"
                          value={reviewNotes[objective.id] || ''}
                          onChange={(event) => setReviewNotes((previous) => ({
                            ...previous,
                            [objective.id]: event.target.value,
                          }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          disabled={busy !== ''}
                          onClick={() => reviewObjective(objective, 'approved')}
                        >
                          Approve Objective
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy !== '' || !(reviewNotes[objective.id] || '').trim()}
                          onClick={() => reviewObjective(objective, 'returned')}
                        >
                          Return with Note
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {selectedCycle && (
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          Employee self-ratings and manager ratings use separate 1–5 scales; the system does not combine them into a performance score. HR roles do not have access to this module.
        </p>
      )}
    </div>
  );
}
