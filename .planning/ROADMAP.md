# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- Storybook story type-checking (closed 2026-07-07; published to npm 2026-07-07 as `angular-typechecker@0.2.0`). One boundary-filter correctness fix (directory-containment -> compiler **input-set membership**) so `typecheck` targets check `*.stories.ts` and the whole `.storybook/` tsconfig-declared surface across the two Nx-official layouts (per-project scaffold + centralized host), proven against the shipped tarball on the supported stack, with no silent false pass; plus the opt-in `strict` mode, Storybook Composition fan-out, and Vite/Analog `?query` guidance. Scope hardened by a 6-lens Opus advisory board (`.planning/research/v0.1.2-storybook/board/CONSENSUS.md`). Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`. (v0.1.1 was a packaging hotfix; no v0.1.x roadmap phases between 15 and 16.)
- [ACTIVE] **v0.2.1** -- Phases 21-24 -- Angular CLI (`angular.json`) workspace support (ADDITIVE-ONLY). Re-export the shipped `typecheck` executor as an Angular CLI builder (`convertNxExecutor`) and the `configuration`/`init` generators as Angular CLI schematics (`convertNxGenerator`), add a first-party `ng-add` schematic that auto-wires every app + library project in `angular.json`, and widen the engine's `tsConfig` to `string | string[]` -- proven end-to-end against a real OSS `angular.json` workspace. No breaking changes to the Nx executor id, the `runTypecheck`/`CoreResult`/`CoreOptions` public API (widening only), or existing schemas (re-versions to v0.3.0 only if a breaking change proves unavoidable). Design + empirical verification: `.planning/research/v0.2.1-angular-cli/SUMMARY.md` (CORRECTION & LOCKED DECISIONS).

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

<details>
<summary>[SHIPPED] v0.1.0 -- reference-walking engine, typecheck executor rename, and the configuration + init generator suite (Phases 12-15, incl. inserted 13.1) -- SHIPPED 2026-07-02</summary>

- [x] Phase 12: Extended-diagnostic catalog + completeness tripwire (4/4 plans) -- completed 2026-07-01 -- CAT-01..05, DRIFT-01: all 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG codes asserted by exact code/category/count/promotion in one enum-keyed `it.each` table, with an enum-vs-table tripwire that fails CI loudly on Angular drift.
- [x] Phase 13: Engine -- solution-tsconfig reference-walking (6/6 plans) -- completed 2026-07-01 -- WALK-01/02: one `runTypecheck` walks a solution tsconfig's in-project referenced leaves; union + dedupe; boundary guard; three-way split; `default`-not-`production` caching.
- [x] Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED) (1/1 plan) -- completed 2026-07-01 -- EXEC-01: breaking rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` everywhere; behavior unchanged; drives the 0.1.0 minor bump.
- [x] Phase 14: configuration + init generators, nx add (3/3 plans) -- completed 2026-07-02 -- GEN-01..09: `nx g :configuration` wires ONE target; `init` seeds targetDefaults; `nx add` runs `init`.
- [x] Phase 15: Generator e2e + CI self-audit guard (2/2 plans) -- completed 2026-07-02 -- GE2E-01..03, GUARD-01: generators proven e2e against the tarball; `-p` set-equality guard.

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.1.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.0 -- Storybook story type-checking (Phases 16-20) -- closed 2026-07-07, published 2026-07-07 (`angular-typechecker@0.2.0`)</summary>

- [x] Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO) (spikes 006-008) -- completed 2026-07-05 -- SB-05: VERDICT = GO (G2/G3/G4 all YES; G1 = html + G5 = PASS -> external-template branch 4a). Layout B is type-checkable on the official stack.
- [x] Phase 17: Input-set-membership boundary + layout support (7/7 plans) -- completed 2026-07-06 -- SB-01/02/03/04: pure `keep(diagnostic, inputSet, options)` shared by walk + single-leaf, split suppressed counters + coverage-incomplete verdict, Layout A + B proven end-to-end, zero ngtsc internals.
- [x] Phase 18: Packaged-tarball e2e + docs (5/5 plans) -- completed 2026-07-06 -- SB-06/07: the SHIPPED tarball catches a planted `*.stories.ts` error on Layout A + B via `nx add` + `nx g configuration` + `nx typecheck`; `.mdx`/`.tsx` "not type-checked" advisory; README coverage claim + green->red CHANGELOG callout.
- [x] Phase 19: Stretch -- Layout C / non-TS story formats / strict mode (3/3 plans) -- completed 2026-07-07 -- SB-08: opt-in verdict-only `strict` mode + Storybook Composition (zero engine code); Layout-C-beyond-guard and `.mdx`/`.tsx`-beyond-advisory recorded "not warranted".
- [x] Phase 20: Vite/Analog Storybook query-import guidance (5/5 plans) -- completed 2026-07-07 -- SB-09: verdict-neutral `bundlerQueryImports` advisory (engine + executor) + README `"types": ["vite/client"]` recipe; charter guard proves plain-missing still fails and `?query` `TS2307` is never auto-suppressed. Gate A (green CI PR #27) + Gate B (radix-ng/primitives real-repo verify).

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.0-ROADMAP.md`

