---
phase: 32-verification-docs-additive-audit
plan: 3
subsystem: audit
tags: [additive-audit, add-01, sarif, node-sarif-builder, barrel-drift, dependency-checks, release-gate]

# Dependency graph
requires:
  - phase: 32-verification-docs-additive-audit (32-01)
    provides: the VER-02 integration proofs + ajv/ajv-formats as ROOT devDeps (dev-only)
  - phase: 32-verification-docs-additive-audit (32-02)
    provides: the VER-03 tarball e2e + the project.json asset-glob packaging fix (flagged as a non-breaking build-config diff)
  - phase: 32-verification-docs-additive-audit (32-04)
    provides: the DOC-01 schema/HELP_TEXT description-only edits (flagged as non-breaking)
  - phase: 30-reporter-seam-json-reporter-format-threading-observability
    provides: the widen-only format enum + optional CoreResult.totalFilesCount + the net-new json/diagnostic-record reporters
  - phase: 31-sarif-reporter
    provides: node-sarif-builder (the ONE new runtime dependency) + the net-new sarif/extended-catalog reporters
provides:
  - 32-ADDITIVE-AUDIT.md -- the ADD-01 release-gating verdict vs angular-typechecker@0.2.2
  - The recorded ADDITIVE-ONLY-HOLDS conclusion with the v0.3.0 escape hatch UNTRIGGERED and version held at 0.2.2
