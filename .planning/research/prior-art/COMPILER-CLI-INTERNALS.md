# @angular/compiler-cli & @angular/compiler Internals -- Engine Improvement Findings

Scope: improve the CURRENT whole-program no-emit engine for
CORRECTNESS / COMPLETENESS / ROBUSTNESS / MAINTAINABILITY. Deferred FEATURES
(watch/incremental, reporters, CLI, generators, inference, Storybook, Jest) are OUT of
scope and NOT proposed.

This doc EXTENDS, and does not re-derive, two prior passes:
- `ENGINE-REFERENCE.md` -- the gatherer comparison (6 `api.Program` getters vs
  `@angular/build`'s per-file `getDiagnosticsForFile`; per-file fault isolation;
  `getGlobalDiagnostics` gap; `getNgStructuralDiagnostics` no-op; `suppressOutputPathCheck`).
- `SHIM-HARDENING.md` -- the `compiler-cli-types.ts` shim drift, the `EmitFlags.None=0`
  fabrication, the build-time drift-detection idiom.

Where this doc touches those topics it CONFIRMS/extends with new citations (the real
`EmitFlags` member set; the `ErrorCode` enum as an importable source of truth; the
`UNKNOWN_ERROR_CODE` *in `parsed.errors`* path) rather than repeating the analysis.

All citations verified at STABLE Angular **v22.0.4** via `git show v22.0.4:<path>` against
`D:\projects\github\angular\angular` (working tree `22.1.0-next.x`). Installed-typing
claims verified against `node_modules/@angular/compiler-cli@22.0.4` + `@angular/compiler@22.0.4`
under TS 6.0.3. Encoding-math claims verified empirically with `node -e`.

---

## performCompilation / readConfiguration flow

Source: `compiler-cli/src/perform_compile.ts` @ v22.0.4.

### `readConfiguration` (perform_compile.ts:74-185)

- **basePath / rootNames / options.** `calcProjectFileAndBasePath` (:62-72) resolves the
  project string: if it is a directory, `projectFile = join(dir, 'tsconfig.json')`, else the
  file itself; `basePath = resolve(projectDir)`. It then injects
  `existingCompilerOptions = { genDir: basePath, basePath, ...readAngularCompilerOptions(...),
  ...existingOptions }` (:137-142) and calls `ts.parseJsonConfigFileContent(config,
  parseConfigHost, basePath, existingCompilerOptions, configFileName)` (:145-156), whose
  `fileNames` become `rootNames`. **So `options.basePath` is ALWAYS injected as an absolute
  path** when the config read succeeds -- our `resolveFilterBasePath` fallback
  (`run-typecheck.ts:218-227`) is the defensive belt-and-suspenders for the failure branch.
- **Config errors structure.** Two distinct error shapes:
  1. **Config-file read error** (file missing/unreadable -- the `ts.readConfigFile` `error`):
     returns `{ project, errors: [error], rootNames: [], options: {}, emitFlags: Default }`
     (:124-131). Note `rootNames: []` -- so a missing tsconfig hits BOTH the `parsed.errors`
     fold AND our zero-rootNames guard. The guard would fire on the empty-rootNames, but the
     real config error is already in `parsed.errors` and we prepend it -- so the user sees the
     genuine read error, not just the synthesized guard. VALIDATED our fold-then-guard order
     is correct.
  2. **Outer-catch crash** (any throw inside `readConfiguration` -- e.g. a malformed extends
     chain, an exception in `parseJsonConfigFileContent`): returns a SINGLE diagnostic with
     `category: Error, code: api.UNKNOWN_ERROR_CODE (500), source: 'angular', file: undefined`
     in `errors`, and `project: ''` (:165-181). **THIS IS A GAP IN OUR ENGINE** -- see
     IMPROVEMENT #1. We fold `parsed.errors` verbatim (`run-typecheck.ts:110`) and only scan
     `result.diagnostics` from `performCompilation` for `UNKNOWN_ERROR_CODE`
     (`run-typecheck.ts:171-173`). A 500 that arrives via `parsed.errors` is therefore counted
     as a genuine type error (it lands in `errorCount`) instead of being re-thrown as
     `TypecheckInfrastructureError`.
