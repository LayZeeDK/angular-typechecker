---
phase: quick-260630-jnl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
autonomous: true
requirements: [] # PR-review polish task -- no roadmap requirement IDs (expected empty)
user_setup: []

must_haves:
  truths:
    - 'The S5c test FAILS under the buggy `warningCount = length - errorCount` and PASSES under the correct explicit category split (anti-tautology restored) -- CONTEXT #1'
    - 'The `isUnderDir(file, undefined base)` over-keep branch (filter-diagnostics.ts:188-190) is exercised by a test whose realpath throws for the base only -- CONTEXT #2'
    - 'The program-undefined guard (run-typecheck.ts:265-272) is exercised by a test that returns `{ diagnostics: [], program: undefined }` (no 500) and reaches the guard, not the post-compilation 500 scan -- CONTEXT #3'
    - 'No stale line pin `run-typecheck.ts:265-267` remains in compiler-cli-types.runtime.spec.ts -- CONTEXT #4'
    - 'run-typecheck.ts:260 reads `finalize CALL ARGS` (not `finalize below`) and :255 names `the optional program? field of PerformCompilationResult` (not `perform_compile.d.ts:29`) -- CONTEXT #5'
    - 'No production behavior change anywhere -- specs plus two source comments only'
  artifacts:
    - path: 'packages/angular-typechecker/src/core/infra-failure.spec.ts'
      provides: 'file-less suggestionDiagnostic builder + upgraded S5c (3-element set, anti-tautology guard) + program-undefined-no-500 guard test'
      contains: 'function suggestionDiagnostic'
    - path: 'packages/angular-typechecker/src/core/filter-diagnostics.spec.ts'
      provides: 'base-throw realpath test covering the undefined-base over-keep branch'
      contains: 'isUnderDir undefined-dir branch'
    - path: 'packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts'
      provides: 'de-pinned symbol reference for the useCaseSensitiveFileNames read'
      contains: 'getTsProgram().useCaseSensitiveFileNames()'
    - path: 'packages/angular-typechecker/src/core/run-typecheck.ts'
      provides: 'two reworded/de-pinned comments (CALL ARGS precision + symbolic perform_compile field)'
      contains: 'the finalize CALL ARGS below'
  key_links:
    - from: 'infra-failure.spec.ts S5c test'
      to: 'run-typecheck.ts finalize category split'
      via: 'stubbed performCompilation returning a 3-element [Error, Warning, Suggestion] set'
      pattern: "toBeLessThan\\(result\\.diagnostics\\.length\\)"
    - from: 'filter-diagnostics.spec.ts base-throw test'
      to: 'filter-diagnostics.ts isUnderDir undefined-base branch'
      via: "realpath that throws for '/ws/proj' only, identity for files"
      pattern: 'isUnderDir'
    - from: 'infra-failure.spec.ts program-undefined test'
      to: 'run-typecheck.ts:265-272 guard'
      via: 'performCompilation returning { diagnostics: [], program: undefined }'
      pattern: 'returned no Program'
---

<objective>
Address the five third-round `/pr-review-toolkit:review-pr` findings on PR #11
(`gsd/v0.0.3-engine-hardening`, HEAD a1bcb80). Every finding is self-inflicted polish
from the round-2 changes: three are missing-coverage test additions, two are
comment/line-pin precision fixes. NO production behavior changes anywhere.

Purpose: restore the S5c test's anti-tautology power (it currently cannot catch the
MD-02 `length - errorCount` regression it claims to guard), cover two shipped-but-untested
defensive branches, and remove a stale line pin + sharpen two comments so the
drift-machinery / comment-accuracy convention holds.

