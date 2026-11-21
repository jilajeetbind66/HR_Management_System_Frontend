import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import {
  Banknote,
  FileText,
  Lock,
  ShieldCheck,
  Plus,
  Receipt,
  Building2,
  CreditCard,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Filter
} from 'lucide-react';

const PAYROLL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const componentRuleLabel = (component) => {
  if (component.calculation_type === 'employee_value') return 'Employee-specific stored amount';
  if (component.calculation_type === 'residual') return 'Balances the remaining gross salary';
  if (component.calculation_type === 'percent_basic') return `${Number(component.value)}% of Basic`;
  if (component.calculation_type === 'percent_gross') return `${Number(component.value)}% of Gross`;
  return `Fixed ₹${Number(component.value).toLocaleString('en-IN')} per month`;
};

const statutoryErrorMessage = (error) => Object.values(error?.data?.errors || {}).flat()[0]
  || error?.data?.message
  || error.message
  || 'Unable to save statutory payroll settings.';

const needsOverrideReason = (amount, computedAmount) => (
  computedAmount == null || Math.abs(Number(amount || 0) - Number(computedAmount)) >= 0.01
);

export default function PayrollView() {
  const { currentUser, activeBranch } = useAuth();
  const {
    payrollRuns,
    runPayroll,
    refreshPayrollRuns,
    refreshBranches,
    branches
  } = useHRMS();

  const isBranchScoped = Boolean(activeBranch && activeBranch !== 'All Branches');
  const isSuperAdmin = currentUser.role === 'super_admin';
  const [activeTab, setActiveTab] = useState(currentUser.role === 'hr_admin' ? 'structures' : 'runs');
  const [selectedRun, setSelectedRun] = useState(null);
  const [runPayslips, setRunPayslips] = useState([]);
  const [deductionDrafts, setDeductionDrafts] = useState({});
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [savingPayslipId, setSavingPayslipId] = useState(null);
  const [payslipError, setPayslipError] = useState('');

  // Super Admin Individual Payout & Custom Salary / Penalties states
  const [payingPayslip, setPayingPayslip] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_status: 'paid',
    payment_mode: 'Bank Transfer',
    payment_reference: '',
    paid_at: new Date().toISOString().slice(0, 10),
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [adjustingPayslipId, setAdjustingPayslipId] = useState(null);
  const [adjustmentDrafts, setAdjustmentDrafts] = useState({});
  const [savingAdjustmentId, setSavingAdjustmentId] = useState(null);

  // Table Search, Filter & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showRunWizard, setShowRunWizard] = useState(false);
  const [wizardMonth, setWizardMonth] = useState('January');
  const [wizardYear, setWizardYear] = useState(new Date().getFullYear());
  const [wizardScope, setWizardScope] = useState('company');
  const [workflowError, setWorkflowError] = useState('');
  const [salaryDataIssues, setSalaryDataIssues] = useState([]);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [components, setComponents] = useState([]);
  const [salaryConfiguration, setSalaryConfiguration] = useState(null);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [componentRefresh, setComponentRefresh] = useState(0);
  const [componentError, setComponentError] = useState('');
  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [componentForm, setComponentForm] = useState({
    name: '',
    component_group: 'earning',
    calculation_type: 'fixed',
    value: '0',
    metro_value: '',
    is_enabled: true,
  });
  const [statutoryData, setStatutoryData] = useState(null);
  const [taxDeclarations, setTaxDeclarations] = useState([]);
  const [declarationFinancialYear, setDeclarationFinancialYear] = useState('');
  const [selectedTaxEmployeeId, setSelectedTaxEmployeeId] = useState('');
  const [statutoryLoading, setStatutoryLoading] = useState(false);
  const [statutorySaving, setStatutorySaving] = useState(false);
  const [statutoryError, setStatutoryError] = useState('');
  const [contributionForm, setContributionForm] = useState({
    effective_from: new Date().toISOString().slice(0, 10),
    pf_employee_rate: '12',
    pf_employer_rate: '12',
    eps_rate: '8.33',
    pf_wage_ceiling: '15000',
    apply_pf_wage_ceiling: true,
    esi_employee_rate: '0.75',
    esi_employer_rate: '3.25',
    esi_gross_limit: '21000',
  });
  const [ptRuleForm, setPtRuleForm] = useState({
    state: 'Uttar Pradesh',
    is_applicable: false,
    effective_from: new Date().toISOString().slice(0, 10),
    slabs: [{ salary_from: '0', salary_to: '', monthly_tax: '0' }],
  });
  const [incomeTaxForm, setIncomeTaxForm] = useState({
    tax_regime: 'New',
    effective_from: new Date().toISOString().slice(0, 10),
    slabs: [{ income_from: '0', income_to: '', tax_rate: '0' }],
  });
  const [declarationForm, setDeclarationForm] = useState({
    financial_year: '',
    tax_regime: 'New',
    other_annual_income: '0',
    previous_employer_income: '0',
    previous_employer_tds: '0',
    annual_deductions: {
      section_80c: '0',
      section_80d: '0',
      section_80ccd_1b: '0',
      hra_exemption: '0',
      home_loan_interest: '0',
      other_deductions: '0',
    },
  });

  const canManagePayroll = ['super_admin', 'payroll_admin'].includes(currentUser.role);
  const canViewPayrollRuns = ['super_admin', 'payroll_admin', 'auditor'].includes(currentUser.role);
  const canViewComponents = ['super_admin', 'hr_admin', 'payroll_admin'].includes(currentUser.role);
  const canManageComponents = ['super_admin', 'hr_admin'].includes(currentUser.role);

  useEffect(() => {
    if (activeTab !== 'structures' || !canViewComponents) return undefined;
    let active = true;
    setComponentsLoading(true);
    setComponentError('');
    api.getPayrollComponents()
      .then((response) => {
        if (active) {
          setComponents(Array.isArray(response?.data) ? response.data : []);
          setSalaryConfiguration(response?.meta?.salary_configuration || null);
        }
      })
      .catch((error) => {
        if (active) setComponentError(error?.data?.message || error.message || 'Unable to load payroll components.');
      })
      .finally(() => {
        if (active) setComponentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, canViewComponents, componentRefresh]);

  useEffect(() => {
    if (activeTab !== 'statutory' || !canViewComponents) return undefined;
    let active = true;
    setStatutoryLoading(true);
    setStatutoryError('');
    Promise.all([api.getPayrollStatutoryConfig(), api.getPayrollTaxDeclarations()])
      .then(([configResponse, declarationResponse]) => {
        if (!active) return;
        const config = configResponse?.data || null;
        const declarations = Array.isArray(declarationResponse?.data) ? declarationResponse.data : [];
        setStatutoryData(config);
        setTaxDeclarations(declarations);
        setSelectedTaxEmployeeId(current => current || String(declarations[0]?.employee_id || ''));
        setDeclarationFinancialYear(declarationResponse?.meta?.financial_year || '');
      })
      .catch((error) => {
        if (active) setStatutoryError(statutoryErrorMessage(error));
      })
      .finally(() => {
        if (active) setStatutoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, canViewComponents, componentRefresh]);

  useEffect(() => {
    const employee = taxDeclarations.find(item => String(item.employee_id) === String(selectedTaxEmployeeId));
    if (!employee) {
      setDeclarationForm(form => ({ ...form, financial_year: declarationFinancialYear }));
      return;
    }
    setDeclarationForm({
      financial_year: employee.financial_year || declarationFinancialYear,
      tax_regime: employee.declaration_regime || employee.tax_regime || 'New',
      other_annual_income: String(employee.other_annual_income || 0),
      previous_employer_income: String(employee.previous_employer_income || 0),
      previous_employer_tds: String(employee.previous_employer_tds || 0),
      annual_deductions: Object.fromEntries(
        Object.keys(declarationForm.annual_deductions).map(key => [
          key,
          String(employee.annual_deductions?.[key] || 0),
        ])
      ),
    });
  }, [selectedTaxEmployeeId, taxDeclarations, declarationFinancialYear]);

  const handleStartPayroll = async (e) => {
    e.preventDefault();
    setWorkflowError('');
    setSalaryDataIssues([]);
    setSavingPayroll(true);
    try {
      await runPayroll(wizardMonth, wizardYear, wizardScope);
      setShowRunWizard(false);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to save the payroll run.');
      setSalaryDataIssues(Array.isArray(error?.data?.invalid_employees) ? error.data.invalid_employees : []);
    } finally {
      setSavingPayroll(false);
    }
  };

  const handleVerifyRun = async (runId) => {
    setPayslipError('');
    try {
      const response = await api.verifyPayrollRun(runId);
      if (response?.data) {
        setSelectedRun(response.data);
      } else {
        setSelectedRun(current => ({ ...current, status: 'verified' }));
      }
      try {
        await refreshPayrollRuns();
      } catch {
        setPayslipError('The payroll run was verified, but the run list could not refresh. Reload the page to confirm its status.');
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to verify the payroll run.');
    }
  };

  const handlePublishRun = async (runId) => {
    setPayslipError('');
    try {
      await api.publishPayrollRun(runId);
      setSelectedRun(null);
      try {
        await refreshPayrollRuns();
      } catch {
        setWorkflowError('The payroll run was published, but the run list could not refresh. Reload the page to confirm its status.');
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to publish the payroll run.');
    }
  };

  const openComponentEditor = (component = null) => {
    setEditingComponent(component);
    setComponentForm(component ? {
      name: component.name,
      component_group: component.component_group,
      calculation_type: component.calculation_type,
      value: String(component.value ?? 0),
      metro_value: component.metro_value == null ? '' : String(component.metro_value),
      is_enabled: Boolean(component.is_enabled),
    } : {
      name: '',
      component_group: 'earning',
      calculation_type: 'fixed',
      value: '0',
      metro_value: '',
      is_enabled: true,
    });
    setComponentError('');
    setComponentModalOpen(true);
  };

  const handleSaveComponent = async (event) => {
    event.preventDefault();
    setComponentError('');
    try {
      const payload = {
        ...componentForm,
        value: Number(componentForm.value),
        metro_value: componentForm.metro_value === '' ? null : Number(componentForm.metro_value),
      };
      if (editingComponent) {
        await api.updatePayrollComponent(editingComponent.id, payload);
      } else {
        await api.createPayrollComponent(payload);
      }
      setComponentModalOpen(false);
      setComponentRefresh((value) => value + 1);
    } catch (error) {
      setComponentError(
        Object.values(error?.data?.errors || {}).flat()[0]
        || error?.data?.message
        || error.message
        || 'Unable to save this payroll component.'
      );
    }
  };

  const toggleComponent = async (component) => {
    setComponentError('');
    try {
      await api.updatePayrollComponent(component.id, { is_enabled: !component.is_enabled });
      setComponentRefresh((value) => value + 1);
    } catch (error) {
      setComponentError(error?.data?.message || error.message || 'Unable to change this component status.');
    }
  };

  const updateSlab = (setForm, index, field, value) => {
    setForm(form => ({
      ...form,
      slabs: form.slabs.map((slab, slabIndex) => (
        slabIndex === index ? { ...slab, [field]: value } : slab
      )),
    }));
  };

  const handleSaveContributionConfig = async (event) => {
    event.preventDefault();
    setStatutoryError('');
    setStatutorySaving(true);
    try {
      await api.createPayrollContributionConfig({
        ...contributionForm,
        pf_employee_rate: Number(contributionForm.pf_employee_rate),
        pf_employer_rate: Number(contributionForm.pf_employer_rate),
        eps_rate: Number(contributionForm.eps_rate),
        pf_wage_ceiling: Number(contributionForm.pf_wage_ceiling),
        esi_employee_rate: Number(contributionForm.esi_employee_rate),
        esi_employer_rate: Number(contributionForm.esi_employer_rate),
        esi_gross_limit: Number(contributionForm.esi_gross_limit),
      });
      setComponentRefresh(value => value + 1);
    } catch (error) {
      setStatutoryError(statutoryErrorMessage(error));
    } finally {
      setStatutorySaving(false);
    }
  };

  const handleSavePtRules = async (event) => {
    event.preventDefault();
    setStatutoryError('');
    setStatutorySaving(true);
    try {
      await api.createProfessionalTaxRules({
        ...ptRuleForm,
        slabs: ptRuleForm.is_applicable ? ptRuleForm.slabs.map(slab => ({
          salary_from: Number(slab.salary_from),
          salary_to: slab.salary_to === '' ? null : Number(slab.salary_to),
          monthly_tax: Number(slab.monthly_tax),
        })) : [],
      });
      setComponentRefresh(value => value + 1);
    } catch (error) {
      setStatutoryError(statutoryErrorMessage(error));
    } finally {
      setStatutorySaving(false);
    }
  };

  const handleSaveIncomeTaxRules = async (event) => {
    event.preventDefault();
    setStatutoryError('');
    setStatutorySaving(true);
    try {
      await api.createIncomeTaxRules({
        ...incomeTaxForm,
        slabs: incomeTaxForm.slabs.map(slab => ({
          income_from: Number(slab.income_from),
          income_to: slab.income_to === '' ? null : Number(slab.income_to),
          tax_rate: Number(slab.tax_rate),
        })),
      });
      setComponentRefresh(value => value + 1);
    } catch (error) {
      setStatutoryError(statutoryErrorMessage(error));
    } finally {
      setStatutorySaving(false);
    }
  };

  const handleSaveTaxDeclaration = async (event) => {
    event.preventDefault();
    setStatutoryError('');
    setStatutorySaving(true);
    try {
      await api.updatePayrollTaxDeclaration(selectedTaxEmployeeId, {
        ...declarationForm,
        other_annual_income: Number(declarationForm.other_annual_income),
        previous_employer_income: Number(declarationForm.previous_employer_income),
        previous_employer_tds: Number(declarationForm.previous_employer_tds),
        annual_deductions: Object.fromEntries(
          Object.entries(declarationForm.annual_deductions).map(([key, value]) => [key, Number(value)])
        ),
      });
      setComponentRefresh(value => value + 1);
    } catch (error) {
      setStatutoryError(statutoryErrorMessage(error));
    } finally {
      setStatutorySaving(false);
    }
  };

  const handleOpenPayslips = async (run) => {
    setSelectedRun(run);
    setRunPayslips([]);
    setDeductionDrafts({});
    setAdjustmentDrafts({});
    setPayingPayslip(null);
    setAdjustingPayslipId(null);
    setSearchTerm('');
    setPaymentFilter('all');
    setConfirmationFilter('all');
    setExpandedRowId(null);
    setCurrentPage(1);
    setPayslipError('');
    setLoadingPayslips(true);
    try {
      const response = await api.getPayrollRunPayslips(run.id);
      const slips = Array.isArray(response?.data) ? response.data : [];
      setRunPayslips(slips);
      setDeductionDrafts(Object.fromEntries(slips.map(slip => [slip.id, {
        professional_tax: String(slip.professional_tax ?? 0),
        tds: String(slip.tds ?? 0),
        professional_tax_override_reason: slip.professional_tax_override_reason || '',
        tds_override_reason: slip.tds_override_reason || '',
      }])));
      setAdjustmentDrafts(Object.fromEntries(slips.map(slip => [slip.id, {
        custom_bonus: String(slip.custom_bonus ?? 0),
        custom_bonus_label: slip.custom_bonus_label || '',
        late_penalty_days: String(slip.late_penalty_days ?? 0),
        late_penalty_amount: String(slip.late_penalty_amount ?? 0),
        late_count_summary: slip.late_count_summary || '',
        other_penalty_amount: String(slip.other_penalty_amount ?? 0),
        other_penalty_reason: slip.other_penalty_reason || '',
      }])));
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to load payroll payslips.');
    } finally {
      setLoadingPayslips(false);
    }
  };

  const openPaymentModal = (payslip) => {
    setPayingPayslip(payslip);
    setPaymentForm({
      payment_status: payslip.payment_status === 'paid' ? 'paid' : 'paid',
      payment_mode: payslip.payment_mode || 'Bank Transfer',
      payment_reference: payslip.payment_reference || '',
      paid_at: payslip.paid_at ? payslip.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!payingPayslip || !selectedRun) return;
    setSavingPayment(true);
    setPayslipError('');
    try {
      const response = await api.markIndividualPayslipPaid(selectedRun.id, payingPayslip.id, paymentForm);
      if (response?.data) {
        setRunPayslips(current => current.map(item => item.id === payingPayslip.id ? response.data : item));
      }
      setPayingPayslip(null);
      try {
        await refreshPayrollRuns();
      } catch {
        // Run refresh failure shouldn't block payment save
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to update payment details.');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSaveAdjustments = async (payslip) => {
    const draft = adjustmentDrafts[payslip.id];
    setPayslipError('');
    setSavingAdjustmentId(payslip.id);
    try {
      const response = await api.updatePayslipAdjustments(selectedRun.id, payslip.id, {
        custom_bonus: draft?.custom_bonus,
        custom_bonus_label: draft?.custom_bonus_label,
        late_penalty_days: draft?.late_penalty_days,
        late_penalty_amount: draft?.late_penalty_amount,
        late_count_summary: draft?.late_count_summary,
        other_penalty_amount: draft?.other_penalty_amount,
        other_penalty_reason: draft?.other_penalty_reason,
      });
      if (response?.data) {
        setRunPayslips(current => current.map(item => item.id === payslip.id ? response.data : item));
        setAdjustingPayslipId(null);
        try {
          await refreshPayrollRuns();
        } catch {
          // Totals refresh failure shouldn't block
        }
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to save salary adjustments and penalties.');
    } finally {
      setSavingAdjustmentId(null);
    }
  };

  const handleReviewPayslip = async (payslip) => {
    const draft = deductionDrafts[payslip.id];
    setPayslipError('');
    setSavingPayslipId(payslip.id);
    const ptReason = (draft?.professional_tax_override_reason || '').trim() ||
      (Number(draft?.professional_tax || 0) === 0 ? 'Nil Professional Tax / State non-applicable' : `Manual verified PT: ₹${draft?.professional_tax}`);
    const tdsReason = (draft?.tds_override_reason || '').trim() ||
      (Number(draft?.tds || 0) === 0 ? 'Nil TDS / Income below taxable threshold' : `Manual verified TDS: ₹${draft?.tds}`);
    try {
      const response = await api.reviewPayrollPayslip(selectedRun.id, payslip.id, {
        professional_tax: draft?.professional_tax ?? '0',
        tds: draft?.tds ?? '0',
        professional_tax_override_reason: ptReason,
        tds_override_reason: tdsReason,
      });
      setRunPayslips(current => current.map(item => item.id === payslip.id ? response.data : item));
      try {
        await refreshPayrollRuns();
      } catch {
        setPayslipError('The deductions were saved, but payroll totals could not refresh. Reload the page before finalizing.');
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to save reviewed deductions.');
    } finally {
      setSavingPayslipId(null);
    }
  };

  const handleConfirmAllDeductions = async () => {
    if (!selectedRun) return;
    const unconfirmed = runPayslips.filter(p => !p.deductions_confirmed);
    if (unconfirmed.length === 0) return;
    setSavingPayslipId('all');
    setPayslipError('');
    try {
      for (const slip of unconfirmed) {
        const draft = deductionDrafts[slip.id] || { professional_tax: String(slip.professional_tax ?? 0), tds: String(slip.tds ?? 0) };
        const ptReason = (draft?.professional_tax_override_reason || '').trim() ||
          (Number(draft?.professional_tax || 0) === 0 ? 'Nil Professional Tax / State non-applicable' : `Manual verified PT: ₹${draft?.professional_tax}`);
        const tdsReason = (draft?.tds_override_reason || '').trim() ||
          (Number(draft?.tds || 0) === 0 ? 'Nil TDS / Income below taxable threshold' : `Manual verified TDS: ₹${draft?.tds}`);
        const res = await api.reviewPayrollPayslip(selectedRun.id, slip.id, {
          professional_tax: draft?.professional_tax ?? '0',
          tds: draft?.tds ?? '0',
          professional_tax_override_reason: ptReason,
          tds_override_reason: tdsReason,
        });
        if (res?.data) {
          setRunPayslips(current => current.map(item => item.id === slip.id ? res.data : item));
        }
      }
      try {
        await refreshPayrollRuns();
      } catch {
        // Totals refresh failure shouldn't block
      }
    } catch (error) {
      setPayslipError(error?.data?.message || error.message || 'Unable to confirm all deductions.');
    } finally {
      setSavingPayslipId(null);
    }
  };

  const pendingPayslips = runPayslips.filter(payslip => !payslip.deductions_confirmed).length;
  const paidPayslipsCount = runPayslips.filter(payslip => payslip.payment_status === 'paid').length;
  const unpaidPayslipsCount = runPayslips.length - paidPayslipsCount;
  const confirmedPayslipsCount = runPayslips.length - pendingPayslips;

  // Filtered payslips based on search and filters
  const filteredPayslips = runPayslips.filter(slip => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const name = `${slip.first_name || ''} ${slip.last_name || ''}`.toLowerCase();
      const code = (slip.employee_code || '').toLowerCase();
      const desig = (slip.designation || '').toLowerCase();
      if (!name.includes(term) && !code.includes(term) && !desig.includes(term)) {
        return false;
      }
    }
    if (paymentFilter === 'paid' && slip.payment_status !== 'paid') return false;
    if (paymentFilter === 'unpaid' && slip.payment_status === 'paid') return false;
    if (confirmationFilter === 'confirmed' && !slip.deductions_confirmed) return false;
    if (confirmationFilter === 'unconfirmed' && slip.deductions_confirmed) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedPayslips = filteredPayslips.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const toggleRowExpand = (id) => {
    setExpandedRowId(curr => curr === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Finance & Compensation
            </span>
            <span className="text-xs text-slate-500 font-medium">Statutory Payroll & Compliance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">India Statutory Payroll & Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review stored salary records and configured PF/ESI amounts; verify PT and TDS before publishing employee payslips.
          </p>
        </div>

        {canManagePayroll && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowRunWizard(true)}
          >
            Generate Monthly Payroll Run
          </Button>
        )}
      </div>

      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          <p>{workflowError}</p>
          {salaryDataIssues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {salaryDataIssues.map((employee) => (
                <li key={employee.employee_id} className="flex flex-wrap items-center gap-x-2">
                  <span>
                    <strong>{employee.employee_code}</strong> — {employee.employee_name}: {employee.issues.map((issue) => ({
                      gross_monthly: 'Gross monthly salary missing',
                      basic_monthly: 'Basic monthly salary missing',
                      basic_exceeds_gross: 'Basic salary exceeds gross',
                    })[issue] || issue).join(', ')}
                  </span>
                  {currentUser.role === 'super_admin' && (
                    <Link
                      className="font-semibold underline underline-offset-2"
                      to={`/employees?employee_id=${employee.employee_id}&profile_tab=salary`}
                    >
                      Open Compensation
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs overflow-x-auto">
        {canViewPayrollRuns && <button
          onClick={() => setActiveTab('runs')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'runs' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Banknote className="w-4 h-4" /> Monthly Payroll Cycles ({payrollRuns.length})
        </button>}

        {canViewComponents && <button
          onClick={() => setActiveTab('structures')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'structures' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" /> CTC Structure & Component Master
        </button>}

        {canViewComponents && (
          <button
            onClick={() => setActiveTab('statutory')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'statutory' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Indian Statutory Config (EPFO / ESIC / PT)
          </button>
        )}

        {isBranchScoped && (
          <div className="ml-auto pb-2 flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Branch: {activeBranch}</span>
          </div>
        )}
      </div>

      {/* TAB 1: PAYROLL RUNS */}
      {activeTab === 'runs' && canViewPayrollRuns && (
        <div className="space-y-4">
          {payrollRuns.length === 0 ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No payroll runs have been generated yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {payrollRuns.map(run => {
                const isPublished = ['published', 'locked'].includes(run.status);
                const isVerified = run.status === 'verified';
                const isDraft = ['draft', 'review'].includes(run.status);
                const statusLabel = isPublished ? 'Published' : isVerified ? 'Verified' : isDraft ? 'Draft' : run.status;

                return (
                  <Card
                    key={run.id}
                    title={`${run.month_name} Payroll Run`}
                    subtitle={`Scope: ${run.scope_key}`}
                    action={
                      <Badge variant={isPublished ? 'success' : 'warning'} size="sm">
                        {isPublished ? <><Lock className="w-3 h-3 inline mr-1" /> {statusLabel}</> : statusLabel}
                      </Badge>
                    }
                  >
                    <div className="space-y-4 text-xs">
                      {/* Numbers Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Payout</span>
                          <span className="font-bold text-slate-800 text-sm">₹{run.gross_payout_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            {Number(run.pending_deductions_count) > 0 ? 'Deductions so far' : 'Total Deductions'}
                          </span>
                          <span className="font-bold text-rose-600 text-sm">₹{run.total_deductions_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            {Number(run.pending_deductions_count) > 0 ? 'Net estimate' : 'Net Salary'}
                          </span>
                          <span className="font-bold text-emerald-600 text-sm">₹{run.net_payout_inr?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>Total Employees: <strong>{run.total_employees}</strong></span>
                        {isDraft && <span>Awaiting PT/TDS review: <strong>{run.pending_deductions_count || 0}</strong></span>}
                        {run.approved_by && <span>Approved by: <strong>{run.approved_by}</strong></span>}
                      </div>

                      {/* Actions */}
                      {canManagePayroll && (
                        <div className="pt-3 border-t border-slate-100">
                          <Button
                            size="sm"
                            variant={isPublished ? 'secondary' : 'primary'}
                            icon={isPublished ? FileText : Lock}
                            onClick={() => handleOpenPayslips(run)}
                          >
                            {isPublished ? 'View Published Payslips' : isVerified ? 'View Verified Payslips' : isDraft ? 'Review Draft Payslips' : 'View Payslips'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALARY CTC BREAKUP MASTER */}
      {activeTab === 'structures' && canViewComponents && (
        <>
          <Card
            title="CTC Structure & Component Master"
            subtitle="Component changes apply only to payroll runs generated afterward; locked payslips keep their saved breakdown."
            action={canManageComponents && (
              <Button size="sm" variant="primary" onClick={() => openComponentEditor()}>
                Add component
              </Button>
            )}
          >
            <div className="space-y-4 text-xs">
              <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-teal-900">
                HRA defaults to 40% of Basic for non-metro branch cities and 50% for Delhi, Mumbai, Kolkata, and Chennai.
                Review your organization’s policy before using these defaults. Special Allowance balances earnings to stored gross;
                Conveyance, Medical, Bonus, and Gratuity start disabled.
              </p>
              {salaryConfiguration && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">Salary data readiness</h4>
                    <p className="mt-1 text-slate-600">
                      {salaryConfiguration.total_count === 0
                        ? 'No active non-demo employees are in the regular payroll scope.'
                        : `${salaryConfiguration.configured_count} of ${salaryConfiguration.total_count} active non-demo employees have valid gross and basic salary values.`}
                    </p>
                  </div>
                  {salaryConfiguration.total_count > 0 && (
                    <Badge
                      variant={salaryConfiguration.configured_count === salaryConfiguration.total_count ? 'success' : 'warning'}
                      size="sm"
                    >
                      {salaryConfiguration.configured_count === salaryConfiguration.total_count
                        ? `Configured ${salaryConfiguration.configured_count} of ${salaryConfiguration.total_count}`
                        : `${salaryConfiguration.total_count - salaryConfiguration.configured_count} need salary data`}
                    </Badge>
                  )}
                </div>
              )}
              {componentError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  {componentError}
                </p>
              )}
              {componentsLoading ? (
                <p role="status" className="py-6 text-center text-slate-500">Loading component settings…</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {components.map((component) => (
                    <div key={component.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-slate-900">{component.name}</h4>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {component.component_group === 'employer_cost' ? 'Employer cost' : 'Earnings'} · {componentRuleLabel(component)}
                            {component.component_key === 'hra' && component.metro_value != null
                              ? ` · ${Number(component.metro_value)}% in metro cities`
                              : ''}
                          </p>
                        </div>
                        <Badge variant={component.is_enabled ? 'success' : 'neutral'} size="sm">
                          {component.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      {canManageComponents && (
                        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                          <Button size="sm" variant="secondary" onClick={() => openComponentEditor(component)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleComponent(component)}
                            disabled={['basic', 'special_allowance'].includes(component.component_key)}
                          >
                            {component.is_enabled ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Modal
            isOpen={componentModalOpen}
            onClose={() => setComponentModalOpen(false)}
            title={editingComponent ? 'Edit payroll component' : 'Add payroll component'}
          >
            <form onSubmit={handleSaveComponent} className="space-y-4 text-xs">
              {componentError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                  {componentError}
                </p>
              )}
              <label className="block font-semibold text-slate-700">
                Component name
                <input
                  required
                  maxLength={100}
                  value={componentForm.name}
                  onChange={(event) => setComponentForm((form) => ({ ...form, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block font-semibold text-slate-700">
                  Category
                  <select
                    value={componentForm.component_group}
                    onChange={(event) => setComponentForm((form) => ({ ...form, component_group: event.target.value }))}
                    disabled={['basic', 'special_allowance'].includes(editingComponent?.component_key)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="earning">Earnings</option>
                    <option value="employer_cost">Employer cost</option>
                  </select>
                </label>
                <label className="block font-semibold text-slate-700">
                  Calculation type
                  <select
                    value={componentForm.calculation_type}
                    onChange={(event) => setComponentForm((form) => ({ ...form, calculation_type: event.target.value }))}
                    disabled={['basic', 'special_allowance'].includes(editingComponent?.component_key)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="fixed">Fixed monthly amount</option>
                    <option value="percent_basic">% of Basic</option>
                    <option value="percent_gross">% of Gross</option>
                    {editingComponent?.component_key === 'basic' && (
                      <option value="employee_value">Employee-specific stored Basic</option>
                    )}
                    {editingComponent?.component_key === 'special_allowance' && (
                      <option value="residual">Residual of Gross</option>
                    )}
                  </select>
                </label>
                <label className="block font-semibold text-slate-700">
                  {componentForm.calculation_type.includes('percent') ? 'Rate (%)' : 'Monthly amount (₹)'}
                  <input
                    required
                    type="number"
                    min="0"
                    max={componentForm.calculation_type.includes('percent') ? '100' : undefined}
                    step="0.01"
                    disabled={['employee_value', 'residual'].includes(componentForm.calculation_type)}
                    value={componentForm.value}
                    onChange={(event) => setComponentForm((form) => ({ ...form, value: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  />
                </label>
                {editingComponent?.component_key === 'hra' && (
                  <label className="block font-semibold text-slate-700">
                    Metro city rate (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={componentForm.metro_value}
                      onChange={(event) => setComponentForm((form) => ({ ...form, metro_value: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                )}
              </div>
              {editingComponent && !['basic', 'special_allowance'].includes(editingComponent.component_key) && (
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(componentForm.is_enabled)}
                    onChange={(event) => setComponentForm((form) => ({ ...form, is_enabled: event.target.checked }))}
                  />
                  Enabled for future payroll runs
                </label>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button type="button" variant="secondary" onClick={() => setComponentModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Save component</Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* TAB 3: STATUTORY CONFIGURATION */}
      {activeTab === 'statutory' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Review statutory settings before using calculated deductions.</p>
            <p className="mt-1 text-xs leading-relaxed">
              PF/ESI defaults carry forward the rates already used by this application. PT and income-tax slabs are intentionally not prefilled;
              add verified, effective-dated tables. Uttar Pradesh demo branches are seeded with PT disabled, so they remain at zero unless the branch
              is marked PT-applicable. These calculations are estimates for payroll review, not tax or legal advice.
            </p>
          </div>
          {statutoryError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {statutoryError}
            </p>
          )}
          {statutoryLoading ? (
            <p role="status" className="py-6 text-center text-sm text-slate-500">Loading statutory settings…</p>
          ) : (
            <>
              <Card title="PF / ESI contribution rules" subtitle="Each new rate set takes effect on its effective date; past payroll snapshots do not change.">
                <div className="space-y-4 text-xs">
                  {(statutoryData?.contribution_configs || []).map(config => (
                    <div key={config.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <strong>Effective {config.effective_from}</strong>
                      <p className="mt-1 text-slate-600">
                        PF employee {config.pf_employee_rate}% · employer {config.pf_employer_rate}% · EPS {config.eps_rate}%
                        {config.apply_pf_wage_ceiling ? ` up to ₹${Number(config.pf_wage_ceiling).toLocaleString('en-IN')}` : ' on full Basic'}
                        {' · '}ESI employee {config.esi_employee_rate}% · employer {config.esi_employer_rate}%
                        {` · gross limit ₹${Number(config.esi_gross_limit).toLocaleString('en-IN')}`}
                      </p>
                    </div>
                  ))}
                  {canManageComponents && (
                    <form onSubmit={handleSaveContributionConfig} className="space-y-3 border-t border-slate-100 pt-4">
                      <h4 className="font-semibold text-slate-800">Add contribution rates</h4>
                      <label className="block font-semibold text-slate-700">
                        Effective from
                        <input required type="date" value={contributionForm.effective_from}
                          onChange={event => setContributionForm(form => ({ ...form, effective_from: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          ['pf_employee_rate', 'Employee PF (%)'],
                          ['pf_employer_rate', 'Employer PF (%)'],
                          ['eps_rate', 'Employer EPS share (%)'],
                          ['pf_wage_ceiling', 'PF wage ceiling (₹)'],
                          ['esi_employee_rate', 'Employee ESI (%)'],
                          ['esi_employer_rate', 'Employer ESI (%)'],
                          ['esi_gross_limit', 'ESI gross limit (₹)'],
                        ].map(([field, label]) => (
                          <label key={field} className="font-semibold text-slate-700">
                            {label}
                            <input required type="number" min="0" step="0.001" value={contributionForm[field]}
                              onChange={event => setContributionForm(form => ({ ...form, [field]: event.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                          </label>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 font-semibold text-slate-700">
                        <input type="checkbox" checked={contributionForm.apply_pf_wage_ceiling}
                          onChange={event => setContributionForm(form => ({ ...form, apply_pf_wage_ceiling: event.target.checked }))} />
                        Apply PF wage ceiling
                      </label>
                      <Button type="submit" size="sm" disabled={statutorySaving}>
                        {statutorySaving ? 'Saving…' : 'Save effective-dated PF/ESI rules'}
                      </Button>
                    </form>
                  )}
                </div>
              </Card>

              <Card title="Professional Tax by state" subtitle="Add a no-PT state entry or the verified monthly salary slabs. Branch PT applicability remains an additional opt-in.">
                <div className="space-y-4 text-xs">
                  {(statutoryData?.professional_tax_rule_sets || []).map(rule => (
                    <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <strong>{rule.state} · Effective {rule.effective_from}</strong>
                      <p className="mt-1 text-slate-600">
                        {rule.is_applicable
                          ? rule.slabs.map(slab => `₹${Number(slab.salary_from).toLocaleString('en-IN')}–${slab.salary_to == null ? 'above' : `₹${Number(slab.salary_to).toLocaleString('en-IN')}`}: ₹${Number(slab.monthly_tax).toLocaleString('en-IN')}/month`).join(' · ')
                          : 'No Professional Tax'}
                      </p>
                    </div>
                  ))}
                  {canManageComponents && (
                    <form onSubmit={handleSavePtRules} className="space-y-3 border-t border-slate-100 pt-4">
                      <h4 className="font-semibold text-slate-800">Add state rule set</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="font-semibold text-slate-700">
                          State
                          <input required maxLength={100} value={ptRuleForm.state}
                            onChange={event => setPtRuleForm(form => ({ ...form, state: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                        <label className="font-semibold text-slate-700">
                          Effective from
                          <input required type="date" value={ptRuleForm.effective_from}
                            onChange={event => setPtRuleForm(form => ({ ...form, effective_from: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                      </div>
                      <label className="flex items-center gap-2 font-semibold text-slate-700">
                        <input type="checkbox" checked={ptRuleForm.is_applicable}
                          onChange={event => setPtRuleForm(form => ({ ...form, is_applicable: event.target.checked }))} />
                        Professional Tax applies in this state
                      </label>
                      {ptRuleForm.is_applicable && ptRuleForm.slabs.map((slab, index) => (
                        <div key={`pt-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                          {[
                            ['salary_from', 'Monthly salary from (₹)'],
                            ['salary_to', 'Monthly salary to (blank = no limit)'],
                            ['monthly_tax', 'Monthly PT amount (₹)'],
                          ].map(([field, label]) => (
                            <label key={field} className="font-semibold text-slate-700">
                              {label}
                              <input required={field !== 'salary_to'} type="number" min="0" step="0.01"
                                value={slab[field]}
                                onChange={event => updateSlab(setPtRuleForm, index, field, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                          ))}
                        </div>
                      ))}
                      {ptRuleForm.is_applicable && (
                        <Button type="button" size="sm" variant="secondary"
                          disabled={!ptRuleForm.slabs[ptRuleForm.slabs.length - 1]?.salary_to}
                          onClick={() => setPtRuleForm(form => {
                            const lower = form.slabs[form.slabs.length - 1].salary_to;
                            return { ...form, slabs: [...form.slabs, { salary_from: lower, salary_to: '', monthly_tax: '0' }] };
                          })}>
                          Add PT salary range
                        </Button>
                      )}
                      <Button type="submit" size="sm" disabled={statutorySaving}>
                        {statutorySaving ? 'Saving…' : 'Save state PT rules'}
                      </Button>
                    </form>
                  )}

                  {canManageComponents && branches.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mt-4">
                      <h4 className="font-semibold text-slate-800 mb-1">Branch Professional Tax Opt-In</h4>
                      <p className="text-[11px] text-slate-500 mb-2">Enable or disable PT deduction per regional branch location:</p>
                      <div className="space-y-1.5">
                        {branches.map((b) => (
                          <div key={b.id} className="flex items-center justify-between py-1 border-b border-slate-200/70 last:border-b-0">
                            <div>
                              <span className="font-semibold text-slate-800">{b.name}</span>
                              <span className="text-slate-500 text-[11px]"> · {b.city}, {b.state}</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={b.pt_applicable ? 'secondary' : 'primary'}
                              onClick={async () => {
                                try {
                                  await api.updateBranchProfessionalTax(b.id, !b.pt_applicable);
                                  await refreshBranches?.();
                                } catch (err) {
                                  setStatutoryError(statutoryErrorMessage(err));
                                }
                              }}
                            >
                              {b.pt_applicable ? 'PT Enabled' : 'PT Disabled'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Old / New regime income-tax slabs" subtitle="Progressive annual slabs are effective-dated separately for each tax regime.">
                <div className="space-y-4 text-xs">
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    No rates are preloaded. A TDS estimate is produced only when the employee has a reviewed declaration for the financial year
                    and a matching regime slab table exists; otherwise Payroll must enter a reviewed amount with an override reason.
                    The estimate does not model tax credits, cess, or surcharge; account for those through verified slabs or a documented override.
                  </p>
                  {(statutoryData?.income_tax_rule_sets || []).map(rule => (
                    <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <strong>{rule.tax_regime} regime · Effective {rule.effective_from}</strong>
                      <p className="mt-1 text-slate-600">
                        {rule.slabs.map(slab => `₹${Number(slab.income_from).toLocaleString('en-IN')}–${slab.income_to == null ? 'above' : `₹${Number(slab.income_to).toLocaleString('en-IN')}`}: ${Number(slab.tax_rate)}%`).join(' · ')}
                      </p>
                    </div>
                  ))}
                  {canManageComponents && (
                    <form onSubmit={handleSaveIncomeTaxRules} className="space-y-3 border-t border-slate-100 pt-4">
                      <h4 className="font-semibold text-slate-800">Add tax regime slab set</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="font-semibold text-slate-700">
                          Tax regime
                          <select value={incomeTaxForm.tax_regime}
                            onChange={event => setIncomeTaxForm(form => ({ ...form, tax_regime: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                            <option value="New">New</option>
                            <option value="Old">Old</option>
                          </select>
                        </label>
                        <label className="font-semibold text-slate-700">
                          Effective from
                          <input required type="date" value={incomeTaxForm.effective_from}
                            onChange={event => setIncomeTaxForm(form => ({ ...form, effective_from: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                      </div>
                      {incomeTaxForm.slabs.map((slab, index) => (
                        <div key={`income-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                          {[
                            ['income_from', 'Annual taxable income from (₹)'],
                            ['income_to', 'Annual taxable income to (blank = no limit)'],
                            ['tax_rate', 'Marginal tax rate (%)'],
                          ].map(([field, label]) => (
                            <label key={field} className="font-semibold text-slate-700">
                              {label}
                              <input required={field !== 'income_to'} type="number" min="0" step="0.01"
                                value={slab[field]}
                                onChange={event => updateSlab(setIncomeTaxForm, index, field, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                          ))}
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="secondary"
                        disabled={!incomeTaxForm.slabs[incomeTaxForm.slabs.length - 1]?.income_to}
                        onClick={() => setIncomeTaxForm(form => {
                          const lower = form.slabs[form.slabs.length - 1].income_to;
                          return { ...form, slabs: [...form.slabs, { income_from: lower, income_to: '', tax_rate: '0' }] };
                        })}>
                        Add income range
                      </Button>
                      <Button type="submit" size="sm" disabled={statutorySaving}>
                        {statutorySaving ? 'Saving…' : 'Save income-tax slabs'}
                      </Button>
                    </form>
                  )}
                </div>
              </Card>

              <Card title="Reviewed annual tax declarations" subtitle="Declarations are used only after HR records them as reviewed. Amounts are employee-provided and require verification.">
                <div className="space-y-4 text-xs">
                  {taxDeclarations.length > 0 ? (
                    <>
                      <label className="block font-semibold text-slate-700">
                        Employee
                        <select value={selectedTaxEmployeeId} onChange={event => setSelectedTaxEmployeeId(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          {taxDeclarations.map(employee => (
                            <option key={employee.employee_id} value={employee.employee_id}>
                              {employee.employee_code} · {employee.first_name} {employee.last_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {canManageComponents ? (
                        <form onSubmit={handleSaveTaxDeclaration} className="space-y-3 border-t border-slate-100 pt-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="font-semibold text-slate-700">
                              Financial year
                              <input required pattern="\d{4}-\d{4}" value={declarationForm.financial_year}
                                onChange={event => setDeclarationForm(form => ({ ...form, financial_year: event.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="font-semibold text-slate-700">
                              Tax regime
                              <select value={declarationForm.tax_regime}
                                onChange={event => setDeclarationForm(form => ({ ...form, tax_regime: event.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                <option value="New">New</option>
                                <option value="Old">Old</option>
                              </select>
                            </label>
                            {[
                              ['other_annual_income', 'Other annual income (₹)'],
                              ['previous_employer_income', 'Previous-employer income (₹)'],
                              ['previous_employer_tds', 'Previous-employer TDS withheld (₹)'],
                            ].map(([field, label]) => (
                              <label key={field} className="font-semibold text-slate-700">
                                {label}
                                <input required type="number" min="0" step="0.01" value={declarationForm[field]}
                                  onChange={event => setDeclarationForm(form => ({ ...form, [field]: event.target.value }))}
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                              </label>
                            ))}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                              ['section_80c', 'Section 80C declared (₹)'],
                              ['section_80d', 'Section 80D declared (₹)'],
                              ['section_80ccd_1b', 'Section 80CCD(1B) declared (₹)'],
                              ['hra_exemption', 'HRA exemption declared (₹)'],
                              ['home_loan_interest', 'Home-loan interest declared (₹)'],
                              ['other_deductions', 'Other verified deductions (₹)'],
                            ].map(([field, label]) => (
                              <label key={field} className="font-semibold text-slate-700">
                                {label}
                                <input required type="number" min="0" step="0.01"
                                  value={declarationForm.annual_deductions[field]}
                                  onChange={event => setDeclarationForm(form => ({
                                    ...form,
                                    annual_deductions: { ...form.annual_deductions, [field]: event.target.value },
                                  }))}
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                              </label>
                            ))}
                          </div>
                          <p className="text-slate-500">
                            Deduction figures are treated as verified annual reductions for the selected regime; confirm eligibility and limits
                            before saving. The system does not decide legal eligibility.
                          </p>
                          <Button type="submit" size="sm" disabled={statutorySaving || !selectedTaxEmployeeId}>
                            {statutorySaving ? 'Saving…' : 'Save and mark reviewed'}
                          </Button>
                        </form>
                      ) : (
                        <p className="text-slate-600">
                          {taxDeclarations.find(employee => String(employee.employee_id) === String(selectedTaxEmployeeId))?.reviewed_by
                            ? `Reviewed by ${taxDeclarations.find(employee => String(employee.employee_id) === String(selectedTaxEmployeeId)).reviewed_by}`
                            : 'No reviewed declaration is available for this financial year.'}
                        </p>
                      )}
                    </>
                  ) : (
                    <p role="status" className="text-slate-500">No active non-demo employees are available for tax declarations.</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* GENERATE RUN MODAL WIZARD */}
      <Modal
        isOpen={showRunWizard}
        onClose={() => setShowRunWizard(false)}
        title="Initialize Monthly Payroll Run"
        subtitle="Architecture Section 7.2: Unique period_year, period_month, scope_key"
      >
        <form onSubmit={handleStartPayroll} className="space-y-4 text-xs">
          {workflowError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {workflowError}
            </p>
          )}
          {salaryDataIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="font-semibold">Employees with incomplete salary details ({salaryDataIssues.length}):</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {salaryDataIssues.map((emp) => (
                  <li key={emp.id || emp.employee_code}>{emp.name || emp.employee_code} ({emp.employee_code})</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period Month:</label>
              <select
                value={wizardMonth}
                onChange={(e) => setWizardMonth(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                {PAYROLL_MONTHS.map(month => <option key={month} value={month}>{month}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Period Year:</label>
              <input
                type="number"
                min="2000"
                max="2100"
                required
                value={wizardYear}
                onChange={(e) => setWizardYear(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Execution Scope:</label>
            <select
              value={wizardScope}
              onChange={(e) => setWizardScope(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="company">All Branches</option>
              <option value="demo">Demo Accounts Only (Test Run)</option>
              {branches.map(branch => (
                <option key={branch.id} value={`branch:${branch.id}`}>{branch.name} only</option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900">
            <p className="font-semibold">Payroll review workflow:</p>
            <p className="text-[11px] mt-0.5">
              Company and branch runs exclude demo accounts. Use the demo-only scope for testing; salary and configured PF/ESI amounts are saved as payslips. Enter verified PT/TDS amounts before finalizing and publishing.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowRunWizard(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingPayroll}>
              {savingPayroll ? 'Saving...' : 'Launch Payroll Calculation'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={`${selectedRun?.month_name || 'Payroll'} Payslips`}
        subtitle="Review employee-level amounts. Employee payslips are available only after publication."
        maxWidth="max-w-7xl"
      >
        <div className="space-y-4">
          {payslipError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {payslipError}
            </div>
          )}
          {loadingPayslips && <p role="status" className="text-sm text-slate-500">Loading payslips…</p>}
          {!loadingPayslips && runPayslips.length === 0 && !payslipError && (
            <p role="status" className="text-sm text-slate-500">No payslip records exist for this run.</p>
          )}

          {!loadingPayslips && runPayslips.length > 0 && (
            <>
              {/* Metric Summary Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Total Employees: <strong>{runPayslips.length}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Paid: <strong>{paidPayslipsCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Unpaid: <strong>{unpaidPayslipsCount}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  Deductions Confirmed: <strong>{confirmedPayslipsCount}</strong>
                </span>
                {pendingPayslips > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    Review Required: <strong>{pendingPayslips}</strong>
                  </span>
                )}
              </div>

              {/* Search Bar & Filters Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by employee name, code (e.g. EMP-021), or designation..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={paymentFilter}
                    onChange={e => {
                      setPaymentFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="all">Payment: All ({runPayslips.length})</option>
                    <option value="paid">Paid ({paidPayslipsCount})</option>
                    <option value="unpaid">Unpaid ({unpaidPayslipsCount})</option>
                  </select>

                  <select
                    value={confirmationFilter}
                    onChange={e => {
                      setConfirmationFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="all">Deductions: All</option>
                    <option value="confirmed">Reviewed ({confirmedPayslipsCount})</option>
                    <option value="unconfirmed">Required ({pendingPayslips})</option>
                  </select>

                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none"
                  >
                    <option value={10}>10 / page</option>
                    <option value={15}>15 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="w-8 px-2 py-3 text-center"></th>
                      <th className="px-3 py-3">Employee</th>
                      <th className="px-3 py-3">Gross (₹)</th>
                      <th className="px-3 py-3">Bonus / Adjust</th>
                      <th className="px-3 py-3">Deductions (₹)</th>
                      <th className="px-3 py-3">Net Salary (₹)</th>
                      <th className="px-3 py-3">Deductions</th>
                      <th className="px-3 py-3">Payment</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPayslips.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          {searchTerm || paymentFilter !== 'all' || confirmationFilter !== 'all' ? (
                            <div>
                              <p className="font-semibold text-slate-700">No employees match the active filters.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchTerm('');
                                  setPaymentFilter('all');
                                  setConfirmationFilter('all');
                                  setCurrentPage(1);
                                }}
                                className="mt-2 text-xs font-semibold text-teal-600 hover:underline"
                              >
                                Reset all filters
                              </button>
                            </div>
                          ) : (
                            'No payslip records exist for this run.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedPayslips.map(payslip => {
                        const isExpanded = expandedRowId === payslip.id;
                        const isAdjusting = isSuperAdmin && adjustingPayslipId === payslip.id && selectedRun?.status !== 'locked';
                        const draft = deductionDrafts[payslip.id] || {
                          professional_tax: '0',
                          tds: '0',
                          professional_tax_override_reason: '',
                          tds_override_reason: '',
                        };
                        const componentBreakdown = payslip.component_breakdown || {};
                        const componentEarnings = Array.isArray(componentBreakdown.earnings) ? componentBreakdown.earnings : [];
                        const employerCosts = Array.isArray(componentBreakdown.employer_costs) ? componentBreakdown.employer_costs : [];

                        return (
                          <React.Fragment key={payslip.id}>
                            <tr className={`transition hover:bg-slate-50/80 ${isExpanded ? 'bg-indigo-50/30 font-medium' : ''}`}>
                              {/* Expand/Collapse Chevron Button */}
                              <td className="w-8 px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpand(payslip.id)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                                  title={isExpanded ? 'Collapse breakdown' : 'Expand full details'}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </td>

                              {/* Employee Details */}
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-900">{payslip.first_name} {payslip.last_name}</div>
                                <div className="text-[11px] text-slate-500">{payslip.employee_code} · {payslip.designation}</div>
                              </td>

                              {/* Gross Salary */}
                              <td className="px-3 py-3 font-medium text-slate-800">
                                ₹{Number(payslip.gross_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>

                              {/* Custom Bonus */}
                              <td className="px-3 py-3">
                                {Number(payslip.custom_bonus || 0) > 0 ? (
                                  <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                                    +₹{Number(payslip.custom_bonus).toLocaleString('en-IN')} <span className="text-emerald-600">({payslip.custom_bonus_label || 'Bonus'})</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Total Deductions */}
                              <td className="px-3 py-3 font-medium text-rose-700">
                                ₹{Number(payslip.total_deductions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>

                              {/* Net Salary */}
                              <td className="px-3 py-3">
                                <span className="inline-block rounded-md bg-emerald-100/80 border border-emerald-300/80 px-2 py-0.5 font-bold text-emerald-900">
                                  ₹{Number(payslip.net_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* Deductions Confirmed Badge */}
                              <td className="px-3 py-3">
                                <Badge variant={payslip.deductions_confirmed ? 'success' : 'warning'} size="sm">
                                  {payslip.deductions_confirmed ? 'Reviewed' : 'Required'}
                                </Badge>
                              </td>

                              {/* Payment Status Badge */}
                              <td className="px-3 py-3">
                                {payslip.payment_status === 'paid' ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                                      <CheckCircle2 className="h-3 w-3" /> Paid
                                    </span>
                                    <div className="mt-0.5 text-[10px] text-emerald-700 truncate max-w-[120px]" title={`Via ${payslip.payment_mode || 'Bank'} · Ref: ${payslip.payment_reference || 'N/A'}`}>
                                      {payslip.payment_mode || 'Bank'} {payslip.payment_reference ? `(${payslip.payment_reference})` : ''}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                    <Clock className="h-3 w-3" /> Unpaid
                                  </span>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => openPaymentModal(payslip)}
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                        payslip.payment_status === 'paid'
                                          ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                      }`}
                                      title="Disburse or edit payment information"
                                    >
                                      <CreditCard className="h-3 w-3" />
                                      <span>{payslip.payment_status === 'paid' ? 'Edit Pay' : 'Pay'}</span>
                                    </button>
                                  )}
                                  {isSuperAdmin && selectedRun?.status !== 'locked' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdjustingPayslipId(cur => cur === payslip.id ? null : payslip.id);
                                        if (!isExpanded) toggleRowExpand(payslip.id);
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-[11px] font-semibold transition ${
                                        isAdjusting ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                      }`}
                                      title="Add custom bonus, late penalty, or fines"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                      <span>Adjust</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleRowExpand(payslip.id)}
                                    className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    {isExpanded ? 'Hide' : 'Details'}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Details Accordion Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 border-b-2 border-indigo-100">
                                <td colSpan={9} className="p-4">
                                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    {/* Header Info */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                      <div>
                                        <h5 className="font-bold text-slate-900">{payslip.first_name} {payslip.last_name} — Detailed Breakdown</h5>
                                        <p className="text-xs text-slate-500">
                                          {payslip.employee_code} · {payslip.designation} · Period: {selectedRun?.month_name}
                                        </p>
                                      </div>
                                      {payslip.payment_status === 'paid' && (
                                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-800">
                                          Paid on: <strong>{payslip.paid_at ? payslip.paid_at.slice(0, 10) : 'N/A'}</strong> via <strong>{payslip.payment_mode || 'Bank Transfer'}</strong>
                                          {payslip.payment_reference ? ` (Ref: ${payslip.payment_reference})` : ''}
                                          {payslip.paid_by ? ` by ${payslip.paid_by}` : ''}
                                        </div>
                                      )}
                                    </div>

                                    {/* Salary Numbers Grid */}
                                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                                      {[
                                        ['Gross', payslip.gross_salary],
                                        ['Basic', payslip.basic_salary],
                                        ['HRA', payslip.hra],
                                        ['Special allowance', payslip.special_allowance],
                                        Number(payslip.custom_bonus || 0) > 0 ? [`Custom Bonus (${payslip.custom_bonus_label || 'Incentive'})`, payslip.custom_bonus] : null,
                                        ['Employee PF', payslip.pf_employee],
                                        ['Employee ESI', payslip.esi_employee],
                                        ['LOP deduction', payslip.lop_deduction],
                                        Number(payslip.late_penalty_amount || 0) > 0 ? ['Late Penalty', payslip.late_penalty_amount] : null,
                                        Number(payslip.other_penalty_amount || 0) > 0 ? ['Other Penalty', payslip.other_penalty_amount] : null,
                                        ['Total deductions', payslip.total_deductions],
                                        ['Net salary', payslip.net_salary],
                                      ].filter(Boolean).map(([label, amount]) => (
                                        <div key={label} className={`rounded-lg p-2 ${label === 'Net salary' ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                                          <span className={`block ${label === 'Net salary' ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>{label}</span>
                                          <strong className={`mt-0.5 block ${label === 'Net salary' ? 'text-emerald-800 text-sm' : 'text-slate-900'}`}>
                                            ₹{Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                          </strong>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Itemized Penalty Breakdown */}
                                    {(Number(payslip.late_penalty_amount || 0) > 0 || Number(payslip.lop_deduction || 0) > 0 || Number(payslip.other_penalty_amount || 0) > 0) && (
                                      <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs">
                                        <div className="flex items-center gap-1.5 font-bold text-rose-900">
                                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                                          <span>Itemized Penalty & Deduction Breakdown:</span>
                                        </div>
                                        <div className="mt-2 divide-y divide-rose-200/60 space-y-1.5">
                                          {Number(payslip.late_penalty_amount || 0) > 0 && (
                                            <div className="flex items-center justify-between pt-1 text-rose-800">
                                              <div>
                                                <span className="font-semibold">Late Arrival Penalty</span>
                                                <span className="ml-1 text-[11px] text-rose-600">({payslip.late_count_summary || `${payslip.late_penalty_days || 0} half-day(s)`})</span>
                                              </div>
                                              <span className="font-bold">-₹{Number(payslip.late_penalty_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                          )}
                                          {Number(payslip.lop_deduction || 0) > 0 && (
                                            <div className="flex items-center justify-between pt-1 text-rose-800">
                                              <div>
                                                <span className="font-semibold">Loss of Pay (Unpaid Leave)</span>
                                                <span className="ml-1 text-[11px] text-rose-600">({Number(payslip.lop_days || 0)} day(s) calculated from month days)</span>
                                              </div>
                                              <span className="font-bold">-₹{Number(payslip.lop_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                          )}
                                          {Number(payslip.other_penalty_amount || 0) > 0 && (
                                            <div className="flex items-center justify-between pt-1 text-rose-800">
                                              <div>
                                                <span className="font-semibold">Disciplinary / Other Penalty</span>
                                                <span className="ml-1 text-[11px] text-rose-600">({payslip.other_penalty_reason || 'Policy deduction'})</span>
                                              </div>
                                              <span className="font-bold">-₹{Number(payslip.other_penalty_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between pt-1.5 font-bold text-rose-900">
                                            <span>Total Penalties Deducted</span>
                                            <span>-₹{(Number(payslip.late_penalty_amount || 0) + Number(payslip.lop_deduction || 0) + Number(payslip.other_penalty_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Super Admin Inline Custom Salary & Penalty Editor */}
                                    {isAdjusting && (
                                      <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 text-xs">
                                        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                                          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                                            <Edit3 className="h-4 w-4 text-indigo-600" />
                                            <span>Super Admin Adjustment: Custom Salary, Bonus & Penalty Editor</span>
                                          </div>
                                          <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                            Access: Super Admin Only
                                          </span>
                                        </div>

                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                          {/* Custom Bonus */}
                                          <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
                                            <h6 className="font-bold text-indigo-900">Custom Bonus / Incentive / Overtime</h6>
                                            <label className="block text-slate-700">
                                              Bonus Amount (₹):
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={adjustmentDrafts[payslip.id]?.custom_bonus ?? '0'}
                                                onChange={e => setAdjustmentDrafts(current => ({
                                                  ...current,
                                                  [payslip.id]: { ...current[payslip.id], custom_bonus: e.target.value }
                                                }))}
                                                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                              />
                                            </label>
                                            <label className="block text-slate-700">
                                              Bonus Label / Reason:
                                              <input
                                                type="text"
                                                maxLength={150}
                                                placeholder="e.g. Performance Incentive, Diwali Bonus, Overtime"
                                                value={adjustmentDrafts[payslip.id]?.custom_bonus_label ?? ''}
                                                onChange={e => setAdjustmentDrafts(current => ({
                                                  ...current,
                                                  [payslip.id]: { ...current[payslip.id], custom_bonus_label: e.target.value }
                                                }))}
                                                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                              />
                                            </label>
                                          </div>

                                          {/* Late Arrival Penalty */}
                                          <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
                                            <h6 className="font-bold text-rose-900">Late Arrival Penalty</h6>
                                            <div className="grid grid-cols-2 gap-2">
                                              <label className="block text-slate-700">
                                                Penalty Amount (₹):
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={adjustmentDrafts[payslip.id]?.late_penalty_amount ?? '0'}
                                                  onChange={e => setAdjustmentDrafts(current => ({
                                                    ...current,
                                                    [payslip.id]: { ...current[payslip.id], late_penalty_amount: e.target.value }
                                                  }))}
                                                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                                />
                                              </label>
                                              <label className="block text-slate-700">
                                                Penalty Days (Half-days):
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.5"
                                                  value={adjustmentDrafts[payslip.id]?.late_penalty_days ?? '0'}
                                                  onChange={e => setAdjustmentDrafts(current => ({
                                                    ...current,
                                                    [payslip.id]: { ...current[payslip.id], late_penalty_days: e.target.value }
                                                  }))}
                                                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                                />
                                              </label>
                                            </div>
                                            <label className="block text-slate-700">
                                              Late Summary / Remarks:
                                              <input
                                                type="text"
                                                maxLength={255}
                                                placeholder="e.g. 3 Late Marks (1.5 days penalty)"
                                                value={adjustmentDrafts[payslip.id]?.late_count_summary ?? ''}
                                                onChange={e => setAdjustmentDrafts(current => ({
                                                  ...current,
                                                  [payslip.id]: { ...current[payslip.id], late_count_summary: e.target.value }
                                                }))}
                                                className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                              />
                                            </label>
                                          </div>

                                          {/* Other Disciplinary / Policy Penalty */}
                                          <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-3 sm:col-span-2">
                                            <h6 className="font-bold text-rose-900">Other Disciplinary / Equipment / Policy Penalty</h6>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <label className="block text-slate-700">
                                                Penalty Amount (₹):
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={adjustmentDrafts[payslip.id]?.other_penalty_amount ?? '0'}
                                                  onChange={e => setAdjustmentDrafts(current => ({
                                                    ...current,
                                                    [payslip.id]: { ...current[payslip.id], other_penalty_amount: e.target.value }
                                                  }))}
                                                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                                />
                                              </label>
                                              <label className="block text-slate-700">
                                                Penalty Reason / Explanation:
                                                <input
                                                  type="text"
                                                  maxLength={255}
                                                  placeholder="e.g. Asset damage deduction, Disciplinary fine"
                                                  value={adjustmentDrafts[payslip.id]?.other_penalty_reason ?? ''}
                                                  onChange={e => setAdjustmentDrafts(current => ({
                                                    ...current,
                                                    [payslip.id]: { ...current[payslip.id], other_penalty_reason: e.target.value }
                                                  }))}
                                                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5"
                                                />
                                              </label>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-indigo-200 pt-3">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setAdjustingPayslipId(null)}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            disabled={savingAdjustmentId === payslip.id}
                                            onClick={() => handleSaveAdjustments(payslip)}
                                          >
                                            {savingAdjustmentId === payslip.id ? 'Recalculating & Saving…' : 'Save Adjustments & Recalculate Net'}
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Components & Employer Costs */}
                                    {(componentEarnings.length > 0 || employerCosts.length > 0) && (
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <section className="rounded-lg border border-slate-200 p-3">
                                          <h5 className="font-semibold text-slate-800">Gross salary components</h5>
                                          <ul className="mt-2 space-y-1">
                                            {componentEarnings.map(component => (
                                              <li key={component.component_key} className="flex justify-between gap-3 text-slate-600">
                                                <span>{component.name}</span>
                                                <span>₹{Number(component.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </section>
                                        <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                                          <h5 className="font-semibold text-slate-800">Employer cost (not deducted from employee pay)</h5>
                                          <ul className="mt-2 space-y-1">
                                            {employerCosts.map(component => (
                                              <li key={component.component_key} className="flex justify-between gap-3 text-slate-600">
                                                <span>{component.name}</span>
                                                <span>₹{Number(component.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                              </li>
                                            ))}
                                          </ul>
                                          <div className="mt-2 space-y-1 border-t border-teal-100 pt-2 font-semibold text-slate-800">
                                            <p className="flex justify-between gap-3">
                                              <span>Total employer cost</span>
                                              <span>₹{Number(payslip.employer_cost_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                            </p>
                                            <p className="flex justify-between gap-3">
                                              <span>Monthly CTC</span>
                                              <span>₹{Number(payslip.total_ctc_monthly || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                            </p>
                                            <p className="flex justify-between gap-3">
                                              <span>Annual CTC</span>
                                              <span>₹{Number(payslip.ctc_annual || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                            </p>
                                          </div>
                                        </section>
                                      </div>
                                    )}

                                    {/* Statutory Estimate Info */}
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                      <p>
                                        Professional Tax estimate:{' '}
                                        <strong>
                                          {payslip.professional_tax_computed == null
                                            ? 'No matching state rule'
                                            : `₹${Number(payslip.professional_tax_computed).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                                        </strong>
                                      </p>
                                      <p className="mt-1">
                                        TDS estimate for {payslip.tax_financial_year || 'this financial year'}:{' '}
                                        <strong>
                                          {payslip.tds_computed == null
                                            ? 'No reviewed declaration or matching tax slab'
                                            : `₹${Number(payslip.tds_computed).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                                        </strong>
                                      </p>
                                      {(payslip.professional_tax_override_reason || payslip.tds_override_reason) && (
                                        <p className="mt-2 border-t border-slate-200 pt-2">
                                          Override reason: {[payslip.professional_tax_override_reason, payslip.tds_override_reason].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </div>

                                    {/* Deductions Confirmation Input (Draft only) */}
                                    {canManagePayroll && ['draft', 'review'].includes(selectedRun?.status) && (
                                      <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                                        <label className="flex-1 text-xs font-medium text-slate-700">
                                          Verified Professional Tax (₹)
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            required
                                            value={draft.professional_tax}
                                            onChange={event => setDeductionDrafts(current => ({
                                              ...current,
                                              [payslip.id]: { ...draft, professional_tax: event.target.value },
                                            }))}
                                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                                          />
                                        </label>
                                        <label className="flex-1 text-xs font-medium text-slate-700">
                                          Verified TDS (₹)
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            required
                                            value={draft.tds}
                                            onChange={event => setDeductionDrafts(current => ({
                                              ...current,
                                              [payslip.id]: { ...draft, tds: event.target.value },
                                            }))}
                                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                                          />
                                        </label>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="sm:col-span-2 sm:justify-self-start"
                                          disabled={savingPayslipId === payslip.id}
                                          onClick={() => handleReviewPayslip(payslip)}
                                        >
                                          {savingPayslipId === payslip.id
                                            ? 'Saving…'
                                            : payslip.deductions_confirmed ? 'Update reviewed amounts' : 'Confirm deductions'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredPayslips.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div>
                    Showing <strong>{(currentPageSafe - 1) * pageSize + 1}</strong> to{' '}
                    <strong>{Math.min(currentPageSafe * pageSize, filteredPayslips.length)}</strong> of{' '}
                    <strong>{filteredPayslips.length}</strong> employees
                    {filteredPayslips.length !== runPayslips.length && (
                      <span className="text-slate-400 ml-1">(filtered from {runPayslips.length} total)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={currentPageSafe <= 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      icon={ChevronLeft}
                    >
                      Previous
                    </Button>
                    <span className="px-2 font-medium text-slate-700">
                      Page {currentPageSafe} of {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={currentPageSafe >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      icon={ChevronRight}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {canManagePayroll && ['draft', 'review'].includes(selectedRun?.status) && runPayslips.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-600">
                {pendingPayslips
                  ? `${pendingPayslips} payslip${pendingPayslips === 1 ? '' : 's'} still need deduction confirmation.`
                  : 'All employee deductions are confirmed and ready for verification.'}
              </p>
              <div className="flex items-center gap-2">
                {pendingPayslips > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={savingPayslipId === 'all'}
                    onClick={handleConfirmAllDeductions}
                  >
                    {savingPayslipId === 'all' ? 'Confirming all…' : `Confirm All Deductions (${pendingPayslips})`}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  icon={ShieldCheck}
                  disabled={pendingPayslips > 0 || savingPayslipId === 'all'}
                  onClick={() => handleVerifyRun(selectedRun.id)}
                >
                  Verify Payroll Run
                </Button>
              </div>
            </div>
          )}
          {canManagePayroll && selectedRun?.status === 'verified' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-600">This verified payroll is locked for edits and ready to release to employees.</p>
              <Button
                type="button"
                variant="primary"
                icon={Lock}
                onClick={() => handlePublishRun(selectedRun.id)}
              >
                Publish Payslips
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Super Admin Individual Payout Modal */}
      <Modal
        isOpen={Boolean(payingPayslip)}
        onClose={() => setPayingPayslip(null)}
        title={`Salary Payout: ${payingPayslip?.first_name} ${payingPayslip?.last_name}`}
        subtitle={`Emp Code: ${payingPayslip?.employee_code} · Net Payout: ₹${Number(payingPayslip?.net_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
      >
        <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-teal-900">
            <p className="font-semibold">Individual Employee Payout (Super Admin Exclusive)</p>
            <p className="mt-0.5 text-[11px]">
              Record or update this employee's salary payment status, transaction reference / UTR number, and mode of disbursement.
            </p>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Payment Status:</label>
            <select
              value={paymentForm.payment_status}
              onChange={e => setPaymentForm(form => ({ ...form, payment_status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white p-2"
            >
              <option value="paid">Paid (Disbursed)</option>
              <option value="unpaid">Unpaid (Pending / On Hold)</option>
            </select>
          </div>

          {paymentForm.payment_status === 'paid' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Payment Mode:</label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={e => setPaymentForm(form => ({ ...form, payment_mode: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Payment Date:</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paid_at}
                    onChange={e => setPaymentForm(form => ({ ...form, paid_at: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Payment Reference / UTR / Cheque Number:
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. UTR1234567890 or Cheque #004512"
                  value={paymentForm.payment_reference}
                  onChange={e => setPaymentForm(form => ({ ...form, payment_reference: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={() => setPayingPayslip(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingPayment}>
              {savingPayment ? 'Saving…' : 'Confirm Payout Status'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
