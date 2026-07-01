# Quick Task 260630-dyd: Address all review findings - Research

**Researched:** 2026-06-30
**Domain:** Implementation mechanics for PR #11 review-finding fixes (angular-typechecker core + specs + fixtures)
**Confidence:** HIGH (all answers backed by current source at named file:line; read-only verification)

This is a mechanical/implementation research pass. The conceptual analysis (5-agent review + `--analyze`) is already done and locked in CONTEXT.md; this only settles the precise wiring so the planner can write exact tasks. No domain survey.

## User Constraints (from CONTEXT.md)

Aligned with the locked decisions verbatim; this research does not reopen any of them:
- I-1: detect NG3004 on the PRE-filter `diagnostics` arg in `finalize`, keep `.find` first-found, fix the ~400-405 comment, primary regression = a `finalize`-level unit test with a SYNTHESIZED out-of-basePath NG3004 (real cross-project fixture is best-effort only).
- T1: throwing-realpath + out-of-project path -> `suppressedCount === 1`.
- T3: assert flattened message text at BOTH 500 scans (config-stage + post-compilation).
- S-types / S-code / S-test / S-comments cleanups as scoped.

---

## 1. I-1 regression test feasibility

### How `basePath` is derived for the filter
`runTypecheck` (run-typecheck.ts:260-263) computes the filter base as
`resolveFilterBasePath(parsed.options.basePath, options.tsConfigPath)`. `parsed.options.basePath` is the
absolute directory `ng.readConfiguration` injects (the leaf tsconfig's own directory); the defensive
fallback (resolveFilterBasePath, run-typecheck.ts:284-293) is `dirname(tsConfigPath)`. For the existing
poison fixture that base is `<workspaceRoot>/fixtures/fault-isolation/` (the dir holding
`tsconfig.app.json`, per fault-isolation.integration.spec.ts:64-69).

The poison Fatal attaches to `tcb-poison.component.ngtypecheck.ts` (shim), normalized to
`tcb-poison.component.ts` (run-typecheck.ts:450-477). That source sits in the SAME directory as the
tsconfig, so it is IN-basePath today -- which is exactly why the current integration spec at
fault-isolation.integration.spec.ts:158-173 already sees `templateCheckAborted` set even on the
post-filter `reported` set. The silent-loss bug only bites when the poison component's own
`.ngtypecheck.ts` shim falls OUTSIDE the leaf tsconfig's basePath while still being type-checked.

### Real integration fixture: NOT reliably feasible -> use the unit-test gate (CONFIRM the CONTEXT.md fallback)
To make the poison component's OWN shim land out-of-basePath, the poison `.ts` would have to live in a
DIRECTORY ABOVE (or sibling to) the leaf tsconfig's directory while still being a `files` entry the
compiler type-checks. The Angular compiler emits the `.ngtypecheck.ts` shim alongside its source file,
so "out-of-basePath shim" requires "out-of-basePath source." `readConfiguration` injects
`options.basePath = dirname(<leaf tsconfig>)`, and a `files` array can point at `../sibling/foo.ts`, so
in principle a multi-dir fixture (tsconfig in `fixtures/x/leaf/tsconfig.app.json` listing
`../poison/tcb-poison.component.ts`) WOULD put the poison source/shim under
`fixtures/x/poison/` which is NOT under `fixtures/x/leaf/`. That is the conceptual repro.

It is NOT a reliable cross-OS gate, for two reasons grounded in this codebase:
1. The basePath classification runs realpath-FIRST then case-fold (filter-diagnostics.ts:115-149). On
   the case-insensitive Windows dev box / macOS CI leg vs case-sensitive Linux leg the containment is
   stable, but the *shim emit location* and whether the compiler keeps the out-of-dir file in
   `rootNames` is a compiler-internal behavior not pinned by any current test -- the CONTEXT.md verdict
   already rates the live cross-project repro "PLAUSIBLE-UNVERIFIED."
2. The second-poison Fatal is empirically suppressed by the compiler (09-02-SUMMARY.md; CONTEXT.md), so
   a fixture cannot reliably produce more than one NG3004, limiting what a real fixture can assert.

**Recommendation: gate on the `finalize`-level unit test (locked Option A). Best-effort real fixture optional (Claude's discretion).**

### Exact mechanics for the I-1 unit test
- `finalize` is NOT exported (run-typecheck.ts:363, module-private `function finalize`). Do NOT export
  it for the test. Invoke the fix path one of two ways:
  - **Preferred (matches existing pattern): test `detectTemplateCheckAborted` directly** -- it IS
    exported (run-typecheck.ts:433) and is the function whose ARG changes from `reported` to the
    pre-filter `diagnostics` set. run-typecheck.spec.ts:57-164 already unit-tests it on synthesized
    `ts.Diagnostic[]` with the `diagnostic(code, fileName?)` helper (run-typecheck.spec.ts:63-73). The
    "failing-then-passing against the fix" property, however, lives in `finalize`'s WIRING (which array
    it passes), not in `detectTemplateCheckAborted` itself -- the detector already finds the code in any
    array. So a pure `detectTemplateCheckAborted` test cannot fail-then-pass on the I-1 change.
  - **To get the genuine failing-then-passing differentiator, drive `runTypecheck` end-to-end with the
    infra-failure.spec.ts mock harness** (the only spec that mocks `loadCompilerCli` /
    `performCompilation`, infra-failure.spec.ts:24-50). Stub `performCompilation` to return a `program`
    (fakeProgram(), infra-failure.spec.ts:67-73) plus a diagnostics array containing an NG3004 whose
    `file.fileName` is OUTSIDE the basePath the mock's `readConfiguration` implies. Pre-fix (detection on
    `reported`) the boundary filter SUPPRESSES that out-of-basePath NG3004, so `templateCheckAborted` is
    `undefined` while `suppressedCount >= 1`; post-fix (detection on the pre-filter `diagnostics` arg)
    `templateCheckAborted` is SET even though the diagnostic is still absent from `result.diagnostics`.
    That is the exact assert pair CONTEXT.md specifies (`suppressedCount > 0`, NG3004 absent from
    `result.diagnostics`, YET `templateCheckAborted` fires).

