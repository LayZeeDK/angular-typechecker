---
phase: 31-sarif-reporter
reviewed: 2026-07-18T13:15:57Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/angular-typechecker/src/core/sarif-report.ts
  - packages/angular-typechecker/src/core/extended-catalog.ts
  - packages/angular-typechecker/src/core/render-report.ts
  - packages/angular-typechecker/src/core/sarif-report.spec.ts
  - packages/angular-typechecker/src/core/sarif-require-graph.spec.ts
  - packages/angular-typechecker/src/core/sarif-report.interop.spec.ts
  - packages/angular-typechecker/src/core/extended-catalog.spec.ts
  - packages/angular-typechecker/src/core/extended-catalog.integration.spec.ts
  - packages/angular-typechecker/src/core/render-report.spec.ts
  - packages/angular-typechecker/src/cli/main.spec.ts
  - packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap
  - package.json
  - package-lock.json
  - packages/angular-typechecker/package.json
findings:
  blocker: 0
  major: 1
  minor: 1
  nit: 2
  total: 4
status: issues
---

# Phase 31: Code Review Report (SARIF reporter)

**Reviewed:** 2026-07-18T13:15:57Z
**Depth:** standard (with targeted deep verification: cross-checked all 18 `EXTENDED_DIAGNOSTIC_CATALOG` codes against the installed `@angular/compiler-cli@22.0.4` bundle, recomputed the golden-snapshot `sha256` fingerprints byte-for-byte, and read the `node-sarif-builder@4.1.0` compiled source to verify interop/region-building behavior)
**Files Reviewed:** 14
**Status:** issues (0 blocker, 1 major, 1 minor, 2 nit -- advisory, none ship-blocking)

## Summary

Reviewed the new SARIF 2.1.0 reporter (`sarif-report.ts`), the new enum-driven
extended-diagnostic catalog (`extended-catalog.ts`), the `render-report.ts` seam
wiring, and all associated specs/manifests for the `78f70e7^..HEAD` range.

The implementation is solid. Specifically verified and confirmed correct (not
just "looks right"):
- All 18 `EXTENDED_DIAGNOSTIC_CATALOG` `ngCode` values are byte-correct against
  the real `ErrorCode` enum in the installed `@angular/compiler-cli@22.0.4`
  bundle (`chunk-QY6RCOQ6.js`) -- cross-checked every entry, zero mismatches.
- The `atcFingerprint/v1` sha256 recipe is exactly what the module header
  claims: recomputed both golden-snapshot fingerprints independently in Node
  and they match byte-for-byte.
- The lazy-import firewall (D-03) is real: `render-report.ts`'s `sarif` branch
  only reaches `node-sarif-builder` via a relative dynamic `import()`, never a
  static `require`; the require-graph guard's positive control is asserted
  against actual built output.
- D-13 anti-drift holds: `sarif-report.ts` never re-implements `path.relative`,
  `ngCodeOf`, `getLineAndCharacterOfPosition`, or
  `flattenDiagnosticMessageText` -- everything routes through the shared
  `toDiagnosticRecord` projection.
- D-08 additive-only holds: the diff touches only the files listed above; the
  public barrel, `index.drift.ts`, `builder.ts`, and both package versions are
  byte-unchanged (confirmed via `git diff --stat`).
- File-less diagnostics are never dropped (D-01), and the reporter never
  re-derives the verdict (D-07) -- confirmed by reading `sarif-report.ts` in
  full: it has no `evaluateResult` import and no `success`/`errorCount` logic.

Two findings are worth fixing, neither of which blocks shipping:

1. A **major** finding: the self-computed `partialFingerprints` tuple omits
   the diagnostic's column, and I found a concrete, real Angular diagnostic
   whose message text is unparameterized, so two genuinely distinct
   occurrences on the same source line collide to an identical fingerprint.
   This works against the stated purpose of D-02 (unique, GitHub-trackable
   fingerprints) and is a one-line, zero-cost fix.
2. A **minor** finding: the extended-catalog's completeness spec checks
   *presence* and *positivity* of each `ngCode` but never asserts they are
   pairwise *distinct*, so a future transcription slip in
   `extended-catalog.ts` (currently verified correct) would silently produce
   a duplicate SARIF rule id with no CI signal.

Two **nit**-level defensive-programming observations round out the report.

## Major

### MJ-01: `partialFingerprints` tuple omits column, causing verified same-line fingerprint collisions

**File:** `packages/angular-typechecker/src/core/sarif-report.ts:149-158`

**Issue:**

```ts
function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [
    record.code,
    record.file ?? '',
    record.message,
    record.line ?? '',
  ].join('\n');

  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
```

The hash tuple is `[code, file, message, startLine]` -- no `column`. This is
D-02's locked recipe, but it has a real, demonstrable collision: not every
extended-diagnostic message is parameterized with the offending expression
text. For example, `NULLISH_COALESCING_NOT_NULLABLE` (NG8102) always emits
the fixed string (verified in the installed
`@angular/compiler-cli@22.0.4` bundle,
`node_modules/@angular/compiler-cli/bundles/chunk-BZ7D2WUK.js:3263`):

> "The left side of this nullish coalescing operation does not include 'null'
> or 'undefined' in its type, therefore the '??' operator can be safely
> removed."

