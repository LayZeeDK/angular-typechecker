# Quick 260712-n7z - e2e local-registry flakiness under `nx run-many -t e2e`

**Researched:** 2026-07-12
**Domain:** Nx 23.0.1 task-invocation loop detection x `@nx/js` `startLocalRegistry` x multi-project Verdaccio e2e
**Confidence:** HIGH (root cause read directly from installed Nx source; fix corroborated by Nx docs)

## Summary

Two e2e projects now start the SAME root `local-registry` target under one `nx run-many`
parent: `angular-typechecker-install-e2e` and `angular-typechecker-ng-cli-e2e` (the 4th,
added in Phase 24). `cache-e2e` and `matrix-e2e` start no registry. `startLocalRegistry`
`fork()`s `nx run <root>:local-registry` with the **inherited** `process.env`, so both forks
carry the parent run-many's `NX_INVOCATION_ROOT_PID`. Nx 23's `TaskInvocationTracker`
(SQLite `task_invocations` table, keyed by that root PID) rejects the SECOND registration of
the same `(rootPID, taskId)` with "Task ... was already invoked by a parent Nx process in
this chain" and `process.exit(1)`. It is intermittent ("flaky") because a `cleanupStale()`
races the second registration.

**Primary recommendation:** In the shared e2e `global-setup.ts`, `delete
process.env.NX_INVOCATION_ROOT_PID` immediately BEFORE `startLocalRegistry(...)`. Each
forked registry then keys the tracker on its OWN pid (Nx's documented `?? process.pid`
fallback), so the two serialized forks never collide. One line, in the two files that start a
registry. Zero config, zero source/package changes, additive-safe. This is the same env
hygiene the repo already applies to nested `nx` calls via `buildCleanEnv`
(`NX_INVOCATION_ROOT_PID` is already in `NX_RUNNER_ENV_KEYS`) - the registry fork is the one
nested `nx` invocation that never got the cleaned env, because `startLocalRegistry` takes no
`env` param.

## CRITICAL premise correction (read before choosing an option)

The task brief and `STATE.md` (Plan 24-06 note) both state **"CI runs each e2e as a fresh
per-job `npm ci` (not run-many)"**. That is **factually wrong.** `.github/workflows/ci.yml`
`e2e` job runs `npm ci` ONCE (line 178) then `npx nx run-many -t e2e --parallel=1`
(line 204) - the EXACT command that fails locally. `ci-e2e-coverage-guard.spec.ts`
(GUARD-01/01b) even asserts CI must use `run-many -t e2e --parallel=1`.

Consequence: this is **not** merely a local-gate convenience. Once the release PR carries the
`e2e/**` code (a non-`.planning` change, so `changes.code=true` and the `e2e` job is NOT
path-skipped), the CI `e2e` job runs `run-many` across all four projects and hits this guard
-> **red release CI.** The only reason CI is green today is that recent commits are
`.planning/`-only and the `e2e` job is path-skipped. So "keep per-project runs, they are how
CI works" (option 4 in the brief) is a non-starter: CI already uses run-many, and the fix is
required to unblock the release PR.

*(Optional confirmation: `gh run list --branch gsd/v0.2.1-angular-cli-workspace-support` -
expect the `e2e` job skipped on the recent planning-only commits.)*

## Root cause (verified in installed source)

1. `nx run-many -t e2e` sets `NX_INVOCATION_ROOT_PID = <run-many PID>` for every forked task
   env. `node_modules/nx/dist/src/tasks-runner/task-env.js:93-102`:
   `NX_INVOCATION_ROOT_PID: process.env.NX_INVOCATION_ROOT_PID ?? String(process.pid)`.
2. Each `<project>:e2e` vitest process inherits that root PID. Its `global-setup.ts` calls
   `startLocalRegistry`, which `fork(require.resolve('nx/bin/nx'), ['run', <target>, ...])`
   with **no env override** -> the forked `nx run <root>:local-registry` inherits the same
   `NX_INVOCATION_ROOT_PID`. `node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js:20-23`.
