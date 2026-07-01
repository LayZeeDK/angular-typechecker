# Phase 6: Full e2e Matrix + CI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 6-Full e2e Matrix + CI
**Mode:** --auto --chain --analyze (autonomous selection; recommended option per area; research-first)
**Areas discussed:** CI matrix shape, Phase-7 gating contract, e2e Linux-only split, install/cache, action pinning, pnpm provisioning, 5-project-type fixture topology, dedicated e2e project, pnpm fixture scope, mixed-case path assertion

> All areas auto-selected and auto-resolved to the research-backed recommended option
> (no AskUserQuestion in --auto). Each row's "Selected" reflects the auto-pick. Two items
> were NOT silently locked -- recorded as OQ-1 / B-02 below for empirical resolution.

---

## CI matrix shape (CI-01)

| Option                                               | Description                                                               | Selected |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| Full 3 Node x 3 OS = 9 cells, fail-fast:false        | Max coverage; free on public repos; matches the tool's cross-OS/Node risk | ✓        |
| Trim macOS to one Node (7 cells)                     | Fewer macOS jobs                                                          |          |
| Linux full + Windows/macOS on Node 24 only (5 cells) | Smallest matrix                                                           |          |

**Selected:** Full 3x3 (D-01). **Notes:** standard runners are free + unquota'd for public repos in 2026; the 10x macOS multiplier is private-repo-quota only. Pin Node to major; do not pin `architecture` (lets macos-latest arm64 resolve). Node 26 is non-LTS but in `engines` -- test it.

---

## Phase-7 required-check gating contract

| Option                                                       | Description                                                   | Selected |
| ------------------------------------------------------------ | ------------------------------------------------------------- | -------- |
| Single aggregate gate job `ci` (needs:[test,e2e], if:always) | One stable required-check name; immune to matrix-cell renames | ✓        |
| Require every matrix cell name individually                  | No extra job                                                  |          |
| Third-party `alls-green` action                              | Less bash                                                     |          |

**Selected:** aggregate `ci` job (D-02). **Notes:** CROSS-PHASE CONTRACT -- Phase 7's "Default branch" ruleset will require the check named `ci`; locking the name now. Use `contains(needs.*.result,'failure'||'cancelled')` (robust under fail-fast:false).

---

## e2e Linux-only split mechanism

| Option                                               | Description                          | Selected |
| ---------------------------------------------------- | ------------------------------------ | -------- |
| Explicit project list, separate Linux-only `e2e` job | Zero config change; deterministic    | ✓        |
| Dedicated `e2e` target on the e2e projects           | Cleaner `-t e2e` split; 2+ file edit |          |
| Select by `scope:e2e` tag                            | Tag-driven; more moving parts        |          |
| `nx affected` instead of `run-many`                  | Skips unchanged                      |          |

**Selected:** explicit project list (D-03), Node 24, `nx run-many` (deterministic). **Notes:** runner-up (dedicated `e2e` target) flagged as a maintainer style call, not auto-locked as superior -- recorded as a deferred refactor.

---

## Install + cache in CI

| Option                                                                 | Description                                     | Selected |
| ---------------------------------------------------------------------- | ----------------------------------------------- | -------- |
| `npm ci` + setup-node `cache: npm`, no cross-job Nx cache, no Nx Cloud | Lockfile-faithful; inherits .npmrc; simple/free | ✓        |
| Add `actions/cache` for `.nx/cache` across cells                       | Cross-job Nx cache                              |          |
| Introduce Nx Cloud                                                     | Distributed cache                               |          |

**Selected:** npm ci + cache:npm (D-04). **Notes:** `.npmrc` `legacy-peer-deps=true` auto-honored by `npm ci` (dev-repo workspace install). No `registry-url` in test CI (OIDC-only concern).

---

## Action version pinning + hardening

| Option                                                                        | Description                                 | Selected |
| ----------------------------------------------------------------------------- | ------------------------------------------- | -------- |
| Reuse release.yml SHAs (checkout v5.0.1, setup-node v5.0.0) + match hardening | Dependabot bumps both workflows in lockstep | ✓        |
| Adopt latest majors (checkout v7, setup-node v6)                              | Start current                               |          |

**Selected:** reuse release.yml SHAs (D-05). **Notes:** match `permissions: contents:read`, `persist-credentials:false`, `# vN`-commented full-SHA pins, add `concurrency` cancel-in-progress; triggers `pull_request` + `push` to `main`. Re-verify SHAs at execution.

