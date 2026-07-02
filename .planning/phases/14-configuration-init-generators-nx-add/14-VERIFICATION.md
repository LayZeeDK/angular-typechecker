---
phase: 14-configuration-init-generators-nx-add
verified: 2026-07-02T06:08:42Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: # No — initial verification (no prior 14-VERIFICATION.md)
recommendations:
  - "GEN-06 is genuinely satisfied (createTreeWithEmptyWorkspace unit tests + a schema-parity spec per generator exist and pass within the 236-test suite). It is deliberately left Pending in REQUIREMENTS.md (cumulative across 14-01/14-02/14-03). The milestone audit should move GEN-06 from Pending -> Complete."
---

# Phase 14: configuration + init generators, nx add — Verification Report

**Phase Goal:** A developer can run `nx g angular-typechecker:configuration <project>` to wire ONE minimal `typecheck` target (executor `angular-typechecker:typecheck`) at the project's solution `tsconfig.json` into `project.json`, with caching seeded into `nx.json` `targetDefaults` by a standalone `init` generator that `configuration` calls; `nx add angular-typechecker` runs `init` on install. Config-edit only (`project.json` + `nx.json`; no `generateFiles`), idempotent, relying on the Phase 13 walk.
**Verified:** 2026-07-02T06:08:42Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | `configuration` writes ONE minimal `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig`) at the solution tsconfig via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`, NO `generateFiles`. | ✓ VERIFIED | `configuration/generator.ts:156-161` writes `{ ...existing, executor: TYPECHECK_EXECUTOR, options: { ...existing?.options, tsConfig } }` then `updateProjectConfiguration`; solution path `libs/my-lib/tsconfig.json` deep-equality asserted in `configuration.spec.ts:47-50`; no `generateFiles`/`node:fs` call in the generator runtime (only a JSDoc negative-reference and pure `node:path.isAbsolute`). |
| SC2 | Standalone `init` seeds `nx.json` targetDefaults["angular-typechecker:typecheck"] with the verbatim WALK-02 block (cache:true, outputs:[], `default`-based inputs — never `production`), unscoped id, whole-entry `??=` don't-clobber; `configuration` invokes `init`. | ✓ VERIFIED | `init/generator.ts:21-36` byte-matches `nx.json:44-58` (unscoped key); `inputs[0]='default'`, no `production`; `??=` whole-entry seed on the unscoped key only (`init/generator.ts:62-64`); `configuration/generator.ts:130` `await initGenerator(tree, { skipFormat: true })` FIRST; proven by `init.spec.ts` (4 cases) + `configuration.spec.ts:52-60` (running configuration alone seeds targetDefaults). |
| SC3 | `--tsConfig` override honored (relative existence-probed per fix c306eee), flat-project fallback by `projectType`, configurable `targetName`, idempotent re-run (merge-preserving user keys), non-ours collision throws. | ✓ VERIFIED | `resolveTsConfig` (`configuration/generator.ts:48-106`): override (absolute verbatim / relative joined+`tree.exists`-probed, throws located error on miss) -> solution `tsconfig.json` w/ non-empty `references[]` -> flat leaf by `projectType` + `tree.exists` -> located error. Collision-by-executor throws for non-ours (`:141-147`); idempotent merge preserves `maxWarnings`/`configurations` (`:156-160`). Covered by `configuration.spec.ts` (11 cases incl. WR-01/WR-02 regression tests). |
| SC4 | `nx add angular-typechecker` runs `init` on install — `generators.json` registers `init` by literal key (NO `ng-add` alias); `package.json` has the `generators` field. | ✓ VERIFIED | `generators.json` registers `init` + `configuration` by literal key, factory paths, no `ng-add` alias; `package.json:30` `"generators": "./generators.json"`; `nx lint` (`@nx/nx-plugin-checks`) green validates the collection; `nx list @angular-typechecker/angular-typechecker` discovers both generators. (Install-time e2e is Phase 15/GE2E-03 — out of scope here.) |
| SC5 | Both generators ship hand-authored schema.json + schema.d.ts registered via generators.json (factory) + package.json generators field, in the tarball files set + build asset glob; unit tests on `createTreeWithEmptyWorkspace` cover configuration + init + a schema-parity spec per generator. | ✓ VERIFIED | Both `schema.json`+`schema.d.ts` present & parity-tested; `generators.json` factory-keyed; `package.json` `files` includes `generators.json` (pinned by `package-manifest.spec.ts:88-99`); `project.json:32-36` build asset glob ships `generators.json`; build emits `dist/.../generators/{init,configuration}/generator.js` (CommonJS) + `schema.json`; `createTreeWithEmptyWorkspace` specs + 2 parity specs all green. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/generators/init/generator.ts` | seeds nx.json targetDefaults (verbatim WALK-02, unscoped, `??=`) | ✓ VERIFIED | 70 lines; `readNxJson`/`updateNxJson`, null guard, `skipFormat`-gated `formatFiles`; imported by configuration + registered in generators.json |
| `src/generators/init/schema.json` + `schema.d.ts` | cli:nx, additionalProperties:false, skipFormat only, no version:2 | ✓ VERIFIED | schema.json has `"cli":"nx"`, `additionalProperties:false`, only `skipFormat`, no `version`; `InitGeneratorSchema { skipFormat?: boolean }` |
| `src/generators/init/{init,schema-parity}.spec.ts` | seed/idempotent/don't-clobber/default-not-production + parity | ✓ VERIFIED | 4 init cases + 3 parity cases on `createTreeWithEmptyWorkspace`; all green |
| `src/generators/configuration/generator.ts` | init-first, resolve tsConfig, collision, write one target, format once | ✓ VERIFIED | 168 lines; `resolveTsConfig` D-07 order; collision-by-executor; merge-preserving idempotency (c306eee); relative-override existence-probe (c306eee) |
| `src/generators/configuration/schema.json` + `schema.d.ts` | project(req)/tsConfig/targetName/skipFormat, cli:nx, strict | ✓ VERIFIED | schema.json has `required:["project"]`, `$default argv index 0`, no `version`; `ConfigurationGeneratorSchema` keys match |
| `src/generators/configuration/{configuration,schema-parity}.spec.ts` | solution+flat+override+error+idempotent+collision+init-invoked + parity | ✓ VERIFIED | 11 configuration cases + 4 parity cases; all green |
| `generators.json` | factory-keyed, both generators, no ng-add | ✓ VERIFIED | registers `configuration` + `init` (factory + schema + description); no `ng-add`; no `outputCapture` |
| `package.json` | `generators` field + `generators.json` in files | ✓ VERIFIED | `"generators":"./generators.json"`; files=`[src, executors.json, generators.json, README.md, LICENSE]` |
| `project.json` | build asset glob shipping generators.json | ✓ VERIFIED | `{ input: ./packages/angular-typechecker, glob: "generators.json", output: "." }` present |
| `src/package-manifest.spec.ts` | pins files entry + generators field | ✓ VERIFIED | `PluginManifest.generators?`, files `.toEqual` incl. generators.json, `generators === './generators.json'` assertion |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| configuration/generator.ts | init/generator.ts | `await initGenerator(tree, { skipFormat: true })` FIRST | ✓ WIRED | `import initGenerator from '../init/generator'` (:17); awaited at :130 before project edit |
| configuration/generator.ts | project.json | readProjectConfiguration/updateProjectConfiguration/formatFiles | ✓ WIRED | :132 read, :161 write, :164 format-once |
| configuration/generator.ts | resolved tsConfig path | joinPathFragments(projectConfig.root, ...) + tree.exists/readJson | ✓ WIRED | `resolveTsConfig` reads virtual Tree only; workspace-root-relative path |
| init/generator.ts | nx.json targetDefaults | readNxJson/updateNxJson | ✓ WIRED | :60 read (null-guarded), :65 write |
| package.json generators field | generators.json | `./generators.json` | ✓ WIRED | present; validated by nx-plugin-checks |
| generators.json factory paths | src/generators/{configuration,init}/generator | extensionless compiled path -> generator.js | ✓ WIRED | build emits both generator.js; lint resolves both |
| project.json build assets | dist root generators.json | glob 'generators.json' -> '.' | ✓ WIRED | dist/packages/angular-typechecker/generators.json present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| init/generator.ts | targetDefaults entry | module-level `TYPECHECK_TARGET_DEFAULTS` copied verbatim from nx.json:44-58 | Yes — full WALK-02 block written via updateNxJson (asserted in specs) | ✓ FLOWING |
| configuration/generator.ts | `tsConfig` written into target | `resolveTsConfig` reading the virtual Tree (references[] / existence probes) | Yes — real workspace-root-relative path derived from project config + tree (asserted in specs) | ✓ FLOWING |

