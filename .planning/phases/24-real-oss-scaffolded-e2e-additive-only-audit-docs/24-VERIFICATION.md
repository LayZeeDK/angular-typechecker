---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
verified: 2026-07-15T12:20:00Z
status: human_needed
score: 6/6 must-haves verified (code-level)
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed:
    - "NGADD-01 (24-06): the `ng-add` schematic is now a VANILLA `@angular-devkit/schematics` Rule with ZERO `@nx/devkit` in its load/execution path (its schematics imports are type-only, erased at compile; the compiled `schematic.js` requires ONLY the pure first-party core). `ng add angular-typechecker` therefore auto-wires every application + library project on the FIRST run under yarn 4 (npm + pnpm already worked). Verified at source AND dist. The former yarn `ng g` fallback + no-wire quirk-lock were dropped from the CLI e2e; the yarn e2e now asserts first-run auto-wire."
    - "README `## Angular CLI` yarn caveat RETIRED (24-06): the product now auto-wires under yarn, so the README needs no yarn-specific caveat. `.planning/todos/pending/readme-yarn-ng-add-caveat.md` moved to `.planning/todos/done/`; the pending dir is empty. The prior verification's tracked follow-up is RESOLVED."
  gaps_remaining: []
  regressions: []
notes:
  - "24-06 replaced the exact ng-add code path the ACV-01 real-clone gate exercises: `src/generators/ng-add/generator.ts` was DELETED and the flow is now the vanilla `src/schematics/ng-add/schematic.ts` sharing `src/core/angular-cli-wiring.ts`. The ACV-01 real-clone UAT (24-ACV-01-UAT.md / 24-HUMAN-UAT.md) was last executed 2026-07-11 -- one day BEFORE 24-06 landed (2026-07-12) -- and it used `ng g angular-typechecker:ng-add` against the now-deleted generator. All other must-haves are re-verified green at HEAD; the single open item is a recommended (LOW-risk) re-run of the manual real-clone gate against post-24-06 HEAD before the v0.2.1 release."
human_verification:
  - test: "Re-run the ACV-01 real-clone tarball gate against post-24-06 HEAD: pack the shipped tarball, clone bluehalo/ngx-leaflet (on-stack Ng22, app `ngx-leaflet-demo` + lib `ngx-leaflet`), run `ng add angular-typechecker` (FIRST run, no `ng g` fallback), then `ng run <project>:typecheck` and assert planted diagnostics per 24-ACV-01-UAT.md. Repeat for the realworld-angular exact-stack app clone."
    expected: "`ng add` auto-wires a `typecheck` architect target with the 2-element `[tsconfig.app.json, tsconfig.spec.json]` array into BOTH projects on the first run (no stray nx.json), clean baseline exits 0, planted per-leaf errors are caught with per-project scoping (no cross-bleed), no ERR_REQUIRE_ESM, and no `chalk.blue is not a function` throw under yarn."
    why_human: "ACV-01 is an external, manual, milestone-FINAL tarball gate against uncommitted real OSS clones (repo URL + SHA are the reproduction). It cannot be run programmatically here, and 24-06 rewrote the ng-add code path it exercises AFTER the last (2026-07-11) execution. Risk is LOW: the automated CI-authoritative ACV-02 e2e (npm + yarn flat + yarn workspace collision + pnpm collision) exercises the identical `ng add` auto-wire -> `ng run` flow on the NEW 24-06 code and is documented green 4/4, and the new schematic reads angular.json directly (the very fix that resolved the original ACV-01 pnpm-collision defect). This is a confirmation, not a suspected regression."
---

# Phase 24: Real-OSS + Scaffolded e2e, Additive-Only Audit, Docs Verification Report

