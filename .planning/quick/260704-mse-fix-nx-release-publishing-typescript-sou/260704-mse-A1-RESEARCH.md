# A1 - Adopt @nx/js first-party Verdaccio local-registry (design, research-only)

**Researched:** 2026-07-04
**Task:** 260704-mse (release PR #23, branch `release/0.1.1`)
**Scope:** Replace the hand-rolled Verdaccio in
`e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts` with the
generator-scaffolded `@nx/js:setup-verdaccio` + `@nx/js:verdaccio` +
`startLocalRegistry` path, in a shared vitest `globalSetup`, and reconcile the
deferred-findings set. No code written; this is the design the executor lands.
**Confidence:** HIGH on the @nx/js mechanics (read from installed 23.0.1 source);
HIGH on the three load-bearing verdicts (source + this repo's own verified
0.1.1 findings); MEDIUM on one Windows teardown edge (benign, CI-irrelevant).

---

## Summary

The generator-scaffolded path is viable but it does NOT preserve any of the three
load-bearing behaviors out of the box - each one requires a specific, small
customization that I have pinned to exact lines of the installed `@nx/js@23.0.1`
source:

1. **No-proxy scoping** - the scaffolded `.verdaccio/config.yml` routes EVERYTHING
   (`'**'`) through `proxy: npmjs`, including `angular-typechecker`. That is the
   exact defect this gate must avoid (it would install the live npmjs `0.1.0`, not
   our fresh dist). The executor's `scopes` option is npm-config registry mapping,
   NOT Verdaccio package routing, and `angular-typechecker` is unscoped - so
   `scopes` is irrelevant here. The fix lives ONLY in a custom `config.yml`: add an
   `angular-typechecker` package block (no `proxy` key) ABOVE the `'**'` glob.

2. **Verdaccio-6 real token** - `@nx/js` authenticates with a hardcoded dummy
   `secretVerdaccioToken` (verified at two call sites). This repo already PROVED
   (0.1.1 deviation log, verified against verdaccio@6.7.4) that an unverifiable
   bearer is 401-rejected, not treated as anonymous. So the design MUST KEEP the
   real-token mint (`PUT /-/user/org.couchdb.user:ci`) and MUST add an
   `auth.htpasswd` block to the config (the generator scaffolds none, and
   `adduser` needs an auth plugin).

3. **Windows-safe spawn/kill** - `startLocalRegistry` forks `nx` directly (NOT an
   `npx` cmd-shim), so it is already better than the shim orphan the hand-rolled
   code guarded against. It is a double fork (nx -> verdaccio); on Windows a
   `.kill()` may abruptly terminate the nx parent before its SIGTERM handler runs,
   which CAN orphan the verdaccio grandchild. This is benign (leaks one process +
   port; `detect-port` recovers next run) and CANNOT happen in CI (e2e is
   Linux-only). Accept it with a documented Windows-local fallback.

**Primary recommendation:** Run `nx g @nx/js:setup-verdaccio`; hand-edit the
scaffolded `.verdaccio/config.yml` (add the `angular-typechecker` no-proxy block,
add `auth.htpasswd`, raise `log.level` to `http`); move the registry startup +
single build + token mint + single publish into a vitest `globalSetup` for the
`angular-typechecker-install-e2e` project using `startLocalRegistry` from
`@nx/js/plugins/jest/local-registry`; rewrite `verdaccio-publish.int.spec.ts` to
consume the globalSetup-provided registry via vitest `provide`/`inject`; drop the
now-redundant per-spec `nx build` from the sibling install-e2e specs (they share
the one globalSetup build). Keep the real token mint and the never-publish-to-npmjs
safety gate verbatim (relocated into globalSetup).

---

## Verified @nx/js@23.0.1 source findings

All read from `node_modules/@nx/js/dist/src/...`.

### `@nx/js:setup-verdaccio` generator (`generators/setup-verdaccio/generator.js`)
- Writes `.verdaccio/config.yml` (from `files/config.yml`, EJS placeholder
  `<%= npmUplinkRegistry %>` filled from the workspace npm registry, default
  `https://registry.npmjs.org`). Skips if the file already exists.
- Adds a `local-registry` target: `executor: '@nx/js:verdaccio'`,
  `options: { port: 4873, config: '.verdaccio/config.yml', storage:
  'tmp/local-registry/storage' }`.
- Target placement branches (LANDMINE): if a root `project.json` exists it appends
  the target there; else if "new TS solution setup" it writes
  `package.json` `nx.targets`; else it calls
  `addProjectConfiguration(tree, <root package.json name>, { root: '.', targets:
  { 'local-registry': ... } })` - i.e. it can CREATE a new root project named after
  the root `package.json`. This repo has no root `project.json`, so expect either a
  `package.json` `nx.targets` entry or a new root project. Verify where it lands
  after generation and relocate the target if the root-project creation is
  undesirable (a bare `local-registry`-only project is inert and is NOT in
  `release.projects`, so it does not affect release scoping - release-hygiene's
  `release.projects === ["angular-typechecker"]` assertion still holds).
- Adds `verdaccio: '^6.3.2'` as a devDependency. This repo already has
  `verdaccio@6.7.4` (satisfies `^6.3.2`), so this is a no-op / range widening.

### The scaffolded `files/config.yml` (VERBATIM)
```yaml
# path to a directory with all packages
storage: ../tmp/local-registry/storage

# a list of other known repositories we can talk to
uplinks:
  npmjs:
    url: <%= npmUplinkRegistry %>
    maxage: 60m

packages:
  '**':
    # give all users (including non-authenticated users) full access
    # because it is a local registry
    access: $all
    publish: $all
    unpublish: $all

    # if package is not available locally, proxy requests to npm registry
    proxy: npmjs

# log settings
log:
  type: stdout
  format: pretty
  level: warn

publish:
  allow_offline: true # set offline to true to allow publish offline
```
Note the two gaps vs our needs: (a) `'**'` proxies EVERYTHING to npmjs (breaks
behavior 1); (b) there is NO `auth` block (breaks the token mint that behavior 2
needs).

### `@nx/js:verdaccio` executor (`executors/verdaccio/verdaccio.impl.js`)
- Options (schema.json): `location` (default `user`; enum global/user/project/none),
  `storage`, `port` (required), `listenAddress` (default `localhost`), `config`,
  `clear` (default `true`), `scopes` (array).
- `clear:true` + `storage` -> `rmSync(storage, { recursive, force })` before start,
  so storage is wiped each run (preserves "clean first publish, no
  EPUBLISHCONFLICT").
- Uses `detect-port` from `options.port` (4873) - picks the next free port if
  occupied, and logs the substitution.
- Starts Verdaccio with `child_process.fork(require.resolve('verdaccio/bin/verdaccio'),
  ...)` - a DIRECT node fork, env `VERDACCIO_HANDLE_KILL_SIGNALS: 'true'` +
  `VERDACCIO_STORAGE_PATH`, `stdio: 'inherit'`. No cmd-shim.
- Registers `process.on('exit'|'SIGTERM'|'SIGINT'|'SIGHUP', ...)` that kills the
  verdaccio child + runs npm/yarn config cleanup.
- `location: none` short-circuits `setupNpm`/`setupYarn` (`cleanupFunctions = []`) -
  the executor then does NOT touch npm/yarn user config. `startLocalRegistry`
  always passes `--location none`.
- `scopes` only affects `setupNpm`/`setupYarn` (`@scope:registry` npm-config keys) -
  it does NOTHING to Verdaccio's `packages:`/`proxy` routing. **Confirms `scopes`
  cannot express behavior 1.**
- `setupNpm` (when location != none) sets `_authToken="secretVerdaccioToken"` - a
  DUMMY token.

### `startLocalRegistry` (`plugins/jest/start-local-registry.js`, exported as `@nx/js/plugins/jest/local-registry`)
- `fork(require.resolve('nx/bin/nx'), ['run', '<target>', '--location', 'none',
  '--clear', <bool>, '--storage', <path>], { stdio: 'pipe' })`.
- Readiness by LOG-SCRAPE: resolves when stdout matches `http://<listenAddress>:`,
  parsing the port out of the log line. No readiness timeout (waits until the line
  appears or the child exits).
- Sets `process.env.npm_config_registry = registry` and
  `npm config set //host:port/:_authToken "secretVerdaccioToken" --ws=false` (dummy
  token again), plus BUN/YARN env.
- Returns a teardown that does `childProcess.kill()` (on the nx fork) +
  `npm config delete //host:port/:_authToken --ws=false`.
- Export confirmed in `@nx/js` package.json: `"./plugins/jest/local-registry"` ->
  `dist/plugins/jest/local-registry.js` (a `__exportStar` re-export of
  `start-local-registry`).

### `addLocalRegistryScripts` (`utils/add-local-registry-scripts.js`)
- Scaffolds `tools/scripts/start-local-registry.ts` (jest globalSetup) that calls
  `startLocalRegistry` then `releaseVersion({ specifier: '0.0.0-e2e', gitCommit:
  false, gitTag: false, firstRelease: true, ... })` + `releasePublish({ tag: 'e2e',
  firstRelease: true })` from `nx/release`.
- **This is NOT what `@nx/js:setup-verdaccio` runs** - it is a separate util the
  preset/`create-nx-plugin` uses. We do NOT need it; we author our own vitest
  globalSetup. Called out because the nx.dev recipe shows this script.
- LANDMINE for us: `releaseVersion({ specifier: '0.0.0-e2e' })` MUTATES the source
  `package.json` version on disk (to `0.0.0-e2e`). On a release PR branch that
  dirties the tree. Our globalSetup must NOT use `releaseVersion`; publish the real
  dist at its real version via `nx release publish --registry <local>
  --first-release` (the current spec's proven approach).

### `versions.js`
- `verdaccioVersion = '^6.3.2'` - @nx/js DOES target Verdaccio 6, so the dummy-token
  behavior below applies to the version family we run (6.7.4).

---

## The three load-bearing behaviors: verdict + exact mechanism

### Behavior 1 - per-package no-proxy scoping: KEEP, express in config.yml only
The `@nx/js:verdaccio` `scopes` option cannot do this (it is npm-config registry
mapping, not Verdaccio routing) and `angular-typechecker` is unscoped anyway.
Verdaccio matches `packages:` blocks top-down, first match wins. Put an
`angular-typechecker` block WITH NO `proxy:` key ABOVE the catch-all `'**'` (which
keeps `proxy: npmjs` so the consumer's Angular/Nx/TS deps resolve). This is the same
shape the current hand-rolled config uses (verified working in 0.1.1). See the
concrete config below.

### Behavior 2 - Verdaccio-6 real token: KEEP the mint, ADD auth.htpasswd
`@nx/js` uses a dummy `secretVerdaccioToken` at both the executor's `setupNpm` and
`startLocalRegistry`. This repo's own 0.1.1 deviation log (verified against
verdaccio@6.7.4, and re-confirmed by a standalone `npm publish` repro) states a
dummy/unverifiable bearer is **401-rejected** ("This command requires you to be
logged in ... npm adduser"), NOT treated as anonymous. Therefore the @nx/js
dummy-token path is NOT trustworthy on the Verdaccio version we run, and on a
critical release gate we do not gamble on it.

- KEEP `createRegistryToken` (mint via `PUT /-/user/org.couchdb.user:ci`, use the
  returned token). Relocate it into globalSetup.
- ADD an `auth.htpasswd` block to `config.yml` - the generator scaffolds none, and
  Verdaccio's `adduser` sign-up requires an auth plugin. The default htpasswd plugin
  allows sign-up.
- For the publish AND the install, OVERRIDE `startLocalRegistry`'s dummy user-npmrc
  token by passing a dedicated `.npmrc` (registry + minted token) via
  `npm_config_userconfig`, exactly as the current spec does.
- Why not just rely on `$all` anonymous publish (no token)? `npm publish` fails
  `ENEEDAUTH` if no `_authToken` is configured for the registry, regardless of the
  registry's policy - so a token must be present, and with htpasswd present a dummy
  one 401s. The mint is the proven resolution. (Idempotency note below.)

### Behavior 3 - Windows-safe spawn/kill: use startLocalRegistry, accept benign Windows edge
`startLocalRegistry` forks `nx` directly (not `npx`), so the cmd-shim orphan the
hand-rolled code guarded against does not apply. The residual is the double fork
(vitest -> nx -> verdaccio): on Windows `childProcess.kill()` on the nx fork maps to
an abrupt `TerminateProcess`, so nx's SIGTERM handler (which kills verdaccio) may not
run, and verdaccio CAN orphan. Mitigating facts:
- `--location none` means the executor's only cleanup is killing verdaccio (no npm
  config to restore), and `startLocalRegistry`'s own `npm config delete _authToken`
  runs in the globalSetup process (not the nx fork), so it always executes.
- An orphaned verdaccio only leaks a process + holds a port; `detect-port` selects a
  new port next run. Non-fatal.
- CI e2e is Linux-only, where `.kill()` delivers a real SIGTERM and the cascade
  works. So this never happens in CI.

Recommendation: use `startLocalRegistry` (the canonical, generator-aligned path) and
accept the benign Windows-local edge. Documented fallback if it ever bites a Windows
dev: add a Windows-only kill in globalTeardown (e.g. kill the port's listener, or
`taskkill /F /T` on the captured nx pid). The strictly-Windows-safer alternative -
the current DIRECT `spawn(process.execPath, [verdaccioBin, ...])` - remains available
if we ever decide first-party runtime is not worth the edge; it would still use the
generator-scaffolded config + target, just not `startLocalRegistry`. Given the user's
stated preference for the first-party path and Linux CI, `startLocalRegistry` is the
call.

---

## Concrete customized `.verdaccio/config.yml`

Start from the generated file; apply exactly these deltas (add `auth`, add the
`angular-typechecker` no-proxy block above `'**'`, raise `log.level`):

```yaml
# storage is overridden at runtime by the executor's --storage / VERDACCIO_STORAGE_PATH
# (target option storage: tmp/local-registry/storage), but keep a sane default here.
storage: ../tmp/local-registry/storage

# htpasswd auth is REQUIRED for the ci-user sign-up that mints a real publish token
# (Verdaccio 6 401s an unverifiable bearer; anonymous-only is not enough because npm
# still needs a token present to publish). File path is relative to THIS config file
# (.verdaccio/). Placing it under the cleared storage dir means clear:true wipes it
# each run -> deterministic fresh sign-up (alternative: globalSetup rmSync's it).
auth:
  htpasswd:
    file: ../tmp/local-registry/storage/.htpasswd
    max_users: 1000

uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    maxage: 60m

packages:
  # BEHAVIOR 1: served ONLY from local storage - NO proxy key - so npm view / install
  # never fall through to the live npmjs 0.1.0. The round-trip exercises OUR dist.
  'angular-typechecker':
    access: $all
    publish: $all
    unpublish: $all

  # Everything else proxies npmjs so the consumer's Angular / Nx / TS deps resolve.
  '**':
    access: $all
    publish: $all
    unpublish: $all
    proxy: npmjs

log:
  type: stdout
  format: pretty
  # BEHAVIOR 3 adjacent: startLocalRegistry resolves readiness by scraping the
  # "http://localhost:PORT" line out of stdout. At level: warn the address line can
  # be suppressed and startLocalRegistry (which has NO readiness timeout) would hang.
  # Raise to http (matches the 0.1.1 hand-rolled config) so the line always prints.
  level: http

publish:
  allow_offline: true
```

htpasswd idempotency: if the htpasswd file survives between runs and the `ci` user
already exists, the `PUT adduser` with the same `ci-password` is effectively a login
and still returns a token; a mismatched password would 409. Wiping (via clear:true +
htpasswd-in-storage, or an explicit `rmSync` in globalSetup) removes the ambiguity.
Recommend the explicit one-line `rmSync(htpasswdPath, { force: true })` in globalSetup
for clarity; the in-storage placement above is the zero-code alternative.

---

## globalSetup design (single build - finding E1)

New file: `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (vitest
globalSetup). It starts the registry, builds dist ONCE, mints the token, strips
CI-only provenance, publishes ONCE, and provides the registry URL + token to the
specs. Sketch (not final code):

```ts
import { execSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GlobalSetupContext } from 'vitest/node';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { findWorkspaceRoot } from '@workspace/test-util';
import { buildCleanEnv } from '@workspace/test-util'; // stripAllNpmConfig variant

export default async function ({ provide }: GlobalSetupContext) {
  const root = findWorkspaceRoot(__dirname);
  const env = buildCleanEnv({ stripAllNpmConfig: true });

  // Fresh htpasswd -> deterministic ci-user sign-up.
  rmSync(join(root, 'tmp/local-registry/storage/.htpasswd'), { force: true });

  // Behavior 3: forks nx (not npx). Behavior 1 lives in the committed config.yml.
  const stop = await startLocalRegistry({
    localRegistryTarget: 'angular-typechecker:local-registry', // or the root project's
    storage: './tmp/local-registry/storage',
    verbose: false,
    clearStorage: true,
  });
  const verdaccioUrl = process.env.npm_config_registry!; // set by startLocalRegistry

  // Load-bearing SAFETY gate (relocated verbatim): never publish to npmjs.
  if (!verdaccioUrl.startsWith('http://localhost:')) {
    stop();
    throw new Error(`refusing to publish to non-local registry: ${verdaccioUrl}`);
  }

  // Behavior 2: mint a REAL token (dummy is 401 on Verdaccio 6).
  const token = await mintCiToken(verdaccioUrl); // PUT /-/user/org.couchdb.user:ci, via fetch (S2)

  // Single build (E1). Optionally Promise.all this with startLocalRegistry (E3).
  execSync('npx nx build angular-typechecker --skip-nx-cache', { cwd: root, env });

  // Strip CI-only provenance on the (gitignored) dist manifest before publish.
  const distManifest = join(root, 'dist/packages/angular-typechecker/package.json');
  const m = JSON.parse(readFileSync(distManifest, 'utf8'));
  if (m.publishConfig) m.publishConfig.provenance = false;
  writeFileSync(distManifest, JSON.stringify(m, null, 2) + '\n');

  // Publish ONCE via the REAL nx path (packageRoot=dist), minted token via userconfig.
  const publishNpmrc = join(root, 'tmp/local-registry/publish.npmrc');
  writeFileSync(publishNpmrc, `registry=${verdaccioUrl}\n//${host(verdaccioUrl)}/:_authToken="${token}"\n`);
  execSync(`npx nx release publish --registry ${verdaccioUrl} --first-release`, {
    cwd: root,
    env: { ...env, npm_config_userconfig: publishNpmrc },
  });

  provide('verdaccioUrl', verdaccioUrl);
  provide('verdaccioToken', token);

  return () => stop(); // globalTeardown
}
```

Wire it in `vitest.config.mts`:
```ts
test: {
  // ...existing serialized knobs (forks/singleFork/fileParallelism:false/node/300000ms)
  globalSetup: ['./src/global-setup.ts'],
}
```
Specs read the values with `inject('verdaccioUrl')` / `inject('verdaccioToken')`
(declare a `declare module 'vitest' { interface ProvidedContext { verdaccioUrl:
string; verdaccioToken: string } }` augmentation). `provide`/`inject` is preferred
over env because each spec rebuilds a clean exec env (stripping all `npm_config_*`),
so it cannot rely on `process.env` inheritance from globalSetup.

Isolation note: vitest runs `globalSetup` for EVERY invocation, including a single
selected spec (`vitest run verdaccio`). So moving the build+publish into globalSetup
does NOT break running one spec in isolation - the registry + dist are always
provisioned first. That is what makes dropping the per-spec builds safe.

---

## Reconciling the sibling install-e2e specs (E1 propagation)

globalSetup builds dist ONCE and publishes ONCE. What each spec in
`angular-typechecker-install-e2e` needs afterward:

| Spec | Today | After adoption | Needs |
|------|-------|----------------|-------|
| verdaccio-publish (REL-04) | spawns own verdaccio, builds, mints, publishes, installs-by-name | THE globalSetup consumer: inject URL+token, install-by-name -> init -> configuration -> typecheck; assert compiled .js + zero .ts + (M13) a .d.ts exists | inject URL+token; drop its own beforeAll spawn/build/mint/publish |
| tarball-audit (PKG-02) | builds dist, `npm pack`, publint/attw + extract on the .tgz | DROP its `nx build` (use shared dist); KEEP `npm pack` (publint/attw need a physical tarball) | shared dist only; keeps own pack + extract |
| install-smoke (TEST-05) | builds dist, packs, installs .tgz BY PATH, green + injected-error | DROP its `nx build`; KEEP pack + install-by-path (its POINT is the tarball artifact, not the registry) | shared dist only |
| nx-add-e2e (GE2E-03) | builds dist, packs, installs .tgz, runs `nx g :init` | DROP its `nx build`; KEEP pack + tarball-install (it deliberately places the package as `nx add`'s installPackage step would - offline/deterministic); OR install-by-name from the registry | shared dist only (tarball path retained) |
| generator-e2e (GE2E-01/02) | builds dist, packs, installs .tgz, runs generators | DROP its `nx build`; KEEP pack + tarball-install | shared dist only |
| release-hygiene (PKG-03/04) | pure config/file reads, NO build | unchanged; but its sibling REL-04 tautology (see A3) is deleted from tarball-audit, not here | nothing from globalSetup |

Answer to "can the shared build move to globalSetup without breaking independence?":
YES. The build is a pure function of source; building once and sharing under the
project's full serialization is safe. The only shared-mutable-state concern is the
provenance-strip on the dist manifest - move it into globalSetup (once), so no spec
mutates shared dist. tarball-audit's REL-04 reads dist `version` (not `provenance`),
so there is no conflict. Keeping each spec's own `npm pack` preserves their per-spec
tarball independence; only the redundant rebuild is removed.

Scope boundary: this globalSetup is `angular-typechecker-install-e2e`-only. The other
two e2e projects (`-cache-e2e`, `-matrix-e2e`) keep their own builds - vitest
globalSetup is per-project. The CI `e2e` job runs all three with `--parallel=1`
because they pack the SAME dist tarball (they still will); no ci.yml change needed.

---

## Deferred-findings reconciliation

| ID | What it was | Verdict | Notes |
|----|-------------|---------|-------|
| S1 | `pingOnce` -> `fetch` | MOOT | `startLocalRegistry` owns readiness (log-scrape); `pingOnce`/`waitForServer` deleted. |
| S2 | `createRegistryToken` -> `fetch` | SURVIVES (relocated) | Token mint is KEPT (behavior 2) and moves to globalSetup; rewrite it with global `fetch` (Node 22+). |
| S3 | dead `node:http` import | MOOT by construction | With S2's fetch rewrite the whole `node:http` import (`get` + `request`) is removed; nothing dead left. |
| E1 | single build via globalSetup | IMPLEMENTED | This is the core of the adoption, not deferred anymore. |
| E2 | `verdaccioLog` listeners | MOOT | We no longer spawn verdaccio; `startLocalRegistry` manages its stdout. |
| E3 | `Promise.all(build, startup)` | SURVIVES (optional) | In globalSetup: `await Promise.all([startLocalRegistry(...), build()])` then mint+publish. Minor; keep or drop. |
| R1 | `walkFiles`/`collectDtsText` -> `readdirSync(dir,{recursive,withFileTypes})` + `.isFile()` + `entry.parentPath` | SURVIVES | Pure spec logic, registry-independent. Applies to verdaccio-publish's `walkFiles` AND tarball-audit's `collectDtsText` (dedup both). `entry.parentPath` is Node 20.12+; repo targets Node 22+, fine. |
| M8 | extract `NX_RUNNER_ENV_KEYS`/`buildCleanEnv`/`run`/`RunResult`/`removeTmpDir` into `@workspace/test-util` | SURVIVES (broad) | Duplicated across 9 spec files in 3 e2e projects (cache-e2e x3, install-e2e x5, matrix-e2e x1). API below. |
| M9 | wrap `execSync` install/init/configuration to surface stdout on failure | SURVIVES | Applies to the remaining bare `execSync('npm install ...')` / `nx g :init` / `nx g :configuration` calls (the `run()` helper already captures nx-run output). Add an `sh(cmd, opts)` helper to test-util that rethrows with stdout+stderr. |
| M13 | assert a `.d.ts` exists in the installed-by-name tree | SURVIVES | Small add to verdaccio-publish's installed-tree assertions (proves types ship, complements the zero-`.ts` check). |
| M14 | `dependsOn:["build"]` on `nx-release-publish` in `packages/angular-typechecker/project.json` | SURVIVES + SAFE | See verification below. |
| A3 | DELETE tarball-audit REL-04 version-parity test (~-33 lines) | SURVIVES (as deletion) | See analysis below. |
| exit-codes.ts comment | fix "three consumers (Nx executor now...)" | SURVIVES (dev-source only) | See below. KEEP `toExitCode`. |
| loadTypescript dedup | extract to module-private `load-typescript.ts` leaf | SURVIVES (shipped source) | See below. Preserve D-02 anti-leak (never barrel-exported). KEEP `TemplateCheckAborted.code`. |

### M8 - shared test-util API (parameterized npm_config strip)
Add to `libs/test-util/src/lib/` and re-export from `index.ts`:
- `export const NX_RUNNER_ENV_KEYS: readonly string[]` (the 8 keys, identical in
  every spec).
- `export function buildCleanEnv(options?: { stripAllNpmConfig?: boolean }):
  NodeJS.ProcessEnv` - always strips `NX_RUNNER_ENV_KEYS` and sets `NX_DAEMON:false`
  + `FORCE_COLOR:0`. Default strips only `npm_config_legacy_peer_deps` /
  `NPM_CONFIG_LEGACY_PEER_DEPS`; `stripAllNpmConfig:true` strips EVERY `^npm_config_`
  key. **The verdaccio consumer requires `stripAllNpmConfig:true`** (and so does the
  globalSetup) - this is load-bearing (an inherited `npm_config_registry`, incl. the
  one `startLocalRegistry` sets in the parent process, would outrank `--registry`).
  The tarball/generator specs use the default (strip legacy-peer-deps only).
- `export interface RunResult { stdout: string; code: number }`.
- `export function run(cwd: string, target: string, options?: { skipNxCache?:
  boolean; env?: NodeJS.ProcessEnv }): RunResult` - the `npx nx run <target>
  --output-style=static [--skip-nx-cache]` wrapper (catch -> `{ stdout:
  stdout+stderr, code: status ?? 1 }`). Note: install-smoke currently calls
  `run(cwd)` with a module-const TARGET; migrate to `run(cwd, TARGET)`. generator-e2e
  passes `--skip-nx-cache`; expose via `options.skipNxCache`.
- `export function removeTmpDir(dir: string): void` - best-effort recursive rm
  (`{ recursive, force, maxRetries:10, retryDelay:100 }`, swallow). (Some specs name
  it `removeTmpWorkspace`; unify.)
- (M9) `export function sh(cmd: string, opts): string` - `execSync` wrapper that on
  failure throws `Error(cmd + "\n" + stdout + stderr)` instead of the bare exec error.

### M14 - `dependsOn:["build"]` on nx-release-publish: SAFE
`release.yml` already runs `npx nx build angular-typechecker` THEN `npx nx release
publish`. `nx release publish` runs the `nx-release-publish` target through the task
orchestrator, which processes `dependsOn` - so adding `dependsOn:["build"]` makes
publish trigger a build first, which in CI is a cache HIT after the explicit build
(cheap no-op). It never double-emits and never breaks the split flow: in CI the
publish job builds off the freshly-checked-out tagged source (exactly the
build-off-tagged-source intent). Bonus: it makes the e2e globalSetup's `nx release
publish` self-sufficient (would build if dist were missing) - though keep the
explicit build in globalSetup for clarity and E3 concurrency. Verify before landing
with `npx nx release publish --dry-run --first-release` (confirm build appears in the
task graph and no error) - MEDIUM confidence that `--dry-run` surfaces the dependsOn
edge clearly; the e2e globalSetup exercises the real path regardless. Optionally add a
release-hygiene assertion that `nx-release-publish.dependsOn` includes `build`.

### A3 - delete tarball-audit REL-04 version-parity test: SAFE
The test (`tarball-audit.int.spec.ts` describe "the built dist carries the source
version through the build", asserting `distVersion === sourceVersion`) is
tautological: `@nx/js:tsc` copies the source `package.json` verbatim into dist, so
dist version ALWAYS equals source version by construction of the build. The REAL
invariant (publish packs dist, not source) is already guarded by release-hygiene's
REL-04 (`packageRoot === build.outputPath`), and the adopted globalSetup + rewritten
verdaccio-publish exercise the full publish->install-by-name->run round-trip, which
subsumes version parity (a wrong dist version would fail install-by-name). Nothing
references this `it`/`describe`; deleting it only drops tarball-audit's count (7 -> 6).
No cross-spec dependency on the count. Confirmed safe to delete.

### exit-codes.ts comment fix (dev-source only): SURVIVES, KEEP toExitCode
The header comment says "One definition, three consumers (Nx executor now, Angular
CLI builder + CLI later)". The Nx executor actually consumes `evaluateResult`
(`executor.ts:4,104`), NOT `toExitCode` - so `toExitCode` currently has NO live
consumer; it is the deliberate COR-04 deferred-CLI scaffold. Fix the comment to say
so (e.g. "the deferred standalone CLI is the only consumer; the Nx executor uses
`evaluateResult`, not `toExitCode`"). Do NOT delete `toExitCode`.

### loadTypescript dedup (shipped source): SURVIVES, preserve D-02 anti-leak
`loadTypescript` is byte-identical in `render-report.ts:31-40` and
`run-typecheck.ts:625-634` (each with its own `cachedTypescript` module-level memo).
Extract into a module-private `packages/angular-typechecker/src/core/load-typescript.ts`
leaf exporting a single `loadTypescript()` with one shared memo; import it in both.
**It must NEVER be added to `src/index.ts`** (the D-02 anti-leak: the `ts` load stays
inside core, not barrel-exported). Gate the change on the plugin unit suite (`nx test
angular-typechecker`) + the tarball-audit attw/publint + `@fixtures`-leak guards
(they prove no new surface leaks into shipped `.d.ts`). KEEP `TemplateCheckAborted.code`
(drift pin) untouched. This is the ONLY shipped-source change in the set - it carries
the most release risk on PR #23; it is safe (same runtime, one shared cache instead of
two) but the reviewer may choose to defer it to a follow-up if release urgency
dominates.

---

## nx.dev docs cross-check (cited)

- `@nx/js:verdaccio` executor - options match the installed schema exactly
  (location/storage/port/listenAddress/config/clear/scopes; port required;
  clear default true). The docs confirm `config` is "a custom configuration file
  that overrides Verdaccio's default settings" and `scopes` "add to the Verdaccio
  config" (npm-config scopes) - consistent with the source finding that `scopes`
  does NOT control package `proxy` routing. Docs do not cover stop/lifecycle; the
  source does (fork + signal handlers).
  URL: https://nx.dev/nx-api/js/executors/verdaccio
- `@nx/js:setup-verdaccio` generator - docs list only `--skipFormat` /
  `--skipPackageJson` and the one-line "Setup Verdaccio local-registry"; the created
  files/target/dependency detail is NOT in the docs (read from source above).
  URL: https://nx.dev/nx-api/js/generators/setup-verdaccio
- "Update Your Local Registry Setup" recipe - confirms the canonical globalSetup uses
  `startLocalRegistry` from `@nx/js/plugins/jest/local-registry` + `releaseVersion`/
  `releasePublish` from `nx/release`. We deliberately DIVERGE from `releaseVersion`
  ({ specifier: '0.0.0-e2e' }) because it mutates the source version on disk (bad on a
  release PR) - we publish the real dist at its real version with `nx release publish
  --registry <local> --first-release`. The recipe's snippet is quoted here for the
  record:
  ```ts
  await releaseVersion({ specifier: '0.0.0-e2e', stageChanges: false, gitCommit: false,
    gitTag: false, firstRelease: true, versionActionsOptionsOverrides: { skipLockFileUpdate: true } });
  await releasePublish({ tag: 'e2e', firstRelease: true });
  ```
  URL: https://nx.dev/recipes/nx-release/update-local-registry-setup

Acceptance check of the doc-recommended path against the three behaviors: the docs'
default `config.yml` (`'**': proxy: npmjs`, no `auth`) FAILS behaviors 1 and 2 as
shipped, and the docs' dummy-token path FAILS behavior 2 on Verdaccio 6 per this
repo's verified finding. So the doc pattern is the SKELETON; our three customizations
(no-proxy block, auth.htpasswd + real token, log.level http) are the delta that meets
the acceptance criteria. Behavior 3 (Windows spawn/kill) is met by `startLocalRegistry`
forking nx directly, with the documented benign Windows-local caveat.

---

## Recommended atomic-task breakdown (ordered; suite green at each step)

Land on `release/0.1.1`. Run the relevant suite green after each task.

1. **M8/M9 - shared test-util helpers (pure refactor).**
   1a. Add `NX_RUNNER_ENV_KEYS`, `buildCleanEnv({stripAllNpmConfig})`, `RunResult`,
       `run`, `removeTmpDir`, `sh` to `libs/test-util` and re-export from
       `index.ts`. No consumer change yet -> green (existing tests untouched).
   1b. Migrate the 9 spec files (cache-e2e x3, install-e2e x5 incl. current
       verdaccio-publish, matrix-e2e x1) to import the shared helpers; delete the
       per-file copies. Run each e2e project's suite green (`--parallel=1`).
   (Do this first so later tasks touch fewer lines; the new globalSetup + rewritten
   spec consume the shared helpers from the start.)

2. **Generator + config customization (behaviors 1, 2, 3-readiness).**
   `nx g @nx/js:setup-verdaccio`; edit `.verdaccio/config.yml` (add `angular-typechecker`
   no-proxy block, add `auth.htpasswd`, `log.level: http`); relocate the
   `local-registry` target if it landed on an unwanted root project; confirm
   `verdaccio` devDep unchanged (already 6.7.4). No spec consumes it yet -> suite
   still green.

3. **globalSetup + verdaccio-publish rewrite (one logical change).**
   Add `src/global-setup.ts` (startLocalRegistry + single build + mint token +
   provenance-strip + `nx release publish --registry --first-release` + provide);
   wire `globalSetup` + the `ProvidedContext` augmentation into `vitest.config.mts`.
   Rewrite `verdaccio-publish.int.spec.ts` to `inject` URL+token, do install-by-name
   -> init -> configuration -> typecheck, assert compiled `.js` + zero `.ts` + (M13)
   a `.d.ts` exists, using `readdirSync(recursive)` (R1). Keep the never-publish-to-
   npmjs SAFETY assertion (now in globalSetup). Run `angular-typechecker-install-e2e`
   green.

4. **Propagate shared build to sibling install-e2e specs (E1) + R1 + M9.**
   Drop the per-spec `nx build` from tarball-audit / install-smoke / nx-add-e2e /
   generator-e2e (use shared dist); keep their `npm pack`. Apply R1 to tarball-audit's
   `collectDtsText`. Apply M9 to the bare install/init/configuration `execSync` calls.
   Run the project suite green.

5. **A3 - delete tarball-audit REL-04 version-parity `describe`.** Run green.

6. **M14 - add `dependsOn:["build"]` to `nx-release-publish`.** Verify `npx nx
   release publish --dry-run --first-release`; optionally add a release-hygiene
   assertion. Run green.

7. **Shipped-source cleanups (LAST - highest release risk on PR #23).**
   7a. Fix the `exit-codes.ts` header comment (keep `toExitCode`).
   7b. Dedup `loadTypescript` into module-private `core/load-typescript.ts` (never
       barrel-exported; keep `TemplateCheckAborted.code`). Gate on `nx test
       angular-typechecker` + `nx build` + tarball-audit (publint/attw + `@fixtures`
       leak). Reviewer may defer 7 to a follow-up if release urgency dominates.

Final gate (per repo rules): full serialized e2e suite on the merged tree, plus
`nx format:check` and `nx run-many -t lint --skip-nx-cache` (maxWarnings:0) before the
Release PR.

---

## Open questions / risks

1. **Generator target placement.** Where `local-registry` lands (root project vs
   `package.json` nx.targets vs a new root project) depends on this repo's TS-setup
   detection - resolve at generation time (task 2) and relocate if a new root project
   is created. LOW risk (inert target).
2. **startLocalRegistry readiness at log.level.** Mitigated by `log.level: http`.
   If the scrape ever hangs, the fallback is the direct `spawn` + HTTP port-poll the
   0.1.1 spec already proved. MEDIUM->LOW with the config fix.
3. **Windows-local verdaccio orphan on teardown** (behavior 3). Benign,
   CI-irrelevant; documented fallback (kill-by-port / taskkill on the nx pid). LOW.
4. **M14 dependsOn honored by `nx release publish`.** HIGH that it is (targets run
   via the orchestrator); the explicit CI build makes it a cache hit either way, so
   even if ignored nothing breaks. Verify with `--dry-run`.
5. **htpasswd idempotency across runs.** Resolved by wiping htpasswd each run
   (clear-in-storage or explicit `rmSync`). LOW.

---

## Sources

- Installed `@nx/js@23.0.1` source (HIGH - canonical): `dist/src/generators/setup-verdaccio/{generator.js,files/config.yml,schema.json}`, `dist/src/executors/verdaccio/{verdaccio.impl.js,schema.json}`, `dist/src/utils/add-local-registry-scripts.js`, `dist/src/plugins/jest/start-local-registry.js`, `dist/src/utils/versions.js`, `package.json` (exports map).
- This repo (HIGH): the 6 install-e2e specs, `vitest.config.mts`, `project.json` (e2e + `packages/angular-typechecker`), `nx.json` (release block), `.github/workflows/release.yml`, `libs/test-util/src/index.ts`, `packages/angular-typechecker/src/core/{exit-codes.ts,run-typecheck.ts,render-report.ts}`, and the 0.1.1 quick-task SUMMARY (verified Verdaccio-6 dummy-token 401, strip-all-npm_config, direct-fork spawn rationale).
- Reference clone `push-based/nx-verdaccio` `examples/e2e/cli-e2e-original/setup/global-setup.ts` (MEDIUM - a different but analogous globalSetup shape: start registry -> publish-all via nx run-many -> install -> teardown stop+unconfigure+rm storage).
- nx.dev docs (MEDIUM - thin, source is authoritative): `nx-api/js/executors/verdaccio`, `nx-api/js/generators/setup-verdaccio`, `recipes/nx-release/update-local-registry-setup` (URLs cited above).

## RESEARCH COMPLETE

File: `D:\projects\github\LayZeeDK\angular-typechecker\.planning\quick\260704-mse-fix-nx-release-publishing-typescript-sou\260704-mse-A1-RESEARCH.md`
