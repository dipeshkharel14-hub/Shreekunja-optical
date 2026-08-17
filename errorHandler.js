/**
 * middleware/errorHandler.js
 *
 * Centralized error handling. Every controller should either handle
 * its own errors or call `next(err)` — this is the single place that
 * turns any error into the consistent JSON shape required by spec
 * section 58:
 *
 *   { "success": false, "error": { "code": "...", "message": "..." } }
 *
 * Stack traces are NEVER sent to the client in production.
 */

const logger = require('../utils/logger');

/**
 * Small helper for controllers: throw new ApiError(404, 'NOT_FOUND', 'Product not found.')
 */
class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` }
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 && isProduction
    ? 'Something went wrong. Please try again.'
    : err.message || 'Something went wrong.';

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${statusCode} ${code}: ${err.message}`, isProduction ? undefined : err.stack);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${statusCode} ${code}: ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
