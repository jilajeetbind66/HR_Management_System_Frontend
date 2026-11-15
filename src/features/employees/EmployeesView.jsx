import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import CloudinaryUpload from '../../components/common/CloudinaryUpload';
import PhoneInput from '../../components/common/PhoneInput';
import { getAssignableUserRoles, roleLoginCategory, userRoleLabels } from '../../config/userRoles';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Building,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  CreditCard,
  Briefcase,
  FileText,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  UserRound
} from 'lucide-react';

export default function EmployeesView() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { currentUser, hasPermission } = useAuth();
  const { employees, branches, departments, addEmployee, updateEmployeeAvatar } = useHRMS();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const showAddModal = pathname.replace(/\/+$/, '') === '/employees/create';
  const [activeProfileTab, setActiveProfileTab] = useState('job'); // 'job' | 'statutory' | 'salary'
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [provisionedCredentials, setProvisionedCredentials] = useState(null);
  const [employeePhoto, setEmployeePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);

  // Add Employee Form State
  const initialEmpState = {
    first_name: '',
    last_name: '',
    email: '',
    role: 'employee',
    phone: '',
    gender: 'Other',
    date_of_birth: '',
    designation: '',
    department: '',
    branch_id: '',
    date_of_joining: '',
    pan: '',
    uan: '',
    pf_applicable: true,
    esi_applicable: false,
    pt_state: 'Uttar Pradesh',
    tax_regime: 'New',
    ctc_annual: '',
    gross_monthly: '',
    basic_monthly: '',
    bank_name: '',
    account_number: '',
    ifsc_code: ''
  };

  const [newEmp, setNewEmp] = useState(initialEmpState);

  const canManageEmployees = hasPermission('employees.manage');
  const assignableRoles = getAssignableUserRoles(currentUser?.role);
  const canViewStatutoryDetails = ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role);
  const canViewCompensation = currentUser?.role === 'super_admin';
  const departmentOptions = currentUser?.role === 'manager'
    ? [...new Set(employees.map((employee) => employee.department).filter(Boolean))]
      .map((name) => ({ id: name, name }))
    : departments;
  const canUploadSelectedEmployeePhoto = selectedEmployee && (
    ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role)
    || Number(currentUser?.employee_id) === Number(selectedEmployee.id)
  );

  useEffect(() => {
    if (!employeePhoto) {
      setPhotoPreview(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(employeePhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [employeePhoto]);

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const nameMatch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const branchMatch = selectedBranch === 'all' || emp.branch_name === selectedBranch;
    const deptMatch = selectedDept === 'all' || emp.department === selectedDept;
    return nameMatch && branchMatch && deptMatch;
  });

  const clearEmployeePhoto = () => {
    setEmployeePhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleEmployeePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      setFormError('Choose a JPG, PNG, or WebP image for the employee photo.');
      clearEmployeePhoto();
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFormError('Employee photos must be 20 MB or smaller.');
      clearEmployeePhoto();
      return;
    }

    setFormError(null);
    setEmployeePhoto(file);
  };

  const closeAddModal = () => {
    if (submitting) return;
    navigate('/employees', { replace: true });
    setFormError(null);
    clearEmployeePhoto();
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newEmp.first_name || !newEmp.last_name || !newEmp.email || !newEmp.branch_id
      || !newEmp.department || !newEmp.designation || !newEmp.date_of_joining) {
      setFormError('Complete the required employee, organization, and joining-date fields.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    
    try {
      // Resolve branch
      const branchIdNum = Number(newEmp.branch_id);
      const branchObj = branches.find(b => b.id === branchIdNum);
      const payload = {
        ...newEmp,
        branch_id: branchIdNum,
        branch_name: branchObj?.name || ''
      };

      const saved = await addEmployee(payload);
      let toast = {
        message: `Employee ${newEmp.first_name} ${newEmp.last_name} saved successfully.`,
        tone: 'success',
      };

      if (employeePhoto) {
        if (!saved?.id) {
          toast = {
            message: 'Employee saved, but the photo could not be uploaded because the server did not return its ID. You can upload it later from View Profile.',
            tone: 'warning',
          };
        } else {
          try {
            const uploadResponse = await api.uploadFile(employeePhoto, 'employee_photos', { employeeId: saved.id });
            const avatarUrl = uploadResponse?.data?.url;
            if (!avatarUrl) throw new Error('Photo upload completed without an avatar URL.');
            updateEmployeeAvatar(saved.id, avatarUrl);
            toast.message = `Employee ${newEmp.first_name} ${newEmp.last_name} saved with photo.`;
          } catch (photoError) {
            console.error('Employee photo upload error:', photoError);
            const photoErrorMessage = photoError?.data?.message || photoError.message || 'Unknown upload error.';
            toast = {
              message: `Employee saved, but photo upload failed: ${photoErrorMessage} You can upload it later from View Profile.`,
              tone: 'warning',
            };
          }
        }
      }

      if (saved?.credentials?.temporary_password) {
        setProvisionedCredentials({
          name: `${newEmp.first_name} ${newEmp.last_name}`,
          firstName: newEmp.first_name,
          loginIdentifier: saved.credentials.login_identifier,
          employeeCode: saved.credentials.employee_code,
          role: saved.credentials.role || newEmp.role,
          temporaryPassword: saved.credentials.temporary_password,
        });
      } else {
        toast = {
          message: `${toast.message} Login details were not returned; check User Access and reset the password before sharing access.`,
          tone: 'warning',
        };
      }

      setSuccessToast(toast);
      setTimeout(() => setSuccessToast(null), 4000);
      navigate('/employees', { replace: true });
      setNewEmp(initialEmpState);
      clearEmployeePhoto();
    } catch (err) {
      console.error("Employee save error:", err);
      const errorMsg = err?.data?.message || err.message || "Failed to save record to database. Ensure Laravel server is running.";
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
              Human Resources
            </span>
            <span className="text-xs text-slate-500 font-medium">Workforce Master Directory</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Employee Master Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {canViewCompensation
              ? 'Workforce records, reporting hierarchy, statutory details, compensation, and bank accounts.'
              : canViewStatutoryDetails
                ? 'Workforce and statutory records. Compensation and bank details are restricted to Admin.'
                : 'Workforce directory. Statutory, compensation, and bank details are restricted by role.'}
          </p>
        </div>

        {canManageEmployees && (
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => navigate('/employees/create')}
          >
            Add New Employee
          </Button>
        )}
      </div>

      {/* Top Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name, code (EMP-001), or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 focus:outline-none"
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {departmentOptions.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3">Designation & Dept</th>
                <th className="px-4 py-3">Branch Location</th>
                {canViewStatutoryDetails && <th className="px-4 py-3">India Statutory (PF / PT)</th>}
                <th className="px-4 py-3">Joining Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={canViewStatutoryDetails ? 7 : 6}
                    role="status"
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    {employees.length === 0
                      ? 'No employee records are available for your account.'
                      : 'No employees match your current search and filters.'}
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={`${emp.first_name} ${emp.last_name}`} className="w-8 h-8 rounded-full object-cover border" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-[10px]" aria-label="No profile photo">
                          {`${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                        </span>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {emp.first_name} {emp.last_name}
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">{emp.employee_code}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{emp.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{emp.designation}</p>
                    <p className="text-[11px] text-slate-400">{emp.department}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <Building className="w-3.5 h-3.5 text-indigo-500" />
                      {emp.branch_name}
                    </span>
                  </td>

                  {canViewStatutoryDetails && (
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-[11px]">
                        <span className="block text-slate-600">UAN: <strong className="font-mono text-slate-800">{emp.uan || 'N/A'}</strong></span>
                        <span className="block text-slate-500">PT: {emp.pt_state} • {emp.tax_regime} Regime</span>
                      </div>
                    </td>
                  )}

                  <td className="px-4 py-3 text-slate-600">
                    {emp.date_of_joining}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant="success" size="sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                      Active
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DETAIL MODAL / DRAWER */}
      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.employee_code})` : ""}
        subtitle={selectedEmployee?.designation}
        maxWidth="max-w-3xl"
      >
        {selectedEmployee && (
          <div className="space-y-4 text-xs">
            {/* Top Quick Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              {selectedEmployee.avatar ? (
                <img src={selectedEmployee.avatar} alt={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`} className="w-14 h-14 rounded-2xl object-cover border" />
              ) : (
                <span className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold" aria-label="No profile photo">
                  {`${selectedEmployee.first_name?.[0] || ''}${selectedEmployee.last_name?.[0] || ''}`}
                </span>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                <p className="text-xs text-indigo-600 font-medium">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedEmployee.email} • {selectedEmployee.phone}</p>
                {canUploadSelectedEmployeePhoto && (
                  <div className="mt-2">
                    <CloudinaryUpload
                      module="employee_photos"
                      employeeId={selectedEmployee.id}
                      accept=".jpg,.jpeg,.png,.webp"
                      onUploaded={(asset) => {
                        setSelectedEmployee((employee) => ({ ...employee, avatar: asset.url }));
                        updateEmployeeAvatar(selectedEmployee.id, asset.url);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Profile Subtabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveProfileTab('job')}
                className={`px-4 py-2 font-semibold border-b-2 text-xs transition ${
                  activeProfileTab === 'job' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
                }`}
              >
                Job & Hierarchy
              </button>
              {canViewStatutoryDetails && (
                <button
                  onClick={() => setActiveProfileTab('statutory')}
                  className={`px-4 py-2 font-semibold border-b-2 text-xs transition ${
                    activeProfileTab === 'statutory' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  India Statutory Details (PF / ESI / PT)
                </button>
              )}
              {canViewCompensation && (
                <button
                  onClick={() => setActiveProfileTab('salary')}
                  className={`px-4 py-2 font-semibold border-b-2 text-xs transition ${
                    activeProfileTab === 'salary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  Compensation & Bank Details
                </button>
              )}
            </div>

            {/* TAB CONTENT: JOB */}
            {activeProfileTab === 'job' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Branch Office</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.branch_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Reporting Manager</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.reporting_manager_name || 'None (Direct to Board)'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Joining</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.date_of_joining}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Employment Type</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.employment_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Probation Status</span>
                  <span className="font-semibold text-emerald-600">{selectedEmployee.probation_status} (6-month baseline)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">System Role</span>
                  <span className="uppercase font-bold text-indigo-700">{selectedEmployee.role}</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: STATUTORY (Architecture Section 7.4 & 8) */}
            {activeProfileTab === 'statutory' && canViewStatutoryDetails && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Income Tax PAN</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEmployee.pan}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax Regime</span>
                    <span className="font-bold text-indigo-600">{selectedEmployee.tax_regime} Tax Regime</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">EPF Universal Account No (UAN)</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEmployee.uan}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">EPF Member ID</span>
                    <span className="font-mono text-slate-700">{selectedEmployee.pf_account_no || 'Pending Allocation'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ESI Applicability</span>
                    <span className="font-semibold text-slate-700">
                      {selectedEmployee.esi_applicable ? 'Applicable (Gross <= ₹21,000)' : 'Exempt (Gross > ₹21,000/mo)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Professional Tax (PT) State</span>
                    <span className="font-semibold text-slate-700">{selectedEmployee.pt_state}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SALARY & BANK */}
            {activeProfileTab === 'salary' && canViewCompensation && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Annual CTC</span>
                    <span className="text-base font-bold text-slate-900">₹{(selectedEmployee.ctc_annual || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Monthly Gross</span>
                    <span className="text-base font-bold text-indigo-600">₹{(selectedEmployee.gross_monthly || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Basic Monthly (50%)</span>
                    <span className="text-base font-bold text-slate-700">₹{(selectedEmployee.basic_monthly || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                    <span className="font-semibold text-slate-800">{selectedEmployee.bank_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedEmployee.account_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedEmployee.ifsc_code}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setSelectedEmployee(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ADD EMPLOYEE MODAL WIZARD */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title="Add New Employee"
        subtitle="Employee, statutory, and login onboarding"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-bold">⚠️ Error:</span>
              <span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">First Name:</label>
              <input
                type="text"
                required
                value={newEmp.first_name}
                onChange={(e) => setNewEmp({ ...newEmp, first_name: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Last Name:</label>
              <input
                type="text"
                required
                value={newEmp.last_name}
                onChange={(e) => setNewEmp({ ...newEmp, last_name: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="employee-login-role" className="mb-1 block font-semibold text-slate-700">Login Role:</label>
            <select
              id="employee-login-role"
              required
              value={newEmp.role}
              onChange={(event) => setNewEmp({ ...newEmp, role: event.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white p-2"
            >
              {assignableRoles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              {currentUser?.role === 'super_admin'
                ? 'Super Admin accounts are not assignable here.'
                : 'HR Admin can assign Employee, Manager, HR Executive, or Recruiter roles. Other elevated roles are Super Admin-only.'}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="w-14 h-14 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Selected employee photo preview" className="w-full h-full object-cover" />
              ) : (
                <UserRound className="w-6 h-6 text-slate-400" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="employee-photo" className="block font-semibold text-slate-700 mb-1">
                Employee Photo <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                ref={photoInputRef}
                id="employee-photo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleEmployeePhotoChange}
                disabled={submitting}
                className="block w-full text-[11px] text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:font-semibold file:text-slate-700"
              />
              <p className="mt-1 text-[10px] text-slate-500">JPG, PNG, or WebP, up to 20 MB. You can also add or change it later in View Profile.</p>
            </div>
            {employeePhoto && (
              <button
                type="button"
                onClick={clearEmployeePhoto}
                disabled={submitting}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white hover:text-slate-800"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Work Email:</label>
              <input
                type="email"
                required
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number:</label>
              <PhoneInput
                required
                autoComplete="tel-national"
                placeholder="Enter 10-digit number"
                value={newEmp.phone}
                onChange={(phone) => setNewEmp({ ...newEmp, phone })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch:</label>
              <select
                required
                value={newEmp.branch_id}
                onChange={(e) => setNewEmp({ ...newEmp, branch_id: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Select branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department:</label>
              <select
                required
                value={newEmp.department}
                onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Select department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation:</label>
              <input
                type="text"
                required
                value={newEmp.designation}
                onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Joining:</label>
              <input
                type="date"
                required
                value={newEmp.date_of_joining}
                onChange={(e) => setNewEmp({ ...newEmp, date_of_joining: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Birth:</label>
              <input
                type="date"
                value={newEmp.date_of_birth}
                onChange={(e) => setNewEmp({ ...newEmp, date_of_birth: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gender:</label>
              <select
                value={newEmp.gender}
                onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value })}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Other">Other / Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">India Statutory Configuration</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">PAN Number:</label>
                <input
                  type="text"
                  value={newEmp.pan}
                  onChange={(e) => setNewEmp({ ...newEmp, pan: e.target.value })}
                  className="w-full p-1.5 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">UAN (EPF):</label>
                <input
                  type="text"
                  value={newEmp.uan}
                  onChange={(e) => setNewEmp({ ...newEmp, uan: e.target.value })}
                  className="w-full p-1.5 rounded-lg border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Regime:</label>
                <select
                  value={newEmp.tax_regime}
                  onChange={(e) => setNewEmp({ ...newEmp, tax_regime: e.target.value })}
                  className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="New">New Tax Regime</option>
                  <option value="Old">Old Tax Regime</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" disabled={submitting} onClick={closeAddModal}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (employeePhoto ? 'Saving employee and photo...' : 'Saving to Database...') : 'Onboard Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Floating Success Toast */}
      {successToast && (
        <div
          role={successToast.tone === 'warning' ? 'alert' : 'status'}
          className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce ${
          successToast.tone === 'warning' ? 'bg-amber-600 border border-amber-500' : 'bg-emerald-600 border border-emerald-500'
          }`}
        >
          <span>{successToast.tone === 'warning' ? '!' : '✓'}</span>
          <span>{successToast.message}</span>
        </div>
      )}

      <Modal
        isOpen={Boolean(provisionedCredentials)}
        onClose={() => setProvisionedCredentials(null)}
        title="Employee login created"
        subtitle={provisionedCredentials?.name}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            This temporary password is shown only once. Store and share it securely; the account holder can change it later in Account & Security.
          </p>
          <label className="block font-medium text-slate-700">
            Login email
            <input
              readOnly
              value={provisionedCredentials?.loginIdentifier || ''}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold">Role:</span>{' '}
            {userRoleLabels[provisionedCredentials?.role] || provisionedCredentials?.role}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-semibold">Login panel:</span>{' '}
            {roleLoginCategory[provisionedCredentials?.role] || 'Employee'}
          </div>
          <label className="block font-medium text-slate-700">
            Employee code (alternate login)
            <input
              readOnly
              value={provisionedCredentials?.employeeCode || ''}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          <label className="block font-medium text-slate-700">
            Temporary password
            <input
              type="text"
              readOnly
              value={provisionedCredentials?.temporaryPassword || ''}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
            />
          </label>
          <p className="text-xs leading-5 text-slate-600">
            {provisionedCredentials?.firstName || 'The employee'} signs in using the panel shown above. The temporary password can be changed at any time from Account & Security.
          </p>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setProvisionedCredentials(null)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
