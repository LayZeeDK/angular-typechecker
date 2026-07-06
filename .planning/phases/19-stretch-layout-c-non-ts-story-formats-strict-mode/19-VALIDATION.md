---
phase: 19
slug: stretch-layout-c-non-ts-story-formats-strict-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 19 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft skeleton; the per-task map is filled by the Nyquist auditor during
> /gsd-validate-phase (post-execution).

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

*Draft -- filled by the Nyquist auditor during /gsd-validate-phase. Expected observables (from RESEARCH.md ## Validation Architecture):*

| Item shipped | Observable that proves it | Test Type | Automated Command |
|---|---|---|---|
| strict-mode gate | a dropped in-graph WARNING passes clean without `strict`, FAILs with `strict:true` (real clean->fail flip; A1) | unit | `nx test angular-typechecker` |
| strict option surface | schema.json + schema.d.ts + `schema-parity.spec.ts` EXPECTED_KEYS all carry `strict` | unit | `nx test angular-typechecker` |
| Composition fixture | a broken composed `*.stories.ts` FAILs via its own project target; a clean host passes | e2e | Composition spec in `angular-typechecker-install-e2e` |
| Composition refs typo | a mistyped host `main.ts` `refs` entry FAILs | e2e | Composition spec |
| `dependsOn: ["^typecheck"]` recipe | fanning out `typecheck` from the host covers composed projects | e2e/unit | recipe test |
| Docs | README `## Storybook` carries the Composition section + coverage MUST/MUST-NOT + Layout C note + Angular-CLI planned/deferred caveat | source assertion | grep in a docs spec |

*Status legend (ASCII): pending / green / red / flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase items (Vitest unit + the shared `angular-typechecker-install-e2e` project). No new framework install. The Composition e2e spec is a NEW file inside the EXISTING e2e project (never a new e2e project -- shared-tarball serialization).

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| OSS real-repo tarball verification (all layouts + Composition) | Network + real `--legacy-peer-deps` installs + off-stack repos; informational per board D5, NOT a CI gate | Post-phase checklist: clone + install the packed tarball into the targets in `.planning/research/v0.1.2-storybook/OSS-CANDIDATES.md`; confirm a planted `*.stories.ts` error FAILs + clean passes |

---

## Validation Sign-Off

- [ ] All shipped items have an automated verify or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable
- [ ] `nyquist_compliant: true` set in frontmatter (by the auditor)

**Approval:** pending
