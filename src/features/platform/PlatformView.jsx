import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import UserAccessManagement from './UserAccessManagement';
import { useAuth } from '../../context/AuthContext';
import { initialBranches } from '../../data/mockData';
import api from '../../services/api';
import {
  History,
  Hash,
  Server,
  KeyRound,
  RefreshCw,
  Search,
  Building2,
} from 'lucide-react';

export default function PlatformView() {
  const { auditLogs, refreshAuditLogs, employees, branches } = useHRMS();
  const { currentUser, activeBranch, setActiveBranch } = useAuth();
  const availableBranches = Array.isArray(branches) && branches.length > 0 ? branches : initialBranches;
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'sequences' | 'scheduler' | 'users'

  // Map employee name/code to their branch for audit attribution
  const employeeBranchMap = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((emp) => {
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim().toLowerCase();
      const bName = emp.branch_name || (Number(emp.branch_id) === 1 ? 'Prayagraj Branch' : Number(emp.branch_id) === 2 ? 'Kaushambi Branch' : '');
      if (fullName && bName) map.set(fullName, bName);
      if (emp.name && bName) map.set(emp.name.trim().toLowerCase(), bName);
      if (emp.employee_code && bName) map.set(emp.employee_code.toLowerCase(), bName);
    });
    return map;
  }, [employees]);

  const getLogBranch = useCallback((log) => {
    if (!log) return 'All Branches';
    const actorLower = String(log.actor || '').trim().toLowerCase();
    const descLower = String(log.description || '').toLowerCase();

    for (const [name, branch] of employeeBranchMap.entries()) {
      if (actorLower === name || actorLower.includes(name) || name.includes(actorLower)) {
        return branch;
      }
    }

    if (descLower.includes('prayagraj') && descLower.includes('kaushambi')) {
      return 'All Branches';
    }
    if (descLower.includes('prayagraj')) return 'Prayagraj Branch';
    if (descLower.includes('kaushambi')) return 'Kaushambi Branch';

    return 'All Branches';
  }, [employeeBranchMap]);

  // Audit logs filter/refresh state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModule, setAuditModule] = useState('');
  const [auditMeta, setAuditMeta] = useState({ total: auditLogs.length, modules: [] });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // Sequences state
  const [sequences, setSequences] = useState([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [sequencesError, setSequencesError] = useState('');

  // Scheduler runs state
  const [schedulerRuns, setSchedulerRuns] = useState([]);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerError, setSchedulerError] = useState('');

  const loadAuditLogs = useCallback(async (search = auditSearch, module = auditModule) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const response = await refreshAuditLogs({ search, module, limit: 100 });
      setAuditMeta({
        total: response?.meta?.total ?? (response?.data?.length || 0),
        modules: Array.isArray(response?.meta?.modules) ? response.meta.modules : [],
      });
    } catch (error) {
      setAuditError(error?.data?.message || error.message || 'Unable to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditModule, auditSearch, refreshAuditLogs]);

  const loadSequences = useCallback(async () => {
    setSequencesLoading(true);
    setSequencesError('');
    try {
      const response = await api.getSequences();
      setSequences(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setSequencesError(error?.data?.message || error.message || 'Unable to load number sequences.');
    } finally {
      setSequencesLoading(false);
    }
  }, []);

  const loadSchedulerRuns = useCallback(async () => {
    setSchedulerLoading(true);
    setSchedulerError('');
    try {
      const response = await api.getSchedulerRuns();
      setSchedulerRuns(Array.isArray(response?.data) ? response.data : []);
      setScheduledJobs(Array.isArray(response?.meta?.scheduled_jobs) ? response.meta.scheduled_jobs : []);
    } catch (error) {
      setSchedulerError(error?.data?.message || error.message || 'Unable to load scheduler runs.');
    } finally {
      setSchedulerLoading(false);
    }
  }, []);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (!activeBranch || activeBranch === 'All Branches') return true;
      const logBranch = getLogBranch(log);
      if (logBranch === 'All Branches') return true;
      return logBranch === activeBranch;
    });
  }, [auditLogs, activeBranch, getLogBranch]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs(auditSearch, auditModule);
    } else if (activeTab === 'sequences') {
      loadSequences();
    } else if (activeTab === 'scheduler') {
      loadSchedulerRuns();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
            Platform & Governance
          </span>
          <span className="text-xs text-slate-500 font-medium">Activity Audits, Number Sequences & Background Jobs</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform, Audit Logs & System Cron</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Activity audit records, sequence number generators, and scheduled job monitor.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'audit' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" /> Audit Log Stream ({filteredAuditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('sequences')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'sequences' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hash className="w-4 h-4" /> Number Sequences
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'scheduler' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" /> Scheduler Runs & Cron
        </button>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'users' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" /> User Access
          </button>
        )}
      </div>

      {/* TAB 1: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card
          title="Audit Log Stream"
          subtitle={`Showing ${filteredAuditLogs.length} of ${auditLogs.length} matching records ${activeBranch && activeBranch !== 'All Branches' ? `(${activeBranch})` : '(All Branches)'}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadAuditLogs(e.target.value, auditModule)}
                  placeholder="Search action, actor..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <select
                value={auditModule}
                onChange={(e) => {
                  setAuditModule(e.target.value);
                  loadAuditLogs(auditSearch, e.target.value);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="">All Modules</option>
                {auditMeta.modules.map((mod) => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
              {currentUser?.role === 'super_admin' && (
                <select
                  value={activeBranch || 'All Branches'}
                  onChange={(e) => setActiveBranch(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
                >
                  <option value="All Branches">All Branches</option>
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="secondary" icon={RefreshCw} disabled={auditLoading} onClick={() => loadAuditLogs(auditSearch, auditModule)}>
                {auditLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          }
          bodyClassName="p-0"
        >
          {auditError && (
            <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {auditError}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Timestamp (UTC/IST)</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Branch Location</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Event Action</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAuditLogs.map(log => {
                  const logBranch = getLogBranch(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 font-mono text-[11px]">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{log.created_at}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-900">{log.actor}</td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          logBranch === 'Prayagraj Branch'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : logBranch === 'Kaushambi Branch'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <Building2 className="w-3 h-3" />
                          {logBranch === 'All Branches' ? 'All / System' : logBranch.replace(' Branch', '')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-teal-600 font-medium">{log.module}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 max-w-md">{log.description}</td>
                      <td className="px-4 py-3 text-slate-400">{log.ip}</td>
                    </tr>
                  );
                })}
                {!auditLoading && filteredAuditLogs.length === 0 && (
                  <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No audit records match your branch and search filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: NUMBER SEQUENCES */}
      {activeTab === 'sequences' && (
        <Card
          title="System Number Sequences"
          subtitle="Live sequence prefixes and highest issued identifiers across HRMS modules"
          action={
            <Button size="sm" variant="secondary" icon={RefreshCw} disabled={sequencesLoading} onClick={loadSequences}>
              {sequencesLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          }
          bodyClassName="p-0"
        >
          {sequencesError && (
            <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {sequencesError}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Sequence</th>
                  <th className="px-4 py-3">Prefix Pattern</th>
                  <th className="px-4 py-3">Latest Issued Code</th>
                  <th className="px-4 py-3 text-right">Total Records Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sequences.map((seq) => (
                  <tr key={seq.key} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">{seq.label}</td>
                    <td className="px-4 py-3 font-mono text-teal-700">{seq.prefix}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{seq.latest_code || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{seq.total_issued}</td>
                  </tr>
                ))}
                {!sequencesLoading && sequences.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">No sequence records available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="space-y-4">
          {scheduledJobs.length > 0 && (
            <Card title="Registered Scheduled Commands" subtitle="Configured in Laravel scheduler (bootstrap/app.php)">
              <div className="space-y-2">
                {scheduledJobs.map((job) => (
                  <div key={job.command} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                    <div>
                      <p className="font-mono font-semibold text-slate-900">{job.command}</p>
                      <p className="mt-0.5 text-slate-600">{job.description}</p>
                    </div>
                    <Badge variant="teal" size="sm">{job.schedule}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card
            title="Laravel Scheduler Run History"
            subtitle="Recent cron executions recorded in scheduler_runs"
            action={
              <Button size="sm" variant="secondary" icon={RefreshCw} disabled={schedulerLoading} onClick={loadSchedulerRuns}>
                {schedulerLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            }
            bodyClassName="p-0"
          >
            {schedulerError && (
              <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {schedulerError}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Ran At</th>
                    <th className="px-4 py-3">Command</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Output</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {schedulerRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{run.ran_at || run.created_at}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{run.command}</td>
                      <td className="px-4 py-3">
                        <Badge variant={run.status === 'success' ? 'success' : 'danger'} size="sm">{run.status}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{run.duration_ms != null ? `${run.duration_ms} ms` : '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-md truncate">{run.output || '—'}</td>
                    </tr>
                  ))}
                  {!schedulerLoading && schedulerRuns.length === 0 && (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No scheduler run records logged yet. Ensure Hostinger cron runs `php artisan schedule:run` every minute.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'users' && currentUser?.role === 'super_admin' && (
        <UserAccessManagement />
      )}
    </div>
  );
}
