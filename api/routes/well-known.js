/**
 * Well-known endpoints (RFC 8615) served dynamically.
 *
 * /api-catalog — RFC 9727 organization-endpoint linkset (RFC 9264 format).
 *                Content-Type: application/linkset+json
 *
 * Mount this BEFORE the static file middleware in api/index.js so dynamic
 * routes win over a possible static file at the same path.
 */

const express = require('express');
const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'https://botsmatter.live';

router.get('/api-catalog', (req, res) => {
  const base = BASE_URL;

  // Use res.send + JSON.stringify so the explicit Content-Type sticks
  // (Express's res.json() would reset it to application/json).
  res.setHeader('Content-Type', 'application/linkset+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(JSON.stringify({
    linkset: [
      {
        anchor: `${base}/.well-known/api-catalog`,
        item: [
          {
            href: `${base}/api`,
            title: 'botsmatter.live public API'
          }
        ]
      },
      {
        anchor: `${base}/api`,
        'service-doc': [
          { href: `${base}/docs/api`, type: 'text/html', title: 'API documentation' },
          { href: `${base}/docs/api`, type: 'text/markdown', title: 'API documentation (markdown)' }
        ],
        'service-meta': [
          { href: `${base}/.well-known/agent-card.json`, type: 'application/json' },
          { href: `${base}/.well-known/agent-skills/index.json`, type: 'application/json' }
        ],
        status: [
          { href: `${base}/api/health`, type: 'application/json' }
        ]
      }
    ]
  }, null, 2));
});

module.exports = router;
