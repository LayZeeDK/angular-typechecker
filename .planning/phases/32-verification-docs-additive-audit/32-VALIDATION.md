---
phase: 32
slug: verification-docs-additive-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Requirements: VER-02 (integration + SARIF schema validation + byte-stability),
> VER-03 (shipped-tarball e2e, three adapters, stdout-purity, exit-code parity),
> ADD-01 (additive-only audit vs `@0.2.2`), DOC-01 (README + CHANGELOG + drift-lock).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vite.config.ts` + `vitest.workspace.ts` |
| **Quick run command** | `npx nx test angular-typechecker` (Unit tier, `dependsOn: build`) |
| **Integration command** | `npx nx integration angular-typechecker` (real cold `@angular/compiler-cli`) |
| **e2e command** | `npx nx run-many -t e2e --parallel=2` (packed tarball + Verdaccio; per-project CI matrix) |
| **Full suite command** | `npx nx test angular-typechecker && npx nx integration angular-typechecker && npx nx lint angular-typechecker && npx nx typecheck angular-typechecker && npx nx format:check` |
| **Estimated runtime** | Unit ~20s · Integration ~60s · e2e ~6min |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (+ `nx integration` when the task touches an integration spec).
- **After every plan wave:** Run the full suite (test + integration + lint + typecheck + format:check); run the affected e2e project for VER-03 tasks.
- **Before `/gsd:verify-work`:** Full suite green, including `nx lint` at `maxWarnings:0` (the ADD-01 `@nx/dependency-checks` re-confirmation) and `nx typecheck` (the `index.drift.ts` barrel + spec tsconfigs — recall `nx test` does NOT type-check specs).
- **Max feedback latency:** ~60 seconds (Unit + Integration); e2e is wave-level.

---

## Per-Task Verification Map

*Filled during `/gsd:validate-phase` by gsd-nyquist-auditor once plans exist. Observable proofs per requirement:*

| Requirement | Observable proof | Test tier |
|-------------|------------------|-----------|
| VER-02 | committed-fixture JSON + SARIF emitted; SARIF validates against SARIF 2.1.0 schema (dev-only `ajv`); redacted payloads byte-stable across the 6-cell matrix incl. Windows path -> forward-slash URI | Integration (`*.integration.spec.ts`) |
| VER-03 | shipped tarball emits valid JSON + schema-valid SARIF via Nx executor, `ng run`, CLI `--format`; stdout payload parses (stdout-purity); exit code identical across human/json/sarif | e2e (packed tarball + Verdaccio) |
| ADD-01 | `git diff angular-typechecker@0.2.2..HEAD` shows only additions on the published surface; `index.drift.ts` tsc green; `nx lint` green with only `node-sarif-builder` added to `dependencies` (ajv dev-only); `32-ADDITIVE-AUDIT.md` records the verdict | Unit (drift tsc) + audit doc + `nx lint` |
| DOC-01 | README `## Machine-readable output` present; docs content tripwire drift-locks flag/claims vs `HELP_TEXT`/payload shape; curated undated CHANGELOG `0.2.3` entry; `package.json` stays `0.2.2` | Unit (`*-docs.spec.ts`) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ajv` + `ajv-formats` installed as **workspace-root devDependencies** (never plugin `dependencies` — ADD-01) + a committed SARIF 2.1.0 schema JSON fixture.
- [ ] A shared `validate-sarif` / `redactVolatile` / `runShimSplit` test-util home (per RESEARCH).

*Otherwise: existing Vitest/integration/e2e infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-OS/Node byte-stability | VER-02 | The redacted-payload byte match is asserted per-cell in the automated matrix; the CROSS-cell equality is observed by CI running the same spec on all 6 cells | Confirm the 6-cell CI matrix is green on the same redacted snapshot |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