- **Synthesizing the `ts.Diagnostic`:** reuse the existing `diagnostic`/`errorDiagnostic` literal shape.
  - code = `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` (imported from `./diagnostic-codes`,
    run-typecheck.spec.ts:9; value `NG(3004) === -993004`, diagnostic-codes.ts:88-90).
  - `file = { fileName } as ts.SourceFile` with an OUT-of-basePath path. To make it out-of-basePath in
    the mock harness, the mock `readConfiguration` returns `options: {}` (infra-failure.spec.ts:85-91),
    so `parsed.options.basePath` is `undefined` -> `resolveFilterBasePath` falls back to
    `dirname('/virtual/tsconfig.json')` = `/virtual`. Give the synthesized NG3004 a `fileName` like
    `/elsewhere/poison.component.ngtypecheck.ts` (NOT under `/virtual`) so the boundary filter suppresses
    it. Note `fakeProgram().getTsProgram().useCaseSensitiveFileNames() === true`
    (infra-failure.spec.ts:67-73), giving a case-sensitive, deterministic comparison.
  - category Error (`1 as ts.DiagnosticCategory`) for realism; the detector reads only `.code` and
    `.file?.fileName`.

---

## 2. Pre-filter detection safety

Moving `detectTemplateCheckAborted` from `reported` to the pre-filter `diagnostics` arg is safe:
- The pre-filter `diagnostics` arg is `[...configDiagnostics, ...result.diagnostics]` (run-typecheck.ts:257),
  i.e. the raw gathered set BEFORE `filterDiagnostics` (run-typecheck.ts:374-384) and BEFORE
  `ts.sortAndDeduplicateDiagnostics` (run-typecheck.ts:391).
- `detectTemplateCheckAborted` is a `.find` by `.code` (run-typecheck.ts:436-438) -- order-independent and
  dedup-independent. `sortAndDeduplicateDiagnostics` affects ORDER and removes exact duplicates; neither
  matters for find-first-by-code. The NG3004 is present in the pre-filter array with the SAME `.code` and
  same `file.fileName` it has post-gather (filtering/sorting never MUTATE a diagnostic, only include/exclude/
  reorder). The pre-filter set is a SUPERSET of `reported` (filter only removes, dedup only collapses
  exact dups), so any NG3004 found post-filter is also found pre-filter -- the change is purely additive
  (more cases fire; none stop), matching the CoreResult doc and CONTEXT.md.
- Counts are unaffected: `errorCount`/`warningCount` derive from `reported` (run-typecheck.ts:393-398),
  not from the detector. The detector only sets the optional `templateCheckAborted` field.

