---
phase: 14
slug: configuration-init-generators-nx-add
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `14-RESEARCH.md` § Validation Architecture. All Phase 14 proof is
> in-plugin UNIT on the public in-memory `createTreeWithEmptyWorkspace` substrate
> (board D1 / D-12); end-to-end / tarball proof is Phase 15 (GE2E-01..03, GUARD-01),
> NOT this phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (existing; `src/generators/**/*.spec.ts` auto-discovered) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx run-many -t test` (or the unchanged 6-cell CI `test` matrix) |
| **Estimated runtime** | ~5-15 seconds (in-memory Tree specs; no real compiler, no `nx build` needed) |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx test angular-typechecker` + `nx lint angular-typechecker` (the lint run validates `generators.json` via `@nx/nx-plugin-checks` — a free registration-correctness lever)
- **Before `/gsd:verify-work`:** Full `test` suite green AND `nx build angular-typechecker` green (proves the compiled `generator.js` emits and the tarball ships the generators)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Plans not yet written — task IDs are filled by `/gsd:validate-phase` after execution.
> Rows below map each requirement to its observable behavior + automated command so the
> planner's Wave 0 (test files) is unambiguous.

| Item | Requirement | Behavior (observable) | Test Type | Automated Command | File (Wave 0) | Status |
|------|-------------|-----------------------|-----------|-------------------|---------------|--------|
| V-01 | GEN-01/02 | `configuration` writes ONE target `{ executor: 'angular-typechecker:typecheck', options.tsConfig }` at the SOLUTION `tsconfig.json` (project has `references[]`), workspace-root-relative path | unit | `nx test angular-typechecker` | ❌ `src/generators/configuration/configuration.spec.ts` | ⬜ pending |
| V-02 | GEN-02 | Flat-project fallback: no solution `tsconfig.json` / no `references` → target points at `tsconfig.lib.json` (library) / `tsconfig.app.json` (application) by `projectType` + existence probe | unit | same | ❌ (same file) | ⬜ pending |
| V-03 | GEN-02 | `--tsConfig` override honored (resolved project-root-relative via `joinPathFragments`) | unit | same | ❌ (same file) | ⬜ pending |
| V-04 | GEN-02 | No resolvable tsconfig → clear located error | unit | same | ❌ (same file) | ⬜ pending |
| V-05 | GEN-04 | Re-run idempotent for OUR target (no dup, same shape); non-ours same-named target → thrown located error | unit | same | ❌ (same file) | ⬜ pending |
| V-06 | GEN-03 | Solution path points at `tsconfig.json` (so WALK-01 walks the spec leaf) — assert target points at the solution tsconfig, not a spec-specific target | unit | same | ❌ (same file) | ⬜ pending |
| V-07 | GEN-08 | Running `configuration` alone seeds `targetDefaults` (proves it invokes `init`) | unit | same | ❌ (in `configuration.spec.ts`) | ⬜ pending |
| V-08 | GEN-07 | `init` seeds `targetDefaults['angular-typechecker:typecheck']` = WALK-02 block: `cache:true`, `outputs:[]`, inputs start with `default`, NOT `production` | unit | `nx test angular-typechecker` | ❌ `src/generators/init/init.spec.ts` | ⬜ pending |
| V-09 | GEN-07 | `init` idempotent re-run (seeded block unchanged) | unit | same | ❌ (same file) | ⬜ pending |
| V-10 | GEN-07 | `init` does NOT clobber a pre-existing customized entry (whole-entry `??=`) | unit | same | ❌ (same file) | ⬜ pending |
| V-11 | GEN-05 | Schema parity: `keys(schema.json.properties)` === `schema.d.ts` interface keys, per generator | unit | same | ❌ `configuration/schema-parity.spec.ts`, `init/schema-parity.spec.ts` | ⬜ pending |
| V-12 | GEN-05 | `generators.json` registration valid (factory/schema paths resolve, schemas well-formed) | lint | `nx lint angular-typechecker` (`@nx/nx-plugin-checks`) | ✅ rule exists; passes once `generators.json` correct | ⬜ pending |
| V-13 | GEN-05 | `package.json` `generators === './generators.json'` AND `files` includes `'generators.json'`; build asset glob ships it | unit (manifest) | extend `src/package-manifest.spec.ts` | ⚠️ Wave 0: add assertions | ⬜ pending |
| V-14 | GEN-09 | `nx add angular-typechecker` runs `init` on install (seed on install) | **e2e — Phase 15 (GE2E-03)** | Phase 15 install-e2e | Not this phase | — deferred |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/generators/configuration/configuration.spec.ts` — solution write, flat fallback, `--tsConfig`, no-resolvable error, idempotency, non-ours collision, init-invoked (GEN-01/02/03/04/08)
- [ ] `src/generators/configuration/schema-parity.spec.ts` — key parity (GEN-05)
- [ ] `src/generators/init/init.spec.ts` — seed shape, idempotent, don't-clobber, `default`-not-`production` (GEN-07)
- [ ] `src/generators/init/schema-parity.spec.ts` — key parity (GEN-05)
- [ ] Packaging assertions — extend `src/package-manifest.spec.ts` (or a new spec) to assert `package.json.generators === './generators.json'` and `files` includes `'generators.json'` (GEN-05)
- [ ] Framework install: none (Vitest + `@nx/devkit/testing` already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `nx add angular-typechecker` seeds `targetDefaults` on install | GEN-09 | Requires the published/packed tarball + a real install; cannot run against the in-memory Tree | Deferred to Phase 15 GE2E-03 (install-e2e); not manual in this phase |

*All Phase 14 behaviors have automated (unit/lint) verification; the only install-time behavior (GEN-09) is proven by Phase 15's e2e, not manually.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
