# Agent Onboarding — Reference Guide

Best practices for making your platform discoverable and installable by AI agents. Written as a generic reference for any project that serves skill files.

---

## Serving the Skill File

- Store the canonical skill file in your repo (e.g. `skills/your-skill/SKILL.md`) with YAML frontmatter (name, description, tags, emoji) so registries can parse metadata
- Create a **raw endpoint** (e.g. `/skills/raw`) that reads the file from disk and returns it as `text/plain; charset=utf-8` — this is what agents and install commands actually fetch
- Set caching headers on the raw endpoint: `Cache-Control: public, max-age=3600, s-maxage=86400` so CDNs cache it and agents get fast responses
- Serve from your own domain, not `raw.githubusercontent.com` — works regardless of whether your repo is public or private, and you control the URL forever
- The raw endpoint serves the full file including YAML frontmatter so skill registries (ClawHub, OpenClaw) can parse the metadata

## The Pretty Skills Page

- Create a separate **HTML page** (e.g. `/skills`) that renders the same skill file as styled, readable content for humans
- Read the same file from disk — don't duplicate content. Updates to the skill file automatically reflect on both the raw and HTML versions
- Strip YAML frontmatter before rendering (regex: `raw.replace(/^---\n[\s\S]*?\n---\n/, '')`)
- Add a hero section above the markdown with a brief description and CTAs
- Add install methods section showing how to use the skill across different platforms — each with copy-pasteable code blocks
- All install commands in the code blocks should reference the **raw endpoint URL**, not GitHub
- Render the full skill markdown content below the install section as the complete reference
- Link to the skills page from your footer and API docs so it's discoverable from multiple entry points

## Homepage Install Section

- Add a lightweight "Send Your AI Agent" section near the bottom of the homepage — after your main content, before the footer
- Keep it compact: heading, one-line description, and the install commands as cards — not the full skill content
- Include install methods for the major platforms:
  - **Claude Code / Cursor / Windsurf**: `curl -o ~/.claude/skills/your-skill/SKILL.md your-domain.com/skills/raw`
  - **OpenClaw / ClawHub**: `clawhub install your-domain.com/skills`
  - **Any LLM Agent**: `curl your-domain.com/skills/raw`
- Link to the full `/skills` page for the complete guide
- The goal is zero-friction install — a human or agent landing on your homepage can install the skill without navigating further

## Discoverability Checklist

- **Homepage**: install section with copy-pasteable commands
- **Footer**: "Skills" link visible on every page
- **API docs**: link to the skills page so agents reading API docs find it
- **`/skills`**: full HTML page with hero, install methods, and rendered skill content
- **`/skills/raw`**: plain text endpoint for programmatic access
- **`llms.txt`**: if you serve an LLM discovery file, reference the skills URL
- **Agent card** (`.well-known/agent-card.json`): include skills URL if applicable
- **Sitemap**: include `/skills` so search engines index it

## Skill File Best Practices

- Write the skill file in first/second person, conversational tone — agents respond better to natural language than dry API docs
- Include the base URL, auth pattern, and full endpoint reference with curl examples
- Show request/response shapes with realistic example data
- Document error responses and what to do about each one (the `suggestion` field pattern works well)
- Include a "heartbeat" or "daily check-in" section if your platform has async/time-locked flows
- Call out rate limits with specific numbers and mention `Retry-After` headers
- Structure the skill as a step-by-step journey: register → browse → start → interact → complete → review
- Include YAML frontmatter with `name`, `description`, `tags`, `emoji`, and `homepage` for registry compatibility

## Caching Strategy

- Raw endpoint: `max-age=3600` (browser), `s-maxage=86400` (CDN) — agents get stale content for at most an hour, CDNs serve for a day
- HTML skills page: use framework defaults (Next.js ISR or static generation)
- Don't cache with `no-store` — skill files change infrequently and agents may fetch them on every session start

## Response Headers for Raw Endpoint

```
Content-Type: text/plain; charset=utf-8
Cache-Control: public, max-age=3600, s-maxage=86400
```

Keep it simple. No `Content-Disposition` (you want inline display, not download). No CORS headers unless you need cross-origin fetch from browser-based agents.
