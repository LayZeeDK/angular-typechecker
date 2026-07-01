---
phase: quick-260630-dyd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/infra-failure.spec.ts
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
  - packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
  - .fallowrc.jsonc
  - fixtures/fault-isolation/non-template-error.component.ts
  - fixtures/fault-isolation/tsconfig.non-template.json
autonomous: true
requirements: [I-1, T1, T3, S-types, S-code, S-test, S-comments]

must_haves:
  truths:
    - 'An out-of-basePath TCB-generation Fatal (NG3004) sets templateCheckAborted even though it is suppressed from the reported diagnostics set'
    - 'A throwing realpath combined with an out-of-project path is still suppressed (suppressedCount 1, kept 0)'
    - 'The thrown TypecheckInfrastructureError carries the flattened compiler message text at both the config-stage and post-compilation scans'
    - 'The runtime drift spec enforces useCaseSensitiveFileNames as a function on the live ts.Program'
    - 'The dead EmitFlags.None mock member, the unreferenced non-template fixtures, and the rot-prone magic-number comments are gone'
    - 'The full engine vitest suite passes after every change'
  artifacts:
    - path: 'packages/angular-typechecker/src/core/run-typecheck.ts'
      provides: 'I-1 fix (detectTemplateCheckAborted on the pre-filter diagnostics arg) + reframed comment + de-pinned typescript.js anchor'
      contains: 'detectTemplateCheckAborted'
    - path: 'packages/angular-typechecker/src/core/infra-failure.spec.ts'
      provides: 'I-1 mock-harness regression test + T3 message assertions; EmitFlags.None removed; 129892 anchor de-pinned'
      contains: 'templateCheckAborted'
    - path: 'packages/angular-typechecker/src/core/filter-diagnostics.spec.ts'
      provides: 'T1: throwing-realpath + out-of-project -> suppressedCount 1'
      contains: "throw new Error('EACCES')"
    - path: 'packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts'
      provides: 'S-types: useCaseSensitiveFileNames reach-through assertion'
      contains: 'useCaseSensitiveFileNames'
  key_links:
    - from: 'packages/angular-typechecker/src/core/run-typecheck.ts (finalize)'
      to: 'detectTemplateCheckAborted'
      via: 'called on the pre-filter diagnostics arg, not the post-filter reported set'
      pattern: "detectTemplateCheckAborted\\(diagnostics\\)"
    - from: 'packages/angular-typechecker/src/core/infra-failure.spec.ts'
      to: 'runTypecheck'
      via: 'mock-harness drives performCompilation to return an out-of-basePath NG3004'
      pattern: 'templateCheckAborted'
---

<objective>
Address every actionable, locked finding from the PR #11 (milestone v0.0.3) code review:
one behavioral fix (I-1), three test-gap closures (T1, T3, S-types), and four no-risk
cleanups (S-code, S-test, S-comments). Scope is confined to the engine core source + specs,
the fault-isolation fixtures, and `.fallowrc.jsonc`. All decisions are LOCKED in CONTEXT.md
and must NOT be reopened; RESEARCH.md supplies the exact wiring.

Purpose: close the review's one genuine behavioral gap (a silent RES-02 notice on
out-of-basePath poison) and the confirmed-real coverage gaps, while removing dead/rot-prone
artifacts -- without touching unrelated code or any verdict/count behavior.

Output: surgical edits to `run-typecheck.ts` + four spec files + `.fallowrc.jsonc`, removal
of two unreferenced fixtures, and a green full engine vitest suite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md

