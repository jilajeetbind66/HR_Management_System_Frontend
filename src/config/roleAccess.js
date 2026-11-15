const allModules = [
  'dashboard',
  'developer_space',
  'projects',
  'employees',
  'organization',
  'documents',
  'attendance',
  'leaves',
  'payroll',
  'payslips',
  'expenses',
  'recruitment',
  'lifecycle',
  'assets',
  'performance',
  'training',
  'helpdesk',
  'announcements',
  'reports',
  'platform',
  'account',
];

const modulesByRole = {
  employee: [
    'dashboard', 'developer_space', 'projects', 'documents', 'attendance',
    'leaves', 'payslips', 'expenses', 'performance', 'training', 'helpdesk', 'announcements', 'account',
  ],
  manager: [
    'dashboard', 'projects', 'employees', 'documents', 'attendance', 'leaves',
    'payslips', 'expenses', 'performance', 'training', 'helpdesk', 'announcements', 'reports', 'account',
  ],
  hr_admin: [
    'dashboard', 'employees', 'organization', 'documents', 'attendance',
    'leaves', 'payslips', 'recruitment', 'lifecycle', 'training', 'helpdesk', 'announcements', 'account',
  ],
  hr_executive: [
    'dashboard', 'employees', 'organization', 'documents', 'attendance',
    'leaves', 'payslips', 'recruitment', 'lifecycle', 'training', 'helpdesk', 'announcements', 'account',
  ],
  recruiter: ['dashboard', 'payslips', 'recruitment', 'helpdesk', 'account'],
  payroll_admin: ['dashboard', 'payroll', 'payslips', 'reports', 'account'],
  auditor: ['dashboard', 'employees', 'payroll', 'payslips', 'reports', 'platform', 'account'],
  super_admin: allModules,
};

const roleLabels = {
  employee: 'Employee Dashboard',
  manager: 'Manager Dashboard',
  hr_admin: 'HR Dashboard',
  hr_executive: 'HR Dashboard',
  recruiter: 'Recruitment Dashboard',
  payroll_admin: 'Payroll Dashboard',
  auditor: 'Audit Dashboard',
  super_admin: 'Admin Dashboard',
};

const permissions = {
  'projects.manage': ['manager', 'super_admin'],
  'projects.view_own': ['employee', 'manager', 'super_admin'],
  'projects.progress.update': ['employee', 'manager', 'super_admin'],
  'projects.extension.request': ['employee', 'manager', 'super_admin'],
  'projects.submit': ['employee', 'manager', 'super_admin'],
  'payroll.view': ['payroll_admin', 'auditor', 'super_admin'],
  'payroll.manage': ['payroll_admin', 'super_admin'],
  'payslips.view_own': ['employee', 'manager', 'hr_admin', 'hr_executive', 'recruiter', 'payroll_admin', 'auditor', 'super_admin'],
  'org.view': ['hr_admin', 'hr_executive', 'auditor', 'super_admin'],
  'org.manage': ['hr_admin', 'super_admin'],
  'employees.view': ['manager', 'hr_admin', 'hr_executive', 'auditor', 'super_admin'],
  'employees.manage': ['hr_admin', 'super_admin'],
  'recruitment.view': ['hr_admin', 'hr_executive', 'recruiter', 'super_admin'],
  'recruitment.manage': ['hr_admin', 'recruiter', 'super_admin'],
  'attendance.approve': ['manager', 'hr_admin', 'hr_executive', 'super_admin'],
  'leaves.approve': ['manager', 'hr_admin', 'hr_executive', 'super_admin'],
  'announcements.create': ['hr_admin', 'super_admin'],
};

export function canAccessModule(role, module) {
  return Boolean(modulesByRole[role]?.includes(module));
}

export function getDashboardLabel(role) {
  return roleLabels[role] || 'Dashboard';
}

export function getPanelName(role) {
  if (role === 'employee') return 'Employee';
  if (role === 'manager') return 'Manager';
  if (['hr_admin', 'hr_executive', 'recruiter'].includes(role)) return 'HR';
  if (['super_admin', 'payroll_admin', 'auditor'].includes(role)) return 'Admin';
  return 'User';
}

export function hasRolePermission(role, permission) {
  return Boolean(permissions[permission]?.includes(role));
}
