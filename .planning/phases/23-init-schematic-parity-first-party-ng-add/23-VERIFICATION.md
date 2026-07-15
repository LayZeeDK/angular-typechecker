---
phase: 23-init-schematic-parity-first-party-ng-add
verified: 2026-07-11T09:20:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
requirements_verified: [ACS-03, NGADD-01, ACP-01]
---

# Phase 23: `init` schematic parity + first-party `ng-add` Verification Report

**Phase Goal:** `ng add angular-typechecker` installs the package and auto-wires a `typecheck` target into every `application` + `library` project in `angular.json`, with an explicit "no target caching on Angular CLI" notice, an `init` schematic for parity that seeds no caching, and correct optional-peer dependency classification.
**Verified:** 2026-07-11T09:20:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 (NGADD-01) | `ng add angular-typechecker` runs a first-party `ng-add` schematic (in `collection.json`, NOT `generators.json`) that iterates `angular.json#projects`, wires a `typecheck` target into EVERY app + library project (idempotent; throws on non-ours same-named target; skips e2e/other), ensures the devDependency, prints the no-caching notice once, COMPOSES `configurationGenerator`, and returns VOID. | VERIFIED | `collection.json` declares `ng-add` -> `./src/schematics/ng-add/schematic`; `generators.json` does NOT (surface-regression spec asserts both). `ngAddGenerator` (`generator.ts`) calls `getProjects(tree)` (L78), filters `projectType in {application, library}` (L83-86), `await configurationGenerator(tree, { project: name, skipFormat: true })` (L87), returns `Promise<void>`. `git grep` confirms NO `addDependenciesToPackageJson`/`GeneratorCallback`/`installPackagesTask`. `ng-add.spec.ts` (13 cases) exercises auto-wire-all, `--project` scoping, whole-workspace idempotency, user-key preservation, throw-on-non-ours, skip-e2e/other, devDep move, and notice-once against a real angular.json-seeded tree with `readProjectConfiguration` read-back. |
| 2 (ACS-03) | `ng generate angular-typechecker:init` is available for parity; on an Angular CLI workspace it seeds NO caching and creates no stray `nx.json`. | VERIFIED | `collection.json` declares `init` -> `./src/schematics/init/schematic`; `src/schematics/init/schematic.ts` is `export default convertNxGenerator(initGenerator)`. `initGenerator` has the additive `if (tree.exists('angular.json') && !tree.exists('nx.json')) { logger.info(NO_CACHING_NOTICE); return; }` fork BEFORE `readNxJson`/`updateNxJson`. `init-angular-cli.spec.ts` proves `nx.json` stays absent + `readNxJson` stays null on the CLI branch. |
| 3 (ACP-01) | `@angular-devkit/architect` + `rxjs` declared as OPTIONAL peerDependencies (`peerDependenciesMeta.optional`), `@nx/dependency-checks` green, `nx`-transitive + `.nx/` consequence documented. | VERIFIED | `package.json` peerDependencies carry `@angular-devkit/architect: >=0.2200.0 <0.2300.0` + `rxjs: ^6.5.3 \|\| ^7.4.0`; `peerDependenciesMeta` marks BOTH `optional: true`; `nx` absent. `eslint.config.mjs` `@nx/dependency-checks` has hand-added `ignoredDependencies: ['@angular-devkit/architect', 'rxjs']` + a doc comment covering WHY and the `nx`-transitive/`.nx/` consequence. `nx lint` exits 0 (maxWarnings:0). `package-manifest.spec.ts` locks the ranges + optional flags + `nx`-absent. |
| 4 (SC4) | Nx `nx add angular-typechecker` behavior unchanged from v0.2.0 (`ng-add` absent from `generators.json`; `nx add` runs `<pkg>:init`). | VERIFIED | `generators.json` declares only `configuration` + `init`, no `ng-add`. `generators` field still `./generators.json` (Nx resolves `generators ?? schematics`, so `collection.json` is Nx-invisible). Surface-regression spec asserts `generatorsManifest.generators['ng-add']` AND `.schematics['ng-add']` are both `undefined`. Nx else-branch of `initGenerator` is byte-unchanged; `init.spec.ts` + `target-defaults-drift.spec.ts` + `schema-parity.spec.ts` pass in the 314-test run. |

**Score:** 4/4 truths verified

### Post-Review Fix Regression Check

