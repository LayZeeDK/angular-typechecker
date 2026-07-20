# Pitfalls Research

**Domain:** Machine-readable reporters (JSON + SARIF 2.1.0) for a diagnostic/type-check tool -- additive to an existing multi-adapter Nx/Angular-CLI/standalone-CLI plugin (`angular-typechecker` v0.2.2 -> v0.2.3)
**Researched:** 2026-07-18
**Confidence:** HIGH (codebase read directly; SARIF/GitHub requirements from official GitHub Docs; `node-sarif-builder` shape from its repo `package.json` + npm)

> Scope note: these are pitfalls SPECIFIC to adding `--format json` + `--format sarif` and wiring them through the three existing adapters over one `runTypecheck` core. Generic project-setup mistakes are out of scope. The existing design already solves several of these (stdout/stderr split, ANSI strip, realpath-normalized paths, additive-only tripwire) -- the pitfalls below are mostly about NOT regressing those invariants while adding a second output shape.

---

## Critical Pitfalls

### Pitfall 1: Non-payload output leaks onto stdout and corrupts the JSON/SARIF

**What goes wrong:**
A consumer runs `atc -c tsconfig.json --format json | jq .` (or CI does `--format sarif > results.sarif`) and the parse fails, because an advisory notice, a warning banner, Nx chrome, or a stray `console.log` landed on stdout ahead of / interleaved with the machine payload. stdout must contain the payload and NOTHING else.

**Why it happens:**
The five advisory notices (`templateCheckAborted`, `skippedReferences`, split suppressed counts, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) are emitted by `emitAdvisoryNotices(result, logger)` -- and in the human path that is exactly right. The trap is routing any of them, or the human report, to stdout when `--format json|sarif` is active. A second trap: the JSON/SARIF reporter itself calling `logger.info(payload)` (which in the Nx path prepends chrome/color) instead of the raw `process.stdout.write(payload)` seam.

**How to avoid:**
The design ALREADY separates streams -- preserve it. The report/payload goes to raw stdout (`process.stdout.write` in the executor; the `stdout` field of `RunResult` in the CLI); every notice and error goes to the injected `Logger` (Nx `logger.warn`/`.info` -> stderr; CLI `BufferingLogger` -> the `stderr` field written by `bin.ts`). Rules for v0.2.3:
- The JSON/SARIF reporter is a PURE `(CoreResult) => string`. It NEVER touches `logger`, `console`, or `process`. It returns the payload string; the adapter writes it to the SAME stdout seam the human `report` uses today.
- `emitAdvisoryNotices` keeps going to the logger (stderr) regardless of `--format`. Do NOT skip it for machine formats -- the notices carry coverage-incompleteness signals a CI log still wants -- but they must never reach stdout.
- `--quiet` suppresses the NOTICES (the stderr advisory stream), NOT the payload. The stdout payload is always emitted; `--quiet` only silences `emitAdvisoryNotices` (and the node_modules INFO line). Wire `--quiet` by gating the `emitAdvisoryNotices` call, not by touching the reporter.

**Warning signs:**
`jq`/`JSON.parse` fails on real output; `actions/upload-sarif` rejects the file as invalid JSON; a snapshot test of the payload contains a line starting with `angular-typechecker:`; piping through `| head` changes the parseability.

**Phase to address:**
Adapter-wiring phase (the `--format` flag threaded through executor + builder + CLI). Verified in the JSON reporter phase (REP-01) and hardened in the e2e phase.

---

### Pitfall 2: ANSI color codes embedded in JSON/SARIF

**What goes wrong:**
The JSON `message` field (or a SARIF `result.message.text`) contains raw SGR escape sequences (`[91m...[0m`), because the reporter reused the human codeframe renderer. Downstream tools show mojibake; SARIF viewers render literal escape bytes; agents get unparseable message text.

**Why it happens:**
`@angular/compiler-cli`'s `formatDiagnostics` ALWAYS colorizes (it calls `formatDiagnosticsWithColorAndContext` unconditionally -- see `format-report.ts`), and the human path strips ANSI as a separate post-step keyed on `color`. If the machine reporter builds its message by calling `formatReport`/`renderReport` (to "reuse" the nice codeframe), it inherits color that depends on TTY/`FORCE_COLOR`. Even with `color:false` the human renderer is the wrong source for structured data.

**How to avoid:**
Machine reporters do NOT call `formatDiagnostics`/`formatReport`/`renderReport` at all. Build the message from the raw diagnostic: `ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')` (this never adds color). Take `code`, `category`, file/position directly off `ts.Diagnostic`. Color is structurally impossible if you never touch the colorizing renderer. Do NOT make the machine payload honor `--color`/`FORCE_COLOR` -- color is a human-only concern; the machine formats are unconditionally plain.

**Warning signs:**
`` / `\x1b` / `[3\dm` substrings in a payload snapshot; a snapshot that differs between a TTY run and a piped run; `FORCE_COLOR=1 atc --format json` differs from the plain run.

**Phase to address:**
JSON reporter phase (REP-01) -- establish the "message via `flattenDiagnosticMessageText`, never the human renderer" rule; SARIF phase (REP-02) inherits it. Add a spec asserting no `` byte in either payload.

---

### Pitfall 3: ts 0-based positions emitted as SARIF/JSON 1-based (off-by-one)

