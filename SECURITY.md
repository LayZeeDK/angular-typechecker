# Security Policy

## Supported Versions

`angular-typechecker` is a pre-1.0 project maintained by a single maintainer.
Only the latest published `0.x` release receives security fixes.

| Version      | Supported |
| ------------ | --------- |
| latest 0.x   | yes       |
| < latest 0.x | no        |

## Reporting a Vulnerability

Please report security vulnerabilities **privately** via GitHub's
**"Report a vulnerability"** button on the repository's Security > Advisories page:

https://github.com/LayZeeDK/angular-typechecker/security/advisories/new

If you cannot use GitHub Private Vulnerability Reporting, email
`larsbrinknielsen@gmail.com` instead.

Please do not open a public issue for a security report.

We aim to acknowledge reports within about 7 days. This is a best-effort target
from a solo maintainer, not a guaranteed SLA.

## Scope

In scope:

- The published `angular-typechecker` npm package.
- The release pipeline that builds and publishes it
  (`.github/workflows/release.yml`).

Out of scope (report these to their respective projects):

- The peer dependencies `@angular/compiler-cli`, `typescript`, and `nx`.
- Vulnerabilities in your own workspace configuration or third-party plugins.
