---
phase: 260704-wnq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts
  - .github/workflows/ci.yml
autonomous: true
requirements:
  - QUICK-wnq-nx-add-e2e
user_setup: []

must_haves:
  truths:
    - "The install-e2e suite runs an npm spec that executes the REAL `nx add angular-typechecker` (not `npm install --save-dev`, not `nx g ...:init`) on an npm workspace at Verdaccio and asserts init seeded the typecheck targetDefaults"
    - "The install-e2e suite runs a pnpm spec that executes the REAL `nx add angular-typechecker` on a pnpm 11 workspace and asserts the OBSERVED build-gate FAILURE"
    - "The install-e2e suite runs a yarn spec that executes the REAL `nx add angular-typechecker` on a yarn 4 workspace at Verdaccio and asserts the OBSERVED SUCCESS (init seeds targetDefaults)"
    - "All three new specs consume the shared Verdaccio globalSetup (inject verdaccioUrl/verdaccioToken); no second registry is stood up"
    - "The CI e2e job makes yarn resolvable (corepack enable) so nx add's bare-`yarn add` child resolves"
    - "The full install-e2e suite passes and nx format:check + lint are clean"
  artifacts:
    - path: "e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts"
      provides: "Real `nx add` on npm workspace at Verdaccio; asserts init seeds targetDefaults"
      contains: "nx add angular-typechecker"
    - path: "e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts"
      provides: "Real `nx add` on pnpm 11 workspace; asserts the pnpm ignored-builds gate signature"
      contains: "nx add angular-typechecker"
    - path: "e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts"
      provides: "Real `nx add` on yarn 4 workspace at Verdaccio; asserts init seeds targetDefaults"
      contains: "nx add angular-typechecker"
    - path: ".github/workflows/ci.yml"
      provides: "corepack enable step in the e2e job so yarn is on PATH"
      contains: "corepack enable"
  key_links:
    - from: "nx-add-npm.int.spec.ts"
      to: "shared Verdaccio registry"
      via: "inject('verdaccioUrl') + fixture .npmrc (registry + minted token)"
      pattern: "inject\\('verdaccioUrl'\\)"
    - from: "nx-add-pnpm.int.spec.ts"
      to: "shared Verdaccio registry"
      via: "inject('verdaccioUrl') + fixture .npmrc (registry + minted token)"
      pattern: "inject\\('verdaccioUrl'\\)"
    - from: "nx-add-yarn.int.spec.ts"
      to: "shared Verdaccio registry"
      via: "inject('verdaccioUrl') + fixture .yarnrc.yml (npmRegistryServer + npmAuthToken)"
      pattern: "inject\\('verdaccioUrl'\\)"
    - from: "all three specs"
      to: "real nx add command"
      via: "bare `<pm> ... nx add angular-typechecker` (NOT nx g angular-typechecker:init, NOT <pm> install by-name)"
      pattern: "nx add angular-typechecker"
---

<objective>
Add real `nx add angular-typechecker` e2e coverage for ALL THREE package managers
by adding three clearly-named spec files to the EXISTING
`angular-typechecker-install-e2e` project (reusing its shared Verdaccio
globalSetup + serialized vitest config), plus the one CI change that lets the
yarn spec run in CI.

Coverage gap this closes: NO spec today runs the REAL `nx add angular-typechecker`.
- `verdaccio-publish.int.spec.ts` proves npm install-BY-NAME from Verdaccio, then
  a MANUAL init/configuration/typecheck -- not `nx add`.
- `nx-add-e2e.int.spec.ts` proves only the `nx g angular-typechecker:init`
  SUBSTITUTE (tarball install + the internal init command) -- not `nx add`.
So nx add's real package-manager orchestration (detect PM -> `<pm> add` -> init)
is never exercised, for any PM. These specs close that gap for npm, pnpm 11, and
yarn 4 -- the latest majors compatible with Angular 22 + Nx 23.

