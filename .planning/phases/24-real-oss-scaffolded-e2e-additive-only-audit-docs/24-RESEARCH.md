# Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs - Research

**Researched:** 2026-07-11
**Domain:** e2e verification (real-clone + scaffolded Angular CLI), additive-only audit, end-user docs -- for an Nx plugin that also ships an Angular CLI builder/schematics surface (v0.2.1, ADDITIVE-ONLY)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (substrate -- LOCKED):** ACV-01 (real-clone) runs against TWO on-stack Angular 22 clones, IN ORDER: **(1st) `bluehalo/ngx-leaflet`** (app `ngx-leaflet-demo` + lib `ngx-leaflet`, MIT, non-Nx `angular.json`; the same clone Phase-21 GATE A' used), then **(2nd) `realworld-angular/realworld-angular`** (exact-stack Ng22.0/TS6.0.3, MIT, non-Nx, `@angular/build:application`). Off-stack Angular 21 stays DROPPED everywhere -- on-stack Angular 22 ONLY. Does NOT re-include `realworld-apps/angular-realworld-example-app`.
- **D-02 (ACV-01 = manual milestone-FINAL gate):** real-clone e2e is MANUAL/local (clones UNCOMMITTED); document as a reproducible UAT procedure (repo URL + SHA + pack -> `ng add` -> plant -> `ng run` -> assert -> clean). CI-authoritative proofs are ACV-02 + ACV-03.
- **D-03 (ACV-02 = a NEW dedicated e2e project):** mirror `angular-typechecker-install-e2e`'s Verdaccio + tarball machinery; keep the `ng`/`@angular/cli` harness SEPARATE from the Nx `nx` harness. The new project MUST honor the shared-tarball serialization + the GUARD set (see ACV-02 Topology below).
- **D-04 (additive-only audit = cross-check existing guards + a git-diff review):** confirm via `git diff angular-typechecker@0.2.0..HEAD` that the executor id, the `src/index.ts` barrel, and the shipped schemas are WIDENED-ONLY. Verdict recorded in the phase audit/VERIFICATION output.
- **D-05 (ACV-03 is AUDIT-and-fill):** most coverage exists from Phases 21-23; the one CANDIDATE gap is "the builder over `BuilderContext`" -- confirm and fill ONLY genuine gaps, no duplicate coverage.
- **D-06 (docs):** README `## Angular CLI` section (enumerated contents) + a curated CHANGELOG entry, PROSE ONLY (no release cut). ALL prose is END-USER language -- no internal ids/phase-plan numbers/board jargon.
- **D-07 (charter reconciliation):** Phase 24 adds NO production engine/core/generator/schematic surface; ACP-02 is trivially true BY CONSTRUCTION for the phase's own changes -- the audit confirms Phases 21-23 stayed additive.

### Claude's Discretion
- Plan decomposition (natural split: new e2e project / coverage+additive audit+gap-fill / docs).
- The new e2e project's exact name (e.g. `angular-typechecker-ng-cli-e2e`).
- Which planted diagnostics prove per-project scoping (app + spec + library errors; mirror install-e2e's distinct-per-leaf `TS2322`/`TS2345` attribution).
- README `## Angular CLI` placement + exact CHANGELOG wording (end-user language).

### Research Flags (resolved in this document)
- **RF-01 (scaffolded provisioning):** committed pinned fixture (B) vs live pinned scaffold (A). **Resolved -> (B), see "RF-01".**
- **RF-02 (new public-API snapshot guard):** add a barrel/API guard vs rely on existing guards + manual diff. **Resolved -> LIGHT YES, add a barrel drift tripwire, see "ACP-02".**

### Deferred Ideas (OUT OF SCOPE)
- Off-stack Angular 21 (or any cross-version) e2e cross-check -- DROPPED. (The consumer `--legacy-peer-deps` README note stays -- it is documentation, not a test tier.)
- `createNodesV2` Nx auto-provisioning (WALK-FUT-01); JSON/SARIF reporters; `NgtscProgram` incremental; standalone CLI; Jest; Angular CLI Storybook special-casing.
- The version cut / npm publish -- separate human-gated Release-PR flow (AGENTS.md). Phase 24 writes CHANGELOG PROSE only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACV-01 | FINAL tarball e2e gate against real cloned OSS Angular 22 workspaces (ngx-leaflet, then realworld-angular) | Both clones verified on-stack Ng22/TS6.0.3, SHAs pinned; UAT procedure shape from `19-UAT.md`; leaf shapes match the tested generator |
| ACV-02 | Repeatable AUTOMATED e2e in CI against a freshly SCAFFOLDED workspace (`npm init @angular` + `ng g library`) | RF-01 resolved (committed pinned fixture); Verdaccio machinery to mirror; 4-guard topology mapped; scaffold structure inspected |
| ACV-03 | Unit+integration coverage of the Angular-CLI-vs-Nx differences | Existing coverage enumerated; ONE genuine gap (builder over `BuilderContext`) + fill mechanism (`@angular-devkit/architect/testing`) |
| ACP-02 | Additive-only enforced + audited (no break to executor id / barrel / schemas) | Guard cross-check map + `git diff @0.2.0..HEAD` procedure; barrel confirmed unchanged since 0.2.0; RF-02 recommendation |
| ACD-01 | README `## Angular CLI` section + curated CHANGELOG entry (end-user language) | Verified command syntax; per-project target shape; docs tripwire precedent; Storybook-caveat tension flagged |
</phase_requirements>

## Summary

Phase 24 ships almost no production code. The Angular CLI builder (`convertNxExecutor`), the `configuration`/`init`/`ng-add` schematics (`convertNxGenerator` + the `angular.json` write-fork), and the engine's `tsConfig: string | string[]` widening ALL shipped in Phases 21-23 and are already guarded by a dense in-repo spec suite. Phase 24 is VERIFICATION + AUDIT + DOCS: (1) a NEW scaffolded Angular CLI e2e project (CI-authoritative), (2) a documented manual real-clone UAT gate against two on-stack Angular 22 workspaces, (3) an AUDIT of the already-built ACV-03 coverage that fills exactly one genuine gap, (4) an additive-only audit that cross-checks existing guards plus a `git diff` against the `angular-typechecker@0.2.0` tag, and (5) an end-user `## Angular CLI` README section + a prose CHANGELOG entry.

Empirical verification this session confirmed both real substrates are on-stack and their tsconfig-leaf shapes match what the shipped generator already resolves and tests (`ngx-leaflet` = app + lib; `realworld-angular` = app-only), so the real-clone gate is de-risked. The one genuine ACV-03 gap -- driving the builder over a real `BuilderContext` and asserting `BuilderOutput.success` + diagnostics parity with the Nx executor -- is fillable with the installed `@angular-devkit/architect/testing` `TestingArchitectHost` (architect `0.2200.6` is present). The `src/index.ts` public barrel is the single additive-only seam with no standing automated guard (all others -- manifest, `executors ?? builders`, `generators ?? schematics`, all four schemas -- are guarded), so RF-02 resolves to LIGHT YES: add a small barrel drift tripwire.

**Primary recommendation:** Split into three plans -- (1) the scaffolded `ng-cli-e2e` project (committed pinned Ng22 fixture + own Verdaccio global-setup, `ng add` -> plant -> `ng run` per project) plus the documented ACV-01 real-clone UAT; (2) the ACV-03 builder-over-`BuilderContext` integration gap-fill + the ACP-02 additive-only audit (git-diff verdict + a barrel drift tripwire); (3) the ACD-01 README `## Angular CLI` section + prose CHANGELOG + a docs content tripwire. Use **npm** for the scaffolded e2e; a committed pinned fixture, not a live scaffold.

## Architectural Responsibility Map

This phase touches only test-infra / CI / docs tiers. No production tier changes.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scaffolded `ng add` -> `ng run` proof (ACV-02) | e2e test project (`e2e/<proj>/`) | CI `e2e` job | Real toolchain via `execSync`; joins `nx run-many -t e2e --parallel=1` |
| Real-clone final gate (ACV-01) | Manual/local UAT (docs) | -- | Clones uncommitted; reproducible from URL + SHA |
| Builder-over-`BuilderContext` parity (ACV-03 gap) | Plugin integration spec (`src/builders/...`) | CI `integration` job | Real compiler + real `workspaceRoot`; runs on the full matrix, fast |
| Additive-only enforcement (ACP-02) | Plugin unit specs + git-diff audit | CI `test` job | Static read + one-time diff vs the 0.2.0 tag; optional standing barrel tripwire |
| End-user docs (ACD-01) | README + CHANGELOG (prose) | `scoped-name-guard` / docs tripwire | Content policed on every PR by a filesystem-read spec |

## Standard Stack

Zero new production dependencies (confirmed: the manifest already declares everything Phases 21-23 needed; `@angular-devkit/architect` + `rxjs` are optional peers). The additions in this phase are DEV/test-only and reuse installed tooling.

### Core (dev/test harness -- not shipped)
| Library | Version (verified 2026-07-11) | Purpose | Why Standard |
|---------|-------------------------------|---------|--------------|
| `@angular/cli` | `22.0.6` (latest; `~22.0.x`) | The `ng` binary for the scaffolded e2e + the committed-fixture generation | [VERIFIED: registry.npmjs.org] Only on-stack (^22) CLI; used to produce the ACV-02 fixture |
| `@angular-devkit/architect` (`/testing`) | `0.2200.6` (installed) | `TestingArchitectHost` to drive the builder over a `BuilderContext` (ACV-03 gap-fill) | [VERIFIED: installed node_modules] `TestingArchitectHost` + `TestProjectHost` exported; already an optional peer |
| `verdaccio` + `@nx/js` `startLocalRegistry` | installed (`verdaccio 6.x`) | Local registry so `ng add angular-typechecker` resolves by NAME | [CITED: TESTING.md] Reuse install-e2e's global-setup pattern verbatim |
| `@nx/vitest:test` | `23.0.1` (installed) | The new e2e project's `e2e` target executor | [CITED: e2e/*/project.json] Every e2e project uses it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@angular/build` | `^22.0.0` | The fixture's `build`/`test` builders (`@angular/build:application`, `@angular/build:unit-test`) | Ships inside the scaffolded fixture; both real clones use it |
| `@workspace/test-util` | workspace | `findWorkspaceRoot`, `buildCleanEnv`, `sh`, `removeTmpDir`, `writeVerdaccioNpmrc` | The new e2e specs reuse these cwd-independent helpers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Committed pinned Ng22 fixture (B) | Live `npm init @angular@22` at test setup (A) | (A) is genuinely "fresh" but adds network + flakiness and can drift within 22.x; (B) is deterministic, on-stack by construction, matches the existing `e2e/<proj>/fixtures/` precedent -- **RECOMMEND B** |
| `TestingArchitectHost` for the builder run | Direct `builderDefault.handler(options, ctx)` | Both run the wrapper's eager prelude over `workspaceRoot`; `TestingArchitectHost` synthesizes a valid `BuilderContext` for you (fewer moving parts) -- prefer it, keep handler-direct as fallback |
| npm for the scaffolded e2e | npm/pnpm/yarn matrix | The PM matrix is the install-e2e `nx add` concern; ACV-02 needs one deterministic proof. npm has no build-approval gate -- **use npm** |

**Installation:** No install step for the plugin. The scaffolded fixture declares its own Angular 22 devDependencies (installed from the Verdaccio upstream proxy at e2e time). `@angular/cli` is a DEV tool for fixture generation + `ng` execution.

**Version verification:** `@angular/cli` latest = `22.0.6` (22.x stable line: 22.0.0-22.0.6); `@angular-devkit/architect` installed = `0.2200.6` (note the `0.22xx.x` scheme). Both on-stack.

## Package Legitimacy Audit

> This phase installs NO new packages into the shipped plugin. The dev/e2e harness uses first-party Angular packages already known to the project; the committed fixture's `package.json` declares standard Angular 22 devDependencies.

| Package | Registry | Age | Source Repo | Disposition |
|---------|----------|-----|-------------|-------------|
| `@angular/cli` | npm | 9+ yrs | github.com/angular/angular-cli | Approved (first-party Angular; latest 22.0.6 verified) |
| `@angular/build` | npm | 2+ yrs | github.com/angular/angular-cli | Approved (first-party Angular) |
| `@angular-devkit/architect` | npm | 8+ yrs | github.com/angular/angular-cli | Approved (already an optional peer; installed 0.2200.6) |
| `@angular/core`, `@angular/compiler-cli`, `typescript` | npm | canonical | angular/angular, microsoft/TypeScript | Approved (already peers) |

**Packages removed due to slop:** none. **Flagged suspicious:** none. slopcheck was not run because the phase adds no new registry install to the shipped artifact; all fixture deps are canonical Angular/TS first-party packages verified against `registry.npmjs.org` this session.

## Substrate Verification (empirical, this session)

### ngx-leaflet (ACV-01 primary; app + lib)
[VERIFIED: local clone `D:\projects\github\bluehalo\ngx-leaflet`, git HEAD]
- Stack: `@angular/* ^22.0.0`, `@angular/cli ^22.0.0`, `typescript ~6.0.3`. On-stack. MIT.
- SHA to pin for reproduction: **`818e9ae55240b570397ede5a15cb4d466785abdc`** ("Remove stray bun.lock added by Angular 22 upgrade PR").
- Projects: `ngx-leaflet-demo` (application, root `""`, `@angular/build:application`, build `tsconfig.app.json`, test `tsconfig.spec.json`) + `ngx-leaflet` (library, root `projects/ngx-leaflet`, leaves `tsconfig.lib.json` + `tsconfig.spec.json`).
- **Notable:** the workspace-root `tsconfig.json` is NOT solution-style (plain base, no `files:[]`/`references`). This does NOT matter -- the generator uses Option A (`tsConfig: [buildLeaf, specLeaf]`), resolving leaves by CONVENTION, never by walking references. The shipped `configuration-angular-cli.spec.ts` already mirrors this exact repo (app `[tsconfig.app.json, tsconfig.spec.json]`; lib `[projects/ngx-leaflet/tsconfig.lib.json, projects/ngx-leaflet/tsconfig.spec.json]`), so ACV-01 leaf wiring is pre-tested.

### realworld-angular (ACV-01 second; app-only)
[VERIFIED: GitHub API]
- Stack: `@angular/core ^22.0.0`, `@angular/build ^22.0.0`, `@angular/cli ^22.0.0`, `@angular/compiler-cli ^22.0.0`, `typescript ~6.0.3`. Exact-stack. MIT.
- SHA to pin: **`9e3528ff27bad5fedaefb879ccc4aaf4717b137b`** (default branch `main`, pushed 2026-06-28). 183 stars, ~1.5 MB.
- Projects: SINGLE `realworld-angular` (application, root `""`, `@angular/build:application`, build `tsconfig.app.json`; test uses `@angular/build:unit-test`). Root has `tsconfig.json` + `tsconfig.app.json` + `tsconfig.spec.json`. **App-only** -- target planted-error assertions at the one application project (leaves `[tsconfig.app.json, tsconfig.spec.json]`). It also uses `@angular-eslint/builder:lint`, irrelevant to typecheck.
- Purpose: breadth/confidence on a SECOND exact-stack repo (ngx-leaflet already covers app+lib scoping). Run AFTER ngx-leaflet.

### Freshly scaffolded (ACV-02; app + lib) -- research-time scaffold inspected
[VERIFIED: `D:\projects\sandbox\angular220`, produced by `npm init @angular@latest` = CLI 22.0.6 + `ng g library my-lib`]
- Root `tsconfig.json` IS solution-style: `files: []` + `references` -> `./tsconfig.app.json`, `./tsconfig.spec.json`, `./projects/my-lib/tsconfig.lib.json`, `./projects/my-lib/tsconfig.spec.json` (confirms `ng g library` APPENDS the lib's tsconfigs to the root references).
- App `angular220` (root `""`, build `tsconfig.app.json`, root `tsconfig.spec.json`) + lib `my-lib` (root `projects/my-lib`, `tsconfig.lib.json` + `tsconfig.spec.json`).
- Same per-project leaf shape as ngx-leaflet -> Option A resolves it identically. This is the structure to CAPTURE as the committed ACV-02 fixture.

## RF-01: Scaffolded-workspace provisioning (the primary research question)

**RECOMMENDATION: Option B -- a committed, pinned Ng22 fixture workspace under `e2e/<ng-cli-e2e>/fixtures/`.** Matches CONTEXT's starting hypothesis and the existing e2e precedent (every consumer workspace already lives committed under `e2e/<project>/fixtures/`).

**Why B over A (live scaffold):**
- **On-stack by construction.** A live `npm init @angular@latest` pulls whatever is newest (22.0.6 today, but could become 22.1/23.x), drifting OFF the locked Angular-22 stack. Even `@angular/cli@22` moves within 22.x. A committed fixture is frozen on-stack.
- **Deterministic + offline.** No network scaffold step in CI (the fixture's own deps still install, but from the Verdaccio upstream proxy at pinned versions -- especially with a committed `package-lock.json`). Removes a whole class of CI flakiness.
- **Precedent.** `install-e2e/fixtures/*`, `matrix-e2e/fixtures/consumer-workspace/` (which commits a `pnpm-lock.yaml`) are all committed fixtures. A committed Angular CLI fixture is the same pattern.
- **"Freshly scaffolded" is satisfied semantically.** The fixture IS a genuine CLI-produced workspace (`npm init @angular@22` + `ng g library`), captured once rather than regenerated per-run. Record this reconciliation for the milestone audit so SC2/ACV-02's "`npm init @angular` + `ng g library`" text is not read as requiring a live scaffold.

**How to produce + commit the fixture (once):**
1. `npm init @angular@22 <fixture-name> --defaults --skip-install` (or `npx @angular/cli@22 new ...`), then `ng g library <lib> --skip-install` inside it.
2. Strip `node_modules/`, `.angular/`, `dist/`, `.git/`. Keep `angular.json`, `package.json`, `package-lock.json`, `src/`, `public/`, `projects/<lib>/`, all `tsconfig.*.json`.
3. Pin `package.json` to `@angular/cli` `~22.0.x`, `@angular/core`/`@angular/build`/`@angular/compiler-cli` `^22.0.0`, `typescript ~6.0.3`; commit `package-lock.json` for byte-reproducible installs.
4. Add a short "regenerate on Angular bumps" drift note (co-located README/comment), mirroring the repo's existing `*.drift.ts` honesty convention.

**RF-01 sub-question -- `ng add` across the PM matrix:** Use **npm only** for ACV-02. The requirement text says `npm init @angular`, and npm has no build-approval gate. `ng add` DOES pull `nx` transitively (Pitfall 4), and `nx` carries a build script, so under **pnpm** the SAME `ERR_PNPM_IGNORED_BUILDS` build-approval friction the `nx add` matrix hit ([[nx-add-fails-on-pnpm-workspaces]]) COULD appear -- but `angular-typechecker` itself has no install scripts. The npm/pnpm/yarn matrix is the install-e2e `nx add` concern; ACV-02 needs ONE deterministic proof, so keep it npm. If pnpm breadth is later wanted it is OPTIONAL and must apply the documented `allowBuilds:{nx:true}` / `--ignore-scripts`-then-`ng g :ng-add` workaround.

**RF-01 sub-question -- `.npmrc`/peer posture:** the committed fixture must NOT carry the dev-repo's `legacy-peer-deps=true` (that would mask a real on-stack peer result). On-stack Angular 22 needs NO `--legacy-peer-deps` (Pitfall 6; spike 011 confirmed the on-stack install is clean). The e2e writes a Verdaccio `.npmrc` (registry + minted token) into the tmp copy exactly like `nx-add-npm.e2e.spec.ts` (`writeVerdaccioNpmrc` + `buildCleanEnv({ stripAllNpmConfig: true })` so an inherited `npm_config_registry` cannot leak the install to the public registry).

## ACV-02: New e2e project topology + the guards it must satisfy

**Add a 4th e2e project** (e.g. `e2e/angular-typechecker-ng-cli-e2e/`) mirroring `install-e2e`. It joins `nx run-many -t e2e` automatically (no `-p` edit). It shares the ONE dist tarball path, so it inherits the `--parallel=1` contract.

**Files the new project needs (mirror install-e2e):**
- `project.json` -- `projectType: application`, tags **`["scope:fixture", "type:e2e"]`**, `implicitDependencies: ["angular-typechecker"]`, targets:
  - `e2e` -> `@nx/vitest:test` (outputs `coverage/e2e/<proj>`).
  - `typecheck` -> `nx:run-commands` `tsc --noEmit -p e2e/<proj>/tsconfig.spec.json` (cache:true).
- `vitest.config.mts` -- node env, `pool: 'forks'`, `singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, long `testTimeout` (300000), `globalSetup: ['./src/global-setup.ts']`.
- `src/global-setup.ts` -- COPY install-e2e's: `startLocalRegistry` on `127.0.0.1`, mint a real couchdb token, `nx build angular-typechecker --skip-nx-cache` once, strip `publishConfig.provenance`, publish once via `nx release publish --first-release --excludeTaskDependencies`, `provide('verdaccioUrl'/'verdaccioToken')`, the non-127.0.0.1 SAFETY gate.
- `fixtures/<scaffolded-workspace>/` -- the committed pinned Ng22 workspace (RF-01 Option B).
- `tsconfig.json` + `tsconfig.spec.json`.
- `src/*.e2e.spec.ts` -- copy fixture to tmp -> `writeVerdaccioNpmrc` -> `npm install` (fixture deps + package-lock) -> `ng add angular-typechecker` (auto-wires all app+lib) -> plant app + spec + library errors -> `ng run <app>:typecheck` and `ng run <lib>:typecheck` -> assert each catches EXACTLY its own planted leaf error and a clean baseline exits clean.

**CRITICAL -- the 4 guards a 4th e2e project must keep green** (from `ci-e2e-coverage-guard.spec.ts`; note CONTEXT D-03 said "`typecheck-e2e`" but the CURRENT guards use `typecheck` + the `type:e2e` tag -- reconcile to the current shape):
- **GUARD-01:** every `e2e/*` project defines an `e2e` target AND no non-e2e project defines one (set-equality). -> define `e2e`.
- **GUARD-01b:** the ci.yml `e2e` job passes `--parallel=1`. -> no ci.yml change needed; just don't break it.
- **GUARD-01c:** every `e2e/*` project defines a `typecheck` target AND the ci.yml e2e job runs `nx run-many -t typecheck`. -> define `typecheck` (the former `typecheck-e2e` was folded into `typecheck`).
- **GUARD-01d:** the `type:e2e` tag set is EXACTLY the `e2e/*` projects. -> add `type:e2e` to the new project's tags.

**No ci.yml edit is required** -- `nx run-many -t e2e` / `-t typecheck -p tag:type:e2e` auto-discover the new project once it carries the target + tag. Adding the project without the `e2e` target or `type:e2e` tag would SILENTLY drop it from coverage (the exact failure the guards exist to make loud).

**Planted diagnostics (discretion, mirror install-e2e):** use distinct-per-leaf codes so each error uniquely pins its leaf -- e.g. `TS2322` (type-not-assignable) in an app component, `TS2345` (arg-not-assignable) in a spec, and a third distinct code in the library component. Assert raw TS codes directly; Angular NG8xxx via the negative-encoding helper `NG = (code) => -990000 - code`. Prove per-project scoping: the app target catches the app+spec errors and NOT the lib error, and vice versa (COV-01 semantics at the e2e tier).

## ACV-03: Coverage audit -- existing coverage vs the ONE genuine gap

**Audit verdict: only ONE genuine gap exists (the builder over `BuilderContext`).** Everything else ACV-03 names is already covered. The planner fills ONLY the gap.

| ACV-03 sub-item | Status | Existing coverage |
|-----------------|--------|-------------------|
| `tsConfig: string[]` union | COVERED | `core/multi-tsconfig.integration.spec.ts` (real compiler, ENG-01/21-02) + `executors/typecheck/normalize-options.spec.ts`; fixtures `multi-tsconfig-array` + `multi-tsconfig-cross-dir` |
| `angular.json` write-fork on an angular.json-seeded tree | COVERED (comprehensive) | `generators/configuration/configuration-angular-cli.spec.ts` -- app/lib arrays, COV-01 disjoint scoping, no-stray-nx.json, idempotency, non-ours collision throw, `--tsConfig` override, single-leaf, missing-leaf throw, hybrid WR-01 Nx-branch |
| **the builder over `BuilderContext`** | **GAP (partial)** | `builders/typecheck/builder.spec.ts` asserts source shape + the runtime Architect brand + a `handler` function, but NEVER RUNS the builder. No `BuilderOutput.success`/diagnostics-parity execution test. |
| `ng-add` auto-wire-all + idempotency | COVERED (comprehensive) | `generators/ng-add/ng-add.spec.ts` -- auto-wire-all, `--project` scoping, idempotency, preserve user options/configs, non-ours collision, skip e2e/other types, devDep move, notice-once, RF-02 no-angular.json guard, WR-03 errors, IN-01 zero-wire notice |
| no stray `nx.json` | COVERED | `configuration-angular-cli.spec.ts` (`assertCliSubstrate`) + `init-angular-cli.spec.ts` (readNxJson null) + `ng-add.spec.ts` (targetDefaults undefined) |

### Filling the gap: builder-over-`BuilderContext` integration test
[VERIFIED: `@angular-devkit/architect/testing` installed, exports `TestingArchitectHost` + `TestProjectHost`, architect `0.2200.6`]

Add ONE `src/builders/typecheck/builder.integration.spec.ts` (integration tier -- real compiler + real `workspaceRoot`). Recommended harness:

```typescript
// Source: @angular-devkit/architect + @angular-devkit/architect/testing (installed 0.2200.6)
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import builderDefault from './builder';

const registry = new schema.CoreSchemaRegistry();
const host = new TestingArchitectHost(fixtureRoot, fixtureRoot);
host.addBuilder('angular-typechecker:typecheck', builderDefault);
const architect = new Architect(host, registry);

const run = await architect.scheduleBuilder('angular-typechecker:typecheck', {
  tsConfig: [/* fixture build leaf, spec leaf */],
});
const output = await run.result;   // BuilderOutput
await run.stop();

expect(output.success).toBe(/* true on clean, false on planted-error fixture */);
// Parity: assert the SAME { success } the Nx executor returns for the same fixture+options.
```

**Implementation notes for the planner:**
- The wrapper's eager `retrieveProjectConfigurationsWithAngularProjects(workspaceRoot)` reads `workspaceRoot` from disk. The fixture must therefore be a resolvable workspace root -- either add a minimal `angular.json` (one project + its tsconfig leaves + a component) to a dedicated fixture, or point `workspaceRoot` at an existing fixture that has one. **This is the one detail to confirm during implementation** (spike 011 ran the builder over a real installed workspace; confirm the `TestingArchitectHost` `workspaceRoot` correctly scopes the eager prelude to the fixture and does not pick up the dev-repo's own nx context).
- Parity target: assert `output.success` equals the Nx executor's `{ success }` for the identical fixture + `tsConfig` (both go through the same `runTypecheck` core, so parity is structural -- the test locks it). One clean case (`success: true`) + one planted-error case (`success: false`) is sufficient; optionally assert diagnostic codes match.
- Value beyond the e2e: this runs in the `integration` CI job on the FULL matrix and fast (no tarball/Verdaccio/network), whereas the ACV-02 e2e is Linux-only + multi-minute. It is the CI-authoritative builder-run parity proof.
- Fallback if `TestingArchitectHost` is fiddly: call `builderDefault.handler(options, minimalContext)` with `minimalContext = { workspaceRoot, logger, target }` -- same eager prelude, fewer abstractions. (Driving the executor directly instead would NOT test the builder wrapper, so avoid that shortcut.)

## ACP-02: Additive-only audit

Additive-only is enforced mostly by guards Phases 21-23 already shipped. The audit CROSS-CHECKS them and adds a git-diff verdict.

**Guard cross-check map (all present and green):**
| Surface | Guard |
|---------|-------|
| `executors ?? builders` unchanged; `typecheck` executor id stays | `builders/typecheck/nx-surface-regression.spec.ts` |
| `generators ?? schematics` unchanged; `ng-add` absent from generators.json | `schematics/configuration/nx-generators-surface-regression.spec.ts` |
| Schema parity (executor + both generators + sanitized builder) | `executors/typecheck/schema-parity.spec.ts`, `generators/*/schema-parity.spec.ts`, `builders/typecheck/schema-parity.spec.ts` |
| Static manifest contract (peers, optional peers, `builders`/`schematics` fields, `ng-add.save`, files, engines) | `package-manifest.spec.ts` |
| ENG-01 single-string + Nx path byte-unchanged | `core/multi-tsconfig.integration.spec.ts` |

**The git-diff verdict (D-04):** [VERIFIED: tag `angular-typechecker@0.2.0` exists] run against the 0.2.0 baseline and record in the phase VERIFICATION/audit output:
```bash
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/index.ts
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/executors/typecheck/schema.json
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/src/generators/configuration/schema.json \
                                            packages/angular-typechecker/src/generators/init/schema.json
git diff angular-typechecker@0.2.0..HEAD -- packages/angular-typechecker/executors.json packages/angular-typechecker/generators.json
```
Assert: the executor id (`angular-typechecker:typecheck`), the barrel exports (`runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`), and the pre-existing schemas are WIDENED-ONLY (never narrowed/removed/renamed). **Confirmed this session:** the `src/index.ts` barrel at the `0.2.0` tag exports the SAME five names as HEAD -- i.e. the barrel is UNCHANGED, so the expected verdict is "additive-safe / barrel unchanged". The only executor-schema change since 0.2.0 is the ENG-01 `tsConfig` `oneOf string|array` widening (additive by construction).

**RF-02 -- add a standing barrel guard? RECOMMEND: LIGHT YES.** The audit confirms `src/index.ts` is the ONE additive-only seam with no standing automated guard (everything else is guarded per the table above); only the manual one-time diff covers it. Convert that manual diff into a standing guard with a small **`src/index.drift.ts`** `tsc --noEmit` tripwire that imports all five exports (2 value + 3 type):
```typescript
// src/index.drift.ts -- additive-only barrel tripwire (rides the `typecheck`/drift target)
import { runTypecheck, TypecheckInfrastructureError } from './index';
import type { CoreOptions, CoreResult, SkippedReference } from './index';
// reference each so removal/rename fails `tsc --noEmit` loudly
void runTypecheck; void TypecheckInfrastructureError;
type _Guard = [CoreOptions, CoreResult, SkippedReference];
```
Rationale: it covers ALL five exports including the erased type-only ones (a runtime `.spec.ts` would only see the 2 value exports), matches the repo's established `*.drift.ts` idiom (`compiler-cli-types.drift.ts`, `extended-catalog.drift.ts`, `target-defaults-drift`), and is proportionate for the milestone's FINAL gating phase. Optionally assert the CoreOptions/CoreResult SHAPE (a widen-only structural assignment) if the planner wants field-level locking; the export-set tripwire alone is the minimum.

## ACD-01: Docs

### Verified command syntax (as a consumer sees it)
- **`ng add angular-typechecker`** -- installs the package and runs the first-party `ng-add` schematic: auto-wires a `typecheck` architect target into EVERY `application` + `library` project in `angular.json` (idempotent; skips e2e/other project types), ensures the devDependency, and prints the "no target caching on Angular CLI" notice. On-stack Angular 22 needs NO `--legacy-peer-deps`.
- **`ng generate angular-typechecker:configuration <project>`** -- wires a single project's `typecheck` target (for a project added after the initial `ng add`).
- **`ng run <project>:typecheck`** -- runs the complete Angular type-check; the exit verdict = `BuilderOutput.success` (identical to the Nx executor).
- **Per-project target shape** -- each project's `angular.json` gains `architect.typecheck = { builder: "angular-typechecker:typecheck", options: { tsConfig: [<build leaf>, <spec leaf>] } }` (e.g. app `[tsconfig.app.json, tsconfig.spec.json]`; lib `[projects/<lib>/tsconfig.lib.json, projects/<lib>/tsconfig.spec.json]`).
- **`tsConfig` array** -- the array unions each leaf's diagnostics and filters via the input-set-membership boundary; this is how one target checks the project's COMPLETE leaf set (build + spec).

### Required notes (from D-06)
- **`nx` transitive + `.nx/` + no caching:** `ng add` pulls `nx` transitively (via `@nx/devkit`'s peer -- the builder needs `nx/src/devkit-internals` at runtime); a `.nx/` cache dir may materialize in the workspace; unlike the Nx surface, the Angular CLI path has NO target caching (Angular CLI has no task-result cache to seed) -- rely on your CI caching.
- **Off-stack `--legacy-peer-deps`:** Angular < 22 consumers hit the `@angular/compiler-cli ^22.0.0` / `typescript >=6.0.0 <6.1.0` peer cap; install with `--legacy-peer-deps`. (Pitfall 6. The off-stack e2e tier was dropped, but this consumer note STAYS -- it is guidance, not a test tier.)

### Docs content tripwire (RECOMMEND: add one)
Mirror `storybook-docs.spec.ts` + `scoped-name-guard`: a small `src/angular-cli-docs.spec.ts` filesystem-read tripwire that locks the load-bearing `## Angular CLI` claims (the `ng add` auto-wire-all claim, the no-caching notice, the `nx`-transitive/`.nx/` note, the off-stack `--legacy-peer-deps` note). It runs in the fast `test` loop on every PR (even docs-only) so a deleted/softened/over-claimed doc fails loudly. Normalize whitespace (`\s+` -> ` `) so it survives prose re-wrapping (the Storybook spec's pattern). Planner discretion, but WARRANTED for these claims.

### Tension to reconcile (FLAG for the planner)
The shipped `storybook-docs.spec.ts` asserts the README says the **"Angular CLI Storybook setup ... is not supported"**. The NEW `## Angular CLI` section says Angular CLI workspaces ARE supported (for typecheck). These are NOT contradictory (Storybook-on-Angular-CLI special-casing stays out of scope; general Angular CLI typecheck is now supported), but word the new section so it does not appear to contradict the existing Storybook caveat. Do not delete or weaken the Storybook caveat -- its tripwire will fail.

### CHANGELOG
PROSE ONLY, end-user language, no internal ids/phase-plan numbers/board jargon ([[changelog-readme-end-user-facing]]). Mirror the `0.2.0` entry style. NO release cut, NO version bump in this phase -- the `0.2.0 -> 0.2.1` cut is the separate human-gated Release-PR flow (AGENTS.md). Describe: "Angular CLI (`angular.json`) workspace support -- `ng add` auto-wires a `typecheck` target into every app + library; `ng run <project>:typecheck` runs the complete Angular type-check; per-project scoping via the `tsConfig` array; notes on `nx` transitivity/no caching and off-stack `--legacy-peer-deps`."

## Common Pitfalls

### Pitfall A: Adding the 4th e2e project without the target/tag -> silent coverage drop
**What goes wrong:** a new `e2e/*` project without an `e2e` target is silently skipped by `nx run-many -t e2e`; without a `typecheck` target or `type:e2e` tag it is dropped from the type-check gates.
**How to avoid:** define `e2e` + `typecheck` targets and the `["scope:fixture","type:e2e"]` tags. GUARD-01/01c/01d turn any omission into a loud, located failure -- run the plugin `test` suite after scaffolding the project.

### Pitfall B: Shared-tarball race (must stay `--parallel=1`)
**What goes wrong:** all e2e projects pack the SAME `dist/.../angular-typechecker-<ver>.tgz`; a sibling's `afterAll rmSync` deletes it mid-install if run in parallel (ENOENT).
**How to avoid:** the new project inherits the contract -- pack in `beforeAll`, `rmSync` in `afterAll`, and do NOT touch the ci.yml `--parallel=1` (GUARD-01b). [[e2e-projects-share-one-tarball-serialize]]

### Pitfall C: `nx` dragged in + `.nx/` artifact on the Angular CLI path (Pitfall 4)
**What goes wrong:** `ng add` into a non-Nx workspace pulls `nx` transitively and may create a `.nx/` dir -- surprising in a repo with no other Nx footprint.
**How to avoid:** ACCEPT + document (it is the cost of reusing the identical engine); the e2e tolerates/cleans `.nx/`; the README documents the tradeoff.

### Pitfall D: Peer friction masks a real result (Pitfall 6)
**What goes wrong:** an inherited `legacy-peer-deps=true` (dev-repo `.npmrc`) leaking into the fixture install would mask a genuine on-stack peer result.
**How to avoid:** `buildCleanEnv({ stripAllNpmConfig: true })` + a fixture `.npmrc` that does NOT set legacy-peer-deps; on-stack Angular 22 must install cleanly with no flag (assert it).

### Pitfall E: Spec coverage claim (Pitfall 8 -- now VOID but keep proving it)
**What goes wrong:** historically the concern was spec leaves silently unchecked. Option A (`[buildLeaf, specLeaf]`) folds the spec leaf in explicitly.
**How to avoid:** the e2e plants BOTH an app error AND a spec error AND a library error and asserts each per-project target catches exactly its own leaves -- so complete coverage is a tested fact, never an accident.

### Pitfall F: The `BuilderContext` eager prelude reads `workspaceRoot` from disk
**What goes wrong:** the builder-over-`BuilderContext` integration test's `workspaceRoot` must resolve a real workspace (angular.json/nx.json); a bare fixture dir may pick up the dev-repo's nx context or fail the prelude.
**How to avoid:** point `TestingArchitectHost` at a fixture that HAS an `angular.json` (one project + tsconfig leaves + a component); confirm scoping during implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verdaccio + publish for the new e2e | A bespoke registry harness | COPY `install-e2e/src/global-setup.ts` | The 127.0.0.1 loopback, real-token mint, provenance strip, and SAFETY gate are all load-bearing and already solved |
| Driving the builder in a test | A fake `BuilderContext` object from scratch | `@angular-devkit/architect/testing` `TestingArchitectHost` | Synthesizes a valid `BuilderContext` + logger; installed already |
| A scaffolded workspace at test time | Live `npm init @angular` in CI | A committed pinned fixture (RF-01 B) | Deterministic, on-stack, offline, matches precedent |
| Barrel additive-only check | A custom AST differ | An `index.drift.ts` `tsc --noEmit` tripwire | Matches the repo's `*.drift.ts` idiom; covers erased type exports |
| Reading `ci.yml`/`project.json` in guards | A YAML parser dependency | Regex/string reads (existing GUARD pattern) | Line-level invariants; no new dep |

**Key insight:** every mechanism this phase needs already exists in the repo (Verdaccio setup, fixture layout, guard specs, drift tripwires, docs tripwires, the Architect testing harness). Phase 24 is assembly + audit + prose, not invention.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` via `@nx/vitest:test` |
| Config file | per-project `vitest.config.mts` (+ new `e2e/<ng-cli-e2e>/vitest.config.mts`); root `vitest.workspace.ts` globs it |
| Quick run command | `npx nx test angular-typechecker` (unit + integration incl. the new builder integration spec) |
| Full suite command | `npx nx run-many -t test integration` + `npx nx run-many -t e2e --parallel=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACV-02 | scaffolded `ng add` -> `ng run` per-project scoping | e2e | `npx nx e2e angular-typechecker-ng-cli-e2e` | ❌ Wave 0 (new project) |
| ACV-03 | builder over `BuilderContext` (success + parity) | integration | `npx nx test angular-typechecker` (runs `builder.integration.spec.ts`) | ❌ Wave 0 (gap-fill) |
| ACV-03 | `tsConfig[]` union / write-fork / ng-add / no stray nx.json | unit+integration | `npx nx test angular-typechecker` | ✅ existing |
| ACP-02 | additive-only guards + git-diff verdict | unit + manual audit | `npx nx test angular-typechecker` + the `git diff @0.2.0..HEAD` audit | ✅ guards; ❌ Wave 0 (barrel drift tripwire, audit doc) |
| ACD-01 | README `## Angular CLI` claims locked | unit (docs tripwire) | `npx nx test angular-typechecker` | ❌ Wave 0 (`angular-cli-docs.spec.ts`) |
| ACV-01 | real-clone final gate | manual UAT | documented procedure (URLs + SHAs) | ❌ Wave 0 (UAT doc) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (fast unit + integration incl. new specs).
- **Per wave merge:** `npx nx run-many -t test integration` + (if e2e touched) `npx nx run-many -t e2e --parallel=1`.
- **Phase gate:** full suite green + the manual ACV-01 real-clone UAT recorded before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `e2e/angular-typechecker-ng-cli-e2e/` (project.json + vitest.config.mts + global-setup.ts + committed fixture + `*.e2e.spec.ts`) -- covers ACV-02.
- [ ] `src/builders/typecheck/builder.integration.spec.ts` (+ a minimal angular.json fixture) -- covers the ACV-03 builder-over-`BuilderContext` gap.
- [ ] `src/index.drift.ts` barrel additive-only tripwire -- ACP-02 standing guard (RF-02).
- [ ] `src/angular-cli-docs.spec.ts` -- ACD-01 docs tripwire.
- [ ] The ACP-02 git-diff audit + the ACV-01 UAT procedure (docs/verification artifacts).

## Security Domain

> `security_enforcement` is absent in config (treated as enabled). This phase adds test-infra/docs only -- no auth/session/access-control/crypto surface. The relevant controls are INHERITED and must not regress.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | minor | Schema validation already guarded (schema-parity specs); no new input surface |
| V6 Cryptography | no | none |
| V10/V14 Supply chain (config/deps) | yes | Reuse install-e2e's SAFETY gate (refuse any non-`http://127.0.0.1:` publish); tarball audit (`publint`/`attw`) already asserts `builders.json`/`collection.json`/schemas ship |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| e2e publishes to a real registry by mistake | Tampering | The 127.0.0.1-only publish SAFETY gate in global-setup (copy verbatim) |
| A malicious/typo'd fixture dependency | Supply chain | Committed `package-lock.json` + first-party Angular deps only; Verdaccio proxies upstream at pinned versions |
| Missing manifest file in the published tarball | Tampering/availability | The existing `tarball-audit.e2e.spec.ts` already gates required files (extend only if the phase adds a shipped file -- it does not) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@angular/cli` (`ng`) | Scaffolded e2e + fixture generation | ✓ (dev) | 22.0.6 | Pin `~22.0.x` in the fixture |
| `@angular-devkit/architect/testing` | ACV-03 builder integration test | ✓ (installed) | 0.2200.6 | Handler-direct invocation |
| Verdaccio + `@nx/js` local-registry | `ng add` by-name resolution | ✓ (installed) | 6.x | -- |
| Node / npm | e2e install + `ng` | ✓ | 22/24/26 | -- |
| `bluehalo/ngx-leaflet` clone | ACV-01 (manual) | ✓ local, UNCOMMITTED | SHA 818e9ae | Re-clone from URL + SHA |
| `realworld-angular/realworld-angular` clone | ACV-01 (manual) | ✗ (clone at UAT time) | SHA 9e3528f | Clone from URL + SHA |
| Network (npm proxy) for fixture install | ACV-02 fixture deps | ✓ (CI) | -- | Verdaccio upstream proxy |

**Missing with fallback:** the `realworld-angular` clone is fetched at UAT time (manual gate) -- reproduced from URL + SHA. No blocking gaps.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TestingArchitectHost(workspaceRoot)` correctly scopes `convertNxExecutor`'s eager project-graph prelude to the fixture (not the dev-repo nx context) | ACV-03 | The builder integration test may need a fuller fixture or the handler-direct fallback; low -- spike 011 proved the run path, only the harness scoping is unconfirmed |
| A2 | `ng add angular-typechecker` on npm behaves like `nx add` (detect PM -> install -> run ng-add schematic) against local Verdaccio | ACV-02 | If `ng add`'s install path differs materially, the e2e falls back to `npm install <tgz>` + `ng g angular-typechecker:ng-add`; medium -- confirm in the first e2e run |
| A3 | The committed pinned fixture's Angular 22 deps install cleanly from the Verdaccio upstream proxy in CI | ACV-02 | Slower/ flaky install; mitigate with a committed `package-lock.json`; low |
| A4 | `realworld-angular`'s app leaves are `tsconfig.app.json` + `tsconfig.spec.json` (verified present) and the generator wires them by convention | ACV-01 | If the `@angular/build:unit-test` builder implies a different spec tsconfig, the UAT `ng run` may need an explicit `--tsConfig`; low -- files confirmed present |

## Open Questions

1. **Does `ng add` need a Verdaccio registry, or can the e2e install the tarball directly then run the schematic?**
   - What we know: ACV-01/02 explicitly exercise `ng add`; `ng add` resolves a package by NAME. Local Verdaccio (mirroring `nx-add-npm.e2e.spec.ts`) is the faithful proof.
   - Recommendation: use Verdaccio (own global-setup). Keep `npm install <tgz>` + `ng g angular-typechecker:ng-add` as the fallback if `ng add` + Verdaccio proves fiddly.

2. **Where should the builder-integration fixture live?**
   - What we know: it needs an `angular.json` + tsconfig leaves + a component; existing `fixtures/multi-tsconfig-array` may lack an `angular.json`.
   - Recommendation: add a small dedicated `fixtures/builder-context/` (or extend an existing fixture with a minimal `angular.json`); confirm the eager-prelude scoping (A1).

## Sources

### Primary (HIGH confidence)
- Local clone `D:\projects\github\bluehalo\ngx-leaflet` (git HEAD 818e9ae, package.json, angular.json, tsconfig.json) -- on-stack Ng22/TS6.0.3, app+lib, non-solution-style root tsconfig.
- Research-time scaffold `D:\projects\sandbox\angular220` (angular.json, solution-style tsconfig.json) -- the modern `npm init @angular@22` + `ng g library` structure.
- GitHub API `realworld-angular/realworld-angular` (repo meta, package.json, angular.json, tsconfig files) -- app-only, exact-stack, MIT, SHA 9e3528f.
- Installed `@angular-devkit/architect@0.2200.6` `/testing` (`TestingArchitectHost`, `TestProjectHost` exported).
- Repo source read directly: `builders/typecheck/{builder,builder.spec,nx-surface-regression,schema-parity}.ts`, `generators/{configuration,init,ng-add}/*.spec.ts`, `ci-e2e-coverage-guard.spec.ts`, `package-manifest.spec.ts`, `schematics/configuration/nx-generators-surface-regression.spec.ts`, `src/index.ts`, `e2e/angular-typechecker-install-e2e/{project.json,src/global-setup.ts,src/nx-add-npm.e2e.spec.ts}`, `.github/workflows/ci.yml`, `storybook-docs.spec.ts`.
- `git tag -l` (confirms `angular-typechecker@0.2.0` exists) + `git show angular-typechecker@0.2.0:.../src/index.ts` (barrel unchanged vs HEAD).
- `registry.npmjs.org/@angular/cli` (latest 22.0.6; 22.x stable line).
- `.planning/config.json` (`nyquist_validation: true`, `security_enforcement` absent).

### Secondary (MEDIUM confidence)
- `.planning/research/v0.2.1-angular-cli/{SUMMARY,PITFALLS,STACK}.md` -- design + pitfalls (Pitfalls 4/5/6/8).
- `.planning/codebase/TESTING.md` -- e2e tiers, shared-tarball `--parallel=1`, guard specs.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- spike 011 = GO (real `ng run` on ngx-leaflet app+lib, planted TS2322 RED / clean GREEN, on-stack no `--legacy-peer-deps`).
- Project memory: [[v021-angular-cli-substrate]], [[e2e-projects-share-one-tarball-serialize]], [[nx-add-fails-on-pnpm-workspaces]], [[changelog-readme-end-user-facing]], [[oss-real-repo-verification]].

## Metadata

**Confidence breakdown:**
- Substrate verification: HIGH -- both clones + the scaffold inspected directly; SHAs pinned; leaf shapes match the tested generator.
- RF-01 (provisioning): HIGH -- committed-fixture precedent is established; scaffold structure confirmed.
- ACV-03 gap analysis: HIGH -- specs read directly; the one gap is precise; the fill harness is installed.
- ACP-02 audit: HIGH -- guards enumerated; 0.2.0 baseline exists; barrel confirmed unchanged.
- ACD-01: HIGH -- command syntax verified against source + real repos; the Storybook-caveat tension identified.
- A1 (builder-integration harness scoping): MEDIUM -- to confirm in implementation.

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (stable stack; re-verify if Angular 22.x or `@angular/cli` bumps, or if the real-clone SHAs are re-pinned)
