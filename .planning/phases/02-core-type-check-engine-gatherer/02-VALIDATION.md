---
phase: 2
slug: core-type-check-engine-gatherer
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
validated: 2026-06-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` "## Validation Architecture". The Per-Task Verification Map is populated once plans exist (and audited by `/gsd:validate-phase`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` (already configured — WS-03 complete) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` |
| **Quick run command** | `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` |
| **Full suite command** | `npx nx build angular-typechecker && npx nx test angular-typechecker` (build precedes so the GATE A static spec reads fresh `dist/`) |
| **Estimated runtime** | quick ~sub-second; full suite ~tens of seconds (REAL-compiler integration tier per fixture) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker -- --exclude '**/*.integration.spec.ts'` (fast unit specs: gatherer getter-order + LW-01 shim import)
- **After every plan wave:** Run `npx nx build angular-typechecker && npx nx test angular-typechecker` (REAL-compiler integration tier + GATE A static + GATE B differential)
- **Before `/gsd:verify-work`:** Full suite must be green; every Requirement -> Test Map row asserted
- **Max feedback latency:** quick run < 5s

---

## Per-Task Verification Map

> Populated during planning / `/gsd:validate-phase`. Rows are bound to their concrete plan/task IDs and asserting spec files. Audited 2026-06-27 against the committed tests (see Validation Audit below) -- every row independently confirmed against the real test source/assertions, not the SUMMARY claims, and re-run green (build + full suite 39/39 across 12 files).

| Req / Decision | Plan/Task | Behavior | Test Type | Asserting Spec (file:lines) / Assertion | File Exists | Status |
|----------------|-----------|----------|-----------|-----------------------------------------|-------------|--------|
| ENG-01 | 02-01-T2 / 02-02-T2 | `runTypecheck` loads ESM compiler-cli, resolves tsconfig, whole-program no-emit, structured result | integration | `run-typecheck.integration.spec.ts:30-37` -- asserts `tsConfigPath`, `rootNamesCount > 0`, `Array.isArray(diagnostics)`, `durationMs > 0` over app+lib | ✅ | ✅ COVERED |
| ENG-02 | 02-01-T1/T2 / 02-03-T2 | Gatherer surfaces TS + template + extended in ONE pass, no short-circuit | unit + integration | Unit: `gather-diagnostics.spec.ts:14-66` (6 getters in order + no-short-circuit, LW-01 import fixed). Integration: `run-typecheck.integration.spec.ts:39-46` (`2322` AND `NG(8109)`). Differential: `gate-b.spec.ts:85-90` (`defaultGatherDiagnostics` has `2322` not `NG8109`) | ✅ | ✅ COVERED |
| ENG-04 | 02-01-T2 / 02-03-T2 | Counts by category; `strictTemplates` honored; extended categories respected | integration | `extended.angular13.integration.spec.ts:33-44` (NG8101 Warning -> `warningCount >= 1`, `errorCount === 0`); `extended.angular17.integration.spec.ts:34-56` (promoted same code -> `errorCount >= 1` + invariant `errorCount + warningCount <= diagnostics.length`) | ✅ | ✅ COVERED |
| EXE-02 | 02-02-T2 | Required single `tsConfig`; spec tsconfig checked | integration | `config-resolution.integration.spec.ts:58-71` -- `tsconfig.spec.json` fixture -> planted spec-file `TS2322` in `codes`, `rootNamesCount > 0`, `errorCount >= 1` | ✅ | ✅ COVERED |
| TEST-02 | 02-03-T2 | REAL compiler, exact codes/counts, per-introduction-version organization | integration | `baseline.angular13` / `extended.angular13` / `extended.angular17` `.integration.spec.ts` -- exact codes (TS raw 2322/2339/5053/6304/6379; NG via `NG()` 8001/8101/8109) + exact `errorCount`/`warningCount`; per-introduction-version filenames | ✅ | ✅ COVERED |
| D-01 | 02-01-T2 | Explicit counts; no public `codes`; invariant | integration | `run-typecheck.integration.spec.ts:58-62` (`'codes' in result === false`) + `:48-56` (invariant); category-count source `run-typecheck.ts:206-211` (filter by `DiagnosticCategory.Error`/`.Warning`) | ✅ | ✅ COVERED |
| D-02 | 02-03-T1/T2 | `diagnostics:false` suppresses "Time for diagnostics" Message | integration | `no-emit-override.integration.spec.ts:59-70` -- `no-emit-message` fixture tsconfig sets `diagnostics:true`; result has NO category-Message "Time for diagnostics" entry | ✅ | ✅ COVERED |
| D-03 / MD-01 | 02-01-T1 / 02-02-T2 | Config errors prepended; malformed tsconfig not silently clean | integration | `config-resolution.integration.spec.ts:73-98` -- `tsconfig.malformed.json` (`extends` nonexistent) -> `errorCount >= 1`, prepended config error present (names the unresolvable file), `runTypecheck` does NOT throw | ✅ | ✅ COVERED |
| D-03 / D-03a | 02-01-T1 / 02-02-T2 | Zero-rootNames guard fires on solution-style | integration | `config-resolution.integration.spec.ts:100-127` -- `{files:[],references:[...]}` -> `rootNamesCount === 0` AND `errorCount === 1` AND guard message matches `/tsconfig\.(app\|lib\|spec)\.json/`; asserts NOT gated on `18003` | ✅ | ✅ COVERED |
| D-05 / L-1 | 02-01-T1 / 02-03-T2 | Override neutralizes composite-triangle (TS5053/6304/6379) | integration | `no-emit-override.integration.spec.ts:47-57` -- `composite-triangle` fixture (`composite/declarationMap/emitDeclarationOnly:true`) -> `codes` excludes `5053`, `6304`, `6379` | ✅ | ✅ COVERED |
| D-06 / L-3 | 02-01-T1/T2 | Infra crash re-thrown (gate on `code === 500`), not counted | unit (focused stub) | `infra-failure.spec.ts:65-100` -- stubbed `performCompilation` returns code-500 -> `runTypecheck` rejects with `TypecheckInfrastructureError`; a returned `TS2322` does NOT throw and IS counted (`errorCount === 1`) | ✅ | ✅ COVERED |
| LW-01 | 02-01-T2 | gatherer spec imports from the shim, not the barrel | static | `gather-diagnostics.spec.ts:3` imports `Program` from `./compiler-cli-types`; `git grep "from '@angular/compiler-cli'" .../gather-diagnostics.spec.ts` returns nothing (verified, exit 1) | ✅ | ✅ COVERED |

