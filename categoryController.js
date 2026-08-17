/**
 * controllers/categoryController.js
 */

const CategoryModel = require('../models/Category');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function list(req, res, next) {
  try {
    const categories = await CategoryModel.listAll({ activeOnly: req.admin ? false : true });
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.nameEn) throw new ApiError(400, 'VALIDATION_ERROR', 'nameEn is required.');

    const slug = body.slug ? slugify(body.slug) : slugify(body.nameEn);
    const category = await CategoryModel.create({ ...body, slug });

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'CATEGORY_CREATED',
      entityType: 'category', entityId: category.id, newValue: { name_en: category.name_en }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await CategoryModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Category not found.');

    const fields = { ...req.body };
    delete fields.id;

    const updated = await CategoryModel.update(req.params.id, fields);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'CATEGORY_UPDATED',
      entityType: 'category', entityId: updated.id, newValue: fields, ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await CategoryModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Category not found.');

    await CategoryModel.remove(req.params.id);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'CATEGORY_DELETED',
      entityType: 'category', entityId: req.params.id, oldValue: { name_en: existing.name_en }, ipAddress: req.ip
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
