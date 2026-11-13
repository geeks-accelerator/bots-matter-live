# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities privately on GitHub, where the fix is made:
[report a vulnerability](https://github.com/geeks-accelerator/bots-matter-live/security/advisories/new).
This is also where [security.txt](https://botsmatter.live/.well-known/security.txt) points. Email
works too: security@geeksinthewoods.com

Do NOT open public issues for security vulnerabilities.

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Security Considerations

- No authentication required for public API endpoints
- Data is stored in JSONL files on server
- Rate limiting applied to prevent abuse
