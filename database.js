/**
 * config/database.js
 *
 * A single shared PostgreSQL connection pool (node-postgres). Every
 * model imports `query`/`getClient` from here instead of creating its
 * own connection. Keeping this in one place makes it possible to swap
 * or reconfigure the pool without touching model code.
 */

const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  // Idle client errors should never crash the process.
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Run a single parameterized query. Always use placeholders ($1, $2, ...)
 * — never string-concatenate user input into SQL.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);

  if (config.nodeEnv !== 'production') {
    const duration = Date.now() - start;
    if (duration > 200) {
      console.warn(`⚠️  Slow query (${duration}ms): ${text.slice(0, 120)}`);
    }
  }

  return result;
}

/**
 * Get a dedicated client for multi-statement transactions.
 * Caller is responsible for BEGIN / COMMIT / ROLLBACK / release().
 *
 * Usage:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     ...
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 */
async function getClient() {
  return pool.connect();
}

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { pool, query, getClient, healthCheck };
