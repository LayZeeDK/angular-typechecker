# Feature Research

**Domain:** Machine-readable diagnostics reporters (JSON + SARIF 2.1.0) for a type-checker CLI/Nx-executor/Angular-builder
**Researched:** 2026-07-18
**Confidence:** HIGH

Grounded in (a) the shipped `CoreResult` shape (`run-typecheck.ts`), the diagnostic-code encoding (`diagnostic-codes.ts`), the verdict classifier (`evaluate-result.ts`), and the human formatter (`format-report.ts` / `render-report.ts`); (b) the GitHub Code Scanning SARIF support doc; (c) the ESLint built-in `json` formatter; (d) the `node-sarif-builder` API. All external facts cited under Sources.

---

## Executive orientation (read first)

- **`tsc` has NO built-in machine-readable output.** There is no `tsc --format json` and no `tsc --sarif`; the closest is `--pretty false` (still human text). Every ecosystem tool that wants structured TS diagnostics builds its own shape over the `ts.Diagnostic` objects. So there is **no canonical "tsc JSON"** to conform to -- the de-facto conventions come from **ESLint `-f json`** and **Biome**, which the JSON reporter should mirror.
- **1-based line/column is universal.** ESLint, Biome, SARIF, the TypeScript human formatter, editors, and GitHub annotations all use 1-based line AND column. TypeScript's *internal* `ts.getLineAndCharacterOfPosition` returns **0-based** `{ line, character }`. The reporter MUST `+1` both. This is the single most common off-by-one in this space.
- **The reporter is pure over `CoreResult`, exactly like `formatReport`/`renderReport`.** It changes no verdict, adds no engine behavior, and (like `renderReport`) needs `ts` injected via `loadTypescript()` for `flattenDiagnosticMessageText` + line/column math. `node-sarif-builder` is lazy-`import()`ed only on `--format sarif`.
- **`CoreResult` already carries everything the JSON reporter needs EXCEPT derived line/column and a display code** -- both are computed from the `ts.Diagnostic` objects already in `CoreResult.diagnostics` (each carries `.file` (a `SourceFile`), `.start`, `.length`, `.code`, `.category`, `.messageText`). Only `totalFilesCount` (OBS-01) is genuinely absent and must be newly threaded out of the compilation.

---

## Feature Landscape