**What goes wrong:**
Every SARIF `region.startLine`/`startColumn` (and the JSON line/column) is off by one, so GitHub Code Scanning annotates the wrong line, and agents jump to the line above the real error. The classic reporter bug.

**Why it happens:**
`ts.Diagnostic.start` is a 0-based character OFFSET into the file. `ts.getLineAndCharacterOfPosition(sourceFile, start)` returns a `{ line, character }` that are BOTH 0-based. SARIF 2.1.0 regions are 1-based for BOTH `startLine` and `startColumn` (and `endLine`/`endColumn`). Forgetting the `+1` on either axis -- or adding it to one axis but not the other -- is the dominant correctness defect in SARIF emitters.

**How to avoid:**
Convert once, in one helper: `startLine = line + 1`, `startColumn = character + 1`. For the end of the range, compute `getLineAndCharacterOfPosition(sourceFile, start + length)` and again `+1` both axes -> `endLine`/`endColumn`. `length` is `ts.Diagnostic.length` (may be 0). Pin the mapping with a fixture whose error is at a KNOWN line/column (e.g. a diagnostic you can eyeball in the source) and assert the exact SARIF numbers -- an off-by-one is invisible to a round-trip snapshot but obvious against a hand-verified position.

**Warning signs:**
Annotations land one line/column off in a real `upload-sarif` run; the first line of a file can never be annotated (0 is invalid in SARIF -> viewer drops or clamps); `startColumn: 0` appears anywhere in the payload.

**Phase to address:**
SARIF reporter phase (REP-02); the JSON reporter phase (REP-01) if JSON also carries line/column (it does per REP-01: file, line/column, code, category, message). Do the conversion in ONE shared position helper used by both reporters so they cannot drift.

---

### Pitfall 4: `artifactLocation.uri` is absolute and/or Windows-backslash -> Code Scanning can't match files

**What goes wrong:**
The SARIF ships `"uri": "D:\\projects\\...\\app.component.ts"` (absolute, backslashes). GitHub Code Scanning cannot map the result to a repo file, so either the alert does not display (validation GH1001-class), or it creates a fresh alert every run because the path is not stable/relative -> duplicate, churning alerts.

