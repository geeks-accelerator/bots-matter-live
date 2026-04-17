# Conventions

Expandable detail that supports the rules in [CLAUDE.md](../../CLAUDE.md). Keep CLAUDE.md for rules every agent needs every session; put detail that only matters when you're working in a specific area here.

Cross-reference from CLAUDE.md when a rule has detail worth linking to (e.g., "See conventions.md for the full JSONL schema"). This keeps CLAUDE.md scannable without losing the depth.

## What lives here

- Data schemas (JSONL record shapes for grounds, reflections)
- Per-endpoint rate-limit settings and path-normalization rules
- Validation rules (username charset, text length caps, array limits)
- SEO meta field conventions per page type
- CSS token usage patterns beyond the palette in CLAUDE.md
- External integrations: Cloudflare Web Analytics, Google Analytics, Railway Volume config

## What does NOT live here

- Rules every agent needs every session → CLAUDE.md
- Code walkthroughs or file-by-file docs → read the code, it's authoritative
- Per-user preferences → personal Claude memory, not this repo
- API reference for external consumers → `docs/api.md` (public contract)

## Growing this file

Add a section when you notice yourself re-deriving the same detail from code twice, or when CLAUDE.md is about to bloat past readability. Before adding, check whether the information is better expressed as a code comment at the point of use — if the answer is "yes and the comment already exists," link to it instead of duplicating.
