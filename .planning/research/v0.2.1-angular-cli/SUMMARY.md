# Project Research Summary

**Project:** angular-typechecker
**Milestone:** v0.2.1 -- Angular CLI (`angular.json`) workspace support (ADDITIVE-ONLY)
**Domain:** Re-exporting a shipped Nx-devkit plugin (executor + generators) as Angular CLI builders + schematics via `convertNxExecutor`/`convertNxGenerator` + a first-party `ng-add` schematic
**Researched:** 2026-07-10
**Confidence:** HIGH

## CORRECTION & LOCKED DECISIONS (empirically verified 2026-07-10 -- supersedes conflicting claims below)

The parallel researchers assumed the PRE-solution-style Angular CLI layout; that was wrong.
Corrected after generating a real Angular CLI 22.0.6 workspace (`npm init @angular@latest` in
`D:/projects/sandbox/angular220`) + reading `@schematics/angular` source + `core/walk-references.ts`.
Where this section conflicts with anything below (especially Pitfall 8), THIS section wins.

1. **Pitfall 8 (spec coverage) is VOID.** Modern Angular CLI's workspace-root `tsconfig.json` IS
   solution-style: `"files": []` + `references` -> `tsconfig.app.json` + `tsconfig.spec.json`, and
   `ng g library` APPENDS each library's `tsconfig.lib.json` + `tsconfig.spec.json` to that SAME root
   `references[]` (verified: `@schematics/angular/library/index.js` `addTsProjectReference`, and a
   generated Ng22 workspace). Planted-error `tsc --noEmit` per leaf confirmed each leaf checks exactly
   its own glob scope (app / spec / lib all isolated).

2. **Per-project targets via `tsConfig: string | string[]` (Option A -- LOCKED).** Angular CLI has NO
   target inference, so a `typecheck` architect target is wired per project. One target per project,
   scoped to that project, is achieved by pointing `tsConfig` at an ARRAY of the project's leaves
   (`[buildLeaf, specLeaf]`). The engine runs each array entry through the existing single-`tsConfig`
   logic, UNIONs diagnostics, and filters via the v0.2.0 input-set-membership boundary over the
   combined declared input sets. Additive/non-breaking: widen `CoreOptions.tsConfig` + executor
   `schema.json` (`oneOf` string|array) + `normalize-options`; single-string behavior AND the Nx path
   are byte-unchanged. NO emitted per-project solution tsconfig (generator stays config-edit-only);
   NO directory-boundary change; NO runtime workspace-parsing.

3. **`ng add` auto-wires ALL projects (LOCKED).** The Angular CLI `ng-add` schematic iterates
   `angular.json#projects` and wires a per-project `typecheck` target into EVERY `application` +
   `library` project (idempotent; skip a project that already has one; skip e2e/other types). The
   `configuration` schematic remains the single-project entry (projects added after install). The Nx
   `nx add` is UNCHANGED from shipped v0.2.0 (init/caching seed only; Nx auto-provisioning stays
   deferred to `createNodesV2` / WALK-FUT-01).

4. `.angular/cache` is build-pipeline-only (verified: every consumer is `@angular/build` or `ng cache`)
   -> nothing to seed on the CLI path.

Authoritative requirements: `.planning/REQUIREMENTS.md` (ENG/ACB/ACS/NGADD/COV/ACV/ACP/ACD).

## Executive Summary

This milestone adds a non-Nx Angular CLI (`angular.json`) surface to the already-shipped `angular-typechecker` Nx plugin, so `ng add angular-typechecker` / `ng generate angular-typechecker:configuration` / `ng run <p>:typecheck` all work against the SAME tested engine that Nx consumers use. All four research files agree on the shape: it is a "thin re-export" plus one genuine fork. `@nx/devkit@23.0.1` (already a pinned dependency) exports both `convertNxExecutor` and `convertNxGenerator`, both current and NOT deprecated (verified in the installed source). No new production dependencies are required. The work is two new manifest files (`builders.json`, `collection.json`), two new `package.json` fields (`builders`, `schematics`), three thin `convert*` wrapper modules, one first-party `ng-add` Rule, and -- the one place real engineering lives -- an `angular.json`-aware write branch inside the shared `configuration` generator.

