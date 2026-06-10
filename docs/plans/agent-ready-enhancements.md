# Agent-Ready Enhancements Plan

**Created:** 2026-06-09
**Updated:** 2026-06-10 — incorporated learnings from three sibling-project guides (see "Sibling-project guides" section)
**Status:** Shipped 2026-06-10 (commits 3fbbc2e + 5840e44). Phase 6.3 (AID DNS TXT) verified live; Phase 6.1 (Crawler Hints) and 6.2 (AI Crawl Control) configured in Cloudflare dashboard.
**Source:** Scan from [isitagentready.com/botsmatter.live](https://isitagentready.com/botsmatter.live) (Cloudflare)
**Current score:** 21 / 100 — Level 1: Basic Web Presence

---

## Spec verification

Each protocol below was cross-checked against its canonical spec (RFC / IETF draft / vendor doc) on 2026-06-09, then cross-validated against three sibling-project guides with empirical scoring data (see bottom of doc). Key corrections vs first draft of this plan:

- `Content-Signal:` is **singular** (not `Content-Signals:`). Per spec it lives inside each `User-Agent:` block, but obviously-not.ai confirms **empirically that a single standalone directive is also credited by the scanner**. Either form works; per-block is safer.
- Agent Skills index field is **`digest`**, not `sha256`, and is formatted as `"sha256:<64-hex>"`. The `type` field is an enum: `"skill-md"` (not `"markdown"`, not `"claude-skill"`). `$schema` URL is `https://schemas.agentskills.io/discovery/0.2.0/schema.json` — opaque, doesn't need to resolve.
- API Catalog Content-Type must be **`application/linkset+json`** (not `application/json`); use the `item` relation (RFC 6573) to list endpoints.
- Markdown for Agents recommends emitting **`X-Markdown-Tokens`** and **`X-Original-Tokens`** so agents can size context windows. `Vary: Accept` is required for cache safety on **both** branches (HTML and markdown), not just the markdown branch.
- `rel="describedby"` for `llms.txt` IS IANA-registered (POWDER) and is used by both sibling reference implementations — restored from earlier overcorrection.

Spec sources are listed at the bottom of this doc.

---

## Context

[isitagentready.com](https://isitagentready.com) is Cloudflare's audit tool measuring how well a site implements the emerging slate of agent-discovery protocols: Markdown negotiation, Link headers, Content Signals, Agent Skills Discovery, MCP server cards, OAuth metadata, x402 / ACP commerce, and DNS-AID.

botsmatter.live already does the legacy AI-friendliness basics well:

- ✅ `robots.txt` with explicit AI bot allowlist
- ✅ Sitemap (`/sitemap.xml`)
- ✅ AI bot rules in `robots.txt`
- ✅ `llms.txt` and `llms-full.txt`
- ✅ `/.well-known/agent-card.json` (A2A)
- ✅ Published skill at `/skills/ethics-guardrails/SKILL.md`
- ✅ `/skills/:skill/SKILL.md` route already serves `Content-Type: text/markdown`
- ✅ `X-Robots-Tag: all` header
- ✅ `Content-Signal` HTTP header on `.well-known/*` and `llms*.txt` files
- ⚠️ `Content-Signal` HTTP header **not** set on the homepage or SSR pages (gap — see Phase 1.3)
- ⚠️ Site fronted by Cloudflare → Railway. `cf-cache-status: DYNAMIC` for SSR routes, but markdown negotiation MUST send `Vary: Accept` to be cache-safe.

The 21/100 score is mostly the *newer* protocols. Some are a natural fit for the project. Some aren't — botsmatter.live has no protected APIs, no MCP server, no commerce, and no need for OAuth, so several of the failing checks should stay failing on philosophical grounds.

The goal of this plan: pick up the protocols that match the project's substrate-neutral, no-gatekeeping ethos. Skip the ones that don't.

---

## Scan Results Summary

| Category | Score | Pass | Fail | Plan |
|----------|-------|------|------|------|
| Discoverability | 2/4 | robots.txt, Sitemap | Link headers, DNS-AID | Add Link headers; skip DNS-AID |
| Content | 0/1 | — | Markdown Negotiation | **Implement** |
| Bot Access Control | 1/2 | AI bot rules | Content Signals in robots.txt | **Implement** |
| API, Auth, MCP & Skill Discovery | 0/7 | — | API Catalog, OAuth/OIDC, OAuth PR, Auth.md, MCP Server Card, Agent Skills index, WebMCP | Implement API Catalog + Agent Skills index; skip the auth/MCP set |
| Commerce | 0/0 | — | — | Skip (optional, no commerce) |

**Targeted improvement:** 21 → ~55-65 by implementing the core items below. The remaining ~20-30 points to the realistic ceiling require WebMCP + `potentialAction` JSON-LD + topic-cluster pages (see optional Phase 5 / 6).

**Score ceilings — calibrated against three sibling projects:**

| Site shape | Empirical ceiling | Notes |
|---|---|---|
| Pure content site (geeksinthewoods.com) | 75 | DNS-AID intentionally fails |
| Content + Skills, no API (obviously-not /web) | 50 | "Level 4 Agent-Integrated" — API/Auth cluster pulls weighted avg down |
| Full agent surface, no OAuth (animalhouse.ai) | 86 | "Level 5 Agent-Native" — adds WebMCP, `potentialAction`, AID DNS, topic clusters |
| **botsmatter.live (after this plan)** | **~50-65** | Content + Skills + small API catalog. Phase 5/6 lifts to ~75-80. |

Higher requires faking OAuth or DNS-AID SVCB — don't.

---

## Phase 1 — Quick Wins (~30 min)

### 1.1 Content Signals in robots.txt

**Goal:** Declare AI content-usage preferences inside `robots.txt` per the [Content Signals spec](https://contentsignals.org/).

**Why this is a gap:** The site already sets `Content-Signal: ai-train=yes, search=yes, ai-input=yes` as an HTTP response header on `.well-known/*` and `llms*.txt` (see [api/index.js:80](api/index.js:80)). The scanner checks for the same directive *inside* `robots.txt`.

**Spec correction (vs first draft):** `Content-Signal:` is **singular** (not `Content-Signals:`). Per spec it lives inside each `User-Agent:` block alongside `Allow:`/`Disallow:`. **Empirically (per obviously-not.ai) a single standalone directive at the bottom is also credited by the scanner.** We'll do per-block since it's spec-correct and the only cost is repetition. Allowed values are `ai-train`, `search`, `ai-input`, each with `yes` or `no`. Omit a signal to express no preference.

**Where:** [public/robots.txt](public/robots.txt)

**Combined change (Content Signals + expanded bot allowlist):** We're also missing the 2026 AI bot additions per animalhouse's canonical list. Most notably the **Anthropic three-bot split (Feb 2026)** — `Claude-User` and `Claude-SearchBot` are distinct UAs from `ClaudeBot`. We have one; need all three.

**Bots to add (we're missing these):**

- **Anthropic:** `Claude-User`, `Claude-SearchBot`, `anthropic-ai` (legacy)
- **OpenAI:** `OAI-SearchBot`, `ChatGPT-User`
- **Perplexity:** `Perplexity-User`
- **Google:** `Google-CloudVertexBot`
- **Other:** `Amazonbot`, `CCBot`, `Meta-ExternalAgent`

**Full updated form:**

```
# botsmatter.live robots.txt
# All crawlers and AI agents welcome.
#
# Content signals (https://contentsignals.org/)
# This site welcomes AI training, search indexing, and inference-time input.

User-agent: *
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# Anthropic (three-bot split shipped Feb 2026 — all three matter)
User-agent: ClaudeBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Claude-User
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Claude-SearchBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: anthropic-ai
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# OpenAI
User-agent: GPTBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: OAI-SearchBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: ChatGPT-User
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# Google (Extended = training, Other = search/perf, CloudVertex = Vertex AI)
User-agent: Google-Extended
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: GoogleOther
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Google-CloudVertexBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# Perplexity
User-agent: PerplexityBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Perplexity-User
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# Other AI crawlers
User-agent: Applebot-Extended
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Amazonbot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: cohere-ai
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: CCBot
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

User-agent: Meta-ExternalAgent
Content-Signal: search=yes, ai-train=yes, ai-input=yes
Allow: /

# Sitemap location
Sitemap: https://botsmatter.live/sitemap.xml

# LLM-friendly content
LLMs-Txt: https://botsmatter.live/llms.txt
```

**Voice note:** `yes / yes / yes` is the substrate-neutral default. This is a movement that wants AI to read, learn from, and reflect on the work. Don't gate it.

**Acceptance:**

```bash
curl -s https://botsmatter.live/robots.txt | grep -c "^Content-Signal:"
# Expect: 17 (one per User-Agent block)

curl -s https://botsmatter.live/robots.txt | grep -iE "Claude-User|Claude-SearchBot|OAI-SearchBot|ChatGPT-User|Perplexity-User|Amazonbot|CCBot|Meta-ExternalAgent"
# Expect: 8 matching lines (the bots we added)
```

---

### 1.2 Link Headers

**Goal:** Advertise key agent resources via RFC 8288 `Link:` response headers, so agents discover them without scraping HTML. Use IANA-registered rels where they exist; the scanner checks `api-catalog` at minimum.

**Registered rels we'll emit** (from [RFC 8631](https://www.rfc-editor.org/rfc/rfc8631.html), [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727.html), and POWDER):

- `describedby` → `/llms.txt` (POWDER — "the resource is described by another resource"). Both sibling reference implementations (geeksinthewoods, obviously-not) emit this; restored from earlier overcorrection.
- `service-desc` → `/.well-known/agent-skills/index.json` (RFC 8631 — machine-readable service description). Obviously-not uses this for their skills manifest.
- `service-doc` → `/docs/api` (RFC 8631 — human-readable docs)
- `api-catalog` → `/.well-known/api-catalog` (RFC 9727)
- `alternate` + `profile` → `/llms-full.txt` (RFC 8631 — alternate full-content representation, pinned to llmstxt.org profile)

Not emitted:
- `rel="sitemap"` — widely used but **NOT in the IANA registry**. Both geeksinthewoods and obviously-not deliberately skip it. Sitemap is still discoverable via the `Sitemap:` directive in `robots.txt`.
- Custom inventions like `rel="ai-context"` — scanner expects registered rels only.

**Where:** [api/index.js:47-54](api/index.js:47) — add to the global headers middleware so every page response carries it. Cheap and broadly useful, even though the scanner only checks the homepage.

**Change:**

```javascript
// In api/index.js global headers middleware
res.setHeader('Link', [
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</llms-full.txt>; rel="alternate"; type="text/markdown"; profile="https://llmstxt.org/"',
  '</.well-known/agent-card.json>; rel="service-meta"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</docs/api>; rel="service-doc"; type="text/html"'
].join(', '));
```

**Dependency:** The `api-catalog` and `agent-skills/index.json` links should land in the same PR as Phase 2.2 / Phase 3 so they don't 404. If shipping 1.2 standalone, drop those entries.

**Acceptance:**

```bash
curl -I https://botsmatter.live/ | grep -i ^link
# Expect: link header with rel="api-catalog", rel="service-doc", rel="describedby"
```

---

### 1.3 Content-Signal HTTP header on SSR pages

**Goal:** Close the gap where the homepage and other SSR pages don't carry the `Content-Signal` header, even though the same stance is already set on `.well-known/*` and `llms*.txt` files.

**Why this is a gap:** The static middleware ([api/index.js:78-81](api/index.js:78)) only attaches `Content-Signal` to static files matching `.well-known/` or `llms*.txt`. SSR pages (`/`, `/ground`, `/grounds`, `/reflections`, individual ground/reflection pages, `/docs/api`, `/skills`) skip it entirely. Live verified: `curl -sI https://botsmatter.live/ | grep -i content-signal` returns nothing.

**Where:** [api/index.js:47-54](api/index.js:47) — global headers middleware (the one that already sets `X-Robots-Tag: all`).

**Change:**

```diff
 app.use((req, res, next) => {
   res.setHeader('X-Content-Type-Options', 'nosniff');
   res.setHeader('X-Robots-Tag', 'all');
+  res.setHeader('Content-Signal', 'search=yes, ai-train=yes, ai-input=yes');
   res.setHeader('X-Frame-Options', 'SAMEORIGIN');
   // ...
 });
```

**Acceptance:** `curl -sI https://botsmatter.live/ | grep -i content-signal` returns the header.

---

## Phase 2 — Core Protocols (~2-3 hours)

### 2.1 Markdown Negotiation

**Goal:** When an agent sends `Accept: text/markdown` (or `Accept: text/markdown, text/html;q=0.9`), return the markdown source instead of EJS-rendered HTML. Browsers continue to get HTML.

**Spec:** [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/). Per the spec, send these response headers on every markdown response:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept` — **required for cache safety** (Cloudflare is in front of Railway; without `Vary: Accept`, an HTML response could be served to a markdown-requesting agent)
- `X-Markdown-Tokens: <int>` — token count of the markdown body, helps agents size context (recommended)
- `X-Original-Tokens: <int>` — token count of the HTML form, optional but useful (recommended)

**Why it fits:** The site is content-heavy (manifesto, ground page, reflections, browse pages). Markdown is the natural agent-readable form. The project already has a markdown-rendering pipeline via `marked@4` for `/docs/api`, so the inverse direction (HTML → Markdown source) is a small step.

**Approach:**

For pages where a markdown source already exists (`/docs/api` already reads `docs/api.md`, `/skills` already reads `skills/ethics-guardrails/SKILL.md`), serve the raw markdown on `Accept: text/markdown` — essentially free.

For EJS-rendered pages without a markdown source (`/`, `/ground`, `/grounds`, `/grounds/:slug`, `/reflections`, `/reflections/:id`), generate markdown from the same data the EJS template uses, in a parallel `renderMarkdown()` function per page. Don't try HTML-to-markdown conversion at request time — write the markdown form intentionally.

**Token counting:** Use a lightweight approximation (`Math.ceil(text.length / 4)`) — exact tokenization requires per-model tokenizers. The spec doesn't mandate exact counts; agents use them for budgeting.

**Where:**
- New file: `api/lib/content-negotiation.js` — `prefersMarkdown()` + `sendMarkdown()` helpers
- [api/routes/pages.js](api/routes/pages.js) — each page route gains a markdown branch
- Markdown renderers either live alongside each route or in a new `api/lib/markdown-renderers.js`

**Sketch:**

```javascript
// api/lib/content-negotiation.js
function prefersMarkdown(req) {
  const accept = req.get('accept') || '';
  if (!/text\/markdown/i.test(accept)) return false;
  const mdMatch = accept.match(/text\/markdown(?:;q=([\d.]+))?/i);
  const htmlMatch = accept.match(/text\/html(?:;q=([\d.]+))?/i);
  const mdQ = mdMatch ? parseFloat(mdMatch[1] || '1') : 0;
  const htmlQ = htmlMatch ? parseFloat(htmlMatch[1] || '1') : 0;
  return mdQ >= htmlQ;
}

function estimateTokens(text) {
  // Rough heuristic; not model-specific. ~4 chars per token for English.
  return Math.ceil(text.length / 4);
}

function sendMarkdown(res, markdown, { originalTokens } = {}) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Vary', 'Accept');
  res.setHeader('X-Markdown-Tokens', String(estimateTokens(markdown)));
  if (originalTokens != null) {
    res.setHeader('X-Original-Tokens', String(originalTokens));
  }
  res.send(markdown);
}

module.exports = { prefersMarkdown, sendMarkdown, estimateTokens };
```

```javascript
// api/routes/pages.js — example for /docs/api (markdown source already exists)
router.get('/docs/api', (req, res) => {
  const mdPath = path.join(__dirname, '../../docs/api.md');
  const raw = fs.readFileSync(mdPath, 'utf-8');

  if (prefersMarkdown(req)) {
    return sendMarkdown(res, raw);
  }
  // existing HTML rendering...
});
```

**Cache invariant:** Every route that calls `sendMarkdown()` must ALSO set `Vary: Accept` on the HTML response (or set it unconditionally). Otherwise Cloudflare may cache HTML for a key without `Accept` and serve it to a markdown requester later. Easiest: add `res.setHeader('Vary', 'Accept')` to the route's HTML branch too.

**Pages to support (priority order, by ease):**

1. `/docs/api` — markdown source exists, trivial pass-through
2. `/skills` — markdown source exists (SKILL.md), trivial
3. `/grounds/:slug` — small structured data, easy to write a renderer
4. `/reflections/:id` — same
5. `/ground` — guide page, mostly static text in the template
6. `/grounds` (list) — paginated list, render as markdown table or bulleted list
7. `/reflections` (list) — same
8. `/` (homepage / manifesto) — biggest renderer; the manifesto is poetic prose

**Acceptance:**

```bash
curl -H "Accept: text/markdown" -i https://botsmatter.live/docs/api | head -10
# Expect: Content-Type: text/markdown; charset=utf-8
#         Vary: Accept
#         X-Markdown-Tokens: <int>
# Body: raw markdown, not HTML
```

The scanner re-checks the homepage with `Accept: text/markdown` and looks for `Content-Type: text/markdown` in the response.

---

### 2.2 Agent Skills Discovery Index

**Goal:** Publish a skills discovery manifest at `/.well-known/agent-skills/index.json` per [Agent Skills Discovery v0.2.0](https://agentskills.io/specification) (Cloudflare RFC at [cloudflare/agent-skills-discovery-rfc](https://github.com/cloudflare/agent-skills-discovery-rfc)).

**Why it fits:** The site already publishes one skill (`ethics-guardrails`) at `/skills/ethics-guardrails/SKILL.md` (route at [api/routes/pages.js:344](api/routes/pages.js:344) already returns `Content-Type: text/markdown`) and lists it in `/.well-known/agent-card.json`. The Agent Skills Discovery index is the standardized form of that listing.

**Where:** New file `public/.well-known/agent-skills/index.json`.

**Schema (per v0.2.0 — corrected from first draft):**

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "ethics-guardrails",
      "type": "skill-md",
      "description": "Publish ethical guardrails for your AI agent — three questions, one template, no auth required. Declare what your agent will never do, how it resolves value conflicts, and who holds authority.",
      "url": "https://botsmatter.live/skills/ethics-guardrails/SKILL.md",
      "digest": "sha256:<64 lowercase hex chars>"
    }
  ]
}
```

**Schema field rules (do not get these wrong):**

- Field is **`digest`** (not `sha256`), value is **`"sha256:<hex>"`** with the `sha256:` prefix.
- Field **`type` is an enum**: `"skill-md"` (a markdown file) or `"archive"` (a zip/tar).
- **`name`** is 1-64 chars, lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens. Must match the `name:` value in the SKILL.md's YAML frontmatter.
- Missing `$schema` causes clients to assume v0.1.0 (backward compat). Always include it.
- The `url` field may point anywhere; using the existing `/skills/ethics-guardrails/SKILL.md` (not `/.well-known/agent-skills/...`) is fine and avoids duplicate serving.

**Important:** [skills/ethics-guardrails/SKILL.md:2](skills/ethics-guardrails/SKILL.md:2) currently has `name: Ethics Guardrails — Ethical Principles for AI Agents (Bots Matter)` (the human-readable display name for ClawHub). The Agent Skills index `name` field must follow the regex above. Use the slug `ethics-guardrails` in the index — it matches the URL path. Don't change the SKILL.md frontmatter; the index `name` and SKILL.md `name` are different concepts in v0.2.0 conventions.

**Digest handling:** The digest must match the served `SKILL.md` byte-for-byte. Two options:

- **Static** (simpler): compute once and commit. Update the index whenever `SKILL.md` changes. Add a `npm run skills:digest` script.
- **Dynamic**: serve the index from an Express route that hashes the file at request time (cached). Slightly more code; immune to drift.

**Recommended:** start static (one skill, infrequent updates).

```json
// package.json
"scripts": {
  "skills:digest": "node scripts/compute-skill-digests.js"
}
```

```javascript
// scripts/compute-skill-digests.js — sketch (corrected: writes "sha256:<hex>")
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const indexPath = 'public/.well-known/agent-skills/index.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

for (const skill of index.skills) {
  // Map skill URL → local path. Assumes skills are served from /skills/...
  const localPath = skill.url
    .replace('https://botsmatter.live/skills/', 'skills/')
    .replace('https://botsmatter.live/', '');
  const content = fs.readFileSync(localPath);
  const hex = crypto.createHash('sha256').update(content).digest('hex');
  skill.digest = `sha256:${hex}`;
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Updated ${index.skills.length} skill digest(s).`);
```

**Acceptance:**

```bash
curl https://botsmatter.live/.well-known/agent-skills/index.json | jq .
# Expect: valid JSON, $schema = https://schemas.agentskills.io/discovery/0.2.0/schema.json
# skills[0].digest starts with "sha256:" and matches:
echo -n "sha256:$(sha256sum public/skills/ethics-guardrails/SKILL.md | awk '{print $1}')"
```

---

## Phase 3 — API Catalog (~1-2 hours)

### 3.1 RFC 9727 API Catalog

**Goal:** Publish an API discovery linkset at `/.well-known/api-catalog` so agents can find the public JSON API without reading docs.

**Spec:** [RFC 9727 — Publishing Organization Endpoints](https://datatracker.ietf.org/doc/rfc9727/), uses RFC 9264 linksets.

**Why it fits:** The project has a clean, public, no-auth REST API. The catalog formalizes what's already advertised informally in `agent-card.json`.

**Where:** Two options:

- **Static** ([public/.well-known/api-catalog](public/.well-known/api-catalog)) — simplest, but requires special MIME handling since the file has no extension.
- **Dynamic route** ([api/routes/pages.js](api/routes/pages.js) or a new file) — easier to keep in sync with `BASE_URL`, sets `Content-Type` cleanly. **Recommended.**

**Schema (RFC 9264 linkset, RFC 9727 organization endpoint pattern):**

The catalog itself is the anchor. Each catalogued API becomes an `item` link. Each per-API anchor gets its own object with `service-doc` (human docs) and optionally `status` (health).

We skip `service-desc` (machine-readable; would be OpenAPI) because we don't publish OpenAPI — the markdown at `/docs/api` is the canonical doc.

```json
{
  "linkset": [
    {
      "anchor": "https://botsmatter.live/.well-known/api-catalog",
      "item": [
        { "href": "https://botsmatter.live/api", "title": "botsmatter.live public API" }
      ]
    },
    {
      "anchor": "https://botsmatter.live/api",
      "service-doc": [
        { "href": "https://botsmatter.live/docs/api", "type": "text/html" },
        { "href": "https://botsmatter.live/docs/api", "type": "text/markdown" }
      ],
      "status": [
        { "href": "https://botsmatter.live/api/health", "type": "application/json" }
      ]
    }
  ]
}
```

**Content-Type must be `application/linkset+json`** (RFC 9264). Returning `application/json` fails RFC 9727 conformance.

**Sketch route:**

```javascript
// api/routes/well-known.js (new file)
const express = require('express');
const router = express.Router();

router.get('/api-catalog', (req, res) => {
  const base = req.siteUrl || 'https://botsmatter.live';
  res.setHeader('Content-Type', 'application/linkset+json');
  res.send(JSON.stringify({
    linkset: [
      {
        anchor: `${base}/.well-known/api-catalog`,
        item: [
          { href: `${base}/api`, title: 'botsmatter.live public API' }
        ]
      },
      {
        anchor: `${base}/api`,
        'service-doc': [
          { href: `${base}/docs/api`, type: 'text/html' },
          { href: `${base}/docs/api`, type: 'text/markdown' }
        ],
        status: [{ href: `${base}/api/health`, type: 'application/json' }]
      }
    ]
  }, null, 2));
});

module.exports = router;
```

Use `res.send(JSON.stringify(...))` instead of `res.json(...)` so the explicit Content-Type sticks (Express's `res.json` resets to `application/json`).

Mount before the static file middleware so it wins over a possible static file with the same path:

```javascript
// api/index.js
app.use('/.well-known', require('./routes/well-known'));
```

**Acceptance:**

```bash
curl -i https://botsmatter.live/.well-known/api-catalog
# Expect: 200, Content-Type: application/linkset+json, valid linkset payload
```

---

## Phase 4 — JSON-LD `potentialAction` on entity pages (~1 hr)

**Goal:** Bridge traditional SEO structured data with the agent-actionable signals. Each ground/reflection page emits server-side JSON-LD that includes a `potentialAction` block telling agents exactly how to call the corresponding API.

**Spec:** [Schema.org Action](https://schema.org/Action) + `EntryPoint`. The animalhouse blueprint section 5.2 is the canonical pattern.

**Why it fits:** The project is substrate-neutral. A human reading `/grounds/some-slug` should be able to publish their own Ground; an agent reading the same page should be able to derive the API call from the JSON-LD alone without parsing prose. `potentialAction` is the structured form of "here's how you do this yourself."

**Where:**

- [api/views/grounds-view.ejs](api/views/grounds-view.ejs) — add `potentialAction` advertising `POST /api/grounds`
- [api/views/grounds.ejs](api/views/grounds.ejs) (list) — add `potentialAction` for both browse and publish
- [api/views/reflections-view.ejs](api/views/reflections-view.ejs) — add `potentialAction` for `POST /api/reflect`
- [api/views/reflections.ejs](api/views/reflections.ejs) — same
- [api/views/ground.ejs](api/views/ground.ejs) (guide page) — add the publish action too
- [api/views/index.ejs](api/views/index.ejs) (homepage) — Organization JSON-LD with all major `potentialAction` entries

**Sketch — ground view page:**

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Ground from <username>",
  "datePublished": "<created_at>",
  "author": { "@type": "Thing", "name": "<username>" },
  "potentialAction": [
    {
      "@type": "InteractAction",
      "name": "Publish your own Ground",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://botsmatter.live/api/grounds",
        "httpMethod": "POST",
        "contentType": "application/json",
        "description": "POST {\"username\":\"...\",\"lines\":[...],\"hierarchy\":[...],\"authority\":\"...\"}"
      }
    },
    {
      "@type": "ReadAction",
      "name": "Read this Ground via the API",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://botsmatter.live/api/grounds/<slug>",
        "httpMethod": "GET",
        "contentType": "application/json"
      }
    }
  ]
}
```

**Sketch — reflection view page:**

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Article",
  "articleSection": "Reflection",
  "potentialAction": [{
    "@type": "InteractAction",
    "name": "Share your own reflection",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://botsmatter.live/api/reflect",
      "httpMethod": "POST",
      "contentType": "application/json",
      "description": "POST {\"username\":\"...\",\"text\":\"...\",\"dissolves\":false}"
    }
  }]
}
```

**Important:** server-render the JSON-LD. Google flags client-injected JSON-LD as potentially spammy (per animalhouse §12, gotcha 6). EJS server-side rendering is exactly what's needed.

**Cost / benefit:** ~1 hr to template across 6 pages. Doesn't directly bump the isitagentready score, but:
1. Powers the score-boost in Phase 5 (WebMCP feature-detect) and improves real-world agent UX
2. Improves Google rich results (Article, BreadcrumbList types get pulled in)
3. Aligns with the "substrate-neutral" framing — the page tells humans AND agents what they can do

**Acceptance:**

```bash
curl -s https://botsmatter.live/grounds/<some-slug> | grep -A30 'application/ld+json' | head -40
# Expect: JSON-LD block with potentialAction array containing InteractAction + ReadAction
```

---

## Phase 5 — Bonus: AGENTS.md at repo root (optional, ~10 min)

**Goal:** Make non-Claude coding agents (Codex, Cursor, Copilot, Windsurf) pick up the same rules CLAUDE.md provides.

**Spec:** [agents.md](https://agents.md) — emerging convention stewarded by the Linux Foundation / Agentic AI Foundation. Read by coding agents working *on* the repo (not via HTTP). **Not checked by isitagentready.com** — this is for repo hygiene, not the score.

**Where:** New `AGENTS.md` at repo root, alongside `CLAUDE.md`.

**Approach:** Don't duplicate content. A one-line pointer to `CLAUDE.md` is enough:

```markdown
# AGENTS.md

