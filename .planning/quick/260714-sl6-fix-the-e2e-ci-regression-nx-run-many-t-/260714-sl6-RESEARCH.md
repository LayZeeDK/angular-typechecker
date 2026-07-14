---
quick_id: 260714-sl6
title: Fix the e2e-CI regression (nx run-many -t e2e does not build dist on a fresh runner)
date: 2026-07-14
domain: nx targetDefaults resolution / CI task graph
confidence: HIGH
---

# Quick Task 260714-sl6: Fix the e2e-CI regression -- RESEARCH

**Primary recommendation:** Delete the inert `e2e` targetDefault from `nx.json` and put an
explicit per-project `dependsOn: [{ "projects": ["angular-typechecker"], "target": "build" }]`
on each e2e project's `e2e` target. This fixes BOTH CI and local `nx run-many -t e2e`, preserves
squ's build-once-upstream intent (one shared build task), and is one-hunk-per-file revertable.
Guard it with a pure-FS `GUARD-01e` that reads each e2e `project.json` and asserts the dep is
present. Verify with the cheap `rm -rf dist ... --skip-nx-cache` repro (fast, decisive), then
confirm in a fresh container with `act pull_request -j e2e`.

---

## (a) Root cause -- the targetDefault is inert, and NO name-keyed repair can fix it

The `e2e` targetDefault in `nx.json` is **not merged onto the e2e targets at all** -- not because
`dependsOn: ["angular-typechecker:build"]` is an unparseable string, but because nx never *reads*
the `e2e` name-keyed default for these targets.

**The decisive nx 23.1 rule** (`nx/dist/src/project-graph/utils/project-configuration/target-defaults.js`,
`readTargetDefaultsForTarget`) [VERIFIED: installed nx source]:

```js
function readTargetDefaultsForTarget(targetName, targetDefaults, executor) {
    if (executor && targetDefaults?.[executor]) {
        // If an executor is defined in project.json, defaults should be read
        // from the most specific key that matches that executor.
        return targetDefaults?.[executor];   // <-- returns EARLY; name key never read
    }
    else if (targetDefaults?.[targetName]) {
        return targetDefaults?.[targetName];
    }
    ...
}
```

All four e2e targets use `executor: "@nx/vitest:test"`, and `nx.json` HAS a `@nx/vitest:test`
targetDefault. So nx returns the **executor-keyed** default and **short-circuits before ever
looking at the `e2e` name-keyed default**. The two are mutually exclusive, not merged.

**Empirical proof** (`nx show project angular-typechecker-install-e2e --json`, merged config) [VERIFIED: local run]:

```json
"e2e": {
  "cache": true,                    // <- from @nx/vitest:test executor default
  "inputs": ["default", "^production"],  // <- from @nx/vitest:test executor default
  "executor": "@nx/vitest:test",
  "outputs": ["{options.reportsDirectory}"],
  "parallelism": false
  // NO dependsOn -- the e2e name-keyed default was never applied
}
```

The merged target picked up `cache`/`inputs` from the **executor** default but has **no
`dependsOn`** -- the `e2e` name-keyed default (whatever it contains) was discarded.

**Task-graph proof** (`nx run-many -t e2e --graph`, current config) [VERIFIED: local run] -- `--graph`
output IS the executed task graph:

```
TASK IDS: [ install-e2e:e2e, matrix-e2e:e2e, ng-cli-e2e:e2e, cache-e2e:e2e ]
DEPS:     { install-e2e:e2e: [], matrix-e2e:e2e: [], ... }   // empty edges, no build
```

**Consequences for the candidate fixes:**

- Changing the `e2e` name-keyed default to `["^build"]` or the object form **cannot work** --
  the whole `e2e` block is ignored for `@nx/vitest:test`-backed targets. (This confirms the
  orchestrator's local `^build` observation: `--graph` was faithful; the build genuinely was not
  scheduled.) So the string form is not "an unparseable `project:target`" -- the string
  `"angular-typechecker:build"` DOES parse to `{projects:['angular-typechecker'],target:'build'}`
  via `readProjectAndTargetFromTargetString`; it just never gets read.