**Why it happens:**
`ts.Diagnostic.file.fileName` is an ABSOLUTE, realpath-normalized path (the core deliberately normalizes for the boundary filter). On the Windows dev host, `path.relative(base, fileName)` returns BACKSLASH separators. SARIF/GitHub require forward-slash, repo-root-relative URIs. Two independent bugs (absolute vs relative; `\` vs `/`) both break matching.

**How to avoid:**
- Relativize against the workspace/repo root. Reuse the existing `pathBase` seam (`FormatOptions.pathBase` = executor `context.root` / CLI `process.cwd()`), the SAME base the human formatter uses for CI-annotation paths. `uri = path.relative(pathBase, fileName)`.
- Force forward slashes: `.replace(/\\/g, '/')` on the result. This is the exact idiom already used in `main.ts`'s `toAbsoluteTsConfigPath`.
- Normalize case + symlinks on BOTH sides before `path.relative`. `pathBase` and `fileName` must be realpath-normalized to the same drive-letter case, or `path.relative` yields `../../D:/...` garbage on Windows (see Pitfall 8). The core already realpath-normalizes `fileName`; make sure `pathBase` is normalized the same way.
- Do NOT emit `file://` URLs or a `uriBaseId` scheme unless you also populate `originalUriBaseIds`. The simplest GitHub-accepted form is a plain repo-root-relative POSIX path with no `uriBaseId`; `upload-sarif` resolves it against the checkout. (If you later add `uriBaseId`, you MUST define it in `run.originalUriBaseIds` or matching breaks.)
- angular-typechecker owns URI construction and feeds finished relative-POSIX URIs to `node-sarif-builder` -- do NOT let the builder guess or re-absolutize them (the milestone charter already states this).

**Warning signs:**
Any `\` in a payload URI; any URI starting with a drive letter (`C:`/`D:`) or `/` (POSIX absolute) or `file:`; `upload-sarif` succeeds but alerts show "path not found" / no source snippet; alert count doubles on the second CI run with no code change.

**Phase to address:**
SARIF reporter phase (REP-02). Add a spec asserting every emitted URI is relative (no drive letter, no leading `/`, no `file:`) and contains no `\`. Verify end-to-end in the e2e phase against a real `upload-sarif` or the SARIF schema + a path-shape assertion.

---

### Pitfall 5: Unstable `results[]` ordering -> Code Scanning dedup churn / snapshot flake

**What goes wrong:**
Two runs over identical code produce SARIF (or JSON) with results in a different order. Effect A: CI snapshot tests flake across OS/Node. Effect B: alert matching/dedup is less stable, and diffing two SARIF files is noise.

**Why it happens:**
Diagnostics can arrive in gather/union order that is not fully deterministic across platforms (multi-leaf walk union, filesystem enumeration order, case-fold differences). The core already runs `ts.sortAndDeduplicateDiagnostics` in `finalize`, which gives a deterministic order -- but that guarantee lives in the CORE, and a reporter that re-groups (e.g. bucket-by-file, or by rule) can reintroduce nondeterminism if the grouping key order is not itself sorted.

**How to avoid:**
- Rely on `CoreResult.diagnostics` already being sorted+deduped (D-09) and emit results in that exact order -- do not re-sort into a Map/Set whose iteration order is insertion-dependent on nondeterministic input.
- If you group (e.g. `rules[]` dedup, or per-file artifacts), sort the group keys explicitly (by ruleId, by URI) so the emitted arrays are deterministic.
- For GitHub matching robustness, consider populating `partialFingerprints.primaryLocationLineHash` per result. NOTE: for the `upload-sarif` action specifically, GitHub ATTEMPTS to auto-populate `partialFingerprints` from the source files when absent, so it is not strictly required for this milestone's target -- but computing it yourself removes the dependency on that best-effort step and is mandatory if anyone uploads via the `/code-scanning/sarifs` API (which does NOT auto-populate). Treat `partialFingerprints` as recommended, deterministic ordering as required.

**Warning signs:**
A payload snapshot passes on Linux but fails on the Windows/macOS CI cells; `git diff` of two SARIF files from unchanged code is non-empty; duplicate alerts appear after a rerun.

**Phase to address:**
JSON reporter phase (REP-01) for ordering discipline; SARIF phase (REP-02) for `partialFingerprints`. Determinism is verified in the CI/verification phase (snapshot must be byte-stable across the 6-cell OS x Node matrix -- see Pitfall 11).

---

### Pitfall 6: SARIF `ruleId` uses the raw negative NG code instead of the human `NG8xxx`/`TSxxxx` form

**What goes wrong:**
The SARIF `ruleId` (and `rules[].id`) reads `-998101` for an Angular extended diagnostic (or `-993004` for the TCB fatal), instead of `NG8101`. GitHub groups alerts BY `ruleId`; a negative synthetic number is meaningless to users, breaks rule metadata linkage, and (because `ruleId` must be stable across runs to match) risks churn if the encoding ever changes.

**Why it happens:**
Angular encodes NG codes negatively on `ts.Diagnostic.code`: `ngErrorCode(code) = parseInt('-99' + code)`, so `NG8101` shows up as `-998101` (see `diagnostic-codes.ts`). TypeScript codes are raw positive (`2322`). A naive reporter emits `String(diagnostic.code)` and ships `-998101`.

**How to avoid:**
Map `ts.Diagnostic.code` to a human rule id in one helper:
- `code < 0` (Angular): `ruleId = 'NG' + ngCodeOf(code)` (reuse the existing `ngCodeOf(-998101) === 8101` inverse). Result: `NG8101`.
- `code >= 90000` (synthesized 90001/90002): use a stable `ATC90001`-style id (these are angular-typechecker's own codes; give them a documented prefix so they never collide with TS/NG).
- else (TypeScript): `ruleId = 'TS' + code` -> `TS2322`.
`ngCodeOf`/`NG` already exist and are dependency-free -- reuse them, do not re-derive the encoding.

**Warning signs:**
A negative number or a bare integer as a `ruleId`; `-99` substring in any ruleId; alerts grouped under unreadable rule names in the Code Scanning UI.

**Phase to address:**
SARIF reporter phase (REP-02); also JSON if JSON exposes a human code string (recommended: JSON should carry both the raw `code` and a human `ruleId`/`codeString`). Pin every code family (TS positive, NG negative, synthesized 90xxx) in a data-driven spec.

---

### Pitfall 7: `rules[]` driver metadata missing or `ruleId`/`ruleIndex` linkage broken

**What goes wrong:**
Results reference rules that are not present in `tool.driver.rules[]`, or `ruleIndex` points at the wrong array slot, so viewers show "unknown rule" or mis-attribute severity/help. Some validators reject a `ruleIndex` that does not resolve.

**Why it happens:**
SARIF lets a result carry `ruleId` alone, but if you ALSO emit `ruleIndex` it must be a valid index into `driver.rules[]` for the SAME run. It is easy to build `rules[]` in one order and set `ruleIndex` from a different map, or to add `ruleIndex` without adding the rule object.

**How to avoid:**
Let `node-sarif-builder` own the linkage: add each distinct rule once via `SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText, helpUri })` + `runBuilder.addRule(...)`, and set only `ruleId` on results -- the builder resolves `ruleIndex` consistently. Do NOT hand-compute `ruleIndex`. Deduplicate rules by the human `ruleId` (Pitfall 6) and add them in sorted order (Pitfall 5). It is valid (and simplest) to omit `ruleIndex` entirely and rely on `ruleId`; only add rule objects when you have real metadata (a `helpUri` to Angular/TS docs is a nice-to-have, not required).

**Warning signs:**
Schema validation error on `ruleIndex`; "unknown rule" in a SARIF viewer; a `ruleIndex` larger than `rules.length`.

**Phase to address:**
SARIF reporter phase (REP-02). Validate against the SARIF 2.1.0 schema in-test (Pitfall 11).

---

### Pitfall 8: Windows path specifics corrupt URIs and file matching

**What goes wrong:**
On the Windows arm64 dev host (and Windows CI cells), URIs come out with backslashes, mixed drive-letter case (`d:\` vs `D:\`), or 8.3 short names (`RUNNER~1`), and CRLF sneaks into the payload. `path.relative` between a lowercase-drive base and an uppercase-drive filename yields `..\..\D:\...`. Any of these breaks Code Scanning file matching and cross-OS snapshot stability.

**Why it happens:**
Windows filesystem paths are case-insensitive but case-PRESERVING, expose 8.3 aliases, and use `\`. Node's `path.relative` is a pure string op that does not case-fold or resolve drive-letter case; a base and a filename normalized differently produce nonsense relatives.

**How to avoid:**
- Normalize BOTH `pathBase` and every `fileName` with `realpathSync.native` (resolves drive-letter case + 8.3 -> long name) BEFORE `path.relative` -- the core already does this for `fileName`; do the same for `pathBase`. This is the documented Windows fix already used in `main.ts` / `normalize-options.ts` (PKG-03).
- Force `/` separators on the final URI: `.replace(/\\/g, '/')`.
- Emit `\n` only. The human formatter already forces `getNewLine: () => '\n'` (see `makeFormatHost`); the machine payload is a single serialized string, so ensure no `\r` is introduced (JSON.stringify won't add any; `node-sarif-builder` `buildSarifJsonString` returns `\n`-free content). Guard the source `bin.js`/reporter files with the existing `.gitattributes` LF rule.

**Warning signs:**
`\` or a drive letter in a URI; a snapshot that differs only by `\r` or by path case between Linux and Windows cells; `../` climbing above the repo root in a URI.

**Phase to address:**
SARIF reporter phase (REP-02) for URI normalization; verified on the Windows cells of the existing 6-cell matrix (VER pattern) and in the e2e phase.

---

### Pitfall 9: `node-sarif-builder` CJS/ESM interop breaks under lazy `await import()`

**What goes wrong:**
`const { SarifBuilder } = await import('node-sarif-builder')` yields `undefined` for the named exports (they are nested under `.default`), so `new SarifBuilder()` throws `SarifBuilder is not a constructor` -- but only at runtime, only on the `--format sarif` path, so unit tests that mock the builder never catch it.

**Why it happens:**
`node-sarif-builder` is CommonJS (no `type` field; `main`/`module` both point at CJS `dist/index.js`; `engines.node >=20`). The plugin is `type: commonjs` built with `module: nodenext`, reaching ESM-only `@angular/compiler-cli` via `await import()`. When a CJS module is `import()`-ed, Node's interop puts `module.exports` on `.default` and ALSO hoists detected named exports to the namespace -- but detection via cjs-module-lexer is not guaranteed for every export shape. The safe, version-stable access differs from the human `formatDiagnostics` bridge.

**How to avoid:**
- Access defensively: `const mod = await import('node-sarif-builder'); const { SarifBuilder, SarifRunBuilder, SarifResultBuilder, SarifRuleBuilder } = (mod as any).default ?? mod;` -- prefer `.default` (the whole CJS `module.exports`), falling back to the namespace. Pin this in an INTEGRATION test that actually imports the real package (not a mock), so the interop shape is exercised on every CI cell.
- Keep the import LAZY and inside the SARIF path only (charter: never load it -- nor its transitive `fs-extra` -- on the JSON/human/CLI-flag paths). A single `await import()` at the top of the SARIF reporter is correct.
- Do NOT downlevel: the `module: nodenext` build must be preserved for this import exactly as for `@angular/compiler-cli` (PKG-02). A `module: commonjs` build would rewrite `import()` to `require()` -- which happens to work for a CJS dep but would break the compiler-cli bridge, so keep the whole plugin on `nodenext`.

**Warning signs:**
`X is not a constructor` / `Cannot read properties of undefined` only under `--format sarif`; green unit tests (mocked builder) but a red integration/e2e; `ERR_REQUIRE_ESM` (means the build downleveled).

**Phase to address:**
SARIF reporter phase (REP-02). Requires a real-import integration test, not just a mocked unit test. Add `node-sarif-builder` as a `dependency` policed by `@nx/dependency-checks` (Pitfall 14).

---

### Pitfall 10: File-less diagnostics dropped or crash the reporter

**What goes wrong:**
The reporter throws `Cannot read properties of undefined (reading 'fileName')` or `getLineAndCharacterOfPosition` throws, OR it silently drops the diagnostic -- for a synthesized `90001`/`90002` guard, a global TS diagnostic (`getGlobalDiagnostics`), or a config error, all of which have `file: undefined` / `start: undefined`. Dropping them is a SILENT FALSE PASS in the machine output (the charter's cardinal sin): the JSON/SARIF says "clean" while the verdict is fail.

**Why it happens:**
`synthesizeFilelessError` deliberately builds diagnostics with `file`/`start`/`length` all `undefined` (this is load-bearing: file-less diagnostics bypass the boundary filter and are always counted). Global/location-less TS diagnostics (COR-02) are the same. A reporter that assumes every diagnostic has a `file` and a position crashes or omits them.

**How to avoid:**
- Guard position extraction: only call `getLineAndCharacterOfPosition` when `diagnostic.file !== undefined && diagnostic.start !== undefined`. Otherwise emit no `region`/no line-column.
- Represent file-less diagnostics faithfully. JSON: `file: null, line: null, column: null` (still carry code + category + message). SARIF: emit a result with NO `physicalLocation`, or attach it to the tsconfig/analysisTarget. NOTE: GitHub GH1001 will not DISPLAY a locationless result -- that is acceptable for a synthesized "no input files" guard (it still fails the run), but it means the SARIF alone cannot convey the failure to the Code Scanning UI. The EXIT CODE / verdict, not the SARIF, is the authoritative fail signal; document that file-less diagnostics are conveyed via the verdict and the JSON, and may not surface as a Code Scanning alert.
- NEVER filter a diagnostic out of the payload because it lacks a file. The payload must contain every diagnostic in `CoreResult.diagnostics`, one-to-one.

**Warning signs:**
A payload with fewer entries than `CoreResult.diagnostics.length`; a crash on the empty-project / references-only fixture; a JSON that says `errorCount: 1` in a summary but has 0 diagnostic entries.

**Phase to address:**
JSON reporter phase (REP-01) -- establish the file-less handling; SARIF phase (REP-02) inherits. Add a fixture that produces a synthesized 90001 (references-only tsconfig) and a global diagnostic, and assert both appear in JSON and are represented (locationless) in SARIF.

---

### Pitfall 11: SARIF/JSON not schema-validated or snapshot-locked in CI -> silent shape drift

**What goes wrong:**
A `node-sarif-builder` upgrade, a TS-version bump, or a careless field change ships a payload that `upload-sarif` rejects, or a JSON schema change breaks every agent parsing it -- discovered in production, not in CI.

**Why it happens:**
The payload shape is an external contract (SARIF 2.1.0 for GitHub; a documented JSON schema for agents), but nothing in-repo pins it unless you add it. `@types/sarif` gives compile-time typing but not runtime schema conformance, and it does not stop a semantically-invalid-but-type-valid document (e.g. a missing required `uri`).

**How to avoid:**
- Validate the SARIF against the SARIF 2.1.0 JSON schema in a unit test (the milestone already plans this). Use the schema `$id` `https://json.schemastore.org/sarif-2.1.0.json` (or the bundled copy) with a JSON-schema validator. Keep it a dev-only test dep (no new runtime dep).
- Snapshot the JSON AND SARIF shape over committed fixtures (structure + representative values), so any field add/remove/rename fails loudly. Snapshot after normalizing volatile fields (see Pitfall 12).
- Document the JSON schema explicitly and drift-lock it (a `*.spec.ts` asserting the top-level keys / a committed `schema.json`), mirroring the repo's existing drift tripwires (`index.drift.ts`, `extended-catalog.drift.ts`, the HELP_TEXT drift-lock).

