import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
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
    reviewLeave
  } = useHRMS();

  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'balances' | 'policy'
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave (CL)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [daysCount, setDaysCount] = useState(1);
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveFormError, setLeaveFormError] = useState(null);
  const [leaveSuccessToast, setLeaveSuccessToast] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  const myBalance = {
    cl: 0,
    sl: 0,
    pl: 0,
    comp_off: 0,
    ...leaveBalances[currentUser.employee_id],
  };
  const canApprove = ['super_admin', 'hr_admin', 'hr_executive', 'manager'].includes(currentUser.role);

  const handleReview = async (leaveId, decision) => {
    setReviewError(null);
    try {
      await reviewLeave(leaveId, decision, `${currentUser.first_name} ${currentUser.last_name}`);
    } catch (error) {
      setReviewError(error?.data?.message || error.message || 'Unable to review this leave request.');
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
        days: daysCount,
        reason: leaveReason
      }, `${currentUser.first_name} ${currentUser.last_name}`);

      setLeaveSuccessToast(`Leave application (${daysCount} days ${leaveType}) saved to database!`);
      setTimeout(() => setLeaveSuccessToast(null), 4000);
      setShowApplyModal(false);
      setLeaveReason('');
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
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
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
          onClick={() => setShowApplyModal(true)}
        >
          Apply for Leave
        </Button>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Casual Leave (CL)"
          value={`${myBalance.cl} Days`}
          subvalue="Accrues 1 per month"
          color="indigo"
        />
        <StatCard
          title="Sick Leave (SL)"
          value={`${myBalance.sl} Days`}
          subvalue="Requires cert if >2 days"
          color="blue"
        />
        <StatCard
          title="Privilege Leave (PL)"
          value={`${myBalance.pl} Days`}
          subvalue="Carry-forward eligible (max 30)"
          color="emerald"
        />
        <StatCard
          title="Compensatory Off"
          value={`${myBalance.comp_off} Days`}
          subvalue="Valid for 60 days"
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'requests' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" /> All Leave Applications ({leaveRequests.length})
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'policy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Leave Policies & Sandwich Rules
        </button>
      </div>

      {/* TAB 1: REQUESTS */}
      {activeTab === 'requests' && (
        <>
        {reviewError && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            {reviewError}
          </div>
        )}
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
                  {canApprove && <th className="px-4 py-3 text-right">Approval Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canApprove ? 7 : 6}
                      role="status"
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      No leave applications are recorded for your team.
                    </td>
                  </tr>
                ) : leaveRequests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">{req.employee_name}</td>
                    <td className="px-4 py-3 font-medium text-indigo-700">{req.leave_type}</td>
                    <td className="px-4 py-3 text-slate-800">{req.from_date} to {req.to_date}</td>
                    <td className="px-4 py-3 font-bold">{req.days} Day(s)</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">"{req.reason}"</td>
                    <td className="px-4 py-3">
                      <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                        {req.status}
                      </Badge>
                    </td>

                    {canApprove && (
                      <td className="px-4 py-3 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReview(req.id, 'rejected')}
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
                          <span className="text-[11px] text-slate-400">Reviewed by {req.reviewed_by}</span>
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

      {/* TAB 2: POLICY */}
      {activeTab === 'policy' && (
        <Card title="Indian Leave Accrual & Sandwich Rule Framework" subtitle="Architecture Section 2 & 15 Q6 Guidelines">
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-1">Sandwich Leave Rule Policy</h4>
              <p>
                When a gazetted holiday or weekly off falls between two consecutive days of leave (e.g. Friday and Monday), the weekend days are counted as leave under Indian statutory Factories/Shops & Establishments act configurations unless HR approves exemption.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Annual Accrual Quota</span>
                <p className="text-slate-600 mt-1">12 Casual + 12 Sick + 15 Privilege Leaves credited per financial year (April - March).</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Encashment on Exit (F&F)</span>
                <p className="text-slate-600 mt-1">Unavailed Privilege Leaves (PL) up to 30 days are encashed in Full & Final payroll settlement.</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-800 block">Maternity / Paternity</span>
                <p className="text-slate-600 mt-1">26 weeks paid maternity leave under Maternity Benefit Act 2017; 2 weeks paternity leave.</p>
              </div>
            </div>
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
              <option value="Casual Leave (CL)">Casual Leave (CL) - {myBalance.cl} days balance</option>
              <option value="Sick Leave (SL)">Sick Leave (SL) - {myBalance.sl} days balance</option>
              <option value="Privilege Leave (PL)">Privilege Leave (PL) - {myBalance.pl} days balance</option>
              <option value="Compensatory Off">Compensatory Off - {myBalance.comp_off} days balance</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Total Days:</label>
              <input
                type="number"
                min="0.5"
                max="30"
                step="0.5"
                required
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

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