</details>

### [ACTIVE] v0.2.1 -- Angular CLI (`angular.json`) workspace support (Phases 21-24)

- [x] **Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO)** -- Re-export the `typecheck` executor as an Angular CLI builder, widen `tsConfig` to `string | string[]`, and prove the CJS->ESM `await import()` bridge survives `convertNxExecutor` + a real `ng run` on-stack (Angular 22) against a real cloned OSS workspace (`bluehalo/ngx-leaflet`). (Off-stack Angular 21 dropped 2026-07-10.) (completed 2026-07-10)
- [x] **Phase 22: `configuration` schematic + the `angular.json` write-fork** -- `ng generate angular-typechecker:configuration <project>` wires one per-project `typecheck` architect target (scoped to that project's leaves) via the `tree.exists('angular.json')` fork, with the Nx generator path unchanged. (completed 2026-07-10)
- [x] **Phase 23: `init` schematic parity + first-party `ng-add`** -- `ng add angular-typechecker` auto-wires every app + library project in `angular.json`, with the no-caching notice and optional-peer dependency classification. (completed 2026-07-10)
- [ ] **Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs** -- prove the full flow against a real OSS `angular.json` workspace and a scaffolded one, audit the additive-only charter, and document the Angular CLI surface.

## Phase Details

### Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO)

**Goal:** The shipped `typecheck` executor is runnable as an Angular CLI builder (`ng run <project>:typecheck`) with diagnostics, human output, and verdict identical to the Nx executor; the engine's `tsConfig` accepts `string | string[]`; and the CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge is empirically proven to survive `convertNxExecutor` + a real `ng run`.
**Depends on:** Nothing new (builds on the shipped v0.2.0 engine + executor).
**Requirements:** ENG-01, ACB-01, ACB-02 (GATE A'), ACB-03
**GATE:** This phase contains the **GATE A' GO/NO-GO spike (ACB-02)**. It is the milestone's headline risk and gates every downstream phase (exactly as Phase 16 gated Layout B in v0.2.0). A NO-GO re-scopes the builder feature (documented) and NEVER falls back to a hand-written `@angular-devkit/architect` builder; the schematics/`ng-add`/e2e phases do not proceed against the builder until GO.
**Success Criteria** (what must be TRUE):

  1. GATE A' (ACB-02): a real `ng run <project>:typecheck` against a real cloned OSS Angular 22 workspace (`bluehalo/ngx-leaflet`) completes with NO `ERR_REQUIRE_ESM` on-stack (Angular 22) -- including the wrapper's eager project-graph prelude -- and the GATE build-output static assertion is extended to the builder entry; the GO/NO-GO verdict is recorded. (Off-stack Angular 21 dropped 2026-07-10 per user directive.)
  2. `ng run <project>:typecheck` (via the `convertNxExecutor`-wrapped builder) produces diagnostics, `formatDiagnostics` human output, and a `BuilderOutput.success` verdict identical to the Nx executor (ACB-01).
  3. The `tsConfig` option accepts an array: each entry runs through the existing single-`tsConfig` logic, diagnostics UNION, and the v0.2.0 input-set-membership boundary filters over the combined declared input sets; the single-string behavior and the Nx path are byte-unchanged (ENG-01).
  4. `builders.json` + the `package.json` `builders` field are added additively, and `nx run <project>:typecheck` still resolves unchanged -- the `executors ?? builders` Nx-surface regression assertion passes (ACB-03).

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 21-01-PLAN.md -- GATE A' gating plan: minimal `convertNxExecutor` builder + manifests + sanitized schema, extended static byte-guard, and the real-`ng run` GATE A' spike (011) against the cloned Angular 22 `bluehalo/ngx-leaflet` workspace (GO/NO-GO). **Tasks 1-3 committed 2026-07-10 (`4b768d4`, `86d44c4`, `57c391c`); spike 011 VERDICT = GO.** Task 4 (blocking human GATE A' GO/NO-GO checkpoint) PENDING -- box stays unchecked until the human types "GO".

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02-PLAN.md -- ENG-01: widen `tsConfig` to `string | string[]` (both schemas `oneOf`, array-aware normalize-options, core `handleMultiTsConfig` union-then-single-finalize) + hermetic integration fixture

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-03-PLAN.md -- ACB-01/ACB-03 in-repo guard suite: builder schema-parity, thin-wrapper structural parity, and the `executors ?? builders` Nx-surface regression

### Phase 22: `configuration` schematic + the `angular.json` write-fork

**Goal:** `ng generate angular-typechecker:configuration <project>` wires ONE per-project `typecheck` architect target into `angular.json`, scoped to exactly that project's complete leaf set, via a single shared generator with a `tree.exists('angular.json')` fork -- leaving the Nx generator path byte-unchanged.
**Depends on:** Phase 21 (needs the builder target + the array-`tsConfig` engine; requires GATE A' = GO).
**Requirements:** ACS-01, ACS-02, ACS-04, COV-01
**Success Criteria** (what must be TRUE):

  1. `ng generate angular-typechecker:configuration <project>` wires one per-project `typecheck` architect target into `angular.json` with `tsConfig: [<build leaf>, <spec leaf>]` via the `tree.exists('angular.json')` write-fork -- config-edit-only (no emitted file), idempotent, and collision-safe (ACS-01).
  2. The Nx `configuration` generator path is behavior-unchanged: one shared generator with the workspace-type fork; the Nx path still writes a single-string solution `tsConfig` (ACS-02).
  3. A per-project `typecheck` target type-checks that project's COMPLETE leaf set (application+spec, or library+spec) and ONLY that project's leaves -- proven by scaffolding `ng g library` and asserting per-project scoping with no cross-project bleed (COV-01).
  4. `collection.json` + the `package.json` `schematics` field are added additively, and `nx g angular-typechecker:configuration` still resolves unchanged -- the `generators ?? schematics` Nx-surface regression assertion passes (ACS-04).

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 22-01-PLAN.md -- ACS-01/ACS-02/COV-01: the `tree.exists('angular.json')` write-fork in the shared `configuration` generator (new `resolveTsConfigLeaves` Approach A helper + the `updateJson('angular.json')` architect target with the `[buildLeaf, specLeaf]` array), and the `angular.json`-seeded `configuration-angular-cli.spec.ts` (target shape, idempotency, collision, no stray `nx.json`, two-project per-project scoping). Nx path byte-unchanged.
- [x] 22-02-PLAN.md -- ACS-04: the four additive manifest edits (`collection.json`, `src/schematics/configuration/schematic.ts` = `convertNxGenerator(configurationGenerator)`, `package.json` `schematics` field + `files` entry, `project.json` `collection.json` build-asset glob) + the `generators ?? schematics` Nx-surface regression spec; `nx lint` hard gate.

### Phase 23: `init` schematic parity + first-party `ng-add`

**Goal:** `ng add angular-typechecker` installs the package and auto-wires a `typecheck` target into every `application` + `library` project in `angular.json`, with an explicit "no target caching on Angular CLI" notice, an `init` schematic for parity that seeds no caching, and correct optional-peer dependency classification.
**Depends on:** Phase 22 (`ng-add` composes the shared `configuration` write-fork).
**Requirements:** ACS-03, NGADD-01, ACP-01
**Success Criteria** (what must be TRUE):

  1. `ng add angular-typechecker` runs a first-party `ng-add` schematic that iterates `angular.json#projects` and wires a `typecheck` target into EVERY `application` + `library` project (idempotent -- skips a project that already has a `typecheck` target; skips e2e/other project types), ensures the devDependency, and prints an explicit "no target caching on Angular CLI" notice (NGADD-01).
  2. `ng generate angular-typechecker:init` is available for parity, and on an Angular CLI workspace it seeds NO caching and creates no stray `nx.json` (ACS-03).
  3. `@angular-devkit/architect` + `rxjs` are declared as OPTIONAL `peerDependencies`, `@nx/dependency-checks` stays green, and the "`ng add` pulls `nx` transitively + may create a `.nx/` dir" consequence is documented (ACP-01).
  4. The Nx `nx add angular-typechecker` behavior is unchanged from v0.2.0 (init/caching seed only).

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 23-01-PLAN.md -- ACS-03: additive `tree.exists('angular.json')` early-return fork in `initGenerator` (no caching / no stray `nx.json`) + the co-located single-source `NO_CACHING_NOTICE` const + `convertNxGenerator(initGenerator)` re-export + the `collection.json` init entry + init-CLI-fork spec + surface-regression (init).
- [x] 23-02-PLAN.md -- ACP-01 + NGADD-01 (RF-01 lever): declare `@angular-devkit/architect` + `rxjs` as OPTIONAL peerDependencies (`peerDependenciesMeta.optional`), the `@nx/dependency-checks` `ignoredDependencies` lever + the nx-transitive/`.nx/` doc comment, the `ng-add.save: devDependencies` field, and the static manifest contract spec.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-03-PLAN.md -- NGADD-01: the composed `ngAddGenerator` (RF-02 guard + defensive devDep move + `getProjects` enumerate/filter/compose `configurationGenerator` per app+library + notice-once, returns void) + schema + `convertNxGenerator(ngAddGenerator)` re-export + the `collection.json` ng-add entry + auto-wire-all/idempotency/guard spec + surface-regression (ng-add absent from generators.json -> nx add unchanged).

### Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs

**Goal:** The full Angular CLI flow (`ng add` -> `ng run <project>:typecheck`) is proven end-to-end against a real OSS `angular.json` workspace and a freshly scaffolded workspace, the additive-only charter is audited, and the README/CHANGELOG document the new Angular CLI surface in end-user language.
**Depends on:** Phases 21, 22, 23 (the e2e exercises the builder, the schematics, and `ng-add` together).
**Requirements:** ACV-01, ACV-02, ACV-03, ACP-02, ACD-01
**Success Criteria** (what must be TRUE):

  1. The packed tarball is proven end-to-end -- the milestone's FINAL real-repo gate -- against a REAL cloned OSS Angular 22 workspace (`bluehalo/ngx-leaflet`, on-stack, MIT, non-Nx, app `ngx-leaflet-demo` + lib `ngx-leaflet`): `ng add` -> `ng run <project>:typecheck` catches planted diagnostics (ACV-01). No off-stack Angular 21 cross-check (dropped 2026-07-10).
  2. The full flow is proven against a freshly SCAFFOLDED workspace (`npm init @angular` + `ng g library`): planted application + spec + library errors each surface, and each per-project target catches exactly its own leaves (ACV-02).
  3. Unit + integration coverage targets the Angular-CLI-vs-Nx differences: the `tsConfig: string[]` union; the `angular.json` write-fork on an `angular.json`-seeded schematics test tree; the builder over `BuilderContext`; `ng-add` auto-wire-all + idempotency; and no stray `nx.json` (ACV-03).
  4. Additive-only is enforced and audited: no breaking change to the executor id, the `runTypecheck`/`CoreResult`/`CoreOptions` public API (widened only), or the existing schemas -- v0.3.0 only if a breaking change proves unavoidable (ACP-02).
  5. README gains an `## Angular CLI` section (`ng add` auto-wire-all; single-project `ng generate ...:configuration`; `ng run <project>:typecheck`; per-project targets; the `tsConfig` array; the `nx`-transitive + no-caching notes; the off-stack `--legacy-peer-deps` note), plus a curated CHANGELOG entry in end-user language with no internal ids (ACD-01).

**Plans:** 2/3 plans executed

Plans:
**Wave 1**

- [x] 24-01-PLAN.md -- ACV-03/ACP-02: builder-over-`BuilderContext` integration gap-fill + `src/index.drift.ts` barrel additive-only tripwire + the git-diff audit vs `angular-typechecker@0.2.0`
- [x] 24-02-PLAN.md -- ACD-01: README `## Angular CLI` section + curated prose CHANGELOG entry + the `angular-cli-docs.spec.ts` content tripwire

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 24-03-PLAN.md -- ACV-01/ACV-02: the scaffolded `ng add` -> `ng run` e2e project (committed pinned Ng22 fixture) + the real-clone milestone-final UAT procedure

## Progress

| Phase             | Milestone | Plans Complete | Status   | Completed  |
| ----------------- | --------- | --------------- | -------- | ---------- |
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
| 13.1 Rename angular-typecheck executor to typecheck (INSERTED) | v0.1.0 | 1/1 | Complete | 2026-07-01 |
| 14. configuration + init generators, nx add | v0.1.0 | 3/3 | Complete | 2026-07-02 |
| 15. Generator e2e + CI self-audit guard | v0.1.0 | 2/2 | Complete | 2026-07-02 |
| 16. Storybook type-check gate spike (GATED) | v0.2.0 | spikes 006-008 | Complete (GO) | 2026-07-05 |
| 17. Input-set-membership boundary + layout support | v0.2.0 | 7/7 | Complete | 2026-07-06 |
| 18. Packaged-tarball e2e + docs | v0.2.0 | 5/5 | Complete | 2026-07-06 |
| 19. Stretch (Layout C / non-TS formats / strict mode) | v0.2.0 | 3/3 | Complete | 2026-07-07 |
| 20. Vite/Analog Storybook query-import guidance | v0.2.0 | 5/5 | Complete | 2026-07-07 |
| 21. Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO) | v0.2.1 | 3/3 | Complete    | 2026-07-10 |
| 22. `configuration` schematic + the `angular.json` write-fork | v0.2.1 | 2/2 | Complete    | 2026-07-10 |
| 23. `init` schematic parity + first-party `ng-add` | v0.2.1 | 3/3 | Complete    | 2026-07-11 |
| 24. Real-OSS + scaffolded e2e, additive-only audit, docs | v0.2.1 | 2/3 | In Progress|  |
