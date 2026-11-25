import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import {
  Handshake,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  DollarSign,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock4,
  Edit2,
  Trash2,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Sparkles,
  History,
  Receipt,
  Tag,
} from 'lucide-react';

const PROJECT_STATUS_CONFIG = {
  Upcoming: { variant: 'info', bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  'In Progress': { variant: 'warning', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Completed: { variant: 'success', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'On Hold': { variant: 'secondary', bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
};

const PAYMENT_STATUS_CONFIG = {
  Paid: { variant: 'success', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  'Partially Paid': { variant: 'warning', bg: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-600' },
  Unpaid: { variant: 'danger', bg: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600' },
};

const PAYMENT_METHODS = [
  'Bank Transfer (NEFT/RTGS/IMPS)',
  'UPI (GPay / PhonePe / Paytm)',
  'Cash',
  'Cheque',
  'Credit / Debit Card',
  'Other / Wire Transfer',
];

export default function ClientManagementView() {
  const { currentUser } = useAuth();
  const isHrOrAdmin = ['super_admin', 'hr_admin'].includes(currentUser?.role);

  // Clients state & stats
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    total_clients: 0,
    total_deal_value: 0,
    total_received: 0,
    total_pending: 0,
    active_projects: 0,
    upcoming_projects: 0,
    completed_projects: 0,
    fully_paid: 0,
    partially_paid: 0,
    unpaid: 0,
    overdue_deadlines: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Filters state with debouncing
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Add / Edit Form state
  const initialFormState = {
    client_name: '',
    phone: '',
    email: '',
    project_name: '',
    service_type: '',
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    total_amount: '',
    paid_amount: '0',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer (NEFT/RTGS/IMPS)',
    project_status: 'In Progress',
    remarks: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Record Payment state (Date-wise installment)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI (GPay / PhonePe / Paytm)');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load clients from API
  const fetchClients = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (projectStatusFilter !== 'all') params.project_status = projectStatusFilter;
      if (paymentStatusFilter !== 'all') params.payment_status = paymentStatusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (overdueOnly) params.overdue_only = 1;

      const response = await api.getClients(params);
      setClients(response?.data || []);
      if (response?.meta?.stats) {
        setStats(response.meta.stats);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError(err?.data?.message || err.message || 'Failed to fetch clients.');
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch when filters or search change
  useEffect(() => {
    setCurrentPage(1);
    fetchClients();
  }, [debouncedSearch, projectStatusFilter, paymentStatusFilter, dateFrom, dateTo, overdueOnly]);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Pagination calculation
  const totalClients = clients.length;
  const totalPages = Math.max(1, Math.ceil(totalClients / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedClients = useMemo(() => {
    return clients.slice(pageStart, pageStart + pageSize);
  }, [clients, pageStart, pageSize]);

  // Live remaining amount in form
  const computedRemaining = useMemo(() => {
    const total = parseFloat(formData.total_amount) || 0;
    const paid = parseFloat(formData.paid_amount) || 0;
    return Math.max(0, total - paid);
  }, [formData.total_amount, formData.paid_amount]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (client) => {
    setSelectedClient(client);
    setFormData({
      client_name: client.client_name || '',
      phone: client.phone || '',
      email: client.email || '',
      project_name: client.project_name || '',
      service_type: client.service_type || '',
      start_date: client.start_date || '',
      deadline: client.deadline || '',
      total_amount: client.total_amount !== undefined ? String(client.total_amount) : '',
      paid_amount: client.paid_amount !== undefined ? String(client.paid_amount) : '0',
      payment_date: client.start_date || new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer (NEFT/RTGS/IMPS)',
      project_status: client.project_status || 'In Progress',
      remarks: client.remarks || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Open Details Modal (with date-wise history)
  const handleOpenDetails = async (client) => {
    setSelectedClient(client);
    setIsDetailsModalOpen(true);
    // Fetch latest client details to guarantee full date-wise payments ledger
    try {
      const res = await api.getClient(client.id);
      if (res?.data) {
        setSelectedClient(res.data);
      }
    } catch {
      // Keep existing client state if single fetch fails
    }
  };

  // Open Record Payment Modal
  const handleOpenPayment = (client) => {
    setSelectedClient(client);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('UPI (GPay / PhonePe / Paytm)');
    setTransactionReference('');
    setPaymentNote('');
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (client) => {
    setSelectedClient(client);
    setIsDeleteModalOpen(true);
  };

  // Validate Add/Edit form
  const validateForm = () => {
    const errors = {};
    if (!formData.client_name.trim()) errors.client_name = 'Customer / Client name is required.';
    if (!formData.phone.trim()) errors.phone = 'Mobile number is required.';
    if (!formData.project_name.trim()) errors.project_name = 'Project name is required.';
    const total = parseFloat(formData.total_amount);
    if (isNaN(total) || total < 0) errors.total_amount = 'Valid total deal amount is required.';
    const paid = parseFloat(formData.paid_amount);
    if (isNaN(paid) || paid < 0) errors.paid_amount = 'Paid amount cannot be negative.';
    if (paid > total) errors.paid_amount = 'Paid amount cannot exceed total deal amount.';
    if (formData.start_date && formData.deadline && formData.deadline < formData.start_date) {
      errors.deadline = 'Deadline cannot be earlier than start date.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add Client
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
        paid_amount: parseFloat(formData.paid_amount) || 0,
      };
      await api.createClient(payload);
      setIsAddModalOpen(false);
      showToast('Client deal registered successfully!');
      fetchClients();
    } catch (err) {
      console.error('Failed to create client:', err);
      const backendErrors = err?.data?.errors;
      if (backendErrors) {
        setFormErrors(Object.fromEntries(Object.entries(backendErrors).map(([k, v]) => [k, v[0]])));
      } else {
        setFormErrors({ submit: err?.data?.message || err.message || 'Failed to register client.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Client
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
        paid_amount: parseFloat(formData.paid_amount) || 0,
      };
      await api.updateClient(selectedClient.id, payload);
      setIsEditModalOpen(false);
      showToast('Client details updated successfully!');
      fetchClients();
    } catch (err) {
      console.error('Failed to update client:', err);
      const backendErrors = err?.data?.errors;
      if (backendErrors) {
        setFormErrors(Object.fromEntries(Object.entries(backendErrors).map(([k, v]) => [k, v[0]])));
      } else {
        setFormErrors({ submit: err?.data?.message || err.message || 'Failed to update client.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Record Payment (with specific Date & Method)
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Enter a valid payment amount greater than ₹0.');
      return;
    }
    const remaining = parseFloat(selectedClient.remaining_amount) || 0;
    if (amt > remaining) {
      setPaymentError(`Amount exceeds remaining balance. Max allowed: ₹${remaining.toLocaleString('en-IN')}`);
      return;
    }
    if (!paymentDate) {
      setPaymentError('Please select the date on which payment was received.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await api.recordClientPayment(selectedClient.id, {
        payment_amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        transaction_reference: transactionReference.trim(),
        payment_note: paymentNote.trim(),
      });
      setIsPaymentModalOpen(false);
      showToast(`Payment of ₹${amt.toLocaleString('en-IN')} on ${formatDate(paymentDate)} recorded successfully!`);
      fetchClients();
    } catch (err) {
      console.error('Failed to record payment:', err);
      setPaymentError(err?.data?.message || err.message || 'Failed to record payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Submit Delete Client
  const handleDeleteSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.deleteClient(selectedClient.id);
      setIsDeleteModalOpen(false);
      showToast('Client record deleted successfully.');
      fetchClients();
    } catch (err) {
      console.error('Failed to delete client:', err);
      showToast(err?.data?.message || err.message || 'Failed to delete client.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if deadline is overdue
  const isOverdue = (deadline, projectStatus) => {
    if (!deadline || projectStatus === 'Completed') return false;
    const today = new Date().toISOString().split('T')[0];
    return deadline < today;
  };

  // Format currency in Indian Rupees
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl transition-all duration-300 ${
            toastMessage.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toastMessage.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25">
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Client & Project Deals
              </h1>
              <p className="text-xs text-slate-500">
                Customer records, project deadlines, date-wise payment installments, and real-time ledger.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchClients}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isHrOrAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-emerald-700/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Client</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Total Clients"
          value={stats.total_clients}
          icon={Handshake}
          color="teal"
          trend="Registered Accounts"
        />
        <StatCard
          title="Active Projects"
          value={stats.active_projects}
          icon={Briefcase}
          color="blue"
          trend="In Progress"
        />
        <StatCard
          title="Total Deal Value"
          value={formatCurrency(stats.total_deal_value)}
          icon={DollarSign}
          color="indigo"
          trend="Total Agreed"
        />
        <StatCard
          title="Payment Received"
          value={formatCurrency(stats.total_received)}
          icon={CreditCard}
          color="emerald"
          trend={`${stats.fully_paid} Fully Paid`}
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(stats.total_pending)}
          icon={AlertCircle}
          color="rose"
          trend={`${stats.partially_paid + stats.unpaid} Pending`}
        />
        <StatCard
          title="Overdue Deadlines"
          value={stats.overdue_deadlines}
          icon={Clock4}
          color="amber"
          trend="Needs Attention"
        />
      </div>

      {/* Main Table Card with Filters */}
      <Card className="overflow-hidden border border-slate-200/80 shadow-sm">
        {/* Filters Bar */}
        <div className="border-b border-slate-200 bg-slate-50/75 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search client, mobile, project, service..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 transition shadow-sm"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 shadow-sm cursor-pointer"
              >
                <option value="all">Project: All Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>

              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 shadow-sm cursor-pointer"
              >
                <option value="all">Payment: All Status</option>
                <option value="Paid">Fully Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              <button
                type="button"
                onClick={() => setOverdueOnly(!overdueOnly)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-sm ${
                  overdueOnly
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className={`h-3.5 w-3.5 ${overdueOnly ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Overdue Only</span>
              </button>

              {(searchInput || projectStatusFilter !== 'all' || paymentStatusFilter !== 'all' || overdueOnly) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setProjectStatusFilter('all');
                    setPaymentStatusFilter('all');
                    setOverdueOnly(false);
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3.5">Customer / Client</th>
                <th className="px-4 py-3.5">Project & Scope</th>
                <th className="px-4 py-3.5">Timeline & Deadline</th>
                <th className="px-4 py-3.5">Financials & Installments</th>
                <th className="px-4 py-3.5 text-center">Payment Status</th>
                <th className="px-4 py-3.5 text-center">Project Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-teal-600" />
                    <p className="mt-2 text-xs font-medium">Loading client accounts...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-rose-500">
                    <AlertCircle className="mx-auto h-7 w-7 text-rose-400" />
                    <p className="mt-2 text-xs font-semibold">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchClients} className="mt-3">
                      Try Again
                    </Button>
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <Handshake className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">No client deals found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {searchInput || projectStatusFilter !== 'all' || paymentStatusFilter !== 'all'
                        ? 'Try adjusting your search query or filters.'
                        : 'Register your first client project deal by clicking "+ Add New Client".'}
                    </p>
                    {isHrOrAdmin && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleOpenAdd}
                        className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add New Client
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const total = parseFloat(client.total_amount) || 0;
                  const paid = parseFloat(client.paid_amount) || 0;
                  const remaining = parseFloat(client.remaining_amount) || 0;
                  const percentPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
                  const overdue = isOverdue(client.deadline, client.project_status);
                  const paymentsCount = client.payments?.length || 0;
                  const latestPayment = client.payments?.[0];

                  const paymentConfig = PAYMENT_STATUS_CONFIG[client.payment_status] || PAYMENT_STATUS_CONFIG.Unpaid;
                  const projectConfig = PROJECT_STATUS_CONFIG[client.project_status] || PROJECT_STATUS_CONFIG['In Progress'];

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Customer / Client Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 font-bold text-white shadow-sm text-xs">
                            {client.client_name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate text-xs hover:text-teal-700 cursor-pointer" onClick={() => handleOpenDetails(client)}>
                              {client.client_name}
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              <a href={`tel:${client.phone}`} className="hover:underline text-teal-700 font-medium">
                                {client.phone}
                              </a>
                            </p>
                            {client.email && (
                              <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate mt-0.5">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{client.email}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project & Scope */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                            {client.project_name}
                          </p>
                          {client.service_type ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200">
                              <Sparkles className="h-2.5 w-2.5 text-teal-600" />
                              {client.service_type}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Custom Scope</span>
                          )}
                        </div>
                      </td>

                      {/* Timeline & Deadline */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <p className="flex items-center gap-1 text-[11px] text-slate-600">
                            <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>Start: {formatDate(client.start_date)}</span>
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className={overdue ? 'font-bold text-rose-600' : 'text-slate-600'}>
                              Due: {formatDate(client.deadline)}
                            </span>
                            {overdue && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-black uppercase text-rose-700 animate-pulse">
                                Overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Financials, Installments & Date breakdown */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1 min-w-[185px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Deal Total:</span>
                            <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-semibold">Paid: {formatCurrency(paid)}</span>
                            <span className={remaining > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                              Due: {formatCurrency(remaining)}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                percentPaid === 100
                                  ? 'bg-emerald-500'
                                  : percentPaid > 0
                                  ? 'bg-amber-500'
                                  : 'bg-rose-400'
                              }`}
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>

                          {/* Date-wise installment badge */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(client)}
                              className="text-teal-700 hover:underline flex items-center gap-1 font-medium"
                            >
                              <History className="h-3 w-3" />
                              <span>{paymentsCount} Installment{paymentsCount === 1 ? '' : 's'}</span>
                            </button>
                            {latestPayment && (
                              <span className="text-slate-400">
                                Last: {formatDate(latestPayment.payment_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Payment Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${paymentConfig.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${paymentConfig.dot}`} />
                          {client.payment_status}
                        </span>
                      </td>

                      {/* Project Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${projectConfig.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${projectConfig.dot}`} />
                          {client.project_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Record Payment Button (Date-wise installment) */}
                          {remaining > 0 && isHrOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(client)}
                              title="Record Date-wise Payment Installment"
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
                            >
                              <CreditCard className="h-4 w-4" />
                            </button>
                          )}

                          {/* View Details / Payment History */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(client)}
                            title="View Deal Ledger & Payment Dates"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          {/* Edit Client */}
                          {isHrOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(client)}
                              title="Edit Deal"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete Client */}
                          {isHrOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(client)}
                              title="Delete Deal"
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Pagination Footer */}
        {totalClients > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 gap-3">
            <p>
              Showing <span className="font-semibold text-slate-800">{pageStart + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(pageStart + pageSize, totalClients)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{totalClients}</span> clients
            </p>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={activePage === 1}
                  className="px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-medium">
                  Page {activePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={activePage === totalPages}
                  className="px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ================= MODAL 1: ADD NEW CLIENT ================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Client Deal"
        size="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formErrors.submit && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formErrors.submit}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer / Client Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer / Client Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar / Acme Corp"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {formErrors.client_name && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.client_name}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {formErrors.phone && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.phone}</p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="e.g. client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. E-Commerce Portal / Brand Campaign"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {formErrors.project_name && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.project_name}</p>
              )}
            </div>

            {/* Service Scope / Category (Free text input without rigid dropdown) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Service Scope / Category (Free Text)
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Digital Marketing, Website Building, Android & iOS App Development, SEO"
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Koi restrictive dropdown nahi hai — aap category direct likh sakte hain (Digital Marketing, Website Building, App Developing, etc.).
              </p>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Deadline
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {formErrors.deadline && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.deadline}</p>
              )}
            </div>

            {/* Total Agreed Payment (Deal Value) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Agreed Deal Value (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Total kitne me baat hui hai (e.g. 150000)"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {formErrors.total_amount && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.total_amount}</p>
              )}
            </div>

            {/* Initial Paid Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial Payment Received (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Kitna payment ho gaya (default: 0)"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-emerald-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>
              {formErrors.paid_amount && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{formErrors.paid_amount}</p>
              )}
            </div>

            {/* If initial payment > 0, show Date & Method fields */}
            {parseFloat(formData.paid_amount) > 0 && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Payment Date
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Mode / Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Live Remaining Balance Due Indicator */}
            <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Remaining Balance Due (Baki Amount):</span>
              <span className={`text-base font-black ${computedRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(computedRemaining)}
              </span>
            </div>

            {/* Project Status */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial Project Status
              </label>
              <select
                value={formData.project_status}
                onChange={(e) => setFormData({ ...formData, project_status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="In Progress">In Progress (Work started)</option>
                <option value="Upcoming">Upcoming (Queued / Advance received)</option>
                <option value="Completed">Completed (Delivered & closed)</option>
                <option value="On Hold">On Hold (Client feedback awaited)</option>
              </select>
            </div>

            {/* Remarks / Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Remarks / Agreement Notes
              </label>
              <textarea
                rows={3}
                placeholder="Client requirements, payment terms, installment dates, or special clauses..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
            >
              {isSubmitting ? 'Registering...' : 'Save Client Deal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 2: EDIT CLIENT ================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Client: ${selectedClient?.client_name || ''}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formErrors.submit && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formErrors.submit}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer / Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {formErrors.client_name && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.client_name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {formErrors.phone && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              {formErrors.project_name && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.project_name}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Service Scope / Category (Free Text)
              </label>
              <input
                type="text"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Agreed Deal Value (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Paid So Far (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.paid_amount}
                onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Calculated Remaining Due:</span>
              <span className={`text-base font-black ${computedRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(computedRemaining)}
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project Status
              </label>
              <select
                value={formData.project_status}
                onChange={(e) => setFormData({ ...formData, project_status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="In Progress">In Progress</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Remarks / Payment History Notes
              </label>
              <textarea
                rows={3}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
            >
              {isSubmitting ? 'Updating...' : 'Update Details'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 3: RECORD DATE-WISE PAYMENT INSTALLMENT ================= */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment for ${selectedClient?.client_name || ''}`}
        size="md"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {paymentError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{paymentError}</span>
            </div>
          )}

          {/* Deal Summary Box */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Project:</span>
              <span className="font-bold text-slate-900">{selectedClient?.project_name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Agreed Deal:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(selectedClient?.total_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Already Paid:</span>
              <span className="font-bold">{formatCurrency(selectedClient?.paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-rose-700 font-bold">
              <span>Remaining Balance Due:</span>
              <span className="text-sm font-black">{formatCurrency(selectedClient?.remaining_amount)}</span>
            </div>
          </div>

          {/* Payment Date Input (User requested: "kis date pe kitni payment di gyi") */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Received Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-600" />
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Kis date pe payment receive hui hai wo date select karein.
            </p>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount Received (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">₹</span>
              <input
                type="number"
                step="0.01"
                required
                autoFocus
                placeholder="Kitna payment mila (e.g. 25000)"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2.5 text-sm font-bold text-emerald-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          {/* Payment Method / Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Method / Transfer Mode
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 cursor-pointer"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Transaction Reference (UTR / Cheque) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transaction Reference / UTR / Cheque # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UTR #123456789 / Cheque #88120"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Payment Note / Milestone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Milestone / Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Milestone 2 design sign-off advance / Final clearance"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmittingPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[130px]"
            >
              {isSubmittingPayment ? 'Saving...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 4: VIEW CLIENT DETAILS & DATE-WISE PAYMENT HISTORY ================= */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Client Deal Ledger & Date-wise Payments"
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-4">
            {/* Top Summary Banner */}
            <div className="flex items-start justify-between rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white font-bold text-lg shadow-md">
                  {selectedClient.client_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedClient.client_name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-teal-600" />
                    <span>{selectedClient.phone}</span>
                    {selectedClient.email && (
                      <>
                        <span className="text-slate-300">•</span>
                        <Mail className="h-3.5 w-3.5 text-teal-600" />
                        <span>{selectedClient.email}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                  PAYMENT_STATUS_CONFIG[selectedClient.payment_status]?.bg || 'bg-slate-100'
                }`}>
                  {selectedClient.payment_status}
                </span>
              </div>
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Name</span>
                <p className="text-sm font-bold text-slate-800">{selectedClient.project_name}</p>
                {selectedClient.service_type && (
                  <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200">
                    <Sparkles className="h-2.5 w-2.5 text-teal-600" />
                    {selectedClient.service_type}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedule</span>
                <p className="text-slate-700">Start Date: <span className="font-semibold">{formatDate(selectedClient.start_date)}</span></p>
                <p className="text-slate-700">
                  Deadline: <span className="font-semibold">{formatDate(selectedClient.deadline)}</span>
                  {isOverdue(selectedClient.deadline, selectedClient.project_status) && (
                    <span className="ml-2 rounded bg-rose-100 px-1 text-[10px] font-black text-rose-700">Overdue</span>
                  )}
                </p>
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Financial Overview
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-medium text-slate-500">Agreed Deal Value</span>
                  <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(selectedClient.total_amount)}</p>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-medium text-emerald-600">Payment Received</span>
                  <p className="text-base font-black text-emerald-700 mt-1">{formatCurrency(selectedClient.paid_amount)}</p>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-medium text-rose-600">Remaining Due</span>
                  <p className="text-base font-black text-rose-700 mt-1">{formatCurrency(selectedClient.remaining_amount)}</p>
                </div>
              </div>
            </div>

            {/* Date-wise Payment Installments Table (User Requested) */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Date-wise Payment History ({selectedClient.payments?.length || 0} Installments)
                  </span>
                </div>
                {parseFloat(selectedClient.remaining_amount) > 0 && isHrOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenPayment(selectedClient);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Record Installment
                  </button>
                )}
              </div>

              {(!selectedClient.payments || selectedClient.payments.length === 0) ? (
                <div className="p-6 text-center text-slate-400">
                  <CreditCard className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-1.5 text-xs font-medium text-slate-600">No payment installments recorded yet</p>
                  <p className="text-[10px] text-slate-400">When client makes a payment, use "Record Payment" to log the date and amount.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3.5 py-2">Payment Date</th>
                        <th className="px-3.5 py-2">Amount Paid</th>
                        <th className="px-3.5 py-2">Payment Mode</th>
                        <th className="px-3.5 py-2">Reference / Notes</th>
                        <th className="px-3.5 py-2 text-right">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClient.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-3.5 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-teal-600 shrink-0" />
                              {formatDate(p.payment_date)}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-black text-emerald-700 whitespace-nowrap">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                              {p.payment_method || 'Bank Transfer'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {p.transaction_reference && (
                              <span className="font-mono text-[10px] text-slate-800 font-semibold block">
                                Ref: {p.transaction_reference}
                              </span>
                            )}
                            {p.notes && <span className="text-[11px] text-slate-500">{p.notes}</span>}
                            {!p.transaction_reference && !p.notes && <span className="text-slate-400 italic">—</span>}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-[11px] text-slate-500 whitespace-nowrap">
                            {p.recorded_by_name || 'Admin'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Remarks / Historical Notes */}
            {selectedClient.remarks && (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Agreement Notes</span>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {selectedClient.remarks}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-400">
              <span>Created by: {selectedClient.creator_name || 'Admin'}</span>
              <Button variant="outline" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL 5: DELETE CLIENT ================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Client Deal"
        size="sm"
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Are you sure you want to delete this client deal?</p>
              <p className="mt-1 text-[11px] text-rose-700">
                Client: <span className="font-semibold">{selectedClient?.client_name}</span>
                <br />
                Project: <span className="font-semibold">{selectedClient?.project_name}</span>
              </p>
              <p className="mt-1.5 text-[10px] text-rose-600">
                This will delete the client profile and all associated date-wise payment installment records.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSubmit}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white min-w-[90px]"
            >
              {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
