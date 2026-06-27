# Phase 03 - Deferred / Out-of-Scope Items (discovered during execution)

These were discovered during plan execution but are NOT caused by the current
plan's changes (SCOPE BOUNDARY). Logged here, not fixed.

## 03-02: `nx build angular-typechecker` fails inside the parallel-executor worktree (environment, pre-existing)

- **Discovered during:** 03-02 verification (the `<verification>` GATE A build step).
- **Symptom:** `npx nx build angular-typechecker` fails with
  - `TS2307: Cannot find module '../../../../node_modules/@angular/compiler-cli/src/transformers/api'`
  - `TS2307: Cannot find module '../../../../node_modules/@angular/compiler-cli/src/perform_compile'`
  - `TS7006: Parameter 'diagnostic' implicitly has an 'any' type` (cascade from the above) in `run-typecheck.ts:147`
- **Root cause:** the git worktree at
  `.claude/worktrees/agent-a77251a8488706331/` has NO local `node_modules`
  (`ls node_modules` -> `total 0`). Dependencies are installed only at the main
  repo root. `npx vitest`/`npx nx` resolve packages by walking up to the main
  repo's `node_modules`, so the test runner works; but `compiler-cli-types.ts`
  re-exports the compiler-cli surface via a HARDCODED deep relative path
  (`../../../../node_modules/@angular/compiler-cli/...`, see its file header /
  STATE.md [01-03 CAVEAT]) that is relative to the worktree package dir, where no
  `node_modules` exists, so `tsc` cannot resolve it during the `@nx/js:tsc` build.
- **Why out of scope for 03-02:** the two failing files (`compiler-cli-types.ts`,
  `run-typecheck.ts`) are NOT modified by plan 03-02. Plan 03-02 adds only a pure,
  dependency-free module (`evaluate-result.ts`, `import type { CoreResult }` only)
  plus its spec. Both compile cleanly under the spec tsconfig
  (`tsc --noEmit -p tsconfig.spec.json` shows zero errors attributable to
  `evaluate-result`), and the full unit/integration suite (12 files, 45 tests)
  passes. The GATE A static specs (`gate-a-static.spec.ts`) also require a built
  `dist/`, which the worktree cannot produce for the same reason.
- **Resolution:** the orchestrator runs the build/GATE-A verification on the
  MERGED result in the main repo (which has `node_modules`), where the deep
  relative path resolves. No code fix needed for 03-02. If the worktree build is
  ever required directly, install deps in the worktree
  (`npm install --legacy-peer-deps`) or make `compiler-cli-types.ts` resolve via a
  bare specifier instead of a deep relative path (a separate, pre-existing-caveat
  task tracked in STATE.md [01-03 CAVEAT]).

## 03-02: pre-existing `@nx/enforce-module-boundaries` lint errors in `compiler-cli-types.ts` (out of scope)

- **Discovered during:** 03-02 post-commit lint check.
- **Symptom:** `nx lint angular-typechecker` reports 2 errors --
  `compiler-cli-types.ts:15` and `:20` "External resources cannot be imported
  using a relative or absolute path (@nx/enforce-module-boundaries)".
- **Root cause:** the same deep relative path re-exports documented in STATE.md
  [01-03 CAVEAT]. Pre-existing; present at the base commit; NOT introduced by
  03-02.
- **Why out of scope:** 03-02 does not modify `compiler-cli-types.ts`. The new
  files `evaluate-result.ts` + `evaluate-result.spec.ts` lint completely clean
  (eslint exit 0, zero problems). The D-11 `core/**` `no-restricted-imports`
  override is plan 03-04's scope, not 03-02.
- **Resolution:** addressed by the existing [01-03 CAVEAT] follow-up (resolve the
  compiler-cli surface via a bare specifier when @angular/compiler-cli ships
  nodenext-clean typings). No action for 03-02.
