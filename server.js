/**
 * server.js
 *
 * Shreekunja Optical 2.0 — Express entry point.
 *
 * This replaces the original single-file Gemini-proxy server.js.
 * Everything that used to live inline here (Gemini setup, DKAI_KB
 * loading, the /api/chat route) has moved into services/aiService.js
 * and controllers/aiController.js — this file's only job now is
 * wiring: middleware, routes, startup, shutdown.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./env'); // ✅ FIXED: Import from env.js, not ./config
const { healthCheck } = require('./database');
const logger = require('./logger');
const { apiLimiter } = require('./rateLimit');
const { notFoundHandler, errorHandler } = require('./errorHandler');

const authRoutes = require('./auth');
const meRoutes = require('./me');
const productRoutes = require('./products');
const categoryRoutes = require('./categories');
const orderRoutes = require('./orders');
const customerRoutes = require('./customers');
const blogRoutes = require('./ai'); // Assuming blog routes exist
const serviceRoutes = require('./services');
const adminRoutes = require('./adminAuth'); // Fixed route name
const aiRoutes = require('./ai');
const settingRoutes = require('./settings');
const uploadRoutes = require('./upload');

const app = express();

// Trust exactly one hop (Render/most PaaS put the app behind a single
// reverse proxy). `true` would trust the entire X-Forwarded-For chain,
// which lets a client spoof their IP and bypass IP-based rate limiting —
// express-rate-limit itself refuses to start with `true` for this reason.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------

app.use(helmet());

app.use(
  cors({
    origin: config.allowedOrigin === '*' ? true : config.allowedOrigin,
    credentials: true // required for the HTTP-only session cookie
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(cookieParser());
app.use(apiLimiter);

// ---------------------------------------------------------------
// Health & debug (spec section 46 — never expose secrets here)
// ---------------------------------------------------------------

app.get('/health', (req, res) => res.send('Shreekunja Optical backend is running.'));

app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await healthCheck();
    res.json({ 
      ok: dbOk, 
      database: dbOk ? 'connected' : 'unreachable', 
      model: config.ai.geminiModel,
      environment: config.nodeEnv
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ ok: false, database: 'error', message: error.message });
  }
});

// ---------------------------------------------------------------
// API routes
// ---------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/blog', blogRoutes);
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

const server = app.listen(config.port, () => {
  logger.info(`✅ Shreekunja Optical backend running on port ${config.port} (${config.nodeEnv})`);
  logger.info(`   Health check:  /api/health`);
  logger.info(`   Shreekunja AI: /api/ai/chat`);
});

function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully.`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  // Force-exit if something hangs (e.g. a stuck DB connection).
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ✅ ADDED: Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ✅ ADDED: Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
