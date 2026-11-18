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
import EmployeeCsvImport from './EmployeeCsvImport';
import EmployeeStaffingRequests from './EmployeeStaffingRequests';
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
  UserRound,
  TrendingUp,
} from 'lucide-react';

export default function EmployeesView() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { currentUser, hasPermission } = useAuth();
  const {
    employees,
    branches,
    departments,
    designations,
    addEmployee,
    archiveEmployee,
    updateEmployeeHierarchy,
    updateEmployeeCompensation,
    updateEmployeeStatutory,
    updateEmployeeLeadAccess,
    updateEmployeeAvatar,
    refreshEmployees,
  } = useHRMS();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false);
  const [hierarchyForm, setHierarchyForm] = useState({ reporting_manager_id: '', role: '' });
  const [hierarchyError, setHierarchyError] = useState('');
  const [isSavingHierarchy, setIsSavingHierarchy] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState(null);
  const [archivePlan, setArchivePlan] = useState({
    reporting_manager_id: '',
    reassign_project_employee_id: '',
    cancel_pending_requests: false,
  });
  const [archiveError, setArchiveError] = useState('');
  const [isLoadingArchiveImpact, setIsLoadingArchiveImpact] = useState(false);
  const [isEditingCompensation, setIsEditingCompensation] = useState(false);
  const [isSavingCompensation, setIsSavingCompensation] = useState(false);
  const [compensationError, setCompensationError] = useState('');
  const [compensationForm, setCompensationForm] = useState({
    ctc_annual: '',
    gross_monthly: '',
    basic_monthly: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
  });
  const [isEditingStatutory, setIsEditingStatutory] = useState(false);
  const [isSavingStatutory, setIsSavingStatutory] = useState(false);
  const [statutoryError, setStatutoryError] = useState('');
  const [statutoryForm, setStatutoryForm] = useState({
    pan: '',
    uan: '',
    pf_account_no: '',
    pf_applicable: true,
    esi_applicable: false,
    pt_state: 'Uttar Pradesh',
    tax_regime: 'New',
  });
  const showAddModal = pathname.replace(/\/+$/, '') === '/employees/create';
  const [activeProfileTab, setActiveProfileTab] = useState('job'); // 'job' | 'statutory' | 'salary'
  const [isUpdatingLeadAccess, setIsUpdatingLeadAccess] = useState(false);
  const [leadAccessSuccess, setLeadAccessSuccess] = useState('');
  const canManageLeadAccess = ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role);
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
    designation_id: '',
    department: '',
    department_id: '',
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
  const canEditHierarchy = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const canArchiveSelectedEmployee = currentUser?.role === 'super_admin'
    || (
      currentUser?.role === 'hr_admin'
      && (!selectedEmployee?.role || ['employee', 'manager', 'hr_executive', 'recruiter'].includes(selectedEmployee.role))
    );
  const assignableRoles = getAssignableUserRoles(currentUser?.role);
  const profileRoleOptions = selectedEmployee?.role && !assignableRoles.some((role) => role.value === selectedEmployee.role)
    ? [...assignableRoles, { value: selectedEmployee.role, label: userRoleLabels[selectedEmployee.role] || selectedEmployee.role }]
    : assignableRoles;
  const managerCandidates = employees.filter((employee) => (
    Number(employee.id) !== Number(selectedEmployee?.id)
    && employee.status === 'active'
    && ['manager', 'hr_admin', 'hr_executive', 'super_admin'].includes(employee.role)
    && (
      selectedEmployee?.allow_cross_branch_managers
      || Number(employee.branch_id) === Number(hierarchyForm.branch_id || selectedEmployee?.branch_id)
      || Number(employee.id) === Number(selectedEmployee?.reporting_manager_id)
    )
  ));
  const canViewStatutoryDetails = ['super_admin', 'hr_admin', 'hr_executive', 'auditor'].includes(currentUser?.role);
  const canViewCompensation = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const departmentOptions = currentUser?.role === 'manager'
    ? [...new Set(employees.map((employee) => employee.department).filter(Boolean))]
      .map((name) => ({ id: name, name }))
    : departments;
  const canUploadSelectedEmployeePhoto = selectedEmployee && (
    ['super_admin', 'hr_admin', 'hr_executive'].includes(currentUser?.role)
    || Number(currentUser?.employee_id) === Number(selectedEmployee.id)
  );
  const pageSize = 20;

  useEffect(() => {
    if (!employeePhoto) {
      setPhotoPreview(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(employeePhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [employeePhoto]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedDept, selectedStatus]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const employeeId = Number(params.get('employee_id'));
    if (!employeeId || params.get('profile_tab') !== 'salary') return;

    const employee = employees.find((item) => Number(item.id) === employeeId);
    if (!employee) return;

    setSelectedEmployee(employee);
    setActiveProfileTab('salary');
    setIsEditingHierarchy(false);
    setHierarchyError('');
  }, [employees, search]);

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const nameMatch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (currentUser?.role !== 'manager' && emp.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const branchMatch = selectedBranch === 'all' || emp.branch_name === selectedBranch;
    const deptMatch = selectedDept === 'all' || emp.department === selectedDept;
    const statusMatch = selectedStatus === 'all' || emp.status === selectedStatus;
    return nameMatch && branchMatch && deptMatch && statusMatch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(pageStart, pageStart + pageSize);

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

  const openEmployeeProfile = (employee) => {
    setSelectedEmployee(employee);
    setActiveProfileTab('job');
    setIsEditingHierarchy(false);
    setHierarchyError('');
    setIsEditingCompensation(false);
    setCompensationError('');
    setIsEditingStatutory(false);
    setStatutoryError('');
    setStatutoryForm({
      pan: employee.pan || '',
      uan: employee.uan || '',
      pf_account_no: employee.pf_account_no || '',
      pf_applicable: employee.pf_applicable !== false,
      esi_applicable: Boolean(employee.esi_applicable),
      pt_state: employee.pt_state || 'Uttar Pradesh',
      tax_regime: employee.tax_regime || 'New',
    });
  };

  const beginHierarchyEdit = () => {
    setHierarchyForm({
      reporting_manager_id: selectedEmployee?.reporting_manager_id
        ? String(selectedEmployee.reporting_manager_id)
        : '',
      role: selectedEmployee?.role || '',
      first_name: selectedEmployee?.first_name || '',
      last_name: selectedEmployee?.last_name || '',
      email: selectedEmployee?.email || '',
      phone: selectedEmployee?.phone || '',
      gender: selectedEmployee?.gender || 'Other',
      date_of_birth: selectedEmployee?.date_of_birth || '',
      branch_id: selectedEmployee?.branch_id ? String(selectedEmployee.branch_id) : '',
      department_id: selectedEmployee?.department_id ? String(selectedEmployee.department_id) : '',
      department: selectedEmployee?.department || '',
      designation_id: selectedEmployee?.designation_id ? String(selectedEmployee.designation_id) : '',
      designation: selectedEmployee?.designation || '',
      date_of_joining: selectedEmployee?.date_of_joining || '',
      employment_type: selectedEmployee?.employment_type || '',
    });
    setHierarchyError('');
    setIsEditingHierarchy(true);
  };

  const saveHierarchy = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) return;

    setIsSavingHierarchy(true);
    setHierarchyError('');
    try {
      const savedEmployee = await updateEmployeeHierarchy(selectedEmployee.id, {
        first_name: hierarchyForm.first_name.trim(),
        last_name: hierarchyForm.last_name.trim(),
        email: hierarchyForm.email.trim(),
        phone: hierarchyForm.phone.trim() || null,
        gender: hierarchyForm.gender,
        date_of_birth: hierarchyForm.date_of_birth || null,
        branch_id: Number(hierarchyForm.branch_id),
        department_id: hierarchyForm.department_id ? Number(hierarchyForm.department_id) : null,
        department: hierarchyForm.department.trim(),
        designation_id: hierarchyForm.designation_id ? Number(hierarchyForm.designation_id) : null,
        designation: hierarchyForm.designation.trim(),
        date_of_joining: hierarchyForm.date_of_joining,
        employment_type: hierarchyForm.employment_type.trim(),
        reporting_manager_id: hierarchyForm.reporting_manager_id
          ? Number(hierarchyForm.reporting_manager_id)
          : null,
        role: hierarchyForm.role,
        version: selectedEmployee.version,
      });
      setSelectedEmployee(savedEmployee);
      setIsEditingHierarchy(false);
      if (savedEmployee.warnings?.length) {
        setSuccessToast({ message: savedEmployee.warnings.join(' '), tone: 'warning' });
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (error) {
      setHierarchyError(
        error?.data?.errors?.reporting_manager_id?.[0]
        || error?.data?.errors?.role?.[0]
        || error?.data?.message
        || error.message
        || 'Could not save this employee profile.'
      );
    } finally {
      setIsSavingHierarchy(false);
    }
  };

  const beginCompensationEdit = () => {
    setCompensationForm({
      ctc_annual: selectedEmployee?.ctc_annual ?? '',
      gross_monthly: selectedEmployee?.gross_monthly ?? '',
      basic_monthly: selectedEmployee?.basic_monthly ?? '',
      bank_name: selectedEmployee?.bank_name ?? '',
      account_number: selectedEmployee?.account_number ?? '',
      ifsc_code: selectedEmployee?.ifsc_code ?? '',
    });
    setCompensationError('');
    setIsEditingCompensation(true);
  };

  const saveCompensation = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) return;

    setIsSavingCompensation(true);
    setCompensationError('');
    try {
      const savedEmployee = await updateEmployeeCompensation(selectedEmployee.id, {
        ...compensationForm,
        ctc_annual: Number(compensationForm.ctc_annual),
        gross_monthly: Number(compensationForm.gross_monthly),
        basic_monthly: Number(compensationForm.basic_monthly),
        ifsc_code: compensationForm.ifsc_code.trim().toUpperCase(),
      });
      setSelectedEmployee(savedEmployee);
      setIsEditingCompensation(false);
    } catch (error) {
      setCompensationError(
        Object.values(error?.data?.errors || {}).flat()[0]
        || error?.data?.message
        || error.message
        || 'Could not save compensation and bank details.'
      );
    } finally {
      setIsSavingCompensation(false);
    }
  };

  const saveStatutory = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) return;

    setIsSavingStatutory(true);
    setStatutoryError('');
    try {
      const savedEmployee = await updateEmployeeStatutory(selectedEmployee.id, {
        pan: statutoryForm.pan ? statutoryForm.pan.trim().toUpperCase() : null,
        uan: statutoryForm.uan ? statutoryForm.uan.trim() : null,
        pf_account_no: statutoryForm.pf_account_no ? statutoryForm.pf_account_no.trim() : null,
        pf_applicable: Boolean(statutoryForm.pf_applicable),
        esi_applicable: Boolean(statutoryForm.esi_applicable),
        pt_state: statutoryForm.pt_state || 'Uttar Pradesh',
        tax_regime: statutoryForm.tax_regime || 'New',
      });
      setSelectedEmployee(savedEmployee);
      setIsEditingStatutory(false);
    } catch (error) {
      setStatutoryError(
        Object.values(error?.data?.errors || {}).flat()[0]
        || error?.data?.message
        || error.message
        || 'Could not save statutory compliance details.'
      );
    } finally {
      setIsSavingStatutory(false);
    }
  };

  const handleToggleLeadAccess = async (employeeId, nextValue) => {
    setIsUpdatingLeadAccess(true);
    setLeadAccessSuccess('');
    try {
      await updateEmployeeLeadAccess(employeeId, nextValue);
      setSelectedEmployee((prev) => (prev ? { ...prev, has_lead_access: nextValue } : null));
      setLeadAccessSuccess(`Lead Management access ${nextValue ? 'granted' : 'revoked'} successfully.`);
      setTimeout(() => setLeadAccessSuccess(''), 3500);
    } catch (err) {
      alert(err?.data?.message || err.message || 'Failed to update lead access');
    } finally {
      setIsUpdatingLeadAccess(false);
    }
  };

  const prepareArchiveSelectedEmployee = async () => {
    if (!selectedEmployee) return;
    setIsLoadingArchiveImpact(true);
    setArchiveError('');
    setArchiveImpact(null);
    setArchivePlan({
      reporting_manager_id: '',
      reassign_project_employee_id: '',
      cancel_pending_requests: false,
    });
    try {
      const response = await api.getEmployeeArchiveImpact(selectedEmployee.id);
      setArchiveImpact(response?.data || null);
    } catch (error) {
      setHierarchyError(error?.data?.message || error.message || 'Could not load employee dependencies.');
    } finally {
      setIsLoadingArchiveImpact(false);
    }
  };

  const archiveSelectedEmployee = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) return;
    const employeeName = `${selectedEmployee.first_name} ${selectedEmployee.last_name}`;
    if (!window.confirm(`Archive ${employeeName}? Their login will be disabled, and the employee record will be retained.`)) return;
    setIsSavingHierarchy(true);
    setArchiveError('');
    try {
      await archiveEmployee(selectedEmployee.id, {
        reporting_manager_id: archivePlan.reporting_manager_id
          ? Number(archivePlan.reporting_manager_id)
          : null,
        reassign_project_employee_id: archivePlan.reassign_project_employee_id
          ? Number(archivePlan.reassign_project_employee_id)
          : null,
        cancel_pending_requests: archivePlan.cancel_pending_requests,
      });
      setArchiveImpact(null);
      setSelectedEmployee(null);
      setIsEditingHierarchy(false);
    } catch (error) {
      setArchiveError(
        error?.data?.message
        || Object.values(error?.data?.errors || {}).flat()[0]
        || error.message
        || 'Could not archive this employee.'
      );
    } finally {
      setIsSavingHierarchy(false);
    }
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
      if (saved?.warnings?.length) {
        toast = {
          message: `${toast.message} ${saved.warnings.join(' ')}`,
          tone: 'warning',
        };
      }

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

      if (saved?.credentials?.setup_email_sent) {
        setProvisionedCredentials({
          name: `${newEmp.first_name} ${newEmp.last_name}`,
          firstName: newEmp.first_name,
          loginIdentifier: saved.credentials.login_identifier,
          employeeCode: saved.credentials.employee_code,
          role: saved.credentials.role || newEmp.role,
          setupLinkExpiresInMinutes: saved.credentials.setup_link_expires_in_minutes,
          warnings: saved.warnings || [],
        });
      } else {
        toast = {
          message: `${toast.message} The setup email was not confirmed as sent. Contact HR before sharing login instructions.`,
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
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
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
          <div className="flex flex-wrap gap-2">
            <EmployeeCsvImport />
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => navigate('/employees/create')}
            >
              Add New Employee
            </Button>
          </div>
        )}
      </div>

      <EmployeeStaffingRequests />

      {/* Top Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={currentUser?.role === 'manager'
              ? 'Search by employee name or code (EMP-001)...'
              : 'Search by employee name, code (EMP-001), or email...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
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

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 focus:outline-none"
            aria-label="Filter by employment status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_notice">On Notice</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>
      <p role="status" aria-live="polite" className="text-xs text-slate-500">
        {currentUser?.role === 'manager' ? 'Team size' : 'Employee records'}: {employees.length}
        {' · '}Showing {filteredEmployees.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageSize, filteredEmployees.length)}
        {' of '}{filteredEmployees.length} filtered
      </p>

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
              ) : paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={`${emp.first_name} ${emp.last_name}`} className="w-8 h-8 rounded-full object-cover border" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold text-[10px]" aria-label="No profile photo">
                          {`${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                        </span>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {emp.first_name} {emp.last_name}
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">{emp.employee_code}</span>
                        </div>
                        {currentUser?.role !== 'manager' && (
                          <p className="text-[11px] text-slate-400">{emp.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{emp.designation}</p>
                    <p className="text-[11px] text-slate-400">{emp.department}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                      <Building className="w-3.5 h-3.5 text-teal-500" />
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
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant={emp.status === 'active' ? 'success' : 'warning'} size="sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'} mr-1`} />
                        {(emp.status || 'unknown').replace('_', ' ')}
                      </Badge>
                      {Boolean(emp.has_lead_access) && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                          <TrendingUp className="w-2.5 h-2.5" /> Leads
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEmployeeProfile(emp)}
                      className="px-2.5 py-1 text-xs font-semibold text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEmployees.length > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">Page {activePage} of {totalPages}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage(activePage - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage(activePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* DETAIL MODAL / DRAWER */}
      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => {
          if (isSavingHierarchy) return;
          setSelectedEmployee(null);
          setIsEditingHierarchy(false);
          setHierarchyError('');
        }}
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
                <span className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold" aria-label="No profile photo">
                  {`${selectedEmployee.first_name?.[0] || ''}${selectedEmployee.last_name?.[0] || ''}`}
                </span>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                <p className="text-xs text-teal-600 font-medium">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                {currentUser?.role !== 'manager' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {[selectedEmployee.email, selectedEmployee.phone].filter(Boolean).join(' • ')}
                  </p>
                )}
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
                  activeProfileTab === 'job' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500'
                }`}
              >
                Job & Hierarchy
              </button>
              {canViewStatutoryDetails && (
                <button
                  onClick={() => setActiveProfileTab('statutory')}
                  className={`px-4 py-2 font-semibold border-b-2 text-xs transition ${
                    activeProfileTab === 'statutory' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  India Statutory Details (PF / ESI / PT)
                </button>
              )}
              {canViewCompensation && (
                <button
                  onClick={() => setActiveProfileTab('salary')}
                  className={`px-4 py-2 font-semibold border-b-2 text-xs transition ${
                    activeProfileTab === 'salary' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  Compensation & Bank Details
                </button>
              )}
            </div>

            {/* TAB CONTENT: JOB */}
            {activeProfileTab === 'job' && (
              <form onSubmit={saveHierarchy} className="space-y-3">
                {hierarchyError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {hierarchyError}
                  </p>
                )}
                {isEditingHierarchy && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Personal and job details</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="font-semibold text-slate-700">
                        First name
                        <input required value={hierarchyForm.first_name} onChange={(event) => setHierarchyForm({ ...hierarchyForm, first_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Last name
                        <input required value={hierarchyForm.last_name} onChange={(event) => setHierarchyForm({ ...hierarchyForm, last_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Login email
                        <input required type="email" value={hierarchyForm.email} onChange={(event) => setHierarchyForm({ ...hierarchyForm, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Phone
                        <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={hierarchyForm.phone || ''} onChange={(event) => setHierarchyForm({ ...hierarchyForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Branch
                        <select required value={hierarchyForm.branch_id} onChange={(event) => setHierarchyForm({ ...hierarchyForm, branch_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                          <option value="">Select branch</option>
                          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                      </label>
                      <label className="font-semibold text-slate-700">
                        Department
                        <input required list="employee-profile-departments" value={hierarchyForm.department} onChange={(event) => {
                          const department = event.target.value;
                          const match = departments.find((item) => item.name.toLowerCase() === department.trim().toLowerCase());
                          setHierarchyForm({ ...hierarchyForm, department, department_id: match ? String(match.id) : '', designation: '', designation_id: '' });
                        }} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                        <datalist id="employee-profile-departments">{departments.map((department) => <option key={department.id} value={department.name} />)}</datalist>
                      </label>
                      <label className="font-semibold text-slate-700">
                        Designation
                        <input required list="employee-profile-designations" value={hierarchyForm.designation} onChange={(event) => {
                          const designation = event.target.value;
                          const match = designations.find((item) => Number(item.department_id) === Number(hierarchyForm.department_id) && item.title.toLowerCase() === designation.trim().toLowerCase());
                          setHierarchyForm({ ...hierarchyForm, designation, designation_id: match ? String(match.id) : '' });
                        }} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                        <datalist id="employee-profile-designations">
                          {designations.filter((item) => Number(item.department_id) === Number(hierarchyForm.department_id)).map((designation) => <option key={designation.id} value={designation.title} />)}
                        </datalist>
                      </label>
                      <label className="font-semibold text-slate-700">
                        Date of joining
                        <input required type="date" value={hierarchyForm.date_of_joining} onChange={(event) => setHierarchyForm({ ...hierarchyForm, date_of_joining: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Date of birth
                        <input type="date" value={hierarchyForm.date_of_birth || ''} onChange={(event) => setHierarchyForm({ ...hierarchyForm, date_of_birth: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                      <label className="font-semibold text-slate-700">
                        Gender
                        <select required value={hierarchyForm.gender} onChange={(event) => setHierarchyForm({ ...hierarchyForm, gender: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                          <option value="Other">Other / Prefer not to say</option>
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                        </select>
                      </label>
                      <label className="font-semibold text-slate-700">
                        Employment type
                        <input required value={hierarchyForm.employment_type} onChange={(event) => setHierarchyForm({ ...hierarchyForm, employment_type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                      </label>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Branch Office</span>
                    <span className="font-semibold text-slate-800">{selectedEmployee.branch_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reporting Manager</span>
                    {isEditingHierarchy ? (
                      <select
                        value={hierarchyForm.reporting_manager_id}
                        onChange={(event) => setHierarchyForm((form) => ({ ...form, reporting_manager_id: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs outline-none focus:border-teal-500"
                      >
                        <option value="">None (Direct to Board)</option>
                        {managerCandidates.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.first_name} {manager.last_name} · {manager.employee_code}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold text-slate-800">
                        {selectedEmployee.reporting_manager_id
                          ? selectedEmployee.reporting_manager_name || 'Manager record unavailable'
                          : 'None (Direct to Board)'}
                      </span>
                    )}
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
                    <span className={`font-semibold ${selectedEmployee.probation_status === 'Confirmed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {selectedEmployee.probation_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">System Role</span>
                    {isEditingHierarchy ? (
                      <select
                        required
                        value={hierarchyForm.role}
                        onChange={(event) => setHierarchyForm((form) => ({ ...form, role: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs outline-none focus:border-teal-500"
                      >
                        {profileRoleOptions.map((role) => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="uppercase font-bold text-teal-700">
                        {userRoleLabels[selectedEmployee.role] || selectedEmployee.role || 'Not assigned'}
                      </span>
                    )}
                  </div>
                </div>
                {canEditHierarchy && (
                  <div className="flex justify-between gap-2">
                    {!isEditingHierarchy
                      && canArchiveSelectedEmployee
                      && Number(currentUser?.employee_id) !== Number(selectedEmployee.id)
                      && (
                        <Button
                          type="button"
                          variant="danger"
                          disabled={isSavingHierarchy || isLoadingArchiveImpact}
                          onClick={prepareArchiveSelectedEmployee}
                        >
                          {isLoadingArchiveImpact ? 'Checking dependencies...' : 'Archive employee'}
                        </Button>
                      )}
                    <div className="flex justify-end gap-2">
                    {isEditingHierarchy ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={isSavingHierarchy}
                          onClick={() => {
                            setIsEditingHierarchy(false);
                            setHierarchyError('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary" disabled={isSavingHierarchy}>
                          {isSavingHierarchy ? 'Saving...' : 'Save profile'}
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="secondary" onClick={beginHierarchyEdit}>
                        Edit hierarchy & role
                      </Button>
                    )}
                    </div>
                  </div>
                )}
              </form>
            )}

            {activeProfileTab === 'job' && canManageLeadAccess && selectedEmployee && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-teal-600 p-2 text-white shadow-sm">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                          Lead Management Access
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          selectedEmployee.has_lead_access
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}>
                          {selectedEmployee.has_lead_access ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-teal-800">
                        When enabled, the Lead Management section appears in this employee's dashboard and sidebar navigation, permitting them to manage assigned leads.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={isUpdatingLeadAccess}
                      onClick={() => handleToggleLeadAccess(selectedEmployee.id, !selectedEmployee.has_lead_access)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${
                        selectedEmployee.has_lead_access ? 'bg-teal-600' : 'bg-slate-300'
                      }`}
                      role="switch"
                      aria-checked={Boolean(selectedEmployee.has_lead_access)}
                      aria-label="Toggle Lead Management Access"
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          selectedEmployee.has_lead_access ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                {leadAccessSuccess && (
                  <div className="mt-2.5 rounded-lg bg-emerald-100/90 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                    ✓ {leadAccessSuccess}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: STATUTORY (Architecture Section 7.4 & 8) */}
            {activeProfileTab === 'statutory' && canViewStatutoryDetails && (
              isEditingStatutory ? (
                <form onSubmit={saveStatutory} className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  {statutoryError && (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                      {statutoryError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block font-semibold text-slate-700">
                      Income Tax PAN
                      <input
                        maxLength={10}
                        value={statutoryForm.pan}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, pan: e.target.value.toUpperCase() })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono uppercase bg-white"
                        placeholder="ABCDE1234F"
                      />
                    </label>
                    <label className="block font-semibold text-slate-700">
                      EPF UAN
                      <input
                        maxLength={12}
                        value={statutoryForm.uan}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, uan: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono bg-white"
                        placeholder="12 digits"
                      />
                    </label>
                    <label className="block font-semibold text-slate-700">
                      EPF Member ID
                      <input
                        maxLength={50}
                        value={statutoryForm.pf_account_no}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, pf_account_no: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono bg-white"
                      />
                    </label>
                    <label className="block font-semibold text-slate-700">
                      Tax Regime
                      <select
                        value={statutoryForm.tax_regime}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, tax_regime: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white"
                      >
                        <option value="New">New Tax Regime</option>
                        <option value="Old">Old Tax Regime</option>
                      </select>
                    </label>
                    <label className="block font-semibold text-slate-700">
                      Professional Tax (PT) State
                      <input
                        required
                        value={statutoryForm.pt_state}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, pt_state: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={statutoryForm.pf_applicable}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, pf_applicable: e.target.checked })}
                      />
                      EPF Applicable
                    </label>
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={statutoryForm.esi_applicable}
                        onChange={(e) => setStatutoryForm({ ...statutoryForm, esi_applicable: e.target.checked })}
                      />
                      ESI Applicable
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditingStatutory(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" disabled={isSavingStatutory}>
                      {isSavingStatutory ? 'Saving...' : 'Save Statutory Details'}
                    </Button>
                  </div>
                </form>
              ) : (
              <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Income Tax PAN</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEmployee.pan || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tax Regime</span>
                    <span className="font-bold text-teal-600">{selectedEmployee.tax_regime || 'New'} Tax Regime</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">EPF Universal Account No (UAN)</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEmployee.uan || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">EPF Member ID</span>
                    <span className="font-mono text-slate-700">{selectedEmployee.pf_account_no || 'Pending Allocation'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ESI Applicability</span>
                    <span className="font-semibold text-slate-700">
                      {selectedEmployee.esi_applicable ? 'Applicable' : 'Exempt'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Professional Tax (PT) State</span>
                    <span className="font-semibold text-slate-700">{selectedEmployee.pt_state || '—'}</span>
                  </div>
                </div>
                {currentUser?.role === 'super_admin' && (
                  <div className="pt-2 flex justify-end">
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setIsEditingStatutory(true)}>
                      Edit Statutory
                    </Button>
                  </div>
                )}
              </div>
              )
            )}

            {/* TAB CONTENT: SALARY & BANK */}
            {activeProfileTab === 'salary' && canViewCompensation && (
              isEditingCompensation ? (
                <form onSubmit={saveCompensation} className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {compensationError && (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      {compensationError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ['ctc_annual', 'Annual CTC'],
                      ['gross_monthly', 'Monthly Gross'],
                      ['basic_monthly', 'Basic Monthly'],
                    ].map(([field, label]) => (
                      <label key={field} className="block font-semibold text-slate-600">
                        {label} (₹)
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={compensationForm[field]}
                          onChange={(event) => setCompensationForm((form) => ({ ...form, [field]: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                        />
                      </label>
                    ))}
                    <label className="block font-semibold text-slate-600">
                      Bank Name
                      <input
                        value={compensationForm.bank_name}
                        onChange={(event) => setCompensationForm((form) => ({ ...form, bank_name: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                      />
                    </label>
                    <label className="block font-semibold text-slate-600">
                      Account Number
                      <input
                        value={compensationForm.account_number}
                        maxLength={34}
                        onChange={(event) => setCompensationForm((form) => ({ ...form, account_number: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900"
                      />
                    </label>
                    <label className="block font-semibold text-slate-600">
                      IFSC Code
                      <input
                        value={compensationForm.ifsc_code}
                        maxLength={11}
                        onChange={(event) => setCompensationForm((form) => ({ ...form, ifsc_code: event.target.value.toUpperCase() }))}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono uppercase text-slate-900"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSavingCompensation}
                      onClick={() => {
                        setIsEditingCompensation(false);
                        setCompensationError('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSavingCompensation}>
                      {isSavingCompensation ? 'Saving...' : 'Save compensation'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="grid grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Annual CTC</span>
                      <span className="text-base font-bold text-slate-900">₹{Number(selectedEmployee.ctc_annual || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Monthly Gross</span>
                      <span className="text-base font-bold text-teal-600">₹{Number(selectedEmployee.gross_monthly || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Basic Monthly</span>
                      <span className="text-base font-bold text-slate-700">₹{Number(selectedEmployee.basic_monthly || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                      <span className="font-semibold text-slate-800">{selectedEmployee.bank_name || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedEmployee.account_number || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">IFSC Code</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedEmployee.ifsc_code || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-200 pt-3">
                    <Button type="button" variant="secondary" onClick={beginCompensationEdit}>
                      Edit compensation & bank details
                    </Button>
                  </div>
                </div>
              )
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setSelectedEmployee(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(archiveImpact)}
        onClose={() => {
          if (!isSavingHierarchy) {
            setArchiveImpact(null);
            setArchiveError('');
          }
        }}
        title="Reassign work before archiving"
        subtitle={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} · ${selectedEmployee.employee_code}` : ''}
        maxWidth="max-w-2xl"
      >
        {archiveImpact && (
          <form onSubmit={archiveSelectedEmployee} className="space-y-4 text-xs">
            {archiveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{archiveError}</p>}
            <p className="text-slate-600">Active login will be disabled. Reassign direct reports and open projects, and confirm whether pending leave or attendance requests should be cancelled.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">Direct reports: {archiveImpact.direct_reports?.length || 0}</p>
                {(archiveImpact.direct_reports?.length || 0) > 0 && (
                  <label className="mt-2 block font-medium text-slate-700">
                    New reporting manager
                    <select
                      required
                      value={archivePlan.reporting_manager_id}
                      onChange={(event) => setArchivePlan({ ...archivePlan, reporting_manager_id: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                    >
                      <option value="">Select eligible manager</option>
                      {(archiveImpact.eligible_managers || []).map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name} · {candidate.employee_code}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">Open projects: {archiveImpact.open_projects?.length || 0}</p>
                {archiveImpact.open_projects?.map((project) => (
                  <p key={project.id} className="mt-1 text-slate-600">{project.name} · {project.status}</p>
                ))}
                {(archiveImpact.open_projects?.length || 0) > 0 && (
                  <label className="mt-2 block font-medium text-slate-700">
                    Assign projects to
                    <select
                      required
                      value={archivePlan.reassign_project_employee_id}
                      onChange={(event) => setArchivePlan({ ...archivePlan, reassign_project_employee_id: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                    >
                      <option value="">Select active employee</option>
                      {employees.filter((candidate) => candidate.status === 'active' && Number(candidate.id) !== Number(selectedEmployee?.id)).map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name} · {candidate.employee_code}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            {Array.isArray(archiveImpact.allocated_assets) && archiveImpact.allocated_assets.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-950">
                <p className="font-semibold text-xs">Allocated hardware assets ({archiveImpact.allocated_assets.length}):</p>
                <p className="mt-0.5 text-[11px] text-amber-900">
                  {archiveImpact.allocated_assets.map((a) => `${a.name} (${a.asset_code})`).join(', ')}.
                  Remember to collect and return equipment in the Asset Register.
                </p>
              </div>
            )}
            {(archiveImpact.pending_leave_requests > 0 || archiveImpact.pending_attendance_requests > 0) && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                <input
                  type="checkbox"
                  required
                  checked={archivePlan.cancel_pending_requests}
                  onChange={(event) => setArchivePlan({ ...archivePlan, cancel_pending_requests: event.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  Cancel {archiveImpact.pending_leave_requests || 0} pending leave and {archiveImpact.pending_attendance_requests || 0} pending attendance request(s).
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" disabled={isSavingHierarchy} onClick={() => setArchiveImpact(null)}>Cancel</Button>
              <Button type="submit" variant="danger" disabled={isSavingHierarchy}>{isSavingHierarchy ? 'Archiving...' : 'Confirm archive'}</Button>
            </div>
          </form>
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
                value={newEmp.department_id}
                onChange={(event) => {
                  const departmentId = event.target.value;
                  const department = departments.find((item) => String(item.id) === departmentId);
                  setNewEmp({
                    ...newEmp,
                    department_id: departmentId,
                    department: department?.name || '',
                    designation_id: '',
                    designation: '',
                  });
                }}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="">Select department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation:</label>
              <input
                type="text"
                required
                list="employee-designation-options"
                value={newEmp.designation}
                onChange={(event) => {
                  const designation = event.target.value;
                  const matchedDesignation = designations.find((item) => (
                    Number(item.department_id) === Number(newEmp.department_id)
                    && item.title.toLowerCase() === designation.trim().toLowerCase()
                  ));
                  setNewEmp({
                    ...newEmp,
                    designation,
                    designation_id: matchedDesignation ? String(matchedDesignation.id) : '',
                  });
                }}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
              <datalist id="employee-designation-options">
                {designations
                  .filter((item) => Number(item.department_id) === Number(newEmp.department_id))
                  .map((item) => <option key={item.id} value={item.title} />)}
              </datalist>
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
                  maxLength={10}
                  value={newEmp.pan}
                  onChange={(e) => setNewEmp({ ...newEmp, pan: e.target.value.toUpperCase() })}
                  className="w-full p-1.5 rounded-lg border border-slate-200 font-mono uppercase"
                  placeholder="ABCDE1234F"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">UAN (EPF):</label>
                <input
                  type="text"
                  maxLength={12}
                  value={newEmp.uan}
                  onChange={(e) => setNewEmp({ ...newEmp, uan: e.target.value })}
                  className="w-full p-1.5 rounded-lg border border-slate-200 font-mono"
                  placeholder="12 digits"
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
        title="Employee setup email sent"
        subtitle={provisionedCredentials?.name}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-sm">
          {provisionedCredentials?.warnings?.length > 0 && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {provisionedCredentials.warnings.join(' ')}
            </p>
          )}
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            A one-time password setup link was sent to the login email. The employee creates their own password; no password is sent by email.
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
          <p className="text-xs leading-5 text-slate-600">
            {provisionedCredentials?.firstName || 'The employee'} should open the email link within {provisionedCredentials?.setupLinkExpiresInMinutes || 60} minutes, set a password, then sign in with the login email or employee code.
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
