/**
 * routes/orders.js
 * Mounted at /api/orders.
 */

const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { identify, requireCustomer } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');

// Customers (or guests) can place orders; identify (not requireCustomer)
// so guest checkout works while still attaching customer_id when logged in.
router.post('/', identify, orderController.create);

router.get('/mine', identify, requireCustomer, orderController.listMine);
router.get('/:orderNumber', identify, orderController.getByOrderNumber);

// Admin
router.get('/', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), orderController.listForAdmin);
router.patch('/:id/status', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), orderController.updateStatus);

module.exports = router;
