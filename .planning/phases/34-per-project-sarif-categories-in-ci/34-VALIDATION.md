---
phase: 34
slug: per-project-sarif-categories-in-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 34 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Status legend (ASCII): `pending` / `green` / `red` / `flaky`; File Exists: `yes` / `no (W0)`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit `test` target) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test` then `npx nx run-many -t typecheck` (spec type-checking -- `nx test`/esbuild does NOT type-check specs) |
| **Estimated runtime** | ~30-60 seconds (unit tier) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (the two new specs)
- **After every plan wave:** Run `npx nx run-many -t test` + `npx nx run-many -t typecheck`
- **Before `/gsd:verify-work`:** Full `test` + `typecheck` + `lint` (maxWarnings:0) + `format:check` green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Task IDs are assigned at planning (step 8); this map is requirement-oriented until PLAN.md exists.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-TBD | TBD | 1 | MULTI-01 | -- | Merge of N single-run files -> one file with N `runs[]`, each `automationDetails.id = angular-typecheck/<name>`; empty/0-run inputs skipped; SARIF envelope preserved | unit | `npx nx test angular-typechecker` | no (W0) | pending |
| 34-TBD | TBD | 1 | MULTI-02 | T-34 silent-drop | Discovery name-set === independent enumeration (excludes `e2e/*/fixtures/` AND workspace-root `@angular-typechecker/source`); discovery throws on empty set | unit (drift guard) | `npx nx test angular-typechecker` | no (W0) | pending |
| 34-TBD | TBD | 1 | MULTI-02 | -- | Discovery tolerates a stray dir / falsy name / missing `apps` or `libs` (robustness; mirrors the B3 test in `ci-e2e-coverage-guard.spec.ts`) | unit | `npx nx test angular-typechecker` | no (W0) | pending |

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` -- the MULTI-02 drift guard (D-04): discovery output == independent root-agnostic enumeration (subtract e2e fixtures + root project).
- [ ] A merge-shape unit spec for `tools/ci/merge-sarif.mjs` -- MULTI-01: write fake single-run SARIF parts to a temp dir (or stub the CLI spawn), assert merged `runs[]` count + per-run `automationDetails.id` + empty-input skip. May share the guard spec file or a sibling; mirror the `execFileSync`/temp-root style of `ci-e2e-coverage-guard.spec.ts`'s B3 test.
- Framework install: NONE (Vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merged file is ACCEPTED by GitHub and lands as N distinct analyses `angular-typecheck/<project>` | MULTI-01 (end-to-end) | GitHub Code Scanning ingestion is asynchronous + server-side; local schema-validate / actionlint / act-compat all pass while GitHub can still reject (multi-run-same-category class). Not locally provable. | On a PR, `gh api repos/LayZeeDK/angular-typechecker/code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` and assert one analysis per `angular-typecheck/<project>` category. Phase 35 (PROOF) automates this. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the two new specs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
