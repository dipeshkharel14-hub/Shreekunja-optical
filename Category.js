/**
 * models/Category.js
 */

const { query } = require('../config/database');

async function listAll({ activeOnly = true } = {}) {
  const result = await query(
    `SELECT * FROM categories ${activeOnly ? 'WHERE active = true' : ''} ORDER BY sort_order ASC, name_en ASC`
  );
  return result.rows;
}

async function findBySlug(slug) {
  const result = await query('SELECT * FROM categories WHERE slug = $1', [slug]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create({ nameEn, nameNe, slug, descriptionEn, descriptionNe, imageUrl, sortOrder = 0 }) {
  const result = await query(
    `INSERT INTO categories (name_en, name_ne, slug, description_en, description_ne, image_url, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nameEn, nameNe || null, slug, descriptionEn || null, descriptionNe || null, imageUrl || null, sortOrder]
  );
  return result.rows[0];
}

async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE categories SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM categories WHERE id = $1', [id]);
}

module.exports = { listAll, findBySlug, findById, create, update, remove };
