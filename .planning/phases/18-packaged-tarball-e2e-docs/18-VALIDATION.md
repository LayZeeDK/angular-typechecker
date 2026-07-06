---
phase: 18
slug: packaged-tarball-e2e-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 18 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 18-RESEARCH.md "Validation Architecture". SB-07 docs are prose-only
> (verified in code review, no automated assertion).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit/integration); `e2e/angular-typechecker-install-e2e/vitest.config.mts` (e2e, serialized singleFork) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test --parallel=1` (adds the serialized e2e project; `--parallel=1` prevents the shared-tarball race) |
| **Estimated runtime** | ~30-60s quick (unit + cold-compiler integration); e2e adds minutes (real install + nested nx) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (fast unit + integration)
- **After every plan wave:** the above + `npx nx test angular-typechecker-install-e2e` for the e2e wave
- **Before `/gsd:verify-work`:** `npx nx run-many -t test --parallel=1` green, PLUS `npx nx run-many -t format:check` and `npx nx run-many -t lint` (both required CI gates at `maxWarnings:0`, per [[verify-format-and-lint-before-release]])
- **Max feedback latency:** ~60 seconds for the unit/integration loop (e2e is a per-wave gate, not per-task)

---

## Per-Task Verification Map

> Provisional pre-planning map (requirement-level). `/gsd:validate-phase` fills exact task IDs post-execution.

| Req / T | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T11 / D-01 detect | 1 | SB-06 | - | Names consumer's OWN declared files only (no dep error text) | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| T11 / D-01 verdict-green | 1 | SB-06 | - | field set + 0 errors -> `{success:true, outcome:'clean'}` (negative) | unit | `npx nx test angular-typechecker` | ⚠️ extend evaluate-result.spec.ts | ⬜ pending |
| T11 / D-01 notice fires | 1 | SB-06 | - | fixture with declared `.mdx` -> notice fires, verdict clean | integration | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| T9 (criterion 2) | 1 | SB-06 | - | `paths`-alias aggregated import compiles clean, no spurious TS2307 | integration | `npx nx test angular-typechecker` | ❌ W0 (fixture + spec) | ⬜ pending |
| T6 | 1 | SB-06 | - | story-less / flat config -> NOT a silent clean pass (90001 or coverage-incomplete) | integration | `npx nx test angular-typechecker` | ❌ W0 (fixture + spec) | ⬜ pending |
| T5 (thin) | 1 | SB-06 | - | `node_modules` diag suppressed-by-default + `suppressedThirdParty>0`; folded under `includeDeps` | integration | `npx nx test angular-typechecker` | ⚠️ verify-then-extend | ⬜ pending |
| T10 (thin) | 1 | SB-06 | - | host with only `.storybook` leaf: story error FAILS, no 90001 (ZERO_ROOT_NAMES absent) | integration | `npx nx test angular-typechecker` | ⚠️ extend layout-b flow | ⬜ pending |
| SB-06 C1 | 2 | SB-06 | T-supply-chain | shipped tarball catches planted story error (Layout A + B); NO ERR_REQUIRE_ESM; NO infra error; SB10 `--legacy-peer-deps` isolated, tarball install override-free (B-03) | e2e | `npx nx test angular-typechecker-install-e2e` | ❌ W0 (fixtures + spec) | ⬜ pending |
| SB-07 | 3 | SB-07 | - | README claim (MUST/MUST-NOT/caveat) + Limitations WR-01 fix + CHANGELOG 0.1.2 prose + green->red callout | manual/prose | code review (no automated assertion) | ⚠️ edit existing docs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/extend*

---

## Wave 0 Requirements

- [ ] `packages/angular-typechecker/src/core/<d-01-detection>.spec.ts` — pure `.tsx`/`jsx` detection (stack-independent)
- [ ] `packages/angular-typechecker/src/core/*.integration.spec.ts` (new, e.g. `not-type-checked` or a Storybook integration spec) — `.mdx` enumeration + green-verdict proof (T11)
- [ ] `packages/angular-typechecker/src/core/evaluate-result.spec.ts` — ADD the negative "field-set-but-clean" case
- [ ] `fixtures/` additions for T6 (story-less/flat), T9 (`paths`-alias aggregated), T11 (declared `.mdx`; A1 — use a JSX-free `.tsx` or `.mdx` for the green demo)
- [ ] `e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-{a,b}` — committed generator-shaped Storybook fixtures (produced once by a real generator, committed minus node_modules)
- [ ] `e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts` — criterion 1 (new FILE in the existing serialized project; never a new e2e project)
- [ ] T5 verification: confirm no existing spec covers node_modules-suppressed + `suppressedThirdParty>0` + `includeDeps` foldback before writing a new one

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README coverage claim + caveats accuracy | SB-07 | Prose correctness against the board CONSENSUS.md claim is a human/code-review judgment, not an assertion | Code review checks the MUST/MUST-NOT/caveat wording matches `research/v0.1.2-storybook/board/CONSENSUS.md`; Limitations WR-01 fix present; `.mdx`/`.tsx`/Layout-C/leaf-tsconfig/force-install caveats present |
| CHANGELOG 0.1.2 green->red callout | SB-07 | Prose framing; no runtime assertion | Code review confirms the false-pass -> true-fail callout and NO release cut (no version bump/tag) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (SB-07 docs are the sole manual/prose exception)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit/integration loop)
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by `/gsd:validate-phase`)

**Approval:** pending
