/**
 * migrations/run.js
 *
 * Minimal, dependency-free migration runner for plain .sql files.
 * Deliberately simple (no ORM) to match the rest of this backend's
 * style — every .sql file in this directory (numbered, e.g.
 * 001_core_auth.sql) is applied once, in filename order, and recorded
 * in a `schema_migrations` table so re-running `npm run migrate` is
 * always safe.
 *
 * Usage:
 *   npm run migrate           -> applies all pending migrations
 *   npm run migrate:status    -> lists applied vs pending
 *
 * There is no automatic "down" migration generation — this project's
 * migrations are additive (CREATE TABLE IF NOT EXISTS). If a real
 * rollback is ever needed, write a corresponding *_down.sql by hand.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const MIGRATIONS_DIR = __dirname;

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // filenames are zero-padded (001_, 002_, ...) so lexical sort == order
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r) => r.filename));
}

async function up() {
  await ensureMigrationsTable();
  const files = listMigrationFiles();
  const applied = await getAppliedMigrations();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅ No pending migrations. Database is up to date.');
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✅ Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed applying ${file}:`, err.message);
      process.exitCode = 1;
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`✅ Applied ${pending.length} migration(s).`);
}

async function status() {
  await ensureMigrationsTable();
  const files = listMigrationFiles();
  const applied = await getAppliedMigrations();

  console.log('\nMigration status:');
  for (const file of files) {
    console.log(`  [${applied.has(file) ? 'x' : ' '}] ${file}`);
  }
  console.log('');
}

async function main() {
  const cmd = process.argv[2] || 'up';

  try {
    if (cmd === 'up') {
      await up();
    } else if (cmd === 'status') {
      await status();
    } else if (cmd === 'down') {
      console.error('⚠️  Automatic "down" migrations are not implemented (see file header comment).');
      process.exitCode = 1;
    } else {
      console.error(`Unknown command: ${cmd}. Use "up" or "status".`);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main();
