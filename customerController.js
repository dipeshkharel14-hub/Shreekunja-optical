/**
 * controllers/customerController.js
 * Admin-facing customer management (spec section 26).
 */

const UserModel = require('../models/User');
const OrderModel = require('../models/Order');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

async function list(req, res, next) {
  try {
    const { search = '', page = '1', limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const customers = await UserModel.listForAdmin({ search, limit: limitNum, offset: (pageNum - 1) * limitNum });
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const customer = await UserModel.findById(req.params.id);
    if (!customer) throw new ApiError(404, 'NOT_FOUND', 'Customer not found.');

    const orders = await OrderModel.listForCustomer(req.params.id);

    const { password_hash, reset_token_hash, ...safeCustomer } = customer;
    res.json({ success: true, data: { ...safeCustomer, orders } });
  } catch (err) {
    next(err);
  }
}

async function setStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!['active', 'disabled'].includes(status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'status must be "active" or "disabled".');
    }

    const updated = await UserModel.setStatus(req.params.id, status);
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Customer not found.');

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name,
      action: status === 'disabled' ? 'CUSTOMER_DISABLED' : 'CUSTOMER_REACTIVATED',
      entityType: 'customer', entityId: req.params.id, ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, setStatus };
