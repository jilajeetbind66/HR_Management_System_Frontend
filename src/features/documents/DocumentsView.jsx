import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import Card from '../../components/common/Card';
import CloudinaryUpload from '../../components/common/CloudinaryUpload';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import api from '../../services/api';

const POLICY_CATEGORIES = [
  'Code of Conduct',
  'Information Security',
  'POSH',
  'Privacy & Data Protection',
  'Attendance',
  'Expense & Travel',
  'Other',
];

const LETTER_TYPES = [
  { value: 'appointment_details', label: 'Appointment details' },
  { value: 'employment_verification', label: 'Employment verification' },
  { value: 'experience', label: 'Experience letter' },
  { value: 'relieving', label: 'Relieving letter' },
];

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.data?.message || error?.message || 'The request could not be completed.';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function todayIsoDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function statusClass(status) {
  if (status === 'verified' || status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'rejected' || status === 'archived') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function escapeHtml(value) {
  return String(value ?? '—').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function printLetter(letter, onError) {
  const printWindow = window.open('', '_blank', 'width=850,height=700');
  if (!printWindow) {
    onError('Allow pop-ups to print or save this draft as a PDF.');
    return;
  }

  const snapshot = letter.snapshot || {};
  const title = LETTER_TYPES.find((type) => type.value === letter.letter_type)?.label || 'HR letter';
  const fields = [
    ['Employee', snapshot.employee_name],
    ['Employee code', snapshot.employee_code],
    ['Designation', snapshot.designation],
    ['Department', snapshot.department],
    ['Branch', snapshot.branch],
    ['Date of joining', formatDate(snapshot.date_of_joining)],
    ...(snapshot.last_working_date ? [['Last working date', formatDate(snapshot.last_working_date)]] : []),
    ['Issued on', formatDate(snapshot.issued_on)],
  ];

  printWindow.addEventListener('load', () => printWindow.print(), { once: true });
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)} - ${escapeHtml(letter.letter_number)}</title>
        <style>
          body{font:15px Arial,sans-serif;color:#172033;margin:40px auto;max-width:760px;padding:0 24px}
          header{border-bottom:2px solid #047857;padding-bottom:18px;margin-bottom:32px}
          h1{font-size:25px;margin:0 0 8px}
          .draft{color:#b45309;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
          dl{display:grid;grid-template-columns:190px 1fr;gap:12px 20px}
          dt{color:#64748b}dd{margin:0;font-weight:600}
          .disclaimer{border:1px solid #fcd34d;background:#fffbeb;padding:14px;margin-top:36px;font-size:12px;line-height:1.6}
          @media print{body{margin:0 auto;padding:24px}}
        </style>
      </head>
      <body>
        <header><p class="draft">Draft for review</p><h1>${escapeHtml(title)}</h1><p>Reference: ${escapeHtml(letter.letter_number)}</p></header>
        <main><dl>${fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl></main>
        <p class="disclaimer">${escapeHtml(snapshot.draft_disclaimer)}</p>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
}

function SectionMessage({ children }) {
  return <p className="py-8 text-center text-xs text-slate-500">{children}</p>;
}

export default function DocumentsView() {
  const { currentUser, activeBranch } = useAuth();
  const { employees = [] } = useHRMS();
  const canManage = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const isBranchScoped = Boolean(activeBranch && activeBranch !== 'All Branches');
  const [activeTab, setActiveTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [letters, setLetters] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [policyForm, setPolicyForm] = useState({
    title: '',
    category: POLICY_CATEGORIES[0],
    version: '',
    effective_date: '',
    mandatory: true,
    content: '',
  });
  const [letterType, setLetterType] = useState(LETTER_TYPES[0].value);
  const [letterEmployeeId, setLetterEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.allSettled([
      api.getPolicies(),
      api.getHrLetters(),
      api.getEmployeeDocuments(),
    ]).then((results) => {
      if (!active) return;
      const failures = [];
      const [policyResult, letterResult, documentResult] = results;
      if (policyResult.status === 'fulfilled') setPolicies(policyResult.value?.data || []);
      else failures.push(errorText(policyResult.reason));
      if (letterResult.status === 'fulfilled') setLetters(letterResult.value?.data || []);
      else failures.push(errorText(letterResult.reason));
      if (documentResult.status === 'fulfilled') setEmployeeDocs(documentResult.value?.data || []);
      else failures.push(errorText(documentResult.reason));
      if (failures.length) {
        setFeedback({ type: 'error', text: failures.join(' ') });
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [currentUser?.employee_id, currentUser?.role, refreshKey]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => {
      if (employee.status !== 'active') return false;
      if (!isBranchScoped) return true;
      const bName = employee.branch_name || '';
      return (
        bName === activeBranch ||
        (activeBranch.includes('Prayagraj') && bName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && bName.includes('Kaushambi'))
      );
    }),
    [employees, isBranchScoped, activeBranch]
  );

  const filteredEmployeeDocs = useMemo(() => {
    if (!isBranchScoped) return employeeDocs;
    return employeeDocs.filter((doc) => {
      const emp = employees.find((e) => Number(e.id) === Number(doc.employee_id));
      const bName = emp?.branch_name || '';
      return (
        bName === activeBranch ||
        (activeBranch.includes('Prayagraj') && bName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && bName.includes('Kaushambi'))
      );
    });
  }, [employeeDocs, employees, isBranchScoped, activeBranch]);

  const filteredLetters = useMemo(() => {
    if (!isBranchScoped) return letters;
    return letters.filter((letter) => {
      const emp = employees.find((e) => Number(e.id) === Number(letter.employee_id));
      const bName = emp?.branch_name || '';
      return (
        bName === activeBranch ||
        (activeBranch.includes('Prayagraj') && bName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && bName.includes('Kaushambi'))
      );
    });
  }, [letters, employees, isBranchScoped, activeBranch]);
  const selectedUploadEmployeeId = canManage ? selectedEmployeeId : String(currentUser?.employee_id || '');
  const today = todayIsoDate();

  const acknowledgePolicy = async (policy) => {
    setBusyAction(`policy-${policy.id}`);
    setFeedback(null);
    try {
      await api.acknowledgePolicy(policy.id);
      setFeedback({ type: 'success', text: `Acknowledgement saved for “${policy.title}”.` });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyAction('');
    }
  };

  const createPolicy = async (event) => {
    event.preventDefault();
    setBusyAction('create-policy');
    setFeedback(null);
    try {
      await api.createPolicy({
        ...policyForm,
        title: policyForm.title.trim(),
        version: policyForm.version.trim(),
        content: policyForm.content.trim(),
      });
      setPolicyForm({
        title: '',
        category: POLICY_CATEGORIES[0],
        version: '',
        effective_date: '',
        mandatory: true,
        content: '',
      });
      setFeedback({ type: 'success', text: 'Policy published.' });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyAction('');
    }
  };

  const archivePolicy = async (policy) => {
    setBusyAction(`policy-${policy.id}`);
    setFeedback(null);
    try {
      await api.archivePolicy(policy.id);
      setPolicies((previous) => previous.map((item) => (
        Number(item.id) === Number(policy.id) ? { ...item, status: 'archived' } : item
      )));
      setFeedback({ type: 'success', text: `“${policy.title}” was archived.` });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyAction('');
    }
  };

  const reviewDocument = async (document, decision) => {
    setBusyAction(`document-${document.id}`);
    setFeedback(null);
    try {
      const response = await api.reviewEmployeeDocument(
        document.id,
        decision,
        reviewNotes[document.id] || ''
      );
      setEmployeeDocs((previous) => previous.map((item) => (
        Number(item.id) === Number(document.id) ? { ...item, ...response.data } : item
      )));
      setReviewNotes((previous) => ({ ...previous, [document.id]: '' }));
      setFeedback({ type: 'success', text: `Document ${decision}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyAction('');
    }
  };

  const createLetter = async (event) => {
    event.preventDefault();
    setBusyAction('create-letter');
    setFeedback(null);
    try {
      const response = await api.createHrLetter({
        employee_id: Number(letterEmployeeId),
        letter_type: letterType,
      });
      setLetters((previous) => [response.data, ...previous]);
      setFeedback({ type: 'success', text: `${LETTER_TYPES.find((type) => type.value === letterType)?.label} draft created.` });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusyAction('');
    }
  };

  const openDocument = async (document) => {
    const newWindow = window.open('about:blank', '_blank');
    setFeedback(null);
    try {
      const response = await api.getUploadDownload(document.id);
      if (newWindow) newWindow.location.href = response.data.url;
      else setFeedback({ type: 'error', text: 'Allow pop-ups to open the private document.' });
    } catch (error) {
      newWindow?.close();
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const tabs = [
    { id: 'policies', label: 'Company Policies', icon: FileText },
    { id: 'verification', label: 'Document Verification', icon: ShieldCheck },
    { id: 'letters', label: 'HR Letter Drafts', icon: FileCheck2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">
            Governance &amp; Compliance
          </span>
          <span className="text-xs font-medium text-slate-500">Policy acknowledgements &amp; private records</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Documents &amp; Corporate Policies</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Review company policies, securely manage employee documents, and prepare printable HR letter drafts.
        </p>
      </div>

      {feedback && (
        <p
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-xs ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex items-center gap-4 overflow-x-auto border-b border-slate-200 text-xs" role="tablist" aria-label="Documents sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`documents-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`documents-panel-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 font-semibold transition ${
              activeTab === id
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading documents…
        </p>
      )}

      {activeTab === 'policies' && (
        <section id="documents-panel-policies" role="tabpanel" aria-labelledby="documents-tab-policies">
          <Card title="Company Policies" subtitle="Published policies and acknowledgement records for your access scope">
            {canManage && (
              <details className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-800">Publish a policy</summary>
                <form onSubmit={createPolicy} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">
                    Policy title
                    <input
                      required
                      maxLength={255}
                      value={policyForm.title}
                      onChange={(event) => setPolicyForm({ ...policyForm, title: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Category
                    <select
                      value={policyForm.category}
                      onChange={(event) => setPolicyForm({ ...policyForm, category: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                    >
                      {POLICY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Version
                    <input
                      required
                      maxLength={20}
                      value={policyForm.version}
                      onChange={(event) => setPolicyForm({ ...policyForm, version: event.target.value })}
                      placeholder="e.g. 1.0"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Effective date
                    <input
                      required
                      type="date"
                      value={policyForm.effective_date}
                      onChange={(event) => setPolicyForm({ ...policyForm, effective_date: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={policyForm.mandatory}
                      onChange={(event) => setPolicyForm({ ...policyForm, mandatory: event.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Acknowledgement is mandatory
                  </label>
                  <label className="text-xs font-medium text-slate-700 md:col-span-2">
                    Policy text
                    <textarea
                      required
                      maxLength={20000}
                      rows={5}
                      value={policyForm.content}
                      onChange={(event) => setPolicyForm({ ...policyForm, content: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busyAction === 'create-policy'}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60 md:col-span-2 md:justify-self-start"
                  >
                    {busyAction === 'create-policy' ? 'Publishing…' : 'Publish policy'}
                  </button>
                </form>
              </details>
            )}

            {policies.length === 0 && !loading ? (
              <SectionMessage>No company policies are available.</SectionMessage>
            ) : (
              <div className="space-y-3">
                {policies.map((policy) => {
                  const effective = String(policy.effective_date).slice(0, 10) <= today;
                  const canAcknowledge = Boolean(currentUser?.employee_id)
                    && policy.status === 'active'
                    && effective
                    && !policy.acknowledged_by_current_user;

                  return (
                    <article key={policy.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{policy.title}</h3>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(policy.status)}`}>
                              {policy.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {policy.category} · Version {policy.version} · Effective {formatDate(policy.effective_date)}
                            {policy.mandatory ? ' · Mandatory' : ' · Optional'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Acknowledged by {policy.acknowledged_count || 0} of {policy.visible_employee_count || 0} people in your access scope
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canAcknowledge && (
                            <button
                              type="button"
                              disabled={busyAction === `policy-${policy.id}`}
                              onClick={() => acknowledgePolicy(policy)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Acknowledge
                            </button>
                          )}
                          {policy.acknowledged_by_current_user && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Acknowledged
                            </span>
                          )}
                          {canManage && policy.status === 'active' && (
                            <button
                              type="button"
                              disabled={busyAction === `policy-${policy.id}`}
                              onClick={() => archivePolicy(policy)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                      <details className="mt-3 border-t border-slate-100 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-teal-700">Read policy</summary>
                        <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-700">{policy.content}</p>
                      </details>
                      {policy.acknowledgements?.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                            Acknowledgement details ({policy.acknowledgements.length})
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            {policy.acknowledgements.map((acknowledgement) => (
                              <li key={acknowledgement.id}>
                                {acknowledgement.first_name} {acknowledgement.last_name}
                                {acknowledgement.employee_code ? ` (${acknowledgement.employee_code})` : ''}
                                {' · '}{formatDate(acknowledgement.acknowledged_at)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      )}

      {activeTab === 'verification' && (
        <section id="documents-panel-verification" role="tabpanel" aria-labelledby="documents-tab-verification">
          <Card title="Private Document Verification" subtitle="Private Cloudinary files are accessed through authorized, audited downloads">
            <div className="mb-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">Upload an employee document (PDF, JPG or PNG; max 20 MB)</p>
              {canManage && (
                <label className="block max-w-sm text-xs font-medium text-slate-700">
                  Employee
                  <select
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <option value="">Select employee</option>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_code})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block max-w-sm text-xs font-medium text-slate-700">
                Document type
                <input
                  type="text"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  placeholder="e.g. Identity document"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                />
              </label>
              {selectedUploadEmployeeId && documentType.trim() ? (
                <CloudinaryUpload
                  module="employee_documents"
                  employeeId={selectedUploadEmployeeId}
                  documentType={documentType.trim()}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onUploaded={() => {
                    setDocumentType('');
                    setRefreshKey((value) => value + 1);
                  }}
                />
              ) : (
                <p className="text-xs text-slate-500">
                  {canManage
                    ? 'Select an employee and enter a document type to upload.'
                    : 'Enter a document type to upload a file to your own employee record.'}
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Employee</th>
                    <th scope="col" className="px-4 py-3">Document</th>
                    <th scope="col" className="px-4 py-3">Submitted</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Review</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredEmployeeDocs.map((document) => (
                    <tr key={document.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {[document.first_name, document.last_name].filter(Boolean).join(' ') || 'My document'}
                        {document.employee_code ? ` (${document.employee_code})` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{document.document_type}</p>
                        <p className="mt-1 text-slate-500">{document.original_filename}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(document.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(document.status)}`}>
                          {String(document.status || 'pending').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {document.reviewed_by_name ? (
                          <>
                            <p>{document.reviewed_by_name} · {formatDate(document.reviewed_at)}</p>
                            {document.review_note && <p className="mt-1 max-w-xs whitespace-pre-wrap text-slate-500">{document.review_note}</p>}
                          </>
                        ) : 'Awaiting review'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDocument(document)}
                            className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            Open
                          </button>
                          {canManage && document.status === 'pending' && (
                            <div className="flex min-w-48 flex-col items-end gap-2">
                              <input
                                aria-label={`Review note for ${document.original_filename}`}
                                value={reviewNotes[document.id] || ''}
                                onChange={(event) => setReviewNotes((previous) => ({
                                  ...previous,
                                  [document.id]: event.target.value,
                                }))}
                                placeholder="Note required to reject"
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-left"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={busyAction === `document-${document.id}`}
                                  onClick={() => reviewDocument(document, 'verified')}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                                >
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  disabled={busyAction === `document-${document.id}` || !(reviewNotes[document.id] || '').trim()}
                                  title={!(reviewNotes[document.id] || '').trim() ? 'Enter a review note before rejecting' : undefined}
                                  onClick={() => reviewDocument(document, 'rejected')}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                                >
                                  <X className="h-3 w-3" aria-hidden="true" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployeeDocs.length === 0 && !loading && (
                    <tr><td colSpan="6"><SectionMessage>{isBranchScoped ? `No employee documents uploaded for ${activeBranch}.` : 'No employee documents uploaded yet.'}</SectionMessage></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {!canManage && currentUser?.role === 'hr_executive' && (
              <p className="mt-3 text-xs text-slate-500">HR Executive document access is limited to the linked employee record; verification is managed by HR Admin.</p>
            )}
          </Card>
        </section>
      )}

      {activeTab === 'letters' && (
        <section id="documents-panel-letters" role="tabpanel" aria-labelledby="documents-tab-letters" className="space-y-5">
          {canManage && (
            <Card title="Create a Letter Draft" subtitle="Drafts contain basic employment details only; no salary or bank data">
              <form onSubmit={createLetter} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs font-medium text-slate-700">
                  Employee
                  <select
                    required
                    value={letterEmployeeId}
                    onChange={(event) => setLetterEmployeeId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Letter type
                  <select
                    value={letterType}
                    onChange={(event) => setLetterType(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"
                  >
                    {LETTER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={!letterEmployeeId || busyAction === 'create-letter'}
                  className="self-end rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {busyAction === 'create-letter' ? 'Creating…' : 'Create draft'}
                </button>
                {letterType === 'relieving' && (
                  <p className="text-xs text-slate-500 md:col-span-3">
                    A relieving draft is available only after the employee has a completed offboarding clearance case.
                  </p>
                )}
              </form>
            </Card>
          )}

          <Card title="HR Letter Drafts" subtitle="Print a reviewed draft or save it as a PDF from your browser">
            {filteredLetters.length === 0 && !loading ? (
              <SectionMessage>{isBranchScoped ? `No HR letter drafts are available for ${activeBranch}.` : 'No HR letter drafts are available.'}</SectionMessage>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Reference</th>
                      <th scope="col" className="px-4 py-3">Employee</th>
                      <th scope="col" className="px-4 py-3">Letter type</th>
                      <th scope="col" className="px-4 py-3">Created</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredLetters.map((letter) => (
                      <tr key={letter.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{letter.letter_number}</td>
                        <td className="px-4 py-3">
                          {letter.first_name} {letter.last_name} ({letter.employee_code})
                        </td>
                        <td className="px-4 py-3">
                          {LETTER_TYPES.find((type) => type.value === letter.letter_type)?.label || letter.letter_type}
                        </td>
                        <td className="px-4 py-3">{formatDate(letter.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(letter.status)}`}>
                            {letter.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => printLetter(letter, (text) => setFeedback({ type: 'error', text }))}
                            className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:underline"
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                            Print / Save PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
