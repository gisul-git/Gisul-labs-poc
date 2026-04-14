/**
 * Proxmox VE API Service
 * Handles all communication with the Proxmox API.
 * Supports both ticket-based auth and API token auth.
 */
const axios = require('axios');
const https = require('https');

const BASE_URL = process.env.PROXMOX_HOST;
const NODE = process.env.PROXMOX_NODE || 'pve';

// Ignore self-signed certs in dev (set PROXMOX_VERIFY_SSL=true in prod)
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.PROXMOX_VERIFY_SSL === 'true',
});

const client = axios.create({
  baseURL: BASE_URL,
  httpsAgent,
  timeout: 30000,
});

// ─── Auth State ────────────────────────────────────────────────────────────────
let authState = {
  ticket: null,
  csrfToken: null,
  expiresAt: null,
  useApiToken: false,
};

function isTokenAuth() {
  return !!(process.env.PROXMOX_TOKEN_ID && process.env.PROXMOX_TOKEN_SECRET);
}

function getApiTokenHeader() {
  return `PVEAPIToken=${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_TOKEN_SECRET}`;
}

async function ensureAuth() {
  if (isTokenAuth()) {
    authState.useApiToken = true;
    return; // API tokens don't expire
  }

  const now = Date.now();
  // Refresh ticket 5 minutes before expiry (tickets last 2 hours)
  if (authState.ticket && authState.expiresAt && now < authState.expiresAt - 5 * 60 * 1000) {
    return;
  }

  const response = await client.post('/api2/json/access/ticket', null, {
    params: {
      username: process.env.PROXMOX_USER,
      password: process.env.PROXMOX_PASSWORD,
    },
  });

  const { ticket, CSRFPreventionToken } = response.data.data;
  authState.ticket = ticket;
  authState.csrfToken = CSRFPreventionToken;
  authState.expiresAt = now + 2 * 60 * 60 * 1000; // 2 hours
}

function getAuthHeaders(includeCSRF = false) {
  if (authState.useApiToken) {
    return { Authorization: getApiTokenHeader() };
  }
  const headers = { Cookie: `PVEAuthCookie=${authState.ticket}` };
  if (includeCSRF) headers['CSRFPreventionToken'] = authState.csrfToken;
  return headers;
}

// ─── Generic Request Helper ────────────────────────────────────────────────────
async function proxmoxRequest(method, path, data = null, params = null) {
  await ensureAuth();
  const isMutating = ['post', 'put', 'delete'].includes(method.toLowerCase());
  const headers = getAuthHeaders(isMutating);

  const response = await client.request({
    method,
    url: `/api2/json${path}`,
    headers,
    data,
    params,
  });

  return response.data.data;
}

// ─── Provisioning State ───────────────────────────────────────────────────────
// Tracks VMs currently being cloned: vmid -> { status: 'creating'|'ready', upid, node }
const provisioningMap = {};

function setProvisioning(vmid, node, upid) {
  provisioningMap[vmid] = { status: 'creating', node, upid };
  // Poll in background until done
  pollUntilReady(vmid, node, upid);
}

function getProvisioningStatus(vmid) {
  return provisioningMap[vmid]?.status || 'ready';
}

async function pollUntilReady(vmid, node, upid) {
  const encodedUpid = encodeURIComponent(upid);
  const maxWait = 30 * 60 * 1000; // 30 minutes max
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await sleep(5000);
    try {
      const result = await proxmoxRequest('GET', `/nodes/${node}/tasks/${encodedUpid}/status`);
      if (result.status === 'stopped') {
        provisioningMap[vmid] = { status: 'ready', node, upid };
        console.log(`[Provisioning] VM ${vmid} clone complete`);
        return;
      }
    } catch (e) {
      console.error(`[Provisioning] poll error for VM ${vmid}:`, e.message);
    }
  }
  // Timed out — mark ready anyway so it's not stuck forever
  provisioningMap[vmid] = { status: 'ready', node, upid };
  console.warn(`[Provisioning] VM ${vmid} poll timed out, marking ready`);
}