- **`zero-rootNames` alignment.** ngc treats a references-only / empty config as
  `rootNames: []` and `parseJsonConfigFileContent` does NOT consult `projectReferences` to
  populate `fileNames` (Angular never type-checks via TS project references). Our guard
  (`run-typecheck.ts:117-130`, gating on `parsed.rootNames.length === 0`, NOT TS18003) is the
  right hook and matches how ngc structures the empty case. VALIDATED.
- **extends-chain handling (`readAngularCompilerOptions`, :81-122).** ngc walks the `extends`
  chain ITSELF for `angularCompilerOptions` (TS only merges `compilerOptions`, not
  `angularCompilerOptions`), reverse-reducing so right-most wins, and also reads
  `bazelOptions.angularCompilerOptions`. Because we pass the tsConfig path straight to
  `readConfiguration` (`run-typecheck.ts:105`), **we inherit this extends-merge for free** --
  we must NOT pre-parse the tsconfig ourselves or we would lose the Angular-options merge.
  VALIDATED (and a reason not to hand-roll config reading).
- **`useTsc`.** No `useTsc` option is read in `readConfiguration` at v22.0.4 (searched). Not a
  concern.

### `performCompilation` (perform_compile.ts:255-326)

- The outer `try` builds the host + program, runs `gatherDiagnostics(program!)`, and -- ONLY
  if `!hasErrors(allDiagnostics)` -- calls `program.emit({ emitFlags, ... })` (:296-305).
  **With our `noEmit: true` + any erroring program, `emit()` is never reached anyway**; and on
  a clean program `emit()` IS called but `emitFlags: 0` + `noEmit: true` make it a no-op emit
  (see EmitFlags section). The `program` is returned in BOTH the clean and the
  has-errors branch (:303 / :307).
- **`UNKNOWN_ERROR_CODE` outer catch (:308-323):** any throw escaping the try (createProgram
  crash, host failure, a throw from a getter that the gatherer did not catch) is swallowed into
  ONE diagnostic `{ category: Error, code: UNKNOWN_ERROR_CODE, file: undefined }` and
  `program = undefined`. **Note: this catch does NOT set `source: 'angular'`** (contrast the
  `readConfiguration` catch, which DOES). So our detect-by-`code`-only
  (`run-typecheck.ts:171-173`) is the CORRECT boundary for the `performCompilation` path -- a
  `source`-based check would miss it. VALIDATED our existing detection; but see #1 for the
  `parsed.errors` path it does not cover.
- `exitCodeFromResult` (perform_compile.ts:241-252) -- ngc's own verdict mapping, and a useful
  reference for ours: `0` if no diagnostics or no Error-category diagnostic; otherwise `2` if
  any diagnostic is `source === 'angular' && code === UNKNOWN_ERROR_CODE`, else `1`. So ngc
  reserves a DISTINCT non-zero exit (2) for infra failures. Our engine instead RE-THROWS infra
  failures as `TypecheckInfrastructureError` and lets the Phase-4 executor map them -- a cleaner
  separation (infra failure is not a "type-check verdict" at all). VALIDATED our approach; the
  `exitCodeFromResult` `source === 'angular'` clause is why we must ALSO handle the
  `readConfiguration` 500 (which carries `source: 'angular'`) -- see #1.

---

## Diagnostic formatting & NG guide-URL fidelity

### `formatDiagnostics` (perform_compile.ts:31-44)

```ts
const defaultFormatHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getCanonicalFileName: (fileName) => fileName,        // identity (the trap)
  getNewLine: () => ts.sys.newLine,
};
export function formatDiagnostics(diags, host = defaultFormatHost): string {
  return diags.map(d =>
    replaceTsWithNgInErrors(ts.formatDiagnosticsWithColorAndContext([d], host))
  ).join('');
}
```

- It ALWAYS calls `ts.formatDiagnosticsWithColorAndContext` (color + codeframe, never the plain
  `formatDiagnostics`). So template codeframes and related-information ARE emitted, and color
  is unconditional. Our `format-report.ts` already knows this: it strips ANSI as a separate
  post-step (`format-report.ts:11`, `ANSI_PATTERN`) and overrides the trap host
  (`makeFormatHost`, :92-108) -- non-identity `getCanonicalFileName`, deterministic
  `getCurrentDirectory`, forced `'\n'` newline. VALIDATED our formatting is a FAITHFUL superset
  of ngc's default (we fix two real defaults bugs ngc ships).
