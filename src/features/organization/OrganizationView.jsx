import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import {
  Building2,
  Building,
  MapPin,
  Calendar,
  Layers,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

function extractError(error, fallback) {
  const fieldErrors = error?.data?.errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const first = Object.values(fieldErrors).flat()[0];
    if (first) return first;
  }
  return error?.data?.message || error?.message || fallback;
}

export default function OrganizationView() {
  const { currentUser, activeBranch } = useAuth();
  const {
    company,
    branches,
    departments,
    designations,
    holidays,
    refreshBranches,
    refreshOrganization,
  } = useHRMS();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'branches' | 'departments' | 'holidays'
  const [selectedHolidayBranch, setSelectedHolidayBranch] = useState('all');
  const [updatingPtBranchId, setUpdatingPtBranchId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  React.useEffect(() => {
    if (!activeBranch || activeBranch === 'All Branches') {
      setSelectedHolidayBranch('all');
    } else {
      const match = branches.find(b => b.name === activeBranch || activeBranch.includes(b.city) || activeBranch.includes(b.name));
      if (match) setSelectedHolidayBranch(String(match.id));
    }
  }, [activeBranch, branches]);

  // Modals state (Super Admin CRUD)
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({});

  const [branchModal, setBranchModal] = useState({ open: false, editing: null });
  const [branchForm, setBranchForm] = useState({ name: '', code: '', city: '', state: '', pt_applicable: false, is_active: true });

  const [deptModal, setDeptModal] = useState({ open: false, editing: null });
  const [deptForm, setDeptForm] = useState({ branch_id: '', name: '', code: '', head: '', budget_inr: 0 });

  const [desigModal, setDesigModal] = useState({ open: false, editing: null });
  const [desigForm, setDesigForm] = useState({ department_id: '', title: '', level: 'L3', min_experience_years: 1 });

  const [holidayModal, setHolidayModal] = useState({ open: false, editing: null });
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Gazetted', branch_ids: [] });

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const visibleHolidays = holidays.filter((holiday) => {
    if (selectedHolidayBranch === 'all') return true;
    const assigned = Array.isArray(holiday.branches) ? holiday.branches : [];
    return assigned.length === 0 || assigned.includes(Number(selectedHolidayBranch));
  });

  const departmentNameById = Object.fromEntries(departments.map((d) => [Number(d.id), d.name]));

  const toggleBranchPt = async (branch) => {
    setFeedback(null);
    setUpdatingPtBranchId(branch.id);
    try {
      await api.updateBranchProfessionalTax(branch.id, !branch.pt_applicable);
      await refreshBranches();
      setFeedback({ type: 'success', text: `Updated Professional Tax setting for ${branch.name}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: extractError(error, 'Unable to update branch PT applicability.') });
    } finally {
      setUpdatingPtBranchId(null);
    }
  };

  // --- Company Edit ---
  const openEditCompany = () => {
    if (!company) return;
    setModalError('');
    setCompanyForm({
      name: company.name || '',
      legal_name: company.legal_name || '',
      cin: company.cin || '',
      pan: company.pan || '',
      tan: company.tan || '',
      gstin: company.gstin || '',
      pf_code: company.pf_code || '',
      esi_code: company.esi_code || '',
      registered_state: company.registered_state || 'Uttar Pradesh',
      headquarters: company.headquarters || '',
      support_email: company.support_email || '',
      contact_number: company.contact_number || '',
    });
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      await api.updateCompany(companyForm);
      await refreshOrganization();
      setCompanyModalOpen(false);
      setFeedback({ type: 'success', text: 'Company master profile updated.' });
    } catch (error) {
      setModalError(extractError(error, 'Unable to update company profile.'));
    } finally {
      setSaving(false);
    }
  };

  // --- Branch Add / Edit ---
  const openBranchModal = (branch = null) => {
    setModalError('');
    setBranchForm(branch ? {
      name: branch.name || '',
      code: branch.code || '',
      city: branch.city || '',
      state: branch.state || '',
      pt_applicable: Boolean(branch.pt_applicable),
      is_active: branch.is_active !== false,
    } : {
      name: '',
      code: '',
      city: '',
      state: company?.registered_state || 'Uttar Pradesh',
      pt_applicable: false,
      is_active: true,
    });
    setBranchModal({ open: true, editing: branch });
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      if (branchModal.editing) {
        await api.updateBranch(branchModal.editing.id, branchForm);
      } else {
        await api.createBranch(branchForm);
      }
      await refreshOrganization();
      setBranchModal({ open: false, editing: null });
      setFeedback({ type: 'success', text: branchModal.editing ? 'Branch updated.' : 'Branch created.' });
    } catch (error) {
      setModalError(extractError(error, 'Unable to save branch.'));
    } finally {
      setSaving(false);
    }
  };

  // --- Department Add / Edit / Delete ---
  const openDeptModal = (dept = null) => {
    setModalError('');
    setDeptForm(dept ? {
      branch_id: dept.branch_id ? String(dept.branch_id) : '',
      name: dept.name || '',
      code: dept.code || '',
      head: dept.head || '',
      budget_inr: dept.budget_inr ?? 0,
    } : {
      branch_id: branches[0] ? String(branches[0].id) : '',
      name: '',
      code: '',
      head: '',
      budget_inr: 0,
    });
    setDeptModal({ open: true, editing: dept });
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      const payload = {
        ...deptForm,
        branch_id: deptForm.branch_id ? Number(deptForm.branch_id) : null,
        budget_inr: Number(deptForm.budget_inr || 0),
      };
      if (deptModal.editing) {
        await api.updateDepartment(deptModal.editing.id, payload);
      } else {
        await api.createDepartment(payload);
      }
      await refreshOrganization();
      setDeptModal({ open: false, editing: null });
      setFeedback({ type: 'success', text: deptModal.editing ? 'Department updated.' : 'Department created.' });
    } catch (error) {
      setModalError(extractError(error, 'Unable to save department.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return;
    setFeedback(null);
    try {
      await api.deleteDepartment(dept.id);
      await refreshOrganization();
      setFeedback({ type: 'success', text: `Deleted department ${dept.name}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: extractError(error, 'Unable to delete department.') });
    }
  };

  // --- Designation Add / Edit / Delete ---
  const openDesigModal = (desig = null) => {
    setModalError('');
    setDesigForm(desig ? {
      department_id: desig.department_id ? String(desig.department_id) : '',
      title: desig.title || '',
      level: desig.level || 'L3',
      min_experience_years: desig.min_experience_years ?? 0,
    } : {
      department_id: departments[0] ? String(departments[0].id) : '',
      title: '',
      level: 'L3',
      min_experience_years: 1,
    });
    setDesigModal({ open: true, editing: desig });
  };

  const handleSaveDesig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      const payload = {
        ...desigForm,
        department_id: Number(desigForm.department_id),
        min_experience_years: Number(desigForm.min_experience_years || 0),
      };
      if (desigModal.editing) {
        await api.updateDesignation(desigModal.editing.id, payload);
      } else {
        await api.createDesignation(payload);
      }
      await refreshOrganization();
      setDesigModal({ open: false, editing: null });
      setFeedback({ type: 'success', text: desigModal.editing ? 'Designation updated.' : 'Designation created.' });
    } catch (error) {
      setModalError(extractError(error, 'Unable to save designation.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesig = async (desig) => {
    if (!window.confirm(`Delete designation "${desig.title}"?`)) return;
    setFeedback(null);
    try {
      await api.deleteDesignation(desig.id);
      await refreshOrganization();
      setFeedback({ type: 'success', text: `Deleted designation ${desig.title}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: extractError(error, 'Unable to delete designation.') });
    }
  };

  // --- Holiday Add / Edit / Delete ---
  const openHolidayModal = (holiday = null) => {
    setModalError('');
    setHolidayForm(holiday ? {
      name: holiday.name || '',
      date: holiday.date || '',
      type: holiday.type || 'Gazetted',
      branch_ids: Array.isArray(holiday.branches) ? holiday.branches.map(Number) : [],
    } : {
      name: '',
      date: '',
      type: 'Gazetted',
      branch_ids: branches.map((b) => Number(b.id)),
    });
    setHolidayModal({ open: true, editing: holiday });
  };

  const toggleHolidayBranch = (branchId) => {
    setHolidayForm((prev) => {
      const exists = prev.branch_ids.includes(branchId);
      return {
        ...prev,
        branch_ids: exists
          ? prev.branch_ids.filter((id) => id !== branchId)
          : [...prev.branch_ids, branchId],
      };
    });
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      if (holidayModal.editing) {
        await api.updateHoliday(holidayModal.editing.id, holidayForm);
      } else {
        await api.createHoliday(holidayForm);
      }
      await refreshOrganization();
      setHolidayModal({ open: false, editing: null });
      setFeedback({ type: 'success', text: holidayModal.editing ? 'Holiday updated.' : 'Holiday created.' });
    } catch (error) {
      setModalError(extractError(error, 'Unable to save holiday.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (holiday) => {
    if (!window.confirm(`Delete holiday "${holiday.name}" (${holiday.date})?`)) return;
    setFeedback(null);
    try {
      await api.deleteHoliday(holiday.id);
      await refreshOrganization();
      setFeedback({ type: 'success', text: `Deleted holiday ${holiday.name}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: extractError(error, 'Unable to delete holiday.') });
    }
  };

  const calendarYearLabel = holidays[0]?.date ? String(holidays[0].date).slice(0, 4) : new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
            Company Structure
          </span>
          <span className="text-xs text-slate-500 font-medium">Single Company & Regional Branches</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Organization & Branches Master</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Single legal entity registered in India with branch locations, departments, designations, and holiday calendars.
        </p>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('company')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'company' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" /> Company Master Profile
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'branches' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" /> Branches ({branches.length})
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'departments' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" /> Departments & Designations
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'holidays' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" /> Indian Holiday Calendars
        </button>
      </div>

      {/* TAB 1: COMPANY MASTER */}
      {activeTab === 'company' && (
        company ? (
        <div className="space-y-6">
          <Card
            title="Corporate Identity & Legal Entity"
            subtitle="Architecture Section 1: Single legal company in India"
            action={
              isSuperAdmin && (
                <Button size="sm" variant="secondary" icon={Pencil} onClick={openEditCompany}>
                  Edit Company
                </Button>
              )
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Entity Name</span>
                <p className="text-sm font-bold text-slate-900">{company.name}</p>
                <p className="text-slate-500 text-[11px]">{company.legal_name}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Corporate Identification Number (CIN)</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.cin || '—'}</p>
                <span className="text-[11px] text-emerald-600 font-semibold">Registered in {company.registered_state}</span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Permanent Account Number (PAN)</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.pan}</p>
                <p className="text-[11px] text-slate-400">TAN: {company.tan || '—'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">GSTIN ({company.registered_state})</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.gstin || '—'}</p>
                <p className="text-[11px] text-slate-400">Principal Place of Business</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">EPF Employer Code</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.pf_code || '—'}</p>
                <p className="text-[11px] text-slate-400">EPFO Regional Office</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">ESIC Employer Code</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.esi_code || '—'}</p>
                <p className="text-[11px] text-slate-400">Employees' State Insurance Corporation</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span><strong>Registered Office:</strong> {company.headquarters}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Timezone: <strong>{company.timezone}</strong></span>
                <span>Currency: <strong>{company.currency} ({company.currency_symbol})</strong></span>
              </div>
            </div>
          </Card>
        </div>
        ) : (
          <Card title="Company master is not configured" subtitle="No company record was returned by the connected database." />
        )
      )}

      {/* TAB 2: BRANCHES */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          {isSuperAdmin && (
            <div className="flex justify-end">
              <Button size="sm" variant="primary" icon={Plus} onClick={() => openBranchModal()}>
                Add Branch
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map((branch) => {
              const isActive = Boolean(
                activeBranch &&
                activeBranch !== 'All Branches' &&
                (branch.name === activeBranch || activeBranch.includes(branch.city) || activeBranch.includes(branch.name))
              );

              return (
                <div key={branch.id} className={isActive ? 'ring-2 ring-teal-500 rounded-2xl' : ''}>
                  <Card
                    title={
                      <div className="flex items-center gap-2">
                        <span>{branch.name}</span>
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                            Active Branch
                          </span>
                        )}
                      </div>
                    }
                    subtitle={`Branch Code: ${branch.code}`}
                    action={
                      isSuperAdmin && (
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openBranchModal(branch)}>
                          Edit
                        </Button>
                      )
                    }
                  >
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">City / State</span>
                        <span className="font-semibold text-slate-800">{branch.city}, {branch.state}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Active Staff Count</span>
                        <span className="font-bold text-teal-600">{branch.employees_count} Employees</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Professional Tax (PT)</span>
                        {branch.pt_applicable ? (
                          <Badge variant="primary" size="sm">Enabled · {branch.state} rule required</Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">Disabled for this branch</Badge>
                        )}
                      </div>

                      {['super_admin', 'hr_admin'].includes(currentUser?.role) && (
                        <Button
                          size="sm"
                          variant={branch.pt_applicable ? 'secondary' : 'primary'}
                          disabled={updatingPtBranchId === branch.id}
                          onClick={() => toggleBranchPt(branch)}
                        >
                          {updatingPtBranchId === branch.id
                            ? 'Saving…'
                            : branch.pt_applicable ? 'Disable PT for branch' : 'Enable PT for branch'}
                        </Button>
                      )}

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">Status</span>
                        <Badge variant={branch.is_active === false ? 'warning' : 'success'} size="sm">
                          {branch.is_active === false ? 'Inactive' : 'Operational'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENTS & DESIGNATIONS */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title="Departments"
            subtitle="Functional organizational units"
            action={
              isSuperAdmin && (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => openDeptModal()}>
                  Add Dept
                </Button>
              )
            }
          >
            <div className="space-y-3">
              {departments.map((dept) => (
                <div key={dept.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                        {dept.code}
                      </span>
                      <h4 className="font-bold text-slate-800">{dept.name}</h4>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Head: {dept.head || 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-semibold text-slate-700">₹{(Number(dept.budget_inr || 0) / 10000000).toFixed(2)} Cr</span>
                      <p className="text-[10px] text-slate-400">Annual Budget</p>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openDeptModal(dept)} className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-teal-700" title="Edit department">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteDept(dept)} className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Delete department">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Designations & Levels"
            subtitle="Structured career ladder"
            action={
              isSuperAdmin && (
                <Button size="sm" variant="primary" icon={Plus} disabled={departments.length === 0} onClick={() => openDesigModal()}>
                  Add Role
                </Button>
              )
            }
          >
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {designations.map((desig) => (
                <div key={desig.id} className="p-3 rounded-lg border border-slate-100 bg-white flex items-center justify-between gap-2 text-xs hover:border-slate-300 transition">
                  <div>
                    <p className="font-semibold text-slate-800">{desig.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {departmentNameById[Number(desig.department_id)] || `Dept #${desig.department_id}`} · Min Exp: {desig.min_experience_years}+ Years
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">Level {desig.level}</Badge>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openDesigModal(desig)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-teal-700" title="Edit designation">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteDesig(desig)} className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Delete designation">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <Card
          title={`Indian Statutory & Gazetted Holiday Calendar ${calendarYearLabel}`}
          subtitle="Configurable across branches as per state labor acts"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedHolidayBranch}
                onChange={(e) => setSelectedHolidayBranch(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 py-1.5 px-2 bg-slate-50"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {isSuperAdmin && (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => openHolidayModal()}>
                  Add Holiday
                </Button>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleHolidays.length ? visibleHolidays.map((holiday) => {
              const assignedBranches = Array.isArray(holiday.branches) ? holiday.branches : [];
              const appliesToAll = assignedBranches.length === 0 || (branches.length > 0 && assignedBranches.length >= branches.length);
              return (
                <div key={holiday.id} className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{holiday.name}</span>
                    <Badge variant={holiday.type === 'National' ? 'success' : holiday.type === 'Gazetted' ? 'primary' : 'neutral'} size="sm">
                      {holiday.type}
                    </Badge>
                  </div>
                  <p className="text-teal-600 font-semibold mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-500" />
                    {holiday.date}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      <span>Applicable: </span>
                      <span className="font-medium text-slate-700">
                        {appliesToAll ? 'All Branches' : `${assignedBranches.length} Branch(es)`}
                      </span>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openHolidayModal(holiday)} className="p-1 rounded text-slate-500 hover:bg-white hover:text-teal-700" title="Edit holiday">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteHoliday(holiday)} className="p-1 rounded text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Delete holiday">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div role="status" className="col-span-full flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                <Calendar className="h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No holiday records configured</p>
                <p className="mt-1 text-xs text-slate-500">
                  No holidays are available for the selected branch.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Company Edit Modal */}
      <Modal isOpen={companyModalOpen} onClose={() => setCompanyModalOpen(false)} title="Edit Company Master Profile">
        <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
          {modalError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{modalError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700">
              Company Name *
              <input required value={companyForm.name || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Legal Name *
              <input required value={companyForm.legal_name || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, legal_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              PAN *
              <input required maxLength={10} value={companyForm.pan || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, pan: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              TAN
              <input maxLength={10} value={companyForm.tan || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, tan: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              CIN
              <input maxLength={30} value={companyForm.cin || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, cin: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              GSTIN
              <input maxLength={15} value={companyForm.gstin || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              EPF Code
              <input value={companyForm.pf_code || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, pf_code: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono" />
            </label>
            <label className="block font-medium text-slate-700">
              ESIC Code
              <input value={companyForm.esi_code || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, esi_code: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono" />
            </label>
            <label className="block font-medium text-slate-700">
              Registered State *
              <input required value={companyForm.registered_state || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, registered_state: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Support Email
              <input type="email" value={companyForm.support_email || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, support_email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <label className="block font-medium text-slate-700">
            Registered Headquarters Address *
            <textarea required rows={2} value={companyForm.headquarters || ''} onChange={(e) => setCompanyForm((p) => ({ ...p, headquarters: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCompanyModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* Branch Modal */}
      <Modal isOpen={branchModal.open} onClose={() => setBranchModal({ open: false, editing: null })} title={branchModal.editing ? 'Edit Branch' : 'Add New Branch'} maxWidth="max-w-lg">
        <form onSubmit={handleSaveBranch} className="space-y-4 text-xs">
          {modalError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{modalError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700">
              Branch Name *
              <input required value={branchForm.name} onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Branch Code *
              <input required maxLength={20} value={branchForm.code} onChange={(e) => setBranchForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              City *
              <input required value={branchForm.city} onChange={(e) => setBranchForm((p) => ({ ...p, city: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              State *
              <input required value={branchForm.state} onChange={(e) => setBranchForm((p) => ({ ...p, state: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="flex flex-wrap gap-5 pt-1">
            <label className="inline-flex items-center gap-2 font-medium text-slate-700">
              <input type="checkbox" checked={branchForm.pt_applicable} onChange={(e) => setBranchForm((p) => ({ ...p, pt_applicable: e.target.checked }))} />
              Professional Tax (PT) Applicable
            </label>
            <label className="inline-flex items-center gap-2 font-medium text-slate-700">
              <input type="checkbox" checked={branchForm.is_active} onChange={(e) => setBranchForm((p) => ({ ...p, is_active: e.target.checked }))} />
              Branch Operational / Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setBranchModal({ open: false, editing: null })}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : branchModal.editing ? 'Update Branch' : 'Create Branch'}</Button>
          </div>
        </form>
      </Modal>

      {/* Department Modal */}
      <Modal isOpen={deptModal.open} onClose={() => setDeptModal({ open: false, editing: null })} title={deptModal.editing ? 'Edit Department' : 'Add Department'} maxWidth="max-w-lg">
        <form onSubmit={handleSaveDept} className="space-y-4 text-xs">
          {modalError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{modalError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700">
              Department Name *
              <input required value={deptForm.name} onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Code *
              <input required maxLength={20} value={deptForm.code} onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              Branch
              <select value={deptForm.branch_id} onChange={(e) => setDeptForm((p) => ({ ...p, branch_id: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
                <option value="">All Branches / Corporate</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-slate-700">
              Department Head
              <input value={deptForm.head} onChange={(e) => setDeptForm((p) => ({ ...p, head: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700 sm:col-span-2">
              Annual Budget (INR)
              <input type="number" min="0" step="1000" value={deptForm.budget_inr} onChange={(e) => setDeptForm((p) => ({ ...p, budget_inr: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDeptModal({ open: false, editing: null })}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : deptModal.editing ? 'Update Department' : 'Create Department'}</Button>
          </div>
        </form>
      </Modal>

      {/* Designation Modal */}
      <Modal isOpen={desigModal.open} onClose={() => setDesigModal({ open: false, editing: null })} title={desigModal.editing ? 'Edit Designation' : 'Add Designation'} maxWidth="max-w-lg">
        <form onSubmit={handleSaveDesig} className="space-y-4 text-xs">
          {modalError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{modalError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700 sm:col-span-2">
              Department *
              <select required value={desigForm.department_id} onChange={(e) => setDesigForm((p) => ({ ...p, department_id: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-slate-700 sm:col-span-2">
              Designation Title *
              <input required value={desigForm.title} onChange={(e) => setDesigForm((p) => ({ ...p, title: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Level *
              <input required maxLength={10} value={desigForm.level} onChange={(e) => setDesigForm((p) => ({ ...p, level: e.target.value.toUpperCase() }))} placeholder="L1 - L7" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase" />
            </label>
            <label className="block font-medium text-slate-700">
              Min Experience (Years)
              <input type="number" min="0" max="50" value={desigForm.min_experience_years} onChange={(e) => setDesigForm((p) => ({ ...p, min_experience_years: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDesigModal({ open: false, editing: null })}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : desigModal.editing ? 'Update Designation' : 'Create Designation'}</Button>
          </div>
        </form>
      </Modal>

      {/* Holiday Modal */}
      <Modal isOpen={holidayModal.open} onClose={() => setHolidayModal({ open: false, editing: null })} title={holidayModal.editing ? 'Edit Holiday' : 'Add Holiday'} maxWidth="max-w-lg">
        <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
          {modalError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{modalError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block font-medium text-slate-700 sm:col-span-2">
              Holiday Name *
              <input required value={holidayForm.name} onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Date *
              <input required type="date" value={holidayForm.date} onChange={(e) => setHolidayForm((p) => ({ ...p, date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block font-medium text-slate-700">
              Type *
              <select value={holidayForm.type} onChange={(e) => setHolidayForm((p) => ({ ...p, type: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
                <option value="National">National</option>
                <option value="Gazetted">Gazetted</option>
                <option value="Restricted">Restricted</option>
              </select>
            </label>
          </div>
          <div>
            <p className="font-medium text-slate-700 mb-1.5">Applicable Branches (leave all unchecked for all branches)</p>
            <div className="flex flex-wrap gap-3">
              {branches.map((b) => (
                <label key={b.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <input
                    type="checkbox"
                    checked={holidayForm.branch_ids.includes(Number(b.id))}
                    onChange={() => toggleHolidayBranch(Number(b.id))}
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setHolidayModal({ open: false, editing: null })}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : holidayModal.editing ? 'Update Holiday' : 'Create Holiday'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
