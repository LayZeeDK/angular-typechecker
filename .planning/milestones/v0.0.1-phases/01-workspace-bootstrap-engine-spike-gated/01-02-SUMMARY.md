---
phase: 01-workspace-bootstrap-engine-spike-gated
plan: 02
subsystem: infra
tags: [nx, nx-plugin, angular-22, typescript-6, nodenext, esm-cjs-bridge, vitest, package-json, scaffold]

# Dependency graph
requires:
  - phase: 01-01
    provides: 'Nx 23 integrated Angular monorepo (--preset=apps) over the preserved .git/; root toolchain pinned EXACT (nx 23.0.1 / @angular/compiler-cli 22.0.4 / typescript 6.0.3)'
provides:
  - 'angular-typechecker plugin project in the Nx graph (packages/angular-typechecker) with @nx/js:tsc build (outputPath dist/packages/angular-typechecker) + @nx/vitest:test test target'
  - 'Plugin solution tsconfig patched to module/moduleResolution: nodenext (the GATE A enabling edit; await import() survives @nx/js:tsc emit)'
  - 'Phase-1 plugin package.json (D-14): type:commonjs, @nx/devkit pinned dep 23.0.1, @angular/compiler-cli ^22.0.0 + typescript >=6.0.0 <6.1.0 peers, engines.node, executors:./executors.json'
  - "Real Angular 22 standalone app apps/ng-spike-app in the graph (the spike's in-graph type-check target; builds green)"
  - 'Generator-created tsconfig.base.json + .prettierrc (resolves the Wave 1 carryover that --preset=apps did not emit them)'
  - 'Root deps re-pinned to Angular 22.0.4 across all @angular/* framework+tooling packages; .npmrc legacy-peer-deps=true for the Nx-23 / Angular-22 peer-range reconciliation'
affects: [01-03-tracer-bullet-core, 01-04-gate-specs, phase-2-core-engine, phase-4-executor, phase-5-publish]

# Tech tracking
tech-stack:
  added:
    - '@angular/core/common/compiler/forms/platform-browser/router 22.0.4 (runtime deps for the spike app)'
    - '@angular/build, @angular/cli, @angular/language-service, @angular-devkit/core, @angular-devkit/schematics, @schematics/angular all 22.0.4 (re-pinned from generator default 21.2)'
    - 'angular-eslint ^22.0.0, eslint 9 flat config (Nx 23 default), prettier (.prettierrc singleQuote:true)'
    - 'vitest 4.1.x via @nx/vitest:test (vitest.config.mts + vitest.workspace.ts)'
  patterns:
    - 'type:commonjs package manifest + module:nodenext tsconfig split (the deliberate cjs-label / nodenext-emit divergence; @nx/js:tsc only READS module to label cjs/esm, never reassigns it)'
    - 'Generator-then-pin: scaffold with @nx/* generators, then re-pin the framework deps the generator under-versioned to the locked stack (exact-dev per D-15)'
    - 'Out-of-graph fixture exclusion in tsconfig.lib.json (fixtures/gate-b-error/**/*) so the deliberate-error fixture is never compiled into the package (D-13)'

key-files:
  created:
    - 'packages/angular-typechecker/project.json (@nx/js:tsc build + @nx/vitest:test)'
    - 'packages/angular-typechecker/package.json (Phase-1 D-14 manifest)'
    - 'packages/angular-typechecker/tsconfig.json (module:nodenext PATCH)'
    - 'packages/angular-typechecker/tsconfig.lib.json (excludes fixtures/gate-b-error)'
    - 'packages/angular-typechecker/tsconfig.spec.json'
    - 'packages/angular-typechecker/vitest.config.mts'
    - 'packages/angular-typechecker/src/index.ts (placeholder; core/executor land in Plan 03)'
    - 'apps/ng-spike-app/ (full standalone Angular 22 app; tsconfig.app.json)'
    - 'tsconfig.base.json (generator-created; was missing after Wave 1)'
    - '.prettierrc, .prettierignore, eslint.config.mjs, vitest.workspace.ts'
    - '.npmrc (legacy-peer-deps=true; Angular-22/Nx-23 peer reconciliation)'
  modified:
    - 'package.json (re-pinned all @angular/* to 22.0.4; added eslint/vitest/swc dev toolchain)'
    - 'nx.json (generator target defaults)'
    - '.gitignore, .vscode/extensions.json, .vscode/settings.json'

