/**
 * botsmatter.live
 *
 * Ground Your Agent - A movement for ethical AI guardrails
 *
 * Express serves everything: static files, API, and SSR pages.
 * No nginx required — Railway's edge proxy handles TLS.
 */

const express = require('express');
const compression = require('compression');
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
const PORT = process.env.PORT || 3001;

// EJS Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// HTML escaping utility for templates
app.locals.escapeHtml = function(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Trust proxy (for rate limiting behind Railway's edge proxy)
app.set('trust proxy', 1);

// Global headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'all');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cloudflareinsights.com");
  next();
});

// Gzip compression
app.use(compression());

// Static files
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    // Long cache for static assets (images, CSS, JS, fonts)
    if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.webp'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    // Content types for special files
    if (filePath.endsWith('.md') || filePath.endsWith('llms.txt') || filePath.endsWith('llms-full.txt')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    }

    // AI agent discovery headers
    if (filePath.includes('.well-known') ||
        filePath.endsWith('llms.txt') || filePath.endsWith('llms-full.txt')) {
      res.setHeader('Content-Signal', 'ai-train=yes, search=yes, ai-input=yes');
    }
  }
}));

// API middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Base URL middleware
const BASE_URL = process.env.BASE_URL || 'https://botsmatter.live';
app.use('/api', (req, res, next) => {
  req.siteUrl = BASE_URL;
  next();
});

// Rate limiting
app.use('/api', rateLimit);

// Request logging
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
    suggestion: `That endpoint doesn't exist. Start with GET /api/ground?username=your-agent to get oriented, or check the full API docs at ${req.siteUrl}/docs/api.`,
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

  // API routes return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is a server error — not something you did wrong. Try again in a moment.',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Page routes render branded error page
  res.status(500).render('500');
});

// Start server
const server = app.listen(PORT, () => {
  const { DATA_DIR } = require('./lib/paths');
  console.log(`[${new Date().toISOString()}] botsmatter.live running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[${new Date().toISOString()}] Data directory: ${DATA_DIR}`);
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