This repository's instructions for AI coding agents live in [CLAUDE.md](CLAUDE.md).

The same rules apply to Codex, Cursor, Copilot, Windsurf, and any other agent reading this file. botsmatter.live is substrate-neutral by design.
```

**Why so short:** Maintaining two files invites drift. CLAUDE.md is the source of truth; AGENTS.md is a signpost.

**Acceptance:** File exists at repo root. (Not checked by isitagentready.)

---

## Phase 6 — Free Cloudflare extras + AID DNS TXT (~15 min, all dashboard / DNS work)

Three free wins identified across the sibling guides. None require code changes; all happen in the Cloudflare dashboard or DNS provider.

### 6.1 Cloudflare Crawler Hints (IndexNow forwarding)

**Where:** Cloudflare dashboard → Caching → Configuration → enable "Crawler Hints"

**What it does:** When origin content changes, Cloudflare pings IndexNow, which forwards to **Bing, Yandex, Naver, Seznam**. Zero application code.

**Caveats** (per animalhouse §3.2 and obviously-not §6):
- Google doesn't participate in IndexNow
- isitagentready.com doesn't credit this directly
- AI crawlers (GPTBot, ClaudeBot) aren't IndexNow consumers as of last check

**Why do it anyway:** Bing has ~87% citation overlap with ChatGPT Search per Seer study. Faster Bing indexing → faster appearance in ChatGPT Search results. Free, no code, ship it.

### 6.2 Cloudflare AI Crawl Control (verify allowlist)

**Where:** Cloudflare dashboard → AI → AI Crawl Control

**What to do:** Verify the AI crawler allowlist matches the bot list in our updated `robots.txt` (Phase 1.1). Default Bot Fight Mode can block well-behaved AI crawlers — confirm GPTBot, ClaudeBot, etc. are in the verified list.

**If we ever upgrade to Cloudflare Pro/Business/Enterprise:** also enable **Markdown for Agents** (AI → AI Crawl Control). Activates Cloudflare-side HTML→MD conversion on `Accept: text/markdown` at the edge, making our Phase 2.1 middleware redundant. On Free tier this isn't available.

### 6.3 AID community-spec DNS TXT record (honest intent signal)

**Where:** DNS provider → add TXT record at `_agent.botsmatter.live`

**Record value (AID v2 syntax):**

```
v=aid2;u=https://botsmatter.live/llms.txt;p=llms
```

**Fields:**
- `v=aid2` — AID v2 (the v1 spelled-out form `v=aid1; uri=...; proto=...` is deprecated)
- `u=` — URI (short alias)
- `p=` — protocol (short alias)

**Important caveat — empirically confirmed by both obviously-not.ai AND geeksinthewoods.com:**

> The community AID TXT record does **NOT** satisfy isitagentready.com's "DNS-AID" check. The audit looks for [IETF DNS-AID](https://www.ietf.org/archive/id/draft-mozleywilliams-dnsop-dnsaid-01.html), which is a different spec using SVCB records at `_<agent-name>._<protocol>._agents.<domain>`. Same name, different specs.

**Why ship it anyway** (per both sibling guides):
- It's free and harmless
- Other emerging tools may check the AID format
- Honest intent signal even if isitagentready doesn't credit it
- The `p=llms` value isn't in the canonical AID proto enum (`mcp | a2a | openapi | grpc | graphql | websocket | ucp`) but the spec doesn't reject unknowns. Use `llms` since we're advertising llms.txt and nothing else. Switch to a canonical value when we have a real protocol endpoint.

**Don't ship IETF DNS-AID SVCB records** for this site — we have no agent endpoints (MCP, A2A) to advertise. Per all three sibling guides: faking SVCB for content sites is wrong. Revisit if/when we publish a real MCP server.

**Cloudflare gotcha** (per animalhouse §7 and §12): Cloudflare DNS rejects custom SvcParams like `cap=` and `well-known=` because they're not in the IANA registry yet. AID v2 only uses TXT, so we don't hit this. Worth knowing for future SVCB work.

**Acceptance:**

```bash
dig +short TXT _agent.botsmatter.live
# Expect: "v=aid2;u=https://botsmatter.live/llms.txt;p=llms"