- `replaceTsWithNgInErrors` (diagnostics/src/util.ts:21-23) rewrites the formatted-string
  prefix `TS-99<digits>` -> `NG<digits>`. It operates on the RENDERED string, regex
  `/(\[\d+m ?)TS-99(\d+: ?\[\d+m)/g` -- and CRUCIALLY the regex requires the SGR
  color codes around the number (the `[...m` capture groups). **Our ANSI strip runs AFTER
  `formatDiagnostics` returns** (`format-report.ts:82`), and `formatDiagnostics` already applied
  `replaceTsWithNgInErrors` internally (:38), so the `NG` rewrite has already happened before we
  strip color -- the order is correct, no fidelity loss. VALIDATED.
- **Color-stripping caveat to confirm:** `replaceTsWithNgInErrors` ONLY matches when color codes
  surround the number. If a future code path produced a non-colored diagnostic, the `TS-99` ->
  `NG` rewrite would not fire and a raw `TS-998109` could leak. Since `formatDiagnostics` is
  hard-wired to the color-and-context formatter, this cannot happen in our path today (we always
  feed `formatDiagnostics`, which always colors before rewriting, then we strip). VALIDATED but
  noted as an Open Question if we ever bypass `formatDiagnostics`.

### `addMessageTextDetails` -- the NG guide-URL appender (compiler.ts:677-689)

```ts
private addMessageTextDetails(diagnostics) {
  return diagnostics.map(diag => {
    if (diag.code && COMPILER_ERRORS_WITH_GUIDES.has(ngErrorCode(diag.code))) {
      return { ...diag, messageText: diag.messageText +
        `. Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/NG${ngErrorCode(diag.code)}` };
    }
    return diag;
  });
}
```

- **Guide URL is baked into `messageText` BEFORE our engine ever sees the diagnostic.**
  `addMessageTextDetails` runs inside `NgCompiler.getDiagnostics()` (compiler.ts:608) and
  `getDiagnosticsForFile` (compiler.ts:638) -- both Angular-semantic paths we call. So our
  `getNgSemanticDiagnostics()` already returns diagnostics whose `messageText` carries the
  `. Find more at https://v22.angular.dev/errors/NG-99xxxx` suffix for the eight guided codes.
  We do NOT strip it (we pass `messageText` through `formatDiagnostics` untouched). VALIDATED:
  full NG guide-URL fidelity, for free.
- **`COMPILER_ERRORS_WITH_GUIDES`** (diagnostics/src/docs.ts:14-23) is a `Set` of EIGHT codes:
  `DECORATOR_ARG_NOT_LITERAL (1001)`, `IMPORT_CYCLE_DETECTED (3003)`, `PARAM_MISSING_TOKEN
  (2003)`, `SCHEMA_INVALID_ELEMENT (8001)`, `SCHEMA_INVALID_ATTRIBUTE (8002)`,
  `MISSING_REFERENCE_TARGET (8003)`, `COMPONENT_INVALID_SHADOW_DOM_SELECTOR (2009)`,
  `WARN_NGMODULE_ID_UNNECESSARY (6100)`. Note the membership test uses `ngErrorCode(diag.code)`
  -- i.e. it RE-encodes the diagnostic's *already-negative* `code` and looks up the 4-digit
  value... wait: the Set holds 4-digit `ErrorCode` values, but `diag.code` is already
  `-99xxxx`, so `ngErrorCode(diag.code)` = `parseInt('-99' + '-998001')` = a garbage value that
  would NEVER be in the Set. **This is an upstream subtlety we do NOT need to reproduce** (the
  enrichment already happened in the compiler); we only CONSUME the enriched `messageText`. No
  action -- flagged only so a future maintainer does not try to re-implement the guide-URL
  appender and trip on the double-encode.
