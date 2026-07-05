# Quick Task 260704-wnq: Add real `nx add` e2e coverage (pnpm + yarn) - Research

**Researched:** 2026-07-04
**Domain:** Nx 23 `nx add` package-manager orchestration; pnpm 11 build-script gate; yarn 4 (berry) registry auth; Verdaccio local-registry consumption
**Confidence:** HIGH (nx routing + pnpm gate + yarn http gate all reproduced empirically on this machine; a full yarn+Verdaccio round-trip was NOT stood up, so the yarn SUCCESS assertion must be observed by the executor)

## Summary

The current `nx-add-e2e.int.spec.ts` substitutes `nx g angular-typechecker:init` for the real
`nx add`, so nx add's package-manager orchestration is never exercised. This research traced nx
23.0.1's actual `add` command in `node_modules`, reproduced pnpm 11.9.0's ignored-builds gate,
and reproduced yarn 4.17.0's http-registry gate. The load-bearing corrections vs the handoff:
**pnpm v11 REMOVED `onlyBuiltDependencies`** (the exact key the handoff/anti-pattern names) and
replaced it with `allowBuilds` + `strictDepBuilds` -- which is precisely why the OSS repos'
allowlists did not stop `nx add` from failing. On pnpm 11 the gate fires whenever ANY unapproved
build-script dep is in the tree, independent of angular-typechecker.

**Primary recommendation:** Add two new specs in the existing `angular-typechecker-install-e2e`
project consuming the shared Verdaccio globalSetup. pnpm spec: a pnpm-11 workspace with an
unapproved build-script dep (esbuild) -> assert the REAL `nx add` FAILS with the
`ERR_PNPM_IGNORED_BUILDS` -> "Failed to install" signature (and optionally that the
`--ignore-scripts` / `allowBuilds` fallback succeeds). yarn spec: a yarn-4 workspace pointed at
Verdaccio -> assert the REAL `nx add` SUCCEEDS and seeds the `angular-typechecker:typecheck`
targetDefaults (mirror `verdaccio-publish.int.spec.ts`). Executor MUST observe the real command
output to finalize each assertion (per CONTEXT + the "test asserts reality" rule).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- REUSE the existing `angular-typechecker-install-e2e` globalSetup Verdaccio registry via
  `inject('verdaccioUrl')` / `inject('verdaccioToken')`; do NOT stand up a second registry.
- New specs are `src/*.int.spec.ts` in that SAME project (inherit serialized `singleFork`,
  `fileParallelism:false`, `node` env, 300000ms timeouts, shared globalSetup).
- Each spec runs the ACTUAL `nx add angular-typechecker` command (NOT `nx g ...:init`).
- pnpm: reproduce a real pnpm workspace with a build-script dep so the gate can fire; assert the
  OBSERVED behavior (failure signature, and/or the documented fallback succeeding).
- yarn: run real `nx add` in a yarn workspace at Verdaccio; assert observed outcome (expected
  success -> init -> `angular-typechecker:typecheck` targetDefaults seeded).
- Pin EXACT PM versions via corepack (`corepack prepare <pm>@<v> --activate` and/or a
  `packageManager` field). No yarn classic (1.x).
- Reuse `@workspace/test-util` (`buildCleanEnv({stripAllNpmConfig:true})`, `sh`, `run`,
  `findWorkspaceRoot`, `removeTmpDir`) exactly as sibling specs. `stripAllNpmConfig` is
  load-bearing (globalSetup sets `npm_config_registry` process-wide). Additionally point the PM's
  own config at Verdaccio (`.npmrc` for pnpm; `.yarnrc.yml npmRegistryServer` for yarn 4).

### Claude's Discretion
- Two spec files vs one parametrized (favor two clearly-named files).
- Whether to also cover npm's real `nx add` (bonus, only if cheap).

### Deferred (OUT OF SCOPE)
- README pnpm caveat (handoff task 1); optional upstream Nx issue (handoff task 3).

## Q1 -- Package manager versions (latest major, Angular 22 + Nx 23 + Node 22/24/26)