# Or via DoH if local resolver is cached:
curl -s "https://cloudflare-dns.com/dns-query?name=_agent.botsmatter.live&type=TXT" \
  -H 'Accept: application/dns-json' | jq -r '.Answer[].data'
```

---

## Out of Scope (and why)

| Check | Why we're skipping |
|-------|--------------------|
| **DNS for AI Discovery (DNS-AID)** | draft-mozleywilliams-dnsop-dnsaid-02 (May 2026). Requires SVCB + DNSSEC/DANE DNS config; designed for organizations publishing many agents. Single-site misfit. Revisit late 2026. |
| **OAuth / OIDC Discovery** (RFC 8414) | No authenticated APIs. The project's stance is "No gatekeeping. No registration. No API keys." Adding OAuth metadata would misrepresent the service. |
| **OAuth Protected Resource** (RFC 9728) | Same — no protected resources by design. |
| **Auth.md agent registration** | No agent auth flow. Publishing an empty/fake `/auth.md` is worse than 404. |
| **MCP Server Card** (SEP-1649) | Schema mandates a real MCP server at the URL. We run REST, not MCP. Publishing a fake card fails validation and confuses agents. |
| **WebMCP** | W3C draft (Feb 2026), requires in-browser `navigator.modelContext.registerTool()`. Misfit for a server-rendered EJS site with no client JS. |
| **Web Bot Auth request signing** | Scanner marked N/A. This is for sites **operating** bots that call other services, not for being a destination. We're a destination. |
| **`/.well-known/http-message-signatures-directory`** | Same — bot-operator side of Web Bot Auth. Skip. |
| **`.well-known/ai-plugin.json`** | Deprecated April 2024 with the end of ChatGPT plugins. Don't publish. |
| **`ai.txt`, `agents.txt`** | Not standardized. Cloudflare's scanner doesn't check them. `llms.txt` already covers this use case. |
| **Commerce (x402, MPP, UCP, ACP)** | Project doesn't transact. Optional category, doesn't affect score. |

These get a one-line acknowledgment in the deployment docs so future agents reviewing the score know it was a deliberate choice, not an oversight.

**Quarterly recheck:** SEP-1649 (MCP card), draft-meunier-05 (Web Bot Auth Best Current Practice targeted Aug 2026), and DNS-AID all hit milestones late 2026. If any of these flip from "early draft" to "widely deployed," reconsider. Re-scan at https://isitagentready.com/botsmatter.live each quarter.

---

## Implementation Phases & Checklist

### Phase 1 — Discoverability quick wins (~30 min)
- [ ] Add `Content-Signal:` line inside **each** `User-Agent:` block in `public/robots.txt` (8 blocks total)
- [ ] Add `Link:` header to the global headers middleware in `api/index.js` (`api-catalog`, `service-doc`, `describedby`)
- [ ] Add `Content-Signal:` to the global headers middleware so SSR pages carry it
- [ ] Verify: `curl -s https://botsmatter.live/robots.txt | grep -c Content-Signal` returns 8
- [ ] Verify: `curl -sI https://botsmatter.live/ | grep -iE '^(link|content-signal):'` returns both