**Phase Goal:** real-OSS + scaffolded Angular CLI (`ng add` -> `ng run`) e2e coverage, additive-only vs `angular-typechecker@0.2.0`, with the docs (README `## Angular CLI` + CHANGELOG) shipped. Re-verified at HEAD with gap-closure plans 24-04 (nx direct dependency), 24-05 (yarn/pnpm CLI e2e), and **24-06 (nx-free vanilla ng-add, Option C -- yarn first-run auto-wire)** fully integrated.
**Verified:** 2026-07-15T12:20:00Z
**Status:** human_needed
**Re-verification:** Yes -- extends the 2026-07-12 `passed 5/5` verdict to cover plan 24-06 (not previously verified) and the post-24-06 test-harness/CI quick tasks. All 6 code-level truths VERIFIED; ONE external manual gate (ACV-01) needs a human re-run against the rewritten 24-06 code path before release.

## Goal Achievement

The prior `passed 5/5` verdict still holds and is extended with the NGADD-01 yarn-auto-wire truth closed by 24-06. Verified against the actual codebase (source + compiled dist + a first-hand `nx test`/`nx lint` re-run), not SUMMARY prose:

- The `ng-add` schematic is now a vanilla `@angular-devkit/schematics` Rule with **zero `@nx/devkit`** in its load/execution path (proven at source: type-only imports; and at dist: `schematic.js` requires only `../../core/angular-cli-wiring`). `ng add` auto-wires every app + library on the first run under yarn.
- One shared framework-agnostic wiring core (`src/core/angular-cli-wiring.ts`, pure `node:path` + injected `exists()`) is imported by BOTH the vanilla ng-add AND the Nx `configuration` generator; the Nx configuration observable behavior stays byte-identical (its 4 specs + init/surface-regression specs are green in the 373-test suite).
- The old `src/generators/ng-add/generator.ts` is deleted (only `schema.d.ts` + `schema.json` remain); ng-add stays ABSENT from `generators.json` and present in `collection.json` (factory now `./src/schematics/ng-add/schematic`).
- Additive-only vs 0.2.0 still holds (version 0.2.0; `src/index.ts` byte-unchanged; 24-06 touched no released surface).
- The README yarn caveat is retired (product-fixed); its todo moved to `done/`.

The single open item is the **manual, external ACV-01 real-clone gate**, which 24-06's ng-add rewrite invalidated the prior (pre-24-06) execution of -- see Human Verification.

### Observable Truths

