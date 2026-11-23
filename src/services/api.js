// Pinweb HRMS API Service
// Connects React frontend directly to Laravel REST API (/api/v1)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TOKEN_STORAGE_KEY = 'hrms_api_token';
const CACHED_USER_STORAGE_KEY = 'hrms_cached_user';

let authToken = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
const inFlightGetRequests = new Map();

export function hasAuthToken() {
  return Boolean(authToken);
}

export function setAuthToken(token, rememberMe = false) {
  authToken = token;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  if (token) {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function getCachedUser() {
  const serializedUser = localStorage.getItem(CACHED_USER_STORAGE_KEY)
    || sessionStorage.getItem(CACHED_USER_STORAGE_KEY)
    || localStorage.getItem('hrms_current_user')
    || sessionStorage.getItem('hrms_current_user');

  if (!serializedUser) return null;

  try {
    const user = JSON.parse(serializedUser);
    if (
      !user
      || typeof user !== 'object'
      || Array.isArray(user)
      || typeof user.role !== 'string'
      || (typeof user.id !== 'string' && typeof user.id !== 'number')
    ) {
      throw new TypeError('Cached user profile has an invalid shape.');
    }
    return user;
  } catch (error) {
    console.warn('[HRMS auth] Unable to restore cached user profile:', error.message);
    localStorage.removeItem(CACHED_USER_STORAGE_KEY);
    sessionStorage.removeItem(CACHED_USER_STORAGE_KEY);
    localStorage.removeItem('hrms_current_user');
    sessionStorage.removeItem('hrms_current_user');
    return null;
  }
}

export function setCachedUser(user, rememberMe) {
  localStorage.removeItem(CACHED_USER_STORAGE_KEY);
  sessionStorage.removeItem(CACHED_USER_STORAGE_KEY);
  localStorage.removeItem('hrms_current_user');
  sessionStorage.removeItem('hrms_current_user');
  localStorage.removeItem('hrms_is_authenticated');
  sessionStorage.removeItem('hrms_is_authenticated');

  if (user) {
    const useLocalStorage = rememberMe ?? Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
    const storage = useLocalStorage ? localStorage : sessionStorage;
    storage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify(user));
  }
}

function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const requestToken = authToken;
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (requestToken) {
    headers.set('Authorization', `Bearer ${requestToken}`);
  }

  const requestKey = method === 'GET' ? `${url}:${requestToken || ''}` : null;
  if (requestKey && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(data?.message || `API Error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.warn(`[HRMS API] Request failed for ${endpoint}:`, err.message);
      throw err;
    }
  })();

  if (requestKey) {
    inFlightGetRequests.set(requestKey, requestPromise);
    requestPromise.then(
      () => {
        if (inFlightGetRequests.get(requestKey) === requestPromise) {
          inFlightGetRequests.delete(requestKey);
        }
      },
      () => {
        if (inFlightGetRequests.get(requestKey) === requestPromise) {
          inFlightGetRequests.delete(requestKey);
        }
      }
    );
  }

  return requestPromise;
}

export const api = {
  // Base Health Check
  health: () => request('/health'),
  login: (identifier, password, roleType) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, role_type: roleType }),
  }),
  completeAccountSetup: (email, token, password, passwordConfirmation) => request('/auth/complete-account-setup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      token,
      password,
      password_confirmation: passwordConfirmation,
    }),
  }),
  forgotPassword: (email) => request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  resetPassword: (email, token, password, passwordConfirmation) => request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      token,
      password,
      password_confirmation: passwordConfirmation,
    }),
  }),
  currentUser: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getNotifications: () => request('/notifications'),
  markNotificationRead: (notificationId) => request(`/notifications/${notificationId}/read`, {
    method: 'POST',
  }),
  markAllNotificationsRead: () => request('/notifications/read-all', {
    method: 'POST',
  }),
  clearAllNotifications: () => request('/notifications/clear-all', {
    method: 'DELETE',
  }),
  deleteNotification: (notificationId) => request(`/notifications/${notificationId}`, {
    method: 'DELETE',
  }),
  changePassword: (currentPassword, password, passwordConfirmation) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    }),
  }),
  requestOwnEmailChange: (currentPassword, email, emailConfirmation) => request('/auth/email-change-request', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      email,
      email_confirmation: emailConfirmation,
    }),
  }),
  confirmEmailChange: (token) => request('/auth/email-change-confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
  getEmployeeDocuments: (employeeId) =>
    request(`/employee-documents${employeeId ? `?employee_id=${employeeId}` : ''}`),
  getUploads: (module, recordId) => {
    const query = new URLSearchParams({ module });
    if (recordId) query.set('record_id', recordId);
    return request(`/uploads?${query.toString()}`);
  },
  uploadFile: (file, module, { employeeId, recordId, documentType } = {}) => {
    const body = new FormData();
    body.append('file', file);
    body.append('module', module);
    if (employeeId) body.append('employee_id', employeeId);
    if (recordId) body.append('record_id', recordId);
    if (documentType) body.append('document_type', documentType);
    return request('/uploads', { method: 'POST', body });
  },
  getUploadDownload: (uploadId) => request(`/uploads/${uploadId}/download`),

  // M02 Organization
  getCompany: () => request('/organization/company'),
  updateCompany: (company) => request('/organization/company', {
    method: 'PUT',
    body: JSON.stringify(company),
  }),
  getBranches: () => request('/organization/branches'),
  createBranch: (branch) => request('/organization/branches', {
    method: 'POST',
    body: JSON.stringify(branch),
  }),
  updateBranch: (branchId, branch) => request(`/organization/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(branch),
  }),
  getDepartments: () => request('/organization/departments'),
  createDepartment: (dept) => request('/organization/departments', {
    method: 'POST',
    body: JSON.stringify(dept),
  }),
  updateDepartment: (deptId, dept) => request(`/organization/departments/${deptId}`, {
    method: 'PATCH',
    body: JSON.stringify(dept),
  }),
  deleteDepartment: (deptId) => request(`/organization/departments/${deptId}`, {
    method: 'DELETE',
  }),
  getDesignations: () => request('/organization/designations'),
  createDesignation: (desig) => request('/organization/designations', {
    method: 'POST',
    body: JSON.stringify(desig),
  }),
  updateDesignation: (desigId, desig) => request(`/organization/designations/${desigId}`, {
    method: 'PATCH',
    body: JSON.stringify(desig),
  }),
  deleteDesignation: (desigId) => request(`/organization/designations/${desigId}`, {
    method: 'DELETE',
  }),
  getHolidays: () => request('/organization/holidays'),
  createHoliday: (holiday) => request('/organization/holidays', {
    method: 'POST',
    body: JSON.stringify(holiday),
  }),
  updateHoliday: (holidayId, holiday) => request(`/organization/holidays/${holidayId}`, {
    method: 'PATCH',
    body: JSON.stringify(holiday),
  }),
  deleteHoliday: (holidayId) => request(`/organization/holidays/${holidayId}`, {
    method: 'DELETE',
  }),

  // M03 Employees Directory
  getEmployees: () => request('/employees'),
  createEmployee: (employeeData) => request('/employees', {
    method: 'POST',
    body: JSON.stringify(employeeData),
  }),
  getEmployeeArchiveImpact: (employeeId) => request(`/employees/${employeeId}/archive-impact`),
  archiveEmployee: (employeeId, reassignments = {}) => request(`/employees/${employeeId}`, {
    method: 'DELETE',
    body: JSON.stringify(reassignments),
  }),
  previewEmployeeImport: (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/employees/import/preview', { method: 'POST', body });
  },
  importEmployees: (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/employees/import', { method: 'POST', body });
  },
  getEmployeeStaffingRequests: () => request('/employee-staffing-requests'),
  createEmployeeStaffingRequest: (data) => request('/employee-staffing-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  reviewEmployeeStaffingRequest: (requestId, data) => request(`/employee-staffing-requests/${requestId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  updateEmployeeHierarchy: (employeeId, profile) => request(`/employees/${employeeId}/hierarchy`, {
    method: 'PATCH',
    body: JSON.stringify(profile),
  }),
  updateEmployeeCompensation: (employeeId, compensation) => request(`/employees/${employeeId}/compensation`, {
    method: 'PATCH',
    body: JSON.stringify(compensation),
  }),
  updateEmployeeStatutory: (employeeId, statutory) => request(`/employees/${employeeId}/statutory`, {
    method: 'PATCH',
    body: JSON.stringify(statutory),
  }),
  updateEmployeeLeadAccess: (employeeId, hasLeadAccess) => request(`/employees/${employeeId}/lead-access`, {
    method: 'PATCH',
    body: JSON.stringify({ has_lead_access: Boolean(hasLeadAccess) }),
  }),

  // M05 Attendance & Web Punch
  getAttendance: () => request('/attendance'),
  getAttendanceImports: () => request('/attendance/imports'),
  previewAttendanceImport: (uploadId) =>
    request(`/attendance/imports/${uploadId}/preview`, { method: 'POST' }),
  processAttendanceImport: (uploadId) =>
    request(`/attendance/imports/${uploadId}/process`, { method: 'POST' }),
  punchAttendance: (employeeId, location, latitude, longitude) => request('/attendance/punch', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      location,
      ...(latitude !== undefined && latitude !== null ? { latitude } : {}),
      ...(longitude !== undefined && longitude !== null ? { longitude } : {}),
    }),
  }),
  getRegularizations: () => request('/attendance/regularizations'),
  requestRegularization: (regularization) => request('/attendance/regularizations', {
    method: 'POST',
    body: JSON.stringify(regularization),
  }),
  reviewRegularization: (requestId, status) => request(`/attendance/regularizations/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  }),
  getAttendanceShiftSettings: () => request('/attendance/shift-settings'),
  updateAttendanceShiftSettings: (settings) => request('/attendance/shift-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // M06 Leave Management
  getLeaves: (scope) => request(scope ? `/leaves?scope=${encodeURIComponent(scope)}` : '/leaves'),
  getLeaveBalances: (scope) => request(scope ? `/leaves/balances?scope=${encodeURIComponent(scope)}` : '/leaves/balances'),
  applyLeave: (leaveData) => request('/leaves/apply', {
    method: 'POST',
    body: JSON.stringify(leaveData),
  }),
  reviewLeave: (leaveId, decision, remarks) => request(`/leaves/${leaveId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status: decision, remarks }),
  }),
  cancelLeave: (leaveId) => request(`/leaves/${leaveId}/cancel`, {
    method: 'POST',
  }),

  // M17 Projects & Deadlines
  getProjects: (status) => request(status ? `/projects?status=${status}` : '/projects'),
  getMyProjects: () => request('/projects/mine'),
  createProject: (projectData) => request('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  }),
  getProjectPenaltyPolicy: () => request('/project-penalty-policy'),
  updateProjectProgress: (assignmentId, progressPercent, note, version) =>
    request(`/project-assignments/${assignmentId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress_percent: progressPercent, note, version }),
    }),
  requestExtension: (assignmentId, requestedDueDate, reason, requestedBy) =>
    request(`/project-assignments/${assignmentId}/extension-requests`, {
      method: 'POST',
      body: JSON.stringify({ requested_due_date: requestedDueDate, reason, requested_by: requestedBy }),
    }),
  approveExtension: (extensionId, decision, decisionNote, reviewedBy) =>
    request(`/project-extension-requests/${extensionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, decision_note: decisionNote, reviewed_by: reviewedBy }),
    }),
  submitProjectCompletion: (assignmentId, deliverableLink, submissionNote) =>
    request(`/project-assignments/${assignmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ deliverable_link: deliverableLink, submission_note: submissionNote }),
    }),
  acceptProjectCompletion: (assignmentId, decision, remarks, acceptedBy) =>
    request(`/project-assignments/${assignmentId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ decision, remarks, accepted_by: acceptedBy }),
    }),
  assessProjectPenalty: (assignmentId, reason) => request(`/project-assignments/${assignmentId}/penalties`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  waiveProjectPenalty: (penaltyId, waiverReason) => request(`/project-penalties/${penaltyId}/waive`, {
    method: 'POST',
    body: JSON.stringify({ waiver_reason: waiverReason }),
  }),

  // M07 Payroll
  getPayrollRuns: () => request('/payroll/runs'),
  // M16 Reports & Analytics
  getReportSummary: () => request('/reports/summary'),
  getReportExport: (report, runId) => {
    const query = runId ? `?run_id=${encodeURIComponent(runId)}` : '';
    return request(`/reports/exports/${encodeURIComponent(report)}${query}`);
  },
  getMyPayslips: () => request('/payroll/payslips/mine'),
  getPayrollRunPayslips: (runId) => request(`/payroll/runs/${runId}/payslips`),
  getPayrollComponents: () => request('/payroll/components'),
  createPayrollComponent: (component) => request('/payroll/components', {
    method: 'POST',
    body: JSON.stringify(component),
  }),
  updatePayrollComponent: (componentId, component) => request(`/payroll/components/${componentId}`, {
    method: 'PATCH',
    body: JSON.stringify(component),
  }),
  getPayrollStatutoryConfig: () => request('/payroll/statutory-config'),
  createPayrollContributionConfig: (config) => request('/payroll/statutory-config/contributions', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  createProfessionalTaxRules: (rules) => request('/payroll/statutory-config/professional-tax', {
    method: 'POST',
    body: JSON.stringify(rules),
  }),
  createIncomeTaxRules: (rules) => request('/payroll/statutory-config/income-tax', {
    method: 'POST',
    body: JSON.stringify(rules),
  }),
  updateBranchProfessionalTax: (branchId, enabled) => request(`/payroll/statutory-config/branches/${branchId}/professional-tax`, {
    method: 'PATCH',
    body: JSON.stringify({ pt_applicable: enabled }),
  }),
  getPayrollTaxDeclarations: () => request('/payroll/tax-declarations'),
  updatePayrollTaxDeclaration: (employeeId, declaration) => request(`/payroll/tax-declarations/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(declaration),
  }),
  reviewPayrollPayslip: (runId, payslipId, deductions) => request(`/payroll/runs/${runId}/payslips/${payslipId}/deductions`, {
    method: 'PATCH',
    body: JSON.stringify(deductions),
  }),
  markIndividualPayslipPaid: (runId, payslipId, paymentData) => request(`/payroll/runs/${runId}/payslips/${payslipId}/pay`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),
  updatePayslipAdjustments: (runId, payslipId, adjustments) => request(`/payroll/runs/${runId}/payslips/${payslipId}/adjustments`, {
    method: 'PATCH',
    body: JSON.stringify(adjustments),
  }),
  generatePayrollRun: (year, month, scopeKey, monthName) => request('/payroll/runs', {
    method: 'POST',
    body: JSON.stringify({
      period_year: year,
      period_month: month,
      scope_key: scopeKey,
      month_name: monthName,
    }),
  }),
  verifyPayrollRun: (runId) => request(`/payroll/runs/${runId}/verify`, {
    method: 'POST',
  }),
  publishPayrollRun: (runId) => request(`/payroll/runs/${runId}/publish`, {
    method: 'POST',
  }),
  lockPayrollRun: (runId, approvedBy) => request(`/payroll/runs/${runId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ approved_by: approvedBy }),
  }),

  // M11 Assets, M14 Helpdesk, M15 Announcements
  getAssets: () => request('/assets'),
  createAsset: (asset) => request('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  }),
  assignAsset: (assetId, employeeId) => request(`/assets/${assetId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  }),
  returnAsset: (assetId) => request(`/assets/${assetId}/return`, {
    method: 'POST',
  }),
  updateAssetStatus: (assetId, status) => request(`/assets/${assetId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  getTickets: () => request('/helpdesk/tickets'),
  getTicket: (ticketId) => request(`/helpdesk/tickets/${ticketId}`),
  createTicket: (ticket) => request('/helpdesk/tickets', {
    method: 'POST',
    body: JSON.stringify(ticket),
  }),
  addTicketMessage: (ticketId, body) => request(`/helpdesk/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  }),
  updateTicketStatus: (ticketId, status) => request(`/helpdesk/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  getAnnouncements: () => request('/announcements'),
  createAnnouncement: (announcement) => request('/announcements', {
    method: 'POST',
    body: JSON.stringify(announcement),
  }),
  markAnnouncementRead: (announcementId) => request(`/announcements/${announcementId}/read`, {
    method: 'POST',
  }),
  getLifecycleCases: () => request('/lifecycle/cases'),
  createLifecycleCase: (lifecycleCase) => request('/lifecycle/cases', {
    method: 'POST',
    body: JSON.stringify(lifecycleCase),
  }),
  updateLifecycleTask: (taskId, status, notes) => request(`/lifecycle/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  }),
  relieveLifecycleCase: (caseId) => request(`/lifecycle/cases/${caseId}/relieve`, {
    method: 'POST',
  }),
  getTraining: () => request('/training'),
  createTrainingCourse: (course) => request('/training/courses', {
    method: 'POST',
    body: JSON.stringify(course),
  }),
  updateTrainingCourse: (courseId, course) => request(`/training/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(course),
  }),
  deleteTrainingCourse: (courseId) => request(`/training/courses/${courseId}`, {
    method: 'DELETE',
  }),
  assignTrainingEmployees: (courseId, employeeIds) => request(`/training/courses/${courseId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ employee_ids: employeeIds }),
  }),
  updateTrainingProgress: (enrollmentId, progressPercent) => request(`/training/enrollments/${enrollmentId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progress_percent: progressPercent }),
  }),
  reviewTrainingCompletion: (enrollmentId, decision, reviewNote) =>
    request(`/training/enrollments/${enrollmentId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_note: reviewNote }),
    }),
  getPerformance: () => request('/performance'),
  createPerformanceCycle: (year, quarter) => request('/performance/cycles', {
    method: 'POST',
    body: JSON.stringify({ year, quarter }),
  }),
  closePerformanceCycle: (cycleId) => request(`/performance/cycles/${cycleId}/close`, {
    method: 'POST',
  }),
  createPerformanceObjective: (cycleId, objective) => request(`/performance/cycles/${cycleId}/objectives`, {
    method: 'POST',
    body: JSON.stringify(objective),
  }),
  updatePerformanceObjective: (objectiveId, objective) => request(`/performance/objectives/${objectiveId}`, {
    method: 'PATCH',
    body: JSON.stringify(objective),
  }),
  deletePerformanceObjective: (objectiveId) => request(`/performance/objectives/${objectiveId}`, {
    method: 'DELETE',
  }),
  submitPerformanceObjectives: (cycleId) => request(`/performance/cycles/${cycleId}/submit-objectives`, {
    method: 'POST',
  }),
  reviewPerformanceObjective: (objectiveId, decision, managerNote) =>
    request(`/performance/objectives/${objectiveId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, manager_note: managerNote }),
    }),
  updatePerformanceKeyResultProgress: (keyResultId, progressPercent) =>
    request(`/performance/key-results/${keyResultId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ progress_percent: progressPercent }),
    }),
  submitPerformanceSelfReview: (objectiveId, rating, reviewNote) =>
    request(`/performance/objectives/${objectiveId}/self-review`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, review_note: reviewNote }),
    }),
  submitPerformanceManagerReview: (objectiveId, rating, reviewNote) =>
    request(`/performance/objectives/${objectiveId}/manager-review`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, review_note: reviewNote }),
    }),
  getExpenses: () => request('/expenses'),
  createExpenseClaim: (claim) => request('/expense-claims', {
    method: 'POST',
    body: JSON.stringify(claim),
  }),
  reviewExpenseClaim: (claimId, decision, decisionNote) => request(`/expense-claims/${claimId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, decision_note: decisionNote }),
  }),
  markExpenseClaimPaid: (claimId) => request(`/expense-claims/${claimId}/pay`, { method: 'POST' }),
  cancelExpenseClaim: (claimId) => request(`/expense-claims/${claimId}/cancel`, { method: 'POST' }),
  createLoanRequest: (loanRequest) => request('/loan-requests', {
    method: 'POST',
    body: JSON.stringify(loanRequest),
  }),
  reviewLoanRequest: (loanId, decision, decisionNote) => request(`/loan-requests/${loanId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, decision_note: decisionNote }),
  }),
  cancelLoanRequest: (loanId) => request(`/loan-requests/${loanId}/cancel`, { method: 'POST' }),
  getPolicies: () => request('/documents/policies'),
  createPolicy: (policy) => request('/documents/policies', {
    method: 'POST',
    body: JSON.stringify(policy),
  }),
  acknowledgePolicy: (policyId) => request(`/documents/policies/${policyId}/acknowledge`, { method: 'POST' }),
  archivePolicy: (policyId) => request(`/documents/policies/${policyId}/archive`, { method: 'POST' }),
  getHrLetters: () => request('/hr-letters'),
  createHrLetter: (letter) => request('/hr-letters', {
    method: 'POST',
    body: JSON.stringify(letter),
  }),
  reviewEmployeeDocument: (documentId, decision, reviewNote) =>
    request(`/employee-documents/${documentId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_note: reviewNote }),
    }),

  // M04 Recruitment
  getRecruitment: () => request('/recruitment'),
  createRecruitmentJob: (job) => request('/recruitment/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  }),
  updateRecruitmentJobStatus: (jobId, status) => request(`/recruitment/jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  createCandidate: (candidate) => request('/recruitment/candidates', {
    method: 'POST',
    body: JSON.stringify(candidate),
  }),
  updateCandidateStage: (candidateId, stage) => request(`/recruitment/candidates/${candidateId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  }),
  evaluateCandidate: (candidateId, rating, evaluationNote) =>
    request(`/recruitment/candidates/${candidateId}/evaluation`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, evaluation_note: evaluationNote }),
    }),
  convertCandidate: (candidateId) => request(`/recruitment/candidates/${candidateId}/convert`, {
    method: 'POST',
  }),

  // M00 Platform & Audit Logs
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.module) query.set('module', params.module);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request(`/platform/audit-logs${qs ? `?${qs}` : ''}`);
  },
  getSchedulerRuns: () => request('/platform/scheduler-runs'),
  getSequences: () => request('/platform/sequences'),
  getAdminUsers: () => request('/admin/users'),
  resetUserPassword: (userId, password, passwordConfirmation) => request(`/admin/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({
      password,
      password_confirmation: passwordConfirmation,
    }),
  }),
  updateUserEmail: (userId, currentPassword, email, emailConfirmation) => request(`/admin/users/${userId}/email`, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      email,
      email_confirmation: emailConfirmation,
    }),
  }),

  // M17 Lead Management
  getLeadAssignees: () => request('/leads/assignees'),
  getLeads: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.employee_id) query.set('employee_id', params.employee_id);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.follow_up_due_today) query.set('follow_up_due_today', '1');
    const qs = query.toString();
    return request(`/leads${qs ? `?${qs}` : ''}`);
  },
  getLead: (id) => request(`/leads/${id}`),
  createLead: (data) => request('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateLead: (id, data) => request(`/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteLead: (id) => request(`/leads/${id}`, {
    method: 'DELETE',
  }),
  updateLeadProgress: (id, data) => request(`/leads/${id}/progress`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export default api;
