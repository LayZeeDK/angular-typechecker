# Quick Task 260630-fg0: Second-round PR review findings - Implementation Research

**Researched:** 2026-06-30
**Domain:** angular-typechecker core/executor specifics (mechanical, read-only)
**Confidence:** HIGH (every claim is file:line-backed against the working tree at HEAD 13aa9ff)

## Summary

All findings are settled in CONTEXT.md; this answers ONLY the implementation specifics so the
planner can write precise tasks. The load-bearing change (#1) is a one-line structural edit to
`createCanonicalizer` plus a sentinel branch in the per-diagnostic loop; everything else is
comment edits, one test inversion, and additive tests that reuse existing harnesses verbatim.

Key constraint discovered: `finalize` is PRIVATE (run-typecheck.ts:369; only `runTypecheck`,
`resolveFilterBasePath`, `detectTemplateCheckAborted`, `TypecheckInfrastructureError` are exported
-- verified by `git grep "^export "`). So the S5(c) `warningCount`-split test cannot call `finalize`
directly -- it must drive it through `runTypecheck` using the `infra-failure.spec.ts` compiler-cli
stub (the only harness that can return a mixed-category set from a stubbed `performCompilation`).

---

## 1. #1 keep-on-throw edit (load-bearing)

**Current control flow (verified):** The per-diagnostic loop (filter-diagnostics.ts:78-103) calls
the canonicalizer ONCE per file at :91 (`const canonicalFile = canonicalize(diagnostic.file.fileName)`),
then branches keep/suppress at :93-102. The throw is swallowed INSIDE `createCanonicalizer`'s catch
at :131-138, which currently falls back to the raw path (`resolved = filePath`). The loop never sees
that a throw happened -- it gets a normal string and classifies it, which is the bug: an out-of-project
raw path classifies out-of-project and is SUPPRESSED.

**Recommended fix -- sentinel return (cleanest; minimal perturbation).** Make the canonicalizer
signal "could not resolve" by returning `undefined` from the catch, then treat that exactly like the
existing file-less keep at :85. This is preferred over an explicit keep-branch in the catch because
the catch is inside a SEPARATE function (`createCanonicalizer`) that has no access to `kept` /
`suppressedCount` -- pushing the keep decision back into the loop keeps all keep/suppress accounting
in one place and preserves the memoization + casefold on the SUCCESS path untouched.

Concrete shape (planner writes the exact diff):

- `createCanonicalizer` return type widens to `(filePath: string) => string | undefined`.
  - SUCCESS path UNCHANGED: realpath resolves -> normalize `\\`->`/` (:140) -> casefold (:141-143)
    -> `cache.set` (:145) -> return canonical. Memoization + case-fold still apply.
  - CATCH path (:131-138) changes the fallback from `resolved = filePath` to `return undefined`
    (do NOT cache `undefined`; a transient EACCES could resolve on a later call, though in practice
    the loop is single-pass -- not caching the failure is the conservative choice). Keep the existing
    pure-core comment but reframe it: "a throwing realpath cannot PROVE out-of-project, so signal
    `undefined` and let the caller KEEP the diagnostic (fail-safe). Silent -- core is PURE."
- In the loop, after :91 compute `const canonicalFile = canonicalize(diagnostic.file.fileName)` then
  add a guard BEFORE the node_modules/isUnderDir test (:93):
  ```ts
  if (canonicalFile === undefined) {
    kept.push(diagnostic);

    continue;
  }
  ```
  This mirrors the file-less keep idiom at :85-89 exactly (push + continue). `canonicalBase` at :73
  also calls the canonicalizer; a throw there is vanishingly unlikely (basePath is a real injected
  directory) but the planner should null-guard it too -- if `canonicalBase === undefined`, the safest
  bias is to KEEP everything for that call (treat as "cannot classify"). Simplest: keep the base
  computation as-is but the `isUnderDir(canonicalFile, canonicalBase)` call already short-circuits
  because we `continue` on `canonicalFile === undefined` first; a `undefined` base would only matter
  if a file DID resolve, which is the over-keep-safe direction anyway. Recommend the planner add the
  base guard for completeness but it is not strictly load-bearing for #1's correctness.

**`suppressedCount` in this path:** it MUST NOT increment. The new `canonicalFile === undefined`
branch does `kept.push(...) + continue` and never reaches the `suppressedCount++` at :97 -- the
diagnostic is kept, identical accounting to the file-less keep at :85.

**Purity preserved:** no `console`/`process` added (eslint bans both in `**/src/core/**`); the only
change is a return value + a loop branch.

---

## 2. T1 test inversion

**Current assertions (verified, filter-diagnostics.spec.ts):**
- Test name: `'RES-03: a throwing realpath is caught; an OUT-of-project diagnostic is still SUPPRESSED'` (:135)
- Setup: `diag('/ws/sibling-lib/src/b.ts')` with `realpath: () => { throw new Error('EACCES'); }`,
  `basePath: '/ws/proj'`, `includeDeps: false` (:136-143)
- Assertions: `expect(result.kept).toHaveLength(0);` (:145), `expect(result.suppressedCount).toBe(1);` (:146)
- Comment block: :128-134 ("...still classifies out-of-project and is SUPPRESSED ... Behavior is
  already correct -- this is a coverage gap, not a failing-then-passing change.")

**Flipped assertions (post-fix):**
- :145 -> `expect(result.kept).toHaveLength(1);`
- :146 -> `expect(result.suppressedCount).toBe(0);`
- Test name: rename to reflect KEEP, e.g.
  `'RES-03: a throwing realpath is caught and the diagnostic is KEPT (cannot prove out-of-project, fail-safe)'`
- Comment block (:128-134) rewrite to the locked intent: "a throwing realpath cannot PROVE the file
  is out-of-project, so the canonicalizer signals `undefined` and the diagnostic is KEPT (fail-safe
  bias for a correctness tool). Accepts a minor over-keep -- a genuinely out-of-project file whose
  realpath throws is now reported -- which is the correct direction: never silently drop a
  diagnostic on an unprovable boundary. This is a failing-then-passing change: pre-fix this asserted
  kept 0 / suppressed 1 (the buggy behavior)."

**No OTHER test asserts suppression-on-throw (verified).** `git grep` for every `suppressedCount).toBe(1)`
/ `kept).toHaveLength(0)` in the spec returns lines 145-146, 175-176, 187-188, 199-200, 226-227,
246-247, 266-267. ALL except 145-146 use an IDENTITY or MAPPING `realpath: (p) => p` / mapped stub
(not a throwing one) -- they test out-of-project / case-fold / store-segment classification on a
RESOLVING realpath and stay correct unchanged. The throwing-realpath companion KEEP test at :114-126
(in-project) already asserts `kept 1 / suppressed 0` and stays green. The non-throwing pnpm-symlink
success test (:88-106) is untouched.

---

## 3. #3 program-undefined guard

**Insertion point:** Between the post-compilation 500 scan and the FIRST `result.program` deref.
- Post-compilation 500 scan: run-typecheck.ts:240-248 (`const infrastructureFailure = result.diagnostics.find(...)`
  then `if (infrastructureFailure !== undefined) throw ...`).
- First `result.program` deref: run-typecheck.ts:268-270, inside the `finalize(...)` call:
  `useCaseSensitiveFileNames: result.program.getTsProgram().useCaseSensitiveFileNames()`.
- **Nothing between :248 and :268 reads `result.program`** (verified -- :250-267 is the `finalize`
  call's leading comment + `tsConfigPath`/`rootNamesCount`/`diagnostics`/`start`/`basePath`/
  `includeDeps` args; `result.program` first appears at :268). So insert the guard immediately AFTER
  the 500-scan `if` block closes (after :248) and BEFORE the `return finalize(...)` at :256.

**Wording matched to the existing two 500-scan throw sites.** Both existing sites construct
`TypecheckInfrastructureError` by FLATTENING a real compiler diagnostic's `messageText`:
- Config scan (:167-174): `throw new TypecheckInfrastructureError(ts.flattenDiagnosticMessageText(configInfrastructureFailure.messageText, '\n'));`
- Post-compilation scan (:244-248): `throw new TypecheckInfrastructureError(ts.flattenDiagnosticMessageText(infrastructureFailure.messageText, '\n'));`

The #3 guard has NO diagnostic to flatten (it fires on a structurally-absent program), so it passes a
LITERAL message. Recommended wording (matches the class's intent -- "the compiler failed to RUN"):
```ts
// #3 DEFENSE-IN-DEPTH: the real PerformCompilationResult.program is OPTIONAL
// (perform_compile.d.ts:29); the vendored shim narrows it to non-optional
// (compiler-cli-types.ts:166-185) to match the engine's guarded usage. A
// `{ program: undefined }` return WITHOUT a 500 diagnostic is type-permitted but
// not observed in @angular/compiler-cli@22.0.4 source -- this guard converts that
// hypothetical bare TypeError into the SAME infra-class failure as the rest of the
// path. DISJOINT from the post-compilation 500 scan above (which handles
// UNKNOWN_ERROR_CODE), so no double-handling.
if (result.program === undefined) {
  throw new TypecheckInfrastructureError(
    'angular-typecheck: the Angular compiler returned no Program ' +
      '(performCompilation produced neither a Program nor an UNKNOWN_ERROR_CODE ' +
      'diagnostic). This is an infrastructure failure, not a type error.',
  );
}
```
Style note: the two existing throws flatten a diagnostic; this one is a literal because there is no
diagnostic. The `angular-typecheck:` prefix matches the executor's infra `logger.error` (executor.ts:79)
and the synthesized zero-rootNames message (run-typecheck.ts:313). The guard's `result.program` narrowing
on the shim means TS will treat the access as always-defined; the planner should expect to keep the
shim non-optional (compiler-cli-types.ts:182-185) -- the guard is a RUNTIME defense, not a type change.

---

## 4. S3 pinning test harness

**Where:** Add to `executor.spec.ts`, NOT `evaluate-result.spec.ts`. Rationale:
- The behavior under test is "`errorCount 0 + templateCheckAborted set -> { success: true }` WITH a
  `logger.warn` emitted". `logger.warn` is the EXECUTOR's responsibility (executor.ts:52-63) -- it is
  never reached from `evaluateResult` (evaluate-result.ts has no logger and no `templateCheckAborted`
  awareness; it reads only `errorCount`/`warningCount`). So the test must exercise the executor.
- `evaluateResult` is already fully covered by evaluate-result.spec.ts:6-67 for the `errorCount 0 ->
  success true` mapping; an evaluate-result test could not assert the warn at all.

**Existing harness to reuse (executor.spec.ts):** It hoist-mocks all four core seams
(`runTypecheck`, `renderReport`, `evaluateResult`, `normalizeOptions`) plus `@nx/devkit`'s `logger`
(:10-64), and has TWO ready-made builders:
- `coreResult(errorCount)` (:66-76) -- a clean CoreResult with `errorCount`, `suppressedCount 0`.
- `abortedCoreResult(fileName)` (:80-85) -- `{ ...coreResult(1), templateCheckAborted: { code: -993004, fileName } }`.

The existing RES-02 warn tests (:147-193) already prove the warn fires/does-not-fire and assert
`mocks.loggerWarn` with `expect.stringContaining(...)`, and that `mocks.loggerError` is NOT called.

**Minimal NEW S3 test (the pinning gap -- abort + ZERO errors + success:true):** the existing
`abortedCoreResult` uses `coreResult(1)` (errorCount 1 -> evaluateResult stubbed `success:false`).
S3 pins the DISTINCT advisory-not-verdict case: abort set BUT `errorCount 0` STILL yields
`{ success: true }`. Add a builder variant or inline a `{ ...coreResult(0), templateCheckAborted: {
code: -993004, fileName: '/ws/libs/x/poison.component.ts' } }`, stub `mocks.evaluateResult.mockReturnValue({ success: true })`,
call the executor, then assert:
```ts
expect(result).toEqual({ success: true });        // verdict NOT forced false by the abort
expect(mocks.loggerWarn).toHaveBeenCalledOnce();   // the loud notice still fires
expect(mocks.loggerError).not.toHaveBeenCalled();  // not an infra error
```
This pins the locked 09-RES-02-DECISION.md advisory-not-verdict policy (the abort is a WARN, never a
`success:false`). The `mockReturnValue({ success: true })` is what models `evaluateResult` seeing
`errorCount 0` -- the executor delegates the verdict to `evaluateResult` (executor.ts:75), so stubbing
its return is the correct seam (it is mocked at :47-49).

---

## 5. S5(a)/(c)/(d) test patterns

### S5(a) -- config-500 scan with NON-empty rootNames

**File:** `infra-failure.spec.ts` (the COR-01 describe block at :239-316).
**Helper:** `errorDiagnostic(code, message)` (:52-61, file-less Error) + the hoisted
`compilerCliStub.readConfiguration` mock (:25-36 / overridden per test at :248-265).
**Pattern:** The existing COR-01 500 test (:245-285) uses `rootNames: []`. S5(a) adds a sibling that
sets `rootNames: ['/virtual/error.component.ts']` (NON-empty) AND a code-500 in `errors`, proving the
config-500 scan (run-typecheck.ts:163-174) fires regardless of rootNames -- i.e. it is rootNames-INDEPENDENT
because the scan at :163 precedes the zero-rootNames guard at :186. Assert
`rejects.toBeInstanceOf(TypecheckInfrastructureError)` and `expect(compilerCliStub.performCompilation).not.toHaveBeenCalled()`
(the throw at :167 short-circuits before `performCompilation` at :208). Reuse `readConfiguration.mockReturnValue({...})`
exactly like :248-265 but with non-empty `rootNames`.

### S5(c) -- mixed Error+Warning set through finalize for warningCount

**File:** `infra-failure.spec.ts` (the main describe at :89-226) -- NOT a `finalize` unit test, because
`finalize` is PRIVATE (not exported; verified). The only way to exercise the `warningCount` split
(run-typecheck.ts:402-404) on a UNIT (no-cold-compiler) basis is through `runTypecheck` with the
stubbed `performCompilation` returning a mixed-category diagnostic set.
**Helpers:** `errorDiagnostic(code, message)` (:52-61, category 1=Error) + a NEW sibling
`warningDiagnostic(code, message)` with `category: 0` (Warning) -- model it on `errorDiagnostic` but
`category: 0 /* ts.DiagnosticCategory.Warning */`. (Note `fileDiagnostic` at :66-75 is Error-only; add
the warning builder rather than overloading it.) Use `fakeProgram()` (:81-87) for the non-infra path.
**Pattern:** `compilerCliStub.performCompilation.mockReturnValue({ diagnostics: [errorDiagnostic(2322,...),
warningDiagnostic(<some-warning-code>,...)], program: fakeProgram() })`, then assert
`result.errorCount === 1` AND `result.warningCount === 1` (proving the EXPLICIT category split at
:399-404, guarding the MD-02 `length - errorCount` anti-bug). To keep the file-less diagnostics
through the filter (they are kept regardless -- run-typecheck.ts:85), use file-less builders so the
boundary filter does not suppress either; that isolates the count logic.

### S5(d) -- `.ngtypecheck.tsx` pass-through for normalizeShimFileName

**File:** `run-typecheck.spec.ts` (the `detectTemplateCheckAborted` describe at :57-164).
**Helper:** `diagnostic(code, fileName?)` (:63-73). `normalizeShimFileName` is private; it is exercised
through the EXPORTED `detectTemplateCheckAborted` (:449), exactly as the existing shim tests at :109-137 do.
**Pattern:** The regex is `/\.ngtypecheck\.ts$/` (run-typecheck.ts:492) -- it is `.ts$`-anchored, so a
`.ngtypecheck.tsx` input does NOT match and passes through UNCHANGED. Add:
```ts
const reported = [diagnostic(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE, '/ws/app/poison.component.ngtypecheck.tsx')];

expect(detectTemplateCheckAborted(reported)?.fileName).toBe('/ws/app/poison.component.ngtypecheck.tsx');
```
This pins the `$` anchor: a `.tsx` shim name is left verbatim (it would only ever appear in a
hypothetical future `.tsx` source; documented LIMITATION at run-typecheck.ts:476-483 says `.tsx` sources
collapse to `<name>.ngtypecheck.ts`, never `.tsx`, so this is a negative-case anchor guard). Mirrors the
existing `.ngtypecheck.ts` positive test at :109-124 and the non-shim leave-unchanged test at :126-137.

---

## 6. S1/S2 comment edits

### S1 -- de-pin compiler-cli-types.ts:98

**Confirmed text (compiler-cli-types.ts:97-99):**
```
 * the literal `0` (the emit-neutralizing value, with `noEmit: true`); `0` is not
 * a declared member, so the call site uses an explicit CAST
 * (`emitFlags: 0 as EmitFlags`, run-typecheck.ts:229) -- a bare `: EmitFlags = 0`
```
The `emitFlags: 0 as EmitFlags` statement is actually at run-typecheck.ts:232 (verified). Line 229 is
the START of the comment block above it (`// D-05a / V-2: emitFlags: 0 AND noEmit: true are BOTH...`).
**Fix:** Replace the line pin `run-typecheck.ts:229` with a SYMBOL reference, e.g.
`(\`emitFlags: 0 as EmitFlags\` at the \`performCompilation\` call site in run-typecheck.ts)` -- drop the
brittle line number. (Do NOT change it to `:232`; CONTEXT.md locks "replace the line pin with a symbol
reference" precisely because line numbers drift.)

### S2 -- document, do NOT drop TemplateCheckAborted.code

**Confirmed field site (run-typecheck.ts:80-83):**
```ts
export interface TemplateCheckAborted {
  code: number;
  fileName: string | undefined;
}
```
`code` is at run-typecheck.ts:81. It IS asserted by infra-failure.spec.ts:219-221
(`expect(result.templateCheckAborted?.code).toBe(TCB_GENERATION_FATAL_DIAGNOSTIC_CODE)`) and
run-typecheck.spec.ts:94-97 (`detectTemplateCheckAborted(reported)).toEqual({ code: ..., fileName: ... })`).
The executor (executor.ts:52-63) reads only `.fileName`, never `.code` -- which is why a reviewer flagged
it unused. Dropping it breaks both specs.
**Fix:** Add a one-line note at/above :81 that `code` is RETAINED as the detector's public shape (always
`NG(3004) === -993004` at v22.0.4), pinned by the detector/drift tests (infra-failure.spec.ts:219-221,
run-typecheck.spec.ts:94-97) even though the current adapter only consumes `fileName`. The existing
doc comment at :73-79 already documents what `code` IS (the negative-encoded code); S2 just adds WHY
it is kept despite being adapter-unused.

---

## #2 (already CONFIRMED in CONTEXT, restated for the planner) -- diagnostic-codes.ts stale "reported set"

**Confirmed (`git grep "reported set"`):**
- diagnostic-codes.ts:71 -- `* the reported set is the signal that drives the loud RES-02 suppression notice.`
- diagnostic-codes.ts:86 -- `* scans the reported set for this exact value to flag the template-check abort.`

Detection scans the PRE-filter gathered set in `finalize` (the raw `diagnostics` arg -- run-typecheck.ts:419
passes `diagnostics`, NOT `reported`; the in-code comment at :406-418 already says "the PRE-filter
`diagnostics` arg ... NOT the post-filter `reported` set"). Fix both lines to say "the PRE-filter gathered
set (the raw `diagnostics` `finalize` receives), NOT the post-boundary-filter `reported` set" to match
run-typecheck.ts's already-correct wording.

---

## Affected files + edit type (planner task map)

| File | Edit | Specifics |
|------|------|-----------|
| `filter-diagnostics.ts` | code | #1: canonicalizer returns `undefined` on throw (:131-138); loop adds `canonicalFile === undefined -> keep+continue` guard after :91 |
| `filter-diagnostics.spec.ts` | test inversion | T1 at :135-147 -> `kept 1`/`suppressed 0` + comment rewrite (:128-134) + rename |
| `diagnostic-codes.ts` | comment | #2: lines 71, 86 "reported set" -> "PRE-filter gathered set" |
| `run-typecheck.ts` | code + comment | #3 guard inserted after :248, before :256; S2 doc note at :81 |
| `compiler-cli-types.ts` | comment | S1: de-pin `:229` at line 98 -> symbol reference |
| `executor.spec.ts` | new test | S3: abort + errorCount 0 -> `success:true` + `logger.warn`, reuse `abortedCoreResult`/`coreResult(0)` |
| `infra-failure.spec.ts` | new tests | S5(a): config-500 + non-empty rootNames; S5(c): mixed Error+Warning via stubbed `performCompilation` (add `warningDiagnostic` builder) |
| `run-typecheck.spec.ts` | new test | S5(d): `.ngtypecheck.tsx` pass-through via `detectTemplateCheckAborted` |

**No work (per CONTEXT --analyze):** S4 (REFUTED, leave drift comments), S5(b) (REFUTED duplicate),
S6 (DECLINE). No `.planning/` behavior change. Commits land on `gsd/v0.0.3-engine-hardening` (PR #11).

## Sources

All HIGH confidence -- direct reads of the working tree at HEAD 13aa9ff:
- `filter-diagnostics.ts` (canonicalizer :115-149, loop :78-103, throw catch :131-138)
- `filter-diagnostics.spec.ts` (T1 :128-147, KEEP companion :114-126, all suppression assertions via `git grep`)
- `run-typecheck.ts` (500 scan :240-248, program deref :268-270, throw sites :167/:244, TemplateCheckAborted :80-83, finalize private :369, exports via `git grep "^export "`)
- `executor.ts` (warn :52-63, verdict delegation :75) + `executor.spec.ts` (mocks :10-64, builders :66-85, RES-02 warn tests :147-193)
- `run-typecheck.spec.ts` (detectTemplateCheckAborted suite :57-164, shim tests :109-137)
- `infra-failure.spec.ts` (compiler-cli stub :25-50, builders :52-87, COR-01 500 :245-285)
- `diagnostic-codes.ts` (:71, :86 via `git grep "reported set"`)
- `compiler-cli-types.ts` (EmitFlags :98, PerformCompilationResult.program narrowing :166-185)
- `evaluate-result.ts` + `evaluate-result.spec.ts` (no logger/templateCheckAborted awareness -> S3 belongs in executor.spec.ts)

## RESEARCH COMPLETE

`.planning/quick/260630-fg0-address-second-round-pr-review-findings/260630-fg0-RESEARCH.md`