### Table Stakes (Consumers Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `--format json` opt-in; human stays default | Agents/CI ask for structured data explicitly; humans keep the codeframe report | LOW | Pure fn over `CoreResult`; a `--format` enum flag on CLI + a matching executor/builder option. Default `human`. |
| Per-diagnostic `file, line, column, endLine, endColumn, code, severity, message` | ESLint/Biome baseline; agents parse these fields by name | MEDIUM | `line/column` DERIVED (see "Not exposed" below). 1-based. |
| **1-based** line/column | Every consumer + GitHub expects 1-based | LOW | `ts.getLineAndCharacterOfPosition` is 0-based -> `+1`. Load-bearing. |
| Top-level summary: `errorCount`, `warningCount`, diagnostics total, `durationMs`, `tsConfigPath` | Counts drive CI gates + agent triage without re-scanning the array | LOW | All already on `CoreResult`. |
| A stable **schema/version marker** in the payload | Consumers must detect a breaking schema change; agents pin to a shape | LOW | Emit both the tool `version` (package.json) AND a `formatVersion` integer. Additive-only 0.x means the shape must stay stable. |
| Valid **SARIF 2.1.0** for GitHub `upload-sarif` | The whole point of REP-02; GitHub rejects malformed/partial SARIF | MEDIUM | Required fields enumerated below. Use `node-sarif-builder` so the envelope is spec-correct. |
| Consistent severity mapping (`ts.DiagnosticCategory` -> SARIF level / JSON severity) | Errors must surface as errors in GitHub + agent logic | LOW | Exact table below. |
| Deterministic, idempotent output | Agents diff runs; CI caches | LOW | Already a repo invariant: diagnostics are sorted+deduped in `finalize`; `getNewLine: '\n'`; absolute-path sentinel. Reporters inherit it. |
| `--no-color` / `NO_COLOR` honored | Machine output must be ANSI-free | LOW | Already shipped for the CLI (`colorFromEnv`: `NO_COLOR` > `FORCE_COLOR` > `isTTY`). JSON/SARIF are inherently color-free. |
| Repo-relative, forward-slash file paths in SARIF/JSON | GitHub needs repo-relative URIs to place alerts; consistent paths give stable fingerprints | LOW | Reuse the existing `pathBase` relativization (`context.root` / workspace root) from `formatReport`. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Emit the discriminated **`outcome`** (`clean` / `type-error` / `coverage-incomplete` / `warnings-exceeded`) in the JSON summary | Exposes this tool's charter floor (never-silent coverage) as machine data; richer than pass/fail | LOW | `evaluate-result.ts` already computes it (`Outcome` type). Wire `evaluateResult(result, {maxWarnings, strict})` into the summary. This is the tool's signature signal. |
| Surface the **suppression + advisory fields** as structured data: `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, `suppressedThirdParty`, `suppressedInGraphFiles`, `templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports` | Unique to this tool; lets CI/agents act on coverage gaps + advisories, not just diagnostics | LOW-MED | All already on `CoreResult` (mostly optional/present-if-non-empty). Put them under a `summary` + `advisories` object; keep additive. |
| **Complete diagnostic set as data** (TS + template + NG8xxx extended) | The core value: agents get template + extended diagnostics no bare `tsc`/`ngc --noEmit` JSON could give | LOW | Comes for free -- `CoreResult.diagnostics` already unions all phases. |
| SARIF **`rules[]` catalog** with `id` = `NG8109` etc. + `help.text` for the 18 extended diagnostics | GitHub Code Scanning renders rule name + description + severity; turns NG8xxx into first-class alerts | MEDIUM | `extended-catalog.members.ts` already enumerates all 18 `ExtendedTemplateDiagnosticName` members. Reuse it to build `reportingDescriptor`s. Optional but high-value for GitHub UX. |
| **`partialFingerprints`** for stable dedup | GitHub tracks alert identity across runs; stable fingerprints avoid alert churn | MEDIUM | Recommended by GitHub (auto-generated if omitted, but self-computed is more stable). `node-sarif-builder` supports it. |
| `totalFilesCount` in the summary (OBS-01) | `@nx/js` parity; agents/CI see program size | MEDIUM | REQUIRES new plumbing (see "Not exposed"). Nice-to-have, not gating. |
| SARIF `relatedLocations` from `ts.Diagnostic.relatedInformation` | Multi-location TS errors (e.g. "type declared here") show linked locations in GitHub | MEDIUM | `relatedInformation` exists on `ts.Diagnostic`; map to SARIF `relatedLocations`. Also emit as JSON `relatedInformation[]`. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| A bespoke JSON shape that ignores ESLint/Biome conventions | "Design it fresh" | Agents already parse ESLint-shaped diagnostics; gratuitous divergence raises the integration cost | Mirror ESLint field NAMES (`ruleId`/`severity`/`line`/`column`/`endLine`/`endColumn`/`message`) where they map cleanly; add tool-specific fields alongside, don't rename the common ones |
| `--format json` (or sarif) changing the verdict / exit code | "The reporter should decide pass/fail" | Reporters are PURE over `CoreResult`; the verdict is owned by `evaluateResult` + the adapter. Coupling them re-introduces silent-false-pass risk | Reporter reads `outcome`/`success`; the ADAPTER still owns exit code (0/1/2) independent of `--format` |
| ESLint-style `--quiet` = "errors only, hide warnings" | Familiar from ESLint | For a *completeness* tool whose charter is never-silent, hiding warning-severity diagnostics (incl. promoted NG8xxx) is a false-clean hazard; `--max-warnings` already gates warnings | `--quiet` suppresses only advisory/progress CHATTER (the `warn*` notices, any summary line) on stderr; NEVER hides diagnostics or flips the verdict |
| SARIF with no `rules[]` and no/unstable fingerprints | Fastest to emit | GitHub churns alerts (new alert every run) and shows bare rule ids with no description | Ship a `rules[]` catalog + stable `partialFingerprints` |
| Absolute file paths in SARIF/JSON | Simplest (that's what the compiler gives) | GitHub can't map absolute paths to repo files -> alerts don't attach; fingerprints unstable across machines | Repo/workspace-relative forward-slash URIs via the existing `pathBase` |
| Bundling `node-sarif-builder` (and its `fs-extra`) into the human/JSON path | One import site is simpler | Loads a dependency (+ `fs-extra`) on every run even when unused; slows CLI startup | Lazy `await import('node-sarif-builder')` ONLY inside the SARIF reporter; JSON + human + flag paths stay dependency-free |
| Adding a color library for `--color`/`--no-color` | "Need color handling" | Redundant -- ANSI strip + env precedence already exist (`format-report.ts` ANSI_PATTERN, `main.ts` `colorFromEnv`) | Extend the existing precedence with an explicit flag on top; no new dep |
| `--format codeclimate` / `compact` / `--output <file>` / gitlab | "More formats/outputs" | Scope creep; out of scope per PROJECT.md; file output is just shell redirection (`> out.sarif`) | JSON + SARIF only this milestone; document `nx run ... --format sarif > results.sarif` |
| Pretty-printed SARIF by default | Human-readable | Larger files; GitHub caps at 10 MB gzip | Compact SARIF by default (`buildSarifJsonString({ indent: false })`); pretty JSON is fine for agents (small) |

---

## Severity Mapping (authoritative)

`ts.DiagnosticCategory` numeric enum: `Warning = 0`, `Error = 1`, `Suggestion = 2`, `Message = 3`. **Count by category, never by code sign** (the NG negative encoding is display-only). Errors and Warnings are already counted in `CoreResult.errorCount`/`warningCount`; Suggestion/Message stay inspectable in `diagnostics` but are uncounted.

| `ts.DiagnosticCategory` | JSON `severity` (string) | JSON `severity` (ESLint-int parity, optional) | SARIF `level` | Notes |
|-------------------------|--------------------------|-----------------------------------------------|---------------|-------|
| `Error` (1) | `"error"` | `2` | `"error"` | Always fails the verdict. |
| `Warning` (0) | `"warning"` | `1` | `"warning"` | Fails only via `--max-warnings`/`strict`. A consumer's `extendedDiagnostics.defaultCategory: "error"` already promotes NG8xxx to `Error` upstream -- the mapping is derived from the ACTUAL category, not the code. |
| `Suggestion` (2) | `"suggestion"` | `0` (ESLint has no 0; use `"suggestion"`) | `"note"` | Uncounted; include in `diagnostics` for completeness. |
| `Message` (3) | `"message"` | -- | `"note"` | Uncounted. |
| (SARIF has a 4th level) | -- | -- | `"none"` | Not produced by this tool; reserved by the spec. |

**Recommendation:** emit the string `severity` (`error`/`warning`/`suggestion`/`message`) as the primary field for readability; optionally also emit the ESLint integer for drop-in ESLint tooling. Do NOT invent numeric severities that disagree with ESLint (2=error, 1=warning).

---

## Recommended JSON schema (concrete, keyed to real `CoreResult` fields)

Flat top-level `diagnostics[]` (easier for agents than ESLint's array-of-files nesting; note the tradeoff below). Field names mirror ESLint/SARIF where they map.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/LayZeeDK/angular-typechecker/main/schema/atc-report.schema.json", // optional, once published
  "formatVersion": 1,                 // stable integer; bump only on a breaking shape change
  "tool": "angular-typechecker",
  "version": "0.2.3",                 // from package.json (VER-01/02 pattern already reads it)
  "tsConfigPath": "apps/app/tsconfig.json",   // CoreResult.tsConfigPath (relativized to pathBase)
  "summary": {
    "outcome": "type-error",          // evaluate-result Outcome: clean|type-error|coverage-incomplete|warnings-exceeded
    "success": false,                 // evaluateResult(...).success (verdict owner stays the adapter)
    "errorCount": 3,                  // CoreResult.errorCount
    "warningCount": 1,                // CoreResult.warningCount
    "diagnosticCount": 4,             // CoreResult.diagnostics.length
    "rootNamesCount": 42,             // CoreResult.rootNamesCount (input root .ts files)
    "totalFilesCount": 318,           // OBS-01 (OPTIONAL; omitted until plumbed -- see "Not exposed")
    "durationMs": 14231,              // CoreResult.durationMs
    "suppressedThirdParty": 12,       // node_modules suppressions (never affects verdict)
    "suppressedInGraphErrorCount": 0, // first-party dropped errors (coverage floor)
    "suppressedInGraphWarningCount": 0
  },
  "diagnostics": [
    {
      "file": "apps/app/src/app.component.ts", // relativized; null when file-less
      "line": 12,          // 1-based (0-based ts value +1); null when file-less
      "column": 5,         // 1-based; null when file-less
      "endLine": 12,       // 1-based, from start+length; null when file-less/length undefined
      "endColumn": 20,     // 1-based; null
      "code": "NG8109",    // display code: TS#### | NG#### | ATC90001 (see code rules)
      "rawCode": -998109,  // the exact ts.Diagnostic.code (agents that want the raw value)
      "severity": "error", // from category (table above)
      "source": "angular", // typescript | angular | angular-typechecker
      "message": "Interpolated signal ... should be invoked",  // ts.flattenDiagnosticMessageText(d.messageText, '\n')
      "relatedInformation": [            // optional; from d.relatedInformation
        { "file": "apps/app/src/x.ts", "line": 3, "column": 1, "message": "declared here" }
      ]
    }
  ],
  "advisories": {                       // optional block; each present only when non-empty (mirror CoreResult presence idiom)
    "templateCheckAborted": { "fileName": "apps/app/src/broken.ts" },
    "skippedReferences": [ { "referencePath": "../other/tsconfig.json", "reason": "out-of-project" } ],
    "notTypeCheckedDeclaredFiles": [ "apps/app/src/doc.mdx" ],
    "bundlerQueryImports": [ "./logo.svg?raw" ],
    "suppressedInGraphFiles": [ "libs/x/src/lib/y.ts" ]
  }
}
```

