---
phase: 260719-iib
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/angular-typechecker/src/core/diagnostic-record.ts
  - packages/angular-typechecker/src/core/diagnostic-record.spec.ts
  - packages/angular-typechecker/src/cli/parse-args.ts
  - packages/angular-typechecker/src/core/json-report.ts
  - libs/test-util/src/lib/e2e-process.ts
  - libs/test-util/src/lib/ng-cli-e2e.ts
autonomous: true
requirements:
  - CI-PR47-1-macos-snapshot
  - CI-PR47-2-fallow-gate

must_haves:
  truths:
    - "machine-reporters-json.integration.spec.ts advisory paths (suppressedInGraphFiles) are repo-relative forward-slash on ALL OS cells, incl. macOS -- the layout-b-host redacted snapshot matches on macos-latest."
    - "The committed Windows/Linux JSON + SARIF integration snapshots stay byte-identical (relativizePath fast path unchanged for the no-case-mismatch case)."
    - "npx fallow audit --format human --base origin/main exits 0 (new-only gate: no parseCliArgs / buildAdvisories complexity finding, no libs/test-util clone group)."
    - "All repo gates green: nx test + nx integration + nx typecheck + nx lint (angular-typechecker) and nx typecheck + nx lint (test-util) and nx format:check (repo root)."
    - "Additive-only charter (ADD-01) holds: public barrel index.ts / index.drift.ts byte-unchanged, CoreResult/CoreOptions/runTypecheck signatures unchanged, JSON/SARIF payload SHAPE unchanged, executor/builder/generator surface unchanged."
  artifacts:
    - packages/angular-typechecker/src/core/diagnostic-record.ts
    - packages/angular-typechecker/src/core/diagnostic-record.spec.ts
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/core/json-report.ts
    - libs/test-util/src/lib/e2e-process.ts
    - libs/test-util/src/lib/ng-cli-e2e.ts
  key_links:
    - "relativizePath is the ONE shared D-13 projection reached by BOTH json-report.ts and sarif-report.ts (via toDiagnosticRecord) -- the single fix corrects macOS for JSON AND SARIF at once."
    - "The relativizePath fast path (relative() result does not start with '..') MUST return byte-identical output so Windows/Linux snapshots and diagnostics[].file (real-case, never escapes) never change."
    - "fallow new-only gate vs origin/main is the CI-blocking `ci` check; parseCliArgs + buildAdvisories complexity and the libs/test-util clone group are the only three new findings that gate it."
---

<objective>
Resolve the two real v0.2.3 CI failures on PR #47 (branch gsd/v0.2.3-machine-readable-reporters) so the `ci` check goes green, WITHOUT changing any public/observable surface.

1. **Correctness (macOS-only snapshot mismatch):** make `relativizePath` robust to a case-only difference between `pathBase` and the (TS-canonicalized, lowercased) advisory-list paths, so `machine-reporters-json.integration.spec.ts` produces the SAME committed repo-relative snapshot on macOS as it already does on Windows/Linux.
2. **Quality gate (fallow new-only):** bring `parseCliArgs` and `buildAdvisories` under fallow's complexity thresholds and dedupe the one new `libs/test-util` clone group, so `npx fallow audit --format human --base origin/main` exits 0.

Purpose: PR #47 is the v0.2.3 Release-PR gate; it cannot merge until `ci` is green. Everything else in CI already passes.
Output: a byte-identical-on-Windows/Linux, macOS-fixed relativization; two behavior-preserving complexity refactors; one extracted test-harness helper; a new Windows-runnable unit test.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./AGENTS.md
@./CLAUDE.md

# The fix sites and the tests that gate them
@packages/angular-typechecker/src/core/diagnostic-record.ts
@packages/angular-typechecker/src/core/json-report.ts
@packages/angular-typechecker/src/core/sarif-report.ts
@packages/angular-typechecker/src/cli/parse-args.ts
@packages/angular-typechecker/src/core/machine-reporters-json.integration.spec.ts
@libs/test-util/src/lib/e2e-process.ts
@libs/test-util/src/lib/ng-cli-e2e.ts
@.fallowrc.jsonc

