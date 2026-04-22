const Lab = require('../models/Lab');
const LabSession = require('../models/LabSession');
const proxmox = require('../services/proxmoxService');
const { executePS } = require('../services/winrmService');
const usageService = require('../services/usageService');

// GET /api/labs
async function listLabs(req, res, next) {
  try {
    const labs = await Lab.find({});
    res.json(labs);
  } catch (err) {
    next(err);
  }
}

// GET /api/labs/:labId
async function getLab(req, res, next) {
  try {
    const lab = await Lab.findById(req.params.labId);
    if (!lab) return res.status(404).json({ error: 'Lab not found' });
    res.json(lab);
  } catch (err) {
    next(err);
  }
}

// GET /api/labs/session/:vmId  — fetch active session for a VM
async function getSession(req, res, next) {
  try {
    const session = await LabSession.findOne({
      userId: req.user.id,
      vmId: parseInt(req.params.vmId),
      status: 'active',
    }).populate('labId');

    if (!session) return res.status(404).json({ error: 'No active session for this VM' });
    res.json(session);
  } catch (err) {
    next(err);
  }
}

// POST /api/labs/start  — clone VM + create session
// Body: { labId }
async function startLab(req, res, next) {
  try {
    const { labId } = req.body;
    const lab = await Lab.findById(labId);
    if (!lab) return res.status(404).json({ error: 'Lab not found' });

    // Close any existing active sessions for this user before starting new one
    await LabSession.updateMany(
      { userId: req.user.id, status: 'active' },
      { status: 'completed' }
    );

    // Clone VM from the lab's template (1 instance), auto-start after clone
    const results = await proxmox.createVM({
      name: `lab-${lab.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      cpu: 2,
      ram: 4,
      disk: 40,
      templateId: lab.templateId,
      instances: 1,
      autoStart: true,
    });

    const vm = results[0];
    usageService.recordAction({
      userId: req.user.id,
      vmid: vm.vmid,
      action: 'create',
      meta: { labId: lab._id.toString(), labTitle: lab.title },
    });

    const session = await LabSession.create({
      userId: req.user.id,
      vmId: vm.vmid,
      labId: lab._id,
      status: 'active',
      completedSteps: [],
    });

    res.status(201).json({ vmId: vm.vmid, sessionId: session._id, labTitle: lab.title });
  } catch (err) {
    next(err);
  }
}

// POST /api/labs/execute-step
// Body: { vmId, stepId }
async function executeStep(req, res, next) {
  try {
    const { vmId, stepId } = req.body;

    // Find active session
    const session = await LabSession.findOne({
      userId: req.user.id,
      vmId: parseInt(vmId),
      status: 'active',
    }).populate('labId');

    if (!session) return res.status(404).json({ error: 'No active lab session for this VM' });

    const lab = session.labId;
    const step = lab.steps.find(s => s.stepId === stepId);
    if (!step) return res.status(404).json({ error: 'Step not found in lab' });

    // Already completed?
    if (session.completedSteps.includes(stepId)) {
      return res.json({ status: 'already_completed', message: 'Step was already completed' });
    }

    // Get VM IP via QEMU Guest Agent
    const ip = await proxmox.getVMIP(vmId);
    if (!ip) return res.status(400).json({ error: 'VM IP not available yet. Ensure QEMU Guest Agent is running.' });

    // Execute via WinRM
    const { stdout, stderr } = await executePS(ip, step.command);

    // Validate: for install_mongodb step, check service exists
    let success = true;
    let validationOutput = stdout;

    if (stepId === 'install_mongodb') {
      const { stdout: svcOut } = await executePS(ip,
        `Get-Service | Where-Object {$_.Name -like "Mongo*"} | Select-Object -ExpandProperty Name`
      );
      success = svcOut.toLowerCase().includes('mongo');
      validationOutput = svcOut;
    }

    if (!success) {
      return res.status(500).json({
        status: 'failed',
        message: 'Step executed but validation failed. MongoDB service not found.',
        stdout,
        stderr,
      });
    }

    // Mark step complete
    await LabSession.updateOne(
      { _id: session._id },
      { $addToSet: { completedSteps: stepId } }
    );

    // Check if all steps done
    const updatedSession = await LabSession.findById(session._id);
    const allDone = lab.steps.every(s => updatedSession.completedSteps.includes(s.stepId));
    if (allDone) {
      await LabSession.updateOne({ _id: session._id }, { status: 'completed' });
    }

    res.json({
      status: 'success',
      stepId,
      output: validationOutput,
      labCompleted: allDone,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLabs, getLab, getSession, startLab, executeStep };