If a single template/expression line contains **two** occurrences of this
diagnostic (e.g. `a ?? b` and `c ?? d` on the same line, neither nullable),
both results get identical `code` + `file` + `message` + `line` -- and
therefore an **identical** `atcFingerprint/v1` hash, even though `results[]`
correctly contains both as separate entries (D-01 holds; only the
fingerprint's uniqueness guarantee is broken).

D-02's own stated rationale is "removes reliance on GitHub's best-effort
auto-populate" and calls the recipe "mandatory for the `/sarifs` API path" --
i.e. the fingerprint's job is to let GitHub track each result's identity
independently across commits. A same-fingerprint collision between two
distinct, simultaneously-reported findings undermines that guarantee: GitHub
Code Scanning (or any other SARIF consumer that dedupes/tracks by
`partialFingerprints`) may conflate the two into one tracked alert, or
mis-track one of them across subsequent commits when only one of the two
underlying issues is fixed.

**Fix:** append the already-computed `column` to the tuple (zero-cost,
still OS-invariant -- no absolute path, no cwd, no volatile field):

```ts
function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [
    record.code,
    record.file ?? '',
    record.message,
    record.line ?? '',
    record.column ?? '',
  ].join('\n');

  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
```

(Note this changes the fingerprint's bytes, so the golden snapshot in
`__snapshots__/sarif-report.spec.ts.snap` will need updating too. Since the
key is already versioned `atcFingerprint/v1` per D-02, either regenerate the
snapshot under the same version, or bump to `/v2` if the recipe is considered
a breaking format change -- the versioning was explicitly designed for this.)

## Minor

### MN-01: No test asserts `EXTENDED_DIAGNOSTIC_CATALOG.ngCode` values are pairwise distinct

**File:** `packages/angular-typechecker/src/core/extended-catalog.spec.ts:20-25`

**Issue:** The completeness spec asserts:
- one entry per `EXTENDED_DIAGNOSTIC_MEMBERS` member, in declaration order
  (guards the `member` field), and
- every `ngCode` is a positive integer (guards *shape*, not *value*
  collisions).

Nothing asserts the 18 `ngCode` values are unique. I independently
cross-checked all 18 against the real compiler-cli enum and they are
currently correct (see Summary), but the guard that would catch a *future*
transcription mistake (e.g. copy-pasting `8102` for two different members)
does not exist. `extended-catalog.drift.ts` (the type-level tripwire) only
guards the **member name** set against the real
`ExtendedTemplateDiagnosticName` enum -- by its own documented scope
("mutual set-equality of the extended-diagnostic member SET... does NOT pin
NG codes") it does not cover this. A duplicated `ngCode` would silently
produce two identical `id`s in `driver.rules[]`, which either violates
SARIF's implicit no-duplicate-rule-id expectation or causes a SARIF consumer
to misattribute one rule's `shortDescription`/`helpUri` to two different
diagnostic types -- with zero CI signal.

**Fix:**

```ts
it('assigns every rule a UNIQUE ngCode', () => {
  const ngCodes = EXTENDED_DIAGNOSTIC_CATALOG.map((entry) => entry.ngCode);

  expect(new Set(ngCodes).size).toBe(ngCodes.length);
});
```

## Nit

### NT-01: `fileUri` is checked truthily by `node-sarif-builder`, so a (currently unreachable) empty-string `record.file` would silently drop `artifactLocation` while still emitting `region`

**File:** `packages/angular-typechecker/src/core/sarif-report.ts:96-105`

**Issue:** The spread condition is `record.file !== null`, but the
third-party `SarifResultBuilder.initSimple` (`node_modules/node-sarif-builder/dist/lib/sarif-result-builder.js:20`)
guards `fileUri` with a **truthy** check (`if (options.fileUri) { ... }`),
not `!== undefined`. If `record.file` were ever an empty string (only
possible if `relativizePath`'s `path.relative(pathBase, absolutePath)`
returns `''`, i.e. the diagnostic's file path is exactly equal to
`pathBase` -- not reachable with a real `ts.SourceFile`, which is always a
file, never the project-root directory), the emitted location would carry a
`region` (since `startLine` is still set) but no `artifactLocation`, which is
an unusual/inconsistent physical-location shape. Not currently reachable;
flagging for awareness only, no action required unless `relativizePath`'s
contract changes.

### NT-02: Location inclusion is keyed on `record.file !== null`, not `record.line !== null`, even though the two null-checks in `diagnostic-record.ts` are independently computed

**File:** `packages/angular-typechecker/src/core/sarif-report.ts:96-105` (consumes `packages/angular-typechecker/src/core/diagnostic-record.ts:66-86,123-132`)

**Issue:** `diagnostic-record.ts`'s `fileOf` guards on
`diagnostic.file === undefined`, while `positionsOf` guards on
`diagnostic.file === undefined || diagnostic.start === undefined` -- two
separate conditions that happen to agree for every diagnostic-construction
path found in this codebase (`synthesizeFilelessError` sets `file`/`start`
together; the TypeScript compiler's own `createFileDiagnostic` /
`attachFileToDiagnostic` factories always pass `file` and `start` together
too, verified by reading `node_modules/typescript/lib/typescript.js`). Given
that, `sarif-report.ts` gating the `fileUri`/region spread on
`record.file !== null` is safe *today*. But the two guards are not
structurally coupled -- there is nothing that would fail loudly if a future
diagnostic source ever set `file` without `start` (or vice versa). In that
case the SARIF result would carry `fileUri` with every region field
`undefined` (harmless at runtime per the library's optional fields, but an
inconsistent shape). Low priority; consider gating on `record.line !== null`
instead (or documenting/asserting the file/position coupling in
`diagnostic-record.ts` itself) for defense in depth.

---

_Reviewed: 2026-07-18T13:15:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
