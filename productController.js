/**
 * controllers/productController.js
 *
 * Public browsing endpoints plus admin product management. Full
 * bulk-actions and image reordering (spec sections 7, 18) are noted
 * as TODOs for the storefront-integration phase — the data layer
 * (models/Product.js) already supports the pieces needed for them.
 */

const ProductModel = require('../models/Product');
const AuditLogModel = require('../models/AuditLog');
const { ApiError } = require('../middleware/errorHandler');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------- Public ----------------

async function list(req, res, next) {
  try {
    const {
      q = '', category = null, minPrice, maxPrice, brand, frameShape,
      frameMaterial, color, gender, inStock, featured, bestSeller, newArrival,
      sort = 'newest', page = '1', limit = '24'
    } = req.query;

    const limitNum = Math.min(parseInt(limit, 10) || 24, 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const result = await ProductModel.search({
      keyword: q,
      categorySlug: category,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      brand: brand || null,
      frameShape: frameShape || null,
      frameMaterial: frameMaterial || null,
      color: color || null,
      gender: gender || null,
      inStockOnly: inStock === 'true',
      featured: featured === 'true' ? true : featured === 'false' ? false : null,
      bestSeller: bestSeller === 'true' ? true : null,
      newArrival: newArrival === 'true' ? true : null,
      sort,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    });

    res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, page: pageNum, limit: limitNum, totalPages: Math.ceil(result.total / limitNum) }
    });
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    const product = await ProductModel.findBySlug(req.params.slug);
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

// ---------------- Admin ----------------

async function create(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.nameEn || !body.sku || !body.price) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'sku, nameEn, and price are required.');
    }

    const existingSku = await ProductModel.findBySku(body.sku);
    if (existingSku) throw new ApiError(409, 'SKU_TAKEN', 'A product with this SKU already exists.');

    const slug = body.slug ? slugify(body.slug) : slugify(`${body.nameEn}-${body.sku}`);

    const product = await ProductModel.create({ ...body, slug });

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: product.id,
      newValue: { sku: product.sku, name_en: product.name_en, price: product.price },
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await ProductModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');

    const fields = { ...req.body };
    delete fields.id;
    delete fields.created_at;

    const priceChanged = fields.price !== undefined && Number(fields.price) !== Number(existing.price);

    const updated = await ProductModel.update(req.params.id, fields);

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: priceChanged ? 'PRODUCT_PRICE_CHANGED' : 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: updated.id,
      oldValue: priceChanged ? { price: existing.price } : undefined,
      newValue: priceChanged ? { price: updated.price } : fields,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await ProductModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');

    await ProductModel.remove(req.params.id);

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'PRODUCT_DELETED',
      entityType: 'product',
      entityId: req.params.id,
      oldValue: { sku: existing.sku, name_en: existing.name_en },
      ipAddress: req.ip
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

async function adjustStock(req, res, next) {
  try {
    const { delta, note } = req.body || {};
    if (typeof delta !== 'number' || delta === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'delta must be a non-zero number.');
    }

    const existing = await ProductModel.findById(req.params.id);
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');

    const result = await ProductModel.adjustStock(req.params.id, delta, { adminId: req.admin.id, note });

    await AuditLogModel.record({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'PRODUCT_STOCK_CHANGED',
      entityType: 'product',
      entityId: req.params.id,
      oldValue: { stock: existing.stock },
      newValue: { stock: result.stock },
      ipAddress: req.ip
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listLowStock(req, res, next) {
  try {
    const items = await ProductModel.listLowStock();
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getBySlug, create, update, remove, adjustStock, listLowStock };
