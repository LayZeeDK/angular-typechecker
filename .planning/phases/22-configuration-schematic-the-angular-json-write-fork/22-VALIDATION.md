---
phase: 22
slug: configuration-schematic-the-angular-json-write-fork
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 22 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (fast tier) |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx test angular-typechecker && nx lint angular-typechecker && nx typecheck angular-typechecker && nx build angular-typechecker` |
| **Estimated runtime** | ~15 seconds (fast tier; write-fork is a pure virtual-Tree op, no `@angular/compiler-cli` load) |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx test angular-typechecker && nx lint angular-typechecker && nx typecheck angular-typechecker`
- **Before `/gsd:verify-work`:** Full suite must be green (add `nx build` + `format:check`)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-* | 01 | 1 | ACS-01 | T-22-01 (malformed angular.json / collision) | CLI fork writes `architect.typecheck = { builder, options.tsConfig: [buildLeaf, specLeaf] }` on an `angular.json`-seeded tree; config-edit-only, no emitted file | unit | `nx test angular-typechecker` | ❌ W0 (`configuration-angular-cli.spec.ts`) | ⬜ pending |
| 22-01-* | 01 | 1 | ACS-01 | T-22-02 (idempotency) | Idempotent re-run of OUR target preserves user keys + extra options; re-asserts id + tsConfig | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 22-01-* | 01 | 1 | ACS-01 | T-22-01 (collision) | Same-named NON-ours `builder` target throws a located error; empty/whitespace `--targetName` rejected; `--tsConfig` override honored; single-leaf edge emits `[buildLeaf]`; no-leaf throws | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 22-01-* | 01 | 1 | ACS-02 | — | Nx path byte-unchanged: single-string solution `tsConfig` via `project.json`; init seeds targetDefaults | unit | `nx test angular-typechecker` | ✅ (`configuration.spec.ts` stays green) | ⬜ pending |
| 22-01-* | 01 | 1 | ACS-02 | — | CLI branch creates NO stray `nx.json` (init skipped) — assert `!tree.exists('nx.json')` | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 22-01-* | 01 | 1 | COV-01 | T-22-03 (silent under-coverage) | On a TWO-project (app + lib) seeded tree, each target's `tsConfig` array equals EXACTLY that project's leaves; no other project's leaves appear | unit | `nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| 22-02-* | 02 | 1 | ACS-04 | — | `package.json` keeps `generators` + adds `schematics`; `collection.json` declares `configuration`; `nx g` resolves via `generators ?? schematics` | unit | `nx test angular-typechecker` | ❌ W0 (`nx-generators-surface-regression.spec.ts`) | ⬜ pending |
| 22-02-* | 02 | 1 | ACS-04 | — | Manifest/plugin validity (`collection.json` + `schematics` field) | lint | `nx lint angular-typechecker` | ✅ (`@nx/nx-plugin-checks` + `@nx/dependency-checks`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*(Plan/task IDs are indicative — the planner assigns final IDs; the requirement→test mapping is the binding part.)*

---

## Wave 0 Requirements

- [ ] `src/generators/configuration/configuration-angular-cli.spec.ts` — write-fork on an `angular.json`-seeded tree: ACS-01 (target shape, idempotency, collision, targetName/override/edge cases), ACS-02 (no stray `nx.json`), COV-01 (per-project scoping, no cross-project bleed). Seed the CLI substrate with `createTreeWithEmptyWorkspace()` then `tree.delete('nx.json')` + `tree.write('angular.json', ...)` + write leaf tsconfigs; assert `tree.exists('angular.json') === true` AND `tree.exists('nx.json') === false`.
- [ ] `src/schematics/configuration/nx-generators-surface-regression.spec.ts` — `generators ?? schematics` static regression, mirroring `src/builders/typecheck/nx-surface-regression.spec.ts`. Covers ACS-04.
- [ ] (OPTIONAL) a schematic structural/schema-reuse assertion pinning `collection.json` factory/schema paths — not required for the requirement set.
- Framework install: NONE — Vitest infrastructure exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `ng generate angular-typechecker:configuration <project>` against the cloned `bluehalo/ngx-leaflet` workspace writes the expected leaf arrays | COV-01 / ACS-01 (confidence check) | Requires an external uncommitted clone + installed Angular CLI; not CI-authoritative | In `D:\projects\github\bluehalo\ngx-leaflet` @ 818e9ae: run the schematic; confirm `angular.json` gains `architect.typecheck` with `["tsconfig.app.json","tsconfig.spec.json"]` (app) and `["projects/ngx-leaflet/tsconfig.lib.json","projects/ngx-leaflet/tsconfig.spec.json"]` (lib). The CI-authoritative proof is the seeded-tree unit test; the real `ng g library` scaffold proof is Phase 24 (ACV-02). |

*All CI-authoritative Phase-22 behaviors have automated (fast-tier Vitest) verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
