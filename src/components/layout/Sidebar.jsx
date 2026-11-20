import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { initialBranches } from '../../data/mockData';
import { canAccessModule, getModuleLabel } from '../../config/roleAccess';
import { canReviewLeave } from '../../utils/leaveApproval';
import {
  LayoutDashboard,
  FolderGit2,
  Users,
  Building,
  Building2,
  Clock,
  CalendarCheck2,
  Banknote,
  Receipt,
  UserPlus,
  Compass,
  Laptop,
  Target,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  BarChart3,
  ShieldCheck,
  FileText,
  Code2,
  UserRound,
  LogOut,
  TrendingUp,
} from 'lucide-react';

function SidebarShell({
  isOpen,
  onClose,
  onLogout,
  showLogout = true,
  isHrWorkspace = false,
  isSuperAdmin = false,
  ariaLabel,
  navClassName = '',
  activeBranch,
  setActiveBranch,
  availableBranches,
  children,
}) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`hrms-sidebar ${isHrWorkspace ? 'hrms-sidebar--hr' : ''} fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 transform flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className={`hrms-sidebar__brand flex shrink-0 items-center border-b ${
          isHrWorkspace ? 'h-[62px] justify-start px-4' : 'h-[76px] gap-3 px-4'
        }`}>
          <img
            src={isHrWorkspace ? '/hrm-sidebar-logo.png' : '/pinweb-logo.webp'}
            alt={isHrWorkspace ? 'HRM' : ''}
            className={isHrWorkspace
              ? 'h-10 w-[100px] shrink-0 object-contain'
              : 'h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1'}
          />
          {!isHrWorkspace && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-white">Pinweb HRMS</span>
              <span className="block truncate text-[10px] font-medium text-slate-300">People · Process · Progress</span>
            </span>
          )}
        </div>

        {/* Mobile Drawer Branch Selector (Super Admin Only) */}
        {isSuperAdmin && availableBranches && availableBranches.length > 0 && (
          <div className="lg:hidden mx-3 my-2.5 rounded-xl border border-white/15 bg-white/10 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5 text-teal-200 text-[11px] font-semibold">
              <Building2 className="h-3.5 w-3.5 text-teal-300" />
              <span>Active Branch Location</span>
            </div>
            <select
              value={activeBranch || 'All Branches'}
              onChange={(e) => {
                setActiveBranch?.(e.target.value);
                onClose?.();
              }}
              className="w-full rounded-lg bg-slate-900 border border-white/20 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-400 font-medium cursor-pointer"
            >
              <option value="All Branches">All Branches (Prayagraj & Kaushambi)</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.name}>{b.name} ({b.city})</option>
              ))}
            </select>
          </div>
        )}

        <nav aria-label={ariaLabel} className={`hrms-sidebar__nav min-h-0 flex-1 overflow-y-auto overscroll-contain ${navClassName}`}>
          {children}
        </nav>

        <div className={`hrms-sidebar__footer shrink-0 border-t ${
          isHrWorkspace ? 'px-3 pb-3 pt-2' : 'p-3'
        }`}>
          <div className={`hrms-sidebar__status flex items-center justify-between px-2 py-1 text-[11px] ${
            isHrWorkspace ? 'font-medium' : 'text-slate-300'
          }`}>
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full ${
                isHrWorkspace ? 'bg-emerald-500' : 'animate-pulse bg-emerald-400'
              }`} />
              India Statutory Active
            </span>
            <span className={`font-mono text-[10px] ${
              isHrWorkspace ? '' : 'text-slate-400'
            }`}>PF/ESI/PT/TDS</span>
          </div>
          {showLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={`hrms-sidebar__logout mt-2 flex w-full items-center gap-2 rounded-lg border-t px-3 py-3 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400 ${
                isHrWorkspace
                  ? 'border-slate-900 text-rose-700'
                  : 'border-white/10 text-rose-300 hover:bg-rose-700 hover:text-white'
              }`}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function EmployeeSidebar({ activeTab, onTabSelect, isOpen, onClose, activeProjectCount }) {
  const { currentUser, activeBranch, setActiveBranch, logout } = useAuth();
  const { branches } = useHRMS();
  const availableBranches = Array.isArray(branches) && branches.length > 0 ? branches : initialBranches;
  const links = [
    { id: 'dashboard', icon: LayoutDashboard },
    { id: 'developer_space', icon: Users },
    { id: 'attendance', icon: Clock },
    { id: 'leaves', icon: CalendarCheck2 },
    { id: 'payslips', icon: Banknote },
    { id: 'my_projects', icon: FolderGit2 },
    ...(currentUser?.has_lead_access ? [{ id: 'leads', icon: TrendingUp }] : []),
    { id: 'performance', icon: BarChart3 },
    { id: 'training', icon: GraduationCap },
    { id: 'documents', icon: FileText },
    { id: 'expenses', icon: Receipt },
    { id: 'helpdesk', icon: LifeBuoy },
    { id: 'announcements', icon: Megaphone },
    { id: 'account', icon: UserRound },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  return (
    <SidebarShell
      isOpen={isOpen}
      onClose={onClose}
      onLogout={handleLogout}
      isSuperAdmin={false}
      activeBranch={activeBranch}
      setActiveBranch={setActiveBranch}
      availableBranches={availableBranches}
      ariaLabel="Employee navigation"
      navClassName="space-y-1 px-2 py-4"
    >
          {links.map(({ id, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                type="button"
                key={id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onTabSelect(id);
                  onClose?.();
                }}
                className={`hrms-sidebar__link group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  isActive ? 'hrms-sidebar__link--active' : ''
                }`}
              >
                <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-teal-200'}`} />
                <span className="truncate">{getModuleLabel('employee', id)}</span>
                {id === 'my_projects' && (
                  <span className={`hrms-sidebar__badge ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : ''
                  }`}>
                    {activeProjectCount} Active
                  </span>
                )}
              </button>
            );
          })}
    </SidebarShell>
  );
}

export default function Sidebar({ activeTab, onTabSelect, isOpen, onClose }) {
  const { currentUser, activeBranch, setActiveBranch, logout } = useAuth();
  const { projects, myProjects, leaveRequests, branches } = useHRMS();
  const availableBranches = Array.isArray(branches) && branches.length > 0 ? branches : initialBranches;
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser.role);
  const isManagerWorkspace = currentUser.role === 'manager';
  const isAdminWorkspace = currentUser.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const isEmployeeWorkspace = currentUser.role === 'employee';

  // Calculate pending counts
  const activeProjectCount = myProjects.filter((project) => project.status !== 'completed').length;
  const pendingExtensionCount = projects.reduce(
    (count, project) => count + (project.extensions || []).filter((extension) => extension.status === 'pending').length,
    0
  );
  const underReviewCount = projects.filter((project) => project.status === 'under_review').length;
  const projectReviewCount = pendingExtensionCount + underReviewCount;
  const pendingLeaves = leaveRequests.filter((leave) => canReviewLeave(leave, currentUser)).length;

  if (isEmployeeWorkspace) {
    return (
      <EmployeeSidebar
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        isOpen={isOpen}
        onClose={onClose}
        activeProjectCount={activeProjectCount}
      />
    );
  }

  const navigationGroups = [
    {
      items: [
        { id: 'dashboard', icon: LayoutDashboard },
        { id: 'developer_space', icon: Code2, badge: 'Self-Service' },
        {
          id: 'projects',
          icon: FolderGit2,
          badge: ['manager', 'hr_admin', 'hr_executive', 'super_admin'].includes(currentUser.role)
            ? `${projectReviewCount} Pending`
            : null,
          badgeColor: projectReviewCount > 0 ? 'bg-rose-500 text-white' : 'bg-white/10 text-slate-200',
          highlight: true
        }
      ]
    },
    {
      items: [
        { id: 'leads', icon: TrendingUp },
        { id: 'employees', icon: Users },
        { id: 'organization', icon: Building },
        { id: 'documents', icon: FileText }
      ]
    },
    {
      items: [
        { id: 'attendance', icon: Clock },
        { id: 'leaves', icon: CalendarCheck2, badge: pendingLeaves > 0 ? `${pendingLeaves} Req` : null },
        ...(!isAdminWorkspace ? [{ id: 'payslips', icon: Banknote }] : []),
        { id: 'payroll', icon: Banknote },
        { id: 'expenses', icon: Receipt }
      ]
    },
    {
      items: [
        { id: 'recruitment', icon: UserPlus },
        { id: 'lifecycle', icon: Compass },
        { id: 'performance', icon: Target },
        { id: 'training', icon: GraduationCap }
      ]
    },
    {
      items: [
        { id: 'assets', icon: Laptop },
        { id: 'helpdesk', icon: LifeBuoy },
        { id: 'announcements', icon: Megaphone },
        { id: 'reports', icon: BarChart3 },
        { id: 'platform', icon: ShieldCheck },
        { id: 'account', icon: UserRound },
      ]
    }
  ];

  const visibleGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => canAccessModule(currentUser, item.id)),
    }))
    .filter(group => group.items.length > 0);
  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const hrNavigationOrder = [
    'dashboard', 'leads', 'employees', 'organization', 'documents', 'attendance', 'leaves',
    'payslips', 'recruitment', 'lifecycle', 'training', 'helpdesk', 'projects',
    'developer_space', 'payroll', 'expenses', 'performance', 'reports', 'announcements', 'account',
  ];
  const hrItems = isHrWorkspace
    ? hrNavigationOrder
      .map((id) => visibleItems.find((item) => item.id === id))
      .filter(Boolean)
    : [];

  const renderNavigationItem = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => {
          onTabSelect(item.id);
          if (onClose) onClose();
        }}
        className={`hrms-sidebar__link group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
          isHrWorkspace
            ? `hrms-sidebar__link--hr min-h-[34px] justify-start gap-3 py-1.5 text-[12px] font-semibold ${
              isActive ? 'hrms-sidebar__link--active' : ''
            }`
            : isActive
              ? 'hrms-sidebar__link--active'
              : item.highlight
                ? 'hrms-sidebar__link--highlight'
                : ''
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={`h-4 w-4 shrink-0 transition ${
            isHrWorkspace
              ? 'hrms-sidebar__icon--hr'
              : isActive ? 'text-white' : item.highlight ? 'text-teal-300' : 'text-slate-400 group-hover:text-teal-200'
          }`} />
          <span className="truncate">{getModuleLabel(currentUser.role, item.id)}</span>
        </div>
        {item.badge && (
          <span className={`hrms-sidebar__badge shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isActive ? 'bg-white/20 text-white' : item.badgeColor || ''
          }`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  return (
    <SidebarShell
      isOpen={isOpen}
      onClose={onClose}
      onLogout={handleLogout}
      isSuperAdmin={currentUser?.role === 'super_admin'}
      activeBranch={activeBranch}
      setActiveBranch={setActiveBranch}
      availableBranches={availableBranches}
      showLogout={isNavyWorkspace || isHrWorkspace}
      isHrWorkspace={isHrWorkspace}
      ariaLabel="Main navigation"
      navClassName={isHrWorkspace ? 'px-3 py-3' : 'space-y-3 px-2 py-4'}
    >
      {isHrWorkspace ? (
        <div className="space-y-1">
          {hrItems.map(renderNavigationItem)}
        </div>
      ) : visibleGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                {group.items.map(renderNavigationItem)}
              </div>
            ))}
    </SidebarShell>
  );
}
