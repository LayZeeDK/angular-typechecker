---
phase: 30-reporter-seam-json-reporter-format-threading-observability
plan: 03
subsystem: api
tags: [cli, parseArgs, format-threading, nx-executor, angular-cli-builder, schema-parity, allowNegative, exit-code-parity, quiet, color, drift-lock]

# Dependency graph
requires:
  - phase: 30-02 (reporter seam + JSON reporter)
    provides: "the widened renderReport(result, { format?, maxWarnings?, strict?, ... }) seam (optional format default human, json->formatJsonReport, sarif throws Phase 31)"
  - phase: 26 (standalone CLI, archived-in-milestone)
    provides: "parse-args.ts (util.parseArgs -> discriminated ParseResult, --max-warnings enum-guard idiom, HELP_TEXT), main.ts (colorFromEnv NO_COLOR>FORCE_COLOR>TTY, the compose), the vi.hoisted main.spec harness"
  - phase: 21 (Angular CLI builder, archived-in-milestone)
    provides: "both schema-parity.spec.ts drift-locks; builder.ts = convertNxExecutor(typecheckExecutor); TypecheckExecutorOptions as the shared executor+builder options interface"
provides:
  - "the --format <human|json|sarif> / --quiet / --color / --no-color CLI flags on parse-args.ts (+ ParsedOptions fields, HELP_TEXT rows, enum usageError, allowNegative:true for --no-color)"
  - "main.ts threading: parsed.color ?? colorFromEnv(env) (flag wins, D-10); emitAdvisoryNotices gated on !parsed.quiet (D-09); format/maxWarnings/strict forwarded into renderReport"
  - "the format enum (human|json|sarif, default human) on the executor AND builder schema.json + TypecheckExecutorOptions.format?; normalize-options defaults it; executor.ts forwards it into renderReport"
  - "both schema-parity EXPECTED_KEYS include 'format' + an enum/default assertion; VER-01 exit-code-parity / --quiet / --color specs in main.spec.ts + parse-args.spec.ts"