**Code-string rules** (mirror the human formatter, which surfaces `NG####`):
- `d.code > 0 && d.code < 90000 && d.code !== 500` -> `"TS" + d.code` (raw TS codes: 2322, 5053, ...).
- `d.code < 0` (Angular negative encoding) -> `"NG" + ngCodeOf(d.code)` (e.g. `-998109` -> `"NG8109"`). Helper already exists (`diagnostic-codes.ts` `ngCodeOf`).
- `d.code === 90001 | 90002` (synthesized) -> a stable prefix, e.g. `"ATC90001"`. These are file-less Errors (see SARIF file-less handling).

**ESLint-shape tradeoff (document the decision):** ESLint's `json` formatter is an array of *file* objects each with a `messages[]` array (fields `filePath`, `messages`, `errorCount`, `warningCount`, `severity` 1/2, 1-based `line`/`column`/`endLine`/`endColumn`, `ruleId`, `message`, `messageId`). A flat `diagnostics[]` is simpler for agents and matches how this tool already unions across leaves; a per-file grouping is closer to ESLint. **Recommend flat** + a top-level summary (this tool's diagnostics already carry their own `file`), and note ESLint parity is at the FIELD level (names), not the container shape.

---

## Minimal SARIF 2.1.0 object GitHub `upload-sarif` accepts (concrete)

