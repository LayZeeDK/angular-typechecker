---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
plan: 02
subsystem: packaging-audit-gate
tags: [pkg-02, attw, publint, tarball, d-09, d-10, b-02, e2e]
requires:
  - '05-01: self-contained shipped .d.ts surface + full PKG-01 manifest + per-package LICENSE asset'
  - 'Phase 4: e2e/angular-typechecker-cache-e2e serialized determinism harness (clone source)'
provides:
  - 'Serialized angular-typechecker-install-e2e project (forks/singleFork/no-parallel/node env, timeouts 300000)'
  - 'tarball-audit.int.spec.ts: build->pack->publint/attw/leak/no-install-scripts gate against the .tgz'
  - 'Root devDeps publint@0.3.21 + @arethetypeswrong/cli@0.18.4 (tooling, never in the plugin manifest)'
  - 'Authoritative D-10/B-02 verification: attw --pack --profile node16 reports problems empty'
affects:
  - '05-03 (e2e smoke reuses this install-e2e project + the build->pack beforeAll shape)'
  - '05-04 (CI wires the audit gate before publish)'
tech-stack:
  added:
    - 'publint@0.3.21 (root devDep) -- tarball publishing-correctness linter'
    - '@arethetypeswrong/cli@0.18.4 (root devDep) -- .d.ts cross-mode resolution checker'
  patterns:
    - 'Build-fresh-then-pack-from-dist beforeAll; audit the .tgz, never the source tree (Pitfall 5)'
    - 'npm pack --json files[].path for cross-OS-deterministic positive/negative file-set assertions'
    - 'Cross-OS tarball extraction: relative tgz filename + relative -C under a shared cwd (no Windows drive letter, no GNU-vs-BSD --force-local divergence)'
    - 'Nested-nx env hygiene (buildCleanEnv strips NX_* runner vars; NX_DAEMON=false, FORCE_COLOR=0)'
key-files:
  created:
    - e2e/angular-typechecker-install-e2e/project.json
    - e2e/angular-typechecker-install-e2e/vitest.config.mts
    - e2e/angular-typechecker-install-e2e/tsconfig.json
    - e2e/angular-typechecker-install-e2e/tsconfig.spec.json
    - e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - 'attw assertion targets analysis.problems (the canonical array form) -- the JSON also carries a top-level `problems` object keyed by entrypoint; the array under `analysis` is the flat problem list and is empty when resolution is clean'
  - 'Read the PACKED manifest + .d.ts by extracting the tarball (tar -xzf) into a tmp dir UNDER distDir with relative paths, not via the source tree -- the gate must audit the real artifact'
  - 'publint/attw pinned EXACT (0.3.21 / 0.18.4), matching the workspace exact-pin convention; npm defaulted to caret ranges so the two specifiers were tightened to exact post-install'
  - "Cloned the cache-e2e vitest.config.mts verbatim (incl. poolOptions.forks shape) per the plan's clone mandate; Vitest 4 emits a non-fatal poolOptions deprecation warning -- parity with the proven analog kept over silencing it"
metrics:
  duration: ~6 min
  completed: 2026-06-28
  tasks: 3
  files: 7
---

# Phase 5 Plan 02: Tarball Audit Gate Summary

Proved the packed `angular-typechecker-0.0.1.tgz` is publish-correct by auditing the real artifact (not the source tree): a new fully-serialized `angular-typechecker-install-e2e` project runs `publint --strict` + `attw --pack --profile node16` + positive/negative file-set + no-install-scripts gates against the `.tgz`. The `attw` problems-empty assertion is the authoritative confirmation that the 05-01 D-10/B-02 self-contained-types fix resolved the `InternalResolutionError` -- no escalation needed.

## Package Legitimacy Gate (pre-approved checkpoint)

The plan's blocking `checkpoint:human-verify` legitimacy gate for the two new root devDeps was PRE-APPROVED for this `--chain`/`--auto` run (both slopcheck-Approved in 05-RESEARCH, exact-pinned, postinstall-free, source-backed). The substantive verification the gate represents was still performed and recorded:

- `npm view publint@0.3.21` -> version `0.3.21` published; tarball at registry.npmjs.org; `npm view publint@0.3.21 scripts.postinstall` is EMPTY (the `scripts` block holds only package-internal dev/test scripts npm never runs on install).
- `npm view @arethetypeswrong/cli@0.18.4` -> version `0.18.4` published; `scripts.postinstall` EMPTY.
- The `npm install -D` run's `allow-scripts` warning listed only pre-existing workspace packages (esbuild/swc/nx/lmdb/etc.) -- NEITHER publint NOR attw appears, confirming both are install-script-free.

