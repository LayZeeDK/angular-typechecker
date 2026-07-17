---
phase: quick-260717-p9r
verified: 2026-07-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Quick Task 260717-p9r: Extract triplicated shim exit-code assertion Verification Report

**Phase Goal:** Extract the triplicated shim exit-code assertion block from the three CLI PM e2e specs (npm/pnpm/yarn) into a shared `assertShippedBinExitCodes(tmp, env)` helper in `libs/test-util`, keeping the npm spec's `runNpx` + multi-tsConfig union extras inline. Test-only refactor; no production change.
**Verified:** 2026-07-17
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `libs/test-util` exports `assertShippedBinExitCodes(tmp, env)` alongside `runShim` | VERIFIED | `cli-e2e.ts:109` `export function assertShippedBinExitCodes(tmp: string, env: NodeJS.ProcessEnv): void`; barrel `index.ts:39-43` re-exports it alongside `runShim`. Reuses local `runShim` (same file) and imports `plant` from `./ng-cli-e2e` (`cli-e2e.ts:7`) -- not re-implemented. Owns the three former per-spec constants `COMPONENT_ANCHOR`/`COMPONENT_INJECTION`/`PLANTED_CODE` (`cli-e2e.ts:88-93`, module-private). |
| 2 | All three CLI PM e2e specs (npm/pnpm/yarn) call the helper instead of the inline block | VERIFIED | npm `cli-exit-codes.e2e.spec.ts:126` `assertShippedBinExitCodes(tmp, npmEnv)`; pnpm `:143` `assertShippedBinExitCodes(tmp, pnpmEnv)`; yarn `:169` `assertShippedBinExitCodes(tmp, npmEnv)`. `git grep` confirms ZERO leftover `runShim`/`plant`/`const isWin`/`COMPONENT_*`/`PLANTED_CODE` in pnpm+yarn specs (exit 1, no matches). |
| 3 | npm baseline keeps its `runNpx` clean(0)/infra(2) and multi-tsConfig UNION assertions inline | VERIFIED | npm spec retains `runNpx` (defined `:55`, used `:132` -> `toBe(0)`, `:133` -> `toBe(2)`) and the UNION `runShim(..., ['-c','tsconfig.json','-c','tsconfig.spec.json'], npmEnv)` -> `toBe(0)` (`:141-147`), placed AFTER the helper call (helper restores fixture clean in `finally`). `runShim` import kept only in npm spec for the UNION. |
| 4 | The e2e spec tsconfig type-checks with pruned imports and the new helper signature | VERIFIED | Orchestrator ran `npx nx typecheck angular-typechecker-cli-e2e` (`tsc --noEmit -p tsconfig.spec.json`) = PASS; `npx nx typecheck test-util` = PASS. Dead `const isWin` removed from all three specs (SUMMARY auto-fix, required for `noUnusedLocals`). `?? .planning` only untracked path; working tree otherwise clean. |
| 5 | No production/src change; assertions run in same order with same expected exit codes 0/1/2 | VERIFIED | `git show --stat` of both commits touches ONLY `libs/test-util/{index.ts,lib/cli-e2e.ts}` (094153f) and the three `cli-exit-codes*.e2e.spec.ts` (9526f22); `rg "packages/angular-typechecker/src"` across both = no matches. Diff of the removed pnpm block vs the helper: identical assertion sequence (shim-resolution both bins -> 0/0 clean -> 2/2 infra -> 2/2 usage -> 1/1 planted TS2322 with the same `toContain(PLANTED_CODE)` / `not.toMatch(ERR_REQUIRE_ESM)` / `not.toContain('infrastructure error')` guards + `try/finally` restore), differing only in the env binding. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `libs/test-util/src/lib/cli-e2e.ts` | helper + module-private constants | VERIFIED | `export function assertShippedBinExitCodes` at `:109`; constants at `:88-93`; imports `plant` (`:7`), `existsSync/readFileSync/writeFileSync` (`:2`), `expect` (`:5`); doc comment frames it as the shared VER-04 contract. |
| `libs/test-util/src/index.ts` | barrel re-export | VERIFIED | `:39-43` `export { assertShippedBinExitCodes, runShim, type ShimResult } from './lib/cli-e2e';` |
| `e2e/.../cli-exit-codes.e2e.spec.ts` | npm baseline + npm-only extras inline | VERIFIED | Helper call `:126` + `runNpx`/UNION inline `:132-147`; `plant`/`existsSync`/`readFileSync`/`writeFileSync` pruned, `cpSync`/`mkdtempSync`/`runShim` kept. |
| `e2e/.../cli-exit-codes-pnpm.e2e.spec.ts` | pnpm spec calling helper | VERIFIED | Helper call `:143`; `plant`+`runShim` pruned; all `node:fs` imports kept (pnpm setup uses them). |
| `e2e/.../cli-exit-codes-yarn.e2e.spec.ts` | yarn spec calling helper | VERIFIED | Helper call `:169`; `plant`+`runShim` pruned; all `node:fs` imports kept (`setupYarnWorkspace` uses them). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `index.ts` | `lib/cli-e2e.ts` | `export { assertShippedBinExitCodes, ... }` | WIRED | `index.ts:39-43` |
| `lib/cli-e2e.ts` | `lib/ng-cli-e2e.ts` | `import { plant } from './ng-cli-e2e'` | WIRED | `cli-e2e.ts:7`; `plant` re-exported from `ng-cli-e2e` barrel (`index.ts:34`) -- reuse, not re-implemented |
| three PM specs | `@workspace/test-util` | `import { assertShippedBinExitCodes }` | WIRED | npm `:9`, pnpm `:15`, yarn `:15` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| test-util unit specs pass | `npx nx test test-util` (orchestrator-run) | 11 passed / 1 skipped | PASS |
| helper + spec type-checks | `npx nx typecheck test-util` + `... angular-typechecker-cli-e2e` (orchestrator-run) | PASS both | PASS |
| Full Verdaccio e2e tier (real npm/pnpm/yarn installs) | -- | not run | SKIP -- CI-authoritative per-project matrix gate (>10s, starts Verdaccio + PM installs); byte-for-byte equivalence proven from the diff instead |

### Anti-Patterns Found

None. No debt markers (`TODO`/`FIXME`/`XXX`/`HACK`) introduced; no stubs; no `console.log`-only bodies; no hardcoded-empty renders. This is byte-for-byte-equivalent test scaffolding.

### Gaps Summary

None. All five must-haves are VERIFIED. The helper exists, reuses `runShim`+`plant`, owns the three former constants, and is barrel-exported; all three PM specs collapse to a single helper call with correct per-file env binding and correct import pruning; the npm baseline retains `runNpx` (0/2) and the multi-tsConfig UNION inline; both commits touch only test-util + the three e2e specs (no `packages/angular-typechecker/src`); and the removed block matches the helper byte-for-byte, so the "no behavior change / same order / same exit codes 0/1/2" contract holds. The full Verdaccio e2e tier is intentionally deferred to CI's per-project matrix and is not a local or human-verify gap.

---

_Verified: 2026-07-17_
_Verifier: Claude (gsd-verifier)_
