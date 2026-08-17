/**
 * controllers/blogController.js
 *
 * NOTE: rich-text content sanitization (spec section 22 — "never
 * render unsanitized arbitrary HTML") is a TODO wired here as a clear
 * marker: `sanitizeHtml()` must run on content_en/content_ne before
 * they are stored, once a sanitizer (e.g. sanitize-html) is added in
 * the blog-CMS phase. Left unimplemented rather than faked so nobody
 * mistakes a passthrough for real sanitization.
 */

const BlogModel = require('../models/Blog');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// eslint-disable-next-line no-unused-vars
function sanitizeHtml(html) {
  throw new Error('sanitizeHtml() is not yet implemented — do not store/render blog HTML content until this is wired to a real sanitizer (blog-CMS phase).');
}

async function listPublished(req, res, next) {
  try {
    const { category = null, page = '1', limit = '12' } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 12, 50);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const posts = await BlogModel.listPublished({ category, limit: limitNum, offset: (pageNum - 1) * limitNum });
    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    const post = await BlogModel.findBySlug(req.params.slug);
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'Blog post not found.');
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

async function listForAdmin(req, res, next) {
  try {
    const posts = await BlogModel.listAllForAdmin();
    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.titleEn) throw new ApiError(400, 'VALIDATION_ERROR', 'titleEn is required.');

    const slug = body.slug ? slugify(body.slug) : slugify(body.titleEn);
    const post = await BlogModel.create({ ...body, slug });

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'BLOG_CREATED',
      entityType: 'blog_post', entityId: post.id, newValue: { title_en: post.title_en }, ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await BlogModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Blog post not found.');

    const fields = { ...req.body };
    delete fields.id;

    const updated = await BlogModel.update(req.params.id, fields);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'BLOG_UPDATED',
      entityType: 'blog_post', entityId: updated.id, newValue: fields, ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function setPublished(req, res, next) {
  try {
    const { published } = req.body || {};
    const updated = await BlogModel.setPublished(req.params.id, Boolean(published));
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Blog post not found.');

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name,
      action: published ? 'BLOG_PUBLISHED' : 'BLOG_UNPUBLISHED',
      entityType: 'blog_post', entityId: updated.id, ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await BlogModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Blog post not found.');

    await BlogModel.remove(req.params.id);

    await AuditLogModel.record({
      adminId: req.admin.id, adminName: req.admin.name, action: 'BLOG_DELETED',
      entityType: 'blog_post', entityId: req.params.id, oldValue: { title_en: existing.title_en }, ipAddress: req.ip
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublished, getBySlug, listForAdmin, create, update, setPublished, remove };
