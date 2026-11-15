import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck, UserCheck } from 'lucide-react';
import Card from '../../components/common/Card';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateAfter(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

function initialForm(caseType = 'onboarding') {
  const today = localDate();
  const effectiveDate = caseType === 'offboarding' ? dateAfter(today, 30) : today;

  return {
    employee_id: '',
    case_type: caseType,
    notice_date: caseType === 'offboarding' ? today : '',
    effective_date: effectiveDate,
    target_completion_date: caseType === 'offboarding' ? effectiveDate : dateAfter(today, 30),
    reason: '',
  };
}

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.message || 'The request could not be completed.';
}

function displayDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function employeeName(employee) {
  return `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
}

function statusStyle(status) {
  if (status === 'completed' || status === 'waived') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status === 'in_progress') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export default function LifecycleView() {
  const { employees = [] } = useHRMS();
  const { currentUser } = useAuth();
  const canManage = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const [activeTab, setActiveTab] = useState('onboarding');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [taskDrafts, setTaskDrafts] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState(() => initialForm());

  useEffect(() => {
    let active = true;
    api.getLifecycleCases()
      .then((response) => {
        if (active) setCases(Array.isArray(response?.data) ? response.data : []);
      })
      .catch((error) => {
        if (active) setFeedback({ type: 'error', text: errorText(error) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCases = useMemo(
    () => cases.filter((lifecycleCase) => lifecycleCase.case_type === activeTab),
    [activeTab, cases]
  );
  const activeCount = visibleCases.filter((lifecycleCase) => lifecycleCase.status === 'active').length;
  const completedCount = visibleCases.filter((lifecycleCase) => lifecycleCase.status === 'completed').length;

  const changeType = (caseType) => {
    setActiveTab(caseType);
    setForm(initialForm(caseType));
    setFeedback(null);
  };

  const submitCase = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await api.createLifecycleCase({
        ...form,
        employee_id: Number(form.employee_id),
        notice_date: form.case_type === 'offboarding' ? form.notice_date : null,
        target_completion_date: form.target_completion_date || null,
        reason: form.reason.trim() || null,
      });
      setCases((previous) => [response.data, ...previous]);
      setActiveTab(form.case_type);
      setForm(initialForm(form.case_type));
      setFeedback({ type: 'success', text: 'Lifecycle case and checklist tasks were saved.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const updateTaskDraft = (task, updates) => {
    setTaskDrafts((previous) => ({
      ...previous,
      [task.id]: {
        status: previous[task.id]?.status ?? task.status,
        notes: previous[task.id]?.notes ?? task.notes ?? '',
        ...updates,
      },
    }));
  };

  const saveTask = async (task) => {
    const draft = taskDrafts[task.id] || { status: task.status, notes: task.notes || '' };
    setSavingTaskId(task.id);
    setFeedback(null);

    try {
      const response = await api.updateLifecycleTask(task.id, draft.status, draft.notes);
      setCases((previous) => previous.map((lifecycleCase) => (
        Number(lifecycleCase.id) === Number(response.data.id) ? response.data : lifecycleCase
      )));
      setTaskDrafts((previous) => {
        const next = { ...previous };
        delete next[task.id];
        return next;
      });
      setFeedback({ type: 'success', text: 'Clearance task updated.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
            People Operations
          </span>
          <span className="text-xs text-slate-500 font-medium">Onboarding journeys and offboarding clearances</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Employee Lifecycle &amp; Clearances</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track 30-day onboarding milestones, notice dates, last working dates, and department sign-offs.
        </p>
      </div>

      <div className="border-b border-slate-200 flex items-center gap-4 text-xs" role="tablist" aria-label="Lifecycle case type">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'onboarding'}
          onClick={() => changeType('onboarding')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'onboarding' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" /> New Joiner Induction
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'offboarding'}
          onClick={() => changeType('offboarding')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'offboarding' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Resignation &amp; Clearances
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {canManage && (
        <Card
          title={activeTab === 'onboarding' ? 'Start an onboarding checklist' : 'Record a resignation'}
          subtitle="Creating a case generates the standard department checklist. It does not change the employee's employment status."
        >
          <form className="space-y-4" onSubmit={submitCase}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Employee
                <select
                  required
                  value={form.employee_id}
                  onChange={(event) => setForm((previous) => ({ ...previous, employee_id: event.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_code} — {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </label>

              {activeTab === 'offboarding' && (
                <label className="text-xs font-medium text-slate-700">
                  Notice submitted on
                  <input
                    required
                    type="date"
                    value={form.notice_date}
                    max={form.effective_date}
                    onChange={(event) => setForm((previous) => ({ ...previous, notice_date: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              )}

              <label className="text-xs font-medium text-slate-700">
                {activeTab === 'onboarding' ? 'Joining date' : 'Last working date'}
                <input
                  required
                  type="date"
                  value={form.effective_date}
                  onChange={(event) => setForm((previous) => ({
                    ...previous,
                    effective_date: event.target.value,
                    target_completion_date: activeTab === 'offboarding'
                      ? event.target.value
                      : previous.target_completion_date,
                  }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Checklist target date
                <input
                  type="date"
                  min={form.effective_date}
                  value={form.target_completion_date}
                  onChange={(event) => setForm((previous) => ({
                    ...previous,
                    target_completion_date: event.target.value,
                  }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            {activeTab === 'offboarding' && form.notice_date && form.effective_date && (
              <p className="text-xs text-slate-500">
                Notice duration: {Math.max(0, Math.round(
                  (new Date(`${form.effective_date}T00:00:00`) - new Date(`${form.notice_date}T00:00:00`)) / 86400000
                ))} days
              </p>
            )}

            <label className="block text-xs font-medium text-slate-700">
              Reason / context (optional)
              <textarea
                rows={2}
                maxLength={2000}
                value={form.reason}
                onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={saving || employees.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : activeTab === 'onboarding' ? 'Create onboarding checklist' : 'Create offboarding case'}
            </button>
          </form>
        </Card>
      )}

      <Card
        title={activeTab === 'onboarding' ? 'Onboarding checklists' : 'Offboarding clearances'}
        subtitle={`${activeCount} active · ${completedCount} completed`}
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading lifecycle cases…</p>
        ) : visibleCases.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No {activeTab} cases have been added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleCases.map((lifecycleCase) => {
              const tasks = lifecycleCase.tasks || [];
              const closedTasks = tasks.filter((task) => ['completed', 'waived'].includes(task.status)).length;
              const noticeDays = lifecycleCase.notice_date
                ? Math.max(0, Math.round(
                  (new Date(`${lifecycleCase.effective_date}T00:00:00`)
                    - new Date(`${lifecycleCase.notice_date}T00:00:00`)) / 86400000
                ))
                : null;

              return (
                <details key={lifecycleCase.id} className="rounded-lg border border-slate-200 bg-white" open={false}>
                  <summary className="cursor-pointer list-none p-4 hover:bg-slate-50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">
                          {lifecycleCase.employee_code} — {lifecycleCase.first_name} {lifecycleCase.last_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeTab === 'onboarding' ? 'Joining' : 'Last working'} date: {displayDate(lifecycleCase.effective_date)}
                          {noticeDays !== null && ` · ${noticeDays}-day notice`}
                          {' · '}Target: {displayDate(lifecycleCase.target_completion_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(lifecycleCase.status)}`}>
                          {lifecycleCase.status}
                        </span>
                        <span className="text-xs text-slate-500">{closedTasks}/{tasks.length} tasks</span>
                      </div>
                    </div>
                    <progress
                      className="mt-3 h-1.5 w-full accent-indigo-600"
                      value={closedTasks}
                      max={Math.max(tasks.length, 1)}
                      aria-label={`${closedTasks} of ${tasks.length} tasks complete`}
                    />
                  </summary>

                  {lifecycleCase.reason && (
                    <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                      <span className="font-semibold">Context:</span> {lifecycleCase.reason}
                    </p>
                  )}

                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {tasks.map((task) => {
                      const draft = taskDrafts[task.id] || { status: task.status, notes: task.notes || '' };
                      const locked = !canManage || lifecycleCase.status !== 'active';

                      return (
                        <div key={task.id} className="grid gap-3 p-4 md:grid-cols-[1fr_180px]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{task.department}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle(draft.status)}`}>
                                {draft.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-800">{task.title}</p>
                            <p className="mt-1 text-xs text-slate-500">Due {displayDate(task.due_date)}</p>
                            <label className="mt-3 block text-xs font-medium text-slate-600">
                              Notes {draft.status === 'waived' && <span className="text-rose-600">(required to waive)</span>}
                              <textarea
                                rows={2}
                                maxLength={2000}
                                disabled={locked}
                                value={draft.notes}
                                onChange={(event) => updateTaskDraft(task, { notes: event.target.value })}
                                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                              />
                            </label>
                          </div>
                          <div className="flex flex-col justify-end gap-2">
                            <label className="text-xs font-medium text-slate-600">
                              Status
                              <select
                                disabled={locked}
                                value={draft.status}
                                onChange={(event) => updateTaskDraft(task, { status: event.target.value })}
                                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In progress</option>
                                <option value="completed">Completed</option>
                                <option value="waived">Waived</option>
                              </select>
                            </label>
                            {canManage && lifecycleCase.status === 'active' && (
                              <button
                                type="button"
                                disabled={savingTaskId === task.id}
                                onClick={() => saveTask(task)}
                                className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                              >
                                {savingTaskId === task.id ? 'Saving…' : 'Save task'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
