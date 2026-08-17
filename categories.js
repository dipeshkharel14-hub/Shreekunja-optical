/**
 * routes/categories.js
 * Mounted at /api/categories.
 */

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');
const { validateBody } = require('../middleware/validation');

router.get('/', identify, categoryController.list);

router.post(
  '/',
  identify,
  requireAdmin,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody({ nameEn: { type: 'string', required: true } }),
  categoryController.create
);
router.patch('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), categoryController.update);
router.delete('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), categoryController.remove);

module.exports = router;
