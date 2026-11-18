import React, { useRef, useState } from 'react';
import { useHRMS } from '../../context/HRMSContext';
import api from '../../services/api';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';

const CSV_HEADERS = [
  'first_name', 'last_name', 'email', 'role', 'phone', 'gender', 'date_of_birth',
  'branch_id', 'department_id', 'designation_id', 'department', 'designation',
  'date_of_joining', 'employment_type', 'pan', 'uan', 'pf_applicable',
  'esi_applicable', 'pt_state', 'tax_regime', 'ctc_annual', 'gross_monthly',
  'basic_monthly', 'bank_name', 'account_number', 'ifsc_code',
];

export default function EmployeeCsvImport() {
  const { importEmployees } = useHRMS();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [setupLinkExpiresInMinutes, setSetupLinkExpiresInMinutes] = useState(60);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([`${CSV_HEADERS.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const preview = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setCredentials([]);
    try {
      const response = await api.previewEmployeeImport(file);
      setReport(response?.data || null);
    } catch (previewError) {
      setError(previewError?.data?.errors?.file?.[0] || previewError?.data?.message || previewError.message || 'Could not validate this CSV.');
      setReport(previewError?.data?.data || null);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    if (!file || !report || report.invalid_count > 0) return;
    setBusy(true);
    setError('');
    try {
      const result = await importEmployees(file);
      setCredentials(result?.credentials || []);
      setSetupLinkExpiresInMinutes(result?.setup_link_expires_in_minutes || 60);
      setReport(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (importError) {
      setError(importError?.data?.message || importError.message || 'The CSV import failed.');
      setReport(importError?.data?.data || null);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setIsOpen(false);
    setReport(null);
    setCredentials([]);
    setSetupLinkExpiresInMinutes(60);
    setError('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>Import employees CSV</Button>
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={credentials.length > 0 ? 'Employee setup emails sent' : 'Bulk employee import'}
        subtitle={credentials.length > 0
          ? `${credentials.length} employee accounts were created and invited to set their passwords.`
          : 'Validate every row before importing; a file with errors is not partially imported.'}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-600">CSV is limited to 5 MB and 500 employees. Required columns: first_name, last_name, email, branch_id, department, designation, date_of_joining.</p>
            <Button type="button" variant="secondary" onClick={downloadTemplate}>Download CSV template</Button>
          </div>
          <label className="block font-semibold text-slate-700">
            Employee CSV file
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setReport(null);
                setCredentials([]);
                setSetupLinkExpiresInMinutes(60);
                setError('');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
          {credentials.length > 0 && (
            <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="font-semibold">Import complete. A one-time password setup email was sent to each employee. No password is shown or emailed; each link expires in {setupLinkExpiresInMinutes} minutes.</p>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-left">
                  <thead><tr><th className="p-1">Employee code</th><th className="p-1">Employee</th><th className="p-1">Login</th><th className="p-1">Role</th></tr></thead>
                  <tbody>{credentials.map((item) => (
                    <tr key={item.employee_code} className="border-t border-amber-200">
                      <td className="p-1 font-mono">{item.employee_code}</td>
                      <td className="p-1">{item.name}</td>
                      <td className="p-1">{item.login_identifier}</td>
                      <td className="p-1">{item.role}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {report && (
            <div className="space-y-2">
              <p role="status" className={report.invalid_count ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>
                {report.valid_count} valid · {report.invalid_count} invalid · {report.total_rows} total rows
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2">CSV line</th><th className="p-2">Employee</th><th className="p-2">Validation</th></tr></thead>
                  <tbody>{report.rows?.map((row) => (
                    <tr key={row.line} className="border-t border-slate-100 align-top">
                      <td className="p-2">{row.line}</td>
                      <td className="p-2">{row.employee?.first_name} {row.employee?.last_name}<span className="block text-slate-500">{row.employee?.email}</span></td>
                      <td className="p-2">
                        {Object.entries(row.errors || {}).flatMap(([field, messages]) => messages.map((message, index) => <span key={`error-${field}-${index}`} className="block text-rose-700">{field}: {message}</span>))}
                        {(row.warnings || []).map((warning, index) => <span key={`warning-${index}`} className="block text-amber-700">{warning}</span>)}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" disabled={busy} onClick={close}>Close</Button>
            <Button variant="secondary" disabled={busy || !file} onClick={preview}>{busy ? 'Validating...' : 'Validate CSV'}</Button>
            <Button disabled={busy || !report || report.invalid_count > 0} onClick={importFile}>{busy ? 'Importing...' : `Import ${report?.valid_count || 0} employees`}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
