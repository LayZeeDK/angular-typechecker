---
phase: 26
slug: pure-cli-core-exit-code-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
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

> Populated by /gsd-validate-phase after plans + execution (task IDs do not exist
> yet at plan time). The requirement -> test-behavior map below is the sampling
> contract each task's `<automated>` verify must satisfy.

*Status legend: [ ] pending - [x] green - [!] red - [~] flaky*

### Unit tier (VER-01) -- `src/cli/parse-args.spec.ts` + `src/cli/main.spec.ts`, STUBBED core

Mirror `executor.spec.ts`'s `vi.hoisted` + `vi.mock` pattern; keep the REAL
`TypecheckInfrastructureError` via `importOriginal`.

| Req | Behavior | Test file | Status |
|-----|----------|-----------|--------|
| ARGS-02 | `-c`/`--tsConfig` maps to `tsConfigPath`; `-c` repeatable | parse-args.spec.ts | [ ] |
| ARGS-02 | `-p`/`--project` NOT registered (unknown-flag -> usage 2) | parse-args.spec.ts | [ ] |
| ARGS-03 | single `-c` -> string; two `-c` -> `string[]` (assert value handed to stubbed `runTypecheck`) | main.spec.ts | [ ] |
| ARGS-04 | unknown flag / missing `-c` value / missing required `--tsConfig` / non-integer `--max-warnings` -> usage error, exit 2 | parse-args.spec.ts | [ ] |
| ARGS-04 | `--help`/`-h` and `--version` -> exit 0, text in stdout | main.spec.ts | [ ] |
| ARGS-05 | `NO_COLOR` wins over `FORCE_COLOR`; `FORCE_COLOR=0` -> off; env-absent -> isTTY | main.spec.ts | [ ] |
| EXIT-01 | clean (stub `{success:true}`) -> 0 | main.spec.ts | [ ] |
| EXIT-01 | type-error (stub `{success:false, outcome:'type-error'}`) -> 1 | main.spec.ts | [ ] |
| EXIT-01 | **coverage-incomplete AND warnings-exceeded (stub `errorCount:0`, `{success:false}`) -> 1** (anti-false-pass; subtlest new logic) | main.spec.ts | [ ] |
| EXIT-01 | infra (stub `runTypecheck` rejects `TypecheckInfrastructureError`) -> 2 via `toExitCode` | main.spec.ts | [ ] |
| EXIT-01 | usage error -> 2 (direct, before the core) | parse-args.spec.ts / main.spec.ts | [ ] |
| CLI-03 | report -> stdout; notices+errors (BufferingLogger) -> stderr; stdout never carries a notice | main.spec.ts | [ ] |
| EXIT-02 | `run()` never calls `process.exit` / writes a stream (spy asserts none) | main.spec.ts | [ ] |
| VER-01 | `--version` equals the real `package.json` version (drift-lock) | main.spec.ts | [ ] |

### Integration tier (VER-02) -- `src/cli/main.integration.spec.ts`, real cold compiler, in-process (NO spawn/tarball)

Reuse existing top-level `fixtures/` (VERIFIED present -- no new fixtures needed).

| Req | Behavior | Fixture (existing) | Status |
|-----|----------|--------------------|--------|
| VER-02 | clean -> 0 | a clean leaf (confirm exact during exec) | [ ] |
| VER-02 | planted TS error -> 1, code in stdout | `fixtures/ng-baseline` or `fixtures/gate-b-error` | [ ] |
| VER-02 | planted template / NG8xxx error -> 1 | `fixtures/gate-b-error` + an `fixtures/extended-*` | [ ] |
| VER-02 | real coverage-incomplete -> 1 | `fixtures/solution-style-empty` (zero-root-names) | [ ] |
| VER-02 | `--max-warnings 0` -> 1; `--strict` -> 1 | an NG8xxx-warning fixture | [ ] |
| VER-02 | multi-`--tsConfig` union | `fixtures/multi-tsconfig-array` | [ ] |
| VER-02 | single-`--tsConfig` solution-walk | `fixtures/solution-style` | [ ] |
| VER-02 | malformed / nonexistent tsconfig -> 2 | `fixtures/config-broken/{tsconfig.malformed.json,tsconfig.does-not-exist.json}` (exercises the realpath ENOENT guard) | [ ] |
| PKG-03 | Windows cells: relative `-c` from a non-root CWD -> same verdict | any of the above w/ cwd override | [ ] |

---

## Wave 0 Requirements

- [ ] `src/cli/parse-args.spec.ts` -- ARGS-01..05 flag mapping + usage errors
- [ ] `src/cli/main.spec.ts` -- exit-code compose (EXIT-01), routing (CLI-03), purity (EXIT-02), color (ARGS-05), version drift-lock (VER-01)
- [ ] `src/cli/main.integration.spec.ts` -- VER-02 end-to-end against existing `fixtures/`
- No framework install needed; no new fixtures needed (existing `fixtures/` cover every VER-02 case -- confirm the exact clean fixture during planning).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | -- | -- | All Phase-26 behaviors have automated verification (unit + integration; no packaging, no spawn). Shipped-tarball literal exit codes + real-clone UAT are Phase 28 (VER-04/05), out of this phase. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~2 min (integration)
- [ ] `nyquist_compliant: true` set in frontmatter (by /gsd-validate-phase after execution)

**Approval:** pending
