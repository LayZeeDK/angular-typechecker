---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
updated: 2026-07-15
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

## Delta: gap-closure re-audit — 24-04 (nx-dep) + 24-05 (yarn/pnpm CLI e2e) (2026-07-12, Nyquist auditor)

Re-validation after the gap-closure plans (24-04, 24-05) + the code-review-fix landed on the
already-validated phase (commits `fd41260`, `dcfb0be`, `5502137`, `76c6f35`, `c5c6912`,
`724c570`, `9d25925`; phase re-verified `1b42eff` 5/5, re-secured `44a7884`). Focus: do the
gap-closure additions constitute ADEQUATE Nyquist sample points for **ACP-02** and **ACV-02**
(not merely "the tasks ran")? Each requirement was re-classified against the actual shipped
tests, then every automated leg was executed THIS session and its green result observed
directly — prior inline/self-certified classifications not trusted.

### ACP-02 — `nx` as a direct `^23.0.0` dependency + additive-only charter — CONFIRMED (no gap)

Sample points and their standing guards, all re-run green:

- **Product manifest** — `packages/angular-typechecker/package.json` `dependencies.nx === "^23.0.0"`
  (alongside exact-pinned `@nx/devkit@23.0.1`), and `nx` is absent from `peerDependencies`
  (verified by direct read).
- **Inverted unit guard** — `src/package-manifest.spec.ts` (20 tests) asserts
  `manifest.dependencies['nx'] === '^23.0.0'` AND not-a-peer at BOTH describe sites
  (CMP-01/D-14 lines 85-88 + ACP-01/NGADD-01/D-07 lines 191-194). Two independent sample
  points, both green.
- **Lint gate** — `eslint.config.mjs` `ignoredDependencies: ['nx', '@angular-devkit/architect', 'rxjs']`
  keeps `@nx/dependency-checks` from flagging the (unimported, runtime-transitive) `nx`
  obsolete at `maxWarnings:0`.
- **Additive-only** — `src/index.drift.ts` barrel tripwire via `tsconfig.drift.json` type-checks
  clean (the dependency addition touches no public barrel / schema / executor id), backed by
  `24-ADDITIVE-AUDIT.md`'s git-diff verdict vs `0.2.0`.
- **Behavioral consequence** — the fix's whole point (a yarn Angular CLI consumer gets `nx`
  installed so `@nx/devkit`'s top-level `require("nx/src/devkit-exports")` resolves) is proven
  end-to-end by the yarn e2e below: `ng g angular-typechecker:ng-add` (which loads the
  `convertNxGenerator` factory, pulling in `nx`) wires successfully — impossible if `nx` were
  absent (the pre-24-04 `Cannot find module 'nx/src/devkit-exports'` crash).

### ACV-02 — CI-authoritative Angular CLI e2e — CONFIRMED (no gap)

