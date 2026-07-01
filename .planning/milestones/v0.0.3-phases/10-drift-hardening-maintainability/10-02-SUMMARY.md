---
phase: 10-drift-hardening-maintainability
plan: 02
subsystem: build/CI (build-time drift tripwire) + core (vendored shim guard)
tags: [HARD-01, HARD-02, HARD-04, drift-hardening, type-assertion, nx-target, ci]
requires:
  - 'compiler-cli-types.ts vendored shim corrected by Plan 01 (EmitFlags DTS=1..All=31, no fabricated zero-valued member)'
  - 'gather-diagnostics.ts all-getter gatherer (the 6 diagnostic getters + getTsProgram + getGlobalDiagnostics reach-through it calls)'
  - 'tsconfig.base.json (classic moduleResolution: node) -- the extends target that resolves the real barrel'
provides:
  - 'compiler-cli-types.drift.ts: per-member real->shim AssertAssignable probes (6 diagnostic getters) + getTsProgram ReturnType special-case + call-site arity probes + value-level UNKNOWN_ERROR_CODE/EmitFlags member pins'
  - 'tsconfig.drift.json: classic-node drift tsconfig (noEmit, ignoreDeprecations 6.0, files = [drift file])'
  - 'typecheck-drift Nx target (nx:run-commands -> tsc --noEmit -p tsconfig.drift.json) cached on the compiler-cli typings'
  - 'ci.yml wiring of typecheck-drift into the path-gated test job'
  - "D-07 HARD-01 REQUIREMENTS.md wording correction (removed/renamed/sig-changed breaks build; ADDED is the runtime spec's job)"
affects:
  - 'Plan 03 (runtime getter-set + encoding spec) -- the runtime half that covers ADDITIONS + encoding the build-time gate cannot see'
  - 'An @angular/compiler-cli upgrade -- the typecheck-drift cache invalidates on its typings, firing the drift check'
tech-stack:
  added: []
  patterns:
    - 'PlainTS `type AssertAssignable<From, To extends From> = true;` over a tuple of real->shim pairs (D-03, ZERO new dependency)'
    - "getTsProgram special-case: ReturnType<RealProgram['getTsProgram']> -> ts.Program (NOT a real->shim member pair, which fails TS2322 because the shim widens the return)"
    - 'Call-site arity probes (declare const real; never-called function) defending the optional->required silent gap'
    - 'Drift file excluded from BOTH production tsconfigs; compiled ONLY by tsconfig.drift.json under classic-node resolution'
    - 'nx:run-commands check target (cache:true, no outputs) with the installed compiler-cli typings as inputs'
key-files:
  created:
    - 'packages/angular-typechecker/src/core/compiler-cli-types.drift.ts'
    - 'packages/angular-typechecker/tsconfig.drift.json'
  modified:
    - 'packages/angular-typechecker/tsconfig.lib.json'
    - 'packages/angular-typechecker/tsconfig.spec.json'
    - 'packages/angular-typechecker/project.json'
    - '.github/workflows/ci.yml'
    - '.planning/REQUIREMENTS.md'
decisions:
  - "HARD-01 build-time half: per-member real->shim AssertAssignable tuple for the 6 diagnostic getters; getTsProgram special-cased as ReturnType -> ts.Program (the shim's TsProgram widens the return with useCaseSensitiveFileNames, so a member pair fails TS2322)"
  - 'Value-level imports (EmitFlags, UNKNOWN_ERROR_CODE) use a regular `import` (NOT `import type`): the pins read them as values; `import type` errored TS1361 and was switched to a value import (Rule 3 blocking-issue fix)'
  - 'Drift tsconfig extends tsconfig.base.json (classic node) with module:commonjs + ignoreDeprecations:6.0; files (singleton) not include, per D-06'
  - '*.drift.ts excluded from tsconfig.lib.json (added to exclude) AND tsconfig.spec.json (new exclude block) so the real-barrel import never resolves EMPTY under nodenext and breaks nx build/nx test'
  - 'CI wiring Option A (RESEARCH-recommended): folded typecheck-drift into the existing test job run-many list; SHA-pinned actions / persist-credentials:false / NX_DAEMON:false / contents:read envelope byte-unchanged; fixed target id + flags only'
  - 'typecheck-drift uses nx:run-commands with the installed compiler-cli index.d.ts + api.d.ts as inputs (a compiler-cli upgrade invalidates the cache -- the intended drift trigger); NO outputs (it is a check, not a build); NOT @nx/js:tsc'
  - 'ROADMAP Success Criterion 1 already carried the D-07-corrected wording (fixed during planning) -- no lockstep ROADMAP edit needed; only REQUIREMENTS.md still had the contradiction'