Output: edits to four files under `packages/angular-typechecker/src/core/` -- three spec
files (new tests + one builder) and two comment edits in `run-typecheck.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md

Runs on the MAIN TREE (single-plan wave -- no worktree, per AGENTS.md
"Single-plan wave: skip worktrees"). `node_modules` is already installed; no junction
needed. Honor CLAUDE.md / AGENTS.md style: ASCII-only (no emoji, em/en dashes, curly
quotes, ellipsis); blank lines around control flow and `return`; always braces for
control-flow bodies; preserve `core/**` purity (no new imports beyond what is already
present in each file). This is a `quick-full` task; commit each task with the conventional
type/scope shown in its `<done>` (clean `core` scope, NO quick-id in scope, NO AI
attribution).
</execution_context>

<context>
@.planning/quick/260630-jnl-address-third-round-pr-review-findings/260630-jnl-CONTEXT.md
@.planning/quick/260630-jnl-address-third-round-pr-review-findings/260630-jnl-RESEARCH.md

<interfaces>
<!-- Exact current state extracted from the codebase. Executor uses these directly; no -->
<!-- exploration needed. RESEARCH.md carries the copy-ready code blocks for each insert. -->

infra-failure.spec.ts: file-less builders live at :52-76 (`errorDiagnostic` category 1,
`warningDiagnostic` category 0). The `TS2322` constant is declared at :17 and
`UNKNOWN_ERROR_CODE = 500` at :16. The S5c test is the `it('S5c: counts errorCount and
warningCount EXPLICITLY ...')` at :248-265 inside the `describe('runTypecheck
infrastructure-failure handling (D-06)')` block (:104). The D-06 `beforeEach` (:105-121)
restores a default `readConfiguration` with non-empty `rootNames`, so a new test in that
describe reaches `performCompilation`. `fakeProgram()` (:96-102) supplies the
`getTsProgram().useCaseSensitiveFileNames()` host the boundary filter reads. The
import-the-engine idiom is `const { runTypecheck, TypecheckInfrastructureError } = await
import('./run-typecheck');`. Diagnostics are stubbed via
`compilerCliStub.performCompilation.mockReturnValue({ diagnostics: [...], program })`.

filter-diagnostics.spec.ts: the `diag(fileName, code = 2322)` builder is at :14-23. The
shared `base` config (`basePath: '/ws/proj'`, `useCaseSensitiveFileNames: true`,
`realpath: (p) => p`) is at :26-30. Existing throwing-realpath tests at :116-128 and
:137-149 throw for EVERY input, so they short-circuit at filter-diagnostics.ts:100
(`canonicalFile === undefined`) and never reach `isUnderDir` with an undefined base.

filter-diagnostics.ts: line 100 short-circuits a keep when `canonicalFile === undefined`.
`isUnderDir(canonicalFile, canonicalDir)` at :184-194 returns `true` when
`canonicalDir === undefined` (:188-190) -- the over-keep-safe branch being covered.

compiler-cli-types.runtime.spec.ts: the stale pin is the comment at :117-118
"the boundary filter's case-fold reads `getTsProgram().useCaseSensitiveFileNames()`
(`run-typecheck.ts:265-267`)." The real read moved to run-typecheck.ts:292-294 (line 265
is now the program-undefined guard).

run-typecheck.ts: the `#3 DEFENSE-IN-DEPTH` comment block is :254-264. Line 255 contains
"(@angular/compiler-cli perform_compile.d.ts:29)". Line 260 contains "access in `finalize`
below". The actual `result.program.getTsProgram().useCaseSensitiveFileNames()` deref is in
the `finalize(...)` call args at :292-294. The guard message is :266-271 (verbatim:
"angular-typecheck: the Angular compiler returned no Program (performCompilation produced
neither a Program nor an UNKNOWN_ERROR_CODE diagnostic). This is an infrastructure failure,
not a type error."). Do NOT touch the guard logic or message text.
</interfaces>

@packages/angular-typechecker/src/core/infra-failure.spec.ts
@packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
@packages/angular-typechecker/src/core/filter-diagnostics.ts
@packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
@packages/angular-typechecker/src/core/run-typecheck.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restore S5c anti-tautology + cover the two untested defensive branches (tests)</name>
  <files>
    packages/angular-typechecker/src/core/infra-failure.spec.ts,
    packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  </files>
  <action>
Three test changes, all using the EXACT copy-ready code in RESEARCH.md (do not paraphrase
the assertions or builder shape).

(#1) In infra-failure.spec.ts, add a file-less `suggestionDiagnostic(code, message)` builder
alongside the existing file-less builders at :52-76. It mirrors `warningDiagnostic` but with
`category: 2` (ts.DiagnosticCategory.Suggestion) and the `// S5c:` lead comment from
RESEARCH.md explaining a Suggestion is RETAINED in `CoreResult.diagnostics` but NEVER counted,
so it makes `diagnostics.length` STRICTLY exceed `errorCount + warningCount` and breaks the
`length - errorCount` tautology a 2-element set could not. Then upgrade the S5c test (:248-265):
feed a 3-element set `[errorDiagnostic(TS2322, ...), warningDiagnostic(6133, ...),
suggestionDiagnostic(6138, ...)]`, KEEP the existing `expect(result.errorCount).toBe(1)` and
`expect(result.warningCount).toBe(1)` asserts, and ADD as the final assert
`expect(result.errorCount + result.warningCount).toBeLessThan(result.diagnostics.length);`
with the MD-02 anti-tautology comment from RESEARCH.md. Use suggestion code 6138 (a benign
real TS "declared but never read" suggestion code -- only `.category` matters; NOT 500, NOT a
`-99xxxx` NG code). Failing-then-passing intent (verify by reasoning): the 3-element set is 1
error + 1 warning + 1 suggestion; correct explicit-count code gives `1 + 1 = 2 < 3` PASS, while
the buggy `warningCount = length - errorCount = 3 - 1 = 2` gives `1 + 2 = 3`, which is NOT `< 3`
and FAILS as intended.

(#2) In filter-diagnostics.spec.ts, add the `RES-03` test from RESEARCH.md whose injected
`realpath` THROWS for the base (`'/ws/proj'`) ONLY and returns identity for files
(`/ws/proj/src/a.ts`). Call `filterDiagnostics([diag('/ws/proj/src/a.ts')], { basePath:
'/ws/proj', useCaseSensitiveFileNames: true, realpath, includeDeps: false })`; assert
`result.kept` length 1 and `result.suppressedCount` 0. This is the ONLY path that reaches
`isUnderDir` with an undefined base: the file canonicalizes normally (line-100 short-circuit
does NOT fire), `canonicalBase` is undefined, so `isUnderDir(file, undefined)` returns true
(filter-diagnostics.ts:188-190) -> kept. Add a brief comment naming the covered branch
(`isUnderDir undefined-dir branch`).

(#3) In infra-failure.spec.ts, add a new test INSIDE the `describe('runTypecheck
infrastructure-failure handling (D-06)')` block (the D-06 `beforeEach` supplies non-empty
rootNames so execution reaches `performCompilation`). Stub
`compilerCliStub.performCompilation.mockReturnValue({ diagnostics: [], program: undefined })`
(NO 500), import `{ runTypecheck, TypecheckInfrastructureError }`, and assert
`rejects.toBeInstanceOf(TypecheckInfrastructureError)` AND `rejects.toThrow(/returned no
Program/)` using the broad OS-independent regex (do NOT pin the full guard sentence). Empty
`diagnostics` means the post-compilation 500 scan finds nothing, so execution reaches the
distinct guard at run-typecheck.ts:265-272 (NOT the 500 scan that the existing
program-undefined test exits through).

Style: ASCII-only; blank lines around control flow and `return` inside the injected
`realpath`; always braces. Do NOT touch infra-failure.spec.ts:204 (claimed "same drift" is
REFUTED -- prose, no pin). No production code edits in this task.
</action>
<verify>
<automated>npx nx test angular-typechecker</automated>
Specifically: the upgraded `S5c: counts errorCount and warningCount EXPLICITLY ... (MD-02)`
test passes (including the new `toBeLessThan(result.diagnostics.length)` assert); the new
`RES-03` base-throw test in filter-diagnostics.spec.ts passes (kept 1 / suppressed 0); and
the new program-undefined-no-500 test in the D-06 describe passes
(`rejects.toBeInstanceOf(TypecheckInfrastructureError)` + `rejects.toThrow(/returned no
    Program/)`). All pre-existing tests still pass.
</verify>
<done>
All three test additions land and the full `nx test angular-typechecker` suite is green. The
S5c anti-tautology guard is restored (would FAIL under the `length - errorCount` bug). No
production source changed. Commit: `test(core): de-tautologize S5c warning count and cover
program-undefined + undefined-base filter branches`.
</done>
</task>

<task type="auto">
  <name>Task 2: De-pin stale line reference + sharpen two run-typecheck comments (comments only)</name>
  <files>
    packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts,
    packages/angular-typechecker/src/core/run-typecheck.ts
  </files>
  <action>
Two comment-only files; NO behavior change, NO assertion change.

(#4) In compiler-cli-types.runtime.spec.ts, the comment at :117-118 cites
`(run-typecheck.ts:265-267)` for the `useCaseSensitiveFileNames()` read. That read shifted to
~:292-294 when the b71447d guard insertion took over line 265. Replace the parenthetical line
pin with a SYMBOL reference and NO line number -- e.g. change "reads
`getTsProgram().useCaseSensitiveFileNames()` (`run-typecheck.ts:265-267`)." to "reads
`getTsProgram().useCaseSensitiveFileNames()` -- the `getTsProgram().useCaseSensitiveFileNames()`
read in `runTypecheck`." (or equivalent wording that drops the line numbers while keeping the
symbol). Do NOT alter the `expect(...).toBe('function')` assertion below it. The claimed "same
drift at infra-failure.spec.ts:204" is REFUTED -- do NOT change line 204.

(#5) In run-typecheck.ts, two edits inside the `#3 DEFENSE-IN-DEPTH` comment block (:254-264),
both comment text only -- leave the guard at :265-272 and the deref at :292-294 byte-unchanged:

- Line 260: reword "access in `finalize` below" -> "access in the `finalize` CALL ARGS below
  (within `runTypecheck`)" -- the deref `result.program.getTsProgram()` runs in the finalize
  CALL ARGS at :292-294, not inside the finalize body.
- Line 255: de-pin the external line ref "(@angular/compiler-cli perform_compile.d.ts:29)" ->
  a symbolic reference "the optional `program?` field of `PerformCompilationResult`". SCOPE:
  edit ONLY this run-typecheck.ts site that the finding names. Do NOT de-pin the
  `compiler-cli-types.ts` `perform_compile.d.ts` pins (not flagged -- avoid scope creep).

Style: ASCII-only (straight quotes, hyphens, no curly quotes / em dashes / ellipsis). These are
the only two comment edits; touch nothing else in either file.
</action>
<verify>
<automated>npx nx test angular-typechecker</automated>
Confirm the suite stays green (comment-only edits must not change behavior). Then confirm
the stale pin is gone and the rewords landed via these `git grep` checks:
`git grep -n "run-typecheck.ts:265-267" packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts`
returns NO match;
`git grep -n "finalize CALL ARGS below" packages/angular-typechecker/src/core/run-typecheck.ts`
matches;
`git grep -n "the optional .program. field of .PerformCompilationResult." packages/angular-typechecker/src/core/run-typecheck.ts`
matches; and
`git grep -n "perform_compile.d.ts:29" packages/angular-typechecker/src/core/run-typecheck.ts`
returns NO match (the compiler-cli-types.ts pins, NOT searched here, remain).
</verify>
<done>
The stale `run-typecheck.ts:265-267` pin is replaced by a symbol reference; run-typecheck.ts:260
reads "finalize CALL ARGS below (within `runTypecheck`)"; run-typecheck.ts:255 names "the optional
`program?` field of `PerformCompilationResult`". No production logic, no test assertion, and no
unflagged `compiler-cli-types.ts` pin changed. Suite green. Commit: `docs(core): de-pin stale
useCaseSensitiveFileNames line ref and sharpen program-guard comments`.
</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

No new trust boundary is introduced. This task edits unit/spec files and two source comments
only; there is no new input-handling, no new dependency install, and no production control-flow
change.

## STRIDE Threat Register

| Threat ID | Category  | Component                                            | Disposition | Mitigation Plan                                                                                                                                                                                                                                 |
| --------- | --------- | ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-jnl-01  | Tampering | spec edits silently weaken an existing guard         | mitigate    | Task 1 KEEPS the existing `errorCount===1`/`warningCount===1` asserts and only ADDS the anti-tautology guard; full `nx test` suite must stay green and the new S5c assert is verified to FAIL under the `length - errorCount` bug by reasoning. |
| T-jnl-02  | Tampering | comment edits accidentally alter production behavior | mitigate    | Task 2 is comment-text only; verified by `git grep` pin checks AND a green `nx test` run (behavior unchanged). Guard logic/message at run-typecheck.ts:265-272 and the deref at :292-294 left byte-unchanged.                                   |
| T-jnl-SC  | Tampering | npm/pip/cargo installs                               | accept      | No package installs in this task -- no executor `npm`/`npx <pkg>` add/remove/upgrade; `node_modules` is the already-installed, lockfile-pinned main-tree tree. No legitimacy gate needed.                                                       |

</threat_model>

<verification>
Phase-level checks (run on the main tree):
- `npx nx test angular-typechecker` is GREEN with all three new/upgraded tests passing.
- S5c anti-tautology restored: the added `expect(result.errorCount + result.warningCount)
  .toBeLessThan(result.diagnostics.length)` PASSES with the correct explicit-count code and
  would FAIL under the `length - errorCount` bug (3-element set: 1+1=2 < 3 PASS; bug 1+2=3 NOT
  < 3 FAIL).
- The undefined-base over-keep branch (filter-diagnostics.ts:188-190) and the program-undefined
  guard (run-typecheck.ts:265-272) each have a dedicated covering test that reaches the intended
  branch (NOT the line-100 short-circuit, NOT the 500 scan).
- No stale `run-typecheck.ts:265-267` pin remains; the two run-typecheck.ts comments read as
  specified; the `compiler-cli-types.ts` `perform_compile.d.ts` pins are untouched.
- ASCII-only, blank-lines-around-control-flow/returns, always-braces preserved; `core/**` purity
  intact (no new imports). No production behavior change.
</verification>

<success_criteria>

- All five third-round findings addressed: #1 S5c de-tautologized, #2 undefined-base branch
  covered, #3 program-undefined guard covered, #4 stale pin de-pinned, #5 two comments sharpened.
- `npx nx test angular-typechecker` passes (no regressions).
- Two clean conventional commits: `test(core): ...` (Task 1) and `docs(core): ...` (Task 2) --
  clean `core` scope, no quick-id in scope, no AI attribution, ASCII-only.
- REFUTED / out-of-scope items left untouched: infra-failure.spec.ts:204 and the
  compiler-cli-types.ts `perform_compile.d.ts` pins.
  </success_criteria>

<output>
Create `.planning/quick/260630-jnl-address-third-round-pr-review-findings/260630-jnl-SUMMARY.md`
when done.
</output>