No human pause was taken (auto-mode pre-approval). The gate was NOT auto-approved blindly: the legitimacy re-confirmation above was executed before the install.

## What Was Built

### Task 1 -- Serialized install-e2e project scaffold -- commit `26cde91`

Cloned the four Phase-4 `e2e/angular-typechecker-cache-e2e` config files into `e2e/angular-typechecker-install-e2e/`:

- `vitest.config.mts`: full determinism block (`root: __dirname`, `nxViteTsPaths()` + `nxCopyAssetsPlugin([])`, `watch:false`, `globals:true`, `environment:'node'`, `include:['src/**/*.int.spec.ts']`, `pool:'forks'`, `poolOptions.forks.singleFork:true`, `fileParallelism:false`, `sequence.concurrent:false`); `name` + `cacheDir` retargeted to `angular-typechecker-install-e2e`; `testTimeout`/`hookTimeout` bumped to `300000` (install is slower than a bare `nx run`, D-21).
- `project.json`: `projectType:application`, `sourceRoot:e2e/angular-typechecker-install-e2e/src`, `tags:["scope:fixture"]`, `@nx/vitest:test` target (`reportsDirectory: coverage/e2e/angular-typechecker-install-e2e`), `implicitDependencies:["angular-typechecker"]` ONLY (dropped the consumer/dep dev-graph deps -- this project packs + audits the plugin, it does not use the dev-graph consumer).
- `tsconfig.json` + `tsconfig.spec.json`: cloned verbatim (`module:esnext`, `moduleResolution:bundler`, `types:["node","vitest/globals","vitest/importMeta","vitest"]`, includes `src/**/*.int.spec.ts`).

Config-only scaffold; no spec source added in Task 1.

### Task 2 -- Root devDeps publint + attw -- commit `5e7e1a7`

Added `@arethetypeswrong/cli@0.18.4` + `publint@0.3.21` to the ROOT `package.json` `devDependencies` (exact pins; npm defaulted to caret, tightened to exact to match the workspace convention) and synced `package-lock.json`. The plugin's published manifest (`packages/angular-typechecker/package.json`) was NOT touched -- these are tooling only (D-09). `.npmrc legacy-peer-deps=true` left intact.

### Task 3 -- tarball-audit gate against the packed .tgz -- commit `018e5cf`

`e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` (252 lines). Clones the cache-e2e harness shape (3-dirs-up `workspaceRoot`, `buildCleanEnv` NX\_\* hygiene, `execSync`). `beforeAll`: `nx build angular-typechecker --skip-nx-cache` (fresh dist, Pitfall 6) -> `npm pack --json` in the dist dir (capture `filename` + `files[].path`) -> extract the `.tgz` into a tmp dir under distDir to read the REAL packed `package/package.json` + `.d.ts`. Six `it(...)` gates (all required by D-09):

1. `publint <tgz> --strict` -- no error-level messages (execSync throws -> test fails on non-clean).
2. `attw <tgz> --profile node16 --format json` -- `analysis.problems` deep-equals `[]`. NO rule-suppression flag. THE D-10/B-02 verification.
3. Positive presence loop -- `executors.json`, `src/executors/angular-typecheck/{schema.json,executor.js}`, `src/index.{js,d.ts}`, `README.md`, `LICENSE`.
4. Negative leak loop -- each `files[].path` matches none of `/\.spec\./`, `/tsconfig\.spec/`, `/(libs|fixtures|e2e)\//`, `/typecheck-consumer/`.
5. `@fixtures` non-leak -- ZERO `@fixtures` in the concatenated shipped `.d.ts` text.
6. No install scripts -- the tarball `package.json` declares no `preinstall/install/postinstall/prepare/prepublish`.

`afterAll` removes the `.tgz` + the extraction dir (verified: no leftover artifacts in dist).

## D-10/B-02 Outcome: VERIFIED, no escalation

`attw angular-typechecker-0.0.1.tgz --profile node16 --format json` returns `analysis.problems: []` and a top-level `problems: {}` (empty). The 05-01 self-contained-types fix to `compiler-cli-types.ts` removed the deep `node_modules/@angular/compiler-cli` escape that previously produced `InternalResolutionError` on all four profiles. The B-02 escalation trigger (a real, unmasked resolution/FalseCJS problem) did NOT fire. The packed tarball's types resolve cleanly in a consumer install.

## Verification

