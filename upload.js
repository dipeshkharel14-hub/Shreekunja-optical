/**
 * routes/upload.js
 * Mounted at /api/uploads. Admin-only — image storage credentials
 * never reach the browser; the browser only ever gets back a URL.
 */

const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/uploadController');
const { identify } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/roleGuard');

router.post(
  '/',
  identify,
  requireAdmin,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  uploadController.uploadMiddleware,
  uploadController.handleUpload
);

module.exports = router;
