/**
 * controllers/orderController.js
 */

const OrderModel = require('../models/Order');
const OrderService = require('../services/orderService');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled', 'returned'];

async function create(req, res, next) {
  try {
    const { customerName, customerPhone, customerEmail, shippingAddress, items, paymentMethod, customerNote } = req.body || {};

    if (!customerName || !customerPhone || !shippingAddress || !items) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'customerName, customerPhone, shippingAddress, and items are required.');
    }

    const customerId = req.auth?.type === 'customer' ? req.auth.sub : null;

    const order = await OrderService.createOrder({
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      items,
      paymentMethod,
      customerNote
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(new ApiError(400, 'ORDER_CREATE_FAILED', err.message));
  }
}

async function getByOrderNumber(req, res, next) {
  try {
    const order = await OrderModel.findByOrderNumber(req.params.orderNumber);
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');

    // Customers may only view their own orders; admins may view any.
    if (req.auth?.type === 'customer' && order.customer_id !== req.auth.sub) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this order.');
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const orders = await OrderModel.listForCustomer(req.auth.sub);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

async function listForAdmin(req, res, next) {
  try {
    const { status = null, page = '1', limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const orders = await OrderModel.listForAdmin({ status, limit: limitNum, offset: (pageNum - 1) * limitNum });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, adminNote } = req.body || {};

    if (!VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const existing = await OrderModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');

    let updated;
    if (status === 'cancelled' && existing.order_status !== 'cancelled') {
      await require('../services/orderService').releaseOrderStock(req.params.id);
      updated = await OrderModel.findById(req.params.id);
    } else {
      updated = await OrderModel.updateStatus(req.params.id, status, adminNote);
    }

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'order',
      entityId: req.params.id,
      oldValue: { order_status: existing.order_status },
      newValue: { order_status: status },
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getByOrderNumber, listMine, listForAdmin, updateStatus };
