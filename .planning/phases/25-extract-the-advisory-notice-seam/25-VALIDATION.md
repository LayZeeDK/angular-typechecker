---
phase: 25
slug: extract-the-advisory-notice-seam
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
updated: 2026-07-16
---

# Phase 25 -- Validation Strategy

> Per-phase validation contract for feedback sampling. Phase 25 (CLI-04) is a PURE
> INTERNAL REFACTOR: the five advisory `warn*` helpers were moved VERBATIM out of
> `executor.ts` into a pure, logger-injected `core/emit-advisory-notices.ts` behind a
> nothing-importing `core/logger.ts` `Logger` seam; the executor now drives one
> `emitAdvisoryNotices(result, logger)` call. Byte-identical observable behavior vs
> `angular-typechecker@0.2.1`, additive-only (ADD-01).
>
> The single behavioral surface is the advisory-notice output (message text + stream
> routing + emission order). Independently re-classified against the shipped tests and
> the code-review Info item (IN-01) by the Nyquist auditor 2026-07-16; the prior inline
> "clean" short-circuit was NOT trusted -- one genuine coverage gap was found and filled.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (via `@nx/vitest:test`) |
| **Unit config** | `packages/angular-typechecker/vitest.config.mts` (tier: `test`) |
| **Integration config** | `packages/angular-typechecker/vitest.integration.config.mts` (tier: `integration`) |
| **Unit command** | `npx nx test angular-typechecker` |
| **Integration command** | `npx nx run angular-typechecker:integration` |
| **Estimated runtime** | ~5s unit / ~30s integration |

The CLI-04 advisory surface is a PURE function (`emitAdvisoryNotices(result, logger)`),
so every behavioral property is a UNIT test against an injected mock `Logger` -- no
integration or e2e sample point is warranted (the pure module performs no I/O of its own;
the real cold-compiler integration tier does not exercise advisory ordering).

---

## Per-Requirement Coverage Map (CLI-04)

| Behavioral property (D-ref) | Sample point | Type | Automated command | Status |
|-----------------------------|--------------|------|-------------------|--------|
| Each advisory's EXACT message text (D-09 byte-exact anchor) | `emit-advisory-notices.spec.ts` -- full-string `toHaveBeenCalledWith` (not `stringContaining`) for all 5 advisories | unit | `npx nx test angular-typechecker` | green (COVERED) |
| Stream routing: `info` for the node_modules-suppressed count, `warn` for every other advisory, `error` NEVER | `emit-advisory-notices.spec.ts` -- each test asserts the right method fired + `logger.error` not called | unit | `npx nx test angular-typechecker` | green (COVERED) |
| Clean `CoreResult` emits nothing on info/warn/error (self-gating) | `emit-advisory-notices.spec.ts` "a clean CoreResult emits nothing" | unit | `npx nx test angular-typechecker` | green (COVERED) |
| All three `skippedReferenceVerdictNote` branches (`not-found` / `zero-root-names` / default tail) | `emit-advisory-notices.spec.ts` -- one warn per reference exercising all three verdict-note tails | unit | `npx nx test angular-typechecker` | green (COVERED) |
| WITHIN-`warnSuppressed` sub-order: `info` (node_modules) BEFORE `warn` (coverage-incomplete) (D-05 Pitfall 2) | `emit-advisory-notices.spec.ts` -- `.mock.invocationCallOrder` info < warn | unit | `npx nx test angular-typechecker` | green (COVERED) |
| Byte-identical adapter output vs 0.2.1 (D-10 regression guard) | UNCHANGED `executor.spec.ts` + `builder.spec.ts` + `builder.integration.spec.ts` run the REAL `emitAdvisoryNotices` against a mocked `@nx/devkit` logger; no `vi.mock` of the seam, no assertion edits | unit + integration | `npx nx test angular-typechecker` + `npx nx run angular-typechecker:integration` | green (COVERED) |
| **CROSS-advisory emission order** (D-05 locked): `templateCheckAborted -> skippedReferences -> suppressed(info THEN warn) -> notTypeChecked -> bundlerQueryImports` | **`emit-advisory-notices.spec.ts` "emits the five advisories in the locked D-05 order across the info and warn streams" (NEW)** | unit | `npx nx test angular-typechecker` | green (**GAP FILLED**) |

---

## Gap Assessment: IN-01 (code-review Info) -- cross-advisory emission order

**Classification: MISSING -> FILLED.**

