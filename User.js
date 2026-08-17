/**
 * models/User.js
 *
 * Query layer for the `customers` table (storefront user accounts).
 * Named User.js to match the spec's suggested file layout (section 35)
 * even though the table is `customers` — Customer-specific business
 * concepts (addresses, orders) live in their own models/services.
 */

const { query } = require('../config/database');

async function findById(id) {
  const result = await query('SELECT * FROM customers WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0] || null;
}

async function findByPhone(phone) {
  const result = await query('SELECT * FROM customers WHERE phone = $1', [phone]);
  return result.rows[0] || null;
}

async function create({ name, email, phone, passwordHash }) {
  const result = await query(
    `INSERT INTO customers (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, created_at`,
    [name, email ? email.toLowerCase() : null, phone || null, passwordHash]
  );
  return result.rows[0];
}

async function updateProfile(id, { name, email, phone, avatarUrl }) {
  const result = await query(
    `UPDATE customers
     SET name = COALESCE($2, name),
         email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         avatar_url = COALESCE($5, avatar_url),
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, email, phone, avatar_url`,
    [id, name, email, phone, avatarUrl]
  );
  return result.rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  await query('UPDATE customers SET password_hash = $2, updated_at = now() WHERE id = $1', [id, passwordHash]);
}

async function setResetToken(id, tokenHash, expiresAt) {
  await query(
    'UPDATE customers SET reset_token_hash = $2, reset_token_expires_at = $3 WHERE id = $1',
    [id, tokenHash, expiresAt]
  );
}

async function findByValidResetTokenHash(tokenHash) {
  const result = await query(
    `SELECT * FROM customers
     WHERE reset_token_hash = $1 AND reset_token_expires_at > now()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function clearResetToken(id) {
  await query('UPDATE customers SET reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $1', [id]);
}

async function setStatus(id, status) {
  const result = await query(
    `UPDATE customers SET status = $2, updated_at = now() WHERE id = $1
     RETURNING id, name, email, phone, status`,
    [id, status]
  );
  return result.rows[0] || null;
}

async function listForAdmin({ limit = 50, offset = 0, search = '' } = {}) {
  const result = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.status, c.created_at,
            COUNT(o.id)::int AS total_orders,
            COALESCE(SUM(o.total), 0) AS total_spent,
            MAX(o.created_at) AS last_order_at
     FROM customers c
     LEFT JOIN orders o ON o.customer_id = c.id
     WHERE ($3 = '' OR c.name ILIKE '%' || $3 || '%' OR c.email ILIKE '%' || $3 || '%' OR c.phone ILIKE '%' || $3 || '%')
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, search]
  );
  return result.rows;
}

module.exports = {
  findById,
  findByEmail,
  findByPhone,
  create,
  updateProfile,
  updatePassword,
  setResetToken,
  findByValidResetTokenHash,
  clearResetToken,
  setStatus,
  listForAdmin
};