| Fix | Status | Evidence |
| --- | ------ | -------- |
| WR-01 (discriminator `angular.json && !nx.json` in both init + configuration) | VERIFIED | `init/generator.ts:84` and `configuration/generator.ts:242` both gate on the full invariant. Hybrid-workspace lock tests added in BOTH `init-angular-cli.spec.ts` (L85-119) and `configuration-angular-cli.spec.ts` (L250+): both-files-present -> Nx branch seeds `targetDefaults` + no notice. Commit `4396ca6`. |
| WR-03 / IN-01 (`--project` throws on no match; notice + `formatFiles` gated on `wired>0`) | VERIFIED | `ng-add/generator.ts` tracks `wired`, throws located error when `schema.project && wired === 0` (L98-103), and returns before format/notice when `wired === 0` (L108-110). Specs: unknown-name throws, e2e-name throws, auto-wire-all-over-only-e2e stays silent. Commit `bbce0d0`. |
| WR-02 (architect widened `>=0.2200.0 <0.2300.0`, rxjs `^6.5.3 \|\| ^7.4.0`, both still optional) | VERIFIED | `package.json` L56-57 carry the widened ranges; `peerDependenciesMeta` unchanged (both optional). `package-manifest.spec.ts` L170/L176 assert the exact widened strings. Commits `4844438` + `93e6014`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/generators/ng-add/generator.ts` | Composed ngAddGenerator (guard + devDep move + enumerate-filter-compose + notice-once) | VERIFIED | 119 lines; composes `configurationGenerator`, imports `NO_CACHING_NOTICE`, returns void. Wired into `collection.json` via schematic re-export; compiles to `dist`. |
| `src/generators/ng-add/schema.json` + `schema.d.ts` | Minimal ng-add schema (`project?`, `skipFormat?`) | VERIFIED | `cli: nx`, `additionalProperties: false`, no `required`; `NgAddGeneratorSchema` matches. |
| `src/schematics/ng-add/schematic.ts` | `convertNxGenerator(ngAddGenerator)` re-export | VERIFIED | Thin re-export; compiled `schematic.js` shipped to `dist`. |
| `src/generators/init/generator.ts` | Additive `angular.json && !nx.json` fork + exported `NO_CACHING_NOTICE` | VERIFIED | Fork at L84; `NO_CACHING_NOTICE` exported (single source, imported by ng-add). Nx else-branch byte-unchanged. |
| `src/schematics/init/schematic.ts` | `convertNxGenerator(initGenerator)` re-export | VERIFIED | Present; compiled to `dist`. |
| `collection.json` | Declares `ng-add` + `init` + `configuration` | VERIFIED | All three present; ships to `dist/.../collection.json`. |
| `generators.json` | Declares `configuration` + `init` ONLY (no `ng-add`) | VERIFIED | Confirmed; `ng-add` absent. |
| `package.json` | Optional peers + `peerDependenciesMeta` + `ng-add.save` | VERIFIED | All additive fields present; `files`/`dependencies`/`nx`-absence unchanged. |
| `eslint.config.mjs` | `ignoredDependencies` lever + consequence doc comment | VERIFIED | Both peers listed; comment documents `nx`-transitive/`.nx/`. `checkVersionMismatches: false` preserved. |
| Specs (ng-add, init-angular-cli, package-manifest, surface-regression) | Real-tree behavioral coverage | VERIFIED | All present, all green in the 314-test run. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `ng-add/generator.ts` | `configuration/generator.ts` | `await configurationGenerator(tree, { project, skipFormat: true })` | WIRED | L87; composition confirmed, no re-implementation. |
| `ng-add/generator.ts` | `init/generator.ts` | `import { NO_CACHING_NOTICE }` | WIRED | L5; single-source notice printed once at L118. |
| `collection.json#schematics.ng-add.factory` | `src/schematics/ng-add/schematic.ts` | `convertNxGenerator(ngAddGenerator)` | WIRED | Factory path resolves; `schematic.js` in dist. |
| `collection.json#schematics.init.factory` | `src/schematics/init/schematic.ts` | `convertNxGenerator(initGenerator)` | WIRED | Factory path resolves; `schematic.js` in dist. |
| `package.json#peerDependenciesMeta` | `package.json#peerDependencies` (architect, rxjs) | `optional: true` | WIRED | Both peers marked optional. |
| `eslint.config.mjs ignoredDependencies` | architect + rxjs peers | dependency-checks short-circuit | WIRED | `nx lint` green. |

