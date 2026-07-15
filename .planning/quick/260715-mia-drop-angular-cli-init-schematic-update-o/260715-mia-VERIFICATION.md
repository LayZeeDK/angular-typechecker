---
phase: quick/260715-mia
verified: 2026-07-15T14:46:44Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Quick 260715-mia: Drop Angular CLI init schematic + relocate ng-add schema Verification Report

**Task Goal:** Complete the surface-symmetry cleanup so each install hook lives only on its own ecosystem's surface -- (1) drop the redundant Angular CLI `init` schematic; (2) relocate the `ng-add` schema out of the Nx `src/generators/` tree into `src/schematics/ng-add/` and rename `NgAddGeneratorSchema` -> `NgAddSchema`. The Nx surface (generators.json + init GENERATOR) stays UNCHANGED.
**Verified:** 2026-07-15T14:46:44Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | collection.json exposes exactly { ng-add, configuration }; no init | VERIFIED | `collection.json` L3-14: `schematics` = { `ng-add`, `configuration` }, no `init` key. |
| 2 | init schematic source gone; `ng generate angular-typechecker:init` no longer resolvable | VERIFIED | `git ls-files src/schematics/init/` returns NOTHING; `schematic.ts` git-removed in b53f096 (-20 lines). Dir empty on disk (untracked; git ignores empty dirs). |
| 3 | Nx surface UNCHANGED: generators.json still { configuration, init }; nx add -> `<pkg>:init` intact | VERIFIED | `git log 5ca7891..HEAD -- generators.json` = UNCHANGED; `git log 5ca7891..HEAD -- src/generators/init/` = UNCHANGED. `generators.json` L6-16 declares configuration + init; init factory `./src/generators/init/generator`. Surface-regression spec L68-72 asserts it. |
| 4 | ng-add has ZERO footprint under src/generators/; schema lives beside schematic under src/schematics/ng-add/ | VERIFIED | `ls src/generators/ng-add/` exit 2 (gone). `src/schematics/ng-add/` holds schema.json + schema.d.ts + schematic.ts + ng-add.spec.ts. 4d246a0 shows renames `{generators => schematics}/ng-add/schema.{json,d.ts}`. |
| 5 | Type `NgAddGeneratorSchema` renamed to `NgAddSchema` | VERIFIED | `git grep NgAddGeneratorSchema -- packages/` = NONE. `NgAddSchema` present in schema.d.ts (interface), schema.json (`$id`), schematic.ts (import + param), ng-add.spec.ts (import + helper) -- all 6 sites. |
| 6 | ng add resolves schema from dist at new path; old dist path gone | VERIFIED | dist has `src/schematics/ng-add/schema.json` + `schema.d.ts` (built 16:39, after commits); `dist/.../src/generators/ng-add` exit 2; `dist/.../src/schematics/init` exit 2. |
| 7 | Surface-regression spec asserts init ABSENT + 6 unchanged siblings, green | VERIFIED | spec L64-66 asserts `collectionManifest.schematics?.init` `toBeUndefined()`; 7 `it` blocks total (6 siblings intact incl. both Nx-surface locks). Runs green (7 tests). |
| 8 | build, test, lint, format:check all pass on main checkout | VERIFIED | test: 39 files / 373 tests passed; lint: "All files pass linting" (maxWarnings:0); format:check: exit 0; build dist reflects changes. |
| 9 | Milestone audit no longer presents `ng generate :init` schematic as wired/verified; ACS-03 no-stray-nx.json guarantee preserved | VERIFIED | `.planning/v0.2.1-MILESTONE-AUDIT.md` shows uncommitted (M) working-tree edit per plan design (orchestrator commits it separately); init GENERATOR statements + ACS-03 guarantee untouched (generators/init unchanged in git). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `collection.json` | { ng-add, configuration }; ng-add schema -> src/schematics/ng-add/schema.json | VERIFIED | ng-add `schema` = `./src/schematics/ng-add/schema.json`, factory `./src/schematics/ng-add/schematic`; init removed. |
| `src/schematics/ng-add/schema.json` | Relocated, `$id` = NgAddSchema | VERIFIED | `$id: "NgAddSchema"`; schema SHAPE (project, skipFormat, additionalProperties:false) unchanged. |
| `nx-generators-surface-regression.spec.ts` | init-absent assertion + 6 contracts | VERIFIED | `toBeUndefined()` on init; 7 `it` blocks; passes. |
| `generators.json` | Nx surface byte-unchanged | VERIFIED | Not touched by either commit; unchanged since 5ca7891. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| collection.json | src/schematics/init/schematic.ts | factory-path string (both refs removed) | VERIFIED | init entry removed from collection.json; schematic.ts git-removed. |
| collection.json | src/schematics/ng-add/schema.json | ng-add `schema` repointed | VERIFIED | Pointer = `./src/schematics/ng-add/schema.json`; file exists in src and dist. |
| generators.json | src/generators/init/generator.ts | init GENERATOR factory (untouched) | VERIFIED | Factory `./src/generators/init/generator` intact; generator + specs unchanged. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit test target green (surface-regression, ng-add, init GENERATOR specs) | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 39 files / 373 tests passed | PASS |
| Lint clean (maxWarnings:0) | `npx nx lint angular-typechecker` | All files pass linting | PASS |
| Format clean | `npx nx format:check` | exit 0 | PASS |
| Dist ships ng-add schema at new path, not old | `ls dist/.../src/schematics/ng-add` + `ls dist/.../src/generators/ng-add` | new PRESENT; old GONE (exit 2) | PASS |
| No stale type/path refs | `git grep NgAddGeneratorSchema` / `generators/ng-add/schema` | NONE | PASS |
| No version bump | `node -e print package.json version` | 0.2.0 | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/angular-cli-wiring.ts | 28 | comment references `generators/ng-add/generator.ts` | Info | Accurate historical provenance note for a file deleted in 24-06; NOT a defect (confirmed it is a comment, not a code reference). |
| src/schematics/ng-add/ng-add.spec.ts | 20 | comment references deleted `generators/ng-add/ng-add.spec.ts` | Info | Accurate provenance note; NOT a defect. |

