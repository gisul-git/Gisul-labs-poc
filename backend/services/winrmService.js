/**
 * WinRM Service — calls the Proxmox-side WinRM proxy via SSH tunnel.
 * Proxy runs on Proxmox (port 8007), tunneled to localhost:9001 on this server.
 */
const axios = require('axios');

const PROXY_URL    = process.env.WINRM_PROXY_URL    || 'http://localhost:9001';
const PROXY_SECRET = process.env.WINRM_PROXY_SECRET || 'changeme';

async function executePS(ip, command, timeoutMs = 180000) {
  const res = await axios.post(
    `${PROXY_URL}/execute`,
    { ip, command },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': PROXY_SECRET,
      },
      timeout: timeoutMs,
    }
  );

  if (res.data.error) {
    throw new Error(res.data.error);
  }

  return {
    stdout: res.data.stdout || '',
    stderr: res.data.stderr || '',
    exitCode: res.data.exit_code ?? 0,
  };
}

module.exports = { executePS };
