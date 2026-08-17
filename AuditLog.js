/**
 * models/AuditLog.js
 *
 * Append-only admin action log (spec sections 17, 28, 59). Write with
 * `record()` from controllers whenever an admin performs a meaningful
 * mutation. Reading the FULL log is SUPER_ADMIN-only — enforced in the
 * route, not here — but this model exposes both a full and scoped read
 * so that restriction stays in one obvious place.
 */

const { query } = require('../config/database');

async function record({ adminId, adminName, action, entityType = null, entityId = null, oldValue = null, newValue = null, ipAddress = null }) {
  await query(
    `INSERT INTO audit_logs (admin_id, admin_name, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [adminId, adminName, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ipAddress]
  );
}

async function listRecent({ limit = 50, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function listForEntity(entityType, entityId) {
  const result = await query(
    `SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return result.rows;
}

module.exports = { record, listRecent, listForEntity };