GitHub required top-level: `$schema`, `version` (`"2.1.0"` only), `runs[]`. Per run: `tool.driver` + `results[]`. Per result GitHub requires `message.text`, `locations[]`, AND `partialFingerprints`. Per location: `physicalLocation.artifactLocation.uri` + `region.startLine`/`startColumn`/`endLine`/`endColumn` (all 1-based). `ruleId`/`ruleIndex`/`level`/`relatedLocations` are optional. (Sources: GitHub SARIF support doc.)

```jsonc
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "angular-typechecker",
          "version": "0.2.3",
          "informationUri": "https://github.com/LayZeeDK/angular-typechecker",
          "rules": [
            {
              "id": "NG8109",
              "name": "InterpolatedSignalNotInvoked",
              "shortDescription": { "text": "Interpolated signal not invoked" },
              "defaultConfiguration": { "level": "warning" }
            },
            { "id": "TS2322", "shortDescription": { "text": "TypeScript type error TS2322" } }
          ]
        }
      },
      "results": [
        {
          "ruleId": "NG8109",
          "ruleIndex": 0,
          "level": "error",
          "message": { "text": "Interpolated signal ... should be invoked" },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "apps/app/src/app.component.ts" },
                "region": { "startLine": 12, "startColumn": 5, "endLine": 12, "endColumn": 20 }
              }
            }
          ],
          "partialFingerprints": { "atcDiagnosticHash/v1": "9f2c…" }
        }
      ]
    }
  ]
}
```

