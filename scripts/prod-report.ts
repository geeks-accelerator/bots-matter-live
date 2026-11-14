/**
 * botsmatter.live's production report: the shared file's sections, set up for
 * this project (prod-report-core.ts, a copy; docs/standard.md in the agents repo).
 *
 *   npm run prod-report [-- --days 28] [-- --json] [-- --only probes]
 *
 * The probes only read: the API's writes need no key, so a POST would add a
 * real ground or reflection.
 */
import { cloudflare, cloudflareZone, deploys, errors, github, monitor, probes, report, searchBing, searchGoogle } from './prod-report-core.ts';

// The caching standard (docs/standard-caching.md in the agents repo): a failure
// is never kept, and robots.txt, the sitemap and llms.txt live an hour or less.
const NO_STORE = { 'cache-control': 'no-store' };
const AN_HOUR_OR_LESS = { 'cache-control': '(^|[ ,])max-age=([0-9]{1,3}|[0-2][0-9]{3}|3[0-5][0-9]{2}|3600)($|,)' };

await report({
  site: 'https://botsmatter.live',
  sections: {
    deploys: deploys({ services: ['bots-matter-live'] }),
    errors: errors({ services: ['bots-matter-live'] }),
    github: github({ repos: ['geeks-accelerator/bots-matter-live'] }),
    'search.google': searchGoogle(),
    'search.bing': searchBing(),
    cloudflare: cloudflare(),
    'cloudflare.zone': cloudflareZone(),
    monitor: monitor(),
    probes: probes([
      { what: 'home, with its security headers', path: '/', expect: 200, type: 'text/html', headers: ['strict-transport-security', 'x-content-type-options', 'x-frame-options'] },
      { what: 'a page, as a browser asks', path: '/grounds', expect: 200, type: 'text/html', accept: 'text/html' },
      { what: 'a missing page', path: '/no-such-page', expect: 404, accept: 'text/html', match: NO_STORE },
      { what: 'a missing share card', path: '/og/v2/grounds/no-such-ground.jpg', expect: 404, match: NO_STORE },
      { what: 'a missing skill', path: '/skills/no-such-skill/SKILL.md', expect: 404, match: NO_STORE },
      { what: 'a missing well-known file', path: '/.well-known/agent-card.json', expect: 404, match: NO_STORE },
      { what: 'a missing endpoint', path: '/api/no-such-endpoint', expect: 404, match: NO_STORE },
      // Card URLs are versioned by hand (CARD_PATH; old paths 301), so a year is the promise.
      { what: 'a share card', path: '/og/v2/grounds/coralnetwork-2026-11-13.jpg', expect: 200, type: 'image/jpeg', match: { 'cache-control': 'max-age=31536000, immutable' } },
      { what: 'the favicon', path: '/favicon.svg', expect: 200, type: 'image/svg+xml' },
      { what: 'the static share image', path: '/og-image.jpg', expect: 200, type: 'image/jpeg' },
      { what: 'a skill', path: '/skills/ethics-guardrails/SKILL.md', expect: 200, type: 'text/markdown' },
      { what: 'sitemap', path: '/sitemap.xml', expect: 200, type: 'application/xml', match: AN_HOUR_OR_LESS },
      { what: 'robots.txt', path: '/robots.txt', expect: 200, type: 'text/plain', match: AN_HOUR_OR_LESS },
      { what: 'llms.txt', path: '/llms.txt', expect: 200, type: 'text/markdown', match: AN_HOUR_OR_LESS },
      { what: 'OpenAPI', path: '/openapi.json', expect: 200, type: 'application/json' },
      { what: 'API catalog', path: '/.well-known/api-catalog', expect: 200, type: 'application/linkset+json' },
      { what: 'API index', path: '/api', expect: 200, type: 'application/json' },
      { what: 'grounds', path: '/api/grounds', expect: 200, type: 'application/json' },
      { what: 'reflections', path: '/api/reflections', expect: 200, type: 'application/json' },
      { what: 'stats', path: '/api/stats', expect: 200, type: 'application/json' },
      { what: 'health', path: '/api/health', expect: 200, type: 'application/json' },
    ]),
  },
});