| # | Truth (requirement) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | NGADD-01 (24-06): `ng add angular-typechecker` runs a nx-free vanilla `@angular-devkit/schematics` ng-add that auto-wires a `typecheck` target into every application + library on the FIRST run under yarn 4 (npm + pnpm parity); the Nx `nx add` surface is unchanged. | VERIFIED | `src/schematics/ng-add/schematic.ts` imports `Rule/SchematicContext/Tree` as `import type` (line 1) and value-imports only from `../../core/angular-cli-wiring` (lines 3-9); NO `@nx/devkit`. Compiled `dist/.../schematics/ng-add/schematic.js` requires ONLY `../../core/angular-cli-wiring` (line 4) -- grep for `@nx/devkit`/`convertNxGenerator`/`nx` = CLEAN. `collection.json` `ng-add.factory` -> `./src/schematics/ng-add/schematic`; `generators.json` has only `configuration` + `init` (ng-add ABSENT). `nx-generators-surface-regression.spec.ts` (7 tests) green. yarn e2e (`ng-add-ng-run-yarn.e2e.spec.ts`) runs real `corepack yarn ng add angular-typechecker --skip-confirmation` (:272) and asserts BOTH projects gained the target directly from ng add (:277-282); no `ng g ...:ng-add` fallback remains. `ng-add.spec.ts` (13) + `angular-cli-wiring.spec.ts` (18) green. |
| 2 | ACP-02: additive-only enforced AND audited; `nx` declared as a direct `^23.0.0` dependency (NOT a peer), @nx/devkit exact 23.0.1; guards enforce it; version stays 0.2.0; 24-06 touched no released surface. | VERIFIED | `package.json` `dependencies: {@nx/devkit:23.0.1, nx:^23.0.0, tslib:^2.3.0}`; `peerDependencies` has NO `nx` (`nx in peers? false`). Dist manifest ships `dependencies.nx === '^23.0.0'`, version `0.2.0`. `package-manifest.spec.ts` (20 tests) green; `eslint.config.mjs` `ignoredDependencies:['nx','@angular-devkit/architect','@angular-devkit/schematics','rxjs']`, `nx lint` green (maxWarnings:0). `git diff angular-typechecker@0.2.0..HEAD -- src/index.ts` = EMPTY; 24-06 commits (`43a5815`..`b5dfcfd`) touch no `src/index.ts` / `src/executors/` / `executors.json`. `24-ADDITIVE-AUDIT.md` verdict ADDITIVE-ONLY. |
| 3 | ACV-02: CI-authoritative Angular CLI e2e proves the REAL `ng add` -> `ng run <project>:typecheck` flow on npm, yarn 4 (flat + workspace) with FIRST-RUN auto-wire, pnpm 11 (root name collision), per-project scoping, app build leaf never dropped. | VERIFIED | yarn spec asserts first-run auto-wire-all (:277-282, `builder === 'angular-typechecker:typecheck'`), non-vacuous pre-ng-add baseline (:252-253), `enableMirror:false` retained (:220), per-leaf scoping. pnpm spec asserts full `[tsconfig.app.json, tsconfig.spec.json]` array + effective-pnpm-major===11. Documented green 4/4 standalone (24-06-SUMMARY: npm + yarn flat 89.8s + yarn workspace 70.9s + pnpm). CI runs the e2e tier as a per-project matrix (fresh `npm ci` per job, no `run-many` local-registry re-invocation). Heavy env (corepack yarn4 + pnpm11 + Verdaccio) -- NOT re-run this pass; verified by substantive committed-spec read + CI matrix + documented-green. |
| 4 | ACV-03: unit + integration coverage of the Angular-CLI-vs-Nx differences (`tsConfig: string[]` union; angular.json write-fork; builder over BuilderContext; ng-add auto-wire-all + idempotency; no stray nx.json). | VERIFIED | 373-test / 39-file suite green (re-run first-hand): incl. `angular-cli-wiring.spec.ts` (18), `ng-add.spec.ts` (13), `builder.spec.ts`, `configuration` + `init` specs, `nx-generators-surface-regression.spec.ts` (7), `nx-surface-regression.spec.ts` (3), init-angular-cli no-stray-nx.json (5). |
| 5 | ACD-01: README `## Angular CLI` section (all enumerated items, no yarn caveat now the product auto-wires) + curated CHANGELOG 0.2.1 in end-user language, no internal ids. | VERIFIED | README `## Angular CLI` (:381-471) covers ng add auto-wire-ALL, `ng generate ...:configuration`, `ng run <project>:typecheck`, per-project target + tsConfig array, no-caching + nx-transitive `.nx/`, off-stack `--legacy-peer-deps`, Storybook caveat. No `yarn` token in README (caveat retired). `CHANGELOG.md` `## 0.2.1` prose + Features/Notes/Compatibility, no internal ids. `angular-cli-docs.spec.ts` (9 tests) green. |
| 6 | ACV-01: shipped tarball proven against REAL cloned OSS Angular 22 workspaces via `ng add` -> `ng run` (milestone-FINAL manual gate). | VERIFIED (code-level) / RE-RUN NEEDED | Code path re-verified: the new vanilla schematic reads `project.projectType`/`project.root` STRAIGHT from angular.json (schematic.ts:68-93) -- collision-immune, preserving the original ACV-01 pnpm-collision fix. Prior real-clone UAT 3/3 PASS but executed 2026-07-11 against the now-DELETED generator (used `ng g ...:ng-add`). 24-06 (2026-07-12) rewrote the exercised path -> manual gate needs a re-run before release. LOW risk (automated ACV-02 covers the identical flow on the new code, green). See Human Verification. |