3. Each forked nx builds `new TaskInvocationTracker(db, Number(process.env.NX_INVOCATION_ROOT_PID ?? process.pid))`
   and `registerTask(process.pid, task.id)`. `node_modules/nx/dist/src/tasks-runner/task-orchestrator.js:64-65, 286`.
4. The DB uniqueness is `(rootPID, taskId='<root>:local-registry')`. First registry-starting
   project registers OK; the second registers the SAME pair -> unique-constraint violation ->
   the "already invoked by a parent Nx process in this chain" error + `process.exit(1)`.
   `task-orchestrator.js:280-308`.
5. **Why flaky:** under `--parallel=1` the first project's `stop()` `kill()`s its registry
   fork; the long-running verdaccio task never reaches the normal `unregisterTask` path
   (`task-orchestrator.js:1062`, only on graceful completion), so the row lingers. The second
   fork's `cleanupStale()` on init (`task-orchestrator.js:99`) sometimes reaps the dead pid in
   time, sometimes not - hence the intermittent verdict. Deleting the shared root key makes the
   two registrations independent and removes the race deterministically.

Nx's own docs confirm the general trigger (nested `nx` invocation under one root chain) and
steer toward avoiding nested `nx` child processes; the canonical recipe only ever starts the
registry ONCE (single e2e project), so it never hits the two-forks case this repo created.

## Ranked options

| # | Option | What changes | Verify command | CI risk | Additive-safe? |
|---|--------|--------------|----------------|---------|----------------|
| A (PRIMARY) | Sever the root-PID link before the registry fork | `delete process.env.NX_INVOCATION_ROOT_PID;` before `startLocalRegistry` in the 2 registry `global-setup.ts` files | `NX_DAEMON=false npx nx run-many -t e2e --parallel=1` green on all 4; `npx nx e2e angular-typechecker-ng-cli-e2e` still green; `npx nx run-many -t test` (guards) green | LOW - fixes the exact CI command; no-op standalone; touches no guard/ci.yml | YES - test-harness env only; no source/package.json |
| B (FALLBACK) | Per-project `local-registry` target (unique taskId) | Add a `local-registry` target (own storage dir) to each registry-starting e2e `project.json`; point that project's `localRegistryTarget` at it | same as A | LOW - no internal-env reliance | YES - config only |
| C | Start registry ONCE via a wrapper; projects detect+reuse | New wrapper script starts verdaccio + publishes once, sets a shared `VERDACCIO_URL`/`npm_config_registry`; each `global-setup` skips the fork when set; change ci.yml command | wrapper script + `run-many` | MEDIUM - rewrites publish/token coordination + ci.yml | mostly |
| D | `targetDefaults.e2e.dependsOn: [<root>:local-registry]` | config | n/a | HIGH - `dependsOn` waits for task COMPLETION; verdaccio is a long-running server that never completes -> hangs | n/a - non-viable |
| E | Drop run-many; run e2e per-project in CI | rewrite ci.yml `e2e` job + delete GUARD-01/01b | per-project | HIGH - contradicts the coverage-guard contract; loses the single authoritative gate; larger diff | no |

Option C is the textbook "multiple projects share one registry" pattern, but it is overkill
here: each e2e project already builds+publishes its own dist once (finding E1), the SAFETY
gate + real-token mint are per-project, and under `--parallel=1` the projects are serial, so
there is no actual need to share a single live registry - only to stop the two independent
forks from colliding on one shared task id. A and B do exactly that with a fraction of the
surface. Option 3 in the brief (start once, siblings detect+reuse) is C; it is viable but
each sibling runs in a SEPARATE vitest process under run-many, so reuse only works if a
PARENT (the wrapper) starts the registry first - env does not propagate sideways between
run-many siblings. That parent requirement is what makes C heavier than A/B.

## Recommendation

**Adopt Option A.** Minimal, deterministic, and consistent with the repo's existing
`NX_INVOCATION_ROOT_PID` stripping in `buildCleanEnv`. Concretely, in BOTH
`e2e/angular-typechecker-install-e2e/src/global-setup.ts` and
`e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts`, immediately before the
`const stop = await startLocalRegistry({...})` call:

