const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { login, logout, me } = require('../controllers/authController');

router.post('/login',
  body('username').trim().notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required'),
  validate,
  login
);

router.post('/logout', logout);
router.get('/me', authenticate, me);

module.exports = router;