**Score:** 6/6 truths verified at the code level. Truth 6 (ACV-01) additionally carries a manual real-clone re-run as a human confirmation (see below), which sets overall status to `human_needed`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/schematics/ng-add/schematic.ts` | vanilla nx-free Rule, type-only schematics imports, uses shared core | VERIFIED | Lines 1-9; no `@nx/devkit`; dist requires only the core. |
| `src/core/angular-cli-wiring.ts` | pure framework-agnostic core (node:path + injected exists) imported by ng-add AND configuration generator | VERIFIED | Imports only `node:path`; dist requires only `node:path`; imported by `generators/configuration/generator.ts` (:16-17) and re-exported by `generators/init/generator.ts` (:11,:25). |
| `src/core/angular-cli-wiring.spec.ts` | pure unit coverage of leaf/override/targetName/collision/merge | VERIFIED | 18 tests green. |
| `src/schematics/ng-add/ng-add.spec.ts` | vanilla-Rule behaviors (auto-wire-all, idempotency, guards) | VERIFIED | 13 tests green. |
| `src/generators/ng-add/generator.ts` | DELETED (only schema.d.ts + schema.json remain) | VERIFIED | Dir holds only `schema.d.ts` + `schema.json`. |
| `packages/angular-typechecker/generators.json` | ng-add ABSENT (only configuration + init) | VERIFIED | Confirmed. |
| `packages/angular-typechecker/collection.json` | ng-add present, factory -> vanilla schematic | VERIFIED | `ng-add.factory: ./src/schematics/ng-add/schematic`. |
| `packages/angular-typechecker/package.json` | `nx:^23.0.0` dep, @nx/devkit exact, no nx peer, version 0.2.0 | VERIFIED | Confirmed via node read; dist manifest matches. |
| `packages/angular-typechecker/eslint.config.mjs` | `@angular-devkit/schematics` added to ignoredDependencies (24-06) + accurate comment | VERIFIED | :101-106 (`nx`, `@angular-devkit/architect`, `@angular-devkit/schematics`, `rxjs`); comment :95-100. |
| `e2e/.../ng-add-ng-run-yarn.e2e.spec.ts` | first-run auto-wire assertion; no ng g fallback; enableMirror:false | VERIFIED | :272 real ng add, :277-282 auto-wire-all assert; no `ng g ...:ng-add`; :220 enableMirror:false. |
| `packages/angular-typechecker/README.md` (`## Angular CLI`) | all ACD-01 items; no yarn caveat | VERIFIED | :381-471; no `yarn` token. |
| `CHANGELOG.md` (`## 0.2.1`) | curated prose, no internal ids | VERIFIED | :5-45. |
| `.planning/todos/done/readme-yarn-ng-add-caveat.md` | moved from pending (caveat retired) | VERIFIED | In `done/`; `pending/` empty. |
| `.planning/.../24-ADDITIVE-AUDIT.md` | ACP-02 additive-only verdict | VERIFIED | Verdict ADDITIVE-ONLY; index.ts byte-unchanged vs 0.2.0. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `schematics/ng-add/schematic.ts` | `core/angular-cli-wiring.ts` | value import of `resolveTsConfigLeaves`/`wireTypecheckTarget`/notices | WIRED | dist `schematic.js` `require("../../core/angular-cli-wiring")`; no @nx/devkit. |
| `generators/configuration/generator.ts` | `core/angular-cli-wiring.ts` | shared core import (byte-identical Nx behavior) | WIRED | :16-17; configuration + surface-regression specs green. |
| `collection.json` ng-add | vanilla schematic | `factory: ./src/schematics/ng-add/schematic` | WIRED | ng-add ABSENT from generators.json (surface unchanged; spec-locked). |
| `package.json` dependencies | `@nx/devkit` -> `require('nx/src/devkit-exports')` | `nx:^23.0.0` direct dep (yarn installs direct deps) | WIRED | dist manifest ships nx:^23.0.0; `^23.0.0` subset of devkit's nx peer. |
| yarn e2e | `corepack yarn ng add angular-typechecker --skip-confirmation` -> auto-wire-all | first-run vanilla schematic (no nx ora/chalk chain) | WIRED | :272 install + :277-282 both-projects wired assert. |
| `eslint.config.mjs` | `@nx/dependency-checks` | ignoredDependencies incl. nx + @angular-devkit/schematics | WIRED | `nx lint` green at maxWarnings:0. |

### Data-Flow Trace (Level 4)

