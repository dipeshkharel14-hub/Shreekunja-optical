/**
 * routes/auth.js
 * Mounted at /api/auth. Customer-facing auth only — admin auth lives
 * in routes/admin.js under /api/admin, matching spec section 38/47.
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { identify } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/register', loginLimiter, authController.customerRegister);
router.post('/login', loginLimiter, authController.customerLogin);
router.post('/logout', identify, authController.customerLogout);

module.exports = router;
