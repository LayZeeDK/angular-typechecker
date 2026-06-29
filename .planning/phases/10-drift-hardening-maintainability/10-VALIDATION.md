---
phase: 10
slug: drift-hardening-maintainability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Requirement-level map below (task IDs are filled in post-planning by
> `/gsd-validate-phase`). Source: `10-RESEARCH.md` Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vite.config.ts` (existing) |
| **Quick run command** | `npx nx run angular-typechecker:test` (filter `-t <name>`) |
| **Full suite command** | `npx nx run-many -t test -p angular-typechecker` |
| **Drift gate command** | `npx nx run angular-typechecker:typecheck-drift` (NEW; build-time tsc, not Vitest) |
| **Estimated runtime** | ~30-60s unit/integration; drift gate ~2-5s (cached) |

---

## Sampling Rate

- **After every task commit:** Run the touched spec(s) + `typecheck-drift` (fast + cached).
- **After every plan wave:** Run `npx nx run-many -t typecheck-drift test -p angular-typechecker`.
- **Before `/gsd:verify-work`:** Full suite + `typecheck-drift` green; `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` returns >= 6.
- **Max feedback latency:** ~60 seconds.

---

## Per-Requirement Verification Map

(Task IDs assigned during planning; this is the requirement-level contract.)

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | Removed/renamed/sig-changed getter or changed `UNKNOWN_ERROR_CODE`/`EmitFlags` breaks the build (exit != 0) | build-time tsc | `npx nx run angular-typechecker:typecheck-drift` | [Wave0] new `compiler-cli-types.drift.ts` + `tsconfig.drift.json` |
| HARD-01 (additions + encoding) | New upstream getter flagged at runtime; `NG(n) === ngErrorCode(n)`; `UNKNOWN_ERROR_CODE === 500` | integration (real `await import`) | `npx nx run angular-typechecker:test -t "compiler-cli-types runtime"` | [Wave0] new `compiler-cli-types.runtime.spec.ts` |
| HARD-02 | Shim `EmitFlags` mirrors real members; `0 as EmitFlags` cast retained + still type-checks | build-time tsc (value-level assertion) + `nx build` | `npx nx run angular-typechecker:typecheck-drift` + `npx nx build angular-typechecker` | drift file [Wave0]; build [exists] |
| HARD-03 | Every vendored divergence carries the greppable marker | static grep assertion | `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts` (expect >= 6) | N/A (grep) |
| HARD-04 | `getNgStructuralDiagnostics` retained + called + covered by the per-member probe | unit (existing) + build-time drift gate | `npx nx run angular-typechecker:test -t "gatherAllDiagnostics"` + drift gate | `gather-diagnostics.spec.ts` [exists]; drift coverage [Wave0] |
| HARD-05 | No `TS-99` substring survives the `color:false` path; an `NG####` label renders (real `cli.formatDiagnostics`) | integration | `npx nx run angular-typechecker:test -t "TS-99"` | [Wave0] new `*.ts99-leak.integration.spec.ts` OR extend `render-report.spec.ts` |

*Status legend: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/tsconfig.drift.json` - classic-node drift tsconfig (`module`/`moduleResolution: node`, `noEmit`, `ignoreDeprecations: "6.0"`, `include` only the drift file) (HARD-01)
- [ ] `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` - per-member assignability probes + `getTsProgram` special-case + call-site probes + value-level `UNKNOWN_ERROR_CODE`/`EmitFlags` assertions (HARD-01/02/04)
- [ ] `typecheck-drift` target in `packages/angular-typechecker/project.json` (`nx:run-commands` -> `tsc --noEmit -p tsconfig.drift.json`) (HARD-01)
- [ ] `*.drift.ts` exclusion added to BOTH `tsconfig.lib.json` AND `tsconfig.spec.json` (HARD-01 safety - the real barrel resolves EMPTY under production nodenext)
- [ ] `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` - runtime getter-set SUBSET-containment + encoding round-trip (HARD-01 D-04)
- [ ] HARD-05 spec - new `*.ts99-leak.integration.spec.ts` OR a `not.toContain('TS-99')` assertion added to an existing NG8xxx case in `render-report.spec.ts`
- [ ] `ci.yml` wiring of `typecheck-drift` (Option A fold-in to the existing `run-many` recommended)
- [ ] Framework install: none - Vitest + TypeScript + Nx all present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | - | - | - |

*All phase behaviors have automated verification (the HARD-03 marker count is an automatable `git grep` assertion, not manual).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
