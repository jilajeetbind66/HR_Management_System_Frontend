import React, { useState, useEffect } from 'react';
import { Building, Calendar, CheckCircle2, Eye, Plus, RefreshCw } from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';

const emptyAnnouncement = {
  title: '',
  content: '',
  target: 'All Company',
  category: 'General',
};

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.data?.message || error?.message || 'The announcement request could not be completed.';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AnnouncementsView() {
  const { currentUser } = useAuth();
  const {
    announcements,
    refreshAnnouncements,
    createAnnouncement,
    markAnnouncementRead,
    branches,
  } = useHRMS();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState('');
  const canPublish = ['super_admin', 'hr_admin'].includes(currentUser?.role);

  // Auto-refresh announcements and read counts every 6 seconds
  useEffect(() => {
    if (typeof refreshAnnouncements === 'function') {
      refreshAnnouncements();
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && typeof refreshAnnouncements === 'function') {
        refreshAnnouncements();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [refreshAnnouncements]);

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setBusy('publish');
    try {
      await createAnnouncement(announcementForm);
      setShowCreateModal(false);
      setAnnouncementForm(emptyAnnouncement);
      setFeedback({ type: 'success', text: 'Announcement published.' });
      if (typeof refreshAnnouncements === 'function') refreshAnnouncements();
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setBusy('');
    }
  };

  const handleMarkRead = async (announcement) => {
    setBusy(`read:${announcement.id}`);
    setFeedback(null);
    try {
      await markAnnouncementRead(announcement.id);
      setFeedback({ type: 'success', text: 'Read receipt recorded.' });
      if (typeof refreshAnnouncements === 'function') refreshAnnouncements();
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">
              Communications
            </span>
            <span className="text-xs font-medium text-slate-500">Audience-targeted broadcasts</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Company Announcements</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Read company and branch notices; your acknowledgement is recorded once for each announcement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            disabled={busy === 'refreshing'}
            onClick={async () => {
              setBusy('refreshing');
              if (typeof refreshAnnouncements === 'function') await refreshAnnouncements();
              setBusy('');
            }}
          >
            {busy === 'refreshing' ? 'Syncing...' : 'Live Sync'}
          </Button>
          {canPublish && (
            <Button variant="primary" icon={Plus} onClick={() => {
              setFormError('');
              setShowCreateModal(true);
            }}>
              Publish Announcement
            </Button>
          )}
        </div>
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

      <div className="space-y-4">
        {announcements.length === 0 && (
          <Card>
            <p className="py-6 text-center text-sm text-slate-500">No announcements are available for your branch.</p>
          </Card>
        )}
        {announcements.map((announcement) => (
          <Card
            key={announcement.id}
            title={announcement.title}
            subtitle={`Published ${formatDate(announcement.published_at)} by ${announcement.published_by}`}
            action={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant={announcement.is_read ? 'success' : 'warning'} size="sm">
                  {announcement.is_read ? 'Read' : 'Unread'}
                </Badge>
                <Badge variant="primary" size="sm">
                  <Eye className="mr-1 inline h-3 w-3" /> {announcement.read_count} Reads
                </Badge>
              </div>
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge variant="neutral" size="sm">{announcement.category}</Badge>
              <span className="inline-flex items-center gap-1">
                <Building className="h-3.5 w-3.5" /> {announcement.target}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(announcement.published_at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{announcement.content}</p>
            {!announcement.is_read && (
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={CheckCircle2}
                  disabled={busy !== ''}
                  onClick={() => handleMarkRead(announcement)}
                >
                  {busy === `read:${announcement.id}` ? 'Saving...' : 'Mark as read'}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Publish Official Announcement"
        subtitle="The notice is visible to the selected audience immediately."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{formError}</p>}
          <label className="block font-semibold text-slate-700">
            Headline / title
            <input
              type="text"
              required
              maxLength="255"
              value={announcementForm.title}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, title: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"
              placeholder="e.g. Annual Company Retreat 2026 Announcement"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block font-semibold text-slate-700">
              Target audience
              <select
                value={announcementForm.target}
                onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, target: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
              >
                <option value="All Company">All Company (all branches)</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.name}>{branch.name} only</option>
                ))}
              </select>
            </label>

            <label className="block font-semibold text-slate-700">
              Category
              <select
                value={announcementForm.category}
                onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, category: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
              >
                <option value="General">General notice</option>
                <option value="Celebration">Celebration / festival</option>
                <option value="Policy">Policy update</option>
                <option value="Wellness">Health &amp; wellness</option>
              </select>
            </label>
          </div>

          <label className="block font-semibold text-slate-700">
            Announcement body
            <textarea
              required
              rows="5"
              maxLength="20000"
              value={announcementForm.content}
              onChange={(event) => setAnnouncementForm((previous) => ({ ...previous, content: event.target.value }))}
              placeholder="Full details of the announcement..."
              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" disabled={busy !== ''} onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy !== ''}>
              {busy === 'publish' ? 'Publishing...' : 'Broadcast Now'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
