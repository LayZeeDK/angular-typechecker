# Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning
**Mode:** `--auto --analyze --chain` (autonomous single-pass; recommended options auto-locked; `--analyze` trade-off tables logged in DISCUSSION-LOG.md). Trap-quadrant check applied per the `--auto` discuss rule -- see the "Trap-quadrant assessment" note in `<decisions>`. No user BLOCKER surfaced. Phase 24 is the LAST phase of v0.2.1, so nothing downstream inherits its choices; every gray area here is a test-infra / audit / docs IMPLEMENTATION-APPROACH question (researcher/planner territory per GSD philosophy), all MEDIUM-impact and reversible. The two genuinely NOT-HIGH-confidence items (scaffolded-workspace provisioning; whether to add a new public-API snapshot guard) are recorded as Phase-24 research flags (RF-01, RF-02) with starting hypotheses, NOT auto-locked as settled. **One mid-pass USER DIRECTIVE (2026-07-11):** include `realworld-angular/realworld-angular` as a SECOND on-stack real-clone substrate, ordered AFTER `bluehalo/ngx-leaflet` -- captured in D-01 (this reverses the pass's earlier auto-lock that had treated the research repo picks as stale; the off-stack Ng21 pick stays dropped).

<domain>
## Phase Boundary

The full Angular CLI flow (`ng add angular-typechecker` -> `ng run <project>:typecheck`)
is proven end-to-end against BOTH a real cloned OSS `angular.json` workspace and a
freshly scaffolded one; the Angular-CLI-vs-Nx-difference unit/integration coverage is
audited and gaps filled; the ADDITIVE-ONLY charter is audited; and the README + CHANGELOG
document the new Angular CLI surface in end-user language. This is the milestone's FINAL,
gating phase.

**Framing (important -- Phase 24 ships almost NO new production code):** the builder
(`convertNxExecutor`), the `configuration`/`init`/`ng-add` schematics
(`convertNxGenerator` + the `angular.json` write-fork), and the engine's `tsConfig:
string | string[]` widening ALL SHIPPED in Phases 21-23. Phase 24 is
VERIFICATION + AUDIT + DOCS: new **e2e/test** projects, an **audit** of already-built
coverage, and **prose**. No new engine/core/generator/schematic surface -> the
additive-only charter (ACP-02) is satisfied largely by construction.

**In scope (Phase 24 -- ACV-01, ACV-02, ACV-03, ACP-02, ACD-01):**
- **ACV-01 -- real-clone tarball e2e (milestone FINAL gate):** pack the SHIPPED tarball
  -> `ng add` -> `ng run <project>:typecheck` against the REAL cloned
  `bluehalo/ngx-leaflet` workspace (on-stack Angular 22, MIT, non-Nx, app
  `ngx-leaflet-demo` + lib `ngx-leaflet`); planted diagnostics fire, clean baselines exit
  clean. Run locally/manually (the clone is UNCOMMITTED); reproduction = repo URL + commit
  SHA. NO off-stack Angular 21 cross-check (DROPPED 2026-07-10).
- **ACV-02 -- scaffolded automated e2e (CI, no external clone):** a freshly SCAFFOLDED
  Angular CLI workspace (`npm init @angular` + `ng g library`); plant application + spec +
  library errors and assert each per-project `typecheck` target catches EXACTLY its own
  leaves.
- **ACV-03 -- Angular-CLI-vs-Nx-difference unit/integration coverage:** the `tsConfig:
  string[]` union; the `angular.json` write-fork on an `angular.json`-seeded schematics
  test tree; the builder over a `BuilderContext`; `ng-add` auto-wire-all + idempotency;
  no stray `nx.json`. AUDIT what Phases 21-23 already built and fill only genuine gaps.
- **ACP-02 -- additive-only enforced + audited:** no breaking change to the executor id,
  the `runTypecheck`/`CoreResult`/`CoreOptions` public API (widening only), or the existing
  schemas; re-version to v0.3.0 ONLY if a breaking change proves unavoidable.
- **ACD-01 -- docs:** README `## Angular CLI` section + a curated CHANGELOG entry in
  end-user language (no internal ids).

**Out of scope (other phases / charter):**
- The builder / schematics / `ng-add` / array-`tsConfig` PRODUCTION code -> ALREADY SHIPPED
  in Phases 21-23 (ACB-01/02/03, ENG-01, ACS-01/02/03/04, NGADD-01, COV-01, ACP-01).
  Phase 24 EXERCISES and DOCUMENTS them; it does not re-implement them.
- Any NEW public engine/generator/schematic surface, or any BREAKING change (ADDITIVE-ONLY
  charter -- the whole point of the ACP-02 audit).
- Off-stack Angular 21 (or any cross-version) e2e cross-check -- DROPPED 2026-07-10 per user
  directive; verification is on-stack Angular 22 ONLY. (The consumer-facing
  `--legacy-peer-deps` note for off-stack Angular still ships in the README -- that is a
  documentation line, not a test tier.)
- The version cut / npm publish -- that is the separate human-gated Release-PR flow
  (AGENTS.md), NOT this phase. Phase 24 writes CHANGELOG PROSE only.
- `createNodesV2` Nx auto-provisioning (WALK-FUT-01) -- deferred.

</domain>

<decisions>
## Implementation Decisions

> **Trap-quadrant assessment (per the `--auto` discuss rule):** Phase 24 is the FINAL phase
> of v0.2.1 -- no downstream phase inherits its choices, and it freezes no
> contract/schema/vocabulary (it ships tests + prose, not public surface). The requirements
> (ACV-01/02/03, ACP-02, ACD-01) are prescriptive and the design source of truth is LOCKED
> in `.planning/research/v0.2.1-angular-cli/` + the ROADMAP Phase-24 success criteria. The
> substrate reconciliation (D-01) is HIGH-confidence -- it is USER-LOCKED (the
> `bluehalo/ngx-leaflet` clone, on-stack-only, off-stack-Ng21-dropped) and recorded in
> ROADMAP + STATE + memory [[v021-angular-cli-substrate]], NOT a bare default. The remaining
> gray areas are all test-infra / audit / docs IMPLEMENTATION-APPROACH questions -- per GSD
> philosophy those belong to the researcher/planner, and all are MEDIUM-impact (reversible
> within the milestone, test-gated). So there is no HIGH-impact + NOT-HIGH-confidence USER
> decision -> no UNRESOLVED user BLOCKER, and this autonomous pass is correct to proceed.
> The TWO genuinely NOT-HIGH-confidence items are recorded as research flags (RF-01, RF-02).

### e2e substrate + topology (ACV-01, ACV-02 -- LOCKED)
- **D-01 (substrate -- LOCKED, HIGH-confidence; user-directed 2026-07-11):** The real-clone
  tier (ACV-01) runs against TWO on-stack Angular 22 clones, IN THIS ORDER:
  - **(1st) `bluehalo/ngx-leaflet`** @ its known SHA -- the PRIMARY substrate: on-stack
    Angular 22.x, MIT, non-Nx `angular.json`, app `ngx-leaflet-demo` + lib `ngx-leaflet`
    (gives the app+lib per-project-scoping coverage). The SAME clone Phase-21 GATE A' used.
  - **(2nd, AFTER ngx-leaflet) `realworld-angular/realworld-angular`** -- an ADDITIONAL
    on-stack real-clone confidence check the user explicitly re-included on 2026-07-11:
    Angular 22.0 / TS 6.0.3, MIT, non-Nx `angular.json`, `@angular/build:application`, NO peer
    friction (an exact-stack find per the research SUMMARY). Run it AFTER ngx-leaflet.
  This ADDS `realworld-angular` back (reversing this pass's earlier auto-lock that treated it
  as stale). It does NOT re-include the research's OFF-STACK Ng21 pick
  (`realworld-apps/angular-realworld-example-app`) -- off-stack Angular 21 stays DROPPED
  everywhere (on-stack Angular 22 ONLY). **Reconciliation for the planner/verifier:** ROADMAP
  Phase-24 SC1 names only `bluehalo/ngx-leaflet`; this CONTEXT (the phase's authoritative
  discuss output) extends the real-clone substrate to `ngx-leaflet` THEN `realworld-angular`
  per the user directive -- both on-stack, ngx-leaflet first. **Confirm during research:**
  `realworld-angular`'s project composition (likely app-only) -- target the planted-error
  assertions at whatever project types it actually declares (ngx-leaflet already covers the
  app+lib scoping; realworld-angular is breadth/confidence on a second exact-stack repo).
  Source: user directive 2026-07-11 + ROADMAP Phase 24 SC1 + STATE.md + research SUMMARY
  "Phase 4" (on-stack pick only) + memory [[v021-angular-cli-substrate]].
- **D-02 (ACV-01 = manual milestone-FINAL gate, not a CI test):** The real-clone e2e is a
  MANUAL/local gate -- the clone is UNCOMMITTED, so a committed CI test cannot run it.
  Document it as a reproducible UAT procedure (repo URL + commit SHA + the exact
  pack -> `ng add` -> plant -> `ng run` -> assert -> clean steps), mirroring the Phase-21
  spike-011 real-`ng run` gate and prior real-repo UAT gates (e.g. `19-UAT.md`). The
  CI-authoritative proofs are ACV-02 (scaffolded automated e2e) + ACV-03 (in-repo Vitest).
- **D-03 (ACV-02 = a NEW dedicated e2e project):** The scaffolded automated e2e is a NEW e2e
  project (name planner's discretion, e.g. `angular-typechecker-ng-cli-e2e`) mirroring
  `angular-typechecker-install-e2e`'s Verdaccio + tarball machinery, NOT folded into
  install-e2e (keeps the Angular CLI `@angular/cli` / `ng` harness separate from the Nx
  `nx` harness). CONSEQUENCE (load-bearing, from `.planning/codebase/TESTING.md` +
  `ci-e2e-coverage-guard.spec.ts`): the CI `e2e` job runs `nx run-many -t e2e --parallel=1`,
  all e2e projects `npm pack` the SAME dist tarball, and GUARD-01/01b/01c assert (a) the
  ci.yml `e2e` invocation stays `--parallel=1`, (b) every e2e project defines + runs a
  `typecheck-e2e` target, and (c) e2e-project/`-p`-list set-equality. So the new project
  MUST define `e2e` + `typecheck-e2e` targets and honor the shared-tarball serialization, or
  those guards go RED. See memory [[e2e-projects-share-one-tarball-serialize]].

### Additive-only audit (ACP-02 -- LOCKED approach + RF-02 flag)
- **D-04 (audit by cross-checking EXISTING guards + a diff review):** Additive-only is
  ENFORCED mostly by guards Phases 21-23 already shipped -- cross-check them rather than
  invent new enforcement:
  - `executors ?? builders` unchanged: `src/builders/typecheck/nx-surface-regression.spec.ts`.
  - `generators ?? schematics` unchanged: `src/schematics/configuration/nx-generators-surface-regression.spec.ts` (extended for `init`/`ng-add`).
  - schema-parity (executor + both generators + the sanitized builder schema): the `*schema-parity.spec.ts` set.
  - the static manifest contract: `src/package-manifest.spec.ts` (23-02).
  - ENG-01 single-string + Nx path byte-unchanged: the `multi-tsconfig-array` integration spec (21-02).
  The Phase-24 AUDIT artifact then confirms, by a git diff against the `angular-typechecker@0.2.0`
  tag, that the executor id, the `src/index.ts` public barrel (`runTypecheck` /
  `TypecheckInfrastructureError` / `CoreOptions` / `CoreResult` / `SkippedReference`), and the
  shipped schemas are WIDENED-ONLY (never narrowed/removed/renamed). Verdict recorded in the
  phase VERIFICATION/audit output.
- **RF-02 (new public-API snapshot guard? -- NOT auto-locked):** Whether to ADD a lightweight
  automated barrel/API snapshot spec (assert the `src/index.ts` export SET + the
  `CoreOptions`/`CoreResult` shape are unchanged-or-widened) or rely on the existing guards +
  the documented manual diff audit. Starting hypothesis (recommended, NOT locked): documented
  audit leveraging the existing guards; add a small barrel-export snapshot spec ONLY if the
  audit finds an unguarded seam. MEDIUM impact, reversible. For gsd-phase-researcher.

### ACV-03 coverage (mostly ALREADY built -- audit-and-fill -- LOCKED)
- **D-05:** ACV-03 is primarily an AUDIT-and-fill of the in-repo Vitest coverage Phases 21-23
  already delivered:
  - `tsConfig: string[]` union -> `fixtures/multi-tsconfig-array` real-compiler integration spec (21-02).
  - `angular.json` write-fork on a seeded tree -> `generators/configuration/configuration-angular-cli.spec.ts` (22-01).
  - `ng-add` auto-wire-all + idempotency + guard -> the 23-03 ng-add spec.
  - no stray `nx.json` -> the init CLI-fork spec (23-01) + the configuration spec (22-01).
  - builder schema-parity + Nx-surface regression -> `src/builders/typecheck/{schema-parity,nx-surface-regression,builder}.spec.ts` (21-03).
  CANDIDATE GAP to confirm/fill (ACV-03 names "the builder over `BuilderContext`"): today
  `builder.spec.ts` asserts STRUCTURAL parity + the Architect-builder BRAND, not a full RUN.
  An execution test that invokes the builder handler over a (mock or real) `BuilderContext`
  and asserts `BuilderOutput.success` + diagnostics parity with the Nx executor may be the one
  genuine addition. The researcher confirms the exact gap; the planner fills ONLY what is
  actually missing (no duplicate coverage).

### Docs (ACD-01 -- Claude's discretion within end-user language)
- **D-06:** README gains an `## Angular CLI` section with the ACD-01-enumerated contents:
  `ng add` auto-wire-all; single-project `ng generate angular-typechecker:configuration
  <project>`; `ng run <project>:typecheck`; per-project targets; the `tsConfig` array; the
  `nx`-transitive + `.nx/` + no-target-caching notes; and the consumer `--legacy-peer-deps`
  note for OFF-STACK Angular (< 22) -- that note stays even though the off-stack e2e tier was
  dropped, because Angular-<22 CONSUMERS still hit the `^22.0.0`/TS-6 peer cap (Pitfall 6).
  Plus a curated CHANGELOG entry, PROSE ONLY (no release cut in this phase). ALL prose is
  END-USER language -- no internal ids, phase/plan numbers, or board jargon
  ([[changelog-readme-end-user-facing]]); the `scoped-name-guard` + `storybook-docs`-style
  content tripwires already police the README on every PR. Section placement (relative to the
  existing `## Storybook` section) and exact wording are planner discretion.

### Charter reconciliation (record for the planner + milestone audit -- IMPORTANT)
- **D-07:** Phase 24 adds NO production engine/core/generator/schematic surface. The only new
  code is TEST/e2e projects + any single ACV-03 gap-fill spec (D-05) + the optional RF-02
  guard + doc prose. This makes ACP-02 (additive-only) trivially true BY CONSTRUCTION for the
  phase's own changes; the audit's job is to confirm Phases 21-23 (which DID add surface) stayed
  additive. Recorded so the milestone audit does not read "Phase 24 = e2e + docs" as leaving
  ACP-02 unproven.

### Claude's Discretion
- Plan decomposition (how many plans; whether the ACV-02 scaffolded e2e, the ACV-03 audit +
  gap-fill, the ACP-02 audit, and the ACD-01 docs split across plans or land together). A
  natural split: the new e2e project in one plan; the coverage/additive audit + any gap-fill
  spec in another; the docs (README + CHANGELOG) in a third. Not prescribed.
- The new e2e project's exact name.
- Which planted diagnostics the scaffolded + real-clone e2e use to prove per-project scoping
  (app + spec + library errors; mirror the install-e2e's distinct-per-leaf TS2322 / TS2345
  attribution so each error uniquely pins its own leaf).
- README `## Angular CLI` placement + exact CHANGELOG wording (end-user language).

### Phase-24 Research Flags (NOT auto-locked -- for gsd-phase-researcher)
- **RF-01 (scaffolded-workspace provisioning -- the primary Phase-24 research question):** HOW
  to provision the "freshly scaffolded" Angular CLI workspace DETERMINISTICALLY and ON-STACK in
  CI (ACV-02 says "runs in CI with no external clone"). The tension: the requirement text says
  `npm init @angular`, but a live `@latest` scaffold pulls the newest Angular (could drift OFF
  the locked Angular-22 stack) and adds a network dependency + flakiness, and this dev repo runs
  `.npmrc legacy-peer-deps=true` for its own Angular-22-on-Nx-23 pinning. Competing approaches to
  resolve empirically (against `bluehalo/ngx-leaflet` for sanity + the scaffolded fixture for the
  CI proof):
  - **(A) scaffold at test setup, PINNED to Angular 22** (`npx @angular/cli@22 new` /
    `npm create @angular@22`) then `ng g library` -- genuinely "fresh", but network + slower +
    still needs the version pinned so it stays on-stack.
  - **(B) commit a pre-scaffolded, PINNED `angular.json` fixture workspace** under
    `e2e/<proj>/fixtures/` (generated once with Angular 22, `ng g library` applied) and install
    the SHIPPED tarball into it -- deterministic, no network, on-stack by construction, but must
    be regenerated on Angular bumps (a `drift`-style note keeps it honest). Starting hypothesis
    (recommended, NOT locked): (B), for CI determinism + on-stack guarantee, matching how the
    existing e2e consumer workspaces live under `e2e/<project>/fixtures/`. Open sub-questions
    the researcher settles: does `ng add angular-typechecker` behave across the npm/pnpm/yarn PM
    matrix the way `nx add` does (cf. the pnpm build-approval friction in
    [[nx-add-fails-on-pnpm-workspaces]] -- `ng add` is a different install path, confirm), and how
    the scaffolded workspace's own `.npmrc`/peer posture interacts with the tarball install.
    MEDIUM impact (a fixture-vs-live choice is reversible, test-gated), deliberately left to
    research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (read FIRST)
- `.planning/REQUIREMENTS.md` -- ACV-01, ACV-02, ACV-03, ACP-02, ACD-01; the ADDITIVE-ONLY
  charter; the Out-of-Scope table (off-stack Angular 21 / any cross-version e2e DROPPED
  2026-07-10; hand-written architect builder / Rule excluded).
- `.planning/ROADMAP.md` -- Phase 24 Goal + Success Criteria SC1-SC5 (SC1 names
  `bluehalo/ngx-leaflet` explicitly; SC2 names `npm init @angular` + `ng g library`).

### Design source of truth (LOCKED decisions)
- `.planning/research/v0.2.1-angular-cli/SUMMARY.md` -- CORRECTION & LOCKED DECISIONS (Option A
  `tsConfig: string[]`; `ng add` auto-wire-all; `.angular/cache` build-only). **CAVEAT: its
  "Phase 4" repo picks are only PARTLY in play (see D-01). The LOCKED real substrate is
  `bluehalo/ngx-leaflet` FIRST, then `realworld-angular/realworld-angular` (its on-stack
  Ng22 pick, re-included by the user 2026-07-11). Its OFF-STACK Ng21 pick
  (`angular-realworld-example-app`) stays DROPPED. Read the design; use only the on-stack repos.**
- `.planning/research/v0.2.1-angular-cli/PITFALLS.md` -- Pitfall 4 (`nx` dragged in + `.nx/`
  artifact -> e2e tolerates/cleans it), Pitfall 5 (optional peers -> e2e backstop), Pitfall 6
  (off-stack `--legacy-peer-deps`; on-stack Ng22 needs none -> the README note), Pitfall 8
  (VOID; plant app + spec + library errors to prove per-project scoping).
- `.planning/research/v0.2.1-angular-cli/ARCHITECTURE.md` -- the additive-safety precedence
  (`executors ?? builders` / `generators ?? schematics`) the ACP-02 audit leans on.
- `.planning/research/v0.2.1-angular-cli/STACK.md` -- DEV-only `@angular/cli@^22.0.0` for the
  e2e harness; reuse the existing Verdaccio tarball tier; the optional-peer classification.
- `.planning/research/v0.2.1-angular-cli/FEATURES.md` -- the "IDENTICAL diagnostics + output +
  exit codes to the Nx surface" correctness INVARIANT the e2e proves.

### Existing code to EXERCISE / AUDIT (not modify)
- `packages/angular-typechecker/src/builders/typecheck/{builder,builder.spec,schema.json,schema-parity.spec,nx-surface-regression.spec}.ts`
  -- the builder + its structural/brand/surface guards; the ACV-03 `BuilderContext`-run gap (D-05).
- `packages/angular-typechecker/src/schematics/{configuration,init,ng-add}/*` +
  `.../configuration/nx-generators-surface-regression.spec.ts` -- the schematic re-exports +
  the `generators ?? schematics` surface guard (extend/confirm for ACP-02).
- `packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts`,
  `.../init/*.spec.ts` -- the `angular.json`-seeded write-fork + no-stray-`nx.json` coverage
  (ACV-03 audit targets).
- `packages/angular-typechecker/src/package-manifest.spec.ts` -- the static manifest contract
  (optional peers, `builders`/`schematics` fields, `ng-add.save`).
- `packages/angular-typechecker/src/index.ts` -- the LOCKED public barrel the ACP-02 diff audit
  checks for widen-only.
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01/01b/01c) -- the
  e2e-project set-equality + `--parallel=1` + `typecheck-e2e` guards a 4th e2e project must
  satisfy (D-03).

### e2e machinery to MIRROR (ACV-02)
- `e2e/angular-typechecker-install-e2e/` -- the Verdaccio `global-setup.ts` (127.0.0.1 loopback,
  real couchdb token, publish-once, provenance strip), the tarball-audit spec, the `nx add`
  npm/pnpm/yarn matrix, and the fixture layout (`e2e/<project>/fixtures/`) to clone for the
  Angular CLI scaffolded workspace.
- `.github/workflows/ci.yml` (the `e2e` job: `nx run-many -t e2e --parallel=1`) -- the new e2e
  project auto-joins `run-many -t e2e`; no `-p` edit needed, but the guard set-equality + the
  `--parallel=1` invariant must stay green.

### Docs targets (ACD-01)
- `packages/angular-typechecker/README.md` -- add `## Angular CLI` (D-06); the shipped
  `## Storybook` section is the length/tone precedent.
- `CHANGELOG.md` -- curate an end-user entry (PROSE only; no release cut). The existing `0.2.0`
  entry is the style precedent.
- `AGENTS.md` -- the Release-PR flow (why the CHANGELOG is prose-only here; the version cut is a
  separate human-gated PR) + the "no internal scopes/ids in the public changelog" rule.

### Codebase maps (orientation)
- `.planning/codebase/TESTING.md` (e2e tiers, the shared-tarball `--parallel=1` rule, the guard
  specs), `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md`,
  `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`.

### Prior context (this milestone)
- `.planning/phases/23-init-schematic-parity-first-party-ng-add/23-CONTEXT.md` -- `ng-add`
  auto-wire-all + optional-peer classification (what ACV-01/02 exercise; ACP-02 audits).
- `.planning/phases/22-configuration-schematic-the-angular-json-write-fork/22-CONTEXT.md` --
  the `angular.json` write-fork (what ACV-03 covers).
- `.planning/phases/21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no/21-CONTEXT.md`
  -- GATE A' = GO; the `bluehalo/ngx-leaflet` clone as the real substrate (D-01 precedent);
  the `convertNxExecutor` DEVIATION lesson (informs the ACV-03 `BuilderContext`-run gap).
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- the v0.2.1 GATE A' = GO
  findings channel.

### Real-clone substrate (ACV-01; UNCOMMITTED -- manual/local gate; two on-stack clones, ORDERED)
- **(1st) `bluehalo/ngx-leaflet`** @ its known SHA -- PRIMARY: on-stack Angular 22
  `angular.json` workspace (app `ngx-leaflet-demo`; lib `ngx-leaflet`). Clone under
  `D:\projects\github\bluehalo\ngx-leaflet`. Reproduction = repo URL + commit SHA. tar/pack
  portability gotcha: MSYS needs `/d/...` style paths, not `D:/...` ([[oss-real-repo-verification]]).
- **(2nd, after ngx-leaflet) `realworld-angular/realworld-angular`** -- ADDITIONAL on-stack
  confidence check (user-directed 2026-07-11): Angular 22.0 / TS 6.0.3, MIT, non-Nx
  `angular.json`, `@angular/build:application`, no peer friction. Clone from its GitHub URL @
  the SHA pinned during research; reproduction = URL + SHA. Confirm its project composition
  (app-only vs app+lib) and target the planted-error assertions accordingly.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`e2e/angular-typechecker-install-e2e/`** -- the Verdaccio + tarball + fixture harness to
  clone for the ACV-02 scaffolded Angular CLI e2e (global-setup publish-once, the
  `e2e/<project>/fixtures/` consumer-workspace layout, `buildCleanEnv({ stripAllNpmConfig:
  true })`, the 127.0.0.1 loopback registry).
- **The Phase 21-23 spec suite** -- `multi-tsconfig-array` integration (ENG-01),
  `configuration-angular-cli.spec.ts` (write-fork), the ng-add auto-wire-all spec, the init
  no-stray-`nx.json` spec, the builder schema-parity + surface-regression specs. ACV-03 AUDITS
  these and fills only genuine gaps (D-05).
- **The surface-regression + schema-parity + package-manifest guards** -- the ACP-02 audit
  cross-checks them rather than adding new enforcement (D-04).
- **`@workspace/test-util`** (`findWorkspaceRoot`, `buildCleanEnv`, `run`, `sh`,
  `removeTmpDir`) -- the cwd-independent e2e helpers the new project reuses.

### Established Patterns
- **Three e2e tiers, one shared dist tarball, `--parallel=1`:** every e2e project packs the SAME
  `dist/.../angular-typechecker-<ver>.tgz` in `beforeAll` and `rmSync`s it in `afterAll`; the CI
  `e2e` job MUST stay `nx run-many -t e2e --parallel=1` or a sibling's teardown ENOENTs a live
  install. GUARD-01/01b/01c enforce it. A 4th e2e project inherits this contract
  ([[e2e-projects-share-one-tarball-serialize]]).
- **`*.e2e.spec.ts` = `execSync` real toolchain, node env, fully serialized** (`singleFork`,
  `fileParallelism:false`); long timeouts (180000-300000ms). The Angular CLI e2e shells `ng` /
  `npm`|`pnpm`|`yarn` the way the Nx e2e shells `nx`.
- **Content tripwires police docs on every PR:** `scoped-name-guard` (no stray scoped ref) +
  the `storybook-docs`-style spec pattern -- an `## Angular CLI` doc claim can be similarly
  locked if a tripwire is warranted (planner discretion).
- **Diagnostic codes asserted via the negative-encoding helper `NG = (code) => -990000 - code`;
  raw TS codes (e.g. `2322`) asserted directly** -- the planted-error e2e assertions follow this.

### Integration Points
- NEW: one e2e project under `e2e/` (Angular CLI scaffolded workspace + `.e2e.spec.ts` +
  `vitest.config.mts` + `project.json` with `e2e` + `typecheck-e2e` targets); optionally one
  ACV-03 gap-fill spec (builder over `BuilderContext`); optionally one RF-02 barrel snapshot spec.
- MODIFIED: `packages/angular-typechecker/README.md` (+`## Angular CLI`), `CHANGELOG.md` (curated
  entry, prose only). The engine, core, executor, builder, schematics, generators, and public
  barrel are UNTOUCHED (exercised + audited, not changed).

</code_context>

<specifics>
## Specific Ideas

- The real substrate is TWO on-stack Ng22 clones, ORDERED: `bluehalo/ngx-leaflet` (app + lib,
  MIT, non-Nx -- the SAME clone Phase 21's GATE A' used) FIRST, then
  `realworld-angular/realworld-angular` (exact-stack Ng22.0/TS6.0.3, MIT, non-Nx,
  `@angular/build:application`) AFTER it (user-directed 2026-07-11). ACV-01 is the milestone
  FINAL tarball gate on both; run locally/manually (uncommitted), reproduced from URL + SHA.
  Off-stack Ng21 stays dropped.
- ACV-02's scaffolded workspace is the CI-authoritative real-repo proof (no external clone);
  ACV-01 is the human-run confidence gate on top. The three tiers (in-repo Vitest CI-authoritative
  + scaffolded automated e2e + real-clone manual) all coexist -- the user's 2026-07-10 override
  ADDED the real clone, it did not replace the scaffolded tier.
- Phase 24 ships tests + prose, not engine/generator surface -- the additive-only charter is
  satisfied by construction for the phase's own changes, and the audit confirms Phases 21-23
  stayed additive.
- Off-stack Angular 21 e2e is dropped; the consumer `--legacy-peer-deps` README note stays (it
  is guidance for Angular-<22 consumers hitting the peer cap, not a test tier).

</specifics>

<deferred>
## Deferred Ideas

None new -- discussion stayed within phase scope. Already-tracked deferrals live in
`REQUIREMENTS.md` (WALK-FUT-01 `createNodesV2` Nx auto-provisioning; wider off-stack Angular
support; JSON/SARIF reporters; `NgtscProgram` incremental; standalone CLI). This is the FINAL
phase of v0.2.1 -- after it verifies + audits + documents, the milestone is ready for close +
the human-gated Release-PR.

</deferred>

---

*Phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs*
*Context gathered: 2026-07-11*