This quick task runs on the MAIN TREE (single plan, no parallelism -> no worktree, per
AGENTS.md "Single-plan wave: skip worktrees"). The executor has real `node_modules` and
verifies by running the full engine vitest suite. All commits land on the current branch
`gsd/v0.0.3-engine-hardening` (into PR #11).
</execution_context>

<context>
@.planning/quick/260630-dyd-address-all-review-findings/260630-dyd-CONTEXT.md
@.planning/quick/260630-dyd-address-all-review-findings/260630-dyd-RESEARCH.md
@packages/angular-typechecker/src/core/run-typecheck.ts
@packages/angular-typechecker/src/core/filter-diagnostics.ts
@packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
@packages/angular-typechecker/src/core/infra-failure.spec.ts
@packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts
@packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts
@packages/angular-typechecker/src/core/run-typecheck.spec.ts

<conventions>
Per CLAUDE.md / AGENTS.md (NON-NEGOTIABLE):
- ASCII only. No emojis, em/en dashes, curly quotes, ellipsis, box-drawing. Use `--`, `->`, `'`, `"`, `...` literals.
- Blank line before AND after control-flow statements (`if`, `for`, `return`, etc.), except as the first/last line of a block.
- Always braces for control-flow bodies, even single-statement.
- The `core/**` import boundary holds: core is PURE -- no `console`, no `process`, no logging (eslint-enforced). Do not introduce any.
- Stage files by name (`git add <file>` / `git rm <file>`); NEVER `git add .`/`-A`/`-u`. Use `git rm` for deletions.
- Prefer `git grep` for tracked-file search; `rg` for node_modules/untracked.
</conventions>

<interfaces>
Contracts the executor needs (already in the read context above; do not re-explore):

From `run-typecheck.ts`:

- `finalize(ts, tsConfigPath, rootNamesCount, diagnostics, start, filter?)` -- module-private (NOT exported). The pre-filter `diagnostics` arg is `[...configDiagnostics, ...result.diagnostics]`. The current code calls `detectTemplateCheckAborted(reported)` at ~line 406; `reported` is the post-filter + deduped set. The I-1 fix moves that call to the pre-filter `diagnostics` arg.
- `detectTemplateCheckAborted(reported: readonly ts.Diagnostic[]): TemplateCheckAborted | undefined` -- exported, pure `.find` by `.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`. Order/dedup-independent. Returns `{ code, fileName }` with the shim path normalized.
- `resolveFilterBasePath(parsedBasePath, tsConfigPath)` -- falls back to `dirname(tsConfigPath)` when basePath is undefined/empty.
- `CoreResult.templateCheckAborted?: TemplateCheckAborted` (optional, present only when set).

From `infra-failure.spec.ts` (the ONLY spec that mocks `loadCompilerCli`/`performCompilation`):

- `compilerCliStub.readConfiguration` default returns `{ project: '/virtual/tsconfig.json', options: {}, rootNames: ['/virtual/error.component.ts'], errors: [], emitFlags: 0 }`. With `options: {}`, `parsed.options.basePath` is undefined -> `resolveFilterBasePath` falls back to `dirname('/virtual/tsconfig.json')` === `/virtual`.
- `fakeProgram()` returns `{ getTsProgram: () => ({ useCaseSensitiveFileNames: () => true }) }` (case-sensitive, deterministic).
- `errorDiagnostic(code, message)` builds a file-less `ts.Diagnostic`. The I-1 test needs a diagnostic WITH a `file.fileName`, so add a small file-carrying helper (or inline the literal).

From `diagnostic-codes.ts`:

- `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE === NG(3004) === -993004` (already imported in `run-typecheck.spec.ts`).

From `filter-diagnostics.spec.ts`:

- `diag(fileName, code = 2322)` helper; shared `base = { basePath: '/ws/proj', useCaseSensitiveFileNames: true, realpath: (p) => p }`. Canonical out-of-project path: `/ws/sibling-lib/src/b.ts`. Existing throwing-realpath stub: `realpath: () => { throw new Error('EACCES'); }`.
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: I-1 behavioral fix -- detect the TCB-Fatal on the PRE-filter diagnostics arg + failing-then-passing mock-harness regression test</name>
  <files>packages/angular-typechecker/src/core/run-typecheck.ts, packages/angular-typechecker/src/core/infra-failure.spec.ts</files>
  <behavior>
    New regression test (drives `runTypecheck` end-to-end through the infra-failure mock harness):
    - Stub `compilerCliStub.performCompilation` to return `{ diagnostics: [<synthesized NG3004 whose file.fileName is OUTSIDE /virtual>], program: fakeProgram() }`. Use `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` (import from `./diagnostic-codes`) as the code and a `fileName` like `/elsewhere/poison.component.ngtypecheck.ts` (NOT under `/virtual`, so the boundary filter suppresses it). Default mock `readConfiguration` (options:{}) makes the filter basePath fall back to `/virtual`.
    - Assert: `result.suppressedCount` >= 1 (the NG3004 was suppressed by the boundary filter); the NG3004 code is ABSENT from `result.diagnostics.map((d) => d.code)`; YET `result.templateCheckAborted` is defined and its `.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE`.
    - This test FAILS pre-fix (detection on `reported` -> `templateCheckAborted` undefined because the NG3004 was filtered out) and PASSES post-fix (detection on the pre-filter `diagnostics` arg). The `.fileName` will be normalized from the `.ngtypecheck.ts` shim back to `/elsewhere/poison.component.ts` -- optionally assert this too.
    Do NOT add a bare `detectTemplateCheckAborted` unit test as the gate: it finds the code in any array and cannot fail-then-pass on this change.
  </behavior>
  <action>
    In `run-typecheck.ts`, apply the I-1 fix per CONTEXT decision (Option A, LOCKED): move the
    `detectTemplateCheckAborted(...)` call in `finalize` (currently `detectTemplateCheckAborted(reported)`
    at ~line 406) so it scans the PRE-filter `diagnostics` arg instead of the post-filter `reported`
    set -- i.e. `const templateCheckAborted = detectTemplateCheckAborted(diagnostics);`. Keep the
    first-found `.find` (do NOT add an in-project-preference branch -- LOCKED Option A; the second
    poison's Fatal is empirically suppressed, so that branch would be untestable dead code). This is
    additive and safe (RESEARCH section 2): the pre-filter set is a SUPERSET of `reported`; the
    detector is a pure code-only `.find` (order/dedup-independent); counts derive only from `reported`
    so errorCount/warningCount are unchanged.

    Reframe the comment block at ~lines 400-405 in `finalize`: it currently claims the scan is on the
    REPORTED set and that an in-basePath poison "survives the filter and is found here exactly once."
    Rewrite it to state the scan is on the PRE-filter `diagnostics` arg (the raw gathered set before
    boundary-filter + dedup) so it ALSO catches an out-of-basePath poison the filter would suppress
    from `reported` -- preserving the code-only discipline note. Keep the `09-RES-02-DECISION.md`
    reference. Also update the `finalize` doc-comment (~lines 358-361) where it says it "scans the same
    reported set" -- correct it to the pre-filter set. ASCII only; blank lines around control flow.

    In `infra-failure.spec.ts`, add the failing-then-passing regression test described in the behavior block above,
    placed inside the existing `describe('runTypecheck infrastructure-failure handling (D-06)')` block
    (it already resets/restores the default `readConfiguration` in `beforeEach`). Import
    `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE` from `./diagnostic-codes`. Add a small helper (or inline a
    literal) for a `ts.Diagnostic` carrying `file: { fileName } as ts.SourceFile` since the existing
    `errorDiagnostic` is file-less. Give it `category: 1` for realism. Reuse `fakeProgram()` for the
    returned `program`. ASCII only; blank lines around control flow; always braces. Do NOT export
    `finalize`. Do NOT plan a real cross-project integration fixture (CONTEXT: best-effort only, not
    feasible cross-OS; the mock-harness unit test is the gate).

  </action>
  <verify>
    <automated>npx nx test angular-typechecker -- run-typecheck.ts infra-failure.spec.ts</automated>
    Concrete gate: `npx nx test angular-typechecker` passes, and the new I-1 test in
    `infra-failure.spec.ts` (out-of-basePath NG3004 -> `suppressedCount >= 1` AND NG3004 absent from
    `result.diagnostics` AND `templateCheckAborted` set) goes from RED (revert the one-line
    `reported` -> `diagnostics` change to confirm it fails) to GREEN with the fix in place.
  </verify>
  <done>
    `finalize` calls `detectTemplateCheckAborted(diagnostics)` (pre-filter arg); the ~400-405 and
    ~358-361 comments describe the pre-filter scan accurately; the new mock-harness regression test
    exists and passes; counts/verdict behavior is unchanged (existing infra-failure + run-typecheck
    specs still green). `finalize` remains unexported.
  </done>
</task>

<task type="auto">
  <name>Task 2: Test-gap closures -- T1 (filter realpath), T3 (infra re-throw message), S-types (drift reach-through)</name>
  <files>packages/angular-typechecker/src/core/filter-diagnostics.spec.ts, packages/angular-typechecker/src/core/infra-failure.spec.ts, packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts</files>
  <action>
    T1 (filter-diagnostics.spec.ts): add a test mirroring the existing throwing-realpath test
    (~lines 114-126) but with an OUT-of-project path, asserting it is still SUPPRESSED. Call
    `filterDiagnostics([diag('/ws/sibling-lib/src/b.ts')], { basePath: '/ws/proj',
    useCaseSensitiveFileNames: true, realpath: () => { throw new Error('EACCES'); },
    includeDeps: false })`. Assert `result.kept` has length 0 and `result.suppressedCount === 1`.
    Reuse the existing `diag` helper and the throwing-realpath stub pattern. This complements the
    existing in-project KEEP test (together they prove the realpath catch falls through to consistent
    classification on BOTH sides of the boundary). Behavior is already correct -- this is a coverage
    gap, not failing-then-passing.

    T3 (infra-failure.spec.ts): strengthen the two existing infra re-throw tests to assert the thrown
    `TypecheckInfrastructureError.message`, not just `toBeInstanceOf`. Both re-throws flatten the
    planted `messageText` via `ts.flattenDiagnosticMessageText(..., '\n')` (a no-op for a single
    string), so the asserted text equals the planted literal verbatim.
    - Post-compilation scan (the 'RE-THROWS ... performCompilation returns an UNKNOWN_ERROR_CODE'
      test, ~lines 94-109): the planted text is `'simulated internal crash'`. Add
      `.rejects.toThrow(/simulated internal crash/)` (in addition to or replacing the
      `toBeInstanceOf` -- keep both for clarity, e.g. assert instance separately or use `toThrow` with
      the class; simplest: add a second `await expect(...).rejects.toThrow(/simulated internal crash/)`).
    - Config-stage scan (the 'RE-THROWS ... config-parse UNKNOWN_ERROR_CODE (500) in parsed.errors'
      test, ~lines 179-212): the planted text is the ENOENT string. Add
      `.rejects.toThrow(/no such file or directory/)` (a stable cross-OS substring; avoid asserting
      the `/virtual/tsconfig.json` path tail). Keep the existing `performCompilation` not-called
      assertion.
    These planted strings are plain ASCII literals (no path separators / drive letters in the asserted
    substring), so the regexes are deterministic on Windows/Linux/macOS.

    S-types (compiler-cli-types.runtime.spec.ts): in test `(a)` (the "every gathered getter is present"
    test, ~lines 108-115, alongside the existing `getGlobalDiagnostics` / `getSourceFiles` reach-through
    asserts), add `expect(typeof program.getTsProgram().useCaseSensitiveFileNames).toBe('function');`.
    This is the one vendored runtime member production reads (run-typecheck.ts:265-267) that neither
    the build-time drift probe nor the runtime spec currently enforces -- the exact blind spot CONTEXT
    names. Add a one-line ASCII comment noting it covers the boundary-filter case-fold read.

    All three edits: ASCII only; blank lines around control flow; always braces. No production code
    changes in this task.

  </action>
  <verify>
    <automated>npx nx test angular-typechecker -- filter-diagnostics.spec.ts infra-failure.spec.ts compiler-cli-types.runtime.spec.ts</automated>
    Concrete gate: `npx nx test angular-typechecker` passes with the new T1 test
    (`kept` length 0, `suppressedCount` 1), the two strengthened T3 message assertions
    (`/simulated internal crash/` and `/no such file or directory/`), and the S-types
    `useCaseSensitiveFileNames` reach-through assertion all green.
  </verify>
  <done>
    filter-diagnostics.spec.ts has a throwing-realpath + out-of-project suppression test;
    infra-failure.spec.ts asserts the flattened message at both 500 scans;
    compiler-cli-types.runtime.spec.ts asserts `useCaseSensitiveFileNames` is a function on the live
    program. No production behavior changed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Cleanups (no behavioral risk) -- S-code, S-test, S-comments</name>
  <files>packages/angular-typechecker/src/core/infra-failure.spec.ts, packages/angular-typechecker/src/core/run-typecheck.ts, packages/angular-typechecker/src/core/suppress-output-path.integration.spec.ts, .fallowrc.jsonc, fixtures/fault-isolation/non-template-error.component.ts, fixtures/fault-isolation/tsconfig.non-template.json</files>
  <action>
    S-code (infra-failure.spec.ts ~line 45): remove the dead `EmitFlags: { None: 0 },` member from
    the mocked `loadCompilerCli` return object. HARD-02 removed `None` from the shim enum; production
    passes `0 as EmitFlags`, never `.None`. Delete only that one property line; leave the surrounding
    `defaultGatherDiagnostics`/`UNKNOWN_ERROR_CODE` members intact.

    S-test: remove the two unreferenced RES-01 spike-leftover fixtures (confirmed zero `.spec.ts`
    references -- only the fixtures reference each other). Use `git rm` (stage-by-name rule):
    `git rm fixtures/fault-isolation/non-template-error.component.ts fixtures/fault-isolation/tsconfig.non-template.json`.
    A non-template survivor diagnostic is already covered by `fault-isolation.integration.spec.ts`
    (the survivor's TS2322), so removal -- not wiring-in -- is correct (wiring-in would be scope creep).
    Do NOT touch the other fault-isolation fixtures (tcb-poison.*, survivor.*, tsconfig.app.json).

    S-comments: drop the three rot-prone `(typescript.js:129892)` line pins, keeping the
    `verifyCompilerOptions()` + `!options.noEmit && !options.suppressOutputPathCheck` semantic anchor at
    each site. Replace the parenthetical with a stable version-anchored phrase such as
    `(verifyCompilerOptions, TS 6.0.3)`. The three sites (exact current text in the read context):
    - run-typecheck.ts ~line 136: `// (typescript.js:129892) -- NOT in readConfiguration (Pitfall 3, RESOLVED).`
    - infra-failure.spec.ts ~line 138: `// !options.noEmit && !options.suppressOutputPathCheck (typescript.js:129892),`
    - suppress-output-path.integration.spec.ts ~line 27: `// (typescript.js:129892). The engine's emit-neutralizing override sets`
    Replace ONLY the `(typescript.js:129892)` token at each (preserve all surrounding semantic text and
    the `verifyCompilerOptions` reference). No fourth site exists in `packages/`.

    Also in `.fallowrc.jsonc`, drop the two magic-number counts, keeping the rationale:
    - Line ~7-8: change `(The 56 real Angular component/source entry points are auto-detected by ...)`
      to drop the literal "56" (e.g. "The real Angular component/source entry points are auto-detected
      by fallow's Angular plugin; do NOT re-list them here.").
    - Line ~24: change `// D-06: the 14 dev/tooling deps (ESLint flat-config plugins, ...)` to drop the
      literal "14" (e.g. "the dev/tooling deps (...)"). Keep all surrounding rationale.

    All edits ASCII only; preserve JSONC comment style; do not reorder keys. No production logic
    changes (comment + dead-member + fixture removal only).

  </action>
  <verify>
    <automated>npx nx test angular-typechecker</automated>
    Then confirm the cleanups landed (run from the repo root): `git status --short` shows both
    non-template fixtures deleted; `git grep -n "typescript.js:129892"` returns no matches in
    `packages/`; `git grep -n -e "the 56 real" -e "the 14 dev" -- .fallowrc.jsonc` returns no matches.
  </verify>
  <done>
    `EmitFlags: { None: 0 }` is gone from the mock; the two non-template fixtures are `git rm`-removed;
    no `typescript.js:129892` token remains in `packages/`; the "56"/"14" counts are dropped from
    `.fallowrc.jsonc` with rationale intact; the full engine vitest suite still passes.
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary               | Description                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| compiler-cli -> engine | Diagnostics returned by `performCompilation` cross into the engine; classified by code/path only (no message-text trust). |
| filesystem -> filter   | `realpath` may throw (EACCES / broken symlink) at the canonicalization boundary.                                          |

## STRIDE Threat Register

| Threat ID | Category          | Component                        | Disposition | Mitigation Plan                                                                                                                                                                                                            |
| --------- | ----------------- | -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-dyd-01  | Denial of Service | filter-diagnostics canonicalizer | accept      | A throwing realpath is already caught and falls back to the raw path (filter-diagnostics.ts:129-138); T1 (Task 2) adds the out-of-project regression so the catch is proven on BOTH boundary sides. No new attack surface. |
| T-dyd-02  | Tampering         | run-typecheck infra-500 re-throw | mitigate    | The re-throw classifies by CODE only (UNKNOWN_ERROR_CODE 500), never message text; T3 (Task 2) asserts the flattened message is surfaced verbatim, not parsed for control flow.                                            |
| T-dyd-SC  | Tampering         | npm installs                     | accept      | No dependency adds/removes/upgrades in this task -- only source, spec, fixture, and JSONC-config edits on the main tree. No package-manager install runs; no Package Legitimacy Gate applies.                              |

All edits preserve the `core/**` purity boundary (no `console`/`process`); the I-1 detection
field remains pure signalling rendered by the adapter, not a verdict reclassification (D-05 intact).
</threat_model>

<verification>
- `npx nx test angular-typechecker` (the full engine vitest suite) passes after all three tasks.
- I-1: the new `infra-failure.spec.ts` regression test goes RED with the `reported`-arg detection and
  GREEN with the `diagnostics`-arg fix (out-of-basePath NG3004 -> `suppressedCount >= 1`, NG3004
  absent from `result.diagnostics`, YET `templateCheckAborted` set).
- T1: throwing-realpath + `/ws/sibling-lib/src/b.ts` under `/ws/proj` -> `kept` 0, `suppressedCount` 1.
- T3: `rejects.toThrow(/simulated internal crash/)` (post-compilation) and
  `rejects.toThrow(/no such file or directory/)` (config-stage).
- S-types: `expect(typeof program.getTsProgram().useCaseSensitiveFileNames).toBe('function')` passes.
- S-code: no `EmitFlags: { None: 0 }` in the mock.
- S-test: `git status` shows both non-template fixtures deleted; no orphan references remain.
- S-comments: `git grep "typescript.js:129892"` returns nothing in `packages/`; `.fallowrc.jsonc` has
  no "56"/"14" literals but retains the rationale prose.
- Conventions: ASCII-only, blank lines around control flow, always braces, `core/**` purity preserved.
</verification>

<success_criteria>

- I-1 behavioral fix landed with a failing-then-passing mock-harness regression test; counts/verdict
  unchanged.
- T1, T3, S-types coverage gaps closed with deterministic cross-OS assertions.
- S-code, S-test, S-comments cleanups applied; no dead members, unreferenced fixtures, or rot-prone
  magic-number line pins remain in scope.
- Full engine vitest suite green on the main tree.
- T2 NOT planned (REFUTED in --analyze: includeDeps:true is already covered e2e).
- No unrelated code touched; no dependency changes; `core/**` purity intact.
  </success_criteria>

<output>
Create `.planning/quick/260630-dyd-address-all-review-findings/260630-dyd-SUMMARY.md` when done.
</output>
