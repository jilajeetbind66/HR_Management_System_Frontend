import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import EmployeeNavbar from './EmployeeNavbar';
import Sidebar from './Sidebar';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout({ activeTab, onTabSelect, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { backendStatus, backendError, syncWithBackend, refreshAttendance } = useHRMS();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const [attendanceRefreshError, setAttendanceRefreshError] = useState(null);
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser?.role);
  const isManagerWorkspace = currentUser?.role === 'manager';
  const isAdminWorkspace = currentUser?.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const isEmployeeWorkspace = currentUser?.role === 'employee';
  const mainPadding = isEmployeeWorkspace
    ? 'max-w-none px-2.5 py-3 sm:px-4 lg:px-5'
    : isHrWorkspace || isNavyWorkspace
      ? 'max-w-none p-3 sm:p-5 lg:p-6'
      : 'max-w-7xl p-3 sm:p-6 lg:p-8';

  useEffect(() => {
    let active = true;
    refreshAttendance()
      .then(() => {
        if (active) setAttendanceRefreshError(null);
      })
      .catch((error) => {
        if (active) {
          setAttendanceRefreshError(error?.data?.message || error.message || 'Attendance status could not be refreshed.');
        }
      });

    return () => {
      active = false;
    };
  }, [pathname, refreshAttendance]);

  return (
    <div className={`${isHrWorkspace ? 'hr-workspace ' : ''}${isManagerWorkspace ? 'manager-workspace ' : ''}${isAdminWorkspace ? 'admin-workspace ' : ''}${isEmployeeWorkspace ? 'employee-workspace ' : ''}hrms-app-shell flex h-full h-screen h-[100dvh] w-full overflow-hidden antialiased text-slate-800`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col h-full min-h-0 overflow-y-auto min-w-0">
        {isEmployeeWorkspace ? (
          <EmployeeNavbar
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onNavigate={onTabSelect}
          />
        ) : (
          <Navbar
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onNavigate={onTabSelect}
          />
        )}

        <main className={`flex-1 w-full mx-auto ${mainPadding}`}>
          {attendanceRefreshError && (
            <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Attendance status could not be refreshed: {attendanceRefreshError}
            </p>
          )}
          {backendStatus === 'checking' ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Loading HRMS records from the server...
            </p>
          ) : backendStatus === 'offline' ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              <p className="font-semibold">HRMS data is unavailable.</p>
              <p className="mt-1">{backendError || 'The server could not load records from the database.'}</p>
              <button
                type="button"
                onClick={() => syncWithBackend()}
                className="mt-3 rounded-lg bg-rose-700 px-3 py-2 font-semibold text-white hover:bg-rose-800"
              >
                Retry connection
              </button>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}
