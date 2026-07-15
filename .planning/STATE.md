---
gsd_state_version: 1.0
milestone: v0.2.1
milestone_name: Angular CLI workspace support
status: executing
last_updated: "2026-07-15T10:39:24.000Z"
last_activity: 2026-07-15 -- quick task 260715-ig5 COMPLETE: re-ran the ACV-01 manual real-clone tarball gate against post-24-06 HEAD (closing the pre-release human item from the Phase-24 re-verification). BOTH gates PASS on the nx-free vanilla ng-add: gate #1 ngx-leaflet@818e9ae (npm, app+lib) first-run ng add auto-wire-all + clean per-project scoping; gate #2 realworld-angular@9e3528f (pnpm-workspace + name-collision) wired the FULL [tsconfig.app.json, tsconfig.spec.json] array (build leaf not dropped) via the documented pnpm-native install + ng g; both clean GREEN / planted RED / no ERR_REQUIRE_ESM. Freshly packed tarball's ng-add schematic.js confirmed nx-free. Clones are uncommitted scratch, restored pristine. No product/version change (0.2.0). [Prior: Phase 24 execute-phase CLOSE-OUT -- four post-execution gates re-run via dedicated agents covering 24-06; verify 6/6, secure SECURED 0-open, validate nyquist_compliant; learnings refreshed + re-bridged; post-merge gate GREEN 373 tests]
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 14
  completed_plans: 13
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10 -- v0.2.1 milestone started: Angular CLI workspace support)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 24 — real-oss-scaffolded-e2e-additive-only-audit-docs

## Current Position

Phase: 24 (real-oss-scaffolded-e2e-additive-only-audit-docs) — COMPLETE (6/6 plans; post-execution gates refreshed to cover 24-06)
Plan: 6 of 6 (24-06 gap-closure complete)
Status: Phase 24 execute-phase workflow + all global-CLAUDE.md post-execute steps complete (verify/secure/validate/extract-learnings + global-learnings bridge). ONE human item outstanding (pre-release ACV-01 real-clone re-run -- see Operator Next Steps)
Last activity: 2026-07-15 -- Quick task 260715-jho: added the yarn-4 `ng generate angular-typechecker:configuration` e2e arbiter cell; empirically DISPROVED the chalk.blue crash on the `ng generate` path (cell ran + passed under real yarn 4), so configuration/init stay convertNx (vanilla refactor correctly skipped, YAGNI); resolved the v0.2.1 milestone-audit tech_debt as verified-safe (ACS-01/ACS-03 caveats lifted). No product/version change (0.2.0)

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
- [Phase 24]: 24-05 (gap closure): finalized the CI-authoritative CLI e2e coverage on the 24-04 fix. YARN spec (flat + workspace): stripped debug scaffolding, installs via the REAL `ng add angular-typechecker` (nx now transitive via 24-04), asserts `ng add` did NOT wire under yarn, then wires via `ng g angular-typechecker:ng-add`. KEY FINDING (three e2e runs): yarn's `ng add` INSTALLS but does NOT auto-wire -- Angular CLI's post-install ng-add detection (`createSchematic('ng-add')`) silently fails on yarn's node-modules layout; npm + pnpm both run the same schematic on the identical package (NOT an angular-typechecker defect, NOT collection-resolution). Coordinator-approved Option A1: keep real `ng add` install + `ng g` wire (the plan's own authorized `ng add`-misbehaves->`ng g` fallback); Task-1 acceptance grep `ng g...` becomes 1 (approved deviation), other 3 scaffolding tokens 0, `enableMirror:false` retained. NEW pnpm spec: committed ACV-01 gate #2 (CLI x pnpm-workspace root-name-collision) -- `ng add` wires the app target with the FULL `[tsconfig.app.json, tsconfig.spec.json]` array (build leaf never dropped) + per-project scoping. pnpm build-gate satisfied via `strictDepBuilds: false` (skip ALL build scripts) NOT the planned `allowBuilds:{nx:true}` (the full Angular fixture flags 5-6 native build-script deps, not just nx); this changes threat T-24-10 to "no dependency build scripts run at all" (MORE restrictive, mirrors npm's skip-and-succeed). All 4 specs green (npm+yarnx2+pnpm); coverage guard green (349). Debug doc `cli-yarn-e2e-wrong-version.md` resolved.
- [Phase 24]: 24-04 (gap closure): ACP-02 root-cause product fix -- declared `nx` as a DIRECT `^23.0.0` dependency in the plugin manifest (NOT a peer). `@nx/devkit`'s entrypoint `require()`s `nx/src/devkit-exports` at load and yarn does not auto-install peers (npm/pnpm do), so a yarn Angular CLI consumer crashed on `ng add`/`ng run` with `Cannot find module 'nx/src/devkit-exports'`; declaring `nx` directly fixes it for every PM. Range `^23.0.0` is a strict subset of `@nx/devkit@23.0.1`'s `nx` peer -> no double-constraint, cannot pull nx 22/24. Inverted BOTH `package-manifest.spec.ts` nx-absent guards (now assert `dependencies.nx === '^23.0.0'`, still not a peer) + restated header comment/it-titles; added `'nx'` to `@nx/dependency-checks` `ignoredDependencies` (unimported runtime-transitive dep) so `nx lint` stays green at maxWarnings:0. Flipped the identical operative Dependencies constraint in PROJECT.md + CLAUDE.md and date-annotated (not rewrote) the CLAUDE.md STACK-research rows + the "What NOT to Use" nx row with `[v0.2.1 CORRECTION (2026-07-12): ...]`; AGENTS.md byte-unchanged. nx test(349)/lint/build green; dist manifest carries `nx: ^23.0.0`.

