export function canReviewLeave(request, user) {
  if (!request || !user || request.status !== 'pending') return false;
  if (
    user.employee_id != null
    && Number(request.employee_id) === Number(user.employee_id)
  ) {
    return false;
  }

  switch (request.next_approver_role) {
    case 'manager':
      return user.role === 'manager'
        && user.employee_id != null
        && request.reporting_manager_employee_id != null
        && Number(request.reporting_manager_employee_id) === Number(user.employee_id);
    case 'hr':
      return ['super_admin', 'hr_admin', 'hr_executive'].includes(user.role);
    case 'super_admin':
      return user.role === 'super_admin';
    case 'super_admin_or_hr_head':
      return ['super_admin', 'hr_admin'].includes(user.role);
    default:
      return false;
  }
}
