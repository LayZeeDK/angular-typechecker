---
phase: 04-nx-executor-adapter-cacheable-target
plan: 02
subsystem: nx-cache-config
tags: [nx-targetdefaults, nx-cache, nx-inputs, project-graph, angular-lib-fixture, tsconfig-paths]

# Dependency graph
requires:
  - phase: 04-nx-executor-adapter-cacheable-target
    provides: "the completed angular-typecheck executor (04-01) whose id keys the cacheable targetDefault; renderReport/normalize-options adapter slice"
  - phase: 03-filtering-modes-output-quality-gates
    provides: "the project-boundary filter so a dep error inlined into the consumer program is reported under the default filter"
provides:
  - "nx.json executor-id-keyed cacheable targetDefault angular-typechecker:angular-typecheck (cache true, outputs [], ^default inlined-source inputs recipe) (D-07/D-08/D-09)"
  - "tsconfig.base.json namespaced @fixtures/typecheck-consumer-dep alias to SOURCE (forms the consumer->dep Nx graph edge) (D-11)"
  - "libs/typecheck-consumer-dep: NON-buildable committed Angular-lib fixture (no build target) + .pristine sidecar for crash-safe revert (D-11/D-15)"
  - "libs/typecheck-consumer: committed Angular-lib fixture carrying the angular-typecheck target, statically importing the dep via the @fixtures alias (D-11)"
  - "R1 edge guard evidence (D-10): the dep source IS an input for the consumer target (nx show target inputs --check exit 0), so ^default reaches the dep source"
