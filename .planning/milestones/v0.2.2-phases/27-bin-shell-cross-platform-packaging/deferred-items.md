# Phase 27 - Deferred Items (out-of-scope discoveries)

Logged by the 27-01 executor per the GSD SCOPE BOUNDARY rule (only fix issues
directly caused by the current task's changes; log pre-existing failures in
unrelated files, do not fix).

## D1 - Pre-existing `nx typecheck` failure in `src/cli/main.spec.ts` (Phase 26 escaped defect) -- RESOLVED

- **RESOLVED 2026-07-16** in commit `c25119b` (`test(26-02): ...`) by the phase-27 orchestrator:
  the `renderReport` mock's inline zero-arg impl was replaced with a bare `vi.fn()` (matching its
  `runTypecheck` sibling) so its `.mock.calls` args tuple is `any[]`; `beforeEach` already sets
  `mockResolvedValue(SENTINEL_REPORT)`. `nx run angular-typechecker:typecheck --skip-nx-cache`
  now exits 0 (all three tsc commands green) and `nx test` stays green (433 tests). Fixed here
  (not deferred to a separate quick task) because it blocked Phase 27's authoritative `nx typecheck`
  CI gate and is a trivial, root-caused test-only change with correct `26-02` attribution.
- **Discovered during:** 27-01 self-check (`nx run angular-typechecker:typecheck`).
- **Symptom:** `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json`
  fails with:
  - `src/cli/main.spec.ts(89,10): error TS2532: Object is possibly 'undefined'.`
  - `src/cli/main.spec.ts(89,49): error TS2493: Tuple type '[]' of length '0' has no element at index '1'.`
  - Location: the `lastColor()` test helper -> `mocks.renderReport.mock.calls.at(-1)?.[1].color`.
- **Why out of scope for 27-01:**
  - `main.spec.ts` is NOT touched by any 27-01 commit (last touched by
    `4a88087 test(26-02): ...`, a Phase-26 commit).
  - `tsconfig.spec.json` extends `tsconfig.json`, NOT the `tsconfig.lib.json`
    this plan edited (`newLine: lf`), so the 27-01 config change cannot reach the
    spec type-check.
  - The error codes (TS2532 / TS2493 on a vitest mock-call tuple) cannot be
    produced by a `newLine` emit option.
- **Root cause (not fixed here):** Phase 26 plan 26-02 recorded `test/lint/format:check`
  green but did NOT run `nx typecheck`, so this spec-only type error escaped. The
  other two typecheck commands are green: `tsconfig.drift.json` (the ADD-01
  barrel-drift guard) exit 0, `tsconfig.tools.json` exit 0.
- **Recommended home:** a Phase-26 gap-close / quick task (e.g. annotate the
  `renderReport` mock's call-args tuple or guard the `[1]` index in the test
  helper). Trivial and safe, but it belongs to the CLI-core test suite (Phase 26),
  not this bin-shell + packaging plan.
