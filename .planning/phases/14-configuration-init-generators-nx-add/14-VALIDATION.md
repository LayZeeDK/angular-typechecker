---
phase: 14
slug: configuration-init-generators-nx-add
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
validated: 2026-07-02
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `14-RESEARCH.md` § Validation Architecture. All Phase 14 proof is
> in-plugin UNIT on the public in-memory `createTreeWithEmptyWorkspace` substrate
> (board D1 / D-12); end-to-end / tarball proof is Phase 15 (GE2E-01..03, GUARD-01),
> NOT this phase.
>
> **VALIDATED 2026-07-02:** all in-phase observable behaviors (V-01..V-13) are
> backed by green automated tests (`nx test angular-typechecker` = 236 tests / 31
> files, `nx lint angular-typechecker` green). The only deferred row (V-14, `nx add`
> install-time seeding) is correctly Phase 15's e2e scope. `nyquist_compliant: true`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (existing; `src/generators/**/*.spec.ts` auto-discovered) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx run-many -t test` (or the unchanged 6-cell CI `test` matrix) |
| **Estimated runtime** | ~21 seconds (in-memory Tree specs; no real compiler, no `nx build` needed) |

---

## Sampling Rate

- **After every task commit:** `nx test angular-typechecker`
- **After every plan wave:** `nx test angular-typechecker` + `nx lint angular-typechecker` (the lint run validates `generators.json` via `@nx/nx-plugin-checks` — a free registration-correctness lever)
- **Before `/gsd:verify-work`:** full `test` suite green AND `nx build angular-typechecker` green
- **Max feedback latency:** ~21 seconds

---

## Per-Task Verification Map

| Item | Requirement | Behavior (observable) | Test Type | Automated Command | File | Status |
|------|-------------|-----------------------|-----------|-------------------|------|--------|
| V-01 | GEN-01/02 | `configuration` writes ONE target `{ executor: 'angular-typechecker:typecheck', options.tsConfig }` at the SOLUTION `tsconfig.json` (workspace-root-relative path) | unit | `nx test angular-typechecker` | `src/generators/configuration/configuration.spec.ts` | ✅ green |
| V-02 | GEN-02 | Flat-project fallback → `tsconfig.lib.json` (library) / `tsconfig.app.json` (application) by `projectType` + existence probe | unit | same | (same file) | ✅ green |
| V-03 | GEN-02 | `--tsConfig` override honored (relative → joined project-root-relative + existence-probed; absolute → verbatim) | unit | same | (same file) | ✅ green |
| V-04 | GEN-02 | No resolvable tsconfig → clear located error; missing relative `--tsConfig` override → located error | unit | same | (same file) | ✅ green |
| V-05 | GEN-04 | Re-run idempotent for OUR target (merge-preserves user-added keys); non-ours same-named target → thrown located error | unit | same | (same file) | ✅ green |
| V-06 | GEN-03 | Solution path points at `tsconfig.json` (so WALK-01 walks the spec leaf) — target points at the solution tsconfig, not a spec-specific target | unit | same | (same file) | ✅ green |
| V-07 | GEN-08 | Running `configuration` alone seeds `targetDefaults` (proves it invokes `init`) | unit | same | (in `configuration.spec.ts`) | ✅ green |
| V-08 | GEN-07 | `init` seeds `targetDefaults['angular-typechecker:typecheck']` = WALK-02 block: `cache:true`, `outputs:[]`, inputs start with `default`, NOT `production` | unit | `nx test angular-typechecker` | `src/generators/init/init.spec.ts` | ✅ green |
| V-09 | GEN-07 | `init` idempotent re-run (seeded block unchanged) | unit | same | (same file) | ✅ green |
| V-10 | GEN-07 | `init` does NOT clobber a pre-existing customized entry (whole-entry `??=`) | unit | same | (same file) | ✅ green |
| V-11 | GEN-05 | Schema parity: `keys(schema.json.properties)` === `schema.d.ts` interface keys, per generator | unit | same | `configuration/schema-parity.spec.ts`, `init/schema-parity.spec.ts` | ✅ green |
| V-12 | GEN-05 | `generators.json` registration valid (factory/schema paths resolve, schemas well-formed) | lint | `nx lint angular-typechecker` (`@nx/nx-plugin-checks`) | — | ✅ green |
| V-13 | GEN-05 | `package.json` `generators === './generators.json'` AND `files` includes `'generators.json'`; build asset glob ships it | unit (manifest) | `nx test angular-typechecker` | `src/package-manifest.spec.ts` | ✅ green |
| V-14 | GEN-09 | `nx add angular-typechecker` runs `init` on install (seed on install) | e2e — **Phase 15 (GE2E-03)** | Phase 15 install-e2e | Not this phase | ⏭ deferred (P15) |

*Status: ✅ green · ⬜ pending · ❌ red · ⚠️ flaky · ⏭ deferred*

---

## Wave 0 Requirements

- [x] `src/generators/configuration/configuration.spec.ts` — solution write, flat fallback, `--tsConfig` (+ missing-override error), no-resolvable error, idempotency (+ merge-preserve), non-ours collision, init-invoked (GEN-01/02/03/04/08)
- [x] `src/generators/configuration/schema-parity.spec.ts` — key parity (GEN-05)
- [x] `src/generators/init/init.spec.ts` — seed shape, idempotent, don't-clobber, `default`-not-`production` (GEN-07)
- [x] `src/generators/init/schema-parity.spec.ts` — key parity (GEN-05)
- [x] Packaging assertions — `src/package-manifest.spec.ts` asserts `package.json.generators === './generators.json'` and `files` includes `'generators.json'` (GEN-05)
- [x] Framework install: none (Vitest + `@nx/devkit/testing` already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `nx add angular-typechecker` seeds `targetDefaults` on install | GEN-09 | Requires the packed tarball + a real install; cannot run against the in-memory Tree | Deferred to Phase 15 GE2E-03 (install-e2e); the registration MECHANISM is unit/lint-verified here (V-12/V-13) |

*All Phase 14 behaviors have automated (unit/lint) verification; the only install-time behavior (GEN-09) is proven by Phase 15's e2e, and its registration mechanism is already automated-verified here.*

---

## Validation Audit 2026-07-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only, Phase 15) | 1 (V-14 / GEN-09 install-e2e) |

State A audit: all in-phase requirement behaviors (V-01..V-13) were already COVERED by green tests written during execution — no gaps to fill, no auditor spawn required. V-14 is correctly out of this phase's scope (Phase 15 e2e). `nyquist_compliant: true`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 21s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-02
