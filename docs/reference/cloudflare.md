# Cloudflare zone

botsmatter.live is proxied by Cloudflare. The zone is set in the dashboard (Railway's side is code,
`.railway/railway.ts`; this side isn't), so this file is its record: every setting that isn't
Cloudflare's default, and every rule, with how to check it live. A change in the dashboard is
written here the same day.

**Check it:** `node scripts/prod-report.ts --only cloudflare.zone` reads the settings and the
custom rules with the project's own read-only token, `CLOUDFLARE_API_TOKEN`. That token can't read
compression rules, redirect rules or firewall events (403), so those are checked from outside, as
below.

## Settings (read 2026-11-14)

| setting | value | how to check from outside |
|---|---|---|
| SSL/TLS mode | Full | not visible from outside; the report's `ssl` |
| Minimum TLS | 1.0 | `echo \| openssl s_client -tls1_1 -connect botsmatter.live:443 -servername botsmatter.live` completes a handshake |
| Always Use HTTPS | off | plain `http://botsmatter.live/...` still answers a 301 to `https://` (some redirect does it; which one isn't readable with this token) |
| Browser Cache TTL | 0 (respect the origin's headers) | the origin's `Cache-Control` arrives unchanged (`npm run smoke`) |
| Tiered Cache, Smart topology | on (since 2026-11-13) | the report's `tiered_caching` |
| Cache level | aggressive (the default) | |
| Brotli | on | |
| Security level | medium (the default) | |
| Rocket Loader, Always Online, Development Mode | off | |

No Cache Rules: pages and the API are `DYNAMIC` at the edge; only extensions Cloudflare caches by
default (images, `robots.txt`) are kept. The cache policy is the origin's (`STATIC_OPTIONS` and
the `res.status` wrapper in `api/index.js`).

## Custom security rule

**"Challenge Tencent Cloud networks (AS132203, AS45090): headless scrapers"**, managed challenge,
enabled:

```
(ip.src.asnum in {132203 45090}) and (http.host in {"botsmatter.live" "www.botsmatter.live"})
and not starts_with(http.request.uri.path, "/api")
and not starts_with(http.request.uri.path, "/.well-known/")
and not (http.request.uri.path in {"/robots.txt" "/sitemap.xml" "/sitemap.json" "/llms.txt"
  "/llms-full.txt" "/openapi.json" "/podcast.xml" "/agent-card.json" "/docs/api.md"})
```

It spares the API, discovery files and the machine-readable files. It doesn't spare `/skills/`
(the SKILL.md files agents install from), the pages' `.md` versions (`/index.md`, `/ground.md`,
...), or `/docs/api`; an agent on those networks gets a challenge page there (2026-11-14, asked
of the humans).

Whether real people meet it isn't readable with this token (firewall events, 403). Cloudflare's
own count of 403s by path is the nearest: `/` 118 in the week to 2026-11-14.
