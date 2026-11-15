import React, { useState } from 'react';
import Navbar from './Navbar';
import EmployeeNavbar from './EmployeeNavbar';
import Sidebar from './Sidebar';
import { useHRMS } from '../../context/HRMSContext';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout({ activeTab, onTabSelect, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { backendStatus, backendError, syncWithBackend } = useHRMS();
  const { currentUser } = useAuth();
  const isHrWorkspace = ['hr_admin', 'hr_executive', 'recruiter'].includes(currentUser?.role);
  const isManagerWorkspace = currentUser?.role === 'manager';
  const isAdminWorkspace = currentUser?.role === 'super_admin';
  const isNavyWorkspace = isManagerWorkspace || isAdminWorkspace;
  const isEmployeeWorkspace = currentUser?.role === 'employee';
  const mainPadding = isEmployeeWorkspace
    ? 'max-w-none px-3 py-3 sm:px-4 lg:px-5'
    : isHrWorkspace || isNavyWorkspace
      ? 'max-w-none p-4 sm:p-5 lg:p-6'
      : 'max-w-7xl p-4 sm:p-6 lg:p-8';

  return (
    <div className={`${isHrWorkspace ? 'hr-workspace ' : ''}${isManagerWorkspace ? 'manager-workspace ' : ''}${isAdminWorkspace ? 'admin-workspace ' : ''}${isEmployeeWorkspace ? 'employee-workspace ' : ''}flex h-screen overflow-hidden font-sans antialiased text-slate-800 ${
      isHrWorkspace ? 'bg-[#f4f7f6]' : isNavyWorkspace ? 'bg-[#f1f5f9]' : isEmployeeWorkspace ? 'bg-[#f5f6f8]' : 'bg-slate-50'
    }`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {isEmployeeWorkspace ? (
          <EmployeeNavbar
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onNavigate={onTabSelect}
          />
        ) : (
          <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        )}

        <main className={`flex-1 w-full mx-auto ${mainPadding}`}>
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
                onClick={syncWithBackend}
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
