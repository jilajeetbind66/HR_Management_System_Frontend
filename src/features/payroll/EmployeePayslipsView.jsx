import React, { useEffect, useState } from 'react';
import { Download, FileText, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import api from '../../services/api';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatAmount(value) {
  return currency.format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? '—').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function buildPrintDocument(payslip) {
  const employeeName = `${payslip.first_name} ${payslip.last_name}`;
  const componentEarnings = Array.isArray(payslip.component_breakdown?.earnings)
    ? payslip.component_breakdown.earnings
    : [
      { name: 'Basic Salary', amount: payslip.basic_salary },
      { name: 'House Rent Allowance', amount: payslip.hra },
      { name: 'Special Allowance', amount: payslip.special_allowance },
    ];
  const employerCosts = Array.isArray(payslip.component_breakdown?.employer_costs)
    ? payslip.component_breakdown.employer_costs
    : [];
  const earnings = [
    ['Gross Salary', payslip.gross_salary],
    ...(Number(payslip.custom_bonus || 0) > 0 ? [[payslip.custom_bonus_label || 'Custom Bonus / Incentive', payslip.custom_bonus]] : []),
    ...componentEarnings.map(component => [component.name, component.amount]),
  ];
  const employerCostEntries = [
    ...employerCosts.map(component => [component.name, component.amount]),
    ['Total employer cost', payslip.employer_cost_total],
    ['Monthly CTC', payslip.total_ctc_monthly],
    ['Annual CTC', payslip.ctc_annual],
  ];
  const deductions = [
    ['Employee Provident Fund (12%)', payslip.pf_employee],
    ['Employee State Insurance', payslip.esi_employee],
    ['Professional Tax', payslip.professional_tax],
    ['Tax Deducted at Source (TDS)', payslip.tds],
    ...(Number(payslip.late_penalty_amount || 0) > 0 ? [[`Late Arrival Penalty (${payslip.late_count_summary || 'Policy Violation'})`, payslip.late_penalty_amount]] : []),
    ...(Number(payslip.lop_deduction || 0) > 0 ? [[`Leave Without Pay / LOP (${Number(payslip.lop_days || 0)} days)`, payslip.lop_deduction]] : []),
    ...(Number(payslip.other_penalty_amount || 0) > 0 ? [[`Other Penalties & Fines (${payslip.other_penalty_reason || 'Disciplinary'})`, payslip.other_penalty_amount]] : []),
    ['Total Deductions', payslip.total_deductions],
  ];
  const rows = entries => entries.map(([label, amount]) => (
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatAmount(amount))}</td></tr>`
  )).join('');

  const paymentStatusHtml = payslip.payment_status === 'paid'
    ? `<span style="color:#047857;font-weight:bold">Paid on ${escapeHtml(payslip.paid_at ? new Date(payslip.paid_at).toLocaleDateString() : '')} via ${escapeHtml(payslip.payment_mode || 'Bank Transfer')} ${payslip.payment_reference ? `(Ref: ${escapeHtml(payslip.payment_reference)})` : ''}</span>`
    : '<span style="color:#b45309;font-weight:bold">Unpaid / Processing</span>';

  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(payslip.month_name)} Payslip</title>
        <style>
          body{font:14px Arial,sans-serif;color:#172033;margin:40px auto;max-width:760px}
          header{border-bottom:2px solid #172033;margin-bottom:24px;padding-bottom:16px}
          h1{font-size:22px;margin:0 0 6px}p{margin:5px 0;color:#475569}
          .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin:24px 0}
          table{border-collapse:collapse;width:100%;margin:16px 0}
          th,td{border-bottom:1px solid #dbe1ea;padding:10px;text-align:left}
          td{text-align:right;font-variant-numeric:tabular-nums}
          .net{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;font-size:18px;font-weight:700}
          @media print{body{margin:0;max-width:none}}
        </style>
      </head>
      <body>
        <header><h1>Salary Payslip</h1><p>${escapeHtml(payslip.month_name)}</p></header>
        <section class="meta">
          <div><strong>Employee:</strong> ${escapeHtml(employeeName)}</div>
          <div><strong>Employee code:</strong> ${escapeHtml(payslip.employee_code)}</div>
          <div><strong>Designation:</strong> ${escapeHtml(payslip.designation)}</div>
          <div><strong>Period:</strong> ${escapeHtml(payslip.period_month)}/${escapeHtml(payslip.period_year)}</div>
          <div style="grid-column:1 / -1"><strong>Payment Status:</strong> ${paymentStatusHtml}</div>
        </section>
        <table><tbody>${rows(earnings)}</tbody></table>
        <h2>Employer cost information (not deducted from employee pay)</h2>
        <table><tbody>${rows(employerCostEntries)}</tbody></table>
        <h2>Itemized Deductions & Penalties</h2>
        <table><tbody>${rows(deductions)}</tbody></table>
        <p class="net">Net salary: ${escapeHtml(formatAmount(payslip.net_salary))}</p>
        <p>Confidential employee document. All deductions and penalties are calculated per official HRMS policies.</p>
      </body>
    </html>`;
}

function printPayslip(payslip, onError) {
  const printWindow = window.open('', '_blank', 'width=800,height=700');
  if (!printWindow) {
    onError('Allow pop-ups to print or save this payslip as a PDF.');
    return;
  }

  printWindow.addEventListener('load', () => printWindow.print(), { once: true });
  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(payslip));
  printWindow.document.close();
  printWindow.focus();
}

