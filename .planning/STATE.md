---
gsd_state_version: 1.0
milestone: v0.2.1
milestone_name: Angular CLI workspace support
status: verifying
last_updated: "2026-07-11T09:37:33.021Z"
last_activity: 2026-07-11
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10 -- v0.2.1 milestone started: Angular CLI workspace support)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 24 — Real-OSS + scaffolded e2e, additive-only audit, docs

## Current Position

Phase: 24 (Real-OSS + scaffolded e2e, additive-only audit, docs) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-07-11

## Accumulated Context

### Decisions

v0.2.0 decisions are logged in PROJECT.md Key Decisions and detailed in the board CONSENSUS.md.
Headline: this milestone is ONE input-set-membership boundary correctness fix (not Storybook-specific
code); Layout A + Layout B both minimum; never-false-pass enforced via a split suppression counter;
external-template coverage G1-gated with a no-ngtsc-internals rule; a hard GO/NO-GO Phase-16 spike.

**Phase 16 GATE RESOLVED 2026-07-05 = GO** (spikes 006-008, all VALIDATED; records in
`.planning/spikes/` + the `spike-findings-angular-typechecker` skill; blueprint in that skill's
`references/storybook-input-set-boundary.md`): G2 = YES (widened cross-project include ->
`readConfiguration().rootNames`; key `inputTs` on the declared set, NOT
`program.getRootFileNames()` which adds `.ngtypecheck.ts` shims); G3 = YES (forced
`@storybook/angular@10.4.6` via `--legacy-peer-deps` compiles; its 48 TS6 `.d.ts` errors are
node_modules-suppressed -- D4 confirmed); G4 = YES positively (NG8002 + NG8102 fire RED in-project);
G1 = html + G5 = PASS -> external-template branch **4a** (map `.html` -> owning rootName `.ts` via
public `relatedInformation`; default-keep the unmappable edge). Phase 17 ships Layout A + Layout B.

Prior milestone decisions (v0.0.1 + v0.0.3 + v0.1.0): PROJECT.md Key Decisions + the per-milestone
archives under `.planning/milestones/`.

