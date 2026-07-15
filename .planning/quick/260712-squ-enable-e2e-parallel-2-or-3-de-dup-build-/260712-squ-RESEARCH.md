# Quick Task 260712-squ: Enable e2e `--parallel=2/3` (de-dup build + isolate shared resources) - Research

**Researched:** 2026-07-12
**Domain:** Nx 23 task orchestration + @nx/js Verdaccio e2e + Vitest process isolation
**Confidence:** HIGH (first-party source reads for every load-bearing claim)

## Summary

The e2e tier is four Nx projects run by `nx run-many -t e2e --parallel=1`. Only TWO of
them start a Verdaccio registry (install-e2e, ng-cli-e2e) and only TWO pack the shared dist
tarball (install-e2e, matrix-e2e). The three resources that force `--parallel=1` are exactly
as the orchestrator stated, PLUS a fourth the brief omitted: **the shared `dist/packages/angular-typechecker`
directory** every project builds and reads. Any safe parallelism must build that ONCE upstream.

The canonical "shared single registry across a run-many" pattern is **not cleanly available**
with the current primitive: `@nx/js` `startLocalRegistry` (verified in
`node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js`) forks verdaccio inside a
vitest globalSetup, takes **no `port` parameter** (the port comes from the `local-registry`
TARGET, project.json 4873), and returns a `stop()` that kills the child. Because each
`nx run <project>:e2e` is its own OS process with its own vitest globalSetup, a registry
started by one project cannot outlive that project to be shared. Nx 21+ `continuous: true`
targets and `@push-based/nx-verdaccio` DO solve shared/isolated registries properly, but both
are a target-model refactor - too large for a release-branch quick task.

The pragmatic path is **per-project isolation of the four shared resources + `--parallel=2`**,
using Nx's native `parallelism: false` (verified in `nx@23.0.1` project schema + scheduler) to
keep the delicate correctness gate (cache-e2e) out of the parallel set.

**Primary recommendation:** De-dup the build via `e2e dependsOn angular-typechecker:build`
(built once, cached, read-only during e2e), isolate the tarball (`npm pack --pack-destination`
per project) and the registry (a second `local-registry` target on a distinct port + per-project
storage dir), mark cache-e2e `parallelism: false`, and flip CI to `--parallel=2`. Update
GUARD-01b in lockstep to assert the NEW invariants. Expected wall-clock ~23 min vs ~40 today.

## User Constraints (from task brief - verbatim)

- Release branch: **NEVER mutate any `package.json` version** (all changes additive).
- Keep intact: 127.0.0.1 loopback pin, the "refusing to publish to non-local registry" SAFETY
  gate, the real-token mint, and the provenance strip.
- Windows arm64 primary dev env; CI e2e job is Linux/Node 24, `nx run-many -t e2e`.
- Every GUARD (01/01b/01c/01d) stays meaningful and updated in lockstep - never silently weakened.
- Already-fixed and out of scope: the `NX_INVOCATION_ROOT_PID` TaskInvocationTracker collision.

## Per-e2e-project resource-needs

| Project | Starts registry? | Builds dist? | Packs SHARED `dist/*.tgz`? | Publishes? | Other shared state | Needs isolation for |
|---|---|---|---|---|---|---|
| **install-e2e** | YES (globalSetup, port 4873, storage `./tmp/local-registry/storage`, clearStorage) | YES (globalSetup, `nx build --skip-nx-cache`) | YES - 4 specs (tarball-audit, install-smoke, generator-e2e, nx-add-e2e) | YES (nx release publish, once) | shared dist dir; global npm authToken line | tarball path, registry port, storage dir, shared dist |
| **ng-cli-e2e** | YES (globalSetup, SAME 4873 + SAME storage) | YES (globalSetup) | NO (installs by-name via `ng add` from registry) | YES (once) | shared dist dir; global npm authToken line | registry port, storage dir, shared dist |
| **matrix-e2e** | NO | YES (beforeAll, `nx build --skip-nx-cache`) | YES - 2 specs (matrix-5types, pnpm-symlink) | NO (installs tgz by path) | shared dist dir | tarball path, shared dist |
| **cache-e2e** | NO | NO (uses source barrel via nxViteTsPaths) | NO | NO | shared workspace `.nx` graph/cache/db; mutates `libs/typecheck-consumer-dep` source (heals) | `.nx` db contention (see Pitfall 1) |