*Status: ⬜ pending · ✅ COVERED (asserting test exists + green) · ⚠️ PARTIAL · ❌ MISSING*

---

## Wave 0 Requirements

- [x] `fixtures/` new dirs + committed tsconfigs: ts-baseline (F2), ng-baseline (NG8001, F3), extended-v13 (NG8101, F5), extended-promoted (F6), composite-triangle (F8), solution-style, config-broken spec-tsconfig + malformed variant, no-emit-message (D-02). (F1/F7 reuse the Phase-1 `gate-b-error` fixture.) -- all 9 fixture dirs present on disk.
- [x] `src/core/*.integration.spec.ts` per-version split (`baseline.angular13`, `extended.angular13`, `extended.angular17`) with the `NG()` helper (`diagnostic-codes.ts`) calling `runTypecheck` directly (D-07c)
- [x] `config-resolution.integration.spec.ts` (D-03/MD-01 malformed config + solution-style zero-rootNames guard assertion + EXE-02 spec checking)
- [x] `no-emit-override.integration.spec.ts` (D-05/L-1 composite-triangle + D-02 Message suppression)
- [x] `infra-failure.spec.ts` (D-06) -- focused `performCompilation` stub (the single justified Phase-2 mock; broad mocking deferred to Phase-3 TEST-01)
- [x] LW-01 one-line import fix in `gather-diagnostics.spec.ts` (barrel -> `./compiler-cli-types`) -- verified
- [x] `gate-b.spec.ts` reconcile `result.codes` -> `result.diagnostics.map(d => d.code)` (D-01 drops public `codes`) -- verified at `gate-b.spec.ts:105`

*Framework install: NONE — Vitest + `@nx/vitest:test` already configured (WS-03 complete).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none expected) | — | All Phase-2 behaviors have automated real-compiler verification | — |

*If none confirmed at plan time: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no MISSING references remain -- all 12 rows COVERED)
- [x] No watch-mode flags (Vitest runs in `run` mode; quick run uses `--exclude '**/*.integration.spec.ts'`)
- [x] Feedback latency < 5s (quick run measured 3.26s, 19/19 across 6 files)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-27 (Validation Audit -- all 12 requirement rows COVERED by real asserting tests, full suite green)

