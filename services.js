/**
 * routes/services.js
 * Mounted at /api/services.
 */

const express = require('express');
const router = express.Router();

const serviceController = require('../controllers/serviceController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');
const { validateBody } = require('../middleware/validation');

router.get('/', identify, serviceController.list);

router.post(
  '/',
  identify,
  requireAdmin,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody({ nameEn: { type: 'string', required: true } }),
  serviceController.create
);
router.patch('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), serviceController.update);
router.delete('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), serviceController.remove);

module.exports = router;
