const router = require('express').Router();
const { getLogs, getDashboardStats } = require('../controllers/usageController');

router.get('/logs', getLogs);
router.get('/stats', getDashboardStats);

module.exports = router;
