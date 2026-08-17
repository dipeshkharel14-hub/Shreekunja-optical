/**
 * controllers/serviceController.js
 */

const ServiceModel = require('../models/Service');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

async function list(req, res, next) {
  try {
    const services = await ServiceModel.listAll({ activeOnly: !req.admin });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.nameEn) throw new ApiError(400, 'VALIDATION_ERROR', 'nameEn is required.');

    const service = await ServiceModel.create(body);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'SERVICE_CREATED',
      entityType: 'service', entityId: service.id, newValue: { name_en: service.name_en }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await ServiceModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');

    const updated = await ServiceModel.update(req.params.id, req.body || {});

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'SERVICE_UPDATED',
      entityType: 'service', entityId: updated.id, ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await ServiceModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');

    await ServiceModel.remove(req.params.id);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'SERVICE_DELETED',
      entityType: 'service', entityId: req.params.id, ipAddress: req.ip
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
