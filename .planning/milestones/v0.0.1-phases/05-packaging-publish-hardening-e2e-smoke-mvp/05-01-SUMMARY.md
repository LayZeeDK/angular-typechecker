---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
plan: 01
subsystem: packaging-manifest
tags: [pkg-01, manifest, license, types, d-10, b-02]
requires:
  - 'Phase 1-4: built plugin (compiler-loader.js GATE A import(), core boundary, executor schema v2)'
provides:
  - 'Self-contained shipped .d.ts surface (no deep node_modules escape) -- attw-resolvable in a consumer install'
  - 'Full PKG-01 publishable manifest (files/exports/keywords/repository/license/description/author/homepage/bugs/publishConfig)'
  - 'Per-package LICENSE shipped into dist via build asset glob'
  - 'checkVersionMismatches:false guard on the public peer ranges'
  - 'Consumer README with the PUBLISHED executor-id recipe + Brandon Roberts positioning'
  - 'Manifest regression backstop spec for every new PKG-01 field'
affects:
  - '05-02 (tarball audit gate: attw --pack must now report problems-empty)'
  - '05-03 (e2e smoke consumes the published manifest + executor id)'
  - '05-04 (nx release reads the manifest; repository.url is the OIDC byte-match anchor)'
tech-stack:
  added: []
  patterns:
    - 'Self-contained structural type re-declaration over the typescript substrate (no deep dependency import) for nodenext-clean shipped types'
    - '@nx/js:tsc verbatim source-manifest -> dist copy + asset glob for non-compiled files (LICENSE)'
key-files:
  created:
    - packages/angular-typechecker/LICENSE
  modified:
    - packages/angular-typechecker/src/core/compiler-cli-types.ts
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/project.json
    - packages/angular-typechecker/eslint.config.mjs
    - packages/angular-typechecker/src/package-manifest.spec.ts
    - packages/angular-typechecker/README.md
decisions:
  - 'compiler-cli-types: declare PerformCompilationResult.program NON-optional (engine only reaches it on the non-infra-failure path; infra path re-throws first) to keep the build green without touching run-typecheck.ts'
  - 'compiler-cli-types: getTsProgram(): TsProgram (= ts.Program & { useCaseSensitiveFileNames(): boolean }) -- the public ts.Program type omits that method but the runtime instance exposes it'
  - 'EmitFlags + UNKNOWN_ERROR_CODE declared as `declare enum` / `declare const` so they serve both type and value positions with zero runtime emit'
metrics:
  duration: ~30 min
  completed: 2026-06-28
  tasks: 3
  files: 7
---

# Phase 5 Plan 01: Manifest + Build-Output Correctness Summary

Made the plugin publishable (full PKG-01 manifest + per-package LICENSE + consumer README) and fixed the one production-code defect that blocked a resolvable tarball: the shipped `compiler-cli-types.d.ts` is now self-contained, eliminating the deep-relative `node_modules` escape that `attw --pack` flagged as `InternalResolutionError`.

## What Was Built

### Task 1 -- compiler-cli-types self-contained (D-10/B-02) -- commit `bf32775`

Replaced the two deep `import type` statements (`../../../../node_modules/@angular/compiler-cli/src/{transformers/api,perform_compile}`) -- which climbed OUT of the published package and failed to resolve in a consumer install -- with hand-declared structural types over the `typescript` substrate (`import type * as ts from 'typescript'`). The exported names are preserved verbatim (`CompilerCli`, `Program`, `EmitFlags`, `ParsedConfiguration`), and the `CompilerCli` member set (`readConfiguration`, `performCompilation`, `defaultGatherDiagnostics`, `EmitFlags`, `UNKNOWN_ERROR_CODE`, `formatDiagnostics`) is unchanged, so the public type contract holds. The two now-unused `@nx/enforce-module-boundaries` eslint-disable directives were removed. Runtime is untouched (still `await import('@angular/compiler-cli')` by bare specifier in `compiler-loader.ts`).

The build is the drift guard: it caught two real mismatches (see Deviations) which were resolved by narrowing the declared shapes to the engine's actual guarded usage -- not by editing any caller.

### Task 2 -- manifest + LICENSE + assets + eslint -- commit `f39436d`

- `package.json`: added `description`, `keywords` (incl. `nx` + `nx-plugin`), `author` (public email `larsbrinknielsen@gmail.com`), `license: MIT`, `homepage`, `bugs.url`, `repository` (`LayZeeDK` casing, `directory: packages/angular-typechecker`), `exports` (`.` + `./package.json`, no conditional entries), `files` (`["src","executors.json","README.md","LICENSE"]`), `publishConfig: { provenance: true }` (no `access`). Core fields + locked deps/peers (`^22.0.0` / `>=6.0.0 <6.1.0`) + engines kept verbatim. `tslib` retained (base tsconfig sets `importHelpers:true`; lint confirms it is not obsolete).
- `LICENSE`: per-package MIT text, `Copyright (c) 2026 Lars Gyrup Brink Nielsen`.
- `project.json`: added the `LICENSE` asset glob; removed the dead `generators.json` glob; kept both `**/!(*.ts)` and `**/*.d.ts` globs verbatim.
- `eslint.config.mjs`: added `checkVersionMismatches: false` to the `@nx/dependency-checks` options so the autofix cannot rewrite `^22.0.0` -> `22.0.4` (still catches MISSING/OBSOLETE).

### Task 3 -- manifest spec + README -- commit `46155da`