affects: [31 SARIF reporter (the 'sarif' enum member is already threaded through all three adapters; only its renderer is deferred), 32 additive-only git-diff audit + README ## Machine-readable output prose (DOC-01)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE --format enum threaded IDENTICALLY through all three adapters (standalone CLI, Nx executor, Angular CLI builder) over the single widened renderReport seam"
    - "node:util parseArgs allowNegative:true for --no-color under strict mode (Node 22.4.0+, engines floor 22.22.3)"
    - "enum validation mirroring the shipped --max-warnings guard: an out-of-enum value is a usageError (exit 2), never a silent fallback"
    - "the verdict/exit code stays owned by evaluateResult/toExitCode across formats; the format only selects the reporter, never the verdict (FMT-02/D-07)"
    - "--quiet gates the stderr advisory chatter ONLY (the never-silent charter, D-09); machine formats stay plain regardless of --color/FORCE_COLOR (D-10)"

key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/cli/parse-args.ts
    - packages/angular-typechecker/src/cli/main.ts
    - packages/angular-typechecker/src/cli/parse-args.spec.ts
    - packages/angular-typechecker/src/cli/main.spec.ts
    - packages/angular-typechecker/src/executors/typecheck/schema.json
    - packages/angular-typechecker/src/executors/typecheck/schema.d.ts
    - packages/angular-typechecker/src/executors/typecheck/normalize-options.ts
    - packages/angular-typechecker/src/executors/typecheck/executor.ts
    - packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts
    - packages/angular-typechecker/src/builders/typecheck/schema.json
    - packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts
    - packages/angular-typechecker/README.md

key-decisions:
  - "ParsedOptions.format + TypecheckExecutorOptions.format + NormalizedOptions.format all use the inline 'human' | 'json' | 'sarif' literal union (NOT an import of ReportFormat) -- matches the shipped adapter pattern (executor already uses inline literals) and keeps parse-args nx-free / import-boundary-clean; structurally identical to ReportFormat so threading into renderReport type-checks"
  - "enum validation via a plain array .includes guard + a safe cast in the return (the guard rejects everything non-member; undefined defaults to 'human') -- mirrors the shipped --max-warnings guard idiom rather than adding a type-guard helper"
  - "both schema-parity specs assert the format ENUM MEMBERS + the default (not just the default the plan required) -- the enum is the public --format contract Phase 31/32 depend on; added enum?: readonly string[] to each spec's SchemaProperty interface"
  - "a lastFormat() wiring guard in main.spec.ts proves --format actually threads into renderReport (default human) -- without it the stubbed renderReport would let a dropped thread pass the exit-parity tests silently"

patterns-established:
  - "Single-enum three-adapter threading over one render seam (CLI + executor + builder), verdict-owner untouched"
  - "allowNegative:true --no-color under strict parseArgs"
  - "Explicit-flag-wins-over-env color override layered above the shipped colorFromEnv precedence, human-path only"

requirements-completed: [FMT-01, FMT-03, CLIX-02, VER-01]

coverage:
  - id: D1
    description: "FMT-01: --format <human|json|sarif> (default human) parses on the CLI, is a format schema option on the executor + builder, both schema-parity EXPECTED_KEYS include 'format', and an out-of-enum --format is a usageError"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/parse-args.spec.ts#--format / --quiet / --color / --no-color > parses --format human|json|sarif to that value; rejects an out-of-enum --format"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts#declares exactly the TypecheckExecutorOptions properties; declares format as a human|json|sarif enum defaulting to human"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts#declares exactly the TypecheckExecutorOptions properties; declares format as a human|json|sarif enum defaulting to human"
        status: pass
    human_judgment: false
  - id: D2
    description: "FMT-02/D-07: the exit code is IDENTICAL across --format human and --format json for the same stubbed CoreResult, including the coverage-incomplete errorCount===0 / success===false case (evaluateResult stays the sole verdict owner)"
    requirement: VER-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/main.spec.ts#FMT-02 / D-07: exit-code parity across --format human and --format json > yields the IDENTICAL exit code ...; keeps the coverage-incomplete anti-false-pass (errorCount 0, success false -> 1) under BOTH formats"
        status: pass
    human_judgment: false
  - id: D3
    description: "FMT-03/D-08: the machine format is threaded into renderReport (format/maxWarnings/strict) from the CLI AND the executor (and the builder via convertNxExecutor); the machine payload never colorizes (json branch ignores color)"
    requirement: FMT-03
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/main.spec.ts#FMT-02 / D-07 ... > threads the selected --format into renderReport, defaulting to human (wiring guard)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/executors/typecheck/executor.spec.ts (executor forwards renderReport output to stdout; format forwarded via normalizeOptions destructure) + nx typecheck (renderReport required-shape)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CLIX-02/D-09: --quiet gates emitAdvisoryNotices ONLY -- the stderr advisory is removed while the stdout payload and the exit code are unchanged"
    requirement: CLIX-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/main.spec.ts#CLI-03: stdout/stderr routing > CLIX-02 / D-09: --quiet silences the stderr advisory ONLY -- stdout payload + exit code unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "CLIX-02/D-10: --color/--no-color win over NO_COLOR > FORCE_COLOR > TTY (human path only); --no-color parses via parseArgs allowNegative:true"
    requirement: CLIX-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/main.spec.ts#ARGS-05: color precedence > --no-color wins over FORCE_COLOR=1; --color wins over NO_COLOR"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/cli/parse-args.spec.ts#--format / --quiet / --color / --no-color > parses --color to true and --no-color to false (allowNegative)"
        status: pass
    human_judgment: false
  - id: D6
    description: "FMT-01/VER-01: adding the flags to HELP_TEXT keeps the standalone-cli-docs drift-lock green because the README ### Options table gains a row per new flag"
    requirement: VER-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/standalone-cli-docs.spec.ts#documents in the README every long-form flag the live --help prints (additions self-enforce)"
        status: pass
    human_judgment: false
  - id: D7
    description: "builder.ts stays byte-unchanged (inherits format via convertNxExecutor); the barrel + index.drift.ts are untouched (additive-only charter holds)"
    requirement: FMT-01
    verification:
      - kind: other
        ref: "git diff --exit-code -- packages/angular-typechecker/src/builders/typecheck/builder.ts (clean); nx typecheck (tsconfig.drift.json compiles)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-18
status: complete
---

# Phase 30 Plan 03: `--format`/`--quiet`/`--color` threaded through all three adapters Summary

**One `--format <human|json|sarif>` enum (+ `--quiet`, `--color`/`--no-color`) threaded identically through the standalone CLI, the Nx executor, and the Angular CLI builder over the single widened `renderReport` seam -- exit code identical across formats (incl. coverage-incomplete), `--quiet` silences stderr chatter only, `--color`/`--no-color` win over env, and `builder.ts` stays byte-unchanged.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-18T03:56:49Z
- **Completed:** 2026-07-18T04:12:03Z
- **Tasks:** 3
- **Files modified:** 12 (all modified; 0 created)

## Accomplishments
- **Standalone CLI (`parse-args.ts` + `main.ts`):** registered `--format` (enum-validated -> `usageError` on an out-of-enum value, mirroring the `--max-warnings` guard), `--quiet`, `--color`, and `--no-color` (the last via `allowNegative: true` -- required under strict `parseArgs`, Node 22.4.0+, engines floor 22.22.3). Added `format`/`quiet`/`color?` to `ParsedOptions` and four rows to `HELP_TEXT`. `main.ts` now: `parsed.color ?? colorFromEnv(env)` so the flag WINS over `NO_COLOR > FORCE_COLOR > TTY` (D-10, human path only); gates `emitAdvisoryNotices` on `!parsed.quiet` (D-09 -- stderr chatter only); and forwards `format`/`maxWarnings`/`strict` into `renderReport`. The exit-code compose (`evaluateResult(...).success`) is UNTOUCHED.
- **Nx executor + Angular CLI builder:** identical `format` enum (`human|json|sarif`, default `human`) on both `schema.json` files; `TypecheckExecutorOptions.format?`; `NormalizedOptions.format` defaulted to `'human'`; `executor.ts` destructures and forwards `format`/`maxWarnings`/`strict` into `renderReport` -- so `--format json` takes effect from the Nx executor AND (via `convertNxExecutor`) the builder. **`builder.ts` is byte-unchanged** (`git diff --exit-code` clean).
- **Drift-locks:** both `schema-parity.spec.ts` gained `'format'` in `EXPECTED_KEYS` (the builder's `satisfies` + `AssertAssignable` reverse-probe forces it at type-check time once `format?` is on `TypecheckExecutorOptions`) plus an enum-members + default assertion; the README `### Options` table gained one row per new flag so `standalone-cli-docs.spec.ts` (derives flags from `HELP_TEXT`, asserts README parity) stays green.
- **VER-01 unit slices (`main.spec.ts` + `parse-args.spec.ts`):** exit-code PARITY across `--format human`/`json` (incl. the coverage-incomplete `errorCount===0`/`success===false` -> exit 1 under BOTH formats); `--quiet` removes the stderr advisory while the stdout payload + exit code are unchanged; `--color`/`--no-color` override `NO_COLOR`/`FORCE_COLOR`; a `lastFormat()` wiring guard proving `--format` threads into `renderReport` (default `human`). `renderReport` stays a bare `vi.fn()` so `.mock.calls` args stay `any[]` (Pitfall 8).
- **Additive-only held:** the `index.ts` barrel and `index.drift.ts` are byte-unchanged (verified via `nx typecheck` running `tsconfig.drift.json`); with `--format` omitted the human path is byte-identical to v0.2.2 (the shipped callers already compiled unchanged after 30-02's optional-format seam).

## Task Commits

Each task was committed atomically (all `type="auto"`; the repo has no pre-commit test gate but hooks stayed ON, never `--no-verify`):

1. **Task 1: thread --format/--quiet/--color through the standalone CLI + README rows** - `f926d2a` (feat)
2. **Task 2: add the format schema option to the executor + builder and forward it** - `d51b404` (feat)
3. **Task 3: VER-01 exit-code parity + --quiet/--color unit specs** - `a62667f` (test)

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md -- final `docs` commit.

## Files Created/Modified
- `packages/angular-typechecker/src/cli/parse-args.ts` - `--format`/`--quiet`/`--color`/`--no-color` registration + `allowNegative:true` + enum guard; `format`/`quiet`/`color?` on `ParsedOptions`; four `HELP_TEXT` rows.
- `packages/angular-typechecker/src/cli/main.ts` - color-flag-over-env (D-10); `--quiet` gate on `emitAdvisoryNotices` (D-09); `format`/`maxWarnings`/`strict` threaded into `renderReport`; exit compose untouched.
- `packages/angular-typechecker/src/cli/parse-args.spec.ts` - enum accept/reject + `--color`/`--no-color` allowNegative parsing + defaults.
- `packages/angular-typechecker/src/cli/main.spec.ts` - exit-code parity (incl. coverage-incomplete), `--quiet`-gates-stderr-only, `--color`/`--no-color` override, `lastFormat()` wiring guard.
- `packages/angular-typechecker/src/executors/typecheck/schema.json` - `format` enum property (default `human`).
- `packages/angular-typechecker/src/executors/typecheck/schema.d.ts` - `TypecheckExecutorOptions.format?`.
- `packages/angular-typechecker/src/executors/typecheck/normalize-options.ts` - `NormalizedOptions.format` + `options.format ?? 'human'` default.
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` - destructure + forward `format`/`maxWarnings`/`strict` into `renderReport`.
- `packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts` - `'format'` in `EXPECTED_KEYS` + enum/default assertion + `enum?` on `SchemaProperty`.
- `packages/angular-typechecker/src/builders/typecheck/schema.json` - identical `format` enum property.
- `packages/angular-typechecker/src/builders/typecheck/schema-parity.spec.ts` - `'format'` in `EXPECTED_KEYS` (type-forced) + enum/default assertion + `enum?` on `SchemaProperty`.
- `packages/angular-typechecker/README.md` - four `### Options` table rows (`--format`, `--quiet`, `--color`, `--no-color`); full `## Machine-readable output` prose deferred to Phase 32 (DOC-01).

## Decisions Made
- **Inline `'human' | 'json' | 'sarif'` literal union everywhere** (`ParsedOptions.format`, `TypecheckExecutorOptions.format`, `NormalizedOptions.format`) rather than importing `ReportFormat` -- matches the shipped adapter pattern (the executor options interface already uses inline literals), keeps `parse-args.ts` nx-free / import-boundary-clean, and is structurally identical to `ReportFormat` so threading into `renderReport` type-checks with zero coupling.
- **Enum validation via a plain `['human','json','sarif'].includes` guard + a safe cast in the return** (the guard rejects every non-member; `undefined` defaults to `'human'`) -- mirrors the shipped `--max-warnings` guard idiom rather than adding a type-guard helper for a three-member enum.
- **Both schema-parity specs assert the enum MEMBERS + the default** (beyond the plan's minimum default-value assertion) -- the enum is the public `--format` contract Phase 31 (SARIF) and Phase 32 (additive audit) depend on; added `enum?: readonly string[]` to each spec's `SchemaProperty` interface to type the assertion.
- **A `lastFormat()` wiring guard in `main.spec.ts`** -- because `renderReport` is a stub, the exit-parity tests alone could pass even if the format thread were dropped; the wiring guard proves `--format json` reaches `renderReport` and the default resolves to `human`.

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed as specified, each green on the first gate run. Routine `prettier --write` was applied to the README (table re-alignment after adding rows) and `main.spec.ts` (whitespace) to satisfy `nx format:check` -- standard formatting normalization, not a behavioral change.

## Issues Encountered
None. The `allowNegative` type surfaced correctly under the repo's `@types/node` (no TS error), and `color: values.color` (a `boolean | undefined` assigned to the optional `color?` field) type-checked cleanly -- confirming `exactOptionalPropertyTypes` is not enabled (the shipped `maxWarnings?` shorthand assignment already proved this).

## Known Stubs
None new. The `renderReport` `sarif` case still throws "SARIF reporter lands in Phase 31" BY DESIGN (from 30-02) -- the `'sarif'` enum member is now a valid, threaded `--format` value across all three adapters (CLI parse + both schemas accept it), but its RENDERER is deliberately deferred to Phase 31 (D-12). `--format json` and `--format human` are wired end-to-end.

## Threat Flags
None. This plan introduces no new network endpoint, auth path, or file-access pattern. The two threats in the plan's `<threat_model>` are both mitigated and spec-asserted: T-30-07 (false-pass across formats) -- the exit code is IDENTICAL across `human`/`json` incl. the coverage-incomplete case, and `evaluateResult`/`toExitCode` stay the sole verdict owners (the exit compose is untouched); T-30-08 (`--quiet` information suppression) -- `--quiet` gates the stderr advisory chatter only, with the payload + exit code asserted unchanged.

## Next Phase Readiness
- **Phase 31 (SARIF):** the `'sarif'` enum member is already accepted + threaded through all three adapters; replace the `renderReport` `sarif` throw with `await import('./sarif-report')` and reuse `core/diagnostic-record.ts` (30-02's shared projection). No adapter re-plumbing needed -- the `--format sarif` path already reaches `renderReport`.
- **Phase 32 (additive audit + docs):** the additive-only charter holds (barrel + `index.drift.ts` byte-unchanged; `builder.ts` byte-unchanged; human output byte-identical with `--format` omitted). The full `## Machine-readable output` README prose (DOC-01) is the remaining doc gap; the `### Options` flag rows are already in place.
- Requirements FMT-01/FMT-03/CLIX-02/VER-01 left Pending in REQUIREMENTS.md per the project's documented convention (closed at phase verification; 30-01/30-02 likewise).
- All gates green: `nx test` 496, `nx integration` 120, `nx typecheck` (spec + drift + tools), `nx lint` (maxWarnings:0), `nx format:check`.

## Self-Check: PASSED
- SUMMARY file exists: `30-03-SUMMARY.md`.
- Commits exist in `git log`: `f926d2a` (Task 1), `d51b404` (Task 2), `a62667f` (Task 3).
- Modified files present: `parse-args.ts`, `main.ts`, `executor.ts`, both `schema.json`, both `schema-parity.spec.ts`, `normalize-options.ts`, `schema.d.ts`, both CLI spec files, `README.md`.
- Acceptance grep confirmations: `allowNegative` in parse-args (present); `parsed.color ?? colorFromEnv` in main.ts (present); `if (!parsed.quiet)` in main.ts (present).
- `builder.ts` byte-unchanged across the wave (`git diff --exit-code` clean); additive-only held (barrel + `index.drift.ts` untouched, `nx typecheck` green).

---
*Phase: 30-reporter-seam-json-reporter-format-threading-observability*
*Completed: 2026-07-18*
