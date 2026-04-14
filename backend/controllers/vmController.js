const proxmox = require('../services/proxmoxService');
const usage = require('../services/usageService');

async function listVMs(req, res, next) {
  try {
    const vms = await proxmox.listVMs();
    const summary = usage.getSummary(vms);
    res.json({ vms, summary });
  } catch (err) {
    next(err);
  }
}

async function getVM(req, res, next) {
  try {
    const vm = await proxmox.getVM(req.params.vmid);
    vm.uptimeTracked = usage.getVMUptime(req.params.vmid);
    res.json(vm);
  } catch (err) {
    next(err);
  }
}

async function createVM(req, res, next) {
  try {
    const { name, cpu, ram, disk, templateId, instances } = req.body;
    const results = await proxmox.createVM({ name, cpu, ram, disk, templateId, instances });
    results.forEach(vm => {
      usage.recordAction({ userId: req.user.id, vmid: vm.vmid, action: 'create', meta: { name: vm.name, cpu, ram, disk } });
    });
    res.status(201).json(results.length === 1 ? results[0] : results);
  } catch (err) {
    next(err);
  }
}

async function startVM(req, res, next) {
  try {
    const result = await proxmox.startVM(req.params.vmid);
    usage.recordAction({ userId: req.user.id, vmid: req.params.vmid, action: 'start' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function stopVM(req, res, next) {
  try {
    const result = await proxmox.stopVM(req.params.vmid);
    usage.recordAction({ userId: req.user.id, vmid: req.params.vmid, action: 'stop' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function restartVM(req, res, next) {
  try {
    const result = await proxmox.restartVM(req.params.vmid);
    usage.recordAction({ userId: req.user.id, vmid: req.params.vmid, action: 'restart' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deleteVM(req, res, next) {
  try {
    const result = await proxmox.deleteVM(req.params.vmid);
    usage.recordAction({ userId: req.user.id, vmid: req.params.vmid, action: 'delete' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getTemplates(req, res, next) {
  try {
    const templates = await proxmox.getTemplates();
    res.json(templates);
  } catch (err) {
    next(err);
  }
}

module.exports = { listVMs, getVM, createVM, startVM, stopVM, restartVM, deleteVM, getTemplates };
