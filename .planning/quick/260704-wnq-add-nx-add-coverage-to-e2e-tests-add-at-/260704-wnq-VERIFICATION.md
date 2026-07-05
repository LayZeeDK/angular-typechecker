---
phase: 260704-wnq
verified: 2026-07-05T02:15:00Z
status: passed
score: 6/6 must-haves verified
re_verification:
  previous_status: none
  note: initial verification
---

# Quick Task 260704-wnq: Real `nx add` e2e coverage (npm + pnpm 11 + yarn 4) Verification Report

**Task Goal:** Add e2e coverage for the REAL `nx add angular-typechecker` command for ALL THREE package managers (npm, pnpm, yarn) at their latest majors compatible with Angular 22 + Nx 23, reusing the shared Verdaccio globalSetup.
**Verified:** 2026-07-05T02:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | npm spec runs the REAL `nx add angular-typechecker` (not install-by-name, not `nx g :init`) and asserts init seeded the typecheck targetDefaults | VERIFIED | `nx-add-npm.int.spec.ts:98` `sh('npx nx add angular-typechecker', ...)`; provision at `:93` is `npm install` (deps only, not the tested command); post-assert `:109-113` |
| 2 | pnpm spec runs the REAL `nx add` on a pnpm 11 workspace and asserts the OBSERVED build-gate FAILURE | VERIFIED | `nx-add-pnpm.int.spec.ts:160` `sh('npx nx add angular-typechecker', ...)`; failure asserted `:176-183` |
| 3 | yarn spec runs the REAL `nx add` on a yarn 4 workspace at Verdaccio and asserts OBSERVED SUCCESS (init seeds targetDefaults) | VERIFIED | `nx-add-yarn.int.spec.ts:136` `sh('corepack yarn nx add angular-typechecker', ...)`; post-assert `:150-154` |
| 4 | All three new specs consume the shared Verdaccio globalSetup (inject verdaccioUrl/verdaccioToken); no second registry | VERIFIED | `inject('verdaccioUrl'/'verdaccioToken')` in all three (npm `:55-56`, pnpm `:90-91`, yarn `:63-64`); globalSetup `provide(...)` at `global-setup.ts:172-173`; no `startVerdaccio` import in any new spec |
| 5 | CI e2e job makes yarn resolvable (`corepack enable`) so nx add's bare-`yarn add` child resolves | VERIFIED | `ci.yml:161` `- run: corepack enable`, placed after `setup-node` (`:151-154`) in the `e2e` job |
| 6 | Full install-e2e suite passes + `nx format:check` + lint clean | VERIFIED (via runner, authoritative) | Executor ran `nx test angular-typechecker-install-e2e` = 9 files / 32 tests PASS; `format:check` + `run-many -t lint` clean (SUMMARY, corroborated by 9 committed spec files + fixture baseline non-vacuous) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `nx-add-npm.int.spec.ts` | Real `nx add` on npm; asserts seeded targetDefaults | VERIFIED | 118 lines; real command + absent-before baseline (`:78-83`) + WALK-02 asserts (`cache===true`, `outputs===[]`, `inputs[0]==='default'`) |
| `nx-add-pnpm.int.spec.ts` | Real `nx add` on pnpm 11; asserts ignored-builds gate signature | VERIFIED | 190 lines; non-vacuous `caught` guard (`:156,162,176-179`) + `ERR_PNPM_IGNORED_BUILDS` + `Failed to install angular-typechecker`; NO `allowBuilds`/`onlyBuiltDependencies` key in fixture (`onlyBuiltDependencies` appears in a comment only) |
| `nx-add-yarn.int.spec.ts` | Real `nx add` on yarn 4 at Verdaccio; asserts seeded targetDefaults | VERIFIED | 161 lines; `.yarnrc.yml` with npmRegistryServer/npmAuthToken from inject + `npmMinimalAgeGate: 0` + per-fixture cache; absent-before baseline (`:112-119`) + WALK-02 asserts |
| `.github/workflows/ci.yml` | corepack enable step in e2e job | VERIFIED | `:161` plain `run:` step, after setup-node, before pnpm/action-setup; no PR-metadata interpolation |
| `nx-add-e2e.int.spec.ts` (retained) | Pre-existing `nx g :init` substitute spec NOT deleted | VERIFIED | Still present (6425 bytes, unchanged mtime); untouched by this task |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| nx-add-npm | shared Verdaccio | `inject('verdaccioUrl')` + fixture `.npmrc` (registry + nerf-dart token) | WIRED |
| nx-add-pnpm | shared Verdaccio | `inject('verdaccioUrl')` + fixture `.npmrc` | WIRED |
| nx-add-yarn | shared Verdaccio | `inject('verdaccioUrl')` + `.yarnrc.yml` (npmRegistryServer + npmAuthToken) | WIRED |
| all three | real nx add | bare `<pm> ... nx add angular-typechecker` (NOT `nx g :init`, NOT install-by-name) | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
| --- | --- | --- | --- | --- |
| npm/yarn specs | `nx.json` targetDefaults post-`nx add` | init generator writes it after real install from local Verdaccio dist | Yes -- absent-before baseline proves the key is genuinely seeded, not pre-declared | FLOWING |
| pnpm spec | thrown Error message from `sh` | real `nx add` non-zero exit; `sh` rethrows combined stdout+stderr | Yes -- `caught===true` guard + provisioning guard (`node_modules/nx` exists) prevent false-green | FLOWING |
| all specs | `verdaccioUrl`/`verdaccioToken` | `provide()` in shared globalSetup | Yes -- `startsWith('http://localhost:')` re-assert | FLOWING |

