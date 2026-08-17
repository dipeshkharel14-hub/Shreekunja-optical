/**
 * controllers/settingController.js
 *
 * Public settings are read-only and unauthenticated. Admin updates are
 * split by field sensitivity: AI configuration and "critical" fields
 * (business identity, currency, tax) are SUPER_ADMIN-only per spec
 * section 33/48 — enforced here (not just at the route level) because
 * a single PATCH could otherwise smuggle a restricted field through
 * an allowed route.
 */

const SettingModel = require('../models/Setting');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

const SUPER_ADMIN_ONLY_FIELDS = new Set([
  'business_name_en', 'business_name_ne', 'currency', 'tax_settings',
  'ai_name', 'ai_welcome_message_en', 'ai_welcome_message_ne', 'ai_personality',
  'ai_temperature', 'ai_max_response_tokens', 'ai_enabled_features'
]);

async function getPublic(req, res, next) {
  try {
    const settings = await SettingModel.getPublic();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

async function getAllForAdmin(req, res, next) {
  try {
    const settings = await SettingModel.getAll();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const fields = { ...req.body };
    delete fields.id;
    delete fields.updated_at;

    const touchesRestricted = Object.keys(fields).some((f) => SUPER_ADMIN_ONLY_FIELDS.has(f));

    if (touchesRestricted && req.admin.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Only the super admin can change these settings.');
    }

    const updated = await SettingModel.update(fields);

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'SETTINGS_CHANGED',
      entityType: 'settings',
      entityId: '1',
      newValue: fields,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublic, getAllForAdmin, update };
