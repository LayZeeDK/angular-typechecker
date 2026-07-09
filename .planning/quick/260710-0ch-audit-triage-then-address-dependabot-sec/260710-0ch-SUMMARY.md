---
quick_id: 260710-0ch
description: Audit, triage, then address Dependabot security alerts
date: 2026-07-10
status: complete
commit: 0fe82a8
---

# Quick Task 260710-0ch -- Summary

Audited, triaged, and closed all five open Dependabot security alerts.

## What changed

`package.json` gained a nine-line `overrides` block; `package-lock.json` was regenerated (54 insertions, 683 deletions -- the duplicate vulnerable copies deduped away).

```json
"overrides": {
  "@babel/core": "^7.29.6",
  "esbuild": "^0.28.1",
  "qs": "^6.15.2",
  "uuid": "^11.1.1",
  "@verdaccio/config": {
    "js-yaml": "^4.2.0"
  }
}
```

Resulting versions -- every GHSA-flagged instance is gone:

| Package | Before | After |
|---------|--------|-------|
| @babel/core | 7.29.0, 7.29.7 | 7.29.7 |
| esbuild | 0.27.7, 0.28.1 | 0.28.1 |
| qs | 6.14.2 (x3), 6.15.3 | 6.15.3 |
| uuid | 8.3.2 | 11.1.1 |
| js-yaml | 3.15.0, 4.1.1, 4.3.0 (x3) | 3.15.0, 4.3.0 |

## Key decisions

**`overrides`, not `npm audit fix`.** `npm audit fix` resolved only esbuild; for js-yaml/qs/uuid it proposed downgrading verdaccio 6.x -> 5.32.2 (semver-major downgrade). Rejected.

**js-yaml override scoped to `@verdaccio/config`.** A global `js-yaml: ^4.2.0` also swept the top-level `js-yaml@3.15.0` required by `@istanbuljs/load-nyc-config` (`^3.13.1`) up to 4.x -- a breaking bump (js-yaml 4 removed `safeLoad`) on an instance that was never vulnerable (the advisory covers only 4.0.0-4.1.1). Caught during verification of the first install; scoping the override preserves 3.15.0.

**uuid 8 -> 11 accepted after a breaking-change audit.** `@cypress/request@3.0.10` (a verdaccio dep) uses uuid in exactly two places, both `const { v4 } = require('uuid'); v4()` with no arguments -- `auth.js` (digest cnonce) and `multipart.js` (boundary). Nothing in the v9/v10/v11 breaking changes touches that: v9 dropped old Node/browsers/UMD and made the default export a named function (named `{ v4 }` preserved); v10 was additive (v6/v7/v8/MAX); v11 was a TS port with dual CJS+ESM, so `require('uuid')` still resolves to the CJS build via the `require` export condition. `v4()` still returns a hyphenated string. The vuln itself is unreachable here -- GHSA-w5hq-g745-h8pq needs a `buf` argument passed to `v3/v5/v6`.

## Verification

| Gate | Result |
|------|--------|
| `npm audit` | 0 vulnerabilities (was 14: 3 low, 11 moderate) |
| Lockfile GHSA scan | 0 vulnerable instances |
| `nx build angular-typechecker` | pass |
| `nx test angular-typechecker` | 47 files, 348 tests pass |
| `nx lint angular-typechecker` | pass |
| `nx format:check` | pass |
| `nx test angular-typechecker-install-e2e` | 11 files, 37 tests pass -- real `nx add` against local Verdaccio on npm, pnpm, and yarn |

The install-e2e is the meaningful uuid@11 gate: it starts verdaccio (which drives `@cypress/request`), publishes the packed tarball, and installs it under three package managers. It passes, confirming the audit's prediction empirically.

## Release impact

None. This touches only the root dev tree, not `packages/angular-typechecker/`. `nx release` attributes bumps by changed files, and `chore` is a no-bump type, so no version bump and no changelog entry.
