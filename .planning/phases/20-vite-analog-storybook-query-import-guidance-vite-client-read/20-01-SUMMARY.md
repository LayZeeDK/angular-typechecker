---
phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read
plan: 01
subsystem: testing
tags:
  [
    typescript,
    angular-compiler-cli,
    vitest,
    vite,
    ts2307,
    diagnostics,
    bundler-query,
    advisory,
  ]

# Dependency graph
requires:
  - phase: 18-not-type-checked-declared-advisory
    provides: the pure-detector -> additive-CoreResult-field -> executor-logger.warn triad (detectUncheckedDeclaredFiles / notTypeCheckedDeclaredFiles) that this plan clones
  - phase: 16-storybook-gate-spike
    provides: spikes 009 (the vite/client consumer fix, radix 227 -> 0) + 010 (the diagnostic detector, VALIDATED) that fully specify this feature
provides:
  - "pure detectBundlerQueryImports(ts, diagnostics): readonly string[] over the KEPT diagnostic set"
  - "additive CoreResult.bundlerQueryImports?: readonly string[] ([] -> undefined), fed from the single finalize seam"
  - "verdict-neutrality tripwire (D-05) locking the field out of evaluateResult"
  - "hermetic fixtures/vite-query-imports/ (baseline + vite/client legs) + a real-compiler integration proof"
affects:
  - 20-02 (executor render warnBundlerQueryImports reads CoreResult.bundlerQueryImports)
  - 20-03 (README Signal 1 cross-references the bundlerQueryImports field)

# Tech tracking
tech-stack:
  added: [] # no new runtime or dev dependencies -- vite@8.1.0 already a root devDependency
  patterns:
    - "diagnostic-derived pure detector at the single finalize seam (no walk threading), scanning the POST-filter kept set (Pitfall 1) -- distinct from the config-derived notTypeCheckedDeclaredFiles that threads through walk-references"
    - "direct-leaf spike-009 fixture shape: one tsconfig.base.json (types: []) + a baseline leg + a vite/client leg over shared story sources"

key-files:
  created:
    - packages/angular-typechecker/src/core/detect-bundler-query-imports.ts
    - packages/angular-typechecker/src/core/detect-bundler-query-imports.spec.ts
    - packages/angular-typechecker/src/core/bundler-query-imports.integration.spec.ts
    - fixtures/vite-query-imports/tsconfig.base.json
    - fixtures/vite-query-imports/tsconfig.baseline.json
    - fixtures/vite-query-imports/tsconfig.vite-client.json
    - fixtures/vite-query-imports/src/widget.stories.ts
    - fixtures/vite-query-imports/src/snippet.md
    - fixtures/vite-query-imports/src/icon.svg
    - fixtures/vite-query-imports/src/worklet.ts
    - fixtures/vite-query-imports/src/extra.ts
  modified:
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/evaluate-result.spec.ts

key-decisions:
  - "Detector scans the POST-filter kept set `reported`, NOT the pre-filter `diagnostics` arg (Pitfall 1); a code comment warns a future refactor NOT to unify it with templateCheckAborted"
  - "code === 2307 gate runs FIRST (Pitfall 2: 2732/2792 share the 'Cannot find module' prefix)"
  - "field name bundlerQueryImports; plain string[] (dropped spike 010's KNOWN label per the LOCKED D-01 shape)"
  - "integration assertions are non-brittle (presence + errorCount strictly greater than the flagged set), never exact counts against fixture source content"
  - "did NOT run requirements.mark-complete for SB-09: this plan delivers only Signal 2's engine half -- executor render (20-02) + README/changelog (20-03) remain, so SB-09 closes at phase verification"

patterns-established:
  - "Fourth instance of the shipped pure-detector -> additive-optional-field triad, and the SIMPLEST (reads the diagnostics array already held in finalize, not the tsconfig -> zero walk threading)"
  - "Verdict-neutrality tripwire cloned from the notTypeCheckedDeclaredFiles pattern: introduce the field via a const variable (excess-property checks fire only on fresh literals) to prove it cannot enter the verdict"

