---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
verified: 2026-07-12T10:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed:
    - "ACP-02 (24-04): yarn does not auto-install the @nx/devkit peer `nx`, so `nx` is now a direct `^23.0.0` dependency in the published manifest (NOT peerDependencies); @nx/devkit stays exact 23.0.1. Both manifest guards inverted (package-manifest.spec.ts asserts nx IS a ^23.0.0 dep + still not a peer), @nx/dependency-checks green (nx in ignoredDependencies), operative constraint flipped in PROJECT.md + CLAUDE.md. Verified: nx test 349 / nx lint / nx build all green; dist manifest carries nx:^23.0.0; version still 0.2.0."
    - "ACV-02 (24-05): CLI x yarn 4 e2e (flat + workspace) finalized to REAL `ng add` install + `ng g :ng-add` wire (yarn ng-add no-autowire quirk asserted+locked), temp scaffolding stripped, enableMirror:false retained, libClean baseline added (code-review fix). New committed CLI x pnpm 11 name-collision e2e asserts the full [tsconfig.app.json, tsconfig.spec.json] array (app build leaf never dropped) + per-project scoping. Both specs committed (76c6f35, c5c6912, 724c570); documented green in 24-05-SUMMARY + fix report."
  gaps_remaining: []
  regressions: []
notes:
  - "Deferred (tracked, user-owned release decision -- NOT a phase-24 gap): README `## Angular CLI` states `ng add` auto-wires every project, which is accurate for npm/pnpm but not yarn (under yarn `ng add` installs but does not run the ng-add schematic; user must `ng g angular-typechecker:ng-add`). Recorded in .planning/todos/pending/readme-yarn-ng-add-caveat.md. ACD-01's enumerated items are all present; the yarn caveat is a release-facing accuracy refinement, not part of ACD-01's defined scope. The yarn no-autowire behavior is itself a documented, locked test-harness quirk (resolved debug doc), asserted by the yarn e2e."
---

# Phase 24: Real-OSS + Scaffolded e2e, Additive-Only Audit, Docs Verification Report

**Phase Goal:** real-OSS + scaffolded Angular CLI (`ng add` -> `ng run`) e2e coverage, additive-only vs `angular-typechecker@0.2.0`, with the docs (README `## Angular CLI` + CHANGELOG) shipped. Plus the 2026-07-12 gap closure: yarn does not auto-install the `@nx/devkit` peer `nx`, so `nx` is now a direct dependency, and the CLI x yarn/pnpm e2e coverage is finalized.
**Verified:** 2026-07-12T10:05:00Z
**Status:** passed
**Re-verification:** Yes -- after gap-closure plans 24-04 (nx-dependency fix) + 24-05 (yarn/pnpm CLI e2e) + a post-verification code-review-fix (WR-01 libClean, IN-01/IN-02 title). Prior verdict was `passed 5/5`; this re-verifies it STILL holds with the gap-closure work integrated.

## Goal Achievement

The prior `passed 5/5` verdict holds. The gap-closure changeset (24-04 + 24-05 + code-review-fix) is integrated on a clean working tree and re-verified against the actual codebase, not SUMMARY claims: the shipped manifest now declares `nx` directly (closing the yarn UX gap the CLI x yarn e2e surfaced), both enforcement guards were inverted and stay green, the yarn/pnpm CLI e2e specs are finalized + committed + substantive, and the additive-only charter still holds (a `dependencies` addition on unreleased/widened surface; version unchanged at 0.2.0).

### Observable Truths

