---
phase: 260719-iib
plan: 01
status: complete
subsystem: core/cli/test-util
tags: [ci, fallow, macos, relativize, complexity, additive-only]
requirements:
  - CI-PR47-1-macos-snapshot
  - CI-PR47-2-fallow-gate
dependency_graph:
  requires:
    - "Phase 30 diagnostic-record.ts relativizePath (D-13 shared projection)"
    - "Phase 26 parse-args.ts parseCliArgs"
    - "Phase 30 json-report.ts buildAdvisories"
  provides:
    - "macOS-correct relativizePath fallback (stripBaseCaseInsensitive)"
    - "fallow new-only gate green vs origin/main (exit 0)"
  affects:
    - "PR #47 ci check (unblocks the v0.2.3 Release-PR merge)"
tech_stack:
  added: []
  patterns:
    - "case-insensitive base strip with real-casing remainder (pure, OS-independent)"
    - "Validated<T> per-flag validator result + assembler builder (complexity decomposition)"
    - "per-field Partial<Advisories> spread (byte-identical key order)"
    - "shared execToRunResult execSync->RunResult wrapper (clone dedupe)"
key_files:
  created:
    - packages/angular-typechecker/src/core/diagnostic-record.spec.ts
  modified:
    - packages/angular-typechecker/src/core/diagnostic-record.ts
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/core/json-report.ts
    - libs/test-util/src/lib/e2e-process.ts
    - libs/test-util/src/lib/ng-cli-e2e.ts
decisions:
  - "relativizePath keeps a byte-identical fast path (relative() non-escape) and only recovers via stripBaseCaseInsensitive when it escapes -- Windows/Linux JSON+SARIF snapshots stay byte-unchanged; only macOS is corrected."
  - "stripBaseCaseInsensitive is exported for the direct unit test but NOT added to the public barrel (index.ts) -- ADD-01 preserved."
  - "parseCliArgs/buildAdvisories decomposed via extraction (not a .fallowrc health.ignore) since both decompose cleanly into pure helpers; observable output byte-identical."
metrics:
  duration: 15m
  completed: 2026-07-19
  tasks: 3
  files: 6
---

# Quick Task 260719-iib: Resolve v0.2.3 CI failures Summary

Fixed the two real red checks on PR #47 -- the macOS-only `machine-reporters-json`
snapshot mismatch and the `fallow` new-only complexity/duplication gate -- without
touching any public/observable surface. All repo gates plus `fallow ... --base
origin/main` now pass (exit 0).

## What was built

### Task 1 -- macOS relativizePath fix (commit 6817f87)

`relativizePath` (the ONE D-13 projection reached by both `json-report.ts` and
`sarif-report.ts`) escaped with `../../..` on macOS: `node:path` `relative()` is
case-sensitive on POSIX, and on a case-insensitive FS the Angular compiler lowercases
advisory-list file names (`useCaseSensitiveFileNames=false`) while `pathBase` keeps
the real cwd case, so no common prefix was found. Linux passes (case-sensitive FS
keeps real case); Windows passes (`path.win32.relative` is case-insensitive).

- Rewrote `relativizePath` with a **byte-identical fast path** (undefined base ->
  slash-normalize only; non-escaping `relative()` -> returned unchanged), and a
  fallback to the new pure helper only when `relative()` escapes.
- Added exported `stripBaseCaseInsensitive(absolutePath, pathBase)`: case-insensitive
  base comparison, real-casing remainder, separator-boundary guard (a sibling like
  `/repo/rootx` is not a child), trailing-separator strip, `''` on exact match,
  `undefined` on a genuine escape. OS-independent pure string logic -> unit-testable
  on Windows without a macOS runner. NOT in the barrel.
- New `diagnostic-record.spec.ts` (10 tests). Per the plan-checker refinement, the
  "preserve real casing of the remainder" and macOS-reproduction properties are
  asserted by calling `stripBaseCaseInsensitive` **directly** (a `relativizePath`-
  routed assertion would false-pass on this Windows machine via the case-insensitive
  `path.win32.relative` fast path).