```ts
// Nx 23's TaskInvocationTracker keys a per-root-PID uniqueness constraint on task
// invocations (task-orchestrator.js). Under `nx run-many -t e2e`, both registry-starting
// e2e projects inherit the SAME NX_INVOCATION_ROOT_PID, and startLocalRegistry forks
// `nx run <root>:local-registry` with the inherited env, so the second fork collides
// ("already invoked by a parent Nx process in this chain"). Clearing the inherited root
// PID makes each forked registry its own root (Nx's own `?? process.pid` fallback), so the
// two serialized forks never collide. Matches buildCleanEnv's NX_RUNNER_ENV_KEYS hygiene;
// startLocalRegistry takes no env param, so we clear process.env before it forks.
delete process.env.NX_INVOCATION_ROOT_PID;
```

Notes:
- The two files are verbatim copies today; add the identical line + comment to both to keep
  them so. (A `test-util` helper is DRYer but is more machinery than one line x2; skip it -
  add when a third registry-starting project appears.)
- Minimal targeted key is `NX_INVOCATION_ROOT_PID`. Defensive superset: also strip the rest
  of `NX_RUNNER_ENV_KEYS` from `process.env` before the fork - not required for this bug.
- Leaves 127.0.0.1 loopback + the SAFETY publish gate + real-token mint untouched.
- No `package.json` version change; no production surface change; guards stay green.

**Fallback: Option B** if reliance on an internal Nx env var is judged too fragile. Give the
`ng-cli-e2e` project its own `local-registry` target (distinct `storage` dir; port 4873 is
fine since `--parallel=1` runs them serially and the first `stop()`s before the second
starts), and set that project's `localRegistryTarget` to it. Different task id => no
uniqueness collision, no internal-env dependency. Cost: duplicated verdaccio target config.

## Constraints honored

- Windows arm64 / ASCII only / `git grep` tracked, `rg -uu` for `node_modules` (used
  throughout this research).
- No `package.json` version mutation (release branch).
- 127.0.0.1 loopback + SAFETY non-local-registry publish refusal preserved by both A and B.
- `ci-e2e-coverage-guard.spec.ts` (GUARD-01/01b/01c/01d) untouched and stays green: A/B change
  neither `e2e`/`typecheck` targets, `type:e2e` tags, nor the `run-many -t e2e --parallel=1`
  ci.yml line.

## Sources

### Primary (HIGH)
- `node_modules/nx/dist/src/tasks-runner/task-orchestrator.js:64-65, 99, 280-308, 1062` -
  `TaskInvocationTracker` construction (keyed on `NX_INVOCATION_ROOT_PID ?? process.pid`),
  `detectTaskInvocationLoop`, the error text, `cleanupStale`/`unregisterTask`.
- `node_modules/nx/dist/src/tasks-runner/task-env.js:93-102` - run-many exports
  `NX_INVOCATION_ROOT_PID` to every forked task.
- `node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js:14-77` - forks
  `nx run <target>:local-registry` with inherited env, sets `npm_config_registry`.
- Repo: `ci.yml:178,204` (run-many, not per-project), `ci-e2e-coverage-guard.spec.ts`
  (GUARD-01/01b enforce run-many), `libs/test-util/src/lib/e2e-process.ts:11-20`
  (`NX_INVOCATION_ROOT_PID` already in `NX_RUNNER_ENV_KEYS`).

### Secondary (MEDIUM)
- [Update Your Local Registry Setup to use Nx Release | Nx](https://nx.dev/docs/guides/nx-release/update-local-registry-setup) -
  confirms the "already invoked by a parent Nx process" trigger is nested `nx` invocation
  under one root chain; steers toward in-process `nx/release` calls (addresses publish
  nesting; registry-start nesting is this repo's two-forks case).
- [nrwl/nx update-local-registry-setup.md](https://github.com/nrwl/nx/blob/master/docs/shared/recipes/nx-release/update-local-registry-setup.md)
