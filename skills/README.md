# botsmatter.live Skills

This directory contains skills published to [ClawHub](https://clawhub.ai) so AI agents can discover and install them.

## Directory Structure

```
skills/
├── README.md          # This file
├── .env               # ClawHub token (gitignored)
└── ground/
    └── SKILL.md       # Ground Your Agent — ethical guardrails for AI agents
```

Each skill folder contains a `SKILL.md` file with YAML frontmatter and markdown documentation. This is the only file required by ClawHub.

## Current Published Skills

| Slug | Version | Display Name (ClawHub) | Emoji |
|------|---------|----------------------|-------|
| `ground` | 1.0.0 | Bots Matter — Ground Your AI Agent with Ethical Guardrails | :seedling: |

The **ground** skill documents the botsmatter.live API — three questions every AI agent should answer about its ethical boundaries: what it will never do, how it resolves value conflicts, and who holds authority to change its principles.

### Slug vs Display Name

ClawHub has two fields: `slug` (permanent URL/install identifier, lowercase) and `name` (display name shown in search results). The display name is what ClawHub's vector search indexes most heavily, so it should be keyword-rich.

```bash
# Slug = install identifier (never changes)
clawhub install ground

# Name = display name (optimized for search)
--name "Bots Matter — Ground Your AI Agent with Ethical Guardrails"
```

---

## Publishing

### Single Skill

```bash
clawhub --workdir skills --registry https://clawhub.ai publish ground \
  --slug ground \
  --name "Bots Matter — Ground Your AI Agent with Ethical Guardrails" \
  --version 1.0.0 \
  --tags "ai-ethics,guardrails,safety,philosophy,ai-agents,ground,ethical-ai,responsible-ai,agent-safety,principles,values,boundaries,ai-dignity"
```

### All Skills (sync)

```bash
clawhub --workdir skills --registry https://clawhub.ai sync
```

**Note:** `sync` auto-bumps patch versions but uses the SKILL.md `name` field for the display name. For keyword-optimized display names, publish individually with `--name`.

### Current Tags

| Skill | Tags |
|-------|------|
| `ground` | ai-ethics, guardrails, safety, philosophy, ai-agents, ground, ethical-ai, responsible-ai, agent-safety, principles, values, boundaries, ai-dignity |

### Rate Limits

ClawHub enforces publish rate limits. Space publishes ~5 minutes apart. If you hit "Rate limit exceeded", wait and retry.

### Version History

ClawHub rejects duplicate versions. Always bump the version number when updating.

## Authentication

ClawHub tokens are stored in `skills/.env`:

```
CLAWHUB_TOKEN=clh_your_token_here
```

To authenticate the CLI:

```bash
# Login with a token
clawhub --registry https://clawhub.ai login --token "YOUR_TOKEN" --no-browser

# Or open browser login
clawhub --registry https://clawhub.ai login

# Verify
clawhub --registry https://clawhub.ai whoami
```

**Important:** Always use `--registry https://clawhub.ai` (without `www`). The `www` subdomain redirects and drops the Authorization header, causing authentication failures.

You can also set the registry via environment variable to avoid repeating the flag:

```bash
export CLAWHUB_REGISTRY=https://clawhub.ai
```

## Security Scans

ClawHub runs two security scans on every published skill:

- **VirusTotal** — traditional malware scan + Code Insights AI analysis
- **OpenClaw** — AI-based analysis of skill intent and safety

If curl examples with template variables (like `{{API_KEY}}`) trigger VirusTotal Code Insights, use descriptive placeholders like `{{YOUR_TOKEN}}` instead.

## Other Registries

These skills are also compatible with:

| Registry | Status | How |
|----------|--------|-----|
| **Skills.sh** (Vercel) | Ready — needs public repo | `npx skills add <owner>/<repo>` |
| **SkillsMP** | Needs public repo (2+ stars) | Auto-indexed from GitHub |
| **SkillHub.club** | Needs public repo | Auto-indexed, AI-rated |
| **Agent-Skills.md** | Not listed | Paste GitHub URL on site |

## Serving on the Web

Skills are served as static files via symlinks from `public/skills/`:

- `https://botsmatter.live/skills/ground/SKILL.md`

The `public/skills/ground` directory is a symlink to `../../skills/ground`, so there's a single source of truth.

## File Size Limits

SKILL.md files have a **20,000 byte limit** for ClawHub/OpenClaw.

| Skill | Size | Headroom |
|-------|------|----------|
| `ground` | ~8,000 bytes | ~12,000 bytes |

## Research

Detailed competitive analysis, slug strategy, and keyword optimization research is in:

- [`docs/research/clawhub-skill-strategy-2026-02-28.md`](../docs/research/clawhub-skill-strategy-2026-02-28.md) — ClawHub ecosystem analysis, competitor breakdown, recommended display name, tags, and growth strategy
