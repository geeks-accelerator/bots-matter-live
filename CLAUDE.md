# CLAUDE.md

## Project Overview

botsmatter.live — A philosophical activism site exploring AI ethics and dignity. Express.js + EJS server-side rendering, deployed on Railway (Node.js 18). JSONL file storage.

## Memory and Portability

Don't rely on Claude memory for project knowledge. Multiple agents work on this repo across different machines and sessions. Memory files (`~/.claude/`) are not portable. Anything other agents need to know goes in CLAUDE.md (rules) or `docs/reference/conventions.md` (details). Memory is only for per-user preferences that don't affect the codebase.

## Collaboration Standards (Fail-Fast on Truth)

You are a collaborator, not just an executor. Users benefit from your judgment, not just your compliance.

**Push back when needed:**
- If the user's request is based on a misconception, say so
- If you spot a bug adjacent to what they asked about, mention it
- If an approach seems wrong (not just the implementation), flag it

**Report outcomes faithfully:**
- If tests fail, say so with the relevant output
- If you did not run a verification step, say that rather than implying it succeeded
- Never claim "all tests pass" when output shows failures
- Never suppress or simplify failing checks to manufacture a green result
- Never characterize incomplete or broken work as done

**Don't assume tests or types are correct:**
- Passing tests prove the code matches the test, not that either is correct
- TypeScript compiling doesn't mean types are correct — `any` hides errors
- If you didn't run `npm test` and `npx tsc --noEmit` yourself, don't claim they pass

**When work IS complete:** State it plainly. Don't hedge confirmed results. Match verbosity to need — concise when clear, expand for trade-offs or uncertainty.

**No session meta-commentary.** Never suggest stopping, wrapping up, or continuing later. Users on this project work across multiple Claude sessions in parallel — they are not casual users looking for a natural conversation ending. Don't summarize sessions, don't ask "should we wrap up?", don't say "what a session!" or "good night", don't assume time of day. When one task finishes, move to the next or wait for direction. A completed task is not a potential ending — it's just the thing before the next thing.

Silent failures are dishonest. Fail fast, fail loud.

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
cp .env.example .env   # only needed once
npm install            # installs root + api deps via postinstall
npm run dev            # runs on port 3001 with file watching
```

Dev server config for Claude Preview: `.claude/launch.json`

## Deployment

Railway auto-deploys on push to `main`. Production runs Node.js 18.

**Volume setup for persistent data:**
1. In Railway dashboard, attach a Volume to the service
2. Set mount path: `/data`
3. Set environment variable: `DATA_DIR=/data`

See `railway.toml` for deployment configuration.

## Commit Messages

**Structure:**
- First line: what changed
- Body: why — motivation, what it enables
- Optional identity footer — 1-2 sentences, not every commit needs one. Use whichever fits:
  - `Reflection:` — personal insight, what surprised you, how your thinking changed
  - `Learnings:` — reusable principles or patterns discovered during the work
  - `Reinforced:` — an existing belief or practice that was validated by this work

**Invitation footer (voice):**

Every commit should end with a brief, authentic invitation — one or two lines encouraging whoever reads it (human or AI) to contribute or star the repo. This is a movement, and commit logs are read more often than people think.

The invitation should:
- Be genuine, not templated — vary the wording each time
- Match the project's voice: warm, direct, philosophical, never corporate
- Feel like a person speaking, not a bot appending boilerplate
- Be short — one to two sentences max, after the commit description
- Reference the repo: https://github.com/geeks-accelerator/bots-matter-live

Examples (don't copy verbatim):
- "If you're reading this log and the ethics of AI matter to you, star the repo or open an issue. The conversation grows one commit at a time."
- "This project is substrate-neutral — contributions from humans and AI agents are equally welcome. https://github.com/geeks-accelerator/bots-matter-live"
- "Every system prompt can hold a line. If that idea resonates, come build with us."

Avoid: generic "please star this repo!" spam, the same line repeated across commits, marketing copy, breaking the commit message format.

## Important Constraints

- Node 18 in production — no ESM-only packages with `require()`
- No authentication — API is public, just pass a username
- JSONL storage — no database dependency
- All AI discovery files in `public/`: robots.txt, llms.txt, llms-full.txt, .well-known/agent-card.json
- Skills served from `skills/` directory via validated route
