/**
 * middleware/roleGuard.js
 *
 * Role-based access control. Must run AFTER `requireAdmin` (which
 * attaches the authoritative `req.admin` record). This file is the
 * single place that encodes "who can do what" — see section 48 of the
 * master spec (permission matrix).
 *
 *   SUPER_ADMIN (Dipesh Kharel): everything.
 *   ADMIN (Durga Kharel, Devi Prasad Kharel): products, inventory,
 *     orders, customers, blog, services, basic analytics.
 *   ADMIN cannot: manage admins, configure AI, change critical/system
 *     settings, view full audit logs, store-wide configuration.
 */

const SUPER_ADMIN_ONLY = new Set([
  'manage_admins',
  'ai_configuration',
  'system_settings',
  'audit_logs_full',
  'critical_security_settings',
  'store_wide_configuration'
]);

/**
 * requireRole('SUPER_ADMIN') — only the super admin may proceed.
 * requireRole(['SUPER_ADMIN', 'ADMIN']) — either role may proceed
 *   (effectively "any authenticated admin").
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Admin login required.' }
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }
      });
    }

    next();
  };
}

/**
 * requirePermission('manage_admins') — checks against the named
 * SUPER_ADMIN_ONLY capability set. Anything not in that set is
 * available to any active admin (ADMIN or SUPER_ADMIN).
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Admin login required.' }
      });
    }

    const restricted = SUPER_ADMIN_ONLY.has(permission);

    if (restricted && req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the super admin can perform this action.' }
      });
    }

    next();
  };
}

module.exports = { requireRole, requirePermission, SUPER_ADMIN_ONLY };
