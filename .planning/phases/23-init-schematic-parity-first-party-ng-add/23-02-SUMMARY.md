---
phase: 23-init-schematic-parity-first-party-ng-add
plan: 02
subsystem: infra
tags: [nx-plugin, package-json, peer-dependencies, ng-add, eslint, dependency-checks, angular-cli]

# Dependency graph
requires:
  - phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no
    provides: the convertNxExecutor-produced angular-typechecker:typecheck builder whose runtime peers (@angular-devkit/architect, rxjs) this plan classifies
  - phase: 22-configuration-schematic-the-angular-json-write-fork
    provides: the shared configuration write-fork that Plan 03's ng-add composes; the schematics/collection.json surface these manifest fields extend
provides:
  - "@angular-devkit/architect (^0.2200.0) + rxjs (^7.8.0) declared as OPTIONAL peerDependencies (peerDependenciesMeta.<dep>.optional: true)"
  - "top-level ng-add.save: devDependencies so `ng add angular-typechecker` installs a dev tool into devDependencies (RF-01)"
  - "@nx/dependency-checks ignoredDependencies lever keeping nx lint green after the two optional peers"
  - "static package-manifest contract test locking ng-add.save, the two optional peer ranges, and peerDependenciesMeta.optional"
affects: [23-03-ng-add-generator, phase-24-e2e, phase-24-additive-audit, phase-24-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional peer classification for require()s that live inside @nx/devkit (invisible to the plugin's own dep linter)"
    - "ng-add.save manifest field as the Angular-native devDependency install-placement lever (precedent @angular-eslint/schematics)"
    - "@nx/dependency-checks ignoredDependencies (hand-edited, never eslint --fix) to exempt declared-but-unimported peers from the obsolete check"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/eslint.config.mjs
    - packages/angular-typechecker/src/package-manifest.spec.ts

key-decisions:
  - "D-07: @angular-devkit/architect + rxjs are OPTIONAL peers; nx is NOT declared (flows in transitively via @nx/devkit's peer; the .nx/ dir consequence is accepted + documented as a code comment)"
  - "D-08: ignoredDependencies is the exact @nx/dependency-checks lever (peerDependenciesMeta.optional does NOT exempt from the obsolete check); added by hand, checkVersionMismatches:false preserved"
  - "RF-01: ng-add.save: devDependencies is the manifest field (not addDependenciesToPackageJson) that places the ng add install into devDependencies"

patterns-established:
  - "Pattern: classify a converted-bridge's hidden runtime require()s as optional peers + exempt them via ignoredDependencies to keep the dep-checks gate green"
  - "Pattern: static filesystem manifest-contract spec (fast tier, no compiler-cli load) guards additive package.json fields against regression"

requirements-completed: [ACP-01, NGADD-01]

# Metrics
duration: 3min
completed: 2026-07-10
---

# Phase 23 Plan 02: Optional-peer classification + ng-add install placement Summary

**Declared @angular-devkit/architect (^0.2200.0) + rxjs (^7.8.0) as OPTIONAL peerDependencies, set ng-add.save: devDependencies for Angular-CLI install placement, and kept nx lint green via a hand-added @nx/dependency-checks ignoredDependencies lever, all locked by a static manifest contract spec.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-10T22:38:02Z
- **Completed:** 2026-07-10T22:40:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ACP-01 (D-07): package.json declares the two converted-builder runtime peers as OPTIONAL (peerDependenciesMeta.optional: true); nx remains undeclared (transitive via @nx/devkit).
- ACP-01 (D-08): both peers added by hand to the @nx/dependency-checks ignoredDependencies array with a doc comment covering WHY (require()s live inside @nx/devkit) AND the nx-transitive/.nx dir consequence; nx lint green (maxWarnings:0), checkVersionMismatches:false preserved.
- NGADD-01 (RF-01): top-level ng-add.save: devDependencies field added so `ng add angular-typechecker` installs into devDependencies.
- Static manifest contract spec (package-manifest.spec.ts) extended with a new ACP-01/RF-01 describe block; all 297 tests green (was 293).

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare optional peers + peerDependenciesMeta + ng-add.save; add the @nx/dependency-checks ignoredDependencies lever + doc comment** - `4552a34` (feat)
2. **Task 2: Static manifest contract spec for ng-add.save + optional peers + peerDependenciesMeta.optional** - `3144fa2` (test)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `packages/angular-typechecker/package.json` - added the two optional peers + peerDependenciesMeta + the top-level ng-add.save field (executors/generators/builders/schematics/files/dependencies untouched; nx not declared)
- `packages/angular-typechecker/eslint.config.mjs` - added ignoredDependencies: ['@angular-devkit/architect', 'rxjs'] to the @nx/dependency-checks rule-options object with a doc comment (checkVersionMismatches:false + ignoredFiles preserved)
- `packages/angular-typechecker/src/package-manifest.spec.ts` - extended PluginManifest (peerDependenciesMeta, ng-add.save) and added the ACP-01/RF-01 describe block

## Decisions Made
None new - followed the plan (D-07, D-08, RF-01) as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The published manifest surface for the Angular CLI install path is complete: Plan 03 (the ng-add generator) can compose without touching package.json (this plan owns ALL manifest edits).
- The optional peers + ignoredDependencies keep the CI lint gate green; Phase 24's additive-only audit + real-OSS e2e can verify the shipped install placement end-to-end.
- Verified beyond the plan's automated checks: nx build green and the built dist/packages/angular-typechecker/package.json carries all three additive fields (ng-add.save, both optional peers, peerDependenciesMeta.optional) so the eventual published tarball is correct.

## Self-Check: PASSED

All 3 modified files present; all 3 commits (4552a34, 3144fa2, b8ed004) exist in history.

---
*Phase: 23-init-schematic-parity-first-party-ng-add*
*Completed: 2026-07-10*