key-decisions:
  - "Re-pinned all @angular/* framework + tooling deps from the generator default ~21.2.0 to EXACT 22.0.4 (locked stack is Angular 22; the generator's Angular 21 default conflicts with @angular/compiler-cli@22.0.4)"
  - '.npmrc legacy-peer-deps=true: @nx/angular@23.0.1 caps its @angular/build (optional) + @angular-devkit/* + @schematics/angular (hard) peers at < 22.0.0; the locked Angular-22 tree legitimately exceeds that known peer-range ceiling'
  - 'Plugin tsconfig module commonjs -> nodenext is the single load-bearing GATE A enabler; tsconfig.lib.json inherits it (no commonjs re-override)'
  - 'Plugin package.json unscoped to angular-typechecker (was @angular-typechecker/angular-typechecker) + dropped generator private:true (publishable manifest; files/exports/hardening land in Phase 5)'
  - 'Spike app generated with --unitTestRunner=none --e2eTestRunner=none (D-06 minimal scaffold; the app is a type-check target, not a unit-test host; e2e is a separate Phase 6 concern per D-07)'

patterns-established:
  - 'Generated plugin build.options.outputPath = dist/packages/angular-typechecker (Plan 04 DERIVES its GATE A dist/.../executor.js path from this verbatim value; built executor will be dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js once Plan 03 adds it)'
  - 'Each task committed atomically, files staged BY NAME (never git add .); single-writer STATE.md/ROADMAP.md in sequential main-tree mode'

requirements-completed: [WS-02, WS-03, CMP-01, CMP-02]

# Metrics
duration: ~30min
completed: 2026-06-27
---

# Phase 01 Plan 02: Scaffold Plugin + Spike App + Module Patch Summary

**The angular-typechecker plugin (@nx/js:tsc build, outputPath `dist/packages/angular-typechecker`, @nx/vitest:test) and a real Angular 22 `apps/ng-spike-app` now exist in the Nx graph; the plugin tsconfig is patched to `module: nodenext` (the GATE A enabler) and the Phase-1 D-14 plugin `package.json` declares the locked dependency model -- with the framework deps re-pinned to Angular 22.0.4 and a `.npmrc` reconciling the Nx-23 / Angular-22 peer-range mismatch.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-27T15:38Z (approx)
- **Completed:** 2026-06-27T15:48Z (approx)
- **Tasks:** 3 auto (no checkpoints; autonomous: true)
- **Files modified:** 35 created/modified (excl. gitignored dist/)

## Accomplishments

- The `angular-typechecker` plugin project exists in the Nx graph at `packages/angular-typechecker` with an `@nx/js:tsc` **build** target (outputPath `dist/packages/angular-typechecker`) and an `@nx/vitest:test` **test** target (NOT `@nx/vite:test`) -- WS-02, WS-03.
- The plugin solution `tsconfig.json` is patched to `module: "nodenext"` + `moduleResolution: "nodenext"` -- the single most load-bearing edit in the phase. Verified the plugin builds cleanly under it (`@nx/js:tsc` emitted `dist/packages/angular-typechecker/src/index.js`), so `await import()` will survive emit and GATE A is enabled by construction.
- The Phase-1 plugin `package.json` (D-14) declares `type: "commonjs"`, `@nx/devkit` pinned EXACT `23.0.1` (no `nx` declared), `@angular/compiler-cli ^22.0.0` + `typescript >=6.0.0 <6.1.0` peers, and `engines.node` (CMP-02) -- the locked exact-dev / ranged-peer split (D-15).
- A real Angular 22 standalone app `apps/ng-spike-app` exists in the graph and **builds green** (`nx build ng-spike-app` succeeded against Angular 22.0.4), proving the whole locked toolchain (Angular 22 + Nx 23 + TS 6) is functional end-to-end -- the spike's in-graph type-check target (D-07).
- The Wave 1 carryover concern is resolved: the `@nx/plugin:plugin` generator **created `tsconfig.base.json`** (and `.prettierrc`) when it scaffolded the first project, exactly as Wave 1 predicted -- no manual creation was needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the plugin package and the spike Angular 22 app** - `58023c0` (feat)
2. **Task 2 [BLOCKING]: Patch the plugin tsconfig module to nodenext** - `f36d3e4` (fix)
3. **Task 3: Author the Phase-1 plugin package.json (D-14)** - `14b8107` (feat)

