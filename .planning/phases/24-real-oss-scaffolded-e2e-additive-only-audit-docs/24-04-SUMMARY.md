---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
plan: 04
subsystem: infra
tags: [nx, package.json, dependency-checks, eslint, yarn, angular-cli, ng-add]

# Dependency graph
requires:
  - phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
    provides: "The CLI x yarn e2e debug root cause (cli-yarn-e2e-wrong-version.md 2nd-layer finding)"
provides:
  - "Published plugin manifest declares nx as a direct ^23.0.0 dependency (not a peer)"
  - "Inverted package-manifest.spec.ts guards asserting nx IS a ^23.0.0 dependency"
  - "@nx/dependency-checks ignoredDependencies now includes nx (lint stays green)"
  - "De-contradicted PROJECT.md + CLAUDE.md operative Dependencies constraint"
affects: [24-05, release, ng-add, yarn]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct declaration of a runtime-transitive dependency (nx) that the plugin never imports, ignored in @nx/dependency-checks so obsoleteDependency stays green"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/src/package-manifest.spec.ts
    - packages/angular-typechecker/eslint.config.mjs
    - .planning/PROJECT.md
    - CLAUDE.md

key-decisions:
  - "nx declared as a direct ^23.0.0 dependency (not a peer): @nx/devkit require()s nx/src/devkit-exports at load and yarn does not auto-install peers, so a yarn Angular CLI consumer needs nx present directly. Range ^23.0.0 is a strict subset of @nx/devkit's nx peer, so no double-constraint and cannot pull nx 22/24."
  - "Historical STACK-research prose in CLAUDE.md annotated with dated [v0.2.1 CORRECTION (2026-07-12): ...] notes rather than rewritten, preserving the original finding as history; only the operative Dependencies constraint (identical in PROJECT.md + CLAUDE.md) was rewritten."

patterns-established:
  - "Three-guard dependency contract kept coherent in one atomic edit: manifest string + package-manifest.spec.ts unit test + @nx/dependency-checks lint all changed together so nx test / nx lint stay green."

requirements-completed: [ACP-02]

# Metrics
duration: 5min
completed: 2026-07-12
---

# Phase 24 Plan 04: nx-as-direct-dependency fix Summary

**Declared `nx` as a direct `^23.0.0` runtime dependency (not a peer) so yarn Angular CLI consumers get `nx/src/devkit-exports` at `ng add`/`ng run` time, with both enforcement guards inverted and the contradicting PROJECT.md/CLAUDE.md constraint flipped.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-12T00:09:54Z
- **Completed:** 2026-07-12T00:14:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `packages/angular-typechecker/package.json` now declares `"nx": "^23.0.0"` in `dependencies` (alongside the exact-pinned `@nx/devkit@23.0.1`); `nx` stays out of `peerDependencies`.
- Both former nx-absent assertions in `package-manifest.spec.ts` inverted to assert `manifest.dependencies?.['nx'] === '^23.0.0'` (and still not a peer), with retitled `it`s and a rewritten header comment stating the new contract.
- `eslint.config.mjs` `ignoredDependencies` now includes `'nx'` with a corrected comment, so `@nx/dependency-checks` no longer flags the unimported runtime-transitive `nx` as obsolete.
- The operative Dependencies constraint (identical in PROJECT.md line 194 and CLAUDE.md line 22) rewritten to the new rule with the yarn-does-not-auto-install-peers rationale; three CLAUDE.md STACK-research rows + the "What NOT to Use" nx row carry dated `[v0.2.1 CORRECTION (2026-07-12): ...]` notes; AGENTS.md byte-unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare nx as a ^23.0.0 dependency + flip the two enforcement guards** - `fd41260` (fix)
2. **Task 2: De-contradict the docs (flip the operative constraint + date-annotate the STACK-research rows)** - `dcfb0be` (docs)

## Files Created/Modified
- `packages/angular-typechecker/package.json` - added `"nx": "^23.0.0"` to `dependencies`
- `packages/angular-typechecker/src/package-manifest.spec.ts` - inverted both nx guards, restated header comment + it-titles
- `packages/angular-typechecker/eslint.config.mjs` - added `'nx'` to `@nx/dependency-checks` `ignoredDependencies`, rewrote the now-false comment
- `.planning/PROJECT.md` - rewrote the operative Dependencies constraint (new rule + rationale)
- `CLAUDE.md` - rewrote the identical Dependencies constraint; annotated 3 STACK-research rows + the "What NOT to Use" nx row with dated corrections

## Decisions Made
- Used a release-meaningful commit scope (`fix(deps)` / `docs(deps)`) instead of the GSD default `{phase}-{plan}` scope. Task 1 is a `fix` that touches `packages/angular-typechecker/` and therefore reaches the public changelog; AGENTS.md gotcha 2 mandates release-meaningful scopes (`core`, `executor`, `release`, `deps`) over internal plan ids for changelog-reaching commits. The dependency-contract change maps cleanly to `deps`.

## Deviations from Plan

None - plan executed exactly as written. All three verification legs (test/lint/build), the dist-manifest check, and the docs check passed on the first run.

## Issues Encountered
- A PreToolUse prompt-injection heuristic flagged the PROJECT.md edit (matched an `act as` regex). Confirmed false positive: the written text is dependency documentation with no embedded instructions. Proceeded.

## Verification Evidence

- Task 1 automated (`NX_DAEMON=false npx nx {test,lint,build} angular-typechecker --skip-nx-cache`):
  - `nx test angular-typechecker` - PASS: Test Files 38 passed (38), Tests 349 passed (349).
  - `nx lint angular-typechecker` - PASS: "All files pass linting" (both `@nx/dependency-checks` and `@nx/nx-plugin-checks` green; `nx@^23.0.0` satisfied by installed `23.0.1`).
  - `nx build angular-typechecker` - PASS: "Successfully ran target build".
  - dist manifest check - PASS: `require('./dist/packages/angular-typechecker/package.json').dependencies.nx` prints `^23.0.0`.
- Task 2 automated (`rg -q -F "^23.0.0" ... && git diff --quiet AGENTS.md`) - PASS: printed `DOCS_OK`. Confirmed no `do NOT declare \`nx\`` remnants in PROJECT.md/CLAUDE.md and no nx-declaration rule in AGENTS.md.

## Next Phase Readiness
- Plan 24-05 (yarn/pnpm CLI e2e finalization) can now build a dist whose manifest carries `nx` in `dependencies`, so its globalSetup-published Verdaccio dist installs `nx` automatically for a yarn Angular CLI consumer.
- Post-execution gates (out of scope for this plan): re-run the ADDITIVE-ONLY audit to record the `dependencies` delta and confirm v0.2.x still holds; `gsd-verifier` re-verifies ACP-02.

## Self-Check: PASSED

- FOUND: `.planning/phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-04-SUMMARY.md`
- FOUND commit: `fd41260` (Task 1)
- FOUND commit: `dcfb0be` (Task 2)

---
*Phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs*
*Completed: 2026-07-12*
