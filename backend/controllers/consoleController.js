const proxmox = require('../services/proxmoxService');

async function getVNCTicket(req, res, next) {
  try {
    const { vmid } = req.params;
    const result = await proxmox.createVNCTicket(vmid);
    res.json({
      ticket: result.ticket,
      port:   result.port,
      node:   result.node,
      wsUrl:  result.wsUrl,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getVNCTicket };
