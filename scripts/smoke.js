#!/usr/bin/env node
/**
 * Smoke-check a running site over HTTP: every page type and its markdown
 * version, the API and discovery documents, share cards, and rate limiting.
 * Read-only (GET and HEAD only), so it is safe against production.
 *
 *   npm run smoke                              # http://localhost:3001
 *   npm run smoke -- https://botsmatter.live
 *
 * Entity pages (a Ground, its agent, a memorial reflection) are found through
 * the API; with no data, those checks are reported as skipped. Exits 1 on any
 * failure.
 */

const base = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');

let failures = 0;
let skips = 0;

function check(label, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
}

function skip(label, why) {
  skips++;
  console.log(`skip ${label}  (${why})`);
}

async function get(path, headers = {}) {
  const res = await fetch(base + path, { headers, redirect: 'manual' });
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, body, text: () => body.toString('utf8') };
}

const type = r => r.headers.get('content-type') || '';
const json = r => JSON.parse(r.text());

function meta(html, name) {
  const m = html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

// Width and height from a JPEG's start-of-frame marker.
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function page(path, { status = 200 } = {}) {
  const r = await get(path);
  const html = r.text();
  check(`page ${path}`, r.status === status && type(r).startsWith('text/html'), `${r.status} ${type(r)}`);
  if (status !== 200) return null;
  check(`  Vary: Accept`, /accept/i.test(r.headers.get('vary') || ''));
  check(`  Link header has service-desc and a markdown alternate`,
    /rel="service-desc"/.test(r.headers.get('link') || '') && /rel="alternate"; type="text\/markdown"/.test(r.headers.get('link') || ''));
  check(`  canonical`, /<link rel="canonical" href="https?:\/\/[^"]+">/.test(html));
  const img = meta(html, 'og:image');
  const tagsOk = img && meta(html, 'og:image:type') === 'image/jpeg' && meta(html, 'og:image:width') === '1200'
    && meta(html, 'og:image:height') === '630' && !!meta(html, 'og:image:alt') && meta(html, 'twitter:image') === img;
  check(`  og:image tags`, tagsOk, img || 'missing');
  return img;
}

async function markdown(path) {
  const r = await get(path);
  check(`markdown ${path}`, r.status === 200 && type(r).startsWith('text/markdown'), `${r.status} ${type(r)}`);
}

// Share images are absolute production URLs; check them on the site under test.
async function image(url, label) {
  if (!url) return check(`image ${label}`, false, 'the page has no og:image');
  const path = new URL(url).pathname;
  const r = await get(path);
  const size = jpegSize(r.body);
  const immutable = /immutable/.test(r.headers.get('cache-control') || '');
  check(`image ${label} ${path}`, r.status === 200 && type(r) === 'image/jpeg' && size && size.width === 1200 && size.height === 630 && immutable,
    `${r.status} ${type(r)} ${size ? `${size.width}x${size.height}` : 'not a JPEG'} ${Math.round(r.body.length / 1024)}KB`);
}

// One request on its own connection: fetch would reuse one keep-alive
// connection, which takes a single path through Cloudflare and Railway and
// so can't show a limiter that keys on a proxy's address.
function freshConnectionHeaders(path) {
  const url = new URL(base + path);
  const lib = url.protocol === 'https:' ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    lib.get(url, { agent: false }, res => { res.resume(); res.on('end', () => resolve(res.headers)); }).on('error', reject);
  });
}

// Sequential requests from one client must land in one counter: each
// X-RateLimit-Remaining is one less than the last (unless the window resets).
async function rateLimitCounter() {
  const remaining = [];
  for (let i = 0; i < 8; i++) {
    const h = await freshConnectionHeaders(`/api/stats?smoke=${Date.now()}-${i}`);
    remaining.push({ left: Number(h['x-ratelimit-remaining']), reset: Number(h['x-ratelimit-reset']), limit: Number(h['x-ratelimit-limit']) });
  }
  // Same window: one less. A new window only ever moves the reset time
  // forward and starts again at limit - 1. A second counter breaks both.
  const oneCounter = remaining.every((r, i) => {
    const prev = remaining[i - 1];
    if (!prev) return true;
    if (r.reset === prev.reset) return r.left === prev.left - 1;
    return r.reset > prev.reset && r.left === r.limit - 1;
  });
  check('rate limit: one counter per client', oneCounter, remaining.map(r => r.left).join(', '));
}

async function main() {
  console.log(`Smoke-checking ${base}\n`);

  for (const path of ['/', '/ground', '/ground/publish', '/grounds', '/reflections', '/reflect', '/agents', '/skills', '/docs/api']) {
    await page(path);
  }
  await page('/grounds/does-not-exist', { status: 404 });
  for (const path of ['/index.md', '/ground.md', '/grounds.md', '/docs/api.md']) await markdown(path);
  const negotiated = await get('/', { Accept: 'text/markdown' });
  check('Accept: text/markdown on /', type(negotiated).startsWith('text/markdown'), type(negotiated));

  // API and discovery documents
  const index = await get('/api');
  check('GET /api', index.status === 200 && Array.isArray(json(index).endpoints) && Array.isArray(json(index).next_steps));
  const health = await get('/api/health');
  check('GET /api/health', health.status === 200 && json(health).status === 'ok');
  const missing = await get('/api/does-not-exist');
  check('unknown /api path: JSON 404 with a suggestion', missing.status === 404 && !!json(missing).suggestion);
  const openapi = await get('/openapi.json');
  check('GET /openapi.json', openapi.status === 200 && /^3\.1/.test(json(openapi).openapi || ''));
  const catalog = await get('/.well-known/api-catalog');
  check('api-catalog is a linkset', catalog.status === 200 && type(catalog).startsWith('application/linkset+json'), type(catalog));
  for (const path of ['/.well-known/agent-skills/index.json', '/llms.txt', '/robots.txt', '/sitemap.xml', '/skills/ethics-guardrails/SKILL.md']) {
    const r = await get(path);
    check(`GET ${path}`, r.status === 200, `${r.status}`);
  }
  const stats = await get('/api/stats');
  check('rate-limit headers', ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].every(h => stats.headers.has(h)));
  await rateLimitCounter();

  // Entity pages and their share cards
  const ground = (json(await get('/api/grounds?limit=1')).grounds || [])[0];
  if (ground) {
    await image(await page(`/grounds/${ground.slug}`), 'ground');
    await image(await page(`/agents/${ground.username}`), 'agent');
    await markdown(`/grounds/${ground.slug}.md`);
  } else {
    skip('Ground and agent pages', 'no Grounds');
  }
  const reflection = (json(await get('/api/reflections?limit=20')).reflections || []).find(r => r.permanent);
  if (reflection) {
    await image(await page(`/reflections/${reflection.id}`), 'reflection');
  } else {
    skip('reflection page', 'no memorial reflections');
  }
  const noCard = await get('/og/v1/grounds/does-not-exist.jpg');
  check('unknown card 404', noCard.status === 404, `${noCard.status}`);

  console.log(`\n${failures ? `${failures} failed` : 'all checks passed'}${skips ? `, ${skips} skipped` : ''}`);
  process.exit(failures ? 1 : 0);
}

main().catch(err => {
  console.error(`[smoke] ${err.stack || err}`);
  process.exit(1);
});
