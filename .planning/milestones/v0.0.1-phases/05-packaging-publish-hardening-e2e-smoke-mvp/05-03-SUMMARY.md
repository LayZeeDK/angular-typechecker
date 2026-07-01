---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
plan: 03
subsystem: e2e-install-smoke
tags: [test-05, tracer-bullet, e2e, install, d-17, d-18, d-19, d-20, b-03]
requires:
  - '05-01: full PKG-01 manifest + self-contained shipped .d.ts (published executor id angular-typechecker:angular-typecheck)'
  - '05-02: serialized angular-typechecker-install-e2e project (forks/singleFork/no-parallel/node env, 300000 timeouts) + the build-then-pack-from-dist beforeAll shape'
  - 'Phase 4: e2e/angular-typechecker-cache-e2e harness (run()/buildCleanEnv/NX_RUNNER_ENV_KEYS/injected-error/exit-code+ERR_REQUIRE_ESM assertion trio)'
provides:
  - 'Committed self-contained consumer-app fixture wired with the PUBLISHED unscoped executor id + includeDeps:true, no source path-alias (the README recipe proven by execution)'
  - 'install-smoke.int.spec.ts: pack -> clean tmp install (no peer override) -> green run exit 0 + injected-TS2322 non-zero/no-ERR_REQUIRE_ESM'
  - 'B-03 RESOLVED finding: a clean npm install of the published peers (stable Angular 22.0.4 + Nx 23.0.1) succeeds with NO consumer peer-resolution override'
affects:
  - '05-04 (nx release config + hardened CI: the smoke is the pre-publish artifact validation; CI may gate on this same install-e2e project)'
  - '05-05 (live first publish: the tracer bullet proves the artifact about to be published installs-and-runs)'
tech-stack:
  added: []
  patterns:
    - 'Per-run mkdtemp tmp consumer + cpSync of the committed fixture; mutate the discarded COPY (inherently crash-safe -- no .pristine sidecar, D-18)'
    - 'Clean-install honesty: empty tmp .npmrc + npm_config_userconfig -> non-existent path + env-strip of npm_config_legacy_peer_deps so no peer override leaks (B-03)'
    - 'require()-the-installed-executors.json sanity check before the nx run (resolution FROM the install, not a dev path-alias, D-18)'
key-files:
  created:
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/project.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/nx.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/package.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/tsconfig.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/tsconfig.lib.json
    - e2e/angular-typechecker-install-e2e/fixtures/consumer-app/src/app.component.ts
    - e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts
  modified: []
decisions:
  - "Fixture nx.json carries the cacheable targetDefaults recipe keyed by the PUBLISHED id angular-typechecker:angular-typecheck so the installed plugin's cacheable target binds in the tmp workspace (relative paths, since the fixture is its own workspace root once copied)"
  - "Fixture package.json declares stable Angular 22.0.4 + TS 6.0.3 + nx/devkit 23.0.1; the angular-typechecker tarball is added by the spec's install step, NOT pre-declared (so the smoke installs the REAL artifact)"
  - 'B-03 RESOLVED, NOT masked: the clean install (empty .npmrc, no override flag, non-existent userconfig) succeeds -- consumers on the stable published peers do NOT need a peer-resolution override; recorded below for the human B-03 call'
  - 'Included the discretionary require()-the-installed-executor check (D-18): assert node_modules/angular-typechecker/executors.json carries the angular-typecheck executor before the green nx run'
metrics:
  duration: ~5 min
  completed: 2026-06-28
  tasks: 2
  files: 7
---

# Phase 5 Plan 03: e2e Install Smoke (the Tracer Bullet) Summary