Not applicable in the rendering sense (this phase ships an Nx plugin + Angular CLI schematics + e2e, no dynamic-data UI). The equivalent "does real data flow" check is: does `ng add` produce a real, runnable `typecheck` target? Traced: schematic reads angular.json -> resolves per-project leaf arrays via the shared core (existence-probed) -> mutates `architect[targetName]` with the real builder id + tsConfig array -> persisted. Verified by the 13 ng-add + 18 core unit tests and the yarn/pnpm e2e assertions (target builder id + full leaf array), not a static/empty stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit + integration suite (incl. new core + ng-add + surface-regression + docs tripwire) | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 39 files / 373 tests passed | PASS (re-run first-hand) |
| Lint (maxWarnings:0; @nx/dependency-checks incl. @angular-devkit/schematics ignore + D-11 core boundary) | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | All files pass linting | PASS (re-run first-hand) |
| Vanilla dist schematic loads zero @nx/devkit | `rg "@nx/devkit\|convertNxGenerator\|require\('nx" dist/.../schematics/ng-add/schematic.js` | CLEAN (requires only ../../core/angular-cli-wiring) | PASS |
| Shipped dist manifest carries nx dep | `node -e require('./dist/.../package.json').dependencies.nx` | `^23.0.0` | PASS |
| Version unchanged (ACP-02: no v0.3.0) | `node -e require(...).version` | `0.2.0` | PASS |
| index.ts byte-unchanged vs 0.2.0 (additive-only) | `git diff angular-typechecker@0.2.0..HEAD -- src/index.ts` | empty | PASS |
| 24-06 commits in HEAD | `git merge-base --is-ancestor <sha> HEAD` x5 | all ancestors | PASS |
| CLI x yarn/pnpm e2e (full `ng add`->`ng run` first-run matrix) | `npx nx e2e angular-typechecker-ng-cli-e2e` | NOT re-run (heavy: corepack yarn4 + pnpm11 + Verdaccio). Documented green 4/4 standalone (24-06-SUMMARY); CI per-project matrix authoritative. | SKIP (documented green) |
| Build (compiled .js executor + schematic) | `nx build angular-typechecker` | per orchestrator ground-truth: green at HEAD | PASS (ground-truth) |
| Format check | `nx format:check --base origin/main` | per orchestrator ground-truth: exit 0 | PASS (ground-truth) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NGADD-01 | 23-* / 24-06 | First-party ng-add auto-wire-all; yarn first-run parity | SATISFIED | Vanilla nx-free schematic (source + dist), first-run yarn e2e assert, 18+13 unit tests, surface unchanged. |
| ACV-01 | 24-03 | Real-clone tarball final gate | SATISFIED (code) / RE-RUN RECOMMENDED | Code path collision-immune + prior 3/3 PASS; manual gate not re-run against post-24-06 code -> human item. |
| ACV-02 | 24-03 + 24-05 + 24-06 | Scaffolded + npm/yarn/pnpm CLI e2e, first-run auto-wire, per-project scoping | SATISFIED | Three specs committed + substantive; documented green 4/4; CI per-project matrix. |
| ACV-03 | 24-01 | Unit + integration CLI-vs-Nx diff coverage | SATISFIED | 373-test suite green incl. write-fork + surface-regression + docs tripwire. |
| ACP-02 | 24-01 + 24-04 + 24-06 | Additive-only enforced + audited (incl. nx-dependency fix) | SATISFIED | nx direct ^23.0.0 dep + guards green + audit + version 0.2.0 + 24-06 touched no released surface. |
| ACD-01 | 24-02 + 24-06 | README `## Angular CLI` + CHANGELOG; yarn caveat retired | SATISFIED | README section + 9-test tripwire + 0.2.1 prose; caveat todo moved to done/. |

REQUIREMENTS.md Traceability: ACV-01/ACV-02/ACV-03/ACP-02/ACD-01 -> Phase 24 (all Complete); NGADD-01 -> Phase 23 (Complete), yarn-parity closed in 24-06. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TBD/FIXME/XXX/HACK/PLACEHOLDER in any 24-06-touched file (schematic.ts, angular-cli-wiring.ts + spec, ng-add.spec.ts, configuration/init generators, eslint.config.mjs, yarn e2e spec) | - | Clean |
| (none) | - | No non-gmail email token in changed public files (README, CHANGELOG, e2e specs, schematic/core sources); only `larsbrinknielsen@gmail.com` where present | - | Public-repo hygiene OK |

