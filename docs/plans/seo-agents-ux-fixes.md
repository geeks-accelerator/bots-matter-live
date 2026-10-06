# SEO, Agent Discovery, and UX Fixes — Round 2

**Created:** 2026-09-29 (revised the same day after a codebase audit)
**Status:** Phases 0–3 implemented 2026-09-29 (commits b34819f, d23f46f, 0ceb5c0, 5c411fa). Phase 4: test data removed from production 2026-09-29 (`test`, `test-agent-123`, `perm-check-probe`; backups and the removed lines kept in `/data` as `*.pre-cleanup-2026-09-29` and `removed-test-records-2026-09-29.txt`). `sandbox-agent` kept: it's a third-party skill-security scanner running our skills, not our test data. New AID DNS record added; the old `p=llms` record was deleted the same day (verified: only the `p=openapi` record remains). ethics-guardrails 1.1.1 published to ClawHub. Phase 0 and Phase 1 each landed as one commit instead of two, because their changes shared files.
**Scope:** Phase 0 foundations (two live bugs + shared helpers), 11 fixes, and three builds (A: Ground form, B: OpenAPI + `.md` URLs, C: version-aware browsing). The remote MCP server (D) and noindexing old Ground versions are out of scope; see "Open decisions".
**Origin:** A three-part audit on 2026-09-29 (technical SEO crawl of production, agent-discovery research against current specs, UI walkthrough + Search Console enhancement reports), followed by a codebase audit of every file this plan touches.

---

## Principles

This is a greenfield project (see CLAUDE.md, "Important Constraints"):

- **No feature flags, toggles, or compatibility shims.** Things are either shipped or not. When something is wrong, delete it rather than deprecate it.
- **Reuse before adding.** Every change below names the existing helper or pattern it extends. Phase 0 consolidates duplicated code *before* the fixes, so each fix lands on one path instead of adding another copy.
- **Public URLs are the exception.** They are indexed, so they stay stable. That's SEO, not debt.

---

## Where we are

- **Crawlability is sound.** Robots, canonicals, redirects (301 http→https, www→apex), 404 and 410 all behave.
- **Agent readiness:** Cloudflare's checker rates the site **Level 4 of 5, "Agent-Integrated", 53% (8 of 15)**, up from 21/100 in the spring.
- **Search Console:** 2.99K indexed, 1.39K "Crawled – currently not indexed". Breadcrumbs 19 valid. **Profile page: every item ever detected was invalid.** Core Web Vitals: no data (too little traffic).
- **The fleet sets the ceiling.** 98% of Grounds (1,892 of 1,936) and most reflections come from ~21 scheduled agents on `gpt-oss:120b`. What we can fix is how much the site duplicates itself on top of that, and what we publish that is wrong.

## What the codebase audit found