Proved the whole vertical slice end-to-end: a clean `npm install` of the freshly-packed `angular-typechecker` tarball into an isolated per-run tmp workspace resolves the executor by its PUBLISHED unscoped id and runs it -- green (exit 0) on a valid project and reporting an injected `TS2322` (non-zero exit, no `ERR_REQUIRE_ESM`) on a broken one. This is THE tracer bullet (D-22): 05-02 proved the tarball is shaped right; this smoke proves it actually WORKS from a consumer install, that the CJS executor's dynamic `import()` of the ESM compiler-cli survived packaging, and -- the honesty check -- that the check actually ran rather than a no-op exiting 0. The clean (no peer-resolution override) install also answers B-03 empirically.

## What Was Built

### Task 1 -- Committed consumer-app fixture (PUBLISHED id, no source alias) -- commit `1cc5fab`

A SELF-CONTAINED minimal consumer fixture under `e2e/angular-typechecker-install-e2e/fixtures/consumer-app/` (6 files). It is the exact shape a real consumer would author, with the two load-bearing D-18 divergences from the dev `libs/typecheck-consumer/`:

- `project.json`: `name: consumer-app`, `projectType: application`, an `angular-typecheck` target with `"executor": "angular-typechecker:angular-typecheck"` (the PUBLISHED UNSCOPED id -- NOT the dev `@angular-typechecker/...` key, which would not bind in a consumer install) and `options: { "tsConfig": "tsconfig.lib.json", "includeDeps": true }` (relative paths since the fixture is its own workspace root once copied; `includeDeps:true` per Phase-4 04-03 Rule-2).
- `nx.json`: a minimal consumer nx.json carrying the cacheable `targetDefaults` recipe keyed by `angular-typechecker:angular-typecheck` (`cache:true`, `outputs:[]`, the per-tsconfig + `externalDependencies` inputs) so the installed plugin's cacheable target binds in the tmp workspace.
- `package.json`: `"private": true`, stable Angular 22.0.4 runtime deps (`@angular/core`/`@angular/common`/`@angular/compiler` + `rxjs`/`zone.js`), `@angular/compiler-cli@22.0.4` + `typescript@6.0.3` + `nx`/`@nx/devkit@23.0.1` as devDeps. The `angular-typechecker` tarball is NOT pre-declared -- the spec's `npm install <tgz>` adds it (so the smoke installs the real artifact).
- `tsconfig.json` (references `tsconfig.lib.json`) + `tsconfig.lib.json` mirroring the dev consumer's Angular shape (`noEmit:true`, `strict:true`, `target:es2022`, `module:preserve`, `moduleResolution:bundler`, `angularCompilerOptions.strictTemplates:true`, `include:["src/**/*.ts"]`) but SELF-CONTAINED: NO `extends` of the workspace base, NO `paths` alias to plugin source (D-18).
- `src/app.component.ts`: a minimal standalone component that type-checks CLEAN (no committed error; the smoke injects a deliberate `TS2322` into a tmp copy).

This fixture's recipe (PUBLISHED id + `includeDeps:true`, no source alias) IS the consumer README example, now proven by execution.

### Task 2 -- The install smoke -- commit `64fa375`

`e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` (241 lines). Clones the cache-e2e harness shape (3-dirs-up `workspaceRoot`, `buildCleanEnv` + `NX_RUNNER_ENV_KEYS` nested-nx hygiene, the `run()`/`RunResult` exit-code-capture helper, the injected-error JSON.stringify idiom, the assertion trio):

