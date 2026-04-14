/**
 * Usage Tracking Service
 * Tracks VM actions and resource usage over time.
 * In production, replace the in-memory store with a database (PostgreSQL/MongoDB).
 */

// In-memory store — replace with DB in production
const usageLog = [];
const vmUsageMap = {}; // vmid -> { totalUptime, lastStarted }

function recordAction({ userId, vmid, action, meta = {} }) {
  const entry = {
    id: usageLog.length + 1,
    userId,
    vmid,
    action,
    meta,
    timestamp: new Date().toISOString(),
  };
  usageLog.push(entry);

  // Track uptime
  if (action === 'start') {
    vmUsageMap[vmid] = vmUsageMap[vmid] || { totalUptime: 0, lastStarted: null };
    vmUsageMap[vmid].lastStarted = Date.now();
  }
  if (action === 'stop' || action === 'restart') {
    if (vmUsageMap[vmid]?.lastStarted) {
      const elapsed = Date.now() - vmUsageMap[vmid].lastStarted;
      vmUsageMap[vmid].totalUptime += elapsed;
      vmUsageMap[vmid].lastStarted = null;
    }
  }

  return entry;
}

function getUsageLogs({ userId, vmid, limit = 100 } = {}) {
  let logs = [...usageLog];
  if (userId) logs = logs.filter(l => l.userId === userId);
  if (vmid) logs = logs.filter(l => l.vmid == vmid);
  return logs.slice(-limit).reverse();
}

function getVMUptime(vmid) {
  const data = vmUsageMap[vmid];
  if (!data) return 0;
  let total = data.totalUptime;
  if (data.lastStarted) total += Date.now() - data.lastStarted;
  return Math.floor(total / 1000); // seconds
}

function getSummary(vms = []) {
  const running = vms.filter(v => v.status === 'running').length;
  const stopped = vms.filter(v => v.status === 'stopped').length;
  const totalCpu = vms.reduce((acc, v) => acc + (v.cpu || 0), 0);
  const totalMem = vms.reduce((acc, v) => acc + (v.mem || 0), 0);
  const totalMaxMem = vms.reduce((acc, v) => acc + (v.maxmem || 0), 0);

  return {
    total: vms.length,
    running,
    stopped,
    avgCpu: vms.length ? parseFloat((totalCpu / vms.length).toFixed(2)) : 0,
    memUsedGB: parseFloat((totalMem / 1024 ** 3).toFixed(2)),
    memTotalGB: parseFloat((totalMaxMem / 1024 ** 3).toFixed(2)),
    recentActions: getUsageLogs({ limit: 10 }),
  };
}

module.exports = { recordAction, getUsageLogs, getVMUptime, getSummary };
