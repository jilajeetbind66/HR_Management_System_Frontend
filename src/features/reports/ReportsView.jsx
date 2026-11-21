import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FolderGit2,
  Users,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatCard from '../../components/common/StatCard';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const payrollExports = [
  {
    id: 'pf_source_register',
    title: 'PF payroll source data',
    description: 'Recorded PF deductions and employee identifiers',
  },
  {
    id: 'pt_source_register',
    title: 'PT deductions source data',
    description: 'Recorded PT deductions and current employee state',
  },
  {
    id: 'tds_source_register',
    title: 'TDS deductions source data',
    description: 'Recorded TDS deductions and current PAN',
  },
];

function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : '—';
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export default function ReportsView() {
  const { activeBranch } = useAuth();
  const [reports, setReports] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [loadError, setLoadError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');

  const isBranchScoped = Boolean(activeBranch && activeBranch !== 'All Branches');

  useEffect(() => {
    let active = true;

    api.getReportSummary()
      .then((response) => {
        if (!active) return;
        const data = response?.data;
        setReports(data);
        if (data?.payroll?.latest_locked_run?.id) {
          setSelectedRunId(String(data.payroll.latest_locked_run.id));
        }
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message || 'Unable to load reports.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const downloadReport = async (report) => {
    setExportError('');
    setExportNotice('');
    setExporting(report);

    try {
      const response = await api.getReportExport(
        report,
        ['employee_master', 'training_compliance'].includes(report) ? undefined : selectedRunId
      );
      const result = response?.data;
      const allRows = result?.rows;

      if (!Array.isArray(allRows) || allRows.length === 0) {
        setExportError('No matching database records are available for this export.');
        return;
      }

      const rows = isBranchScoped && report === 'employee_master'
        ? allRows.filter((r) => (
            r.branch_name === activeBranch
            || (activeBranch.includes('Prayagraj') && r.branch_name?.includes('Prayagraj'))
            || (activeBranch.includes('Kaushambi') && r.branch_name?.includes('Kaushambi'))
          ))
        : allRows;

      if (rows.length === 0) {
        setExportError(`No matching database records found for ${activeBranch}.`);
        return;
      }

      const columns = Object.keys(rows[0]);
      const csv = [
        columns.map(escapeCsvCell).join(','),
        ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      const period = result.run
        ? `_${result.run.period_year}-${String(result.run.period_month).padStart(2, '0')}`
        : '';
      const branchSuffix = isBranchScoped && report === 'employee_master'
        ? `_${activeBranch.replace(/\s+/g, '_')}`
        : '';
      link.href = url;
      link.download = `${report}${period}${branchSuffix}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      const missingCount = Number(result.missing_identifier_count || 0);
      setExportNotice(
        `${rows.length} record(s) exported${isBranchScoped ? ` for ${activeBranch}` : ''}.${missingCount ? ` ${missingCount} record(s) have a missing identifier.` : ''}`
      );
    } catch (requestError) {
      setExportError(requestError.message || 'Unable to export this report.');
    } finally {
      setExporting('');
    }
  };

  const workforce = reports?.workforce;
  const projects = reports?.projects;
  const payroll = reports?.payroll;
  const training = reports?.training;
  const exports = reports?.exports || {};
  const lockedRuns = payroll?.locked_runs || [];

  const selectedBranchData = isBranchScoped && workforce?.branches
    ? workforce.branches.find((b) => b.name === activeBranch || activeBranch.includes(b.city) || activeBranch.includes(b.name))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">
              Intelligence & Analytics
            </span>
            <span className="text-xs font-medium text-slate-500">Database-backed reports</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">HR Reports & Executive Analytics</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Report data is calculated on the server and limited to the signed-in role.
          </p>
        </div>

        {exports.employee_master && (
          <Button
            variant="primary"
            icon={Download}
            disabled={loading || exporting !== ''}
            onClick={() => downloadReport('employee_master')}
          >
            {exporting === 'employee_master'
              ? 'Exporting…'
              : isBranchScoped
              ? `Export ${selectedBranchData?.city || 'Branch'} Master`
              : 'Export Employee Master'}
          </Button>
        )}
        {exports.training_compliance && (
          <Button
            variant="secondary"
            icon={Download}
            disabled={loading || exporting !== ''}
            onClick={() => downloadReport('training_compliance')}
          >
            {exporting === 'training_compliance' ? 'Exporting…' : 'Export Training Compliance'}
          </Button>
        )}
      </div>

      {loading && (
        <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading reports…
        </p>
      )}
      {training && (
        <Card title="Mandatory Training Compliance by Branch" subtitle="Completed mandatory assignments divided by active mandatory assignments; overdue excludes completed work.">
          {training.branch_compliance.length === 0 ? (
            <p className="text-sm text-slate-600">No mandatory training assignments are available for this reporting scope.</p>
          ) : (
            <div className="space-y-3">
              {training.branch_compliance.map((branch) => (
                <div key={branch.branch_id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{branch.branch_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {branch.completed_count}/{branch.assigned_count} completed · {branch.pending_review_count} awaiting review · {branch.overdue_count} overdue
                    </p>
                  </div>
                  <strong className="text-lg text-teal-700">{branch.compliance_percent}%</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {(loadError || exportError) && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {loadError || exportError}
        </div>
      )}
      {exportNotice && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {exportNotice}
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {workforce && (
              <StatCard
                title={isBranchScoped ? `Headcount (${selectedBranchData?.name || activeBranch})` : "Active Headcount"}
                value={selectedBranchData ? selectedBranchData.active_employee_count : workforce.active_employee_count}
                subvalue={selectedBranchData
                  ? `${selectedBranchData.active_employee_count} of ${workforce.active_employee_count} total staff (${selectedBranchData.share_percent}%)`
                  : `${workforce.total_employee_count} total employee records`}
                trend={isBranchScoped ? `Filtered: ${activeBranch}` : `${workforce.branches.length} branches active`}
                trendPositive={true}
                icon={Users}
                color="indigo"
              />
            )}
            {projects && (
              <StatCard
                title="On-time Milestone Completion"
                value={projects.on_time_completion_rate == null ? '—' : `${projects.on_time_completion_rate}%`}
                subvalue={`${projects.rated_completion_count} completed milestones with dates`}
                icon={FolderGit2}
                color="emerald"
              />
            )}
            {workforce && (
              <StatCard
                title="Average Active Tenure"
                value={workforce.average_tenure_years == null ? '—' : `${workforce.average_tenure_years} Years`}
                subvalue="Based on active employees with a valid joining date"
                icon={Clock}
                color="blue"
              />
            )}
            {payroll && (
              <StatCard
                title="Latest Finalized Gross Payroll"
                value={payroll.latest_locked_run ? formatCurrency(payroll.latest_locked_run.gross_payout_inr) : '—'}
                subvalue={payroll.latest_locked_run?.month_name || 'No finalized payroll run'}
                icon={Banknote}
                color="purple"
              />
            )}
          </div>

          {(workforce || projects) && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {workforce && (
                <Card title="Branch Staff Distribution" subtitle="Active employee counts from the employee database">
                  <div className="space-y-3 text-xs">
                    {workforce.branches.length === 0 && (
                      <p className="text-slate-500">No active employee records are available in this reporting scope.</p>
                    )}
                    {workforce.branches.map((branch) => {
                      const isSelected = isBranchScoped && (
                        branch.name === activeBranch
                        || activeBranch.includes(branch.city)
                        || activeBranch.includes(branch.name)
                      );
                      return (
                        <div
                          key={branch.id}
                          className={`space-y-1 p-2 rounded-lg transition ${
                            isSelected ? 'bg-teal-50 border border-teal-200' : ''
                          }`}
                        >
                          <div className="flex justify-between gap-3 font-semibold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              {branch.name}{branch.city ? ` (${branch.city})` : ''}
                              {isSelected && (
                                <span className="bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  Active Branch
                                </span>
                              )}
                            </span>
                            <span className={isSelected ? 'text-teal-700 font-bold' : ''}>
                              {branch.active_employee_count} staff ({branch.share_percent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isSelected ? 'bg-teal-600' : 'bg-slate-400'
                              }`}
                              style={{ width: `${branch.share_percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {projects && (
                <Card title="Project Milestone Health" subtitle="Assignment-level status and recorded deadlines">
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Active</span>
                        <span className="text-lg font-bold text-slate-800">{projects.active_milestone_count}</span>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <span className="block text-[10px] font-bold uppercase text-emerald-700">Completed</span>
                        <span className="text-lg font-bold text-emerald-700">{projects.completed_milestone_count}</span>
                      </div>
                      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                        <span className="block text-[10px] font-bold uppercase text-rose-700">Overdue</span>
                        <span className="text-lg font-bold text-rose-700">{projects.overdue_milestone_count}</span>
                      </div>
                    </div>
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-600">
                      On-time rate uses completed assignments that have both an actual completion timestamp and an active due date. Records without either date are excluded from that rate.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {exports.pf_source_register && (
            <Card title="Internal Payroll Source Registers" subtitle="Exports use recorded values from finalized payroll runs">
              {lockedRuns.length === 0 ? (
                <p className="text-sm text-slate-600">No finalized payroll runs are available for export.</p>
              ) : (
                <>
                  <label htmlFor="report-payroll-run" className="mb-2 block text-xs font-semibold text-slate-700">
                    Finalized payroll period
                  </label>
                  <select
                    id="report-payroll-run"
                    value={selectedRunId}
                    onChange={(event) => setSelectedRunId(event.target.value)}
                    className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:max-w-md"
                  >
                    {lockedRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.month_name} · {run.scope_key} · {run.total_employees} employees
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {payrollExports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div>
                          <p className="font-bold text-slate-800">{report.title}</p>
                          <p className="text-[10px] text-slate-500">{report.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Download}
                          disabled={!selectedRunId || exporting !== ''}
                          onClick={() => downloadReport(report.id)}
                        >
                          {exporting === report.id ? '…' : 'CSV'}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    These are internal source-data registers, not EPFO ECR, state PT return, or Form 24Q filing formats. Statutory calculations, jurisdiction-specific schemas, and required filing/challan fields are not available in the current data model.
                  </p>
                </>
              )}
            </Card>
          )}
        </>
      )}

      {!loading && !loadError && !workforce && !projects && !payroll && !training && (
        <Card title="Reports unavailable" subtitle="No report data is assigned to this role.">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <BarChart3 className="h-4 w-4" />
            Contact an administrator if you believe this is incorrect.
          </div>
        </Card>
      )}
    </div>
  );
}