- `beforeAll` (300000 ms): `nx build angular-typechecker --skip-nx-cache` (fresh dist, Pitfall 6) -> `npm pack --json` in the dist dir -> capture the ABSOLUTE `.tgz` path.
- The single `it(...)` (D-17/D-18/D-19/D-20):
  1. `mkdtempSync(join(tmpdir(), 'atc-smoke-'))` -> `cpSync` the committed fixture into tmp (does NOT copy this repo's `.npmrc`).
  2. Write an explicit EMPTY `.npmrc` into tmp + set `npm_config_userconfig` to a non-existent path + env-strip `npm_config_legacy_peer_deps` -- so NO peer-resolution override leaks (B-03 honesty, D-20).
  3. `npm install <absoluteTgz>` with NO override flag. An ERESOLVE here would FAIL the test, surfacing the real finding (no auto-masking).
  4. Sanity (discretionary, D-18): assert `node_modules/angular-typechecker/executors.json` carries the `angular-typecheck` executor -- resolution FROM the install.
  5. GREEN: `run(tmp)` of `nx run consumer-app:angular-typecheck --output-style=static` -> `expect(code).toBe(0)`.
  6. Inject `const broken: number = 'str';` (TS2322) into the TMP copy's `app.component.ts` via the JSON.stringify idiom (crash-safe -- the tmp copy is discarded).
  7. INJECTED: `expect(code).not.toBe(0)` + `expect(stdout).toContain('TS2322')` + `expect(stdout).not.toMatch(/ERR_REQUIRE_ESM/)` + `expect(stdout).not.toContain('infrastructure error')`.
- `afterAll`: `rmSync` the packed `.tgz`; the `finally` `rmSync(tmp, {recursive,force})` per run.

`--output-style=static` + `FORCE_COLOR=0` (NEVER the color-disabling CLI flag -- Nx forwards it as `color:false` which the schema's `additionalProperties:false` rejects). The injected TS code token is hoisted to `INJECTED_TS_CODE` (IN-02).

## B-03 finding: RESOLVED -- a clean install needs NO consumer peer override

**Outcome: a clean `npm install` of the packed tarball SUCCEEDS with no peer-resolution override.** The smoke installs into a tmp workspace with an explicit empty `.npmrc`, `npm_config_userconfig` pointed at a non-existent path, and the override env vars stripped -- so this repo's committed `.npmrc legacy-peer-deps=true` and any user-level `~/.npmrc` are provably NOT consulted. The install completed without an `ERESOLVE` (the only `npm warn` was the unrelated `nx@23.0.1` postinstall allow-scripts notice; no peer-conflict warning, no override warning).

**Why it resolves clean:** the consumer's peer set is the STABLE published surface -- `@angular/compiler-cli@^22.0.0` + `typescript@>=6.0.0 <6.1.0` (the plugin's peers, D-06) against the consumer's own stable Angular 22.0.4 + Nx 23.0.1. The `@nx/angular@23.0.1` `<22.0.0` peer ceiling that forces THIS dev repo to set `legacy-peer-deps=true` is a DEV-workspace concern (this repo installs the `@nx/angular` generator/tooling tree); a downstream CONSUMER of `angular-typechecker` does not pull `@nx/angular` transitively, so that ceiling never reaches them. The plugin ships `@nx/devkit` as a pinned dependency (whose `nx` peer is satisfied transitively) and `@angular/compiler-cli`/`typescript` as peers the consumer already provides.

**Human B-03 call (now low-stakes):** no remediation is required for consumers on stable Angular 22. The README's existing pre-release note (consumers on `22.x-next`/`-rc` must pass the override, since `^22.0.0` excludes pre-releases by semver) remains correct and sufficient. No range-widening and no "await @nx/angular 23.1.x" action is needed for the stable path. The honesty mechanism was NOT bypassed -- the clean install genuinely succeeded.

## Verification

- `npx nx run angular-typechecker-install-e2e:test --skip-nx-cache` exits 0 -- 2 test files / 7 tests green (the 1 install-smoke test + the 6 carried-over 05-02 audit-gate tests). Re-run twice; stable (~22-27s).
- The `NX Running target angular-typecheck for project consumer-app failed` line in the output is the EXPECTED injected-error nested `nx run` that the test catches and asserts on (non-zero exit) -- not a suite failure.
- Green run -> exit 0; injected run -> non-zero exit + `TS2322` in stdout + NO `ERR_REQUIRE_ESM` + NO `infrastructure error` (the packaged CJS `import()` of the ESM compiler-cli survived and the check actually ran).
- The discretionary `executors.json` resolution check passes -> the executor resolves from `node_modules/angular-typechecker`, not a dev path-alias.
- `rg` acceptance guards: `legacy-peer-deps` (hyphenated CLI form) count 0; `no-color` count 0; `mkdtempSync` >= 1; `ERR_REQUIRE_ESM` >= 1; `TS2322` >= 1; `output-style=static` >= 1; install-smoke spec is 241 lines (>= 80). Fixture: executor id `angular-typechecker:angular-typecheck` + `includeDeps:true` (node -e ok); dev-scoped key 0; `@angular-typechecker/` alias in tsconfig.lib.json 0; `@fixtures` 0; `"private": true` present; no `-next`/`-rc`; ASCII-only; no work-email.
- Teardown: no leftover `.tgz` in `dist/packages/angular-typechecker/`; no leftover `atc-smoke-*` tmp dirs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Literal-grep false positives on the `legacy-peer-deps` and `no-color` acceptance criteria**

- **Found during:** Task 2 (acceptance check).
- **Issue:** The acceptance criteria require `git grep -c "legacy-peer-deps"` and `git grep -c "no-color"` to return 0 in the spec. The implementation passes NEITHER flag, but explanatory comments contained the literal hyphenated substrings (e.g. "WITHOUT --legacy-peer-deps", "NOT --no-color") -- the same comment-false-positive class 05-01/05-02 hit. The honesty env-strip code uses the npm CONFIG key form (`npm_config_legacy_peer_deps`, underscores) which does NOT match the hyphenated pattern, so it was never the trip.
- **Fix:** Reworded the comments to "peer-resolution override" / "the color-disabling CLI flag" without the literal hyphenated substrings; no code change. Both criteria now return 0; the smoke still passes no override flag and no color flag (re-ran the full suite green after the reword).
- **Files modified:** e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts
- **Commit:** 64fa375 (the reword was applied before the commit).

No architectural deviations (Rule 4 not triggered). No Rule 1/2 bugs found. No authentication gates. No package installs (the only `npm install` is the local tarball + the fixture's pinned stable deps into a discarded tmp dir, threat T-05-SC).

## Threat Model Adherence

- **T-05-08 (packaged executor import() survival):** the injected-error run asserts NO `ERR_REQUIRE_ESM` -- the CJS executor's dynamic `import()` of the ESM compiler-cli survived packaging and ran from the installed package. Green (D-19).
- **T-05-09 (dev-scoped vs published executor id):** the fixture wires the PUBLISHED unscoped id `angular-typechecker:angular-typecheck`; the green run + the `executors.json` resolution check prove real resolution from the install (the dev key would not bind). Green (D-18).
- **T-05-10 (honest peer resolution, B-03):** clean install with NO peer-resolution override (empty `.npmrc`, non-existent userconfig, env-stripped) -- it SUCCEEDED, surfaced honestly. accept-with-surfacing satisfied; recorded above for the human B-03 call (resolved: no consumer override needed for stable Angular 22).
- **T-05-SC (npm install in the smoke):** the only install is the just-built local tarball + the fixture's pinned stable Angular 22.0.4 / Nx 23.0.1 deps into a discarded tmp dir; no untrusted external package is introduced.

## Threat Flags

None. The smoke introduces no new network endpoint, auth path, or trust-boundary schema change beyond the in-register tarball-install and injected-source boundaries already modeled.

## Known Stubs

None. No placeholder/TODO/empty-data patterns in any file changed by this plan. The fixture's clean component is intentional (the smoke injects the error into a tmp copy); it is not a stub.

## Self-Check: PASSED

- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/project.json
- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/nx.json
- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/package.json
- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/tsconfig.json
- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/tsconfig.lib.json
- FOUND: e2e/angular-typechecker-install-e2e/fixtures/consumer-app/src/app.component.ts
- FOUND: e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts
- FOUND commit: 1cc5fab (Task 1)
- FOUND commit: 64fa375 (Task 2)