### Behavioral Spot-Checks

Skipped re-running the slow e2e suite per task instruction (builds+publishes dist, runs real package managers, ~20+ min). Authoritative test-runner signal already produced by the executor: 9 files / 32 tests PASS (exit 0), format:check clean, lint clean. Committed state cross-checked: `git status` clean (only the untracked VERIFICATION planning dir), 4 files committed across `97deb06`/`7e61c06`/`dd639c1`/`f0dd652`.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| QUICK-wnq-nx-add-e2e | Real `nx add` e2e coverage for npm/pnpm/yarn reusing shared Verdaccio | SATISFIED | Three specs + CI corepack step; all truths verified |

### Anti-Patterns Found

None. No debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) in the four modified files. Comment references to `onlyBuiltDependencies` and `pnpm exec nx add` are deliberate documentation of AVOIDED patterns, not live code.

### Human Verification Required

None. The structural truths are confirmed in the committed codebase; the runtime truth is backed by the executor's already-run authoritative test-runner signal (which the task treats as sufficient), and CI runs the yarn/pnpm paths via the added `corepack enable` step.

### Gaps Summary

No gaps. All six must-haves verified against the actual codebase:
1. Each spec drives the REAL `nx add angular-typechecker` (npm/pnpm via `npx nx add`, yarn via `corepack yarn nx add`) -- confirmed the executor's documented pnpm correction (`npx nx add`, plain gated `pnpm install`) is what shipped, not the plan's original `pnpm exec` / `--ignore-scripts`.
2. npm + yarn assert the absent-before baseline (fixture nx.json has no such key -> non-vacuous) and the WALK-02 seeded shape.
3. pnpm asserts the failure non-vacuously (`caught===true` before substring asserts) on stable substrings `ERR_PNPM_IGNORED_BUILDS` + `Failed to install angular-typechecker`; fixture carries no pnpm-10 `onlyBuiltDependencies` key.
4. All three consume the shared globalSetup via inject(); no second registry stood up.
5. ci.yml e2e job gains a `corepack enable` step after setup-node.
6. The pre-existing `nx-add-e2e.int.spec.ts` substitute spec is retained unchanged.

---

_Verified: 2026-07-05T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
