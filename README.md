# HRMS frontend navigation

The role-to-module access matrix and canonical navigation labels live in
`src/config/roleAccess.js`. `Sidebar.jsx`, `EmployeeNavbar.jsx`, and route
authorization use that configuration. These frontend checks shape navigation
and routing; backend authorization remains authoritative for API data and
actions.

| Role | Modules |
| --- | --- |
| Employee | Dashboard, My Workspace, My Projects, Documents & Policies, Attendance & Punches, Leave Management, My Payslips, Expenses & Advances, Performance & Goals, Training & LMS, Helpdesk & SLA, Announcements, Account & Security |
| Manager | Dashboard, My Workspace, Projects & Deadlines, Employees Directory, Documents & Policies, Attendance & Punches, Leave Management, My Payslips, Expenses & Advances, Performance & Goals, Training & LMS, Helpdesk & SLA, Announcements, Analytics & Reports, Account & Security |
| HR Admin / HR Executive | Dashboard, My Workspace, Projects & Deadlines, Employees Directory, Organization & Branches, Documents & Policies, Attendance & Punches, Leave Management, My Payslips, Recruitment & ATS, Lifecycle & Exit, Training & LMS, Helpdesk & SLA, Announcements, Account & Security |
| Recruiter | Dashboard, My Workspace, My Payslips, Recruitment & ATS, Helpdesk & SLA, Account & Security |
| Payroll Admin | Dashboard, My Workspace, Payroll & Statutory Tax, My Payslips, Analytics & Reports, Account & Security |
| Auditor | Dashboard, My Workspace, Employees Directory, Payroll & Statutory Tax, My Payslips, Analytics & Reports, Platform & Audit Logs, Account & Security |
| Super Admin | All modules |

Account & Security is personal sign-in management and remains available to each
role. Auditors retain read access to Platform & Audit Logs. Employees and
managers can view Announcements; publishing permissions remain role-restricted.