### Data-Flow Trace (Level 4)

Artifacts are `@nx/devkit` generators that mutate a virtual `Tree` (angular.json / package.json / nx.json), not dynamic-data renderers. The "data" flowing is the written target/dependency configuration, and it is proven flowing by the integration specs, which invoke the composed generators against real `angular.json`-seeded trees and read the result back via `readProjectConfiguration` / `tree.read('package.json')` -- e.g. `readProjectConfiguration(tree, 'ngx-leaflet-demo').targets?.typecheck` equals the concrete `{ executor: 'angular-typechecker:typecheck', options: { tsConfig: [...] } }` object. This is FLOWING (not static/hollow): the assertions compare the actual written target shape, not a hardcoded fixture.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit + integration suite (the CI-authoritative behavioral proof for this surface) | `nx test angular-typechecker --skip-nx-cache` | 314 passed / 36 files | PASS |
| Package builds + ships schematic artifacts | `nx build angular-typechecker --skip-nx-cache` | exit 0; `dist/.../collection.json`, `ng-add/generator.js`, `ng-add/schematic.js`, `init/schematic.js` all present | PASS |
| Dependency-checks gate green with optional peers | `nx lint angular-typechecker --skip-nx-cache` | exit 0 (maxWarnings:0) | PASS |
| Formatting clean | `nx format:check` | exit 0 | PASS |

Note: end-to-end `ng add` / `ng run` against a REAL Angular CLI workspace is explicitly Phase 24's scope (ACV-01/02/03) per ROADMAP + REQUIREMENTS; Phase 23 delivers unit/integration coverage of its own surface, which is the CI-authoritative proof here (23-CONTEXT `<specifics>`). Not a Phase 23 gap.

### Probe Execution

N/A -- generator/schematic phase, not a migration/tooling phase. No `scripts/*/tests/probe-*.sh` exist and none are declared in the PLAN/SUMMARY.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| ACS-03 | 23-01 | `ng generate ...:init` parity; seeds no caching, no stray nx.json | SATISFIED | init fork + schematic + `init-angular-cli.spec.ts`; REQUIREMENTS.md marks Complete. |
| NGADD-01 | 23-02 (RF-01 lever), 23-03 (generator) | first-party `ng-add` auto-wire-all + devDep + notice; Nx `nx add` unchanged | SATISFIED | ngAddGenerator + collection.json + `ng-add.save` + `ng-add.spec.ts` + surface-regression; REQUIREMENTS.md marks Complete. |
| ACP-01 | 23-02 | optional peers + dependency-checks green + consequence documented | SATISFIED | package.json + eslint.config.mjs + `package-manifest.spec.ts` + green `nx lint`; REQUIREMENTS.md marks Complete. |

No orphaned requirements: REQUIREMENTS.md maps exactly ACS-03, NGADD-01, ACP-01 to Phase 23, all claimed by plans, all satisfied.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER`/"not implemented" strings, and no `addDependenciesToPackageJson`/`GeneratorCallback`/`installPackagesTask` in the ng-add generator (all grep-confirmed absent across the phase's source + schematic files).

### Human Verification Required

None. Every success criterion is programmatically verifiable and is covered by green unit/integration tests against real `@nx/devkit` test trees plus the build/lint/format gates. The real-workspace end-to-end proof is deliberately scoped to Phase 24 (ACV-01/02/03) and is not part of Phase 23's contract.

### Gaps Summary

No gaps. All four ROADMAP success criteria are VERIFIED against the actual codebase (not just SUMMARY claims): the composed `ngAddGenerator` auto-wires app+library projects and is proven by read-back assertions; the `init` CLI fork seeds no caching and no stray `nx.json`; the two optional peers are correctly classified with a green dependency-checks gate; and the Nx `nx add` surface is provably unchanged (`ng-add` absent from `generators.json`). All three post-review fixes (WR-01, WR-02, WR-03/IN-01) landed, are reflected in the source, and are locked by dedicated tests -- with no regression to the goal. The suite is independently confirmed green: `nx test` = 314 passed across 36 files, `nx build` success (dist artifacts shipped), `nx lint` pass, `nx format:check` clean.

---

_Verified: 2026-07-11T09:20:00Z_
_Verifier: Claude (gsd-verifier)_
