---
phase: 20
slug: vite-analog-storybook-query-import-guidance-vite-client-read
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
audited: 2026-07-07
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

> Task IDs assigned post-plan by the nyquist audit (2026-07-07). Convention: `20-<plan>-T<task>` for the plan tasks; bare `20-<plan>` for the whole-plan manual gates. Automated rows each cite the green test proving them (see the Validation Audit trail below for exact test names + file:line).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-T1 | 01 | 1 | SB-09 / D-02 | T-20 ReDoS (V5) | linear `[^']+` regex, gated on `code===2307` | unit | `npx nx test angular-typechecker` | yes (`detect-bundler-query-imports.spec.ts`) | green |
| 20-01-T1 | 01 | 1 | SB-09 / D-06(a) | - | plain missing (no `?`) NOT flagged | unit | `npx nx test angular-typechecker` | yes (`detect-bundler-query-imports.spec.ts`) | green |
| 20-01-T1 | 01 | 1 | SB-09 / Pitfall 2 | - | non-2307 (2732/2792) "cannot find module" gated out | unit | `npx nx test angular-typechecker` | yes (`detect-bundler-query-imports.spec.ts`) | green |
| 20-01-T2 | 01 | 1 | SB-09 / D-05 | verdict integrity | `evaluateResult` never reads the field (verdict-neutral) | unit | `npx nx test angular-typechecker` | yes (`evaluate-result.spec.ts`) | green |
| 20-02-T2 | 02 | 2 | SB-09 / D-04 | info-disclosure isolation | executor emits ONE `logger.warn` (count + `vite/client` + ADVISORY); silent when undefined | unit (mocked logger) | `npx nx test angular-typechecker` | yes (`executor.spec.ts`) | green |
| 20-01-T3 | 01 | 1 | SB-09 / D-06(b) + self-gating | verdict integrity | REAL compile: field non-empty AND `?query` TS2307 KEPT (errorCount includes them) on baseline leg; `undefined` on `vite/client` leg; plain missing still TS2307 on both | integration | `npx nx test angular-typechecker` | yes (`bundler-query-imports.integration.spec.ts` + `fixtures/vite-query-imports/`) | green |
| 20-03-T1 | 03 | - | SB-09 / Signal 1 | - | README caveat LEADS with `"types": ["vite/client"]`, names hand-shim fallback + blind spot + Signal-2 cross-ref + never-auto-suppressed | manual review + lint/format | `npx nx run angular-typechecker:lint`; manual read | `packages/angular-typechecker/README.md` | green (manual; verified 20-VERIFICATION truth 1, README.md:433-460) |
| 20-04 | - | - | SB-09 / Gate A | - | branch pushed, PR opened, required CI green | manual/CI | GitHub Actions `ci` + CodeQL | PR #27 (OPEN) | green (manual; met -- 20-VERIFICATION gate_a) |
| 20-05 | - | - | SB-09 / Gate B (D-10) | verdict integrity (real repo) | locally-packed dist tarball into `radix-ng/primitives`: advisory fires on unresolved `?query` TS2307, `"types": ["vite/client"]` drives them to 0, plain missing still fails | manual/interactive | `nx build` -> `npm pack` dist -> install into external radix checkout | external checkout, NOT committed | green (manual; met -- 20-05-SUMMARY, 3/3 legs) |

*Status: pending / green / red / flaky (manual rows: "green (manual)" = recorded + met, not machine-run)*

---

## Wave 0 Requirements

- [x] `src/core/detect-bundler-query-imports.ts` -- the pure detector (source; NOT exported from `index.ts`)
- [x] `src/core/detect-bundler-query-imports.spec.ts` -- unit tier (D-02, D-06(a), Pitfall 2, empty-set baseline) -- 4 tests green
- [x] `fixtures/vite-query-imports/` (workspace-root `fixtures/` dir, resolved via `findWorkspaceRoot` -- same as `fixtures/not-type-checked-mdx/`) -- hermetic fixture: `tsconfig.base.json`, a `baseline` tsconfig, and a `vite/client` tsconfig over shared story sources with `?raw`/`?url`/`?worker`/`?inline` + one plain-missing control; optional hand-shim leg
- [x] `src/core/bundler-query-imports.integration.spec.ts` -- real-compiler integration tier -- 2 tests green
- [x] Extend `src/core/evaluate-result.spec.ts` -- verdict-neutrality tripwire -- 2 cases green (:247, :260)
- [x] Extend `src/executors/typecheck/executor.spec.ts` -- render + silent-when-undefined -- 2 cases green (:521, :545)
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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (6 automated rows green; 3 manual rows recorded + met)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all 6 W0 artifacts exist)
- [x] No watch-mode flags (`vitest run` / `nx test`, non-watch)
- [x] Feedback latency < 30s (targeted 4-file run 1.67s; full suite ~62s dominated by cold-compiler integration specs)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (nyquist audit 2026-07-07 -- all automated rows green, manual rows recorded)

---

## Validation Audit 2026-07-07

