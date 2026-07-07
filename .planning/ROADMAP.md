# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Ships the spike-validated reference-walking engine mode (WALK) and the complete 18-member extended-diagnostic catalog + enum-completeness tripwire; the BREAKING executor rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` that drives the 0.0.3 -> 0.1.0 minor bump; the `configuration` generator wiring ONE minimal `typecheck` target at the solution `tsconfig.json`, a standalone `init` generator that seeds `nx.json` targetDefaults, and `nx add angular-typechecker` support; and the folded generator + `nx add` e2e plus a CI `-p` set-equality guard. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [IN PROGRESS] **v0.1.2** -- Phases 16-20 -- Storybook story type-checking. One boundary-filter correctness fix (directory-containment -> compiler **input-set membership**) so `typecheck` targets check `*.stories.ts` and the whole `.storybook/` tsconfig-declared surface across the two Nx-official layouts (per-project scaffold + centralized host), proven against the shipped tarball on the supported stack, with no silent false pass. Scope + decisions hardened by a 6-lens Opus advisory board (record: `.planning/research/v0.1.2-storybook/board/CONSENSUS.md`). Phase 20 adds Vite/Analog query-import guidance (SB-09), a follow-up surfaced by the Phase-19 OSS real-repo UAT + spikes 009-010. Requirements: `.planning/REQUIREMENTS.md` (SB-01..09). (v0.1.1 was a packaging hotfix; no v0.1.x roadmap phases between 15 and 16.)

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

### v0.1.2 -- Storybook story type-checking (Phases 16-20) -- IN PROGRESS

- [x] **Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO)** - Resolve G1-G5 on the official stack (forced `@storybook/angular@10.4.6`) to decide, on evidence, whether the centralized-host layout (Layout B) is type-checkable; produces the GO/NO-GO verdict reviewed at the 16->17 gate. (SB-05) -- **DONE 2026-07-05 via spikes 006-008: VERDICT = GO** (G2/G3/G4 all YES; G1=html + G5=PASS -> external-template branch 4a). Layout B ships in Phase 17.
- [x] **Phase 17: Input-set-membership boundary + layout support** - Replace directory-containment with a pure `keep(diagnostic, inputSet, options)` boundary; split + surface suppressed counts (coverage-incomplete floor); deliver Layout A (regression) and Layout B (aggregated cross-project stories incl. external templates). (SB-02, SB-04, SB-01, SB-03) (completed 2026-07-06)
- [x] **Phase 18: Packaged-tarball e2e + docs** - Prove the SHIPPED artifact catches a planted story error via `nx add` + `nx g configuration` + `nx typecheck` on generator-scaffolded Storybook fixtures; ship the coverage claim + caveats + green->red changelog callout. (SB-06, SB-07) (completed 2026-07-06)
- [x] **Phase 19: Stretch -- Layout C / non-TS story formats / strict mode** - Only if warranted after 16-18; otherwise carried forward. (SB-08, DEFERRABLE) (completed 2026-07-06)
- [ ] **Phase 20: Vite/Analog Storybook query-import guidance** - Strengthen the README Storybook caveat to LEAD with the proven fix (`"types": ["vite/client"]` on the checked tsconfig; hand `declare module '*?query'` fallback) for Vite/Analog `?raw`/`?url`/`?worker`/`?inline` imports reporting `TS2307`, AND add a verdict-neutral `?query` detection advisory. Both signals in scope for v0.1.2. Never auto-suppress `?query` `TS2307`. Follow-up from the Phase-19 OSS UAT + spikes 009-010. (SB-09)

## Phase Details

### Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO)

**Goal**: A reproducible, recorded spike resolves whether the centralized Storybook-host layout (Layout B) is type-checkable on the officially supported stack, so the milestone commits to Layout B only on evidence -- or ships Layout A alone with Layout B documented "not yet supported".
**Depends on**: Nothing within v0.1.2 (runs first; builds on the shipped walk engine)
**Requirements**: SB-05
**Status**: COMPLETE 2026-07-05 -- VERDICT = **GO** (spikes 006-008; records in `.planning/spikes/` + the `spike-findings-angular-typechecker` skill). G2/G3/G4 all YES; G1 = html + G5 = PASS -> external-template branch **4a**. All four success criteria met. Layout B ships in Phase 17.
**Success Criteria** (what must be TRUE):

  1. Each of G1-G5 is resolved with a recorded, reproducible result on the official stack (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, `@storybook/angular@10.4.6` force-installed): G1 external-template diagnostic attribution (component `.ts` vs `.html`); G2 widened Layout-B files materialize as the storybook leaf's `parsed.rootNames`; G3 forced SB10 compiles via `performCompilation` and a clean story passes clean; G4 NG8xxx fire on stories/aggregated components (proven POSITIVELY); G5 owning-component->external-template map from a stable public signal vs the keep-all-external-template fallback.
  2. A documented GO/NO-GO verdict for Layout B, reviewed at the 16->17 gate (NO-GO on G2/G3/G4 -> ship Layout A only, document Layout B "not yet supported (blocked upstream by the `@storybook/angular` peer range)").
  3. The SB-02(d) external-template branch and the SB-05 owning-map-vs-fallback choice are selected by the recorded evidence, not assumed.
  4. A written spike record exists under `.planning/spikes/`.

