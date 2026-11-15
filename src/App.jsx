import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HRMSProvider } from './context/HRMSContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './features/auth/LoginPage';

// Feature Views
import ExecutiveDashboard from './features/dashboard/ExecutiveDashboard';
import DeveloperDashboard from './features/dashboard/DeveloperDashboard';
import ProjectsView from './features/projects/ProjectsView';
import OrganizationView from './features/organization/OrganizationView';
import DocumentsView from './features/documents/DocumentsView';
import AttendanceView from './features/attendance/AttendanceView';
import LeavesView from './features/leaves/LeavesView';
import PayrollView from './features/payroll/PayrollView';
import ExpensesView from './features/expenses/ExpensesView';
import RecruitmentView from './features/recruitment/RecruitmentView';
import LifecycleView from './features/lifecycle/LifecycleView';
import AssetsView from './features/assets/AssetsView';
import PerformanceView from './features/performance/PerformanceView';
import TrainingView from './features/training/TrainingView';
import HelpdeskView from './features/helpdesk/HelpdeskView';
import AnnouncementsView from './features/announcements/AnnouncementsView';
import ReportsView from './features/reports/ReportsView';
import RoleDashboard from './features/dashboard/RoleDashboard';
import { canAccessModule, hasRolePermission } from './config/roleAccess';
import EmailChangeVerificationPage from './features/account/EmailChangeVerificationPage';

const EmployeesView = lazy(() => import('./features/employees/EmployeesView'));
const PlatformView = lazy(() => import('./features/platform/PlatformView'));
const EmployeePayslipsView = lazy(() => import('./features/payroll/EmployeePayslipsView'));
const AccountSettingsView = lazy(() => import('./features/account/AccountSettingsView'));

const TAB_ROUTES = {
  dashboard: '/dashboard',
  developer_space: '/developer-space',
  projects: '/projects',
  employees: '/employees',
  organization: '/organization',
  documents: '/documents',
  attendance: '/attendance',
  leaves: '/leaves',
  payroll: '/payroll',
  payslips: '/payslips',
  expenses: '/expenses',
  recruitment: '/recruitment',
  lifecycle: '/lifecycle',
  assets: '/assets',
  performance: '/performance',
  training: '/training',
  helpdesk: '/helpdesk',
  announcements: '/announcements',
  reports: '/reports',
  platform: '/platform',
  account: '/account',
};

const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
);

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function MainApp() {
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentPath = normalizePathname(pathname);
  const isEmailChangeVerification = currentPath === '/verify-email-change';
  const activeTab = currentPath === '/employees/create'
    ? 'employees'
    : ROUTE_TABS[currentPath] || 'dashboard';
  const canAccessCurrentPath = currentPath === '/employees/create'
    ? hasRolePermission(currentUser?.role, 'employees.manage')
    : canAccessModule(currentUser?.role, activeTab);

  useEffect(() => {
    if (isEmailChangeVerification) return;
    if (isLoading) return;

    if (!isAuthenticated) {
      if (currentPath !== '/') {
        navigate('/', { replace: true });
      }
      return;
    }

    const isKnownPath = currentPath === '/employees/create'
      || Object.prototype.hasOwnProperty.call(ROUTE_TABS, currentPath);

    if (
      !isKnownPath
      || currentPath === '/'
      || !canAccessCurrentPath
    ) {
      navigate(TAB_ROUTES.dashboard, { replace: true });
    }
  }, [activeTab, canAccessCurrentPath, currentPath, isAuthenticated, isEmailChangeVerification, isLoading, navigate]);

  const handleTabSelect = (tab) => {
    const route = TAB_ROUTES[tab];
    if (route && canAccessModule(currentUser?.role, tab) && currentPath !== route) {
      navigate(route);
    }
  };

  if (isEmailChangeVerification) {
    return <EmailChangeVerificationPage />;
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Checking secure session...</div>;
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return currentUser.role === 'super_admin'
          ? <ExecutiveDashboard onNavigate={handleTabSelect} />
          : <RoleDashboard onNavigate={handleTabSelect} />;
      case 'developer_space':
        return <DeveloperDashboard onNavigate={handleTabSelect} />;
      case 'projects':
        return <ProjectsView />;
      case 'employees':
        return <EmployeesView />;
      case 'organization':
        return <OrganizationView />;
      case 'documents':
        return <DocumentsView />;
      case 'attendance':
        return <AttendanceView />;
      case 'leaves':
        return <LeavesView />;
      case 'payroll':
        return <PayrollView />;
      case 'payslips':
        return <EmployeePayslipsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'recruitment':
        return <RecruitmentView />;
      case 'lifecycle':
        return <LifecycleView />;
      case 'assets':
        return <AssetsView />;
      case 'performance':
        return <PerformanceView />;
      case 'training':
        return <TrainingView />;
      case 'helpdesk':
        return <HelpdeskView />;
      case 'announcements':
        return <AnnouncementsView />;
      case 'reports':
        return <ReportsView />;
      case 'platform':
        return <PlatformView />;
      case 'account':
        return <AccountSettingsView />;
      default:
        return <ExecutiveDashboard onNavigate={handleTabSelect} />;
    }
  };

  if (!canAccessCurrentPath) {
    return (
      <AppLayout activeTab="dashboard" onTabSelect={handleTabSelect}>
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          This section is not available for your account. Returning to your role dashboard.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeTab={activeTab} onTabSelect={handleTabSelect}>
      <Suspense fallback={<div role="status" className="p-6 text-sm text-slate-500">Loading module...</div>}>
        {renderActiveView()}
      </Suspense>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HRMSProvider>
          <MainApp />
        </HRMSProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