| # | Truth (requirement) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | ACP-02: additive-only enforced AND audited; `nx` declared as a direct `^23.0.0` dependency (NOT a peer), @nx/devkit exact 23.0.1; guards enforce it; version stays 0.2.0. | VERIFIED | `package.json:49-53` `dependencies: {@nx/devkit:23.0.1, nx:^23.0.0, tslib:^2.3.0}`; `peerDependencies` (54-59) has NO `nx`. `package-manifest.spec.ts:85-88` + `:191-194` assert `dependencies.nx === '^23.0.0'` AND `not.toHaveProperty('nx')` on peers (non-vacuous, populated peer object). `eslint.config.mjs:95` `ignoredDependencies: ['nx', '@angular-devkit/architect', 'rxjs']`. Behavioral: `nx test` 38 files/349 tests green, `nx lint` "All files pass" (maxWarnings:0), `nx build` success, dist manifest `dependencies.nx === '^23.0.0'`, version 0.2.0. `24-ADDITIVE-AUDIT.md` s.1-5 verdict ADDITIVE-ONLY (dependency addition additive vs 0.2.0). |
| 2 | ACV-02: CI-authoritative Angular CLI e2e proves the REAL `ng add` -> `ng run <project>:typecheck` flow on npm, yarn 4 (flat + workspace), pnpm 11 (root name collision), with per-project scoping and the app build leaf never dropped. | VERIFIED | Three committed specs auto-join `ng-cli-e2e` (no project.json edit). yarn spec: real `ng add angular-typechecker --skip-confirmation` install (:286), asserts no-wire after `ng add` (:296-297, locks the yarn quirk), wires via `ng g angular-typechecker:ng-add` (:302), full `[tsconfig.app.json, tsconfig.spec.json]` app array + lib array (:313-320), no stray nx.json (:323), appClean+libClean baselines (:328-331), per-leaf scoping TS2322+TS2345 app / TS2554 lib no cross-bleed (:352-368), no ERR_REQUIRE_ESM, `enableMirror:false` retained (:231), 127.0.0.1 safety (:249), no temp scaffolding. pnpm spec: root name collision (`packages:['.']`), full app array assertion (:277-284, the ACV-01 gate #2 lock), per-project scoping, effective-pnpm-major===11 assertion (:256-259), `strictDepBuilds:false`. Committed 76c6f35/c5c6912/724c570; green in 24-05-SUMMARY (Test Files 3/Tests 4) + fix report (post-libClean re-run). |
| 3 | ACV-01: shipped tarball proven against REAL cloned OSS Angular 22 workspaces via `ng add` -> `ng run`. | VERIFIED | Unchanged by gap closure. Both clones executed 3/3 PASS (24-ACV-01-UAT / 24-HUMAN-UAT). Generator fix commit `1837b25` confirmed ancestor of HEAD; `generator.ts:251-273` reads `root`/`projectType` straight from `angular.json` (`readJson<AngularJsonWorkspace>(tree,'angular.json').projects[schema.project]`), `resolveTsConfigLeaves(tree, root, projectType, schema)` (:152). |
| 4 | ACV-03: unit+integration coverage of the Angular-CLI-vs-Nx differences. | VERIFIED | Unchanged by gap closure. `builder.integration.spec.ts` + `configuration-angular-cli.spec.ts` (pnpm-collision regression) + write-fork array resolution; 349-test suite green incl. drift barrel tripwire under `nx typecheck` (success). |
| 5 | ACD-01: README `## Angular CLI` section (all enumerated items) + curated CHANGELOG in end-user language, no internal ids. | VERIFIED | `README.md:381-471` covers ng add auto-wire-all, `ng generate ...:configuration`, `ng run <project>:typecheck`, per-project target, tsConfig array shape, nx-transitive + `.nx/` + no-caching, off-stack `--legacy-peer-deps`; Storybook caveat preserved (:461-463). `CHANGELOG.md:5-45` `## 0.2.1` prose + Compatibility block, no internal ids, no cut date (finalized at Release-PR). `angular-cli-docs.spec.ts` 9 tests green. See notes: a yarn-specific `ng add` accuracy caveat is a tracked, user-owned release follow-up, not an ACD-01 scope item. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/package.json` | `nx:^23.0.0` in `dependencies`, @nx/devkit exact, no nx peer, version 0.2.0 | VERIFIED | Lines 49-53 / 54-59; version 0.2.0. |
| `packages/angular-typechecker/src/package-manifest.spec.ts` | inverted nx guard (IS ^23.0.0 dep, NOT a peer) at both sites | VERIFIED | :85-88, :191-194; non-vacuous. |
| `packages/angular-typechecker/eslint.config.mjs` | `nx` in `@nx/dependency-checks` ignoredDependencies + accurate comment | VERIFIED | :95 (`['nx', ...]`); comment :86-94 states nx IS a direct dep. |
| `e2e/.../ng-add-ng-run-yarn.e2e.spec.ts` | real ng add + ng g wire, no scaffolding, enableMirror:false, libClean | VERIFIED | Substantive, wired, committed; docstring accurately scopes the yarn quirk. |
| `e2e/.../ng-add-ng-run-pnpm.e2e.spec.ts` | CLI x pnpm name-collision, full [build,spec] array | VERIFIED | Committed (c5c6912); regression lock at :277-284. |
| `packages/angular-typechecker/src/generators/configuration/generator.ts` | CLI write-fork reads root/projectType from angular.json | VERIFIED | 1837b25 in HEAD; :251-273. No debt markers. |
| `packages/angular-typechecker/README.md` (`## Angular CLI`) | all D-06 items | VERIFIED | :381-471. |
| `CHANGELOG.md` (`## 0.2.1`) | curated prose, no cut/ids | VERIFIED | :5-45. |
| `.planning/.../24-ADDITIVE-AUDIT.md` | ACP-02 verdict incl. dependency delta | VERIFIED | s.5 covers the nx-dependency addition disposition (additive). |
| `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` | debug doc resolved + moved | VERIFIED | Moved to `resolved/`; working tree clean (start-of-session untracked copy is gone). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `package.json` dependencies | `@nx/devkit` -> `require('nx/src/devkit-exports')` | `nx:^23.0.0` direct dep (yarn installs direct deps; skips peers) | WIRED | dist manifest confirms nx:^23.0.0 ships; `^23.0.0` is a strict subset of @nx/devkit's `nx` peer -> no double-constraint. |
| `eslint.config.mjs` | `@nx/dependency-checks` obsoleteDependency | `ignoredDependencies:['nx',...]` | WIRED | `nx lint` green at maxWarnings:0. |
| `package-manifest.spec.ts` | `package.json` | `readFileSync` + `dependencies.nx` assertion | WIRED | `nx test` green. |
| yarn e2e | `corepack yarn ng add angular-typechecker --skip-confirmation` | real ng add (nx auto-installed as direct dep) | WIRED | Install path + no-wire assertion + ng g wire. |
| pnpm e2e | app target `tsConfig == [tsconfig.app.json, tsconfig.spec.json]` | pnpm-workspace root collision -> ng add -> write-fork reads angular.json | WIRED | Full-array regression lock. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suite (incl. inverted nx manifest guard + docs tripwire) | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 38 files / 349 tests passed | PASS |
| Lint (maxWarnings:0; @nx/dependency-checks + @nx/nx-plugin-checks) | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | All files pass linting | PASS |
| Typecheck incl. additive-only barrel drift tripwire | `NX_DAEMON=false npx nx typecheck angular-typechecker --skip-nx-cache` | success | PASS |
| Build (compiled .js executor) | `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` | success | PASS |
| Shipped dist manifest carries nx dep | `node -e require('./dist/.../package.json').dependencies.nx` | `^23.0.0` | PASS |
| Version unchanged (ACP-02: no v0.3.0) | `node -e require(...).version` | `0.2.0` | PASS |
| Generator fix in HEAD | `git merge-base --is-ancestor 1837b25 HEAD` | ancestor (clean tree) | PASS |
| CLI x yarn/pnpm e2e (full `ng add`->`ng run` matrix) | `npx nx e2e angular-typechecker-ng-cli-e2e` | NOT re-run this pass (heavy: corepack yarn 4 + pnpm 11 + Verdaccio, ~15-20min). Verified by substantive read + committed state + documented-green (24-05-SUMMARY 3 files/4 tests; fix report post-libClean re-run). | SKIP (documented green) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACV-01 | 24-03 | Real-clone tarball final gate | SATISFIED | Both clones 3/3 PASS; fix 1837b25 in HEAD. |
| ACV-02 | 24-03 + 24-05 | Scaffolded + yarn + pnpm CLI e2e, per-project scoping | SATISFIED | npm + yarn(flat/workspace) + pnpm(collision) specs committed + substantive + green. |
| ACV-03 | 24-01 | Unit+integration CLI-vs-Nx diff coverage | SATISFIED | builder.integration + write-fork regression suite green. |
| ACP-02 | 24-01 + 24-04 | Additive-only enforced + audited (incl. nx-dependency fix) | SATISFIED | nx as direct ^23.0.0 dep + guards green + audit s.5 + version 0.2.0. |
| ACD-01 | 24-02 | README `## Angular CLI` + CHANGELOG | SATISFIED | README section + 9-test docs tripwire + 0.2.1 prose. |

All 5 PLAN-declared requirement IDs (ACV-01, ACV-02, ACV-03, ACP-02, ACD-01) map to Phase 24 in REQUIREMENTS.md (Traceability table, all "Complete"). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | No TBD/FIXME/XXX in gap-closure or fix-touched files (package.json, package-manifest.spec.ts, eslint.config.mjs, generator.ts, both e2e specs) | - | Clean |
| (none) | - | No non-gmail email token in changed public files (README, CHANGELOG, e2e specs, CLAUDE.md); only `larsbrinknielsen@gmail.com` | - | Public-repo hygiene OK |

### Human Verification Required

None. The two ACV-01 real-clone gates (the only prior human items) were executed and PASS in the initial verification and are unchanged by the gap closure. The gap-closure work is fully machine-verifiable and re-verified green here.

### Gaps Summary

No gaps. The two gap-closure objectives are both achieved and verified against the codebase:

- **ACP-02 (nx dependency):** `packages/angular-typechecker/package.json` declares `"nx": "^23.0.0"` in `dependencies` (not peerDependencies); `@nx/devkit` stays exact `23.0.1`. The manifest guard (`package-manifest.spec.ts`, both sites) and the `@nx/dependency-checks` lint both enforce it green. `nx test` (349), `nx lint`, `nx build`, and `nx typecheck` (with the additive-only barrel drift tripwire) all pass; the built dist manifest ships `nx:^23.0.0`; version is unchanged at `0.2.0`; the additive audit (s.5) confirms the dependency addition is additive vs 0.2.0.
- **ACV-02 (yarn/pnpm CLI e2e):** the yarn spec is finalized to the real `ng add` install + `ng g` wire (with the yarn ng-add no-autowire quirk asserted and locked, `enableMirror:false` retained, temp scaffolding removed, and the code-review `libClean` baseline added), and the new committed pnpm name-collision spec asserts the full `[tsconfig.app.json, tsconfig.spec.json]` array (app build leaf never dropped) plus per-project scoping. Both specs are substantive, correctly wired, and committed.

One tracked follow-up is surfaced (see frontmatter `notes`): the README `## Angular CLI` section describes `ng add` auto-wire-all without a yarn-specific caveat, which is inaccurate for yarn only (installs but does not run the ng-add schematic). This is a release-facing documentation-accuracy decision owned by the user, already recorded in `.planning/todos/pending/readme-yarn-ng-add-caveat.md`, and is NOT a phase-24 verification gap: ACD-01's enumerated items are all present, and the yarn no-autowire behavior is a documented, locked quirk asserted by the yarn e2e.

Note: the full CLI e2e (`nx e2e angular-typechecker-ng-cli-e2e`) was not re-executed in this pass (heavy environment-dependent toolchain: corepack yarn 4 + pnpm 11 + Verdaccio publish, ~15-20min). ACV-02 is verified from substantive read of the committed specs + documented-green evidence (24-05-SUMMARY: 3 files/4 tests; 24-REVIEW-GAP-2404-2405-FIX.md: post-`libClean` re-run green). The fast, directly-affected ACP-02 gates (test/lint/build/typecheck) were re-run here and are green.

---

_Verified: 2026-07-12T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
