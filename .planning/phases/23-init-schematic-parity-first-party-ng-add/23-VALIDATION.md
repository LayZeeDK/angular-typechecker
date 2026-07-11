---
phase: 23
slug: init-schematic-parity-first-party-ng-add
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
updated: 2026-07-11
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sample points enumerated in `23-RESEARCH.md` "## Validation Architecture"
> (ng-add auto-wire-all + idempotency + skip e2e/other, init no-stray-nx.json,
> the no-`angular.json` guard, and the optional-peer / `@nx/dependency-checks`-green
> assertion). The planner maps these onto per-plan tasks; `/gsd-validate-phase`
> fills the per-task map post-execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (via `@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vite.config.ts` |
| **Quick run command** | `npx nx test angular-typechecker --skip-nx-cache` |
| **Full suite command** | `npx nx test angular-typechecker && npx nx lint angular-typechecker && npx nx run angular-typechecker:format-check` |
| **Estimated runtime** | ~30-60 seconds (unit/integration; the tarball e2e is Phase 24) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker --skip-nx-cache`
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (`nx lint` includes the `@nx/dependency-checks` gate — ACP-01)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-03 T1/T2 | 23-03 | 2 | NGADD-01 | T-23-01/02b/03/04/05 | ng-add auto-wires app+lib only, idempotent, skips existing (throws on non-ours), skips e2e/other, --project no-match throws, devDep move, notice-once, no-angular.json guard | integration | `npx nx test angular-typechecker` | `src/generators/ng-add/ng-add.spec.ts` (12) | green |
| 23-01 T1/T2 | 23-01 | 1 | ACS-03 | T-23-06/05a | init schematic seeds no caching, no stray nx.json off-Nx (angular.json && !nx.json fork); hybrid workspace takes Nx branch | integration | `npx nx test angular-typechecker` | `src/generators/init/init-angular-cli.spec.ts` (5) + `src/schematics/configuration/nx-generators-surface-regression.spec.ts` (7) | green |
| 23-02 T1/T2 | 23-02 | 1 | ACP-01 | T-23-02/07/08 | optional peers declared (widened to Angular 22 ranges) + `@nx/dependency-checks` green + nx not declared + ng-add.save devDependencies | lint + static | `npx nx lint angular-typechecker` + `npx nx test angular-typechecker` | `src/package-manifest.spec.ts` (20) + `eslint.config.mjs` | green |

*Status: pending · green · red · flaky. All three requirement rows are COVERED by shipped, green specs (314 tests / 36 files at audit time). No MISSING/PARTIAL gaps -> nyquist_compliant.*

---

## Wave 0 Requirements

- [x] `src/generators/ng-add/ng-add.spec.ts` — auto-wire-all + idempotency + skip-existing (throw-on-non-ours) + skip-e2e/other + `--project` no-match throw + devDep move + notice-once + no-`angular.json` guard (NGADD-01)
- [x] `src/generators/init/init-angular-cli.spec.ts` — angular.json-seeded init no-op, no stray nx.json, hybrid (angular.json + nx.json) takes Nx branch (ACS-03)
- [x] `src/schematics/configuration/nx-generators-surface-regression.spec.ts` — `generators ?? schematics` covers the new `init`/`ng-add` entries; `ng-add` absent from generators.json (SC4)

*Existing Vitest infrastructure covers the framework; the net-new specs above all landed green (Wave 0 complete).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `ng add` end-to-end on a live workspace | NGADD-01 | Needs a packed tarball + real Angular CLI clone | Deferred to Phase 24 (ACV-01 tarball e2e against `bluehalo/ngx-leaflet`) |

*In-repo behaviors (auto-wire-all, idempotency, init no-op, dependency-checks) all have automated verification via the `angular.json`-seeded schematics test tree.*

---

## Validation Audit 2026-07-11

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All three phase requirements (NGADD-01, ACS-03, ACP-01) are COVERED by shipped,
green in-repo specs (314 tests / 36 files). No tests needed generating. The only
Manual-Only item is the real `ng add` tarball e2e, deferred to Phase 24 (ACV-01)
by design.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-11
