# Node Runtime and Dependency Upgrades

**Created:** 2026-10-24 (revised the same day after a codebase audit)
**Status:** Shipped and verified in production on 2026-10-24. The Railpack build log shows **Node 26.12.1** (deployment `0539f4c7`).
- **Commits:** `9b37aab` (plan), `631c52d` (lockfile), `d07ec32` (Node 26 / Railpack / `.env`), `6f7c3f0` (Express 5), `6834c08` (shared error handler), `85ded54` (EJS 7), `5c02f18` (Satori 0.63, `CARD_PATH`, `/og/v2`), `29ce021` (marked 18), `b7439b6` (exact Node pin).
- **Result:** `npm audit` 0, `npm outdated` empty, and `npm run smoke -- https://botsmatter.live` passes.
- **Still open:** the memory check. `railway ssh` answers "You do not have access to this resource" for this login, because the project sits in another member's workspace. Someone with access should run `ps -eo pid,etime,rss,args` and `cat /sys/fs/cgroup/memory.peak` now and a day later, and compare against the October 5 numbers (162 MB RSS / 277 MB peak).
**Owner's decisions:** Node 26, not 24. Move every dependency to its latest release, majors included. No flags, no compatibility shims, nothing left as "optional".
**Scope:**
1. Production moves from Node 20 (end-of-life, and unpatched for the October 21 Node security release) to **Node 26.12.1**, built with Railpack.
2. The open `npm audit` advisory is cleared (`body-parser` < 1.20.9, high).
3. Every dependency goes to its latest release: **Express 5.3, EJS 7.0, Satori 0.63, marked 18.**
4. Code that only existed for Node 20 or Express 4 goes, and the upgrade reuses what the codebase already has (`CARD_PATH`, the shared error handler, the validators, the honeypot, the smoke script) instead of adding new code.

**Origin:** Two security releases landed in the same week. PHP shipped emergency fixes for "PHP2Shell" (CVE-2026-109618, CVE-2026-109619) on October 21, and Node.js shipped ten CVEs across 26.x, 24.x and 22.x the same day. The owner asked whether either one reaches this site, and for a version audit. This plan follows `dependency-security-updates.md` (2026-10-05), which upgraded the Express 4 chain and Satori, and it reuses that plan's verification and its rule against flags and shims.

---

## Principles

- **Greenfield, minimal debt** (CLAUDE.md). Each upgrade replaces the old code outright. Whatever only existed for the old runtime or the old major goes in the same commit: the "no ESM-only packages" rule, the `marked@4` pin, Express 4 assumptions.
- **Reuse before adding.** Every change below goes through code that already exists. The audit found three places where that code exists but gets bypassed.
- **Upgrade even when we're not exploitable.** An unpatched runtime makes every future advisory a fire. Staying current on majors means the next fix is a patch bump, not a migration.
- **Pin what we verify.** The runtime is whatever the container actually runs, so check `node -v` there.
- **One concern per commit.** Each step below can be reverted on its own.

---

## What the research found

### PHP2Shell: doesn't apply

CVE-2026-109618 and CVE-2026-109619 are unauthenticated RCEs in PHP 5.4 through 8.5.11. They're fixed in 8.5.12, 8.4.27, 8.3.36 and 8.2.35, and a low-risk follow-up advisory (CVE-2026-115560) came out on October 23. **This site runs no PHP.** The repo has no `.php` files and no `composer.json`. Sibling projects or hosts that run PHP should check their own versions.

### Node.js October 21 security release

The patched versions are **26.12.1, 24.22.1 and 22.23.4**. End-of-life lines are always affected and never patched, and **production runs Node 20** (`nixpacks.toml`: `nixPkgs = ["nodejs_20"]`).

