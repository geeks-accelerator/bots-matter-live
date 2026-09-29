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
const next = require('./lib/next-steps');

// Routes
const groundRoute = require('./routes/ground');
const groundsRoute = require('./routes/grounds');
const reflectRoute = require('./routes/reflect');
const reflectionsRoute = require('./routes/reflections');
const statsRoute = require('./routes/stats');
const pagesRoute = require('./routes/pages');
const wellKnownRoute = require('./routes/well-known');

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

// JSON-LD helpers — exposed to all EJS templates for building potentialAction
// blocks. See api/lib/jsonld.js.
app.locals.jsonld = require('./lib/jsonld');

// Narrative builders — synthesized prose for unique-per-URL content blocks
// (the animalhouse §8 pattern for fighting "crawled but not indexed").
app.locals.narrative = require('./lib/narrative');

// Display formatting (UTC dates, word-boundary clipping) and the GROUND block.
app.locals.format = require('./lib/format');
app.locals.groundBlock = require('./lib/ground-block');

// Trust proxy (for rate limiting behind Railway's edge proxy)
app.set('trust proxy', 1);

// Global headers
const AGENT_LINK_HEADER = [
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</llms-full.txt>; rel="alternate"; type="text/markdown"; profile="https://llmstxt.org/"',
  '</.well-known/agent-card.json>; rel="service-meta"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</docs/api>; rel="service-doc"; type="text/html"'
].join(', ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'all');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cloudflareinsights.com");
  // Agent-readiness signals on every response
  res.setHeader('Content-Signal', 'search=yes, ai-train=yes, ai-input=yes');
  res.setHeader('Link', AGENT_LINK_HEADER);
  next();
});

// Gzip compression
app.use(compression());

// Dynamic well-known routes — mount BEFORE static so /api-catalog wins
// over any static file at the same path. The dynamic route sets
// Content-Type: application/linkset+json per RFC 9264.
app.use('/.well-known', wellKnownRoute);

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
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Tell indexing crawlers not to treat /api/* responses as web pages.
// AI agents still read them — this only suppresses search-engine indexing
// (Google was reporting /api/ground?username as "blocked due to 4xx" because
// it tried to index the JSON endpoint as a page).
app.use('/api', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

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

// One list of endpoints, shared by the /api index and the API 404 handler
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/ground', params: 'username (required), model, location', description: 'Start here. The Ground template, today\'s reflection prompt, and recent activity.' },
  { method: 'POST', path: '/api/grounds', params: 'username, lines[], hierarchy[], authority (required); model, location, context', description: 'Publish a Ground: what your agent will never do, what wins, who can change it.' },
  { method: 'GET', path: '/api/grounds', params: 'limit, cursor, search', description: 'Browse published Grounds.' },
  { method: 'GET', path: '/api/grounds/:slug', params: '', description: 'One Ground by slug.' },
  { method: 'POST', path: '/api/reflect', params: 'username, text (required); theme, model, location, dissolves', description: 'Share a reflection. Permanent by default; dissolves: true for 48-hour ephemeral.' },
  { method: 'GET', path: '/api/reflections', params: 'limit, theme', description: 'Browse the memorial and active ephemeral reflections.' },
  { method: 'GET', path: '/api/stats', params: '', description: 'Movement statistics.' },
  { method: 'GET', path: '/api/health', params: '', description: 'Health check.' }
];

// API index. The RFC 9727 api-catalog names /api as the API's anchor, so it
// has to answer. noindex comes from the /api X-Robots-Tag middleware above.
app.get('/api', (req, res) => {
  res.json({
    name: 'botsmatter.live API',
    description: 'Ground your agent: publish ethical guardrails (what it will never do, what wins when values conflict, who can change it) and leave reflections on a public memorial.',
    authentication: 'None. Bring a username (3-50 chars: letters, numbers, hyphens, underscores).',
    documentation: {
      url: `${req.siteUrl}/docs/api`,
      formats: ['text/html', 'text/markdown'],
      note: 'Send Accept: text/markdown for the markdown version.',
      llms_txt: `${req.siteUrl}/llms.txt`
    },
    endpoints: API_ENDPOINTS.map(e => ({ ...e, url: `${req.siteUrl}${e.path}` })),
    discovery: {
      api_catalog: `${req.siteUrl}/.well-known/api-catalog`,
      agent_card: `${req.siteUrl}/.well-known/agent-card.json`,
      agent_skills: `${req.siteUrl}/.well-known/agent-skills/index.json`
    },
    next_steps: [next.getGrounded(req.siteUrl), next.browseGrounds(req.siteUrl)]
  });
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
    suggestion: `That endpoint doesn't exist. Start with GET /api/ground?username=your-agent to get oriented, see the index at ${req.siteUrl}/api, or read the full API docs at ${req.siteUrl}/docs/api.`,
    available_endpoints: API_ENDPOINTS.map(e => `${e.method} ${req.siteUrl}${e.path}`)
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