**Finding.** D-05 locks the cross-advisory emission order as an explicit correctness
property, and it is part of the byte-identical CLI-04 bar. But before this audit it was
guarded ONLY by source ordering inside `emitAdvisoryNotices`. Every one of the 7 existing
spec tests exercises ONE advisory in isolation (the `warnSuppressed` test asserts only the
info-before-warn sub-order WITHIN that one helper). A future edit that reordered the five
helper calls would emit correct strings and pass every existing unit AND executor test
while silently changing observable output order -- a real, sampleable Nyquist gap on a
locked property.

**Fill.** Appended ONE combined-scenario test to `emit-advisory-notices.spec.ts` (existing
assertions untouched -- additive only): it drives a `CoreResult` that triggers ALL FIVE
advisories at once, reconstructs the true cross-stream timeline by pairing each `info`/`warn`
call with its global `.mock.invocationCallOrder` and sorting, then asserts the six fired
messages appear in the exact D-05 order via positional substring checks
(`timeline[0]`..`timeline[5]`) plus `logger.error` never called.

**Can-fail proof (adversarial).** The assertions are POSITIONAL against the reconstructed
timeline, so they are order-sensitive by construction: if the helper sequence were reordered
(e.g. `bundlerQueryImports` moved first), `timeline[0]` would no longer contain the
`aborted Angular template type-check-block` substring and the test fails. It is not a
trivially-passing test -- it discriminates order, which is precisely the ungurded property.

---

## Commands executed this session (observed directly, green)

| Command | Result |
|---------|--------|
| `npx nx test angular-typechecker --skip-nx-cache` | **40 files / 394 tests PASS**; `emit-advisory-notices.spec.ts` now **8 tests** (was 7; +1 D-05 cross-order) |
| `npx nx lint angular-typechecker --skip-nx-cache` | All files pass linting at `maxWarnings:0` (the added spec trips no rule) |
| `npx prettier --check .../emit-advisory-notices.spec.ts` | Clean (Prettier code style) |

The integration tier (`vitest.integration.config.mts`, 107 tests, verified green in
`25-VERIFICATION.md`) was NOT re-run this session: the filled gap is a pure unit-tier
ordering property, the change is test-only and confined to `emit-advisory-notices.spec.ts`,
and no implementation file was touched -- the integration tier is unaffected.

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts` -- +1 combined-scenario test locking the D-05 cross-advisory emission order (IN-01 gap-fill).

*Existing Vitest infrastructure covers the framework; the one net-new sample point landed
green. No other Wave-0 artifact was required (CLI-04 is a pure-function refactor).*

---

## Validation Audit 2026-07-16 (Nyquist auditor, independent)

| Metric | Count |
|--------|-------|
| Requirements classified | 1 (CLI-04) |
| Behavioral properties re-classified | 7 |
| COVERED by existing spec (re-run green) | 6 |
| MISSING -> FILLED this session | 1 (IN-01 cross-advisory order) |
| Tests generated | 1 |
| Escalated (implementation bug) | 0 |
| Implementation files modified | 0 |
| Existing assertions weakened/edited | 0 |

**Method.** CLI-04's behavioral surface was decomposed into seven observable properties
(above) and each re-classified against the actual shipped tests -- the inline "no gaps"
short-circuit in the phase workflow was not trusted. Six properties (exact message text,
stream routing, clean silence, all three verdict-note branches, the within-`warnSuppressed`
sub-order, and the byte-identical adapter guard) are COVERED by the shipped
`emit-advisory-notices.spec.ts` + the unchanged `executor.spec.ts`/`builder*.spec.ts`. The
seventh -- the D-05 CROSS-advisory order -- was genuinely uncovered (IN-01) and is now filled
with one order-sensitive test proven able to fail. No implementation file was touched; no
existing assertion was edited or weakened.

---

## Validation Sign-Off

- [x] Every automatable CLI-04 property has an executed, green Nyquist sample point
- [x] The one identified gap (IN-01) is FILLED with a can-fail behavioral test, not skipped
- [x] Implementation files never modified (test-only change)
- [x] No watch-mode flags; feedback latency < 10s (unit tier)
- [x] `nyquist_compliant: true` set in frontmatter

**Verdict: `nyquist_compliant: true`; `wave_0_complete: true`.** CLI-04's advisory surface
is adequately sampled: 6 properties pre-covered + 1 gap (IN-01 cross-advisory order) filled
this session. 1 test generated, 0 gaps remaining, 0 escalations.

**Files for commit (test, separate from this VALIDATION.md):**
- `packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts`

---

_Validated: 2026-07-16_
_Auditor: Claude (gsd-nyquist-auditor)_
