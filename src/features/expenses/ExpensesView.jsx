import React, { useEffect, useState } from 'react';
import { Banknote, Receipt } from 'lucide-react';
import Card from '../../components/common/Card';
import CloudinaryUpload from '../../components/common/CloudinaryUpload';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const categories = ['Travel', 'Meals', 'Accommodation', 'Transport', 'Supplies', 'Other'];
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.message || 'The request could not be completed.';
}

function displayDate(value) {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString();
}

function displayStatus(status) {
  return status.replaceAll('_', ' ');
}

function statusStyle(status) {
  if (status === 'paid' || status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function initialData() {
  return { claims: [], loans: [], unlinked_receipts: [] };
}

export default function ExpensesView() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('expenses');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [claimNotes, setClaimNotes] = useState({});
  const [loanNotes, setLoanNotes] = useState({});
  const [claimForm, setClaimForm] = useState({
    category: 'Travel',
    amount: '',
    incurred_on: localDate(),
    description: '',
  });
  const [loanForm, setLoanForm] = useState({ requested_amount: '', purpose: '' });

  useEffect(() => {
    let active = true;
    api.getExpenses()
      .then((response) => {
        if (active) {
          setData({
            claims: Array.isArray(response?.data?.claims) ? response.data.claims : [],
            loans: Array.isArray(response?.data?.loans) ? response.data.loans : [],
            unlinked_receipts: Array.isArray(response?.data?.unlinked_receipts)
              ? response.data.unlinked_receipts
              : [],
          });
        }
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

  const employeeId = currentUser?.employee_id ? Number(currentUser.employee_id) : null;
  const canSubmit = employeeId !== null && ['employee', 'manager', 'super_admin'].includes(currentUser?.role);
  const isManager = currentUser?.role === 'manager';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const createClaim = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await api.createExpenseClaim({
        ...claimForm,
        amount: Number(claimForm.amount),
        description: claimForm.description.trim(),
      });
      setData((previous) => ({
        ...previous,
        claims: [{ ...response.data, receipts: [] }, ...previous.claims],
      }));
      setClaimForm({ category: 'Travel', amount: '', incurred_on: localDate(), description: '' });
      setFeedback({ type: 'success', text: 'Expense claim submitted. Attach a receipt before requesting approval.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const createLoanRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await api.createLoanRequest({
        ...loanForm,
        requested_amount: Number(loanForm.requested_amount),
        purpose: loanForm.purpose.trim(),
      });
      setData((previous) => ({ ...previous, loans: [response.data, ...previous.loans] }));
      setLoanForm({ requested_amount: '', purpose: '' });
      setFeedback({ type: 'success', text: 'Loan request submitted for manager or admin review.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const reviewClaim = async (claim, decision) => {
    const decisionNote = claimNotes[claim.id] || '';
    setBusyRecordId(claim.id);
    setFeedback(null);

    try {
      const response = await api.reviewExpenseClaim(claim.id, decision, decisionNote);
      setData((previous) => ({
        ...previous,
        claims: previous.claims.map((item) => Number(item.id) === Number(claim.id) ? response.data : item),
      }));
      setFeedback({
        type: 'success',
        text: decision === 'approved' ? 'Expense claim approved.' : 'Expense claim rejected.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyRecordId(null);
    }
  };

  const markClaimPaid = async (claim) => {
    if (!window.confirm('Confirm that this reimbursement has already been paid outside the HRMS?')) return;
    setBusyRecordId(claim.id);
    setFeedback(null);

    try {
      const response = await api.markExpenseClaimPaid(claim.id);
      setData((previous) => ({
        ...previous,
        claims: previous.claims.map((item) => Number(item.id) === Number(claim.id) ? response.data : item),
      }));
      setFeedback({ type: 'success', text: 'Claim marked paid. No transfer was initiated by the HRMS.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyRecordId(null);
    }
  };

  const reviewLoan = async (loan, decision) => {
    const decisionNote = loanNotes[loan.id] || '';
    setBusyRecordId(loan.id);
    setFeedback(null);

    try {
      const response = await api.reviewLoanRequest(loan.id, decision, decisionNote);
      setData((previous) => ({
        ...previous,
        loans: previous.loans.map((item) => Number(item.id) === Number(loan.id) ? response.data : item),
      }));
      setFeedback({
        type: 'success',
        text: decision === 'approved'
          ? 'Loan request approved. Disbursement and repayment remain outside the HRMS.'
          : 'Loan request rejected.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyRecordId(null);
    }
  };

  const openReceipt = async (receipt) => {
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      setFeedback({ type: 'error', text: 'Allow pop-ups to securely open the receipt.' });
      return;
    }

    try {
      const response = await api.getUploadDownload(receipt.id);
      newWindow.location.href = response.data.url;
    } catch (error) {
      newWindow.close();
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const onReceiptUploaded = (claimId, receipt) => {
    setData((previous) => ({
      ...previous,
      claims: previous.claims.map((claim) => (
        Number(claim.id) === Number(claimId)
          ? { ...claim, receipts: [receipt, ...(claim.receipts || [])] }
          : claim
      )),
    }));
  };

  const canReview = (recordEmployeeId) => (
    !employeeId
    || Number(recordEmployeeId) !== employeeId
  ) && (isSuperAdmin || isManager);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
            Finance &amp; Claims
          </span>
          <span className="text-xs text-slate-500 font-medium">Reimbursements and employee loan requests</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Expenses &amp; Loans</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Claims require Cloudinary receipts before approval. Loan approval records a decision only; no repayment schedule, disbursement, or payroll deduction is triggered.
        </p>
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

      <div className="border-b border-slate-200 flex items-center gap-4 text-xs" role="tablist" aria-label="Finance records">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'expenses'}
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'expenses' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" aria-hidden="true" /> Expense claims
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'loans'}
          onClick={() => setActiveTab('loans')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'loans' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Banknote className="w-4 h-4" aria-hidden="true" /> Loan requests
        </button>
      </div>

      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {canSubmit && (
            <Card title="Submit an expense claim" subtitle="Submit business expenses in INR. Attach one or more receipts to the saved claim.">
              <form onSubmit={createClaim} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-medium text-slate-700">
                    Expense category
                    <select
                      value={claimForm.category}
                      onChange={(event) => setClaimForm((previous) => ({ ...previous, category: event.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Amount (INR)
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="10000000"
                      step="0.01"
                      value={claimForm.amount}
                      onChange={(event) => setClaimForm((previous) => ({ ...previous, amount: event.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Expense date
                    <input
                      required
                      type="date"
                      value={claimForm.incurred_on}
                      onChange={(event) => setClaimForm((previous) => ({ ...previous, incurred_on: event.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-xs font-medium text-slate-700">
                  Business purpose
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={claimForm.description}
                    onChange={(event) => setClaimForm((previous) => ({ ...previous, description: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Submit claim'}
                </button>
              </form>
            </Card>
          )}

          <Card title="Expense claims" subtitle="Managers review their direct reports; only Super Admin can record manual reimbursement payment.">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading expense claims…</p>
            ) : data.claims.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No expense claims are available.</p>
            ) : (
              <div className="space-y-4">
                {data.claims.map((claim) => {
                  const receipts = claim.receipts || [];
                  const isOwner = employeeId !== null && Number(claim.employee_id) === employeeId;
                  const reviewer = canReview(claim.employee_id) && claim.status === 'submitted';
                  const busy = busyRecordId === claim.id;

                  return (
                    <article key={claim.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm text-slate-800">
                              {claim.employee_code} — {claim.first_name} {claim.last_name}
                            </h3>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(claim.status)}`}>
                              {displayStatus(claim.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-800">{currency.format(Number(claim.amount))}</p>
                          <p className="mt-1 text-xs text-slate-500">{claim.category} · {displayDate(claim.incurred_on)}</p>
                          <p className="mt-2 text-sm text-slate-600">{claim.description}</p>
                          {claim.decision_note && <p className="mt-2 text-xs text-slate-500">Reviewer note: {claim.decision_note}</p>}
                          {claim.paid_at && <p className="mt-2 text-xs text-emerald-700">Marked paid on {displayDate(claim.paid_at)}</p>}
                        </div>
                        <span className="text-xs text-slate-500">Claim #{claim.id}</span>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-700">Receipt files ({receipts.length})</p>
                        {receipts.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {receipts.map((receipt) => (
                              <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="text-slate-600">{receipt.original_filename} · {receipt.mime_type}</span>
                                <button
                                  type="button"
                                  onClick={() => openReceipt(receipt)}
                                  className="font-semibold text-teal-600 hover:underline"
                                >
                                  Download securely
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {isOwner && claim.status === 'submitted' && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            <CloudinaryUpload
                              key={`claim-${claim.id}`}
                              module="expense_receipts"
                              employeeId={claim.employee_id}
                              recordId={claim.id}
                              accept=".pdf,.jpg,.jpeg,.png"
                              onUploaded={(receipt) => onReceiptUploaded(claim.id, receipt)}
                            />
                          </div>
                        )}
                        {reviewer && (
                          <div className="mt-4 space-y-2">
                            {receipts.length === 0 && (
                              <p className="text-xs text-amber-700">Attach at least one receipt before approval is available.</p>
                            )}
                            <label className="block text-xs font-medium text-slate-600">
                              Reviewer note (required when rejecting)
                              <textarea
                                rows={2}
                                maxLength={2000}
                                value={claimNotes[claim.id] || ''}
                                onChange={(event) => setClaimNotes((previous) => ({
                                  ...previous,
                                  [claim.id]: event.target.value,
                                }))}
                                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy || receipts.length === 0}
                                onClick={() => reviewClaim(claim, 'approved')}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busy || !(claimNotes[claim.id] || '').trim()}
                                onClick={() => reviewClaim(claim, 'rejected')}
                                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                        {isSuperAdmin && claim.status === 'approved' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markClaimPaid(claim)}
                            className="mt-3 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Mark manually paid
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          {data.unlinked_receipts.length > 0 && (
            <Card title="Older unlinked receipt files" subtitle="These files predate claim linking and are retained for review.">
              <ul className="space-y-2">
                {data.unlinked_receipts.map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>{receipt.original_filename} · {receipt.mime_type}</span>
                    <button
                      type="button"
                      onClick={() => openReceipt(receipt)}
                      className="font-semibold text-teal-600 hover:underline"
                    >
                      Download securely
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-6">
          {canSubmit && (
            <Card title="Request a loan or salary advance" subtitle="Submit a request for manager or Super Admin review.">
              <form onSubmit={createLoanRequest} className="space-y-4">
                <label className="block max-w-sm text-xs font-medium text-slate-700">
                  Requested amount (INR)
                  <input
                    required
                    type="number"
                    min="0.01"
                    max="10000000"
                    step="0.01"
                    value={loanForm.requested_amount}
                    onChange={(event) => setLoanForm((previous) => ({ ...previous, requested_amount: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Purpose
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={loanForm.purpose}
                    onChange={(event) => setLoanForm((previous) => ({ ...previous, purpose: event.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Submit loan request'}
                </button>
              </form>
            </Card>
          )}

          <Card title="Loan requests" subtitle="Approval records the decision only; disbursement, interest, and repayment are not configured.">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading loan requests…</p>
            ) : data.loans.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No loan requests are available.</p>
            ) : (
              <div className="space-y-3">
                {data.loans.map((loan) => {
                  const reviewer = canReview(loan.employee_id) && loan.status === 'submitted';
                  const busy = busyRecordId === loan.id;

                  return (
                    <article key={loan.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm text-slate-800">
                              {loan.employee_code} — {loan.first_name} {loan.last_name}
                            </h3>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(loan.status)}`}>
                              {displayStatus(loan.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-800">{currency.format(Number(loan.requested_amount))}</p>
                          <p className="mt-2 text-sm text-slate-600">{loan.purpose}</p>
                          {loan.decision_note && <p className="mt-2 text-xs text-slate-500">Reviewer note: {loan.decision_note}</p>}
                        </div>
                        <span className="text-xs text-slate-500">Request #{loan.id}</span>
                      </div>

                      {reviewer && (
                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                          <label className="block text-xs font-medium text-slate-600">
                            Reviewer note (required when rejecting)
                            <textarea
                              rows={2}
                              maxLength={2000}
                              value={loanNotes[loan.id] || ''}
                              onChange={(event) => setLoanNotes((previous) => ({
                                ...previous,
                                [loan.id]: event.target.value,
                              }))}
                              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => reviewLoan(loan, 'approved')}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve request
                            </button>
                            <button
                              type="button"
                              disabled={busy || !(loanNotes[loan.id] || '').trim()}
                              onClick={() => reviewLoan(loan, 'rejected')}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Reject request
                            </button>
                          </div>
                        </div>
                      )}

                      {loan.status === 'approved' && (
                        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-amber-700">
                          This is an approval record only. Do not treat it as a disbursement or payroll deduction authorization.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