Keep the existing `nx-add-e2e.int.spec.ts` substitute spec (it proves the
init-from-absent invariant offline; do NOT delete it).

Purpose: prove the REAL install path for every PM, and pin the empirically
observed pnpm 11 build-script-gate failure as a regression tripwire.
Output: three new `src/*.int.spec.ts` files + a `corepack enable` step in ci.yml.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260704-wnq-add-nx-add-coverage-to-e2e-tests-add-at-/260704-wnq-CONTEXT.md
@.planning/quick/260704-wnq-add-nx-add-coverage-to-e2e-tests-add-at-/260704-wnq-RESEARCH.md

# The closest analogs. Extend these patterns; do NOT reinvent them.
@e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts
@e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts
@e2e/angular-typechecker-install-e2e/src/global-setup.ts
@e2e/angular-typechecker-install-e2e/vitest.config.mts
@e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/package.json
@e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/nx.json
@libs/test-util/src/lib/e2e-process.ts
@.github/workflows/ci.yml

<interfaces>
<!-- Contracts the executor needs. Extracted from the codebase -- use directly. -->

From @workspace/test-util (libs/test-util/src/lib/e2e-process.ts):
- buildCleanEnv(options?: { stripAllNpmConfig?: boolean }): NodeJS.ProcessEnv
    -- pass { stripAllNpmConfig: true } (globalSetup sets npm_config_registry
       process-wide; the singleFork worker inherits it and it would outrank the
       fixture PM config). Also sets NX_DAEMON=false + FORCE_COLOR=0 and strips
       the NX runner vars. In the default (non-strip) mode it strips only the
       legacy-peer-deps override.
- sh(command: string, options: { cwd: string; env: NodeJS.ProcessEnv }): string
    -- execSync wrapper. On non-zero exit it THROWS `new Error(\`${command}\n${stdout}${stderr}\`)`
       -- i.e. the thrown Error.message carries the combined stdout+stderr. This
       is how the pnpm FAILURE spec captures + asserts the failure signature
       (wrap in try/catch, assert on error.message substrings).
- run(cwd, target, options?): { stdout: string; code: number }
    -- ONLY for `npx nx run <target>`; NOT usable for a bare `<pm> ... nx add`.
- removeTmpDir(dir: string): void  -- EPERM-tolerant teardown (use in finally).
- findWorkspaceRoot(fromDir: string): string  -- walks up to nx.json.

From vitest: inject('verdaccioUrl'): string, inject('verdaccioToken'): string
  (provided by the shared globalSetup; the ProvidedContext augmentation lives in
  global-setup.ts -- do NOT re-declare it).

Shared Verdaccio facts (global-setup.ts / verdaccio-publish.int.spec.ts):
- Registry URL is always `http://localhost:<port>` (http, localhost).
- The minted token is a real bearer; the nerf-dart auth line the npm specs write
  is: `//${new URL(url).host}/:_authToken="<token>"` alongside `registry=<url>`.
- To block the user ~/.npmrc (and the repo-root legacy-peer-deps .npmrc) from
  reintroducing a peer override into a nested npm install, verdaccio-publish sets
  `npm_config_userconfig` to a nonexistent path in the sh env; the nested
  `nx add`/`npm install` child inherits that env. Mirror this for the npm spec.
- .verdaccio/config.yml proxies npmjs for everything EXCEPT the
  angular-typechecker no-proxy block -- so a fixture's nx/angular/ts/esbuild deps
  resolve through the proxy while angular-typechecker resolves from the freshly
  published LOCAL dist. Both pnpm and yarn honor a single default registry.

nx add behavior (RESEARCH Q2, traced in nx 23.0.1):
- `nx add angular-typechecker` -> detectPackageManager (lockfile precedence
  yarn.lock > pnpm-lock.yaml > package-lock.json, else user-agent, else npm) ->
  `<addDev> angular-typechecker[@latest]` via child_process.exec (inherits PATH),
  non-zero exit -> "Failed to install angular-typechecker" + process.exit(1);
  on success -> runPluginInitGenerator -> the internal `g angular-typechecker:init`.
