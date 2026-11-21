import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy, MessageSquare, Plus, Send } from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';

const getEmptyTicket = (userRole) => ({
  title: '',
  description: '',
  category: ['hr_admin', 'hr_executive'].includes(userRole) ? 'HR Query' : 'IT Support',
  priority: 'Medium',
});

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.data?.message || error?.message || 'Unable to complete the ticket request.';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function statusVariant(status) {
  if (status === 'Resolved' || status === 'Closed') return 'success';
  if (status === 'In Progress') return 'primary';
  return 'warning';
}

function priorityVariant(priority) {
  if (priority === 'Urgent' || priority === 'High') return 'danger';
  if (priority === 'Medium') return 'warning';
  return 'neutral';
}

function slaLabel(ticket) {
  if (ticket.sla_status === 'Overdue') return `${ticket.sla_hours_overdue}h overdue`;
  if (ticket.sla_status === 'Breached') return 'SLA breached';
  if (ticket.sla_status === 'Met') return 'Met';
  if (ticket.sla_status === 'Unknown') return 'Unavailable';
  return `${ticket.sla_hours_left}h remaining`;
}

function statusOptions(ticket) {
  if (ticket.status === 'Open') return ['Open', 'In Progress', 'Resolved'];
  if (ticket.status === 'In Progress') return ['In Progress', 'Resolved'];
  if (ticket.status === 'Resolved') return ['Resolved', 'In Progress', 'Closed'];
  return ['Closed'];
}

