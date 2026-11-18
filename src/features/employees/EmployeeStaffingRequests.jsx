import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const initialForm = {
  request_type: 'new_hire',
  designation: '',
  department: '',
  requested_employee_code: '',
  justification: '',
};

export default function EmployeeStaffingRequests() {
  const { currentUser } = useAuth();
  const { employees, refreshEmployees } = useHRMS();
  const isManager = currentUser?.role === 'manager';
  const isHr = ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [employeeSelections, setEmployeeSelections] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRequests = async () => {
    if (!isManager && !isHr) return;
    try {
      const response = await api.getEmployeeStaffingRequests();
      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      setError(loadError?.data?.message || loadError.message || 'Could not load staffing requests.');
    }
  };

  useEffect(() => {
    if (isManager || isHr) {
      loadRequests();
    }
  }, [isManager, isHr]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitRequest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await api.createEmployeeStaffingRequest({
        ...form,
        requested_employee_code: form.request_type === 'team_member'
          ? form.requested_employee_code.trim() || null
          : null,
      });
      setForm(initialForm);
      setStatus('Request submitted for HR review.');
      await loadRequests();
    } catch (submitError) {
      setError(submitError?.data?.message || submitError.message || 'Could not submit the staffing request.');
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (request, decision) => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await api.reviewEmployeeStaffingRequest(request.id, {
        decision,
        review_note: (reviewNotes[request.id] || '').trim() || null,
        assigned_employee_id: decision === 'approved' && request.request_type === 'team_member'
          ? Number(employeeSelections[request.id])
          : null,
      });
      setStatus(`Request #${request.id} ${decision}.`);
      await loadRequests();
      if (decision === 'approved' && request.request_type === 'team_member') {
        await refreshEmployees?.();
      }
    } catch (reviewError) {
      setError(reviewError?.data?.message || reviewError.message || 'Could not review the staffing request.');
    } finally {
      setBusy(false);
    }
  };

  if (!isManager && !isHr) return null;

  return (
    <Card title="Staffing requests" subtitle={isManager ? 'Submit requests for HR approval and track their status.' : 'Review manager hiring and team-member requests.'}>
      <div className="space-y-4 text-xs">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
        {status && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{status}</p>}

        {isManager && (
          <form onSubmit={submitRequest} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <label className="font-semibold text-slate-700">
              Request type
              <select
                value={form.request_type}
                onChange={(event) => setForm({ ...form, request_type: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option value="new_hire">New hire</option>
                <option value="team_member">Assign a team member</option>
              </select>
            </label>
            <label className="font-semibold text-slate-700">
              Department
              <input
                required
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            <label className="font-semibold text-slate-700">
              Designation requested
              <input
                required
                value={form.designation}
                onChange={(event) => setForm({ ...form, designation: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            {form.request_type === 'team_member' && (
              <label className="font-semibold text-slate-700">
                Employee code, if known
                <input
                  value={form.requested_employee_code}
                  onChange={(event) => setForm({ ...form, requested_employee_code: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  placeholder="Optional; HR confirms the employee"
                />
              </label>
            )}
            <label className="font-semibold text-slate-700 md:col-span-2">
              Business justification
              <textarea
                required
                rows={3}
                value={form.justification}
                onChange={(event) => setForm({ ...form, justification: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? 'Submitting...' : 'Submit for HR approval'}</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
              <tr>
                {isHr && <th className="py-2 pr-3">Manager</th>}
                <th className="py-2 pr-3">Request</th>
                <th className="py-2 pr-3">Role / department</th>
                <th className="py-2 pr-3">Justification</th>
                <th className="py-2 pr-3">Status</th>
                {isHr && <th className="py-2">Review</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((request) => (
                <tr key={request.id} className="align-top">
                  {isHr && (
                    <td className="py-3 pr-3 font-medium text-slate-800">
                      {request.manager_first_name} {request.manager_last_name}
                      <span className="block text-slate-500">{request.manager_employee_code}</span>
                    </td>
                  )}
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-slate-800">{request.request_type === 'new_hire' ? 'New hire' : 'Team member'}</span>
                    {request.requested_employee_code && <span className="block text-slate-500">Requested code: {request.requested_employee_code}</span>}
                    {request.assigned_employee_code && <span className="block text-slate-500">Assigned: {request.assigned_employee_code}</span>}
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{request.designation}<span className="block text-slate-500">{request.department}</span></td>
                  <td className="max-w-xs whitespace-pre-wrap py-3 pr-3 text-slate-600">{request.justification}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2 py-1 font-semibold ${
                      request.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                        : request.status === 'rejected' ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}>{request.status}</span>
                    {request.review_note && <span className="mt-1 block text-slate-500">{request.review_note}</span>}
                  </td>
                  {isHr && (
                    <td className="min-w-56 py-3">
                      {request.status === 'pending' ? (
                        <div className="space-y-2">
                          {request.request_type === 'team_member' && (
                            <select
                              value={employeeSelections[request.id] || ''}
                              onChange={(event) => setEmployeeSelections({ ...employeeSelections, [request.id]: event.target.value })}
                              className="w-full rounded-lg border border-slate-300 bg-white p-2"
                              aria-label={`Employee to assign for request ${request.id}`}
                            >
                              <option value="">Select active employee</option>
                              {employees
                                .filter((employee) => employee.status === 'active' && Number(employee.id) !== Number(request.manager_employee_id))
                                .map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.employee_code} — {employee.first_name} {employee.last_name}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            placeholder="Review note (optional)"
                            value={reviewNotes[request.id] || ''}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [request.id]: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy || (request.request_type === 'team_member' && !employeeSelections[request.id])} onClick={() => reviewRequest(request, 'approved')}>Approve</Button>
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => reviewRequest(request, 'rejected')}>Reject</Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">{request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : ''}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={isHr ? 6 : 4} className="py-6 text-center text-slate-500">No staffing requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