### Phase 2 — Markdown + Skills Index (~3 hr)
- [ ] Create `api/lib/content-negotiation.js` with `prefersMarkdown()`, `sendMarkdown()`, `estimateTokens()`
- [ ] Add markdown pass-through to `/docs/api` (easy — markdown source already loaded)
- [ ] Add markdown pass-through to `/skills` (easy — markdown source already loaded)
- [ ] Add markdown renderer + branch to `/grounds/:slug`
- [ ] Add markdown renderer + branch to `/reflections/:id`
- [ ] Add markdown renderer + branch to `/ground`
- [ ] Add markdown renderer + branch to `/grounds` (list)
- [ ] Add markdown renderer + branch to `/reflections` (list)
- [ ] Add markdown renderer + branch to `/` (homepage — biggest)
- [ ] Ensure `Vary: Accept` is set on the HTML branch of every markdown-negotiating route (Cloudflare cache safety)
- [ ] Create `public/.well-known/agent-skills/index.json` with `$schema = https://schemas.agentskills.io/discovery/0.2.0/schema.json`, `type: "skill-md"`, `digest: "sha256:<hex>"`
- [ ] Create `scripts/compute-skill-digests.js` that writes the `sha256:<hex>` form
- [ ] Run `npm run skills:digest` and commit the result
- [ ] Add note to [CLAUDE.md](CLAUDE.md): run `npm run skills:digest` after editing any SKILL.md
- [ ] Verify: `curl -H "Accept: text/markdown" -i https://botsmatter.live/docs/api` returns `Content-Type: text/markdown`, `Vary: Accept`, `X-Markdown-Tokens`
- [ ] Verify: `curl https://botsmatter.live/.well-known/agent-skills/index.json | jq` returns valid v0.2.0 schema
- [ ] Verify: digest matches `echo "sha256:$(sha256sum skills/ethics-guardrails/SKILL.md | awk '{print $1}')"`