No blocking or warning anti-patterns. No debt markers introduced.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| ACS-04 | Angular CLI surface-symmetry cleanup (init dropped from collection.json) | SATISFIED | collection.json trimmed; surface-regression spec inverted + green. |
| ACS-03 | init generator no-stray-nx.json guarantee preserved (only redundant CLI schematic removed) | SATISFIED | init GENERATOR + specs untouched (git log confirms); milestone-audit honesty edit reflects the drop without touching the guarantee. |
| NGADD-01 | ng-add schema relocated + type renamed, consumer surface unchanged | SATISFIED | Schema moved to src/schematics/ng-add/; NgAddSchema rename applied; dist ships same schema shape at new path. |

### Human Verification Required

None. All truths are programmatically verifiable and were verified against the codebase, git history, the built dist, and the test/lint/format gates.

### Gaps Summary

No gaps. Both halves of the surface-symmetry cleanup are complete and verified in the codebase:

- The Angular CLI `init` schematic is git-removed and absent from collection.json; the surface-regression spec now asserts its absence (7 tests green).
- The ng-add schema is relocated to `src/schematics/ng-add/` (zero footprint under `src/generators/`), the `$id`/interface renamed `NgAddSchema`, all 6 references updated, and the collection.json pointer repointed.
- The Nx surface (generators.json + init GENERATOR + specs) is byte-unchanged since the pre-task commit 5ca7891; the `nx add -> <pkg>:init` seam is intact.
- Both commits exist (b53f096, 4d246a0); the two "generators/ng-add" mentions remaining are accurate historical comments, not defects.
- Gates green: test 373, lint (maxWarnings:0), format:check; dist ships the ng-add schema at the new path and not the old, no init schematic in dist.
- No version bump (0.2.0), no release. The consumer-visible surface is intended UNCHANGED (same schema shape resolved from the new dist path; type rename internal) -- confirmed, not a gap.
- The milestone-audit edit is uncommitted (M) in the working tree by design -- the orchestrator commits `.planning/` separately.

---

_Verified: 2026-07-15T14:46:44Z_
_Verifier: Claude (gsd-verifier)_