Notes:
- GitHub's *strict* validator wants `rules[].id` + `shortDescription.text` + `fullDescription.text` + `help.text`; the **ingestion** path is more lenient (name + rules present). Ship at least `id` + `shortDescription.text`; add `fullDescription`/`help` for the 18 NG8xxx from the catalog to satisfy the strict validator and improve GitHub UX.
- `node-sarif-builder`'s `SarifResultBuilder.initSimple({ level, messageText, ruleId, fileUri })` + `SarifRunBuilder.initSimple({ toolDriverName, toolDriverVersion, url })` + `sarifBuilder.buildSarifJsonString({ indent: false })` produce this envelope; you supply the repo-relative `fileUri`, the region, and `partialFingerprints`.
- Empty string is NOT allowed for any required field (GitHub: "The empty string is not supported for required properties").
- Limits: 20 runs/file, 25,000 results/run (top 5,000 by severity retained), 10 MB gzip max. Not a concern at this tool's scale but note the truncation.

**File-less diagnostics + SARIF (important pitfall):** SARIF requires `locations[].physicalLocation`, but synthesized guards (`90001`/`90002`) and global/location-less TS diagnostics (from `getGlobalDiagnostics()`) have `file`/`start`/`length` undefined. GitHub does not attach a location-less result well. Recommended fallback: give file-less results an `artifactLocation.uri` pointing at the checked `tsConfigPath` with `region { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 }` so the alert lands on the tsconfig, OR emit them as `invocations[].toolExecutionNotifications` (spec-clean but less visible). Pick one and document it. JSON has no such constraint (`file: null`).

---

## Feature Dependencies

```
--format flag wiring (CLI/executor/builder)
    └──enables──> REP-01 (JSON reporter)
                     ├──requires──> line/column derivation (ts.getLineAndCharacterOfPosition, +1)
                     ├──requires──> code classification (diagnostic-codes.ts ngCodeOf)
                     ├──requires──> path relativization (existing pathBase / formatReport)
                     └──requires──> Outcome (evaluate-result.ts) for summary.outcome
    └──enables──> REP-02 (SARIF reporter)
                     ├──requires──> everything REP-01 needs
                     ├──requires──> node-sarif-builder (LAZY import, sarif path only)
                     ├──enhanced-by──> rules[] catalog (extended-catalog.members.ts, 18 NG8xxx)
                     ├──requires──> file-less-diagnostic location fallback
                     └──requires──> repo-relative forward-slash URIs

OBS-01 (totalFilesCount)
    └──requires──> NEW plumbing: capture program.getSourceFiles().length out of runNoEmitCompilation/walk
    └──enhances──> REP-01 summary (surfaced there)

CLIX-02 (--quiet, --color/--no-color)
    └──extends──> existing colorFromEnv precedence (adds explicit-flag tier on top)
    └──independent of reporters (helps human + json paths stay clean)
```

### Dependency Notes