**Plan metadata:** (this commit) (docs: complete plan -- SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified

- `packages/angular-typechecker/project.json` - Plugin project; `@nx/js:tsc` build (outputPath `dist/packages/angular-typechecker`, main `src/index.ts`, executors.json asset-copy) + `@nx/vitest:test` test + `@nx/eslint:lint`
- `packages/angular-typechecker/package.json` - Phase-1 D-14 manifest (type:commonjs, devkit pinned dep, compiler-cli+typescript peers, engines.node, executors:./executors.json)
- `packages/angular-typechecker/tsconfig.json` - PATCHED: module + moduleResolution = nodenext; verbatimModuleSyntax:false; ignoreDeprecations:6.0
- `packages/angular-typechecker/tsconfig.lib.json` - Inherits nodenext; exclude adds `fixtures/gate-b-error/**/*` (D-13)
- `packages/angular-typechecker/tsconfig.spec.json`, `vitest.config.mts`, `src/index.ts` (placeholder), `README.md`, `eslint.config.mjs`
- `apps/ng-spike-app/**` - Full standalone Angular 22 app (`tsconfig.app.json`, `src/app/*`, `src/main.ts`) -- unmodified since scaffold, builds green
- `tsconfig.base.json` - Generator-created workspace base tsconfig (path alias for the plugin); was missing after Wave 1
- `.prettierrc` (singleQuote:true), `.prettierignore`, `eslint.config.mjs` (root flat config), `vitest.workspace.ts`
- `.npmrc` - `legacy-peer-deps=true` with a documenting comment (Nx-23 / Angular-22 peer reconciliation)
- `package.json` (root) - All `@angular/*` framework + tooling deps re-pinned to EXACT `22.0.4`; eslint/vitest/swc dev toolchain added by the generators
- `nx.json`, `.gitignore`, `.vscode/extensions.json`, `.vscode/settings.json` - generator updates

## Decisions Made

- **Spike app runner flags (D-06):** generated `apps/ng-spike-app` with `--unitTestRunner=none --e2eTestRunner=none` for a minimal scaffold. The app is a type-check target (D-07), not a unit-test host; the e2e tarball tier is a separate Phase 6 concern. (The `@nx/angular:application` schema rejects `--unitTestRunner=vitest` -- its valid choices are `vitest-angular`/`vitest-analog`/`jest`/`none`; `none` is correct for the spike.)
- **Plugin name unscoped + no `private` (D-14):** rewrote the generated `@angular-typechecker/angular-typechecker` (scoped, private) to the publishable `angular-typechecker` matching the PROJECT.md package-name decision. Nx still resolves the graph node by `project.json` name (`angular-typechecker`), so the rename is graph-stable. The `files`/`exports`/publish-hardening land in Phase 5; `nx release` is the only publish path (no manual `npm publish` wired), so dropping `private` now carries no accidental-publish risk in Phase 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @nx/angular generator wrote Angular 21.2 framework deps, conflicting with the locked Angular 22 stack**

- **Found during:** Task 1 (spike app generation -- the generator's post-scaffold `npm install` aborted)
- **Issue:** `@nx/angular@23.0.1`'s `:application` generator added `@angular/core/common/compiler/forms/platform-browser/router`, `@angular/build`, `@angular/cli`, `@angular/language-service`, `@angular-devkit/*`, `@schematics/angular` all at `~21.2.0` (its baseline default), and `angular-eslint ^21.2.0`. These conflict with Wave 1's locked `@angular/compiler-cli@22.0.4` (whose peer requires `@angular/compiler@22.0.4`) -> `ERESOLVE`. The locked stack is Angular 22 + TS 6 (PROJECT.md MUST).
- **Fix:** Re-pinned every `@angular/*` framework + tooling package to EXACT `22.0.4` and `angular-eslint` to `^22.0.0` in the root `package.json` (D-15 exact-dev). Verified `npm ls` resolves `@angular/core@22.0.4` / `@angular/build@22.0.4` / `@angular/compiler-cli@22.0.4` / `typescript@6.0.3` deduped.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `nx build ng-spike-app` succeeds against Angular 22.0.4 (app is green); `npm ls` shows the deduped Angular-22 tree.
- **Committed in:** `58023c0` (Task 1 commit)

**2. [Rule 3 - Blocking] @nx/angular@23.0.1 peers cap Angular tooling at < 22.0.0; install needs legacy-peer-deps**

- **Found during:** Task 1 (re-running `npm install` after the Angular-22 re-pin)
- **Issue:** `@nx/angular@23.0.1` declares `@angular/build` (optional), `@angular-devkit/core`, `@angular-devkit/schematics`, `@schematics/angular` (hard peers) with the range `">= 19.0.0 < 22.0.0"` -- it formally supports Angular up to 21. The locked Angular-22 tree legitimately exceeds that ceiling, so a strict `npm install` aborts on the peer conflict. This is a real, accepted ecosystem version-skew tied to a PROJECT.md MUST (Angular 22 + Nx 23), NOT a package-legitimacy issue: no new/unknown packages were introduced -- all are the official `@nx/*` / `@angular/*` set already pinned exact and legitimacy-audited in Wave 1 (threat T-01-SC disposition `accept`).
- **Fix:** Created a root `.npmrc` with `legacy-peer-deps=true` and a documenting comment explaining the Nx-23 / Angular-22 reconciliation and when to revisit (a stable `@nx/angular` 23.1.x whose peers admit Angular 22). `latest` `@nx/angular` is `23.0.1` (no stable patch widens the peer); only `next`/beta does, which is unsuitable for the locked stack. This is the standard, single correct resolution -- not an architectural change (no library switch, no new dependency).
- **Files modified:** `.npmrc` (created)
- **Verification:** `npm install` succeeds; the only residual `npm ls` `invalid` marker is `@angular/build@22.0.4 ... invalid: ">= 19.0.0 < 22.0.0" from node_modules/@nx/angular` -- exactly the known, accepted mismatch the `.npmrc` documents. Both projects resolve in the graph; both build green.

---

**Total deviations:** 2 auto-fixed (1 bug: generator under-versioned the framework; 1 blocking: peer-range reconciliation)
**Impact on plan:** Both were necessary to honor the locked Angular-22 stack (PROJECT.md MUST) against an `@nx/angular@23.0.1` that defaults to and peers against Angular 21. No scope creep; no new capabilities. **CAVEAT (flagged explicitly):** the workspace now relies on `legacy-peer-deps=true` for installs -- CI and future `npm install`s inherit it via the committed `.npmrc`. Revisit when a stable `@nx/angular` admits Angular 22 in its peer ranges; until then this is the documented, intentional reconciliation of the locked pairing.

## Issues Encountered

- **`@nx/plugin:plugin` does not support `--dry-run`** (it installs Angular plugins internally; emits a NOTE and exits). Ran the generator for real; verified output post-hoc. Not a defect.
- **Generated `vitest` config is `vitest.config.mts`, not `vitest.config.ts`.** The plan acceptance text says `vitest.config.ts`; the `--unitTestRunner=vitest` generator emits the `.mts` variant on Nx 23 (ESM config). This is the WS-03 plumbing -- functionally identical; only the extension differs.
- **Deprecation warnings from the generators** (`@nx/eslint:lint` and `@nx/vitest:test` executors "will be removed in Nx v24"; `nx g convert-to-inferred` suggested). These are informational; the executor-based targets are correct and intended for Nx 23. Migrating to inferred plugins is a future-Nx concern, out of scope for this plan.
- **CSS budget WARNING on `apps/ng-spike-app/src/app/nx-welcome.ts`** during the green build (generator-default component exceeds the 4 kB budget by ~3 kB). A warning, not an error; a pre-existing generator artifact, not caused by this plan's changes (SCOPE BOUNDARY -- left as-is; the app is green).
- **Stale path alias in `tsconfig.base.json`:** the generator wrote a `paths` mapping for the OLD scoped name `@angular-typechecker/angular-typechecker`; the plugin is now unscoped `angular-typechecker`. Harmless in Phase 1 -- the executor/core use relative imports (per ARCHITECTURE.md), and the alias is unused. Left untouched (the plan does not own `tsconfig.base.json` path aliases); a later phase can re-align it if any consumer relies on the package-name import.
- **npm `allow-scripts` postinstall gate** continues to defer some native postinstall scripts (nx, @parcel/watcher, @swc/core, esbuild, lmdb, less, unrs-resolver) -- same benign gate as Wave 1; `nx report`, generators, and both builds resolve regardless. Audit/hardening deferred to Phase 5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 01-03 (tracer-bullet core) is unblocked:** the plugin skeleton + the patched `module: nodenext` tsconfig are in place. Plan 03 creates `core/` (compiler-loader with memoized `await import()`, unconditional all-getter `gatherAllDiagnostics`, `runTypecheck`), the minimal executor stub (default export -> `runTypecheck`), `executors.json`, and the out-of-graph `fixtures/gate-b-error/` deliberate-error fixture (already excluded from `tsconfig.lib.json`).
- **Plan 01-04 (gate specs):** the generated build `outputPath` is `dist/packages/angular-typechecker` -- the GATE A static spec must DERIVE its built-executor path from this (`dist/packages/angular-typechecker/src/executors/angular-typecheck/executor.js`), not hard-code it (research Open Question 2).
- **No blockers.** The Angular-22/Nx-23/TS-6 toolchain is proven functional (spike app + plugin both build green). The `.npmrc` legacy-peer-deps reconciliation is committed and documented.

## Self-Check: PASSED

- Files verified present: project.json, package.json, tsconfig.json, tsconfig.lib.json, vitest.config.mts, apps/ng-spike-app/tsconfig.app.json, tsconfig.base.json, .npmrc, 01-02-SUMMARY.md
- Commits verified present: `58023c0` (scaffold), `f36d3e4` (module patch), `14b8107` (plugin package.json)
- Functional gates: `nx show projects` lists `[angular-typechecker, ng-spike-app]`; plugin `tsconfig.json` module/moduleResolution = nodenext; plugin builds (`dist/packages/angular-typechecker/src/index.js`); spike app builds green

---

_Phase: 01-workspace-bootstrap-engine-spike-gated_
_Completed: 2026-06-27_