export default function HelpdeskView() {
  const {
    tickets,
    createTicket,
    addTicketMessage,
    updateTicketStatus,
    api,
  } = useHRMS();
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const hrOnly = ['hr_admin', 'hr_executive'].includes(role);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ticketForm, setTicketForm] = useState(() => getEmptyTicket(role));
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [statusDraft, setStatusDraft] = useState('');

  const openTicket = async (ticketId) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError('');
    setSelectedTicket(null);
    try {
      const response = await api.getTicket(ticketId);
      setSelectedTicket(response.data);
      setStatusDraft(response.data.status);
    } catch (error) {
      setDetailsError(errorText(error));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setBusy('create');
    try {
      const payload = {
        ...ticketForm,
        category: hrOnly ? 'HR Query' : ticketForm.category,
      };
      await createTicket(payload);
      setShowCreateModal(false);
      setTicketForm(getEmptyTicket(role));
      setFeedback({ type: 'success', text: 'Support ticket created.' });
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setBusy('');
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setBusy('reply');
    setDetailsError('');
    try {
      const updated = await addTicketMessage(selectedTicket.id, reply.trim());
      setSelectedTicket(updated);
      setReply('');
    } catch (error) {
      setDetailsError(errorText(error));
    } finally {
      setBusy('');
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedTicket) return;
    setBusy('status');
    setDetailsError('');
    try {
      const updated = await updateTicketStatus(selectedTicket.id, status);
      setSelectedTicket(updated);
      setStatusDraft(updated.status);
      setFeedback({ type: 'success', text: `${updated.ticket_code} moved to ${updated.status}.` });
    } catch (error) {
      setDetailsError(errorText(error));
    } finally {
      setBusy('');
    }
  };

  const canManageTicket = role === 'super_admin'
    || (role === 'hr_admin' && selectedTicket?.category === 'HR Query');
  const canCloseOwnTicket = selectedTicket
    && Number(selectedTicket.created_by_user_id) === Number(currentUser?.id)
    && selectedTicket.status === 'Resolved';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">
              Support &amp; Services
            </span>
            <span className="text-xs font-medium text-slate-500">Ticket conversations and service-level tracking</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Employee Helpdesk &amp; Support Tickets</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Track support requests, communicate in a ticket thread, and monitor priority response deadlines.
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setTicketForm(getEmptyTicket(role));
            setFormError('');
            setShowCreateModal(true);
          }}
        >
          Raise New Ticket
        </Button>
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

      <Card bodyClassName="p-0">
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No support tickets are available in your authorized view.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Ticket &amp; subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Raised by</th>
                  <th className="px-4 py-3">Assigned queue</th>
                  <th className="px-4 py-3">SLA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Conversation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className="mr-1.5 font-mono font-semibold text-teal-600">{ticket.ticket_code}</span>
                      <span className="font-semibold text-slate-900">{ticket.title}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ticket.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityVariant(ticket.priority)} size="sm">{ticket.priority}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{ticket.created_by}</td>
                    <td className="px-4 py-3 text-slate-600">{ticket.assigned_to}</td>
                    <td className={`px-4 py-3 font-semibold ${
                      ['Overdue', 'Breached'].includes(ticket.sla_status) ? 'text-rose-700' : 'text-teal-700'
                    }`}>
                      <span className="inline-flex items-center gap-1">
                        {ticket.sla_status === 'Overdue' || ticket.sla_status === 'Breached'
                          ? <AlertTriangle className="h-3.5 w-3.5" />
                          : <Clock className="h-3.5 w-3.5" />}
                        {slaLabel(ticket)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(ticket.status)} size="sm">{ticket.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="secondary" icon={MessageSquare} onClick={() => openTicket(ticket.id)}>
                        View / Reply
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Raise Helpdesk Ticket"
        subtitle="Priority determines the initial response deadline."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{formError}</p>}
          <label className="block font-semibold text-slate-700">
            Subject
            <input
              type="text"
              required
              maxLength="255"
              value={ticketForm.title}
              onChange={(event) => setTicketForm((previous) => ({ ...previous, title: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"
            />
          </label>
          <label className="block font-semibold text-slate-700">
            Describe the issue
            <textarea
              rows="4"
              maxLength="5000"
              required
              value={ticketForm.description}
              onChange={(event) => setTicketForm((previous) => ({ ...previous, description: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block font-semibold text-slate-700">
              Category
              <select
                value={hrOnly ? 'HR Query' : ticketForm.category}
                disabled={hrOnly}
                onChange={(event) => setTicketForm((previous) => ({ ...previous, category: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
              >
                {hrOnly ? (
                  <option value="HR Query">HR &amp; Benefits Query</option>
                ) : (
                  <>
                    <option value="IT Support">IT Hardware / Network Support</option>
                    <option value="HR Query">HR &amp; Benefits Query</option>
                    <option value="Payroll">Payroll &amp; Tax</option>
                    <option value="Facilities">Admin &amp; Facilities</option>
                  </>
                )}
              </select>
            </label>
            <label className="block font-semibold text-slate-700">
              Priority
              <select
                value={ticketForm.priority}
                onChange={(event) => setTicketForm((previous) => ({ ...previous, priority: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
              >
                <option value="Low">Low · 72 hours</option>
                <option value="Medium">Medium · 24 hours</option>
                <option value="High">High · 8 hours</option>
                <option value="Urgent">Urgent · 2 hours</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" disabled={busy !== ''} onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy !== ''}>
              {busy === 'create' ? 'Saving...' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={selectedTicket ? `${selectedTicket.ticket_code} · ${selectedTicket.title}` : 'Ticket details'}
        subtitle={selectedTicket ? `${selectedTicket.category} · created ${formatDate(selectedTicket.created_at)}` : ''}
        maxWidth="max-w-3xl"
      >
        {detailsLoading && <p role="status" className="text-sm text-slate-600">Loading conversation…</p>}
        {detailsError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{detailsError}</p>}
        {selectedTicket && !detailsLoading && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Issue description</p>
                <div className="flex items-center gap-2">
                  <Badge variant={priorityVariant(selectedTicket.priority)} size="sm">{selectedTicket.priority}</Badge>
                  <Badge variant={statusVariant(selectedTicket.status)} size="sm">{selectedTicket.status}</Badge>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {selectedTicket.description || 'No additional description was provided.'}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                SLA: {slaLabel(selectedTicket)} · deadline {formatDate(selectedTicket.sla_due_at)}
              </p>
            </div>

            {canManageTicket && selectedTicket.status !== 'Closed' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  Update status
                  <select
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                    disabled={busy !== ''}
                    className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    {statusOptions(selectedTicket).map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                {statusDraft !== selectedTicket.status && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={CheckCircle2}
                    disabled={busy !== ''}
                    onClick={() => handleStatusUpdate(statusDraft)}
                  >
                    Save Status
                  </Button>
                )}
              </div>
            )}
            {canCloseOwnTicket && (
              <Button
                size="sm"
                variant="success"
                icon={CheckCircle2}
                disabled={busy !== ''}
                onClick={() => handleStatusUpdate('Closed')}
              >
                Close Resolved Ticket
              </Button>
            )}

            <section aria-labelledby="ticket-thread-title">
              <h4 id="ticket-thread-title" className="mb-3 text-sm font-bold text-slate-900">Conversation history</h4>
              {selectedTicket.messages?.length ? (
                <ol className="space-y-3">
                  {selectedTicket.messages.map((message) => (
                    <li
                      key={message.id}
                      className={`rounded-lg border p-3 ${
                        message.type === 'status'
                          ? 'border-teal-100 bg-teal-50/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap justify-between gap-1 text-xs">
                        <strong className="text-slate-800">{message.created_by}</strong>
                        <time className="text-slate-500">{formatDate(message.created_at)}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">No replies yet.</p>
              )}
            </section>

            {selectedTicket.status !== 'Closed' && (
              <form onSubmit={handleReply} className="space-y-2 border-t border-slate-100 pt-4">
                <label htmlFor="ticket-reply" className="block text-xs font-semibold text-slate-700">Add a reply</label>
                <textarea
                  id="ticket-reply"
                  required
                  maxLength="5000"
                  rows="3"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="primary" icon={Send} disabled={busy !== '' || !reply.trim()}>
                    {busy === 'reply' ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        HR accounts can raise and manage HR Query tickets only. Other users see their own tickets; managers also see direct reports; Super Admin has oversight.
      </p>
    </div>
  );
}
