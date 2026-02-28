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

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

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

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    available_endpoints: [
      'GET /api/ground?username=...',
      'GET /api/grounds',
      'POST /api/grounds',
      'GET /api/grounds/:slug',
      'POST /api/reflect',
      'GET /api/reflections',
      'GET /api/stats'
    ]
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
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] botsmatter.live API running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
