/**
 * config/env.js
 *
 * Single source of truth for environment variables. Loads dotenv once,
 * validates that required secrets exist, and exports a typed-ish config
 * object so the rest of the app never touches `process.env` directly.
 */

require('dotenv').config();

function required(name, { allowEmptyInDev = false } = {}) {
  const value = process.env[name];

  if (!value) {
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev && allowEmptyInDev) {
      console.warn(`⚠️  Missing env var ${name} (allowed in development, required in production).`);
      return '';
    }

    console.error(`\n❌ Missing required environment variable: ${name}`);
    console.error('   Check .env against .env.example.\n');
    process.exit(1);
  }

  return value;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const config = {
  nodeEnv: NODE_ENV,
  isProduction: IS_PRODUCTION,
  port: parseInt(process.env.PORT, 10) || 5000,
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',

  database: {
    url: required('DATABASE_URL', { allowEmptyInDev: true }),
    ssl: process.env.DATABASE_SSL === 'true'
  },

  auth: {
    jwtSecret: required('JWT_SECRET', { allowEmptyInDev: true }),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieSecure: process.env.COOKIE_SECURE !== 'false'
  },

  ai: {
    geminiApiKey: required('GEMINI_API_KEY', { allowEmptyInDev: true }),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || '',
    apiKey: process.env.STORAGE_API_KEY || '',
    secret: process.env.STORAGE_SECRET || '',
    bucket: process.env.STORAGE_BUCKET || '',
    region: process.env.STORAGE_REGION || ''
  },

  whatsapp: {
    businessToken: process.env.WHATSAPP_BUSINESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || ''
  },

  adminSeed: {
    allowed: process.env.ALLOW_ADMIN_SEED === 'true',
    admins: [
      {
        name: process.env.ADMIN_1_NAME || 'Dipesh Kharel',
        role: 'SUPER_ADMIN',
        email: process.env.ADMIN_1_EMAIL || '',
        password: process.env.ADMIN_1_PASSWORD || ''
      },
      {
        name: process.env.ADMIN_2_NAME || 'Durga Kharel',
        role: 'ADMIN',
        email: process.env.ADMIN_2_EMAIL || '',
        password: process.env.ADMIN_2_PASSWORD || ''
      },
      {
        name: process.env.ADMIN_3_NAME || 'Devi Prasad Kharel',
        role: 'ADMIN',
        email: process.env.ADMIN_3_EMAIL || '',
        password: process.env.ADMIN_3_PASSWORD || ''
      }
    ]
  }
};

// In production, refuse to boot with weak/missing secrets.
if (IS_PRODUCTION) {
  if (!config.database.url) required('DATABASE_URL');
  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
    console.error('\n❌ JWT_SECRET must be set and at least 32 characters in production.\n');
    process.exit(1);
  }
  if (!config.ai.geminiApiKey) required('GEMINI_API_KEY');
}

module.exports = config;