- [Phase 24]: 24-06 (gap closure): NGADD-01 yarn first-run auto-wire (Option C, spike-CONFIRMED). Made the ng-add schematic a VANILLA @angular-devkit/schematics Rule -- Rule/Tree/SchematicContext type-only imports (erased at compile), so the compiled schematic.js requires ONLY the pure first-party core (ZERO @nx/devkit). The Angular CLI post-install createSchematic('ng-add') probe no longer loads nx's ora/log-symbols/chalk chain (the `chalk.blue is not a function` throw under yarn 4's last-in-wins hoist), so `ng add angular-typechecker` AUTO-WIRES every application + library project on the FIRST run under yarn 4 (npm+pnpm already worked). Reading angular.json directly is also collision-immune (ACV-01). EXTRACTED (not duplicated) the leaf-array resolution + targetName default/empty-guard + collision-by-builder + [build,spec] idempotent merge into src/core/angular-cli-wiring.ts -- pure (node:path posix.join replaces devkit joinPathFragments; an injected exists() callback replaces tree.exists; every error string byte-preserved), enforced framework-agnostic by the D-11 core/** lint boundary. BOTH the vanilla ng-add AND the Nx configuration generator import it; the Nx configuration observable behavior is byte-identical (configuration.spec + configuration-angular-cli.spec + configuration-matrix.spec + schema-parity.spec + all init specs green). Deleted the dead generators/ng-add/generator.ts (schema.json/schema.d.ts kept; collection.json byte-unchanged; ng-add still absent from generators.json). Flipped the CI-authoritative yarn CLI e2e to assert first-run `ng add` auto-wire (dropped the `ng g` fallback + the no-wire quirk-lock; enableMirror:false retained); retired the README yarn-caveat todo (product-fixed -> pending/->done/, README needs no edit). Additive-only vs 0.2.0 holds (unreleased-surface implementation change). Deviations (Rule 3): the migrated ng-add spec invokes the synchronous Rule directly with a runner.logger-backed context (SchematicTestRunner.callRule builds a NullLogger context and crashes on a passed parent logger, so it cannot capture context.logger notices); removed a non-null assertion (read angular.json once, null => absent) for maxWarnings:0. nx test(366)/build/lint/typecheck green; standalone nx e2e angular-typechecker-ng-cli-e2e green 4/4 (npm + yarn flat + yarn workspace first-run auto-wire + pnpm collision). KNOWN INFRA (not 24-06): `nx run-many -t e2e --parallel=1` fails only on ng-cli-e2e via an Nx local-registry task re-invocation ("already invoked by a parent Nx process in this chain"), Nx-flagged flaky; install(37)/matrix(7)/cache(9) pass under run-many and ng-cli-e2e passes standalone -- CI runs each e2e as a fresh per-job `npm ci` (not run-many), so the conflict does not occur in CI.

### Roadmap Evolution

- Phase 25 added 2026-07-15 (via /gsd-phase, current milestone v0.2.1): GitHub-backed self-hosted Nx remote cache -- a workspace-wide CI cache optimization deferred out of the e2e wall-clock quick task (quick-260715-050). Grounded by `260715-050-RESEARCH-3.md` (GitHub Actions Cache backend; CREEP-mitigated via the `pull_request` merge-ref scoping + a cache-miss-by-design release build; ~90-day retention TTL; read-write in CI, read-only from local). Lower priority: the e2e per-project split already banks the ~43% tier win cache-free, so this phase justifies itself on workspace-wide cross-run hits, not the e2e tier. Requires fixing the OS/Node hash landmine (`RUNNER_OS` + Node major as `env` named inputs) before any cache replay.
- v0.2.1 roadmap created 2026-07-10: 4 phases (21-24), numbering continued from v0.2.0's Phase 20. All 16 v0.2.1 requirements (ENG/ACB/ACS/NGADD/COV/ACV/ACP/ACD) mapped to exactly one phase, 100% coverage, 0 unmapped. Structure follows the research build-order (`.planning/research/v0.2.1-angular-cli/SUMMARY.md`, CORRECTION & LOCKED DECISIONS): Phase 21 carries the GATE A' GO/NO-GO spike (ACB-02 -- the CJS->ESM `await import()` bridge surviving `convertNxExecutor` + a real `ng run`, on-stack Ng22 + off-stack Ng21) and gates the milestone; Phase 22 carries the highest design weight (the `angular.json` write-fork, Option A `tsConfig: [buildLeaf, specLeaf]`); Phase 23 is `ng-add` auto-wire-all + `init` parity + optional-peer classification; Phase 24 is the real-OSS + scaffolded e2e, the additive-only audit, and docs. ADDITIVE-ONLY charter: re-versions to v0.3.0 only if a breaking change proves unavoidable.
- Phase 20 added 2026-07-07: Vite/Analog Storybook query-import guidance (SB-09). Follow-up surfaced by the Phase-19 OSS real-repo UAT (`19-UAT.md`) and validated by spikes 009-010. BOTH signals in scope for v0.2.0 (user-committed 2026-07-07): the `vite/client` README recipe (docs) AND the `?query` detection advisory (engine + executor). Reopens v0.2.0 beyond its passed milestone audit.

### Blockers/Concerns

- **e2e-CI dist-build regression -- RESOLVED 2026-07-14 (quick task 260714-sl6, commit bd2d243).** Was: a
  RELEASE-PR blocker -- `nx run-many -t e2e --parallel=2` failed in CI with `install-e2e`/`matrix-e2e`/`ng-cli-e2e`
  ENOENT on `dist/packages/angular-typechecker/package.json` because the build never ran before the specs.
  ROOT CAUSE (proven): the `e2e` targetDefault `dependsOn: ["angular-typechecker:build"]` in nx.json was
  INERT -- nx 23.1's targetDefaults precedence returns the EXECUTOR-keyed default (`@nx/vitest:test`, which
  all 4 e2e targets use) and short-circuits before reading the NAME-keyed `e2e` default, so it was discarded
  (masked locally by a pre-existing dist/ + --skip-nx-cache; surfaced only on the nub probe PR since
  feature-branch pushes don't trigger CI). FIX: deleted the inert nx.json `e2e` targetDefault + added
  `dependsOn: [{ projects:["angular-typechecker"], target:"build" }]` to each e2e target's OWN project.json
  (bypasses the precedence trap; one shared build before the parallel tier -- preserves squ's intent; fixes
  CI AND local) + GUARD-01e (per-target dependsOn assertion, fail-loud) + a corrected ci.yml comment.
  VERIFIED IN REAL CI (throwaway draft PR #35, feature->main, 2026-07-14, closed after): the FULL e2e tier
  PASSES on a fresh GitHub runner -- `e2e` GREEN 10m20s INCLUDING ng-cli-e2e (its first-ever real-CI run;
  act could not run it due to the act image's Node 24.14.1 < Angular CLI 24.15.0, but real CI setup-node@24
  is compliant), plus the 6-cell test matrix + act-compat + scoped-name-guard + CodeQL all green. The
  dist-build regression is fully resolved. The 260714-nub actions/cache work is now UNPARKED (e2e tier is
  CI-green) -- resume when desired.

- **`fallow` + `format-lint` CI blockers -- RESOLVED 2026-07-14 (quick task 260714-wr9, commit 3cfa12d).**
  Was: two Release-PR blockers surfaced by the 260714-sl6 dress-rehearsal PR #35 (pre-existing, accumulated
  across the milestone; latent because feature-branch pushes don't trigger CI + local checks were
  scoped/dismissed). FIX (config + one Prettier pass; NO product-logic change; NO version mutation):
  - **format-lint:** `.prettierignore`'d the whole `ng-cli-workspace` e2e fixture dir (committed `ng new`
    output, regenerated via REGENERATE.md -- preserve fidelity, not Prettier-owned) + `nx format:write` on the
    one real source `angular-cli-wiring.spec.ts` (whitespace only).
  - **fallow:** all config, per the existing .fallowrc precedent + CLAUDE.md's fallow note -- `entry` +5 for
    the config-only-reachable false positives (ng-cli global-setup.ts, index.drift.ts, both schematic re-exports,
    the aggregate-install-timings.mjs CLI tool); `ignoreDependencies` +2 (@angular-devkit/core + /schematics,
    Angular-CLI-provided type imports); `rules.test-only-dependencies:"off"` (@angular-devkit/architect stays
    the intentional optional peer, NOT moved to devDeps); `duplicates.ignore` for both clone groups (the
    verbatim-sibling global-setups + the run-typecheck/walk-references block); `health.ignore` +globs for the
    reviewed essential-complexity functions (same treatment as the existing walk-references.ts entry).
  VERIFIED locally with the EXACT CI commands (deterministic local==CI, unlike e2e): `nx format:check --base
  origin/main` GREEN (0 files) + `npx fallow audit --base origin/main` verdict PASS ("No issues in 334 changed
  files", exit 0) + nx test angular-typechecker (372, guards green) + nx lint (maxWarnings:0). The only source
  change is whitespace in angular-cli-wiring.spec.ts; the ng-cli-workspace fixture has zero diff.
  RECOMMENDED before the Release-PR: one final full-suite dress-rehearsal throwaway PR to confirm ALL jobs
  (e2e + fallow + format-lint + test matrix) are green together on a fresh runner.

- **RELEASE-FACING yarn `ng add` caveat -- RESOLVED 2026-07-12 (Plan 24-06).** The former concern
  (README `## Angular CLI` "auto-wire-all" was inaccurate for yarn because `ng add` installed but wired
  nothing) is fixed IN THE PRODUCT: 24-06's nx-free vanilla ng-add schematic makes `ng add
  angular-typechecker` auto-wire every application + library project on the FIRST run under yarn 4 too
  (no `@nx/devkit`/nx load -> no `chalk.blue` throw in the CLI's post-install probe). The README claim is
  now accurate for npm + pnpm + yarn (no edit needed), proven by the flipped CI-authoritative yarn CLI
  e2e (first-run auto-wire, flat + workspace). The todo moved to `.planning/todos/done/`.

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
| 260712-ft9 | Vanilla (Nx-free) Angular CLI schematic ng-add repro -- discriminated the yarn ng-add no-autowire as NX-SPECIFIC (not a general Angular CLI bug); upstream issue NOT warranted | 2026-07-12 | b513ac9 | Verified | [260712-ft9-create-vanilla-angular-cli-schematic-min](./quick/260712-ft9-create-vanilla-angular-cli-schematic-min/) |
| 260712-n7z | Resolve e2e local-registry flakiness under `nx run-many -t e2e --parallel=1` (CI e2e gate, ci.yml:204) -- Option A: clear inherited NX_INVOCATION_ROOT_PID before startLocalRegistry in both registry-starting e2e globalSetups so each forked `nx run <root>:local-registry` keys the invocation tracker on its own pid | 2026-07-12 | a17ee57 | Verified | [260712-n7z-before-phase-completion-research-on-the-](./quick/260712-n7z-before-phase-completion-research-on-the-/) |
| 260712-squ | Run the e2e tier at `nx run-many -t e2e --parallel=2` (from --parallel=1): build plugin once upstream (`e2e dependsOn angular-typechecker:build`, drop 4 in-spec builds), per-spec `--pack-destination` tarball isolation (6 specs), single 4873 registry with install-e2e + cache-e2e `parallelism:false` (corrected Fallback A -- the planned 2nd registry was reverted because yarn 4 keys its global metadata cache by host not host:port, so a 2nd registry port breaks CI); GUARD-01b rewritten to 5 fail-loud invariants | 2026-07-13 | 6db144d | Verified | [260712-squ-enable-e2e-parallel-2-or-3-de-dup-build-](./quick/260712-squ-enable-e2e-parallel-2-or-3-de-dup-build-/) |
| 260713-w87 | Measure e2e-install time across the npm/pnpm/yarn matrix (opt-in `sh()` JSONL timing behind ATC_TIME_INSTALLS + committed `tools/e2e-timing` aggregator) + optimization findings report. Headline (Windows dev box, directional): npm ~594s/26 calls, yarn ~209s/11, pnpm ~85s/9; ~2.1x cold/warm delta. Top follow-up lever = persist the Verdaccio uplink cache (clearStorage wipes the proxied npmjs cache every run); honest irreducible-bytes ceiling. MEASURE+REPORT only -- NO optimization applied, no version mutation | 2026-07-14 | 1b88529 | Verified | [260713-w87-measure-e2e-install-time-across-the-matr](./quick/260713-w87-measure-e2e-install-time-across-the-matr/) |
| 260714-1gr | Apply Lever 1 (persist Verdaccio uplink cache) + re-measure. Flipped `clearStorage:false` in both registry global-setups + shared `resetVerdaccioPublishState` helper (deletes ONLY storage/angular-typechecker + .htpasswd each run -> fresh token mint + no EPUBLISHCONFLICT, npmjs proxy cache persists). Honest finding: same-session cold-vs-warm delta ~null (clearStorage:false makes each run warm-within-itself -- win banked in-run); structural win vs w87 baseline = flagship ng-cli `corepack yarn install` 93.4s->53.5s->44.7s (~-52%). actions/cache DEFERRED (documented turnkey follow-up; the bigger cross-run win). Test-harness only, no version mutation | 2026-07-14 | 302f93c | Verified | [260714-1gr-apply-lever-1-persist-verdaccio-uplink-c](./quick/260714-1gr-apply-lever-1-persist-verdaccio-uplink-c/) |
| 260714-fd4 | Research Docker-based e2e wall-clock optimization (pre-built image w/ pinned Nx/Angular CLI workspace) -- RESEARCH-ONLY, NO-GO. Fixtures are already committed (cpSync, zero runtime scaffold) so Docker would only save the install; a pre-baked node_modules trades extract for cpSync (a wash) AND breaks fidelity (yarn ng-add layout, pnpm-workspace .pnpm store, Storybook install-order/--legacy-peer-deps, B-03 peer-honesty ERESOLVE). actions/cache wins for CI (same fetch win, no packages: OIDC-scope regression, no 10GB ceiling); Lever 1 already banks the local win. Docker-locally low-value on Dev-Drive/ReFS + arm64!=CI-amd64. Nothing applied | 2026-07-14 | (research-only) | NO-GO | [260714-fd4-research-and-apply-docker-based-e2e-wall](./quick/260714-fd4-research-and-apply-docker-based-e2e-wall/) |
| 260714-gja | Apply fidelity-safe LOCAL e2e install perf flags + measure. Appended `--no-audit --no-fund --prefer-offline` to the 11 direct npm-install sites + `--prefer-offline` to the 2 provisioning pnpm installs (nx add/ng add/yarn/pnpm-symlink/--legacy-peer-deps all untouched -> B-03 peer-honesty intact). REAL npm win (not within-noise): flagged npm rows -42.5% while flag-free nx-add/ng-add/yarn control rose ~+14% (clean drift-robust separation); Storybook install -72%, provision npm -44.6%; pnpm within-noise (no audit to skip). Driver = --no-audit skipping the audit round-trip via the Verdaccio uplink (helps CI too). e2e 4/4 green, no flake. Measure-only (Windows Defender temp-path exclusion; matrix file-parallelism; pnpm-symlink --prefer-offline) + rejected (local cache pin, pnpm-swap, yarn flags, ng-cli/install intra-project parallelism) documented. Test-harness only, no version mutation | 2026-07-14 | 6828d35 | Verified | [260714-gja-research-other-local-e2e-wall-clock-time](./quick/260714-gja-research-other-local-e2e-wall-clock-time/) |
| 260714-nub | Add CI actions/cache (Verdaccio uplink storage) + measure via throwaway PR + apply if faster. Cache step AUTHORED (SHA-pinned actions/cache restore+save@v6.1.0, path tmp/local-registry/storage excl angular-typechecker/.htpasswd, keyed on manifests+ci.yml; additive over setup-node cache:npm -- warms the Verdaccio<->npmjs hop yarn/pnpm never get) + CODE-REVIEWED (APPROVE, 0 blockers). Measurement BLOCKED + cache NOT applied: throwaway probe PR #34 (base=feature) surfaced a Release-PR-blocking e2e-CI regression (fixed in 260714-sl6). PR closed + scratch branch deleted; cache YAML parked in RESEARCH.md, UNPARKED now that e2e is CI-green -- resume when desired. No version mutation | 2026-07-14 | (blocked -- not applied) | Blocked | [260714-nub-add-the-ci-actions-cache-optimization-fo](./quick/260714-nub-add-the-ci-actions-cache-optimization-fo/) |
| 260714-sl6 | FIX the e2e-CI regression nub surfaced. Root cause: the nx.json `e2e` targetDefault `dependsOn:[angular-typechecker:build]` was INERT -- nx 23.1 targetDefaults precedence returns the EXECUTOR-keyed default (`@nx/vitest:test`, used by all 4 e2e targets) and short-circuits before the NAME-keyed `e2e` default, discarding it (so dist was never built before the e2e tier on a fresh runner -> ENOENT; masked locally by pre-existing dist + --skip-nx-cache). FIX: deleted the inert nx.json e2e targetDefault + added object-form `dependsOn:[{projects:[angular-typechecker],target:build}]` to each of the 4 e2e project.json (bypasses the precedence trap; one shared build before the parallel tier; fixes CI AND local) + GUARD-01e (per-target dependsOn assertion) + corrected ci.yml comment (comment-only). Verified: task graph schedules the build; act fresh-container run GREEN for install(37)/matrix(7)/cache(9). ng-cli's act failure = act container Node 24.14.1 < Angular CLI 24.15.0 (act-only; real CI setup-node@24 compliant; passes locally). nx.json + 4 project.json + guard + ci.yml comment; no version mutation | 2026-07-14 | bd2d243 | Verified | [260714-sl6-fix-the-e2e-ci-regression-nx-run-many-t-](./quick/260714-sl6-fix-the-e2e-ci-regression-nx-run-many-t-/) |
| 260714-wr9 | Fix the fallow + format-lint CI blockers PR #35 surfaced (config + one Prettier pass; NO product-logic change). format-lint: `.prettierignore` the whole ng-cli-workspace `ng new` fixture (preserve fidelity) + `nx format:write` the one real source angular-cli-wiring.spec.ts (whitespace). fallow (all .fallowrc config per existing precedent): `entry` +5 (config-only-reachable false positives: ng-cli global-setup, index.drift.ts, 2 schematic re-exports, aggregate-install-timings.mjs CLI tool) + `ignoreDependencies` +2 (@angular-devkit/core,/schematics -- Angular-CLI-provided type imports) + `rules.test-only-dependencies:off` (@angular-devkit/architect stays optional peer) + `duplicates.ignore` (verbatim-sibling global-setups + run-typecheck/walk-references block) + `health.ignore` (reviewed essential-complexity fns, per walk-references.ts precedent). Verified locally w/ exact CI cmds: format:check GREEN + fallow audit PASS ("No issues in 334 files") + nx test(372)/lint green. No version mutation | 2026-07-15 | 3cfa12d | Verified | [260714-wr9-fix-fallow-and-format-lint-ci-checks-rel](./quick/260714-wr9-fix-fallow-and-format-lint-ci-checks-rel/) |
| 260715-050 | Optimize e2e-tier CI wall-clock. SHIPPED the SPLIT (Lever A): the single serialized `nx run-many -t e2e --parallel=2` job (620s) -> a per-project matrix -- a lean fs-read `discover` job (`tools/ci/list-e2e-projects.mjs` -> dynamic `fromJSON(needs.discover.outputs.projects)`, auto-covers new e2e projects) fans the 4 e2e projects across separate runners; per-cell build via the untouched `dependsOn:build`. MEASURED on real CI (throwaway PR #36): **620s -> ~366s (~41% faster)**; floor = ng-cli-e2e cell (~356s, serial ng-add installs). A cross-runner `dist`+`.nx/cache` build-artifact handoff proved a NO-OP (nx rejects a foreign `.nx/cache` as `unknown-local-cache`) -> dropped for the lean discover job. Lever B (per-cell Verdaccio uplink cache) implemented + measured miss/hit + DISCARDED (opposite-sign cells = within CI noise). GitHub-backed Nx remote cache researched (feasible + CREEP-mitigable) + DEFERRED to ROADMAP Phase 25. GUARD-01b rewritten (dynamic-matrix wiring + discovery-script consistency check); fallow `entry` for the discovery script. Release provenance already covered (install-e2e cell tests the shipped packageRoot on the Release-PR). No version mutation | 2026-07-15 | c7eabb4 | Verified | [260715-050-optimize-e2e-ci-wall-clock](./quick/260715-050-optimize-e2e-ci-wall-clock/) |
| 260715-ig5 | Re-run the ACV-01 manual real-clone tarball gate against post-24-06 HEAD (closes the Phase-24 re-verification pre-release human item). Rebuilt + packed the dist (packed `ng-add/schematic.js` confirmed nx-free -- the 24-06 delta in the shipped artifact). Gate #1 ngx-leaflet@818e9ae (npm, app+lib): a SINGLE `ng add <tarball>` auto-wired BOTH projects FIRST-RUN with 2-el tsConfig arrays + no nx.json; clean baseline both exit 0; clean bidirectional per-project scoping (app=TS2322+TS2345, lib=TS2554, no bleed); no ERR_REQUIRE_ESM. Gate #2 realworld-angular@9e3528f (pnpm-workspace + name-collision): `ng add <tarball>` blocked at pnpm install (ERR_PNPM_ADDING_TO_ROOT -- Angular-CLI/pnpm mechanics, not a defect) -> documented pnpm-native `pnpm add -w -D` + `ng g` (force-fresh, guarded the stale 2026-07-11 nx-based install); vanilla 24-06 ng-add wired the FULL [tsconfig.app.json, tsconfig.spec.json] array (build leaf NOT dropped under the collision) + no nx.json; clean baseline exit 0; planted TS2322(build leaf)+TS2345(spec leaf) both surfaced, exit 1; no ERR_REQUIRE_ESM. Both clones uncommitted scratch, restored pristine. No product/test/version change (0.2.0) | 2026-07-15 | 895ee43 | Verified | [260715-ig5-re-run-the-acv-01-manual-real-clone-tarb](./quick/260715-ig5-re-run-the-acv-01-manual-real-clone-tarb/) |
| 260715-jho | Add a yarn-4 `ng generate angular-typechecker:configuration` e2e ARBITER cell to prove/disprove the `chalk.blue is not a function` crash on the SECONDARY single-project `ng generate` path (configuration/init are still `convertNxGenerator`, so their `schematic.js` does `require('@nx/devkit')` -> nx's log-symbols@4/chalk chain -- the surface 24-06 eliminated from ng-add). Result: DISPROVED. The cell RAN (not skipped -- corepack yarn 4.17.0 provisioned) and PASSED under a real yarn 4 workspace: `corepack yarn add -D angular-typechecker` -> `ng generate ...:configuration ng-cli-workspace` wired the app target with `[tsconfig.app.json, tsconfig.spec.json]` + no stray nx.json, clean `ng run :typecheck` exit 0, planted TS2322+TS2345 both caught, no chalk.blue/ERR_REQUIRE_ESM. So the convertNx configuration schematic is SAFE on yarn 4 -- the RESEARCH HIGH-confidence crash prediction did NOT reproduce, validating the original 24-06 "configuration/init stay convertNx" decision. Task 2 (vanilla nx-free refactor) correctly SKIPPED per YAGNI -- zero product source changed. Resolved the v0.2.1-MILESTONE-AUDIT tech_debt (status tech_debt->passed, integration 8/8, flows 4/4, ACS-01/ACS-03 `*` unverified-caveats lifted to e2e-verified-safe). README already accurate (no change). `nx test` (373) / `nx lint` (maxWarnings:0) / `nx format:check` green. No version change (0.2.0) | 2026-07-15 | 08cb451 | Verified | [260715-jho-add-a-yarn-4-ng-generate-angular-typeche](./quick/260715-jho-add-a-yarn-4-ng-generate-angular-typeche/) |

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

Last session: 2026-07-15T10:39:24.000Z
Phase 24 execute-phase CLOSE-OUT. Confirmed all execute-phase workflow steps complete: 6/6 plans
committed with SUMMARY.md, ROADMAP all `[x]`, working tree clean, authoritative post-merge gate GREEN
(`nx run-many -t build test lint --projects=angular-typechecker --skip-nx-cache` => 39 files/373 tests,
lint maxWarnings:0, build ok; `nx format:check --base origin/main` exit 0). Then ran ALL global-CLAUDE.md
post-execute steps IN ORDER, each reached by its DEDICATED agent, because the prior gates (2026-07-12
10:xx) predated gap-closure plan 24-06 (SUMMARY 16:36) and were therefore stale:
- **verify** (gsd-verifier): 24-VERIFICATION.md refreshed -> passed 6/6 truths at code level. ONE
  `human_needed`: re-run the ACV-01 manual real-clone tarball gate against post-24-06 HEAD before the
  v0.2.1 release (LOW risk -- 24-06 rewrote the exact ng-add path ACV-01 exercises + the last manual UAT
  was 2026-07-11, one day before 24-06; the CI-authoritative ACV-02 e2e covers the identical `ng add`->
  `ng run` flow on the new code, green 4/4). See Operator Next Steps.
- **secure** (gsd-security-auditor): 24-SECURITY.md refreshed -> SECURED, threats_open 0 (15/15 closed;
  4 new 24-06 threats all closed), no code edited, public-repo hygiene clean.
- **validate** (gsd-nyquist-auditor): 24-VALIDATION.md refreshed -> nyquist_compliant, 0 gaps, 0 tests
  generated (24-06 shipped angular-cli-wiring.spec 18 + ng-add.spec 13; YAGNI, added nothing).
- **extract-learnings** (inline) + **global-learnings bridge** (features.global_learnings:true):
  24-LEARNINGS.md refreshed to 11 decisions / 12 lessons / 7 patterns / 7 surprises covering 24-06;
  bridged 37 items into the cross-project store (16 created, 21 deduped); temp .planning/LEARNINGS.md
  removed, never staged.
Committed the 4 refreshed gate artifacts + this STATE. NO product/test/version change (stays 0.2.0);
NO release cut (human-gated). HANDOFF.json / .continue-here.md are now superseded (24-06 executed + gated).

Prior session: 2026-07-12T14:33:14.385Z
(nx-free vanilla ng-add, Option C -- plan-checked PASSED, 0/3 tasks). Proceeding to
`/gsd-execute-phase 24 --gaps-only` on the main checkout (single-plan wave, no worktree). HANDOFF.json
retained until 24-06 execution completes.

Prior session: 2026-07-12 (autonomous). Executed the paused Phase-24 gap-closure Wave 2 (plan 24-05):
finalized the yarn + pnpm CLI e2e. Yarn spec installs via the REAL `ng add` (nx transitive via 24-04)
and wires via `ng g` -- Angular CLI's `ng add` does NOT run the ng-add schematic under yarn
(post-install detection fails on yarn's node-modules layout; npm + pnpm both wire). New committed
CLI x pnpm-workspace root-name-collision e2e proves the app build leaf is never dropped; pnpm build-gate
satisfied via `strictDepBuilds: false` (skip all build scripts, safer than allowBuilds). All 4
ng-cli-e2e specs green (npm + yarn x2 + pnpm) + coverage guard green (349). Debug doc
`cli-yarn-e2e-wrong-version.md` resolved (moved to debug/resolved/). Deferred (user decision before
release): README `## Angular CLI` "auto-wire-all" claim needs a yarn caveat
(.planning/todos/pending/readme-yarn-ng-add-caveat.md). `packages/angular-typechecker/package.json`
stays at `0.2.0` (v0.2.1 NOT yet cut).

Prior session: 2026-07-11 (autonomous). Resumed from HANDOFF.json to run the Phase-24 ACV-01
real-clone milestone gate. Gate #1 (bluehalo/ngx-leaflet @818e9ae, npm, app+lib) PASS. Gate #2
(realworld-angular @9e3528f, pnpm, app-only) initially FAILED -- surfaced a REAL defect in the
(unreleased) Angular CLI `configuration`/`ng-add` generator: on an Angular CLI workspace that is
ALSO a pnpm workspace with a name-colliding root package.json, `readProjectConfiguration` returns a
shadowing package stub, so the CLI write-fork silently dropped the app build leaf (root app ->
spec-only under-check) or threw (subdir app). FIXED (commit 1837b25): the CLI branch reads
projectType/root straight from angular.json. Regression tests hardened + proven non-vacuous
(49974f1) and covered at the ng-add entry point (cf90407); gate #2 re-verified PASS on the real
clone. Trigger verified NARROW (pnpm-workspace + name collision only; npm/yarn/lockfile/mismatch
unaffected; Nx branch robust). Additive-only vs 0.2.0 HOLDS (fix is inside the unreleased Angular
CLI generator). All four post-execution gates re-run via their DEDICATED agents: code-review
(24-REVIEW-ACV01FIX.md, 0 blockers; 1 major + 1 minor addressed), verify (24-VERIFICATION.md
passed, 5/5), secure (24-SECURITY.md SECURED, threats_open 0), validate (24-VALIDATION.md compliant,
+ng-add gap filled). Phase 24 complete; extract-learnings done (24-LEARNINGS.md) +
global-learnings bridged (18 entries); v0.2.1 MILESTONE AUDIT = PASSED (16/16 reqs, integrated,
0 gaps, all phases Nyquist-compliant). Follow-on (full-matrix coverage): added
configuration-matrix.spec.ts locking {CLI,Nx} x {flat,npm/yarn-workspaces,pnpm-workspace} x
{collision,clean} x {root,subdir} (invariant: build leaf never silently dropped, or loud throw),
then ran /gsd-code-review --fix on the added tests (gsd-code-reviewer 0 blockers/2 warnings/4 info
-> gsd-code-fixer applied WR-01/WR-02/IN-02/IN-04; 24-REVIEW-ADDED-TESTS(-FIX).md). nx
test(349)/lint/typecheck/build/format all green.
`packages/angular-typechecker/package.json` stays at `0.2.0` (v0.2.1 NOT yet cut). OSS clones under
D:/projects/github/{bluehalo/ngx-leaflet, realworld-angular/realworld-angular} are UNCOMMITTED scratch.

## Operator Next Steps

- **[RESOLVED 2026-07-15 -- quick task 260715-ig5]** The pre-release ACV-01 human item (re-run the manual
  real-clone tarball gate against post-24-06 HEAD) is DONE. Both gates PASS on the nx-free vanilla ng-add:
  ngx-leaflet @818e9ae (npm, app+lib) first-run `ng add` auto-wire-all + clean per-project scoping; and
  realworld-angular @9e3528f (pnpm-workspace + name-collision) wired the full [tsconfig.app.json,
  tsconfig.spec.json] array (build leaf not dropped) via the documented pnpm-native install + `ng g`. No
  open items block the release on this gate. Evidence: `.planning/quick/260715-ig5-.../`.

- (optional) `/gsd-complete-milestone v0.2.1` if not already done this session -- archive Phase 21-24
  dirs + collapse ROADMAP + evolve PROJECT.md.

- HUMAN-GATED RELEASE (do NOT auto-run): cut v0.2.1 via the AGENTS.md Release-PR flow -- branch
  `release/0.2.1` off main, `npx nx release --dry-run` then `--skip-publish`, curate CHANGELOG,
  PR into PR-only `main`, tag `angular-typechecker@0.2.1` on the merge commit, push to fire
  `release.yml` OIDC publish (approve the `npm-publish` environment), cut the GitHub Release.
