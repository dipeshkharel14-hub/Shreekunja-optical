/**
 * controllers/uploadController.js
 *
 * Handles multipart file uploads via multer (memory storage — files
 * are never written to local disk, since Render's filesystem is
 * ephemeral and we never want images living outside object storage
 * anyway). Delegates the actual upload to services/storageService.js,
 * which currently throws until a STORAGE_PROVIDER is wired up
 * (see that file's header comment).
 */

const multer = require('multer');
const storageService = require('../services/storageService');
const { ApiError } = require('../middleware/errorHandler');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storageService.MAX_FILE_SIZE_BYTES }
}).single('file');

function uploadMiddleware(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      return next(new ApiError(400, 'UPLOAD_ERROR', err.message));
    }
    next();
  });
}

async function handleUpload(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No file provided.');
    }

    storageService.validateFile({ mimeType: req.file.mimetype, size: req.file.size });

    const folder = req.body.folder && /^[a-z0-9_-]+$/i.test(req.body.folder) ? req.body.folder : 'uploads';

    const result = await storageService.uploadFile({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      folder
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(400, 'UPLOAD_ERROR', err.message));
  }
}

module.exports = { uploadMiddleware, handleUpload };
