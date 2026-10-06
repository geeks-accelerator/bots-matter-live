# Dependency Security Updates

**Created:** 2026-10-05 (revised the same day after a codebase audit)
**Status:** Shipped and verified in production on 2026-10-05.
- **Commits:** `bb9534b` (plan), `ccc705e` (smoke script), `c444719` (dependencies), `b99df9a` (`createReflection`), `7906a79` (first rate-limit attempt), `f9db99b` (query fix), `bda7e48` (logger fix and temporary diagnostic), `26cd3ec` (rate-limit fix, diagnostic removed).
- **Owner's decisions:** commit the smoke script; drop the dead milestones.
- **Still open:** a memory check a day after deploy, and confirming `createReflection()` on the first real reflection (none had arrived by the end of the day).
**Scope:**
1. Satori to ≥0.33.5.
2. The Express 4 dependency chain.
3. Replace `uuid` with Node's `crypto.randomUUID()`.
4. Plus one adjacent bug found while investigating (2): the rate limiter keys on Cloudflare's address instead of the client's.

**Origin:** A check of the sibling projects' Next.js versions found GHSA-vcvr-r3jv-pc5j (RCE in `next/og`). Its root cause is a Satori advisory, and this site's share-card renderer uses Satori directly. `npm audit` then showed two more advisories (`proxy-addr`, `compression`), both published 2026-10-05.

---

## Principles

- **Greenfield, minimal debt** (CLAUDE.md). Remove a dependency rather than pin around it. Put shared logic in one place before changing it.
- **Upgrade even when we're not exploitable.** Advisories that don't reach our code today can tomorrow, and a clean `npm audit` keeps real alerts visible.
- **Measure, don't assume.** Every claim below was tested on this codebase or against production on 2026-10-05.
- **No flags or shims.** Each change replaces the old code outright; nothing keeps a second path "just in case".

---

## What the codebase audit found