The ~400-405 comment must be reframed: it currently claims the kept/deduped `reported` set is scanned and
that an in-basePath poison "survives the filter and is found here exactly once." After the change, the
scan is on the pre-filter set, so it ALSO catches an out-of-basePath poison that the filter would have
suppressed from `reported`.

---

## 3. T1 mechanics (filter-diagnostics: throwing realpath + out-of-project -> suppressedCount === 1)

Add to filter-diagnostics.spec.ts, mirroring the existing throwing-realpath test (filter-diagnostics.spec.ts:114-126)
and the out-of-project rows (filter-diagnostics.spec.ts:32-51, where `/ws/sibling-lib/...` is the out-of-project case under `basePath: '/ws/proj'`).

- **"Out of project" given the fixture base:** with `basePath: '/ws/proj'` (the shared `base` literal,
  filter-diagnostics.spec.ts:26-30), any path NOT under `/ws/proj/` is out-of-project, e.g.
  `/ws/sibling-lib/src/b.ts` (already used as the canonical out-of-project case). The throwing-realpath
  fallback returns the UNRESOLVED raw path (filter-diagnostics.ts:129-138), which is then normalized +
  case-folded -- so an out-of-project raw path classifies out-of-project and is SUPPRESSED.
- **How realpath throws:** identical stub to the existing RES-03 test --
  `realpath: () => { throw new Error('EACCES'); }` (filter-diagnostics.spec.ts:117-120).
- **The new assert (failing-then-passing is N/A; this is a coverage gap, behavior already correct):**
  ```ts
  it('RES-03: a throwing realpath is caught; an OUT-of-project diagnostic is still SUPPRESSED', () => {
    const result = filterDiagnostics([diag('/ws/sibling-lib/src/b.ts')], {
      basePath: '/ws/proj',
      useCaseSensitiveFileNames: true,
      realpath: () => { throw new Error('EACCES'); },
      includeDeps: false,
    });

    expect(result.kept).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });
  ```
  This complements the existing throwing-realpath test (which covers the in-project KEEP path); together
  they prove the catch falls through to consistent classification on BOTH sides of the boundary.

---

## 4. T3 mechanics (infra re-throw message, deterministic cross-OS text)

Both re-throws flatten the planted `messageText` via `ts.flattenDiagnosticMessageText(..., '\n')`:
- config-stage scan: run-typecheck.ts:164-171 (message from `configInfrastructureFailure.messageText`).
- post-compilation scan: run-typecheck.ts:241-245 (message from `infrastructureFailure.messageText`).

The existing harness plants the message text:
- post-compilation case: `errorDiagnostic(UNKNOWN_ERROR_CODE, 'simulated internal crash')`
  (infra-failure.spec.ts:95-98). The current assertion only checks `rejects.toBeInstanceOf(...)`
  (infra-failure.spec.ts:106-109); T3 adds a message assertion.
- config-stage case: the planted `messageText` is
  `"Error: ENOENT: no such file or directory, lstat '/virtual/tsconfig.json'"`
  (infra-failure.spec.ts:182-199). The current assertion is `rejects.toBeInstanceOf(...)`
  (infra-failure.spec.ts:205-207); T3 adds a message assertion.

These planted strings are PLAIN ASCII test literals (no OS-specific path separators in the asserted
substring), so they are deterministic on Windows/Linux/macOS. Recommended stable assertions:
- post-compilation: `rejects.toThrow(/simulated internal crash/)`
- config-stage: `rejects.toThrow(/no such file or directory/)` (a stable substring of the planted ENOENT
  text; avoid asserting the `/virtual/tsconfig.json` path tail -- the message itself is a test literal so
  it is fine, but the shorter substring is maximally robust to any future harness rewording).

Both literals contain no backslashes, drive letters, or locale-dependent text, so the regexes are stable
cross-OS. (The flatten step with `'\n'` is a no-op for a single-string `messageText`, so the asserted
text equals the planted text verbatim.)

---

## 5. S-comments anchor (the `typescript.js:129892` sites)

The CONTEXT.md cites three SOURCE sites to re-anchor (replace the `:129892` line pin with a stable
phrase such as "in `verifyCompilerOptions` (TS 6.0.3)"; keep the semantic reference). All three quote
the SAME source string alongside the line number. The exact current text at each site is:

1. **run-typecheck.ts:134-136** (production comment):
   > `// check fires in TypeScript's verifyCompilerOptions() at the END of`
   > `// createProgram, gated by !options.noEmit && !options.suppressOutputPathCheck`
   > `// (typescript.js:129892) -- NOT in readConfiguration (Pitfall 3, RESOLVED).`

