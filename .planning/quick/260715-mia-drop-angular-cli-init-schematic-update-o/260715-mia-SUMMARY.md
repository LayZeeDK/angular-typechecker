---
status: complete
quick_id: 260715-mia
plan: 01
subsystem: schematics / Angular CLI surface
tags: [surface-symmetry, schematics, ng-add, init, cleanup]
requires: []
provides:
  - "collection.json Angular CLI surface = { ng-add, configuration } (init schematic dropped)"
  - "ng-add schema relocated to src/schematics/ng-add/ + type renamed NgAddSchema"
affects:
  - packages/angular-typechecker/collection.json
  - packages/angular-typechecker/src/schematics
key-files:
  created: []
  modified:
    - packages/angular-typechecker/collection.json
    - packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts
    - packages/angular-typechecker/src/schematics/ng-add/schematic.ts
    - packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts
    - packages/angular-typechecker/src/schematics/ng-add/schema.json
    - packages/angular-typechecker/src/schematics/ng-add/schema.d.ts
  deleted:
    - packages/angular-typechecker/src/schematics/init/schematic.ts
  moved:
    - "src/generators/ng-add/schema.json -> src/schematics/ng-add/schema.json"
    - "src/generators/ng-add/schema.d.ts -> src/schematics/ng-add/schema.d.ts"
decisions:
  - "init schematic dropped from the Angular CLI surface; init stays the Nx-only post-install hook (nx add -> <pkg>:init, nx g :init) via the UNTOUCHED init GENERATOR"
  - "ng-add schema moved beside its schematic and NgAddGeneratorSchema renamed to NgAddSchema (ng-add is a schematic, not a generator)"
  - "milestone audit edit left UNCOMMITTED for the orchestrator (do not commit .planning/ in a code commit)"
metrics:
  duration: ~7 min
  completed: 2026-07-15
---

# Quick 260715-mia: Drop Angular CLI init schematic + relocate ng-add schema Summary

Surface-symmetry cleanup: dropped the redundant `ng generate angular-typechecker:init` Angular CLI
schematic (init stays the Nx-only post-install hook via the untouched init GENERATOR), and relocated
the misplaced ng-add schema out of `src/generators/` beside its schematic, renaming its vestigial
`NgAddGeneratorSchema` type to `NgAddSchema`. All four gates plus the dist-ship gate pass; the Nx
surface (`generators.json`) is byte-unchanged.

## Tasks

- Task 1 -- Drop the init schematic from the Angular CLI surface: DONE (commit b53f096)
- Task 2 -- Relocate the ng-add schema out of the generators tree + de-"Generator" its type: DONE (commit 4d246a0)
- Task 3 -- Regression gates + dist-ship gate + surgical milestone-audit honesty edit: DONE (audit edit uncommitted)

## Files changed

Commit 1 (b53f096) `refactor(schematics): drop redundant Angular CLI init schematic`:
- `packages/angular-typechecker/collection.json` -- removed the `"init"` schematics entry (surface now = { ng-add, configuration })
- `packages/angular-typechecker/src/schematics/configuration/nx-generators-surface-regression.spec.ts` -- inverted the init assertion in place (now asserts `collectionManifest.schematics?.init` is `toBeUndefined()`); 6 sibling contracts unchanged
- `packages/angular-typechecker/src/schematics/init/schematic.ts` -- deleted via `git rm`

Commit 2 (4d246a0) `refactor(schematics): move ng-add schema out of the generators tree`:
- `git mv` `src/generators/ng-add/schema.json` -> `src/schematics/ng-add/schema.json`
- `git mv` `src/generators/ng-add/schema.d.ts` -> `src/schematics/ng-add/schema.d.ts`
- removed the emptied `src/generators/ng-add/` dir (`rmdir`)
- `packages/angular-typechecker/collection.json` -- repointed ng-add `schema` to `./src/schematics/ng-add/schema.json`
- `src/schematics/ng-add/schematic.ts` -- import path `-> './schema'`; param type `NgAddSchema`
- `src/schematics/ng-add/ng-add.spec.ts` -- import path `-> './schema'`; helper type `NgAddSchema`
- `src/schematics/ng-add/schema.d.ts` -- interface renamed `NgAddGeneratorSchema -> NgAddSchema`
- `src/schematics/ng-add/schema.json` -- `$id` renamed to `NgAddSchema`

Uncommitted (left for the orchestrator, NOT staged into a code commit):
- `.planning/v0.2.1-MILESTONE-AUDIT.md` -- four surgical INIT-HALF honesty edits (ACS-03 evidence row; 8th-seam WIRED note; Resolved-Debt block supersession pointer; frontmatter resolved_debt supersession pointer). No ng-add audit edit (relocation is internal). Scores/structure untouched; the init GENERATOR / `nx add` / `nx g :init` statements and ACS-03's no-stray-nx.json guarantee preserved.

## Gate results (Task 3, MAIN checkout)

- `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` -- PASS (build succeeded against trimmed collection.json + relocated ng-add schema)
- Dist-ship gate -- PASS:
  - `dist/packages/angular-typechecker/src/schematics/ng-add/schema.json` PRESENT
  - `dist/packages/angular-typechecker/src/schematics/ng-add/schema.d.ts` PRESENT
  - `dist/packages/angular-typechecker/src/generators/ng-add` GONE
  - (also confirmed `dist/.../src/schematics/init/schematic.js` GONE)
- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -- PASS (39 files, 373 tests). Surface-regression spec = 7 tests (inverted init-absent assertion green); ng-add spec = 13 tests green; init GENERATOR specs (init-angular-cli 5, target-defaults-drift 1, schema-parity 3) green. Test count stayed 373 (as the plan predicted -- in-place invert keeps the `it` block).
- `npx nx lint angular-typechecker` -- PASS (All files pass linting; maxWarnings:0)
- `npx nx format:check` -- PASS (exit 0)

## Invariants confirmed

- `generators.json` (the Nx surface) is byte-unchanged (not touched by either commit; clean in the working tree).
- The init GENERATOR specs stayed green (init CLI early-return fork / no-stray-nx.json guarantee intact).
- No `NgAddGeneratorSchema` or `generators/ng-add/schema` reference remains anywhere under `packages/` (git grep empty).
- No version bump (package.json stays 0.2.0), no release, no e2e tier.
- README untouched (NON-GOAL).

## Deviations from Plan

None substantive. One process note: the initial Task 1 commit's `git add` included the already-`git rm`'d
init `schematic.ts` pathspec, which errored (the file no longer exists on disk) and aborted staging of the
other two files, so only the pre-staged deletion committed. Amended the commit (`git commit --amend`,
unpushed) to include `collection.json` + the surface-regression spec -- final commit b53f096 carries all
three changes. No functional impact.

## Self-Check: PASSED
- collection.json surface = { ng-add, configuration }: FOUND
- ng-add schema at src/schematics/ng-add/ (json + d.ts): FOUND
- src/generators/ng-add removed: CONFIRMED
- init schematic.ts removed: CONFIRMED
- commit b53f096: FOUND
- commit 4d246a0: FOUND
