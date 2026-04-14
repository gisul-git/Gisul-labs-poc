'use client';
import { useState, useEffect, useCallback } from 'react';
import { vmService } from '../../lib/vmService';
import VMCard from '../../components/VMCard';
import StatsBar from '../../components/StatsBar';
import ConfirmModal from '../../components/ConfirmModal';
import { ToastContainer, toast } from '../../components/Toast';
import ActivityLog from '../../components/ActivityLog';

export default function DashboardPage() {
  const [vms, setVMs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');

  const fetchVMs = useCallback(async () => {
    try {
      const res = await vmService.list();
      setVMs(res.data.vms.filter(v => !v.template));
      setSummary(res.data.summary);
    } catch {
      toast('Failed to load VMs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVMs();
    const interval = setInterval(fetchVMs, 15000);
    return () => clearInterval(interval);
  }, [fetchVMs]);

  async function runAction(vmid, action) {
    setActionLoading(true);
    try {
      await vmService[action](vmid);
      toast(`VM ${action} successful`, 'success');
      await fetchVMs();
    } catch (err) {
      toast(err.response?.data?.error || `Failed to ${action} VM`, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirm() {
    const { vmid, action } = confirm;
    setConfirm(null);
    await runAction(vmid, action);
  }

  const filtered = vms.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) || String(v.vmid).includes(search)
  );

  return (
    <div>
      <ToastContainer />
      {confirm && (
        <ConfirmModal
          message={`Are you sure you want to ${confirm.action} VM ${confirm.vmid}?`}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button onClick={fetchVMs} className="btn-ghost text-xs" disabled={loading}>↻ Refresh</button>
      </div>
      <StatsBar summary={summary} />
      <div className="mb-4">
        <input className="input max-w-xs" placeholder="Search VMs..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="text-gray-500 text-sm">Loading VMs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 text-sm">No VMs found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(vm => (
            <VMCard key={vm.vmid} vm={vm} loading={actionLoading}
              onStart={id => runAction(id, 'start')}
              onStop={id => setConfirm({ vmid: id, action: 'stop' })}
              onRestart={id => setConfirm({ vmid: id, action: 'restart' })}
              onDelete={id => setConfirm({ vmid: id, action: 'remove' })}
            />
          ))}
        </div>
      )}
      <ActivityLog />
    </div>
  );
}
