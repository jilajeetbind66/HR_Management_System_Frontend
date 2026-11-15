import React, { useState } from 'react';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Building, Laptop, Plus, Search } from 'lucide-react';

const emptyAsset = {
  name: '',
  category: '',
  serial_number: '',
  branch_id: '',
};

function errorText(error) {
  const validationMessages = Object.values(error?.data?.errors || {}).flat();
  return validationMessages[0] || error?.data?.message || error?.message || 'The asset request could not be completed.';
}

function statusVariant(status) {
  if (status === 'Available') return 'success';
  if (status === 'Allocated') return 'primary';
  if (status === 'Maintenance') return 'warning';
  return 'danger';
}

export default function AssetsView() {
  const {
    assets,
    employees,
    branches,
    createAsset,
    assignAsset,
    returnAsset,
    updateAssetStatus,
  } = useHRMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [employeeDrafts, setEmployeeDrafts] = useState({});
  const [statusDrafts, setStatusDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const activeEmployees = employees.filter((employee) => employee.status === 'active');

  const filteredAssets = assets.filter((asset) => (
    (asset.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    || (asset.asset_code || '').toLowerCase().includes(searchTerm.toLowerCase())
    || (asset.serial_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    || (asset.assigned_to || '').toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const runAction = async (actionKey, action, successText) => {
    setBusy(actionKey);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: 'success', text: successText });
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error) });
    } finally {
      setBusy('');
    }
  };

  const handleCreate = (event) => {
    event.preventDefault();
    runAction('create', async () => {
      await createAsset({
        ...assetForm,
        branch_id: Number(assetForm.branch_id || branches[0]?.id),
      });
      setAssetForm(emptyAsset);
      setShowCreateForm(false);
    }, 'Asset registered.');
  };

  const handleAssign = (asset) => {
    const employeeId = employeeDrafts[asset.id];
    if (!employeeId) {
      setFeedback({ type: 'error', text: 'Select an active employee before allocation.' });
      return;
    }
    runAction(`assign:${asset.id}`, () => assignAsset(asset.id, employeeId), 'Asset allocated.');
  };

  const handleReturn = (asset) => {
    if (!window.confirm(`Return ${asset.asset_code} from ${asset.assigned_to}?`)) return;
    runAction(`return:${asset.id}`, () => returnAsset(asset.id), 'Asset returned to the register.');
  };

  const handleStatusUpdate = (asset) => {
    const status = statusDrafts[asset.id] ?? asset.status;
    if (status === 'Retired' && !window.confirm(`Retire ${asset.asset_code}? This cannot be undone.`)) return;
    runAction(`status:${asset.id}`, () => updateAssetStatus(asset.id, status), 'Asset status updated.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-600">
              IT Infrastructure
            </span>
            <span className="text-xs font-medium text-slate-500">Hardware assets and device allocations</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">IT &amp; Hardware Asset Register</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Register equipment, allocate it to active employees, track maintenance, and record returns.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setShowCreateForm((open) => !open)}>
          {showCreateForm ? 'Cancel' : 'Register Asset'}
        </Button>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showCreateForm && (
        <Card title="Register Company Asset" subtitle="New assets start as Available and receive a unique asset code.">
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">
              Asset name
              <input
                required
                maxLength="255"
                value={assetForm.name}
                onChange={(event) => setAssetForm((previous) => ({ ...previous, name: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Category
              <input
                required
                maxLength="50"
                value={assetForm.category}
                onChange={(event) => setAssetForm((previous) => ({ ...previous, category: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Serial number
              <input
                required
                maxLength="255"
                value={assetForm.serial_number}
                onChange={(event) => setAssetForm((previous) => ({ ...previous, serial_number: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Branch
              <select
                required
                value={assetForm.branch_id || branches[0]?.id || ''}
                onChange={(event) => setAssetForm((previous) => ({ ...previous, branch_id: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end sm:col-span-2 lg:col-span-4">
              <Button type="submit" icon={Plus} disabled={busy !== '' || branches.length === 0}>
                {busy === 'create' ? 'Saving...' : 'Save Asset'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <label className="sr-only" htmlFor="asset-search">Search assets</label>
        <input
          id="asset-search"
          type="search"
          placeholder="Search by name, asset code, serial number, or employee..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full text-xs focus:outline-none"
        />
      </div>

      <Card bodyClassName="p-0">
        {filteredAssets.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {assets.length === 0 ? 'No company assets are registered yet.' : 'No assets match this search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Asset code &amp; item</th>
                  <th className="px-4 py-3">Category / serial</th>
                  <th className="px-4 py-3">Assigned employee</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAssets.map((asset) => {
                  const isAssigned = asset.status === 'Allocated';
                  const isRetired = asset.status === 'Retired';
                  const selectedStatus = statusDrafts[asset.id] ?? asset.status;
                  return (
                    <tr key={asset.id} className="align-top hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="mr-2 rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 font-mono font-bold text-indigo-600">
                          {asset.asset_code}
                        </span>
                        <span className="font-semibold text-slate-900">{asset.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{asset.category}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">{asset.serial_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        {asset.assigned_to ? (
                          <div>
                            <div className="font-semibold text-slate-800">{asset.assigned_to}</div>
                            {asset.assigned_employee_code && (
                              <div className="mt-1 font-mono text-[11px] text-slate-500">{asset.assigned_employee_code}</div>
                            )}
                          </div>
                        ) : <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          {asset.branch || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(asset.status)} size="sm">{asset.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-56 flex-col gap-2">
                          {!isAssigned && !isRetired && (
                            <>
                              <div className="flex gap-2">
                                <label className="sr-only" htmlFor={`asset-employee-${asset.id}`}>Assign employee</label>
                                <select
                                  id={`asset-employee-${asset.id}`}
                                  value={employeeDrafts[asset.id] || ''}
                                  onChange={(event) => setEmployeeDrafts((previous) => ({
                                    ...previous,
                                    [asset.id]: event.target.value,
                                  }))}
                                  disabled={asset.status !== 'Available' || busy !== ''}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                                >
                                  <option value="">Select active employee</option>
                                  {activeEmployees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                      {employee.first_name} {employee.last_name} · {employee.employee_code}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={Laptop}
                                  disabled={asset.status !== 'Available' || !employeeDrafts[asset.id] || busy !== ''}
                                  onClick={() => handleAssign(asset)}
                                >
                                  Allocate
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <label className="sr-only" htmlFor={`asset-status-${asset.id}`}>Change asset status</label>
                                <select
                                  id={`asset-status-${asset.id}`}
                                  value={selectedStatus}
                                  onChange={(event) => setStatusDrafts((previous) => ({
                                    ...previous,
                                    [asset.id]: event.target.value,
                                  }))}
                                  disabled={busy !== ''}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                                >
                                  {['Available', 'Maintenance', 'Retired'].map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                                {selectedStatus !== asset.status && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy !== ''}
                                    onClick={() => handleStatusUpdate(asset)}
                                  >
                                    Save
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                          {isAssigned && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy !== ''}
                              onClick={() => handleReturn(asset)}
                            >
                              Record Return
                            </Button>
                          )}
                          {isRetired && <span className="text-[11px] text-slate-500">Retired assets are read-only.</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
