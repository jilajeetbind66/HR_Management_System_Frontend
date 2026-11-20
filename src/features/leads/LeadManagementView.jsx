import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock4,
  Edit2,
  Trash2,
  RefreshCw,
  MessageSquare,
  History,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
  FileText,
  Building
} from 'lucide-react';

const STATUS_CONFIG = {
  New: { variant: 'primary', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'In Progress': { variant: 'warning', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Converted: { variant: 'success', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Lost: { variant: 'danger', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

export default function LeadManagementView() {
  const { currentUser } = useAuth();
  const isHr = ['super_admin', 'hr_admin'].includes(currentUser?.role);
  const isEmployee = currentUser?.role === 'employee';

  // Leads list & stats
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    in_progress: 0,
    converted: 0,
    lost: 0,
    follow_ups_due_today: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Filter state with debouncing
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dueTodayOnly, setDueTodayOnly] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Available employees for assignment/filtering
  const [availableEmployees, setAvailableEmployees] = useState([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessSearch, setAccessSearch] = useState('');
  const [updatingAccessEmpId, setUpdatingAccessEmpId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  // Add / Edit Form state
  const initialFormState = {
    lead_name: '',
    lead_date: new Date().toISOString().split('T')[0],
    status: 'New',
    assigned_employee_ids: [],
    follow_up_required: false,
    follow_up_date: '',
    remarks: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progress Update Form state (for Employee / HR)
  const [progressData, setProgressData] = useState({
    status: 'New',
    remarks: '',
    follow_up_required: false,
    follow_up_date: '',
    mark_follow_up_completed: false,
    progress_note: '',
  });

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load leads
  const fetchLeads = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (employeeFilter !== 'all') params.employee_id = employeeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (dueTodayOnly) params.follow_up_due_today = 1;

      const response = await api.getLeads(params);
      setLeads(response?.data || []);
      if (response?.meta?.stats) {
        setStats(response.meta.stats);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
      setError(err?.data?.message || err.message || 'Failed to fetch leads.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load employees for assignment
  useEffect(() => {
    api.getLeadAssignees()
      .then((res) => {
        const list = res?.data || [];
        setAvailableEmployees(list.filter((emp) => emp.status === 'active' || emp.status === undefined));
      })
      .catch((err) => {
        console.error('Failed to load lead assignees:', err);
        if (isHr) {
          api.getEmployees()
            .then((res) => setAvailableEmployees((res?.data || []).filter((emp) => emp.status === 'active')))
            .catch(() => {});
        }
      });
  }, [isHr]);

  // Refetch leads when filters or debounced search changes
  useEffect(() => {
    setCurrentPage(1);
    fetchLeads();
  }, [debouncedSearch, statusFilter, employeeFilter, dateFrom, dateTo, dueTodayOnly]);

  // Pagination calculation
  const totalLeads = leads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedLeads = useMemo(() => {
    return leads.slice(pageStart, pageStart + pageSize);
  }, [leads, pageStart, pageSize]);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleEmployeeAccess = async (employeeId, currentStatus) => {
    setUpdatingAccessEmpId(employeeId);
    try {
      await api.updateEmployeeLeadAccess(employeeId, !currentStatus);
      setAvailableEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId ? { ...emp, has_lead_access: !currentStatus } : emp
        )
      );
      showToast(`Lead Access ${!currentStatus ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      showToast(err?.data?.message || err.message || 'Failed to update access', 'error');
    } finally {
      setUpdatingAccessEmpId(null);
    }
  };

  // Open Add Lead
  const handleOpenAddModal = () => {
    setFormData({
      lead_name: '',
      lead_date: new Date().toISOString().split('T')[0],
      status: 'New',
      assigned_employee_ids: currentUser?.employee_id ? [currentUser.employee_id] : [],
      follow_up_required: false,
      follow_up_date: '',
      remarks: '',
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Lead
  const handleOpenEditModal = (lead) => {
    setSelectedLead(lead);
    setFormData({
      lead_name: lead.lead_name,
      lead_date: lead.lead_date,
      status: lead.status,
      assigned_employee_ids: (lead.assigned_employees || []).map((e) => e.id),
      follow_up_required: Boolean(lead.follow_up_required),
      follow_up_date: lead.follow_up_date || '',
      remarks: lead.remarks || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Open Delete Confirmation
  const handleOpenDeleteModal = (lead) => {
    setSelectedLead(lead);
    setIsDeleteModalOpen(true);
  };

  // Open Progress / Follow-up update modal
  const handleOpenProgressModal = async (lead) => {
    setSelectedLead(lead);
    setProgressData({
      status: lead.status,
      remarks: lead.remarks || '',
      follow_up_required: Boolean(lead.follow_up_required),
      follow_up_date: lead.follow_up_date || '',
      mark_follow_up_completed: false,
      progress_note: '',
    });
    setIsProgressModalOpen(true);

    // Refresh lead activities
    try {
      const detailed = await api.getLead(lead.id);
      if (detailed?.data) {
        setSelectedLead(detailed.data);
      }
    } catch (err) {
      console.error('Could not refresh lead details:', err);
    }
  };

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.lead_name.trim()) errors.lead_name = 'Lead name is required.';
    if (!formData.lead_date) errors.lead_date = 'Lead date is required.';
    if (!formData.status) errors.status = 'Status is required.';
    if (!formData.assigned_employee_ids || formData.assigned_employee_ids.length === 0) {
      errors.assigned_employee_ids = 'Please select at least one assigned employee.';
    }
    if (formData.follow_up_required && !formData.follow_up_date) {
      errors.follow_up_date = 'Follow-up date is required when follow-up is enabled.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        lead_name: formData.lead_name.trim(),
        lead_date: formData.lead_date,
        status: formData.status,
        assigned_employee_ids: formData.assigned_employee_ids,
        follow_up_required: formData.follow_up_required,
        follow_up_date: formData.follow_up_required ? formData.follow_up_date : null,
        remarks: formData.remarks.trim() || null,
      };
      await api.createLead(payload);
      setIsAddModalOpen(false);
      showToast('Lead created and assigned successfully.');
      fetchLeads();
    } catch (err) {
      console.error('Create lead failed:', err);
      setFormErrors({ general: err?.data?.message || err.message || 'Failed to create lead.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        lead_name: formData.lead_name.trim(),
        lead_date: formData.lead_date,
        status: formData.status,
        assigned_employee_ids: formData.assigned_employee_ids,
        follow_up_required: formData.follow_up_required,
        follow_up_date: formData.follow_up_required ? formData.follow_up_date : null,
        remarks: formData.remarks.trim() || null,
      };
      await api.updateLead(selectedLead.id, payload);
      setIsEditModalOpen(false);
      showToast('Lead updated successfully.');
      fetchLeads();
    } catch (err) {
      console.error('Update lead failed:', err);
      setFormErrors({ general: err?.data?.message || err.message || 'Failed to update lead.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete
  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      await api.deleteLead(selectedLead.id);
      setIsDeleteModalOpen(false);
      showToast('Lead deleted successfully.');
      fetchLeads();
    } catch (err) {
      console.error('Delete lead failed:', err);
      alert(err?.data?.message || err.message || 'Failed to delete lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Progress / Follow-up Update
  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      const payload = {
        status: progressData.status,
        remarks: progressData.remarks,
        mark_follow_up_completed: progressData.mark_follow_up_completed,
        follow_up_required: progressData.mark_follow_up_completed ? false : progressData.follow_up_required,
        follow_up_date: progressData.mark_follow_up_completed ? null : (progressData.follow_up_required ? progressData.follow_up_date : null),
        progress_note: progressData.progress_note.trim() || null,
      };
      await api.updateLeadProgress(selectedLead.id, payload);
      setIsProgressModalOpen(false);
      showToast('Lead progress and follow-up updated successfully.');
      fetchLeads();
    } catch (err) {
      console.error('Update progress failed:', err);
      alert(err?.data?.message || err.message || 'Failed to update lead progress.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to toggle assigned employee in Add/Edit modal
  const toggleEmployeeAssignment = (empId) => {
    setFormData((prev) => {
      const current = prev.assigned_employee_ids || [];
      const exists = current.includes(empId);
      const updated = exists ? current.filter((id) => id !== empId) : [...current, empId];
      return { ...prev, assigned_employee_ids: updated };
    });
  };

  // Check if current user is permitted
  if (isEmployee && !currentUser?.has_lead_access) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-600 mb-3" />
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="mt-1 text-sm text-amber-800">
            You do not have permission to access Lead Management. Please contact HR or your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {toastMessage.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              {isHr ? 'HR & Admin' : 'Workforce Pipeline'}
            </span>
            <span className="text-xs text-slate-500 font-medium">Sales & Outreach Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-teal-600" />
            Lead Management
          </h1>
          <p className="text-xs text-slate-500">
            Track, assign, schedule follow-ups, and manage client and candidate leads across your workforce.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLeads}
            disabled={isLoading}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          {isHr && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAccessModalOpen(true)}
              icon={Users}
            >
              Employee Access
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            icon={Plus}
          >
            Add Lead
          </Button>
        </div>
      </div>

      {/* Dashboard Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Leads"
          value={stats.total}
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard
          title="New Leads"
          value={stats.new}
          icon={Plus}
          color="blue"
        />
        <StatCard
          title="In Progress"
          value={stats.in_progress}
          icon={Clock4}
          color="amber"
        />
        <StatCard
          title="Converted"
          value={stats.converted}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Lost"
          value={stats.lost}
          icon={AlertCircle}
          color="rose"
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => setDueTodayOnly((prev) => !prev)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDueTodayOnly((prev) => !prev); }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
            dueTodayOnly
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 shadow-md'
              : stats.follow_ups_due_today > 0
                ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Due Today</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-900">{stats.follow_ups_due_today}</p>
          <p className="mt-0.5 text-[10px] text-rose-600 font-medium">
            {dueTodayOnly ? 'Active Filter (Click to clear)' : 'Click to filter'}
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search with Debouncing */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads by name or remarks..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            {/* Filter by Assignee */}
            <div className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[160px] truncate"
              >
                <option value="all">All Assignees</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Date From */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                title="Lead Date From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span>to</span>
              <input
                type="date"
                title="Lead Date To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Clear filters button */}
            {(searchInput || statusFilter !== 'all' || employeeFilter !== 'all' || dateFrom || dateTo || dueTodayOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setStatusFilter('all');
                  setEmployeeFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setDueTodayOnly(false);
                  setCurrentPage(1);
                }}
                className="text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1 rounded hover:bg-teal-50 transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Leads Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Lead Details</th>
                <th className="px-4 py-3">Lead Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Employees</th>
                <th className="px-4 py-3">Follow-up</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-teal-600 mb-2" />
                    Loading leads data...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <TrendingUp className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No leads found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try adjusting your search criteria or click "Add Lead" to register a new lead.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const statusConf = STATUS_CONFIG[lead.status] || STATUS_CONFIG.New;
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                      {/* Lead Details */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{lead.lead_name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>ID: #{lead.id}</span>
                          {lead.creator_name && (
                            <>
                              <span>•</span>
                              <span>Created by {lead.creator_name}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Lead Date */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                          <span>{lead.lead_date}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusConf.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />
                          {lead.status}
                        </span>
                      </td>

                      {/* Assigned Employees */}
                      <td className="px-4 py-3.5">
                        {(!lead.assigned_employees || lead.assigned_employees.length === 0) ? (
                          <span className="text-slate-400 italic">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {lead.assigned_employees.map((emp) => (
                              <span
                                key={emp.id}
                                title={`${emp.name} (${emp.designation || 'Staff'})`}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800 shadow-2xs"
                              >
                                <span className="h-4 w-4 rounded-full bg-teal-100 text-teal-800 font-bold text-[9px] flex items-center justify-center">
                                  {emp.first_name?.[0]}
                                </span>
                                {emp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Follow-up info */}
                      <td className="px-4 py-3.5">
                        {lead.follow_up_required ? (
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                lead.is_follow_up_due
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {lead.is_follow_up_due ? 'Due Today' : 'Scheduled'}
                            </span>
                            <div className="text-[11px] font-medium text-slate-700">
                              {lead.follow_up_date || 'No date set'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None required</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="px-4 py-3.5 max-w-xs truncate" title={lead.remarks || ''}>
                        <span className="text-slate-600 text-[11px]">
                          {lead.remarks || <span className="text-slate-300 italic">No notes</span>}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Progress / History update button (both HR & Employee) */}
                          <button
                            type="button"
                            onClick={() => handleOpenProgressModal(lead)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition shadow-2xs"
                            title="Update progress, follow-up or add notes"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {isEmployee ? 'Update' : 'Progress'}
                          </button>

                          {/* Edit Lead */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(lead)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                            title="Edit Lead"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* HR only: Delete */}
                          {isHr && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(lead)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                              title="Delete Lead"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalLeads > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 px-4 py-3 gap-3 bg-slate-50/60">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                Showing <strong className="font-semibold text-slate-800">{pageStart + 1}</strong>–<strong className="font-semibold text-slate-800">{Math.min(pageStart + pageSize, totalLeads)}</strong> of <strong className="font-semibold text-slate-800">{totalLeads}</strong> leads
              </span>
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-xs text-slate-500 mr-2">
                Page <strong className="font-semibold text-slate-800">{activePage}</strong> of <strong className="font-semibold text-slate-800">{totalPages}</strong>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* ADD LEAD MODAL (HR ONLY) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Lead"
        subtitle="Create a new lead and assign it to employees for follow-up and management."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          {formErrors.general && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {formErrors.general}
            </div>
          )}

          {/* 1. Lead Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Lead Name / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp Enterprise Solution or Rohan Gupta"
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                formErrors.lead_name ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white'
              }`}
            />
            {formErrors.lead_name && (
              <p className="mt-1 text-[11px] text-rose-600">{formErrors.lead_name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 2. Lead Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Lead Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.lead_date}
                onChange={(e) => setFormData({ ...formData, lead_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {formErrors.lead_date && (
                <p className="mt-1 text-[11px] text-rose-600">{formErrors.lead_date}</p>
              )}
            </div>

            {/* 3. Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>

          {/* 4. Assign Employee (Multi-select) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Assign Employee(s) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {formData.assigned_employee_ids.length} selected
              </span>
            </div>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 divide-y divide-slate-100">
              {availableEmployees.length === 0 ? (
                <p className="text-center py-4 text-xs text-slate-400">Loading active employees...</p>
              ) : (
                availableEmployees.map((emp) => {
                  const isChecked = formData.assigned_employee_ids.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployeeAssignment(emp.id)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</span>
                        <span className="text-slate-400 ml-1.5 font-mono text-[10px]">({emp.employee_code})</span>
                        <span className="text-slate-500 ml-2 text-[11px]">· {emp.designation || 'Staff'}</span>
                      </div>
                      {Boolean(emp.has_lead_access) && (
                        <span className="text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
                          Lead Permitted
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {formErrors.assigned_employee_ids && (
              <p className="mt-1 text-[11px] text-rose-600">{formErrors.assigned_employee_ids}</p>
            )}
          </div>

          {/* 5. Follow-up Required & 6. Follow-up Date */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.follow_up_required}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    follow_up_required: checked,
                    follow_up_date: checked ? (prev.follow_up_date || new Date().toISOString().split('T')[0]) : '',
                  }));
                }}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <span className="text-xs font-bold text-slate-800">Follow-up Required</span>
            </label>

            <div className="pt-2 border-t border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Next Follow-up Date {formData.follow_up_required && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="date"
                disabled={!formData.follow_up_required}
                required={formData.follow_up_required}
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  !formData.follow_up_required
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : formErrors.follow_up_date
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-slate-300 bg-white'
                }`}
              />
              {!formData.follow_up_required ? (
                <p className="mt-1 text-[11px] text-slate-400">Select "Follow-up Required" above to enable this date field.</p>
              ) : formErrors.follow_up_date ? (
                <p className="mt-1 text-[11px] text-rose-600">{formErrors.follow_up_date}</p>
              ) : null}
            </div>
          </div>

          {/* 7. Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Remarks / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Add optional notes, requirements, or client preferences..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Lead...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT LEAD MODAL (HR ONLY) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Lead"
        subtitle={`Updating details for ${selectedLead?.lead_name || ''}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdateLead} className="space-y-4">
          {formErrors.general && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {formErrors.general}
            </div>
          )}

          {/* Lead Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Lead Name / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lead Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Lead Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.lead_date}
                onChange={(e) => setFormData({ ...formData, lead_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>

          {/* Assign Employee (Multi-select) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Assign Employee(s) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {formData.assigned_employee_ids.length} selected
              </span>
            </div>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 divide-y divide-slate-100">
              {availableEmployees.map((emp) => {
                const isChecked = formData.assigned_employee_ids.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEmployeeAssignment(emp.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</span>
                      <span className="text-slate-400 ml-1.5 font-mono text-[10px]">({emp.employee_code})</span>
                      <span className="text-slate-500 ml-2 text-[11px]">· {emp.designation || 'Staff'}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Follow-up Required & Follow-up Date */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.follow_up_required}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    follow_up_required: checked,
                    follow_up_date: checked ? (prev.follow_up_date || new Date().toISOString().split('T')[0]) : '',
                  }));
                }}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <span className="text-xs font-bold text-slate-800">Follow-up Required</span>
            </label>

            <div className="pt-2 border-t border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Next Follow-up Date {formData.follow_up_required && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="date"
                disabled={!formData.follow_up_required}
                required={formData.follow_up_required}
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  !formData.follow_up_required
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'border-slate-300 bg-white'
                }`}
              />
              {!formData.follow_up_required && (
                <p className="mt-1 text-[11px] text-slate-400">Select "Follow-up Required" above to enable this date field.</p>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Remarks / Notes
            </label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE LEAD MODAL (HR ONLY) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Lead Deletion"
        subtitle="This action is permanent and will delete all associated activity history."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-4 text-xs text-rose-900">
            <p className="font-semibold text-rose-800">
              Are you sure you want to delete lead <strong className="font-bold underline">{selectedLead?.lead_name}</strong>?
            </p>
            <p className="mt-1 text-rose-700">
              All employee assignments and logged follow-up activities for this lead will be removed permanently.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={handleDeleteLead}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* PROGRESS & FOLLOW-UP UPDATE MODAL (HR & ASSIGNED EMPLOYEES) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title="Lead Progress & Follow-up"
        subtitle={`Managing progress for ${selectedLead?.lead_name || ''}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdateProgress} className="space-y-4">
          {/* Lead Summary Overview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Name</span>
              <span className="font-bold text-slate-900">{selectedLead?.lead_name}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Date</span>
              <span className="font-semibold text-slate-800">{selectedLead?.lead_date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
              <span className="font-bold text-teal-700">{selectedLead?.status}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Follow-up</span>
              <span className="font-semibold text-slate-800">
                {selectedLead?.follow_up_required ? selectedLead.follow_up_date || 'Due' : 'None'}
              </span>
            </div>
          </div>

          {/* Update Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Update Lead Status
            </label>
            <select
              value={progressData.status}
              onChange={(e) => setProgressData({ ...progressData, status: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="New">New</option>
              <option value="In Progress">In Progress</option>
              <option value="Converted">Converted</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {/* Follow-up Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">Follow-up Management</span>
              {selectedLead?.follow_up_required && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-emerald-700">
                  <input
                    type="checkbox"
                    checked={progressData.mark_follow_up_completed}
                    onChange={(e) => setProgressData({
                      ...progressData,
                      mark_follow_up_completed: e.target.checked,
                    })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  Mark current follow-up as completed
                </label>
              )}
            </div>

            {!progressData.mark_follow_up_completed && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={progressData.follow_up_required}
                    onChange={(e) => setProgressData({
                      ...progressData,
                      follow_up_required: e.target.checked,
                      follow_up_date: e.target.checked ? (progressData.follow_up_date || new Date().toISOString().split('T')[0]) : '',
                    })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <span className="text-xs font-medium text-slate-700">Schedule next follow-up date</span>
                </label>

                {progressData.follow_up_required && (
                  <div>
                    <input
                      type="date"
                      value={progressData.follow_up_date}
                      onChange={(e) => setProgressData({ ...progressData, follow_up_date: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Lead Remarks / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Update general notes or lead details..."
              value={progressData.remarks}
              onChange={(e) => setProgressData({ ...progressData, remarks: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Progress Note / Activity Entry */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Add Progress Note / Activity Entry
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Discussed pricing proposals via call. Client requested demo next Tuesday."
              value={progressData.progress_note}
              onChange={(e) => setProgressData({ ...progressData, progress_note: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Activity Timeline History */}
          {selectedLead?.activities && selectedLead.activities.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Activity Timeline ({selectedLead.activities.length})
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {selectedLead.activities.map((act) => (
                  <div key={act.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="font-semibold text-slate-800">{act.user_name || 'System'}</span>
                      <span>{new Date(act.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 font-medium">{act.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsProgressModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving Progress...' : 'Save Progress'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Employee Lead Access Control Modal */}
      <Modal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        title="Lead Management Access Control"
        subtitle="Enable or disable lead management access for employees. When enabled, the employee can view and manage their assigned leads."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee by name, code or department..."
              value={accessSearch}
              onChange={(e) => setAccessSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
            {availableEmployees
              .filter((emp) => {
                if (!accessSearch.trim()) return true;
                const q = accessSearch.toLowerCase();
                const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                const code = (emp.employee_code || '').toLowerCase();
                const dept = (emp.department || '').toLowerCase();
                return name.includes(q) || code.includes(q) || dept.includes(q);
              })
              .map((emp) => {
                const isEnabled = Boolean(emp.has_lead_access);
                const isUpdating = updatingAccessEmpId === emp.id;
                return (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-xs">
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">
                            {emp.first_name} {emp.last_name}
                          </p>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                            {emp.employee_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {emp.designation || 'Staff'} • {emp.department}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold ${isEnabled ? 'text-teal-700' : 'text-slate-400'}`}>
                        {isEnabled ? 'Access Granted' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        disabled={isUpdating}
                        onClick={() => handleToggleEmployeeAccess(emp.id, isEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 disabled:opacity-50 ${
                          isEnabled ? 'bg-teal-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAccessModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