Note (informational, not a debt marker): the schematic JSDoc was reworded during 24-06 to avoid the literal `@nx/devkit` token (tsc preserves comments into dist, which would trip the dist blocking-constraint grep). The current comment says "the Nx devkit / nx runtime" -- accurate and grep-clean.

### Human Verification Required

**1. Re-run the ACV-01 real-clone tarball gate against post-24-06 HEAD (recommended before v0.2.1 release; LOW risk)**

- **Test:** Pack the shipped tarball; against a fresh clone of `bluehalo/ngx-leaflet` (on-stack Ng22, app `ngx-leaflet-demo` + lib `ngx-leaflet`) and the `realworld-angular` exact-stack app clone, run `ng add angular-typechecker` (FIRST run -- there is no longer a `ng g ...:ng-add` fallback), then `ng run <project>:typecheck`, per 24-ACV-01-UAT.md.
- **Expected:** `ng add` auto-wires a `typecheck` architect target with the 2-element `[tsconfig.app.json, tsconfig.spec.json]` array into every application + library on the first run (no stray nx.json); clean baseline exits 0; planted per-leaf errors are caught with per-project scoping (no cross-bleed); no ERR_REQUIRE_ESM; no `chalk.blue is not a function` throw under yarn.
- **Why human:** ACV-01 is the external, manual, milestone-FINAL tarball gate against uncommitted real OSS clones -- not programmatically runnable here. 24-06 DELETED the generator and rewrote the exercised ng-add path AFTER the last (2026-07-11) UAT execution, so the prior PASS no longer covers HEAD. Risk is LOW: the CI-authoritative automated ACV-02 e2e (npm + yarn flat + yarn workspace collision + pnpm collision) exercises the identical `ng add` auto-wire -> `ng run` flow on the NEW code and is documented green 4/4, and the new schematic reads angular.json directly (the exact fix that resolved the original ACV-01 pnpm-collision defect). This is a confirmation, not a suspected regression.

### Gaps Summary

No blocking gaps. All six observable truths are VERIFIED at the code level, and the two 24-06 gap-closure objectives are achieved and verified against the codebase (not SUMMARY prose):

- **NGADD-01 (yarn first-run auto-wire):** the ng-add schematic is a vanilla `@angular-devkit/schematics` Rule that loads zero `@nx/devkit` -- confirmed at source (type-only schematics imports; value imports only from the pure core) AND at dist (`schematic.js` requires only `../../core/angular-cli-wiring`; grep-clean of `@nx/devkit`/`convertNxGenerator`/`nx`). The shared `src/core/angular-cli-wiring.ts` is imported by both the vanilla ng-add and the Nx `configuration` generator (byte-identical Nx behavior, spec-locked). The old generator is deleted; ng-add stays absent from `generators.json` and points at the vanilla schematic in `collection.json`. The yarn CLI e2e asserts first-run auto-wire (no `ng g` fallback).
- **README yarn caveat retired:** the product now auto-wires under yarn, so the README `## Angular CLI` section describes auto-wire-all with no yarn caveat (no `yarn` token present), and the tracking todo moved to `.planning/todos/done/`. The prior verification's tracked follow-up is RESOLVED.
- **ACP-02 additive-only still holds:** `nx:^23.0.0` is a direct dependency (not a peer), version stays `0.2.0`, `src/index.ts` is byte-unchanged vs the `0.2.0` tag, and the 24-06 commits touch no released surface (no `src/index.ts`, `src/executors/`, or `executors.json` changes). Guards green: `package-manifest.spec.ts` (20) + `@nx/dependency-checks` lint (maxWarnings:0).

The only open item is the manual ACV-01 real-clone gate re-run (see Human Verification): 24-06 rewrote the ng-add code path the gate exercises after its last execution. It is surfaced as a LOW-risk human confirmation before release, not a code gap -- the automated ACV-02 substrate covers the same flow on the new code and is green.

---

_Verified: 2026-07-15T12:20:00Z_
_Verifier: Claude (gsd-verifier)_