2. **infra-failure.spec.ts:137-138** (spec comment):
   > `// check fires in TypeScript's verifyCompilerOptions() gated by`
   > `// !options.noEmit && !options.suppressOutputPathCheck (typescript.js:129892),`

3. **suppress-output-path.integration.spec.ts:25-27** (spec comment):
   > `// check is in TypeScript's verifyCompilerOptions() at the END of`
   > `// createProgram, gated by !options.noEmit && !options.suppressOutputPathCheck`
   > `// (typescript.js:129892). The engine's emit-neutralizing override sets`

All three already name `verifyCompilerOptions()` and the `!options.noEmit && !options.suppressOutputPathCheck`
gate, so the planner only drops the `(typescript.js:129892)` parenthetical and substitutes a version-anchored
phrase (e.g. `(verifyCompilerOptions, TS 6.0.3)`) -- the semantic reference (`verifyCompilerOptions` + the
gate predicate) is already present and must be preserved.

Note: there are two ADDITIONAL `129892` mentions inside infra-failure.spec.ts and suppress-output-path
that are part of the SAME comment blocks at sites 2 and 3 (single occurrence each in source); the grep
shows line 138 and line 27 as the pinned-number lines. No fourth site exists in `packages/`.

---

## Supplementary mechanical confirmations (for the other locked cleanups)

- **S-types target:** add `expect(typeof program.getTsProgram().useCaseSensitiveFileNames).toBe('function')`
  to compiler-cli-types.runtime.spec.ts inside test `(a)` (alongside the existing
  `getGlobalDiagnostics` / `getSourceFiles` reach-through asserts at
  compiler-cli-types.runtime.spec.ts:108-115). `useCaseSensitiveFileNames` is read by production at
  run-typecheck.ts:265-267 but is in neither `GATHERED_GETTERS` (compiler-cli-types.runtime.spec.ts:50-58,
  not a `get*Diagnostics` getter) nor the build-time drift probe -- the exact blind spot CONTEXT.md names.
- **S-code target:** remove `EmitFlags: { None: 0 }` at infra-failure.spec.ts:45 (the mocked
  `loadCompilerCli` return). Production passes `0 as EmitFlags` (run-typecheck.ts:229), never `.None`.
- **S-test removal:** delete `fixtures/fault-isolation/non-template-error.component.ts` and
  `fixtures/fault-isolation/tsconfig.non-template.json` (confirmed zero `.spec.ts` references: the only
  specs touching `fault-isolation` are fault-isolation.integration.spec.ts and executor.spec.ts, neither
  references the non-template fixture). Use `git rm` per the repo's stage-by-name rule.

## Sources

### Primary (HIGH confidence) -- current repo source, read 2026-06-30
- run-typecheck.ts (finalize 363-418; detectTemplateCheckAborted 433-448; normalizeShimFileName 450-477;
  two 500 scans 160-171 + 237-245; filter wiring 253-271; resolveFilterBasePath 284-293).
- filter-diagnostics.ts (boundary filter 64-106; realpath try/catch 129-138; FilterOptions 39-51).
- filter-diagnostics.spec.ts (diag helper 14-23; base literal 26-30; out-of-project rows 32-51;
  throwing-realpath test 114-126).
- run-typecheck.spec.ts (detectTemplateCheckAborted unit tier 48-164; diagnostic helper 63-73).
- infra-failure.spec.ts (mock harness 24-50; fakeProgram 67-73; planted messages 95-98 + 182-199;
  EmitFlags.None 45; current toBeInstanceOf asserts 106-109 + 205-207).
- fault-isolation.integration.spec.ts (basePath derivation 62-69; templateCheckAborted assert 158-173).
- compiler-cli-types.runtime.spec.ts (GATHERED_GETTERS 50-58; reach-through asserts 108-115).
- suppress-output-path.integration.spec.ts (129892 site 25-27).
- diagnostic-codes.ts (TCB_GENERATION_FATAL_DIAGNOSTIC_CODE 88-90; NG 39).
- fixtures/fault-isolation/{tcb-poison.component.ts, tcb-poison.component.html, survivor.component.ts,
  tsconfig.app.json, non-template-error.component.ts, tsconfig.non-template.json}.

## RESEARCH COMPLETE

File: `D:\projects\github\LayZeeDK\angular-typechecker\.planning\quick\260630-dyd-address-all-review-findings\260630-dyd-RESEARCH.md`
