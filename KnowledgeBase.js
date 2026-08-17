/**
 * models/KnowledgeBase.js
 *
 * Admin-curated Q&A the AI should prioritize over free generation
 * (spec section 32). Full CRUD lands in phase 5 alongside the AI
 * service wiring; this model provides the read path needed once that
 * lands, plus basic admin CRUD now since the schema is already defined.
 */

const { query } = require('../config/database');

async function listAll({ activeOnly = true, category = null } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (activeOnly) conditions.push('active = true');
  if (category) {
    conditions.push(`category = $${i}`);
    params.push(category);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM ai_knowledge ${where} ORDER BY created_at DESC`, params);
  return result.rows;
}

/**
 * Simple keyword-overlap search used as a first pass before falling
 * back to the LLM's free-form response. Full-text/embedding search
 * can replace this later without changing the calling code's shape.
 */
async function search(text, { limit = 5 } = {}) {
  const result = await query(
    `SELECT * FROM ai_knowledge
     WHERE active = true
       AND (question_en ILIKE $1 OR question_ne ILIKE $1 OR $2 && keywords)
     LIMIT $3`,
    [`%${text}%`, text.toLowerCase().split(/\s+/).filter(Boolean), limit]
  );
  return result.rows;
}

async function create(data) {
  const result = await query(
    `INSERT INTO ai_knowledge (question_en, question_ne, answer_en, answer_ne, category, keywords, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.questionEn, data.questionNe || null, data.answerEn, data.answerNe || null, data.category || 'general', data.keywords || [], data.active !== false]
  );
  return result.rows[0];
}

async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return null;

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE ai_knowledge SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM ai_knowledge WHERE id = $1', [id]);
}

module.exports = { listAll, search, create, update, remove };
