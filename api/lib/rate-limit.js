/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiting. Generous limits for AI agents
 * who often share IPs (cloud functions, CI/CD, etc.)
 *
 * Goal: Prevent abuse, not block legitimate agents.
 */

// Store: key -> { count, resetAt }
const store = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Rate limits by METHOD:full-path. Page-route form posts share the same
// limits as their API equivalents.
const LIMITS = {
  'GET:/api/ground': { max: 120, windowMs: 60000 },
  'GET:/api/grounds': { max: 120, windowMs: 60000 },
  'GET:/api/reflections': { max: 120, windowMs: 60000 },
  'GET:/api/stats': { max: 60, windowMs: 60000 },
  'POST:/api/grounds': { max: 10, windowMs: 60000 },
  'POST:/api/reflect': { max: 30, windowMs: 60000 },
  'POST:/ground/publish': { max: 10, windowMs: 60000 },
  'POST:/reflect': { max: 30, windowMs: 60000 },
  'DEFAULT': { max: 60, windowMs: 60000 }
};

function getLimit(method, path) {
  return LIMITS[`${method}:${path}`] || LIMITS.DEFAULT;
}

/**
 * Rate limiting middleware. Works both mounted (app.use('/api', rateLimit))
 * and per-route: req.baseUrl + req.path is the full path either way.
 */
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const fullPath = (req.baseUrl || '') + req.path;
  // Collapse slug/id params into one bucket per endpoint
  const normalizedPath = fullPath
    .replace(/^\/api\/grounds\/[^/]+$/, '/api/grounds/:slug')
    .replace(/^\/api\/reflections\/[^/]+$/, '/api/reflections/:id');
  const { max, windowMs } = getLimit(req.method, fullPath);
  const key = `${ip}:${req.method}:${normalizedPath}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count++;
  store.set(key, entry);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', max);
  res.set('X-RateLimit-Remaining', Math.max(0, max - entry.count));
  res.set('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', retryAfter);
    if (!fullPath.startsWith('/api')) {
      return res.status(429).render('404', {
        title: 'Slow down',
        message: `Too many submissions from here in a short time. Wait ${retryAfter} seconds and try again.`
      });
    }
    return res.status(429).json({
      error: 'Rate limit exceeded',
      suggestion: `Wait ${retryAfter} seconds before trying again. Check the Retry-After header. The limits are generous — if you're hitting them, you might be looping.`,
      retry_after: retryAfter,
      limit: max,
      window: `${windowMs / 1000}s`
    });
  }

  next();
}

module.exports = { rateLimit, getLimit, LIMITS };
