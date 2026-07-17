---
phase: quick-260717-p9r
plan: 01
subsystem: test-util / cli-e2e
tags: [test-scaffolding, refactor, dedup, e2e]
requires: []
provides:
  - "libs/test-util assertShippedBinExitCodes(tmp, env) shared CLI shim exit-code helper"
affects:
  - "e2e/angular-typechecker-cli-e2e (npm/pnpm/yarn shim exit-code specs)"
tech-stack:
  added: []
  patterns:
    - "Extract-triplicated-block -> shared test-util helper (mirrors assertPerProjectScoping)"
key-files:
  created: []
  modified:
    - libs/test-util/src/lib/cli-e2e.ts
    - libs/test-util/src/index.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts
    - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts
decisions:
  - "Removed the now-dead `const isWin` local from all three specs (its only consumer, the shim-resolution block, moved into the helper) -- required for the e2e spec-tsconfig noUnusedLocals tsc to stay green"
metrics:
  tasks: 2
  files: 5
  commits: 2
  completed: 2026-07-17
---

# Phase quick-260717-p9r Plan 01: Extract triplicated shim exit-code assertion Summary

Extracted the ~55-line shim exit-code assertion block triplicated across the three CLI
package-manager e2e specs (npm / pnpm / yarn) into a single
`assertShippedBinExitCodes(tmp, env)` helper in `libs/test-util/src/lib/cli-e2e.ts`
(reusing `runShim` + `plant`, owning the three former per-spec constants), then collapsed
each spec to one helper call and pruned the now-dead imports/constants -- net -267 lines,
zero behavior change (same runs, same expected exit codes 0/1/2, same order).

## Tasks

### Task 1 -- helper + barrel export (commit 094153f)

- Added `assertShippedBinExitCodes(tmp, env): void` to `cli-e2e.ts`. Byte-for-byte reproduces
  the specs' assertion sequence: shim-resolution (both `.bin` names) -> exit 0 clean (both
  bins) -> exit 2 infrastructure (both bins) -> exit 2 usage (`--nonsense`, no `-c`) ->
  exit 1 planted TS2322 (both bins, `try { plant } finally { restore }`). Carried over the
  explanatory comments and a doc comment framing it as the shared VER-04 contract.
- Moved the three copy-pasted constants (`COMPONENT_ANCHOR` / `COMPONENT_INJECTION` /
  `PLANTED_CODE`) into the file as module-private consts.
- Added imports `existsSync, readFileSync, writeFileSync` (node:fs), `expect` (vitest),
  and `plant` from `./ng-cli-e2e` (reused, not re-implemented); `join` was already imported.
- Exported `assertShippedBinExitCodes` from the test-util barrel alongside `runShim`.

### Task 2 -- collapse the three PM specs + prune (commit 9526f22)

- npm (`cli-exit-codes.e2e.spec.ts`): replaced the block with `assertShippedBinExitCodes(tmp, npmEnv)`;
  kept the npm-only extras inline AFTER the helper call (helper restores the fixture clean in
  its finally) -- `runNpx` clean(0) + infra(2) and the multi-tsConfig UNION `runShim(..., ['-c',
  'tsconfig.json', '-c', 'tsconfig.spec.json'], npmEnv)` -> 0. Pruned `existsSync/readFileSync/
  writeFileSync` (node:fs) and `plant` (@workspace/test-util); kept `cpSync/mkdtempSync` and
  `runShim` (UNION still uses it).
- pnpm (`cli-exit-codes-pnpm.e2e.spec.ts`): replaced the block with `assertShippedBinExitCodes(tmp, pnpmEnv)`.
  Pruned `plant` + `runShim` (@workspace/test-util); kept all node:fs imports (pnpm's own
  package-lock/pnpm-workspace/package.json setup still uses them).
- yarn (`cli-exit-codes-yarn.e2e.spec.ts`): replaced the block with `assertShippedBinExitCodes(tmp, npmEnv)`
  (the yarn spec's env binding is `npmEnv`). Pruned `plant` + `runShim`; kept all node:fs
  imports (`setupYarnWorkspace` still uses them).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the now-dead `const isWin` from all three specs**
- **Found during:** Task 2
- **Issue:** `const isWin = process.platform === 'win32';` was used ONLY by the shim-resolution
  line (`const shimSuffix = isWin ? '.cmd' : '';`) inside the moved block; the helper inlines
  `process.platform === 'win32'`. After the block moved, `isWin` was unused in all three specs.
  The plan's import-pruning list named the constants + imports to remove but did not mention
  `isWin`; leaving it would fail the e2e spec-tsconfig `tsc --noEmit` (noUnusedLocals).
- **Fix:** Deleted the `const isWin` declaration in each of the three specs.
- **Files modified:** the three cli-exit-codes*.e2e.spec.ts
- **Commit:** 9526f22
- **Consistent with:** success criterion "Every removed import/constant was genuinely unused."

No other deviations. No production/`src` file touched.

## Verification

All five locally-achievable gates run with `--skip-nx-cache`. The full Verdaccio e2e tier
(verdaccio + npm/pnpm/yarn installs) was intentionally NOT run locally -- it is the
CI-authoritative per-project matrix gate, not a local step for this refactor.

**Gate 1 -- `npx nx typecheck test-util`: PASS**
```
> tsc --noEmit -p libs/test-util/tsconfig.spec.json

 NX   Successfully ran target typecheck for project test-util
```

**Gate 2 -- `npx nx typecheck angular-typechecker-cli-e2e`: PASS** (the real spec gate --
`tsc --noEmit -p e2e/angular-typechecker-cli-e2e/tsconfig.spec.json`)
```
> tsc --noEmit -p e2e/angular-typechecker-cli-e2e/tsconfig.spec.json

 NX   Successfully ran target typecheck for project angular-typechecker-cli-e2e
```

**Gate 3 -- `npx nx test test-util`: PASS**
```
 ↓ |test-util| src/lib/cli-e2e.spec.ts (1 test | 1 skipped)
 ✓ |test-util| src/lib/e2e-process.spec.ts (5 tests) 398ms
 Test Files  3 passed | 1 skipped (4)
      Tests  11 passed | 1 skipped (12)

 NX   Successfully ran target test for project test-util
```

**Gate 4 -- `npx nx lint test-util`: PASS**
```
Linting "test-util"...
* All files pass linting

 NX   Successfully ran target lint for project test-util
```

**Gate 5 -- `npx prettier --check` (all 5 changed files): PASS**
```
Checking formatting...
All matched files use Prettier code style!
```

## Self-Check: PASSED

- Commits exist: `094153f` (helper + barrel), `9526f22` (spec collapse) -- both in `git log`.
- All 5 modified files present on disk.
- `assertShippedBinExitCodes` exported from `libs/test-util/src/index.ts` (line 40).

## Commits

- `094153f` test(test-util): add shared assertShippedBinExitCodes CLI e2e helper
- `9526f22` test(cli-e2e): collapse triplicated shim exit-code block to shared helper

Both are `test`-type (non-releasing -- no version bump), which is correct for test-only scaffolding.