The dominant design finding is an ASYMMETRY. `convertNxExecutor(typecheckExecutor)` gives a working builder UNCHANGED: the executor reads only `context.root`, which the bridge maps from the Angular `BuilderContext.workspaceRoot`. But `convertNxGenerator(configurationGenerator)` only HALF-works: Nx's `readProjectConfiguration` has an `angular.json` READ-polyfill, while `updateProjectConfiguration` has NO `angular.json` WRITE branch -- it throws on an Angular CLI application and mis-writes into a library's `package.json` `nx` block, so `ng run` never finds the target. The resolution (Architecture Option A, RECOMMENDED) is ONE shared generator with a `tree.exists('angular.json')` fork: on Angular CLI, write the `architect` target via `updateJson('angular.json', ...)` and skip the Nx-only caching seed; else run the existing Nx path unchanged. `convertNxGenerator` then re-exports that same generator for free.

Two items MUST be resolved empirically by an early spike and must NOT be papered over. (1) GATE A' GO/NO-GO: does the shipped CJS-executor -> ESM-`@angular/compiler-cli` `await import()` bridge survive `convertNxExecutor` + a real `ng run` (including the wrapper's eager `retrieveProjectConfigurationsWithAngularProjects` ESM-sensitive prelude)? Verdict: SHOULD survive, LOW-to-MEDIUM residual risk -- prove it in a real `ng run` on-stack (Ng22) AND off-stack (Ng21) before any other work. (2) A direct CONTRADICTION between the research docs: FEATURES.md claims running the shipped `init`/`updateNxJson` unchanged off-Nx would CREATE a stray `nx.json`, while PITFALLS.md and ARCHITECTURE.md both read the `nx@23.0.1` source and found `updateNxJson` early-returns (a silent NO-OP) when `nx.json` is absent. The weight of evidence (two source reads) favors no-op, but it is contradictory in-corpus -- verify in code/spike. Either way the safe design is the same: `ng-add`/`init` MUST explicitly skip the Nx caching seed off-Nx rather than rely on incidental behavior.

## Key Findings

### Recommended Stack (from STACK.md)

Zero new production dependencies. Both conversion APIs ship in the pinned `@nx/devkit@23.0.1`. The additive `package.json` wiring keeps the Nx surface (`executors`/`generators`) byte-unchanged and adds two fields:

```jsonc
"executors": "./executors.json",     // Nx (UNCHANGED)
"generators": "./generators.json",   // Nx (UNCHANGED)
"builders": "./builders.json",       // NEW: ng run discovery
"schematics": "./collection.json",   // NEW: ng generate / ng add discovery
```

**Dependency-classification call (recommended):** `convertNxExecutor`'s returned builder runtime-`require()`s `@angular-devkit/architect` + `rxjs` AND (via `nx/src/devkit-internals`) `nx` itself. Classify:

