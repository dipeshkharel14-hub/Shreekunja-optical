/**
 * utils/security.js
 *
 * Centralized security primitives so every part of the app hashes
 * passwords, signs tokens, and generates identifiers the same way.
 * Nothing in this file should ever be duplicated inline elsewhere.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

const BCRYPT_ROUNDS = 12;

// ---------- Passwords ----------

async function hashPassword(plainText) {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

async function comparePassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

/**
 * Minimal password strength gate. This is deliberately not exotic —
 * length is the strongest practical signal — but blocks the obvious
 * mistakes (empty, trivially short, all-whitespace).
 */
function isPasswordStrongEnough(plainText) {
  return typeof plainText === 'string' && plainText.trim().length >= 10;
}

// ---------- JWT (admin + customer sessions) ----------

/**
 * `payload` should be the minimum needed to identify the principal —
 * e.g. { sub: admin.id, type: 'admin', role: admin.role } or
 * { sub: customer.id, type: 'customer' }. Never put permissions
 * themselves in the token as the source of truth; the backend
 * re-checks role/permissions from the database on every request
 * that matters (see middleware/roleGuard.js).
 */
function signToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch {
    return null;
  }
}

// ---------- CSRF ----------

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ---------- Misc identifiers ----------

/**
 * Order number format: SKO-<year>-<6 digit sequence>.
 * The sequence itself should come from a DB sequence/count in
 * services/orderService.js — this only formats it.
 */
function formatOrderNumber(year, sequence) {
  return `SKO-${year}-${String(sequence).padStart(6, '0')}`;
}

function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  isPasswordStrongEnough,
  signToken,
  verifyToken,
  generateCsrfToken,
  timingSafeEqual,
  formatOrderNumber,
  generateResetToken,
  hashResetToken
};