export default function EmployeePayslipsView() {
  const { currentUser } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [printError, setPrintError] = useState('');

  useEffect(() => {
    if (!currentUser?.employee_id) {
      setError('This account is not linked to an employee record.');
      setIsLoading(false);
      return undefined;
    }

    let active = true;

    api.getMyPayslips()
      .then(response => {
        if (active) setPayslips(Array.isArray(response?.data) ? response.data : []);
      })
      .catch(requestError => {
        if (active) setError(requestError?.data?.message || requestError.message || 'Unable to load your payslips.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.employee_id]);

  return (
    <div className="space-y-6">
      <header>
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Employee self-service</span>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">My Payslips</h1>
        <p className="mt-1 text-sm text-slate-600">
          View and print only your finalized salary statements. Payroll publishes each slip after deduction review.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {printError && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {printError}
        </div>
      )}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading your finalized payslips…</p>}
      {!isLoading && !error && payslips.length === 0 && (
        <Card title="No payslips available">
          <p className="text-sm text-slate-600">
            Finalized payslips will appear here after Payroll reviews and publishes your monthly run.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {payslips.map(payslip => {
          const componentBreakdown = payslip.component_breakdown || {};
          const componentEarnings = Array.isArray(componentBreakdown.earnings) ? componentBreakdown.earnings : [];
          const employerCosts = Array.isArray(componentBreakdown.employer_costs) ? componentBreakdown.employer_costs : [];
          return (
          <Card
            key={payslip.id}
            title={payslip.month_name}
            subtitle={`${payslip.employee_code} · ${payslip.designation}`}
            action={<Badge variant={payslip.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
              {payslip.payment_status === 'paid' ? '✓ Paid' : 'Finalized'}
            </Badge>}
          >
            {/* Payment Disbursement Information */}
            {payslip.payment_status === 'paid' ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Salary Disbursed via {payslip.payment_mode || 'Bank Transfer'}</span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  <span>Paid on: <strong>{payslip.paid_at ? payslip.paid_at.slice(0, 10) : 'N/A'}</strong></span>
                  {payslip.payment_reference && (
                    <span className="ml-2 pl-2 border-l border-emerald-300">
                      Ref / UTR: <strong>{payslip.payment_reference}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Payment Status: <strong>Pending Disbursement / Processing</strong></span>
              </div>
            )}

            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Gross salary', payslip.gross_salary],
                ['Basic salary', payslip.basic_salary],
                ['House rent allowance', payslip.hra],
                ['Special allowance', payslip.special_allowance],
                Number(payslip.custom_bonus || 0) > 0 ? [`Custom Bonus (${payslip.custom_bonus_label || 'Incentive'})`, payslip.custom_bonus] : null,
                ['Employee PF', payslip.pf_employee],
                ['Employee ESI', payslip.esi_employee],
                ['Professional tax', payslip.professional_tax],
                ['TDS', payslip.tds],
                [`LOP deduction (${Number(payslip.lop_days || 0)} days)`, payslip.lop_deduction],
                Number(payslip.late_penalty_amount || 0) > 0 ? [`Late arrival penalty (${payslip.late_count_summary || `${payslip.late_penalty_days || 0} half-days`})`, payslip.late_penalty_amount] : null,
                Number(payslip.other_penalty_amount || 0) > 0 ? [`Other penalty (${payslip.other_penalty_reason || 'Disciplinary'})`, payslip.other_penalty_amount] : null,
                ['Total deductions', payslip.total_deductions],
              ].filter(Boolean).map(([label, amount]) => (
                <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="block text-xs text-slate-500">{label}</span>
                  <strong className="mt-1 block text-slate-900">{formatAmount(amount)}</strong>
                </div>
              ))}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <span className="block text-xs text-emerald-800">Net salary</span>
                <strong className="mt-1 block text-lg text-emerald-800">{formatAmount(payslip.net_salary)}</strong>
              </div>
            </div>

            {/* Itemized Penalties Breakdown for Employee */}
            {(Number(payslip.late_penalty_amount || 0) > 0 || Number(payslip.lop_deduction || 0) > 0 || Number(payslip.other_penalty_amount || 0) > 0) && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs">
                <h4 className="flex items-center gap-1.5 font-bold text-rose-900">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Itemized Penalties & Loss of Pay (LOP) Breakdown:
                </h4>
                <div className="mt-2 divide-y divide-rose-200/60 space-y-1">
                  {Number(payslip.late_penalty_amount || 0) > 0 && (
                    <div className="flex justify-between pt-1 text-rose-800">
                      <span>Late Arrival Penalty ({payslip.late_count_summary || `${payslip.late_penalty_days || 0} half-day(s)`}):</span>
                      <strong className="font-semibold">-{formatAmount(payslip.late_penalty_amount)}</strong>
                    </div>
                  )}
                  {Number(payslip.lop_deduction || 0) > 0 && (
                    <div className="flex justify-between pt-1 text-rose-800">
                      <span>Loss of Pay (Unpaid Leave) ({Number(payslip.lop_days || 0)} day(s)):</span>
                      <strong className="font-semibold">-{formatAmount(payslip.lop_deduction)}</strong>
                    </div>
                  )}
                  {Number(payslip.other_penalty_amount || 0) > 0 && (
                    <div className="flex justify-between pt-1 text-rose-800">
                      <span>Other / Disciplinary Penalty ({payslip.other_penalty_reason || 'Policy deduction'}):</span>
                      <strong className="font-semibold">-{formatAmount(payslip.other_penalty_amount)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-bold text-rose-900">
                    <span>Total Penalty Deductions:</span>
                    <span>-{formatAmount(Number(payslip.late_penalty_amount || 0) + Number(payslip.lop_deduction || 0) + Number(payslip.other_penalty_amount || 0))}</span>
                  </div>
                </div>
              </div>
            )}
            {(componentEarnings.length > 0 || employerCosts.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <section className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-800">Salary component breakdown</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {componentEarnings.map(component => (
                      <li key={component.component_key} className="flex justify-between gap-3 text-slate-600">
                        <span>{component.name}</span>
                        <span>{formatAmount(component.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                  <h3 className="text-sm font-semibold text-slate-800">Employer cost (not deducted from your pay)</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {employerCosts.map(component => (
                      <li key={component.component_key} className="flex justify-between gap-3 text-slate-600">
                        <span>{component.name}</span>
                        <span>{formatAmount(component.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 space-y-1 border-t border-teal-100 pt-2 text-sm font-semibold text-slate-800">
                    <p className="flex justify-between gap-3"><span>Total employer cost</span><span>{formatAmount(payslip.employer_cost_total)}</span></p>
                    <p className="flex justify-between gap-3"><span>Monthly CTC</span><span>{formatAmount(payslip.total_ctc_monthly)}</span></p>
                    <p className="flex justify-between gap-3"><span>Annual CTC</span><span>{formatAmount(payslip.ctc_annual)}</span></p>
                  </div>
                </section>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                TDS and professional tax were reviewed before publication. LOP uses monthly gross divided by calendar days in the payroll month.
              </p>
              <Button
                type="button"
                variant="secondary"
                icon={Download}
                onClick={() => {
                  setPrintError('');
                  printPayslip(payslip, setPrintError);
                }}
              >
                Print / Save as PDF
              </Button>
            </div>
          </Card>
          );
        })}
      </div>

      {!isLoading && !error && payslips.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <FileText className="h-4 w-4" />
          Payslip access is limited to the employee account linked to this session.
        </p>
      )}
    </div>
  );
}
