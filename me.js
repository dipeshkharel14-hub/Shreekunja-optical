/**
 * routes/me.js
 * Mounted at /api/me — the logged-in customer's own profile.
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { identify, requireCustomer } = require('../middleware/auth');

router.get('/', identify, requireCustomer, authController.me);

module.exports = router;