---

## Validation Audit (2026-06-27)

> State A audit: this VALIDATION.md existed as a `draft` from planning. The phase was executed and verified (`02-VERIFICATION.md` status: passed). This audit cross-referenced every Per-Task Verification Map row against the ACTUAL committed test files (asserting source read line-by-line, NOT trusting the SUMMARY/VERIFICATION claims), re-ran the suites independently, and updated the map.

### Method (adversarial / FORCE stance)

- Read all three PLANs, three SUMMARYs, `02-VERIFICATION.md`, the engine source (`run-typecheck.ts`, `compiler-cli-types.ts`, `diagnostic-codes.ts`), and all 12 committed spec files.
- For each of the 12 rows: located the specific `it(...)` block + assertion that proves the claimed behavior, and confirmed the asserting test genuinely exercises the requirement's hard edge (e.g. exact `=== 0` / `=== 1` for the zero-rootNames guard, `NG()`-encoded codes not bare numbers, category-based counts not `length - errorCount`).
- Re-ran both suites independently rather than trusting recorded counts.

### Independent re-run (this audit, not the SUMMARY)

| Command | Result |
|---------|--------|
| `npx nx test angular-typechecker -- --exclude "**/*.integration.spec.ts"` | 19 passed across 6 files (3.26s) |
| `npx nx build angular-typechecker` | Successfully ran target build |
| `npx nx test angular-typechecker` | 39 passed across 12 files (full tier incl. REAL-compiler integration + focused D-06 stub) |

Matches the orchestrator's expected state (39 passed across 12 files).

### Per-row finding

All 12 Per-Task Verification Map rows are **COVERED** -- each by a real behavioral test that asserts the requirement's claimed behavior and runs green:

- **ENG-01, ENG-02, ENG-04, D-01** -- `run-typecheck.integration.spec.ts` + `extended.angular13/17.integration.spec.ts` + the `gather-diagnostics.spec.ts` unit getter-order/no-short-circuit proof + `gate-b.spec.ts` differential.
- **EXE-02, D-03/MD-01, D-03/D-03a** -- `config-resolution.integration.spec.ts` (spec tsconfig checked; malformed never silently clean and never thrown; solution-style exactly `rootNamesCount === 0` + `errorCount === 1` with leaf-naming message, not gated on TS18003).
- **TEST-02** -- per-introduction-version `*.angularNN.integration.spec.ts` files asserting EXACT codes/counts via the `NG()` helper.
- **D-02, D-05/L-1** -- `no-emit-override.integration.spec.ts` (composite-triangle excludes 5053/6304/6379; no "Time for diagnostics" Message; fixture confirmed to set `diagnostics:true`, so the suppression is genuinely exercised).
- **D-06/L-3** -- `infra-failure.spec.ts` (the single justified focused stub: re-throws on code 500, does NOT throw + counts a normal TS2322).
- **LW-01** -- `gather-diagnostics.spec.ts:3` imports from `./compiler-cli-types`; the barrel import is verifiably gone.

### Gaps filled

None. Zero MISSING and zero PARTIAL rows were found -- all behaviors were already covered by genuine asserting tests prior to this audit. No new test files were written (writing a padding test would not have raised coverage; every requirement edge is already asserted). No implementation bugs surfaced; no escalation needed.

### Notes carried forward (non-blocking, INFO-level -- from `02-VERIFICATION.md` / `02-REVIEW.md`)

- `extended.angular17.integration.spec.ts` proves the version-independent `defaultCategory:"error"` promotion using the portable NG8101 shape; the `angular17` filename is the additive-catalog "promotion" slot, not a claim that NG8101 was introduced in v17 (IN-01).
- `tsconfig.lib.json`'s dead `fixtures/**/*` excludes were removed (no `fixtures/` dir under the project root); the real guard is `include: ["src/**/*.ts"]`, and the fixture header comments now state that mechanism truthfully. No fixture `.ts` leaks to `dist` (WR-01 / IN-03 fixed). Does not affect any requirement's coverage.

**Audit outcome: nyquist_compliant -- all requirement rows COVERED; status flipped draft -> validated; `wave_0_complete: true`.**
