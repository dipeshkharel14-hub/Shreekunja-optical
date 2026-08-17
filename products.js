/**
 * routes/products.js
 * Mounted at /api/products.
 */

const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');
const { validateBody } = require('../middleware/validation');

// Public
router.get('/', identify, productController.list);
router.get('/low-stock', identify, requireAdmin, productController.listLowStock); // before /:slug to avoid collision
router.get('/:slug', productController.getBySlug);

// Admin (both roles can manage products per permission matrix)
router.post(
  '/',
  identify,
  requireAdmin,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody({ sku: { type: 'string', required: true }, nameEn: { type: 'string', required: true }, price: { type: 'number', required: true, min: 0 } }),
  productController.create
);
router.patch('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), productController.update);
router.delete('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), productController.remove);
router.patch('/:id/stock', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), productController.adjustStock);

module.exports = router;