- `ERROR_DETAILS_PAGE_BASE_URL` (diagnostics/src/error_details_base_url.ts) = `${DOC_PAGE_BASE_URL}/errors`,
  and `DOC_PAGE_BASE_URL` derives from `@angular/compiler`'s `VERSION.full`: `next` for
  pre-releases, else `v${major}`. So the guide URL is VERSION-PINNED to the consumer's installed
  Angular (e.g. `https://v22.angular.dev/errors/...`). This is the one concrete `@angular/compiler`
  coupling in our output -- see "@angular/compiler relevance". We surface it verbatim; correct.

**Fidelity verdict:** our two-file output layer (`format-report.ts` + `render-report.ts`)
preserves NG codes, guide URLs, related-information, and template codeframes; it deterministically
fixes ngc's two default-host bugs; and it controls color. No fidelity gap found for file-bearing
diagnostics. One file-LESS nuance: `formatDiagnosticsWithColorAndContext` renders a file-less
diagnostic (our zero-rootNames guard, config errors, the 500) as a bare message line with the
code -- which is correct and what we want.

---

## NG error-code infrastructure

Source of truth: `compiler-cli/src/ngtsc/diagnostics/` @ v22.0.4, **and these are EXPORTED from
the public `@angular/compiler-cli` barrel** -- verified `index.d.ts:30`:
`export { isLocalCompilationDiagnostics, ErrorCode, ngErrorCode } from './src/ngtsc/diagnostics'`.

- **`ErrorCode` enum** (diagnostics/src/error_code.ts) -- the authoritative catalog. The NG8xxx
  extended/template codes our engine cares about: `SCHEMA_INVALID_ELEMENT=8001`,
  `INVALID_BANANA_IN_BOX=8101`, `NULLISH_COALESCING_NOT_NULLABLE=8102`,
  `INTERPOLATED_SIGNAL_NOT_INVOKED=8109`, `UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION=8117`, etc.
  (8001-8118 at v22.0.4). Our `diagnostic-codes.ts` only hard-references 8001/8101/8109/8117 in
  its JSDoc examples; the `NG()`/`ngCodeOf()` helpers are generic over any 4-digit code, so we do
  not maintain a literal catalog that could drift. GOOD design.
- **`ngErrorCode(code) = parseInt('-99' + code)`** (diagnostics/src/util.ts:25). Our
  `NG(code) = -990000 - code` (`diagnostic-codes.ts:39`) and `ngCodeOf(code) = Math.abs(code) -
  990000` (:50). **Verified empirically that the two formulas AGREE for every 4-digit code:**
  `NG(8109) === parseInt('-998109') === -998109`; `NG(8024) === -998024`; round-trip
  `ngCodeOf(-998109) === 8109`. VALIDATED our encoding matches the source of truth for the
  4-digit range -- which is the only range we surface.
- **Two encoding corner cases (confirmed by `node -e`), neither a current miss but both worth a
  note:**
  1. `CONFLICTING_HOST_DIRECTIVE_BINDING = -8024` is stored NEGATIVE *in the enum itself*
     (error_code.ts). `ngErrorCode(-8024) = parseInt('-99-8024') = -99` (parseInt halts at the
     embedded `-`), whereas `NG(-8024) = -981976`. The compiler emits `-99` as that diagnostic's
     `ts.Diagnostic.code`. We never model this code, so no miss -- but our `NG()` would compute a
     wrong value if ever handed `-8024`. (This is a single pathological upstream value.)
  2. 5-digit codes `10001/10002/11001/11003` ("categories other than Error" -- LS-only /
     local-compilation, comment at error_code.ts ~ the `10XXX` reservation). `ngErrorCode(10001)
     = -9910001` but `NG(10001) = -1000001`. Our JSDoc precondition already documents the
     4-digit-only constraint. These codes never appear in our whole-program no-emit path, so no
     miss; our helper would mis-encode them if misused.
- The drift-detection unit proposed in SHIM-HARDENING could ALSO pin `ngErrorCode` behavior:
  since the real `ngErrorCode` + `ErrorCode` are importable under classic-node resolution, a
  drift test could assert `NG(8109) === ng.ngErrorCode(8109)` for the codes we model -- turning
  our hand-rolled encoding into a verified mirror rather than a parallel re-implementation. See
  IMPROVEMENT #5.

---

## Extended (NG8xxx) diagnostic severity gating

