/**
 * models/Service.js
 * Optical services (Eye Testing, Frame Fitting, etc.) — spec section 24.
 */

const { query } = require('../config/database');

async function listAll({ activeOnly = true } = {}) {
  const result = await query(
    `SELECT * FROM services ${activeOnly ? 'WHERE active = true' : ''} ORDER BY sort_order ASC`
  );
  return result.rows;
}

async function findById(id) {
  const result = await query('SELECT * FROM services WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create({ nameEn, nameNe, descriptionEn, descriptionNe, icon, sortOrder = 0 }) {
  const result = await query(
    `INSERT INTO services (name_en, name_ne, description_en, description_ne, icon, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [nameEn, nameNe || null, descriptionEn || null, descriptionNe || null, icon || null, sortOrder]
  );
  return result.rows[0];
}

async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE services SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM services WHERE id = $1', [id]);
}

module.exports = { listAll, findById, create, update, remove };
