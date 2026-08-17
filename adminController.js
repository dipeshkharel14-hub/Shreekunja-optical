/**
 * controllers/adminController.js
 *
 * Dashboard summary + audit log reads + admin account status changes.
 * There is deliberately NO "create admin" endpoint here — per spec
 * section 16/49, admin accounts are only ever created by the seed
 * script, never through the API.
 */

const AdminModel = require('../models/Admin');
const OrderModel = require('../models/Order');
const ProductModel = require('../models/Product');
const AuditLogModel = require('../models/AuditLog');
const { query } = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');

async function dashboard(req, res, next) {
  try {
    const [todayOrders, pendingOrders, revenue30d, lowStock, customerCount, productCount] = await Promise.all([
      OrderModel.countTodayOrders(),
      OrderModel.countPendingOrders(),
      OrderModel.revenueSince(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      ProductModel.listLowStock(10),
      query('SELECT COUNT(*)::int AS count FROM customers'),
      query('SELECT COUNT(*)::int AS count FROM products WHERE active = true')
    ]);

    res.json({
      success: true,
      data: {
        todaysOrders: todayOrders,
        pendingOrders,
        revenueLast30Days: revenue30d.revenue,
        ordersLast30Days: revenue30d.order_count,
        totalCustomers: customerCount.rows[0].count,
        totalProducts: productCount.rows[0].count,
        lowStockProducts: lowStock
      }
    });
  } catch (err) {
    next(err);
  }
}

async function auditLogs(req, res, next) {
  try {
    // Full audit log is SUPER_ADMIN-only (enforced via requirePermission
    // in the route); this controller assumes that's already checked.
    const { page = '1', limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const logs = await AuditLogModel.listRecent({ limit: limitNum, offset: (pageNum - 1) * limitNum });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

async function listAdmins(req, res, next) {
  try {
    const admins = await AdminModel.listAll();
    res.json({ success: true, data: admins });
  } catch (err) {
    next(err);
  }
}

/**
 * SUPER_ADMIN can deactivate/reactivate ADMIN accounts — but never
 * their own account, and there is no route to change roles or create
 * a 4th admin (see file header + models/Admin.js MAX_ADMINS).
 */
async function setAdminActive(req, res, next) {
  try {
    const { active } = req.body || {};
    const targetId = req.params.id;

    if (targetId === req.admin.id) {
      throw new ApiError(400, 'INVALID_OPERATION', 'You cannot deactivate your own account.');
    }

    const target = await AdminModel.findById(targetId);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Admin not found.');

    const updated = await AdminModel.setActive(targetId, Boolean(active));

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: active ? 'ADMIN_REACTIVATED' : 'ADMIN_DEACTIVATED',
      entityType: 'admin',
      entityId: targetId,
      newValue: { active: Boolean(active) },
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, auditLogs, listAdmins, setAdminActive };