**The three brief-listed forcing resources, mapped:** (1) shared tarball path -> install-e2e x matrix-e2e; (2) fixed port 4873 -> install-e2e x ng-cli-e2e; (3) shared storage `./tmp/local-registry/storage` + clearStorage -> install-e2e x ng-cli-e2e.
**Fourth resource (omitted in brief):** the shared `dist/packages/angular-typechecker` dir is written by install/ng-cli/matrix - concurrent `nx build` to it corrupts every packer/publisher. **De-dup build is therefore load-bearing for ANY parallelism**, not just an optimization.

## Key verified facts (first-party)

- **`startLocalRegistry` has no port knob.** `[VERIFIED: node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js]` Params: `{ localRegistryTarget, storage, verbose, clearStorage, listenAddress }`. It forks `nx run <target> --location none --clear <bool> [--storage <dir>]`, scrapes `http://<listenAddress>:PORT` from stdout to learn the port, sets `process.env.npm_config_registry`, and writes a GLOBAL `npm config set //host:port/:_authToken` (user `~/.npmrc`). `stop()` kills the child + deletes that global line. => a distinct port requires a distinct `local-registry` TARGET (project.json), NOT a function arg; `.verdaccio/config.yml`'s port is ignored (the executor passes it on the command line). `[CITED: github.com/nrwl/nx#19683]`
- **Nx 23.0.1 supports per-target `parallelism` and `continuous`.** `[VERIFIED: node_modules/nx/schemas/project-schema.json:141-150]` (`continuous` default false, `parallelism` default true).
- **`parallelism: false` semantics (scheduler).** `[VERIFIED: node_modules/nx/dist/src/tasks-runner/tasks-schedule.js:231-252]` A running `parallelism:false` task blocks ALL other scheduling (runs alone); a `parallelism:false` task can only start when nothing else is running. => a `parallelism:false` project never co-runs with any sibling. It cannot express "may overlap A but not B" (all-or-nothing).
- **6 real pack specs**, all `execSync('npm pack --json', { cwd: dist/packages/angular-typechecker })` -> `angular-typechecker-<ver>.tgz`, `rmSync` in afterAll: install-e2e {tarball-audit:117, install-smoke:74, generator-e2e:96, nx-add-e2e:68}; matrix-e2e {matrix-5types:93, pnpm-symlink:91}. `[VERIFIED: git grep]` (storybook-tarball / verdaccio-publish only MENTION pack in comments; they install by-name.)
- **`npm pack --pack-destination <dir> --json`** writes the tgz to `<dir>` and reports `filename` as the base name (npm 7+). The known scoped-package `filename` bug does NOT apply - `angular-typechecker` is unscoped. `[CITED: docs.npmjs.com/cli/v11/commands/npm-pack]`

## Architecture options (ranked)

| # | Option | What changes (files) | Verify | CI risk | Keeps GUARDs meaningful? | Additive-safe? | Wall-clock |
|---|---|---|---|---|---|---|---|
| **1 (PRIMARY)** | **Per-project isolation -> `--parallel=2`** | nx.json/project.json: `e2e dependsOn angular-typechecker:build`; add 2nd `local-registry-ngcli` target (port 4874); both globalSetups: per-project `storage` dir + own target + DROP in-spec `nx build`; matrix beforeAll: DROP `nx build`; 6 pack specs: `--pack-destination` mkdtemp; cache-e2e project.json: `parallelism:false`; ci.yml `--parallel=2`; GUARD-01b rewrite | `NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` x3 green + `nx test` guards green | Medium (install-e2e now overlaps ng-cli/matrix; more moving parts) | YES (new assertions, see below) | YES (no version touch; 2nd target additive) | ~23 min |
| **2 (FALLBACK A)** | **Build-dedup + `parallelism:false` on install-e2e (+cache-e2e), `--parallel=2`** | `e2e dependsOn build`; drop in-spec builds; install-e2e + cache-e2e project.json `parallelism:false`; ci.yml `--parallel=2`; GUARD-01b lighter rewrite | same command x3 | Low (install stays serialized alone; only ng-cli x matrix overlap) | YES | YES | ~33-35 min |
| **3 (FALLBACK B)** | **De-dup build only, keep `--parallel=1`** | `e2e dependsOn build`; drop the 3 in-spec `nx build` calls | `nx run-many -t e2e --parallel=1` green | Very low | GUARD-01b unchanged | YES | ~40 min (saves ~3 redundant builds only) |
| 4 (not recommended) | **Shared single registry** via Nx 21+ `continuous` local-registry `dependsOn`, or adopt `@push-based/nx-verdaccio` per-env isolation | Move registry+publish OUT of vitest globalSetup into Nx targets; rewire all specs to read URL/token from a shared file/env; or new dependency + `nxv-*` target model | full e2e rewrite verify | High (large refactor on a release branch) | Requires guard rewrite | YES but heavy | ~20 min |