| PM | Latest major | Exact pinnable | Evidence |
|----|--------------|----------------|----------|
| pnpm | **11** | `11.10.0` (`latest`); `11.9.0` is what CI + this box already run | `registry.npmjs.org/-/package/pnpm/dist-tags`: `"latest":"11.10.0","latest-11":"11.10.0","latest-10":"10.34.3"` (fetched 2026-07-04) |
| yarn (berry) | **4** | `4.17.0` | `registry.npmjs.org/-/package/@yarnpkg/cli-dist/dist-tags`: `"latest":"4.17.0"`. NOTE the `yarn` npm package's `latest` is `1.22.22` (classic) -- berry 4.x is delivered via corepack, not the `yarn` npm dist-tag |

- Node here: `v24.18.0`; corepack `0.35.0` bundled and working. `corepack prepare yarn@4.17.0 --activate` succeeded; `corepack yarn --version` -> `4.17.0` [VERIFIED: local run].
- Nx 23 has no known-bad pnpm/yarn range; `getPackageManagerCommand` branches purely on
  `gte(version,'2.0.0')` for yarn-berry and `gte(version,'6.13.0')`/`lt('7.0.0')` for pnpm
  (`node_modules/nx/dist/src/utils/package-manager.js:114-183`). Both pnpm 11 and yarn 4 satisfy
  Node engines `^22.22.3 || ^24.15.0 || ^26.0.0`.
- **corepack caveat:** corepack ships with Node 22-24 but is REMOVED from Node 25+. The CI `e2e`
  job pins Node 24 (`.github/workflows/ci.yml:153`) so corepack is present there. pnpm is ALSO
  already on PATH in CI via `pnpm/action-setup@v6` `version: 11.9.0` (`ci.yml:155-157`); yarn is
  NOT provisioned in CI -> the yarn spec needs corepack (Node 24 has it) or a `corepack enable`
  step. **Recommendation:** match CI's pnpm (`11.9.0`, or bump action-setup to `11.10.0`) and pin
  yarn `4.17.0`; guard both specs to skip if corepack is unavailable (defensive for a Node-25+
  local run).

## Q2 -- How `nx add` detects the PM and routes the registry (nx 23.0.1, traced in node_modules)

`nx add <bare-name>` (`node_modules/nx/dist/src/command-line/add/add.js`):

1. `parsePackageSpecifier` splits on the LAST `@`; a bare `angular-typechecker` (not a core nx
   plugin) -> `version = 'latest'` (`add.js:108-119`).
2. `installPackage` -> `detectPackageManager()` + `getPackageManagerCommand(pm)` and builds the
   command (`add.js:34-43`):
   - yarn berry (`gte(pmv,'2.0.0')`) + `latest` -> `` `${pmc.addDev} ${pkgName}` `` (NO `@latest`
     suffix -- "if we explicitly specify latest in yarn berry, it won't resolve the version").
   - everything else -> `` `${pmc.addDev} ${pkgName}@${version}` ``.
3. Runs it via **`child_process.exec(command, { windowsHide: true })`** (`add.js:44`). Any non-zero
   exit -> `spinner.fail()` + `output.error({title: 'Failed to install ${pkgName}...'})` +
   `process.exit(1)` (`add.js:46-58`). [CORRECTION vs memory: it is async `exec`, not `execSync` --
   effect identical.] `exec` inherits the parent process env (incl. PATH) -- see Q6 PATH note.
4. On success -> `initializePlugin` -> `runPluginInitGenerator(pkgName, ...)` which constructs the
   VERBATIM `g <plugin>:init` internal command (`add.js:84-107`; the substitute spec already
   proves this half).

Detection (`package-manager.js:39-72`): `nxJson.cli.packageManager` override, else lockfile
precedence `bun.lock(b)` > `yarn.lock` > `pnpm-lock.yaml` > `package-lock.json`, else the
`npm_config_user_agent` env. So a fixture with a `pnpm-lock.yaml` -> pnpm; `yarn.lock` -> yarn.

`addDev` strings (`package-manager.js:133-134, 168-169, 190-191`):

| PM | `addDev` | Command nx add runs for our fixtures |
|----|----------|--------------------------------------|
| pnpm + `pnpm-workspace.yaml` present | `pnpm add -Dw` | `pnpm add -Dw angular-typechecker@latest` |
| pnpm, no workspace file | `pnpm add -D` | `pnpm add -D angular-typechecker@latest` |
| yarn berry | `yarn add -D` | `yarn add -D angular-typechecker` |
| npm | `npm install -D` | `npm install -D angular-typechecker@latest` |

