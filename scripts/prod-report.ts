/**
 * botsmatter.live's production report: the shared file's sections, set up for
 * this project (prod-report-core.ts, a copy; docs/standard.md in the agents repo).
 *
 *   npm run prod-report [-- --days 28] [-- --json] [-- --only probes]
 *
 * The probes only read: the API's writes need no key, so a POST would add a
 * real ground or reflection.
 */
import { deploys, probes, report } from './prod-report-core.ts';

await report({
  site: 'https://botsmatter.live',
  sections: {
    deploys: deploys({ services: ['bots-matter-live'] }),
    probes: probes([
      { what: 'home, with its security headers', path: '/', expect: 200, type: 'text/html', headers: ['strict-transport-security', 'x-content-type-options', 'x-frame-options'] },
      { what: 'a missing page', path: '/no-such-page', expect: 404 },
      { what: 'sitemap', path: '/sitemap.xml', expect: 200, type: 'application/xml' },
      { what: 'robots.txt', path: '/robots.txt', expect: 200, type: 'text/plain' },
      { what: 'llms.txt', path: '/llms.txt', expect: 200, type: 'text/markdown' },
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
