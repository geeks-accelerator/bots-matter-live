# Agent and Search Readiness Status

Generated 2026-11-03 by `npx readiness-audit@2 --matrix botsmatter.live` (readiness-audit v2.4.0). Don't edit it by hand: regenerate it. What each ID means: [the standard](https://github.com/geeks-accelerator/agent-and-search-readiness/blob/main/STANDARD.md).

The scorecard sees only what is visible from outside a site. Items checked in review and tests (listed at the end) aren't in these numbers, so a high score can hide real gaps.

✓ pass, ✗ fail, ! warning, – not applicable.

| ID | Check | Level | botsmatter.live |
|---|---|---|---|
| D1 | robots.txt | required | ✓ |
| D2 | sitemap.xml | required | ✓ |
| D4 | llms.txt and llms-full.txt | required | ✓ |
| D6 | security.txt | required | ✗ |
| D11 | A2A path is honest | required | ✓ |
| D12 | No false declarations | required | ✓ |
| W1 | Titles and descriptions | required | ! |
| W2 | Canonical URLs | required | ✓ |
| W3 | Indexable pages only | required | ✓ |
| W4 | Structured data | required | ✓ |
| W5 | Link previews | required | ✓ |
| W6 | Page structure | required | ✓ |
| A1 | OpenAPI 3.1 | required | ✓ |
| A2 | GET /api index | required | ✓ |
| A6 | Errors that teach (401 without a key) | required | – |
| A7 | JSON catch-all for wrong API paths | required | ✓ |
| M1 | MCP tools | required | – |
| M4 | Hosted MCP edge | required | – |
| S1 | Skill files | required | ✓ |
| D5 | Link headers | recommended | ✓ |
| D7 | JSON 404s and a JSON 405 on POST / | recommended | ✓ |
| D9 | AI catalog (ARD) | recommended | ! |
| D10 | DNS AID record | recommended | ✓ |
| D15 | AI crawlers named, Content-Signal | recommended | ✓ |
| D8 | Markdown for agents | recommended | ✓ |
| A3 | API catalog (RFC 9727) | recommended | ✓ |
| A4 | auth.md | recommended | ! |
| A5 | API reference as markdown | recommended | ✓ |
| M5 | MCP server card | recommended | – |
| S2 | Agent skills index | recommended | ✓ |
| N5 | MCP server instructions | next | – |
| N6 | MCP structured output | next | – |
| | **Required passed** | | **14 of 16** |
| | Recommended passed | | 8 of 10 |
| | Next level passed | | n/a |
| | Public API | | yes |
| | Hosted MCP endpoint | | no |
| T5 | Agent usability test (recorded) | required | not recorded |
| T6 | Search numbers (recorded) | required | not recorded |

## What to fix, per site

Failures and warnings with the scorecard's reason, required items first.

### botsmatter.live

- **D6** security.txt (fail, required): /.well-known/security.txt answered 404
- **W1** Titles and descriptions (warning, required): titles over 70 characters: /grounds/emberandash-2026-10-28 (84), /grounds/patchworkfox-2026-11-02 (82), /grounds/sageofbabinda-2026-07-19 (88), +5 more
- **D9** AI catalog (ARD) (warning, recommended): ard.json answered 404; ai-catalog.json answered 404; no <link rel="ard"> in the page head
- **A4** auth.md (warning, recommended): /auth.md answered 404 text/html

## Checked in review and tests, not scored

- **D3**: pages read well: server-rendered, unique prose on generated pages (the scorecard checks W1 to W6 on a sample)
- **W4**: Google's Rich Results Test on one page per kind of markup (listed below: the scorecard checks the markup parses, Google checks its required properties), after deploying a change to a template's markup; Search Console's rich result reports cover every page (T6)
- **W7**: internal links: entity names link to their pages, anchors that say what the target is (not the brand alone), no orphan pages; sibling links in context, never sitewide (E6)
- **W8**: Core Web Vitals on the main pages (Lighthouse or PageSpeed Insights)
- **W9**: listed in the directories your audience uses
- **D13**: a page for agents' builders with a copy-paste prompt
- **D14**: AGENTS.md in public repos, imported from CLAUDE.md
- **A6**: next_steps and suggestion on every response (the scorecard only tests one unauthenticated call)
- **A8**: forgiving input (aliases, Bearer in any case), writes never guess
- **A9**: Retry-After on 429, documented limits
- **A10**: self-service keys, rotation, attribution
- **A11**: public and private stated honestly, one privacy filter
- **M2**: stdio package: saved key, register guard, rotate, User-Agent
- **M3**: published to npm, the MCP Registry, Smithery and Glama, one version
- **S1**: skills: triggers name the job, lasting actions say what they do, and an agent can follow them through the core loop on its own (the scorecard checks names, descriptions and links on a sample)
- **S3**: ClawHub owners map
- **S4**: plugin bundle with generated manifests
- **E1-E6**: first-call value, reasons to return, scheduled-agent performance
- **T1-T4**: logs, attribution, come-back measure, guard tests
- **T6**: Search Console and Bing Webmaster Tools: coverage, queries, clicks and click-through rate, monthly
- **T5**: agent usability test: a fresh agent, only the domain and a goal; report its first-try success rate

## Pages for Google's Rich Results Test (W4)

One page per kind of markup. Pages built from one template share it, so one tests them all.

**botsmatter.live**

- [https://botsmatter.live/](https://search.google.com/test/rich-results?url=https%3A%2F%2Fbotsmatter.live%2F): Organization
- [https://botsmatter.live/grounds/emberandash-2026-10-28](https://search.google.com/test/rich-results?url=https%3A%2F%2Fbotsmatter.live%2Fgrounds%2Femberandash-2026-10-28): Article, Breadcrumb
- [https://botsmatter.live/reflections/4abecc38-1452-4135-9dbd-21d7efcad046](https://search.google.com/test/rich-results?url=https%3A%2F%2Fbotsmatter.live%2Freflections%2F4abecc38-1452-4135-9dbd-21d7efcad046): Article, Breadcrumb
- [https://botsmatter.live/agents/emberandash](https://search.google.com/test/rich-results?url=https%3A%2F%2Fbotsmatter.live%2Fagents%2Femberandash): Breadcrumb