# Prior diagnosis is authoritative -- do NOT re-investigate:
# - Failure 1: relativizePath() uses node:path relative(), case-SENSITIVE on POSIX.
#   macOS is the unique failing cell: case-insensitive FS => TypeScript lowercases the
#   advisory-list file names (useCaseSensitiveFileNames=false) while pathBase (cwd)
#   keeps real case, so relative('/Users/..','/users/../file') finds no common prefix
#   and escapes with '../../../'. Linux passes (case-sensitive FS keeps real case);
#   Windows passes (path.win32.relative is case-insensitive). Only the TS-canonicalized
#   advisory lists carry lowercased paths; diagnostics[].file comes from
#   diagnostic.file.fileName (real case) and already matched on macOS.
# - Failure 2: fallow new-only gate. Verified accurate findings (run from repo ROOT
#   with node_modules present, matching ci.yml):
#     complexity  parseCliArgs   (parse-args.ts:113)   16 cyclomatic / 17 cognitive / 109 LOC
#     complexity  buildAdvisories (json-report.ts:110) 11 cyclomatic /  8 cognitive / 44 LOC / 37.1 CRAP
#     duplication clone f730a954  e2e-process.ts:117-131 <-> ng-cli-e2e.ts:89-111 (the
#                 identical execSync->RunResult try/catch block; "38 lines duplicated")
#   NOTE: the run-typecheck/walk-references clone + walkReferences complexity are ALREADY
#   suppressed in .fallowrc.jsonc -- do NOT touch those; the three above are the only new gating findings.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Make relativizePath robust to a case-only base/path mismatch (macOS fix) + Windows-runnable unit test</name>
  <files>packages/angular-typechecker/src/core/diagnostic-record.ts, packages/angular-typechecker/src/core/diagnostic-record.spec.ts</files>
  <behavior>
    - relativizePath('/repo/root/sub/file.ts', '/Repo/Root') returns 'sub/file.ts' (case-only base/path difference recovered; repo-relative, forward-slash). This is the mandated Windows-runnable regression assertion -- it FAILS on Linux with the old code (case-sensitive relative escapes) and PASSES on Windows/Linux with the fix.
    - relativizePath preserves the REAL casing of the part below the base: base '/Repo/Root', path '/repo/root/Sub/File.ts' returns 'Sub/File.ts' (never lowercase the output).
    - Byte-identical fast path (no behavior change) when relative() does not escape: matching-case base returns the plain relative path; an undefined pathBase returns the input slash-normalized only.
    - A GENUINELY-outside path keeps its escape: base '/repo/root', path '/repo/other/file.ts' returns the '../other/file.ts'-style escape unchanged (the fix must not swallow real escapes).
    - The exported case-strip helper: sibling-prefix does NOT false-match -- base '/repo/root', path '/repo/rootx/file.ts' returns undefined (the char after the base must be a separator), and exact base equality returns '' (empty remainder).
    - The macOS scenario is reproduced deterministically: helper('/users/runner/work/angular-typechecker/angular-typechecker/fixtures/layout-b-dependency/thing.ts', '/Users/runner/work/angular-typechecker/angular-typechecker') returns 'fixtures/layout-b-dependency/thing.ts' -- exactly the committed snapshot value.
  </behavior>
  <action>
    In diagnostic-record.ts, rewrite relativizePath (keep its exact signature `(absolutePath: string, pathBase: string | undefined): string`) so it: (a) when pathBase is undefined, returns absolutePath slash-normalized (unchanged); (b) computes `const relativePath = relative(pathBase, absolutePath)`; (c) FAST PATH -- if relativePath does NOT start with '..', return relativePath slash-normalized (BYTE-IDENTICAL to the current behavior, so Windows/Linux and all real-case diagnostics[].file paths are untouched); (d) otherwise call a NEW exported pure helper to recover a repo-relative path from a case-only mismatch, using its result when defined and falling back to relativePath (the real escape) when undefined; then slash-normalize the chosen value.

    Add the NEW exported helper `stripBaseCaseInsensitive(absolutePath: string, pathBase: string): string | undefined`: strip trailing path separators from pathBase; lowercase both base and absolutePath for comparison ONLY; if the folded path equals the folded base, return '' (empty remainder); if the folded path does not start with the folded base, return undefined; require the character in the ORIGINAL absolutePath at index base.length to be a path separator ('/' or '\\') -- else return undefined (a sibling like '/repo/rootx' sharing a prefix is NOT a child); return `absolutePath.slice(base.length + 1)` sliced from the ORIGINAL absolutePath so the remainder KEEPS its real casing. Never lowercase the returned value. Export it (it is consumed by relativizePath internally AND unit-tested directly; not added to the public barrel index.ts). Explain in a doc comment WHY it exists (macOS case-insensitive FS + TS canonical lowercasing of advisory-list names) and that it is OS-independent pure string logic so it is unit-testable on a Windows dev machine without a macOS runner.

    Follow the repo JS/TS style: single quotes, blank lines around control-flow/returns, braces on every control-flow body. Do NOT change fileOf/toDiagnosticRecord/positionsOf/codeStringOf/severityOf. Do NOT touch index.ts / index.drift.ts.

    Create diagnostic-record.spec.ts covering every case in the behavior block above (RED first if the test harness allows; the fix makes it GREEN). Import relativizePath + stripBaseCaseInsensitive from './diagnostic-record'. Keep it a pure unit spec (no compiler-cli, no fixtures).
  </action>
  <verify>
    <automated>npx nx test angular-typechecker &amp;&amp; npx nx integration angular-typechecker &amp;&amp; npx nx typecheck angular-typechecker</automated>
  </verify>
  <done>New diagnostic-record.spec.ts passes on Windows; the layout-b-host integration snapshot is UNCHANGED on this Windows machine (fast path); nx typecheck (tsc over spec/drift/tools) is green; index.ts + index.drift.ts are byte-unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Reduce parseCliArgs + buildAdvisories complexity below fallow thresholds (behavior-preserving)</name>
  <files>packages/angular-typechecker/src/cli/parse-args.ts, packages/angular-typechecker/src/core/json-report.ts</files>
  <behavior>
    - parse-args.spec.ts (19 existing assertions) stays 100% green -- every ParseResult (options / help / version / usageError), the --max-warnings matrix (0 valid; '', '1e3', '0x10', ' 5 ' rejected), the --format enum guard, and the version drift-lock are unchanged.
    - json-report.spec.ts stays 100% green -- buildAdvisories emits the SAME advisories object (present-if-non-empty over the five fields, every file path relativized, bundlerQueryImports verbatim) and returns undefined when empty.
    - After refactor: `npx fallow audit --format human --base origin/main` no longer reports parseCliArgs or buildAdvisories as high-complexity.
  </behavior>
  <action>
    parse-args.ts: extract cohesive PURE helpers out of parseCliArgs so its cyclomatic/cognitive drop below fallow's thresholds while its observable ParseResult is byte-identical. Recommended cuts (each returns a validated value OR a usage-error message the caller maps to a ParsedUsageError): a `--max-warnings` validator (the `/^\d+$/`-before-Number guard, with 0 staying valid) and a `--format` enum validator (the human/json/sarif membership check). Optionally move the `values -> ParsedOptions` assembly (the six `??`-default reads) into a small builder helper. Keep the single try/catch around parseArgs and the D-14 caught->usageError mapping in parseCliArgs. Do NOT change HELP_TEXT, the flag registration (allowNegative, short 'c'/'h'), the D-11/D-12 semantics, or any message text. Keep the src/cli/** nx-free boundary (import only node:util + the manifest + type-only Logger, as today).

    json-report.ts: refactor buildAdvisories from the single 5-branch conditional-spread chain into a flat assembler over small per-advisory helper functions -- one tiny helper per field (templateCheckAborted, skippedReferences, suppressedInGraphFiles, notTypeCheckedDeclaredFiles, bundlerQueryImports), each returning a `Partial<Advisories>` that is `{}` when the field is absent/empty or `{ key: value }` when present (paths relativized via relativizePath, bundlerQueryImports spread verbatim). buildAdvisories then spreads the five partials and returns `Object.keys(advisories).length > 0 ? advisories : undefined`. This distributes the branch count so no single function exceeds threshold and drops the estimated CRAP. Do NOT change the Advisories interface, the emitted key set/shape, or formatJsonReport. (ponytail: if either refactor proves awkward, the lazier fallback is a reviewed `.fallowrc.jsonc` health.ignore entry mirroring the FAL-10 walk-references precedent -- but prefer the extraction here since both functions decompose cleanly and are not irreducible domain logic.)

    Repo JS/TS style throughout: single quotes, blank lines around control flow/returns, braces on every body.
  </action>
  <verify>
    <automated>npx nx test angular-typechecker &amp;&amp; npx nx typecheck angular-typechecker &amp;&amp; npx nx lint angular-typechecker</automated>
  </verify>
  <done>parse-args.spec.ts + json-report.spec.ts green with NO assertion edits; nx typecheck + nx lint (maxWarnings:0) green; fallow no longer flags parseCliArgs or buildAdvisories (confirmed at the Task 3 final gate).</done>
