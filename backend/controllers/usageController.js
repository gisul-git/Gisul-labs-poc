const usage = require('../services/usageService');
const proxmox = require('../services/proxmoxService');

async function getLogs(req, res, next) {
  try {
    const { vmid, limit } = req.query;
    const logs = usage.getUsageLogs({
      userId: req.user.id,
      vmid,
      limit: limit ? parseInt(limit) : 100,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const [vms, nodeStats] = await Promise.all([
      proxmox.listVMs(),
      proxmox.getNodeStats(),
    ]);
    const summary = usage.getSummary(vms);
    res.json({ summary, nodeStats });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLogs, getDashboardStats };
