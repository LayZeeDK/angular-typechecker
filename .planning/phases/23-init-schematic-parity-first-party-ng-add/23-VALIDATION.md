---
phase: 23
slug: init-schematic-parity-first-party-ng-add
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
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
| TBD | TBD | TBD | NGADD-01 | — | ng-add auto-wires app+lib only, idempotent, skips existing/e2e | integration | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACS-03 | — | init schematic seeds no caching, no stray nx.json off-Nx | integration | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACP-01 | — | optional peers declared, `@nx/dependency-checks` green | lint | `npx nx lint angular-typechecker` | ❌ W0 | ⬜ pending |

*Status: pending · green · red · flaky. Concrete task IDs assigned during planning; per-task rows completed by `/gsd-validate-phase`.*

---

## Wave 0 Requirements

- [ ] `src/schematics/ng-add/*.spec.ts` — auto-wire-all + idempotency + skip-existing + no-`angular.json` guard (NGADD-01)
- [ ] `src/generators/init/init-angular-cli.spec.ts` (or extension) — angular.json-seeded init no-op, no stray nx.json (ACS-03)
- [ ] `src/schematics/*/nx-generators-surface-regression.spec.ts` — extend `generators ?? schematics` to the new `init`/`ng-add` entries

*Existing Vitest infrastructure covers the framework; only the new specs above are net-new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `ng add` end-to-end on a live workspace | NGADD-01 | Needs a packed tarball + real Angular CLI clone | Deferred to Phase 24 (ACV-01 tarball e2e against `bluehalo/ngx-leaflet`) |

*In-repo behaviors (auto-wire-all, idempotency, init no-op, dependency-checks) all have automated verification via the `angular.json`-seeded schematics test tree.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
