---
phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode
plan: 02
subsystem: testing
tags: [storybook, composition, nx-graph, e2e, verdaccio, typecheck, refs, dependsOn]

# Dependency graph
requires:
  - phase: 17-18 (Storybook Layout A/B)
    provides: the consumer-storybook-a/b Layout-A fixtures + the Verdaccio nx-add packaged-tarball e2e harness (storybook-tarball.int.spec.ts) this plan mirrors
provides:
  - Storybook Composition as a supported TOPOLOGY with ZERO engine code (per-project typecheck + Nx graph fan-out)
  - a synthetic-hybrid Composition fixture (2 Layout-A composed libs + a composing host with refs + implicitDependencies + dependsOn:['^typecheck'])
  - Composition negative tests: broken composed story (own target + fan-out), mistyped host refs, plus a clean baseline
affects: [19-03 (README ## Storybook Composition docs recipe rests on this exercised fixture), milestone verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composition = per-project Layout-A + Nx graph fan-out; the graph edge (implicitDependencies), never the ref URL, is the source of truth (D-04)"
    - "dependsOn:['^typecheck'] on the host fans the check out over the composed set (D-05 recipe, exercised by the fan-out negative)"
    - "Multi-project e2e fixtures must be excluded from the dev Nx graph via .nxignore (name collisions + pre-committed executor targets)"

key-files:
  created:
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/** (20 files: nx.json, package.json; lib-buttons/, lib-cards/, storybook-host/)
    - e2e/angular-typechecker-install-e2e/src/storybook-composition.int.spec.ts
  modified:
    - .nxignore (exclude the Composition fixture from the dev graph)

key-decisions:
  - "Host refs typed against a locally-declared CompositionRef shape (Storybook types StorybookConfig['refs'] as `any`, so a bare object gives no type safety)"
  - "Composition fixture excluded from the dev Nx graph via .nxignore (matrix-e2e precedent): storybook-host name collision + pre-committed typecheck targets"
  - "Spec is a NEW FILE in the EXISTING angular-typechecker-install-e2e project (never a new e2e project -- shared-tarball serialization)"

patterns-established:
  - "Pattern: Composition negative test = plant into a composed lib's own story (own-target fail) THEN run the host (dependsOn:['^typecheck'] fan-out fail), plant-then-restore around a shared beforeAll install"
  - "Pattern: when a vendor type is `any`, a fixture demonstrating type-checking declares its own shape (the realistic consumer pattern)"

requirements-completed: [SB-08]

# Metrics
duration: 35min
completed: 2026-07-07
---

# Phase 19 Plan 02: Storybook Composition topology (fixture + e2e) Summary

**Storybook Composition ships as a supported multi-project topology with ZERO engine code: a synthetic-hybrid fixture (2 Layout-A composed libs + a composing host) proves per-project `typecheck` + the `dependsOn:['^typecheck']` Nx graph fan-out catch a broken composed story and a mistyped host `refs` entry, with a clean baseline passing first.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-07T00:44Z (approx)
- **Completed:** 2026-07-07T01:18:39+02:00
- **Tasks:** 2
- **Files modified:** 22 (21 created + `.nxignore`)

## Accomplishments
- Committed a synthetic-hybrid Composition workspace: `lib-buttons` + `lib-cards` (each a Layout-A project with a `angular-typechecker:typecheck` target on its solution tsconfig) + a `storybook-host` with `implicitDependencies` on both libs and a `typecheck` target carrying `dependsOn:['^typecheck']`.
- Added `storybook-composition.int.spec.ts` (a NEW file in the EXISTING serialized install-e2e project) proving four behaviors against the SHIPPED tarball + real `@storybook/angular@10.4.6`: clean baseline exits 0; a broken composed story fails its OWN target (TS2322) AND the host fan-out; a mistyped host `refs` entry fails on an ordinary TS diagnostic.
- No engine change (D-04): `run-typecheck.ts` / `filter-diagnostics.ts` / `walk-references.ts` / `evaluate-result.ts` untouched.

## Task Commits

1. **Task 1: Build the synthetic-hybrid Composition fixture** - `e6bb3f5` (test)
2. **Fixture correction: type host refs + exclude fixture from dev graph** - `7b24c68` (test) [deviations, see below]
3. **Task 2: The Composition e2e spec** - `96e86cd` (test)

_All three commits are `test` type (e2e fixtures + spec): hidden from the changelog and outside `packages/angular-typechecker/`, so they do not bump the released version._

## Files Created/Modified
- `.../consumer-storybook-composition/nx.json`, `package.json` - workspace root (namedInputs reused from consumer-storybook-b; Angular 22.0.4 / nx 23.0.1 / typescript 6.0.3 deps)
- `.../lib-buttons/` and `.../lib-cards/` - each a Layout-A composed lib: `project.json` (typecheck target), solution `tsconfig.json` + `tsconfig.app.json` + `.storybook/tsconfig.json`, a clean standalone component, a clean story with a plantable `count` anchor, `.storybook/main.ts` (`Partial<StorybookConfig> = {}`)
- `.../storybook-host/project.json` - `implicitDependencies: ["lib-buttons","lib-cards"]` + typecheck target with `dependsOn:["^typecheck"]`
- `.../storybook-host/.storybook/main.ts` - typed refs object (locally-declared `CompositionRef` shape) with a plantable clean `url` anchor
- `e2e/angular-typechecker-install-e2e/src/storybook-composition.int.spec.ts` - the Composition e2e (baseline + 2 negatives + fan-out)
- `.nxignore` - exclude the Composition fixture from the dev Nx graph

## Decisions Made
- **Host refs typing.** `StorybookConfig['refs']` is `any` in `@storybook/angular@10.4.6` (verified: `r.anything.deeply.nested` compiles), so a bare refs object carries no type safety. Typed the host refs against a locally-declared `CompositionRef { title: string; url: string }` -- the realistic consumer pattern -- so a numeric `url` is a plain TS error on `main.ts` while the committed baseline stays clean.
- **Dev-graph exclusion.** Excluded the fixture from the dev Nx graph via `.nxignore` (matrix-e2e precedent).
- **Spec placement.** New file in the existing install-e2e project (shared-tarball serialization; never a new e2e project).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Host `refs` was not type-checked because Storybook types `refs` as `any`**
- **Found during:** Task 2 (the mistyped-refs scenario failed -- `url: 123` produced exit 0)
- **Issue:** The plan (and 19-RESEARCH Pattern 3) assumed typing the host refs via `StorybookConfig['refs']` would make a numeric `url` a TS error. It does not: `@storybook/angular@10.4.6` types `StorybookConfig['refs']` as `any`, so every mistyped value passes. This would have shipped a Composition "mistyped refs FAILs" claim with a negative test that never fails -- a false-green.
- **Fix:** Declared a local `CompositionRef { title: string; url: string }` interface in the host `main.ts` and typed the refs as `Record<string, CompositionRef>`. A numeric `url` now errors (TS2322) while the baseline stays clean. This is the realistic consumer pattern (a consumer wanting the host config type-checked declares the ref shape). Verified in a scratch `@storybook/angular@10.4.6` install and then in the full e2e.
- **Files modified:** `.../storybook-host/.storybook/main.ts`
- **Verification:** scratch tsc probe (baseline clean, `url:123` -> TS2322) + the full e2e spec's mistyped-refs scenario now fails as intended
- **Committed in:** `7b24c68`

**2. [Rule 3 - Blocking] Fixture projects collided in / polluted the dev Nx graph**
- **Found during:** Task 2 (globalSetup `nx build` failed: "projects defined in multiple locations: storybook-host")
- **Issue:** Nx discovers fixture `project.json` files into the dev workspace graph. The Composition fixture's `storybook-host` name collides with `consumer-storybook-b`'s `storybook-host`, and its PRE-COMMITTED `angular-typechecker:typecheck` targets (the Composition topology requires them committed, not generated at test time) would be swept into an unscoped `nx run-many -t typecheck` with dev-root tsConfig paths that do not resolve.
- **Fix:** Excluded `e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/` from the dev graph via `.nxignore`, following the existing `matrix-e2e/fixtures/` precedent. The tmp-copied workspace (a separate nx workspace) still discovers all three projects.
- **Files modified:** `.nxignore`
- **Verification:** `nx show projects` lists no `lib-buttons`/`lib-cards` and a single `storybook-host` (consumer-storybook-b's), with no "Failed to process" error; the e2e globalSetup build succeeds.
- **Committed in:** `7b24c68`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were necessary for a genuinely-failing negative test and a runnable e2e. No scope creep -- no engine change, no new e2e project. The plan's `StorybookConfig['refs']` typing suggestion (also in 19-RESEARCH Pattern 3) is factually corrected: 19-03 docs should NOT claim Storybook's own types catch a bad ref.

## Issues Encountered
- The full install-e2e suite is expensive (build + Verdaccio publish + Angular/Storybook install per describe). Verified this plan's spec in isolation via `vitest run ... storybook-composition` (globalSetup still builds+publishes once); all 3 scenarios pass in ~217s. The full serialized suite gate is a post-merge/orchestrator concern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 19-03 (README `## Storybook` Composition recipe) can now document the `dependsOn:['^typecheck']` fan-out against an EXERCISED fixture. IMPORTANT for 19-03: do NOT claim Storybook's own `refs` type catches a mistyped entry -- it is `any`; the coverage claim rests on per-project `typecheck` + graph fan-out (and, for host-config type safety, a consumer-declared ref shape).
- No blockers.

## Self-Check: PASSED

- All created files verified present (fixture root, both libs, host, spec, `.nxignore`).
- All three task commits verified in git log (`e6bb3f5`, `7b24c68`, `96e86cd`).
- Composition e2e spec run in isolation: 3/3 scenarios pass (clean baseline, broken story own-target + fan-out, mistyped refs).
- Prettier + ESLint clean on the new spec; dev Nx graph healthy (no duplicate project, composition projects excluded).

---
*Phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode*
*Completed: 2026-07-07*