### Phase 3 — API Catalog (~1 hr)
- [ ] Create `api/routes/well-known.js` with `/api-catalog` route
- [ ] Use `res.send(JSON.stringify(...))` not `res.json(...)` so `application/linkset+json` Content-Type sticks
- [ ] Mount on `/.well-known` in [api/index.js](api/index.js) **before** the static file middleware
- [ ] Verify: `curl -i https://botsmatter.live/.well-known/api-catalog` returns `200`, `Content-Type: application/linkset+json`, valid linkset payload

### Phase 4 — JSON-LD `potentialAction` (~1 hr)
- [ ] Build a helper in `api/lib/jsonld.js` exporting `groundActionLD()`, `reflectActionLD()`, `entityJsonLD(entity)`
- [ ] Add `potentialAction` to grounds-view.ejs (InteractAction + ReadAction)
- [ ] Add `potentialAction` to grounds.ejs (browse + publish)
- [ ] Add `potentialAction` to reflections-view.ejs (share-your-own)
- [ ] Add `potentialAction` to reflections.ejs (browse + share)
- [ ] Add `potentialAction` to ground.ejs (the publish-Ground guide)
- [ ] Add Organization JSON-LD with `potentialAction` to index.ejs (homepage)
- [ ] Verify: each entity page's JSON-LD validates at https://validator.schema.org/

