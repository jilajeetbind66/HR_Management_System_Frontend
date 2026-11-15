import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from './AuthContext';

const HRMSContext = createContext(null);

const emptyRecruitment = () => ({ jobs: [], candidates: [] });
const responseDataArray = (response) => Array.isArray(response?.data) ? response.data : [];

const ROUTE_TABS = {
  '/dashboard': 'dashboard',
  '/developer-space': 'developer_space',
  '/projects': 'projects',
  '/employees': 'employees',
  '/organization': 'organization',
  '/documents': 'documents',
  '/attendance': 'attendance',
  '/leaves': 'leaves',
  '/payroll': 'payroll',
  '/payslips': 'payslips',
  '/expenses': 'expenses',
  '/recruitment': 'recruitment',
  '/lifecycle': 'lifecycle',
  '/assets': 'assets',
  '/performance': 'performance',
  '/training': 'training',
  '/helpdesk': 'helpdesk',
  '/announcements': 'announcements',
  '/reports': 'reports',
  '/platform': 'platform',
};

const DASHBOARD_DATA_BY_ROLE = {
  employee: ['projects', 'attendance', 'leaves', 'leaveBalances', 'regularizations', 'announcements'],
  manager: ['employees', 'projects', 'attendance', 'leaves', 'announcements', 'branches'],
  super_admin: ['employees', 'projects', 'attendance', 'leaves', 'payrollRuns', 'branches', 'announcements'],
  hr_admin: ['employees', 'attendance', 'leaves', 'branches', 'announcements'],
  hr_executive: ['employees', 'attendance', 'leaves', 'branches', 'announcements'],
  recruiter: ['announcements'],
  payroll_admin: ['payrollRuns'],
  auditor: ['auditLogs', 'payrollRuns', 'branches'],
};

const MODULE_DATA = {
  developer_space: ['projects', 'attendance', 'leaveBalances'],
  projects: ['projects', 'employees', 'penaltyPolicy'],
  employees: ['employees', 'branches', 'departments'],
  organization: ['company', 'branches', 'departments', 'designations', 'holidays'],
  documents: ['employees'],
  attendance: ['attendance', 'regularizations', 'employees'],
  leaves: ['leaves', 'leaveBalances'],
  payroll: ['payrollRuns', 'branches'],
  recruitment: ['recruitment', 'branches'],
  lifecycle: ['employees'],
  training: ['employees'],
  assets: ['assets', 'employees', 'branches'],
  helpdesk: ['tickets'],
  announcements: ['announcements', 'branches'],
  platform: ['auditLogs'],
};

