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

const config = require('./config'); // ✅ FIXED: Missing import
const { healthCheck } = require('./database');
const logger = require('./logger');
const { apiLimiter } = require('./rateLimit');
const { notFoundHandler, errorHandler } = require('./errorHandler');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const blogRoutes = require('./routes/blog');
const serviceRoutes = require('./routes/services');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const settingRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');

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
app.use(cookieParser());
app.use(apiLimiter);

// ---------------------------------------------------------------
// Health & debug (spec section 46 — never expose secrets here)
// ---------------------------------------------------------------

app.get('/health', (req, res) => res.send('Shreekunja Optical backend is running.'));

app.get('/api/health', async (req, res) => {
  const dbOk = await healthCheck();
  res.json({ ok: dbOk, database: dbOk ? 'connected' : 'unreachable', model: config.ai.geminiModel });
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