**Registry routing:** `nx add` forwards NO registry/scope flags -- the PM reads its OWN config.
pnpm reads `.npmrc` (`registry=` + `//host/:_authToken=`); yarn 4 reads `.yarnrc.yml`
(`npmRegistryServer` + `npmAuthToken`). So `nx add <bare-name>` WILL resolve
`angular-typechecker@latest` from Verdaccio iff the fixture's PM config points there (CONTEXT's
offline premise holds). `nx add --help` exposes only `--version/--verbose/--updatePackageScripts`
-- you cannot pass `--ignore-scripts` or a registry THROUGH `nx add` [CONFIRMED, matches memory].

## Q3 -- pnpm ignored-builds gate (all reproduced on pnpm 11.9.0, Windows arm64, non-interactive)

Minimal deterministic repro: a pnpm workspace (`pnpm-workspace.yaml` with `packages:`) + a
build-script dep (`esbuild@0.24.0`) as a devDependency. Results [VERIFIED: local runs]:

| Scenario (`pnpm-workspace.yaml`) | `pnpm add -Dw esbuild` exit | Notes |
|----------------------------------|------------------------------|-------|
| no allowlist | **1** + `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild` | the gate; baseline |
| `--ignore-scripts` flag | **0** | documented fallback |
| `onlyBuiltDependencies: [esbuild]` (pnpm-10 key) | **1** (still fails) | **key removed in v11** |
| `pnpm.onlyBuiltDependencies` in package.json | **1** + `[WARN] The "pnpm" field in package.json is no longer read by pnpm` | dead in v11 |
| `allowBuilds: { esbuild: true }` (pnpm-11 key) | **0** | correct v11 approval |
| `strictDepBuilds: false` (pnpm-11 key) | **0** + Warning (builds ignored, not error) | |

**CORRECTION (load-bearing) vs handoff/anti-pattern:** the anti-pattern text says the fixture must
carry `onlyBuiltDependencies`. That key was **REMOVED in pnpm v11** and replaced by `allowBuilds`
(+ `strictDepBuilds`, default `true`) [CITED: pnpm.io/settings -- "The following settings have
been removed in v11 and replaced by `allowBuilds`: onlyBuiltDependencies,
onlyBuiltDependenciesFile, neverBuiltDependencies, ignoredBuiltDependencies, ignoreDepScripts";
"By default, an error is printed (strictDepBuilds defaults to true)"]. This is EXACTLY why
ngx-lottie "HAS an allowlist yet nx add still failed" -- its allowlist used the removed pnpm-10 key
that pnpm 11 ignores. On pnpm 11 the gate fires purely from the presence of any unapproved
build-script dep in the tree.

**CONFIRMED vs memory:** `pnpm add` (plain, unapproved builds) exits 1;`--ignore-scripts` -> 0;
error code is `ERR_PNPM_IGNORED_BUILDS`; `nx add` forwards no pnpm flags.
**Resolved apparent contradiction:** the handoff's "direct `pnpm add -Dw angular-typechecker@0.1.1`
exits 0" is not about angular-typechecker (it ships zero scripts) -- it reflects a tree state with
no unapproved builds; add an unapproved build-script dep and the same `pnpm add` exits 1.

**So the `nx add` failure chain (fixture with unapproved esbuild):** `nx add angular-typechecker`
-> `pnpm add -Dw angular-typechecker@latest` -> pnpm re-evaluates tree, esbuild build unapproved
-> `ERR_PNPM_IGNORED_BUILDS`, exit 1 -> nx add prints "Failed to install angular-typechecker" and
`process.exit(1)`. The pnpm spec asserts THIS (the failure occurs BEFORE init; the plugin itself
is sound).

**Setup wrinkle:** the fixture's OWN `pnpm install` also trips the gate (esbuild present). Use
`pnpm install --ignore-scripts` (exit 0) to provision node_modules + the `nx` binary + a
`pnpm-lock.yaml` (so detection -> pnpm), THEN run the real `nx add` for the assertion.

