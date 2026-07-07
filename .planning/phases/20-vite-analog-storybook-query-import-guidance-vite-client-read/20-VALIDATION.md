---
phase: 20
slug: vite-analog-storybook-query-import-guidance-vite-client-read
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 20 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 20-RESEARCH.md `## Validation Architecture`. SB-09: two signals + charter guard.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx test angular-typechecker` (single project; add `--coverage` for the CI gate) |
| **Estimated runtime** | ~30 seconds (one cold-compiler integration spec inherits `testTimeout 30000`) |
| **Also-required CI gates (AGENTS.md)** | `npx nx run angular-typechecker:lint` (maxWarnings 0) + Prettier `format:check` -- run before the Release PR |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (touched specs run well under 30s except the one cold-compiler integration spec)
- **After every plan wave:** Run `npx nx test angular-typechecker` + `lint` + Prettier `format:check` on the merged tree
- **Before `/gsd:verify-work`:** Full suite + lint + format green (Gate A CI), then Gate B manual verify
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Task IDs are TBD until the planner assigns waves/plans; rows are keyed to SB-09 sub-decisions and the RESEARCH.md test map. The nyquist-auditor refines Task IDs post-plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | SB-09 / D-02 | T-20 ReDoS (V5) | linear `[^']+` regex, gated on `code===2307` | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | SB-09 / D-06(a) | — | plain missing (no `?`) NOT flagged | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | SB-09 / Pitfall 2 | — | non-2307 (2732/2792) "cannot find module" gated out | unit | `npx nx test angular-typechecker` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | SB-09 / D-05 | verdict integrity | `evaluateResult` never reads the field (verdict-neutral) | unit | `npx nx test angular-typechecker` | ✅ (add to `evaluate-result.spec.ts`) | ⬜ pending |
| TBD | 02 | 2 | SB-09 / D-04 | info-disclosure isolation | executor emits ONE `logger.warn` (count + `vite/client` + ADVISORY); silent when undefined | unit (mocked logger) | `npx nx test angular-typechecker` | ✅ (add to `executor.spec.ts`) | ⬜ pending |
| TBD | 01 | 1 | SB-09 / D-06(b) + self-gating | verdict integrity | REAL compile: field non-empty AND `?query` TS2307 KEPT (errorCount includes them) on baseline leg; `undefined` on `vite/client` leg; plain missing still TS2307 on both | integration | `npx nx test angular-typechecker` | ❌ W0 (`bundler-query-imports.integration.spec.ts` + `fixtures/vite-query-imports/`) | ⬜ pending |
| TBD | 03 | — | SB-09 / Signal 1 | — | README caveat LEADS with `"types": ["vite/client"]`, names hand-shim fallback + blind spot + Signal-2 cross-ref + never-auto-suppressed | manual review + lint/format | `npx nx run angular-typechecker:lint`; manual read | `packages/angular-typechecker/README.md` | ⬜ pending |
| TBD | — | — | SB-09 / Gate A | — | branch pushed, PR opened, required CI green | manual/CI | GitHub Actions `ci` + CodeQL | — | ⬜ pending |
| TBD | — | — | SB-09 / Gate B (D-10) | verdict integrity (real repo) | locally-packed dist tarball into `radix-ng/primitives`: advisory fires on unresolved `?query` TS2307, `"types": ["vite/client"]` drives them to 0, plain missing still fails | manual/interactive | `nx build` -> `npm pack` dist -> install into external radix checkout | external checkout, NOT committed | ⬜ pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/core/detect-bundler-query-imports.ts` -- the pure detector (source; NOT exported from `index.ts`)
- [ ] `src/core/detect-bundler-query-imports.spec.ts` -- unit tier (D-02, D-06(a), Pitfall 2, empty-set baseline)
- [ ] `fixtures/vite-query-imports/` (workspace-root `fixtures/` dir, resolved via `findWorkspaceRoot` -- same as `fixtures/not-type-checked-mdx/`) -- hermetic fixture: `tsconfig.base.json`, a `baseline` tsconfig, and a `vite/client` tsconfig over shared story sources with `?raw`/`?url`/`?worker`/`?inline` + one plain-missing control; optional hand-shim leg
- [ ] `src/core/bundler-query-imports.integration.spec.ts` -- real-compiler integration tier
- [ ] Extend `src/core/evaluate-result.spec.ts` -- verdict-neutrality tripwire
- [ ] Extend `src/executors/typecheck/executor.spec.ts` -- render + silent-when-undefined
- No new framework install needed (Vitest + vite 8.1.0 + compiler-cli 22.0.4 all present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README caveat prose (leads with fix, honest blind spot) | SB-09 / Signal 1 | Prose quality + accuracy not machine-assertable beyond lint/format | Read the restructured `## Storybook` Vite bullet; confirm it leads with `"types": ["vite/client"]`, names the hand-shim fallback, documents the wildcard blind spot, cross-refs the new field, reaffirms never-auto-suppressed |
| Gate A -- PR pushed + green CI | SB-09 (user gate) | Requires the GitHub PR + Actions run | Push branch, open PR into `main`, wait for `ci` + CodeQL `Analyze` checks green |
| Gate B -- real-OSS tarball verify | SB-09 / D-10 (user gate) | External large `radix-ng/primitives` checkout; not CI-appropriate | `nx build` -> `npm pack` on dist -> install the tarball into a radix-ng checkout (pnpm `allowBuilds`/`--ignore-scripts` workaround); confirm the advisory fires on the unresolved `?query` TS2307, `"types": ["vite/client"]` drives them to 0, plain missing still fails. NOT committed. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
