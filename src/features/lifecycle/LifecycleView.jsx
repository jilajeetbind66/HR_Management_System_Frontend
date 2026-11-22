import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCheck,
  UserCheck,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowRight,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
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
  const { employees = [], refreshEmployees } = useHRMS();
  const { currentUser } = useAuth();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isHr = ['hr_admin', 'hr_executive'].includes(currentUser?.role);
  const isManager = currentUser?.role === 'manager';
  const canInitiateCase = isSuperAdmin || isHr;

  const [activeTab, setActiveTab] = useState('onboarding'); // 'onboarding' | 'offboarding'
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [taskDrafts, setTaskDrafts] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState(() => initialForm());
  const [showInitiateForm, setShowInitiateForm] = useState(isHr); // Open for HR, collapsed for Super Admin

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

  const activeOnboardings = useMemo(
    () => cases.filter((c) => c.case_type === 'onboarding' && c.status === 'active'),
    [cases]
  );

  const activeOffboardings = useMemo(
    () => cases.filter((c) => c.case_type === 'offboarding' && c.status === 'active'),
    [cases]
  );

  const pendingClearanceTasksCount = useMemo(() => {
    return cases
      .filter((c) => c.status === 'active')
      .flatMap((c) => c.tasks || [])
      .filter((t) => !['completed', 'waived'].includes(t.status)).length;
  }, [cases]);

  // Exiting employees whose 5 department tasks are all completed/waived, awaiting Owner final sign-off
  const readyForRelievingCases = useMemo(() => {
    return cases.filter((c) => {
      if (c.case_type !== 'offboarding' || c.status !== 'active') return false;
      const tasks = c.tasks || [];
      if (tasks.length === 0) return false;
      return tasks.every((t) => ['completed', 'waived'].includes(t.status));
    });
  }, [cases]);

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
      if (!isHr) setShowInitiateForm(false);
      await refreshEmployees?.();
      setFeedback({ type: 'success', text: `${form.case_type === 'onboarding' ? 'Onboarding journey' : 'Offboarding case'} and departmental checklist saved.` });
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
      setFeedback({ type: 'success', text: `Department task "${task.title}" updated successfully.` });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleRelieveEmployee = async (lifecycleCase) => {
    if (!window.confirm(
      `Are you sure you want to approve final exit and officially relieve ${lifecycleCase.first_name} ${lifecycleCase.last_name}? Their employment status will be set to inactive.`
    )) {
      return;
    }
    setSaving(true);
    setFeedback(null);

    try {
      const response = await api.relieveLifecycleCase(lifecycleCase.id);
      setCases((previous) => previous.map((c) => (
        Number(c.id) === Number(response.data.id) ? response.data : c
      )));
      await refreshEmployees?.();
      setFeedback({
        type: 'success',
        text: `Employee ${lifecycleCase.employee_code} (${lifecycleCase.first_name} ${lifecycleCase.last_name}) officially relieved. Employment status set to inactive.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const canEditTask = (task) => {
    if (isSuperAdmin || isHr) return true;
    if (isManager && task.department === 'Manager') return true;
    return false;
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
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Executive Lifecycle Desk
                </>
              ) : isManager ? (
                <>
                  <Users className="w-3.5 h-3.5 text-teal-600" /> Team Operations
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-teal-600" /> People Operations
                </>
              )}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {isSuperAdmin
                ? 'Onboarding velocity, clearance bottlenecks & final exit sign-off'
                : isManager
                ? 'Departmental onboarding goals & exit handovers'
                : 'Onboarding journeys and offboarding clearances'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {isSuperAdmin
              ? 'Employee Lifecycle & Exit Governance'
              : isManager
              ? 'Team Lifecycle & Department Sign-Offs'
              : 'Employee Lifecycle & Clearances'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdmin
              ? 'Track 30-day onboarding milestones, monitor departmental clearance bottlenecks, and provide final sign-off to relieve exiting employees.'
              : isManager
              ? 'Conduct 1-on-1 onboarding goal setting for new joiners and sign off on knowledge transfer (KT) for exiting employees.'
              : 'Initiate new joiner induction checklists, track departmental tasks, and process employee resignations.'}
          </p>
        </div>

        {canInitiateCase && !isHr && (
          <button
            type="button"
            onClick={() => setShowInitiateForm(!showInitiateForm)}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium px-3.5 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            {showInitiateForm ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showInitiateForm ? 'Hide Intake Form' : 'Direct Case Intake'}
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {feedback.text}
        </div>
      )}

      {/* Top Executive KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Onboardings */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Onboardings</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeOnboardings.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">30-day induction journeys</p>
          </div>
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Resignations on Notice */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resignations on Notice</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeOffboardings.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Active notice periods</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Department Bottlenecks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pending Tasks</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{pendingClearanceTasksCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across HR, IT, Mgr & Finance</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Awaiting Owner Relieving */}
        <div
          className={`p-4 rounded-xl border shadow-xs flex items-center justify-between transition ${
            readyForRelievingCases.length > 0
              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  readyForRelievingCases.length > 0 ? 'text-amber-800' : 'text-slate-500'
                }`}
              >
                Owner Final Exit Sign-Off
              </p>
              {readyForRelievingCases.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p
              className={`text-2xl font-black mt-1 ${
                readyForRelievingCases.length > 0 ? 'text-amber-900' : 'text-slate-900'
              }`}
            >
              {readyForRelievingCases.length}
            </p>
            <p
              className={`text-[11px] mt-0.5 ${
                readyForRelievingCases.length > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'
              }`}
            >
              {readyForRelievingCases.length > 0 ? 'All clearances cleared · Ready to relieve' : 'No exits awaiting sign-off'}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${
              readyForRelievingCases.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-500'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* High-Priority Final Exit Sign-Off Alert (Visible when an employee is ready for relieving) */}
      {(isSuperAdmin || isHr) && readyForRelievingCases.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-amber-200 text-amber-900">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Employees Awaiting Final Relieving & Exit Sign-Off ({readyForRelievingCases.length})
                </h2>
                <p className="text-xs text-slate-600">
                  All 5 departmental clearances (Manager KT, IT Assets, Finance No-Dues, Admin, HR) are completed. Sign off to officially relieve the employee and set their employment status to inactive.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readyForRelievingCases.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-xl p-4 border border-amber-300 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {cand.employee_code} — {cand.first_name} {cand.last_name}
                      </h3>
                      <p className="text-xs text-slate-500">Last working date: {displayDate(cand.effective_date)}</p>
                    </div>
                    <Badge variant="warning" size="sm">
                      Ready for Relieving
                    </Badge>
                  </div>

                  {cand.reason && (
                    <p className="mt-2 text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                      "{cand.reason}"
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      ✓ Manager KT Cleared
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      ✓ IT Assets Recovered
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      ✓ Finance No-Dues
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      ✓ Admin & HR Cleared
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRelieveEmployee(cand)}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saving ? 'Processing...' : '✓ Approve Final Exit & Relieve Employee'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs overflow-x-auto whitespace-nowrap" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'onboarding'}
          onClick={() => changeType('onboarding')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'onboarding'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" /> New Joiner Induction ({activeOnboardings.length} Active)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'offboarding'}
          onClick={() => changeType('offboarding')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'offboarding'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Resignation & Clearances ({activeOffboardings.length} Active)
          {readyForRelievingCases.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              {readyForRelievingCases.length} Ready
            </span>
          )}
        </button>
      </div>

      {/* Case Creation Form (Prominent for HR Admin, Collapsible for Super Admin) */}
      {canInitiateCase && showInitiateForm && (
        <Card
          title={activeTab === 'onboarding' ? 'Start an onboarding checklist' : 'Record a resignation'}
          subtitle="Creating a case generates the standard department checklist. For resignations, employee status automatically moves to On Notice."
          action={
            !isHr ? (
              <button
                type="button"
                onClick={() => setShowInitiateForm(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close Form ✕
              </button>
            ) : null
          }
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
                  {employees
                    .filter((employee) => ['active', 'on_notice'].includes(employee.status))
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employee_code} — {employeeName(employee)} ({employee.department || 'General'})
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
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      effective_date: event.target.value,
                      target_completion_date:
                        activeTab === 'offboarding'
                          ? event.target.value
                          : previous.target_completion_date && previous.target_completion_date < event.target.value
                          ? event.target.value
                          : previous.target_completion_date,
                    }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                Checklist target date
                <input
                  type="date"
                  min={form.effective_date}
                  value={form.target_completion_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      target_completion_date: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            {activeTab === 'offboarding' && form.notice_date && form.effective_date && (
              <p className="text-xs text-slate-500 font-medium">
                Notice duration:{' '}
                {Math.max(
                  0,
                  Math.round(
                    (new Date(`${form.effective_date}T00:00:00`) - new Date(`${form.notice_date}T00:00:00`)) / 86400000
                  )
                )}{' '}
                days
              </p>
            )}

            <label className="block text-xs font-medium text-slate-700">
              Reason / context (optional)
              <textarea
                rows={2}
                maxLength={2000}
                placeholder={
                  activeTab === 'onboarding'
                    ? 'e.g. Campus recruit induction - Documentation, IT assets & role orientation'
                    : 'e.g. Higher studies / Relocation - 30 days notice period'
                }
                value={form.reason}
                onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <button
              type="submit"
              disabled={saving || employees.length === 0}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : activeTab === 'onboarding' ? 'Create onboarding checklist' : 'Create offboarding case'}
            </button>
          </form>
        </Card>
      )}

      {/* Case List */}
      <Card
        title={activeTab === 'onboarding' ? 'Onboarding Induction Checklists' : 'Offboarding Clearances & Sign-Offs'}
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
              const allDone = tasks.length > 0 && closedTasks === tasks.length;
              const noticeDays = lifecycleCase.notice_date
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(`${lifecycleCase.effective_date}T00:00:00`) -
                        new Date(`${lifecycleCase.notice_date}T00:00:00`)) /
                        86400000
                    )
                  )
                : null;

              return (
                <details key={lifecycleCase.id} className="rounded-lg border border-slate-200 bg-white" open={lifecycleCase.status === 'active'}>
                  <summary className="cursor-pointer list-none p-4 hover:bg-slate-50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-800">
                            {lifecycleCase.employee_code} — {lifecycleCase.first_name} {lifecycleCase.last_name}
                          </p>
                          {lifecycleCase.status === 'active' && allDone && lifecycleCase.case_type === 'offboarding' && (
                            <Badge variant="warning" size="sm">
                              All Clearances Done · Ready to Relieve
                            </Badge>
                          )}
                        </div>
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
                        <span className="text-xs text-slate-500 font-medium">
                          {closedTasks}/{tasks.length} tasks
                        </span>
                      </div>
                    </div>
                    <progress
                      className="mt-3 h-1.5 w-full accent-teal-600"
                      value={closedTasks}
                      max={Math.max(tasks.length, 1)}
                      aria-label={`${closedTasks} of ${tasks.length} tasks complete`}
                    />
                  </summary>

                  {lifecycleCase.reason && (
                    <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600 bg-slate-50/50">
                      <span className="font-semibold text-slate-700">Context:</span> {lifecycleCase.reason}
                    </p>
                  )}

                  {/* Super Admin 1-Click Relieving Button inside card if all clearances done */}
                  {isSuperAdmin && lifecycleCase.status === 'active' && allDone && lifecycleCase.case_type === 'offboarding' && (
                    <div className="border-t border-amber-200 bg-amber-50/80 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-amber-900 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All 5 departmental clearances are complete. You can now officially relieve this employee.</span>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRelieveEmployee(lifecycleCase)}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs transition flex items-center gap-1 shrink-0"
                      >
                        ✓ Sign-Off & Relieve
                      </button>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {tasks.map((task) => {
                      const draft = taskDrafts[task.id] || { status: task.status, notes: task.notes || '' };
                      const editable = canEditTask(task) && lifecycleCase.status === 'active';
                      const isMyAction = (isManager && task.department === 'Manager') || (isHr && task.department === 'HR');

                      return (
                        <div key={task.id} className={`grid gap-3 p-4 md:grid-cols-[1fr_180px] ${isMyAction ? 'bg-teal-50/20' : ''}`}>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                {task.department}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle(draft.status)}`}>
                                {draft.status.replace('_', ' ')}
                              </span>
                              {isMyAction && (
                                <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 border border-teal-200 px-1.5 py-0.2 rounded">
                                  Your Sign-Off
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-800">{task.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">Due {displayDate(task.due_date)}</p>
                            <label className="mt-2.5 block text-xs font-medium text-slate-600">
                              Notes {draft.status === 'waived' && <span className="text-rose-600 font-semibold">(required to waive)</span>}
                              <textarea
                                rows={2}
                                maxLength={2000}
                                disabled={!editable}
                                value={draft.notes}
                                placeholder={editable ? "Add department sign-off notes..." : "No notes recorded"}
                                onChange={(event) => updateTaskDraft(task, { notes: event.target.value })}
                                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 font-normal"
                              />
                            </label>
                          </div>
                          <div className="flex flex-col justify-end gap-2">
                            <label className="text-xs font-medium text-slate-600">
                              Status
                              <select
                                disabled={!editable}
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
                            {editable && (
                              <button
                                type="button"
                                disabled={savingTaskId === task.id}
                                onClick={() => saveTask(task)}
                                className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 transition shadow-2xs"
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