Optional success-path assertion (if the spec also proves the documented fallback): either add
`allowBuilds: { esbuild: true }` to `pnpm-workspace.yaml` so `nx add`'s `pnpm add` exits 0 and init
runs, OR skip `nx add` and assert `pnpm add -Dw angular-typechecker@latest --ignore-scripts` +
`nx g angular-typechecker:init` succeeds.

## Q4 -- yarn 4 (berry) setup + behavior

Corepack provisions yarn 4.17.0 (`corepack prepare yarn@4.17.0 --activate` -> `yarn --version`
`4.17.0`) [VERIFIED]. yarn 4 http-registry behavior [VERIFIED: local runs]:

- `.yarnrc.yml` with `npmRegistryServer: "http://localhost:PORT"` and NO whitelist ->
  `yarn add` FAILS: `YN0081: Unsafe http requests must be explicitly whitelisted in your
  configuration (localhost)`.
- adding `unsafeHttpWhitelist: [localhost]` -> the http block is lifted (with no registry running
  it then `ECONNREFUSED`s -- i.e. it proceeded to connect). So the whitelist is REQUIRED for the
  http Verdaccio.

Required `.yarnrc.yml` for the fixture (at fixture root):
```yaml
nodeLinker: node-modules          # REQUIRED: a real node_modules tree for the nx executor + require()
npmRegistryServer: "<verdaccioUrl>"
npmAuthToken: "<verdaccioToken>"  # bearer; yarn 4 auth form (NOT .npmrc)
unsafeHttpWhitelist:
  - localhost                     # REQUIRED: yarn 4 blocks http by default
enableTelemetry: false
enableImmutableInstalls: false    # defensive: yarn auto-enables immutable under CI env
```
And `packageManager: "yarn@4.17.0"` in the fixture package.json (corepack routes to it).

- **No pnpm-style build gate:** yarn 4 runs build scripts by default (`enableScripts` default true)
  and does not hard-error on them, so `nx add` on yarn is expected to SUCCEED -> init runs ->
  `angular-typechecker:typecheck` targetDefaults seeded (assert like `verdaccio-publish` + the
  substitute spec). [Confidence MEDIUM -- not reproduced end-to-end against Verdaccio; executor
  MUST observe the real output.]
- `enableImmutableInstalls`: a quick `CI=true corepack yarn add ...` exited 0 here (immutable
  gates `yarn install`, not `yarn add`), but set `enableImmutableInstalls: false` defensively so a
  CI `yarn install`/lockfile write cannot fail the fixture provisioning.
- yarn berry + `latest` -> `nx add` runs `yarn add -D angular-typechecker` (no `@latest`), which
  resolves the dist-tag from Verdaccio.

## Q5 -- Verdaccio auth for pnpm + yarn

The committed `.verdaccio/config.yml` grants `$all` for access/publish, has an `auth.htpasswd`
block, and proxies npmjs for everything except the `angular-typechecker` no-proxy block
(`.verdaccio/config.yml:34-52`). The globalSetup mints a REAL bearer token and provides
`verdaccioUrl` + `verdaccioToken` (`src/global-setup.ts:120,172-173`).

- **pnpm:** reads the same nerf-dart `.npmrc` form the npm specs already write
  (`registry=<url>` + `//host/:_authToken="<token>"`; see `verdaccio-publish.int.spec.ts:112-116`).
  Verdaccio proxies npmjs for the fixture's nx/angular/ts/esbuild deps; the no-proxy block serves
  angular-typechecker from the freshly-published local dist. pnpm reads `.npmrc` natively -> http
  localhost is fine for pnpm (no https requirement).
- **yarn 4:** does NOT read `.npmrc` for auth -- use `.yarnrc.yml` `npmAuthToken` +
  `npmRegistryServer` + `unsafeHttpWhitelist` (Q4). Same bearer token works.
- Non-angular-typechecker deps resolve via the `**` -> `proxy: npmjs` uplink; angular-typechecker
  resolves from local storage (no-proxy). Both pnpm and yarn honor a single default registry, so a
  full-Verdaccio config (all deps through the proxy) is correct and matches the existing npm specs.

