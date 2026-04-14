const express = require('express');
const { param } = require('express-validator');
const { validate } = require('../middlewares/validate');
const { getVNCTicket } = require('../controllers/consoleController');
const proxmox = require('../services/proxmoxService');
const WebSocket = require('ws');

// Router is created in server.js and passed here so express-ws can patch it
function createConsoleRouter(app) {
  const router = express.Router();

  // Patch this router with ws support
  const expressWs = require('express-ws');
  expressWs(app, null, { leaveRouterUntouched: false });

  // REST: get VNC ticket
  router.get('/ticket/:vmid',
    param('vmid').isInt({ min: 100 }),
    validate,
    getVNCTicket
  );

  /**
   * WebSocket proxy for noVNC
   * noVNC connects to: ws://our-backend/api/console/ws/:node/:vmid?ticket=...&port=...
   * We forward to: wss://proxmox-host:8006/api2/json/nodes/:node/qemu/:vmid/vncwebsocket
   */
  router.ws('/ws/:node/:vmid', async (ws, req) => {
    const { node, vmid } = req.params;
    const { ticket, port } = req.query;

    if (!ticket || !port) {
      ws.close(1008, 'Missing ticket or port');
      return;
    }

    const proxmoxHost = process.env.PROXMOX_HOST.replace(/^https?:\/\//, '');
    const targetUrl = `wss://${proxmoxHost}/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

    const upstream = new WebSocket(targetUrl, {
      rejectUnauthorized: process.env.PROXMOX_VERIFY_SSL === 'true',
      headers: proxmox.authState.ticket
        ? { Cookie: `PVEAuthCookie=${proxmox.authState.ticket}` }
        : { Authorization: `PVEAPIToken=${process.env.PROXMOX_TOKEN_ID}=${process.env.PROXMOX_TOKEN_SECRET}` },
    });

    upstream.on('open', () => {
      ws.on('message', data => upstream.readyState === WebSocket.OPEN && upstream.send(data));
      upstream.on('message', data => ws.readyState === ws.OPEN && ws.send(data));
    });

    upstream.on('error', err => {
      console.error('[VNC Proxy Error]', err.message);
      ws.close(1011, 'Upstream error');
    });

    ws.on('close', () => upstream.close());
    upstream.on('close', () => ws.close());
  });

  return router;
}

module.exports = createConsoleRouter;
