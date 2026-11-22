const allModules = [
  'dashboard',
  'developer_space',
  'my_projects',
  'projects',
  'leads',
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
    'dashboard', 'developer_space', 'my_projects', 'documents', 'attendance',
    'leaves', 'payslips', 'expenses', 'performance', 'training', 'helpdesk', 'announcements', 'account',
  ],
  manager: [
    'dashboard', 'developer_space', 'projects', 'employees', 'documents', 'attendance', 'leaves',
    'payslips', 'expenses', 'lifecycle', 'performance', 'training', 'helpdesk', 'announcements', 'reports', 'account',
  ],
  hr_admin: [
    'dashboard', 'developer_space', 'projects', 'leads', 'employees', 'organization', 'documents', 'attendance',
    'leaves', 'payroll', 'payslips', 'recruitment', 'lifecycle', 'training', 'reports', 'helpdesk', 'announcements', 'account',
  ],
  hr_executive: [
    'dashboard', 'developer_space', 'projects', 'employees', 'organization', 'documents', 'attendance',
    'leaves', 'payslips', 'recruitment', 'lifecycle', 'training', 'reports', 'helpdesk', 'announcements', 'account',
  ],
  recruiter: ['dashboard', 'developer_space', 'payslips', 'recruitment', 'helpdesk', 'announcements', 'account'],
  payroll_admin: ['dashboard', 'developer_space', 'payroll', 'payslips', 'announcements', 'reports', 'account'],
  auditor: ['dashboard', 'developer_space', 'employees', 'organization', 'payroll', 'payslips', 'announcements', 'reports', 'platform', 'account'],
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

const moduleLabels = {
  developer_space: 'My Workspace',
  my_projects: 'My Projects',
  projects: 'Projects & Deadlines',
  leads: 'Lead Management',
  employees: 'Employees Directory',
  organization: 'Organization & Branches',
  documents: 'Documents & Policies',
  attendance: 'Attendance & Punches',
  leaves: 'Leave Management',
  payroll: 'Payroll & Statutory Tax',
  payslips: 'My Payslips',
  expenses: 'Expenses & Advances',
  recruitment: 'Recruitment & ATS',
  lifecycle: 'Lifecycle & Exit',
  assets: 'Asset Register',
  performance: 'Performance & Goals',
  training: 'Training & LMS',
  helpdesk: 'Helpdesk & SLA',
  announcements: 'Announcements',
  reports: 'Analytics & Reports',
  platform: 'Platform & Audit Logs',
  account: 'Account & Security',
};

const permissions = {
  'projects.manage': ['manager', 'super_admin'],
  'projects.create': ['manager', 'hr_admin', 'hr_executive', 'super_admin'],
  'projects.view_own': ['employee', 'manager', 'super_admin'],
  'projects.progress.update': ['employee', 'manager', 'super_admin'],
  'projects.extension.request': ['employee', 'manager', 'super_admin'],
  'projects.submit': ['employee', 'manager', 'super_admin'],
  'payroll.view': ['hr_admin', 'payroll_admin', 'auditor', 'super_admin'],
  'payroll.manage': ['payroll_admin', 'super_admin'],
  'payroll.components.manage': ['hr_admin', 'super_admin'],
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
  'leads.manage': ['hr_admin', 'super_admin'],
  'leads.view': ['employee', 'manager', 'recruiter', 'payroll_admin', 'auditor', 'hr_executive', 'hr_admin', 'super_admin'],
};

export function canAccessModule(userOrRole, module) {
  const role = typeof userOrRole === 'object' && userOrRole !== null ? userOrRole.role : userOrRole;
  if (module === 'leads') {
    if (['super_admin', 'hr_admin'].includes(role)) return true;
    if (typeof userOrRole === 'object' && userOrRole !== null) {
      return Boolean(userOrRole.has_lead_access);
    }
    return false;
  }
  return Boolean(modulesByRole[role]?.includes(module));
}

export function getDashboardLabel(role) {
  return roleLabels[role] || 'Dashboard';
}

export function getModuleLabel(role, module) {
  return module === 'dashboard'
    ? getDashboardLabel(role)
    : moduleLabels[module] || module;
}

export function getRoleMenuItems(userOrRole) {
  const role = typeof userOrRole === 'object' && userOrRole !== null ? userOrRole.role : userOrRole;
  let modules = [...(modulesByRole[role] || [])];
  if (typeof userOrRole === 'object' && userOrRole?.has_lead_access) {
    if (!modules.includes('leads')) {
      const idx = modules.indexOf('my_projects');
      if (idx !== -1) {
        modules.splice(idx + 1, 0, 'leads');
      } else {
        modules.splice(1, 0, 'leads');
      }
    }
  }
  return modules.map((module) => ({
    module,
    label: getModuleLabel(role, module),
  }));
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