### Phase 17: Input-set-membership boundary + layout support

**Goal**: `nx typecheck` type-checks `*.stories.ts` (and the whole `.storybook/` tsconfig-declared surface) for both the per-project scaffold (Layout A) and the centralized host (Layout B) without ever silently passing a dropped diagnostic, via one boundary-filter correctness fix.
**Depends on**: Phase 16 (GO verdict + the selected external-template branch)
**Requirements**: SB-02, SB-04, SB-01, SB-03
**Success Criteria** (what must be TRUE):

  1. A broken `*.stories.ts` FAILS the verdict and a clean one PASSES, under BOTH Layout A and Layout B.
  2. An aggregated external-`templateUrl` NG8002 FAILS with the `.html`/component codeframe (the kill-shot case), per the Phase-16 branch.
  3. An imported dependency project's internal error and `node_modules` diagnostics are NOT reported (isolation preserved).
  4. A clean Layout-B host reports `suppressedInGraph == 0`, both suppression counts appear in stdout AND the structured result, and `suppressedInGraph > 0` yields a non-clean coverage-incomplete outcome.
  5. No Layout-A regression; the boundary is a pure `keep(diagnostic, inputSet, options)` shared by the walk and single-leaf paths; `git grep` shows it references zero ngtsc/component-registry internals.