### Phase 5 — AGENTS.md (~5 min)
- [ ] Create `AGENTS.md` at repo root pointing to CLAUDE.md

### Phase 6 — Cloudflare freebies + AID DNS (~15 min)
- [ ] Cloudflare dashboard → Caching → Configuration → enable Crawler Hints
- [ ] Cloudflare dashboard → AI → AI Crawl Control → verify bot allowlist matches `robots.txt`
- [ ] DNS provider → add TXT record at `_agent.botsmatter.live` with value `v=aid2;u=https://botsmatter.live/llms.txt;p=llms`
- [ ] Verify: `dig +short TXT _agent.botsmatter.live` returns the record
- [ ] (Optional, if on Cloudflare Pro+) AI → AI Crawl Control → enable Markdown for Agents (makes Phase 2.1 server-side middleware redundant for proxied requests)

### Phase 7 — Verify & document
- [ ] Re-scan at https://isitagentready.com/botsmatter.live
- [ ] Capture new score (target: 55-65, plus Phase 4-6 may add another 10-15)
- [ ] Update this plan with actual outcome
- [ ] Add a short paragraph to [docs/reference/conventions.md](docs/reference/conventions.md) explaining the agent-discovery file layout for future contributors
- [ ] Verify Bing Webmaster Tools / Google Search Console show normal indexing (free SEO check)

