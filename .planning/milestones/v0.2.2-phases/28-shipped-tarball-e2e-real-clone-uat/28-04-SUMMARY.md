---
phase: 28-shipped-tarball-e2e-real-clone-uat
plan: 04
subsystem: docs
tags: [uat, real-clone, manual-gate, standalone-cli, ver-05, human-run, sha-pinned]

# Dependency graph
requires:
  - phase: 28-shipped-tarball-e2e-real-clone-uat
    plan: 01
    provides: the shipped-bin exit-code contract exercised by the runShim harness (the same 0/1/2 contract the UAT asserts by hand)
  - phase: 27-bin-shell-cross-platform-packaging
    plan: 01
    provides: the shipped bin (angular-typechecker + atc -> src/cli/bin.js) whose installed artifact the UAT runs
provides:
  - a reproducible human-run real-clone UAT procedure (28-04-UAT.md) for the shipped bin at real project tsconfigs in on-stack Angular 22 OSS clones of BOTH kinds (Angular CLI + Nx)
  - a human sign-off / results table gating VER-05 (status pending-human-run until a human executes it)
affects: [VER-05, phase verification, v0.2.2 milestone close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Human-run UAT artifact modeled on 24-ACV-01-UAT.md, adapted to the standalone bin: atc -c <tsconfig> per real project leaf instead of ng add / ng run"
    - "RED (planted distinct TSxxxx per leaf -> exit 1) / GREEN (clean -> exit 0) / BAD-PATH (nonexistent tsconfig + usage errors incl. one -p cell -> exit 2), with no ERR_REQUIRE_ESM / infrastructure error on RED runs"
    - "-c/--tsConfig on every invocation; both bin names + npx angular-typechecker exercised; atc is NEVER run through npx (atc@0.0.6 supply-chain hazard)"

key-files:
  created:
    - .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md
  modified: []

key-decisions:
  - "VER-05 is HUMAN-RUN and is NOT marked done from automation: the --auto --chain pipeline PRODUCES the checklist (status: pending-human-run); a blocking human checkpoint gates the actual run (D-08)."
  - "Angular CLI kind uses the carry-forward v0.2.1 Phase-24 SHAs (ngx-leaflet @818e9ae, realworld-angular @9e3528f); the Nx kind (radix-ng/primitives primary, analogjs/analog alt) is NOT pre-pinned -- the human pins a FRESH on-stack Angular 22 SHA at run time and records it (repos move); candidate starting SHAs are presented to re-verify, not locked."
  - "Install the LOCAL packed tarball (nx build + npm pack from dist), NOT npm i angular-typechecker: the published 0.2.1 does not ship the standalone CLI (bin landed unreleased in Phase 27)."
  - "One -p cell per clone is retained as a VALID exit-2 usage-error test (-p is deliberately unregistered); every other invocation uses -c/--tsConfig."

patterns-established:
  - "Pattern: a two-tier verification close -- CI-authoritative committed specs (VER-04) plus a human-run real-clone UAT (VER-05) modeled on the ACV-01/ACV-02 split; the UAT doc carries pending fields (result/evidence/Summary/sign-off) for the human to fill and an explicit human-run gate note."

requirements-completed: []  # VER-05 stays OPEN -- it is closed only when a human executes 28-04-UAT.md and records the outcome (blocking human checkpoint; not auto-advanced).

# Metrics
duration: 20min
completed: 2026-07-16
---

# Phase 28 Plan 04: VER-05 Human-Run Real-Clone UAT Summary

**Produced `28-04-UAT.md` -- a complete, reproducible human-run procedure that runs the SHIPPED standalone bin (`atc` / `angular-typechecker`) at REAL project tsconfigs in on-stack Angular 22 OSS clones of BOTH workspace kinds (Angular CLI and Nx), asserting planted RED (exit 1) / clean GREEN (exit 0) / bad-path (exit 2) -- modeled on `24-ACV-01-UAT.md`. VER-05 is HUMAN-RUN: this plan authored the PROCEDURE only; a blocking human checkpoint gates the actual clone-and-run, and VER-05 stays OPEN until the human records the results.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16
- **Tasks:** 1 of 2 executed (Task 2 is the human-run checkpoint -- NOT auto-completed)
- **Files created:** 1

## Accomplishments

- Wrote `.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md` (341 lines), the reproducible VER-05 procedure:
  - **Frontmatter** `status: pending-human-run` (so the phase is NOT auto-marked done) + `scope`/`gate: manual (D-08)`/`substrate` (on-stack Angular 22, both kinds)/`outcome: <PENDING HUMAN RUN>`.
  - **About this gate** stating VER-05 is the human-run confidence gate ON TOP of the CI-authoritative VER-04 (`angular-typechecker-cli-e2e`, Plans 28-01/02/03), plus the FROZEN shipped-bin contract (`-c`/`--tsConfig` required; `-p` unregistered -> usage error; exit codes 0/1/2; both bin names -> one file; `npx angular-typechecker` safe, `atc` never via npx).
  - **5 numbered tests**: (1) build + pack the shipped tarball -> `$ABS_TGZ`; (2) ngx-leaflet @818e9ae (Angular CLI, app+lib) with per-leaf `atc -c tsconfig.app.json` / `-c projects/ngx-leaflet/tsconfig.lib.json` / `-c tsconfig.spec.json`; (3) realworld-angular @9e3528f (Angular CLI, app-only); (4) radix-ng/primitives @ `<PIN FRESH>` (Nx, solution reference-walk + per-leaf lib/spec); (5) analogjs/analog @ `<PIN FRESH>` (Nx, alt/breadth).
  - Each test carries the three assertion shapes (RED planted distinct TSxxxx per leaf -> exit 1 + no `ERR_REQUIRE_ESM` / no "infrastructure error", revert; GREEN -> exit 0; BAD-PATH nonexistent tsconfig + `atc` no-`-c` + `atc --nonsense` + one `atc -p <tsconfig>` cell -> exit 2), with fenced bash `steps:` and empty `result:`/`evidence:` for the human.
  - Clone/checkout by URL + SHA (clones stay UNCOMMITTED), local-tarball install per the clone's own PM (npm / `pnpm add -w -D` / yarn), the MSYS `/d/...` path note, a `## Summary` tally, a human sign-off / results table, and a note to pin + record the FRESH Nx-kind SHAs (PITFALLS candidates as a starting point, re-verify on-stack).
- Verified all acceptance criteria against the written file (see below).

## Task Commits

1. **Task 1: write the 28-04-UAT.md human-run procedure** - `bef482e` (docs)

**Plan metadata:** committed with this SUMMARY (docs).

**Task 2** (`checkpoint:human-verify`, gate blocking) is the actual human UAT run -- returned as a blocking human-action checkpoint, NOT executed by automation.

## Files Created

- `.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md` - the VER-05 human-run real-clone UAT procedure (status: pending-human-run).

## Decisions Made

- **VER-05 stays OPEN.** The `--auto --chain` pipeline produced the checklist; a HUMAN must clone the repos and run the shipped bin. `requirements-completed` is intentionally empty; VER-05 is closed only when the human executes the procedure and records the outcome (blocking checkpoint, not auto-advanced) -- consistent with D-08 and the CONTEXT "UAT is human-run" invariant.
- **Substrate SHAs.** Angular CLI kind uses the carry-forward Phase-24 SHAs (literal in the doc); Nx kind is human-pinned FRESH at run time (candidates presented to re-verify, not locked) because those repos move on `main`/`beta`.
- **Install the LOCAL tarball, not the published package.** The npm 0.2.1 release predates the standalone CLI (bin landed unreleased in Phase 27), so the procedure builds + packs from dist and installs that tarball; installing by name from npm would fetch a CLI-less artifact.

## Deviations from Plan

None - plan executed exactly as written. (Only the human-run Task 2 remains, by design.)

## Deferred Issues

None.

## Known Stubs

None. The artifact is a procedure doc with intentional `<PENDING>` result/evidence/sign-off placeholders for the human to fill -- these are the human-run gate fields, not code stubs.

## Threat Flags

None new. The plan's `<threat_model>` is honored by the artifact:
- **T-28-04 (untrusted clone content):** clones stay UNCOMMITTED and pinned by URL + SHA (reproducible, auditable, never merged); the shipped engine only READS tsconfigs/sources.
- **T-28-03 (npx supply chain):** the procedure runs the installed `.bin/atc` / `.bin/angular-typechecker` by path and uses `npx angular-typechecker` for the npx path; `atc` is NEVER run through npx (verified: the file contains zero `npx atc` occurrences).

## Verification Checks (ran vs deferred)

**Ran and GREEN (Windows arm64 dev host):**
- `test -f 28-04-UAT.md` + `rg -q "pending-human-run"` -> present.
- `git grep -c "atc -c"` -> 38 (>= 1).
- `rg -c "npx atc"` -> 0 (the supply-chain-hazard invariant; T-28-03).
- All four substrate repos present (ngx-leaflet, realworld-angular, radix-ng/primitives, analogjs/analog) and both carry-forward SHAs literal (818e9ae..., 9e3528f...).
- RED / GREEN / BAD-PATH shapes + exit codes 0/1/2 + `ERR_REQUIRE_ESM` all present.
- ASCII-only (`rg -n '[^\x00-\x7F]'` -> no matches).

**Deferred to the human (Task 2, blocking checkpoint):**
- The actual clone-checkout-install-run of the shipped bin against the four real OSS clones and the recording of result/evidence/Summary/sign-off -- VER-05's authoritative proof. Not runnable by this automation pass by design (D-08).

## Self-Check: PASSED

- `.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md` present (verified via `test -f` + acceptance greps).
- Task 1 commit `bef482e` verified in git log.
- No file deletions in the commit (1 file changed, 341 insertions).

---
*Phase: 28-shipped-tarball-e2e-real-clone-uat*
*Completed: 2026-07-16 (Task 1); VER-05 awaits the human-run Task 2)*