- **REP-01 needs derived line/column:** `CoreResult` does NOT expose line/column. Each `ts.Diagnostic` in `CoreResult.diagnostics` carries `.file` (a `SourceFile`) + `.start`; the reporter calls `d.file.getLineAndCharacterOfPosition(d.start)` (0-based) and `+1`s both, and `getLineAndCharacterOfPosition(d.start + d.length)` for end. No compiler re-run -- the SourceFiles are live on the diagnostics.
- **REP-01 needs `ts` injected** (like `renderReport`): `ts.flattenDiagnosticMessageText(d.messageText, '\n')` collapses the `string | DiagnosticMessageChain` union to one string. Reach it via `loadTypescript()` (already the pattern). No new dependency.
- **REP-02 depends on REP-01's derivations** -- build SARIF over the SAME per-diagnostic projection, then feed `node-sarif-builder`. Share one internal "diagnostic -> normalized record" function between JSON and SARIF.
- **OBS-01 is the only feature that touches the engine:** `totalFilesCount` is absent because `finalize` does not retain the `Program`. It must be captured where the Program is live (`runNoEmitCompilation` in `gather-diagnostics.ts`, and summed across walked leaves) and threaded onto `CoreResult` as OPTIONAL. Additive; independent of the reporters (they just surface it if present).
- **A shared reporter seam** mirrors `renderReport`: one selector (`--format`) resolves to `renderReport` (human, default) / `reportJson` / `reportSarif`; all three adapters call the same seam so JSON/SARIF work identically on CLI, Nx executor, and Angular builder.

---

## `--quiet` and `--color`/`--no-color` conventions

