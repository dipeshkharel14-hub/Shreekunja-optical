/**
 * routes/admin.js
 * Mounted at /api/admin. Admin auth + dashboard + audit logs +
 * admin-account status (activate/deactivate — never create/delete).
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole, requirePermission } = require('../middleware/roleGuard');
const { loginLimiter } = require('../middleware/rateLimit');

// Admin auth
router.post('/login', loginLimiter, authController.adminLogin);
router.post('/logout', identify, authController.adminLogout);
router.get('/me', identify, requireAdmin, authController.adminMe);

// Dashboard — any active admin
router.get('/dashboard', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.dashboard);

// Audit logs — full log is SUPER_ADMIN-only (spec section 28)
router.get('/audit-logs', identify, requireAdmin, requirePermission('audit_logs_full'), adminController.auditLogs);

// Admin account management — SUPER_ADMIN-only (spec section 16/48)
router.get('/admins', identify, requireAdmin, requirePermission('manage_admins'), adminController.listAdmins);
router.patch('/admins/:id/status', identify, requireAdmin, requirePermission('manage_admins'), adminController.setAdminActive);

module.exports = router;
ash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, active, created_at`,
    [name, email.toLowerCase(), passwordHash, role]
  );

  return result.rows[0];
}

async function recordSuccessfulLogin(id) {
  await query(
    `UPDATE admins
     SET last_login_at = now(), failed_login_count = 0, locked_until = NULL
     WHERE id = $1`,
    [id]
  );
}

async function recordFailedLogin(id, { lockThreshold = 5, lockMinutes = 15 } = {}) {
  const result = await query(
    `UPDATE admins
     SET failed_login_count = failed_login_count + 1
     WHERE id = $1
     RETURNING failed_login_count`,
    [id]
  );

  const failedCount = result.rows[0]?.failed_login_count || 0;

  if (failedCount >= lockThreshold) {
    await query(
      `UPDATE admins SET locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1`,
      [id, String(lockMinutes)]
    );
  }

  return failedCount;
}

function isLocked(admin) {
  return Boolean(admin.locked_until && new Date(admin.locked_until) > new Date());
}

async function setActive(id, active) {
  const result = await query(
    `UPDATE admins SET active = $2, updated_at = now() WHERE id = $1
     RETURNING id, name, email, role, active`,
    [id, active]
  );
  return result.rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  await query(
    `UPDATE admins SET password_hash = $2, updated_at = now() WHERE id = $1`,
    [id, passwordHash]
  );
}

module.exports = {
  MAX_ADMINS,
  findById,
  findByEmail,
  count,
  listAll,
  createAdmin,
  recordSuccessfulLogin,
  recordFailedLogin,
  isLocked,
  setActive,
  updatePassword
};