affects: [04-03-cache-correctness, 05-packaging-publish, 06-e2e-matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Executor-id-keyed cacheable targetDefault (beats target-name key): the cache config lives once in nx.json; fixture project.json just wires the target, never repeats cache/outputs/inputs"
    - "^default (inlined-source) cache model, NOT @nx/js's ^production/project-references model: Angular has no TS project references, so the non-buildable dep SOURCE must be hashed (D-09)"
    - "tsconfig.base.json paths-alias-to-SOURCE (relative ./libs/... value) forms the Nx project-graph edge automatically (analyzeSourceFiles true), so ^default reaches the dep without implicitDependencies"
    - ".pristine sidecar of the TEST-04 mutation target for crash-safe heal (D-15)"

key-files:
  created:
    - libs/typecheck-consumer-dep/project.json
    - libs/typecheck-consumer-dep/package.json
    - libs/typecheck-consumer-dep/tsconfig.json
    - libs/typecheck-consumer-dep/tsconfig.lib.json
    - libs/typecheck-consumer-dep/src/index.ts
    - libs/typecheck-consumer-dep/src/lib/dep.component.ts
    - libs/typecheck-consumer-dep/src/lib/dep.component.ts.pristine
    - libs/typecheck-consumer/project.json
    - libs/typecheck-consumer/package.json
    - libs/typecheck-consumer/tsconfig.json
    - libs/typecheck-consumer/tsconfig.lib.json
    - libs/typecheck-consumer/src/index.ts
    - libs/typecheck-consumer/src/lib/consumer.component.ts
  modified:
    - nx.json
    - tsconfig.base.json

key-decisions:
  - "D-07/D-08/D-09: cacheable targetDefault keyed by the EXECUTOR id with cache true, outputs [], and the ^default inlined-source inputs recipe (production, tsconfig*.json, package.json, workspaceRoot tsconfig.base.json, ^default, dependentTasksOutputFiles, externalDependencies typescript+@angular/compiler-cli)"
  - "D-11: two committed Angular-lib fixtures under libs/ (real discoverable main-graph projects); dep is NON-buildable (no build target); both tagged scope:fixture + private"
  - "D-10: the consumer->dep graph edge formed automatically via the @fixtures paths-alias-to-source + a static import (analyzeSourceFiles true); NO implicitDependencies needed; R1 --check guard exit 0 confirms it"
  - "D-15: .pristine byte-identical sidecar of dep.component.ts committed for crash-safe revert in 04-03"

requirements-completed: [EXE-06]

# Metrics
duration: 12min
completed: 2026-06-28
---

# Phase 4 Plan 02: Cacheable Target + Fixture Graph Summary

**The executor-id-keyed cacheable `targetDefaults` recipe (EXE-06, `^default` inlined-source model) plus two committed Angular-lib fixtures (a non-buildable dep + a consumer carrying the target) whose consumer->dep project-graph edge is proven live by the R1 `nx show target inputs --check` guard (exit 0) -- so `^default` provably reaches the dep source, the precondition for Plan 04-03's dependency-error-busts-cache test.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (2 code, 1 live verification gate) + 1 regression fix
- **Files:** 15 (13 created, 2 modified)

## Accomplishments

- Added the `angular-typechecker:angular-typecheck` cacheable `targetDefault` to `nx.json` (D-07/D-08/D-09): `cache: true`, `outputs: []`, and the load-bearing `^default` inlined-source inputs recipe -- `production`, `{projectRoot}/tsconfig*.json`, `{projectRoot}/package.json`, `{workspaceRoot}/tsconfig.base.json`, `^default` (NOT `^production`), `{ dependentTasksOutputFiles: '**/*.{d.ts,d.cts,d.mts,tsbuildinfo}', transitive: true }`, and `{ externalDependencies: ['typescript', '@angular/compiler-cli'] }`. `namedInputs` left untouched; no custom hasher (D-05/D-10, so the `--check` guard stays valid).
- Added the namespaced `@fixtures/typecheck-consumer-dep` -> `./libs/typecheck-consumer-dep/src/index.ts` alias to `tsconfig.base.json` `paths` (alias to SOURCE) -- this both type-checks the consumer import AND forms the Nx project-graph edge.
- Hand-authored two committed Angular-lib fixtures under `libs/` as REAL discoverable main-graph projects (D-11): `typecheck-consumer-dep` (NON-buildable -- NO build target, the critical cache case) and `typecheck-consumer` (carries the `angular-typecheck` target pointing at its leaf `tsconfig.lib.json`, statically imports the dep). Both tagged `scope:fixture`, each `package.json` `"private": true`.
- Committed a byte-identical `.pristine` sidecar of `dep.component.ts` for crash-safe revert in 04-03 (D-15).
- Verified `NX_DAEMON=false nx show projects` discovers both fixtures (not swallowed by the discovery trap).
- Confirmed the consumer target runs GREEN at baseline (`nx run typecheck-consumer:angular-typecheck` exit 0) -- run #1 of the cache test will be genuinely green (Q6).

## Task Commits

1. **Task 1: executor-id-keyed cacheable target default (D-07/D-08/D-09) + fixture alias (D-11)** - `bb321f9` (feat)
2. **Task 2: two committed Angular-lib fixtures + .pristine sidecar (D-11/D-15)** - `fe34564` (feat)
3. **Task 3: R1 edge guard (D-10)** - verification gate, no code change (the edge formed automatically; no `implicitDependencies` needed)
4. **Regression fix: relative fixture-alias path (Rule 1 bug)** - `4e42ad0` (fix)

## SC2 Evidence -- R1 Edge Guard (D-10)

The headline correctness gate, captured via `execSync` (direct exit-code capture, NOT piped through `head`/`rg`):

```
command: npx nx show target inputs typecheck-consumer:angular-typecheck --check libs/typecheck-consumer-dep/src/lib/dep.component.ts
exit code: 0
matched line: "libs/typecheck-consumer-dep/src/lib/dep.component.ts is an input for typecheck-consumer:angular-typecheck (files)"
```

This proves the consumer->dep project-graph edge exists (formed automatically via `analyzeSourceFiles: true` + the `@fixtures` paths-alias-to-source + the static import in `consumer.component.ts`), so `^default` reaches the dep source. **No `implicitDependencies` was required** -- the static import + alias formed the edge as RESEARCH A1 predicted. This is the literal SC2 "verified via `nx show target inputs --check`" evidence and the precondition for Plan 04-03's TEST-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-relative fixture-alias path triggered a TS5090 options diagnostic that broke gate-b.spec.ts**
- **Found during:** Task 2 green-baseline verification (then confirmed against the full suite)
- **Issue:** The plan/RESEARCH snippet for the alias used a non-relative value `"libs/typecheck-consumer-dep/src/index.ts"`. Under TypeScript 6, a non-relative `paths` value with no `baseUrl` raises **TS5090** (`Non-relative paths are not allowed when 'baseUrl' is not set`). Because the alias lives in `tsconfig.base.json`, EVERY fixture extending base (including `fixtures/gate-b-error/*`) inherited this options diagnostic. `ng.defaultGatherDiagnostics` (the differential half of `gate-b.spec.ts`) surfaces program-OPTIONS diagnostics and short-circuited on `5090`, returning `[5090]` instead of `[2322]` -- failing the GATE B differential assertion (`expected [5090] to include 2322`). The custom all-getter (`gatherAllDiagnostics`) does not surface options diagnostics, so the positive cases stayed green, which localized the cause.
- **Fix:** Made the alias value relative (`"./libs/typecheck-consumer-dep/src/index.ts"`), matching the existing `@angular-typechecker/angular-typechecker` -> `"./packages/..."` entry's style. This needs no `baseUrl` anywhere. An earlier interim fix (adding `baseUrl` + `ignoreDeprecations` to the fixture leaf tsconfigs) was reverted in favor of the cleaner relative-path approach -- it would have spread `baseUrl`/`ignoreDeprecations` into every fixture and still left the base-inherited diagnostic for other extenders.
- **Files modified:** `tsconfig.base.json` (relative value), `libs/typecheck-consumer-dep/tsconfig.lib.json` + `libs/typecheck-consumer/tsconfig.lib.json` (interim baseUrl/ignoreDeprecations removed).
- **Verification:** `nx test angular-typechecker --skip-nx-cache` -> 20 files / 99 tests green (matches the 04-01 baseline); consumer green baseline + R1 guard both still exit 0.
- **Commit:** `4e42ad0`

## Hand-off Notes for Plan 04-03 (the cache-correctness e2e)

- **`--no-color` CLI flag is incompatible with the executor schema.** Passing `--no-color` to `nx run typecheck-consumer:angular-typecheck` makes Nx forward `color: false` into the executor options, which `additionalProperties: false` (schema D-06) rejects with `'color' is not found in schema` (exit 1). **Use `FORCE_COLOR=0` (and/or `NO_COLOR=1`) in the env INSTEAD of the `--no-color` CLI flag** in the TEST-04 harness -- verified to produce clean ANSI-free output with NO schema collision and the consumer target green (exit 0). D-12's no-color determinism goal is fully met via env, so drop `--no-color` from the `execSync` command line. (This is a 04-03 implementation detail, not a schema change -- the schema correctly rejects unknown options; `--no-color` is simply not an executor option.)
- The dep source file Plan 04-03 mutates is `libs/typecheck-consumer-dep/src/lib/dep.component.ts`; its crash-safe heal source is the committed byte-identical `dep.component.ts.pristine` (810 bytes). The clean GREEN symbol the consumer uses is `depLabel()`.
- The executor currently resolves from SOURCE (`executor.ts`) via the local plugin graph (a benign ESM-load warning prints); the type-check engine runs correctly regardless. Plan 04-03 should keep `NX_DAEMON=false` for the cache test (D-12/D-17).

## Threat Surface

No new security-relevant surface beyond the plan's `<threat_model>`. T-04-05 (lying cache) is mitigated: the R1 `--check` guard PROVES the dep source is in the consumer's hash before 04-03 trusts the cache, and `externalDependencies: [typescript, @angular/compiler-cli]` busts on a compiler bump. T-04-06 (fixtures vs product) is mitigated: both fixtures tagged `scope:fixture`, each `package.json` `"private": true`, the alias is namespaced `@fixtures/...` and never shadows the product alias; the product never imports them. No custom hasher (T-04-07 accept-by-avoidance). No package installs (T-04-SC N/A).

## User Setup Required

None.

## Self-Check: PASSED