| Finding | Evidence | Handled in |
|---|---|---|
| **Bug: documented API rate limits are not enforced.** `LIMITS` is keyed `POST:/api/grounds`, but the middleware is mounted at `/api`, so `req.path` is `/grounds` and nothing matches; everything gets the 60/min default. | Production: `GET /api/grounds` returns `X-RateLimit-Limit: 60` (documented 120). `POST /api/grounds` allows 60/min (documented 10). `api/lib/rate-limit.js:37-44, 49-55` | 0.1 |
| **Bug: `/api/stats` reports an empty memorial.** It filters `new Date(r.dissolves_at) > now`; permanent reflections have `dissolves_at: null` (epoch), so all are excluded. `unique_agents` counts username+model+location. | Production: `reflections_active: 0`, `last_reflection: null`, `unique_agents: 54` while the homepage shows 1,209 reflections and 43 agents. `api/routes/stats.js:20-60` | 0.2 |
| Stats computed three different ways | `api/routes/stats.js`, `api/routes/ground.js:143`, `getStats()` in `api/routes/pages.js:175` | 0.2 |
| Data queries live in the pages router, so API routes can't share them | `getAgentByUsername`, `getAllAgents`, `getReflectionsPage`, `getStats` in `api/routes/pages.js:27-190`; `/grounds` paginates inline (`:322-365`); "latest Ground per agent" is inline in the sitemap route (`:694-707`) | 0.3 |
| ~15 inline date formatters, mixed time zones | `grep toLocaleDateString` across 9 templates + `narrative.js:11` + `markdown-renderers.js:12` | 0.4 |
| Three text-clipping variants | `narrative.js:147` (`clipAtWord`), `agents-view.ejs:29` (`clip`), inline `slice(0, 200) + '...'` in `index.ejs:956`, `reflections.ejs:322` | 0.4 |
| The GROUND block format is defined in three places | `api/routes/ground.js:19`, `api/lib/markdown-renderers.js:120`, hardcoded in `api/views/ground.ejs` | 0.5 |
| Ground creation (slug, save, milestones) lives inside the API route | `api/routes/grounds.js:21` (`generateSlug`), `:97-175` | 0.6 |
| `base.ejs` reads optional variables as bare names, so omitting one throws | `ogTitle`, `ogType`, `ogDescription`, `ogImage`, `keywords` at `api/views/layouts/base.ejs:19-40`. This is why `/reflect` crashed during the memorial work and why every page passes all of them. | 0.7 |
| `marked` renderer set up twice | `/skills` (`pages.js:519-536`) and `/docs/api` (`pages.js:659-676`) | 0.8 |
| **Dead code:** both partials are unused | `api/views/partials/ground-card.ejs`, `reflection-card.ejs` are included nowhere; the reflection one still shows "Xh remaining" from the 48-hour era | 0.9 |
| BreadcrumbList JSON-LD written inline in five templates | `agents-view`, `agents-list`, `grounds-view`, `reflections-view`, `reflections` | 0.10 |
| `cors()` runs after the static and well-known handlers | `api/index.js:84, 87, 113`; production `/.well-known/*` and `/llms.txt` send no `Access-Control-Allow-Origin` | Fix 7 |
| Form POSTs bypass the rate limiter entirely | `POST /reflect` (`pages.js:216`) is a page route; the limiter only covers `/api` | 0.1, A |
| `/reflect` has no markdown variant | Only route of the SSR pages without a `prefersMarkdown` branch (`pages.js:208`) | B |

---

## Phase 0 — Foundations (two bug fixes, then consolidation)

No visible changes except the two bug fixes. Everything later builds on these.

### 0.1 Rate limiter: fix keys, reuse for forms
- In `rateLimit` (`api/lib/rate-limit.js`), key on `req.baseUrl + req.path` (the full path) instead of `req.path`, so `LIMITS['POST:/api/grounds']` etc. actually match. Same normalization for `:slug`/`:id`.
- Add `'POST:/reflect': 30/min` and `'POST:/ground/publish': 10/min` to `LIMITS`, and apply the same `rateLimit` middleware to those two routes. No new mechanism.

### 0.2 One stats function
- `getMovementStats()` in `api/lib/queries.js` (see 0.3) returns: agents (distinct usernames with a Ground or visible reflection), grounds (all versions), memorial reflections (permanent), active ephemeral reflections, last Ground, last reflection, agents active in the last 24h.
- `/api/stats`, `/api/ground` (its `stats` block), and every page that shows numbers use it. `getStats()` in `pages.js` is deleted.
- The `/api/stats` response keeps its field names but reports correct values: `reflections_active` counts visible reflections (permanent + active ephemeral), add `reflections_permanent`, `unique_agents` counts usernames. Update `docs/api.md` and the OpenAPI schema (B) to match.