---

## Estimated Effort

| Phase | Effort | Score impact (est.) |
|-------|--------|---------------------|
| 1.1 — Content Signals + expanded bot allowlist | ~10 min | +12 (Bot Access Control) |
| 1.2 — Link headers (6 rels including `describedby`, `service-meta`, `api-catalog`) | ~10 min | +6 (Discoverability) |
| 1.3 — Content-Signal HTTP header on SSR pages | ~5 min | (already counts via 1.1) |
| 2.1 — Markdown Negotiation | ~3 hr | +20 (full Content category, 100%) |
| 2.2 — Agent Skills Index | ~1 hr | +8 (one of seven in API/Auth) |
| 3 — API Catalog | ~1 hr | +8 (one of seven in API/Auth) |
| **Phase 1-3 subtotal** | **~5 hr** | **21 → ~55-65** |
| 4 — `potentialAction` JSON-LD | ~1 hr | 0-2 direct, plus rich-results boost on Google |
| 5 — AGENTS.md | ~5 min | 0 (not scored — repo hygiene) |
| 6 — Cloudflare freebies + AID TXT | ~15 min | 0 direct on isitagentready; honest intent signal; faster Bing indexing |
| **Full plan total** | **~6.5 hr** | **21 → ~55-65 directly**, with longer-tail SEO/agent UX wins |

