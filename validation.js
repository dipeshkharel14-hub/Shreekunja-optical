/**
 * middleware/validation.js
 *
 * Lightweight, dependency-free request validation. Deliberately not a
 * full schema library (Zod/Joi) yet — this gives controllers a
 * consistent way to declare required fields and basic type/shape
 * checks now; swapping in a schema library later is a drop-in
 * replacement for `validateBody`.
 */

const { ApiError } = require('./errorHandler');

/**
 * validateBody({
 *   name_en: { type: 'string', required: true, maxLength: 200 },
 *   price:   { type: 'number', required: true, min: 0 },
 *   active:  { type: 'boolean' }
 * })
 */
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];
      const present = value !== undefined && value !== null && value !== '';

      if (rules.required && !present) {
        errors.push(`${field} is required.`);
        continue;
      }

      if (!present) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string.`);
      } else if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number.`);
      } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field} must be a boolean.`);
      } else if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array.`);
      }

      if (rules.type === 'string' && typeof value === 'string') {
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters.`);
        }
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters.`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} is not in a valid format.`);
        }
      }

      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}.`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}.`);
        }
      }

      if (rules.oneOf && !rules.oneOf.includes(value)) {
        errors.push(`${field} must be one of: ${rules.oneOf.join(', ')}.`);
      }
    }

    if (errors.length > 0) {
      return next(new ApiError(400, 'VALIDATION_ERROR', errors.join(' ')));
    }

    next();
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEPAL_PHONE_PATTERN = /^(\+?977)?[9][6-9]\d{8}$|^0?1-?\d{6,7}$/;

module.exports = { validateBody, EMAIL_PATTERN, NEPAL_PHONE_PATTERN };