requirements-completed: [SB-09] # Signal 2 engine half only; not closed until 20-02 + 20-03 + phase verification

# Metrics
duration: 18min
completed: 2026-07-07
---

# Phase 20 Plan 01: Vite/Analog bundler-query advisory (engine half) Summary

**Pure `detectBundlerQueryImports` over the kept TS2307 set + an additive, verdict-neutral `CoreResult.bundlerQueryImports` fed from the single `finalize` seam, proven by a unit tier, a D-05 tripwire, and a hermetic real-compiler baseline/vite-client fixture.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-07T15:04Z (approx)
- **Completed:** 2026-07-07T15:16:01Z
- **Tasks:** 3
- **Files modified/created:** 13 (11 created, 2 modified)

## Accomplishments

- Pure `detectBundlerQueryImports(ts, diagnostics): readonly string[]` -- flags unresolved TS2307 whose module specifier contains a `?` (a Vite/Analog bundler query), gated on `code === 2307` first, deduped + sorted, `[]` when none. No `console`/`process`; not exported from the barrel.
- Additive `CoreResult.bundlerQueryImports?: readonly string[]` wired from ONE `finalize` call over the POST-filter kept set (`reported`), `[] -> undefined` via the same conditional-spread idiom as `templateCheckAborted`. Zero walk threading (diagnostic-derived, not config-derived).
- Charter guard proven three ways: the D-06(a) no-false-positive unit case, the D-05 verdict-neutrality tripwire (field cannot enter `evaluateResult`), and the integration assertion that the `?query` TS2307 stay COUNTED errors (never suppressed) on both legs.
- Real compile of `fixtures/vite-query-imports/`: baseline leg fires + keeps the `?query` TS2307; `vite/client` leg self-gates (field `undefined`); the plain `./does-not-exist` control still FAILs TS2307 on both legs.

## Task Commits

1. **Task 1 (TDD): pure detector + unit spec**
   - RED `test(core)` `7f69a6b` - failing unit spec (4 cases: flag/dedupe/sort, no false positive, 2732 gated, empty-set)
   - GREEN `feat(core)` `c15e12b` - `detect-bundler-query-imports.ts` implementation
   - `style(core)` `2fc1809` - Prettier line-wrap of the detector (format-gate parity)
2. **Task 2: CoreResult field + finalize seam + tripwire**
   - `feat(core)` `69b1d8d` - import + `bundlerQueryImports?` field + `finalize` call over `reported`
   - `test(core)` `50068c7` - D-05 verdict-neutrality tripwire in `evaluate-result.spec.ts`
3. **Task 3: hermetic fixture + real-compiler integration spec**
   - `test(core)` `e9ea16e` - `fixtures/vite-query-imports/` + `bundler-query-imports.integration.spec.ts`

