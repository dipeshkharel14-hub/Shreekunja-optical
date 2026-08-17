/**
 * services/orderService.js
 *
 * Order creation is the one piece of "phase 1" business logic worth
 * building now rather than stubbing: it's the transaction that ties
 * together orders + order_items + inventory together correctly, and
 * getting that atomic from the start avoids overselling stock later
 * once checkout (phase 4) calls into it. Full checkout validation
 * (address, payment method rules, coupons) still belongs to phase 4 —
 * this only covers "given validated items, create the order safely."
 */

const { getClient, query } = require('../config/database');
const { formatOrderNumber } = require('../utils/security');

async function nextOrderSequence(client, year) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM orders WHERE order_number LIKE $1`,
    [`SKO-${year}-%`]
  );
  return result.rows[0].count + 1;
}

/**
 * items: [{ productId, quantity, prescriptionId? }]
 * Locks each product row, verifies stock, computes snapshot pricing,
 * writes the order + items + inventory logs atomically.
 */
async function createOrder({ customerId = null, customerName, customerPhone, customerEmail = null, shippingAddress, items, paymentMethod = 'cod', customerNote = null, deliveryFee = 0, discount = 0 }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one item.');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const orderItemRows = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, sku, name_en, name_ne, price, stock, low_stock_threshold FROM products WHERE id = $1 AND active = true FOR UPDATE',
        [item.productId]
      );
      const product = productResult.rows[0];

      if (!product) {
        throw new Error(`Product ${item.productId} not found or is no longer available.`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name_en}. Only ${product.stock} left.`);
      }

      const lineTotal = Number(product.price) * item.quantity;
      subtotal += lineTotal;

      orderItemRows.push({
        productId: product.id,
        nameEn: product.name_en,
        nameNe: product.name_ne,
        sku: product.sku,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal,
        prescriptionId: item.prescriptionId || null,
        lowStockThreshold: product.low_stock_threshold
      });

      const newStock = product.stock - item.quantity;
      const newStatus = newStock <= 0 ? 'out_of_stock' : newStock <= product.low_stock_threshold ? 'low_stock' : 'in_stock';

      await client.query(
        'UPDATE products SET stock = $2, stock_status = $3, updated_at = now() WHERE id = $1',
        [product.id, newStock, newStatus]
      );

      await client.query(
        `INSERT INTO inventory_logs (product_id, change_type, quantity_delta, stock_after, note)
         VALUES ($1, 'order_reserved', $2, $3, 'Reserved for new order')`,
        [product.id, -item.quantity, newStock]
      );
    }

    const total = subtotal - discount + deliveryFee;
    const year = new Date().getFullYear();
    const sequence = await nextOrderSequence(client, year);
    const orderNumber = formatOrderNumber(year, sequence);

    const orderResult = await client.query(
      `INSERT INTO orders (
         order_number, customer_id, customer_name, customer_phone, customer_email,
         shipping_address, subtotal, discount, delivery_fee, total, payment_method, customer_note
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [orderNumber, customerId, customerName, customerPhone, customerEmail, JSON.stringify(shippingAddress), subtotal, discount, deliveryFee, total, paymentMethod, customerNote]
    );
    const order = orderResult.rows[0];

    for (const row of orderItemRows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name_en, product_name_ne, sku, unit_price, quantity, line_total, prescription_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [order.id, row.productId, row.nameEn, row.nameNe, row.sku, row.unitPrice, row.quantity, row.lineTotal, row.prescriptionId]
      );
    }

    await client.query('COMMIT');

    order.items = orderItemRows;
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Releases reserved stock back to inventory — used when an order is
 * cancelled before fulfillment.
 */
async function releaseOrderStock(orderId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const itemsResult = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);

    for (const item of itemsResult.rows) {
      const productResult = await client.query('SELECT stock, low_stock_threshold FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      const product = productResult.rows[0];
      if (!product) continue;

      const newStock = product.stock + item.quantity;
      const newStatus = newStock <= 0 ? 'out_of_stock' : newStock <= product.low_stock_threshold ? 'low_stock' : 'in_stock';

      await client.query('UPDATE products SET stock = $2, stock_status = $3, updated_at = now() WHERE id = $1', [item.product_id, newStock, newStatus]);
      await client.query(
        `INSERT INTO inventory_logs (product_id, change_type, quantity_delta, stock_after, note)
         VALUES ($1, 'order_released', $2, $3, 'Released from cancelled order')`,
        [item.product_id, item.quantity, newStock]
      );
    }

    await client.query('UPDATE orders SET order_status = $2, updated_at = now() WHERE id = $1', [orderId, 'cancelled']);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createOrder, releaseOrderStock };
