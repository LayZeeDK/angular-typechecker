---
phase: 260715-jho
reviewed: 2026-07-15T00:00:00Z
depth: quick
files_reviewed: 1
files_reviewed_list:
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 260715-jho: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** quick
**Files Reviewed:** 1
**Status:** clean

## Summary

Reviewed the new yarn-4 `ng generate angular-typechecker:configuration` e2e arbiter
cell against its sibling (`ng-add-ng-run-yarn.e2e.spec.ts`), `global-setup.ts`, and the
`@workspace/test-util` `sh` / `commandSucceeds` implementations. The focus was FALSE PASS
risk: whether a PASS actually settles the arbiter question ("does `ng generate` crash with
`TypeError: chalk.blue is not a function` under yarn 4?").

**Verdict: the arbiter is sound. No correctness or false-pass defect found.** A PASS
genuinely means the schematic did NOT crash, wired the target correctly, and the wired
target runs the full type-check. The three critical properties all hold:

1. **`sh` rethrows on non-zero exit (crash surfaces loudly).** Confirmed in
   `libs/test-util/src/lib/e2e-process.ts:144-186`: `sh` wraps `execSync` (which throws on
   non-zero exit) and, in `catch`, throws a `new Error(command + stdout + stderr)`. So the
   `sh('corepack yarn ng generate angular-typechecker:configuration ...')` call (spec
   lines 271-274) FAILS the test with the verbatim crash output if the convertNx schematic
   factory-load throws. The arbiter's core assumption ("`ng generate` has no swallowing
   `catch {}`") is backed by a real throw path, not an assertion the CLI could bypass.

2. **Defense-in-depth against a silent no-op.** Even in the hypothetical where `ng generate`
   swallowed a crash and exited 0 WITHOUT wiring, the non-vacuous wire assertions
   (lines 248 baseline `toBeUndefined()`; lines 279-283 `builder === 'angular-typechecker:typecheck'`
   and `tsConfig` deep-equals the exact `['tsconfig.app.json','tsconfig.spec.json']` leaf array)
   would fail on `undefined`. A factory-load throw precludes wiring, so there is no path
   where `chalk.blue` fires AND the test passes. The `skipIf(!corepackAvailable)` guard
   produces a SKIP (not a pass) where corepack yarn is unavailable.

3. **Planted-error assertions are specific and prove BOTH leaves run.** Codes are full
   `TSxxxx` tokens, not bare 4-digit substrings (lines 68-71), so an unrelated 4-digit
   hash/offset cannot false-match. `appTypeError: string = 123` yields TS2322 in the app
   BUILD leaf (`tsconfig.app.json`); `Math.abs("planted-app-spec-arg")` yields TS2345 in the
   SPEC leaf (`tsconfig.spec.json`). Requiring both (lines 307-308) means both leaves must
   have been compiled -- if only one ran, one `toContain` fails. The green clean-baseline
   run first (lines 289-290) proves the regression starts from a known-green executor, so
   the non-zero `appBad` exit (line 306) is a real diagnostic, not a crash. The
   `not.toMatch(ERR_REQUIRE_ESM)` / `not.toContain('chalk.blue')` / `not.toContain('infrastructure error')`
   guards (lines 311-313) confirm the CJS->ESM `import()` bridge survived a real yarn install.

The `plant` helper asserts the anchor was found (lines 164-170, `not.toBe(original)`), so a
future scaffold rename fails loudly instead of planting nothing. ASCII-only throughout (no
emoji / non-ASCII); cross-platform path handling (`join`, `tmpdir`, `mkdtempSync`); no debug
artifacts, no `TODO`/`FIXME`, no unintended empty catch blocks (the `catch` in `ngRun` and
`commandSucceeds` are deliberate result-capture / availability-probe patterns).

## Info

### IN-01: Blank-line-around-`if` style deviation (consistent with sibling, non-blocking)

**File:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts:242-245`
**Issue:** The `if (existsSync(...))` block that drops the npm lockfile has no blank line
before it (a comment precedes it) nor after it (`setupYarnWorkspace(...)` immediately
follows the closing brace). The CLAUDE.md JS/TS style rule calls for blank lines around
control-flow statements that are neither the first nor last line of their block. This is a
cosmetic authoring-preference deviation only -- it is byte-identical to the reviewed,
CI-green sibling (`ng-add-ng-run-yarn.e2e.spec.ts:243-249`), and ESLint (`maxWarnings:0`)
does not enforce blank-lines-around-`if`, so it does not fail the lint gate.
**Fix (optional, for strict CLAUDE.md adherence):**
```ts
cpSync(fixtureDir, tmp, { recursive: true });

// The committed fixture ships an npm lockfile; drop it so yarn.lock +
// packageManager: yarn become the authoritative package-manager signal.
if (existsSync(join(tmp, 'package-lock.json'))) {
  rmSync(join(tmp, 'package-lock.json'), { force: true });
}

setupYarnWorkspace(tmp, verdaccioUrl, verdaccioToken);
```
Leaving it as-is (matching the sibling) is equally acceptable; do not fix in isolation
unless the sibling is normalized too.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
