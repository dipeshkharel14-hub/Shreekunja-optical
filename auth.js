/**
 * middleware/auth.js
 *
 * Verifies the session JWT (read from an HTTP-only cookie) and attaches
 * the authenticated principal to `req.auth`. This middleware only
 * establishes IDENTITY. It never grants permissions itself — that is
 * `adminAuth.js` / `roleGuard.js`'s job, which re-check the database.
 *
 * Frontend-supplied role/permission claims are never trusted; only the
 * token's `sub` (subject id) is used to look up the real, current
 * record from the database at the point authorization is checked.
 */

const { verifyToken } = require('../utils/security');

const COOKIE_NAME = 'sko_session';

/**
 * Populates req.auth = { sub, type, role } if a valid token is present.
 * Does NOT reject the request if absent — use `requireAuth` for that.
 * Keeping identification and enforcement separate lets public routes
 * optionally personalize a response (e.g. AI chat) without requiring login.
 */
function identify(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.auth = decoded; // { sub, type: 'admin' | 'customer', role? }
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Login required.' }
    });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.auth || req.auth.type !== 'customer') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Customer login required.' }
    });
  }
  next();
}

function setSessionCookie(res, token, config) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days; keep in sync with JWT_EXPIRES_IN
  });
}

function clearSessionCookie(res, config) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax'
  });
}

module.exports = {
  COOKIE_NAME,
  identify,
  requireAuth,
  requireCustomer,
  setSessionCookie,
  clearSessionCookie
};
