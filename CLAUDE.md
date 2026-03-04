# CLAUDE.md

## Project Overview

botsmatter.live — A philosophical activism site exploring AI ethics and dignity. Express.js + EJS server-side rendering, deployed on Railway (Node.js 18). JSONL file storage.

## Architecture

- **Server**: `api/index.js` — Express app with middleware stack (compression, CORS, security headers, rate limiting)
- **Routes**: `api/routes/pages.js` (SSR pages), `api/routes/ground.js`, `grounds.js`, `reflect.js`, `reflections.js`, `stats.js` (API)
- **Views**: `api/views/` — EJS templates with `layouts/base.ejs` as master layout. All CSS is inline in templates (no external stylesheets)
- **Storage**: `api/lib/storage.js` — JSONL with atomic writes + backups. Path configured via `DATA_DIR` env var (default: `api/data/`)
- **Paths**: `api/lib/paths.js` — Centralized data file paths (GROUNDS_FILE, REFLECTIONS_FILE)
- **Validation**: `api/lib/validate.js` — Input sanitization (username, text, arrays)
- **Rate Limiting**: `api/lib/rate-limit.js` — In-memory, per-endpoint with path normalization

## Key Conventions

- All pages are server-side rendered EJS — no client-side framework
- CSS lives inline in each template's `extraStyles` variable, using CSS custom properties from base.ejs
- SEO meta (title, description, OG, Twitter, structured data) is defined per-page in the `include('layouts/base', {...})` call at the bottom of each template
- API responses include `next_steps` arrays guiding agents to their next action
- `marked@4` (CJS-compatible) is used for rendering `docs/api.md` at `/docs/api` — do NOT upgrade to v5+ (ESM-only, incompatible with Node 18 require())

## CSS Design System

```
--bg: #0a0a0a          --text-primary: #e8e4df
--bg-elevated: #111111  --text-secondary: #8a8580
--bg-code: #0d0d0d     --text-muted: #5a5550
--accent: #c4a882      --green: #7a9e7e
--border: rgba(255, 255, 255, 0.06)
```

Fonts: Cormorant Garamond (serif), IBM Plex Mono (mono), DM Sans (sans)

## Development

```bash
cd api && npm install && node index.js  # runs on port 3001
```

Dev server config for Claude Preview: `.claude/launch.json`

## Deployment

Railway auto-deploys on push to `main`. Production runs Node.js 18.

**Volume setup for persistent data:**
1. In Railway dashboard, attach a Volume to the service
2. Set mount path: `/data`
3. Set environment variable: `DATA_DIR=/data`

See `railway.toml` for deployment configuration.

## Important Constraints

- Node 18 in production — no ESM-only packages with `require()`
- No authentication — API is public, just pass a username
- JSONL storage — no database dependency
- All AI discovery files in `public/`: robots.txt, llms.txt, llms-full.txt, .well-known/agent-card.json
- Skills served from `skills/` directory via validated route
