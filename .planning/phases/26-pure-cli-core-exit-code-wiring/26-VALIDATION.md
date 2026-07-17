---
phase: 26
slug: pure-cli-core-exit-code-wiring
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-16
validated: 2026-07-16
---

# Phase 26 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 26-RESEARCH.md "## Validation Architecture" (VERIFIED against
> project.json + the two vitest configs + ci.yml). The per-task map is completed
> by /gsd-validate-phase after execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Unit config** | `packages/angular-typechecker/vitest.config.mts` (excludes `*.integration.spec.ts`; 30s timeout) |
| **Integration config** | `packages/angular-typechecker/vitest.integration.config.mts` (includes only `*.integration.spec.ts`; real cold `@angular/compiler-cli`) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx test angular-typechecker && nx run angular-typechecker:integration` |
| **Estimated runtime** | unit ~seconds; integration ~1-2 min (cold compiler) |
| **Matrix** | LEAN 6-cell: Linux x {22,24,26} + Windows x {24,26} + macOS x 24 (ci.yml:106-111) |

Both `test` and `integration` targets `dependsOn: build`, so specs run against the
COMPILED `dist` output -- the same GATE-A invariant the executor specs ride (the
CJS->ESM `await import()` bridge is exercised for real in the integration tier).

---

## Sampling Rate

- **After every task commit:** `nx test angular-typechecker` (fast unit tier)
- **After every plan wave:** `nx test angular-typechecker && nx run angular-typechecker:integration`
- **Before phase verification:** both green on the merged main checkout
- **Max feedback latency:** unit < ~30s; integration < ~2 min

---

## Per-Task Verification Map

> Completed by /gsd-validate-phase after execution. Every row below maps to a
> SHIPPED, PASSING assertion in the named test file (audited 2026-07-16 against
> the actual specs; unit tier re-run green by the auditor -- 433 pass / 42 files;
> integration tier re-run green by the verifier -- 119 pass / 21 files).

*Status legend: [ ] pending - [x] green - [!] red - [~] flaky*

### Unit tier (VER-01) -- `src/cli/parse-args.spec.ts` + `src/cli/main.spec.ts`, STUBBED core

Mirror `executor.spec.ts`'s `vi.hoisted` + `vi.mock` pattern; keep the REAL
`TypecheckInfrastructureError` via `importOriginal`.

| Req | Behavior | Test file | Status |
|-----|----------|-----------|--------|
| ARGS-02 | `-c`/`--tsConfig` maps to `tsConfigPath`; `-c` repeatable | parse-args.spec.ts | [x] |
| ARGS-02 | `-p`/`--project` NOT registered (unknown-flag -> usage 2) | parse-args.spec.ts | [x] |
| ARGS-03 | single `-c` -> string; two `-c` -> `string[]` (assert value handed to stubbed `runTypecheck`) | main.spec.ts | [x] |
| ARGS-04 | unknown flag / missing `-c` value / missing required `--tsConfig` / non-integer `--max-warnings` -> usage error, exit 2 | parse-args.spec.ts | [x] |
| ARGS-04 | `--help`/`-h` and `--version` -> exit 0, text in stdout | main.spec.ts | [x] |
| ARGS-05 | `NO_COLOR` wins over `FORCE_COLOR`; `FORCE_COLOR=0` -> off; env-absent -> isTTY | main.spec.ts | [x] |
| EXIT-01 | clean (stub `{success:true}`) -> 0 | main.spec.ts | [x] |
| EXIT-01 | type-error (stub `{success:false, outcome:'type-error'}`) -> 1 | main.spec.ts | [x] |
| EXIT-01 | **coverage-incomplete AND warnings-exceeded (stub `errorCount:0`, `{success:false}`) -> 1** (anti-false-pass; subtlest new logic) | main.spec.ts | [x] |
| EXIT-01 | infra (stub `runTypecheck` rejects `TypecheckInfrastructureError`) -> 2 via `toExitCode` | main.spec.ts | [x] |
| EXIT-01 | usage error -> 2 (direct, before the core) | parse-args.spec.ts / main.spec.ts | [x] |
| CLI-03 | report -> stdout; notices+errors (BufferingLogger) -> stderr; stdout never carries a notice | main.spec.ts | [x] |
| EXIT-02 | `run()` never calls `process.exit` / writes a stream (spy asserts none) | main.spec.ts | [x] |
| VER-01 | `--version` equals the real `package.json` version (drift-lock) | main.spec.ts | [x] |

### Integration tier (VER-02) -- `src/cli/main.integration.spec.ts`, real cold compiler, in-process (NO spawn/tarball)

Reuse existing top-level `fixtures/` (VERIFIED present -- no new fixtures needed).

| Req | Behavior | Fixture (existing) | Status |
|-----|----------|--------------------|--------|
| VER-02 | clean -> 0 | `fixtures/not-type-checked-clean` (clean leaf, silent stderr) | [x] |
| VER-02 | planted TS error -> 1, code in stdout | `fixtures/gate-b-error/tsconfig.app.json` (TS2322) | [x] |
| VER-02 | planted template / NG8xxx error -> 1 | `fixtures/gate-b-error` (NG8109 same program) | [x] |
| VER-02 | real coverage-incomplete -> 1 | `[clean, fixtures/solution-style-empty]` two-entry array (errorCount 0, success false) | [x] |
| VER-02 | `--max-warnings 0` -> 1; `--strict`(+`--max-warnings 0`) -> 1 | `fixtures/extended-v13` (reported NG8101 warning) | [x] |
| VER-02 | multi-`--tsConfig` union | `fixtures/multi-tsconfig-array` (TS2322 app + TS2345 spec) | [x] |
| VER-02 | single-`--tsConfig` solution-walk | `fixtures/solution-style` (app + spec leaves, no zero-root-names skip) | [x] |
| VER-02 | malformed -> 1 (folded 5012, accepted deviation) / nonexistent tsconfig -> 2 (realpath ENOENT guard) | `fixtures/config-broken/{tsconfig.malformed.json,tsconfig.does-not-exist.json}` | [x] |
| PKG-03 | relative `-c` from a non-root (chdir) CWD -> same verdict as canonical absolute | `fixtures/gate-b-error` w/ cwd override | [x] |

---

## Wave 0 Requirements

- [x] `src/cli/parse-args.spec.ts` -- ARGS-01..05 flag mapping + usage errors (19 assertions, green)
- [x] `src/cli/main.spec.ts` -- exit-code compose (EXIT-01), routing (CLI-03), purity (EXIT-02), color (ARGS-05), version drift-lock (VER-01) (20 assertions, green)
- [x] `src/cli/main.integration.spec.ts` -- VER-02 end-to-end against existing `fixtures/` (12 cases, green)
- No framework install needed; no new fixtures needed (existing `fixtures/` covered every VER-02 case -- CONFIRMED during execution + this audit).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | -- | -- | All Phase-26 behaviors have automated verification (unit + integration; no packaging, no spawn). Shipped-tarball literal exit codes + real-clone UAT are Phase 28 (VER-04/05), out of this phase. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < ~2 min (integration)
- [x] `nyquist_compliant: true` set in frontmatter (by /gsd-validate-phase after execution)

**Approval:** approved (nyquist_compliant)

---

## Audit Trail (gsd-nyquist-auditor, 2026-07-16)

**Result:** NO GAPS -- comprehensive coverage already present; nothing generated (YAGNI).

**Covered / Partial / Missing:** 12 / 0 / 0 (all 12 phase requirements).

**Method:** FORCE stance -- every requirement treated as uncovered until a passing,
can-fail assertion was found in the shipped specs. Read all three specs + the three
`src/cli/*.ts` under test. Re-ran the unit tier (`nx test angular-typechecker
--skip-nx-cache`) -> 433 pass / 42 files; the integration tier (119 pass / 21 files)
was independently re-run green by gsd-verifier minutes earlier against the same
unmodified files.

**Requirement -> proof (all green):**

- ARGS-01 (parseArgs, zero deps) -- `parse-args.ts` imports only `node:util` + the
  manifest; exercised by every parse-args.spec.ts assertion; zero-deps is a static
  property held by `@nx/dependency-checks` + the verifier grep (no runtime test can
  fail on it).
- ARGS-02 (-c repeatable/required, -p rejected) -- parse-args.spec.ts single/repeatable
  `-c`, `-p`/`--project`/unknown-flag/missing-required usageError.
- ARGS-03 (single string vs array) -- main.spec.ts asserts a STRING for one `-c`, a
  `string[]` for two (the value handed to the stubbed `runTypecheck`); integration
  proves solution-walk vs union end-to-end.
- ARGS-04 (usage -> 2; help/version -> 0) -- parse-args.spec.ts usage/max-warnings
  matrix + main.spec.ts exit-2-direct + help/version exit-0.
- ARGS-05 (color NO_COLOR/FORCE_COLOR/TTY) -- main.spec.ts pins all four precedence
  branches via the `color` option captured by the renderReport stub.
- CLI-02 (same verdict/diagnostics via runTypecheck) -- integration composes the real
  core and asserts real TS2322/TS2345/NG8109 codes flow through `run()`.
- CLI-03 (routing) -- main.spec.ts (report->stdout, real advisory notice->stderr,
  stdout uncontaminated) + integration (TS2322 in stdout, absent from stderr).
- EXIT-01 (0/1/2) -- main.spec.ts clean->0, type-error->1, infra->2, usage->2, rethrow;
  and the subtlest anti-false-pass matrix: coverage-incomplete AND warnings-exceeded,
  both with `errorCount:0` + stubbed `{success:false}` -> exitCode 1 (LOAD-BEARING: if
  `main.ts` read raw counts instead of `evaluateResult().success` both would fail).
  Integration confirms a REAL coverage-incomplete (errorCount 0, success false) -> 1
  and a nonexistent tsconfig -> 2.
- EXIT-02 (purity) -- main.spec.ts spies confirm neither `process.exit` nor
  `process.stdout.write` is called.
- PKG-03 (nx-free path + realpath) -- integration relative-`-c`-from-chdir == absolute
  verdict; nonexistent path -> 2 via the guarded `realpathSync.native` ENOENT
  fall-through; nx-free import boundary held by construction (verifier grep).
- VER-01 / VER-02 -- both tiers exist and pass (drift-lock compares `--version` to the
  real manifest in both parse-args.spec.ts and main.spec.ts).

**Accepted execution deviations (NOT gaps; covered end-to-end):** malformed-`extends`
tsconfig folds a counted 5012 config error -> exit 1 (only a NONEXISTENT path is the
infra exit 2); real coverage-incomplete driven via a two-entry array because ARGS-03
collapses a single `-c` to the string walk-path. Both grounded in already-locked
integration specs; no implementation change; neither weakens EXIT-01/VER-02.