affects: [v0.2.3-release-pr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only audit mirroring 27-ADDITIVE-AUDIT.md: standing-guard cross-check (leg a barrel-drift tsc + leg c dependency-checks lint) + git-diff per published path (leg b) + git ls-tree net-new proof"
    - "Negated-quiet dependency idiom (! git show HEAD:manifest | rg -q ajv) proves a dev-only validator did NOT reach the shipped dependencies"

key-files:
  created:
    - .planning/phases/32-verification-docs-additive-audit/32-ADDITIVE-AUDIT.md
  modified: []

key-decisions:
  - "The plugin dependencies gained EXACTLY node-sarif-builder@^4.1.0 since @0.2.2; ajv/ajv-formats are ROOT (private) devDependencies only, proven absent from the shipped manifest by the negated-quiet idiom."
  - "The two consumer-observable diffs are classified widen-only (optional format enum on the executor + builder schema.json/schema.d.ts; required/additionalProperties unchanged) and additive (optional CoreResult.totalFilesCount); everything else on the published surface is byte-UNCHANGED."
  - "The project.json asset-glob ignore:['**/__snapshots__/**'] (32-02) and the schema/HELP_TEXT format description rewordings (32-04) are recorded as NON-BREAKING (build-config + description-string only); no enum/default/required/additionalProperties/dependency/version change."
  - "node-sarif-builder classification RE-CONFIRMED against the real nx lint (maxWarnings:0 green, NOT in ignoredDependencies) -- A1 from Phase 31 holds; not re-litigated."

patterns-established:
  - "index.drift.ts barrel-drift tsc is the authoritative leg-a proof; nx lint dependency-checks is the authoritative leg-c proof; both run green in-phase and are cited in the audit doc."

requirements-completed: [ADD-01]

coverage:
  - id: D1
    description: "Every published-surface path has a recorded git-diff verdict vs @0.2.2: barrel/builder/executors.json/generators.json/builders.json/collection.json/generator-schemas UNCHANGED; executor+builder schemas WIDEN-ONLY (optional format); CoreResult.totalFilesCount ADDITIVE."
    requirement: ADD-01
    verification:
      - kind: other
        ref: "git diff angular-typechecker@0.2.2..HEAD -- <each published path> (recorded in 32-ADDITIVE-AUDIT.md Section 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The plugin dependencies gained EXACTLY node-sarif-builder since @0.2.2; ajv/ajv-formats are ROOT devDeps only (absent from the shipped manifest)."
    requirement: ADD-01
    verification:
      - kind: other
        ref: "git diff @0.2.2..HEAD -- packages/angular-typechecker/package.json (+ node-sarif-builder only); ! git show HEAD:packages/angular-typechecker/package.json | rg -q ajv"
        status: pass
    human_judgment: false
  - id: D3
    description: "The standing guards are green in-phase: barrel-drift tsc (nx typecheck, 3 tsc incl tsconfig.drift.json), dependency-checks (nx lint maxWarnings:0, node-sarif-builder NOT ignored -- A1), surface-regression + schema-parity (nx test 51 files/534 tests), nx format:check."
    requirement: ADD-01
    verification:
      - kind: other
        ref: "nx typecheck + nx lint + nx test + nx format:check angular-typechecker all green (Section 1 guard cross-check map)"
        status: pass
    human_judgment: false
  - id: D4
    description: "32-ADDITIVE-AUDIT.md records the ADDITIVE-ONLY verdict with v0.3.0 UNTRIGGERED and version held at 0.2.2, mirroring the 27-ADDITIVE-AUDIT.md five-section structure."
    requirement: ADD-01
    verification:
      - kind: other
        ref: "rg ADDITIVE-ONLY / node-sarif-builder / v0.3.0 / UNTRIGGERED in 32-ADDITIVE-AUDIT.md; ASCII-only confirmed"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-19
status: complete
---

# Phase 32 Plan 3: ADD-01 additive-only audit Summary

**`32-ADDITIVE-AUDIT.md` records the release-gating verdict for the whole v0.2.3 milestone (Phases 30-32) vs `angular-typechecker@0.2.2`: the published surface is byte-additive (barrel/builder/executor-id/generator-schemas UNCHANGED; the executor+builder schemas WIDEN-ONLY by the optional `format` enum; `CoreResult.totalFilesCount` ADDITIVE), the plugin `dependencies` gained EXACTLY `node-sarif-builder` (ajv/ajv-formats are dev-only ROOT devDeps), and every standing guard is green -- so ADDITIVE-ONLY HOLDS, v0.3.0 stays UNTRIGGERED, and the version is held at 0.2.2.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-19T01:19:10Z
- **Completed:** 2026-07-19T01:25:38Z
- **Tasks:** 2
- **Files modified:** 1 (1 created)

## Accomplishments
- Confirmed the baseline `angular-typechecker@0.2.2` tag (`6d3214d`) and captured HEAD (`6ca7628`, 91 commits in range), then ran `git diff @0.2.2..HEAD` per published path and recorded a verdict for each.
- Proved the dependency crux: the plugin `dependencies` gained EXACTLY `node-sarif-builder@^4.1.0` since `@0.2.2`; the negated-quiet idiom (`! git show HEAD:packages/angular-typechecker/package.json | rg -q 'ajv'`) passes, and `ajv@^8.20.0` / `ajv-formats@^3.0.1` are ROOT (`private:true`) devDependencies only.
- Proved the reporter modules are net-new by construction (`git ls-tree -r @0.2.2` returns 0 files for `core/{json-report,sarif-report,diagnostic-record,extended-catalog}.ts`; HEAD has 1 each), and none is on the `src/index.ts` barrel.
- Re-confirmed the standing guards green in-phase: `nx typecheck` (3 tsc incl. `tsconfig.drift.json` barrel-drift, leg a), `nx lint` (`maxWarnings:0`, dependency-checks leg c -- `node-sarif-builder` NOT in `ignoredDependencies`, A1), `nx test` (51 files / 534 tests -- surface-regression + schema-parity), `nx format:check`.
- Classified the two non-source diffs the sibling plans flagged: the `project.json` asset-glob `ignore:['**/__snapshots__/**']` (32-02 packaging fix) and the executor/builder `schema.json` `format` description rewordings + `HELP_TEXT` prose (32-04) are recorded as NON-BREAKING (build-config + description-string only).
- Authored `32-ADDITIVE-AUDIT.md` mirroring the shipped `27-ADDITIVE-AUDIT.md` five-section structure; verdict: ADDITIVE-ONLY HOLDS, v0.3.0 UNTRIGGERED, version stays 0.2.2.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gather the additive-only git-diff + dependency + barrel/lint/typecheck evidence** - `d6c8b0e` (docs)
2. **Task 2: Author the ADD-01 disposition + ADDITIVE-ONLY verdict** - `5419309` (docs)

## Files Created/Modified
- `.planning/phases/32-verification-docs-additive-audit/32-ADDITIVE-AUDIT.md` - The ADD-01 additive-only verdict vs `angular-typechecker@0.2.2` (five sections: header+verdict, guard cross-check map, git-diff verdict per path, new-file additions, ADD-01 disposition), mirroring `27-ADDITIVE-AUDIT.md`.

## Decisions Made
- **The two consumer-observable public-surface changes are widen-only/additive, not breaking:** the OPTIONAL `format` enum (`enum ["human","json","sarif"]`, `default "human"`) added to the executor + builder `schema.json`/`schema.d.ts` with `required`/`additionalProperties` unchanged, and the OPTIONAL `CoreResult.totalFilesCount`. Omitting `format` yields byte-identical `0.2.2` human output.
- **`node-sarif-builder` is the ONLY new runtime dependency and is correctly classified** -- `nx lint` at `maxWarnings:0` is green with it NOT in `ignoredDependencies` (the ignore list is only `nx`, `@angular-devkit/architect`, `@angular-devkit/schematics`, `rxjs`), so `@nx/dependency-checks` SEES the lazy `await import('node-sarif-builder')` (A1). Not re-litigated (resolved Phase 31 31-01).
- **The sibling-plan build/docs diffs are non-breaking** and are called out explicitly in the audit so a reviewer is not surprised by a `project.json` diff (packaging) or two schema `description`-line diffs (prose).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the audit doc ASCII-only (removed a stray ellipsis)**
- **Found during:** Task 2 overall verification (the plan's ASCII-only + hygiene gate).
- **Issue:** One table cell authored in the Task 1 pass carried a Unicode ellipsis (`U+2026`) in the `e2e/*/...` reference, violating the plan's ASCII-only constraint (and the repo's no-non-ASCII rule).
- **Fix:** Replaced it with ASCII `...`; re-verified `rg -nP '[^\x00-\x7F]'` finds nothing.
- **Files modified:** `32-ADDITIVE-AUDIT.md`
- **Verification:** ASCII-only check passes; the `ADDITIVE-ONLY`/`node-sarif-builder`/`v0.3.0`/`UNTRIGGERED` content asserts all pass.
- **Committed in:** `5419309` (folded into the Task 2 commit).

---

**Total deviations:** 1 auto-fixed (ASCII hygiene). No scope creep -- the audit records the git-diff evidence exactly as the plan specified.
**Impact on plan:** none; the "email token" matches flagged by the hygiene grep were false positives (git refspecs `angular-typechecker@0.2.2..HEAD`, not emails). No work email or bare work domain is present.

## Issues Encountered
- None. The audit re-ran the standing guards live (typecheck, lint, test, format:check) rather than trusting the sibling SUMMARYs; all green.

## Known Stubs
None - the audit is a records-and-verdict document over already-shipped, already-tested surface.

## Threat Flags
None - this plan writes an audit document over a frozen published surface; it adds no code, no dependency, no network/auth/file surface. T-32-SC (dependency drift) and T-32-04 (contract break) are both mitigated by the recorded dependency-diff + barrel-drift/schema-parity guard evidence.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ADD-01 is the last of Phase 32's four requirements (VER-02 in 32-01, VER-03 in 32-02, DOC-01 in 32-04). The additive-only verdict is the release-gating input for the eventual human-gated v0.2.3 Release-PR (version bump `0.2.2 -> 0.2.3` + tag `angular-typechecker@0.2.3` + npm publish -- NOT part of this phase).
- All standing guards green in-phase: `nx typecheck` (barrel drift), `nx lint` (dependency-checks, maxWarnings:0), `nx test` (51 files / 534 tests), `nx format:check`.

## Self-Check: PASSED

- Created file exists: `.planning/phases/32-verification-docs-additive-audit/32-ADDITIVE-AUDIT.md`.
- Both task commits present: `d6c8b0e`, `5419309`.
- Verdict recorded: ADDITIVE-ONLY HOLDS; `node-sarif-builder` the ONLY new runtime dep; `v0.3.0` UNTRIGGERED; version stays `0.2.2`. Doc is ASCII-only with no work-email/work-domain leak.

---
*Phase: 32-verification-docs-additive-audit*
*Completed: 2026-07-19*
