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

// Maps the camelCase field names the API accepts (matching create()'s
// input shape) to the actual snake_case database columns. Needed because
// ProductModel.update() builds `SET <col> = $n` directly from whatever
// keys it's given — passing camelCase straight through silently fails
// (Postgres folds unquoted identifiers to lowercase: "nameEn" -> "nameen",
// which doesn't exist), so every field accepted here MUST be mapped.
const PRODUCT_FIELD_MAP = {
  nameEn: 'name_en', nameNe: 'name_ne', descriptionEn: 'description_en', descriptionNe: 'description_ne',
  categoryId: 'category_id', subcategory: 'subcategory', brand: 'brand', gender: 'gender',
  frameType: 'frame_type', frameMaterial: 'frame_material', frameShape: 'frame_shape', color: 'color',
  size: 'size', lensType: 'lens_type', featuresEn: 'features_en', featuresNe: 'features_ne',
  price: 'price', compareAtPrice: 'compare_at_price', discountPercent: 'discount_percent',
  stock: 'stock', lowStockThreshold: 'low_stock_threshold',
  prescriptionSupported: 'prescription_supported', lensIndex: 'lens_index', uvProtection: 'uv_protection',
  blueCut: 'blue_cut', antiReflective: 'anti_reflective', photochromic: 'photochromic', polarized: 'polarized',
  progressive: 'progressive', waterRepellent: 'water_repellent', scratchResistant: 'scratch_resistant',
  featured: 'featured', bestSeller: 'best_seller', newArrival: 'new_arrival', active: 'active',
  seoTitle: 'seo_title', seoDescription: 'seo_description', slug: 'slug'
};

function mapProductFields(body) {
  const mapped = {};
  for (const [key, value] of Object.entries(body)) {
    const column = PRODUCT_FIELD_MAP[key] || (Object.values(PRODUCT_FIELD_MAP).includes(key) ? key : null);
    if (column) mapped[column] = value;
    // Unknown keys are silently dropped rather than passed through —
    // the alternative (forwarding unmapped keys as-is) is what caused
    // this bug in the first place.
  }
  return mapped;
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

    const fields = mapProductFields(req.body || {});
    delete fields.id;
    delete fields.created_at;

    // Recompute stock_status whenever stock is set directly through this
    // generic PATCH — otherwise it goes stale (e.g. stock:15 would keep
    // whatever stock_status the row happened to have before, even
    // "out_of_stock"). adjustStock() already does this correctly for
    // delta-based changes; this covers the "set an absolute value" path.
    if (fields.stock !== undefined) {
      const threshold = fields.low_stock_threshold ?? existing.low_stock_threshold;
      fields.stock_status = ProductModel.computeStockStatus(fields.stock, threshold);
    }

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
