/**
 * routes/blog.js
 * Mounted at /api/blog.
 */

const express = require('express');
const router = express.Router();

const blogController = require('../controllers/blogController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');
const { validateBody } = require('../middleware/validation');

// Public
router.get('/', blogController.listPublished);
router.get('/admin', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), blogController.listForAdmin); // before /:slug
router.get('/:slug', blogController.getBySlug);

// Admin
router.post(
  '/',
  identify,
  requireAdmin,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  validateBody({ titleEn: { type: 'string', required: true } }),
  blogController.create
);
router.patch('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), blogController.update);
router.patch('/:id/publish', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), blogController.setPublished);
router.delete('/:id', identify, requireAdmin, requireRole(['SUPER_ADMIN', 'ADMIN']), blogController.remove);

module.exports = router;
 {
  const result = await query(
    `INSERT INTO blog_posts (
       title_en, title_ne, slug, excerpt_en, excerpt_ne, content_en, content_ne,
       cover_image, category, tags, author, seo_title, seo_description, published, published_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      data.titleEn, data.titleNe || null, data.slug, data.excerptEn || null, data.excerptNe || null,
      data.contentEn || null, data.contentNe || null, data.coverImage || null, data.category || null,
      data.tags || [], data.author || null, data.seoTitle || null, data.seoDescription || null,
      Boolean(data.published), data.published ? new Date() : null
    ]
  );
  return result.rows[0];
}

async function update(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const setClauses = columns.map((col, idx) => `${col} = $${idx + 2}`);
  const values = columns.map((col) => fields[col]);

  const result = await query(
    `UPDATE blog_posts SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0] || null;
}

async function setPublished(id, published) {
  const result = await query(
    `UPDATE blog_posts SET published = $2, published_at = CASE WHEN $2 THEN COALESCE(published_at, now()) ELSE published_at END, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, published]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await query('DELETE FROM blog_posts WHERE id = $1', [id]);
}

module.exports = { listPublished, listAllForAdmin, findBySlug, findById, create, update, setPublished, remove };