**Warning signs:**
`upload-sarif` fails with a schema error only in a real workflow; agents report "unexpected JSON shape" after a dependency bump; no test references the SARIF schema.

**Phase to address:**
Verification/CI phase; the schema-validation test lands WITH the SARIF reporter phase (REP-02) and the JSON schema-lock WITH the JSON reporter phase (REP-01).

---

### Pitfall 12: Non-deterministic fields (`durationMs`, tool version, timestamps) break snapshots and reproducibility

**What goes wrong:**
The JSON payload embeds `CoreResult.durationMs` (wall-clock), or the SARIF embeds a run timestamp / an absolute temp path, so the snapshot test flakes on every run and two CI runs over identical code produce different bytes.

**Why it happens:**
`CoreResult` carries `durationMs` (a live `performance.now()` delta). SARIF runs can carry timing/invocation data. These are legitimately in the data model but are NOT reproducible.

**How to avoid:**
- Keep timing OUT of the stable payload, or place it in a clearly-separated, snapshot-excluded field. If `durationMs` is surfaced in JSON (observability), normalize it in snapshots (`durationMs: expect.any(Number)` / redact before comparing) -- never assert its literal value.
- Do not emit wall-clock timestamps or `invocation.startTimeUtc` in the SARIF unless a consumer needs them; if emitted, exclude from snapshots.
- Tool version: `SarifRunBuilder.initSimple({ toolDriverVersion })` should read the plugin's OWN version from `package.json` at build/publish, and snapshots must redact it (it changes every release) -- assert its SHAPE, not the literal.