- [Phase 18]: 18-01: added advisory CoreResult.notTypeCheckedDeclaredFiles (.mdx always; .tsx when jsx unset/None) rendered as one executor logger.warn; verdict stays green (evaluate-result unchanged, negative test locks it)
- [Phase 18]: 18-03: T11 integration proof of D-01 notTypeCheckedDeclaredFiles; fixed .mdx enumeration (ScriptKind.Deferred, was Unknown -> zero .mdx); verdict stays green with a JSX-free .tsx
- [Phase 18]: 18-04: packaged-tarball Storybook criterion-1 e2e (Verdaccio nx add) proves the SHIPPED artifact catches planted story errors on Layout A (TS2322) + Layout B (aggregated TS2345 + external-template NG8002); clean baselines exit 0, no ERR_REQUIRE_ESM/infra error. B-03 preserved by installing angular-typechecker BEFORE Storybook (nx add forwards no flags) so the override-free peer check runs against a Storybook-free tree; only @storybook/angular used --legacy-peer-deps. Known-local out-of-scope: nx-add-yarn ECONNREFUSED (corepack-yarn vs Verdaccio).
- [Phase 18]: 18-05: SB-07 docs -- README ## Storybook section (exact coverage claim + caveats), Limitations WR-01 fix (zero-input in-project leaf is coverage-incomplete, not advisory-skip), CoreResult comment gains notTypeCheckedDeclaredFiles, curated CHANGELOG 0.2.0 with green->red false-pass to true-fail callout; prose only, no release cut (D-05).
- [Phase 19]: 19-03: README ## Storybook Composition coverage claim rests on per-project typecheck + Nx ^typecheck fan-out (implicitDependencies), NOT Storybook's any-typed refs (19-02 finding); a content tripwire (storybook-docs.spec.ts) locks it
- [Phase 19]: 19-03: recorded Layout-C-beyond-guard and .mdx/.tsx-beyond-advisory as 'not warranted' (19-DECISIONS.md), closing phase-19 success criterion 1
- [Phase 20]: 20-01: added advisory CoreResult.bundlerQueryImports (deduped+sorted ?query TS2307 specifiers) via a pure detector over the POST-filter kept set at the single finalize seam (zero walk threading); verdict-neutral (evaluate-result untouched + D-05 tripwire); baseline leg fires+keeps the TS2307 / vite-client leg self-gates, proven by a hermetic real-compiler fixture. Signal 2 engine half only -- executor render (20-02) + README (20-03) remain; SB-09 not closed until phase verification.
- [Phase 20]: 20-02: executor half of Signal 2 (D-04) -- warnBundlerQueryImports renders CoreResult.bundlerQueryImports as ONE logger.warn (count + "types": ["vite/client"] fix + ADVISORY-not-suppressed + specifiers), the fifth advisory notice, fired after warnNotTypeChecked; self-gating on field presence (D-03), verdict untouched (evaluateResult never reads it), content-isolated to the consumer's own specifiers; both doc-comments bumped four->five
- [Phase 20]: README Vite caveat restructured to lead with the vite/client fix; both SB-09 signals folded into the curated 0.2.0 CHANGELOG (prose only, no release cut, package.json stays 0.1.1)
- [Phase 21]: 21-01: GATE A' = GO (spike 011, VALIDATED). The shipped CJS->ESM `await import()` bridge SURVIVES `convertNxExecutor` + a real `ng run <project>:typecheck` on-stack Angular 22 (app AND library) against the real `bluehalo/ngx-leaflet` clone @ 818e9ae -- no `ERR_REQUIRE_ESM` incl. the eager `retrieveProjectConfigurationsWithAngularProjects` prelude; planted TS2322 RED / clean control GREEN; on-stack install clean (no --legacy-peer-deps). Minimal builder = `convertNxExecutor(typecheckExecutor)` + `builders.json` + additive `builders` field landed; `gate-a-static` byte-guard extended to the builder entry. Builder `tsConfig` stays single-string (ENG-01 array widening is 21-02). Human GATE A' GO/NO-GO checkpoint = GO (authorized); Waves 2-3 proceed. NO-GO would NEVER have fallen back to a hand-written architect builder (D-04).
- [Phase 21]: 21-02: ENG-01 -- `tsConfig` widened to `string | string[]` at four additive seams (schema.d.ts, both schema.json `oneOf`, normalize-options `map(resolveOne)`, `CoreOptions.tsConfigPath`). Core `handleMultiTsConfig` runs each entry through the SAME single-tsConfig gather logic, UNIONs the raw per-entry diagnostics, and calls `finalize` EXACTLY ONCE over the COMBINED declared input set (`buildFinalizeFilter` combined `rootNamePaths`) -- the surviving-leaf tail of `handleSolutionWalk`, never per-entry `runTypecheck`+merge. Zero-rootNames entry -> `zero-root-names` `SkippedReference` (coverage-incomplete via `evaluateResult`), per-entry 500 / empty array -> infra throw (never a silent pass, T-21-05). Widened union is MUTABLE `string[]` not `readonly` (Array.isArray narrows a readonly union only in the true branch; mutable keeps the single-string body byte-unchanged). Single-string path + Nx executor path byte-unchanged; proven by a hermetic `fixtures/multi-tsconfig-array` real-compiler integration spec (both planted codes surface, `['x']`===`'x'`). nx build/test(259)/integration/lint green.
- [Phase 21]: 21-03: in-repo CI-authoritative builder guard suite (three specs, NO production code). (1) `schema-parity.spec.ts` locks the SANITIZED builder `schema.json` to `TypecheckExecutorOptions` via `satisfies` + `AssertAssignable` reverse-coverage probe (keys/required:['tsConfig']/additionalProperties:false/defaults + ENG-01 `tsConfig` oneOf string|array) AND asserts sanitized (no `cli`/`version`/`$id`) -- T-21-07. (2) `builder.spec.ts` thin-wrapper: source-regex proves `builder.ts` imports `convertNxExecutor` from `@nx/devkit` + the executor default from `../../executors/typecheck/executor` + default-exports exactly `convertNxExecutor(typecheckExecutor)`, forbidding an engine fork / hand-written architect builder (T-21-09 / D-04); runtime asserts the Architect Builder brand. (3) `nx-surface-regression.spec.ts` asserts package.json `executors` unchanged + `builders` additive + executors.json still declares the `typecheck` impl -> `executors ?? builders` still resolves the executor (T-21-08). DEVIATION (Rule 1): `convertNxExecutor` returns an Architect Builder OBJECT branded `Symbol.for('@angular-devkit/architect:builder')===true` + a `handler` function, NOT a bare function -- the plan's `typeof==='function'` runtime assertion was corrected to the stronger brand+handler check. nx test(274)/lint/format:check green. Phase 21 complete.
- [Phase 22]: 22-01: Angular CLI write-fork -- an early tree.exists(angular.json) branch in the shared configuration generator writes each per-project architect.typecheck = { builder: angular-typechecker:typecheck, options.tsConfig: [buildLeaf, specLeaf] } via @nx/devkit updateJson (updateProjectConfiguration cannot write angular.json, Pitfall 2), skipping the Nx init (D-04, no stray nx.json). New resolveTsConfigLeaves helper resolves RF-01 to Approach A (projectType-convention tsconfig.app.json/tsconfig.lib.json + tsconfig.spec.json, each tree.exists-probed; --tsConfig override to single-element array; empty result throws) -- NOT Approach B, because the default @angular/build:ng-packagr library builder carries no tsConfig in build.options. Collision by builder id read defensively from architect then targets, written canonically to architect; idempotent rewrite preserves user keys + options. Nx else-branch byte-unchanged (resolveTsConfig/resolveTsConfigOverride untouched; configuration.spec.ts green). Proven by a 10-case angular.json-seeded spec (nx test 284 green, typecheck green). Reachable now via nx g; the ng generate schematic surface + ACS-04 regression are 22-02.
- [Phase 22]: 22-02: additive ng generate surface -- NEW collection.json (configuration schematic only; init/ng-add are Phase 23) + convertNxGenerator(configurationGenerator) re-export + package.json schematics field + files entry + project.json build asset glob (Pitfall 4: dist ships collection.json). generators ?? schematics keeps the collection Nx-invisible (ACS-04), proven by nx-generators-surface-regression.spec.ts. Schema REUSED verbatim. Zero new production dependency. nx lint/build/test(288)/typecheck green.
- [Phase 23]: 23-01: init parity via an additive tree.exists('angular.json') early-return fork in the shipped initGenerator (mirrors the Phase-22 configuration fork) -- on an Angular CLI workspace it prints the shared NO_CACHING_NOTICE and returns BEFORE readNxJson/updateNxJson, seeding no caching + no stray nx.json (ACS-03, D-04); the Nx else-branch is byte-unchanged (existing init specs still pass). NO_CACHING_NOTICE is exported from init/generator.ts as the single source Plan 03's ng-add imports (D-06). Thin convertNxGenerator(initGenerator) re-export + collection.json init entry (D-05); generators.json still declares init so nx add angular-typechecker runs <pkg>:init resolvable via generators ?? schematics (nx add UNCHANGED, Pitfall 5). nx build/test(293)/lint/format:check green.
- [Phase 23]: 23-02: classified the converted builder's runtime peers -- @angular-devkit/architect (^0.2200.0) + rxjs (^7.8.0) as OPTIONAL peerDependencies (peerDependenciesMeta.optional:true); nx NOT declared (transitive via @nx/devkit, .nx/ dir accepted+documented as a code comment). ACP-01 lever = @nx/dependency-checks ignoredDependencies (hand-added; peerDependenciesMeta.optional does NOT exempt the obsolete check; checkVersionMismatches:false preserved, never eslint --fix). RF-01 = top-level ng-add.save:devDependencies so ng add installs a dev tool into devDependencies. Static package-manifest.spec.ts contract locks all three; nx lint/test(297)/build green + dist manifest carries the fields.
- [Phase 23]: 23-03: first-party ng-add (NGADD-01) -- composed ngAddGenerator enumerates getProjects(tree), filters projectType in {application,library} (skips e2e/other, Pitfall 3), and composes configurationGenerator(tree,{project,skipFormat:true}) per in-scope project so idempotency + collision-by-builder-id + leaf-array resolution are all inherited (re-implements nothing); optional --project scopes to one, default auto-wires ALL. RF-01 backstop: a defensive updateJson deps->devDeps move that returns VOID (no install callback -> no redundant npm install; never addDependenciesToPackageJson/GeneratorCallback). RF-02: guard on tree.exists('angular.json') AFTER the devDep ensure -- absent -> devDep-ensure + end-user guidance only, no wiring, no nx.json. D-06: NO_CACHING_NOTICE imported from init/generator (single source), printed exactly once after wiring (configurationGenerator logs nothing on the CLI branch). convertNxGenerator(ngAddGenerator) re-export + collection.json ng-add entry ONLY; generators.json untouched so nx add stays <pkg>:init (Pitfall 5) -- surface-regression asserts ng-add present in collection.json + absent from generators.json. TDD RED(0b28f25)->GREEN(9c3c17e); nx test(308)/build/lint/format:check green.
- [Phase 24]: 24-01: ACV-03 gap-fill -- builder.integration.spec.ts runs the convertNxExecutor builder over a real BuilderContext via @angular-devkit/architect TestingArchitectHost, asserting BuilderOutput.success (true on a clean leaf, false on a planted-error two-element tsConfig array) AND parity with the Nx executor { success }. DEVIATION (Rule 3): Assumption A1 holds ONLY with NX_DAEMON=false + NX_ISOLATE_PLUGINS=false set at spec module scope -- the ambient dev-repo Nx daemon/isolated plugin workers otherwise resolve the eager retrieveProjectConfigurationsWithAngularProjects prelude against the REAL root (ProjectConfigurationsError readJsonFile ENOENT); the forks pool isolates the env change. New fixtures/builder-context/ minimal angular.json workspace root (Pitfall F). Clean-run parity reuses clean-template-host. nx integration(107)/lint/format green.
- [Phase 24]: 24-01: ACP-02 enforced + audited -- src/index.drift.ts barrel tripwire (all five exports, 2 value + 3 type-only) wired into tsconfig.drift.json rides the typecheck drift tsc; fail-loud proven (rename a barrel export -> TS2724/TS2305). 24-ADDITIVE-AUDIT.md records the git-diff verdict vs angular-typechecker@0.2.0: barrel byte-unchanged; executor schema tsConfig string->oneOf[string,array] widen-only; generator schemas + executors.json/generators.json unchanged; builders.json/collection.json new files; guard cross-check map all green. Additive-only HOLDS, milestone stays 0.2.x (v0.3.0 NOT triggered). nx test(314)/typecheck green.
- [Phase 24]: 24-02: README ## Angular CLI section (ng add auto-wire-all, ng run parity, tsConfig-array targets, nx-transitive/no-caching, off-stack --legacy-peer-deps) + a docs content tripwire (angular-cli-docs.spec.ts) locking those claims; Storybook 'not supported' caveat preserved (deferred, not weakened). Corrected the stale Installation 'no Angular-CLI installer' line (Rule 1).
- [Phase 24]: 24-02: curated CHANGELOG 0.2.1 entry is PROSE ONLY -- no date/link-ref, no package.json bump (stays 0.2.0), no tag, no nx release; the cut is the human-gated Release-PR flow.
- [Phase 24]: 24-03: shipped angular-typechecker-ng-cli-e2e (ACV-02) -- the 4th e2e project proving `ng add` auto-wire-all + per-project `ng run <project>:typecheck` scoping (app TS2322 component + TS2345 spec vs library TS2554, distinct-per-leaf; clean baseline green; no ERR_REQUIRE_ESM) against a COMMITTED pinned Angular 22 app+lib fixture (RF-01 Option B: `ng new` + `ng g library`, frozen on-stack, committed package-lock.json + REGENERATE.md, no legacy-peer-deps). Satisfies the CURRENT 4-guard contract (e2e + typecheck targets + type:e2e tag; CONTEXT D-03's typecheck-e2e is STALE) with no ci.yml edit; verbatim install-e2e Verdaccio global-setup (127.0.0.1 SAFETY gate, publish-once). On-stack install clean (no --legacy-peer-deps); primary `ng add` path worked (no A2 fallback). Local run 94.6s.
- [Phase 24]: 24-03: ACV-01 = 24-ACV-01-UAT.md, a documented MANUAL/local real-clone milestone-final gate (D-02, clones uncommitted): ngx-leaflet @818e9ae (app+lib) then realworld-angular @9e3528f (app-only), each by URL+SHA with pack -> `ng add` -> plant -> `ng run` -> assert -> clean; on-stack Angular 22 ONLY (off-stack Ng21 dropped). ACV-02 is its CI-authoritative counterpart. Phase 24 changed NO production surface -- additive-only holds by construction.

### Roadmap Evolution

- v0.2.1 roadmap created 2026-07-10: 4 phases (21-24), numbering continued from v0.2.0's Phase 20. All 16 v0.2.1 requirements (ENG/ACB/ACS/NGADD/COV/ACV/ACP/ACD) mapped to exactly one phase, 100% coverage, 0 unmapped. Structure follows the research build-order (`.planning/research/v0.2.1-angular-cli/SUMMARY.md`, CORRECTION & LOCKED DECISIONS): Phase 21 carries the GATE A' GO/NO-GO spike (ACB-02 -- the CJS->ESM `await import()` bridge surviving `convertNxExecutor` + a real `ng run`, on-stack Ng22 + off-stack Ng21) and gates the milestone; Phase 22 carries the highest design weight (the `angular.json` write-fork, Option A `tsConfig: [buildLeaf, specLeaf]`); Phase 23 is `ng-add` auto-wire-all + `init` parity + optional-peer classification; Phase 24 is the real-OSS + scaffolded e2e, the additive-only audit, and docs. ADDITIVE-ONLY charter: re-versions to v0.3.0 only if a breaking change proves unavoidable.
- Phase 20 added 2026-07-07: Vite/Analog Storybook query-import guidance (SB-09). Follow-up surfaced by the Phase-19 OSS real-repo UAT (`19-UAT.md`) and validated by spikes 009-010. BOTH signals in scope for v0.2.0 (user-committed 2026-07-07): the `vite/client` README recipe (docs) AND the `?query` detection advisory (engine + executor). Reopens v0.2.0 beyond its passed milestone audit.

### Blockers/Concerns

- **v0.2.0 GATE -- RESOLVED 2026-07-05 = GO (was: Layout B rested on unverified official-stack
  empirics).** Phase 16 spikes 006-008 confirmed G2/G3/G4 all YES and selected external-template
  branch 4a (G1 = html + G5 = PASS). Layout B IS supportable; no fallback to Layout-A-only. See the
  Decisions section above and `.planning/spikes/`.

- **v0.2.0 external constraint:** `@storybook/angular@10.4.6` peer-caps Angular at `<22.0.0` / TS at
  `^4.9||^5`, so installing Storybook on Angular 22 needs `--legacy-peer-deps`/`--force`. Documented,
  never gated (D4). `nx add`/pnpm can hit `ERR_PNPM_IGNORED_BUILDS` (see [[nx-add-fails-on-pnpm-workspaces]]).

- **CARRIED FORWARD (dev-repo only):** `.npmrc legacy-peer-deps=true` is required in this dev repo
  because `@nx/angular@23.0.1` caps Angular tooling peers at `< 22.0.0` while the locked stack is
  Angular 22. It does NOT reach consumers. Revisit when a stable `@nx/angular` admits Angular 22.

- **PROCESS DEBT (not a code blocker):** the `audit-open` quick-task scanner bug (bare `<dir>/SUMMARY.md`
  vs `<id>-SUMMARY.md`) recurred at v0.0.3 and v0.1.0 closes; and "close requirement statuses at phase
  verification" has recurred. Both want a mechanical gate before the next milestone close.

### Pending Todos

None.

### Quick Tasks Completed

v0.1.1 and its post-release quick tasks are recorded in the git history and the prior STATE.md archive
(260703-lp0 / 260703-p2x / 260703-u74 / 260703-wcg / 260704-mse / 260704-wnq / 260705-1wo). v0.1.1
(packaging hotfix -- `packageRoot` so the tarball ships built `.js`) is published; prior versions
(0.0.1-0.1.0) are deprecated. See [[angular-typechecker-npm-releases-ship-source]].

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260710-0ch | Audit, triage, then address Dependabot security alerts | 2026-07-10 | 0fe82a8 | Verified | [260710-0ch-audit-triage-then-address-dependabot-sec](./quick/260710-0ch-audit-triage-then-address-dependabot-sec/) |
| 260710-b9t | Dogfood angular-typechecker: unified typecheck/test/integration/e2e verbs covering every non-broken file (PR #33) | 2026-07-10 | 1c68811 | Verified | [260710-b9t-dogfood-angular-typechecker-add-typechec](./quick/260710-b9t-dogfood-angular-typechecker-add-typechec/) |

## Deferred Items

Tracked as Future Requirements (out of scope, not debt):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Storybook (v0.2.0 stretch) | SB-08: Layout C beyond the guard; `.mdx`/`.tsx` type-check; opt-in strict mode failing on `suppressedInGraph>0` | Deferred (stretch; deferrable Phase 19) | v0.2.0 requirements definition |
| FsTree testing | FSTREE-01: bespoke real-disk `createFsTree`/`flushFsTreeChanges` helpers | Deferred (board Option A) | v0.0.4 requirements definition |
| Generator surface | GEN-FUT-01 (Angular CLI `angular.json`) / GEN-FUT-02 (`ng add` Angular CLI schematic) | Deferred (later milestone) | v0.0.4 requirements definition |
| Engine / performance | WALK-FUT-01 (`createNodesV2` per-leaf targets) / WALK-FUT-02 (`NgtscProgram` incremental) | Deferred (additive) | v0.0.4 re-scope |
| Resilience | REP-RES-02b: faithful per-file template recovery after a TCB Fatal | Deferred (needs `NgtscProgram`) | v0.0.3 RES-02 reframe |
| Observability | OBS-01: `totalFilesCount` on `CoreResult` | Deferred pending charter-fit | v0.0.3 requirements definition |
| Surfaces | Standalone CLI (owns literal OS exit code `2`) | Deferred | v0.0.3 (COR-04) |
| Reporters | Machine-readable JSON/SARIF | Deferred | v0.0.1 close |
| Feature families | INF / SUR / REP / SUP carried from v0.0.1 | Deferred | v0.0.1 close |

## Session Continuity

Last session: 2026-07-11T09:37:33.012Z
9/9 cross-phase integration, 4/4 E2E flows) then `/gsd-complete-milestone v0.2.0`: archived
ROADMAP/REQUIREMENTS/audit to `.planning/milestones/v0.2.0-*`, collapsed ROADMAP to a SHIPPED
one-liner, evolved PROJECT.md (v0.2.0 Active -> Validated), updated MILESTONES/RETROSPECTIVE, removed
REQUIREMENTS.md, added the 7 bare quick-task `SUMMARY.md` markers (audit-open workaround, 3rd close).
Milestone-close committed on `release/0.2.0`; then RELEASED via the AGENTS.md Release-PR flow:
PR #29 (`release/0.2.0`, carrying the version cut + curated end-user-facing CHANGELOG) merged into
`main`; the `angular-typechecker@0.2.0` tag was created on the release merge commit and pushed
(fired `release.yml` -> OIDC publish through the human-approved `npm-publish` environment); and the
GitHub Release was cut from the curated CHANGELOG section. `angular-typechecker@0.2.0` is live on npm
(dist-tag `latest`, published 2026-07-07T22:25:11Z, SLSA v1 provenance);
`packages/angular-typechecker/package.json` is at `0.2.0`.
Next step: start the next milestone with `/gsd-new-milestone`. OSS reference clones under
D:/projects/github/ (radix-ng/primitives et al.) are not committed.

## Operator Next Steps

- Plan Phase 21 with /gsd-plan-phase 21 (Angular CLI builder + engine multi-tsConfig + GATE A' GO/NO-GO spike)
