/**
 * middleware/rateLimit.js
 *
 * Named rate-limit presets built on express-rate-limit. Keeping them
 * here (rather than inline per-route) makes the limits easy to audit
 * and tune in one place.
 */

const rateLimit = require('express-rate-limit');

function jsonRateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down and try again shortly.' }
  });
}

// General API traffic (per-IP).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler
});

// Admin & customer login — tight, to blunt credential-stuffing/brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  skipSuccessfulRequests: true
});

// Shreekunja AI chat — generous but bounded, since each call costs tokens.
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler
});

// Password reset requests — prevent email/SMS bombing.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler
});

module.exports = { apiLimiter, loginLimiter, aiChatLimiter, passwordResetLimiter };