- addDev per PM: npm -> `npm install -D ...@latest`; pnpm(+workspace) ->
  `pnpm add -Dw ...@latest`; yarn berry -> `yarn add -D ...` (no @latest).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: npm real `nx add` spec (asserts the observed success + seeded targetDefaults)</name>
  <files>e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts</files>
  <action>
Create a new spec mirroring `verdaccio-publish.int.spec.ts` for the
fixture/registry setup and `nx-add-e2e.int.spec.ts:131-141` for the nx.json
targetDefaults assertion -- but drive the REAL `nx add`, not `npm install
--save-dev` and not `nx g ...:init`. Per the coordinator scope update + RESEARCH.

Reuse the sibling imports + resolution: findWorkspaceRoot from import.meta.url;
fixtureDir = e2e/angular-typechecker-install-e2e/fixtures/consumer-generator;
env = buildCleanEnv({ stripAllNpmConfig: true }).

Inside the it() (300000ms timeout):
1. mkdtempSync an OS-temp dir; cpSync the fixture into it; wrap the body in
   try/finally with removeTmpDir(tmp) in finally.
2. Point npm at Verdaccio: write `.npmrc` in tmp with `registry=<verdaccioUrl>`
   + the nerf-dart `//host/:_authToken="<token>"` line (same shape as
   verdaccio-publish.int.spec.ts), from inject('verdaccioUrl')/('verdaccioToken').
3. Seeded-from-absent baseline: read tmp/nx.json and assert
   `targetDefaults?.['angular-typechecker:typecheck']` is undefined BEFORE (so
   the post-assert is non-vacuous, like nx-add-e2e.int.spec.ts).
4. Provision the fixture's own deps + the nx binary + a `package-lock.json` (so
   nx detects npm): sh('npm install', { cwd: tmp, env: { ...env,
   npm_config_userconfig: join(tmp, '.npmrc.nonexistent') } }).