**Plan metadata:** (final `docs(20-01)` commit with SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified

- `packages/angular-typechecker/src/core/detect-bundler-query-imports.ts` - pure detector (SB-09 D-02); `code === 2307` gate first, linear null-guarded regex `/Cannot find module '([^']+)'/`, `?`-in-specifier flag, deduped + sorted.
- `packages/angular-typechecker/src/core/detect-bundler-query-imports.spec.ts` - unit tier (4 D-02/D-06(a)/Pitfall-2 cases over synthetic diagnostics).
- `packages/angular-typechecker/src/core/run-typecheck.ts` - `import detectBundlerQueryImports`; `CoreResult.bundlerQueryImports?` field with doc comment; `finalize` call over `reported` (POST-filter) with the Pitfall-1 do-not-unify comment; conditional-spread `[] -> undefined`.
- `packages/angular-typechecker/src/core/evaluate-result.spec.ts` - D-05 tripwire (non-empty field via a const variable stays `clean`, incl. under `maxWarnings: 0`).
- `packages/angular-typechecker/src/core/bundler-query-imports.integration.spec.ts` - real-compiler proof (baseline fires+kept / vite-client self-gated / plain-missing kept on both legs).
- `fixtures/vite-query-imports/*` - direct-leaf spike-009-shaped fixture: `tsconfig.base.json` (`strict`, `moduleResolution: bundler`, `noEmit`, `types: []`), `tsconfig.baseline.json`, `tsconfig.vite-client.json`, and `src/` story sources (`?raw`/`?url`/`?worker`/`?inline` + base assets + a plain-missing control).

## Decisions Made

- **Scan the KEPT set, not the pre-filter arg (Pitfall 1).** `detectBundlerQueryImports(ts, reported)` reads the POST-boundary-filter diagnostics so a node_modules `?query` the consumer cannot fix is never named. A code comment states the OPPOSITE intent vs `templateCheckAborted` (which must scan the pre-filter superset) so a future refactor does not unify them.
- **`code === 2307` gate first (Pitfall 2).** typescript@6.0.3's 2732/2792 share the "Cannot find module" prefix; the code gate excludes them before the regex runs.
- **Plain `string[]`, no KNOWN label.** Dropped spike 010's confidence label per the LOCKED D-01 shape.
- **Did NOT touch `evaluate-result.ts`/`EvaluateInput`.** Verdict-neutral by construction (the field is structurally absent from `EvaluateInput`); the tripwire enforces it. Detector NOT exported from `index.ts` (mirrors `detectUncheckedDeclaredFiles`); the field reaches the public API transitively via `CoreResult`.
- **Non-brittle integration assertions.** Presence + `errorCount` strictly greater than the flagged set (proves both the queries and the plain-missing control remain counted errors); exact counts stay in the synthetic unit tier.

## Deviations from Plan

None affecting behavior. One mechanical follow-up: the Task 1 detector was committed before a Prettier line-wrap was applied (`flattenDiagnosticMessageText` call exceeded the print width), fixed in a separate `style(core)` commit `2fc1809` so the CI `format:check` gate stays green. No logic changed.

**Total deviations:** 0 rule-based auto-fixes. 1 formatting follow-up (whitespace only).
**Impact on plan:** None. Plan executed as written; the `?worker`/`?inline` base modules and the plain-missing control match the plan's fixture spec exactly.

## Issues Encountered

- `git grep` returned nothing for the newly-written detector because it operates on the git index only (untracked file); switched to `rg` for working-tree verification (per the CLAUDE.md `git grep`/`rg` discipline). Confirmed with `git grep` after commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CoreResult.bundlerQueryImports` is live and stable for **20-02** (executor `warnBundlerQueryImports` reads it; bump the executor's "four advisory warn*" doc-comment count to "five") and for **20-03** (README Signal 1 cross-references the field + adds it to the Programmatic-API `CoreResult` comment).
- **SB-09 is NOT closed by this plan.** Only Signal 2's engine half shipped. Remaining: Signal 2 executor render (20-02), Signal 1 README/changelog (20-03), and the user-added phase-end gates (Gate A green CI, Gate B real-OSS radix-ng tarball verify -- both HUMAN-gated, D-10/D-11). `requirements.mark-complete SB-09` intentionally deferred to phase verification.
- Full suite green: 345 tests / 47 files; `angular-typechecker:lint` clean (maxWarnings 0); touched files Prettier-clean.

## Self-Check: PASSED

All 12 created/modified artifacts exist on disk and all 6 task commits are present in git history (`7f69a6b`, `c15e12b`, `2fc1809`, `69b1d8d`, `50068c7`, `e9ea16e`). Full suite green (345/47), lint clean, `evaluate-result.ts` bundlerQueryImports count 0 (verdict-neutral), detector not exported from the barrel.

---
*Phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read*
*Completed: 2026-07-07*