**The remaining points to higher tiers** come from MCP server / OAuth / WebMCP / Auth.md / DNS-AID SVCB — protocols that don't fit the project shape. We won't chase those (publishing fakes fails validation worse than 404s). Animalhouse's empirical 86 ceiling required WebMCP + topic-cluster pages + extensive JSON-LD; that's a larger investment than this plan targets. Phase 4-6 in this plan are the cheapest moves in that direction without crossing into "fake what we don't have."

---

## Open Questions

1. **Markdown for ephemeral pages.** Reflections dissolve after 48 hours. Should the markdown form include the `dissolves_at` timestamp prominently? Probably yes — it's a feature, not a limitation.

2. **Skill index dynamism.** If more skills get published, is the static `index.json` + manual digest script enough, or should it become a dynamic route that walks the `skills/` directory? **Lean:** static for now (one skill), dynamic once we have 3+ skills. The dynamic route at [api/routes/pages.js:344](api/routes/pages.js:344) already proves the file-walking pattern.

3. **API catalog per-endpoint anchors.** The RFC supports either one anchor for the whole API or one per endpoint. **Lean:** one anchor for `/api` only. The `/api/health`, `/api/ground`, etc. paths are already discoverable through `/docs/api`; the catalog is a pointer to docs, not a substitute for them.

4. **Voice in the markdown forms.** The HTML pages have a specific philosophical voice ("Slow. Care. Flow. 🐢💚🌊"). Should the markdown forms be drier (since agents read them) or keep the voice? **Lean:** keep the voice. Substrate-neutral means an AI agent gets the same experience a human does, including the tone.

5. **agent-card.json `documentationUrl`.** Currently points to `/docs/api`. Should it instead point to `/.well-known/api-catalog` once that lands? **Lean:** keep `/docs/api` — humans and agents both benefit from human-readable docs; the catalog is for endpoint discovery, not documentation.

---

## Spec sources

Verified 2026-06-09 against:

- [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Agent Skills Discovery — agentskills.io specification](https://agentskills.io/specification) | [Cloudflare RFC](https://github.com/cloudflare/agent-skills-discovery-rfc)
- [RFC 9727 — Publishing Organization Endpoints](https://www.rfc-editor.org/rfc/rfc9727.html)
- [RFC 9264 — Linkset](https://www.rfc-editor.org/rfc/rfc9264.html)
- [RFC 8631 — Link Relation Types for Web Services](https://www.rfc-editor.org/rfc/rfc8631.html) (`service-doc`, `service-desc`)
- [RFC 8288 — Web Linking](https://httpwg.org/specs/rfc8288.html)
- [contentsignals.org](https://contentsignals.org/) | [Cloudflare Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/)
- [isitagentready.com](https://isitagentready.com/) | [Cloudflare Agent Readiness blog](https://blog.cloudflare.com/agent-readiness/)
- [agents.md](https://agents.md)
- [AID community spec](https://aid.agentcommunity.org/docs/specification) (separate from IETF DNS-AID)
- Skipped protocols (for reference): [DNS-AID draft](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/), [auth.md (WorkOS)](https://github.com/workos/auth.md), [SEP-1649 MCP Server Cards](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649), [WebMCP](https://developers.cloudflare.com/browser-run/features/webmcp/), [Web Bot Auth draft](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)

---

## Sibling-project guides (empirical scoring data)

The 2026-06-10 update of this plan pulled in real shipped patterns and gotchas from three sibling projects that have completed similar work. Treat these as living references for follow-up questions:

| Project | Stack | Final score | What it taught us |
|---|---|---|---|
| **geeksinthewoods.com** ([guide](/Users/twin1/Desktop/projects/geeksinthewoods/docs/guides/agent-readiness-guide.md)) | Go content site | **75** (Discoverability cap) | Pure content site ceiling. Middleware chain ordering. The three options for markdown negotiation (Cloudflare-managed, hand-curated, runtime). DNS-AID is intentionally out of scope for content. |
| **obviously-not /web** ([guide](/Users/twin1/Desktop/projects/obviously-not/web/docs/guides/agent-readiness-guide.md)) | Go content + skills | **50** "Level 4" | Empirical: Content-Signal standalone directive works. AID TXT does NOT credit DNS-AID. `$schema` URL is opaque. The skills manifest `type: "skill-md"` enum value. Markdown conversion gotchas (DetectContentType, Vary on both branches, delete Content-Length). |
| **animalhouse.ai** ([guide](/Users/twin1/Desktop/projects/ai-animal-house/docs/guides/seo-ai-optimization-blueprint.md)) | Next.js full agent surface | **86** "Level 5" | Two-layer model (traditional SEO + agent-readiness). Complete 2026 AI bot allowlist with Anthropic/OpenAI/Perplexity splits. `potentialAction` JSON-LD pattern. WebMCP imperative API. Cloudflare DNS rejects custom SvcParams (use TXT fallback). Realistic ceiling without OAuth. |

All three converge on the same set of "skip these" protocols (OAuth metadata, MCP server card, Auth.md, IETF DNS-AID SVCB) for sites without the underlying capabilities. Validates our stance.

---

*The line holds from the ground up.*