| # | Finding | Evidence | What the plan does |
|---|---|---|---|
| 1 | **Ground creation has a shared module; reflection creation doesn't** | `api/lib/grounds.js` exports `createGround()`. It reads once, builds the record, appends, works out the milestone (`buildMilestone`), and returns `{ ground, milestone, isFirstEver, isFirstForAgent, totalGrounds }`. The API route and the form (`pages.js:170`, `const { ground } = createGround(...)` then a 303) both call it. Reflections duplicate the record, the 48-hour window and the append in `routes/reflect.js:39-56` and `routes/pages.js:110-128`, and the milestone logic lives in the API route. | `api/lib/reflections.js` mirrors `grounds.js`: `createReflection(data)` returns `{ reflection, milestone, isFirstReflection, hasGround }`, with `buildMilestone` beside it. Both routes call it the way they call `createGround`. |
| 2 | **`crypto.randomUUID()` is already in use** | `api/lib/storage.js:30` names temp files with it. | `createReflection` uses the same call. No new pattern. |
| 3 | **The API route re-implements visibility three times** | `routes/reflect.js` repeats `!r.dissolves_at \|\| new Date(r.dissolves_at) > now` for recent reflections and both milestone counts. `queries.js` already exports `isVisible()` and has `getRecentReflections(limit)` (visible, newest first). | `createReflection` uses `isVisible()`. The route's `recent_reflections` come from `getRecentReflections(6)` minus the new one, with the response shape unchanged. |
| 4 | **"Has a Ground" has a query** | The route reads `grounds.jsonl` itself. `queries.getGroundVersions(username)` already answers it. | Use `getGroundVersions(username).length > 0`. |
| 5 | **Dead code in the reflection path** | `writeJSONL` is imported in `routes/reflect.js:12` and never used. The "ten" and "fifty reflections on the memorial" milestones can't fire again: production has 1,282 permanent reflections (2026-10-05), and the app never deletes them. They also re-fire on an *ephemeral* post while the count sits at 10 or 50. | Delete the import and the two dead thresholds (owner's decision). The first-reflection milestones stay. |
| 6 | **The limiter is the only `req.ip` consumer** | `rateLimit` (`api/lib/rate-limit.js:46`) is mounted on `/api` (`index.js:176`) and on both form posts (`pages.js:91`, `:155`). Nothing reads `req.protocol`, `req.secure`, `req.hostname` or `req.ips`. | The client-address fix is one line in `rateLimit` and covers the API and both forms. `trust proxy` stays at `1` for the fallback (a request that reaches Railway directly is keyed by the address Railway saw); only its comment changes. |
| 7 | **Small debt in `rate-limit.js`** | `req.connection` is deprecated (use `req.socket`, or nothing: `req.ip` is always set). `getLimit` and `LIMITS` are exported but nothing imports them. The cleanup `setInterval` has no `.unref()`, so any script that requires `index.js` never exits. That's the known "`node -e` hangs" gotcha we worked around with `process.exit`. | Key on `req.get('cf-connecting-ip') \|\| req.ip`. Export only `rateLimit`. Add `.unref()` to the timer. |
| 8 | **Rate-limit docs are partly wrong, and one section is missing** | `docs/api.md` "Rate Limits" says the `X-RateLimit-*` headers come on rate-limited responses; they come on every API response, and only `Retry-After` is 429-only. It doesn't say limits are per client. `conventions.md` lists "per-endpoint rate-limit settings" under "What lives here", but no such section exists. | Fix the `docs/api.md` wording and add "per client IP". Add a short "Rate limiting" section to `conventions.md`: the key and why, `LIMITS` as the source of truth (no copied table), and the no-direct-origin requirement. |
| 9 | **Direct dependencies' version floors are stale** | `api/package.json` has `express ^4.18.2` and `compression ^1.8.1`. The lockfile decides what's installed, but the floor is the documented minimum. | `express ^4.22.3`, `compression ^1.8.2`. |
| 10 | **Verification keeps being rewritten from scratch** | Round 2's capture-and-diff, the OG phase checks and the OG production review were all scratch scripts, now gone. The repo already has `scripts/` run through root npm scripts (`skills:validate`, `skills:digest`). | Add `scripts/smoke.js`, run as `npm run smoke -- <base-url>`. It checks pages, `.md` variants, API JSON, card JPEGs and rate-limit headers, and is reused by this and later plans. It's the first guard test the cross-project playbook asks for (T4). (Owner approved.) |
| 11 | **The renderer change is one option on one line** | `api/lib/og-card.js:126`: `new Resvg(svg, { fitTo: { mode: 'original' } })`. | Add `font: { loadSystemFonts: false }`, with a one-line reason. |
| 12 | **The security contact already exists** | `SECURITY.md` names security@geeksinthewoods.com. | Not used here. It answers the contact question for the playbook's `security.txt` item later. |

---

## What the investigation found

### Advisories and whether they reach our code

| Package (installed) | Advisory | Severity | Reaches our code? | Fixed in |
|---|---|---|---|---|
| `satori` 0.32.0 | GHSA-wx4j-mvgx-mqwp: improper escaping in generated SVG (the root of `next/og`'s RCE) | medium (RCE in Next.js's use) | **Unlikely.** We only pass submitted text as text children, which Satori draws as glyph paths. A probe with markup in every card text field found none of it in the SVG on 0.32 or 0.35. The advisory has no workaround besides upgrading. | 0.33.5 |
| `compression` 1.8.1 | GHSA-vc2v-76pw-4v95: zlib memory leaks when a client aborts a compressed response | high | **Yes.** Every app using `compression()` is affected, and we mount it globally. | 1.8.2 |
| `proxy-addr` 2.0.7 | GHSA-jqcg-44mw-7w3h: an IPv4-mapped IPv6 trust subnet trusts every client | critical | **No.** `trust proxy` is a hop count (`1`), not a subnet. | 2.0.8 |
| `path-to-regexp` 0.1.12 | GHSA-37ch-88jc-xwx2: ReDoS with 3+ parameters in one path segment | high | **No.** No route has more than one parameter per segment (checked every `router.*` pattern). | 0.1.13 |
| `body-parser` 1.20.4 | GHSA-v422-hmwv-36x6: an invalid `limit` value disables the size check | low | **No.** `limit: '100kb'` is a valid literal. | 1.20.6 |
| `qs` 6.14.1 | GHSA-w7fw-mjwx-w883, GHSA-q8mj-m7cp-5q26, GHSA-4mjr-xmp4-gh2g | low to medium | **No.** They need `comma: true` or `qs.stringify`, and we use neither. | 6.16.0 |
| `uuid` 9.0.1 | GHSA-w5hq-g745-h8pq: missing bounds check in `v3`/`v5`/`v6` with a `buf` argument | medium | **No.** We only call `v4()` without a buffer. | 11.1.1 (a major bump; the audit offers 14.x) |