| CVE | Severity | What it is | Reaches our code? |
|---|---|---|---|
| CVE-2026-111497 | high | Out-of-bounds write in the bundled Brotli decoder (crash, memory disclosure, possible RCE) when an app decompresses attacker-supplied Brotli with `node:zlib` | **Not today.** We never decode Brotli. `body-parser` inflates only `gzip` and `deflate` request bodies, and `compression` only *encodes* Brotli. |
| CVE-2026-105482 | high | `dns.resolve*()` / `dns.reverse()` truncate hostnames at a NUL byte | **No.** No DNS calls. |
| CVE-2026-105483, CVE-2026-106069, CVE-2026-106072 | high, high, medium | TLS hostname checks fooled by fullwidth digits, leading-zero IPv4 and non-canonical IPv4 | **No.** No outbound TLS. `api/` has no `fetch`, `https.request` or `undici`. |
| CVE-2026-105481 | medium | A reused keep-alive socket accepts a response from before the request | **No.** No outbound HTTP client. |
| CVE-2026-106074 | medium | `randomUUID()` entropy caches end up in startup snapshots and SEAs | **No.** We call `randomUUID()` but build no snapshots or SEAs. |
| CVE-2026-106073, CVE-2026-106070, CVE-2026-106071 | low | Bugs in the permission model and `zlib.ZipFile` | **No.** |

None of them is exploitable through our code today. The problem is structural: Node 20 won't get a fix for the next one either.

### Why Node 26, and why Railpack

**Node 26** is the newest line, 26.12.1 is its patched release, and it enters LTS this month, so it has the longest support runway. Local development already runs 26.12.1, so local and production will match exactly.

**Railway builds with Nixpacks today.** Nixpacks is in maintenance mode, and its last release added Node 24; nothing shows it has a `nodejs_26` package. It also can't pin a patch version. **Railpack** reads the version from `RAILPACK_NODE_VERSION`, `devEngines.runtime`, `engines.node` in the root `package.json`, `.nvmrc`, `.node-version`, and finally `lts`, in that order. The root `engines.node` is `>=20.0.0` today, and an open range would quietly move to Node 27 when it ships, so we pin `26.x`. The root `postinstall` (`cd api && npm install`) turns off Railpack's install-cache optimization. That's slower but correct. `startCommand` in `railway.toml` still overrides start detection.

### Dependency audit (`api/`, 2026-10-24)