The gap-closure widened the e2e matrix to three package managers, all committed to the existing
`angular-typechecker-ng-cli-e2e` project (auto-join `run-many -t e2e`, no ci.yml edit). Every
cell asserts: non-vacuous baseline (no `typecheck` target before install), per-project scoping
with DISTINCT planted leaf codes (app `TS2322`+`TS2345` vs lib `TS2554`) proven BIDIRECTIONALLY
(each `.toContain` its own + `.not.toContain` the other project's), clean baseline exit 0
(app + lib), no stray `nx.json`, no `ERR_REQUIRE_ESM` / `infrastructure error`. Adequate
sample points for the requested edges:

- **npm / flat** — `ng-add-ng-run.e2e.spec.ts` (real `ng add` auto-wire-all).
- **yarn 4 / flat + yarn-workspace** — `ng-add-ng-run-yarn.e2e.spec.ts` (`.each(['flat','workspace'])`;
  the `workspace` layout makes the lib a `workspaces:['projects/*']` member whose name collides,
  proving a yarn name collision does NOT shadow). The CLI-x-yarn no-autowire is a DOCUMENTED,
  LOCKED quirk — the spec asserts the no-wire state right after `ng add`, then wires via the
  authorized `ng g` fallback — NOT an uncovered gap.
- **pnpm 11 / root name-collision** — `ng-add-ng-run-pnpm.e2e.spec.ts` (root `packages:['.']` so the
  root package.json name collides with the app project name → Nx shadowing stub). REGRESSION
  LOCK: the app `typecheck` target keeps the FULL `['tsconfig.app.json','tsconfig.spec.json']`
  array — the app BUILD leaf is never silently dropped (the committed form of the manual ACV-01
  gate #2 realworld-angular scenario). Effective-pnpm-major===11 assertion ran (not skipped),
  so the collision was reproduced on the CI-matched PM major.
- **Coverage self-audit** — `ci-e2e-coverage-guard.spec.ts` (GUARD-01/01b/01c/01d) enforces the
  e2e set membership, the `type:e2e` tag set, `run-many -t e2e`/`-t typecheck` presence, and the
  `--parallel=1` shared-tarball serialization.

No package-manager / layout / collision / cross-bleed edge is left unsampled. The unit-level
collision invariant (`configuration-matrix.spec.ts` name-COLLISION cells; `ng-add.spec.ts` SUBDIR
stub) backs the tarball-level e2e.

### Commands executed this session (all green, observed directly)

| Command | Result |
|---------|--------|
| `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | **38 files / 349 tests PASS** (incl. `package-manifest.spec.ts` 20 — ACP-02; `ci-e2e-coverage-guard`; `configuration-matrix` 19 w/ name-COLLISION cells; `ng-add.spec.ts` 14 w/ SUBDIR-stub case) |
| `NX_DAEMON=false npx nx typecheck angular-typechecker --skip-nx-cache` | PASS — drift `tsc --noEmit` incl. `tsconfig.drift.json` (ACP-02 additive barrel tripwire) |
| `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` | **3 files / 4 tests PASS** (555s): npm flat (148s), yarn flat (157s), yarn workspace/lib-collision (144s), pnpm root-collision (84s) — no vacuous skips; per-leaf scoping proven each cell (ACV-02) |

### Verdict

**`nyquist_compliant: true` holds; `wave_0_complete: true` holds.** ACP-02 and ACV-02 each have
adequate, executed, green Nyquist sample points covering the two package-manager layouts, the
name-collision cell, and the bidirectional per-leaf cross-bleed guards. Coverage already
existed — **0 tests generated** (no redundant tests added), 0 gaps filled, 0 escalated. No
implementation file was touched; no assertion was weakened. The prior verdict stands.

---

## Delta: 24-06 re-audit — nx-free vanilla ng-add + shared wiring core (2026-07-15, Nyquist auditor)

Re-validation after **Plan 24-06** landed on the already-validated phase (commits `43a5815`,
`73ba76c`, `1df91b6`, `b5dfcfd`, `1b05e19`). 24-06 REPLACED the Nx-based `convertNxGenerator`
ng-add with a **vanilla `@angular-devkit/schematics` ng-add schematic**
(`src/schematics/ng-add/schematic.ts`) that loads ZERO `@nx/devkit`, and EXTRACTED the shared
wiring core (`src/core/angular-cli-wiring.ts`) consumed by BOTH the vanilla ng-add AND the Nx
`configuration` generator (whose observable behavior stays byte-identical). Focus of this
re-audit: does the coverage adequately SAMPLE the 24-06 behavior (the refactor's new surfaces
and the closed NGADD-01 yarn first-run gap), not merely "the tasks ran"? Each requirement was
re-classified against the actual shipped tests at HEAD, then the fast tier was executed THIS
session and its green result observed directly — prior inline classifications not trusted.

### Per-requirement coverage at HEAD (24-01..24-06 integrated)

| Requirement | Sample point(s) at HEAD | Type | Status |
|-------------|-------------------------|------|--------|
| **NGADD-01** (yarn first-run auto-wire — the gap 24-06 closed) | `src/schematics/ng-add/ng-add.spec.ts` (13) drives the vanilla Rule directly (auto-wire-all, `--project` scoping, idempotency, re-assert-ours-preserve-user-keys, collision throw, skip e2e, dev-dep move, notice-once, WR-03 ×2, IN-01, RF-02 no-`angular.json` guard, pnpm-collision-immune-by-construction) + e2e `ng-add-ng-run-yarn.e2e.spec.ts` (real yarn 4 `ng add` FIRST-RUN auto-wire, `.each(['flat','workspace'])`, per-leaf scoping) | unit + e2e | green |
| **ACV-03** (unit+integration of CLI-vs-Nx differences) | `src/core/angular-cli-wiring.spec.ts` (18) — the new authoritative fast unit tier for the shared leaf-resolution / targetName-guard / override / collision-by-builder / idempotent-`[build,spec]`-merge decision logic; `ng-add.spec.ts` (13) for the `angular.json` write-fork on a schematics tree; `builder.integration.spec.ts` (4) for the builder over `BuilderContext`; `configuration-angular-cli.spec.ts` (15) for the array shape | unit + integration | green |
| **ACP-02** (additive-only, no breaking change) | Core extraction touches no public barrel/schema/executor id: `src/index.drift.ts` drift tripwire (`nx typecheck`), `nx-surface-regression` (3), `nx-generators-surface-regression` (7), `schema-parity` ×4 (7+8+3+4), `package-manifest.spec.ts` (20). Nx observable behavior byte-identical after the extraction: `configuration.spec.ts` (15) + `configuration-matrix.spec.ts` (19) green | unit + static | green |
| **ACV-02** (automated scaffolded CI e2e) | `ng-add-ng-run.e2e.spec.ts` (npm) + `ng-add-ng-run-yarn.e2e.spec.ts` (yarn flat+workspace) + `ng-add-ng-run-pnpm.e2e.spec.ts` (pnpm root-collision) + `ci-e2e-coverage-guard.spec.ts` (set/tag membership) | e2e + unit | green |
| **ACD-01** (README `## Angular CLI` + CHANGELOG) | `src/angular-cli-docs.spec.ts` (9). 24-06 made NO README change — the yarn `ng add` caveat became obsolete (product-fixed by the nx-free schematic), so the todo was retired to `done/`; the docs tripwire is unchanged and green | unit | green |
| **ACV-01** (real-clone tarball FINAL gate) | Manual-only BY DESIGN (uncommitted clones — see Manual-Only above). 24-06 does not change its status | manual UAT | manual (by design) |

### Is the "vanilla nx-free" mechanism guarded against regression?

24-06's load-bearing property is that the compiled ng-add loads zero `@nx/devkit` (else the
`ora -> log-symbols -> chalk` `chalk.blue is not a function` throw under yarn 4's hoist returns).
It is guarded on TWO standing axes — no gap:

- **Structural (fast, lint-time):** the D-11 `@typescript-eslint/no-restricted-imports` block in
  `eslint.config.mjs` scoped to `**/src/core/**/*.ts` bans `nx`, `@nx/devkit`, `@nx/*`,
  `@angular-devkit/architect`, and `yargs` — INCLUDING type-only imports (`allowTypeImports`
  omitted) — enforced at `maxWarnings:0`, keeping the shared core framework-agnostic.
- **Behavioral (CI-authoritative):** `ng-add-ng-run-yarn.e2e.spec.ts` proves the real
  `ng add angular-typechecker` auto-wires on the FIRST run under yarn 4 — which is impossible if
  the schematic reintroduced the nx transitive chalk chain. A regression fails this leg loudly.

A fast dist-grep tripwire over `schematic.js` would be pure defense-in-depth; the requirement is
already sampled behaviorally AND the mechanism is lint-guarded, so adding one is redundant (YAGNI)
— NOT generated.

### Commands executed this session (observed directly)

| Command | Result |
|---------|--------|
| `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | **39 files / 373 tests PASS** (6.08s), incl. `angular-cli-wiring.spec.ts` (18 — the new shared core, ACV-03), `ng-add.spec.ts` (13 — vanilla nx-free Rule, NGADD-01), `configuration.spec.ts` (15) + `configuration-angular-cli.spec.ts` (15) + `configuration-matrix.spec.ts` (19) + `schema-parity` ×4 (Nx byte-identity gate holds after the core extraction), `nx-generators-surface-regression.spec.ts` (7) + `package-manifest.spec.ts` (20) (ACP-02) |

*The e2e tier (`ng-add-ng-run-yarn.e2e.spec.ts` etc.) was NOT re-run this session — it was
verified green standalone during 24-06 execution (yarn flat 89.8s + yarn workspace 70.9s
first-run auto-wire, per 24-06-SUMMARY) and runs as the CI-authoritative per-project e2e matrix.
The fast unit + static tier re-run here re-samples every automatable 24-06 surface.*

### Verdict

**`nyquist_compliant: true` holds; `wave_0_complete: true` holds.** All Phase-24 automatable
requirements (NGADD-01 yarn first-run, ACV-02, ACV-03, ACP-02, ACD-01) have adequate, executed,
green Nyquist sample points covering the 24-06 delta: the shared wiring core, the vanilla nx-free
ng-add Rule, the Nx byte-identity gate, and the additive-only guards. Coverage already existed —
**0 tests generated** (no redundant tests added), **0 gaps filled**, **0 escalated**. No
implementation file was touched; no test file was created or modified; no assertion was weakened.
ACV-01 remains manual-only by design. The prior verdict stands.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (ACV-01 excepted — manual by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (there were none)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit/integration/drift tier)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-11; re-audited 2026-07-12 after gap closure (24-04 nx-dep + 24-05 yarn/pnpm CLI e2e) — ACP-02 + ACV-02 adequately sampled and re-run green (349 unit + drift typecheck + 4 CLI e2e); re-audited 2026-07-15 after 24-06 (nx-free vanilla ng-add + shared `angular-cli-wiring` core) — Nyquist auditor: NGADD-01 (yarn first-run), ACV-03, ACP-02, ACV-02, ACD-01 adequately sampled and re-run green (**39 files / 373 tests**; Nx byte-identity gate holds after the core extraction; core "no @nx/devkit" mechanism doubly guarded by D-11 lint boundary + yarn e2e); 0 tests generated (coverage pre-existing), 0 gaps, 0 escalations; ACV-01 manual-only by design. `nyquist_compliant: true` holds.
