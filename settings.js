/**
 * routes/settings.js
 * Mounted at /api/settings.
 */

const express = require('express');
const router = express.Router();

const settingController = require('../controllers/settingController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');

router.get('/public', settingController.getPublic);
router.get('/', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), settingController.getAllForAdmin);
router.patch('/', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), settingController.update);

module.exports = router;