metrics:
  duration: ~4 min
  completed: 2026-06-29
  tasks: 3
  files: 7
---

# Phase 10 Plan 02: HARD-01 Drift Tripwire (Build-time Half) Summary

The build-time half of the two-pronged drift guard: a type-only
`compiler-cli-types.drift.ts` asserts the real `@angular/compiler-cli`
`api.Program` stays assignable TO the vendored shim, compiled by a classic-node
`tsconfig.drift.json` and run by a new cached `typecheck-drift` Nx target wired
into CI -- so a REMOVED, renamed, or signature-changed called getter (or a
changed `EmitFlags`/`UNKNOWN_ERROR_CODE`) breaks CI loudly instead of silently
under-gathering. The drift file is excluded from both production tsconfigs so it
never breaks `nx build`/`nx test` and never ships.

## What was built

### Task 1 -- drift tsconfig + assertions + production-tsconfig exclusions (commit 60452f6)

- **`tsconfig.drift.json`** (new): `extends ../../tsconfig.base.json`;
  `module: commonjs`, `moduleResolution: node`, `ignoreDeprecations: "6.0"`
  (load-bearing -- without it tsc 6.0 errors TS5107 on node10 resolution),
  `noEmit: true`, `declaration: false`, `types: ["node"]`, `skipLibCheck: true`;
  `files: ["src/core/compiler-cli-types.drift.ts"]` (singleton, per D-06).
- **`compiler-cli-types.drift.ts`** (new, type-only): an inverse-of-the-shim
  header explaining why it resolves the real barrel under classic-node and never
  ships; the PlainTS `AssertAssignable<From, To extends From>` helper (D-03);
  a tuple of 6 real->shim diagnostic-getter probes; the `getTsProgram`
  `ReturnType -> ts.Program` special-case (Pitfall 1 / LANDMINE); call-site
  probes at the gatherer's exact arities (no-arg + `'x.ts'`-arg
  `getNgSemanticDiagnostics`, the other getters no-arg, and
  `real.getTsProgram().getGlobalDiagnostics()` COR-02 reach-through); value-level
  `const _unknown: 500 = RealUnknown;` and the 7 `EmitFlags` member pins
  (DTS=1..All=31). All bindings `void`-ed.
- **Exclusions**: added `"src/**/*.drift.ts"` to `tsconfig.lib.json`'s `exclude`
  array; added a new `exclude: ["src/**/*.drift.ts"]` block to
  `tsconfig.spec.json` (it had none).

Verified: `tsc --noEmit -p tsconfig.drift.json` exits 0; `nx build` exits 0;
`nx run angular-typechecker:test --skip-nx-cache` (NX_DAEMON=false) -> 147/147
tests pass.

### Task 2 -- typecheck-drift Nx target + CI wiring (commit 8202764)

- **`project.json`**: new `typecheck-drift` target -- `executor:
nx:run-commands`, `cache: true`, `inputs` = the drift file, the shim,
  `tsconfig.drift.json`, `{workspaceRoot}/tsconfig.base.json`, and the installed
  `@angular/compiler-cli/index.d.ts` + `src/transformers/api.d.ts` (a
  compiler-cli upgrade invalidates the cache -- the intended drift trigger);
  `options.command: "tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json"`,
  `cwd: "."`. NO `outputs` (it is a check). Not `@nx/js:tsc`.
- **`ci.yml`** (Option A): changed the test job's run step from
  `npx nx run-many -t test ...` to
  `npx nx run-many -t typecheck-drift test -p angular-typechecker`. The
  SHA-pinned actions, `persist-credentials: false`, `NX_DAEMON: false`, and
  `permissions: contents: read` envelope are byte-unchanged (diff is the one run
  step + an explanatory comment).

