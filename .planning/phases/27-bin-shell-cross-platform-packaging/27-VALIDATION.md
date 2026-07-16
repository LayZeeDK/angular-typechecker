---
phase: 27
slug: bin-shell-cross-platform-packaging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 27 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft skeleton created by plan-phase; the per-task map is completed by
> `/gsd-validate-phase` (gsd-nyquist-auditor) after execution. Status legend is
> ASCII (this repo is ASCII-only): `[ ]` pending, `[x]` green, `[!]` red, `[~]` flaky.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit `test` tier) + `vitest.integration.config.mts` (integration) + `e2e/angular-typechecker-install-e2e/vitest.config.mts` (tarball audit) |
| **Quick run command** | `nx test angular-typechecker` (dependsOn: build) |
| **Full suite command** | `nx run-many -t build test integration lint` + `nx e2e angular-typechecker-install-e2e` |
| **Estimated runtime** | unit ~a few s (dist read); integration ~cold-compiler; e2e ~Verdaccio pack+install |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker`
- **After every plan wave:** Run `nx run-many -t build test lint` on the package
- **Before `/gsd:verify-work`:** Full suite (build + test + integration + lint + format:check) must be green
- **Max feedback latency:** the `test` tier is a dist byte-read (fast); the tarball e2e is the slow tail

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CLI-01 / PKG-01 / PKG-02 / VER-03 / ADD-01 | see PLAN threat_model | N/A (dev tool, no network/secrets) | unit / e2e / static | `nx test angular-typechecker` / `nx e2e angular-typechecker-install-e2e` | [ ] W0 | [ ] pending |

*Populated by gsd-nyquist-auditor during `/gsd-validate-phase`. Requirement-to-tier map (from 27-RESEARCH.md Validation Architecture): VER-03 `bin-static.spec.ts` in the `test` tier (built-`bin.js` shebang byte-check + static nx-free require-graph walk); PKG-01 publint bin audit extends the `e2e`-tier `tarball-audit.e2e.spec.ts`; PKG-02 covered by the built-artifact ESM-bridge assertion (no `require()` of `@angular/compiler-cli`, shared with gate-a-static); CLI-01 the `bin` map + shebang on the packed tarball; ADD-01 the barrel-drift tripwire (`test`/`typecheck` tier) + the git-diff audit doc; the `src/cli/**` ESLint import-ban is a lint-time guard. Deferred to Phase 28: the install-and-run e2e for literal 0/1/2 through the `.bin` shim + the real-clone UAT.*

---

## Wave 0 Requirements

- [ ] `bin-static.spec.ts` -- new VER-03 static guard (shebang + nx-free require graph on the built `bin.js`)
- [ ] Tarball-audit extension -- publint bin audit added to the existing `tarball-audit.e2e.spec.ts`

*Existing infrastructure (Vitest tiers, `gate-a-static.spec.ts` model, drift tripwire, tarball-audit spec) covers the rest -- no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none this phase) | -- | -- | -- |

*All phase-27 behaviors have automated verification. The real-clone shipped-bin UAT is Phase 28 (VER-05), not this phase.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable for the tier
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
