import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import CloudinaryUpload from '../../components/common/CloudinaryUpload';
import api from '../../services/api';
import { getIndiaDateString } from '../../utils/date';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Upload,
  UserCheck,
  FileSpreadsheet,
  MapPin,
  Laptop,
  Download
} from 'lucide-react';

export default function AttendanceView() {
  const { currentUser } = useAuth();
  const {
    attendance,
    punchAttendance,
    regularizationRequests,
    submitRegularization,
    reviewRegularization,
    refreshAttendance,
    employees
  } = useHRMS();

  const [activeTab, setActiveTab] = useState('punches'); // 'punches' | 'regularization' | 'import'
  const [showRegModal, setShowRegModal] = useState(false);
  const [regDate, setRegDate] = useState(getIndiaDateString);
  const [regIn, setRegIn] = useState('09:15 AM');
  const [regOut, setRegOut] = useState('06:30 PM');
  const [regReason, setRegReason] = useState('');
  const [regModalError, setRegModalError] = useState('');
  const [importFiles, setImportFiles] = useState([]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [busyImportId, setBusyImportId] = useState(null);
  const [importRefresh, setImportRefresh] = useState(0);
  const [workflowError, setWorkflowError] = useState('');
  const canManageAttendance = ['super_admin', 'hr_admin', 'hr_executive', 'manager'].includes(currentUser.role);
  const canViewCsvImports = ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser.role);
  const canProcessCsvImports = ['super_admin', 'hr_admin'].includes(currentUser.role);
  const canApprove = canManageAttendance;
  const [punchFeedback, setPunchFeedback] = useState(null);

  useEffect(() => {
    if (!canViewCsvImports) {
      setImportFiles([]);
      return;
    }

    let active = true;
    api.getAttendanceImports()
      .then((response) => {
        if (active) setImportFiles(response?.data || []);
      })
      .catch((error) => {
        if (active) setImportError(error?.data?.message || error.message || 'Unable to load uploaded files.');
      });

    return () => {
      active = false;
    };
  }, [canViewCsvImports, importRefresh]);

  const today = getIndiaDateString();
  const hasEmployeeProfile = Boolean(currentUser?.employee_id);
  const myPunch = hasEmployeeProfile
    ? attendance.find(a => Number(a.employee_id) === Number(currentUser.employee_id) && a.date === today)
    : null;
  const hasPunchedIn = Boolean(myPunch?.punch_in);
  const isPunchComplete = Boolean(myPunch?.punch_in && myPunch?.punch_out);
  const currentEmployeeName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.name;

  const myMissingPunches = useMemo(() => {
    if (!currentUser?.employee_id) return [];
    return attendance.filter((a) => (
      Number(a.employee_id) === Number(currentUser.employee_id) &&
      a.date < today &&
      !a.punch_out &&
      !regularizationRequests.some((r) => Number(r.employee_id) === Number(currentUser.employee_id) && r.date === a.date && r.status === 'pending')
    ));
  }, [attendance, currentUser, today, regularizationRequests]);

  const handleOpenRegularizeForRecord = (record) => {
    setRegDate(record.date);
    setRegIn(record.punch_in || '09:15 AM');
    setRegOut(record.punch_out || '06:30 PM');
    setRegReason(record.punch_out ? `Correction for punch times on ${record.date}` : `Missed punch-out on ${record.date}. Requested standard exit time.`);
    setRegModalError('');
    setShowRegModal(true);
  };

  const handlePunchClick = async () => {
    if (!hasEmployeeProfile || isPunchComplete) return;

    try {
      const res = await punchAttendance(currentUser.employee_id, currentUser.branch_name || 'Web Portal');
      if (res?.type === 'in') {
        setPunchFeedback(`Punched IN at ${res.punch?.punch_in || 'now'}`);
      } else if (res?.type === 'out') {
        setPunchFeedback(`Punched OUT at ${res.punch?.punch_out || 'now'}`);
      } else {
        setPunchFeedback('Already completed attendance for today');
      }
    } catch (err) {
      setPunchFeedback(`Error saving punch: ${err?.data?.message || err.message}`);
    }
    setTimeout(() => setPunchFeedback(null), 3500);
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regDate || !regReason) return;
    setWorkflowError('');
    setRegModalError('');
    try {
      await submitRegularization({
        date: regDate,
        punch_in_requested: regIn,
        punch_out_requested: regOut,
        reason: regReason
      });
      setShowRegModal(false);
      setRegReason('');
    } catch (error) {
      const msg = error?.data?.message || error.message || 'Unable to save the regularization request.';
      setRegModalError(msg);
      setWorkflowError(msg);
    }
  };

  const handleReviewRegularization = async (requestId, decision) => {
    setWorkflowError('');
    try {
      await reviewRegularization(requestId, decision);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to review the regularization request.');
    }
  };

  const updateImportSummary = (uploadId, summary) => {
    setImportFiles((previous) => previous.map((file) => (
      Number(file.id) === Number(uploadId)
        ? { ...file, import_status: summary.status, summary }
        : file
    )));
  };

  const handlePreviewImport = async (file) => {
    setBusyImportId(file.id);
    setImportError('');
    setImportSuccess('');
    try {
      const response = await api.previewAttendanceImport(file.id);
      updateImportSummary(file.id, response.data);
      setImportSuccess(`Preview ready for ${file.original_filename}.`);
    } catch (error) {
      setImportError(error?.data?.message || error.message || 'Unable to preview the attendance file.');
    } finally {
      setBusyImportId(null);
    }
  };

  const handleProcessImport = async (file) => {
    setBusyImportId(file.id);
    setImportError('');
    setImportSuccess('');
    try {
      const response = await api.processAttendanceImport(file.id);
      updateImportSummary(file.id, response.data);
      setImportSuccess(
        `Import complete: ${response.data.imported_count} attendance day(s) saved; ${response.data.existing_count} existing day(s) skipped.`
      );
      if (refreshAttendance) {
        await refreshAttendance();
      }
    } catch (error) {
      if (error?.data?.data) updateImportSummary(file.id, error.data.data);
      setImportError(error?.data?.message || error.message || 'Unable to process the attendance file.');
    } finally {
      setBusyImportId(null);
    }
  };

  const handleDownloadImport = async (file) => {
    const newWindow = window.open('about:blank', '_blank');
    setImportError('');
    try {
      const response = await api.getUploadDownload(file.id);
      if (newWindow) newWindow.location.href = response.data.url;
      else setImportError('Allow pop-ups to download this private attendance file.');
    } catch (error) {
      newWindow?.close();
      setImportError(error?.data?.message || error.message || 'Unable to download the attendance file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Time & Attendance
            </span>
            <span className="text-xs text-slate-500 font-medium">Web Punches, Biometrics & Regularization</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Attendance & Time Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            One punch-in/out session is supported per employee per India date. Use regularization to correct a missed or incorrect punch; additional sessions are not supported.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            disabled={!hasEmployeeProfile}
            title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
            onClick={() => {
              setRegModalError('');
              setShowRegModal(true);
            }}
          >
            Request Regularization
          </Button>

          <Button
            variant={isPunchComplete ? "secondary" : hasPunchedIn ? "danger" : "primary"}
            icon={Clock}
            disabled={!hasEmployeeProfile || isPunchComplete}
            title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
            onClick={handlePunchClick}
          >
            {isPunchComplete ? "Punch Completed" : hasPunchedIn ? "Punch Out" : "Punch In"}
          </Button>
        </div>
      </div>

      {punchFeedback && (
        <div className="bg-teal-50 border border-teal-200 text-teal-700 text-xs px-4 py-2.5 rounded-xl font-medium flex items-center justify-between animate-fadeIn">
          <span>{punchFeedback}</span>
          <span className="text-[10px] text-teal-500 font-mono">Saved in MySQL Database</span>
        </div>
      )}
      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {workflowError}
        </div>
      )}

      {myMissingPunches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-950">
                You have {myMissingPunches.length} missed punch-out session(s) awaiting regularization.
              </p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Dates: {myMissingPunches.map(p => p.date).join(', ')}. Submit a regularization request to clear work hours for payroll.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenRegularizeForRecord(myMissingPunches[0])}
            className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50 shrink-0"
          >
            Regularize Now
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('punches')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'punches' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Daily Punch Ledger ({attendance.length})
        </button>

        <button
          onClick={() => setActiveTab('regularization')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'regularization' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Regularization Requests ({regularizationRequests.length})
        </button>

        {canViewCsvImports && (
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'import' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" /> CSV Biometric Punch Import
          </button>
        )}
      </div>

      {/* TAB 1: PUNCHES */}
      {activeTab === 'punches' && (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Punch In</th>
                  <th className="px-4 py-3">Punch Out</th>
                  <th className="px-4 py-3">Work Hours</th>
                  <th className="px-4 py-3">IP & Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} role="status" className="px-5 py-8 text-center text-slate-500">
                      {isBranchScoped
                        ? `No attendance records found for ${activeBranch}.`
                        : 'No attendance records are available for your team.'}
                    </td>
                  </tr>
                ) : filteredAttendance.map(att => {
                  const employeeId = Number(att.employee_id);
                  const emp = employees.find(e => Number(e.id) === employeeId);
                  const isCurrentEmployee = employeeId === Number(currentUser.employee_id);
                  const employeeName = emp
                    ? `${emp.first_name} ${emp.last_name}`
                    : isCurrentEmployee
                      ? currentEmployeeName
                      : [att.first_name, att.last_name].filter(Boolean).join(' ') || (att.employee_code ? `${att.employee_code}` : `EMP-${att.employee_id}`);
                  const employeeInfo = emp?.designation || (isCurrentEmployee ? currentUser.employee_code : '');

                  const isPastDate = att.date < today;
                  const isMissingPunchOut = isPastDate && !att.punch_out;
                  const regReq = regularizationRequests.find((r) => (
                    Number(r.employee_id) === employeeId && r.date === att.date
                  ));

                  return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{employeeName}</div>
                        {employeeInfo && <div className="text-[11px] text-slate-400">{employeeInfo}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{att.date}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{att.punch_in}</td>
                      <td className="px-4 py-3">
                        {att.punch_out ? (
                          <span className="font-semibold text-slate-700">{att.punch_out}</span>
                        ) : isMissingPunchOut ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Missing Punch Out
                            </span>
                            {regReq && (
                              <span className="text-[10px] text-teal-600 font-medium">
                                Reg {regReq.status} ({regReq.punch_out_requested})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-teal-600">— (Working)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {att.punch_out ? (
                          <span>{att.work_hours} hrs</span>
                        ) : isMissingPunchOut ? (
                          <span className="text-slate-400">0.00 hrs</span>
                        ) : (
                          <span className="text-teal-600">In Progress</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <span>{att.location}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{att.ip_address}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isMissingPunchOut && att.status === 'Present' ? (
                          <Badge variant="warning" size="sm">
                            Incomplete
                          </Badge>
                        ) : (
                          <Badge variant={att.status === 'Present' ? 'success' : 'warning'} size="sm">
                            {att.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {regReq?.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            <Clock className="w-3 h-3" /> Reg Pending
                          </span>
                        ) : isMissingPunchOut && (isCurrentEmployee || canManageAttendance) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRegularizeForRecord(att)}
                            className="inline-flex items-center gap-1 rounded bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 border border-teal-200 transition"
                          >
                            <Clock className="w-3 h-3 text-teal-600" /> Regularize
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: REGULARIZATION */}
      {activeTab === 'regularization' && (
        <Card title="Attendance Regularization Requests" subtitle="Workflow for missed punches, client visits, and network issues">
          <div className="space-y-3">
            {regularizationRequests.length === 0 ? (
              <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No attendance regularization requests have been submitted.
              </p>
            ) : regularizationRequests.map(req => (
              <div key={req.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{req.employee_name}</h4>
                    <span className="text-slate-400 font-medium">for Date: {req.date}</span>
                    <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-slate-700 mt-1 italic">"{req.reason}"</p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Requested In: <strong>{req.punch_in_requested}</strong> | Requested Out: <strong>{req.punch_out_requested}</strong>
                  </p>
                </div>

                {canApprove && req.status === 'pending' && Number(req.employee_id) !== Number(currentUser?.employee_id) && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="danger" onClick={() => handleReviewRegularization(req.id, 'rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" variant="success" onClick={() => handleReviewRegularization(req.id, 'approved')}>
                      Approve Regularization
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 3: CSV IMPORT */}
      {activeTab === 'import' && canViewCsvImports && (
        <Card
          title="Biometric Punch CSV Imports"
          subtitle="Private Cloudinary files are validated before import; existing attendance records are never overwritten"
        >
          <div className="space-y-4 text-xs">
            {canProcessCsvImports ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-700">Upload a biometric CSV file (CSV or TXT, max 20 MB and 100,000 punch rows)</p>
                <p className="text-slate-600">
                  Required columns: <code>employee_code</code>, <code>punch_time</code>. Optional: <code>device_id</code>, <code>location_code</code>.
                </p>
                <p className="text-slate-500">
                  Supported timestamps include <code>YYYY-MM-DD HH:MM[:SS]</code>, <code>DD/MM/YYYY HH:MM[:SS]</code>, 12-hour AM/PM, and ISO 8601 with an offset.
                </p>
                <p className="text-slate-500">
                  Each row is a punch event. The earliest and latest punches per employee and India-local day become punch in/out.
                  A single punch creates an in-progress day. Timestamps without a timezone are treated as India time; ISO timestamps with offsets are converted to India time.
                  Invalid rows block the whole batch. Existing attendance days are skipped.
                </p>
                <CloudinaryUpload
                  module="attendance_csv"
                  accept=".csv,.txt"
                  onUploaded={() => setImportRefresh((value) => value + 1)}
                />
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
                HR Executive access is read-only. HR Admin or Super Admin uploads and processes organization-wide files.
              </p>
            )}
            {importError && <p role="alert" className="text-rose-700">{importError}</p>}
            {importSuccess && <p role="status" className="text-emerald-700">{importSuccess}</p>}
            {importFiles.map((file) => {
              const summary = file.summary;
              const busy = Number(busyImportId) === Number(file.id);

              return (
                <article key={file.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{file.original_filename}</p>
                      <p className="mt-1 text-slate-500">
                        Uploaded {file.uploaded_at?.slice(0, 10) || '—'}
                        {file.uploaded_by_name ? ` by ${file.uploaded_by_name}` : ''}
                        {Number.isFinite(Number(file.file_size)) ? ` · ${(Number(file.file_size) / 1024).toFixed(1)} KB` : ''}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Import status: <span className="font-semibold text-slate-700">{file.import_status || 'Not previewed'}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyImportId !== null}
                        onClick={() => handleDownloadImport(file)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download CSV
                      </button>
                      {canProcessCsvImports && !file.import_status && (
                        <button
                          type="button"
                          disabled={busyImportId !== null}
                          onClick={() => handlePreviewImport(file)}
                          className="rounded-lg bg-teal-600 px-3 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          {busy ? 'Validating…' : 'Preview'}
                        </button>
                      )}
                      {canProcessCsvImports && file.import_status === 'previewed' && summary?.can_process && (
                        <button
                          type="button"
                          disabled={busyImportId !== null}
                          onClick={() => handleProcessImport(file)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busy ? 'Importing…' : 'Process import'}
                        </button>
                      )}
                    </div>
                  </div>
                  {summary && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
                      <p>Rows: <strong>{summary.row_count}</strong></p>
                      <p>Employee-days: <strong>{summary.attendance_day_count}</strong></p>
                      <p>
                        {summary.status === 'processed'
                          ? 'Imported'
                          : summary.can_process
                            ? 'Ready to add'
                            : 'Potential new days'}: <strong>
                          {summary.status === 'processed' ? summary.imported_count : summary.new_record_count}
                        </strong>
                      </p>
                      <p>Existing skipped: <strong>{summary.existing_count}</strong></p>
                      <p>Duplicate events: <strong>{summary.duplicate_count}</strong></p>
                    </div>
                  )}
                  {summary?.errors?.length > 0 && (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
                      <p className="font-semibold">
                        {summary.error_count} invalid row(s). Upload a corrected file; this batch was not imported.
                      </p>
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        {summary.errors.map((error, index) => (
                          <li key={`${error.row}-${index}`}>Row {error.row}: {error.message}</li>
                        ))}
                      </ul>
                      {summary.error_count > summary.errors.length && (
                        <p className="mt-2">Showing the first {summary.errors.length} errors.</p>
                      )}
                    </div>
                  )}
                  {file.import_status === 'processed' && (
                    <p className="text-emerald-700">
                      {summary?.imported_count || file.imported_count || 0} attendance day(s) imported
                      {file.processed_at ? ` · processed ${file.processed_at.slice(0, 10)}` : ''}.
                    </p>
                  )}
                </article>
              );
            })}
            {importFiles.length === 0 && !importError && (
              <p className="py-6 text-center text-slate-500">No attendance CSV files uploaded yet.</p>
            )}
          </div>
        </Card>
      )}

      {/* REGULARIZATION MODAL */}
      <Modal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        title="Request Attendance Regularization"
        subtitle="Submit missed punch justification for manager review"
      >
        <form onSubmit={handleRegSubmit} className="space-y-4 text-xs">
          {regModalError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {regModalError}
            </p>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date to Regularize:</label>
            <input
              type="date"
              required
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Punch In Time:</label>
              <input
                type="text"
                required
                value={regIn}
                onChange={(e) => setRegIn(e.target.value)}
                placeholder="e.g. 09:30 AM"
                className="w-full p-2 rounded-lg border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM (e.g. 09:30 AM)</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Requested Punch Out Time:</label>
              <input
                type="text"
                required
                value={regOut}
                onChange={(e) => setRegOut(e.target.value)}
                placeholder="e.g. 06:30 PM"
                className="w-full p-2 rounded-lg border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM (e.g. 06:30 PM)</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Missed Punch / Client Onsite:</label>
            <textarea
              required
              rows="3"
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              placeholder="e.g. WiFi down, client visit at Kaushambi branch, biometric scanner unreadable..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowRegModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Regularization</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