- `@angular-devkit/architect` (`^0.2200.0` -- note the `0.22xx.x` scheme, NOT `22.x`) and `rxjs` (`^7.8.0`): declare as OPTIONAL `peerDependencies` (`peerDependenciesMeta.<dep>.optional: true`). Always present in any Angular CLI workspace; never forced onto a pure-Nx consumer. Documents the implicit runtime contract that `@nx/dependency-checks` cannot otherwise see (the `require()`s live in `@nx/devkit`, not in this plugin's source).
- `nx`: NOT declarable here and cannot be avoided -- it flows in transitively through `@nx/devkit`'s existing peer, and the builder needs `nx/src/devkit-internals` at runtime. ACCEPT + DOCUMENT it (an `ng add` into a non-Nx workspace pulls `nx` transitively and may materialize a `.nx/` cache dir). Hand-writing an architect builder to dodge `nx` is explicitly out of charter (would fork the engine -> v0.3.0 scope).
- DEV-only (never shipped): `@angular/cli@^22.0.0` for the e2e harness; reuse the existing `verdaccio` tarball tier.

### Expected Features (from FEATURES.md)

**Must have (table stakes -- parity with `nx add`/`nx g`/`nx run`):**
- `ng add angular-typechecker` -- installs + runs a first-party `ng-add` schematic (the Angular analog of `nx add` -> `init`).
- `ng generate angular-typechecker:configuration <project>` -- wires a `builder` target into `angular.json` `architect`.
- `ng generate angular-typechecker:init` -- available for symmetry; FORKED body (no `nx.json` seed off-Nx).
- `ng run <project>:typecheck` -- runs the check; `BuilderOutput.success` maps to the exit code exactly like the Nx `{ success }`.
- IDENTICAL diagnostics + `formatDiagnostics` output + exit codes to the Nx surface (a correctness INVARIANT to test, not new code).
- All shipped options exposed (`tsConfig`, `includeDeps`, `maxWarnings`, `failFast`, `strict`); `--dry-run`/`--skip-confirmation` inherited free.

**Should have (differentiator):** one package, both worlds -- the exact same tested engine reachable from a non-Nx Angular CLI workspace with a ZERO-divergence guarantee (thin adapters over one core, not a second implementation). No other tool offers the complete Angular check (TS + template + NG8xxx) as an `ng run` builder.

**Deliberately NOT built (anti-features):** seeding an `nx.json` cache block off-Nx (false parity -- nothing to cache); auto-wiring every project on `ng add`; a hand-written architect builder; `createNodesV2` inference (no Angular analog); JSON/SARIF reporters (project-wide deferral); Angular CLI Storybook layout special-casing; a standalone CLI bin.

### Architecture Approach (from ARCHITECTURE.md)

Bridge-and-branch. The executor is re-exported verbatim; the generators are re-exported with one `tree.exists('angular.json')` write-branch in the shared `configuration` generator. New files are SIBLINGS of the existing manifests, never edits of them.

**Major components:**
1. `src/builders/typecheck/builder.ts` (NEW, ~3 lines) -- `export default convertNxExecutor(typecheckExecutor)`; registered in `builders.json`, reusing the executor `schema.json` (or a sanitized copy -- see Pitfall 7).
2. `src/schematics/{configuration,init}/schematic.ts` (NEW, ~2 lines each) -- `convertNxGenerator(...)` re-exports; registered in `collection.json`.
3. `src/schematics/ng-add/schematic.ts` (NEW, first-party small Rule) -- ensure devDependency + guidance; skips the Nx caching seed explicitly; optionally chains `configuration` when passed a project.
4. `src/generators/configuration/generator.ts` (MODIFIED, additive branch) -- the `angular.json` write fork (Option A). The engine, executor, core, and public barrel are UNTOUCHED.

**Additive-safety is source-verified:** Nx resolves `executorsFile = packageJson.executors ?? packageJson.builders` and `generatorsFile = packageJson.generators ?? packageJson.schematics` (nx `executor-utils.js` L76, `generator-utils.js` L57). Since `executors`/`generators` stay declared, Nx never reads the new manifests -- the Nx surface is byte-for-byte unchanged.

**Suggested build order (Architecture):** builder re-export (proves GATE A', lowest risk) -> `configuration` `angular.json` write-fork (highest design weight) -> `init` parity + first-party `ng-add` -> real-OSS `angular.json` tarball e2e (gating, last).

### Critical Pitfalls (from PITFALLS.md)

1. **ESM bridge through `convertNxExecutor` + `ng run` (headline).** SHOULD survive (the `await import()` lives in the already-compiled `compiler-loader.js`, not re-transformed by the bridge) but the wrapper's eager project-graph prelude is a real, ESM-sensitive phase that runs BEFORE the executor (cf. nrwl/nx#19475). Avoid: GATE A' spike -- real `ng run` on-stack + off-stack, no `ERR_REQUIRE_ESM`; extend the GATE A build-output static assertion to the builder entry.
2. **`updateProjectConfiguration` cannot write `angular.json`.** Throws on an app, mis-writes to a lib's `package.json` `nx` block; `ng run` never finds the target (nrwl/nx#19104). Avoid: the `tree.exists('angular.json')` write fork (`updateJson`/`updateWorkspace`), keeping `resolveTsConfig` shared and the idempotency/collision guard intact.
3. **`init` is a silent no-op off-Nx -- caching value-prop evaporates.** Avoid: `ng-add` must NOT call the Nx `init` on Angular CLI; do only Angular-meaningful work and print an explicit "no target cache; skipping cache seeding" notice. (This is the safe side of the init CONTRADICTION -- see Gaps.)
4. **`nx` dragged into a non-Nx workspace + required at runtime + a `.nx/` artifact appears.** Not a bug; ACCEPT + document the tradeoff; e2e tolerates/cleans `.nx/`.
5. **Undeclared runtime `require()`s (`@angular-devkit/architect`, `rxjs`).** Avoid: declare optional peers (see Stack); e2e is the backstop.
6. **`ng add` peer friction on Angular < 22.** The `^22.0.0`/TS-6 peer caps mean off-stack fixtures need `--legacy-peer-deps`; on-stack (Ng22) needs none. Document; never gate in code.
7. **Reusing the Nx executor `schema.json` for the builder** trips Architect's stricter validation (`cli:"nx"`, `x-*`, `$default` positional args). Avoid: a sanitized builder `schema.json` over the same TS options interface + a schema-parity test. (Confidence MEDIUM -- confirm in the builder spike.)
8. **[CORRECTED -- VOID; see "CORRECTION & LOCKED DECISIONS" at top.]** ~~Reference-walk never engages on Angular CLI (no TS project references) -> specs silently unchecked.~~ FALSE for modern Angular CLI: the workspace-root `tsconfig.json` IS solution-style with `references`. Per-project complete coverage is delivered by `tsConfig: [buildLeaf, specLeaf]` (Option A). e2e still plants BOTH an app error and a spec error (and a library error) to prove per-project scoping.

## Implications for Roadmap

Four phases, ordered by dependency + risk (prove the mechanical bridge first, do the design-risk write-fork second, glue with `ng-add`, gate with real-OSS e2e last).

### Phase 1: Builder re-export + GATE A' GO/NO-GO spike
**Rationale:** Lowest risk, independently testable, and a prerequisite for any runnable wired target. The ESM-bridge-through-`ng run` question is the milestone's headline risk and must gate GO/NO-GO before further investment.
**Delivers:** `src/builders/typecheck/builder.ts` (`convertNxExecutor`), `builders.json`, the `builders` `package.json` field + `files` entry, optional Angular-devkit peers, a sanitized builder `schema.json`.
**Addresses:** `ng run <p>:typecheck` (table stake).
**Avoids:** Pitfall 1 (real `ng run` on-stack Ng22 + off-stack Ng21; extend GATE A static assertion), Pitfall 5 (optional peers), Pitfall 7 (builder schema).
**Also verify here:** the field-aliasing / Nx-surface regression (see Gaps) -- assert `nx run <p>:typecheck` still resolves after the `builders` field is added.

### Phase 2: `configuration` schematic + the `angular.json` write-fork (crux)
**Rationale:** Highest design + test weight of the milestone; depends on the builder for an end-to-end-runnable target.
**Delivers:** the `tree.exists('angular.json')` branch in the shared generator (Option A), `convertNxGenerator(configurationGenerator)` in `collection.json`, the `schematics` `package.json` field.
**Implements:** Architecture components 2 + 4.
**Avoids:** Pitfall 2 (write `architect` target directly, no throw), Pitfall 8 (tsConfig/spec coverage decision).
**Test:** BOTH substrates -- Nx (`project.json` path unchanged) and Angular CLI (`architect` target written, no stray `nx.json`), using an `angular.json`-seeded schematics test tree, not `createTreeWithEmptyWorkspace`.

### Phase 3: `init` schematic (parity) + first-party `ng-add`
**Rationale:** The install entry point that ties it together; resolves the `init` contradiction empirically.
**Delivers:** `convertNxGenerator(initGenerator)` for parity, the first-party `ng-add` Rule (devDependency + guidance + explicit no-caching notice, optional `configuration` chain).
**Addresses:** `ng add angular-typechecker` (table stake).
**Avoids:** Pitfall 3 (skip the Nx caching seed explicitly; do NOT call the Nx `init` off-Nx), Pitfall 4 (document the `nx`/`.nx/` tradeoff).
**Resolves:** the init nx.json create-vs-no-op contradiction (verify in code here).

### Phase 4: Real-OSS `angular.json` tarball e2e
**Rationale:** Slow, gating, needs Phases 1-3; the Angular-CLI analog of the v0.2.0 radix-ng cross-check.
**Delivers:** a new `angular-typechecker-ng-cli-e2e` project -- pack the tarball -> `ng add` -> `ng generate ...:configuration` -> `ng run <p>:typecheck` -> assert diagnostics.
**e2e repos (already picked):** PRIMARY on-stack `realworld-angular/realworld-angular` (Angular 22.0 / TS 6.0.3, MIT, non-Nx `angular.json`, `@angular/build:application`, no peer friction -- a decisive exact-stack find); off-stack cross-check `realworld-apps/angular-realworld-example-app` (Angular 21.2, install with `--legacy-peer-deps`). `Ismaestro/angular-example-app` optional breadth check only (no LICENSE -> local-clone-only).
**Avoids:** Pitfall 6 (Ng22 without / Ng21 with `--legacy-peer-deps`), Pitfall 8 (plant app + spec errors), Pitfall 4 (tolerate/clean `.nx/`).

### Phase Ordering Rationale
- The executor-unchanged / generator-write-fork ASYMMETRY means Phase 1 is nearly free and Phase 2 carries essentially all the engineering + test weight -- flag Phase 2 for the deepest testing.
- Phase 1 gates GO/NO-GO on the whole builder feature (exactly as Phase 16 gated Layout B in v0.2.0), so it runs first and alone.
- `ng run` depends on a wired `architect` target (Phase 2); `ng add` composes the forked `init` (Phase 3); the e2e needs all three (Phase 4).

### Research Flags

Phases likely needing a spike / deeper research during planning:
- **Phase 1:** YES -- a dedicated GATE A' GO/NO-GO spike (real `ng run`, on-stack + off-stack; ESM bridge + eager prelude), plus the builder-schema-dialect confirmation and the Nx-surface field-aliasing regression assertion.
- **Phase 3:** LIGHT -- empirically resolve the `init` nx.json create-vs-no-op contradiction (low effort; the safe design skips regardless).

Phases with standard patterns (skip research-phase):
- **Phase 2:** the write-fork DESIGN is resolved (Option A); needs `angular.json`-substrate integration tests, not new research.
- **Phase 4:** reuses the existing Verdaccio tarball-e2e machinery; the repos are already chosen.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `@nx/devkit@23.0.1` installed source read directly; both APIs exported + non-deprecated; runtime `require()`s + peer classification verified. |
| Features | HIGH | Mechanics verified vs installed devkit/nx source + Angular CLI docs; the Angular-cache-scope nuance is MEDIUM. |
| Architecture | HIGH | Bridge mechanics, the write-path fork, and additive-safety precedence all read from source; consumer-side Angular CLI resolution of `builders`/`schematics`/`ng-add` is MEDIUM (symmetric inference, not re-read from `@angular/cli`). |
| Pitfalls | HIGH | Mechanism-level findings from source; OSS-repo suitability + `ng add` peer-friction extrapolation are MEDIUM. |

**Overall confidence:** HIGH

### Gaps to Address

- **`init` nx.json create-vs-no-op CONTRADICTION (must-verify).** FEATURES.md says running the shipped `init`/`updateNxJson` unchanged off-Nx CREATES a stray `nx.json`; PITFALLS.md + ARCHITECTURE.md read the `nx@23.0.1` source (`nx-json.js` `if (tree.exists('nx.json'))` early-return) and found a silent NO-OP that creates nothing. Weight of evidence favors no-op, but it is contradictory in-corpus -- confirm in code/spike (Phase 3). Safe design either way: `ng-add`/`init` MUST explicitly skip the Nx caching seed off-Nx, never rely on the incidental behavior.
- **ESM bridge through `ng run` (GATE A', must-verify).** "Should survive, LOW-to-MEDIUM risk" plus the adjacent `retrieveProjectConfigurationsWithAngularProjects` eager-prelude risk. GO/NO-GO in Phase 1, on-stack (Ng22) AND off-stack (Ng21), via a real `ng run`. A NO re-scopes the milestone (document; do NOT hand-write an architect builder).
- **Field-aliasing DISAGREEMENT (verify-in-spike).** STACK.md flags "Nx may alias `builders`->`executors` / `schematics`->`generators`, risking the must-not-regress Nx surface" (MEDIUM). ARCHITECTURE.md read the nx source and found `executors ?? builders` / `generators ?? schematics` precedence -> the new manifests are Nx-invisible / additive-safe (HIGH). The source-verified finding is stronger, but the disagreement is unresolved -- fold an Nx-surface regression assertion into Phase 1 (`nx run`/`nx g` still resolve after the fields land) rather than treat it as settled.
- **Builder schema dialect (Pitfall 7, MEDIUM).** Whether Architect accepts the executor `schema.json` verbatim or needs a sanitized copy -- confirm in the Phase 1 builder spike.
- **Consumer-side Angular CLI resolution (MEDIUM).** `builders`/`schematics`/`ng-add` discovery is symmetric-inferred, not re-read from `@angular/cli` -- backstopped by the Phase 4 real `ng add`/`ng run` e2e.

## Sources

### Primary (HIGH confidence)
- Installed `@nx/devkit@23.0.1` (`convert-nx-executor.js`, `invoke-nx-generator.js`, `public-api.*`, `package.json`) -- both APIs exist, exported, non-deprecated; runtime `require()`s of architect/rxjs; only peer is `nx`.
- Installed `nx@23.0.1` (`generators/utils/project-configuration.js`, `nx-json.js`, `command-line/run/executor-utils.js` L76, `command-line/generate/generator-utils.js` L57, `adapter/angular-json.js`) -- `readProjectConfiguration` `angular.json` polyfill, `updateProjectConfiguration` no-`angular.json`-write branch, `updateNxJson` no-op-when-absent, `executors ?? builders` / `generators ?? schematics` precedence, `executor`<->`builder` / `targets`<->`architect` rename.
- Repo source: `packages/angular-typechecker/{package.json,executors.json,generators.json}`, `src/executors/typecheck/{executor,normalize-options,gate-a-static.spec}.ts`, `src/generators/{configuration,init}/generator.ts`, `src/index.ts`.
- npm registry (2026-07-10): `@angular/cli 22.0.6`, `@angular-devkit/architect 0.2200.6` (deps `rxjs@7.8.2`), `@angular/core@22.0.4` peer `rxjs ^6.5.3 || ^7.4.0`.
- GitHub API (2026-07-10): `realworld-angular/realworld-angular` (Ng22.0/TS6.0.3, MIT, non-Nx); `realworld-apps/angular-realworld-example-app` (Ng21.2).

### Secondary (MEDIUM confidence)
- nx.dev `convertNxExecutor` API doc (current, not deprecated).
- Angular CLI docs (`ng add`, library schematics, custom builders, cache) -- discovery + the reserved `ng-add` name + `BuilderOutput` mapping; cache-scope nuance.
- nrwl/nx#19104 (`updateProjectConfiguration` not compatible with `ng g`), nrwl/nx#19475 (converted Angular executor ESM prelude failure), DEV/Nx "read `angular.json` directly in a `convertNxGenerator` schematic".

### Tertiary (LOW confidence)
- nrwl/nx#10441 (`convertNxExecutor` pulls extra runtime surface).
- OSS-repo suitability judgments + `ng add` peer-friction extrapolation (verified via GitHub API for stack/license; behavior confirmed only in Phase 4 e2e).

---
*Research completed: 2026-07-10*
*Ready for roadmap: yes*