export function HRMSProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [company, setCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [penaltyPolicy, setPenaltyPolicy] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [regularizationRequests, setRegularizationRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [recruitment, setRecruitment] = useState(emptyRecruitment);
  const [tickets, setTickets] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendError, setBackendError] = useState(null);
  const loadedResources = useRef(new Set());
  const inFlightResources = useRef(new Map());
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const activeTab = normalizedPath === '/employees/create'
    ? 'employees'
    : ROUTE_TABS[normalizedPath] || 'dashboard';

  const clearRemoteData = useCallback(() => {
    loadedResources.current.clear();
    inFlightResources.current.clear();
    setCompany(null);
    setBranches([]);
    setDepartments([]);
    setDesignations([]);
    setHolidays([]);
    setEmployees([]);
    setProjects([]);
    setPenaltyPolicy(null);
    setAttendance([]);
    setRegularizationRequests([]);
    setLeaveBalances({});
    setLeaveRequests([]);
    setPayrollRuns([]);
    setRecruitment(emptyRecruitment());
    setTickets([]);
    setAnnouncements([]);
    setAuditLogs([]);
    setAssets([]);
  }, []);

  const syncWithBackend = useCallback(async (tab = activeTab) => {
    const role = currentUser?.role;
    const canViewOrganization = ['super_admin', 'hr_admin', 'hr_executive', 'manager', 'auditor'].includes(role);
    const canViewEmployees = ['super_admin', 'hr_admin', 'hr_executive', 'manager', 'auditor'].includes(role);
    const canViewProjects = ['employee', 'manager', 'super_admin'].includes(role);
    const canViewWorkforce = ['employee', 'manager', 'hr_admin', 'hr_executive', 'super_admin'].includes(role);
    const canViewAssets = role === 'super_admin';
    const canViewHelpdesk = ['employee', 'manager', 'hr_admin', 'hr_executive', 'recruiter', 'super_admin'].includes(role);
    const canViewAnnouncements = ['employee', 'manager', 'hr_admin', 'hr_executive', 'recruiter', 'super_admin'].includes(role);
    const canViewPayroll = ['super_admin', 'payroll_admin', 'auditor'].includes(role);
    const canViewAudit = ['super_admin', 'auditor'].includes(role);
    const canViewRecruitment = ['super_admin', 'hr_admin', 'hr_executive', 'recruiter'].includes(role);

    const availableResources = {
      health: true,
      company: canViewOrganization,
      branches: canViewOrganization,
      departments: canViewOrganization,
      designations: canViewOrganization,
      holidays: canViewOrganization,
      employees: canViewEmployees,
      projects: canViewProjects,
      penaltyPolicy: canViewProjects,
      attendance: canViewWorkforce,
      regularizations: canViewWorkforce,
      leaves: canViewWorkforce,
      leaveBalances: canViewWorkforce,
      payrollRuns: canViewPayroll,
      auditLogs: canViewAudit,
      recruitment: canViewRecruitment,
      tickets: canViewHelpdesk,
      announcements: canViewAnnouncements,
      assets: canViewAssets,
    };
    const resourceLoaders = {
      health: async () => {
        const response = await api.health();
        if (response?.status !== 'healthy') {
          throw new Error('The HRMS API health check did not succeed.');
        }
        return null;
      },
      company: async () => (await api.getCompany())?.data || null,
      branches: async () => responseDataArray(await api.getBranches()),
      departments: async () => responseDataArray(await api.getDepartments()),
      designations: async () => responseDataArray(await api.getDesignations()),
      holidays: async () => responseDataArray(await api.getHolidays()),
      employees: async () => responseDataArray(await api.getEmployees()),
      projects: async () => responseDataArray(await api.getProjects()),
      penaltyPolicy: async () => (await api.getProjectPenaltyPolicy())?.data || null,
      attendance: async () => responseDataArray(await api.getAttendance()),
      regularizations: async () => responseDataArray(await api.getRegularizations()),
      leaves: async () => responseDataArray(await api.getLeaves()),
      leaveBalances: async () => (await api.getLeaveBalances())?.data || {},
      payrollRuns: async () => responseDataArray(await api.getPayrollRuns()),
      auditLogs: async () => responseDataArray(await api.getAuditLogs()),
      recruitment: async () => (await api.getRecruitment())?.data || emptyRecruitment(),
      tickets: async () => responseDataArray(await api.getTickets()),
      announcements: async () => responseDataArray(await api.getAnnouncements()),
      assets: async () => responseDataArray(await api.getAssets()),
    };

    const moduleResources = tab === 'employees' && role === 'manager'
      ? ['employees', 'branches']
      : MODULE_DATA[tab] || [];
    const requestedResources = new Set([
      ...(tab === 'dashboard' ? DASHBOARD_DATA_BY_ROLE[role] || [] : []),
      ...moduleResources,
      'health',
    ]);
    const resourcesToLoad = [...requestedResources].filter(
      (key) => availableResources[key] && !loadedResources.current.has(key)
    );

    if (!resourcesToLoad.length) {
      setBackendError(null);
      setBackendStatus('connected');
      return true;
    }

    const loadResource = (key) => {
      if (inFlightResources.current.has(key)) {
        return inFlightResources.current.get(key);
      }

      const request = resourceLoaders[key]()
        .finally(() => inFlightResources.current.delete(key));
      inFlightResources.current.set(key, request);
      return request;
    };

    try {
      setBackendStatus('checking');
      setBackendError(null);
      const responses = await Promise.all(resourcesToLoad.map(loadResource));
      const loadedData = Object.fromEntries(
        resourcesToLoad.map((key, index) => [key, responses[index]])
      );
      if ('company' in loadedData) setCompany(loadedData.company);
      if ('branches' in loadedData) setBranches(loadedData.branches);
      if ('departments' in loadedData) setDepartments(loadedData.departments);
      if ('designations' in loadedData) setDesignations(loadedData.designations);
      if ('holidays' in loadedData) setHolidays(loadedData.holidays);
      if ('employees' in loadedData) setEmployees(loadedData.employees);
      if ('projects' in loadedData) setProjects(loadedData.projects);
      if ('penaltyPolicy' in loadedData) setPenaltyPolicy(loadedData.penaltyPolicy);
      if ('attendance' in loadedData) setAttendance(loadedData.attendance);
      if ('regularizations' in loadedData) setRegularizationRequests(loadedData.regularizations);
      if ('leaves' in loadedData) setLeaveRequests(loadedData.leaves);
      if ('leaveBalances' in loadedData) setLeaveBalances(loadedData.leaveBalances);
      if ('payrollRuns' in loadedData) setPayrollRuns(loadedData.payrollRuns);
      if ('auditLogs' in loadedData) setAuditLogs(loadedData.auditLogs);
      if ('recruitment' in loadedData) setRecruitment(loadedData.recruitment);
      if ('tickets' in loadedData) setTickets(loadedData.tickets);
      if ('announcements' in loadedData) setAnnouncements(loadedData.announcements);
      if ('assets' in loadedData) setAssets(loadedData.assets);
      resourcesToLoad.forEach((key) => loadedResources.current.add(key));
      setBackendStatus('connected');
      return true;
    } catch (error) {
      clearRemoteData();
      setBackendStatus('offline');
      setBackendError(error?.data?.message || error.message || 'Unable to load HRMS records from the server.');
      return false;
    }
  }, [activeTab, clearRemoteData, currentUser?.role]);

  useEffect(() => {
    if (isAuthenticated) {
      syncWithBackend(activeTab);
      return;
    }

    clearRemoteData();
    setBackendStatus('checking');
    setBackendError(null);
  }, [activeTab, clearRemoteData, isAuthenticated, syncWithBackend]);

  const refreshProjects = async () => {
    const response = await api.getProjects();
    setProjects(Array.isArray(response?.data) ? response.data : []);
    loadedResources.current.add('projects');
  };

  const refreshAttendance = async () => {
    const [attendanceResponse, regularizationsResponse] = await Promise.all([
      api.getAttendance(),
      api.getRegularizations(),
    ]);
    setAttendance(Array.isArray(attendanceResponse?.data) ? attendanceResponse.data : []);
    setRegularizationRequests(Array.isArray(regularizationsResponse?.data) ? regularizationsResponse.data : []);
    loadedResources.current.add('attendance');
    loadedResources.current.add('regularizations');
  };

  const refreshLeaveData = async () => {
    const [leavesResponse, leaveBalancesResponse] = await Promise.all([
      api.getLeaves(),
      api.getLeaveBalances(),
    ]);
    setLeaveRequests(Array.isArray(leavesResponse?.data) ? leavesResponse.data : []);
    setLeaveBalances(leaveBalancesResponse?.data || {});
    loadedResources.current.add('leaves');
    loadedResources.current.add('leaveBalances');
  };

  const findAssignmentId = (projectId) => {
    const project = projects.find((item) => Number(item.id) === Number(projectId));
    if (!project?.assignment_id) {
      throw new Error('Project assignment was not found. Reload the project list and try again.');
    }
    return project.assignment_id;
  };

  const createProject = async (projectData) => {
    const response = await api.createProject({
      name: projectData.name,
      description: projectData.description,
      deliverable: projectData.deliverable,
      priority: projectData.priority || 'Medium',
      assigned_employee_id: Number(projectData.assigned_employee_id),
      start_date: projectData.start_date,
      planned_end_date: projectData.planned_end_date,
    });
    await refreshProjects();
    return response?.data;
  };

  const updateProjectProgress = async (projectId, progressPercent, note) => {
    const project = projects.find((item) => Number(item.id) === Number(projectId));
    if (!project) {
      throw new Error('Project was not found. Reload the project list and try again.');
    }
    await api.updateProjectProgress(
      findAssignmentId(projectId),
      progressPercent,
      note,
      project.version || 1
    );
    await refreshProjects();
  };

  const requestExtension = async (projectId, requestedDueDate, reason) => {
    await api.requestExtension(findAssignmentId(projectId), requestedDueDate, reason);
    await refreshProjects();
  };

  const reviewExtension = async (_projectId, extensionId, decision, decisionNote) => {
    await api.approveExtension(extensionId, decision, decisionNote);
    await refreshProjects();
  };

  const submitProjectCompletion = async (projectId, submissionNote, deliverableLink) => {
    await api.submitProjectCompletion(findAssignmentId(projectId), deliverableLink, submissionNote);
    await refreshProjects();
  };

  const reviewProjectCompletion = async (projectId, decision, reviewNote) => {
    await api.acceptProjectCompletion(
      findAssignmentId(projectId),
      decision === 'accept' ? 'accept' : 'return',
      reviewNote
    );
    await refreshProjects();
  };

  const assessPenalty = async (projectId, penaltyData) => {
    await api.assessProjectPenalty(findAssignmentId(projectId), penaltyData.reason);
    await refreshProjects();
  };

  const waivePenalty = async (_projectId, penaltyId, waiverReason) => {
    await api.waiveProjectPenalty(penaltyId, waiverReason);
    await refreshProjects();
  };

  const punchAttendance = async (employeeId, location = 'Web Client Portal') => {
    const response = await api.punchAttendance(Number(employeeId), location);
    if (response?.data) {
      setAttendance((previous) => {
        const isSameRecord = (record) => (
          Number(record.id) === Number(response.data.id)
          || (
            Number(record.employee_id) === Number(response.data.employee_id)
            && record.date === response.data.date
          )
        );
        const exists = previous.some(isSameRecord);
        return exists
          ? previous.map((record) => isSameRecord(record) ? response.data : record)
          : [response.data, ...previous];
      });
    }
    return { type: response?.type || 'in', punch: response?.data || null };
  };

  const submitRegularization = async (requestData) => {
    const response = await api.requestRegularization({
      date: requestData.date,
      punch_in_requested: requestData.punch_in_requested,
      punch_out_requested: requestData.punch_out_requested,
      reason: requestData.reason,
    });
    await refreshAttendance();
    return response?.data;
  };

  const reviewRegularization = async (requestId, decision) => {
    await api.reviewRegularization(requestId, decision);
    await refreshAttendance();
  };

  const applyLeave = async (leaveData) => {
    const response = await api.applyLeave({
      employee_id: Number(leaveData.employee_id),
      leave_type: leaveData.leave_type,
      from_date: leaveData.from_date,
      to_date: leaveData.to_date,
      days: Number(leaveData.days),
      reason: leaveData.reason,
    });
    const savedLeave = response?.data
      ? {
        ...response.data,
        employee_name: [response.data.first_name, response.data.last_name].filter(Boolean).join(' ')
          || leaveData.employee_name,
      }
      : null;
    if (savedLeave) {
      setLeaveRequests((previous) => [
        savedLeave,
        ...previous.filter((leave) => Number(leave.id) !== Number(savedLeave.id)),
      ]);
      loadedResources.current.add('leaves');
    }
    return savedLeave;
  };

  const reviewLeave = async (leaveId, decision) => {
    await api.reviewLeave(leaveId, decision);
    await refreshLeaveData();
  };

  const refreshPayrollRuns = async () => {
    const response = await api.getPayrollRuns();
    const runs = Array.isArray(response?.data) ? response.data : [];
    setPayrollRuns(runs);
    return runs;
  };

  const runPayroll = async (monthName, year, scopeKey = 'company') => {
    const monthNumber = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
    const response = await api.generatePayrollRun(year, monthNumber, scopeKey, `${monthName} ${year}`);
    await refreshPayrollRuns();
    return response?.data;
  };

  const lockPayroll = async (runId) => {
    await api.lockPayrollRun(runId);
    await refreshPayrollRuns();
  };

  const addEmployee = async (employeeData) => {
    const response = await api.createEmployee({
      first_name: employeeData.first_name,
      last_name: employeeData.last_name,
      email: employeeData.email,
      role: employeeData.role || 'employee',
      phone: employeeData.phone,
      gender: employeeData.gender,
      date_of_birth: employeeData.date_of_birth,
      branch_id: Number(employeeData.branch_id),
      designation: employeeData.designation,
      department: employeeData.department,
      date_of_joining: employeeData.date_of_joining || new Date().toISOString().substring(0, 10),
      pan: employeeData.pan,
      uan: employeeData.uan,
      pf_applicable: employeeData.pf_applicable,
      esi_applicable: employeeData.esi_applicable,
      pt_state: employeeData.pt_state,
      tax_regime: employeeData.tax_regime,
      ctc_annual: employeeData.ctc_annual,
      gross_monthly: employeeData.gross_monthly,
      basic_monthly: employeeData.basic_monthly,
      bank_name: employeeData.bank_name,
      account_number: employeeData.account_number,
      ifsc_code: employeeData.ifsc_code,
    });
    const employeesResponse = await api.getEmployees();
    setEmployees(Array.isArray(employeesResponse?.data) ? employeesResponse.data : []);
    return {
      ...response?.data,
      credentials: response?.credentials,
    };
  };

  const updateEmployeeAvatar = (employeeId, avatarUrl) => {
    setEmployees((previous) => previous.map((employee) => (
      Number(employee.id) === Number(employeeId)
        ? { ...employee, avatar: avatarUrl }
        : employee
    )));
  };

  const upsertTicket = (ticket) => {
    setTickets((previous) => [
      ticket,
      ...previous.filter((item) => Number(item.id) !== Number(ticket.id)),
    ]);
    loadedResources.current.add('tickets');
    return ticket;
  };

  const createTicket = async (ticketData) => {
    const response = await api.createTicket(ticketData);
    return upsertTicket(response.data);
  };

  const addTicketMessage = async (ticketId, body) => {
    const response = await api.addTicketMessage(ticketId, body);
    return upsertTicket(response.data);
  };

  const updateTicketStatus = async (ticketId, status) => {
    const response = await api.updateTicketStatus(ticketId, status);
    return upsertTicket(response.data);
  };

  const upsertAnnouncement = (announcement) => {
    setAnnouncements((previous) => [
      announcement,
      ...previous.filter((item) => Number(item.id) !== Number(announcement.id)),
    ]);
    loadedResources.current.add('announcements');
    return announcement;
  };

  const createAnnouncement = async (announcementData) => {
    const response = await api.createAnnouncement(announcementData);
    return upsertAnnouncement(response.data);
  };

  const markAnnouncementRead = async (announcementId) => {
    const response = await api.markAnnouncementRead(announcementId);
    return upsertAnnouncement(response.data);
  };

  const upsertAsset = (asset) => {
    setAssets((previous) => [
      asset,
      ...previous.filter((item) => Number(item.id) !== Number(asset.id)),
    ]);
    loadedResources.current.add('assets');
    return asset;
  };

  const createAsset = async (assetData) => {
    const response = await api.createAsset(assetData);
    return upsertAsset(response.data);
  };

  const assignAsset = async (assetId, employeeId) => {
    const response = await api.assignAsset(assetId, Number(employeeId));
    return upsertAsset(response.data);
  };

  const returnAsset = async (assetId) => {
    const response = await api.returnAsset(assetId);
    return upsertAsset(response.data);
  };

  const updateAssetStatus = async (assetId, status) => {
    const response = await api.updateAssetStatus(assetId, status);
    return upsertAsset(response.data);
  };

  const createRecruitmentJob = async (jobData) => {
    const response = await api.createRecruitmentJob(jobData);
    const recruitmentResponse = await api.getRecruitment();
    setRecruitment(recruitmentResponse.data || emptyRecruitment());
    return response?.data;
  };

  const updateRecruitmentJobStatus = async (jobId, status) => {
    await api.updateRecruitmentJobStatus(jobId, status);
    const response = await api.getRecruitment();
    setRecruitment(response.data || emptyRecruitment());
  };

  const createCandidate = async (candidateData) => {
    const response = await api.createCandidate(candidateData);
    const recruitmentResponse = await api.getRecruitment();
    setRecruitment(recruitmentResponse.data || emptyRecruitment());
    return response?.data;
  };

  const updateCandidateStage = async (candidateId, stage) => {
    await api.updateCandidateStage(candidateId, stage);
    const response = await api.getRecruitment();
    setRecruitment(response.data || emptyRecruitment());
  };

  const evaluateCandidate = async (candidateId, rating, evaluationNote) => {
    await api.evaluateCandidate(candidateId, rating, evaluationNote);
    const response = await api.getRecruitment();
    setRecruitment(response.data || emptyRecruitment());
  };

  const convertCandidate = async (candidateId) => {
    const response = await api.convertCandidate(candidateId);
    const recruitmentResponse = await api.getRecruitment();
    setRecruitment(recruitmentResponse.data || emptyRecruitment());
    return response?.data;
  };

  return (
    <HRMSContext.Provider value={{
      company,
      branches,
      departments,
      designations,
      holidays,
      employees,
      addEmployee,
      updateEmployeeAvatar,
      projects,
      createProject,
      updateProjectProgress,
      requestExtension,
      reviewExtension,
      submitProjectCompletion,
      reviewProjectCompletion,
      assessPenalty,
      waivePenalty,
      penaltyPolicy,
      attendance,
      punchAttendance,
      regularizationRequests,
      submitRegularization,
      reviewRegularization,
      leaveBalances,
      leaveRequests,
      applyLeave,
      reviewLeave,
      payrollRuns,
      refreshPayrollRuns,
      runPayroll,
      lockPayroll,
      recruitment,
      createRecruitmentJob,
      updateRecruitmentJobStatus,
      createCandidate,
      updateCandidateStage,
      evaluateCandidate,
      convertCandidate,
      tickets,
      createTicket,
      addTicketMessage,
      updateTicketStatus,
      announcements,
      createAnnouncement,
      markAnnouncementRead,
      auditLogs,
      assets,
      createAsset,
      assignAsset,
      returnAsset,
      updateAssetStatus,
      backendStatus,
      backendError,
      syncWithBackend,
      api,
    }}>
      {children}
    </HRMSContext.Provider>
  );
}

export function useHRMS() {
  const context = useContext(HRMSContext);
  if (!context) {
    throw new Error('useHRMS must be used within a HRMSProvider');
  }
  return context;
}