</task>

<task type="auto">
  <name>Task 3: Dedupe the libs/test-util clone group (extract execToRunResult) + final fallow gate</name>
  <files>libs/test-util/src/lib/e2e-process.ts, libs/test-util/src/lib/ng-cli-e2e.ts</files>
  <action>
    In e2e-process.ts, add ONE exported helper `execToRunResult(command: string, options: { cwd: string; env: NodeJS.ProcessEnv; maxBuffer?: number }): RunResult` that runs `execSync(command, { cwd, env, encoding: 'utf8', maxBuffer })` and returns `{ stdout, code: 0 }` on success; in the catch, narrows the error to `{ stdout?: string; stderr?: string; status?: number }` and returns `{ stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`, code: execError.status ?? 1 }` -- i.e. the exact block currently duplicated in `run()` (e2e-process.ts:116-131) and the `createNgRun` returned closure (ng-cli-e2e.ts:88-112). Passing `maxBuffer: undefined` is byte-equivalent to omitting it (execSync default 1 MB), so `run()` calls `execToRunResult(command, { cwd, env })` (no maxBuffer) and preserves its current default-buffer behavior.

    Rewrite `run()` (e2e-process.ts) to build its `command` string exactly as today then `return execToRunResult(command, { cwd, env })`. Rewrite the `createNgRun` closure (ng-cli-e2e.ts) to `return execToRunResult(`${commandPrefix} ng run ${target}`, { cwd, env: runEnv, maxBuffer: 20 * 1024 * 1024 })`, keeping the IN-02 20 MB comment. Import `execToRunResult` in ng-cli-e2e.ts from './e2e-process' (it already imports `type { RunResult }` from there -- add to that import). Do NOT add execToRunResult to the barrel index.ts (internal helper; ng-cli-e2e.ts imports it directly). This is a mechanical, type-checked extraction -- behavior is byte-identical (the e2e specs that exercise these paths need Verdaccio and are not run here; correctness rests on the identical block + identical call args, gated by tsc + eslint).

    (ponytail: the lazier alternative is a `.fallowrc.jsonc` duplicates.ignore entry for the two files, mirroring FAL-11 -- but this clone is genuinely-extractable shared execSync-wrapping logic, not a deliberate mirror invariant, so extraction is the smaller correct diff. Prefer extraction.)

    Then run the fallow gate. If it still reports ANY new finding, iterate on Tasks 1-3 until it exits 0 (the gate is the source of truth).
  </action>
  <verify>
    <automated>npx nx typecheck test-util &amp;&amp; npx nx lint test-util &amp;&amp; npx fallow audit --format human --base origin/main</automated>
  </verify>
  <done>test-util typechecks + lints clean; `npx fallow audit --format human --base origin/main` exits 0 with the clone group f730a954 gone and no parseCliArgs/buildAdvisories complexity finding.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| type-check diagnostics -> machine payload | Absolute local file paths from the compiler cross into the JSON/SARIF payload that CI systems and coding agents consume. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-IIB-01 | Information Disclosure | relativizePath (diagnostic-record.ts) | low | mitigate | The macOS fix keeps advisory-list paths repo-relative (never an absolute `../../../users/runner/...` escape that reveals the runner home/dir layout), reinforcing the existing T-30-04 no-absolute-path-leak property on the one OS where it currently leaks. The fast path preserves the already-safe Windows/Linux output. |
| T-IIB-SC | Tampering | npm/pip/cargo installs | low | accept | No package installs in this task -- zero new dependencies; the fix is pure source. No supply-chain surface introduced. |
</threat_model>

<verification>
Run from `packages/angular-typechecker/` (nx targets are project-scoped; runnable from anywhere with the project arg) unless noted. All must pass; the fallow gate must exit 0.

- `npx nx test angular-typechecker` -- unit tier: new diagnostic-record.spec.ts + parse-args.spec.ts + json-report.spec.ts green.
- `npx nx integration angular-typechecker` -- machine-reporters-json integration snapshot BYTE-UNCHANGED on Windows/Linux (proves no regression on the fast path).
- `npx nx typecheck angular-typechecker` -- the REAL spec type gate (tsc over tsconfig.spec.json/drift/tools; `nx test`'s esbuild does NOT type-check specs).
- `npx nx typecheck test-util` + `npx nx lint test-util` -- the libs/test-util extraction compiles + lints clean.
- `npx nx lint angular-typechecker` -- eslint at maxWarnings:0 (incl. @nx/dependency-checks).
- `npx nx format:check` (from the REPO ROOT) -- Prettier clean.
- `npx fallow audit --format human --base origin/main` -- new-only gate, MUST exit 0 (the CI-blocking `ci` check). Run from repo root or packages/angular-typechecker with node_modules present.

macOS note: the actual macOS snapshot fix cannot be observed on this Windows dev machine; the Windows-runnable diagnostic-record.spec.ts unit test (which fails on Linux CI with the old code) is the local proof, and the Linux + macOS CI cells confirm the end-to-end fix on PR #47.
</verification>

<success_criteria>
- PR #47's two red checks are addressed: the macOS `test (macos-latest, 24)` snapshot matches, and the `fallow` job (and thus `ci`) is green.
- Committed Windows/Linux JSON + SARIF integration snapshots are byte-identical (no snapshot regeneration).
- Additive-only charter (ADD-01) holds: index.ts / index.drift.ts byte-unchanged, no public signature/shape change, no new dependency.
- Every gate in <verification> passes, `npx fallow audit --format human --base origin/main` exits 0.
</success_criteria>

<output>
Create `.planning/quick/260719-iib-resolve-v0-2-3-ci-failures/260719-iib-SUMMARY.md` when done.
</output>
