'use client';
import { useRouter } from 'next/navigation';

const STATUS_COLORS = {
  running:  'bg-green-500',
  stopped:  'bg-gray-500',
  paused:   'bg-yellow-500',
  creating: 'bg-blue-500',
};

function StatBar({ value, max, color = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export default function VMCard({ vm, onStart, onStop, onRestart, onDelete, loading }) {
  const router = useRouter();
  const isRunning = vm.status === 'running';
  const isCreating = vm.provisioningStatus === 'creating';
  const dot = isCreating ? 'bg-blue-500' : (STATUS_COLORS[vm.status] || 'bg-gray-500');

  return (
    <div className={`card flex flex-col gap-4 transition-colors ${isCreating ? 'border-blue-800' : 'hover:border-gray-700'}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-100 truncate max-w-[160px]" title={vm.name}>{vm.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            VMID: {vm.vmid}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${vm.type === 'lxc' ? 'bg-teal-900 text-teal-300' : 'bg-indigo-900 text-indigo-300'}`}>
              {vm.type === 'lxc' ? 'CT' : 'VM'}
            </span>
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-800">
          <span className={`w-1.5 h-1.5 rounded-full ${dot} ${isCreating || isRunning ? 'animate-pulse' : ''}`} />
          {isCreating ? 'Cloning...' : vm.status}
        </span>
      </div>

      {isCreating && (
        <div className="text-xs text-blue-400 bg-blue-950/50 border border-blue-900 rounded-lg px-3 py-2">
          VM is being cloned from template. Actions will be available once complete.
        </div>
      )}

      {!isCreating && (
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex justify-between"><span>CPU</span><span>{vm.cpu ?? 0}%</span></div>
          <StatBar value={vm.cpu ?? 0} max={100} />
          <div className="flex justify-between mt-1"><span>RAM</span><span>{formatBytes(vm.mem)} / {formatBytes(vm.maxmem)}</span></div>
          <StatBar value={vm.mem} max={vm.maxmem} color="bg-purple-500" />
          {vm.ip && <p className="text-gray-500 pt-1">IP: <span className="text-gray-300">{vm.ip}</span></p>}
          {/* Uptime stats */}
          <div className="pt-2 mt-1 border-t border-gray-800 grid grid-cols-2 gap-2">
            <div className="bg-gray-900 rounded-lg px-2 py-1.5">
              <p className="text-gray-600 text-xs mb-0.5">Today</p>
              <p className="text-yellow-400 text-xs font-medium">
                {formatUptime(vm.uptimeToday) || '—'}
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg px-2 py-1.5">
              <p className="text-gray-600 text-xs mb-0.5">This week</p>
              <p className="text-blue-400 text-xs font-medium">
                {formatUptime(vm.uptimeWeek) || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800">
        {!isCreating && !isRunning && (
          <button className="btn-primary text-xs py-1 px-3" onClick={() => onStart(vm.vmid)} disabled={loading}>▶ Start</button>
        )}
        {!isCreating && isRunning && (
          <>
            <button className="btn-ghost text-xs py-1 px-3" onClick={() => onStop(vm.vmid)} disabled={loading}>■ Stop</button>
            <button className="btn-ghost text-xs py-1 px-3" onClick={() => onRestart(vm.vmid)} disabled={loading}>↺ Restart</button>
            <button className="btn-ghost text-xs py-1 px-3 text-green-400" onClick={() => router.push(`/console/${vm.vmid}`)}>⬛ Console</button>
          </>
        )}
        <button className="btn-danger text-xs py-1 px-3 ml-auto" onClick={() => onDelete(vm.vmid)} disabled={loading || isCreating}>🗑</button>
      </div>
    </div>
  );
}