**Store/cache purity note:** pnpm's global content-addressable store and yarn's global cache may
already hold the real npmjs `angular-typechecker@0.1.1`; if the Verdaccio-published version equals
it, the PM could reuse the cached copy instead of the local dist. The pnpm spec does not care
(its failure is about esbuild). For the yarn SUCCESS spec (which should prove the LOCAL dist), set
a per-fixture cache (`cacheFolder: ./.yarn/cache` + `enableGlobalCache: false` in `.yarnrc.yml`)
or accept version-parity. Flag for the executor.

## Q6 -- Pitfalls + CI integration

- **PATH for nx add's child PM (load-bearing):** `nx add` `exec`s a BARE `pnpm add ...` /
  `yarn add ...`, inheriting the nx process PATH. pnpm is already on PATH (CI action-setup +
  local), so the pnpm spec is fine. **yarn is NOT on PATH** unless `corepack enable` has installed
  the global `yarn` shim -- otherwise nx add's child `yarn add` will not resolve. Recommendation:
  run `corepack enable` (corepack's sanctioned shim install, not a manual PATH edit) in the yarn
  spec setup and add a `corepack enable` step to the CI `e2e` job; or the executor OBSERVES whether
  `corepack yarn nx add` propagates yarn to the child and adjusts.
- **Serialization:** the new specs inherit `singleFork` + `fileParallelism:false` from
  `vitest.config.mts`. CI already runs the three e2e projects with `--parallel=1`
  (`ci.yml:170-173`) to avoid the shared-tarball race (memory
  `e2e-projects-share-one-tarball-serialize`). New specs add no new e2e project, so that guard is
  unaffected. NOTE: these two specs do NOT pack the shared dist tarball (they install by name from
  Verdaccio), so they do not participate in that race.
- **Timeouts:** a real `pnpm install --ignore-scripts` + `nx add`, or `corepack yarn install` +
  `nx add`, is well within the existing 300000ms `testTimeout`/`hookTimeout`. First-time corepack
  yarn download and Verdaccio uplink fetches add seconds; acceptable.
- **Windows vs CI (Linux):** dev box is Windows arm64 (pnpm symlink/junction store, corepack shim
  under fnm); CI `e2e` is Linux Node 24. pnpm reproduced clean on Windows here; the CI gate is the
  authority. Use `removeTmpDir` (already EPERM-tolerant on Windows) for teardown.
- **Env hygiene:** use `buildCleanEnv({ stripAllNpmConfig: true })` (strips the process-wide
  `npm_config_registry` the globalSetup set; strips NX_* runner vars; sets `NX_DAEMON=false`,
  `FORCE_COLOR=0`) exactly as the sibling Verdaccio specs. Point the PM config at Verdaccio via
  the fixture `.npmrc` (pnpm) / `.yarnrc.yml` (yarn) -- NOT via env.
- **CI provisioning gap:** the `e2e` job installs pnpm but not yarn. Add `corepack enable` (Node 24
  has corepack) OR a yarn setup step so the yarn spec's `corepack yarn` + nx add's child `yarn`
  resolve. Confirm before merge.

## Recommended test design (actionable)

Two files in `e2e/angular-typechecker-install-e2e/src/`, both `inject('verdaccioUrl'|'verdaccioToken')`,
both using `@workspace/test-util` and a fresh `mkdtempSync` copy of the `consumer-generator` fixture.

**`nx-add-pnpm.int.spec.ts` (assert the real failure):**
1. Copy fixture; write `pnpm-workspace.yaml` (`packages: ['.']`, no `allowBuilds`); add `esbuild`
   to devDependencies; write `.npmrc` (Verdaccio registry + minted token).
2. `pnpm install --ignore-scripts` (provisions nx + node_modules + lockfile; exit 0).
3. Run REAL `nx add`: capture exit + output of `pnpm exec nx add angular-typechecker` (use the
   `run`/`sh` catch to capture non-zero exit + stderr; do NOT let it throw uncaught).
4. Assert: non-zero exit AND output matches the failure signature (`ERR_PNPM_IGNORED_BUILDS`
   and/or `Failed to install angular-typechecker`). Optionally then assert the fallback succeeds
   (`allowBuilds` approval makes `nx add` exit 0, OR `--ignore-scripts` add + `nx g ...:init`).
   Executor OBSERVES the exact string to lock the assertion.

**`nx-add-yarn.int.spec.ts` (assert the real success, mirror verdaccio-publish):**
1. Copy fixture; set `packageManager: "yarn@4.17.0"`; write `.yarnrc.yml` (nodeLinker node-modules,
   npmRegistryServer + npmAuthToken = injected Verdaccio, unsafeHttpWhitelist [localhost],
   enableTelemetry false, enableImmutableInstalls false, per-fixture cache).
2. `corepack enable` (or ensure yarn on PATH); `corepack yarn install`.
3. Run REAL `nx add`: `corepack yarn nx add angular-typechecker` (or `yarn exec nx add ...`).
4. Assert: success AND `nx.json` `targetDefaults['angular-typechecker:typecheck']` seeded
   (`cache:true`, `outputs:[]`, `inputs[0]==='default'`), mirroring `nx-add-e2e.int.spec.ts:137-141`
   and `verdaccio-publish.int.spec.ts`. Executor OBSERVES actual output; if the child-`yarn` PATH
   issue surfaces, resolve via `corepack enable` before finalizing.

## Assumptions / observe-at-runtime (flagged -- could go two ways)

| # | Item | Why uncertain | Executor action |
|---|------|---------------|-----------------|
| A1 | yarn `nx add` SUCCEEDS + seeds targetDefaults | Not reproduced end-to-end vs Verdaccio; yarn PnP-vs-node-modules + child-`yarn` PATH + immutable interplay | OBSERVE real output; assert what actually happens |
| A2 | Exact pnpm failure string to assert | Wording may vary by pnpm patch; nx wraps it | Assert on stable substrings (`ERR_PNPM_IGNORED_BUILDS`, `Failed to install`); OBSERVE |
| A3 | nx add's child `yarn add` resolves without `corepack enable` | `exec` inherits PATH; yarn shim may/may not be present | Prefer `corepack enable` in setup + CI; OBSERVE |
| A4 | pnpm/yarn cache may serve npmjs `angular-typechecker` over local dist | global store/cache reuse by version | Use per-fixture cache/store for the yarn success spec if local-dist proof matters |
| A5 | Pin pnpm 11.9.0 (match CI action-setup) vs 11.10.0 (latest) | both valid; corepack vs action-setup shim interplay | Pick one; if corepack-pinning pnpm, avoid clashing with action-setup's PATH pnpm |

## Sources

### Primary (HIGH)
- `node_modules/nx/dist/src/command-line/add/add.js` (nx 23.0.1) -- specifier parse, `installPackage`
  exec + "Failed to install", `initializePlugin` -> `g <plugin>:init`.
- `node_modules/nx/dist/src/utils/package-manager.js:39-199` -- `detectPackageManager` lockfile
  precedence + user-agent; `getPackageManagerCommand` yarn/pnpm/npm `addDev` strings; berry/pnpm
  version branches.
- Local empirical runs (pnpm 11.9.0, yarn 4.17.0, Node 24.18.0, corepack 0.35.0) -- ignored-builds
  exit-code matrix; yarn http/unsafeHttpWhitelist gate; corepack yarn provisioning.
- `registry.npmjs.org/-/package/{pnpm,yarn,@yarnpkg/cli-dist}/dist-tags` (fetched 2026-07-04).
- Repo: `.verdaccio/config.yml`, `src/global-setup.ts`, `src/verdaccio-publish.int.spec.ts`,
  `src/nx-add-e2e.int.spec.ts`, `vitest.config.mts`, `project.json`,
  `fixtures/consumer-generator/*`, `libs/test-util/src/lib/e2e-process.ts`,
  `packages/angular-typechecker/package.json`, `.github/workflows/ci.yml`.

### Secondary (MEDIUM)
- `pnpm.io/settings` -- `onlyBuiltDependencies` removed in v11, replaced by `allowBuilds` +
  `strictDepBuilds` (default true); error code `ERR_PNPM_IGNORED_BUILDS`.
- Memories `nx-add-fails-on-pnpm-workspaces`, `e2e-projects-share-one-tarball-serialize`,
  `angular-typechecker-npm-releases-ship-source`; handoff `7a767ca:.planning/{HANDOFF.json,.continue-here.md}`.

**Valid until:** ~2026-08-04 (pnpm/yarn move fast; re-verify dist-tags + the pnpm settings key if
revisited later).