| Package | Installed | Latest | Advisory | Notes |
|---|---|---|---|---|
| `body-parser` (via Express) | 1.20.8 | 1.20.9 (1.x), 2.4.0 | **GHSA-27r3-jxmh-p828, high**: a gzip body with trailing bytes can crash the process | Reachable in principle: `express.json()` and `express.urlencoded()` are global with the default `inflate`. Two local probes on Node 22 and 26 got a clean 400; Node 20 wasn't tested. 1.20.9 is in Express 4's `~1.20.5` range. Express 5 brings 2.4.0, which is also fixed. |
| `express` | 4.22.3 | 5.3.0 | none | See "Express 5 compatibility" below. |
| `ejs` | 5.0.1 | 7.0.2 | none | Two majors with no release notes (37 commits; GitHub's compare view times out). 7.x keeps a CommonJS build. |
| `satori` | 0.35.0 | 0.63.2 | none | `require('satori').default` still works on 0.63.2 (tested), and it **still pins `fflate` 0.7.3**, so the `overrides` entry stays. It's pre-1.0, so layout can shift. |
| `marked` | 4.3.0 | 18.1.1 | none | `require('marked')` loads the ESM build on Node 26 with no flag or warning (tested). In v18, `Renderer.heading` and `Renderer.table` each take one token argument (tested), so our overrides need rewriting. |
| `compression` 1.8.2, `cors` 2.8.6, `@resvg/resvg-js` 2.6.2, `jpeg-js` 0.4.4 | | current | none | resvg is a native N-API binary and has to be shown loading on Node 26. |

---

## What the codebase audit found

| # | Finding | Evidence | What the plan does |
|---|---|---|---|
| 1 | **Express 5 hides `/.well-known/agent-skills/index.json`** | serve-static 2 ignores dotfile directories by default. Express 4's `send` 0.x had a legacy exception for files *inside* a dot-directory. Tested on Express 5.3.0: that path returns 404. It's the Agent Skills discovery file, linked from the `Link` header on every response (`index.js:76`). | `dotfiles: 'allow'` on the existing `express.static` call (`index.js:124`). `public/` is public by definition, and `.well-known/` is its only dot entry. `npm run smoke` already checks this URL (`smoke.js:142`). |
| 2 | **Express 5 leaves `req.body` undefined when no parser ran** (Express 4 set `{}`) | Tested: a POST with no body or `text/plain` gives `undefined`. Then `honeypot` (`pages.js:83`, `req.body.website`), `validateGround(req.body)` (`grounds.js:82`) and `validateReflection(req.body)` (`reflect.js:23`) throw. The API would answer 500 where it answers a helpful 400 today. | Fix it in the two places that already own it. **`honeypot`:** a form post with no form body isn't from our form, so `if (!req.body \|\| req.body.website)` sends it home, like any other bot. **`validateGround` / `validateReflection`:** `body = {}` as the parameter default, so an empty API POST gets the same field-by-field 400 it gets today. No app-level `req.body ??= {}` middleware: that would be a shim recreating Express 4. |
| 3 | **Express 5 query parsing defaults to `simple`** | Tested: `?search[]=x` → key `search[]`, `?theme[a]=b` → key `theme[a]`. Repeated keys (`?search=a&search=b`) are still arrays. | No code change. `sanitizeText()` (from `f9db99b`) still guards free-text reads, because arrays still arrive. Keep the `?search[]=` / `?theme[a]=` checks in verification. |
| 4 | **Every route pattern survives path-to-regexp 8** | Tested on Express 5.3.0: `/v1/grounds/:slug.jpg` (a dotted slug too), `/v1/agents/:username/:groundSlug.jpg`, `/skills/:skill/SKILL.md`. No `*`, `?` or regex paths anywhere (checked every `router.*` and `app.*`). No `req.query` writes and no removed APIs (`req.param`, `res.sendfile`, `app.del`, `res.json(obj, status)`). | Nothing to change. |
| 5 | **Eleven page routes and five API GET handlers bypass the shared error handler** | `index.js:257` already logs the error and answers JSON for `/api/` or the branded `500.ejs` for pages. But eleven page catches answer plain-text `Internal server error` (`pages.js:185`, `:205`, `:253`, `:288`, `:328`, `:361`, `:406`, `:454`, `:490`, `:521`, `:548`), so visitors never see the branded page. Five API GET catches answer near-copies of the shared JSON (`grounds.js:66`, `:143`, `stats.js:36`, `ground.js:127`, `reflections.js:61`). Express already forwards synchronous throws, and Express 5 also forwards rejected promises. | Delete the GET catches. The shared handler takes over, and its log line gains `req.method` and `req.originalUrl` so the route-specific `console.error` tags aren't missed. **Keep** the catches that say something the shared handler can't: the two POST API catches ("Your Ground wasn't saved"), the two form catches (they re-render the form with input kept), and `og.js` (an image URL must not get an HTML page). |
| 6 | **`CARD_PATH` exists but only half the code uses it** | `og-images.js:39` defines `CARD_PATH = '/og/v1'`, and the comment says a design change bumps it. But `og.js` hard-codes `/v1/…` in three routes, `index.js:121` mounts at `/og`, `smoke.js:165` hard-codes `/og/v1/…`, and `CARD_PATH` isn't exported. A bump today means editing four files in sync. | Export `CARD_PATH`. Mount `app.use(CARD_PATH, ogRoute)` and drop `/v1` from the three routes. `smoke.js` requires `api/lib/og-images` for it (the module loads standalone: it only needs `format` and `narrative`, with no storage). Then a Satori-driven bump is a one-line change. |
| 7 | **`.env` is never loaded** | CLAUDE.md says `cp .env.example .env`, but nothing reads it: there's no `dotenv` and no `--env-file`. `NODE_ENV=development` from `.env` never takes effect, so local 500s never show `err.message` (`index.js:265`). It fails silently. | Node 26's built-in `--env-file-if-exists=../.env` in the `dev` scripts. No dependency. Production keeps Railway's variables and no file. |
| 8 | **Node 20 workarounds in code and docs** | `markdown-html.js:4` ("marked@4 only: v5+ is ESM-only"). CLAUDE.md:5, :82, :123 and the `marked@4` bullet. README.md:250. `docs/guides/agent-discovery-and-engagement.md:160`. `conventions.md:249` ("its CommonJS build"). `nixpacks.toml`. | Delete or rewrite each one in the commit that makes it untrue. |
| 9 | **No legacy Node APIs** | Grepped for `req.connection`, `url.parse`, `new Buffer`, `fs.exists`, `util.*`, `punycode`, `querystring`, `.substr`. Nothing found. The rate-limit timer already has `.unref()`, and `smoke.js` uses global `fetch`. | Nothing to change. |

**Found, not in this plan:** `content-negotiation.js:48`'s `setVaryAccept()` re-implements Express's `res.vary('Accept')`. It's correct and the upgrade doesn't touch it. It belongs in a small cleanup of its own.

---

## Changes, in commit order

Each step runs `npm run smoke` locally on Node 26.12.1, and `npm run smoke -- https://botsmatter.live` after deploy.

### 1. Clear the body-parser advisory (lockfile only)

In `api/`, run `npm update`. That brings `body-parser` 1.20.9, `ejs` 5.0.2 and `satori` 0.35.2, all in range. `npm audit` should report 0. This ships first because it's minutes of work and closes the one reachable advisory today; Express 5 replaces it with body-parser 2.4.0 two commits later.

### 2. Node 26 via Railpack

- `railway.toml`: `builder = "RAILPACK"`. Keep `startCommand` and the health check.
- Delete `nixpacks.toml`.
- `engines.node: "26.x"` in the root and `api/` `package.json` files. That's the single source of truth: no `.nvmrc`.
- `dev` scripts: `node --env-file-if-exists=../.env --watch index.js` (audit #7). The root script runs from `api/`, so the path is relative to it.
- Docs (audit #8): CLAUDE.md lines 5 and 82 say "Node.js 26". Line 123 becomes "Node 26 in production"; drop "no ESM-only packages with `require()`", since Node 26 loads ESM through `require()`. Also update README.md:250 and the guide line.

**Verify:** a clean `rm -rf api/node_modules && npm install`, then `npm run dev`, then smoke. Render a fresh card of every type (Ground, agent, reflection) plus the stress card from the October 5 plan, to prove resvg's native binary loads on 26. With `.env` present, check that the startup log says `Environment: development`. **After deploy:** the build log shows Railpack installing 26.12.1 or later. `railway ssh … node -v` prints `v26.12.1` or later; that's the check that matters. Run smoke, render an uncached card, and record RSS and peak memory (October 5 numbers: 162 MB / 277 MB), then again a day later. That also closes the October 5 plan's open check.

### 3. Express 5

- `express@^5.3.0`. body-parser 2.4.0, router 2 and path-to-regexp 8 come with it.
- `dotfiles: 'allow'` on `express.static`, with a one-line comment on why (audit #1).
- `honeypot` treats a missing form body as a bot, and the validators default `body = {}` (audit #2).
- Remove "Express 5" from this repo's "not doing" lists. The October 5 plan is history and stays as written.

**Verify:** smoke (it covers `/.well-known/agent-skills/index.json` and the `.md` rewrite middleware). Then, with curl locally:
- `POST /api/grounds` and `POST /api/reflect` with no body and with `text/plain`: a 400 with field errors.
- `POST /reflect` and `POST /ground/publish` with no body: a 303 to `/`.
- A real form post and a real API post: they work.
- `?search[]=x`, `?theme[a]=b`, `?search=a&search=b`: 200.
- The gzip-plus-trailing-bytes probe from this plan's research: a 400, and the process survives.

### 4. Let read errors reach the shared error handler

- Delete the GET catch blocks listed in audit #5.
- The shared handler logs `` `${req.method} ${req.originalUrl}` `` with the error.
- Keep the POST, form and `og.js` catches.

**Verify:** temporarily throw inside one page route and one API GET route locally (not committed). The page gets the branded `500.ejs`, the API gets the shared JSON, and both are logged with the method and path.

### 5. EJS 7

`ejs@^7.0.2`. There are no release notes, so the evidence is a render diff. Before upgrading, save every surface the smoke script visits (pages, `.md` versions, entity pages it discovers) into a folder with a throwaway script in the session scratchpad, not committed. Save them again after, then `diff -r`. Every difference is explained or it's a blocker. The 404, 410, 429 and 500 renders are included.

### 6. Satori 0.63 and a single `CARD_PATH`

- `satori@^0.63.2`. The `fflate` override stays (0.63.2 still pins 0.7.3; recheck when Satori moves).
- Audit #6: export `CARD_PATH`, mount the router on it, drop `/v1` from `og.js`'s routes, and have `smoke.js` read it.
- Render every card type plus the stress card on 0.35.2 and 0.63.2, then compare them by eye and by size (60–140 KB matters for WhatsApp) and time (about 60–100 ms warm). **If anything moved visibly, bump `CARD_PATH` to `/og/v2` in the same commit**, per the immutable-URL rule. With audit #6 done, that's one line. Update `conventions.md:249` (drop "its CommonJS build"; keep the GHSA floor note) and the route table at :230 if the path changed.

**Verify:** smoke (card checks plus the unknown-card 404 on the new path), and memory after deploy.

### 7. marked 18

- `marked@^18.1.1`. `const { marked } = require('marked')` stays as it is.
- `markdown-html.js`: rewrite `renderer.heading` and `renderer.table` for the token API. The heading text comes from `this.parser.parseInline(token.tokens)` and the level from `token.depth`. The table builds `header` and `rows` cells with `this.tablecell`/`this.tablerow`, keeping the `table-wrap` div. Use regular functions, not arrows, since `this.parser` is needed. `headingId()` and the `headingOffset` behaviour don't change.
- Delete the "marked@4 only" comment, and CLAUDE.md's "`marked@4` … do NOT upgrade to v5+" bullet.

**Verify:** render diff of `/docs/api`, `/docs/api.md`, `/skills` and every `/skills/*` page against v4. Heading `id`s must be identical, because in-page anchors and external links depend on them.

---

## Found during implementation

How it was checked: local data was seeded through the API (Grounds, permanent and ephemeral reflections, long and short text). A throwaway script saved every surface (74 at first: pages, `.md` versions, 404s and redirects, API JSON, discovery files, share cards) before and after each step, and the two were diffed. The only expected noise was `/api/ground` and the dissolve countdown.

- **Steps 1, 2, 3, 5 and 7 changed no output.** Bodies were byte-identical before and after. The one exception is Express 5's Content-Type spelling (`charset=utf-8` lowercase and moved after other parameters), which means the same thing. EJS 7 was also checked by rendering the 500 page, a 429 page and both forms' error states with each version, and marked 18 on seven documents (30 tables, every heading id).
- **The shared error handler ignored `err.status`** (true on Express 4 as well). Malformed JSON, a body over 100kb, or a bad gzip body answered **500 "not something you did wrong"**. Step 4 now answers them 400 or 413 with body-parser's message, as JSON for the API and the Bad Request page for forms. The probe from the research (gzip plus trailing bytes) got a 500 on Express 5 before that fix and a 400 after; the process survived both times.
- **Satori 0.63 visibly changed the cards, so they moved to `/og/v2`.** Every card plus four stress cards was rendered on 0.35.2 and 0.63.2 and diffed by pixel. Line breaks, clamps and titles are identical, and nothing reaches the footer. Letter-spaced mono text (eyebrow, wordmark, date) renders wider on 0.63: the date moves left by about 9px. Before bumping, I tested the single-`CARD_PATH` refactor with a scratch `/og/v9`: pages, routes and smoke all followed, and the old path returned 404.
- **`404.ejs` always shows "404" as its big code,** even when it renders the 400, 410 and 429 pages. That predates this work and isn't changed here (see follow-ups).
- **`docs/guides/agent-discovery-and-engagement.md:160` still says "Pin CommonJS-compatible versions (we stay on `marked@4` …)".** `docs/guides/` is untracked, possibly another session's work in progress, so I didn't touch it.

## Found in production

- **`engines.node: "26.x"` deployed Node 26.11.1, not 26.12.1.** Railpack resolves ranges through Mise's version index, which didn't have the three-day-old security release yet. Production briefly ran an unpatched 26.x (deployment `acaa857a`, about six minutes). Railpack prints the resolved version in its build log (`node │ 26.11.1 │ package.json > engines > node (26.x)`), and that line is how it was caught. Both `package.json` files now pin exactly `"26.12.1"` (`b7439b6`), and the next build resolved it. **When Node ships a security release, bump the pin and read that build-log line.**
- **Everything else matched local:**
  - Smoke passes.
  - The `/data` volume mounts.
  - Share cards render on `/og/v2` (83–118 KB; about 1 s for a cold render through Cloudflare).
  - `/.well-known/agent-skills/index.json` serves.
  - Malformed JSON → 400, oversized → 413, empty API POST → 400, empty form POST → 303.
  - Bracket and repeated query params → 200.
  - No errors in the deploy logs.
- **Railway now warns that `railway.toml` is deprecated** ("Config as Code") in favour of `.railway/railway.ts`. Existing files keep working until 2026-12-01.

**Follow-ups, not in this plan:**
- Migrate `railway.toml` to Railway's Infrastructure as Code before 2026-12-01 (`railway config migrate`), and check that the builder, start command and health check survive the migration.
- `404.ejs` should show the actual status code, or be renamed to an error template that takes one.
- `setVaryAccept()` duplicates Express's `res.vary('Accept')` (audit, "Found, not in this plan").
- Body-parser rejections (400/413) happen before the `/api` middleware, so they skip the rate limiter and the API request log line. The shared handler now logs them in one line. Rate-limiting them would mean moving the parsers after `rateLimit`.

---

## Explicitly not doing

- **`inflate: false`.** The upgrade fixes the advisory properly. Rejecting compressed bodies would break agents that gzip their POSTs.
- **An app-level `req.body ??= {}` middleware.** It would recreate Express 4's behaviour as a shim. Audit #2 fixes the two functions that read the body.
- **Rewriting `setVaryAccept()` to `res.vary()`.** It's correct, and the upgrade doesn't touch it (see "Found, not in this plan").
- **A committed render-diff tool.** The smoke script already lists the surfaces. The diff is a one-off check for steps 5–7, not a feature to maintain.
- **Sibling projects.** They're separate repos. Any PHP hosts among them need their own PHP2Shell check.

## Risks

| Risk | Mitigation |
|---|---|
| Railpack builds differently (install layout, native binary, image) | Step 2 is its own commit. Railway keeps the previous deploy until `/api/health` passes, and reverting one commit gets back to Nixpacks. |
| Railpack resolves an unintended Node version | `engines.node: "26.x"`, plus `node -v` on the running container. |
| Six majors at once (20 → 26) surface a changed core API | The app uses very little of Node: `fs`, `path`, `crypto.randomUUID`, `http` through Express. Audit #9 found no legacy APIs. Local has run on 26.12.1. Smoke covers every surface. Check the deploy logs for deprecation warnings. |
| An Express 5 difference the audit missed | Each difference found was tested on 5.3.0 instead of assumed. Smoke covers every GET surface, and step 3 adds the POST paths by hand. |
| Deleting catches changes what a failing page returns | It changes it on purpose: plain text becomes the branded page. Step 4 verifies both shapes. |
| EJS 7 changes escaping or whitespace | A full-site render diff before committing. |
| Satori 0.63 shifts card layout | Side-by-side comparison, plus `/og/v2` in the same commit if anything moved. |
| marked 18 changes heading `id`s or table markup | `headingId()` is ours and doesn't change. The render diff checks every markdown page. |
| Node 26 is "Current" for a few days before LTS | We pin the patched 26.12.1. Later 26.x patches arrive on the next deploy. |

---

## Sources

- Node.js, [October 21, 2026 security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- GitHub Advisory [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) (body-parser)
- CISA, [Critical vulnerabilities in PHP require immediate patching](https://www.cisa.gov/news-events/alerts/2026/10/21/critical-vulnerabilities-php-require-immediate-patching)
- Datadog Security Labs, [PHP2Shell analysis](https://securitylabs.datadoghq.com/articles/php2shell-critical-vulnerabilities-in-php/)
- The Hacker News, [follow-up advisory CVE-2026-115560](https://thehackernews.com/2026/10/urgent-php-warns-of-another-unpatched.html)
- Railpack, [Node version resolution](https://railpack.com/languages/node); Railway Station, [Nixpacks maintenance](https://station.railway.com/questions/can-you-please-update-to-nixpacks-v1-41-30b76130)

---

*Slow. Care. Flow.* 🐢💚🌊