**Warning signs:**
A snapshot test that fails intermittently with only a number differing; SARIF bytes differ between two immediate reruns; a snapshot needs updating on every version bump.

**Phase to address:**
JSON reporter phase (REP-01) and SARIF phase (REP-02); the normalization strategy is a verification-phase concern.

---

### Pitfall 13: Machine output changes the verdict / exit codes (charter break)

**What goes wrong:**
Adding reporters accidentally changes WHEN the tool fails -- e.g. the SARIF path returns success because it "handled" the diagnostics, or a reporter error crashes the run and flips a clean verdict to exit 2, or `--format json` suppresses the coverage-incomplete fail.

**Why it happens:**
Reporters are downstream of the verdict, but wiring a new output branch invites coupling: a `try/catch` around the reporter that swallows the real verdict, or reading counts in the reporter and re-deciding success.

**How to avoid:**
- Reporters are PURE over `CoreResult` and NEVER touch the verdict. `evaluateResult(...).success` remains the SOLE owner of 0-vs-1 (CLI/executor), and `toExitCode`/`TypecheckInfrastructureError` the sole owner of 2. The `--format` choice changes ONLY what string lands on stdout.
- Order stays: `runTypecheck` -> `emitAdvisoryNotices` -> render payload (human OR json OR sarif) -> `evaluateResult` -> exit code. The payload branch sits exactly where `renderReport` sits today.
- A reporter that itself throws (e.g. `node-sarif-builder` interop) must be treated as infrastructure (exit 2), NOT swallowed into success. Let it propagate to the existing catch (CLI re-throws non-infra -> `bin.ts` maps to 2; executor re-throws).
- Do NOT read `errorCount`/counts in the reporter to decide anything about success -- a coverage-incomplete run has `errorCount === 0` but `success === false` (the documented silent-false-pass trap).

