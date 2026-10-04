/**
 * server.js
 *
 * Shreekunja Optical 2.0 — Express entry point (Render-ready).
 *
 * Responsibilities: wiring only — middleware, routes, startup, shutdown.
 * Business logic lives in services/ and controllers/.
 *
 * Deploy notes (Render):
 *   Build command:        npm install
 *   Start command:        node server.js
 *   Health Check Path:    /health
 *   Required env vars:    DATABASE_URL, GEMINI_API_KEY, JWT/SESSION secrets,
 *                         ALLOWED_ORIGIN (comma-separated), NODE_ENV=production
 *   PORT is injected by Render — never hardcode it.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// ---------------------------------------------------------------
// Safe module loader
// ---------------------------------------------------------------
// Works whether your files sit next to server.js or inside
// routes/, middleware/, config/, controllers/, services/.
// On Render (Linux) file names are CASE-SENSITIVE, so when a module
// can't be found, the error lists every path that was tried — you
// can see at a glance if it is a "rateLimit" vs "ratelimit" issue.
// A module that exists but has a bug (or a missing npm package) is
// NOT swallowed: its real error is rethrown.

const SEARCH_DIRS = ['', 'routes', 'middleware', 'config', 'controllers', 'services', 'utils', 'db'];

function load(names, { optional = false } = {}) {
  const list = Array.isArray(names) ? names : [names];
  const tried = [];

  for (const name of list) {
    for (const dir of SEARCH_DIRS) {
      const full = path.join(__dirname, dir, name);
      tried.push(full);
      let resolved;
      try {
        resolved = require.resolve(full);
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
        continue; // file simply isn't there — try next candidate
      }
      return require(resolved); // exists: let real errors surface
    }
  }

  if (optional) return null;
  throw new Error(
    `Cannot find module "${list.join('" / "')}". Looked in:\n  - ${tried.join('\n  - ')}\n` +
      'Check the file name AND its letter-case (Linux/Render is case-sensitive).'
  );
}

// ---------------------------------------------------------------
// Core modules
// ---------------------------------------------------------------

const config = load('env');
const db = load('database');
const logger = load('logger');
const { apiLimiter } = load(['rateLimit', 'rateLimiter']);
const { notFoundHandler, errorHandler } = load('errorHandler');

// Routers
const authRoutes = load('auth');
const meRoutes = load('me');
const productRoutes = load('products');
const categoryRoutes = load('categories');
const orderRoutes = load('orders');
const customerRoutes = load('customers');
const serviceRoutes = load('services');
const adminRoutes = load(['adminAuth', 'admin']);
const aiRoutes = load('ai');
const settingRoutes = load('settings');
const uploadRoutes = load('upload');
const blogRoutes = load('blog', { optional: true }); // skipped if you have no blog router yet

const healthCheck = db.healthCheck;

// ---------------------------------------------------------------
// App
// ---------------------------------------------------------------

const app = express();

// Exactly one proxy hop (Render). `true` would trust the whole
// X-Forwarded-For chain and let clients spoof IPs past the rate limiter.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------
// Health — registered BEFORE helmet/cors/rate-limiter so Render's
// frequent probes are never throttled or blocked.
// ---------------------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).send('Shreekunja Optical backend is running.');
});

app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await healthCheck();
    res.status(dbOk ? 200 : 503).json({
      ok: Boolean(dbOk),
      database: dbOk ? 'connected' : 'unreachable',
      model: config.ai && config.ai.geminiModel,
      environment: config.nodeEnv
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ ok: false, database: 'error', message: error.message });
  }
});

// ---------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------

app.use(helmet());

// ALLOWED_ORIGIN may be "*", a single origin, or a comma-separated list
// (e.g. "https://shreekunja.com,https://www.shreekunja.com").
function resolveCorsOrigin(value) {
  if (!value || value === '*') return true;
  const list = Array.isArray(value)
    ? value
    : String(value).split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

app.use(
  cors({
    origin: resolveCorsOrigin(config.allowedOrigin),
    credentials: true // required for the HTTP-only session cookie
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter); // only API traffic is rate-limited

// ---------------------------------------------------------------
// API routes
// ---------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
if (blogRoutes) {
  app.use('/api/blog', blogRoutes);
} else {
  logger.warn('No blog router found — /api/blog is disabled.');
}
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/uploads', uploadRoutes);

// ---------------------------------------------------------------
// Errors
// ---------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------
// Startup
// ---------------------------------------------------------------

// Render injects PORT; bind to 0.0.0.0 so the platform can reach us.
const PORT = Number(process.env.PORT) || Number(config.port) || 3000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`✅ Shreekunja Optical backend running on ${HOST}:${PORT} (${config.nodeEnv})`);
  logger.info('   Health check:  /health  (DB: /api/health)');
  logger.info('   Shreekunja AI: /api/ai/chat');

  // Non-fatal DB check: log the problem clearly, but keep the port open
  // so the deploy doesn't fail and /api/health can report the state.
  Promise.resolve()
    .then(() => healthCheck())
    .then((ok) => {
      if (ok) logger.info('   Database:      connected');
      else logger.error('   Database:      UNREACHABLE — check DATABASE_URL / SSL settings');
    })
    .catch((err) => logger.error('   Database check failed:', err));
});

// Keep-alive must exceed Render's proxy idle timeout, otherwise
// long NDJSON streams (Shreekunja AI) can be cut with 502s.
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000;

server.on('error', (err) => {
  logger.error(`Server failed to start on port ${PORT}:`, err);
  process.exit(1);
});

// ---------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully.`);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      // Close the DB pool if database.js exports a way to do it.
      if (db.pool && typeof db.pool.end === 'function') await db.pool.end();
      else if (typeof db.close === 'function') await db.close();
    } catch (err) {
      logger.error('Error closing database pool:', err);
    }
    process.exit(0);
  });

  // Force-exit if something hangs (e.g. a stuck DB connection or open stream).
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A stray rejected promise (failed DB call, Gemini timeout) should be
// logged, not take the whole server down and cause a Render crash loop.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// A truly uncaught exception leaves the process in an unknown state:
// log it and exit so Render restarts a clean instance.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
