---
phase: 19
slug: stretch-layout-c-non-ts-story-formats-strict-mode
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
updated: 2026-07-07
---

# Phase 19 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per-task map filled by the post-execution Nyquist audit (/gsd-validate-phase).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vite.config.ts` (unit); e2e via the `angular-typechecker-install-e2e` project |
| **Quick run command** | `nx test angular-typechecker` |
| **Full suite command** | `nx run-many -t test,lint,build` + the packaged-tarball e2e (`--parallel=1`) |
| **Estimated runtime** | ~30-90 s unit; e2e minutes (Verdaccio + `--legacy-peer-deps` installs) |

---

## Sampling Rate

- **After every task commit:** Run `nx test angular-typechecker` (unit) for the strict-mode + schema-parity edits.
- **After every plan wave:** Run the full unit suite + lint + build; the Composition e2e spec runs in the serialized `angular-typechecker-install-e2e` project (`--parallel=1` -- shared tarball).
- **Before phase verification:** Full suite green; `format:check` + `lint` (maxWarnings:0) clean.
- **Max feedback latency:** ~90 s for the unit signal.

---

## Per-Task Verification Map

*Audited post-execution. Every shipped item has a green automated test; all
ran green across the CI 6-cell matrix + e2e job (runs 28830318393 / 28831454836).*

| Item shipped | Observable that proves it | Test Type | Test file | Status |
|---|---|---|---|---|
| strict-mode gate | a dropped in-graph WARNING passes clean without `strict`, FAILs with `strict:true` (real clean->fail flip; A1) | unit | `evaluate-result.spec.ts` (FLIP + ERROR regression guard) | green |
| strict option surface | schema.json + schema.d.ts + `schema-parity.spec.ts` EXPECTED_KEYS all carry `strict` | unit | `schema-parity.spec.ts` | green |
| Composition fixture | a broken composed `*.stories.ts` FAILs via its own project target; a clean host passes | e2e | `storybook-composition.int.spec.ts` | green |
| Composition refs typo | a mistyped host `main.ts` `refs` entry FAILs (via the consumer `CompositionRef` shape, not Storybook's `any`-typed `refs`) | e2e | `storybook-composition.int.spec.ts` | green |
| `dependsOn: ["^typecheck"]` recipe | fanning out `typecheck` from the host covers composed projects | e2e | `storybook-composition.int.spec.ts` (fan-out scenario) | green |
| Docs | README `## Storybook` carries the Composition section + coverage MUST/MUST-NOT + Layout C note + Angular-CLI planned/deferred caveat | source assertion | `storybook-docs.spec.ts` (content tripwire) | green |

*Status legend (ASCII): pending / green / red / flaky*

---

## Wave 0 Requirements

- Existing infrastructure covered all phase items (Vitest unit + the shared `angular-typechecker-install-e2e` project). No new framework install. The Composition e2e spec is a NEW file inside the EXISTING e2e project (never a new e2e project -- shared-tarball serialization).

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| OSS real-repo tarball verification (all layouts + Composition) | Network + real `--legacy-peer-deps` installs + off-stack repos; informational per board D5, NOT a CI gate | Post-phase checklist: clone + install the packed tarball into the targets in `.planning/research/v0.1.2-storybook/OSS-CANDIDATES.md`; confirm a planted `*.stories.ts` error FAILs + clean passes |

---

## Validation Audit 2026-07-07

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 6 shipped observables map to an existing green automated test; no MISSING or
PARTIAL gaps, so no tests were generated. Coverage was cross-confirmed by the
phase verifier (17/17), the deep code review (0 blockers), and the green CI e2e
job. The one manual-only item (OSS real-repo tarball spot-check) is informational
per board D5, not a CI gate.

---

## Validation Sign-Off

- [x] All shipped items have an automated verify or Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable
- [x] `nyquist_compliant: true` set in frontmatter (by the auditor)

**Approval:** nyquist-compliant (2026-07-07)