Source: `compiler-cli/src/ngtsc/typecheck/extended/src/extended_template_checker.ts` +
`compiler-cli/src/ngtsc/core/src/compiler.ts` @ v22.0.4.

### How severity is computed (the full interaction)

1. **`strictTemplates` is the master gate.** `runAdditionalChecks` only invokes the
   `extendedTemplateChecker` when `this.strictTemplates && extendedTemplateChecker !== null`
   (compiler.ts:1281). `strictTemplates` getter = `this.options.strictTemplates !== false`
   (compiler.ts:1055-1056) -- i.e. DEFAULT-ON unless explicitly `false`. With `strictTemplates`
   off, extended checks are NOT run at all (zero NG8xxx).
2. **Per-check category resolution** (extended_template_checker.ts:38-46), for EACH check factory:
   ```
   category = diagnosticLabelToCategory(
     options.extendedDiagnostics?.checks?.[factory.name]   // (1) per-check override
     ?? options.extendedDiagnostics?.defaultCategory       // (2) project default
     ?? DiagnosticCategoryLabel.Warning                    // (3) hard default
   )
   ```
   Precedence: per-check label > `defaultCategory` > `Warning`.
3. **`Suppress` removes the diagnostic entirely.** `diagnosticLabelToCategory`
   (:113-122): `Warning -> ts.DiagnosticCategory.Warning`, `Error -> Error`, `Suppress -> null`.
   A `null` category makes the constructor `continue` and NOT register the check
   (:47-49) -- so a suppressed check produces ZERO diagnostics (not a hidden Warning).
4. The resolved `ts.DiagnosticCategory` is baked into each emitted diagnostic via
   `makeTemplateDiagnostic(component, span, category, check.code, message, relatedInfo)`
   (:91-100). **So by the time a diagnostic reaches our engine, its `category` already encodes
   the consumer's configured severity.**
5. Config sanity is enforced separately (`verifyCompatibleTypeCheckOptions`, compiler.ts:1773+):
   `extendedDiagnostics` with `strictTemplates: false` -> `CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES`
   (Error); unknown `defaultCategory` label -> `CONFIG_..._UNKNOWN_CATEGORY_LABEL`; unknown check
   name -> `CONFIG_..._UNKNOWN_CHECK`. These are `getNgOptionDiagnostics()`-surfaced config errors
   we ALREADY gather (gather-diagnostics.ts:21).

### Verdict vs our engine

Our engine spreads `parsed.options` verbatim (`run-typecheck.ts:140`), so `strictTemplates`,
`extendedDiagnostics.defaultCategory`, and `extendedDiagnostics.checks[...]` all flow through
untouched -- we NEVER force `strictTemplates: true` (which would invent diagnostics the build
would not report) and never inject a `defaultCategory`. `finalize` buckets by
`ts.DiagnosticCategory` (run-typecheck.ts:322-327), and `evaluateResult` reads those counts
(evaluate-result.ts:44-55). A consumer's `defaultCategory: "error"` therefore lands a promoted
NG8xxx in `errorCount` and fails the verdict; `"suppress"` drops it before we ever see it;
`"warning"` lands it in `warningCount` gated by `maxWarnings`. VALIDATED end-to-end: our
verdict is FAITHFUL to the consumer-configured severity, and we neither suppress nor force a
category. No change.

---

## EmitFlags real values

CONFIRMED at v22.0.4 -- `compiler-cli/src/transformers/api.ts:129-138` (source) and
`node_modules/@angular/compiler-cli/src/transformers/api.d.ts:74-82` (installed typing):

```
DTS = 1<<0 (1), JS = 1<<1 (2), Metadata = 1<<2 (4), I18nBundle = 1<<3 (8),
Codegen = 1<<4 (16), Default = DTS|JS|Codegen = 19, All = DTS|JS|Metadata|I18nBundle|Codegen = 31
```

- **The real enum has SEVEN members, NO `None`.** This CONFIRMS the SHIM-HARDENING finding that
  our `EmitFlags { None = 0 }` (`compiler-cli-types.ts:89-91`) is a fabricated name. **Correction
  to the SHIM-HARDENING table:** that doc listed six members
  (`DTS=1, JS=2, Metadata=4, Codegen=16, Default=19, All=31`) and OMITTED `I18nBundle = 1<<3 = 8`.
  The real set is the seven above. Minor, but the drift unit's enum-pin should account for it.
