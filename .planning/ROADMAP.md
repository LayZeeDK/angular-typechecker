# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [ACTIVE] **v0.0.4** -- Phases 12-14 -- typecheck-configuration generator and extended testing strategy. Ships the deferred `typecheck-configuration` Nx generator (the version-bumping `feat` for 0.0.3 -> 0.0.4) plus the board-ratified testing-technique stack: the complete 18-member extended-diagnostic catalog with an enum-completeness tripwire, in-memory generator unit tests, a folded generator e2e, and a CI `-p` set-equality guard. Testing strategy: `.planning/research/v0.0.4-testing/board2/CONSENSUS.md`.

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

### v0.0.4 -- typecheck-configuration generator and extended testing strategy (Phases 12-14)

- [ ] **Phase 12: Extended-diagnostic catalog + completeness tripwire** - Assert all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes by exact code/category/count/promotion in one enum-keyed `it.each` table, with an enum-vs-table tripwire that fails CI loudly on Angular drift.
- [ ] **Phase 13: typecheck-configuration generator** - Ship the `nx g angular-typechecker:typecheck-configuration <project>` generator that wires an `angular-typecheck` target into `project.json` (config-edit only, idempotent), with hand-authored schema and in-memory generator tests.
- [ ] **Phase 14: Generator e2e + CI self-audit guard** - Fold a generator end-to-end scenario into `angular-typechecker-install-e2e` (install tarball -> `nx g` -> assert `project.json` -> run the target) and add a `-p` set-equality guard that turns a forgotten e2e project into a loud failure.

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
- [ ] 12-03-PLAN.md -- The sibling baseline TS/NG `it.each` table + ~2 baseline fixtures; folds/deletes `baseline.angular13` and corrects the TESTING.md spec count (CAT-03)
- [x] 12-04-PLAN.md -- Rewrite `research/DIAGNOSTIC-CATALOG.md` to the authoritative 18-member enum set (CAT-05)

### Phase 13: typecheck-configuration generator
**Goal**: A developer can run a single Nx generator to wire a complete, correct `angular-typecheck` target into any Nx-workspace project's `project.json` -- with the right `tsConfig` defaulted per project type, spec-tsconfig handling, idempotent re-runs, and a shipped/registered schema -- all proven on the public in-memory tree substrate.
**Depends on**: Nothing within v0.0.4 (parallel to Phase 12; consumes the existing executor it wires up)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06
**Success Criteria** (what must be TRUE):
  1. A developer runs `nx g angular-typechecker:typecheck-configuration <project>` and the project's `project.json` gains a working `angular-typecheck` target, edited via `readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles` with NO file emission (no `generateFiles`).
  2. The generator picks the correct `tsConfig` per project type (application -> `tsconfig.app.json`, library -> `tsconfig.lib.json`) with an explicit `--tsConfig` override, and handles spec-tsconfig (`tsconfig.spec.json`) type-checking when a spec tsconfig exists; prod tsconfigs (e.g. `tsconfig.lib.prod.json`) are skipped. The exact wiring shape (single target + option vs. multiple targets vs. `configurations`) and the type-detection method are resolved during this phase's discussion/research and are observable in the written `project.json` -- whatever shape is chosen, re-running the generator stays idempotent. (Nx workspaces only; Angular CLI `angular.json` layouts deferred.)
  3. Re-running the generator on an already-wired project is idempotent: no duplicate target and no clobbered existing configuration.
  4. The generator ships a hand-authored `schema.json` + `schema.d.ts`, registered via `generators.json` and the published `package.json` `generators` field, and the generator + schema are included in the tarball `files` set.
  5. Generator unit tests run on the public in-memory `createTreeWithEmptyWorkspace` substrate (NO bespoke `createFsTree`) and assert the written target configuration for each supported project type plus idempotency; a schema-parity spec asserts `schema.json` keys === the `schema.d.ts` interface.
**Plans**: TBD

### Phase 14: Generator e2e + CI self-audit guard
**Goal**: The generator is proven end-to-end against the installed tarball -- a real consumer installs the package, generates the target on a previously un-wired project, and runs it to a correct verdict -- and the CI e2e job can no longer silently skip a project because of a forgotten `-p` entry.
**Depends on**: Phase 13 (needs the shipped generator + `generators.json` + the registered `generators` field)
**Requirements**: GE2E-01, GE2E-02, GUARD-01
**Success Criteria** (what must be TRUE):
  1. The `angular-typechecker-install-e2e` consumer fixture gains a project WITHOUT a pre-wired target, and an e2e scenario installs the tarball, runs `nx g angular-typechecker:typecheck-configuration` on that project, and asserts the resulting `project.json` target -- with no Verdaccio and no new e2e project.
  2. The same scenario then runs `nx run <proj>:angular-typecheck --skip-nx-cache` and asserts the verdict end-to-end: a clean project yields success, and an injected template/type error yields a failure with the diagnostic code visible in the output.
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
| 12. Extended-diagnostic catalog + completeness tripwire | v0.0.4 | 3/4 | In Progress|  |
| 13. typecheck-configuration generator | v0.0.4 | 0/? | Not started | - |
| 14. Generator e2e + CI self-audit guard | v0.0.4 | 0/? | Not started | - |