Verified: `nx run angular-typechecker:typecheck-drift` exits 0;
`nx run-many -t typecheck-drift test -p angular-typechecker` exits 0 (caching
confirmed: 1 of 3 tasks read from cache).

### Task 3 -- D-07 HARD-01 wording correction (commit 427dc88)

- **`REQUIREMENTS.md`**: replaced HARD-01's internally contradictory acceptance
  text ("a new OR removed diagnostic getter breaks the build" alongside
  "real->shim direction only") with the corrected form -- a REMOVED, renamed, or
  signature-changed called getter breaks the build via the real->shim
  assignability assertion; newly-ADDED upstream getters are intentionally NOT a
  build failure (deliberate subset) and are surfaced by the runtime getter-set
  spec (Plan 03). The `ngErrorCode`/`UNKNOWN_ERROR_CODE` mirror clause is
  preserved; no other requirement changed (diff is exactly 1 line). ROADMAP SC1
  already carried the corrected wording (fixed during planning), so no lockstep
  ROADMAP edit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Value-level imports must not use `import type`**

- **Found during:** Task 1 (first `tsc -p tsconfig.drift.json` run)
- **Issue:** The plan/RESEARCH text described importing `EmitFlags`/
  `UNKNOWN_ERROR_CODE`; my first draft pulled them in via `import type` alongside
  `Program`. The value-level pins read `UNKNOWN_ERROR_CODE` as a VALUE
  (`const _unknown: 500 = RealUnknown;`) and `EmitFlags` as a value-namespace
  (`RealEmitFlags.DTS`), which `import type` forbids -> `tsc` errored TS1361
  ("'RealUnknown' cannot be used as a value because it was imported using
  'import type'").
- **Fix:** Split the imports -- `Program` stays `import type` (used only in type
  position); `EmitFlags` + `UNKNOWN_ERROR_CODE` now use a regular `import`
  (matching RESEARCH Pattern 3's `import { EmitFlags as ..., UNKNOWN_ERROR_CODE
as ... }`). The target is `noEmit`, so the value bindings are erased anyway.
- **Files modified:** packages/angular-typechecker/src/core/compiler-cli-types.drift.ts
- **Commit:** 60452f6 (fixed before the Task 1 commit)

No other deviations -- the rest of the plan executed exactly as written.

## Code-review-gated change (per AGENTS.md)

The `REQUIREMENTS.md` HARD-01 wording change (Task 3, D-07) is a
REQUIREMENTS/Success-Criterion wording change, which AGENTS.md ("Changing this
file") requires to be code-reviewed. This is satisfied by the phase
`code_review_gate` that reviews every source file changed in the phase.

## Security (V14 supply-chain)

No new dependency (D-03). The new `typecheck-drift` CI step reuses the existing
SHA-pinned actions, `persist-credentials: false`, `NX_DAEMON: false`, and
`permissions: contents: read` conventions and uses FIXED target ids/flags (no
untrusted-PR-metadata interpolation). `nx:run-commands` ships with nx core. No
new supply-chain surface; threat register dispositions T-10-02-01..03 (mitigate)
and T-10-02-SC (accept) are all honored. No HIGH threats.

## Verification results

- `tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json` -> exit 0
- `nx run angular-typechecker:typecheck-drift` -> exit 0
- `nx build angular-typechecker` -> exit 0
- `nx run angular-typechecker:test --skip-nx-cache` (NX_DAEMON=false) -> 147/147 pass
- `nx run-many -t typecheck-drift test -p angular-typechecker` (the exact CI form) -> exit 0
- `git grep -c "AssertAssignable" -- ...drift.ts` -> 8 (helper + 6 pairs + getTsProgram special-case; >= 7)
- `git grep -c "src/**/*.drift.ts" -- tsconfig.lib.json tsconfig.spec.json` -> 1 + 1 = 2
- `git grep -c "@nx/js:tsc" -- project.json` -> 1 (unchanged; only build uses it)
- `git grep -c "newly-ADDED" -- .planning/REQUIREMENTS.md` -> 1; old contradictory phrase -> 0

## Self-Check: PASSED

- Created files exist: compiler-cli-types.drift.ts, tsconfig.drift.json, 10-02-SUMMARY.md
- Commits exist: 60452f6 (Task 1), 8202764 (Task 2), 427dc88 (Task 3)
