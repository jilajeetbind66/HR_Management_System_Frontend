import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import api from '../../services/api';
import { canReviewLeave } from '../../utils/leaveApproval';
import {
  CalendarCheck2,
  CalendarPlus,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export default function LeavesView() {
  const { currentUser } = useAuth();
  const {
    leaveBalances,
    leaveRequests,
    applyLeave,
    reviewLeave,
    cancelLeave
  } = useHRMS();

  const [activeTab, setActiveTab] = useState('my');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave (CL)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState('first_half');
  const [sickCertificateFile, setSickCertificateFile] = useState(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveFormError, setLeaveFormError] = useState(null);
  const [leaveSuccessToast, setLeaveSuccessToast] = useState(null);
  const [leaveWarnings, setLeaveWarnings] = useState([]);
  const [reviewError, setReviewError] = useState(null);

  const myBalance = {
    cl: 0,
    sl: 0,
    pl: 0,
    comp_off: 0,
    ...leaveBalances[currentUser.employee_id],
  };
  const formatDays = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const canApprove = ['super_admin', 'hr_admin', 'hr_executive', 'manager'].includes(currentUser.role);
  const myLeaves = leaveRequests.filter(
    (request) => Number(request.employee_id) === Number(currentUser.employee_id)
  );
  const pendingApprovals = leaveRequests.filter((request) => canReviewLeave(request, currentUser));
  const baseLeaves = activeTab === 'approvals'
    ? pendingApprovals
    : activeTab === 'all'
      ? leaveRequests
      : myLeaves;
  const displayedLeaves = baseLeaves.filter((request) => (
    (!statusFilter || request.status === statusFilter)
    && (!employeeFilter || String(request.employee_id) === employeeFilter)
    && (!dateFromFilter || request.to_date >= dateFromFilter)
    && (!dateToFilter || request.from_date <= dateToFilter)
  ));
  const employeeOptions = [...new Map(leaveRequests.map((request) => [
    String(request.employee_id),
    { id: String(request.employee_id), name: request.employee_name || request.employee_code || 'Employee' },
  ])).values()].sort((first, second) => first.name.localeCompare(second.name));

  const handleReview = async (leaveId, decision) => {
    setReviewError(null);
    try {
      await reviewLeave(leaveId, decision);
    } catch (error) {
      setReviewError(reviewErrorMessage(error));
    }
  };

  const handleRejectSubmit = async (event) => {
    event.preventDefault();
    if (!reviewTarget || !reviewRemarks.trim()) return;
    setReviewError(null);
    setSubmittingReview(true);
    try {
      await reviewLeave(reviewTarget.id, 'rejected', reviewRemarks.trim());
      setReviewTarget(null);
      setReviewRemarks('');
    } catch (error) {
      setReviewError(reviewErrorMessage(error));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancel = async (leaveId) => {
    setReviewError(null);
    try {
      await cancelLeave(leaveId);
    } catch (error) {
      setReviewError(error?.data?.message || error.message || 'Unable to cancel this leave request.');
    }
  };

  const reviewErrorMessage = (error) => {
    if (error?.status === 403) {
      return 'This request is not assigned to your approval stage. The approval queue was refreshed.';
    }
    if (error?.status === 409) {
      return 'This request has already changed. The approval queue was refreshed.';
    }
    return error?.data?.message || error.message || 'Unable to review this leave request.';
  };

  const openCertificate = async (uploadId) => {
    const newWindow = window.open('about:blank', '_blank');
    try {
      const response = await api.getUploadDownload(uploadId);
      if (!response?.data?.url) throw new Error('The certificate download link was not returned.');
      if (newWindow) newWindow.location.href = response.data.url;
    } catch (error) {
      newWindow?.close();
      setReviewError(error?.data?.message || error.message || 'Unable to open the medical certificate.');
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !leaveReason) return;
    setLeaveFormError(null);
    setSubmittingLeave(true);

    try {
      const saved = await applyLeave({
        employee_id: currentUser.employee_id,
        employee_name: `${currentUser.first_name} ${currentUser.last_name}`,
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        certificate_file: sickCertificateFile,
        reason: leaveReason,
      }, `${currentUser.first_name} ${currentUser.last_name}`);

      setLeaveSuccessToast(`Leave application (${saved?.days || 0} days ${leaveType}) submitted.`);
      setLeaveWarnings(saved?.warnings || []);
      setTimeout(() => setLeaveSuccessToast(null), 4000);
      setShowApplyModal(false);
      setLeaveReason('');
      setSickCertificateFile(null);
      setIsHalfDay(false);
    } catch (err) {
      console.error("Leave apply error:", err);
      const msg = err?.data?.message || err.message || "Failed to submit leave. Ensure Laravel server is running.";
      setLeaveFormError(msg);
    } finally {
      setSubmittingLeave(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Leave & Absence
            </span>
            <span className="text-xs text-slate-500 font-medium">Accrual Balances & Approval Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Leave Management & Accrual</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Casual, Sick, Privilege leaves, holiday sandwich rule tracking, balance ledgers, and multi-tier approval chains.
          </p>
        </div>

        <Button
          variant="primary"
          icon={CalendarPlus}
          disabled={!currentUser?.employee_id}
          title={!currentUser?.employee_id ? 'Account is not linked to an employee record' : undefined}
          onClick={() => setShowApplyModal(true)}
        >
          Apply for Leave
        </Button>
      </div>
      {leaveWarnings.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {leaveWarnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Casual Leave (CL)"
          value={`${formatDays(myBalance.cl_available ?? myBalance.cl)} Available`}
          subvalue={`Used ${formatDays(myBalance.cl_used)} · Pending ${formatDays(myBalance.cl_pending)}`}
          color="indigo"
        />
        <StatCard
          title="Sick Leave (SL)"
          value={`${formatDays(myBalance.sl_available ?? myBalance.sl)} Available`}
          subvalue={`Used ${formatDays(myBalance.sl_used)} · Pending ${formatDays(myBalance.sl_pending)}`}
          color="blue"
        />
        <StatCard
          title="Privilege Leave (PL)"
          value={`${formatDays(myBalance.pl_available ?? myBalance.pl)} Available`}
          subvalue={`Used ${formatDays(myBalance.pl_used)} · Pending ${formatDays(myBalance.pl_pending)}`}
          color="emerald"
        />
        <StatCard
          title="Compensatory Off"
          value={`${formatDays(myBalance.comp_off_available ?? myBalance.comp_off)} Available`}
          subvalue={`Used ${formatDays(myBalance.comp_off_used)} · Pending ${formatDays(myBalance.comp_off_pending)}`}
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'my' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" /> My Leaves ({myLeaves.length})
        </button>

        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'approvals' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Pending Approvals ({pendingApprovals.length})
          </button>
        )}

        {canApprove && (
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'all' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> All / Team Leaves ({leaveRequests.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'policy' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Leave Policies & Sandwich Rules
        </button>
      </div>

      {/* TAB 1: REQUESTS */}
      {(activeTab === 'my' || activeTab === 'approvals' || activeTab === 'all') && (
        <>
        {reviewError && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            {reviewError}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-xs font-medium text-slate-600">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          {canApprove && activeTab !== 'my' && (
            <label className="text-xs font-medium text-slate-600">
              Employee
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="mt-1 block min-w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              >
                <option value="">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setEmployeeFilter('');
              setDateFromFilter('');
              setDateToFilter('');
            }}
            className="rounded-lg px-2.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            Clear filters
          </button>
        </div>
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Date Range</th>
                  <th className="px-4 py-3">Total Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applied On</th>
                  <th className="px-4 py-3">Review</th>
                  {(canApprove || currentUser.employee_id) && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedLeaves.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(canApprove || currentUser.employee_id) ? 9 : 8}
                      role="status"
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      {activeTab === 'approvals' && currentUser.role === 'manager'
                        ? 'No leave applications from your team'
                        : activeTab === 'approvals'
                          ? 'No pending leave approvals are waiting for you.'
                          : 'No leave applications are recorded for you.'}
                    </td>
                  </tr>
                ) : displayedLeaves.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">{req.employee_name}</td>
                    <td className="px-4 py-3 font-medium text-teal-700">{req.leave_type}</td>
                    <td className="px-4 py-3 text-slate-800">{req.from_date} to {req.to_date}</td>
                    <td className="px-4 py-3 font-bold">{req.days} Day(s)</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs">
                      <p className="max-w-40 truncate">"{req.reason}"</p>
                      <button
                        type="button"
                        onClick={() => setSelectedLeave(req)}
                        className="mt-1 text-[10px] font-semibold text-teal-600 hover:text-teal-800"
                      >
                        View Details
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-medium text-slate-800">{req.approval_stage || '—'}</p>
                      {req.reviewed_by && <p className="mt-1">Reviewed by {req.reviewed_by}</p>}
                      {req.reviewed_at && <p className="mt-1">{new Date(req.reviewed_at).toLocaleString()}</p>}
                      {req.review_remarks && (
                        <p className="mt-1 max-w-48 whitespace-pre-line">Remarks: {req.review_remarks}</p>
                      )}
                    </td>

                    {(canApprove || currentUser.employee_id) && (
                      <td className="px-4 py-3 text-right">
                        {req.status === 'pending' ? (
                          Number(req.employee_id) === Number(currentUser.employee_id) ? (
                            <button
                              onClick={() => handleCancel(req.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded"
                            >
                              Cancel request
                            </button>
                          ) : canReviewLeave(req, currentUser) ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setReviewTarget(req);
                                  setReviewRemarks('');
                                  setReviewError(null);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleReview(req.id, 'approved')}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                Approve
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Awaiting {req.approval_stage}</span>
                          )
                        ) : req.status === 'cancelled' ? (
                          <span className="text-[11px] text-slate-400">Cancelled by employee</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Reviewed by {req.reviewed_by || 'Approver'}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}

      <Modal
        isOpen={Boolean(selectedLeave)}
        onClose={() => setSelectedLeave(null)}
        title="Leave Request Details"
        subtitle={selectedLeave?.employee_name}
      >
        {selectedLeave && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-slate-500">Leave type</dt><dd className="mt-1 font-medium">{selectedLeave.leave_type}</dd></div>
              <div><dt className="text-xs text-slate-500">Days</dt><dd className="mt-1 font-medium">{selectedLeave.days}</dd></div>
              <div><dt className="text-xs text-slate-500">From</dt><dd className="mt-1 font-medium">{selectedLeave.from_date}</dd></div>
              <div><dt className="text-xs text-slate-500">To</dt><dd className="mt-1 font-medium">{selectedLeave.to_date}</dd></div>
              <div><dt className="text-xs text-slate-500">Current stage</dt><dd className="mt-1 font-medium">{selectedLeave.approval_stage || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Applied on</dt><dd className="mt-1 font-medium">{selectedLeave.created_at ? new Date(selectedLeave.created_at).toLocaleString() : '—'}</dd></div>
            </dl>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold text-slate-700">Full reason</h3>
              <p className="mt-1 whitespace-pre-line text-slate-700">{selectedLeave.reason || 'No reason provided.'}</p>
            </div>
            {selectedLeave.certificate_upload && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <h3 className="text-xs font-semibold text-blue-900">Medical certificate</h3>
                <p className="mt-1 text-xs text-blue-800">{selectedLeave.certificate_upload.original_filename}</p>
                <button
                  type="button"
                  onClick={() => openCertificate(selectedLeave.certificate_upload.id)}
                  className="mt-2 text-xs font-semibold text-blue-700 underline hover:text-blue-900"
                >
                  Open private certificate
                </button>
              </div>
            )}
            {selectedLeave.reviews?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-700">Review history</h3>
                <ol className="mt-2 space-y-3">
                  {selectedLeave.reviews.map((review) => (
                    <li key={review.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-medium text-slate-800">{review.stage} · {review.decision}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {review.reviewer_name} · {new Date(review.reviewed_at).toLocaleString()}
                      </p>
                      {review.remarks && <p className="mt-2 whitespace-pre-line text-slate-700">{review.remarks}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(reviewTarget)}
        onClose={() => {
          if (!submittingReview) {
            setReviewTarget(null);
            setReviewRemarks('');
            setReviewError(null);
          }
        }}
        title="Reject Leave Request"
        subtitle={reviewTarget?.employee_name}
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Rejection remarks
            <textarea
              required
              value={reviewRemarks}
              onChange={(event) => setReviewRemarks(event.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          {reviewError && <p role="alert" className="text-sm text-rose-700">{reviewError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={submittingReview}
              onClick={() => setReviewTarget(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submittingReview || !reviewRemarks.trim()}>
              {submittingReview ? 'Saving…' : 'Confirm rejection'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TAB 2: POLICY */}
      {activeTab === 'policy' && (
        <Card title="Configured Leave Policies & Sandwich Rules" subtitle="Current HRMS rules applied when employees submit leave requests">
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-1">Weekends, holidays & sandwich rule</h4>
              <p>
                Saturdays, Sundays, and applicable branch holidays are excluded from leave-day totals. A continuous run of non-working days bracketed by working leave days is counted as leave (for example, leave from Friday through Monday counts all four days). A range containing only non-working days is not eligible. The rule is applied automatically; this screen does not provide an HR exemption override.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Annual accrual & balances</span>
                <p className="text-slate-600 mt-1">The configured financial-year quotas are 12 CL, 12 SL, and 15 PL from April through March. Entitlement is prorated from the employee's joining date. Pending days are displayed separately and are not deducted until final approval.</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Sick leave documentation</span>
                <p className="text-slate-600 mt-1">A private medical certificate is required for Sick Leave requests exceeding two calculated leave days. Only the applicant and authorized HR roles can access the uploaded certificate.</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Leave Without Pay (LOP)</span>
                <p className="text-slate-600 mt-1">Approved LOP does not consume CL/SL/PL balances. Payroll deducts monthly gross divided by the calendar days in that payroll month for each approved LOP day.</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              These are the application's configured rules, not a statement of statutory entitlements. Confirm company policy and applicable state requirements before production use.
            </p>
          </div>
        </Card>
      )}

      {/* APPLY LEAVE MODAL */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => { if (!submittingLeave) { setShowApplyModal(false); setLeaveFormError(null); } }}
        title="Apply for Leave"
        subtitle="Multi-stage approval workflow"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
          {leaveFormError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-bold">⚠️ Error:</span>
              <span>{leaveFormError}</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Leave Type:</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="Casual Leave (CL)">Casual Leave (CL) - {formatDays(myBalance.cl_available ?? myBalance.cl)} days available</option>
              <option value="Sick Leave (SL)">Sick Leave (SL) - {formatDays(myBalance.sl_available ?? myBalance.sl)} days available</option>
              <option value="Privilege Leave (PL)">Privilege Leave (PL) - {formatDays(myBalance.pl_available ?? myBalance.pl)} days available</option>
              <option value="Compensatory Off">Compensatory Off - {formatDays(myBalance.comp_off_available ?? myBalance.comp_off)} days available</option>
              <option value="Leave Without Pay (LOP)">Leave Without Pay (LOP) - unpaid</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">From Date:</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">To Date:</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(event) => setIsHalfDay(event.target.checked)}
              />
              Request half-day leave
            </label>
            {isHalfDay && (
              <label className="mt-3 block font-semibold text-slate-700">
                Half-day period
                <select
                  value={halfDayPeriod}
                  onChange={(event) => setHalfDayPeriod(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                >
                  <option value="first_half">First half</option>
                  <option value="second_half">Second half</option>
                </select>
              </label>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Leave days are calculated using working days, applicable holidays, and the sandwich rule.
            </p>
          </div>

          <label className="block font-semibold text-slate-700">
            Medical certificate (required for sick leave over 2 days)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) {
                  setSickCertificateFile(null);
                  return;
                }
                const extension = file.name.split('.').pop()?.toLowerCase();
                if (file.size > 10 * 1024 * 1024 || !['pdf', 'jpg', 'jpeg', 'png'].includes(extension)) {
                  setLeaveFormError('Choose a PDF, JPG, or PNG certificate up to 10 MB.');
                  event.target.value = '';
                  setSickCertificateFile(null);
                  return;
                }
                setLeaveFormError(null);
                setSickCertificateFile(file);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              PDF/JPG/PNG only; maximum 10 MB. The uploaded file is private and linked to this request.
            </span>
          </label>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Leave:</label>
            <textarea
              required
              rows="3"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="State reason and project handover arrangement..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" disabled={submittingLeave} onClick={() => { setShowApplyModal(false); setLeaveFormError(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submittingLeave}>
              {submittingLeave ? 'Saving to Database...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Floating Leave Success Toast */}
      {leaveSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500 text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{leaveSuccessToast}</span>
        </div>
      )}
    </div>
  );
}
