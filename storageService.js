/**
 * services/storageService.js
 *
 * Pluggable object-storage interface (spec section 37: images must go
 * to real cloud/object storage, never base64-in-database, and storage
 * credentials must never reach the browser).
 *
 * This is intentionally an interface stub for phase 1 — the actual
 * provider SDK call (S3 / Cloudinary / Supabase Storage / etc.) gets
 * filled in during the image-upload phase, once STORAGE_PROVIDER is
 * chosen. Keeping the interface fixed now means routes/controllers/
 * models built in later phases (product images, blog covers,
 * prescription uploads) can be written against this contract today.
 *
 * Contract:
 *   uploadFile({ buffer, filename, mimeType, folder }) => Promise<{ url, storageKey }>
 *   deleteFile(storageKey) => Promise<void>
 */

const config = require('../config/env');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

function validateFile({ mimeType, size }) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Allowed: JPG, PNG, WEBP.`);
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }
}

// eslint-disable-next-line no-unused-vars
async function uploadFile({ buffer, filename, mimeType, folder = 'uploads' }) {
  if (!config.storage.provider) {
    throw new Error(
      'STORAGE_PROVIDER is not configured. Set STORAGE_PROVIDER/STORAGE_API_KEY/STORAGE_SECRET/STORAGE_BUCKET in .env before uploading images.'
    );
  }

  // TODO (image-upload phase): dispatch on config.storage.provider to the
  // real SDK (e.g. @aws-sdk/client-s3 for 's3', cloudinary for
  // 'cloudinary'). Never construct a public URL by hand from
  // user-supplied `filename` — always use the storage SDK's returned key.
  throw new Error('storageService.uploadFile is not yet implemented for this provider.');
}

// eslint-disable-next-line no-unused-vars
async function deleteFile(storageKey) {
  if (!config.storage.provider) {
    throw new Error('STORAGE_PROVIDER is not configured.');
  }

  // TODO (image-upload phase): dispatch on config.storage.provider.
  throw new Error('storageService.deleteFile is not yet implemented for this provider.');
}

module.exports = { uploadFile, deleteFile, validateFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