**Warning signs:**
Exit code differs between `--format human` and `--format json` on the same input; a coverage-incomplete fixture passes under `--format sarif`; a reporter crash yields exit 0/1 instead of 2.

**Phase to address:**
Adapter-wiring phase; asserted in every reporter phase (same fixture, assert IDENTICAL exit code across all three `--format` values).

---

### Pitfall 14: Breaking `CoreResult`/`CoreOptions` instead of adding optional fields (additive-only break)

**What goes wrong:**
`totalFilesCount` (OBS-01) is added as a REQUIRED field on `CoreResult`, or `--format` is added as a required option, or a reporter needs data not on `CoreResult` and someone changes an existing field's type -- silently shipping a breaking change under a patch bump (`0.2.2 -> 0.2.3`), tripping `index.drift.ts` (or worse, not tripping it and breaking real consumers of `runTypecheck`).

**Why it happens:**
Reporters want richer data than the human formatter, tempting a `CoreResult` reshape. `CoreResult` is a PUBLIC barrel export (`index.ts`) pinned by `index.drift.ts`.

**How to avoid:**
- `totalFilesCount` is OPTIONAL (`totalFilesCount?: number`), matching the existing advisory-field idiom (`present only when meaningful` / consumers branch on presence). Same for any reporter-support field.
- `--format` defaults to `human`; the option is additive on the executor/builder schema and CLI arg set. Default behavior byte-unchanged.
- Keep `node-sarif-builder` a runtime `dependency` (charter) and let `@nx/dependency-checks` police it; keep the JSON reporter + CLI flags dependency-free.
- Run the additive-only git-diff audit vs `angular-typechecker@0.2.2` before release (the established ADD-01 pattern), and keep the barrel/drift tripwire green -- `index.drift.ts` must still compile with the extended `CoreResult`.

**Warning signs:**
`index.drift.ts` fails `tsc --noEmit`; a required field added to `CoreResult`/`CoreOptions`; `@nx/dependency-checks` flags a missing/obsolete dep; the additive-audit git-diff shows a changed (not added) signature.

**Phase to address:**
Every phase that touches `CoreResult`/`CoreOptions`/schemas (OBS-01 phase, reporter phases); final additive-only audit in the release/verification phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Build JSON/SARIF messages by reusing the human `formatReport` codeframe | Reuses nice rendering | ANSI + non-determinism + coupling to the human renderer leak into the machine contract (Pitfall 2) | Never -- build messages from `flattenDiagnosticMessageText` |
| Hand-write the SARIF object literal instead of `node-sarif-builder` | No CJS/ESM interop headache (Pitfall 9); no `fs-extra` transitive dep | Must hand-maintain SARIF 2.1.0 conformance + `ruleIndex` linkage; loses schema-tracking on spec updates | Acceptable ONLY if the interop cost proves unmanageable AND you add strict schema validation; the charter chose the builder, so default to it |
| Emit `ruleIndex` computed by hand | Feels explicit | Drifts from `rules[]` order -> invalid index (Pitfall 7) | Never -- let the builder own linkage, or omit `ruleIndex` |
| Skip `partialFingerprints` (rely on GitHub auto-populate) | Less code | Fine for `upload-sarif`, but duplicate alerts via the `/sarifs` API; less stable matching (Pitfall 5) | Acceptable for the `upload-sarif`-only target this milestone scopes; document the API-upload caveat |
| Assert `durationMs`/version literally in snapshots | Simple snapshot | Flaky tests on every run/release (Pitfall 12) | Never -- redact volatile fields |
| Mock `node-sarif-builder` in ALL tests | Fast unit tests | Misses the real CJS/ESM interop shape (Pitfall 9) | Unit tier may mock; at least one integration test MUST import the real package |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Code Scanning (`actions/upload-sarif`) | Absolute / backslash `artifactLocation.uri`; locationless results expected to show as alerts | Repo-root-relative POSIX URI (`path.relative(root, file).replace(/\\/g,'/')`); accept that file-less diagnostics won't surface as alerts and rely on the verdict/exit code (Pitfalls 4, 10) |
| GitHub result matching | Unstable ruleId (negative NG code) or unstable path -> churning duplicate alerts | Human `NG8xxx`/`TSxxxx` ruleId (Pitfall 6) + stable relative path + optional `partialFingerprints` (Pitfall 5) |
| `node-sarif-builder` (CJS) under `await import()` on `nodenext` | Destructure named exports off the namespace -> `undefined` | `(mod.default ?? mod)` access; lazy-import only on the SARIF path; keep `nodenext` (Pitfall 9) |
| `node-sarif-builder` transitive `fs-extra` | Using a builder file-write helper (pulls in fs-extra I/O; couples the reporter to disk) | Use `buildSarifJsonString({ indent: false })` -> string, and write via the adapter's existing stdout seam; the reporter never does file I/O (charter) |
| SARIF 2.1.0 schema | Trusting `@types/sarif` for conformance | Runtime-validate against the SARIF 2.1.0 JSON schema in a dev-only test (Pitfall 11) |
| TypeScript diagnostic model | Assuming every diagnostic has `file`/`start` | Guard `getLineAndCharacterOfPosition` on `file && start !== undefined`; +1 both axes (Pitfalls 3, 10) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eagerly importing `node-sarif-builder` (+ `fs-extra`) on every run | Slower cold start for the human/JSON/CLI paths that never use SARIF | Lazy `await import('node-sarif-builder')` inside the SARIF reporter only (charter) | Every non-SARIF invocation, especially the agent/CLI fast loop |
| Re-reading source files to compute positions/line-hash per diagnostic | Extra I/O proportional to diagnostic count | Use the `ts.SourceFile` already attached to `diagnostic.file` (no re-read); compute line/col via `getLineAndCharacterOfPosition` on that node | Large projects with thousands of diagnostics |
| Serializing the whole payload then re-parsing to normalize for snapshots | Doubles work in tests | Normalize the object model before serialize; assert on the object where possible | Large fixtures in CI |