### Task 2 -- complexity decomposition (commit 6a5aba0)

Behavior-preserving extractions so fallow's new-only complexity gate passes
(`parseCliArgs` was 16 cyclo / 17 cog / 109 LOC; `buildAdvisories` 11 cyclo / 37.1 CRAP):

- `parse-args.ts`: hoisted the parseArgs option config to a module const; extracted
  pure validators `validateTsConfig` / `validateMaxWarnings` / `validateFormat` (each
  returning a `Validated<T>` = `{ok,value} | {ok:false,message}`) plus a
  `buildParsedOptions` assembler. `parseCliArgs` is now a flat linear read with the
  single try/catch + D-14 mapping intact. HELP_TEXT, flag registration, and every
  message string are byte-unchanged.
- `json-report.ts`: split `buildAdvisories`'s 5-branch conditional-spread chain into
  one per-field helper (each returns `Partial<Advisories>` = `{}` or `{key:value}`).
  The spread order fixes the emitted key order -> payload byte-identical.

### Task 3 -- clone dedupe (commit 6f8e455)

Extracted one exported `execToRunResult(command, { cwd, env, maxBuffer? })` in
`e2e-process.ts` (the identical `execSync` -> `RunResult` try/catch that fallow flagged
as clone `f730a954`). `run()` calls it with the default buffer; `createNgRun`
(`ng-cli-e2e.ts`) with 20 MB (IN-02). Passing `maxBuffer: undefined` is byte-equivalent
to omitting it, so behavior is byte-identical. Removed the now-unused `execSync` import
from `ng-cli-e2e.ts`; the e2e-process import uses the repo's inline-type form.

## Verification (all green)

| Gate | Result |
|------|--------|
| `nx test angular-typechecker` | PASS (544 tests; new diagnostic-record.spec.ts = 10) |
| `nx integration angular-typechecker` | PASS (139 tests; committed snapshots BYTE-UNCHANGED, no `-u`) |
| `nx typecheck angular-typechecker` | PASS (tsc spec/drift/tools) |
| `nx lint angular-typechecker` | PASS (maxWarnings:0, incl. @nx/dependency-checks) |
| `nx typecheck test-util` + `nx lint test-util` | PASS |
| `nx format:check` (repo root) | PASS (exit 0) |
| `npx fallow audit --format human --base origin/main` | **exit 0** -- "No issues in 189 changed files"; clone `f730a954` + both complexity findings gone |

Fallow evidence (final run, HEAD 6f8e455):
```
Audit scope: 189 changed files vs origin/main
✓ No issues in 189 changed files (0.88s)
EXIT=0
```

## Additive-only charter (ADD-01)

Holds. `git diff --stat angular-typechecker@0.2.2 -- src/index.ts src/index.drift.ts`
is empty (barrel byte-unchanged). No public signature change (`relativizePath`
signature preserved; `stripBaseCaseInsensitive` is a non-barrel internal export),
no JSON/SARIF payload-shape change (integration snapshots byte-unchanged), and zero
new dependencies (my three commits touched only the 6 source files; the sole
package.json insertion on the branch is Phase 31's node-sarif-builder, pre-existing).

## Deviations from Plan

None material to the fix. Process note: `format:check` initially flagged three files
(a long `Validated<T>` one-liner + two wrapped assertion lines) AFTER the first Task
1/2 commits; ran `nx format:write` and rebuilt the three task commits via a soft reset
(feature branch, nothing pushed) so each task commit is atomic and format-clean.

## Known Stubs

None.

## Self-Check: PASSED

- Created file exists: `packages/angular-typechecker/src/core/diagnostic-record.spec.ts` -> FOUND
- Commits exist: 6817f87 (Task 1), 6a5aba0 (Task 2), 6f8e455 (Task 3) -> all FOUND in git log
- My commits touched exactly the 6 planned files, zero `.snap` files -> confirmed