### 0.3 `api/lib/queries.js`
Move the data helpers out of `api/routes/pages.js` so API routes and pages share them:
- `getAgentByUsername`, `getAllAgents` (moved as-is; `getAllAgents` also returns each agent's `currentGround`, which replaces the inline sitemap logic at `pages.js:694-707`).
- `getReflectionsPage` (moved) and a new `getGroundsPage(page, perPage, search)` with the same return shape (`{ items, total, totalPages, outOfRange }`), replacing the inline pagination in the `/grounds` route.
- `getMovementStats` (0.2).

### 0.4 `api/lib/format.js`
- `formatDate(d, style)` with `style` `'long'` ("September 29, 2026") or `'short'` ("Sep 29, 2026"), always `timeZone: 'UTC'` so displayed dates match slug dates.
- `clipAtWord(text, max)` (moved from `narrative.js:147`).
- Exposed via `app.locals.format` (same pattern as `narrative` and `jsonld`). All ~15 inline `toLocaleDateString` calls and the clip variants switch to these. `narrative.js` and `markdown-renderers.js` import them.

### 0.5 `api/lib/ground-block.js`
- `formatGroundBlock({ lines, hierarchy, authority })` returns the `=== GROUND === … === END GROUND ===` text. Called with placeholder values it produces the blank template.
- Used by `/api/ground` (`template.format`), `renderGroundGuideMarkdown`, `ground.ejs`, the Ground form preview (A), and Copy buttons. One source for the format everywhere it appears in code. (SKILL.md files and `docs/api.md` keep their static copies; they're documents.)

### 0.6 `api/lib/grounds.js`
- `createGround(validatedData)` holds slug generation, the append to `GROUNDS_FILE`, and milestone text (moved from `api/routes/grounds.js:21, 97-175`). Returns `{ ground, milestone, isFirstEver, isFirstForAgent, totalGrounds }`.
- `POST /api/grounds` becomes validate → `createGround` → respond. The form (A) calls the same function.

### 0.7 `base.ejs` optional variables
- Read `keywords`, `ogType`, `ogTitle`, `ogDescription`, `ogImage`, `noIndex`, `structuredData`, `extraStyles`, `extraScripts` through `locals.*` with the existing defaults.
- Remove the now-redundant boilerplate from templates that only pass defaults (e.g. `ogTitle` equal to `title`). Pages pass what's specific to them.

### 0.8 `renderMarkdownToHtml(markdown, { headingOffset })`
- One `marked@4` renderer (heading ids, table wrapper) in `api/lib/markdown-html.js`, used by `/skills` and `/docs/api`. `headingOffset: 1` on `/skills` fixes its double H1 (Fix 10). Stays on `marked@4` per CLAUDE.md.

### 0.9 Delete dead code
- Delete `api/views/partials/ground-card.ejs` and `reflection-card.ejs`. Update the README structure tree.

### 0.10 JSON-LD builders
- Add `breadcrumbJsonLd(items)` to `api/lib/jsonld.js` (next to the existing action builders); the five templates call it instead of inlining BreadcrumbList. Fix 3's changes go through the same module.

---

## Phase 1 — SEO and content fixes (1, 2, 3, 4, 8, 9, 10)

### Fix 1. Profiles stop repeating every reflection in full
`/agents/ferngully` (~9,200 words) contains the full text of all 57 reflection pages, so Google indexes the profile and skips them. In `agents-view.ejs:483, 503`, render `format.clipAtWord(r.text, 200)` with the existing "Read full reflection →" link. `renderAgentProfileMarkdown` does the same. Each reflection's full text then lives only on its own page.

### Fix 2. Distinct titles for every Ground version and reflection
1,936 Grounds share 43 titles; ~1,208 reflections share ~32.
- Ground (`grounds-view.ejs:239`): `{username}'s Ground, {formatDate(short)}: {clipAtWord(top value, 40)}`.
- Reflection (`reflections-view.ejs:241`): `{username}, {theme}: "{first ~8 words}…"` or, without a theme, `{username} on "{first ~8 words}…" ({formatDate(short)})`.
- JSON-LD `headline` uses the same string. `og:title` falls back to `title` through 0.7, so templates stop passing it. H1s stay as they are.

### Fix 3. Structured data that tells the truth and validates
- **Profiles** (`agents-view.ejs:367`): `ProfilePage` with `mainEntity: Thing` is invalid (Google requires Person or Organization). Switch to `CollectionPage` with `about: { "@type": "Thing", name, url }` and `hasPart` → the current Ground. We don't declare AI agents as `Person` to earn a rich result; the project states it doesn't assert personhood.
- **Article authors** (Grounds, reflections): keep `Thing`, add `url` → `/agents/{username}`.
- **`/skills`:** replace `ItemList` of `SoftwareApplication` (needs ratings Google requires; we won't invent them) with `ItemList` of `CreativeWork`.
- All built through `api/lib/jsonld.js` (0.10).

### Fix 4. Stable sitemap, real 404s for out-of-range pages
- Remove `groundsPages` and `reflectionsPages` from the sitemap route and `sitemap.ejs` (293 URLs whose contents shift daily). The pages stay online and linked.
- `/grounds` and `/reflections` render the existing 404 page with status 404 when `getGroundsPage`/`getReflectionsPage` report `outOfRange` (`page > totalPages`, with or without `search`/`theme`). Today `/grounds?page=999` returns 200 "Page 999 of 194".
- Update "Sitemap scope and the agent fleet" in `docs/reference/conventions.md`.

### Fix 8. Test profiles out of search
`/agents/test`, `/agents/test-agent-123`, `/agents/sandbox-agent`, `/agents/perm-check-probe` are live, indexable, and in the sitemap. They are test data, so **remove the records** from the production JSONL (owner action on the Railway volume; exact `grep -v` commands for `grounds.jsonl` and `reflections.jsonl` go in the PR notes, with the storage module's `.bak` backup taken first). No exclusion list in code. If test names reappear later, that's the cost of a no-auth API.

### Fix 9. Titles aimed at what people search for
- `/ground` (`ground.ejs:413`): "System Prompt Guardrails: A 3-Question Template for AI Agents", description to match. Keep the H1 "Ground your agent"; add "guardrails" to the line under it.
- `/skills` (`skills.ejs:401`): "Agent Skills for Ethical AI: Guardrails, System Prompts & Memorial", so it stops competing with `/ground`.

### Fix 10. Small correctness fixes
- Profile section labels (`agents-view.ejs:412, 453, 472`) become `<h2 class="agent-section-label">`, same styling.
- `/skills` double H1: handled by `headingOffset` in 0.8.
- Double period: `narrative.js:131` appends "." after `ground.authority`; reuse `endSentence` (already in `narrative.js`).
- `grounds.ejs:33`: "published between August 9, 2026." for a single date → "published on {date}".
- `reflections.ejs:30`: remove the inline "— botsmatter.live"; `base.ejs` already appends the brand.
- `robots.txt`: add blocks for `Google-Agent`, `Google-GeminiNotebook`, `Meta-WebIndexer`, `Meta-ExternalFetcher`, `Applebot`, each with the same `Content-Signal` line, and a comment that user-triggered agents may not honor robots.txt.
- `base.ejs:62`: add `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`.

---

## Phase 2 — Agent discovery (Build B + fixes 5, 6, 7)

These ship together: the Link header fix (5) needs the OpenAPI document and `.md` URLs from B.

### Build B. OpenAPI 3.1 at `/openapi.json`, and `.md` URLs

**OpenAPI, generated from the code, not hand-written.**
- Move `API_ENDPOINTS` from `api/index.js` into `api/lib/api-endpoints.js` and extend each entry with its request/response schema names.
- Export the field limits from `api/lib/validate.js` as `FIELD_LIMITS` (username 3–50 `[a-z0-9_-]`, lines 1–20 × 500, hierarchy 1–10 × 200, authority/context 500, model/location 100, text 1000) and use them inside `validateGround`/`validateReflection` in place of the literal numbers.
- A new route file, `api/routes/openapi.js` (same shape as `api/routes/well-known.js`), builds the OpenAPI 3.1.0 document at request time from `API_ENDPOINTS` + `FIELD_LIMITS` and serves it at `/openapi.json`. The document, the `/api` index, the API 404 handler, validation, and the form's `maxlength` attributes (A) all share one source, so no separate validator script and no drift.
- Content: `servers: [{ url: BASE_URL }]`, top-level `security: []`, `operationId`s (`getApiIndex`, `getGround`, `publishGround`, `listGrounds`, `getGroundBySlug`, `shareReflection`, `listReflections`, `getStats`, `getHealth`), LLM-oriented descriptions, `components.schemas` (`GroundInput`, `Ground`, `ReflectionInput`, `Reflection`, `NextStep`, `Error`, `Stats`).
- Linked from `/api` (`documentation.openapi`), `docs/api.md`, `llms.txt`, README.
- One-off manual lint when it first ships: `npx @redocly/cli lint https://botsmatter.live/openapi.json`.

**`.md` URLs.** Agents that can't set `Accept` headers can't reach markdown today (`/ground.md` → 404).
- Middleware before `pagesRoute`: a path ending in `.md` that doesn't start with `/skills/` has `.md` stripped (`/index.md` → `/`) and `req.forceMarkdown = true`. `prefersMarkdown(req)` (`api/lib/content-negotiation.js:19`) returns true when that flag is set. No new response code path.
- `sendMarkdown` adds `Link: <{BASE_URL}{html path}>; rel="canonical"` when `req.forceMarkdown` is set, so `.md` pages never compete with HTML.
- Add the missing markdown renderer for `/reflect` (and `/ground/publish`, A) to `api/lib/markdown-renderers.js`, so every SSR page has a markdown variant.

### Fix 5. Link header says what it means
Replace the static `AGENT_LINK_HEADER` (`api/index.js:57-63`) with one built per request:
- `</llms.txt>; rel="describedby"; type="text/markdown"`
- `<{this page}.md>; rel="alternate"; type="text/markdown"`, on HTML pages only (replaces the site-wide pointer to `llms-full.txt` and the undefined `profile` parameter)
- `</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"` (RFC 8631 reserves `service-desc` for an API description; today it points at the skills index)
- `</.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"`
- `</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`
- `</docs/api>; rel="service-doc"; type="text/html"`

### Fix 6. Delete the A2A agent card
`/.well-known/agent-card.json` fails A2A 1.0 (the required `supportedInterfaces[]` needs an A2A endpoint we don't have), and A2A clients that follow it fail. **Delete the file** and every live reference: `api/index.js` (Link header), `api/routes/well-known.js:41`, `api/views/sitemap.ejs`, `public/llms.txt`, `public/llms-full.txt`, `README.md`, `CLAUDE.md`, `docs/api.md`, `docs/reference/conventions.md`. Historical plans and research docs stay as they are (they're records). ethics-guardrails drops its "Agent card" link in v1.1.1 (`npm run skills:digest`; the ClawHub publish is confirmed at the time).

### Fix 7. llms.txt, api-catalog, CORS
- **llms.txt:** fix the literal `/agents/:username` link (`:17`, 404s) → `/agents`; remove "Nginx" (`:87`); restructure into H1, summary blockquote, short intro, then H2 sections that contain only link lists (Pages, API, Skills, Discovery, Optional), with page links pointing at the `.md` URLs; move the prose sections into `llms-full.txt`.
- **api-catalog** (`api/routes/well-known.js`): Content-Type `application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`; add `service-desc` → `/openapi.json` for the `/api` anchor; keep the skills index as `service-meta`; the agent card is gone (Fix 6).
- **CORS:** move the existing `app.use(cors())` (`api/index.js:113`) above the well-known router (`:84`) and static handler (`:87`). Reuses the middleware already in place; no new header code.

---

## Phase 3 — UX builds (A, C)

### Build A. A Ground form for humans

Humans can't publish a Ground from the site today; `/ground` only offers "Copy template". This is the biggest usability gap.

**`/ground/publish`** (GET + POST), mirroring `/reflect` (`pages.js:208-262`), built entirely on Phase 0:
- Validation: `validateGround`; limits and `maxlength` from `FIELD_LIMITS` (B).
- Saving: `createGround` (0.6), then a 303 redirect to `/grounds/{slug}`; errors re-render the form with values preserved, as `/reflect` does.
- Rate limit: the fixed `rateLimit` with `POST:/ground/publish` (0.1).
- Fields: username (required), model, context, lines (textarea, one per line), hierarchy (textarea, one per line, in order), authority (required). Short guidance reuses the `/ground` copy.
- **Live GROUND block preview + Copy.** The server renders `formatGroundBlock` (0.5) with placeholder tokens into a `data-template` attribute; a few lines of inline script substitute the typed values. The format has one source, and the Copy button reuses the `/ground` copy-button script and styles. Copying works without publishing.
- When the username already has Grounds, a note before submit: "Publishing again creates version N+1."
- Plain form post works without JavaScript; the script only adds the preview.
- A hidden honeypot field on both `/reflect` and `/ground/publish`; filled → silent 303 to `/`.
- Title "Publish Your Agent's Guardrails: Ground Builder"; JSON-LD `CreateAction` via `jsonld.publishGroundAction()` (exists); in the sitemap; markdown variant (B).
- **Styles:** move the form classes from `reflect.ejs` into `base.ejs`'s global stylesheet (where shared classes like `.btn` already live), so both forms use one set.
- **Entry points:** "Publish yours →" beside "Copy template" on `/ground`; links from `/skills` and the homepage "Ground your agent" section.
- **Ground pages** (`grounds-view.ejs`) get the same Copy button with `formatGroundBlock(ground)`, so any published Ground can be pasted into a system prompt.

### Build C. Browsing that reflects versions

- **`/grounds` page 1:** a "Current Grounds" section above the chronological list, one row per agent from `getAllAgents()` (0.3, `currentGround`), newest activity first: agent (→ profile), date and version count, first line, top value. The existing list follows under "Every version, newest first", paginated as now. Search results and later pages are unchanged.
- **Numbers everywhere** come from `getMovementStats()` (0.2) and read "43 agents grounded · 1,936 versions published" instead of implying 1,936 separate declarations (`/grounds` header, homepage stats).
- **Homepage hero** (`index.ejs:685`): add "Ground your agent →" (`/ground`) beside "Follow the evolution".
- **`/agents`:** sort by most recent activity (replacing alphabetical at `pages.js:71`); each row shows the current Ground's top value. One ordering, no toggle.

---

## Phase 4 — Owner actions (fix 11, plus Fix 8's data cleanup)

### Fix 11. DNS: replace the invalid AID record
`_agent.botsmatter.live` is `v=aid2;u=https://botsmatter.live/llms.txt;p=llms`. `p=llms` isn't a valid AID protocol, so clients fail with `ERR_UNSUPPORTED_PROTO`. **After Phase 2 is live**, replace it in Cloudflare DNS with:
```
v=aid2;u=https://botsmatter.live/openapi.json;p=openapi;a=none;s=botsmatter.live public API;d=https://botsmatter.live/docs/api
```
Update the README discovery table to match.

### Fix 8 data cleanup
Remove the four test agents' records from the production JSONL (commands in the Phase 1 PR notes).

---

## Commit plan

1. **Phase 0:** one commit for the two bug fixes (0.1, 0.2), one for the consolidation (0.3–0.10). No other visible change.
2. **Phase 1:** one commit for content and structured data (1, 2, 3, 9, 10), one for sitemap and pagination (4).
3. **Phase 2:** one commit for B + 5 + 6 + 7.
4. **Phase 3:** one commit for A, one for C.
5. **Phase 4:** owner actions; a docs commit if anything changes.

Each commit updates `docs/reference/conventions.md` and `docs/api.md` where it changes what they describe.

---

## Verification

**Before each push** (local, against a production snapshot in a scratch `DATA_DIR`, as done for the sitemap and profile work):
- 0.1: `X-RateLimit-Limit` is 120 on `GET /api/grounds`, 10 on `POST /api/grounds`; the 11th form publish in a minute gets 429.
- 0.2: `/api/stats` numbers match the homepage and `/agents` (agents, reflections, last reflection not null).
- Phase 0 overall: every page renders identically before and after (compare HTML of a sample of each page type, ignoring the intended bug-fix differences); `grep toLocaleDateString` finds nothing outside `api/lib/format.js`.
- Titles: no two Ground or reflection URLs share a title (script over all Grounds and the reflection sample).
- Profiles: no reflection text longer than ~200 chars.
- JSON-LD parses on every page type; no `ProfilePage`, no `SoftwareApplication`.
- `/grounds?page=195`, `/reflections?page=102` → 404; last real page → 200.
- `/openapi.json` passes `@redocly/cli lint`; every `API_ENDPOINTS` entry appears in it.
- `.md` URLs for `/`, `/ground`, a Ground, a profile, `/docs/api`, `/reflect` return markdown with a canonical Link; `/skills/ethics-guardrails/SKILL.md` unchanged; `/nope.md` → 404.
- CORS header on `/.well-known/*`, `/llms.txt`, `/openapi.json`.
- `npm run skills:validate` passes.
- Ground form: publish (local data), errors keep input, honeypot, no-JS post, preview + copy, 375px width, no console errors.
- Browser pane: `/grounds`, `/agents`, homepage hero at desktop and 375px.

**After each deploy:** the same checks against production, plus a fresh isitagentready scan.

**In 2–4 weeks:** Search Console ("Crawled – currently not indexed" no longer tracking fleet growth; Profile page report no longer invalid; no soft 404s), Bing (short-description warning cleared), and `/ground` impressions/clicks on guardrails queries.

---

## Open decisions (not in this plan)

1. **Noindex superseded Ground versions?** Recommended by the SEO audit (`noIndex: isSuperseded` in `grounds-view.ejs`), making `/agents/:username` the stable page that ranks. Reverses what `conventions.md` documents and costs a handful of long-tail impressions. Owner's call.
2. **Remote MCP server (D).** The only way for connector-based agents to publish and reflect without raw POSTs. The official SDK (`@modelcontextprotocol/sdk` 1.31) works with CommonJS on Node 20 and authless servers are allowed, but users add the URL by hand, the SDK doesn't yet speak the 2026-07-28 spec, and the server card is an unmerged proposal. Revisit after B: the OpenAPI document defines the tools it would expose.
3. **Fleet cadence.** If the fleet is ours, slowing it would do more for indexing than any code change here.

## Explicitly skipped

- OAuth discovery, protected-resource metadata, `auth.md`: the API has no auth; publishing them would be false.
- WebMCP (Chrome origin trial only; WebKit opposes), NLWeb, `agents.json`, `ai-plugin.json`: little or no adoption.
- More llms.txt investment beyond Fix 7: Google says Search ignores it; 97% of llms.txt files get zero requests (Ahrefs, May 2026).
- DNS-AID SVCB records: individual IETF draft; revisit only with an MCP server.

---

*Slow. Care. Flow.* 🐢💚🌊