5. Run the REAL command: sh('npx nx add angular-typechecker', { cwd: tmp, env:
   { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') } }). nx add
   detects npm -> runs `npm install -D angular-typechecker@latest` (resolves the
   dist-tag from Verdaccio; npm has NO build-script gate so it succeeds) -> then
   runs the internal `g angular-typechecker:init`.
6. Assert: read + JSON.parse tmp/nx.json AFTER; the seeded
   `targetDefaults['angular-typechecker:typecheck']` is defined with
   `cache === true`, `outputs` deep-equals [], and `inputs[0] === 'default'`
   (mirror nx-add-e2e.int.spec.ts:137-141).

The executor MUST run the flow FIRST and assert what actually happens. If nx
add's init needs a signal it cannot pass through (e.g. formatting without
Prettier), OBSERVE the real behavior -- nx's formatFiles no-ops when Prettier is
absent, so init is expected to succeed; adapt only if the observed output proves
otherwise, and record any adaptation in the summary.

Header comment: state this is the REAL `nx add` on npm (contrast with
verdaccio-publish's install-BY-NAME + manual init, and nx-add-e2e's `nx g
...:init` substitute), and that it runs serialized on the main tree under the
shared globalSetup. NO fenced command blocks in assertions -- assert observed values.
  </action>
  <verify>
  <automated>npx nx test angular-typechecker-install-e2e 2>&1 | rg -n "nx-add-npm|angular-typechecker:typecheck|passed|failed"</automated>
  </verify>
  <done>nx-add-npm.int.spec.ts runs the REAL `npx nx add angular-typechecker` on an npm workspace at local Verdaccio and PASSES by asserting init seeded the typecheck targetDefaults (cache:true, outputs:[], inputs[0]==='default'). It consumes the shared registry via inject().</done>
</task>

<task type="auto">
  <name>Task 2: pnpm 11 real `nx add` spec (asserts the observed build-script gate FAILURE)</name>
  <files>e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts</files>
  <action>
Create a new spec mirroring `verdaccio-publish.int.spec.ts` for imports +
workspace-root/fixture-dir resolution; env = buildCleanEnv({ stripAllNpmConfig:
true }). Per RESEARCH "Recommended test design" and Q3.

Availability guard: at module load, probe pnpm reachability (e.g. try
sh('pnpm --version') / 'corepack --version' in a try/catch returning a boolean)
and gate the it() with it.skipIf(!available) so a host without pnpm/corepack
(e.g. Node 25+ without corepack) skips cleanly. CI provides pnpm 11.9.0 on PATH
via pnpm/action-setup, so CI runs it.

Inside the it() (300000ms timeout):
1. mkdtempSync + cpSync the fixture; try/finally with removeTmpDir(tmp).
2. Make it a REAL pnpm 11 workspace with an UNAPPROVED build-script dep so the
   gate can fire (Q3): write `pnpm-workspace.yaml` containing `packages: ['.']`
   and NO `allowBuilds` key; read the copied package.json, add `esbuild` (a
   build-script dep -- RESEARCH used `0.24.0`) to devDependencies, and set
   `packageManager: 'pnpm@11.9.0'` to MATCH CI's action-setup pnpm exactly
   (avoids the A5 corepack-vs-PATH version clash), then write it back.
3. Point pnpm at Verdaccio: write `.npmrc` with `registry=<verdaccioUrl>` + the
   nerf-dart `//host/:_authToken="<token>"` line, from inject().
4. Provision WITHOUT tripping the gate: sh('pnpm install --ignore-scripts', ...)
   -- exit 0; materializes node_modules + the nx binary + a `pnpm-lock.yaml`
   (nx detectPackageManager -> pnpm).
5. Run the REAL command: `pnpm exec nx add angular-typechecker`. It WILL exit
   non-zero -- capture it by wrapping sh(...) in try/catch and keeping the thrown
   Error (do NOT let it throw uncaught). nx add runs `pnpm add -Dw
   angular-typechecker@latest`, pnpm re-evaluates the tree, esbuild's build is
   unapproved -> ERR_PNPM_IGNORED_BUILDS exit 1 -> nx add prints "Failed to
   install angular-typechecker" and process.exit(1).
6. Assert: the command threw (non-zero exit) AND the captured message contains
   the observed stable substring(s). RESEARCH A2 flags exact wording as
   patch-dependent -- run the flow FIRST, read the real output, and lock the
   assertion on whichever stable substring(s) actually appear (candidates:
   'ERR_PNPM_IGNORED_BUILDS' and/or 'Failed to install angular-typechecker').
   Assert on what is observed, per CONTEXT's "test asserts reality" rule.

NON-VACUOUS GUARD (plan-checker Warning 1 -- LOAD-BEARING for this tripwire):
a pure catch-only assertion FALSE-PASSES if `nx add` unexpectedly SUCCEEDS
(the catch never runs, no assertion executes, the test goes green and the
regression tripwire is silently defeated). You MUST make "did not throw" a
RED failure. Use one of:
  - a `let caught = false;` flag set `true` inside `catch`, then AFTER the
    try/catch: `expect(caught).toBe(true);` before asserting the substrings; OR
  - `expect.fail('nx add unexpectedly succeeded -- pnpm build-gate did not fire')`
    as the LAST statement inside the `try`, immediately after the `sh(...)` call.
This also defends the one empirical gap RESEARCH Q3 did not prove in a cell:
esbuild is PRE-installed via `pnpm install --ignore-scripts`, then `nx add`
runs `pnpm add -Dw angular-typechecker@latest` (a DIFFERENT package) -- the
claim that the pre-existing unapproved esbuild re-arms ERR_PNPM_IGNORED_BUILDS
on that add is very likely but observe-first-verified. If the observed reality
is that `nx add` SUCCEEDS (gate does not fire on the add of a different
package), do NOT force a failing assertion: STOP and report it in the SUMMARY
as a finding (the pnpm bug's repro is narrower than assumed) so the coordinator
can adjust scope -- a green-because-it-actually-succeeded spec must assert that
observed success, not a fabricated failure.

LOAD-BEARING CORRECTION (RESEARCH Q3): pnpm v11 REMOVED `onlyBuiltDependencies`
(the key the handoff/anti-pattern named) -- do NOT put it in the fixture; on
pnpm 11 the gate fires purely from an unapproved build-script dep in the tree.
The pnpm-11 approval key is `allowBuilds`. Do NOT write comments that frame this
as a "v1"/simplified proof -- it is the real failure the task exists to pin.

Header comment: state this is the REAL `nx add` (not the `nx g ...:init`
substitute), that esbuild is the unapproved build-script dep that arms the gate,
and that it runs serialized on the main tree under the shared globalSetup.
NO fenced pnpm/yaml examples in the assertion values -- assert observed strings.
  </action>
  <verify>
  <automated>npx nx test angular-typechecker-install-e2e 2>&1 | rg -n "nx-add-pnpm|ERR_PNPM_IGNORED_BUILDS|Failed to install|passed|failed"</automated>
  </verify>
  <done>nx-add-pnpm.int.spec.ts runs the REAL `pnpm exec nx add angular-typechecker` on a pnpm 11 workspace with an unapproved esbuild build-script dep, and PASSES by asserting the observed non-zero exit + failure signature. It consumes the shared registry via inject() and skips cleanly when pnpm/corepack is unavailable.</done>
</task>

<task type="auto">
  <name>Task 3: yarn 4 real `nx add` spec (asserts observed success) + CI corepack enable</name>
  <files>e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts, .github/workflows/ci.yml</files>
  <action>
PART A -- yarn spec. Create a new spec mirroring `verdaccio-publish.int.spec.ts`
for setup and `nx-add-e2e.int.spec.ts:131-141` for the nx.json targetDefaults
assertion. Per RESEARCH Q4/Q5/Q6 and "Recommended test design".

Availability guard: probe yarn/corepack reachability at module load and gate the
it() with it.skipIf(!available). yarn 4 is delivered via corepack (NOT the `yarn`
npm dist-tag), so corepack is required.

Inside the it() (300000ms timeout):
1. mkdtempSync + cpSync the fixture; try/finally with removeTmpDir(tmp).
2. Make it a REAL yarn 4 workspace: read the copied package.json, set
   `packageManager: 'yarn@4.17.0'` (latest berry; corepack routes to it), write back.
3. Write `.yarnrc.yml` at tmp root with these keys (RESEARCH Q4 -- all
   load-bearing): `nodeLinker: node-modules` (a real node_modules tree for the nx
   executor + require()); `npmRegistryServer:` = inject('verdaccioUrl');
   `npmAuthToken:` = inject('verdaccioToken') (yarn 4 auth form, NOT .npmrc);
   `unsafeHttpWhitelist:` a list containing `localhost` (yarn 4 blocks http by
   default -- YN0081 without this); `enableTelemetry: false`;
   `enableImmutableInstalls: false` (defensive: yarn auto-enables immutable under
   CI env); and a per-fixture cache -- `cacheFolder: ./.yarn/cache` +
   `enableGlobalCache: false` -- so the LOCAL published dist is used, not a
   globally-cached npmjs angular-typechecker (RESEARCH A4). Build this YAML with a
   small string template or minimal object-to-YAML lines; do NOT add a YAML lib.
4. Ensure yarn is on PATH for nx add's BARE `yarn add` child (RESEARCH A3/Q6):
   sh('corepack enable', ...) (corepack's sanctioned shim install -- NOT a manual
   PATH edit) then sh('corepack yarn install', ...) (writes yarn.lock -> detection
   resolves yarn; provisions node_modules + the nx binary).
5. Run the REAL command: `corepack yarn nx add angular-typechecker` (nx add
   detects yarn berry -> runs `yarn add -D angular-typechecker` no `@latest` ->
   resolves the dist-tag from Verdaccio -> on success runs `g
   angular-typechecker:init`). Capture output with sh(...).
6. Assert the OBSERVED outcome. EXPECTED (RESEARCH, confidence MEDIUM -- A1): it
   SUCCEEDS and init seeds nx.json `targetDefaults['angular-typechecker:typecheck']`
   with `cache === true`, `outputs` deep-equals [], and `inputs[0] === 'default'`.
   Read + JSON.parse tmp/nx.json AFTER; and (plan-checker info item -- parity with
   the npm spec, defense against future fixture drift) assert the seeded-from-absent
   baseline BEFORE (`targetDefaults?.['angular-typechecker:typecheck']` undefined)
   so the post-assert is non-vacuous.

The executor MUST run the flow FIRST and assert what actually happens (A1). If
the child-`yarn` PATH issue (A3) surfaces, resolve via `corepack enable` before
finalizing. Init formatting without Prettier: nx's formatFiles no-ops when
Prettier is absent, so init is expected to succeed; adapt only if observed output
proves otherwise, and record any adaptation in the summary.

Header comment: state this is the REAL `nx add` on yarn 4 (not the init
substitute), the per-fixture cache proves the local dist, serialized on the main
tree under the shared globalSetup. NO fenced yaml/command blocks in assertions.

PART B -- CI corepack enable. Add a `- run: corepack enable` step to the `e2e`
job (the Linux-only, Node 24 tarball/install gate, ci.yml lines 141-173). The
e2e job pins Node 24 (ships corepack) and provisions pnpm via
pnpm/action-setup version 11.9.0, but yarn is NOT provisioned, so nx add's
bare-`yarn add` child in this yarn spec would not resolve (RESEARCH Q6 "CI
provisioning gap"). Placement: insert the step AFTER `actions/setup-node`
(corepack needs Node present); keeping it alongside the existing pnpm/action-setup
step is fine -- corepack enable installs the yarn (and pnpm) shims on PATH. Since
the pnpm fixture pins `pnpm@11.9.0` (Task 2) -- the same version action-setup
provides -- a corepack pnpm shim that shadows resolves the identical version (no
A5 clash). Do NOT remove the pnpm/action-setup step. Match the file's style:
plain `run:` step (no action ref, so no SHA pin), fixed command with NO
PR-metadata interpolation (preserves the no-injection posture), 2-space YAML
indentation; add a short comment on the step (yarn 4 for the nx-add-yarn spec;
Node 24 has corepack). Do NOT touch any other job.
  </action>
  <verify>
  <automated>npx nx test angular-typechecker-install-e2e 2>&1 | rg -n "nx-add-yarn|angular-typechecker:typecheck|passed|failed"; git grep -n "corepack enable" .github/workflows/ci.yml</automated>
  </verify>
  <done>nx-add-yarn.int.spec.ts runs the REAL `corepack yarn nx add angular-typechecker` on a yarn 4 workspace pointed at local Verdaccio and PASSES by asserting the observed outcome (expected: success -> init seeds the typecheck targetDefaults); it consumes the shared registry via inject() and skips cleanly when yarn/corepack is unavailable. The ci.yml e2e job has a `corepack enable` step after setup-node; the workflow YAML still parses and no other job changed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test harness -> package registry | All three specs run real package managers that fetch packages. The shared globalSetup already refuses any non-local registry before publishing, and the specs point npm/pnpm/yarn at `http://localhost:<port>` Verdaccio only. |
| CI runner -> corepack shims | `corepack enable` installs PM shims on PATH in the ephemeral CI runner only. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wnq-01 | Tampering | fixture PM registry config (.npmrc / .yarnrc.yml) | mitigate | Registry + auth come ONLY from inject('verdaccioUrl'/'verdaccioToken') (local Verdaccio); URL is known/asserted http://localhost. No hardcoded external registry. userconfig is pinned to a nonexistent path so ~/.npmrc / repo-root .npmrc cannot inject a peer override into a nested npm install. |
| T-wnq-02 | Info Disclosure | minted Verdaccio bearer token | accept | Token is a per-run local-registry credential minted by globalSetup; never a real npmjs secret; scoped to the ephemeral test registry. |
| T-wnq-SC | Tampering | npm/pnpm/yarn/esbuild package installs | accept | No NEW repo dependency is added: esbuild is added to a COPIED tmp FIXTURE package.json at runtime (not the repo), resolves via Verdaccio's npmjs proxy, and its build script is what the pnpm test deliberately gates. pnpm 11.9.0 + yarn 4.17.0 are corepack-delivered PM runtimes, version-pinned per RESEARCH Q1 (dist-tags fetched 2026-07-04). No package-manager install adds a dependency to the published `angular-typechecker` package. |
</threat_model>

<verification>
Authoritative signal is the test runner, NOT the LSP (per CLAUDE.md). These
specs run REAL package managers and are SLOW (300000ms timeouts) and MUST run
serialized on the MAIN tree (no worktree) -- this is a single-plan quick task, so
run the executor sequentially on the main checkout with real node_modules.

1. `npx nx test angular-typechecker-install-e2e` -- the full install-e2e suite
   (existing specs + the three new specs) passes. The shared globalSetup builds +
   publishes dist once; all three new specs consume it via inject().
2. `npx nx format:check` -- clean (blank-lines-around-control-flow + single-quote
   conventions; new spec files are Prettier-owned).
3. `npx nx run-many -t lint` -- clean (maxWarnings:0 is baked into targetDefaults).
4. ci.yml parses (actionlint / act-compat unaffected).

Observe-at-runtime (RESEARCH assumptions table -- resolve empirically, do not
guess): A1 (yarn nx add succeeds + seeds targetDefaults), A2 (exact pnpm failure
substring), A3 (child-`yarn` PATH needs corepack enable), A4 (per-fixture yarn
cache to prove local dist), A5 (pnpm 11.9.0 pin vs corepack). The executor runs
each real flow, reads the actual output, and locks each assertion on the observed
stable substrings before finalizing. The npm success path also observes init's
real behavior (formatFiles no-ops without Prettier).
</verification>

<success_criteria>
- Three new specs exist in `e2e/angular-typechecker-install-e2e/src/`:
  `nx-add-npm.int.spec.ts`, `nx-add-pnpm.int.spec.ts`, `nx-add-yarn.int.spec.ts`.
- Each runs the REAL `nx add angular-typechecker` (NOT `nx g
  angular-typechecker:init`, NOT `<pm> install`-by-name).
- npm spec: real `nx add` on an npm workspace at Verdaccio -> observed SUCCESS ->
  init seeds the typecheck targetDefaults.
- pnpm spec: real `nx add` on a pnpm 11 workspace with an unapproved esbuild
  build-script dep -> observed FAILURE (non-zero exit + failure signature). No
  `onlyBuiltDependencies` in the fixture.
- yarn spec: real `nx add` on a yarn 4 workspace at Verdaccio -> observed SUCCESS
  -> init seeds the typecheck targetDefaults.
- The existing `nx-add-e2e.int.spec.ts` substitute spec is retained (not deleted).
- All three consume the shared Verdaccio globalSetup via inject(); no second registry.
- pnpm + yarn specs skip cleanly when the PM / corepack is unavailable.
- ci.yml e2e job has a `corepack enable` step so the yarn spec runs in CI.
- `npx nx test angular-typechecker-install-e2e` + `npx nx format:check` +
  `npx nx run-many -t lint` all pass.
</success_criteria>

<output>
Create `.planning/quick/260704-wnq-add-nx-add-coverage-to-e2e-tests-add-at-/260704-wnq-SUMMARY.md` when done.
</output>
