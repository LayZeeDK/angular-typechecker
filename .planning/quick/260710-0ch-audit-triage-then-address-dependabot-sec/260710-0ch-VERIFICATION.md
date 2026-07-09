---
quick_id: 260710-0ch
status: passed
date: 2026-07-10
---

# Quick Task 260710-0ch -- Verification

Goal: audit, triage, and address the open Dependabot security alerts.

## must_haves check

| Truth | Verdict | Evidence |
|-------|---------|----------|
| All five alerts are dev-scope transitive deps in `package-lock.json` | CONFIRMED | Every flagged lockfile entry carries `dev: true`; `gh api .../dependabot/alerts` reports `scope: development` for all five. |
| None ship in the published package | CONFIRMED | `packages/angular-typechecker` declares `@nx/devkit` + `tslib` as deps and `@angular/compiler-cli` + `typescript` as peers; it bundles nothing. No flagged package appears. |
| `npm audit fix` cannot resolve four of five | CONFIRMED | `npm audit --json` reports `fixAvailable: {name: "verdaccio", version: "5.32.2", isSemVerMajor: true}` for js-yaml, qs, and uuid; only esbuild had `fixAvailable: true`. |
| npm `overrides` forces the patched versions | CONFIRMED | Post-install lockfile scan shows zero instances inside any GHSA vulnerable range. |
| js-yaml override must be scoped to `@verdaccio/config` | CONFIRMED | Global override collapsed `js-yaml` to `4.3.0` only, removing the `3.15.0` required by `@istanbuljs/load-nyc-config` (`^3.13.1`). Scoped override restores `3.15.0` alongside `4.3.0`. |
| uuid 8 -> 11 is safe for `@cypress/request` | CONFIRMED | Source grep shows only `{ v4 } = require('uuid')` + `v4()` (no args) in `auth.js:4,92` and `multipart.js:3,10`. v11 still ships CJS via `exports["."].node.require`. install-e2e passes against live verdaccio. |

## Artifacts

- `package.json` -- `overrides` block present.
- `package-lock.json` -- regenerated; 54 insertions, 683 deletions.
- `260710-0ch-SUMMARY.md` -- present.
- `260710-0ch-VERIFICATION.md` -- this file.

## Gates

All green:

```
npm audit                                  0 vulnerabilities (was 14)
lockfile GHSA scan                         0 vulnerable instances
nx build angular-typechecker               pass
nx test angular-typechecker                47 files / 348 tests pass
nx lint angular-typechecker                pass
nx format:check                            pass
nx test angular-typechecker-install-e2e    11 files / 37 tests pass
```

## Residual risk

- `esbuild` was forced from `0.27.7` to `0.28.1` inside `@angular/build > vite`. A 0.x minor bump is potentially breaking for esbuild, but `0.28.1` was already the tree's primary version and the Angular build plus all unit and e2e tests pass on it.
- `uuid@11`'s stated support matrix is Node 16-20 while this repo runs Node 22/24/26. `engines` is unset in `11.1.1` (no enforcement) and `v4()` relies only on `crypto.randomUUID`, present since Node 16. e2e confirms it works.

## Status

**passed** -- no human follow-up required. The five alerts should auto-close once the branch merges to `main`.
