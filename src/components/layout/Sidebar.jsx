import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import { canAccessModule, getDashboardLabel } from '../../config/roleAccess';
import {
  LayoutDashboard,
  FolderGit2,
  Users,
  Building,
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
  ChevronRight,
  Flame,
  LogOut,
} from 'lucide-react';

function EmployeeSidebar({ activeTab, onTabSelect, isOpen, onClose }) {
  const { logout } = useAuth();
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'developer_space', label: 'My Workspace', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leaves', label: 'Leave Management', icon: CalendarCheck2 },
    { id: 'payslips', label: 'My Payslips', icon: Banknote },
    { id: 'projects', label: 'My Projects', icon: FolderGit2 },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'training', label: 'Training & Development', icon: GraduationCap },
    { id: 'documents', label: 'Policies & Notices', icon: FileText },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'helpdesk', label: 'Help & Support', icon: LifeBuoy },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'account', label: 'Account & Security', icon: UserRound },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

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
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[232px] shrink-0 transform flex-col overflow-hidden bg-[#101a38] text-white shadow-2xl transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-20 h-56 w-56 rounded-full border border-orange-400/10" />
        <div className="relative flex h-[76px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <svg aria-hidden="true" viewBox="0 0 64 48" className="h-10 w-12 shrink-0">
            <circle cx="16" cy="13" r="6" fill="#ff8a00" />
            <path d="M5 42v-6c0-6 4-10 11-10s11 4 11 10v6H5Z" fill="#ff8a00" />
            <circle cx="48" cy="13" r="6" fill="#10b981" />
            <path d="M37 42v-6c0-6 4-10 11-10s11 4 11 10v6H37Z" fill="#10b981" />
            <circle cx="32" cy="10" r="8" fill="#1496ff" />
            <path d="M18 44v-8c0-8 5-13 14-13s14 5 14 13v8H18Z" fill="#1496ff" />
          </svg>
          <span className="min-w-0">
            <span className="block text-lg font-extrabold leading-tight tracking-wide text-white">HRMS</span>
            <span className="block truncate text-[9px] font-medium tracking-wide text-slate-300">People · Process · Progress</span>
          </span>
        </div>

        <nav aria-label="Employee navigation" className="relative flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {links.map(({ id, label, icon: Icon }) => {
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
                className={`group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-950/25'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-orange-200'}`} />
                <span className="truncate">{label}</span>
                {id === 'leaves' && (
                  <ChevronRight className={`ml-auto h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white/75' : 'text-slate-500'}`} />
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className="relative flex h-[52px] shrink-0 items-center gap-3 border-t border-white/10 px-4 text-xs font-semibold text-rose-400 transition hover:bg-red-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400"
        >
          <LogOut className="h-[17px] w-[17px]" />
          <span>Logout</span>
        </button>
      </aside>
    </>
  );
}

export default function Sidebar({ activeTab, onTabSelect, isOpen, onClose }) {
  const { currentUser, logout } = useAuth();
  const { projects, leaveRequests, regularizationRequests } = useHRMS();
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser.role);
  const isManagerWorkspace = currentUser.role === 'manager';
  const isAdminWorkspace = currentUser.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const isEmployeeWorkspace = currentUser.role === 'employee';

  // Calculate pending counts
  const pendingProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'overdue').length;
  const overdueCount = projects.filter(p => p.status === 'overdue').length;
  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending').length;

  if (isEmployeeWorkspace) {
    return (
      <EmployeeSidebar
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  const navigationGroups = [
    {
      items: [
        { id: 'dashboard', label: getDashboardLabel(currentUser.role), icon: LayoutDashboard },
        { id: 'developer_space', label: 'Developer Space', icon: Code2, badge: 'Self-Service' },
        {
          id: 'projects',
          label: 'Projects & Deadlines',
          icon: FolderGit2,
          badge: overdueCount > 0 ? `${overdueCount} Overdue` : `${pendingProjects} Active`,
          badgeColor: overdueCount > 0
            ? 'bg-rose-500 text-white'
            : isNavyWorkspace
              ? 'bg-teal-100 text-teal-800'
              : isEmployeeWorkspace
                ? 'bg-orange-700/40 text-white'
                : isHrWorkspace ? 'bg-[#d6d8cd] text-[#596052]' : 'bg-indigo-100 text-indigo-700',
          highlight: true
        }
      ]
    },
    {
      items: [
        { id: 'employees', label: 'Employees Directory', icon: Users },
        { id: 'organization', label: 'Organization & Branches', icon: Building },
        { id: 'documents', label: 'Documents & Policies', icon: FileText }
      ]
    },
    {
      items: [
        { id: 'attendance', label: 'Attendance & Punches', icon: Clock },
        { id: 'leaves', label: 'Leave Management', icon: CalendarCheck2, badge: pendingLeaves > 0 ? `${pendingLeaves} Req` : null },
        { id: 'payslips', label: 'My Payslips', icon: Banknote },
        { id: 'payroll', label: 'Payroll & Statutory Tax', icon: Banknote },
        { id: 'expenses', label: 'Expenses & Advances', icon: Receipt }
      ]
    },
    {
      items: [
        { id: 'recruitment', label: 'Recruitment & ATS', icon: UserPlus },
        { id: 'lifecycle', label: 'Lifecycle & Exit', icon: Compass },
        { id: 'performance', label: 'Performance & Goals', icon: Target },
        { id: 'training', label: 'Training & LMS', icon: GraduationCap }
      ]
    },
    {
      items: [
        { id: 'assets', label: 'Asset Register', icon: Laptop },
        { id: 'helpdesk', label: 'Helpdesk & SLA', icon: LifeBuoy },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
        { id: 'platform', label: 'Platform & Audit Logs', icon: ShieldCheck },
        { id: 'account', label: 'Account & Security', icon: UserRound },
      ]
    }
  ];

  const visibleGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => canAccessModule(currentUser.role, item.id)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 flex flex-col justify-between ${
        isEmployeeWorkspace
          ? 'border-r border-orange-700/30 bg-[#ff6500] text-white'
          : isHrWorkspace
              ? 'bg-[#e7e8df] text-[#4c5148] border-r border-[#202020]'
            : isNavyWorkspace ? 'bg-[#020617] text-slate-300' : 'bg-slate-900 text-slate-300'
      } ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div>
        <div className={`flex items-center border-b ${
          isNavyWorkspace ? 'h-16 justify-center px-4' : 'h-16 gap-3 px-4'
        } ${
            isEmployeeWorkspace
              ? 'border-white/20 bg-orange-700/10'
              : isHrWorkspace ? 'border-[#202020] bg-[#e7e8df]' : 'border-slate-800 bg-slate-950/40'
          }`}>
          {isNavyWorkspace ? (
            <span className="text-base font-bold tracking-wide text-white">
              {isManagerWorkspace ? 'Manager Panel' : 'Admin Panel'}
            </span>
          ) : isEmployeeWorkspace ? (
              <>
                <img
                  src="/hrm-logo.png"
                  alt="HRMS"
                  className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1.5"
                />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-bold tracking-tight text-white">HRMS</span>
                  <p className="truncate text-[10px] font-medium text-white/75">Employee Workspace</p>
                </div>
              </>
            ) : isHrWorkspace ? (
              <img
                src="/hrm-sidebar-logo.png"
                alt="HRM"
                className="h-10 w-auto shrink-0 object-contain"
              />
            ) : (
              <>
                <img
                  src="/pinweb-logo.webp"
                  alt="Pinweb"
                  className="h-10 w-10 rounded-xl object-contain bg-black border border-slate-800/80 shadow-md p-1 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm tracking-tight truncate">Pinweb HRMS</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium truncate">Innovative Software Solutions</p>
                </div>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <div className={`px-3 py-4 overflow-y-auto space-y-3 ${
            isNavyWorkspace || isHrWorkspace
              ? 'max-h-[calc(100vh-180px)]'
              : 'max-h-[calc(100vh-140px)]'
          }`}>
            {visibleGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabSelect(item.id);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                        isHrWorkspace ? 'font-bold' : 'font-medium'
                      } transition-all group ${
                        isActive
                          ? isHrWorkspace
                            ? 'border border-white bg-white text-black shadow-sm shadow-[#a1a18c]/10'
                              : isEmployeeWorkspace
                                ? 'bg-white text-orange-700 shadow-sm shadow-orange-900/10'
                                : isNavyWorkspace
                                  ? 'bg-[#0f9488] text-white shadow-sm shadow-teal-900/30'
                                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                          : isHrWorkspace
                            ? 'text-black hover:bg-[#d9dbd0] hover:text-black'
                              : isEmployeeWorkspace
                                ? 'text-white/95 hover:bg-orange-700/30 hover:text-white'
                                : isNavyWorkspace
                                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      } ${item.highlight && !isActive
                        ? isHrWorkspace
                          ? 'bg-[#dadcd1] text-black border border-[#dadcd1]'
                            : isEmployeeWorkspace
                              ? 'bg-orange-700/30 text-white border border-white/20'
                              : isNavyWorkspace
                                ? 'bg-teal-950/50 text-teal-100 border border-teal-900/60'
                                : 'bg-indigo-950/40 text-indigo-200 border border-indigo-900/50'
                        : ''}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 transition ${
                          isActive
                            ? isHrWorkspace ? 'text-[#008f4c]' : isEmployeeWorkspace ? 'text-orange-700' : 'text-white'
                            : item.highlight
                              ? isHrWorkspace
                                ? 'text-[#008f4c]'
                                : isEmployeeWorkspace ? 'text-white' : isNavyWorkspace ? 'text-teal-300' : 'text-indigo-400'
                              : isHrWorkspace
                                ? 'text-[#008f4c]'
                                : isEmployeeWorkspace
                                  ? 'text-white/70 group-hover:text-white'
                                  : isNavyWorkspace ? 'text-slate-400 group-hover:text-teal-300' : 'text-slate-400 group-hover:text-slate-200'
                        }`} />
                        <span>{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? isHrWorkspace ? 'bg-[#e7e8df] text-[#171816]' : isEmployeeWorkspace ? 'bg-orange-100 text-orange-800' : 'bg-white/20 text-white'
                            : item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer info: Indian Statutory Compliance indicator */}
        <div className={`p-3 border-t ${
          isEmployeeWorkspace
            ? 'border-white/20 bg-orange-700/25'
            : isHrWorkspace ? 'border-[#202020] bg-[#e7e8df]' : 'border-slate-800/90 bg-slate-950/60'
        }`}>
          <div className={`flex items-center justify-between text-[11px] px-2 py-1 ${
            isEmployeeWorkspace ? 'text-white/80' : isHrWorkspace ? 'text-[#008f4c]' : 'text-slate-400'
          }`}>
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                isEmployeeWorkspace ? 'bg-white' : isHrWorkspace ? 'bg-[#008f4c]' : 'bg-emerald-400'
              }`}></span>
              India Statutory Active
            </span>
            <span className={`font-mono text-[10px] ${
              isEmployeeWorkspace ? 'text-white/65' : isHrWorkspace ? 'text-[#008f4c]' : 'text-slate-500'
            }`}>PF/ESI/PT/TDS</span>
          </div>
          {(isNavyWorkspace || isHrWorkspace) && (
            <button
              type="button"
              onClick={() => logout().catch((error) => console.error('Sign-out failed:', error))}
              className={`mt-2 flex w-full items-center gap-2 rounded-lg border-t px-3 py-3 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400 ${
                isHrWorkspace
                  ? 'border-[#202020] text-[#8b0000] hover:bg-[#8b0000] hover:text-white'
                  : 'border-slate-800 text-rose-400 hover:bg-red-700 hover:text-white'
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