**Why not shared-registry (option 4) now:** the registry lifecycle is bound to a single vitest
globalSetup and cannot outlive its process; `startLocalRegistry` has no shared-instance mode;
publish lives per-project in globalSetup. Making it shared means moving registry + publish into
Nx `continuous` targets and teaching every spec to read a shared URL/token - the proper
long-term architecture (`[CITED: nx.dev continuous tasks]`, `[CITED: github.com/push-based/nx-verdaccio]`),
but far beyond a quick task and risky pre-release.

## RECOMMENDATION: Option 1 (per-project isolation -> `--parallel=2`)

`--parallel=2`, not 3: only 4 projects and only 2 ever start a registry, so 2 ports suffice;
`--parallel=3` adds marginal overlap (~3 min) for more `.nx` db + npm-cache contention. Stop at 2.

### Task breakdown (3 tasks)

**Task 1 - De-dup the build (foundation; also = Fallback B on its own).**
- Add `dependsOn: ["angular-typechecker:build"]` to each `e2e` target (or an `e2e` targetDefault in nx.json).
- Remove `sh('npx nx build angular-typechecker --skip-nx-cache')` from BOTH globalSetups and `execSync('npx nx build ...')` from matrix-e2e beforeAll. Nx now builds dist ONCE (cached; input hash covers src, so freshness is preserved - the `--skip-nx-cache` was belt-and-suspenders). dist is read-only during e2e.
- Keep `nx release publish --excludeTaskDependencies` (still load-bearing: stops the publish's own `dependsOn:["build"]` from re-materializing dist and clobbering the provenance strip).
- Verify each project standalone green + `nx run-many -t e2e --parallel=1` green.

**Task 2 - Isolate resources 1-3.**
- **Tarball (resource 1):** the 6 pack specs -> `npm pack --json --pack-destination <mkdtemp>` (an OS-temp dir per project) instead of packing into `dist`. Read `packResult.filename`, `join(destDir, filename)`; point `tar -xzf` / rmSync at the new path. dist stays read-only.
- **Port (resource 2):** add a second root target `local-registry-ngcli` (port 4874, same `.verdaccio/config.yml`, storage `tmp/local-registry/storage-ngcli`) in project.json. ng-cli-e2e globalSetup references `${rootProjectName}:local-registry-ngcli`; install-e2e keeps `:local-registry`. (Derive from parts to keep the scoped-name guard happy.)
- **Storage (resource 3):** pass a per-project `storage` to `startLocalRegistry` (`./tmp/local-registry/storage-install` vs `-ngcli`). clearStorage now wipes only that project's own dir.
- **Provenance strip under overlap:** install-e2e + ng-cli-e2e can now co-run and both strip the shared dist manifest. It is an idempotent same-value write (`provenance=false`); lowest-effort is to leave it (ponytail note the race ceiling). Cleaner: strip once in a `prepare-e2e-dist` target that `e2e dependsOn`, OR test `npm_config_provenance=false` in the publish env (unverified - publishConfig may win; verify before relying).
- **cache-e2e:** set `parallelism: false` on its `e2e` target so the cache-correctness gate never co-runs with a nested-nx sibling (removes the `.nx` db-contention risk for the riskiest project - Pitfall 1).

**Task 3 - Flip CI + update guards in lockstep.**
- ci.yml: `--parallel=1` -> `--parallel=2`; rewrite the e2e-job comment (the "share one dist tarball path" rationale is now false).
- **GUARD-01b (rewrite, never delete):** replace the `--parallel=1` assertion with the NEW invariants, each fail-loud + located:
  1. ci.yml e2e job passes `--parallel=[23]` (regex `--parallel=[23]\b`) and NOT `--parallel=1`.
  2. Every one of the 6 pack specs packs to a unique destination: assert each source contains `--pack-destination` (no bare pack into `dist/packages/angular-typechecker`). This is the exact prerequisite GUARD-01b's own message already names ("give each e2e project a UNIQUE tarball path").
  3. The two registry globalSetups use DISTINCT `local-registry` targets AND distinct `storage` strings (read both `global-setup.ts` and assert they differ).
  4. cache-e2e's `e2e` target has `parallelism: false` (keeps the correctness gate serialized).
- GUARD-01 / 01c / 01d are UNAFFECTED (still one unscoped `run-many -t e2e`, no `-p` list).
- Verify: `NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` green x3 (no ENOENT / EADDRINUSE / EPUBLISHCONFLICT), then `npx nx test angular-typechecker` (all GUARDs) green.

### Exact verify command

```
NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache   # x3, all 4 projects green
npx nx run-many -t test                                              # GUARD-01/01b/01c/01d green
```

### Fallback ladder

If Option 1 flakes (most likely from cache-e2e `.nx` contention or a registry race), fall back
to **Option 2** (install-e2e serialized alone via `parallelism:false`; only ng-cli x matrix
overlap - no tarball/registry isolation needed because the only packer/registry-pair that could
collide is install, which no longer co-runs). If even that flakes, **Option 3** (build-dedup,
keep `--parallel=1`) is a guaranteed-safe, still-additive win.

### Honest ROI verdict

The wall-clock win is real (~40 -> ~23 min, ~46%) but this is a **CI-only Linux gate that runs
in parallel with the `test`/`fallow`/`format-lint` jobs** - it only shortens PR feedback if e2e
is the long pole. install-e2e is internally serial (singleFork + fileParallelism:false), so its
own ~20 min is a hard floor; parallelism only overlaps the OTHER three under its shadow. De-dup
of the 3 redundant builds saves only ~45s - negligible on its own (that is why Option 3 is a weak
standalone win). The lever is overlapping install-e2e with ng-cli/matrix/cache, which requires
the full isolation. Option 1 is worth it; Option 2 is the low-risk 80%-there compromise.

## Common Pitfalls

### Pitfall 1: cache-e2e shares the workspace `.nx` under concurrency
cache-e2e asserts Nx CACHE hit/miss for `typecheck-consumer:typecheck` against the real `.nx`
db. Concurrent nested-nx siblings contend on the SQLite workspace-data lock (rare transient
"database is locked" - a fail-loud flake, not a false pass; different task hashes mean no
corruption of cache-e2e's verdict). **Mitigation:** `parallelism: false` on cache-e2e's e2e
target (Task 2). This is the Nx-native answer the ecosystem recommends for shared-resource tasks.
`[CITED: github.com/nrwl/nx#19683]`

### Pitfall 2: `startLocalRegistry` writes GLOBAL npm config
It runs `npm config set //host:port/:_authToken` against the user `~/.npmrc` and deletes it in
`stop()`. Two registry projects on DIFFERENT ports write DIFFERENT lines (safe). Same port would
be the collision - which is exactly why the 2nd port (Task 2) matters. `[VERIFIED: start-local-registry.js]`

### Pitfall 3: don't hand-roll ephemeral ports
`startLocalRegistry` has no port arg; `port: 0` on the target relies on unverified verdaccio
ephemeral-port + stdout-scrape behavior. Prefer a second fixed target (4874) - deterministic,
additive, no gamble.

### Pitfall 4: don't add `-p` project lists to the CI e2e run
GUARD-01's whole value is that `run-many -t e2e` (no `-p`) auto-covers every e2e project. A
"grouped" schedule (`-p install,cache` then `-p ng-cli,matrix`) would dodge some isolation code
but reintroduce the silent-miscoverage risk GUARD-01 guards against, and weaken the guard. Reject.

## Sources

### Primary (HIGH - first-party source)
- `node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js` (+ `.d.ts`) - no port param; stdout scrape; global npm config write; `stop()` contract.
- `node_modules/nx/schemas/project-schema.json:141-150` - `continuous` + `parallelism` exist in nx@23.0.1.
- `node_modules/nx/dist/src/tasks-runner/tasks-schedule.js:231-252` - `parallelism:false` runs alone / blocks scheduling.
- Repo: both `global-setup.ts`, all 6 pack specs, cache-e2e/matrix-e2e specs + configs, `ci.yml:204`, `ci-e2e-coverage-guard.spec.ts` (GUARD-01b), project.json x4, nx.json.

### Secondary (MEDIUM - web, verified against first-party where possible)
- [nrwl/nx#19683 - E2E test setup with verdaccio](https://github.com/nrwl/nx/issues/19683) - port hardcoded on command line, `.verdaccio/config.yml` port ignored, `parallelism:false` guidance.
- [npm-pack docs (v11)](https://docs.npmjs.com/cli/v11/commands/npm-pack/) - `--pack-destination` + `--json`.
- [push-based/nx-verdaccio](https://github.com/push-based/nx-verdaccio) - per-environment isolation for parallel e2e (option 4).
- [Faithful E2E Testing of Nx Preset Generators](https://dev.to/chiubaka/faithful-e2e-testing-of-nx-preset-generators-m5a) - dynamic ephemeral-port verdaccio pattern.

## Metadata
- Confidence: stack/mechanism HIGH (source-verified); wall-clock estimates MEDIUM (relative, machine-dependent; ~40 min baseline taken from the brief).
- Research date: 2026-07-12. Valid until: ~30 days (stable Nx 23 line).