**`--quiet`** (recommendation): suppress advisory/progress CHATTER only -- the five `warn*` advisory notices (`templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) and any human summary line -- on **stderr**. It does NOT suppress diagnostics, does NOT alter counts, does NOT flip the verdict/exit code. Rationale: this tool's charter is never-silent; ESLint's `--quiet` ("errors only, hide warnings") would risk hiding a real warning-severity diagnostic, so explicitly do NOT adopt that meaning (warnings are gated by `--max-warnings`/`strict`, not by quiet). With `--format json`/`sarif`, advisories already live in the payload/stderr and don't pollute stdout, so `--quiet` is mostly a human-format nicety.

**`--color` / `--no-color`** (recommendation): an EXPLICIT flag that sits ABOVE the env vars in precedence, then falls through to the shipped `colorFromEnv` chain:

```
1. --no-color flag           -> OFF   (explicit user override wins; per the NO_COLOR standard,
2. --color flag              -> ON      "command line flags ... should override $NO_COLOR")
3. NO_COLOR present (any value, incl. empty) -> OFF   (already implemented)
4. FORCE_COLOR present and not "0"/"false"   -> ON    (already implemented)
5. else process.stdout.isTTY === true        -> tracks TTY (already implemented)
```

This extends the existing precedence (`main.ts` `colorFromEnv`: NO_COLOR > FORCE_COLOR > isTTY) by adding the flag tier on top. Precedence between `NO_COLOR` and `FORCE_COLOR` is not universally standardized (Python/CMake give NO_COLOR priority; Node/chalk the reverse) -- this repo already commits to **NO_COLOR wins**, which matches the NO_COLOR informal standard; keep it. Node/chalk `FORCE_COLOR` levels (`0` off, `1` 16-color, `2` 256, `3` truecolor) are irrelevant here -- the tool only needs a boolean (color on/off) because it strips ANSI wholesale; treat any non-`0`/`false` `FORCE_COLOR` as on. JSON/SARIF are always emitted color-free regardless of these flags.

---

## MVP Definition

### Launch With (v0.2.3)

- [ ] `--format` enum flag (`human` default | `json` | `sarif`) wired through CLI + Nx executor + Angular builder -- essential; the selector.
- [ ] REP-01 JSON reporter: flat `diagnostics[]` + `summary` (with `outcome`), stable `formatVersion` + `version`, 1-based derived line/column, `TS####`/`NG####` code strings, repo-relative paths -- the primary agent deliverable.
- [ ] REP-02 SARIF reporter: minimal-valid 2.1.0 (required fields), lazy `node-sarif-builder`, repo-relative URIs, `partialFingerprints`, file-less fallback -- the CI/GitHub deliverable.
- [ ] Severity mapping applied consistently across both reporters.
- [ ] CLIX-02 `--quiet` + `--color`/`--no-color` (flag-over-env precedence).

### Add After Validation (v0.2.3, low-cost extras)

- [ ] SARIF `rules[]` catalog for the 18 NG8xxx (from `extended-catalog.members.ts`) with `shortDescription`/`fullDescription`/`help` -- passes the strict SARIF validator + nicer GitHub UX.
- [ ] `advisories` block in JSON (suppression counts + advisory arrays) -- differentiator, near-free (fields already on `CoreResult`).
- [ ] `relatedInformation` -> JSON + SARIF `relatedLocations`.

### Future Consideration (deferred)

- [ ] OBS-01 `totalFilesCount` -- only engine-touching item; ship if the plumbing is cheap, else defer (it is a nice-to-have parity field, not gating).
- [ ] Published JSON Schema file (`$schema` URL) for the JSON payload -- adds discoverability once the shape stabilizes.
- [ ] Other formats (codeclimate/compact/gitlab), `--output <file>` -- OUT OF SCOPE (redirection covers file output).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `--format` flag + selector seam | HIGH | LOW | P1 |
| REP-01 JSON reporter | HIGH | MEDIUM | P1 |
| REP-02 SARIF reporter | HIGH | MEDIUM | P1 |
| Severity mapping | HIGH | LOW | P1 |
| CLIX-02 `--quiet` / `--color` | MEDIUM | LOW | P1 |
| SARIF `rules[]` catalog (18 NG8xxx) | MEDIUM | MEDIUM | P2 |
| JSON `advisories` block | MEDIUM | LOW | P2 |
| `partialFingerprints` (stable) | MEDIUM | MEDIUM | P2 |
| `relatedInformation`/`relatedLocations` | LOW-MED | MEDIUM | P2 |
| OBS-01 `totalFilesCount` | LOW | MEDIUM (engine plumbing) | P3 |
| Published `$schema` file | LOW | LOW | P3 |

---

## Competitor / prior-art feature analysis

| Feature | `tsc` | ESLint `-f json` | Biome | GitHub Code Scanning (SARIF) | Our Approach |
|---------|-------|------------------|-------|------------------------------|--------------|
| Built-in JSON | NONE (`--pretty false` only) | Yes (array of file objects) | Yes (`--reporter=json`, diagnostics list) | n/a | Flat `diagnostics[]` + `summary` (ESLint field names, flat container) |
| Line/column base | human output 1-based; API 0-based | 1-based | 1-based | 1-based | 1-based (derive from 0-based ts + 1) |
| Severity encoding | category enum (internal) | int 1=warn/2=error | severity string | `error`/`warning`/`note`/`none` | string `severity` (+ optional ESLint int); SARIF level per table |
| SARIF | NONE | via `@microsoft/eslint-formatter-sarif` | Yes (`--reporter=sarif`, native) | required format | `node-sarif-builder` (lazy) -> minimal-valid 2.1.0 |
| Rule metadata | n/a | rule ids only in output | rule catalog | `rules[]` reportingDescriptors | `rules[]` from the NG8xxx catalog + TS codes |
| Fingerprints | n/a | no | no | `partialFingerprints` (recommended) | self-computed stable fingerprints |
| Verdict richness | exit 0/non-0 | counts | counts | alert states | discriminated `outcome` (clean/type-error/coverage-incomplete/warnings-exceeded) -- our differentiator |

---

## What `CoreResult` does NOT currently expose (hand-off for requirements/roadmap)

1. **Per-diagnostic line/column** -- NOT a field. Derive in the reporter from each `ts.Diagnostic.file` + `.start` via `getLineAndCharacterOfPosition` (0-based) `+1`. No engine change; the SourceFiles are already on the diagnostics. (Also compute `endLine`/`endColumn` from `.start + .length`; guard `length === undefined`.)
2. **A display code string** -- `CoreResult` has raw `d.code` (int) only. The reporter classifies to `TS####`/`NG####`/`ATC90001` using `diagnostic-codes.ts` `ngCodeOf`. No engine change.
3. **Flattened message** -- `d.messageText` is `string | DiagnosticMessageChain`; the reporter flattens via injected `ts.flattenDiagnosticMessageText`. No engine change (needs `loadTypescript`, already available).
4. **`totalFilesCount` (OBS-01)** -- genuinely ABSENT. The `Program` is not retained past `finalize`. Requires NEW plumbing: capture `program.getTsProgram().getSourceFiles().length` in `runNoEmitCompilation` (and sum across walked leaves / dedupe by path for the union path) and thread an OPTIONAL `totalFilesCount?: number` onto `CoreResult`. Only engine-touching reporter dependency; additive (0.x-safe).
5. **A tool `version`** -- not on `CoreResult`; read from `package.json` (the CLI already reads it for `--version`, VER pattern). Pass into the reporter.
6. **Everything else the reporters need is already present:** `tsConfigPath`, `errorCount`, `warningCount`, `durationMs`, `rootNamesCount`, `suppressedThirdParty`, `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, `suppressedInGraphFiles`, `templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`, plus `diagnostics[]` (with `.file`/`.start`/`.length`/`.code`/`.category`/`.messageText`/`.relatedInformation`). `outcome`/`success` come from `evaluateResult(result, {maxWarnings, strict})` (already computed; expose it to the reporter via the adapter, which knows `maxWarnings`/`strict`).

---

## Sources

- **GitHub Code Scanning -- SARIF support** (docs.github.com, `sarif-support-for-code-scanning`), fetched 2026-07-18 -- HIGH. Required top-level `$schema`/`version`/`runs[]`; per-run `tool.driver`(`name`,`rules[]`) + `results[]`; per-result required `message.text`, `locations[]`, `partialFingerprints`; per-location required `physicalLocation.artifactLocation.uri` + `region.startLine/startColumn/endLine/endColumn` (1-based); `ruleId`/`ruleIndex`/`level`/`relatedLocations` optional; empty string not allowed for required props; limits (20 runs, 25,000 results/run truncating to top 5,000 by severity, 10 MB gzip); auto-generated fingerprints if omitted; consistent filepaths for stable fingerprints; `defaultConfiguration.level` in {note,warning,error}.
- **ESLint -- built-in `json` formatter** (eslint.org/docs/latest/use/formatters), fetched 2026-07-18 -- HIGH. Array of file objects (`filePath`,`messages`,`errorCount`,`warningCount`,`fatalErrorCount`,`source`); per-message `ruleId`,`severity` (1=warning,2=error),`message`,`line`,`column`,`endLine`,`endColumn` (all 1-based),`messageId`,`fix`/`suggestions`.
- **node-sarif-builder README** (github.com/nvuillam/node-sarif-builder) -- HIGH. Exports `SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`; `initSimple` on run + result builders; `buildSarifJsonString({indent})` / `buildSarifOutput()`; CommonJS (`require`). Package classification (MIT, CJS, node>=20, bundled `@types/sarif`, transitive `fs-extra`, lazy-import decision) is locked in PROJECT.md v0.2.3 charter -- HIGH.
- **NO_COLOR / FORCE_COLOR conventions** (no-color.org, force-color.org, Python/CMake precedence discussion) via web search, 2026-07-18 -- MEDIUM (ecosystem disagreement on NO_COLOR-vs-FORCE_COLOR precedence). NO_COLOR set to any non-empty value disables color; FORCE_COLOR (non-empty) forces it; explicit CLI flags should override NO_COLOR per the NO_COLOR standard.
- **Codebase (authoritative, HIGH):** `packages/angular-typechecker/src/core/run-typecheck.ts` (`CoreResult`/`CoreOptions` fields), `evaluate-result.ts` (`Outcome` discriminant + verdict), `diagnostic-codes.ts` (`NG`/`ngCodeOf` negative encoding, synthesized 90001/90002, infra 500), `format-report.ts` + `render-report.ts` (pure reporter seam, ANSI strip, `pathBase` relativization, absolute-path sentinel), `cli/main.ts` `colorFromEnv` (NO_COLOR > FORCE_COLOR > isTTY precedence), `extended-catalog.members.ts` (18 NG8xxx). PROJECT.md + v0.2.2-REQUIREMENTS.md (ARGS/EXIT/`--format` charter, additive-only).
- **`tsc` has no JSON/SARIF output** -- established fact (TypeScript CLI has only `--pretty`/`--pretty false`); no authoritative "tsc JSON" convention exists, hence ESLint/Biome are the reference shapes -- HIGH.

---
*Feature research for: machine-readable type-checker reporters (JSON + SARIF 2.1.0)*
*Researched: 2026-07-18*