async function listVMs() {
  const resources = await proxmoxRequest('GET', '/cluster/resources', null, { type: 'vm' });
  console.log('[listVMs] raw types:', resources.map(v => ({ vmid: v.vmid, name: v.name, type: v.type })));
  return resources.map(vm => ({
    vmid: vm.vmid,
    name: vm.name,
    status: vm.status,
    node: vm.node,
    type: vm.type, // 'qemu' or 'lxc'
    cpu: vm.cpu ? parseFloat((vm.cpu * 100).toFixed(2)) : 0,
    maxcpu: vm.maxcpu,
    mem: vm.mem,
    maxmem: vm.maxmem,
    disk: vm.disk,
    maxdisk: vm.maxdisk,
    uptime: vm.uptime,
    ip: vm.ip || null,
    template: vm.template === 1,
    provisioningStatus: getProvisioningStatus(vm.vmid),
  }));
}

async function getVM(vmid) {
  const vms = await listVMs();
  const vm = vms.find(v => v.vmid == vmid);
  if (!vm) throw Object.assign(new Error('VM not found'), { status: 404 });

  const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu';
  const config = await proxmoxRequest('GET', `/nodes/${vm.node}/${endpoint}/${vmid}/config`);
  const status = await proxmoxRequest('GET', `/nodes/${vm.node}/${endpoint}/${vmid}/status/current`);

  return { ...vm, config, status: status.status, pid: status.pid };
}

async function createVM({ name, cpu, ram, disk, templateId, instances = 1 }) {
  const vms = await listVMs();
  const template = vms.find(v => v.vmid == templateId && v.template);
  if (!template) throw Object.assign(new Error('Template not found'), { status: 404 });

  const endpoint = template.type === 'lxc' ? 'lxc' : 'qemu';
  const count = Math.min(parseInt(instances) || 1, 100);

  // Create all instances — get VMIDs sequentially (Proxmox nextid must be called one at a time)
  const results = [];
  for (let i = 0; i < count; i++) {
    const newVmid = await proxmoxRequest('GET', '/cluster/nextid');
    const vmName = count > 1 ? `${name}-${i + 1}` : name;

    const upid = await proxmoxRequest('POST', `/nodes/${template.node}/${endpoint}/${templateId}/clone`, {
      newid: parseInt(newVmid),
      name: vmName,
      full: 0,
      target: template.node,
    });

    setProvisioning(parseInt(newVmid), template.node, upid);

    setTimeout(async () => {
      try {
        if (endpoint === 'qemu') {
          await proxmoxRequest('PUT', `/nodes/${template.node}/qemu/${newVmid}/config`, {
            cores: parseInt(cpu),
            memory: parseInt(ram) * 1024,
          });
        } else {
          await proxmoxRequest('PUT', `/nodes/${template.node}/lxc/${newVmid}/config`, {
            cores: parseInt(cpu),
            memory: parseInt(ram) * 1024,
          });
        }
      } catch (e) {
        console.error('[Config after clone error]', e.message);
      }
    }, 30000);

    results.push({ vmid: parseInt(newVmid), name: vmName, node: template.node, type: template.type, status: 'creating' });
  }

  return results;
}

async function startVM(vmid) {
  const vm = await getVMLocation(vmid);
  const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu';
  const taskId = await proxmoxRequest('POST', `/nodes/${vm.node}/${endpoint}/${vmid}/status/start`);
  return { taskId, vmid };
}

async function stopVM(vmid) {
  const vm = await getVMLocation(vmid);
  const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu';
  const taskId = await proxmoxRequest('POST', `/nodes/${vm.node}/${endpoint}/${vmid}/status/stop`);
  return { taskId, vmid };
}

async function restartVM(vmid) {
  const vm = await getVMLocation(vmid);
  const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu';
  // LXC uses 'reboot', QEMU uses 'reboot' too
  const taskId = await proxmoxRequest('POST', `/nodes/${vm.node}/${endpoint}/${vmid}/status/reboot`);
  return { taskId, vmid };
}