- `npx nx run angular-typechecker-install-e2e:test --skip-nx-cache` exits 0 with all 6 audit `it(...)` blocks green (re-run twice; stable).
- `npx nx show project angular-typechecker-install-e2e --json` reports the `test` target with executor `@nx/vitest:test`.
- `npx attw --version` -> `cli: v0.18.4` (exit 0); `npx publint --version` -> `0.3.21` (exit 0).
- Manual cross-check: `publint <tgz> --strict` -> "All good!"; `attw <tgz> --profile node16 --format json` -> `analysis.problems: []`.
- rg guards: `ignore-rules` count 0 in the spec; `attw`/`LICENSE`/`typecheck-consumer`/`postinstall`/`npm pack` all present; `singleFork`/`fileParallelism:false`/`sequence:{concurrent:false}`/`300000` in vitest.config; `implicitDependencies` has no `typecheck-consumer`; plugin manifest carries no `publint`/`arethetypeswrong`.
- Exact pins: `"publint": "0.3.21"` and `"@arethetypeswrong/cli": "0.18.4"` in root package.json; both in package-lock.json.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tar -xzf` rejected the Windows drive-letter tarball path**

- **Found during:** Task 3 (first spec run).
- **Issue:** GNU tar (Git Bash, Windows arm64) read the absolute path `D:\...angular-typechecker-0.0.1.tgz` as a remote `host:path` rsh spec -> `tar (child): Cannot connect to D: resolve failed`, status 128, all 6 tests skipped. GNU's `--force-local` flag fixes it but BSD tar (macOS CI) lacks that flag.
- **Fix:** Extract with `cwd: distDir` and RELATIVE paths only -- the bare tgz filename + a relative `-C` subdir created under distDir. This form is handled identically by both GNU and BSD tar and never exposes a drive letter. Verified working.
- **Files modified:** e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
- **Commit:** 018e5cf

**2. [Rule 3 - Blocking] npm defaulted the two new devDeps to caret ranges**

- **Found during:** Task 2 (post-install verification).
- **Issue:** `npm install -D publint@0.3.21 @arethetypeswrong/cli@0.18.4` wrote `^0.3.21` / `^0.18.4`, failing the acceptance criterion (`git grep -c '"publint": "0.3.21"'` must return 1) and diverging from the workspace exact-pin convention.
- **Fix:** Edited both specifiers to exact (`0.3.21` / `0.18.4`), re-ran `npm install` to sync the lockfile.
- **Files modified:** package.json, package-lock.json
- **Commit:** 5e7e1a7

**3. [Rule 3 - Blocking] Literal-grep false positive on the `--ignore-rules` acceptance criterion**

- **Found during:** Task 3 (acceptance check).
- **Issue:** The attw-gate explanatory comment contained the literal `--ignore-rules` substring (saying "NO --ignore-rules"), tripping the `git grep -c "ignore-rules" ... returns 0` criterion -- the same class of false positive 05-01 hit on its file-header comment.
- **Fix:** Reworded the comment to "passes NO rule-suppression flag whatsoever" without the literal substring; no code change. Criterion now returns 0; the attw command still passes no suppression flag.
- **Files modified:** e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
- **Commit:** 018e5cf

No architectural deviations. No authentication gates. The package install ran only after the pre-approved legitimacy gate.

## Threat Model Adherence

- **T-05-05 (published tarball file-set leak):** the negative-leak loop over `npm pack --json files[].path` asserts no `.spec`/`tsconfig.spec`/`libs|fixtures|e2e`/`typecheck-consumer` ships; the `@fixtures` non-leak grep guards the shipped `.d.ts`. Both green.
- **T-05-06 (shipped .d.ts resolution / D-10 regression):** `attw --pack --profile node16` problems-empty gate, no `InternalResolutionError` ignore. Green -- the permanent regression detector for a future re-introduction.
- **T-05-07 (malicious postinstall in published tarball):** the no-install-scripts gate asserts `preinstall/install/postinstall/prepare/prepublish` all undefined in the tarball `package.json`. Green -- blocks reintroducing the s1ngularity postinstall vector.
- **T-05-SC (npm install of publint + attw):** legitimacy re-verified (versions resolve, no postinstall) before install; both are root devDeps only, never in the published manifest.

## Known Stubs

None. No placeholder/TODO/empty-data patterns in any file changed by this plan.

## Self-Check: PASSED

- FOUND: e2e/angular-typechecker-install-e2e/project.json
- FOUND: e2e/angular-typechecker-install-e2e/vitest.config.mts
- FOUND: e2e/angular-typechecker-install-e2e/tsconfig.json
- FOUND: e2e/angular-typechecker-install-e2e/tsconfig.spec.json
- FOUND: e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
- FOUND: package.json (modified -- publint + attw exact pins)
- FOUND: package-lock.json (modified)
- FOUND commit: 26cde91 (Task 1)
- FOUND commit: 5e7e1a7 (Task 2)
- FOUND commit: 018e5cf (Task 3)
