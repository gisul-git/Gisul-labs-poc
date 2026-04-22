const router = require('express').Router();
const { body, param } = require('express-validator');
const { validate } = require('../middlewares/validate');
const ctrl = require('../controllers/labController');

router.get('/', ctrl.listLabs);

// session route MUST come before /:labId to avoid being swallowed by the param route
router.get('/session/:vmId',
  param('vmId').isInt({ min: 100 }).withMessage('Invalid VM ID'),
  validate,
  ctrl.getSession
);

router.get('/:labId',
  param('labId').isMongoId().withMessage('Invalid lab ID'),
  validate,
  ctrl.getLab
);

router.post('/start',
  body('labId').isMongoId().withMessage('Valid labId required'),
  validate,
  ctrl.startLab
);

router.post('/execute-step',
  body('vmId').isInt({ min: 100 }).withMessage('Valid vmId required'),
  body('stepId').trim().notEmpty().withMessage('stepId required'),
  validate,
  ctrl.executeStep
);

module.exports = router;
