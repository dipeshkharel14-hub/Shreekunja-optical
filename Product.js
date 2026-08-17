/**
 * models/Product.js
 *
 * Query layer for `products` (+ `product_images`, `inventory_logs`).
 * This is the model Shreekunja AI's tool-calling layer (services/aiService.js)
 * will call into for searchProducts/getProduct/getStock — so its shape
 * matters for phase 2/5, not just the admin CRUD screens.
 */

const { query, getClient } = require('../config/database');

const PRODUCT_IMAGES_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'is_primary', pi.is_primary, 'sort_order', pi.sort_order) ORDER BY pi.sort_order)
     FROM product_images pi WHERE pi.product_id = p.id),
    '[]'
  ) AS images
`;

async function findById(id) {
  const result = await query(
    `SELECT p.*, ${PRODUCT_IMAGES_SUBQUERY}, c.name_en AS category_name_en, c.name_ne AS category_name_ne, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findBySlug(slug) {
  const result = await query(
    `SELECT p.*, ${PRODUCT_IMAGES_SUBQUERY}, c.name_en AS category_name_en, c.name_ne AS category_name_ne, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.active = true`,
    [slug]
  );
  return result.rows[0] || null;
}

async function findBySku(sku) {
  const result = await query('SELECT * FROM products WHERE sku = $1', [sku]);
  return result.rows[0] || null;
}

/**
 * The single search/filter/sort entry point used by both the public
 * storefront API and Shreekunja AI's searchProducts() tool.
 */
async function search({
  keyword = '',
  categorySlug = null,
  minPrice = null,
  maxPrice = null,
  brand = null,
  frameShape = null,
  frameMaterial = null,
  color = null,
  gender = null,
  inStockOnly = false,
  featured = null,
  bestSeller = null,
  newArrival = null,
  sort = 'newest',
  limit = 24,
  offset = 0,
  includeInactive = false
} = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (!includeInactive) {
    conditions.push(`p.active = true`);
  }

  if (keyword) {
    conditions.push(`(p.name_en ILIKE $${i} OR p.name_ne ILIKE $${i} OR p.description_en ILIKE $${i} OR p.brand ILIKE $${i} OR p.sku ILIKE $${i})`);
    params.push(`%${keyword}%`);
    i++;
  }

  if (categorySlug) {
    conditions.push(`c.slug = $${i}`);
    params.push(categorySlug);
    i++;
  }

  if (minPrice !== null) {
    conditions.push(`p.price >= $${i}`);
    params.push(minPrice);
    i++;
  }

  if (maxPrice !== null) {
    conditions.push(`p.price <= $${i}`);
    params.push(maxPrice);
    i++;
  }

  if (brand) {
    conditions.push(`p.brand ILIKE $${i}`);
    params.push(brand);
    i++;
  }

  if (frameShape) {
    conditions.push(`p.frame_shape ILIKE $${i}`);
    params.push(frameShape);
    i++;
  }

  if (frameMaterial) {
    conditions.push(`p.frame_material ILIKE $${i}`);
    params.push(frameMaterial);
    i++;
  }

  if (color) {
    conditions.push(`p.color ILIKE $${i}`);
    params.push(color);
    i++;
  }

  if (gender) {
    conditions.push(`p.gender = $${i}`);
    params.push(gender);
    i++;
  }

  if (inStockOnly) {
    conditions.push(`p.stock_status IN ('in_stock', 'low_stock')`);
  }

  if (featured !== null) {
    conditions.push(`p.featured = $${i}`);
    params.push(featured);
    i++;
  }

  if (bestSeller !== null) {
    conditions.push(`p.best_seller = $${i}`);
    params.push(bestSeller);
    i++;
  }

  if (newArrival !== null) {
    conditions.push(`p.new_arrival = $${i}`);
    params.push(newArrival);
    i++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    newest: 'p.created_at DESC',
    price_low: 'p.price ASC',
    price_high: 'p.price DESC',
    popular: 'p.best_seller DESC, p.created_at DESC',
    best_selling: 'p.best_seller DESC, p.created_at DESC'
  };
  const orderBy = sortMap[sort] || sortMap.newest;

  params.push(limit);
  const limitParam = i++;
  params.push(offset);
  const offsetParam = i++;

  const result = await query(
    `SELECT p.*, ${PRODUCT_IMAGES_SUBQUERY}, c.name_en AS category_name_en, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereClause}`,
    params.slice(0, params.length - 2)
  );

  return { items: result.rows, total: countResult.rows[0].total };
}

