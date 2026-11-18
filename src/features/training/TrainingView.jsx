import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, GraduationCap, Printer } from 'lucide-react';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import api from '../../services/api';

const categories = [
  'Compliance',
  'Security',
  'Role-based',
  'Professional Development',
  'Wellness',
  'Other',
];

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.message || 'The request could not be completed.';
}

function displayDate(value) {
  if (!value) return 'No due date';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString();
}

function todayInputDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function displayStatus(status) {
  return status.replaceAll('_', ' ');
}

function statusStyle(status) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'pending_review') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'in_progress') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
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

function printCertificate(enrollment, onError) {
  const printWindow = window.open('', '_blank', 'width=850,height=700');
  if (!printWindow) {
    onError('Allow pop-ups to print or save this certificate as a PDF.');
    return;
  }

  printWindow.addEventListener('load', () => printWindow.print(), { once: true });
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Training Certificate</title>
        <style>
          body{font:16px Arial,sans-serif;color:#172033;margin:40px auto;max-width:900px}
          main{border:8px double #047857;padding:64px 48px;text-align:center;min-height:480px}
          .eyebrow{color:#047857;font-weight:700;letter-spacing:3px;text-transform:uppercase}
          h1{font-family:Georgia,serif;font-size:42px;margin:26px 0}
          .name{font-size:30px;font-weight:700;margin:26px 0 10px}
          .course{font-size:24px;color:#047857;font-weight:700;margin:16px 0}
          .meta{display:flex;justify-content:space-between;margin-top:64px;font-size:13px;color:#475569}
          @media print{body{margin:0;max-width:none}main{min-height:0}}
        </style>
      </head>
      <body>
        <main>
          <p class="eyebrow">Learning &amp; Development</p>
          <h1>Certificate of Completion</h1>
          <p>This certifies that</p>
          <p class="name">${escapeHtml(`${enrollment.first_name} ${enrollment.last_name}`)}</p>
          <p>Employee code: ${escapeHtml(enrollment.employee_code)}</p>
          <p>has successfully completed</p>
          <p class="course">${escapeHtml(enrollment.course_title)}</p>
          <p>${escapeHtml(enrollment.course_category)}</p>
          <div class="meta">
            <span>Completed: ${escapeHtml(displayDate(enrollment.completed_at))}</span>
            <span>Certificate ID: ${escapeHtml(enrollment.certificate_code)}</span>
          </div>
        </main>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
}

function replaceEnrollment(previous, updated) {
  const enrollments = previous.enrollments.map((enrollment) => (
    Number(enrollment.id) === Number(updated.id) ? updated : enrollment
  ));
  const courses = previous.courses.map((course) => {
    const courseEnrollments = enrollments.filter(
      (enrollment) => Number(enrollment.course_id) === Number(course.id)
    );
    return {
      ...course,
      assigned_count: courseEnrollments.length,
      completed_count: courseEnrollments.filter((enrollment) => enrollment.status === 'completed').length,
    };
  });

  return { courses, enrollments };
}

export default function TrainingView() {
  const { currentUser } = useAuth();
  const { employees = [], branches = [] } = useHRMS();
  const canManageCourses = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const canReviewCompletions = ['manager', 'hr_admin', 'super_admin'].includes(currentUser?.role);
  const [training, setTraining] = useState({ courses: [], enrollments: [] });
  const [trainingMeta, setTrainingMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingEnrollmentId, setSavingEnrollmentId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [progressDrafts, setProgressDrafts] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseDraft, setCourseDraft] = useState(null);
  const [assigningCourseId, setAssigningCourseId] = useState(null);
  const [courseAssignmentEmployeeIds, setCourseAssignmentEmployeeIds] = useState([]);
  const [uploadingCourseId, setUploadingCourseId] = useState(null);
  const [uploadingCertificateId, setUploadingCertificateId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Compliance',
    description: '',
    mandatory: true,
    due_date: '',
    material_url: '',
  });

  const refreshTraining = async () => {
    const response = await api.getTraining();
    setTraining({
      courses: Array.isArray(response?.data?.courses) ? response.data.courses : [],
      enrollments: Array.isArray(response?.data?.enrollments) ? response.data.enrollments : [],
    });
    setTrainingMeta(response?.meta || {});
  };

  useEffect(() => {
    let active = true;
    api.getTraining()
      .then((response) => {
        if (active) {
          setTraining({
            courses: Array.isArray(response?.data?.courses) ? response.data.courses : [],
            enrollments: Array.isArray(response?.data?.enrollments) ? response.data.enrollments : [],
          });
          setTrainingMeta(response?.meta || {});
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

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'active'),
    [employees]
  );
  const departments = useMemo(
    () => [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))].sort(),
    [activeEmployees]
  );
  const visibleEmployees = useMemo(() => activeEmployees.filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    const matchesSearch = !query || [
      employee.employee_code,
      employee.first_name,
      employee.last_name,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesBranch = !branchFilter || String(employee.branch_id || '') === branchFilter;
    const matchesDepartment = !departmentFilter || employee.department === departmentFilter;
    return matchesSearch && matchesBranch && matchesDepartment;
  }), [activeEmployees, employeeSearch, branchFilter, departmentFilter]);
  const pendingReviews = training.enrollments.filter(
    (enrollment) => enrollment.status === 'pending_review'
  ).length;

  const toggleEmployee = (employeeId) => {
    setSelectedEmployeeIds((previous) => (
      previous.includes(Number(employeeId))
        ? previous.filter((id) => id !== Number(employeeId))
        : [...previous, Number(employeeId)]
    ));
  };

  const toggleVisibleEmployees = (selectedIds, setSelectedIds) => {
    const visibleIds = visibleEmployees.map((employee) => Number(employee.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((previous) => allSelected
      ? previous.filter((id) => !visibleIds.includes(id))
      : [...new Set([...previous, ...visibleIds])]);
  };

  const downloadUpload = async (uploadId) => {
    setFeedback(null);
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      setFeedback({ type: 'error', text: 'Allow pop-ups to open this private training file.' });
      return;
    }
    try {
      const response = await api.getUploadDownload(uploadId);
      if (!response?.data?.url) throw new Error('The private file link was not returned.');
      newWindow.opener = null;
      newWindow.location = response.data.url;
    } catch (error) {
      newWindow.close();
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const createCourse = async (event) => {
    event.preventDefault();
    setSavingCourse(true);
    setFeedback(null);

    try {
      const response = await api.createTrainingCourse({
        ...form,
        due_date: form.due_date || null,
        material_url: form.material_url.trim() || null,
        description: form.description.trim() || null,
        employee_ids: selectedEmployeeIds,
      });
      setTraining((previous) => ({
        courses: [response.data.course, ...previous.courses],
        enrollments: [...response.data.enrollments, ...previous.enrollments],
      }));
      setSelectedEmployeeIds([]);
      setForm({
        title: '',
        category: 'Compliance',
        description: '',
        mandatory: true,
        due_date: '',
        material_url: '',
      });
      setFeedback({ type: 'success', text: 'Course created and assigned to the selected employees.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingCourse(false);
    }
  };

  const updateCourse = async (event, course) => {
    event.preventDefault();
    setSavingCourse(true);
    setFeedback(null);
    try {
      const response = await api.updateTrainingCourse(course.id, {
        ...courseDraft,
        due_date: courseDraft.due_date || null,
        material_url: courseDraft.material_url.trim() || null,
        description: courseDraft.description.trim() || null,
      });
      await refreshTraining();
      setEditingCourseId(null);
      setCourseDraft(null);
      setFeedback({ type: 'success', text: 'Course details updated.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingCourse(false);
    }
  };

  const changeCourseStatus = async (course) => {
    setFeedback(null);
    try {
      const response = await api.updateTrainingCourse(course.id, {
        status: course.status === 'archived' ? 'active' : 'archived',
      });
      await refreshTraining();
      setFeedback({ type: 'success', text: course.status === 'archived' ? 'Course reactivated.' : 'Course archived.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? Courses with assignments must be archived instead.`)) return;
    setFeedback(null);
    try {
      await api.deleteTrainingCourse(course.id);
      setTraining((previous) => ({
        ...previous,
        courses: previous.courses.filter((item) => Number(item.id) !== Number(course.id)),
      }));
      setFeedback({ type: 'success', text: 'Course deleted.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const assignMoreEmployees = async (event, course) => {
    event.preventDefault();
    setFeedback(null);
    try {
      await api.assignTrainingEmployees(course.id, courseAssignmentEmployeeIds);
      await refreshTraining();
      setCourseAssignmentEmployeeIds([]);
      setAssigningCourseId(null);
      setFeedback({ type: 'success', text: 'Training assigned to the selected employees.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    }
  };

  const uploadCourseMaterial = async (course, file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Course PDF files cannot exceed 20 MB.' });
      return;
    }
    setUploadingCourseId(course.id);
    setFeedback(null);
    try {
      await api.uploadFile(file, 'training_material', { recordId: course.id });
      await refreshTraining();
      setFeedback({ type: 'success', text: 'Course PDF uploaded securely.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setUploadingCourseId(null);
    }
  };

  const uploadCertificate = async (enrollment, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Training certificates cannot exceed 10 MB.' });
      return;
    }
    setUploadingCertificateId(enrollment.id);
    setFeedback(null);
    try {
      await api.uploadFile(file, 'training_certificates', {
        employeeId: enrollment.employee_id,
        recordId: enrollment.id,
      });
      await refreshTraining();
      setFeedback({ type: 'success', text: 'Certificate uploaded securely.' });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setUploadingCertificateId(null);
    }
  };

  const saveProgress = async (enrollment) => {
    const progress = Number(progressDrafts[enrollment.id] ?? enrollment.progress_percent);
    setSavingEnrollmentId(enrollment.id);
    setFeedback(null);

    try {
      const response = await api.updateTrainingProgress(enrollment.id, progress);
      setTraining((previous) => replaceEnrollment(previous, response.data));
      setProgressDrafts((previous) => {
        const next = { ...previous };
        delete next[enrollment.id];
        return next;
      });
      setFeedback({
        type: 'success',
        text: progress === 100
          ? 'Completion submitted for manager or HR review.'
          : 'Training progress saved.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  const reviewCompletion = async (enrollment, decision) => {
    const reviewNote = reviewNotes[enrollment.id] || '';
    setSavingEnrollmentId(enrollment.id);
    setFeedback(null);

    try {
      const response = await api.reviewTrainingCompletion(enrollment.id, decision, reviewNote);
      setTraining((previous) => replaceEnrollment(previous, response.data));
      setReviewNotes((previous) => {
        const next = { ...previous };
        delete next[enrollment.id];
        return next;
      });
      setFeedback({
        type: 'success',
        text: decision === 'approved' ? 'Completion approved and certificate issued.' : 'Completion returned to the employee.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setSavingEnrollmentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
            Learning &amp; Development
          </span>
          <span className="text-xs text-slate-500 font-medium">Compliance and professional certifications</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Training &amp; Professional Development</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          HR assigns courses, employees submit completion, and managers or HR verify certificates.
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

      {currentUser?.role === 'manager' && trainingMeta.team_training && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase text-amber-700">Team training pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{trainingMeta.team_training.pending_count}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase text-rose-700">Team training overdue</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">{trainingMeta.team_training.overdue_count}</p>
          </div>
        </div>
      )}

      {canManageCourses && (
        <Card title="Create and assign a course" subtitle="Select one or more active employees. Course assignments and due dates are stored in the HRMS.">
          <form onSubmit={createCourse} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Course title
                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Due date {form.mandatory ? '(required for mandatory training)' : '(optional)'}
                <input
                  type="date"
                  min={todayInputDate()}
                  required={form.mandatory}
                  value={form.due_date}
                  onChange={(event) => setForm((previous) => ({ ...previous, due_date: event.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-700">
              Course description (optional)
              <textarea
                rows={2}
                maxLength={5000}
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Video or course link (optional)
              <input
                type="url"
                maxLength={2000}
                value={form.material_url}
                onChange={(event) => setForm((previous) => ({ ...previous, material_url: event.target.value }))}
                placeholder="https://…"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.mandatory}
                onChange={(event) => setForm((previous) => ({ ...previous, mandatory: event.target.checked }))}
                className="rounded border-slate-300 text-teal-600"
              />
              Mandatory training
            </label>

            <fieldset className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-xs font-semibold text-slate-700">Assign to active employees</legend>
              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-700">
                  Search employees
                  <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Branch
                  <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">All branches</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Department
                  <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">All departments</option>
                    {departments.map((department) => <option key={department}>{department}</option>)}
                  </select>
                </label>
              </div>
              {activeEmployees.length === 0 ? (
                <p className="py-2 text-xs text-slate-500">No active employee records are available.</p>
              ) : visibleEmployees.length === 0 ? (
                <p className="py-2 text-xs text-slate-500">No active employees match these filters.</p>
              ) : (
                <>
                  <button type="button" className="mb-2 text-xs font-semibold text-teal-700 underline"
                    onClick={() => toggleVisibleEmployees(selectedEmployeeIds, setSelectedEmployeeIds)}>
                    {visibleEmployees.every((employee) => selectedEmployeeIds.includes(Number(employee.id)))
                      ? 'Clear visible selection'
                      : 'Select all filtered employees'}
                  </button>
                  <div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                  {visibleEmployees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 rounded-md p-2 text-xs text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(Number(employee.id))}
                        onChange={() => toggleEmployee(employee.id)}
                        className="rounded border-slate-300 text-teal-600"
                      />
                      <span>{employee.employee_code} — {employee.first_name} {employee.last_name}</span>
                    </label>
                  ))}
                  </div>
                </>
              )}
            </fieldset>

            <button
              type="submit"
              disabled={savingCourse || selectedEmployeeIds.length === 0}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingCourse ? 'Saving…' : 'Create and assign course'}
            </button>
          </form>
        </Card>
      )}

      <Card
        title="Training courses"
        subtitle={pendingReviews > 0 ? `${pendingReviews} completion${pendingReviews === 1 ? '' : 's'} awaiting review` : 'Assignments and completion progress'}
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading training records…</p>
        ) : training.courses.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No training courses have been assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {training.courses.map((course) => {
              const enrollments = training.enrollments.filter(
                (enrollment) => Number(enrollment.course_id) === Number(course.id)
              );
              const isEditing = Number(editingCourseId) === Number(course.id);
              const isAssigning = Number(assigningCourseId) === Number(course.id);

              return (
                <section key={course.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-col gap-3 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className="mt-0.5 rounded-lg bg-teal-50 p-2 text-teal-600">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="font-semibold text-sm text-slate-800">{course.title}</h2>
                        <p className="mt-1 text-xs text-slate-500">{course.category} · Due {displayDate(course.due_date)}</p>
                        {course.description && <p className="mt-2 text-xs text-slate-600">{course.description}</p>}
                        {course.material_url && (
                          <a href={course.material_url} target="_blank" rel="noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-teal-700 underline">
                            Open course video / link
                          </a>
                        )}
                        {course.material_upload_id && (
                          <button type="button" onClick={() => downloadUpload(course.material_upload_id)}
                            className="mt-2 block text-xs font-semibold text-teal-700 underline">
                            Download PDF: {course.material_filename || 'Course material'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {course.status === 'archived' && (
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-600">Archived</span>
                      )}
                      {course.mandatory ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 font-semibold text-rose-700">Mandatory</span>
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold">Optional</span>
                      )}
                      <span>{course.completed_count}/{course.assigned_count} complete</span>
                    </div>
                  </div>

                  {canManageCourses && (
                    <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                      <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                        onClick={() => {
                          setEditingCourseId(isEditing ? null : course.id);
                          setCourseDraft({
                            title: course.title,
                            category: course.category,
                            description: course.description || '',
                            mandatory: Boolean(course.mandatory),
                            due_date: course.due_date ? course.due_date.slice(0, 10) : '',
                            material_url: course.material_url || '',
                          });
                        }}>
                        {isEditing ? 'Close editor' : 'Edit course'}
                      </button>
                      <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
                        onClick={() => changeCourseStatus(course)}>
                        {course.status === 'archived' ? 'Reactivate' : 'Archive'}
                      </button>
                      {Number(course.assigned_count) === 0 && (
                        <button type="button" className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                          onClick={() => deleteCourse(course)}>
                          Delete unassigned course
                        </button>
                      )}
                      {course.status === 'active' && (
                        <button type="button" className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700"
                          onClick={() => {
                            setAssigningCourseId(isAssigning ? null : course.id);
                            setCourseAssignmentEmployeeIds([]);
                          }}>
                          {isAssigning ? 'Close assignment' : 'Assign more employees'}
                        </button>
                      )}
                      <label className="cursor-pointer rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700">
                        {uploadingCourseId === course.id ? 'Uploading PDF…' : 'Upload course PDF (max 20 MB)'}
                        <input type="file" accept=".pdf,application/pdf" className="sr-only"
                          disabled={uploadingCourseId === course.id}
                          onChange={(event) => {
                            uploadCourseMaterial(course, event.target.files?.[0]);
                            event.target.value = '';
                          }} />
                      </label>
                    </div>
                  )}

                  {isEditing && courseDraft && (
                    <form onSubmit={(event) => updateCourse(event, course)} className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
                      <label className="text-xs font-medium text-slate-700">
                        Course title
                        <input required maxLength={255} value={courseDraft.title}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, title: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Category
                        <select value={courseDraft.category}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, category: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          {categories.map((category) => <option key={category}>{category}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Due date {courseDraft.mandatory ? '(required)' : '(optional)'}
                        <input type="date" min={todayInputDate()} required={courseDraft.mandatory}
                          value={courseDraft.due_date}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, due_date: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Video or course link
                        <input type="url" maxLength={2000} value={courseDraft.material_url}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, material_url: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                        Description
                        <textarea rows={2} maxLength={5000} value={courseDraft.description}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, description: event.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 sm:col-span-2">
                        <input type="checkbox" checked={courseDraft.mandatory}
                          onChange={(event) => setCourseDraft((previous) => ({ ...previous, mandatory: event.target.checked }))}
                          className="rounded border-slate-300" />
                        Mandatory training
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" disabled={savingCourse}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                          {savingCourse ? 'Saving…' : 'Save course'}
                        </button>
                        <button type="button" onClick={() => setEditingCourseId(null)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {isAssigning && (
                    <form onSubmit={(event) => assignMoreEmployees(event, course)} className="space-y-3 border-b border-slate-100 p-4">
                      <p className="text-xs font-semibold text-slate-700">Assign this course to additional active employees</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input aria-label="Search employees" placeholder="Search employees"
                          value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                        <select aria-label="Filter by branch" value={branchFilter}
                          onChange={(event) => setBranchFilter(event.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                          <option value="">All branches</option>
                          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                        <select aria-label="Filter by department" value={departmentFilter}
                          onChange={(event) => setDepartmentFilter(event.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                          <option value="">All departments</option>
                          {departments.map((department) => <option key={department}>{department}</option>)}
                        </select>
                      </div>
                      <button type="button" className="text-xs font-semibold text-teal-700 underline"
                        onClick={() => {
                          const unassigned = visibleEmployees.filter(
                            (emp) => !enrollments.some((e) => Number(e.employee_id) === Number(emp.id))
                          );
                          const unassignedIds = unassigned.map((e) => Number(e.id));
                          const allSelected = unassignedIds.every((id) => courseAssignmentEmployeeIds.includes(id));
                          setCourseAssignmentEmployeeIds(allSelected ? [] : unassignedIds);
                        }}>
                        Select all unassigned filtered employees
                      </button>
                      <div className="grid max-h-40 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                        {visibleEmployees.map((employee) => {
                          const alreadyAssigned = enrollments.some((e) => Number(e.employee_id) === Number(employee.id));
                          return (
                          <label key={employee.id} className={`flex items-center gap-2 text-xs ${alreadyAssigned ? 'text-slate-400 opacity-60' : 'text-slate-700'}`}>
                            <input
                              type="checkbox"
                              disabled={alreadyAssigned}
                              checked={alreadyAssigned || courseAssignmentEmployeeIds.includes(Number(employee.id))}
                              onChange={() => setCourseAssignmentEmployeeIds((previous) => (
                                previous.includes(Number(employee.id))
                                  ? previous.filter((id) => id !== Number(employee.id))
                                  : [...previous, Number(employee.id)]
                              ))}
                            />
                            {employee.employee_code} — {employee.first_name} {employee.last_name}
                            {alreadyAssigned && ' (Enrolled)'}
                          </label>
                          );
                        })}
                      </div>
                      <button type="submit" disabled={courseAssignmentEmployeeIds.length === 0}
                        className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        Assign selected employees
                      </button>
                    </form>
                  )}

                  {enrollments.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">No visible assignments for this course.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {enrollments.map((enrollment) => {
                        const isOwner = Number(currentUser?.employee_id) === Number(enrollment.employee_id);
                        const canUpdateProgress = isOwner && ['employee', 'manager'].includes(currentUser?.role);
                        const canReview = canReviewCompletions
                          && !isOwner
                          && enrollment.status === 'pending_review';
                        const isLocked = ['pending_review', 'completed'].includes(enrollment.status)
                          || enrollment.course_status === 'archived';
                        const progress = Number(progressDrafts[enrollment.id] ?? enrollment.progress_percent);

                        return (
                          <article key={enrollment.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm text-slate-800">
                                  {enrollment.employee_code} — {enrollment.first_name} {enrollment.last_name}
                                </p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(enrollment.status)}`}>
                                  {displayStatus(enrollment.status)}
                                </span>
                                {enrollment.is_overdue && (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Overdue</span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                <progress
                                  className="h-1.5 flex-1 accent-teal-600"
                                  value={enrollment.progress_percent}
                                  max="100"
                                  aria-label={`${enrollment.progress_percent}% complete`}
                                />
                                <span>{enrollment.progress_percent}%</span>
                              </div>
                              {enrollment.review_note && (
                                <p className="mt-2 text-xs text-amber-700">
                                  Reviewer note: {enrollment.review_note}
                                </p>
                              )}
                              {enrollment.status === 'completed' && (
                                <p className="mt-2 text-xs text-emerald-700">
                                  Certificate ID: {enrollment.certificate_code}
                                </p>
                              )}
                              {enrollment.certificate_upload_id && (
                                <button type="button" onClick={() => downloadUpload(enrollment.certificate_upload_id)}
                                  className="block text-xs font-semibold text-teal-700 underline">
                                  Download uploaded certificate: {enrollment.certificate_filename || 'Certificate'}
                                </button>
                              )}
                              {canUpdateProgress && !enrollment.certificate_upload_id && (
                                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                                  {uploadingCertificateId === enrollment.id ? 'Uploading…' : 'Upload certificate (PDF/JPG/PNG, max 10 MB)'}
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only"
                                    disabled={uploadingCertificateId === enrollment.id}
                                    onChange={(event) => {
                                      uploadCertificate(enrollment, event.target.files?.[0]);
                                      event.target.value = '';
                                    }} />
                                </label>
                              )}
                            </div>

                            <div className="space-y-3">
                              {canUpdateProgress && (
                                <div className="flex flex-wrap items-end gap-3">
                                  <label className="min-w-40 flex-1 text-xs font-medium text-slate-600">
                                    Update progress: {progress}%
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      step="5"
                                      disabled={isLocked}
                                      value={progress}
                                      onChange={(event) => setProgressDrafts((previous) => ({
                                        ...previous,
                                        [enrollment.id]: Number(event.target.value),
                                      }))}
                                      className="mt-2 block w-full accent-teal-600 disabled:opacity-50"
                                    />
                                  </label>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      disabled={savingEnrollmentId === enrollment.id}
                                      onClick={() => saveProgress(enrollment)}
                                      className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                                    >
                                      {savingEnrollmentId === enrollment.id
                                        ? 'Saving…'
                                        : progress === 100 ? 'Submit for review' : 'Save progress'}
                                    </button>
                                  )}
                                </div>
                              )}

                              {canReview && (
                                <div className="space-y-2">
                                  <label className="block text-xs font-medium text-slate-600">
                                    Reviewer note (required when returning)
                                    <textarea
                                      rows={2}
                                      maxLength={2000}
                                      value={reviewNotes[enrollment.id] || ''}
                                      onChange={(event) => setReviewNotes((previous) => ({
                                        ...previous,
                                        [enrollment.id]: event.target.value,
                                      }))}
                                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={savingEnrollmentId === enrollment.id}
                                      onClick={() => reviewCompletion(enrollment, 'approved')}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Approve completion
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingEnrollmentId === enrollment.id || !(reviewNotes[enrollment.id] || '').trim()}
                                      onClick={() => reviewCompletion(enrollment, 'returned')}
                                      className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                    >
                                      Return to employee
                                    </button>
                                  </div>
                                </div>
                              )}

                              {enrollment.status === 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => printCertificate(enrollment, (text) => setFeedback({ type: 'error', text }))}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print / Save certificate
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        Certificates are issued only after a manager or HR reviewer approves a submitted completion. PDFs are limited to 20 MB; uploaded certificates accept PDF/JPG/PNG up to 10 MB. Video material should be shared using a secure HTTPS link.
      </div>
    </div>
  );
}
