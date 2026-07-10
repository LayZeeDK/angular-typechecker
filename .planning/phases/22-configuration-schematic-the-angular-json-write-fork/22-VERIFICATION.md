---
phase: 22-configuration-schematic-the-angular-json-write-fork
verified: 2026-07-10T21:11:34Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Real `ng generate angular-typechecker:configuration <project>` against the cloned bluehalo/ngx-leaflet workspace writes the expected leaf arrays"
    addressed_in: "Phase 24"
    evidence: "22-VALIDATION.md Manual-Only table: 'The CI-authoritative proof is the seeded-tree unit test; the real ng g library scaffold proof is Phase 24 (ACV-02).' REQUIREMENTS.md maps ACV-01/ACV-02 (real-OSS + scaffolded e2e) to Phase 24."
---

# Phase 22: `configuration` schematic + the `angular.json` write-fork Verification Report

**Phase Goal:** `ng generate angular-typechecker:configuration <project>` wires ONE per-project `typecheck` architect target into `angular.json`, scoped to exactly that project's complete leaf set, via a single shared generator with a `tree.exists('angular.json')` fork -- leaving the Nx generator path byte-unchanged.
**Verified:** 2026-07-10T21:11:34Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ACS-01: On an angular.json workspace, the shared generator writes `projects.<p>.architect.<targetName> = { builder: 'angular-typechecker:typecheck', options: { tsConfig: [buildLeaf, specLeaf] } }` via `updateJson`, config-edit-only, one shared generator with an early `tree.exists('angular.json')` fork, zero new dependency | VERIFIED | `generator.ts:238-275`: `if (tree.exists('angular.json'))` fork; `updateJson<AngularJsonWorkspace>(tree, 'angular.json', ...)` writes `project.architect[targetName] = { ...existing, builder: TYPECHECK_EXECUTOR_ID, options: { ...existing?.options, tsConfig } }`. Only imports `@nx/devkit` + the local init generator's `TYPECHECK_EXECUTOR_ID`. 10 CLI-fork cases green. |
| 2 | ACS-02: The Nx path is byte-unchanged -- single-string solution `tsConfig` via `project.json`; existing `configuration.spec.ts` stays green untouched | VERIFIED | `git diff b168ebc^ HEAD` on generator.ts removes only doc comments + the hoisted targetName-guard/init lines; `resolveTsConfig`/`resolveTsConfigOverride` bodies unchanged. Else-branch (277-320) keeps `initGenerator` -> `resolveTsConfig` -> `updateProjectConfiguration`. `configuration.spec.ts` (14 tests) green. |
| 3 | COV-01: Per-project scoping -- each target's tsConfig array equals EXACTLY that project's leaves, no cross-project bleed, on a two-project seeded tree | VERIFIED | `configuration-angular-cli.spec.ts:95-122` "scopes each target to EXACTLY its own leaves" configures BOTH projects on one seeded tree and asserts disjoint exact arrays (`['tsconfig.app.json','tsconfig.spec.json']` vs `['projects/ngx-leaflet/tsconfig.lib.json','projects/ngx-leaflet/tsconfig.spec.json']`). Green. |
| 4 | ACS-02/D-04: The CLI branch creates NO stray `nx.json` (init skipped) | VERIFIED | Fork returns before the else-branch `initGenerator`; `generator.ts:270-274`. Test "creates NO stray nx.json on the CLI branch" asserts `tree.exists('nx.json') === false` after a run. Green. |
| 5 | ACS-01/D-05: A re-run of OUR target is idempotent (preserves user keys + extra options); a same-named NON-ours target throws a clear located error; empty/whitespace `--targetName` rejected | VERIFIED | `generator.ts:250-265` collision-by-builder-id throw + spread-preserve rewrite; `224-231` empty-name guard (hoisted, shared). Tests: idempotent (preserves `maxWarnings`+`configurations`), collision `/already has a "typecheck" target/`, empty-name `/must be a non-empty target name/`. All green. |
| 6 | ACS-04: A NEW `collection.json` declares the `configuration` schematic (factory -> `./src/schematics/configuration/schematic`, schema REUSES `./src/generators/configuration/schema.json`) | VERIFIED | `collection.json` present with exactly that factory + reused schema + description; advisory `$schema` present (resolves in node_modules). |
| 7 | ACS-04/D-06: `package.json` gains `"schematics": "./collection.json"` as a NEW SIBLING of executors/generators/builders + `collection.json` in `files` (never a replacement) | VERIFIED | `package.json:32` `"schematics": "./collection.json"`; `:42` `collection.json` in `files`; `executors`/`generators`/`builders` all still declared (`:29-31`). `package-manifest.spec.ts` (16 tests) asserts the allowlist + all four manifest fields. Green. |
| 8 | ACS-04/Pitfall 4: `project.json` build assets copy `collection.json` into the dist root so the shipped tarball includes it | VERIFIED | `project.json:42-46` fourth glob `{ input: ./packages/angular-typechecker, glob: collection.json, output: . }`. `nx build` green; `dist/packages/angular-typechecker/collection.json` present (354 bytes) AND `dist/.../src/schematics/configuration/schematic.js` present. |
| 9 | ACS-04: `nx g angular-typechecker:configuration` still resolves via `generators ?? schematics`; collection.json is Nx-invisible | VERIFIED | `nx-generators-surface-regression.spec.ts` (3 tests): `generators === './generators.json'`, `schematics === './collection.json'`, `generators.configuration.factory === './src/generators/configuration/generator'`. `generators.json` unchanged. Green. |
| 10 | ACS-04: Zero new production dependency -- `schematic.ts` imports only `@nx/devkit` + the local generator; `@nx/dependency-checks` + `nx lint` green | VERIFIED | `schematic.ts` = `convertNxGenerator(configurationGenerator)`, imports only `@nx/devkit` + `../../generators/configuration/generator`. `nx lint` green (dependency-checks pass). Both SUMMARYs report `tech-stack.added: []`. Compiled `dist/.../schematic.js` confirms the CJS re-export. |
| 11 | Additive-only (ACP-02 spirit): no breaking change to the executor id, engine, builder, or public barrel | VERIFIED | Executor id `angular-typechecker:typecheck` unchanged (via `TYPECHECK_EXECUTOR_ID`, reused as CLI builder id). `src/index.ts` barrel unchanged (only `runTypecheck`/`TypecheckInfrastructureError`/types). `builders.json` + `nx-surface-regression.spec.ts` (3 tests) green. Engine files untouched. |

