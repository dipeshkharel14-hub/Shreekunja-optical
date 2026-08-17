/**
 * routes/customers.js
 * Mounted at /api/customers — admin-facing customer management.
 * (Customer's own profile lives under /api/me, not here.)
 */

const express = require('express');
const router = express.Router();

const customerController = require('../controllers/customerController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');

router.use(identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/', customerController.list);
router.get('/:id', customerController.getOne);
router.patch('/:id/status', customerController.setStatus);

module.exports = router;
