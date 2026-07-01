# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [ACTIVE] **v0.0.4** -- Phases 12-15 -- solution-tsconfig reference-walking engine, typecheck-configuration generator, and extended testing strategy. Ships (1) the spike-validated reference-walking engine mode (WALK) -- point one target at a project's solution `tsconfig.json` and type-check its in-project referenced leaves (lib/app + spec) in one `runTypecheck` call (union + dedupe, module-boundary-guarded, coarse-cached) -- (2) the deferred `typecheck-configuration` Nx generator, now trivially wiring ONE `typecheck` target at the solution `tsconfig.json` (the version-bumping `feat` for 0.0.3 -> 0.0.4), and (3) the board-ratified testing-technique stack: the complete 18-member extended-diagnostic catalog with an enum-completeness tripwire (shipped), in-memory generator unit tests, a folded generator e2e, and a CI `-p` set-equality guard. Reference-walking GO-gated by spikes 001-005 (`.planning/spikes/MANIFEST.md`). Testing strategy: `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.

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

### v0.0.4 -- solution-tsconfig reference-walking engine, typecheck-configuration generator, and extended testing strategy (Phases 12-15)

- [x] **Phase 12: Extended-diagnostic catalog + completeness tripwire** - Assert all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes by exact code/category/count/promotion in one enum-keyed `it.each` table, with an enum-vs-table tripwire that fails CI loudly on Angular drift. (completed 2026-07-01)
- [ ] **Phase 13: Engine -- solution-tsconfig reference-walking** - Teach the `angular-typecheck` engine to type-check a solution / references-only `tsconfig.json` by walking its in-project referenced leaves (lib/app + spec) in ONE `runTypecheck` call (union + dedupe by value identity, module-boundary-guarded, coarse-cached), superseding the D-03a solution-style short-circuit so a single target yields the complete, duplicate-free diagnostic set for the whole project.
- [ ] **Phase 14: typecheck-configuration generator** - Ship the `nx g angular-typechecker:typecheck-configuration <project>` generator that wires ONE `typecheck` target pointed at the project's solution `tsconfig.json` into `project.json` (config-edit only, idempotent), with a hand-authored/registered schema and in-memory generator tests -- relying on the Phase 13 walk, so no per-project-type detection and no separate spec target.
- [ ] **Phase 15: Generator e2e + CI self-audit guard** - Prove the generator end-to-end against the installed tarball (install -> `nx g` on a previously un-wired project -> assert `project.json` -> run the single `typecheck` target to a multi-leaf walk verdict) and add a `-p` set-equality guard that turns a forgotten e2e project into a loud failure.

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
**Plans**: TBD

### Phase 14: typecheck-configuration generator
**Goal**: A developer can run `nx g angular-typechecker:typecheck-configuration <project>` to wire ONE `typecheck` target (executor `angular-typechecker:angular-typecheck`) pointed at the project's solution `tsconfig.json` into `project.json` (config-edit only, idempotent), with a hand-authored + registered schema and in-memory generator tests -- relying on the Phase 13 walk, so no per-project-type detection and no separate spec target are needed.
**Depends on**: Phase 13 (the reference-walk the single target relies on)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06
**Success Criteria** (what must be TRUE):
  1. Running the generator adds a working `typecheck` target pointed at the project's solution `tsconfig.json`, edited via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles` with NO file emission (no `generateFiles`).
  2. An explicit `--tsConfig` override is honored; a flat-project fallback points the target at the leaf (`tsconfig.app.json`/`tsconfig.lib.json`) when the project has no solution tsconfig / no `references`; `targetName` is configurable (default `typecheck`); and an existing non-ours target of the same name is not clobbered (collision handling).
  3. Re-running the generator on an already-wired project is idempotent (no duplicate target, no clobbered config).
  4. The generator ships a hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` and the published `package.json` `generators` field, with the generator + schema included in the tarball `files` set.
  5. Generator unit tests on the public in-memory `createTreeWithEmptyWorkspace` substrate assert the written target for the solution-tsconfig case AND the flat-project fallback case plus idempotency; a schema-parity spec asserts `schema.json` keys === the `schema.d.ts` interface.
**Plans**: TBD

### Phase 15: Generator e2e + CI self-audit guard
**Goal**: The generator is proven end-to-end against the installed tarball -- a real consumer installs the package, generates the single `typecheck` target on a previously un-wired project, and runs it to a correct multi-leaf walk verdict -- and the CI e2e job can no longer silently skip a project via a forgotten `-p` entry.
**Depends on**: Phase 14 (needs the shipped generator + `generators.json` + the registered `generators` field)
**Requirements**: GE2E-01, GE2E-02, GUARD-01
**Success Criteria** (what must be TRUE):
  1. The `angular-typechecker-install-e2e` consumer fixture gains a project WITHOUT a pre-wired target, and an e2e scenario installs the tarball, runs `nx g angular-typechecker:typecheck-configuration` on that project, and asserts the resulting `project.json` (one `typecheck` target pointed at the solution `tsconfig.json`) -- with no Verdaccio and no new e2e project.
  2. The same scenario runs `nx run <proj>:typecheck --skip-nx-cache` and asserts the walk verdict end-to-end: a clean project yields success, and errors injected into BOTH the lib leaf AND the spec leaf yield a failure with the diagnostic codes visible in the output (proving both leaves were walked).
  3. A guard test asserts the `e2e` CI job's explicit `-p` project list EQUALS the set of `e2e/*` projects in the workspace graph (predicate quantifier `every`), so a forgotten `-p` entry becomes a loud, located CI failure instead of a silent skip; the single required `ci` gate is unchanged.
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
| 12. Extended-diagnostic catalog + completeness tripwire | v0.0.4 | 4/4 | Complete | 2026-07-01 |
| 13. Engine -- solution-tsconfig reference-walking | v0.0.4 | 0/? | Not started | - |
| 14. typecheck-configuration generator | v0.0.4 | 0/? | Not started | - |
| 15. Generator e2e + CI self-audit guard | v0.0.4 | 0/? | Not started | - |
