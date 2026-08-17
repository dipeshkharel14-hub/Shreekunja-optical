/**
 * controllers/authController.js
 *
 * Admin and customer authentication. Two principal types share the
 * same JWT/cookie mechanism (utils/security.js + middleware/auth.js)
 * but different tables and different post-login payloads — admins
 * never get a "customer" token and vice versa.
 */

const AdminModel = require('../models/Admin');
const UserModel = require('../models/User');
const AuditLogModel = require('../models/AuditLog');
const { hashPassword, comparePassword, isPasswordStrongEnough, signToken } = require('../utils/security');
const { setSessionCookie, clearSessionCookie } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { EMAIL_PATTERN } = require('../middleware/validation');
const config = require('../config/env');

// ---------------------------------------------------------------
// ADMIN AUTH
// ---------------------------------------------------------------

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required.');
    }

    const admin = await AdminModel.findByEmail(String(email).trim());

    // Constant-shape response whether the email exists or not, to avoid
    // leaking which admin emails are valid.
    if (!admin) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (AdminModel.isLocked(admin)) {
      throw new ApiError(423, 'ACCOUNT_LOCKED', 'This account is temporarily locked due to failed login attempts. Try again later.');
    }

    if (!admin.active) {
      throw new ApiError(401, 'ACCOUNT_INACTIVE', 'This admin account is no longer active.');
    }

    const passwordOk = await comparePassword(password, admin.password_hash);

    if (!passwordOk) {
      await AdminModel.recordFailedLogin(admin.id);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    await AdminModel.recordSuccessfulLogin(admin.id);

    const token = signToken({ sub: admin.id, type: 'admin', role: admin.role });
    setSessionCookie(res, token, config);

    await AuditLogModel.record({
      adminId: admin.id,
      adminName: admin.name,
      action: 'ADMIN_LOGIN',
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    next(err);
  }
}

async function adminLogout(req, res) {
  clearSessionCookie(res, config);
  res.json({ success: true, data: { loggedOut: true } });
}

async function adminMe(req, res, next) {
  try {
    if (!req.admin) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Not logged in.');
    }
    res.json({
      success: true,
      data: { id: req.admin.id, name: req.admin.name, email: req.admin.email, role: req.admin.role }
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------
// CUSTOMER AUTH
// ---------------------------------------------------------------

async function customerRegister(req, res, next) {
  try {
    const { name, email, phone, password } = req.body || {};

    if (!name || !password || (!email && !phone)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Name, password, and at least one of email or phone are required.');
    }

    if (email && !EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Please provide a valid email address.');
    }

    if (!isPasswordStrongEnough(password)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 10 characters.');
    }

    if (email) {
      const existing = await UserModel.findByEmail(email);
      if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    if (phone) {
      const existing = await UserModel.findByPhone(phone);
      if (existing) throw new ApiError(409, 'PHONE_TAKEN', 'An account with this phone number already exists.');
    }

    const passwordHash = await hashPassword(password);
    const customer = await UserModel.create({ name, email, phone, passwordHash });

    const token = signToken({ sub: customer.id, type: 'customer' });
    setSessionCookie(res, token, config);

    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

async function customerLogin(req, res, next) {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Email/phone and password are required.');
    }

    const customer = identifier.includes('@')
      ? await UserModel.findByEmail(identifier)
      : await UserModel.findByPhone(identifier);

    if (!customer) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    if (customer.status === 'disabled') {
      throw new ApiError(401, 'ACCOUNT_DISABLED', 'This account has been disabled.');
    }

    const passwordOk = await comparePassword(password, customer.password_hash);
    if (!passwordOk) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    const token = signToken({ sub: customer.id, type: 'customer' });
    setSessionCookie(res, token, config);

    res.json({
      success: true,
      data: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone }
    });
  } catch (err) {
    next(err);
  }
}

async function customerLogout(req, res) {
  clearSessionCookie(res, config);
  res.json({ success: true, data: { loggedOut: true } });
}

async function me(req, res, next) {
  try {
    if (!req.auth || req.auth.type !== 'customer') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Not logged in.');
    }

    const customer = await UserModel.findById(req.auth.sub);
    if (!customer) throw new ApiError(404, 'NOT_FOUND', 'Account not found.');

    res.json({
      success: true,
      data: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, avatarUrl: customer.avatar_url }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminLogin,
  adminLogout,
  adminMe,
  customerRegister,
  customerLogin,
  customerLogout,
  me
};