async function deleteVM(vmid) {
  const vm = await getVMLocation(vmid);
  const endpoint = vm.type === 'lxc' ? 'lxc' : 'qemu';
  const status = await proxmoxRequest('GET', `/nodes/${vm.node}/${endpoint}/${vmid}/status/current`);
  if (status.status === 'running') {
    await proxmoxRequest('POST', `/nodes/${vm.node}/${endpoint}/${vmid}/status/stop`);
    await waitForStatus(vm.node, vmid, 'stopped', vm.type);
  }
  const taskId = await proxmoxRequest('DELETE', `/nodes/${vm.node}/${endpoint}/${vmid}`);
  return { taskId, vmid };
}

async function getTemplates() {
  const vms = await listVMs();
  return vms.filter(v => v.template);
}

// ─── Console ───────────────────────────────────────────────────────────────────

async function createVNCTicket(vmid) {
  const vm = await getVMLocation(vmid);
  // LXC uses termproxy (xterm.js), QEMU uses vncproxy (noVNC)
  if (vm.type === 'lxc') {
    const result = await proxmoxRequest('POST', `/nodes/${vm.node}/lxc/${vmid}/termproxy`);
    return {
      ticket: result.ticket,
      port: result.port,
      node: vm.node,
      type: 'lxc',
      wsUrl: `/api/console/ws/${vm.node}/${vmid}`,
    };
  }
  const result = await proxmoxRequest('POST', `/nodes/${vm.node}/qemu/${vmid}/vncproxy`, {
    websocket: 1,
  });
  return {
    ticket: result.ticket,
    port: result.port,
    node: vm.node,
    type: 'qemu',
    wsUrl: `/api/console/ws/${vm.node}/${vmid}`,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getVMLocation(vmid) {
  const vms = await listVMs();
  const vm = vms.find(v => v.vmid == vmid);
  if (!vm) throw Object.assign(new Error('VM not found'), { status: 404 });
  return vm;
}

async function waitForTask(node, upid, maxWait = 120000) {
  const start = Date.now();
  const encodedUpid = encodeURIComponent(upid);
  console.log('[waitForTask] node:', node, 'upid:', upid, 'encoded:', encodedUpid);
  while (Date.now() - start < maxWait) {
    await sleep(3000);
    try {
      const result = await proxmoxRequest('GET', `/nodes/${node}/tasks/${encodedUpid}/status`);
      console.log('[waitForTask] poll result:', JSON.stringify(result));
      if (result.status === 'stopped') {
        if (result.exitstatus === 'OK') return;
        throw new Error(`Task failed: ${result.exitstatus}`);
      }
    } catch (e) {
      console.log('[waitForTask] poll error:', e.message);
      if (e.message.startsWith('Task failed')) throw e;
    }
  }
  throw new Error('Task timed out');
}

async function waitForStatus(node, vmid, targetStatus, type = 'qemu', maxWait = 30000) {
  const endpoint = type === 'lxc' ? 'lxc' : 'qemu';
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(2000);
    const status = await proxmoxRequest('GET', `/nodes/${node}/${endpoint}/${vmid}/status/current`);
    if (status.status === targetStatus) return;
  }
  throw new Error(`VM did not reach status: ${targetStatus}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Usage / Stats ─────────────────────────────────────────────────────────────

async function getNodeStats() {
  const nodes = await proxmoxRequest('GET', '/nodes');
  return nodes.map(n => ({
    node: n.node,
    status: n.status,
    cpu: parseFloat((n.cpu * 100).toFixed(2)),
    maxcpu: n.maxcpu,
    mem: n.mem,
    maxmem: n.maxmem,
    disk: n.disk,
    maxdisk: n.maxdisk,
    uptime: n.uptime,
  }));
}

module.exports = {
  listVMs,
  getVM,
  createVM,
  startVM,
  stopVM,
  restartVM,
  deleteVM,
  getTemplates,
  createVNCTicket,
  getNodeStats,
  proxmoxRequest,
  getVMLocation,
  ensureAuth,
  authState,
  getProvisioningStatus,
};
