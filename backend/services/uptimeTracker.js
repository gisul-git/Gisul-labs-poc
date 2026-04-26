/**
 * Uptime Tracker
 * Uses Proxmox's native `uptime` field (seconds since last boot) to calculate
 * real VM running time and persists daily buckets to MongoDB.
 */
const VmUptime = require('../models/VmUptime');

// Last seen uptime per vmid: { uptime, timestamp }
const lastSeen = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 6); // last 7 days including today
  return d.toISOString().slice(0, 10);
}

/**
 * Call this every time listVMs runs.
 * For each running VM, calculate delta seconds since last poll and add to today's bucket.
 */
async function trackVMs(vms) {
  const now = Date.now();
  const today = todayStr();
  const ops = [];

  for (const vm of vms) {
    if (vm.status !== 'running' || !vm.uptime) {
      delete lastSeen[vm.vmid];
      continue;
    }

    const prev = lastSeen[vm.vmid];
    let delta = 0;

    if (prev) {
      const proxmoxDelta = vm.uptime - prev.uptime;
      const wallDelta = Math.floor((now - prev.timestamp) / 1000);

      if (proxmoxDelta < 0) {
        // VM was rebooted — uptime reset
        delta = vm.uptime;
      } else {
        // Use the smaller of the two to avoid overcounting
        delta = Math.min(proxmoxDelta, wallDelta);
      }
    }

    lastSeen[vm.vmid] = { uptime: vm.uptime, timestamp: now };

    if (delta > 0) {
      ops.push(
        VmUptime.findOneAndUpdate(
          { vmid: vm.vmid, date: today },
          { $inc: { seconds: delta } },
          { upsert: true, new: true }
        )
      );
    }
  }

  if (ops.length) await Promise.all(ops);
}

/**
 * Get today + this week seconds for a list of vmids
 * Returns: { [vmid]: { today: seconds, week: seconds } }
 */
async function getUptimeStats(vmids) {
  if (!vmids.length) return {};
  const today = todayStr();
  const weekStartDate = weekStart();

  const records = await VmUptime.find({
    vmid: { $in: vmids },
    date: { $gte: weekStartDate },
  });

  const result = {};
  for (const vmid of vmids) {
    result[vmid] = { today: 0, week: 0 };
  }

  for (const r of records) {
    if (!result[r.vmid]) result[r.vmid] = { today: 0, week: 0 };
    result[r.vmid].week += r.seconds;
    if (r.date === today) result[r.vmid].today += r.seconds;
  }

  return result;
}

module.exports = { trackVMs, getUptimeStats };