- **Is `emitFlags: 0` safe?** YES. `0` is not equal to any named flag and not a documented
  member, but `performCompilation` only USES `emitFlags` inside `program.emit({ emitFlags })`
  (perform_compile.ts:300), and `emit` is reached ONLY on a clean (`!hasErrors`) program; even
  then, `noEmit: true` short-circuits TS's emit to a no-op. So `emitFlags: 0` is a valid
  "no emit-flags" bitmask and, paired with `noEmit: true`, is doubly inert. The
  `run-typecheck.ts:160-163` comment ("emitFlags: 0 is the suppressor when i18n is involved")
  is consistent with `I18nBundle = 8` being a real bit that `0` deliberately excludes. VALIDATED
  -- `0` is correct and meaningful; no need for a named flag. (The only fix is cosmetic: rename
  the fabricated `None` per SHIM-HARDENING #5 / our #6 below.)

---

## @angular/compiler relevance

Honest scoping: **`@angular/compiler` is almost entirely irrelevant to our whole-program
type-checker, with ONE real coupling.**

- Verified the installed `@angular/compiler@22.0.4` public surface
  (`node_modules/@angular/compiler/types/compiler.d.ts`): it exports `ParseError` (:323),
  `ParseSourceSpan` (:288), `Version` (:2356), `VERSION` (:6118) -- the template-PARSER and
  source-span machinery plus the version constant. It does **NOT** export `ErrorCode`,
  `ngErrorCode`, or `COMPILER_ERRORS_WITH_GUIDES` (those are exclusively in
  `@angular/compiler-cli`'s `ngtsc/diagnostics`). Verified by absence.
- `ParseError` / `ParseSourceSpan` are consumed INTERNALLY by ngtsc to build template
  `ts.Diagnostic`s (the codeframe spans) -- our engine never imports or reproduces them; we only
  receive finished `ts.Diagnostic`s. No source-of-truth coupling.
- **The one real coupling: `VERSION`.** `@angular/compiler`'s `VERSION.full`
  (`compiler/src/version.ts`, `0.0.0-PLACEHOLDER` at source, substituted at publish) drives the
  guide-URL host (`DOC_PAGE_BASE_URL` -> `v22.angular.dev` vs `next.angular.dev`). That URL ends
  up in `messageText` via `addMessageTextDetails`. We surface it verbatim and correctly; we do
  NOT recompute it. So even this coupling is "consume, don't reproduce."
- Our `diagnostic-codes.ts` catalog reproduces the `ngErrorCode` ENCODING, whose source of truth
  is `@angular/compiler-cli` (NOT `@angular/compiler`). So the drift concern lives entirely on
  the compiler-cli side (see #5), and `@angular/compiler` adds nothing our engine needs to track.

**Conclusion:** do not invest in mirroring any `@angular/compiler` surface. It is a transitive
engine dependency (template parsing + the version constant behind the guide URL), not a source
of truth our engine reproduces.

---

## CONCRETE IMPROVEMENTS FOR OUR ENGINE

Highest-value first. (Improvements about the gatherer per-file loop / global TS diagnostics /
`getNgStructuralDiagnostics` / `suppressOutputPathCheck` are owned by ENGINE-REFERENCE.md
#1-#4 and not duplicated here. The shim drift-unit / greppable markers / `EmitFlags.None` /
filter realpath try-catch are owned by SHIM-HARDENING.md #1-#8; #5/#6 below EXTEND those with
the new compiler-cli citations, they do not replace them.)

### 1. Detect `UNKNOWN_ERROR_CODE` in `parsed.errors`, not only in `result.diagnostics`
- **(a) Current:** we fold `parsed.errors` verbatim (`run-typecheck.ts:110`) and scan ONLY the
  `performCompilation` result for a 500 (`run-typecheck.ts:171-173`). A `readConfiguration`
  outer-catch crash returns its 500 in `parsed.errors` (`perform_compile.ts:165-181`, with
  `source: 'angular'`), so it is counted as a genuine type error in `errorCount` instead of
  being re-thrown as `TypecheckInfrastructureError`.
- **(b) Reference:** `readConfiguration` outer catch, `perform_compile.ts:165-181` @ v22.0.4
  (`code: api.UNKNOWN_ERROR_CODE, source: 'angular'`); ngc's own `exitCodeFromResult`
  (`perform_compile.ts:249-251`) treats `source === 'angular' && code === UNKNOWN_ERROR_CODE`
  as the distinct infra exit (2), proving Angular itself considers a config-path 500 an infra
  failure, not a type error.
- **(c) Change:** in `run-typecheck.ts`, after `const parsed = ng.readConfiguration(...)` and
  BEFORE the zero-rootNames guard, scan `parsed.errors` for `code === ng.UNKNOWN_ERROR_CODE`
  and, if found, throw `TypecheckInfrastructureError` (flatten its `messageText`) -- the same
  treatment we already give the `result.diagnostics` 500. Detect by `code` only (consistent
  with the existing check; the config-path 500 also carries `source: 'angular'` but code-only
  is sufficient and uniform).
- **(d) Classification:** `correctness` (an infra/config crash is mis-reported as a type error).
- **(e) Risk/output:** CHANGES output only when `readConfiguration` itself crashes (rare:
  malformed `extends`, a host throw). Today such a run reports `errorCount >= 1` with a 500
  diagnostic; after, it throws `TypecheckInfrastructureError` (executor maps to the infra
  failure path). Strictly more correct; no effect on normal runs. Low risk.
- **(f) Effort:** S.

### 2. (VALIDATED -- no change) Extended (NG8xxx) severity gating is faithful
- **(a) Current:** spread `parsed.options` verbatim; bucket by `ts.DiagnosticCategory`;
  `evaluateResult` reads counts (`run-typecheck.ts:140,322-327`; `evaluate-result.ts:44-55`).
- **(b) Reference:** per-check `checks[name] ?? defaultCategory ?? Warning`, `Suppress -> null`
  (drops the check), category baked into the diagnostic via `makeTemplateDiagnostic`
  (`extended_template_checker.ts:38-100`); master gate `this.strictTemplates`
  (`compiler.ts:1281`, `:1055-1056`).
- **(c) Change:** NONE. We must continue to NOT force `strictTemplates`/`defaultCategory`.
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** n/a. Documents that a consumer's `error`/`warning`/`suppress` config is
  honored end-to-end and our verdict respects it.
- **(f) Effort:** none.

### 3. (VALIDATED -- no change) NG guide-URL + codeframe + related-info fidelity is intact
- **(a) Current:** `format-report.ts` feeds `formatDiagnostics` (color-and-context), fixes the
  two default-host bugs, strips ANSI after the NG rewrite already ran.
- **(b) Reference:** `formatDiagnostics` always uses `formatDiagnosticsWithColorAndContext` +
  `replaceTsWithNgInErrors` (`perform_compile.ts:31-44`); guide URL pre-baked into `messageText`
  by `addMessageTextDetails` inside our gathered Angular path (`compiler.ts:608,638,677-689`).
- **(c) Change:** NONE.
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** n/a. (Open Question: only if we ever bypass `formatDiagnostics` would the
  color-dependent `TS-99 -> NG` rewrite risk leaking a raw `TS-99xxxx`.)
- **(f) Effort:** none.

### 4. (VALIDATED -- no change) `NG()`/`ngCodeOf()` encoding matches the source of truth (4-digit)
- **(a) Current:** `NG = -990000 - code`, `ngCodeOf = abs(code) - 990000`
  (`diagnostic-codes.ts:39,50`).
- **(b) Reference:** `ngErrorCode = parseInt('-99' + code)` (`diagnostics/src/util.ts:25`);
  verified equal for all 4-digit codes (the only range we surface).
- **(c) Change:** NONE to the helpers. (See #5 for turning the parallel implementation into a
  verified mirror.)
- **(d) Classification:** `none/validated`.
- **(e) Risk/output:** n/a. Corner cases (`-8024` enum value -> compiler emits `-99`; 5-digit
  10XXX/11XXX LS-only codes) are never surfaced by our path; our JSDoc already states the
  4-digit precondition.
- **(f) Effort:** none.

### 5. Fold `ngErrorCode`/`ErrorCode`/`UNKNOWN_ERROR_CODE` into the SHIM-HARDENING drift unit
- **(a) Current:** `diagnostic-codes.ts` re-implements the encoding; `compiler-cli-types.ts`
  hardcodes `UNKNOWN_ERROR_CODE = 500`. Both are parallel to upstream with no compile-time pin.
- **(b) Reference:** the public barrel EXPORTS `ngErrorCode` and `ErrorCode`
  (`@angular/compiler-cli/index.d.ts:30`), and `UNKNOWN_ERROR_CODE` is typed as a literal `500`
  (`api.d.ts:11`). All are importable under the classic-node resolution the SHIM-HARDENING
  drift unit already uses.
- **(c) Change:** in the planned `compiler-cli-types.drift.spec.ts` (SHIM-HARDENING #3), add:
  `expect(NG(8109)).toBe(ng.ngErrorCode(8109))` for the codes we model (a runtime mirror check);
  and a type-level pin `const _code: 500 = ng.UNKNOWN_ERROR_CODE`. This converts the encoding +
  the 500 literal from "trusted parallel constants" into "verified against the real exports."
- **(d) Classification:** `maintainability` (regression net for an Angular-version bump).
- **(e) Risk/output:** none (test/drift-unit only; no engine behavior change).
- **(f) Effort:** S (folds into the SHIM-HARDENING drift unit).

### 6. (Confirm + extend SHIM-HARDENING) Real `EmitFlags` has 7 members incl. `I18nBundle = 8`
- **(a) Current:** shim declares `EmitFlags { None = 0 }` (`compiler-cli-types.ts:89-91`); engine
  passes `0 as EmitFlags` (`run-typecheck.ts:163`).
- **(b) Reference:** real enum `DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19,
  All=31` (`api.ts:129-138` / installed `api.d.ts:74-82`). `emitFlags: 0` confirmed safe (only
  used by `program.emit`, gated by `!hasErrors` + neutralized by `noEmit:true`).
- **(c) Change:** as SHIM-HARDENING #5 -- either keep `None = 0` with a `// angular-typechecker:
  vendored -- NOT an upstream member; 0 = no-flags bitmask` marker, or declare the real subset.
  EXTENSION: when the drift unit pins the enum, include `I18nBundle` (the member the
  SHIM-HARDENING table omitted) so the pin reflects the true 7-member set.
- **(d) Classification:** `maintainability`.
- **(e) Risk/output:** none (type-only / comment).
- **(f) Effort:** S.

---

## Open questions

1. **#1 detection scope:** should we ALSO re-throw when a config-file READ error
   (`perform_compile.ts:124-131`, the `error` branch, NOT a 500) is present? No -- a genuine
   "cannot find/parse tsconfig" error is a legitimate user-facing diagnostic (the consumer
   pointed at a bad path), not an infra crash; we correctly surface it via the `parsed.errors`
   fold + zero-rootNames guard. Only the `code === UNKNOWN_ERROR_CODE` config-path crash should
   re-throw. Confirm with a fixture that points at a tsconfig with a circular/broken `extends`
   to see whether it surfaces as a normal config error or a 500.
2. **Color-dependent NG rewrite (RQ2):** the `replaceTsWithNgInErrors` regex requires SGR codes
   around the number. We never bypass `formatDiagnostics`, so this is safe today -- but if a
   future reporter renders diagnostics without color before the rewrite, a raw `TS-99xxxx` could
   leak. Lock with a spec asserting no `TS-99` substring survives in our `color:false` output.
3. **`next.x` ErrorCode drift:** confirmed the working tree adds NG8025-8029+ (foreign-component
   `@content` codes) beyond v22.0.4. Our generic `NG()` helper is unaffected (no literal
   catalog), but the drift unit (#5) should re-run against new typings at each Angular bump --
   this is the regression net for newly-added codes.
4. **`exitCodeFromResult` as a verdict reference:** we deliberately re-throw infra failures
   rather than mapping to exit 2. Confirm the Phase-4 executor's infra-failure exit code is
   distinct from its type-error exit code (mirroring ngc's 2-vs-1), so CI/agents can tell an
   infra crash apart from a real type error -- a faithful parallel to `exitCodeFromResult`.
