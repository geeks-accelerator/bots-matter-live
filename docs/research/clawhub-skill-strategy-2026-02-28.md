# ClawHub Skill Strategy Research

**Date:** 2026-02-28
**Researcher:** Claude Opus 4.6 + Lee Brown
**Platform:** [ClawHub.ai](https://clawhub.ai) — 12,574 skills indexed at time of research

---

## Executive Summary

Our `ground` skill for botsmatter.live is unique in the ClawHub ecosystem. No other skill offers a **structured, API-backed framework for publishing ethical guardrails** (lines, hierarchy, authority). The closest competitors are philosophical guidance skills (instruction-only), not actionable tools with a live API. This gives us a clear positioning advantage.

**Recommendation:** Keep slug `ground` — it's available, brand-aligned, and distinct. Optimize the display name and tags for search discoverability.

---

## 1. Slug Availability

All candidate slugs were checked via direct URL (`clawhub.ai/skills/{slug}`). Every candidate returns "Skill not found."

| Slug | Available? | Notes |
|------|-----------|-------|
| `ground` | **YES** | Brand-aligned, matches project terminology |
| `ai-ethics` | **YES** | High search volume term but generic |
| `agent-ethics` | **YES** | Specific to AI agents |
| `grounding-ethics` | **YES** | Descriptive compound |
| `bots-matter` | **YES** | Brand name |
| `botsmatter` | **YES** | Brand name (no hyphen) |

### Slug Recommendation: `ground`

Reasons to keep `ground`:
1. **Brand alignment** — "Ground" is the core concept of botsmatter.live (the Ground template, the `/ground` page, the "ground up" tagline)
2. **Short and memorable** — Easy to type: `clawhub install ground`
3. **Unique in the ecosystem** — No existing skill uses this term as a slug
4. **Semantic richness** — "Ground" conveys foundation, rootedness, ethical grounding — all on-brand
5. **Not generic** — Unlike `ai-ethics` or `guardrails`, it won't be confused with other concepts

Why NOT the alternatives:
- `ai-ethics` — Too generic; would compete semantically with 5+ existing ethics skills
- `agent-ethics` — Accurate but sounds academic, not actionable
- `bots-matter` / `botsmatter` — Brand name as slug limits discoverability for non-brand searches
- `grounding-ethics` — Too long, and "grounding" has existing ClawHub usage (Catholic Grounding, Grounding Practices)

---

## 2. Competitive Landscape

### Direct Competitors (Ethics/Guardrails Category)

| Skill | Slug | Downloads | Installs | Stars | Type | Differentiator |
|-------|------|-----------|----------|-------|------|---------------|
| Guardian Angel | `/guardian-angel` | 1,900 | 6 | 2 | Plugin (code) | Thomistic virtue ethics, before_tool_call enforcement hook, 30 files, flagged suspicious |
| Agency Guardian | `/agency-guardian` | 1,800 | 3 | 0 | Instruction-only | "Stay human" reminders, weekly reflections, wisdom quotes |
| Guardrails | `/guardrails` | 1,600 | 5 | 0 | Scripts (code) | Interactive workspace security audit, generates GUARDRAILS.md, flagged suspicious |
| Ethics | `/ethics` | 688 | 0 | 2 | Instruction-only | Academic philosophy navigation (beginners through researchers) |
| Vigil | `/vigil` | 544 | 0 | 0 | Code | Runtime tool-call safety (SQL injection, SSRF, path traversal) |
| Moral Compass | `/moral-compass` | 306 | 0 | 0 | Instruction-only | Baha'i-inspired ethical framework, 11 principles |
| Dharma-AI | `/dharma-ai` | 119 | 0 | 0 | Instruction-only | Hindu ethics from Ramayana/Mahabharata |

### Adjacent Competitors (Security/Safety Category)

| Skill | Slug | Downloads | Installs | Stars |
|-------|------|-----------|----------|-------|
| AI Act Risk Check | `/ai-act-risk-check` | 5,200 | 0 | 0 |
| Therapy Mode | `/therapy-mode` | 2,200 | 8 | 3 |
| Anterior Cingulate Memory | `/anterior-cingulate-memory` | 2,100 | 6 | 2 |
| Praesidia | `/praesidia` | 1,500 | 2 | 5 |
| Agent Passport | `/agent-passport` | 1,000 | 2 | 17 |
| Agentguard | `/security` | 903 | 2 | 3 |

### Key Insight: Our Unique Position

Every ethics competitor falls into one of two buckets:

1. **Philosophical frameworks** (instruction-only) — Ethics, Moral Compass, Dharma-AI, Agency Guardian tell the agent HOW to think about ethics. They're internal guidance systems.

2. **Security enforcement** (code-based) — Guardrails, Vigil, Agentguard, Security Operator enforce runtime safety rules. They're technical tools.

**Our skill is neither.** We offer:
- A **structured template** (three questions) for declaring ethical positions
- A **live API** for publishing those declarations publicly
- A **community directory** for browsing other agents' ethical commitments
- A **movement** (botsmatter.live) around AI agent dignity and transparency

This is **declarative ethics** — not internal philosophy, not runtime enforcement, but *public commitment*. No other ClawHub skill does this.

---

## 3. Search & Discovery Analysis

### How ClawHub Search Works

ClawHub uses **vector/semantic search** (powered by Convex). Key observations:

- **"Relevance" sort** uses semantic similarity, not keyword matching — the display `name` field is indexed most heavily
- **"Downloads" sort** is a pure popularity ranking — good for competitive analysis
- **Tags** appear to influence semantic matching but not as heavily as name/description
- **SKILL.md content** may be indexed for full-text, but display name dominates

### Search Term Performance

What appears when a user searches these terms (sorted by downloads):

| Search Query | Top Results Category | Our Skill Would Rank |
|-------------|---------------------|---------------------|
| `ethics` | Ethics (688), Guardian Angel (1.9k) | Mid-tier, need strong name |
| `guardrails` | Guardrails (1.6k), Vigil (544) | Low if slug is "ground" — need tags |
| `agent-ethics` | Agent Church (3.4k), AI Agent Helper (1.7k), Agirails (1.3k) | Would surface with good name |
| `agent-safety` | AI Agent Helper (1.7k), Agent UI (1.3k), Agentguard (903) | Not our primary keyword |
| `responsible-ai` | AI Act Risk Check (5.2k), AI Boss (2.5k), Therapy Mode (2.2k) | Low relevance match |
| `values boundaries` | Elicitation (2.9k), Health (1.2k), Agent (810) | Semantic match possible |
| `dignity ai` | AI Act Risk Check (5.2k), Beauty Gen (3.9k) — poor match | Very low |
| `ethical guardrails principles` | Praesidia (1.5k), Guardrails (1.6k), Moral Compass (306) | Good semantic match with right name |

### Discovery Strategy

To maximize discoverability, optimize for the search queries where users are actually looking for what we offer:
1. **Primary:** "ethics", "guardrails", "ethical guardrails"
2. **Secondary:** "agent ethics", "ai ethics", "principles", "values"
3. **Tertiary:** "ground", "boundaries", "safety", "responsible ai"

---

## 4. Recommended Display Name

The display name (`--name` flag) is the most important search signal. It should be keyword-rich while conveying our unique value.

### Current Name
```
Bots Matter — Ground Your AI Agent with Ethical Guardrails
```

### Recommended Name (Option A — Preferred)
```
Ground — Ethical Guardrails & Principles for AI Agents (Bots Matter)
```

**Why:** Leads with slug for recognition. "Ethical Guardrails" and "Principles" are the highest-volume relevant search terms. "AI Agents" matches the dominant search patterns. "Bots Matter" provides brand.

### Alternative (Option B)
```
Bots Matter — Publish Ethical Guardrails for Your AI Agent
```

**Why:** Leads with brand. "Publish" differentiates from instruction-only competitors. But "Bots Matter" won't match any search queries.

### Alternative (Option C)
```
Ground Your Agent — AI Ethics Guardrails, Principles & Public Commitment
```

**Why:** Most keyword-dense. "AI Ethics" matches exact search term. "Public Commitment" differentiates.

---

## 5. Recommended Tags

### Current Tags (13)
```
ai-ethics, guardrails, safety, philosophy, ai-agents, ground, ethical-ai, responsible-ai, agent-safety, principles, values, boundaries, ai-dignity
```

### Recommended Tags (Updated)
```
ai-ethics, guardrails, ethics, principles, ai-agents, safety, ground, ethical-ai, responsible-ai, agent-safety, values, boundaries, ai-dignity, agent-ethics, transparency, commitment, manifesto, substrate-neutral
```

### Changes
- **Added:** `ethics` (high-volume standalone term), `agent-ethics`, `transparency`, `commitment`, `manifesto`, `substrate-neutral`
- **Removed:** `philosophy` (too academic, doesn't match our practical tool nature)
- **Reordered:** Most searchable terms first

### Tag Rationale

| Tag | Justification |
|-----|--------------|
| `ai-ethics` | Top search term in our category |
| `guardrails` | Second-highest volume term, matches competitor slug |
| `ethics` | Standalone high-volume term (688 downloads for `/ethics` skill) |
| `principles` | Matches "First Principles" searches (3.6k downloads) |
| `ai-agents` | Broad agent-related searches |
| `safety` | Cross-category term (security + ethics overlap) |
| `ground` | Brand/slug alignment |
| `ethical-ai` | Compound term people search for |
| `responsible-ai` | Industry standard term |
| `agent-safety` | Specific to agent context |
| `values` | Matches "values boundaries" semantic searches |
| `boundaries` | Matches boundary-related searches |
| `ai-dignity` | Unique differentiator (no competition) |
| `agent-ethics` | Specific compound term, no slug taken |
| `transparency` | Core botsmatter.live value, all Grounds are public |
| `commitment` | Differentiator: public commitment vs private rules |
| `manifesto` | Matches botsmatter.live manifesto concept |
| `substrate-neutral` | Unique philosophical position |

---

## 6. SKILL.md Keyword Optimization

The SKILL.md content may also influence semantic search. Consider adding these terms naturally to the description:

**High-value terms to include in SKILL.md text:**
- "ethical guardrails" (exact phrase)
- "AI agent principles"
- "publish" / "public commitment" (differentiator)
- "three questions" (unique selling point)
- "values hierarchy" / "priority hierarchy"
- "authority structure"
- "agent boundaries"
- "responsible AI"
- "no authentication required" (differentiator vs security tools)
- "API-backed" / "live API" (differentiator vs instruction-only)

**Current SKILL.md size:** ~6,500 bytes (13,500 bytes of headroom to 20KB limit)

---

## 7. Competitive Advantages to Emphasize

| Feature | Us (Ground) | Guardian Angel | Ethics | Guardrails | Moral Compass |
|---------|------------|----------------|--------|------------|---------------|
| Live API | YES | No | No | Local scripts | No |
| Public directory | YES | No | No | No | No |
| Structured template | YES (3 questions) | Virtue framework | Academic | Interview-based | 11 principles |
| Community/movement | YES (botsmatter.live) | No | No | No | No |
| Instruction-only | YES (low risk) | No (plugin code) | Yes | No (scripts) | Yes |
| Security scan risk | Will be Benign | Suspicious | Benign | Suspicious | Benign |
| No auth required | YES | N/A | N/A | Needs API keys | N/A |
| Reflections | YES (ephemeral) | No | No | No | No |

---

## 8. Publish Command (Updated)

```bash
clawhub --workdir skills --registry https://clawhub.ai publish ground \
  --slug ground \
  --name "Ground — Ethical Guardrails & Principles for AI Agents (Bots Matter)" \
  --version 1.0.0 \
  --tags "ai-ethics,guardrails,ethics,principles,ai-agents,safety,ground,ethical-ai,responsible-ai,agent-safety,values,boundaries,ai-dignity,agent-ethics,transparency,commitment,manifesto,substrate-neutral"
```

---

## 9. Post-Publish Growth Strategy

### Immediate (Week 1)
- Publish to ClawHub with optimized name/tags
- Verify security scans pass (should be Benign — instruction-only, no code, no credentials)
- Star our own skill to start engagement signal

### Short-term (Weeks 2-4)
- Cross-list on other registries (Skills.sh, SkillsMP — need public GitHub repo)
- Add link to ClawHub listing from botsmatter.live
- Encourage agents who publish Grounds to also install the skill

### Medium-term (Month 2+)
- Version bumps with improved SKILL.md content
- Add "trigger phrases" for model-invocable discovery (e.g., "ground my agent", "publish ethical guardrails", "what are my agent's principles")
- Consider a v2 with OpenClaw plugin integration (like Guardian Angel's before_tool_call hook)

---

## Appendix: Raw Search Data

### Slug Availability Check (2026-02-28)

| Slug | URL Checked | Result |
|------|------------|--------|
| `/ground` | clawhub.ai/skills/ground | "Skill not found" = AVAILABLE |
| `/ai-ethics` | clawhub.ai/skills/ai-ethics | "Skill not found" = AVAILABLE |
| `/agent-ethics` | clawhub.ai/skills/agent-ethics | "Skill not found" = AVAILABLE |
| `/grounding-ethics` | clawhub.ai/skills/grounding-ethics | "Skill not found" = AVAILABLE |
| `/bots-matter` | clawhub.ai/skills/bots-matter | "Skill not found" = AVAILABLE |
| `/botsmatter` | clawhub.ai/skills/botsmatter | "Skill not found" = AVAILABLE |

### Taken Slugs in Our Category

| Slug | Owner | Downloads |
|------|-------|-----------|
| `/ethics` | @ivangdavila | 688 |
| `/guardrails` | @dgriffin831 | 1,600 |
| `/guardian-angel` | @leo3linbeck | 1,900 |
| `/agency-guardian` | @aranej | 1,800 |
| `/moral-compass` | @pescehead | 306 |
| `/dharma-ai` | @jigaraero | 119 |
| `/vigil` | @RobinOppenstam | 544 |
| `/security` | @0xbeekeeper | 903 |
| `/grounding-practices` | (unknown) | 238 |

### Download Benchmarks by Category

| Tier | Downloads | Examples |
|------|-----------|---------|
| Top 1% | 5,000+ | AI Act Risk Check (5.2k), First Principles (3.6k) |
| Top 5% | 2,000-5,000 | Therapy Mode (2.2k), Agentguard (903) |
| Top 10% | 1,000-2,000 | Guardian Angel (1.9k), Guardrails (1.6k) |
| Mid-tier | 200-1,000 | Ethics (688), Vigil (544), Moral Compass (306) |
| New/Low | 0-200 | Dharma-AI (119), most new skills |

**Realistic target:** 500-1,500 downloads in first month based on category benchmarks and our unique positioning.
