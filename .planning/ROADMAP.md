# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [ACTIVE] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Ships (1) the spike-validated reference-walking engine mode (WALK, Phase 13, shipped) and the complete 18-member extended-diagnostic catalog + enum-completeness tripwire (Phase 12, shipped); (2) the BREAKING executor rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` (Phase 13.1) that drives the 0.0.3 -> 0.1.0 minor bump; (3) the `configuration` generator (renamed from `typecheck-configuration`) wiring ONE minimal `typecheck` target at the solution `tsconfig.json`, a standalone `init` generator that seeds `nx.json` targetDefaults, and `nx add angular-typechecker` support (Phase 14); and (4) the folded generator + `nx add` e2e and a CI `-p` set-equality guard (Phase 15). Reference-walking GO-gated by spikes 001-005 (`.planning/spikes/MANIFEST.md`). Testing strategy: `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.

## Phases

<details>
<summary>[SHIPPED] v0.0.1 (Phases 1-7, incl. 5.1) -- SHIPPED 2026-06-29</summary>

- [x] Phase 1: Workspace Bootstrap + Engine Spike (GATED) (4/4 plans) -- completed 2026-06-27
- [x] Phase 2: Core Type-Check Engine + Gatherer (3/3 plans) -- completed 2026-06-27
- [x] Phase 3: Filtering, Modes, Output + Quality Gates (4/4 plans) -- completed 2026-06-27
- [x] Phase 4: Nx Executor Adapter + Cacheable Target (3/3 plans) -- completed 2026-06-28
- [x] Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) (5/5 plans) -- completed 2026-06-28
- [x] Phase 5.1: 0.0.2 first OIDC steady-state publish verification (INSERTED) (1/1 plan) -- completed 2026-06-29
- [x] Phase 6: Full e2e Matrix + CI (5/5 plans) -- completed 2026-06-29
- [x] Phase 7: Release-PR workflow and clean changelog (4/4 plans) -- completed 2026-06-29

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.1-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.0.3 -- Engine hardening (Phases 8-11) -- SHIPPED 2026-06-30</summary>

