/**
 * utils/logger.js
 *
 * Small structured logger. Not a replacement for a real observability
 * stack — just consistent, timestamped, secret-redacted console output
 * so logs are usable in Render's log viewer.
 */

const SECRET_ENV_KEYS = ['GEMINI_API_KEY', 'JWT_SECRET', 'SESSION_SECRET', 'DATABASE_URL', 'STORAGE_SECRET', 'STORAGE_API_KEY', 'WHATSAPP_BUSINESS_TOKEN'];

function redact(input) {
  let text = typeof input === 'string' ? input : JSON.stringify(input);

  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 6) {
      text = text.split(value).join('[REDACTED]');
    }
  }

  return text;
}

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info(message, meta) {
    console.log(`[${timestamp()}] INFO  ${redact(message)}`, meta ? redact(meta) : '');
  },
  warn(message, meta) {
    console.warn(`[${timestamp()}] WARN  ${redact(message)}`, meta ? redact(meta) : '');
  },
  error(message, meta) {
    console.error(`[${timestamp()}] ERROR ${redact(message)}`, meta ? redact(meta) : '');
  }
};

module.exports = logger;
