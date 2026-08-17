/**
 * models/Order.js
 *
 * Query layer for `orders` + `order_items`. Order CREATION (which
 * touches stock, order numbering, and items atomically) lives in
 * services/orderService.js — this model is the lower-level data
 * access used by that service and by the admin/customer read routes.
 */

const { query } = require('../config/database');

async function findById(id) {
  const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await query('SELECT * FROM order_items WHERE order_id = $1', [id]);
  order.items = itemsResult.rows;
  return order;
}

async function findByOrderNumber(orderNumber) {
  const orderResult = await query('SELECT * FROM orders WHERE order_number = $1', [orderNumber]);
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemsResult = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  order.items = itemsResult.rows;
  return order;
}

async function listForCustomer(customerId, { limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );
  return result.rows;
}

async function listForAdmin({ status = null, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (status) {
    conditions.push(`order_status = $${i}`);
    params.push(status);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  params.push(offset);

  const result = await query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  return result.rows;
}

async function updateStatus(id, status, adminNote = null) {
  const result = await query(
    `UPDATE orders SET order_status = $2, admin_note = COALESCE($3, admin_note), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status, adminNote]
  );
  return result.rows[0] || null;
}

async function updatePaymentStatus(id, paymentStatus) {
  const result = await query(
    `UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, paymentStatus]
  );
  return result.rows[0] || null;
}

async function countTodayOrders() {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM orders WHERE created_at >= date_trunc('day', now())`
  );
  return result.rows[0].count;
}

async function countPendingOrders() {
  const result = await query(`SELECT COUNT(*)::int AS count FROM orders WHERE order_status = 'pending'`);
  return result.rows[0].count;
}

async function revenueSince(sinceDate) {
  const result = await query(
    `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*)::int AS order_count
     FROM orders WHERE created_at >= $1 AND payment_status = 'paid'`,
    [sinceDate]
  );
  return result.rows[0];
}

module.exports = {
  findById,
  findByOrderNumber,
  listForCustomer,
  listForAdmin,
  updateStatus,
  updatePaymentStatus,
  countTodayOrders,
  countPendingOrders,
  revenueSince
};
