---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
updated: 2026-07-11
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sample points enumerated in `24-RESEARCH.md` "## Validation Architecture"
> (the scaffolded `ng-cli-e2e` project, the builder-over-`BuilderContext`
> integration harness, the barrel drift tripwire, and the docs tripwire).
> Independently re-classified and each automated command re-run green by the
> Nyquist auditor 2026-07-11 (prior inline classifications were NOT trusted).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1 (via `@nx/vitest:test`) |
| **Config file** | per-project `vitest.config.mts` (plugin unit/integration + each `e2e/*`) |
| **Quick run command** | `npx nx test angular-typechecker --skip-nx-cache` |
| **Full suite command** | `npx nx test angular-typechecker` + `npx nx integration angular-typechecker` + `npx nx typecheck angular-typechecker` + `npx nx run-many -t e2e --parallel=1` |
| **Estimated runtime** | ~6s unit / ~33s integration / ~3s drift typecheck; ~95s the ng-cli e2e (real Verdaccio publish + `npm install` + `ng add` + 4 `ng run`s) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker --skip-nx-cache`
- **After every plan wave:** Run the plugin unit + integration + drift typecheck; if an `e2e/*` project changed, `npx nx run-many -t e2e --parallel=1`
- **Before `/gsd:verify-work`:** All four automated legs green + the manual ACV-01 UAT recorded
- **Max feedback latency:** ~60 seconds (unit/integration/drift tier)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01 T1 | 24-01 | 1 | ACV-03 | T-24-02 | Builder driven over a real `BuilderContext` (`TestingArchitectHost`) returns `success:true` on a clean leaf and `success:false` on a two-element planted-error `tsConfig` array; parity with the Nx executor `{ success }`; WR-01 non-vacuity — planted TS2322 + TS2345 actually surface in captured stdout (not a masked infra error) | integration | `npx nx integration angular-typechecker` | `src/builders/typecheck/builder.integration.spec.ts` (4) + `fixtures/builder-context/` | green |
| 24-01 T2 | 24-01 | 1 | ACP-02 | T-24-01 | All five public barrel exports (`runTypecheck`, `TypecheckInfrastructureError` value; `CoreOptions`, `CoreResult`, `SkippedReference` type-only) locked by a standing `tsc --noEmit` drift tripwire — a removed/renamed export fails the drift leg loudly (TS2305/TS2724) | static (drift tsc --noEmit) | `npx nx typecheck angular-typechecker` | `src/index.drift.ts` + `tsconfig.drift.json` `files` entry | green |
| 24-01 T3 | 24-01 | 1 | ACP-02 | T-24-01 | Additive-only holds vs `angular-typechecker@0.2.0`: executor id, barrel, and pre-existing schemas widened-only/byte-unchanged; standing guards (`nx-surface-regression`, `nx-generators-surface-regression`, `schema-parity` ×4, `package-manifest`) all green | unit (guard suite) + recorded audit | `npx nx test angular-typechecker` | `24-ADDITIVE-AUDIT.md` + `src/builders/typecheck/nx-surface-regression.spec.ts` (3) + `src/schematics/configuration/nx-generators-surface-regression.spec.ts` (7) + `src/package-manifest.spec.ts` (20) | green |
| 24-02 T1/T2/T3 | 24-02 | 1 | ACD-01 | T-24-03 | README `## Angular CLI` section carries every D-06 claim (ng add auto-wire-all, `ng run <project>:typecheck` Nx-parity, tsConfig-array target shape, nx-transitive/`.nx/`/no-caching, off-stack `--legacy-peer-deps`) locked by a normalized filesystem-read tripwire; Storybook "not supported" caveat preserved; CHANGELOG `0.2.1` prose entry, no version cut | unit (docs tripwire) | `npx nx test angular-typechecker` | `src/angular-cli-docs.spec.ts` (9) + `README.md` `## Angular CLI` + `CHANGELOG.md` `## 0.2.1` | green |
| 24-03 T1/T2 | 24-03 | 2 | ACV-02 | T-24-06 | The 4th e2e project (committed pinned Ng22 app+lib fixture, no `node_modules`/peer-masking `.npmrc`) satisfies the 4-guard contract (GUARD-01/01b/01c/01d) so it auto-joins `nx run-many -t e2e` / `-t typecheck -p tag:type:e2e` with no ci.yml edit | unit (coverage guard) | `npx nx test angular-typechecker` | `e2e/angular-typechecker-ng-cli-e2e/project.json` + `fixtures/ng-cli-workspace/` + `src/ci-e2e-coverage-guard.spec.ts` | green |
| 24-03 T3 | 24-03 | 2 | ACV-02 | T-24-05/06/07 | In the scaffolded workspace, `ng add angular-typechecker` auto-wires a `typecheck` target into every app + library (non-vacuous baseline), and `ng run <project>:typecheck` catches EXACTLY that project's own planted leaves (app TS2322 + spec TS2345 vs lib TS2554) with no cross-project bleed; clean baseline exits 0; on-stack install needs no `--legacy-peer-deps`; loopback-only Verdaccio publish | e2e | `npx nx e2e angular-typechecker-ng-cli-e2e` (or `npx nx run-many -t e2e --parallel=1`) | `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts` (1) | green |
| 24-03 T3 | 24-03 | 2 | ACV-01 | — | Real-clone tarball final gate (ngx-leaflet then realworld-angular, by URL + pinned SHA) — see Manual-Only below | manual UAT | documented procedure (URLs + SHAs) | `24-ACV-01-UAT.md` + `24-HUMAN-UAT.md` | manual (by design) |

*Status: pending · green · red · flaky. Every automatable requirement row (ACV-02, ACV-03, ACP-02, ACD-01) is COVERED by a shipped spec whose automated command the auditor re-ran green this session. ACV-01 is manual-only BY DESIGN (uncommitted clones) — its absence of a committed CI test is not a Nyquist gap.*

---

## Wave 0 Requirements

- [x] `src/builders/typecheck/builder.integration.spec.ts` (+ `fixtures/builder-context/angular.json` resolvable workspace root) — builder over a real `BuilderContext`, success + Nx parity, WR-01 non-vacuous (ACV-03 gap-fill)
- [x] `src/index.drift.ts` wired into `tsconfig.drift.json` `files` — standing barrel additive-only tripwire covering all five exports incl. type-only (ACP-02 / RF-02)
- [x] `src/angular-cli-docs.spec.ts` — normalized filesystem-read docs tripwire locking the load-bearing `## Angular CLI` claims (ACD-01)
- [x] `e2e/angular-typechecker-ng-cli-e2e/` (project.json + vitest.config.mts + global-setup.ts + committed pinned Ng22 fixture + `ng-add-ng-run.e2e.spec.ts`) — scaffolded `ng add` → `ng run` per-project scoping (ACV-02)
- [x] `24-ADDITIVE-AUDIT.md` (ACP-02 git-diff verdict vs 0.2.0) + `24-ACV-01-UAT.md` (ACV-01 manual UAT procedure)

*Existing Vitest infrastructure covers the framework; all five net-new Wave-0 artifacts landed green (Wave 0 complete).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-clone tarball e2e (`ng add` → `ng run <project>:typecheck`) against `bluehalo/ngx-leaflet` @ `818e9ae55240b570397ede5a15cb4d466785abdc` (app `ngx-leaflet-demo` + lib `ngx-leaflet`), run FIRST | ACV-01 | The OSS clone is UNCOMMITTED (reproduced by URL + pinned SHA); cannot run as a committed CI test. Needs a real `ng`/`npm` toolchain + network clone. | `24-ACV-01-UAT.md`: clone @ SHA, `npm pack` the shipped dist tarball (MSYS `/d/…` path), `ng add angular-typechecker`, plant per-leaf errors (app component TS2322, app spec TS2345, lib component TS2554), `ng run ngx-leaflet-demo:typecheck` + `ng run ngx-leaflet:typecheck` → app target reports TS2322+TS2345 but not TS2554; lib target reports TS2554 but neither app code; clean baseline exits 0; no `ERR_REQUIRE_ESM`/infra error. |
| Real-clone tarball e2e against `realworld-angular/realworld-angular` @ `9e3528ff27bad5fedaefb879ccc4aaf4717b137b` (single application, app-only), run SECOND | ACV-01 | Same as above — uncommitted OSS clone reproduced by URL + SHA; on-stack Angular 22 breadth/confidence gate that cannot be a committed CI test. | `24-ACV-01-UAT.md`: `ng add`, plant app-component TS2322 + app-spec TS2345, `ng run realworld-angular:typecheck` → both codes reported, exits non-zero; clean baseline exits 0; no `ERR_REQUIRE_ESM`/infra error. |

*ACV-01 is a confidence gate ON TOP of the CI-authoritative ACV-02 scaffolded e2e (which IS committed and, verified this session, green). Per phase design D-02 and REQUIREMENTS.md, ACV-01 is manual/local by design — not a phase gap. Every other Phase-24 behavior has automated verification.*

---

## Validation Audit 2026-07-11 (Nyquist auditor, independent)

| Metric | Count |
|--------|-------|
| Requirements classified | 5 (ACV-01, ACV-02, ACV-03, ACP-02, ACD-01) |
| COVERED (automated, re-run green) | 4 (ACV-02, ACV-03, ACP-02, ACD-01) |
| Manual-only by design (not a gap) | 1 (ACV-01) |
| MISSING automated gaps | 0 |
| Tests generated | 0 |
| Escalated (implementation bug) | 0 |

**Method.** Each requirement was re-classified against the actual test files (prior inline
classifications not trusted), then every automated command was executed this session and its
green result observed directly:

- `npx nx typecheck angular-typechecker --skip-nx-cache` → drift `tsc --noEmit` (incl. `src/index.drift.ts`) PASS — **ACP-02** barrel tripwire.
- `npx nx test angular-typechecker --skip-nx-cache` → 37 files / **323 tests** PASS, incl. `angular-cli-docs.spec.ts` (9, **ACD-01**), `ci-e2e-coverage-guard.spec.ts` (**ACV-02** wiring guard), `nx-surface-regression` (3), `nx-generators-surface-regression` (7), `schema-parity` ×4, `package-manifest.spec.ts` (20) (**ACP-02** guards).
- `npx nx integration angular-typechecker --skip-nx-cache` → 20 files / **107 tests** PASS; `builder.integration.spec.ts` re-run in isolation confirmed **4 tests** green and NON-VACUOUS (planted `TS2322` + `TS2345` observed in captured stdout) — **ACV-03**.
- `npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` → **1 test** PASS (95.8s): loopback Verdaccio publish, `npm install` with no `--legacy-peer-deps`, real `ng add` auto-wire-all, and per-project `ng run <project>:typecheck` scoping (app TS2322+TS2345 vs lib TS2554, no bleed) — **ACV-02**.

No test failed; no assertion was weakened; no implementation file was touched. No gaps to fill.

---

## Delta: ACV-01 gap-fix re-audit (2026-07-11, Nyquist auditor)

The ACV-01 real-clone gate (realworld-angular @ `9e3528f`) surfaced a correctness bug
fixed in commits `1837b25` (fix) + `49974f1` (non-vacuous regression tests). This re-audit
assesses whether the FIXED behavior is adequately covered.

**The change.** On the Angular CLI write-fork, `configurationGenerator` now reads
`root`/`projectType` STRAIGHT from angular.json (not via `readProjectConfiguration`), because
on a workspace that is ALSO a pnpm workspace whose root `package.json` `name` collides with
the angular.json project name, Nx infers a shadowing package stub (`root:"."`,
`projectType: undefined`) that silently dropped the app build leaf (root app -> spec-only
under-check) or threw (subdir app). `resolveTsConfigLeaves` now takes
`(tree, root, projectType, schema)`; a `!cliProject` throw guards an absent project.

**Coverage assessment.** The four new regression cases (3 CLI + 1 not-found in
`configuration-angular-cli.spec.ts`, +1 Nx-branch lock in `configuration.spec.ts`) drive
`configurationGenerator` DIRECTLY and were verified non-vacuous by the phase author. But the
REAL production entry point of the ACV-01 gate is `ng add angular-typechecker` ->
`ngAddGenerator`, which enumerates projects via `getProjects(tree)` and filters on
`project.projectType === 'application' | 'library'` (`ng-add/generator.ts:78-90`).
`getProjects` uses the SAME Nx project inference that returns the shadowing stub. **Residual
gap identified:** if that stub reached ng-add's filter with `projectType: undefined`, the
colliding app would be SKIPPED entirely (zero targets wired, IN-01 silent return) -- a
distinct, arguably worse failure than the leaf-drop -- and NO test exercised the `ng add`
composition path under the collision.

**Gap FILLED.** Added two non-vacuous regression cases at the `ng add` entry point in
`ng-add/ng-add.spec.ts` (new describe: "Angular CLI + pnpm-workspace name collision, ACV-01
regression"): auto-wire-all (no `--project`) over a root-app and a subdir-app collision
substrate, each asserting the FULL `[app, spec]` leaf array is written into angular.json.

**Non-vacuity PROVEN.** Transiently restoring the pre-fix generator (`git show 1837b25~1`)
makes both new ng-add cases FAIL identically to the direct cases -- root app ->
`['tsconfig.spec.json']` (build leaf dropped), subdir app -> `Could not resolve a tsconfig`
throw -- and the fixed generator turns them GREEN. This also proved the residual-gap
hypothesis was NOT a live bug: `getProjects` returns `projectType: 'application'` under the
collision (the app IS enumerated and reaches `configurationGenerator`), so the fault was the
leaf resolution the fix corrected -- but the ng-add path now carries its own standing guard.

| Command | Result |
|---------|--------|
| `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | **330 tests PASS** (was 328; +2 ng-add collision cases) |
| pre-fix generator + `--testNamePattern="name collision"` | 6 FAIL / 1 PASS (RED confirms non-vacuity) |
| fixed generator + `--testNamePattern="name collision"` | 7 PASS (GREEN restored) |

**Verdict: `nyquist_compliant: true` holds.** The changed behavior (CLI-branch
angular.json-direct read; both root-app-drop + subdir-throw failure modes; the Nx-branch
robustness) is covered, and the real `ng add` entry point now has a standing regression guard
it previously lacked. No implementation file was modified (the pre-fix swap was transient and
restored to a clean diff). Gaps filled: 1. Escalated: 0.

**File for commit:** `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts`

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (ACV-01 excepted — manual by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (there were none)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit/integration/drift tier)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-11 (Nyquist auditor — 4/4 automatable requirements green; ACV-01 manual-only by design)
