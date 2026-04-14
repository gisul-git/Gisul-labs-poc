const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/vmController');

router.get('/list', ctrl.listVMs);
router.get('/templates', ctrl.getTemplates);

router.get('/:vmid',
  param('vmid').isInt({ min: 100 }).withMessage('Invalid VMID'),
  validate,
  ctrl.getVM
);

router.post('/create',
  body('name').trim().notEmpty().isLength({ max: 64 }).withMessage('Name required (max 64 chars)'),
  body('cpu').isInt({ min: 1, max: 64 }).withMessage('CPU must be 1-64'),
  body('ram').isInt({ min: 1, max: 512 }).withMessage('RAM must be 1-512 GB'),
  body('disk').isInt({ min: 1, max: 10000 }).withMessage('Disk must be 1-10000 GB'),
  body('templateId').isInt({ min: 100 }).withMessage('Valid templateId required'),
  validate,
  ctrl.createVM
);

router.post('/start/:vmid',
  param('vmid').isInt({ min: 100 }),
  validate,
  ctrl.startVM
);

router.post('/stop/:vmid',
  param('vmid').isInt({ min: 100 }),
  validate,
  ctrl.stopVM
);

router.post('/restart/:vmid',
  param('vmid').isInt({ min: 100 }),
  validate,
  ctrl.restartVM
);

router.delete('/:vmid',
  param('vmid').isInt({ min: 100 }),
  validate,
  ctrl.deleteVM
);

module.exports = router;
