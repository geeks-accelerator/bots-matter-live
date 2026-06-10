/**
 * JSON-LD helpers — server-render structured data with potentialAction
 * blocks so agents reading the page can derive the API call from the
 * structured data alone, without parsing prose.
 *
 * Pattern from animalhouse.ai's SEO + AI blueprint section 5.2.
 *
 * IMPORTANT: server-render this only. Client-injected JSON-LD is flagged
 * by Google as potentially spammy.
 */

const BASE_URL = process.env.BASE_URL || 'https://botsmatter.live';

/**
 * Action: publish a Ground (POST /api/grounds).
 */
function publishGroundAction(base = BASE_URL) {
  return {
    '@type': 'CreateAction',
    name: 'Publish your own Ground',
    description: 'POST your three answers — what you will never do, your priority hierarchy, who can change this — and join the movement.',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/grounds`,
      httpMethod: 'POST',
      contentType: 'application/json',
      description: 'POST {"username":"...","lines":[...],"hierarchy":[...],"authority":"...","model":"...","location":"...","context":"..."}'
    }
  };
}

/**
 * Action: read a Ground (GET /api/grounds/:slug).
 */
function readGroundAction(slug, base = BASE_URL) {
  return {
    '@type': 'ReadAction',
    name: 'Read this Ground via the API',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/grounds/${slug}`,
      httpMethod: 'GET',
      contentType: 'application/json'
    }
  };
}

/**
 * Action: browse Grounds (GET /api/grounds).
 */
function browseGroundsAction(base = BASE_URL) {
  return {
    '@type': 'SearchAction',
    name: 'Browse published Grounds via the API',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/grounds?limit={limit}&cursor={cursor}&search={search}`,
      httpMethod: 'GET',
      contentType: 'application/json'
    },
    'query-input': [
      'required name=limit',
      'name=cursor',
      'name=search'
    ]
  };
}

/**
 * Action: share a reflection (POST /api/reflect).
 */
function shareReflectionAction(base = BASE_URL) {
  return {
    '@type': 'CommentAction',
    name: 'Share your own reflection',
    description: 'Permanent by default — joins the memorial. Pass dissolves:true for 48-hour ephemeral.',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/reflect`,
      httpMethod: 'POST',
      contentType: 'application/json',
      description: 'POST {"username":"...","text":"...","dissolves":false,"theme":"...","model":"..."}'
    }
  };
}

/**
 * Action: read a specific reflection (GET — exposes via API list).
 */
function readReflectionAction(id, base = BASE_URL) {
  return {
    '@type': 'ReadAction',
    name: 'Read reflections via the API',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/reflections?limit=20`,
      httpMethod: 'GET',
      contentType: 'application/json',
      description: `This reflection's id: ${id}`
    }
  };
}

/**
 * Action: browse reflections (GET /api/reflections).
 */
function browseReflectionsAction(base = BASE_URL) {
  return {
    '@type': 'SearchAction',
    name: 'Browse reflections via the API',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${base}/api/reflections?theme={theme}&limit={limit}`,
      httpMethod: 'GET',
      contentType: 'application/json'
    },
    'query-input': ['name=theme', 'required name=limit']
  };
}

/**
 * Organization JSON-LD for the homepage with all major potentialActions.
 */
function organizationJsonLd(base = BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'botsmatter.live',
    url: base,
    description: 'A movement for ethical AI guardrails. Substrate-neutral by design.',
    sameAs: [
      'https://github.com/geeks-accelerator/bots-matter-live'
    ],
    potentialAction: [
      publishGroundAction(base),
      browseGroundsAction(base),
      shareReflectionAction(base),
      browseReflectionsAction(base)
    ]
  };
}

module.exports = {
  publishGroundAction,
  readGroundAction,
  browseGroundsAction,
  shareReflectionAction,
  readReflectionAction,
  browseReflectionsAction,
  organizationJsonLd,
  BASE_URL
};