No hollow/hardcoded-empty data paths: the seed is the real WALK-02 constant; the target path is derived from live project config + tree probes, not a static placeholder.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full unit suite (init + configuration + parity + all prior) | `nx test angular-typechecker --skip-nx-cache` | 236 passed / 31 files; build ran as prerequisite | ✓ PASS |
| Registration validity (nx-plugin-checks) | `nx lint angular-typechecker --skip-nx-cache` | All files pass linting | ✓ PASS |
| Build ships compiled generators + manifest | `ls dist/.../generators/*/generator.js + generators.json` | Both generator.js (CommonJS) + generators.json + both schema.json present | ✓ PASS |
| Generator discovery | `nx list @angular-typechecker/angular-typechecker` | GENERATORS: configuration, init; EXECUTORS: typecheck | ✓ PASS |

### Probe Execution

Not applicable — Phase 14 is a generator/packaging phase with no `scripts/*/tests/probe-*.sh` and no probe declarations in PLAN/SUMMARY. Verification relies on the authoritative `nx test`/`nx build`/`nx lint` runners (all green).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| GEN-01 | 14-02 | configuration wires target via devkit, no generateFiles | ✓ SATISFIED | generator.ts write path + specs |
| GEN-02 | 14-02 | ONE target at solution tsconfig + --tsConfig override + flat fallback + configurable targetName | ✓ SATISFIED | resolveTsConfig + 6 covering specs |
| GEN-03 | 14-02 | spec-tsconfig checked automatically via WALK-01 (point at solution tsconfig) | ✓ SATISFIED | solution-tsconfig case points at tsconfig.json with references incl. tsconfig.spec.json (run-proof is Phase 15) |
| GEN-04 | 14-02 | idempotent re-run (merge-preserving), non-ours collision throws | ✓ SATISFIED | merge idempotency + collision specs (incl. WR-01 regression) |
| GEN-05 | 14-01/02/03 | both generators ship schema.json+schema.d.ts, registered via generators.json + package.json generators field, in tarball files | ✓ SATISFIED | generators.json + package.json + project.json + manifest spec + build output |
| GEN-06 | 14-01/02 | createTreeWithEmptyWorkspace unit tests (solution+flat+idempotency) + schema-parity spec per generator | ✓ SATISFIED (marked Pending) | init.spec + configuration.spec + 2 parity specs all green; **REQUIREMENTS.md still marks Pending — recommend -> Complete** |
| GEN-07 | 14-01 | standalone init seeds targetDefaults (verbatim WALK-02, unscoped, default-not-production, don't-clobber) | ✓ SATISFIED | init/generator.ts + init.spec.ts (4 cases) |
| GEN-08 | 14-02 | configuration invokes init | ✓ SATISFIED | await initGenerator FIRST; configuration-alone-seeds spec |
| GEN-09 | 14-03 | nx add runs init on install (registration mechanism) | ✓ SATISFIED (mechanism) | init registered by literal key + generators field + lint validation + discovery; install-e2e is Phase 15/GE2E-03 |

All 9 requirement IDs declared across the Phase 14 plans (GEN-01..09) are accounted for and mapped to Phase 14 in REQUIREMENTS.md. No orphaned requirements. GE2E-01..03 / GUARD-01 are correctly scoped to Phase 15 (not this phase).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | none | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER debt markers; no stubs; no `generateFiles`/`node:fs` runtime usage (only JSDoc negative-references); no `ng-add` alias. |

The only `generateFiles`/`node:fs` grep hits are JSDoc comments explicitly documenting that these are NOT used. `node:path.isAbsolute` is a pure function, not a filesystem read.

### Human Verification Required

None. All five success criteria are verifiable programmatically and were confirmed via the unit suite, lint (nx-plugin-checks), build output, and generator discovery. The `nx add` install-time run (GEN-09 e2e) is deliberately deferred to Phase 15 (GE2E-03) and is out of this phase's scope; its registration mechanism is verified here.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are observably true in the shipped code. Both generators (`init`, `configuration`) exist, are substantive, are wired (configuration awaits init; both registered in generators.json; package.json declares the generators field; build ships them), and real data flows (the verbatim WALK-02 seed + tree-derived tsConfig path). The two code-review warnings (WR-01 lossy idempotency, WR-02 unprobed relative override) were resolved in commit c306eee and now carry covering unit tests. Authoritative runners all green: `nx test` (236/31), `nx build`, `nx lint`.

**One traceability recommendation (not a gap):** GEN-06 is genuinely satisfied — the `createTreeWithEmptyWorkspace` unit tests (init + configuration, solution + flat-fallback + idempotency) and a schema-parity spec per generator all exist and pass within the 236-test suite. It was deliberately left `Pending` in REQUIREMENTS.md by the executors (cumulative across 14-01/14-02/14-03, to avoid a premature self-close). The milestone audit should move GEN-06 from Pending to Complete.

---

_Verified: 2026-07-02T06:08:42Z_
_Verifier: Claude (gsd-verifier)_