**Plans:** 7/7 plans complete
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — Pure boundary `keep()` + dual-identity membership + split counter + branch 4a (filter-diagnostics.ts) [wave 1]
- [x] 17-02-PLAN.md — Surface declared rootName paths from the walk (walk-references.ts) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-03-PLAN.md — Thread inputTs union + replace suppressedCount with the split-counter CoreResult fields (run-typecheck.ts) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-04-PLAN.md — Late-bound coverage-incomplete verdict + outcome discriminant + exit-code wiring (evaluate-result.ts, exit-codes.ts) [wave 3]
- [x] 17-05-PLAN.md — Executor renders both suppressed counts + coverage-incomplete notice (executor.ts) [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 17-06-PLAN.md — Layout A + Layout B minimum integration proof of the 5 success criteria (fixtures + integration specs) [wave 4]
- [x] 17-07-PLAN.md — D-09a MANDATORY tripwire fixtures + FM-9 drift probe [wave 4]

### Phase 18: Packaged-tarball e2e + docs

**Goal**: The SHIPPED artifact (not just the local build) is proven to catch a planted story type error via `nx typecheck` on generator-scaffolded Storybook fixtures, and the README/changelog state the exact coverage claim and caveats.
**Depends on**: Phase 17
**Requirements**: SB-06, SB-07
**Success Criteria** (what must be TRUE):

  1. The packaged tarball, installed into a generator-scaffolded Layout-A project (and Layout B if GO), catches a planted `*.stories.ts` error via `nx add` + `nx g angular-typechecker:configuration` + `nx typecheck`.
  2. A workspace `paths`-aliased aggregated import compiles clean (no spurious TS2307).
  3. `.mdx` (never checked) and `.tsx`-without-`jsx` gaps emit a loud "not type-checked" notice (verdict may stay green).
  4. README + changelog carry the exact MUST/MUST-NOT/caveat coverage statement and the false-pass -> true-fail (green->red) callout.

**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 18-01-PLAN.md - D-01 net-new "not type-checked" advisory: pure detector + CoreResult field on walk + direct paths + executor render + green-verdict negative test [wave 1]
- [x] 18-02-PLAN.md - Residual boundary-semantics integration: T9 (paths-alias, criterion 2), T6 (story-less guard), T5 (node_modules suppression), T10 (host-only-.storybook) [wave 1]

**Wave 2** *(blocked on Wave 1)*

- [x] 18-03-PLAN.md - T11 integration proof: declared .mdx (+ JSX-free .tsx) fires the notice, verdict stays clean [wave 2]
- [x] 18-04-PLAN.md - Packaged-tarball Storybook e2e (criterion 1): shipped artifact catches a planted story error on Layout A + B via nx add + nx g configuration + nx typecheck [wave 2]

**Wave 3** *(blocked on Wave 2)*

- [x] 18-05-PLAN.md - Docs (SB-07): README ## Storybook coverage claim + Limitations WR-01 fix + CoreResult comment + curated CHANGELOG 0.1.2 green->red callout (prose only, no release cut) [wave 3]

### Phase 19: Stretch -- Layout C / non-TS story formats / strict mode

**Goal**: Optionally extend beyond the minimums (Layout C beyond the guard, `.mdx`/`.tsx` type-check, an opt-in strict mode that FAILS on `suppressedInGraph > 0`) only if warranted after Phases 16-18.
**Depends on**: Phase 18
**Success Criteria** (what must be TRUE):

  1. A decision is recorded for Layout C support beyond the no-silent-pass guard.
  2. Any item actually shipped carries a negative test.

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 19-01-PLAN.md -- Opt-in strict mode: strict option threaded schema -> normalizeOptions -> evaluateResult (the (gatesWarnings || strict) gate) + the dropped-in-graph-WARNING FLIP test + error-case regression guard [wave 1]
- [x] 19-02-PLAN.md -- Storybook Composition (ZERO engine code): synthetic-hybrid fixture (2 Layout-A libs + composing host with refs + implicitDependencies + dependsOn:['^typecheck']) + a negative-test e2e spec in the existing install-e2e project [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-03-PLAN.md -- Docs (D-10): README ## Storybook Composition section + MUST/MUST-NOT coverage claim + Layout C note + Angular-CLI planned caveat + content tripwire; and the 19-DECISIONS.md "not warranted" record for Layout C-beyond-guard + .mdx/.tsx-beyond-advisory (criterion 1) [wave 2]

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
| 16. Storybook type-check gate spike (GATED) | v0.1.2 | spike 006-008 | Complete (GO) | 2026-07-05 |
| 17. Input-set-membership boundary + layout support | v0.1.2 | 7/7 | Complete    | 2026-07-06 |
| 18. Packaged-tarball e2e + docs | v0.1.2 | 5/5 | Complete    | 2026-07-06 |
| 19. Stretch (Layout C / non-TS formats / strict mode) | v0.1.2 | 3/3 | Complete    | 2026-07-07 |

### Phase 20: Vite/Analog Storybook query-import guidance -- vite/client README recipe + optional TS2307 ?query advisory

**Goal:** Give consumers a clear, proven path when angular-typechecker (correctly) reports `TS2307`
on Vite/Analog Storybook import queries (`?raw`/`?url`/`?worker`/`?inline`, virtual modules) -- WITHOUT
weakening the never-a-silent-false-pass charter.

**Requirements**: SB-09

**Depends on:** Phase 19

**Success criteria:**
- **Signal 1 (required, docs-only, no engine change):** the README `## Storybook` caveat LEADS with
  the recommended fix -- add `"types": ["vite/client"]` to the checked tsconfig -- and names the hand
  `declare module '*?query'` `.d.ts` as the no-`vite`-dependency fallback. Wording is honest about the
  one wildcard blind spot (a `?query` import of a missing base resolves through the wildcard) and that
  the diagnostics are never auto-suppressed. Grounded in spike 009 (radix-ng 227 `?query` `TS2307` -> 0,
  no-false-pass preserved).
- **Signal 2 (in scope for Phase 20 -- user committed both signals 2026-07-07):** a verdict-neutral
  detection advisory (beside `notTypeCheckedDeclaredFiles`) that flags unresolved `TS2307` whose module
  specifier contains a `?` bundler query -- builder-agnostic (no Storybook/framework coupling),
  self-gating (silent once resolved), and NEVER suppressing a diagnostic. Grounded in spike 010. This
  is an ENGINE + executor change (a new advisory surfaced in the executor output + structured result),
  built and shipped together with Signal 1 in v0.1.2 -- NOT deferred.
- **Charter guard:** a test proves a plain missing module (no `?`) still fails `TS2307` and that no
  `?query` `TS2307` is ever auto-suppressed.

**Blueprint:** `.claude/skills/spike-findings-angular-typechecker/references/vite-analog-query-imports.md`
(spikes 009-010); origin `.planning/phases/19-stretch-layout-c-non-ts-story-formats-strict-mode/19-UAT.md`.

**Plans:** 1/5 plans executed

Plans:

**Wave 1**

- [x] 20-01-PLAN.md -- Signal 2 engine: pure detect-bundler-query-imports + CoreResult.bundlerQueryImports (single finalize seam) + unit/tripwire/integration tiers + hermetic vite-query fixture [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 20-02-PLAN.md -- Signal 2 executor render: warnBundlerQueryImports (fifth advisory notice; self-gating) + render/silent tests [wave 2]
- [ ] 20-03-PLAN.md -- Signal 1 docs: README Vite caveat leads with "types": ["vite/client"] + CoreResult API comment + curated CHANGELOG fold (no release cut) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 20-04-PLAN.md -- Gate A: local build/test/lint/format gates, push branch, open PR into main, confirm green CI (no merge/release) [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 20-05-PLAN.md -- Gate B (autonomous:false, human-gated): locally-packed dist tarball verified on radix-ng/primitives (advisory fires; vite/client clears; plain missing still fails) [wave 4]