---

## pnpm provisioning

| Option                           | Description                        | Selected |
| -------------------------------- | ---------------------------------- | -------- |
| `pnpm/action-setup` (SHA-pinned) | Durable; Node-25+ removed corepack | ✓        |
| `corepack enable`                | Removed from Node 25+              |          |

**Selected:** pnpm/action-setup (D-06). **Notes:** the matrix runs Node 26 where corepack is gone; pin a `version:` matching the fixture lockfile.

---

## 5-project-type fixture topology (TEST-03)

| Option                                                        | Description                                                         | Selected |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| ONE multi-project consumer workspace, install-once, 5 targets | Pay install once; real cross-project graph; mirrors a real consumer | ✓        |
| Five independent single-type fixtures                         | Isolated; pays full install 5x on the slow Linux gate               |          |
| Extend the single consumer-app                                | Smallest diff; collapses into option A anyway                       |          |

**Selected:** one multi-project workspace (D-07). **Notes:** binding constraint is the Linux-only serialized gate's install cost. Per-type `it()`/`it.each` keeps failure isolation. 5 type shapes validated against installed Nx 23 schemas. See OQ-1 for the buildable/publishable peer caveat.

---

## Harness reuse vs new e2e project

| Option                                                 | Description                                                                             | Selected |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------- |
| New dedicated `angular-typechecker-matrix-e2e` project | Follows cache-e2e/install-e2e one-project-per-concern precedent; finer gate granularity | ✓        |
| Extend `angular-typechecker-install-e2e`               | Reuse in place; but blocks the fast audit specs behind the slow matrix                  |          |

**Selected:** new project (D-08). **Notes:** clone install-e2e's serialized `vitest.config.mts` + `buildCleanEnv` + pack-to-tmp.

---

## pnpm fixture scope

| Option                                                                | Description                                               | Selected |
| --------------------------------------------------------------------- | --------------------------------------------------------- | -------- |
| (a)+(c) ONE fixture: symlinked-layout run + realpath regression-guard | Proves OUT-02 realpath-first is load-bearing; one install | ✓        |
| (a) alone: single pnpm consumer                                       | Proves "works under pnpm" only                            |          |
| (b) full 5-type matrix under pnpm                                     | Doubles the slow install for no new signal                |          |

**Selected:** (a)+(c) combined (D-09). **Notes:** construction needs an empirical realpath check (B-02).

---

## Mixed-case path assertion

| Option                                                                                   | Description                                             | Selected |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| Cross-OS unit tier (extend filter-diagnostics.spec.ts) + live-host integration assertion | Runs on all 3 OS where the bug bites; e2e is Linux-only | ✓        |
| e2e fixture mixed-case assertion                                                         | Dead code on Linux (case-sensitive), the only e2e OS    |          |
| Both                                                                                     | e2e half adds signal only on macOS/Windows              |          |

**Selected:** cross-OS unit + integration (D-10). **Notes:** Linux is case-sensitive and the e2e gate is Linux-only, so the assertion must live in the 3-OS unit+integration matrix to have teeth.

---

## Claude's Discretion

- CI workflow filename (`ci.yml`); concurrency group string; whether the Linux-only e2e is one job or split per project; exact fixture/project names; pnpm version pin; e2e Node version (24 vs 22); whether `npm i -g npm@latest` precedes `npm ci`; the precise D-09 symlink + D-10 extra unit cases; whether integration shares the matrix `test` target.

## Deferred Ideas

- Phase 7: branch-protection ruleset switch + Release-PR workflow + clean public changelog (Phase 6 only defines the `ci` check name).
- Later: OpenSSF Scorecard / harden-runner / CodeQL / signed commits-tags; Nx community-registry-listing PR.
- Possible later refactor: a dedicated `e2e` Nx target (vs the explicit-project-list split).
- Rejected: a full 5-type matrix duplicated under pnpm (no new signal).

## Open Questions (NOT silently locked -- see CONTEXT.md)

- **OQ-1 [INVESTIGATE]:** buildable/publishable fixtures vs the "clean install needs no legacy-peer-deps" honesty invariant (B-03). Recommended default: hand-author build targets to avoid an `@nx/angular` fixture dep; planner spikes a clean install first; escalate remediation if it ERESOLVEs.
- **B-02 [DISCOVER empirically]:** whether `ts.sys.realpath` resolves the `.pnpm/` symlink so the regression-guard genuinely fails a non-realpath filter; validate with a probe before asserting.
