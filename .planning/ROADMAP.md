# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Verified against stable Angular 22.0.4; NO `NgtscProgram` migration, NO new feature surfaces. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- Storybook story type-checking (closed 2026-07-07; npm publish pending the human-gated Release-PR). One boundary-filter correctness fix (directory-containment -> compiler **input-set membership**) so `typecheck` targets check `*.stories.ts` and the whole `.storybook/` tsconfig-declared surface across the two Nx-official layouts (per-project scaffold + centralized host), proven against the shipped tarball on the supported stack, with no silent false pass; plus the opt-in `strict` mode, Storybook Composition fan-out, and Vite/Analog `?query` guidance. Scope hardened by a 6-lens Opus advisory board (`.planning/research/v0.1.2-storybook/board/CONSENSUS.md`). Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`. (v0.1.1 was a packaging hotfix; no v0.1.x roadmap phases between 15 and 16.)

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
<summary>[SHIPPED] v0.2.0 -- Storybook story type-checking (Phases 16-20) -- closed 2026-07-07 (npm publish pending Release-PR)</summary>

- [x] Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO) (spikes 006-008) -- completed 2026-07-05 -- SB-05: VERDICT = GO (G2/G3/G4 all YES; G1 = html + G5 = PASS -> external-template branch 4a). Layout B is type-checkable on the official stack.
- [x] Phase 17: Input-set-membership boundary + layout support (7/7 plans) -- completed 2026-07-06 -- SB-01/02/03/04: pure `keep(diagnostic, inputSet, options)` shared by walk + single-leaf, split suppressed counters + coverage-incomplete verdict, Layout A + B proven end-to-end, zero ngtsc internals.
- [x] Phase 18: Packaged-tarball e2e + docs (5/5 plans) -- completed 2026-07-06 -- SB-06/07: the SHIPPED tarball catches a planted `*.stories.ts` error on Layout A + B via `nx add` + `nx g configuration` + `nx typecheck`; `.mdx`/`.tsx` "not type-checked" advisory; README coverage claim + green->red CHANGELOG callout.
- [x] Phase 19: Stretch -- Layout C / non-TS story formats / strict mode (3/3 plans) -- completed 2026-07-07 -- SB-08: opt-in verdict-only `strict` mode + Storybook Composition (zero engine code); Layout-C-beyond-guard and `.mdx`/`.tsx`-beyond-advisory recorded "not warranted".
- [x] Phase 20: Vite/Analog Storybook query-import guidance (5/5 plans) -- completed 2026-07-07 -- SB-09: verdict-neutral `bundlerQueryImports` advisory (engine + executor) + README `"types": ["vite/client"]` recipe; charter guard proves plain-missing still fails and `?query` `TS2307` is never auto-suppressed. Gate A (green CI PR #27) + Gate B (radix-ng/primitives real-repo verify).

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.0-ROADMAP.md`

</details>

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
