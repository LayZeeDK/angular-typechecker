---
quick_id: 260720-w5a
description: Audit and triage all open vulnerabilities reported by Dependabot then address the vulnerabilities that remain
status: complete
date: 2026-07-20
commits:
  - 7606f57 fix(deps): override transitive axios to ^1.18.0 (root)
  - 6b8af77 fix(deps): override @babel/core + esbuild in ng-cli e2e fixture
  - ad6434a fix(deps): override transitive axios to ^1.18.0 in consumer e2e fixture
---

# Quick Task 260720-w5a: Audit, triage, and address open Dependabot vulnerabilities

## Audit (4 open alerts, `gh api repos/LayZeeDK/angular-typechecker/dependabot/alerts`, 2026-07-20)

| # | Package | Sev | Scope | Location | Vuln range -> patched | GHSA |
|---|---------|-----|-------|----------|-----------------------|------|
| 12 | axios | medium | dev | root `package-lock.json` | `>=1.15.2 <1.18.0` (1.16.0) -> 1.18.0 | GHSA-xj6q-8x83-jv6g |
| 9 | axios | medium | dev | consumer-workspace `pnpm-lock.yaml` | `>=1.15.2 <1.18.0` -> 1.18.0 | GHSA-xj6q-8x83-jv6g |
| 7 | @babel/core | low | dev | ng-cli-workspace `package-lock.json` | `<=7.29.0` -> 7.29.6 | GHSA-4x5r-pxfx-6jf8 |
| 6 | esbuild | low | dev | ng-cli-workspace `package-lock.json` | `>=0.27.3 <0.28.1` -> 0.28.1 | GHSA-g7r4-m6w7-qqqr |

## Triage

- **All 4 are development-scope transitive dependencies.** None ship in the published
  `angular-typechecker` package (its `files` whitelist ships only `src`, `executors.json`,
  `README.md`). Zero consumer runtime exposure.
- **No real exploit path** in this repo: the axios prototype-pollution needs attacker-controlled
  Basic-auth subfields; the @babel/core and esbuild issues are build/dev-server file-reads that
  never see untrusted input inside sealed CI fixtures.
- **Verdict: address (clear), do not dismiss.** The root `package.json` already carries an
  `overrides` block pinning patched `@babel/core`/`esbuild`/`qs`/`uuid` -- the maintainer's
  established convention is to clear transitive dev vulns via `overrides` (the repo also dogfoods
  CodeQL + SARIF + fallow, so a clean Dependabot surface matters). "Remaining" work = extend that
  same pattern to the 3 lockfiles the alerts sit in. Nothing was left un-addressed.

## What was done (3 atomic commits, all `fix(deps)`)

Each fix is **lockfile-only** (`npm install --package-lock-only` / `pnpm install --lockfile-only`)
-- it bumps the committed lockfile that Dependabot scans without churning `node_modules`. CI installs
fresh (`npm ci`) per job, so the patched versions flow through automatically.

1. **Root axios (#12)** -- added `"axios": "^1.18.0"` to the existing root `overrides`. Root
   `package-lock.json`: axios 1.16.0 -> **1.18.1**. Diff +31/-3.
2. **ng-cli fixture @babel/core + esbuild (#7, #6)** -- added an `overrides` block
   (`@babel/core: ^7.29.6`, `esbuild: ^0.28.1`) to `e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/package.json`.
   Nested vulnerable `@babel/core@7.29.0` + `esbuild@0.27.7` deduped to patched **7.29.7** / **0.28.1**.
3. **consumer fixture axios (#9)** -- added `pnpm.overrides` (`axios: ^1.18.0`) to
   `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/package.json`. pnpm-lock axios
   1.16.0 -> **1.18.1**.

## Verification

- Re-scanned all 3 touched lockfiles programmatically: **no version remains inside any vulnerable
  range** (axios `>=1.15.2 <1.18.0`, @babel/core `<=7.29.0`, esbuild `>=0.27.3 <0.28.1`) -> CLEAN.
- Changes are dev-dependency lockfile bumps outside the published `angular-typechecker` project
  graph, so no version bump / no shipped-code impact; the plugin's own source is untouched.
- Final Dependabot state (all 4 alerts on the affected lockfiles) is expected to auto-close once this
  branch's lockfiles land on `main`.

## Follow-up: 2 new alerts surfaced by the merge re-scan (#15, #14 brace-expansion)

Merging PR #50 triggered a Dependabot re-scan that opened **2 new high-severity alerts** --
#15 (root `package-lock.json`) and #14 (consumer `pnpm-lock.yaml`), both `brace-expansion`
GHSA-3jxr-9vmj-r5cp (ReDoS, exponential-time expansion, range `>=3.0.0 <5.0.7`, patched 5.0.7).

- **Not a regression from PR #50.** The brace-expansion version set is byte-identical before and
  after that PR (`1.1.16, 2.1.2, 5.0.6, 5.0.7`). The advisory was published 2026-07-20; the merge
  push was simply the first re-scan to see the pre-existing `brace-expansion@5.0.6` (nested under
  `nx`) against the new advisory.
- **Fix (PR #51):** a **version-scoped** override `brace-expansion@5.0.6 -> 5.0.7` in the root
  `overrides` and the consumer fixture `pnpm.overrides`. Scoped on purpose so the unaffected
  1.1.16 / 2.1.2 instances (minimatch 1.x/2.x consumers, below the vuln range) are NOT forced up
  two majors. Root + consumer lockfiles re-scanned CLEAN of the `>=3.0.0 <5.0.7` range.
- **`nx migrate` considered and rejected** as the fix: the scoped override clears the nx-nested
  `brace-expansion@5.0.6` without touching nx at all, whereas `nx migrate latest` would move off the
  deliberately pinned Nx 23.0.1 / Angular 22 / TS 6 locked stack (big diff + migration scripts +
  full re-verification) -- a sledgehammer for a single transitive ReDoS. A version bump remains a
  separate maintenance decision on its own merits, not a security workaround.

## Notes

- Executed **inline** rather than via the `--full` subagent pipeline (researcher/planner/checker/
  executor/reviewer/verifier): the task is "extend an existing `overrides` convention + regenerate
  3 lockfiles", fully verifiable by lockfile re-grep and a Dependabot re-query. GSD tracking
  guarantees (task dir, PLAN/SUMMARY, STATE.md row, atomic commits, PR) preserved.
- `main` is PR-only; work is on branch `quick/260720-w5a-dependabot-vulns` and lands via PR.