Adversarial coverage verification of the pre-execution draft. Stance: assume each row uncovered until a real, green test proves it. The 6 automated rows were RUN (not trusted from the SUMMARY claim); the 3 manual rows were confirmed recorded + met against 20-VERIFICATION.md / 20-05-SUMMARY.md. No missing gaps found -- zero new tests generated.

### How the audit was run

- Targeted run (per-test evidence): `cd packages/angular-typechecker && npx vitest run --reporter=verbose src/core/detect-bundler-query-imports.spec.ts src/core/evaluate-result.spec.ts src/executors/typecheck/executor.spec.ts src/core/bundler-query-imports.integration.spec.ts` -> **4 files, 53 tests passed, 1.67s**.
- Full-suite parity (authoritative): `npx nx test angular-typechecker --skip-nx-cache` -> **47 files, 347 tests passed, ~62s**.

### Automated row -> green test map (verified)

| Task ID | Requirement | Test (name) | File:line | Result |
|---------|-------------|-------------|-----------|--------|
| 20-01-T1 | D-02 (ReDoS-safe linear `[^']+`, `code===2307` gate) | `flags a ?query specifier, deduped + sorted` (exercises the linear regex) + `ignores non-2307 "cannot find module" codes (2732/2792 gated out -- Pitfall 2)` (proves the code gate) | `detect-bundler-query-imports.spec.ts:30`, `:46` | green |
| 20-01-T1 | D-06(a) (plain missing, no `?`, not flagged) | `does NOT flag a plain missing module (no ?) -- D-06(a) no false positive` | `detect-bundler-query-imports.spec.ts:40` | green |
| 20-01-T1 | Pitfall 2 (non-2307 2732/2792 gated out) | `ignores non-2307 "cannot find module" codes (2732/2792 gated out -- Pitfall 2)` | `detect-bundler-query-imports.spec.ts:46` | green |
| 20-01-T2 | D-05 (verdict-neutral -- `evaluateResult` never reads the field) | `stays clean when bundlerQueryImports is non-empty and errorCount 0 -- the SB-09 advisory NEVER flips the verdict` + `stays clean on a non-empty bundlerQueryImports even under maxWarnings 0 (SB-09 advisory)` | `evaluate-result.spec.ts:247`, `:260` | green |
| 20-02-T2 | D-04 (executor ONE `logger.warn`; silent when undefined) | `SB-09 D-04: emits a single logger.warn with the vite/client fix + ADVISORY + specifier when bundlerQueryImports is non-empty` + `SB-09 D-04: does NOT warn when bundlerQueryImports is undefined (self-gating, D-03)` | `executor.spec.ts:521`, `:545` | green |
| 20-01-T3 | D-06(b) + self-gating (real compile) | `flags the ?query specifiers, keeps them as counted errors, and does NOT flag the plain-missing control` (baseline leg) + `leaves bundlerQueryImports undefined yet keeps the plain-missing TS2307 (no false pass)` (vite/client leg) | `bundler-query-imports.integration.spec.ts:58`, `:110` | green |

### Manual rows (recorded + met -- NOT machine-run, by design)

| Task ID | Requirement | Recorded / met evidence |
|---------|-------------|-------------------------|
| 20-03-T1 | Signal 1 README caveat prose | 20-VERIFICATION.md truth 1 VERIFIED (README.md:433-460: leads with `"types": ["vite/client"]`, names the INCOMPLETE hand-shim fallback, documents the wildcard blind spot, cross-refs `bundlerQueryImports`, reaffirms never-auto-suppressed); lint + Prettier `format:check` green (20-03-SUMMARY) |
| 20-04 | Gate A -- PR + green CI | 20-VERIFICATION.md `gate_a: met`: PR #27 OPEN; `ci` + both CodeQL Analyze + full test matrix + e2e + fallow + format-lint all SUCCESS (verified live). Merge/release stay human-gated (D-11). |
| 20-05 | Gate B -- real-OSS radix-ng tarball verify | 20-05-SUMMARY.md: 3/3 legs pass -- baseline 226 `?query` TS2307 flagged + run FAILs; `vite/client` -> advisory silent, TS2307 229->2 (2 genuine plain-missing survivors); planted plain-missing still errors. Charter (never a silent false pass) confirmed on a real repo. |

### Adversarial notes

- The D-05 and executor-silent rows are the charter tripwires (verdict integrity + no false positive). Both were checked to actually FAIL if the field ever entered the verdict or the warn fired when undefined -- they assert the negative, not just the positive, so they can fail. Confirmed green.
- The integration row is the strongest: it asserts the `?query` TS2307 remain COUNTED errors (`errorCount > flagged.length`) on the baseline leg and that the plain-missing control stays a KEPT TS2307 on BOTH legs -- so the advisory can never launder a real error into a pass.
- Implementation files were NOT modified. No debug loop entered (no failing test). No ESCALATE.

**Audit outcome:** GAPS FILLED -- all 6 automated rows green, all 3 manual rows recorded + met. `nyquist_compliant`, `wave_0_complete`, `status: complete` flipped in the frontmatter.
