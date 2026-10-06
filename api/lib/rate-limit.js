/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiting. Generous limits for AI agents
 * who often share IPs (cloud functions, CI/CD, etc.)
 *
 * Goal: Prevent abuse, not block legitimate agents.
 */

const net = require('net');

// Store: key -> { count, resetAt }
const store = new Map();

// Cleanup old entries every 5 minutes. unref(): the timer alone shouldn't
// keep a process alive (scripts that load the app can exit).
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

// Cloudflare's published ranges (cloudflare.com/ips-v4 and /ips-v6, checked
// 2026-10-05). Traffic reaches Railway through Cloudflare, so req.ip (the
// address Railway's proxy saw) is a Cloudflare egress address, shared by
// many clients and different from request to request. Only then is
// CF-Connecting-IP the real client: Railway's edge also answers our hostname
// directly, and a request that skips Cloudflare could set that header itself.
// An address missing from this list just falls back to per-address keying.
const CLOUDFLARE = new net.BlockList();
for (const cidr of [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32'
]) {
  const [address, prefix] = cidr.split('/');
  CLOUDFLARE.addSubnet(address, Number(prefix), net.isIPv6(address) ? 'ipv6' : 'ipv4');
}

function clientAddress(req) {
  const peer = (req.ip || '').replace(/^::ffff:/, '');
  const family = net.isIP(peer);
  const viaCloudflare = family !== 0 && CLOUDFLARE.check(peer, family === 6 ? 'ipv6' : 'ipv4');
  return (viaCloudflare && req.get('cf-connecting-ip')) || peer || 'unknown';
}

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
  const ip = clientAddress(req);
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

module.exports = { rateLimit };
