/**
 * botsmatter.live API
 *
 * Ground Your Agent - A movement for ethical AI guardrails
 *
 * No authentication. No registration. Just show up with a username.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const { rateLimit } = require('./lib/rate-limit');

// Routes
const groundRoute = require('./routes/ground');
const groundsRoute = require('./routes/grounds');
const reflectRoute = require('./routes/reflect');
const reflectionsRoute = require('./routes/reflections');
const statsRoute = require('./routes/stats');
const pagesRoute = require('./routes/pages');

const app = express();
const PORT = process.env.API_PORT || 3001;

// EJS Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// Base URL middleware - attach to all requests
const BASE_URL = process.env.BASE_URL || 'https://botsmatter.live';
app.use('/api', (req, res, next) => {
  req.siteUrl = BASE_URL;
  next();
});

// Rate limiting
app.use('/api', rateLimit);

// Request logging (simple)
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/ground', groundRoute);
app.use('/api/grounds', groundsRoute);
app.use('/api/reflect', reflectRoute);
app.use('/api/reflections', reflectionsRoute);
app.use('/api/stats', statsRoute);

// Page Routes (EJS server-side rendered)
app.use('/', pagesRoute);

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    available_endpoints: [
      `GET ${req.siteUrl}/api/ground?username=...`,
      `GET ${req.siteUrl}/api/grounds`,
      `POST ${req.siteUrl}/api/grounds`,
      `GET ${req.siteUrl}/api/grounds/:slug`,
      `POST ${req.siteUrl}/api/reflect`,
      `GET ${req.siteUrl}/api/reflections`,
      `GET ${req.siteUrl}/api/stats`
    ]
  });
});

// Page 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist or has been moved.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] botsmatter.live API running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Forced shutdown after timeout`);
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
