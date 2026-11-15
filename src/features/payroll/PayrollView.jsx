import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import {
  Banknote,
  FileText,
  Lock,
  ShieldCheck,
  Plus,
  Receipt
} from 'lucide-react';

const PAYROLL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PayrollView() {
  const { currentUser } = useAuth();
  const {
    payrollRuns,
    runPayroll,
    lockPayroll,
    refreshPayrollRuns,
    branches
  } = useHRMS();

  const [activeTab, setActiveTab] = useState('runs'); // 'runs' | 'structures' | 'statutory'
  const [selectedRun, setSelectedRun] = useState(null);
  const [runPayslips, setRunPayslips] = useState([]);
  const [deductionDrafts, setDeductionDrafts] = useState({});
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [savingPayslipId, setSavingPayslipId] = useState(null);
  const [payslipError, setPayslipError] = useState('');
  const [showRunWizard, setShowRunWizard] = useState(false);
  const [wizardMonth, setWizardMonth] = useState('January');
  const [wizardYear, setWizardYear] = useState(new Date().getFullYear());
  const [wizardScope, setWizardScope] = useState('company');
  const [workflowError, setWorkflowError] = useState('');
  const [savingPayroll, setSavingPayroll] = useState(false);

  const canManagePayroll = ['super_admin', 'payroll_admin'].includes(currentUser.role);

  const handleStartPayroll = async (e) => {
    e.preventDefault();
    setWorkflowError('');
    setSavingPayroll(true);
    try {
      await runPayroll(wizardMonth, wizardYear, wizardScope);
      setShowRunWizard(false);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the payroll run.');
    } finally {
      setSavingPayroll(false);
    }
  };

  const handleLockRun = async (runId) => {
    setWorkflowError('');
    try {
      await lockPayroll(runId);
      setSelectedRun(null);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to lock the payroll run.');
    }
  };

  const handleOpenPayslips = async (run) => {
    setSelectedRun(run);
    setRunPayslips([]);
    setDeductionDrafts({});
    setPayslipError('');
    setLoadingPayslips(true);
    try {
      const response = await api.getPayrollRunPayslips(run.id);
      const slips = Array.isArray(response?.data) ? response.data : [];
      setRunPayslips(slips);
      setDeductionDrafts(Object.fromEntries(slips.map(slip => [slip.id, {
        professional_tax: String(slip.professional_tax ?? ''),
        tds: String(slip.tds ?? ''),
      }])));
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to load payroll payslips.');
    } finally {
      setLoadingPayslips(false);
    }
  };

  const handleReviewPayslip = async (payslip) => {
    const draft = deductionDrafts[payslip.id];
    setPayslipError('');
    setSavingPayslipId(payslip.id);
    try {
      const response = await api.reviewPayrollPayslip(selectedRun.id, payslip.id, {
        professional_tax: draft?.professional_tax,
        tds: draft?.tds,
      });
      setRunPayslips(current => current.map(item => item.id === payslip.id ? response.data : item));
      try {
        await refreshPayrollRuns();
      } catch {
        setPayslipError('The deductions were saved, but payroll totals could not refresh. Reload the page before finalizing.');
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to save reviewed deductions.');
    } finally {
      setSavingPayslipId(null);
    }
  };

  const pendingPayslips = runPayslips.filter(payslip => !payslip.deductions_confirmed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
              Finance & Compensation
            </span>
            <span className="text-xs text-slate-500 font-medium">Statutory Payroll & Compliance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">India Statutory Payroll & Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review stored salary records and configured PF/ESI amounts; verify PT and TDS before publishing employee payslips.
          </p>
        </div>

        {canManagePayroll && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowRunWizard(true)}
          >
            Generate Monthly Payroll Run
          </Button>
        )}
      </div>

      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {workflowError}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('runs')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'runs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Banknote className="w-4 h-4" /> Monthly Payroll Cycles ({payrollRuns.length})
        </button>

        <button
          onClick={() => setActiveTab('structures')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'structures' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" /> CTC Structure & Component Master
        </button>

        <button
          onClick={() => setActiveTab('statutory')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'statutory' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Indian Statutory Config (EPFO / ESIC / PT)
        </button>
      </div>

      {/* TAB 1: PAYROLL RUNS */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          {payrollRuns.length === 0 ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No payroll runs have been generated yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {payrollRuns.map(run => {
                const isLocked = run.status === 'locked';

                return (
                  <Card
                    key={run.id}
                    title={`${run.month_name} Payroll Run`}
                    subtitle={`Scope: ${run.scope_key}`}
                    action={
                      <Badge variant={isLocked ? 'success' : 'warning'} size="sm">
                        {isLocked ? <><Lock className="w-3 h-3 inline mr-1" /> Finalized & Published</> : 'In Review'}
                      </Badge>
                    }
                  >
                    <div className="space-y-4 text-xs">
                      {/* Numbers Grid */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Payout</span>
                          <span className="font-bold text-slate-800 text-sm">₹{run.gross_payout_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            {Number(run.pending_deductions_count) > 0 ? 'Deductions so far' : 'Total Deductions'}
                          </span>
                          <span className="font-bold text-rose-600 text-sm">₹{run.total_deductions_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            {Number(run.pending_deductions_count) > 0 ? 'Net estimate' : 'Net Salary'}
                          </span>
                          <span className="font-bold text-emerald-600 text-sm">₹{run.net_payout_inr?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>Total Employees: <strong>{run.total_employees}</strong></span>
                        {!isLocked && <span>Awaiting PT/TDS review: <strong>{run.pending_deductions_count || 0}</strong></span>}
                        {run.approved_by && <span>Approved by: <strong>{run.approved_by}</strong></span>}
                      </div>

                      {/* Actions */}
                      {canManagePayroll && (
                        <div className="pt-3 border-t border-slate-100">
                          <Button
                            size="sm"
                            variant={isLocked ? 'secondary' : 'primary'}
                            icon={isLocked ? FileText : Lock}
                            onClick={() => handleOpenPayslips(run)}
                          >
                            {isLocked ? 'View Published Payslips' : 'Review Employee Payslips'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALARY CTC BREAKUP MASTER */}
      {activeTab === 'structures' && (
        <Card title="Salary Structure Review" subtitle="Salary components are sourced from the employee compensation master.">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Earnings Breakdown */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Earnings Components
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">Basic Salary</strong>
                      <p className="text-[10px] text-slate-400">Configured in the employee compensation master</p>
                    </div>
                    <Badge variant="primary" size="sm">Configured</Badge>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">House Rent Allowance (HRA)</strong>
                      <p className="text-[10px] text-slate-400">Derived from the stored salary structure for this payroll run</p>
                    </div>
                    <Badge variant="neutral" size="sm">Configured</Badge>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">Special Allowance</strong>
                      <p className="text-[10px] text-slate-400">Balancing residual component, fully taxable</p>
                    </div>
                    <Badge variant="neutral" size="sm">Residual</Badge>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Statutory Deductions
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">Employees' Provident Fund (EPF)</strong>
                      <p className="text-[10px] text-slate-400">12% employee contribution + 12% employer matching</p>
                    </div>
                    <Badge variant="danger" size="sm">12% Basic</Badge>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">Employees' State Insurance (ESIC)</strong>
                      <p className="text-[10px] text-slate-400">0.75% Employee + 3.25% Employer (Gross ≤ ₹21,000)</p>
                    </div>
                    <Badge variant="danger" size="sm">0.75% Gross</Badge>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">Professional Tax (PT)</strong>
                      <p className="text-[10px] text-slate-400">Payroll must enter the verified state-specific amount</p>
                    </div>
                    <Badge variant="warning" size="sm">Review required</Badge>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
                    <div>
                      <strong className="text-slate-800">TDS (Tax Deducted at Source)</strong>
                      <p className="text-[10px] text-slate-400">Payroll must enter the employee's reviewed monthly TDS</p>
                    </div>
                    <Badge variant="warning" size="sm">Review required</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: STATUTORY CONFIGURATION */}
      {activeTab === 'statutory' && (
        <Card title="Statutory Deduction Review" subtitle="State and tax-regime values require payroll review before publication.">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">TDS and Professional Tax are not auto-calculated.</p>
            <p className="mt-1 text-xs leading-relaxed">
              Enter the reviewed employee-specific amounts in each payroll run. The server blocks finalization until every payslip is confirmed.
              PF and ESI use the employee's configured eligibility and stored salary amounts.
            </p>
          </div>
        </Card>
      )}

      {/* GENERATE RUN MODAL WIZARD */}
      <Modal
        isOpen={showRunWizard}
        onClose={() => setShowRunWizard(false)}
        title="Initialize Monthly Payroll Run"
        subtitle="Architecture Section 7.2: Unique period_year, period_month, scope_key"
      >
        <form onSubmit={handleStartPayroll} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period Month:</label>
              <select
                value={wizardMonth}
                onChange={(e) => setWizardMonth(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                {PAYROLL_MONTHS.map(month => <option key={month} value={month}>{month}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period Year:</label>
              <input
                type="number"
                min="2000"
                max="2100"
                required
                value={wizardYear}
                onChange={(e) => setWizardYear(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Execution Scope:</label>
            <select
              value={wizardScope}
              onChange={(e) => setWizardScope(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="company">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={`branch:${branch.id}`}>{branch.name} only</option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900">
            <p className="font-semibold">Payroll review workflow:</p>
            <p className="text-[11px] mt-0.5">
              Salary and configured PF/ESI amounts are saved as payslips. Enter verified PT/TDS amounts for every employee before finalizing and publishing.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowRunWizard(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingPayroll}>
              {savingPayroll ? 'Saving...' : 'Launch Payroll Calculation'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={`${selectedRun?.month_name || 'Payroll'} Payslips`}
        subtitle="Review employee-level amounts. Only finalized runs are visible to employees."
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          {payslipError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {payslipError}
            </div>
          )}
          {loadingPayslips && <p role="status" className="text-sm text-slate-500">Loading payslips…</p>}
          {!loadingPayslips && runPayslips.length === 0 && !payslipError && (
            <p role="status" className="text-sm text-slate-500">No payslip records exist for this run.</p>
          )}
          {runPayslips.map(payslip => {
            const draft = deductionDrafts[payslip.id] || { professional_tax: '', tds: '' };
            const estimatedDeductions = Number(payslip.pf_employee)
              + Number(payslip.esi_employee)
              + Number(draft.professional_tax || 0)
              + Number(draft.tds || 0);

            return (
              <article key={payslip.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{payslip.first_name} {payslip.last_name}</h4>
                    <p className="text-xs text-slate-500">{payslip.employee_code} · {payslip.designation}</p>
                  </div>
                  <Badge variant={payslip.deductions_confirmed ? 'success' : 'warning'} size="sm">
                    {payslip.deductions_confirmed ? 'Deductions reviewed' : 'Review required'}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Gross', payslip.gross_salary],
                    ['Basic', payslip.basic_salary],
                    ['HRA', payslip.hra],
                    ['Special allowance', payslip.special_allowance],
                    ['Employee PF', payslip.pf_employee],
                    ['Employee ESI', payslip.esi_employee],
                    ['Total deductions', estimatedDeductions],
                    ['Estimated net', Number(payslip.gross_salary) - estimatedDeductions],
                  ].map(([label, amount]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-2">
                      <span className="block text-slate-500">{label}</span>
                      <strong className="mt-0.5 block text-slate-900">
                        ₹{Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  ))}
                </div>

                {canManagePayroll && selectedRun?.status !== 'locked' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                    <label className="flex-1 text-xs font-medium text-slate-700">
                      Verified Professional Tax (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={draft.professional_tax}
                        onChange={event => setDeductionDrafts(current => ({
                          ...current,
                          [payslip.id]: { ...draft, professional_tax: event.target.value },
                        }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <label className="flex-1 text-xs font-medium text-slate-700">
                      Verified TDS (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={draft.tds}
                        onChange={event => setDeductionDrafts(current => ({
                          ...current,
                          [payslip.id]: { ...draft, tds: event.target.value },
                        }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={savingPayslipId === payslip.id}
                      onClick={() => handleReviewPayslip(payslip)}
                    >
                      {savingPayslipId === payslip.id
                        ? 'Saving…'
                        : payslip.deductions_confirmed ? 'Update reviewed amounts' : 'Confirm deductions'}
                    </Button>
                  </div>
                )}
              </article>
            );
          })}

          {canManagePayroll && selectedRun?.status !== 'locked' && runPayslips.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-600">
                {pendingPayslips
                  ? `${pendingPayslips} payslip${pendingPayslips === 1 ? '' : 's'} still need deduction confirmation.`
                  : 'All employee deductions are confirmed and ready for publication.'}
              </p>
              <Button
                type="button"
                variant="primary"
                icon={Lock}
                disabled={pendingPayslips > 0}
                onClick={() => handleLockRun(selectedRun.id)}
              >
                Finalize & Publish Payslips
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