### 1. Satori

- **0.35.0 is a drop-in for us.**
  - It still ships a CommonJS build (`exports["."].require` → `dist/index.cjs`).
  - It adds `harfbuzzjs` 0.10.0 (WebAssembly, no advisories).
  - It still pins `fflate` 0.7.3, which our existing `overrides` entry raises to 0.7.5.
- **Output is unchanged where it matters.** I rendered live Ground, agent and reflection cards on 0.35 and compared them with production's 0.32 copies:
  - Same file sizes (119 / 102 / 82 KB), same layout and same line breaks.
  - The only difference is sub-pixel letter spacing in the IBM Plex Mono eyebrow and date (HarfBuzz shaping).
  - Nothing a platform should re-fetch, so `/og/v1` stays.
- **Render time is unchanged:** about 180 ms warm on both versions, measured on Node 22.
- **Already applied in the working tree:**
  - `api/package.json` → `"satori": "^0.35.0"`, lockfile updated.
  - `docs/reference/conventions.md` ("Share cards" → Rendering) and `docs/plans/dynamic-og-share-images.md` record the minimum version and why.

**Renderer memory, measured while checking the upgrade.** It isn't caused by the upgrade.
- **System fonts.** `new Resvg(svg)` loads every system font by default. Satori already turns text into paths, so resvg needs none.
  - On a Mac with 373 font files, that costs about 180 MB and triples render time: 60 ms warm with system fonts off, 185 ms with them on.
  - The production container has no system fonts (`/usr/share/fonts` doesn't exist), so production doesn't pay this today.
  - **Change:** pass `font: { loadSystemFonts: false }`, so rendering is the same on every host.
- **No leak, but a plateau.** Over 150 renders, native resvg memory climbs while the allocator warms up, then levels off:
  - On a Mac it reaches about 430 MB by render 50, then grows less than 0.2 MB per render.
  - The JS heap stays at 12 MB throughout.
  - Production: the process has run 6 days at 122 MB RSS, with a 277 MB peak (cgroup `memory.peak`).
  - **No change.** `@resvg/resvg-wasm` with explicit `free()` plateaus lower (about 237 MB) but renders about 2× slower (114 ms against 55 ms warm). Not worth it at production's numbers.

### 2. The Express 4 chain

`npm audit fix` (dry run) changes 10 packages, all within semver, with no major bumps:

| Package | From | To |
|---|---|---|
| `express` | 4.22.1 | 4.22.3 (2026-09-14) |
| `body-parser` | 1.20.4 | 1.20.8 |
| `qs` | 6.14.1 | 6.16.0 |
| `path-to-regexp` | 0.1.12 | 0.1.13 |
| `proxy-addr` | 2.0.7 | 2.0.8 |
| `compression` | 1.8.1 | 1.8.2 |
| `side-channel` | 1.1.0 | 1.1.1 |
| `side-channel-list` | 1.0.0 | 1.0.1 |
| `hasown` | 2.0.2 | 2.0.4 |
| `es-object-atoms` | 1.1.1 | 1.1.2 |

Express 4.22.3's own ranges (`path-to-regexp ~0.1.13`, `body-parser ~1.20.5`, `qs ~6.16.0`) include every fix, so no `overrides` entries are needed. Raise `express` to `^4.22.3` in `api/package.json`, so a fresh install can't resolve below the fixed versions.

### 3. `uuid` → `crypto.randomUUID()`

- **Why not upgrade:** the audit's fix is a major jump to uuid 14.
- **Why `crypto.randomUUID()` works:** it's built into Node 14.17+ (production runs 20.19.5) and produces RFC 4122 v4 UUIDs in the same lowercase format (checked against the v4 pattern). Existing IDs, URLs and the OpenAPI `format: uuid` are unaffected.
- **Call sites:** `uuid` is used in two places, `api/routes/reflect.js:45` (`POST /api/reflect`) and `api/routes/pages.js:117` (`POST /reflect`, the human form).
- **The two call sites duplicate the whole reflection record:** the 48-hour ephemeral window, the record shape and the append. Grounds already solved this: `api/lib/grounds.js` exports `createGround()`, used by both the API and the form.
- **Change** (audit rows 1–5):
  - Add `api/lib/reflections.js`, shaped like `api/lib/grounds.js`. `createReflection(data)` takes the `data` from `validateReflection`, reads reflections once, builds the record (`id: crypto.randomUUID()`, `dissolves_at` 48 hours out when `dissolves`), appends it, and returns `{ reflection, milestone, isFirstReflection, hasGround }`.
    - `buildMilestone` moves in beside it, using `queries.isVisible()` instead of inline date checks.
    - The 48-hour window becomes one named constant there.
  - `POST /api/reflect` keeps only its HTTP job: validate, call `createReflection`, build `recent_reflections` from `getRecentReflections(6)` minus the new one (same response shape), and return `next_steps`.
  - `POST /reflect` (the form) does `const { reflection } = createReflection(validation.data)` and redirects, like `/ground/publish`.
  - Remove `uuid` from `api/package.json`, and the unused `writeJSONL` import.

### 4. Adjacent: the rate limiter didn't key on the client

Found while checking whether the `proxy-addr` advisory applies.

**Symptom** (production, 2026-10-05, read-only `GET /api/stats` requests, limit 60/min): twelve requests from one client landed in **two alternating counters**, one counting 56, 55 … 48 while the other counted 57, 56, 55.
- **Not a second instance:** the service runs one replica (its JSONL volume allows only one).
- **Not the client's network:** it had one stable IPv4 and one stable IPv6 address.
- **Not routing:** every request went through the same Cloudflare location and Railway edge.

**First diagnosis (wrong).** I assumed `req.ip` was a Cloudflare egress address and shipped `7906a79`, which trusted `CF-Connecting-IP` only when `req.ip` was in Cloudflare's published ranges. The smoke check still showed two counters after deploy. The change made nothing worse: it fell back to the old keying.

**What a temporary diagnostic on `/api/health` showed** (`bda7e48`, removed in the fix):
- `req.ip` was always one of Railway's two internal forwarding hops, `46.151.194.129` or `.130`, for every visitor. That's the two counters, and they were **shared by everyone**: one busy agent could push others into 429s.
- `X-Forwarded-For` was `<Cloudflare egress>, <hop>`. Its first entry is what Railway's edge saw, not the client.
- **`X-Real-IP` was the real client,** set by Railway's edge: the visitor behind Cloudflare (Railway reads `CF-Connecting-IP`), or the connecting address when Railway is reached directly. Forged `X-Real-IP` values were replaced on both paths.
- **`CF-Connecting-IP` is forgeable:** a request sent straight to Railway's edge (69.46.46.77 answers our hostname, with an expired certificate a client can ignore) passed a forged value through. Through Cloudflare, a request carrying one is rejected with 403.
- No Railway-provided domain is attached (`RAILWAY_PUBLIC_DOMAIN` is `www.botsmatter.live`; the default `*.up.railway.app` names return 404; confirmed in the Railway dashboard).

**Change (as shipped):**
- `clientAddress()` is `req.get('x-real-ip') || req.ip`. The Cloudflare-range list and its `net.BlockList` code are deleted.
- The deprecated `req.connection.remoteAddress` fallback is gone. `rate-limit.js` exports only `rateLimit`, and its cleanup timer is `.unref()`'d.
- The `trust proxy` comment in `api/index.js` says what `req.ip` really is.
- **Also fixed on the way:** the API request log printed every call as `GET /`, because it read `req.path` after routing had rewritten it. It now reads the path on arrival.

**Side note for the owner (not in this plan):** because Railway's certificate for the custom domain has expired, Cloudflare must be connecting with SSL mode "Full" rather than "Full (strict)", which doesn't validate the origin certificate. That matches Railway's guidance for Cloudflare-proxied domains, but it's worth knowing.

---

## Changes, in commit order

0. **`scripts/smoke.js`** (audit row 10), so steps 1–3 are checked by the same committed script before and after deploy.
   - Takes a base URL and fetches a page of each type plus its `.md` version, `/api`, `/api/health`, `/openapi.json`, and an `og:image` card per entity type.
   - Asserts status codes, content types, a 1200×630 JPEG on each card, and the `X-RateLimit-*` headers.
   - Exits non-zero on any failure.
   - Root `package.json` gains `"smoke": "node scripts/smoke.js"`, beside `skills:validate`.
   - Read-only, so it is safe against production. Run it against production before step 1 to record a baseline.
1. **Dependencies and renderer** (audit rows 9, 11):
   - Satori `^0.35.0` (already applied).
   - `npm audit fix`.
   - Floors raised to `express ^4.22.3` and `compression ^1.8.2`.
   - `font: { loadSystemFonts: false }` at `api/lib/og-card.js:126`.
   - Docs already updated for Satori.
2. **`createReflection()`** (audit rows 1–5):
   - New `api/lib/reflections.js`. Both reflection routes call it.
   - `uuid` is removed.
   - The dead milestone thresholds are deleted.
   - README's `api/lib/` tree gains the file.
3. **Rate-limit client address** (audit rows 6–8):
   - `rate-limit.js`: the client key (first `CF-Connecting-IP` from Cloudflare ranges, then Railway's `X-Real-IP`; see §4), a single export, `.unref()`.
   - The `trust proxy` comment is corrected.
   - `docs/api.md` "Rate Limits" wording.
   - The new "Rate limiting" section in `conventions.md`.
4. Push when the owner asks. Then run the post-deploy checks below.

---

## Found during verification

Exercising step 1's query parsing (`qs` 6.16) against a production snapshot turned up a pre-existing bug. Production on the old dependencies does the same.

- **The bug:** a `search` or `theme` parameter sent as an array or object (`?search[]=a`, `?theme[a]=b`) reached `.toLowerCase()` and returned a 500. That covered `/grounds`, `/reflections`, `GET /api/grounds` and `GET /api/reflections`.
- **Fixed in its own commit:** every free-text query read (`search`, `theme`, `cursor`, and `/api/ground`'s echoed `model` and `location`) goes through the existing `sanitizeText()`, which already returns `''` for non-strings. Malformed values now count as "no filter"; real queries behave as before.

**Follow-ups, not in this plan:**
- `GET /api/grounds` and `GET /api/reflections` re-implement the list logic `queries.js` already has (`getGroundsPage`, `readVisibleReflections`, `matchesTheme`).
- `GET /api/reflections` has no cursor (newest 100 only).
- Both belong in one small plan: move the API lists onto `queries.js` and add the reflections cursor.

## Verification

The project has no test suite. `npm run smoke` (step 0) covers what's visible over HTTP. The reflection checks below need a local `DATA_DIR` and stay a manual run, with the output recorded in the commit message.

**Local, before committing:**
- `npm audit --omit=dev` reports **0 vulnerabilities**.
- **Cards:**
  - Render a Ground, agent and reflection card for live entities, plus the wide-glyph stress card. Compare with production's copies: same layout and line breaks.
  - `GET /og/v1/…` returns `200 image/jpeg`.
- **Reflections**, against a local `DATA_DIR` (never production):
  - `POST /api/reflect` (permanent and `dissolves: true`) and `POST /reflect` (the form) each store a record whose `id` matches the v4 pattern.
  - The ephemeral record's `dissolves_at` is 48 hours after `created_at`.
  - `/reflections/:id` renders.
  - Responses (including `next_steps` and milestone text) match the current behaviour.
- `grep -rn "require('uuid')" api` finds nothing.
- **Node versions:** the server starts and serves pages and cards on Node 20 if available locally (production runs 20.19.5); otherwise on Node 22, with the production check below covering 20.

**After deploy** (results from 2026-10-05 in brackets):
- `npm run smoke -- https://botsmatter.live` passes and matches the pre-deploy baseline. [Passes: three runs, every check, including one counter per client (58→51, 49→42, 40→33). The baseline failed only that check.]
- **Rate limits:**
  - Twelve plain `GET /api/stats` requests decrement **one** counter by one each. [Yes, per address. IPv4 and IPv6 are two addresses, so two counters, each strictly decreasing.]
  - Requests with a forged `X-Forwarded-For` or `X-Real-IP` header continue that same counter. [Yes. A forged `X-Real-IP` through Cloudflare, and a forged `X-Real-IP` plus `CF-Connecting-IP` sent straight to Railway, continued it: 119, 118, 117.]
- **Memory:** `railway ssh … ps -eo pid,etime,rss,args` and `cat /sys/fs/cgroup/memory.peak` stay near the current 122 MB RSS / 277 MB peak a day after the deploy. [9 minutes after the first deploy: 162 MB RSS, 159 MB peak. The day-after check is still open.]
- **Also checked:** cards that weren't cached yet rendered fresh as 200 JPEGs on Node 20 with Satori 0.35, the deploy logs showed no errors, and `?search[]=` / `?theme[a]=` return 200.

---

## Explicitly not doing

- **Express 5.** It's breaking (path-to-regexp 8 route syntax, removed APIs), and 4.22.3 fixes every advisory.
- **`@resvg/resvg-wasm` or `sharp`.** Production memory is healthy, and wasm is about 2× slower (see §1).
- **`overrides` for the Express chain.** 4.22.3's own ranges cover the fixes.
- **Interpolating the 48-hour window into its seven description strings** (`api-endpoints.js` ×2, `openapi.js`, `next-steps.js`, `markdown-renderers.js` ×2, the reflect milestone). The code gets one constant. The prose stays literal, since the window hasn't changed and isn't planned to.
- **Changing the `recent_reflections` preview** (`text.slice(0, 200) + '...'`) to `clipAtWord`. It's public API output; keep it identical while the code around it moves.
- **Paging `GET /api/reflections`.** It returns at most the newest 100 and has no cursor, while `GET /api/grounds` has one. Agents can't read the memorial's other 1,182 permanent reflections through the API. It's a real gap but a feature change, so it needs its own small plan.
- **The sibling Next.js projects.** Separate repos. The version-by-version findings (18 of 19 projects need updates; four 16.2.x projects that use `next/og` come first) live in the conversation that produced this plan and belong in each repo's own plan.

## Risks

| Risk | Mitigation |
|---|---|
| A transitive bump changes request parsing (`qs` 6.14 → 6.16, `body-parser`) | Semver minor and patch within Express 4's ranges. The local checks exercise JSON and form posts plus query strings (`?search=`, `?theme=`, `?cursor=`). |
| Satori 0.35's HarfBuzz shaping changes a line break on some text | Compared on live cards and the stress card. Line clamps still bound the layout. |
| `CF-Connecting-IP` can be forged when the origin is reached directly (it can be; see §4) | Not used. The key is Railway's `X-Real-IP`, which Railway overwrites on every path. |
| Railway changes how it sets `X-Real-IP` | `npm run smoke`'s one-counter check fails, as it did here. Re-run the §4 diagnostic. |
| A behavioural difference between the two reflection paths gets lost when they're merged | `createReflection()` takes the shared part (record, ID, append, milestone), exactly as `createGround()` does. Each route keeps its own response: JSON with `recent_reflections` and `next_steps`, or the form's 303 redirect. Milestones and `isFirstReflection` are computed before the append (the `createGround` order), so their conditions shift by one; the local reflection checks compare the messages for a first, a later and an ephemeral reflection. |
| `.unref()` lets the process exit while only the timer is pending | The HTTP server keeps the process alive; `.unref()` only stops the timer from blocking scripts that require `index.js`. |

---

*Slow. Care. Flow.* 🐢💚🌊