- A `dependsOn` reaches these targets only via (i) the `@nx/vitest:test` executor key -- but that
  would also touch the plugin's `test`/`integration` and is semantically muddy -- or (ii) the
  target's OWN `project.json` config, which always applies (a target's own config is the most
  specific and bypasses the precedence trap entirely). **Route (ii) is the fix.**

**Correction to the brief:** `cache-e2e` *does* declare `implicitDependencies` -- all four e2e
projects declare `implicitDependencies: ["angular-typechecker"]` (cache-e2e also lists
`typecheck-consumer`, `typecheck-consumer-dep`). The implicit deps were never the missing piece;
the targetDefault simply never applied. Also note GUARD-01b invariant 5's comment ("dist is built
ONCE upstream via the e2e target's dependsOn") documented a dependsOn that never ran -- that false
premise is exactly how squ's de-dup removed the in-setup build while trusting an inert dep.

---

## (b) The fix, ranked

### RECOMMENDED -- per-project object-form dependsOn (fixes CI + local)

Two edits, both test-harness/CI config only:

**1. `nx.json` -- remove the inert `e2e` targetDefault** (currently ~lines 48-50):

```json
    "e2e": {
      "dependsOn": ["angular-typechecker:build"]
    },
```

Delete this block. It never applied and is actively misleading (it gave squ false confidence).

**2. Each e2e `project.json` -- add `dependsOn` to the `e2e` target:**

```json
    "e2e": {
      "executor": "@nx/vitest:test",
      "dependsOn": [{ "projects": ["angular-typechecker"], "target": "build" }],
      "outputs": ["{options.reportsDirectory}"],
      ...
    }
```

Apply to `install-e2e`, `matrix-e2e`, `ng-cli-e2e` (the three that read the built dist), and
`cache-e2e` too for a uniform model + simplest guard. Adding it to `cache-e2e` costs **zero**
runtime: `angular-typechecker:build` is a single shared task in the run-many graph, so a 4th
dependent adds only a graph edge, not a second build. (cache-e2e uses the source barrel and does
not strictly need dist -- doing only the 3 dist-readers is acceptable, but uniform-4 is cleaner
and future-proofs a cache-e2e that later reads dist.)

**Why the object form over `^build`** [VERIFIED: local `nx run-many -t e2e --graph` on both]:

| Form (per-project) | install-e2e:e2e deps | Note |
|---|---|---|
| `["^build"]` | `angular-typechecker:build`, `test-util:build` | Follows ALL project deps; on cache-e2e also builds `typecheck-consumer*` |
| `[{projects:['angular-typechecker'],target:'build'}]` | `angular-typechecker:build` only | Surgical; exactly the original `"angular-typechecker:build"` intent |

Both schedule the build; the object form is surgical and matches the original intent exactly.
(`test-util:build` still appears as `angular-typechecker:build`'s OWN build dependency via the
`@nx/js:tsc` `^build` default -- that is pre-existing and identical to a plain `nx build`.)

**This preserves squ's intent:** under `nx run-many -t e2e --parallel=2`, nx dedups to **one**
`angular-typechecker:build` task that runs first, then the four e2e tasks run at parallel=2 with a
read-only dist. Verified: the graph shows exactly one `angular-typechecker:build` node. No per-spec
or in-globalSetup build (GUARD-01b invariant 5 stays satisfied -- now by a dependsOn that actually
runs).

### FALLBACK -- explicit CI build step (CI-only; does NOT fix local)

Add before the typecheck/e2e steps in the ci.yml `e2e` job:

```yaml
      - run: npx nx build angular-typechecker
```

Robust and dead-simple, but: (i) does **not** fix local `nx run-many -t e2e` on a fresh checkout
(dist still ENOENTs -- local devs must `nx build` first); (ii) leaves the e2e task graph still
missing the build edge, so it relies on dist persisting from a prior step. Use only if the
graph-form fix is ever undesired. **Do not stack both** -- the graph fix makes this redundant; the
guard is the safety net instead.

### NOT VIABLE -- repairing the nx.json `e2e` name-keyed dependsOn

`["^build"]` or the object form under the `e2e` **name** key both stay inert (executor-key
precedence, section a). Rejected.

---

## (c) Regression guard -- GUARD-01e (cheapest meaningful)

