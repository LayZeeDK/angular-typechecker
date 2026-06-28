# Phase 6: Full e2e Matrix + CI - Research

**Researched:** 2026-06-29
**Domain:** GitHub Actions CI matrix design + Nx-plugin multi-project-type e2e fixtures (tarball install, pnpm symlink layout, cross-OS path normalization)
**Confidence:** HIGH (CONTEXT decisions D-01..D-10 re-validated against live Nx 23.0.1 source + GitHub API SHAs + official docs; OQ-1 and B-02 resolved empirically below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Unit + integration matrix = FULL 3-Node x 3-OS = 9 cells, `fail-fast: false`. `matrix: { node: [22, 24, 26], os: [ubuntu-latest, windows-latest, macos-latest] }`. Pin Node to MAJOR; do NOT pin `architecture`.
- **D-02 (CROSS-PHASE CONTRACT):** single aggregate gate job `id: ci`, `name: ci`, `needs: [test, e2e]`, `runs-on: ubuntu-latest`, `if: always()`; fail unless every dependency succeeded via `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')`. `ci` is the EXACT name Phase 7's "Default branch" ruleset requires -- LOCK it. Pair with "require branches up to date".
- **D-03:** e2e is a SEPARATE Linux-only job selected by EXPLICIT project list (`nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`), one Node version (Node 24, matching release.yml), `nx run-many` NOT `nx affected`, `NX_DAEMON: false` job-wide, no Nx Cloud. Matrix `test` job runs `-p angular-typechecker`.
- **D-04:** `npm ci` + `actions/setup-node` `cache: npm`; NO cross-job Nx cache, NO Nx Cloud. `npm ci` auto-honors the committed root `.npmrc` (`legacy-peer-deps=true`). Do NOT set `registry-url` in CI.
- **D-05:** Match release.yml hardening + reuse its action SHAs. Top-level `permissions: { contents: read }`; `persist-credentials: false`; full 40-char SHA pins with `# vN`; `concurrency` group `${{ github.workflow }}-${{ github.ref }}` + `cancel-in-progress: true`. Triggers: `pull_request` + `push` to `main`.
- **D-06:** Provision pnpm via `pnpm/action-setup` (SHA-pinned), NOT `corepack enable` (corepack removed from Node 25+; matrix runs Node 26).
- **D-07:** Fixture topology = ONE multi-project consumer Nx-workspace fixture, install the tarball ONCE, run the executor against 5 targets. Each project type in its own `it()`/`it.each` over the 5 targets; reuse the Phase-5 green+`TS2322` pairing. Self-contained (own `nx.json`, NO `tsconfig.base.json` extension, NO source path-aliases). Wires the PUBLISHED executor id `angular-typechecker:angular-typecheck`.
- **D-08:** New dedicated `angular-typechecker-matrix-e2e` Nx project (do NOT pile onto `install-e2e`). Clone `install-e2e`'s `vitest.config.mts` verbatim + `buildCleanEnv` + pack-to-tmp; `implicitDependencies:["angular-typechecker"]`; tag `scope:fixture`.
- **D-09:** pnpm fixture = ONE fixture that BOTH runs under the symlinked layout AND is a realpath regression-guard. Reject a full 5-type duplicate under pnpm.
- **D-10:** Mixed-case path assertion lives in the CROSS-OS unit + integration tier, NOT the Linux-only e2e gate. Extend `filter-diagnostics.spec.ts`; add ONE integration test asserting the executor/host derives `useCaseSensitiveFileNames` from the real `ts.sys`/program host.

### Claude's Discretion
- CI workflow filename (`ci.yml` recommended); the `concurrency` group string; whether the Linux-only e2e runs as ONE `e2e` job or split.
- Exact fixture/project names; the pnpm version pin; whether the e2e job pins Node 24 vs 22.
- Whether to also run `npm i -g npm@latest` before `npm ci`.
- The precise construction of the D-09 regression symlink + the D-10 extra unit cases.
- Whether unit + integration share one matrix `test` target or integration gets its own.

### Deferred Ideas (OUT OF SCOPE)
- The branch-protection RULESET SWITCH + Release-PR workflow + clean public changelog -> Phase 7. Phase 6 only DEFINES the `ci` required-check NAME.
- OpenSSF Scorecard, StepSecurity harden-runner, CodeQL, signed commits/tags -> later.
- Nx community-registry-listing PR -> post-publish human follow-up.
- A dedicated `e2e` Nx target on the e2e projects -> possible later refactor.
- A full 5-type matrix duplicated under pnpm -> rejected (no new signal).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-03 | Executor validated across all five project types: application, local (non-buildable) library, buildable library, publishable library, spec tsconfig | The 5-target `consumer-workspace` fixture + `matrix-e2e` project (Standard Stack / Architecture Patterns below); OQ-1 resolved -- buildable/publishable build targets are hand-authored WITHOUT `@nx/angular` (Nx never resolves a sibling target's executor when running `angular-typecheck`) |
| CI-01 | GitHub Actions runs unit + integration on Node 22/24/26 x Linux/Windows/macOS matrix (free public runners); heavy e2e gate Linux-only | The `ci.yml` workflow (jobs: `test` 3x3 matrix + `e2e` Linux-only + `ci` aggregate gate); action SHAs verified; runner OS/arch verified; corepack/pnpm fact verified |
| OUT-02 | Diagnostics filtered on absolute realpath-normalized `fileName` (pnpm-symlink / case-insensitive-FS safe) -- the property the pnpm fixture + mixed-case assertion BACKSTOP | pnpm fixture (D-09) exercises realpath through `.pnpm/` symlinks; D-10 mixed-case unit + integration assertions; B-02 resolved -- pnpm top-level `node_modules/<pkg>` IS a symlink into `.pnpm/`, realpath crosses into the store |

> OUT-02 is closed by Phase 3 (the filter logic). Phase 6's pnpm + mixed-case fixtures are its cross-platform REGRESSION BACKSTOP, not its primary validation.
</phase_requirements>

## Summary

Phase 6 is the slow gating backstop: it does not add product capability -- it proves the already-built executor + package work across the real platform/PM/project-type surface and locks a CI gate. The CONTEXT.md 2-researcher synthesis (D-01..D-10) is sound and was re-validated against live sources in this session. Two flagged open questions are now RESOLVED with HIGH confidence:

- **OQ-1 (hand-author buildable/publishable build targets WITHOUT `@nx/angular`):** VIABLE. Nx 23.0.1's `normalizeTarget` wraps the only graph-time executor resolution (`getExecutorInformation`, reading `schema.continuous`) in a `try/catch` that explicitly ignores a missing executor ("We could throw an error here, but it would be better to just ignore it" -- `nx/dist/src/project-graph/utils/project-configuration/target-normalization.js:53-64`). At RUN time, `nx run <proj>:angular-typecheck` resolves ONLY that target's executor (`run.js` `parseExecutorAndTarget`), never the sibling `build` target. `ng-packagr` is not installed in this workspace and need not be. So a `build` target referencing `@nx/angular:package`/`:ng-packagr-lite` is a purely structural marker that distinguishes buildable/publishable from local libs -- no `@nx/angular` dep, so the Phase-5 B-03 clean-install honesty invariant is preserved. The planner should still keep the OQ-1 spike (clean `npm install` of the shaped fixture FIRST) as a cheap confirmation gate before locking the 5-type fixture.
- **B-02 (pnpm `.pnpm/` symlink resolves through realpath):** CONFIRMED at the mechanism level. pnpm's top-level `node_modules/<pkg>` IS a symlink into `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>`, and Node resolves symlinks to their real location (pnpm docs: "node ignores symlinks ... resolves to its real location"). So `includeDeps:true` over an installed package genuinely traverses `.pnpm/`. CAVEAT (new landmine -- see Pitfalls): the realpath-crossing regression-guard CANNOT be authored/probed on the Windows arm64 dev box -- a probe in this session showed Git Bash `ln -s` produced a COPY (`isSymbolicLink:false`, realpath did not cross), because Windows symlinks need elevated privileges/Developer Mode. The D-09 construction must be validated on the Linux CI runner (the gate is Linux-only anyway). Keep the realpath UNIT coverage (`filter-diagnostics.spec.ts`) as the load-bearing guard; the e2e fixture is the integration backstop.

**Primary recommendation:** Implement exactly per D-01..D-10. Add `ci.yml` with three jobs (`test` 3x3 matrix, `e2e` Linux-only, `ci` aggregate gate named `ci`). Build the `angular-typechecker-matrix-e2e` project by cloning `install-e2e` verbatim, with ONE `consumer-workspace` fixture carrying 5 hand-authored project types (no `@nx/angular` dep) installed once from the packed tarball, plus ONE pnpm fixture. Extend `filter-diagnostics.spec.ts` + add one host-derived `useCaseSensitiveFileNames` integration assertion for the mixed-case criterion. Introduce NO new npm package into the root manifest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-OS / cross-Node correctness of the CJS->ESM `import()` bridge + path separators | CI runner matrix (`test` job) | -- | The bug class only manifests across OS/Node; a 3x3 matrix is the only tier that exercises it |
| Project-type structural correctness (5 types resolve a `tsConfig`, executor runs) | e2e tarball-install fixture (`matrix-e2e`) | Nx project graph (fixture `nx.json`) | The executor reads each project's `tsConfig`; type differentiation is structural in `project.json` |
| pnpm symlinked-store traversal + realpath boundary | e2e fixture (Linux-only) | core filter (`filter-diagnostics.ts`) | Symlink layout is a real-FS property; the filter's realpath logic is the unit-tested core it backstops |
| Case-insensitive-FS fold (mixed-case path) | unit tier (`filter-diagnostics.spec.ts`, all 3 OS) | integration tier (host-derived `useCaseSensitiveFileNames`, all 3 OS) | The fold only bites on macOS/Windows; the e2e gate is Linux-only so it would be dead code there |
| The merge/publish gate contract | aggregate `ci` job | Phase 7 branch-protection ruleset | A single stable check name is the only thing a ruleset can require without per-cell admin wiring |

## Standard Stack

This phase installs NO new npm package into the root manifest. The "stack" is the CI action set + the already-pinned toolchain. All versions verified live this session.

### Core (CI actions + provisioning)
| Tool | Version / SHA | Purpose | Why Standard |
|------|---------------|---------|--------------|
| `actions/checkout` | `93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1` | Repo checkout | `[VERIFIED: GitHub API]` tag `v5.0.1` resolves to this exact SHA; REUSE release.yml's pin so Dependabot bumps both in lockstep (D-05). Latest major is v7.0.0 -- adopting it is fine, Dependabot converges. |
| `actions/setup-node` | `a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0` | Node provisioning + npm cache | `[VERIFIED: GitHub API]` tag `v5.0.0` resolves to this exact SHA; `cache: npm` keyed on `package-lock.json`. Latest major is v6.4.0. |
| `pnpm/action-setup` | `008330803749db0355799c700092d9a85fd074e9 # v6.0.9` (or major-tag `v6` = `b0f76dfb45f55f8421693e4803ac7bb65143bd34`) | pnpm provisioning for the Linux-only pnpm fixture | `[VERIFIED: GitHub API]` SHA-pin to match the hardening envelope. Corepack is removed from Node 25+, so this is the durable path. |
| `pnpm` | `11.9.0` (latest; pin a `version:` matching the committed fixture lockfile) | The pnpm fixture's package manager | `[VERIFIED: npm registry]` `npm view pnpm version` = 11.9.0. pnpm auto-switches to frozen-lockfile in CI. |

### Supporting (already pinned -- no change)
| Tool | Version | Purpose | Verified |
|------|---------|---------|----------|
| `nx` / `@nx/devkit` / `@nx/vitest` / `@nx/angular` | `23.0.1` | Workspace runtime + test executor + (structural-only) build-target executor names | `[VERIFIED: npm registry]` all `latest = 23.0.1` |
| `typescript` | `6.0.3` | peer | `[VERIFIED: npm registry]` `latest = 6.0.3` |
| `@angular/compiler-cli` | `22.0.4` | peer (engine) | `[VERIFIED: npm registry]` `latest = 22.0.4` |
| `vitest` | `4.1.9` | test runner | `[VERIFIED: npm registry]` `latest = 4.1.9` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `nx run-many` explicit project list | `nx affected` | Rejected (D-03): the `ci` gate must always run so its meaning is consistent; the e2e graph is tiny and `implicitDependencies:["angular-typechecker"]` makes everything affected anyway. |
| explicit-project-list e2e split | dedicated `e2e` Nx target | Runner-up (D-03); cleaner `nx run-many -t e2e` but a multi-file `project.json` edit. Deferred to a later refactor. |
| `pnpm/action-setup` | `corepack enable` | Rejected (D-06): corepack bundled only `14.19.0` up to (NOT incl) `25.0.0`; Node 26 has none. `[VERIFIED: corepack docs]` |
| SHA-pinned `# v5` | latest majors (checkout v7 / setup-node v6) | Either is fine; Dependabot converges. Reusing release.yml's exact SHAs keeps lockstep bumps. |

**Installation:** None. Phase 6 adds `ci.yml`, a new e2e Nx project + fixture workspace, and extends specs. No root devDependency is added.

## Package Legitimacy Audit

> Phase 6 installs NO external npm package into the published manifest or the root dev manifest. The only external supply-chain surface is GitHub Actions, all SHA-pinned and Dependabot-tracked (`github-actions` ecosystem, already configured in `.github/dependabot.yml`). The `consumer-workspace` + pnpm fixtures pin EXACT versions (mirroring `consumer-app`'s `package.json`) of already-vetted packages, and the `angular-typechecker` artifact is built from this repo's own source (no registry fetch).

| Artifact | Source | Verification | Disposition |
|----------|--------|--------------|-------------|
| `actions/checkout@93cb6e...` | GitHub Actions | SHA resolves from `v5.0.1` tag (GitHub API) | Approved -- reuse release.yml pin |
| `actions/setup-node@a0853c...` | GitHub Actions | SHA resolves from `v5.0.0` tag (GitHub API) | Approved -- reuse release.yml pin |
| `pnpm/action-setup@008330...` | GitHub Actions | SHA resolves from `v6.0.9` tag (GitHub API) | Approved -- SHA-pin + Dependabot |
| `angular-typechecker` tarball | this repo's `npm pack` of `dist/` | built fresh per-run (`nx build --skip-nx-cache`) | Approved -- not a registry fetch |
| fixture `package.json` deps (`@angular/*`, `nx`, `@nx/devkit`, `typescript`) | npm | EXACT pins mirroring `consumer-app` (Angular 22.0.4 / Nx 23.0.1 / TS 6.0.3) | Approved -- already-vetted locked stack |

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages introduced).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                          PR / push to main
                                 |
            +--------------------+--------------------+
            |                                         |
        [job: test]  (matrix 3 Node x 3 OS, fail-fast:false)   [job: e2e]  (ubuntu-latest, Node 24)
        for each {22,24,26} x {ubuntu,windows,macos}:          NX_DAEMON=false
          checkout (persist-credentials:false)                 checkout -> setup-node (cache:npm)
          setup-node node-version=${matrix.node} cache:npm     pnpm/action-setup (SHA-pinned)
          npm ci   (honors root .npmrc legacy-peer-deps)       npm ci
          npx nx run-many -t test -p angular-typechecker       npx nx run-many -t test -p \
            (unit .spec.ts [jsdom] + *.integration.spec.ts       angular-typechecker-install-e2e \
             real-compiler, incl. D-10 mixed-case)               angular-typechecker-cache-e2e \
            |                                                     angular-typechecker-matrix-e2e
            |                                                       |
            |                                       matrix-e2e: nx build --skip-nx-cache -> npm pack
            |                                         -> ONE consumer-workspace install (npm, 5 targets)
            |                                         -> it.each over 5 project types: green + TS2322
            |                                         -> ONE pnpm fixture: pnpm add <tgz>, includeDeps
            |                                            green/red + realpath regression-guard
            +--------------------+--------------------+
                                 |
                          [job: ci]  needs:[test,e2e]  if:always()  runs-on:ubuntu-latest
                          fail unless contains(needs.*.result,'failure'|'cancelled')
                                 |
                          <- Phase 7 "Default branch" ruleset requires this exact check name `ci`
```

### Recommended Project Structure (new artifacts)
```
.github/workflows/
  ci.yml                          # NEW: test matrix + e2e + ci gate (matches release.yml hardening)
e2e/angular-typechecker-matrix-e2e/   # NEW Nx project (clone of install-e2e shape)
  project.json                    # @nx/vitest:test target, implicitDependencies:["angular-typechecker"], tags:["scope:fixture"]
  vitest.config.mts               # CLONE install-e2e verbatim (forks/singleFork/no-parallel/300000 timeouts/node env)
  tsconfig.json / tsconfig.spec.json
  src/
    matrix-5types.int.spec.ts     # install tarball ONCE into tmp consumer-workspace, it.each over 5 targets
    pnpm-symlink.int.spec.ts      # pnpm add <tgz> into tmp; symlinked-layout run + realpath regression-guard
  fixtures/consumer-workspace/    # ONE multi-project fixture (self-contained: own nx.json, no tsconfig.base.json)
    nx.json                       # PUBLISHED executor-id targetDefault (copy consumer-app/nx.json)
    package.json                  # EXACT pins (Angular 22.0.4 / Nx 23.0.1 / TS 6.0.3); NO @nx/angular
    apps/app/{project.json,tsconfig.app.json,src/...}
    libs/local-lib/{project.json,tsconfig.lib.json,src/...}        # no build target
    libs/buildable-lib/{project.json,tsconfig.lib.json,ng-package.json,src/...}   # build: @nx/angular:ng-packagr-lite (never run)
    libs/publishable-lib/{project.json,tsconfig.lib.json,ng-package.json,package.json,src/...}  # build: @nx/angular:package + importPath
    # spec-tsconfig type = a target whose tsConfig points at a tsconfig.spec.json (distinct file set)
packages/angular-typechecker/src/core/
  filter-diagnostics.spec.ts      # EXTEND (D-10 mixed-case unit cases)
  run-typecheck.integration.spec.ts  # EXTEND (one host-derived useCaseSensitiveFileNames assertion)
```

### Pattern 1: The 5 project-type shapes (Nx 23 / Angular 22)
**What:** Each type is distinguished STRUCTURALLY in `project.json` + tsconfig; the executor only reads `tsConfig`.
**When to use:** The single `consumer-workspace` fixture.
```jsonc
// app  (template on consumer-app)
{ "projectType": "application",
  "targets": { "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "apps/app/tsconfig.app.json", "includeDeps": true } } } }

// local non-buildable lib  (mirror libs/typecheck-consumer -- NO build target)
{ "projectType": "library",
  "targets": { "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "libs/local-lib/tsconfig.lib.json", "includeDeps": true } } } }

// buildable lib  (add a build target -- STRUCTURAL marker only, NEVER run)
{ "projectType": "library",
  "targets": {
    "build": { "executor": "@nx/angular:ng-packagr-lite",
      "options": { "project": "libs/buildable-lib/ng-package.json" } },   // executor never resolved (OQ-1)
    "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
      "options": { "tsConfig": "libs/buildable-lib/tsconfig.lib.json", "includeDeps": true } } } }

// publishable lib  (build = @nx/angular:package + importPath + per-lib package.json + ng-package.json)
{ "projectType": "library",
  "targets": {
    "build": { "executor": "@nx/angular:package",
      "options": { "project": "libs/publishable-lib/ng-package.json" } },  // executor never resolved (OQ-1)
    "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
      "options": { "tsConfig": "libs/publishable-lib/tsconfig.lib.json", "includeDeps": true } } } }

// spec tsconfig type  (a target whose tsConfig is a tsconfig.spec.json -- the file set the app/lib
// targets EXCLUDE; genuinely distinct check baseline)
{ "targets": { "angular-typecheck-spec": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "libs/local-lib/tsconfig.spec.json", "includeDeps": true } } } }
```
`ng-package.json` minimal shape: `{ "$schema": "../../node_modules/ng-packagr/ng-package.schema.json", "dest": "../../dist/<lib>", "lib": { "entryFile": "src/index.ts" } }`. It is never validated because `build` never runs; `$schema` may be omitted to avoid a missing-file note.

**Source:** `[VERIFIED: Nx 23.0.1 source]` executor names `@nx/angular:ng-packagr-lite` and `@nx/angular:package` confirmed via `node_modules/@nx/angular/executors.json`. Tier ownership + run-time resolution via `nx/dist/src/command-line/run/run.js` + `.../project-configuration/target-normalization.js:52-64`.

### Pattern 2: Aggregate gate job (the Phase-7 required check)
```yaml
ci:
  needs: [test, e2e]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: Gate
      run: |
        if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
          echo "A required job failed or was cancelled"; exit 1
        fi
```
**Why this form:** `needs.*.result` aggregates ALL matrix cells `[VERIFIED: GitHub docs]`; `contains(..., 'failure')` is true if even one of the 9 `test` cells failed. Do NOT use `needs.test.result != 'success'` -- under `fail-fast:false` the job-level result can read `success` if any single cell passed. Note: a needed job's result can also be `skipped`; for `needs:[test,e2e]` (both always reachable) `skipped` does not occur, but if the e2e split changes, add `|| contains(needs.*.result, 'skipped')`.

### Pattern 3: Reuse the install-e2e harness verbatim
**What:** Clone `vitest.config.mts` (serialized: `pool:'forks'`, `singleFork:true`, `fileParallelism:false`, `sequence.concurrent:false`, `environment:'node'`, 300000 timeouts) + `buildCleanEnv` (strips the 8 `NX_*` runner vars + both legacy-peer-deps env forms; sets `NX_DAEMON='false'`, `FORCE_COLOR='0'`) + the `nx build --skip-nx-cache` -> `npm pack --json` -> `cpSync` fixture into `mkdtempSync(tmpdir())` -> install -> `run(cwd)` flow.
**Source:** `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` (read this session).

### Anti-Patterns to Avoid
- **Mixed-case assertion in the Linux-only e2e gate:** dead code on a case-sensitive FS (D-10). Put it in the all-3-OS unit + integration tier.
- **Five independent per-type fixtures:** pays the Angular+Nx install cost 5x for no extra signal; the type logic is PM/OS-independent (D-07).
- **A second full Angular+Nx install under pnpm:** the Linux-only serialized gate cannot afford it; the type breakdown is PM-independent (D-09).
- **Adding `@nx/angular` to the fixture deps to carry build targets:** re-introduces the Angular-22-vs-`@nx/angular`-23 peer mismatch and burns the B-03 honesty signal. Hand-author the build targets (OQ-1).
- **Piping `nx` through `head`/`rg`:** the pipe tail's exit code masks Nx's; capture full stdout and assert on the token.
- **`--no-color` CLI flag on `nx run`:** Nx forwards it as `color:false` into executor options -> `additionalProperties:false` rejects it. Use `FORCE_COLOR=0`/`NO_COLOR=1` env.
- **`git checkout`/`git -C` to restore mutated fixture files:** use a `.pristine` byte-restore or operate on a discarded tmp copy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Required-check across dynamic matrix cell names | A script enumerating each cell's check name for branch protection | ONE aggregate `ci` job + `needs.*.result` | Cell names are dynamic/unstable; only a single stable name can be required without per-cell admin wiring (D-02) |
| pnpm provisioning on Node 26 | `corepack enable` + version juggling | `pnpm/action-setup` (SHA-pinned) | corepack removed from Node 25+ (D-06) |
| Cross-OS Nx cache restore across 9 cells | Hand-rolled `actions/cache` for `.nx/cache` | `setup-node` `cache: npm` (built-in) + within-job Nx caching | Fragile cross-OS keys for a 3-project graph; e2e specs use `--skip-nx-cache` anyway (D-04) |
| Serialized e2e config | A bespoke per-project vitest config | Clone `install-e2e/vitest.config.mts` verbatim | The serialization knobs are already hardened (D-08/D-21) |
| Clean-env for nested `nx run`/`npm install` | Ad-hoc env deletion | `buildCleanEnv` (Phase-4 pattern) | Strips the exact 8 `NX_*` runner vars + legacy-peer-deps forms that corrupt nested runs |

**Key insight:** Phase 6 is almost entirely composition of existing hardened patterns (install-e2e harness, release.yml envelope, Phase-4 `buildCleanEnv`). The only genuinely new construction is the 5-type fixture shapes and the pnpm regression-guard -- both validated above.

## Runtime State Inventory

> Phase 6 adds CI config + test fixtures + spec extensions. It is not a rename/migration. The relevant "state" is CI-side and cross-phase contract state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no datastore touched. Verified: phase only adds workflow YAML + Nx fixtures + specs. | none |
| Live service config | The required-status-check name `ci` is consumed by Phase 7's GitHub "Default branch" ruleset (lives in repo settings, NOT git). Renaming `ci` later silently breaks branch protection. | LOCK the job name `ci`; document the cross-phase contract |
| OS-registered state | None. | none |
| Secrets/env vars | CI uses NO secrets (no `registry-url`, no `NODE_AUTH_TOKEN` -- those are release.yml-only for OIDC). `legacy-peer-deps=true` is read from the committed root `.npmrc` by `npm ci`; the e2e fixtures must NOT inherit it (B-03 -- strip via empty `.npmrc` + non-existent `npm_config_userconfig`). | none new; preserve the strip pattern |
| Build artifacts | `matrix-e2e` packs a fresh `dist/` per run; `npm pack` writes a `.tgz` under `dist` -- remove it in `afterAll` (WR-02). | teardown in spec (clone install-e2e) |

## Common Pitfalls

### Pitfall 1: Windows symlink construction silently produces a copy (NEW -- found this session)
**What goes wrong:** Authoring/probing the D-09 pnpm realpath regression-guard on the Windows arm64 dev box yields a non-symlink (`fs.lstatSync(p).isSymbolicLink() === false`), so realpath never crosses a boundary and the "guard" is dead.
**Why it happens:** Windows symlinks require elevated privileges or Developer Mode; Git Bash `ln -s` falls back to copying. Confirmed by a probe this session.
**How to avoid:** Construct/validate the regression-guard on the LINUX CI runner (the gate is Linux-only). Add a small in-spec probe that asserts the constructed path is actually a symlink AND its realpath crosses out of `basePath` BEFORE asserting filter behavior; if pnpm's layout does not produce a boundary-crossing realpath, fall back to asserting the symlinked layout simply WORKS (D-09 option a) and keep the realpath UNIT coverage as the load-bearing guard (B-02 resolution).
**Warning signs:** A pnpm guard that passes on the dev box but is meaningless; `isSymbolicLink:false` in a probe.

### Pitfall 2: Aggregate gate reads `success` when one cell passed
**What goes wrong:** `if: needs.test.result != 'success'` lets the `ci` gate go green even when a matrix cell failed (under `fail-fast:false`).
**How to avoid:** Use `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` (D-02).
**Warning signs:** A red cell with a green `ci` check.

### Pitfall 3: A no-op executor run exits 0 (a lying check)
**What goes wrong:** A green run that did not actually type-check passes the "green" assertion.
**How to avoid:** The green+`TS2322` pairing for every project type -- a deliberate injected error must produce non-zero + the rendered `TS2322` token + NO `ERR_REQUIRE_ESM` + NO "infrastructure error" (the 4-way assertion from install-smoke). Assert the full `TS2322` token, never a bare `2322` substring.

### Pitfall 4: Stale dist packed
**What goes wrong:** Packing a stale `dist/` smoke-tests a stale artifact.
**How to avoid:** `nx build angular-typechecker --skip-nx-cache` in `beforeAll` before `npm pack` (install-e2e pattern).

### Pitfall 5: Leaked legacy-peer-deps masks a real consumer ERESOLVE
**What goes wrong:** The fixture install inherits `legacy-peer-deps=true`, hiding a real consumer peer-resolution failure (B-03).
**How to avoid:** Empty `.npmrc` in the tmp workspace + `npm_config_userconfig` -> a non-existent path + strip the env forms in `buildCleanEnv`. A clean install must honestly succeed or ERESOLVE. If a hand-authored fixture ERESOLVEs in a way hand-authoring cannot avoid, ESCALATE (do NOT auto-add the override) per OQ-1.

### Pitfall 6: Node 26 churn
**What goes wrong:** Node 26 is Current/non-LTS until ~Oct 2026; occasional behavior churn.
**How to avoid:** Accept it -- 26 is inside `engines`, so testing it is correct and forward-looking (D-01). `fail-fast:false` keeps a 26-only flake from masking other cells.

## Code Examples

### `ci.yml` skeleton (matches release.yml hardening)
```yaml
# Source: composed from .github/workflows/release.yml (verified) + D-01..D-06
name: ci

on:
  pull_request: {}
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    env:
      NX_DAEMON: false
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: ${{ matrix.node }}   # NO architecture pin -> native arm64 on macos-latest
          cache: npm
      - run: npm ci                          # honors committed .npmrc legacy-peer-deps
      - run: npx nx run-many -t test -p angular-typechecker

  e2e:
    runs-on: ubuntu-latest
    env:
      NX_DAEMON: false
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 24
          cache: npm
      - uses: pnpm/action-setup@008330803749db0355799c700092d9a85fd074e9 # v6.0.9
        with:
          version: 11.9.0                    # match the committed fixture pnpm-lock.yaml
      - run: npm ci
      - run: >
          npx nx run-many -t test
          -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e

  ci:
    needs: [test, e2e]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Gate
        run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
            echo "A required job failed or was cancelled"; exit 1
          fi
```
> Discretion: split `e2e` into `install-e2e` + `matrix-e2e` jobs for finer granularity if desired -- both feed the single `ci` gate via `needs`. Optionally `npm i -g npm@latest` before `npm ci` for parity with release.yml.

### Install the tarball under pnpm in a tmp dir (D-09)
```ts
// Source: pnpm docs (verified) + install-smoke pattern
// after nx build --skip-nx-cache -> npm pack --json -> tarballPath
const tmp = mkdtempSync(join(tmpdir(), 'atc-pnpm-'));
cpSync(pnpmFixtureDir, tmp, { recursive: true });
writeFileSync(join(tmp, '.npmrc'), '');                 // B-03: no inherited peer override
execSync(`pnpm add ${JSON.stringify(tarballPath)} --no-frozen-lockfile`, { cwd: tmp, env });
// PROBE (run on Linux CI): assert the installed package path is a symlink whose realpath
// crosses into .pnpm/ BEFORE asserting filter behavior (Pitfall 1 / B-02).
```

### D-10 host-derived useCaseSensitiveFileNames (integration tier)
```ts
// Source: packages/.../core/run-typecheck.ts (verified): the filter's
// useCaseSensitiveFileNames comes from result.program.getTsProgram().useCaseSensitiveFileNames()
// and realpath from ts.sys.realpath. Add to run-typecheck.integration.spec.ts
// (already runs the real compiler against committed fixtures, all 3 OS).
// On macos/windows legs this is a real case-insensitive exercise; on Linux, case-sensitive.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `corepack enable` for pnpm in CI | `pnpm/action-setup` | Node 25.0.0 (corepack unbundled) | `[VERIFIED: corepack docs]` Node 26 has no corepack; D-06 is correct |
| Unpinned `actions/*@v4` (reference clones nx-verdaccio/analog) | Full 40-char SHA pins + Dependabot | tj-actions incident era | `[CITED: release.yml threat model]` mutable-tag repoint was the attack vector |
| `nx affected` in CI | `nx run-many` explicit list for a gate | -- | A gate must always run for a consistent `ci` meaning (D-03) |

**Deprecated/outdated:**
- nx-verdaccio's `.eslintrc.json` + unpinned `@v4` actions: Nx-22-era; this repo uses flat config + SHA pins. Do not copy verbatim.
- The Phase-5.1 "drop registry-url on 404" contingency: WRONG for npm >= 11.5.1; irrelevant to CI (no registry-url in `ci.yml` anyway, D-04).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pinning `pnpm` `version: 11.9.0` matches a committed fixture `pnpm-lock.yaml` | Standard Stack / ci.yml | Low -- if the lockfile is generated at a different pnpm version, use `--no-frozen-lockfile` for the tmp install (D-06 already allows). Validate at execution. |
| A2 | `ng-packagr` `$schema` path in `ng-package.json` is non-load-bearing because `build` never runs | Pattern 1 | Low -- if Nx validates `ng-package.json` at graph time (it does not; OQ-1 confirms try/catch), omit `$schema`. Confirm in the OQ-1 spike. |
| A3 | The spec-tsconfig 5th type is exercised by pointing a target's `tsConfig` at a `tsconfig.spec.json` with a distinct file set | Pattern 1 | Low -- the existing `tsconfig.spec.json` shape (install-e2e) confirms the distinct file set; verify the spec tsconfig includes `*.spec.ts` + test ambient types and the app/lib targets exclude them. |

> A1-A3 are LOW-risk execution-time confirmations, not architectural unknowns. OQ-1 and B-02 (the two CONTEXT-flagged questions) are RESOLVED above with HIGH confidence and are NOT assumptions.

## Open Questions

1. **D-09 pnpm regression-guard exact symlink construction (was B-02)**
   - What we know: pnpm top-level `node_modules/<pkg>` IS a symlink into `.pnpm/`; Node resolves to real location (mechanism confirmed).
   - What's unclear: whether the SPECIFIC in-project source construction produces a realpath that a non-realpath `startsWith` filter would mis-suppress, on the actual installed Linux layout.
   - Recommendation: in-spec probe on Linux CI (assert symlink + boundary-crossing realpath) BEFORE the filter assertion; fall back to "symlinked layout works" + lean on the realpath UNIT coverage (Pitfall 1).

2. **OQ-1 clean-install spike (RESOLVED in principle; keep the cheap gate)**
   - What we know: Nx never resolves a sibling target's executor when running `angular-typecheck` (HIGH confidence, source-verified); no `@nx/angular` dep needed.
   - What's unclear: only whether a clean `npm install` of the fully-shaped fixture ERESOLVEs for an unrelated reason.
   - Recommendation: planner runs a clean `npm install` of the shaped fixture FIRST; if it ERESOLVEs in a way hand-authoring cannot avoid, ESCALATE the remediation (scope override to that one fixture w/ rationale vs widen vs await `@nx/angular` 23.1.x) -- do NOT auto-patch (preserves B-03).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub-hosted ubuntu-latest | `test`/`e2e`/`ci` jobs | (CI) Ubuntu 24.04 x64 | n/a | -- |
| GitHub-hosted windows-latest | `test` matrix | (CI) Windows 2025 x64 | n/a | -- |
| GitHub-hosted macos-latest | `test` matrix | (CI) macOS arm64 (M1) | n/a | -- |
| Node 22/24/26 | matrix legs | all ship osx-arm64/linux-x64/win-x64 builds | 22.23.1 / 24.18.0 / 26.4.0 | -- |
| pnpm | pnpm fixture (Linux job) | via `pnpm/action-setup` | 11.9.0 | `--no-frozen-lockfile` if lockfile pnpm version differs |
| Windows symlink (dev-box authoring of D-09) | local probing only | NO (needs elevated/Dev Mode) | -- | author/validate the guard on Linux CI |

**Missing dependencies with no fallback:** none (all CI-provided).
**Missing dependencies with fallback:** local symlink authoring -> do it on Linux CI (Pitfall 1).

## Validation Architecture

> Derives the Nyquist VALIDATION.md. nyquist_validation is treated as enabled (config key absent).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x via `@nx/vitest:test` |
| Config file | per-project `vitest.config.mts` (plugin: jsdom env; e2e: cloned serialized node-env config) |
| Quick run command | `npx nx run-many -t test -p angular-typechecker` (unit + integration, fast) |
| Full suite command (matrix) | `npx nx run-many -t test -p angular-typechecker` per cell |
| Full suite command (e2e gate) | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` |

### Test Layers
| Layer | Where | Validates | Runs On |
|-------|-------|-----------|---------|
| Unit | `packages/angular-typechecker/src/**/*.spec.ts` (jsdom) -- incl. extended `filter-diagnostics.spec.ts` (D-10 mixed-case) | OUT-02 case-fold + realpath-first + segment containment logic | every CI cell (9) |
| Integration | `packages/angular-typechecker/src/**/*.integration.spec.ts` (real compiler) -- incl. NEW host-derived `useCaseSensitiveFileNames` assertion (D-10) | real-compiler diagnostics; the host actually derives case-sensitivity per-OS (case-insensitive on mac/win legs) | every CI cell (9) |
| e2e (5-type) | `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` | TEST-03: executor runs against the INSTALLED tarball for all 5 project types | Linux-only `e2e` job |
| e2e (pnpm) | `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` | OUT-02 backstop: symlinked-store traversal + realpath regression-guard | Linux-only `e2e` job |
| e2e (carried) | install-e2e + cache-e2e | TEST-05 smoke, TEST-04 cache-correctness (already complete) | Linux-only `e2e` job |
| CI infra | the `ci.yml` workflow itself | CI-01: matrix runs + aggregate gate | GitHub Actions |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | Layer | File Exists? |
|--------|----------|-----------|-------------------|-------|-------------|
| TEST-03 | app type-checks from installed tarball | e2e | `nx run-many -t test -p angular-typechecker-matrix-e2e` | e2e 5-type | Wave 0 |
| TEST-03 | local non-buildable lib | e2e | (same; `it.each`) | e2e 5-type | Wave 0 |
| TEST-03 | buildable lib | e2e | (same) | e2e 5-type | Wave 0 |
| TEST-03 | publishable lib | e2e | (same) | e2e 5-type | Wave 0 |
| TEST-03 | spec tsconfig | e2e | (same) | e2e 5-type | Wave 0 |
| TEST-03 / OUT-02 | pnpm symlinked-store run + realpath guard | e2e | (same; pnpm spec) | e2e pnpm | Wave 0 |
| OUT-02 | mixed-case fold (unit) | unit | `nx run-many -t test -p angular-typechecker` | unit (all 9 cells) | EXTEND existing |
| OUT-02 | host-derived case sensitivity (integration) | integration | (same) | integration (all 9 cells) | EXTEND existing |
| CI-01 | unit+integration on 3 Node x 3 OS | CI | the `test` matrix in `ci.yml` | CI infra | Wave 0 (ci.yml) |
| CI-01 | heavy e2e Linux-only | CI | the `e2e` job in `ci.yml` | CI infra | Wave 0 (ci.yml) |
| CI-01 | full matrix green + required gate | CI | the `ci` aggregate job | CI infra | Wave 0 (ci.yml) |

### Nyquist Sample Points
- **5 project types x install path** (5 samples): app, local lib, buildable lib, publishable lib, spec tsconfig -- each green + injected-`TS2322`, against the once-installed npm tarball (e2e 5-type).
- **pnpm symlink case** (1 sample): one pnpm install of the tarball; symlinked-layout green/red + realpath regression-guard (e2e pnpm, Linux).
- **mixed-case case** (2 samples): unit (`filter-diagnostics.spec.ts`, `useCaseSensitiveFileNames:false` mixed-case in-project/out-of-project/node_modules-segment) + integration (host-derived case sensitivity) -- both run on ALL 9 cells, so the macOS+Windows legs are the live case-insensitive samples.
- **9 CI matrix cells** (9 samples): {22,24,26} x {ubuntu,windows,macos}, `fail-fast:false`, each running unit+integration.
- **aggregate gate** (1 sample): the `ci` job -- green iff all 9 `test` cells AND the `e2e` job succeeded; this is the single sample Phase 7's ruleset requires.

### Which layer validates which requirement
- **TEST-03** -> e2e 5-type + e2e pnpm layers (Linux-only `e2e` job).
- **CI-01** -> CI infra layer (the `test` matrix + `e2e` job + `ci` aggregate gate in `ci.yml`).
- **OUT-02** (backstop) -> unit + integration layers (all 9 cells, mixed-case) + e2e pnpm layer (realpath guard).

### Sampling Rate
- **Per task commit:** `npx nx run-many -t test -p angular-typechecker` (fast unit+integration).
- **Per wave merge:** add the e2e project list on Linux.
- **Phase gate:** the full `ci.yml` matrix green (all 9 `test` cells + `e2e`) -> the `ci` job green.

### Wave 0 Gaps
- [ ] `.github/workflows/ci.yml` -- covers CI-01
- [ ] `e2e/angular-typechecker-matrix-e2e/{project.json,vitest.config.mts,tsconfig.json,tsconfig.spec.json}` -- new Nx project (clone install-e2e)
- [ ] `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/**` -- the 5-type fixture (nx.json, package.json, 4 projects + spec target)
- [ ] `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` -- TEST-03 5-type
- [ ] `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` + committed `pnpm-lock.yaml` -- OUT-02 pnpm
- [ ] EXTEND `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` -- D-10 mixed-case unit cases
- [ ] EXTEND `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` -- D-10 host-derived case-sensitivity
- [ ] (OQ-1 spike) clean `npm install` of the shaped fixture before locking it

*Framework already installed; no framework install gap.*

## Security Domain

> `security_enforcement` treated as enabled. Phase 6 is CI + test infra; the security surface is supply-chain + CI workflow hardening, NOT application input handling.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CI uses no secrets; OIDC auth is release.yml-only |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | top-level `permissions: { contents: read }`; no job re-grants write; no `pull_request_target` |
| V5 Input Validation | yes (CI-context) | no untrusted PR field interpolated into a `run:` step; fixed target ids/flags only in specs (no untrusted string to shell) |
| V6 Cryptography | no | n/a |
| V14 Configuration (supply chain) | yes | full 40-char SHA-pinned actions + Dependabot `github-actions`; `persist-credentials: false`; `concurrency` cancel-in-progress |

### Known Threat Patterns for {GitHub Actions CI for a published npm plugin}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Untrusted PR title/branch injected into a privileged `run:` | Elevation / Tampering | `pull_request` (not `pull_request_target`); read-only default perms; never interpolate PR fields into `run:` (matches release.yml threat model) |
| Mutable action tag repointed to malicious code (tj-actions) | Tampering | full SHA pins + Dependabot lockstep with release.yml |
| Checkout credential persisted + leaked via artifact/log | Information Disclosure | `persist-credentials: false` on every checkout |
| A malicious tarball install runs a postinstall in CI | Tampering / Elevation | the fixture installs THIS repo's freshly-packed tarball (Phase-5 audit already asserts no install scripts); no third-party registry fetch |
| Over-privileged CI token | Elevation | top-level `contents: read`; the `test`/`e2e`/`ci` jobs need no write |

## Sources

### Primary (HIGH confidence)
- Nx 23.0.1 installed source: `node_modules/nx/dist/src/project-graph/utils/project-configuration/target-normalization.js` (lines 52-64, the try/catch that ignores a missing executor at graph time) and `.../command-line/run/run.js` (`parseExecutorAndTarget` -- per-target run-time resolution). Resolves OQ-1.
- `node_modules/@nx/angular/executors.json` -- confirms `ng-packagr-lite` + `package` executor names.
- `packages/angular-typechecker/src/core/run-typecheck.ts` + `filter-diagnostics.ts` + `filter-diagnostics.spec.ts` -- the OUT-02 realpath/case-fold seam (`useCaseSensitiveFileNames` from `result.program.getTsProgram()`, `realpath` from `ts.sys.realpath`).
- `e2e/angular-typechecker-install-e2e/{src/install-smoke.int.spec.ts,vitest.config.mts,project.json,fixtures/consumer-app/*}` + `e2e/angular-typechecker-cache-e2e/*` -- the harness to clone.
- `.github/workflows/release.yml` + `.github/dependabot.yml` -- the hardening envelope + SHA pins to reuse.
- GitHub API (`gh api`): `actions/checkout` `v5.0.1` -> `93cb6efe18208431cddfb8368fd83d5badbf9bfd`; `actions/setup-node` `v5.0.0` -> `a0853c24544627f65ddf259abe73b1d18a591444`; `pnpm/action-setup` `v6.0.9` -> `008330803749db0355799c700092d9a85fd074e9` (major `v6` -> `b0f76dfb...`). Latest majors checkout v7 / setup-node v6.
- npm registry (`npm view`): nx/@nx/* 23.0.1, typescript 6.0.3, @angular/compiler-cli 22.0.4, vitest 4.1.9, pnpm 11.9.0. nodejs.org dist index: node 22.23.1/24.18.0/26.4.0 all ship osx-arm64.
- GitHub docs -- hosted runners (ubuntu-latest=Ubuntu 24.04 x64, windows-latest=Windows 2025 x64, macos-latest=macOS arm64 M1 3-core); `needs.*.result` aggregates all matrix cells.
- corepack docs (github.com/nodejs/corepack) -- bundled 14.19.0 up to (NOT incl) 25.0.0.
- pnpm docs (symlinked-node-modules-structure) -- top-level `node_modules/<pkg>` is a symlink into `.pnpm/`; Node resolves to real location. Resolves B-02 mechanism.

### Secondary (MEDIUM confidence)
- `D:/projects/github/push-based/nx-verdaccio/.github/workflows/ci.yml` + `D:/projects/github/analogjs/analog/.github/workflows/ci.yml` -- real Nx-plugin CI matrix + pnpm + concurrency patterns (Nx-22-era; unpinned actions; this repo improves with SHA pins).

### Tertiary (LOW confidence)
- (none material -- all load-bearing claims verified against primary sources)

## Metadata

**Confidence breakdown:**
- Standard stack (action SHAs, versions, runner specs): HIGH -- verified via GitHub API + npm + official docs this session.
- Architecture (5-type fixture, OQ-1 no-@nx/angular): HIGH -- Nx 23.0.1 source-verified (try/catch + per-target run resolution).
- pnpm realpath guard (B-02): HIGH on mechanism (pnpm docs + Node symlink resolution); MEDIUM on the exact construction (must be validated on Linux CI -- Windows dev box cannot reproduce symlinks).
- Pitfalls: HIGH -- carried from Phase-4/5 LEARNINGS + one new (Windows symlink copy) found by probe this session.

**Research date:** 2026-06-29
**Valid until:** ~2026-07-29 (stable; action majors and Node 26 may move -- re-verify SHAs at execution if Dependabot has bumped release.yml).