async function create(data) {
  const stockStatus = computeStockStatus(data.stock, data.lowStockThreshold);

  const result = await query(
    `INSERT INTO products (
       sku, name_en, name_ne, slug, description_en, description_ne, category_id, subcategory, brand, gender,
       frame_type, frame_material, frame_shape, color, size, lens_type, features_en, features_ne,
       price, compare_at_price, discount_percent, stock, low_stock_threshold, stock_status,
       prescription_supported, lens_index, uv_protection, blue_cut, anti_reflective, photochromic,
       polarized, progressive, water_repellent, scratch_resistant, featured, best_seller, new_arrival, active
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
     ) RETURNING *`,
    [
      data.sku, data.nameEn, data.nameNe || null, data.slug, data.descriptionEn || null, data.descriptionNe || null,
      data.categoryId || null, data.subcategory || null, data.brand || null, data.gender || null,
      data.frameType || null, data.frameMaterial || null, data.frameShape || null, data.color || null, data.size || null, data.lensType || null,
      data.featuresEn || [], data.featuresNe || [],
      data.price, data.compareAtPrice || null, data.discountPercent || 0, data.stock || 0, data.lowStockThreshold || 3, stockStatus,
      Boolean(data.prescriptionSupported), data.lensIndex || null, Boolean(data.uvProtection), Boolean(data.blueCut),
      Boolean(data.antiReflective), Boolean(data.photochromic), Boolean(data.polarized), Boolean(data.progressive),
      Boolean(data.waterRepellent), Boolean(data.scratchResistant),
      Boolean(data.featured), Boolean(data.bestSeller), Boolean(data.newArrival), data.active !== false
    ]
  );

  return result.rows[0];
}

/**
 * Partial update — only columns present in `fields` are touched.
 * Callers (controllers) build `fields` from validated request bodies.
 */
async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE products SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM products WHERE id = $1', [id]);
}

async function setActive(id, active) {
  const result = await query('UPDATE products SET active = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, active]);
  return result.rows[0] || null;
}

function computeStockStatus(stock, lowStockThreshold = 3) {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Adjusts stock atomically and writes an inventory_logs row in the
 * same transaction — used by both admin manual adjustments and order
 * placement/cancellation (see services/orderService.js).
 */
async function adjustStock(productId, delta, { adminId = null, changeType = 'manual_adjust', note = null } = {}) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const productResult = await client.query('SELECT stock, low_stock_threshold FROM products WHERE id = $1 FOR UPDATE', [productId]);
    const product = productResult.rows[0];

    if (!product) {
      throw new Error('Product not found.');
    }

    const newStock = product.stock + delta;
    if (newStock < 0) {
      throw new Error('Insufficient stock for this operation.');
    }

    const newStatus = computeStockStatus(newStock, product.low_stock_threshold);

    await client.query(
      'UPDATE products SET stock = $2, stock_status = $3, updated_at = now() WHERE id = $1',
      [productId, newStock, newStatus]
    );

    await client.query(
      `INSERT INTO inventory_logs (product_id, admin_id, change_type, quantity_delta, stock_after, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, adminId, changeType, delta, newStock, note]
    );

    await client.query('COMMIT');
    return { stock: newStock, stockStatus: newStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listLowStock(limit = 20) {
  const result = await query(
    `SELECT id, sku, name_en, stock, low_stock_threshold FROM products
     WHERE active = true AND stock_status IN ('low_stock', 'out_of_stock')
     ORDER BY stock ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function addImage(productId, { url, storageKey = null, isPrimary = false, sortOrder = 0 }) {
  if (isPrimary) {
    await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
  }
  const result = await query(
    `INSERT INTO product_images (product_id, url, storage_key, is_primary, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [productId, url, storageKey, isPrimary, sortOrder]
  );
  return result.rows[0];
}

async function removeImage(imageId) {
  await query('DELETE FROM product_images WHERE id = $1', [imageId]);
}

async function setPrimaryImage(productId, imageId) {
  await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
  await query('UPDATE product_images SET is_primary = true WHERE id = $1 AND product_id = $2', [imageId, productId]);
}

module.exports = {
  findById,
  findBySlug,
  findBySku,
  search,
  create,
  update,
  remove,
  setActive,
  computeStockStatus,
  adjustStock,
  listLowStock,
  addImage,
  removeImage,
  setPrimaryImage
};