The failure mode was "config present but semantically inert," so a file-read of `nx.json` would
have **passed** on the broken config -- useless. The fix moves the dep to each project's OWN
`e2e` target config (the most-specific location, which always applies and has no precedence trap),
so a **pure-FS read of each e2e `project.json`** is authoritative and cheap. Add to the existing
`packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (rides the fast `test` matrix,
`cache:false`, no build), mirroring GUARD-01b style:

```
GUARD-01e: every e2e/* project's `e2e` target declares a dependsOn that builds the plugin.
  For each enumerated e2e project, read targets.e2e.dependsOn and assert it contains an entry
  that resolves to angular-typechecker's build -- i.e. an object
  { projects: [...'angular-typechecker'...], target: 'build' } (or the string
  'angular-typechecker:build' / '^build'). Fail-loud + located, e.g.:
  "e2e/<p> `e2e` target has no dependsOn that builds angular-typechecker -- on a fresh runner
   dist is never built and every spec ENOENTs on dist/.../package.json."
```

Optional second assertion (prevents a misleading re-add): assert `nx.json` `targetDefaults` has
**no** `e2e` key (the inert name-keyed default must stay deleted).

Also update GUARD-01b invariant 5's comment so "built once upstream via the e2e target's
dependsOn" now correctly refers to the **per-project** dependsOn, not the deleted nx.json default.

**Stronger (heavier) alternative:** a graph-assertion guard that spawns
`nx run-many -t e2e --graph=<tmp>` and asserts `angular-typechecker:build` is scheduled and each
dist-reading e2e task depends on it. This catches ANY inert-config regression (including the exact
executor-precedence trap) but spawns nx per fast-tier cell. GUARD-01e (pure-FS) is the recommended
cheapest-meaningful; escalate to graph-assertion only if the config-presence guard feels too weak.

---

## (d) Verification -- cheap cross-check (primary) + act (fresh-container confirm)

### Cheap non-act repro (primary, fast, decisive) [reasoning VERIFIED]

dist EXISTS locally right now (`dist/packages/angular-typechecker/package.json` present) -- this is
exactly why the bug is masked locally. Force the fresh-runner condition:

```bash
rm -rf dist/packages/angular-typechecker
NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
```

- On the **UNFIXED** tree this reproduces the ENOENT: `--skip-nx-cache` forces the e2e tasks to
  actually run, but the build is not in their graph, so dist stays absent -> the globalSetups
  ENOENT on `dist/.../package.json`. (Valid because skip-nx-cache only re-runs tasks that are IN
  the graph; it cannot schedule a build that the inert dep never added.)
- On the **FIXED** tree the same command schedules `angular-typechecker:build` first, then the
  four e2e tasks -> 4/4 green.

An even faster graph-only check (no e2e run): `nx run-many -t e2e --graph=<tmp>` and confirm
`angular-typechecker:build` is a task that the e2e tasks depend on (already confirmed for the fix
during this research).

### act fresh-container confirmation (secondary)

`.actrc` maps `ubuntu-latest -> catthehacker/ubuntu:act-24.04`; on the arm64 host Docker pulls the
native arm64 variant (no QEMU). Run ONLY the e2e job (act auto-runs its `needs: changes`):

```bash
act pull_request -j e2e -e tools/act/events/pull_request.json
```

**Faithfulness verdict: FAITHFUL for this bug.** A fresh act container reproduces the exact CI
condition -- no pre-existing dist, cold nx cache, `npm ci` from clean, and the real
`npx nx run-many -t e2e --parallel=2` with **no `--skip-nx-cache`** (identical to ci.yml). So act
on the UNFIXED workflow ENOENTs like CI, and on the FIXED workflow passes 4/4. Recommended to run
the UNFIXED workflow once first to prove act reproduces, then the FIXED workflow to prove green.

**Caveats for THIS job under act (none block faithfulness; one needs a log check):**
- **`changes` gate (the one real risk):** the e2e job is `if: needs.changes.outputs.code != 'false'`.
  Under act *execution* the `changes` job runs `dorny/paths-filter`, which needs a base/head diff;
  the event payload only carries branch refs. If paths-filter cannot diff it outputs empty ->
  `'' != 'false'` is true -> e2e still runs. **Verify in the act log that the e2e job actually ran
  `npm ci` / `nx run-many -t e2e` (was not skipped).** If it is skipped, fall back to the cheap
  cross-check + a throwaway PR.
- **Verdaccio / startLocalRegistry:** the install-e2e globalSetup forks `nx run <root>:local-registry`
  binding `127.0.0.1:4873` inside the container -- loopback works in a container. Fine.
- **corepack enable + pnpm/action-setup + npm ci + Angular installs:** all need container internet
  egress to registry.npmjs.org (and the Verdaccio uplink proxies to npmjs). Docker Desktop NAT
  provides this. Expect a slow run (heavy install tier), slower than a GitHub runner.
- **actions/cache** is a no-op under act -- irrelevant (the e2e job has no cache step).
- **setup-node** downloads Node 24 under act (works; adds time).

### Recommended sequence

1. Cheap repro on UNFIXED (confirm ENOENT) -> fast.
2. Apply the fix.
3. Cheap cross-check on FIXED (4/4 green) + `nx test angular-typechecker` (GUARD-01e green).
4. `act pull_request -j e2e -e tools/act/events/pull_request.json` on FIXED -> 4/4 in a fresh
   container (verify not skipped).
5. Throwaway PR only if act proves unfaithful (changes gate skips e2e, or container networking
   blocks the install).

---

## (e) Scope / plan shape (1 task)

**One task** (test-harness/CI + nx config only):

- Edit `nx.json` (remove inert `e2e` targetDefault).
- Edit the 4 e2e `project.json` files (add per-project object-form `dependsOn`).
- Add `GUARD-01e` to `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` and fix the
  GUARD-01b invariant-5 comment.
- Verify: cheap `rm -rf dist && ... --parallel=2 --skip-nx-cache` 4/4 + `nx test` (guards) +
  `nx lint` (maxWarnings:0); then `act pull_request -j e2e` fresh-container confirm.

**Scope confirmation:**
- ci.yml is **not** changed by the recommended fix (the graph fix lives in nx.json + project.json;
  no explicit CI build step). If the fallback CI step is ever chosen, that is the only ci.yml edit.
- No product source change: the guard spec is a `*.spec.ts` excluded from the published build
  (`tsconfig.lib.json` excludes specs) -- test-harness, not shipped (same as squ's
  `production_source_changed: false`).
- No `package.json` version mutation.
- One-hunk-per-file revert (delete one nx.json block; remove one dependsOn line per project.json;
  drop the new guard describe block).
- Release-safe: run on the release/feature branch; committer = public gmail; ASCII-only.

---

## Sources

### Primary (HIGH)
- `node_modules/nx/dist/src/project-graph/utils/project-configuration/target-defaults.js`
  (`readTargetDefaultsForTarget`) -- the executor-key-wins-over-name-key precedence rule [VERIFIED: installed nx 23.x source].
- `node_modules/nx/dist/src/tasks-runner/utils.js`
  (`expandDependencyConfigSyntaxSugar`, `readProjectAndTargetFromTargetString`) -- confirms the
  string `project:target` form DOES parse; the problem is upstream (default never read) [VERIFIED].
- `nx run-many -t e2e --graph` (string / `^build` / object-form variants) + `nx show project ... --json`
  -- empirical task-graph and merged-config evidence [VERIFIED: local runs, temp edits reverted via `git checkout`].

### Repo evidence (HIGH)
- `nx.json` (inert `e2e` targetDefault; `@nx/vitest:test` executor default), the four
  `e2e/*/project.json` (all `@nx/vitest:test`, all `implicitDependencies: ["angular-typechecker"]`),
  `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (the ENOENT site),
  `.github/workflows/ci.yml` (e2e job, no `--skip-nx-cache`), `.actrc`, `tools/act/act-compat.sh`,
  `tools/act/events/pull_request.json`, `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`
  (guard style), and the squ + nub SUMMARYs.

**Confidence:** HIGH -- root cause proven from nx source AND reproduced in the task graph; the fix
verified to schedule the build in the graph; verification tooling (act v0.2.89, event payloads, dist
state) confirmed present.
