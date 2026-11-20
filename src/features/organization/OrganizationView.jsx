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
  Briefcase,
  Layers,
  CheckCircle2,
  Plus,
  Shield,
  FileSpreadsheet
} from 'lucide-react';

export default function OrganizationView() {
  const { currentUser } = useAuth();
  const { company, branches, createBranch, departments, designations, holidays, syncWithBackend } = useHRMS();
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'branches' | 'departments' | 'holidays'
  const [selectedHolidayBranch, setSelectedHolidayBranch] = useState('all');
  const [updatingPtBranchId, setUpdatingPtBranchId] = useState(null);
  const [branchError, setBranchError] = useState('');
  const [branchSuccess, setBranchSuccess] = useState('');
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    pt_applicable: false,
  });

  const handleAddBranch = async (e) => {
    e.preventDefault();
    setBranchError('');
    setBranchSuccess('');
    setSavingBranch(true);
    try {
      await createBranch(newBranchForm);
      setBranchSuccess(`Branch "${newBranchForm.name}" registered successfully! It is now active across all HRMS dropdowns.`);
      setShowAddBranchModal(false);
      setNewBranchForm({ name: '', code: '', city: '', state: '', pt_applicable: false });
      setTimeout(() => setBranchSuccess(''), 6000);
    } catch (err) {
      setBranchError(err?.data?.message || err.message || 'Unable to create branch.');
    } finally {
      setSavingBranch(false);
    }
  };
  const visibleHolidays = holidays.filter(
    holiday => selectedHolidayBranch === 'all' || holiday.branches?.includes(Number(selectedHolidayBranch))
  );

  const toggleBranchPt = async (branch) => {
    setBranchError('');
    setUpdatingPtBranchId(branch.id);
    try {
      await api.updateBranchProfessionalTax(branch.id, !branch.pt_applicable);
      await syncWithBackend('organization');
    } catch (error) {
      setBranchError(error?.data?.message || error.message || 'Unable to update branch PT applicability.');
    } finally {
      setUpdatingPtBranchId(null);
    }
  };

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
          Single legal entity registered in India with branch locations (Prayagraj & Kaushambi), departments, designations, and holiday calendars.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
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
          <Card title="Corporate Identity & Legal Entity" subtitle="Architecture Section 1: Single legal company in India">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Entity Name</span>
                <p className="text-sm font-bold text-slate-900">{company.name}</p>
                <p className="text-slate-500 text-[11px]">{company.legal_name}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Corporate Identification Number (CIN)</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.cin}</p>
                <span className="text-[11px] text-emerald-600 font-semibold">Active Registrar of Companies (ROC Kanpur/UP)</span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Permanent Account Number (PAN)</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.pan}</p>
                <p className="text-[11px] text-slate-400">TAN: {company.tan}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">GSTIN (Uttar Pradesh State)</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.gstin}</p>
                <p className="text-[11px] text-slate-400">Principal Place of Business</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">EPF Employer Code</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.pf_code}</p>
                <p className="text-[11px] text-slate-400">EPFO Regional Office Prayagraj</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">ESIC Employer Code</span>
                <p className="text-sm font-mono font-bold text-slate-800">{company.esi_code}</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Regional Branch Offices ({branches.length})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All branch offices registered here are immediately available across Recruitment, Employees Directory, and Payroll.
              </p>
            </div>
            {['super_admin', 'hr_admin'].includes(currentUser?.role) && (
              <Button
                size="sm"
                variant="primary"
                icon={Plus}
                onClick={() => {
                  setBranchError('');
                  setShowAddBranchModal(true);
                }}
              >
                Add New Branch
              </Button>
            )}
          </div>

          {branchSuccess && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {branchSuccess}
            </p>
          )}

          {branchError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {branchError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(branch => (
            <Card key={branch.id} title={branch.name} subtitle={`Branch Code: ${branch.code}`}>
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
                  <Badge variant="success" size="sm">Operational</Badge>
                </div>
              </div>
            </Card>
          ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENTS & DESIGNATIONS */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Departments" subtitle="Functional organizational units">
            <div className="space-y-3">
              {departments.map(dept => (
                <div key={dept.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                        {dept.code}
                      </span>
                      <h4 className="font-bold text-slate-800">{dept.name}</h4>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Head: {dept.head}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-700">₹{(dept.budget_inr / 10000000).toFixed(2)} Cr</span>
                    <p className="text-[10px] text-slate-400">Annual Budget</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Designations & Levels" subtitle="Structured career ladder">
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {designations.map(desig => (
                <div key={desig.id} className="p-3 rounded-lg border border-slate-100 bg-white flex items-center justify-between text-xs hover:border-slate-300 transition">
                  <div>
                    <p className="font-semibold text-slate-800">{desig.title}</p>
                    <p className="text-[11px] text-slate-400">Min Exp: {desig.min_experience_years}+ Years</p>
                  </div>
                  <Badge variant="primary" size="sm">Level {desig.level}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <Card
          title="Indian Statutory & Gazetted Holiday Calendar 2026"
          subtitle="Configurable across branches as per state labor acts"
          action={
            <select
              value={selectedHolidayBranch}
              onChange={(e) => setSelectedHolidayBranch(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-2 bg-slate-50"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleHolidays.length ? visibleHolidays.map(holiday => (
              <div key={holiday.id} className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{holiday.name}</span>
                  <Badge variant={holiday.type === 'National' ? 'success' : holiday.type === 'Gazetted' ? 'primary' : 'neutral'} size="sm">
                    {holiday.type}
                  </Badge>
                </div>
                <p className="text-teal-600 font-semibold mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-500" />
                  {holiday.date}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1 text-[11px] text-slate-500">
                  <span>Applicable:</span>
                  <span className="font-medium text-slate-700">
                    {holiday.branches.length === 4 ? "All India Branches" : `${holiday.branches.length} Branch(es)`}
                  </span>
                </div>
              </div>
            )) : (
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

      {showAddBranchModal && (
        <Modal
          isOpen={showAddBranchModal}
          onClose={() => setShowAddBranchModal(false)}
          title="Add New Regional Branch"
        >
          <form onSubmit={handleAddBranch} className="space-y-4 text-xs">
            {branchError && (
              <p className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-rose-700">
                {branchError}
              </p>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Branch Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Noida Tech Hub or Delhi Branch"
                value={newBranchForm.name}
                onChange={(e) => setNewBranchForm({ ...newBranchForm, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 font-normal focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Branch Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. NOI-01 (Auto if blank)"
                  value={newBranchForm.code}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-normal focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  City <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Noida"
                  value={newBranchForm.city}
                  onChange={(e) => setNewBranchForm({ ...newBranchForm, city: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 font-normal focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Uttar Pradesh, Karnataka, Maharashtra"
                value={newBranchForm.state}
                onChange={(e) => setNewBranchForm({ ...newBranchForm, state: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 font-normal focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="pt_applicable"
                checked={newBranchForm.pt_applicable}
                onChange={(e) => setNewBranchForm({ ...newBranchForm, pt_applicable: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="pt_applicable" className="text-slate-700 font-medium cursor-pointer">
                Professional Tax (PT) applicable in this state
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAddBranchModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={savingBranch}
              >
                {savingBranch ? 'Creating Branch…' : 'Save & Register Branch'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
