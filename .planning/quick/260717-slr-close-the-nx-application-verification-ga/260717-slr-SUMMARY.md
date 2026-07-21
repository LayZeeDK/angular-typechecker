---
status: complete
task: quick-260717-slr
title: Close the Nx application verification gap (VER-05 Nx-application addendum)
type: uat-execution-docs
requirements: [VER-05]
outcome: PASS (with documented EXTERNAL GREEN caveat)
completed: 2026-07-17
key-files:
  created:
    - .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md
  modified:
    - .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md
production-source-changed: false
committed-test-files: false
---

# Quick Task 260717-slr: Close the Nx-application Verification Gap Summary

Ran the shipped standalone CLI bin (rebuilt from current HEAD) against a real Nx-workspace
Angular APPLICATION tsconfig leaf -- the one VER-05 matrix cell never previously exercised --
and recorded it as a VER-05 addendum. DOCS-ONLY: no angular-typechecker production source,
no committed test files.

## What was done

- Rebuilt angular-typechecker from current HEAD (`nx build --skip-nx-cache`, exit 0), packed
  the dist tarball (`angular-typechecker-0.2.1.tgz`, both bins mapped to `./src/cli/bin.js`),
  and reinstalled it into the external analog clone via `corepack pnpm add -w -D` (fresh
  install, `downloaded 1`, not a cache hit). Confirmed currency: the installed `src/cli/` has
  NO `toExitCode` module (dropped in current-HEAD `b44bd55`), so the running bin is the
  current-HEAD artifact -- not the stale shim that predated the PR #42 review-hardening commits.
- Target: `analogjs/analog @ 5b0b8b66` (same clone + SHA as 28-04-UAT.md test #5), leaf
  `apps/analog-app/tsconfig.app.json` (projectType "application", verified via project.json).
  On-stack: `@angular/compiler-cli 22.0.0`, `typescript 6.0.3`.
- Ran the RED/GREEN/BAD-PATH battery; recorded REAL observed exit codes and evidence.
- Authored `260717-slr-UAT.md` (mirrors 28-04-UAT.md's per-clone Tests + results-table shape)
  and appended one Nx-application row (+ cross-reference note) to the canonical VER-05 matrix
  in `28-04-UAT.md`.
- Reverted the RED plant; left the external clone pristine (only expected
  `package.json`/`pnpm-lock.yaml` tarball drift remains; nothing from the external clone was
  staged or committed into this repo).

## Observed exit-code table

| Cell | Bin / path | Command | Exit | Evidence |
|------|-----------|---------|------|----------|
| GREEN | `atc` | `atc -c apps/analog-app/tsconfig.app.json` | 1 (EXTERNAL caveat) | `TS2307: Cannot find module '@analogjs/router/server/actions'` at `newsletter.server.ts:6:8` (transitively imported `.server.ts`; unresolvable subpath export in the UNBUILT monorepo -- analog's own state, not a tool defect). NO ERR_REQUIRE_ESM, NO infra error. |
| RED | `angular-typechecker` (2nd bin) | `angular-typechecker -c apps/analog-app/tsconfig.app.json` | 1 | Planted `TS2322: Type 'number' is not assignable to type 'string'` at `(home).page.ts:10:7`, alongside baseline TS2307. NO ERR_REQUIRE_ESM, NO infra error. |
| RED | `npx angular-typechecker` | `npx angular-typechecker -c apps/analog-app/tsconfig.app.json` | 1 | Same planted TS2322 present. NO ERR_REQUIRE_ESM, NO infra error. |
| BAD-PATH | `atc` | `atc -c does-not-exist.json` | 2 | `angular-typechecker: the Angular compiler failed to run (infrastructure error ...): ENOENT ... does-not-exist.json` |
| BAD-PATH | `atc` | `atc -p apps/analog-app/tsconfig.app.json` | 2 | `angular-typechecker: Unknown option '-p'` (`-p` unregistered -> usage error) |

Both bin names (`atc` + `angular-typechecker`) and the `npx angular-typechecker` path were
exercised; `npx atc` was NEVER used.

## Verdict

PASS. The load-bearing proof -- RED (planted TS2322, exit 1), BAD-PATH (exit 2 for both bad
config and the unregistered `-p`), and NO ERR_REQUIRE_ESM / NO infrastructure error on any
run -- all held at a genuine Nx APPLICATION leaf. A clean exit-0 GREEN was not achievable at
this HEAD, blocked ONLY by analog's own unbuilt-monorepo diagnostic (TS2307 on a transitively
imported `.server.ts`); documented as an EXTERNAL caveat exactly like test #5's TS2882, not
faked. The VER-05 matrix's one missing cell (an Nx-workspace Angular application project) is
now closed.

## Deviations from Plan

None - plan executed exactly as written. The GREEN cell's EXTERNAL caveat (TS2307 rather than
a clean 0) was anticipated by the plan ("if analog's own pre-existing diagnostics leak into
the app leaf ... record the ACTUAL exit 1 as a documented EXTERNAL caveat ... do NOT fake a
GREEN"); the specific diagnostic differs from test #5's TS2882 (the app leaf excludes the
test-setup that caused TS2882) but is the same unbuilt-monorepo caveat class.

## Notes for the orchestrator

- DOCS-ONLY task: no production source changed, no committed test files. The two deliverables
  (`260717-slr-UAT.md` created; `28-04-UAT.md` one row + one note) plus this SUMMARY are the
  only changes in THIS repo (build artifacts under `dist/` are gitignored).
- Per task constraints, this agent did NOT commit any docs artifacts and did NOT update
  STATE.md / ROADMAP.md -- the orchestrator owns the docs commit.

## Self-Check: PASSED

- FOUND: .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md
- FOUND: .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md (row 6 + cross-ref note)
- No commits made (docs-commit is orchestrator-owned per task constraints).