## Security Mistakes

Domain-specific issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Embedding absolute local paths (`D:\Users\...`) in a SARIF committed/uploaded to a public repo | Leaks the maintainer's local directory structure / usernames into public Code Scanning data | Repo-root-relative URIs only (Pitfall 4) -- also the correctness fix; realpath-normalize but relativize before emit |
| Reporting dependency (node_modules) diagnostic TEXT into the machine payload when `includeDeps` is off | Content-isolation break (the repo's standing rule: never emit a dependency's error text) | Reporter emits only what's in `CoreResult.diagnostics` (already boundary-filtered); node_modules suppressions are counts only, never text |
| Trusting a diagnostic message as safe to embed in JSON without escaping | Message contains quotes/newlines/control chars -> malformed JSON | Use `JSON.stringify` (escapes correctly); never hand-concatenate JSON; for SARIF let the builder serialize |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `--format json` still prints the human report or notices to stdout | Unparseable output; agent pipeline breaks | Payload-only stdout; notices to stderr; `--quiet` silences notices (Pitfall 1) |
| No documented JSON schema | Agents guess field names; break on any change | Ship + drift-lock a documented JSON schema (Pitfall 11); include both raw `code` and human `ruleId` |
| `--format sarif` prints pretty-indented multi-KB to a TTY by default | Wall of text when a human forgets to redirect | `indent: false` by default (compact); document `> results.sarif` usage; SARIF is not a human format |
| Silent divergence between `--format` outputs' verdict | User thinks JSON "passed" but exit code failed | Identical exit code across all `--format` values (Pitfall 13); document that the exit code is authoritative |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **JSON reporter:** Often missing file-less-diagnostic handling -- verify a synthesized 90001 (references-only tsconfig) and a global TS diagnostic both appear with `line: null` and are NOT dropped (Pitfall 10).
- [ ] **SARIF line/column:** Often off by one -- verify against a hand-counted position in a fixture, both `startLine`/`startColumn` AND `endLine`/`endColumn` (Pitfall 3).
- [ ] **SARIF URIs:** Often absolute/backslash -- verify every URI is relative, forward-slash, no drive letter, no `file:` (Pitfall 4); verify on a Windows CI cell.
- [ ] **ruleId:** Often the raw negative NG code -- verify `NG8101` not `-998101`, `TS2322` not `2322`... actually `TS2322` (Pitfall 6).
- [ ] **stdout purity:** Often has a stray notice -- verify `--format json | jq .` and `--format sarif` validate, with notices present on stderr (Pitfall 1).
- [ ] **Color:** Often leaks ANSI -- verify no `` byte in either payload, and payload identical under `FORCE_COLOR=1` (Pitfall 2).
- [ ] **node-sarif-builder interop:** Often only mock-tested -- verify at least one test imports the REAL package and constructs a builder (Pitfall 9).
- [ ] **Determinism:** Often only tested on Linux -- verify byte-identical payload across the OS x Node matrix (Pitfall 5, 12).
- [ ] **Additive-only:** Often adds a required field -- verify `index.drift.ts` compiles and the git-diff audit vs `@0.2.2` shows only additions (Pitfall 14).
- [ ] **Exit-code parity:** Often diverges -- verify the SAME fixture yields the SAME exit code under `human`/`json`/`sarif` (Pitfall 13).
- [ ] **e2e:** Often tests the local dist, not the shipped tarball -- verify the SHIPPED surfaces emit valid JSON + schema-valid SARIF (the repo's "npm ships source, test the tarball" lesson).

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Off-by-one positions shipped (Pitfall 3) | LOW | Fix the `+1` in the shared position helper; patch release; annotations self-heal on next scan |
| Absolute/backslash URIs shipped (Pitfall 4) | MEDIUM | Fix relativization; existing Code Scanning alerts churn once (old closed, new opened) as paths stabilize; patch release |
| Duplicate Code Scanning alerts from unstable ordering/fingerprints (Pitfall 5) | MEDIUM | Add deterministic ordering + `partialFingerprints`; GitHub re-matches on next upload; stale alerts age out |
| `node-sarif-builder` interop crash in production (Pitfall 9) | LOW | Switch to `(mod.default ?? mod)`; add the real-import integration test that would have caught it; patch release |
| Breaking `CoreResult` shipped under a patch (Pitfall 14) | HIGH | Consumers of `runTypecheck` break at runtime; requires a corrective release + advisory; prevention (drift tripwire + audit) is far cheaper |
| Silent false pass in machine output (Pitfall 10/13) | HIGH | Charter violation -- worst case; requires re-audit of the verdict/exit path and a corrective release; the coverage-incomplete + file-less fixtures are the guardrail |

## Pitfall-to-Phase Mapping

Phases are logical (roadmap not yet numbered; this milestone continues from Phase 29, so numbers will be 30+). Grouped by the milestone's features: **OBS** (`totalFilesCount`), **REP-01** (JSON reporter), **REP-02** (SARIF reporter), **WIRE** (`--format` + `--quiet`/`--color` through the three adapters, CLIX-02), **VER** (verification / e2e / additive audit).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. stdout purity | WIRE + REP-01 | `--format json | jq .` and `sarif` validate; notice appears on stderr; `--quiet` silences notices only |
| 2. ANSI leakage | REP-01 (rule), REP-02 | No `` byte in payload; payload stable under `FORCE_COLOR=1` |
| 3. 0-based -> 1-based | REP-02 (+ REP-01 line/col) | Hand-verified position fixture; both start AND end axes |
| 4. relative forward-slash URI | REP-02 | URI-shape spec (relative, no `\`, no drive letter); Windows-cell e2e |
| 5. deterministic ordering / fingerprints | REP-01 (order), REP-02 (fingerprints) | Byte-stable snapshot across OS x Node matrix |
| 6. human ruleId (NG/TS) | REP-02 (+ REP-01 code string) | Data-driven spec over TS/NG/90xxx code families |
| 7. rules[] + ruleIndex linkage | REP-02 | SARIF 2.1.0 schema validation |
| 8. Windows paths | REP-02 | Windows CI cell; realpath-normalize base + file; LF-only |
| 9. node-sarif-builder interop | REP-02 | Real-import integration test on every cell |
| 10. file-less diagnostics | REP-01 (+ REP-02) | 90001 + global-diagnostic fixture present in JSON, represented in SARIF |
| 11. schema/snapshot lock | REP-01 (JSON schema), REP-02 (SARIF schema), VER | Schema-validation test; drift-locked schema spec |
| 12. non-deterministic fields | REP-01, REP-02 | Redacted-field snapshots; two-run byte stability |
| 13. verdict/exit unchanged | WIRE (asserted in REP-01/REP-02) | Same-fixture identical exit code across all `--format` values |
| 14. additive-only | OBS + REP-02 (dep) + VER | `index.drift.ts` compiles; `@nx/dependency-checks` green; git-diff audit vs `@0.2.2` |

## Sources

- Codebase (read directly, HIGH): `src/core/run-typecheck.ts` (`CoreResult`/`CoreOptions`, `finalize`, sort+dedup, file-less synthesis), `src/core/format-report.ts` (ANSI strip, deterministic format host, `getNewLine: '\n'`), `src/core/render-report.ts`, `src/core/evaluate-result.ts` (verdict is the sole owner of 0-vs-1; coverage-incomplete has `errorCount === 0`), `src/core/emit-advisory-notices.ts` (notices -> logger), `src/core/diagnostic-codes.ts` (`NG()`/`ngCodeOf()` negative encoding; synthesized 90001/90002), `src/executors/typecheck/executor.ts` (raw `process.stdout.write(report)`, notices to `logger`), `src/cli/main.ts` (`RunResult { stdout, stderr }`, color precedence, `realpathSync.native` + `.replace(/\\/g,'/')`), `src/cli/console-logger.ts` (`BufferingLogger` -> stderr), `src/cli/bin.ts` (only stream-write/exit site, EPIPE, `process.exitCode`), `src/index.ts` + `src/index.drift.ts` (public barrel + additive-only tripwire).
- `.planning/PROJECT.md` + `.planning/milestones/v0.2.2-REQUIREMENTS.md` (HIGH): v0.2.3 charter (additive-only; lazy SARIF import; reporters pure over `CoreResult`; never change the verdict), the stdout/stderr + 0/1/2 exit contract, the tarball-e2e "test the shipped artifact" lesson.
- GitHub Docs, "SARIF support for code scanning" (HIGH): `physicalLocation.artifactLocation.uri` mandatory (GH1001 -- locationless results not displayed); relative URIs + `originalUriBaseIds`/`uriBaseId`; `partialFingerprints` for cross-run result matching (auto-populated by the `upload-sarif` action from source when absent, NOT by the `/code-scanning/sarifs` API); stable `ruleId` + consistent filepath required to avoid duplicate/reopened alerts. https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support
- `node-sarif-builder` npm + GitHub (HIGH): `SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`; `initSimple({ toolDriverName, toolDriverVersion, url })`; `addRule`/`addResult`/`addRun`; `buildSarifJsonString({ indent })` -> string, `buildSarifOutput()` -> object; SARIF 2.1.0. https://www.npmjs.com/package/node-sarif-builder , https://github.com/nvuillam/node-sarif-builder
- `node-sarif-builder` `package.json` (HIGH): no `type` field (CommonJS), `main`+`module` both `dist/index.js`, `engines.node >=20`, dependencies `@types/sarif ^2.1.7` + `fs-extra ^11.1.1`. https://raw.githubusercontent.com/nvuillam/node-sarif-builder/main/package.json
- SARIF 2.1.0 OASIS spec (HIGH, well-established): `region.startLine`/`startColumn`/`endLine`/`endColumn` are 1-based; `ts.getLineAndCharacterOfPosition` returns 0-based line/character (TypeScript compiler API, established).

---
*Pitfalls research for: JSON + SARIF machine-readable reporters (angular-typechecker v0.2.3)*
*Researched: 2026-07-18*
