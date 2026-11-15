import React, { useState } from 'react';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import UserAccessManagement from './UserAccessManagement';
import { useAuth } from '../../context/AuthContext';
import {
  History,
  Hash,
  Server,
  KeyRound,
} from 'lucide-react';

export default function PlatformView() {
  const { auditLogs } = useHRMS();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'sequences' | 'scheduler' | 'users'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wide">
            Platform & Governance
          </span>
          <span className="text-xs text-slate-500 font-medium">Activity Audits, Number Sequences & Background Jobs</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform, Audit Logs & System Cron</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable Spatie-equivalent activity logs, sequence number generators, and scheduled job monitor.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 text-xs">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" /> Spatie Audit Log Stream ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('sequences')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'sequences' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hash className="w-4 h-4" /> Number Sequences
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'scheduler' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" /> Scheduler Runs & Cron
        </button>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" /> User Access
          </button>
        )}
      </div>

      {/* TAB 1: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Timestamp (UTC/IST)</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Event Action</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 font-mono text-[11px]">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{log.created_at}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-slate-900">{log.actor}</td>
                    <td className="px-4 py-3 font-sans text-indigo-600 font-medium">{log.module}</td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-600 max-w-md">{log.description}</td>
                    <td className="px-4 py-3 text-slate-400">{log.ip}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No audit records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: NUMBER SEQUENCES */}
      {activeTab === 'sequences' && (
        <Card title="Number Sequences" subtitle="No sequence configuration records are available.">
          <p className="py-8 text-center text-xs text-slate-500">No number sequences have been configured yet.</p>
        </Card>
      )}

      {/* TAB 3: SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="space-y-4">
          <Card title="Laravel Scheduler Logs" subtitle="Architecture Section 3: One cron schedule:run; supervised queue worker">
            <p className="py-8 text-center text-xs text-slate-500">No scheduler run records yet.</p>
          </Card>
        </div>
      )}

      {activeTab === 'users' && currentUser?.role === 'super_admin' && (
        <UserAccessManagement />
      )}
    </div>
  );
}