**Score:** 11/11 truths verified

### Deferred Items

Items not required for Phase 22 goal achievement but explicitly assigned to a later phase.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Real `ng generate ...:configuration` against the uncommitted `bluehalo/ngx-leaflet` clone writes the expected leaf arrays (confidence check) | Phase 24 | 22-VALIDATION.md Manual-Only: "CI-authoritative proof is the seeded-tree unit test; the real `ng g library` scaffold proof is Phase 24 (ACV-02)." REQUIREMENTS.md maps ACV-01/ACV-02 to Phase 24. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/generators/configuration/generator.ts` | `resolveTsConfigLeaves` helper + early `tree.exists('angular.json')` write-fork; Nx branch verbatim as else | VERIFIED | Helper at 145-176; fork at 238-275; Nx else-branch 277-320. Imported by schematic.ts + both specs. |
| `src/generators/configuration/configuration-angular-cli.spec.ts` | Seeded-angular.json spec, 10 cases, min 120 lines | VERIFIED | 248 lines, 10 `it` cases, seeded two-project substrate (nx.json deleted). Collected + green (10 tests). |
| `collection.json` | Schematics manifest declaring `configuration` only | VERIFIED | Present; single `configuration` entry. Ships to dist. |
| `src/schematics/configuration/schematic.ts` | `convertNxGenerator(configurationGenerator)` re-export | VERIFIED | Present; compiles to CJS `schematic.js` in dist. |
| `src/schematics/configuration/nx-generators-surface-regression.spec.ts` | `generators ?? schematics` regression, min 40 lines | VERIFIED | 55 lines, 3 assertions. Green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| generator.ts | readProjectConfiguration angular.json polyfill | `readProjectConfiguration(tree, schema.project)` | WIRED | Line 239 inside the fork -- gives root + projectType off-Nx. |
| generator.ts | angular.json#projects.<p>.architect | `updateJson(tree, 'angular.json', ...)` | WIRED | Line 242 -- the single fork write. |
| resolveTsConfigLeaves | projectConfig.root | `joinPathFragments(root, leaf)` + `tree.exists` probe | WIRED | Lines 160-166 scope the array to that project only. |
| package.json#schematics | collection.json | `"schematics": "./collection.json"` | WIRED | package.json:32. |
| collection.json#factory | schematic.ts | factory path -> `convertNxGenerator(configurationGenerator)` | WIRED | Factory resolves to compiled `schematic.js` (convertNxGenerator confirmed in dist). |
| project.json build assets | dist/.../collection.json | asset glob `"glob": "collection.json"` | WIRED | project.json:42-46; dist artifact present. |

### Data-Flow Trace (Level 4)

N/A -- this phase produces a build-time generator/manifest, not a UI rendering dynamic data. The equivalent "does real data flow" check is that the resolved `tsConfig` leaf array is a genuine existence-probed set (never `[undefined, ...]` or a hardcoded empty), verified by the single-leaf and no-leaf edge tests + the exact-array COV-01 assertion.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full fast-tier suite | `nx test angular-typechecker --skip-nx-cache` | 288 passed (34 files); incl. 10 CLI-fork + 14 Nx + 3 surface-regression + 16 manifest | PASS |
| Type-clean | `nx typecheck angular-typechecker --skip-nx-cache` | exit 0 (3 tsc --noEmit projects) | PASS |
| Lint (manifest + dependency-checks) | `nx lint angular-typechecker --skip-nx-cache` | "All files pass linting" | PASS |
| Build ships collection + schematic + reused schema | `nx build ...` + `ls dist/...` | collection.json + schematic.js + schema.json all present in dist | PASS |
| Collision read/write both use `architect` (WR-01 fix, cfecebe) | code read + suite | generator.ts:248 reads `project.architect?.[targetName]`, :258-265 writes `project.architect`; no `targets` alias; 288 tests green | PASS |

### Probe Execution

No probe scripts declared for this phase (`scripts/*/tests/probe-*.sh` absent; PLAN/SUMMARY declare none). The CI-authoritative proof is the fast-tier Vitest suite, executed above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ACS-01 | 22-01 | `ng generate ...:configuration` wires one per-project `typecheck` architect target with `tsConfig: [build leaf, spec leaf]` via the write-fork; config-edit-only, idempotent, collision-safe | SATISFIED | Truths 1, 5; 10 CLI-fork tests green |
| ACS-02 | 22-01 | Nx generator path stays behavior-unchanged; still writes single-string solution `tsConfig` | SATISFIED | Truths 2, 4; `configuration.spec.ts` (14) green; resolver bodies byte-unchanged |
| ACS-04 | 22-02 | `collection.json` + `package.json` `schematics` field added additively; `nx g` still resolves (`generators ?? schematics`) | SATISFIED | Truths 6-10; surface-regression (3) + manifest (16) tests green; dist ships collection.json |
| COV-01 | 22-01 | Per-project target checks that project's complete leaf set and ONLY its leaves (no bleed) | SATISFIED | Truth 3; two-project scoping test green |

No orphaned requirements: REQUIREMENTS.md maps exactly ACS-01, ACS-02, ACS-04, COV-01 to Phase 22 -- all claimed by a plan and all satisfied.

### Anti-Patterns Found

None. `git grep` for `TODO|FIXME|XXX|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented` across all 8 phase files returned no matches. No stub returns, no empty handlers, no hardcoded empty data flowing to output (the write-fork writes real existence-probed leaf arrays).

### Human Verification Required

None required for Phase 22 goal achievement. Every CI-authoritative behavior has automated fast-tier coverage (per 22-VALIDATION.md). The single Manual-Only item -- running the schematic against the real uncommitted `bluehalo/ngx-leaflet` clone -- is an explicit non-authoritative confidence check whose binding proof is deferred to Phase 24 (ACV-01/ACV-02); it is recorded under Deferred Items, not as a phase gate.

### Gaps Summary

No gaps. The phase goal is achieved and independently verified against the codebase and the authoritative test/build runner:

- The `tree.exists('angular.json')` write-fork exists in the single shared generator, writes the per-project `architect.typecheck` target with the existence-probed leaf array via `updateJson`, is collision-safe and idempotent, and skips the Nx init (no stray `nx.json`).
- The Nx else-branch and its `resolveTsConfig`/`resolveTsConfigOverride` resolvers are byte-unchanged; `configuration.spec.ts` passes untouched.
- Per-project scoping (COV-01) is proven on a two-project seeded tree with disjoint exact arrays.
- The Angular CLI surface is wired additively: `collection.json` + the `schematics` field + the `files` entry + the build-asset glob, with `nx g` still resolving via `generators ?? schematics` (proven, not assumed) and zero new production dependency.
- Additive-only holds: executor id, engine, builder, and public barrel are untouched.
- The WR-01 code-review fix (commit cfecebe) is in place -- collision read and write both operate on `architect` -- and the suite is green (288) after it.

---

_Verified: 2026-07-10T21:11:34Z_
_Verifier: Claude (gsd-verifier)_
