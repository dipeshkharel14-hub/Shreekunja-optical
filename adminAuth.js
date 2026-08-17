/**
 * middleware/adminAuth.js
 *
 * Requires the request to belong to an authenticated, currently-active
 * admin. Re-fetches the admin row from the database on every request
 * rather than trusting the JWT's stale claims — if an admin is
 * deactivated mid-session, this middleware locks them out immediately
 * instead of waiting for token expiry.
 */

const AdminModel = require('../models/Admin');

async function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.type !== 'admin') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Admin login required.' }
    });
  }

  const admin = await AdminModel.findById(req.auth.sub);

  if (!admin || !admin.active) {
    return res.status(401).json({
      success: false,
      error: { code: 'ACCOUNT_INACTIVE', message: 'This admin account is no longer active.' }
    });
  }

  // Attach the fresh, authoritative record — downstream code (including
  // roleGuard) reads permissions from req.admin, never from req.auth.
  req.admin = admin;
  next();
}

module.exports = { requireAdmin };
