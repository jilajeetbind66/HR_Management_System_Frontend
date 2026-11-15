export const assignableUserRoles = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'hr_executive', label: 'HR Executive' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'payroll_admin', label: 'Payroll Admin' },
  { value: 'auditor', label: 'Auditor' },
];

export const userRoleLabels = Object.fromEntries(
  assignableUserRoles.map(({ value, label }) => [value, label]).concat([
    ['super_admin', 'Super Admin'],
  ])
);

export const roleLoginCategory = {
  employee: 'Employee',
  manager: 'Manager',
  hr_admin: 'HR',
  hr_executive: 'HR',
  recruiter: 'HR',
  payroll_admin: 'Admin',
  auditor: 'Admin',
};

const hrAdminAssignableRoles = new Set([
  'employee',
  'manager',
  'hr_executive',
  'recruiter',
]);

export function getAssignableUserRoles(actorRole) {
  if (actorRole === 'super_admin') return assignableUserRoles;
  return assignableUserRoles.filter(({ value }) => hrAdminAssignableRoles.has(value));
}