- `package-manifest.spec.ts`: widened `PluginManifest` and added 7 `it(...)` blocks asserting `files` (exact array), `exports` (`.` + `./package.json`), `keywords` (contains `nx` + `nx-plugin`), `repository.url`/`repository.directory` (exact strings), `license`, non-empty `description`, `publishConfig.provenance === true`. 12 manifest tests total (was 5); runs in the fast `nx test` loop.
- `README.md`: replaced the stub with the consumer guide -- Brandon Roberts positioning, install, both the per-project `project.json` recipe and the cacheable `nx.json` `targetDefaults` recipe (mirrored from the live nx.json) using the PUBLISHED unscoped id `angular-typechecker:angular-typecheck`, `includeDeps:true` guidance for non-buildable deps, peer ranges + `--legacy-peer-deps` note for Angular pre-releases, and the options table. ASCII-only.

## Verification

- `npx nx build angular-typechecker` exits 0.
- GATE A: built `compiler-loader.js` still contains a literal `import(` (count 1); shipped `compiler-cli-types.d.ts` contains NO deep `node_modules/@angular/compiler-cli` import (count 0).
- `npx nx lint angular-typechecker` exits 0 (one pre-existing unused-vars WARNING in an unrelated spec; no dependency-checks / nx-plugin-checks errors).
- `npx nx test angular-typechecker` exits 0 (20 files, 106 tests; 12 in the extended manifest spec).
- dist carries the new manifest fields + `LICENSE` (the dist `package.json` is the verbatim source copy modulo the trailing-newline strip `@nx/js:tsc` applies).
- grep guards: no deep escape in `compiler-cli-types.ts`; PUBLISHED executor id (not the dev key) in the README; no `consensus.dk` leak in manifest or README.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getTsProgram()` return type missing `useCaseSensitiveFileNames()`**

- **Found during:** Task 1 (build drift guard, TS2339).
- **Issue:** A naive `getTsProgram(): ts.Program` does not type-check `result.program.getTsProgram().useCaseSensitiveFileNames()` in `run-typecheck.ts` -- the public `ts.Program` interface omits `useCaseSensitiveFileNames()` (it lives on the host), though the runtime instance exposes it.
- **Fix:** Declared `TsProgram = ts.Program & { useCaseSensitiveFileNames(): boolean }` and typed `getTsProgram(): TsProgram`. Structurally accurate; no caller change.
- **Files modified:** packages/angular-typechecker/src/core/compiler-cli-types.ts
- **Commit:** bf32775

**2. [Rule 1 - Bug] `PerformCompilationResult.program` optionality**

- **Found during:** Task 1 (build drift guard, TS18048).
- **Issue:** Angular's own declaration types `program?` optional, but `run-typecheck.ts` accesses `result.program` unguarded on the non-infrastructure-failure path (the infra path re-throws before any access). A `program?: Program` declaration broke the build.
- **Fix:** Declared `program: Program` NON-optional, matching the engine's guarded usage. The infra-failure spec (which mocks `program: undefined`) is unaffected -- it casts via `as unknown as CompilerCli` and is not lib-compiled.
- **Files modified:** packages/angular-typechecker/src/core/compiler-cli-types.ts
- **Commit:** bf32775

**3. [Rule 3 - Blocking] Acceptance-criterion literal-grep false positive on the file-header comment**

- **Found during:** Task 1 (acceptance check).
- **Issue:** The explanatory file header originally contained the literal `node_modules/@angular/compiler-cli` string (describing the OLD deep import), which tripped the `git grep -c "node_modules/@angular/compiler-cli" ... returns 0` acceptance criterion.
- **Fix:** Reworded the comment to describe the old deep-relative specifier without the exact substring; no code change. Criterion now returns 0 matches.
- **Files modified:** packages/angular-typechecker/src/core/compiler-cli-types.ts
- **Commit:** bf32775

No architectural deviations. No authentication gates. No package installs (the `publint`/`attw` devDeps are added in 05-02 under their own legitimacy gate).

## Threat Model Adherence

- **T-05-01 (tarball file-set leak):** explicit `files` allowlist `["src","executors.json","README.md","LICENSE"]` added (D-01). Negative-leak assertion is enforced in 05-02.
- **T-05-02 (shipped .d.ts deep escape):** fixed at source (Task 1); `attw --pack` problems-empty is the 05-02 regression gate.
- **T-05-03 (peer-range autofix):** `checkVersionMismatches:false` set; the manifest spec asserts the exact ranges; manifest never `eslint --fix`'d.
- **T-05-04 (contact-metadata disclosure on a PUBLIC repo):** `author` uses the public email; grep confirms no `consensus.dk` leak in manifest or README.

## Known Stubs

None. No placeholder/TODO/empty-data patterns in any file changed by this plan.

## Self-Check: PASSED

- FOUND: packages/angular-typechecker/LICENSE
- FOUND: packages/angular-typechecker/src/core/compiler-cli-types.ts (modified)
- FOUND: packages/angular-typechecker/package.json (modified)
- FOUND: packages/angular-typechecker/project.json (modified)
- FOUND: packages/angular-typechecker/eslint.config.mjs (modified)
- FOUND: packages/angular-typechecker/src/package-manifest.spec.ts (modified)
- FOUND: packages/angular-typechecker/README.md (modified)
- FOUND commit: bf32775 (Task 1)
- FOUND commit: f39436d (Task 2)
- FOUND commit: 46155da (Task 3)