- [x] Phase 8: Correctness & Completeness Fixes (3/3 plans) -- completed 2026-06-29 -- COR-01..04: config-resolution 500 re-thrown as infrastructure, global TS diagnostics via `getGlobalDiagnostics()`, empty-`fileName` diagnostics kept, pure core `toExitCode` 0/1/2 policy.
- [x] Phase 9: Resilience (per-file fault isolation + boundary robustness) (5/5 plans) -- completed 2026-06-29 -- RES-01..04: GATED spike -> HYBRID per-file fault isolation (one `FatalDiagnosticError` no longer collapses the run) + loud TCB-abort notice, `realpath()` try/catch, `suppressOutputPathCheck`.
- [x] Phase 10: Drift-hardening & Maintainability (4/4 plans) -- completed 2026-06-29 -- HARD-01..05: build-time `tsconfig.drift.json` + `typecheck-drift` CI target, `EmitFlags` fix, vendor markers, retained no-op getter, no-`TS-99`-leak spec.
- [x] Phase 11: Fallow code-quality CI gate (2/2 plans) -- completed 2026-06-30 -- QUAL-01..03: `fallow@2.103.0` adopted as a path-gated SHA-pinned CI quality gate (new-only, `--format human`, least-privilege `contents: read`), current findings resolved (green on adoption), proven RED on introduced dead code.

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.3-ROADMAP.md`

</details>

### v0.1.0 -- reference-walking engine, typecheck executor rename, and the configuration + init generator suite (Phases 12-15, incl. inserted 13.1)

- [x] **Phase 12: Extended-diagnostic catalog + completeness tripwire** - Assert all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes by exact code/category/count/promotion in one enum-keyed `it.each` table, with an enum-vs-table tripwire that fails CI loudly on Angular drift. (completed 2026-07-01)
- [x] **Phase 13: Engine -- solution-tsconfig reference-walking** - Teach the `angular-typecheck` engine to type-check a solution / references-only `tsconfig.json` by walking its in-project referenced leaves (lib/app + spec) in ONE `runTypecheck` call (union + dedupe by value identity, module-boundary-guarded, coarse-cached), superseding the D-03a solution-style short-circuit so a single target yields the complete, duplicate-free diagnostic set for the whole project. (completed 2026-07-01)
- [ ] **Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED)** - Rename the shipped executor `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` across `executors.json`, `nx.json` targetDefaults, all fixtures, specs, and the README -- a BREAKING change that drives the 0.0.3 -> 0.1.0 minor bump (EXEC-01).
- [ ] **Phase 14: configuration + init generators, nx add** - Ship the `nx g angular-typechecker:configuration <project>` generator (renamed from `typecheck-configuration`) that wires ONE minimal `typecheck` target (executor `angular-typechecker:typecheck`) at the solution `tsconfig.json` and delegates caching to a standalone `init` generator (seeds `nx.json` targetDefaults), plus `nx add angular-typechecker` support -- `project.json`/`nx.json` config-edit only, idempotent, relying on the Phase 13 walk.
- [ ] **Phase 15: Generator e2e + CI self-audit guard** - Prove the generators end-to-end against the installed tarball (install -> `nx g angular-typechecker:configuration` on a previously un-wired project -> assert `project.json` + the `init`-seeded `targetDefaults` -> run the `typecheck` target to a multi-leaf walk verdict; plus an `nx add angular-typechecker` scenario), and add a `-p` set-equality guard that turns a forgotten e2e project into a loud failure.

## Phase Details

### Phase 12: Extended-diagnostic catalog + completeness tripwire
**Goal**: The integration suite proves angular-typechecker observes the COMPLETE Angular 22 diagnostic surface -- all 18 extended-template diagnostics plus the baseline TS/NG codes -- by exact identity, and any future Angular release that changes the extended-diagnostic set fails CI loudly instead of silently under-covering.
**Depends on**: Nothing within v0.0.4 (independent of the generator; builds directly on the shipped engine)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, DRIFT-01
**Success Criteria** (what must be TRUE):
  1. Running the integration suite asserts every one of the 18 `ExtendedTemplateDiagnosticName` members (NG8101-8117 plus NG8011 and NG8021 -- never matched by a numeric "NG81xx" filter) by exact code + `DiagnosticCategory` + occurrence count against the real `@angular/compiler-cli` over committed fixtures.
  2. The suite is a SINGLE data-driven `it.each` table keyed on the enum members, with introduction-version carried as a row field (not split across per-version files); any member not reproducible by a static Angular 22.0.4 fixture appears as `it.skip` with a written reason and its row stays in the table.
  3. At least one severity-promotion case proves `extendedDiagnostics.defaultCategory: "error"` flips a warning-default check to an error; NG8011 is asserted at its observed category and its promotion case is explicitly skipped with a reason (out-of-band / not promotable).
  4. The baseline TS/NG codes (TS2322, TS2339, NG2003, NG2005, NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) are each asserted by exact code.
  5. A completeness tripwire asserts the catalog's covered-code set EQUALS the `ExtendedTemplateDiagnosticName` enum (consumed at build/test time), so a member added/renamed/removed by a future Angular release makes the `test` (or `typecheck-drift`) job fail loudly; `research/DIAGNOSTIC-CATALOG.md` is corrected to the authoritative 18-member set (incl. the NG8110/NG8118 note that they are `ErrorCode`s but NOT configurable extended diagnostics).

> **NOTE (D-13, for the milestone audit):** SC3's parenthetical "(out-of-band / not promotable)" and requirement CAT-02's matching parenthetical are FACTUALLY SUPERSEDED -- NG8011 IS promotable (triple-verified docs+source+runtime; CONTEXT.md D-09 corrected). The implementation treats NG8011 as a normal promotable Warning-default member; the ROADMAP/REQUIREMENTS/CONSENSUS text is left as-is this phase (no re-ratification) and reconciled at the milestone audit. CAT-02 stays satisfied by the single NG8101 promotion proof (D-08).

**Plans**: 4 plans
- [x] 12-01-PLAN.md -- Source-of-truth `EXTENDED_DIAGNOSTIC_MEMBERS` (`as const`) + the DRIFT-01 type-level enum-vs-list completeness tripwire wired into `typecheck-drift` (DRIFT-01)
- [x] 12-02-PLAN.md -- The 18-row extended `it.each` catalog (exact code+category+count) + the NG8101 promotion proof + ~7 new extended fixtures; folds/deletes the two extended specs (CAT-01, CAT-02, CAT-04)
- [x] 12-03-PLAN.md -- The sibling baseline TS/NG `it.each` table + ~2 baseline fixtures; folds/deletes `baseline.angular13` and corrects the TESTING.md spec count (CAT-03)
- [x] 12-04-PLAN.md -- Rewrite `research/DIAGNOSTIC-CATALOG.md` to the authoritative 18-member enum set (CAT-05)

### Phase 13: Engine -- solution-tsconfig reference-walking
**Goal**: The `angular-typecheck` engine type-checks a project's solution / references-only `tsconfig.json` by walking its in-project referenced leaves (lib/app + spec) in ONE `runTypecheck` call -- union + dedupe by value identity, module-boundary-guarded, coarse-cached -- superseding the D-03a solution-style short-circuit, so a single target pointed at `tsconfig.json` yields the complete, duplicate-free diagnostic set for the whole project.
**Depends on**: Nothing new within v0.0.4 (builds on the shipped `performCompilation` engine); GO-gated by spikes 001-005 (all VALIDATED)
**Requirements**: WALK-01, WALK-02
**Success Criteria** (what must be TRUE):
  1. `runTypecheck` on a solution `tsconfig.json` whose `references[]` include a lib/app leaf and a `tsconfig.spec.json` leaf sharing a source returns the UNION of the per-leaf `performCompilation` diagnostics, deduped by `ts.sortAndDeduplicateDiagnostics` value identity (`file.path` + start + length + code + `messageText`): the cross-`Program` overlap collapses to one, while both spec-only AND lib-only diagnostics survive (no loss, no phantom), and `errorCount`/`warningCount` are explicit POST-dedupe `DiagnosticCategory` counts (never `length - errorCount`).
  2. A reference-resolution-layer module-boundary guard SKIPS out-of-project references (skip-with-notice; path-containment under the project directory) so an outsider never becomes a walked leaf -- a no-guard baseline leaks the outsider's error while the guarded walk does not -- and `filter-diagnostics` + `includeDeps` behavior on imported SOURCES is unchanged (the guard is orthogonal to and composable with the diagnostic-layer filter).
  3. The D-03a zero-`rootNames` guard splits THREE-WAY: references present + >=1 in-project leaf -> walk; references present + 0 in-project leaves -> a new synthesized error (code 90001, distinct message); no references -> the unchanged empty-project error. The `rootNames > 0` direct-leaf path is untouched, no branch gates on TS18003, and `rootNamesCount` = the sum over the walked leaves. `config-resolution.integration.spec.ts:124-130` is rewritten to assert the walk.
  4. `fixtures/solution-style` carries a KNOWN diagnostic plus a real `tsconfig.spec.json` leaf so the walk assertion proves type-checking actually occurred; a references-less fixture covers the still-errors branch and an out-of-project-refs fixture covers the boundary guard.
  5. The walk target's Nx `targetDefaults` inputs use the `default` named input (NOT `production`, which excludes `*.spec.ts` and would under-hash spec sources -> stale PASS); `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default` are retained, and README consumer guidance is updated to the single-target walk recipe.
**Plans**: 6 plans
- [x] 13-01-PLAN.md -- Export createCanonicalizer + isUnderDir from filter-diagnostics.ts (D-01/D-04 reuse) (WALK-01)
- [x] 13-02-PLAN.md -- Upgrade fixtures/solution-style + 5 sibling fixtures (overlap/oop/empty/broken-ref/selfref) (WALK-01)
- [x] 13-03-PLAN.md -- NEW pure core walk-references.ts (walk + boundary guard + 90002 fold-and-count) + unit spec (WALK-01)
- [x] 13-04-PLAN.md -- run-typecheck.ts D-03a three-way split + CoreResult.skippedReferences + index.ts export + executor logger.warn (WALK-01)
- [x] 13-05-PLAN.md -- Integration walk proofs + config-resolution rewrite + cross-leaf TCB unit + executor unit (WALK-01)
- [x] 13-06-PLAN.md -- nx.json production->default input + cache-e2e stale-PASS proof + README walk recipe (WALK-02)

### Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED)
**Goal**: The published Nx executor is renamed `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` everywhere -- `executors.json` key + implementation/schema paths + schema `$id`, `nx.json` `targetDefaults` keys (local + scoped), all fixture `project.json` executor refs (and target names), `nx-target-defaults.spec.ts`, the integration/unit specs that name the id, and the README recipe -- with behavior unchanged. This is the BREAKING change that carries the 0.0.3 -> 0.1.0 minor bump; it lands before the generator (Phase 14) so the generator targets the new id from the start.
**Depends on**: Phase 13
**Requirements**: EXEC-01
**Success Criteria** (what must be TRUE):
  1. `executors.json` exposes the executor under the key `typecheck` (id `angular-typechecker:typecheck`); the implementation directory + `implementation`/`schema` paths + schema `$id` are renamed accordingly; `nx build` and the full test suite pass.
  2. `nx.json` `targetDefaults` are re-keyed to `angular-typechecker:typecheck` and `@angular-typechecker/angular-typechecker:typecheck`; `nx-target-defaults.spec.ts` asserts the new keys; the WALK-02 caching contract (`default` input, `outputs:[]`, `{projectRoot}/tsconfig*.json`, `^default`) is preserved.
  3. Every fixture/consumer `project.json` referencing the old id (and any `angular-typecheck` target name) is updated to `angular-typechecker:typecheck`; all integration/unit/e2e specs referencing the old id pass.
  4. The README consumer recipe and any docs use the new id `angular-typechecker:typecheck`; no stale `angular-typecheck` executor reference remains in shipped source, config, or docs.
  5. The change is committed as a breaking `feat!` / `BREAKING CHANGE:` touching the package so `nx release` computes the 0.1.0 minor bump.
**Plans**: 1 plan
- [ ] 13.1-01-PLAN.md -- git mv the executor dir + rename the full executor identity (executors.json key/paths, schema `$id`, internal symbols, message prefixes), re-key both nx.json targetDefaults (WALK-02 value preserved), re-point every fixture/consumer/spec + README, then rebuild + run the full gate and commit the breaking `feat!` (EXEC-01)

### Phase 14: configuration + init generators, nx add
**Goal**: A developer can run `nx g angular-typechecker:configuration <project>` (renamed from `typecheck-configuration`) to wire ONE minimal `typecheck` target (executor `angular-typechecker:typecheck`) at the project's solution `tsconfig.json` into `project.json`, with caching seeded into `nx.json` `targetDefaults` by a standalone `init` generator that `configuration` calls; `nx add angular-typechecker` runs `init` on install. Config-edit only (`project.json` + `nx.json`; no `generateFiles`), idempotent, relying on the Phase 13 walk -- no per-project-type detection, no separate spec target.
**Depends on**: Phase 13 (the reference-walk the single target relies on), Phase 13.1 (the renamed executor id the target + targetDefaults use)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08, GEN-09
**Success Criteria** (what must be TRUE):
  1. `nx g angular-typechecker:configuration <project>` adds a minimal `typecheck` target (executor `angular-typechecker:typecheck`, `options.tsConfig`) pointed at the solution `tsconfig.json`, edited via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles` with NO file emission (no `generateFiles`).
  2. A standalone `nx g angular-typechecker:init` generator idempotently seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` with the WALK-02 cacheable block (`cache:true`, `outputs:[]`, `default`-based inputs, never `production`), keyed by the unscoped published id, never clobbering a customized entry; `configuration` invokes `init`, so one command wires the target AND seeds caching.
  3. An explicit `--tsConfig` override is honored; a flat-project fallback points the target at the leaf (`tsconfig.app.json`/`tsconfig.lib.json` by `projectType` + existence probe) when there is no solution tsconfig / no `references`; `targetName` is configurable (default `typecheck`); re-runs are idempotent and an existing non-ours target of the same name is not clobbered (errors clearly).
  4. `nx add angular-typechecker` auto-runs the `init` generator on install (Nx invokes the package's registered `init`), seeding `targetDefaults`.
  5. Both generators ship hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` (each entry keyed `factory`) and the published `package.json` `generators` field, included in the tarball `files` set (root `generators.json` globbed like `executors.json`); unit tests on `createTreeWithEmptyWorkspace` assert the `configuration` target write (solution + flat-fallback) + idempotency + collision, the `init` seed (idempotent + don't-clobber + `default`-not-`production`), and a schema-parity spec per generator.
**Plans**: TBD

### Phase 15: Generator e2e + CI self-audit guard
**Goal**: The generator is proven end-to-end against the installed tarball -- a real consumer installs the package, generates the single `typecheck` target on a previously un-wired project, and runs it to a correct multi-leaf walk verdict -- and the CI e2e job can no longer silently skip a project via a forgotten `-p` entry.
**Depends on**: Phase 14 (needs the shipped `configuration`/`init` generators + `generators.json` + the registered `generators` field)
**Requirements**: GE2E-01, GE2E-02, GE2E-03, GUARD-01
**Success Criteria** (what must be TRUE):
  1. The `angular-typechecker-install-e2e` consumer fixture gains a project WITHOUT a pre-wired target, and an e2e scenario installs the tarball, runs `nx g angular-typechecker:configuration` on that project, and asserts the resulting `project.json` (one `typecheck` target, executor `angular-typechecker:typecheck`, pointed at the solution `tsconfig.json`) AND the `init`-seeded `nx.json` `targetDefaults["angular-typechecker:typecheck"]` -- with no Verdaccio and no new e2e project.
  2. The same scenario runs `nx run <proj>:typecheck --skip-nx-cache` and asserts the walk verdict end-to-end: a clean project yields success, and errors injected into BOTH the lib leaf AND the spec leaf yield a failure with the diagnostic codes visible in the output (proving both leaves were walked).
  3. An e2e scenario proves `nx add angular-typechecker` runs the `init` generator and seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]` on install (GE2E-03).
  4. A guard test asserts the `e2e` CI job's explicit `-p` project list EQUALS the set of `e2e/*` projects in the workspace graph (predicate quantifier `every`), so a forgotten `-p` entry becomes a loud, located CI failure instead of a silent skip; the single required `ci` gate is unchanged.
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Workspace Bootstrap + Engine Spike (GATED) | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 2. Core Type-Check Engine + Gatherer | v0.0.1 | 3/3 | Complete | 2026-06-27 |
| 3. Filtering, Modes, Output + Quality Gates | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 4. Nx Executor Adapter + Cacheable Target | v0.0.1 | 3/3 | Complete | 2026-06-28 |
| 5. Packaging, Publish Hardening + e2e Smoke (MVP) | v0.0.1 | 5/5 | Complete | 2026-06-28 |
| 5.1 0.0.2 first OIDC steady-state publish verification (INSERTED) | v0.0.1 | 1/1 | Complete | 2026-06-29 |
| 6. Full e2e Matrix + CI | v0.0.1 | 5/5 | Complete | 2026-06-29 |
| 7. Release-PR workflow and clean changelog | v0.0.1 | 4/4 | Complete | 2026-06-29 |
| 8. Correctness & Completeness Fixes | v0.0.3 | 3/3 | Complete | 2026-06-29 |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 5/5 | Complete | 2026-06-29 |
| 10. Drift-hardening & Maintainability | v0.0.3 | 4/4 | Complete | 2026-06-29 |
| 11. Fallow code-quality CI gate | v0.0.3 | 2/2 | Complete | 2026-06-30 |
| 12. Extended-diagnostic catalog + completeness tripwire | v0.1.0 | 4/4 | Complete | 2026-07-01 |
| 13. Engine -- solution-tsconfig reference-walking | v0.1.0 | 6/6 | Complete | 2026-07-01 |
| 13.1 Rename angular-typecheck executor to typecheck (INSERTED) | v0.1.0 | 0/1 | Planned | - |
| 14. configuration + init generators, nx add | v0.1.0 | 0/? | Not started | - |
| 15. Generator e2e + CI self-audit guard | v0.1.0 | 0/? | Not started | - |
