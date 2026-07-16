# Phase 28: Shipped-tarball e2e + real-clone UAT - Research

**Researched:** 2026-07-16
**Domain:** Verification-only phase -- Verdaccio publish-once + install-and-RUN of the shipped `bin` shim across the PM matrix on Linux AND Windows (VER-04), plus a manual real-clone UAT (VER-05). No engine/verdict/adapter logic changes.
**Confidence:** HIGH (all claims verified against the live codebase + `ci.yml` + official GitHub Actions docs; the one open item -- the Windows OS-axis mechanism -- has a recommended shape with a cited rationale)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add a NEW `e2e/angular-typechecker-cli-e2e/` project modeled on `e2e/angular-typechecker-install-e2e/` -- Verdaccio `globalSetup` (`startLocalRegistry` on `127.0.0.1`, real couchdb bearer token, build-and-publish ONCE via `nx release publish --first-release --excludeTaskDependencies`, the non-`127.0.0.1` SAFETY refuse-gate), node env, `pool: forks` + `singleFork` + `fileParallelism:false` + `sequence.concurrent:false`, long timeout (~300000ms). It defines an `e2e` target so `tools/ci/list-e2e-projects.mjs` auto-discovers it into the dynamic CI matrix with NO static list edit.
- **D-02:** Reuse the EXISTING Verdaccio pattern verbatim -- ONE registry on `127.0.0.1`, `buildCleanEnv({ stripAllNpmConfig: true })`. NO second registry port. Shared `@workspace/test-util` helpers (`findWorkspaceRoot`, `buildCleanEnv`, `run`/`sh`, `removeTmpDir`) -- no new helper lib.
- **D-03:** Assert the NET-NEW surface. Install the packed/published tarball with each of npm + yarn (flat) + yarn (workspace) + pnpm, then run the installed bins through the PM-generated `.bin` shim (NOT a direct `node dist/...bin.js` call -- the shim IS the surface under test) and assert `process.exitCode`: `0` clean, `1` planted-error (type/template/NG8xxx or warnings-exceeded), `2` infra (malformed/nonexistent tsconfig) AND usage (unknown flag / missing required `--tsConfig`). Cover BOTH bin names (`angular-typechecker`, `atc`) and `npx angular-typechecker`. Planner may prune provably-redundant (PM x invocation x code) cells but MUST keep >=1 shim-resolution assertion per PM, each exit code per bin name, and the Windows `.cmd`/`.ps1` shim leg.
- **D-04:** DIRECTION (locked): the CI `e2e` job runs `angular-typechecker-cli-e2e` on BOTH Linux AND Windows (Node 24). Other e2e projects stay Linux-only -- do NOT cartesian-expand every e2e project onto Windows.
- **D-05:** MECHANISM (OPEN -- researcher/planner decides): candidate shapes (a) `runs-on: ${{ matrix.os }}` + `matrix.include` adding an `os: windows-latest` cell ONLY for `angular-typechecker-cli-e2e`; (b) a SEPARATE dedicated Windows job outside the dynamic project matrix. Whichever is chosen MUST (1) keep the `discover` -> `fromJSON(needs.discover.outputs.projects)` dynamic-matrix contract intact for the Linux legs, (2) stay consistent with `ci-e2e-coverage-guard.spec.ts` GUARD-01/01b (extend the guard if the wiring shape changes), and (3) respect the Node-24/corepack coupling note already in `ci.yml`.
- **D-06:** Windows-Verdaccio robustness (direction locked, mechanism = research): the Windows leg MUST handle the known `127.0.0.1` bind / ECONNREFUSED-retry issues (the `127.0.0.1` numeric-loopback choice already addresses the dual-stack half; a bounded start-up retry loop is the likely addition).
- **D-07:** Add the RUNTIME half Phase 27 D-10 deferred: assert the installed bin's output NEVER matches `/ERR_REQUIRE_ESM/` AND a module-graph probe confirms the INSTALLED bin's `require` cache never reaches `@nx/*`/`nx/` at runtime (complements Phase 27's STATIC dist-graph walk).
- **D-08:** MANUAL UAT (VER-05), captured in a `28-<id>-UAT.md` artifact modeled on `24-ACV-01-UAT.md` / `24-HUMAN-UAT.md`. For each clone: planted-error RED / clean GREEN (exit 0) / bad tsconfig path -> exit 2. Clones stay UNCOMMITTED, pinned by URL + SHA. The `--auto --chain` pipeline PRODUCES the UAT checklist/script; a HUMAN runs the manual UAT (it is not auto-executed) -- surface this to the user at phase close.
- **D-09:** UAT substrate (both kinds, on-stack Angular 22): Angular CLI kind = `bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc` (primary) + `realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b` (second) -- carry-forward SHAs. Nx-workspace kind = `radix-ng/primitives` (primary), `analogjs/analog` (alt) -- SHAs NOT recorded; pin FRESH at run time and record in the UAT artifact. MSYS/Windows manual runs use `/d/...` not `D:/...` paths.

### Claude's Discretion

- Fixture design inside the new project (which planted-error fixtures; reuse `fixtures/` project shapes vs minimal inline ones), provided each asserts a diagnostic CODE (never message text).
- The exact pruning of the (PM x bin-name x invocation x exit-code) cell set within D-03's mandatory-coverage floor.
- The module-graph runtime-probe implementation (require-cache inspection vs a child-process `--eval` walk), provided it proves no `@nx/*`/`nx/` at runtime (D-07).
- The exact `execSync`/`spawnSync` capture mechanics for reading the shim's literal exit code, provided the flush-safe bin contract (Phase 27 D-02) is honored and the tail `TSxxxx` code is never truncated.

### Deferred Ideas (OUT OF SCOPE)

- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- Phase 29 (DOC-01).
- JSON/SARIF reporters (REP-01/02), `--watch` (CLIX-01), `--quiet`/`--color`/`--no-color`/`--project` alias (CLIX-02) -- Future Requirements.
- GitHub-backed self-hosted Nx remote cache -- ROADMAP Backlog.
- Cartesian OS-expansion of ALL e2e projects onto Windows -- deliberately NOT done; only `angular-typechecker-cli-e2e` gets the Windows leg.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-04 | A DEDICATED `angular-typechecker-cli-e2e` project proves the SHIPPED bins (installed from the Verdaccio-published tarball) return literal exit codes `0`/`1`/`2` through the real PM `.bin` shim -- `angular-typechecker` + `atc` + `npx angular-typechecker` -- across npm + yarn (flat + workspace) + pnpm, on Linux AND Windows (Node 24). Net-new = literal exit `2` + the shim path. | New e2e project (D-01/D-02, `## Architecture Patterns`); PM install mechanics + shim invocation + literal-exit-code capture (`## Code Examples`); Windows OS-axis recommendation (`## The Windows OS-Axis Decision`); Windows-Verdaccio retry (`## Common Pitfalls` P1/P2); runtime nx-free/ESM probe (`## Code Examples`, D-07). |
| VER-05 | The shipped bins run at real project tsconfigs in on-stack Angular 22 clones of BOTH kinds -- a real Nx workspace (`radix-ng/primitives` primary, `analogjs/analog` alt) AND a real Angular CLI workspace (`bluehalo/ngx-leaflet`, `realworld-angular`) -- asserting planted RED / clean GREEN / bad-path -> `2`. Uncommitted clones pinned by URL + SHA. | UAT artifact model + exact clone/checkout/tsconfig targets + RED/GREEN/bad-path shape (`## Real-Clone UAT (VER-05)`); modeled on `24-ACV-01-UAT.md`. |
</phase_requirements>

## Summary

This is the FINAL verification phase of milestone v0.2.2. It adds NO engine, verdict, exit-code, or adapter logic -- Phases 25-27 shipped and froze all correctness (the pure `run()` core, the two-step exit-code compose owning literal `2`, the flush-safe `bin.ts` shell, the two-name `bin` field, the LF shebang, the static nx-free guards). Phase 28 only INSTALLS the shipped artifact and RUNS it, asserting behavior through the real package-manager surface.

Two net-new surfaces. **VER-04** is a new, CI-authoritative `e2e/angular-typechecker-cli-e2e/` project that copies the verified-live Verdaccio publish-once harness (`createVerdaccioGlobalSetup`), installs the published package by-name into throwaway consumer workspaces under npm + yarn (flat + workspace) + pnpm, and invokes the PM-generated `.bin` shim (`angular-typechecker`, `atc`, `npx angular-typechecker`) -- asserting the literal OS exit codes `0`/`1`/`2`. The headline net-new assertion is literal exit **2** (infra + usage), which the pre-existing Nx/ng `{success}` (0/1) harness never proves, plus the Windows `.cmd`/`.ps1` shim path. **VER-05** is a human-run real-clone UAT modeled on `24-ACV-01-UAT.md`, running the shipped bin at real tsconfigs in on-stack Angular 22 OSS clones of both workspace kinds.

The single most consequential planning decision is the Windows CI OS-axis mechanism (D-04/D-05), deliberately left open. After tracing the live `e2e` job (1-D `project:` dynamic matrix, `runs-on: ubuntu-latest` fixed, fed by `discover` -> `list-e2e-projects.mjs`, guarded by `ci-e2e-coverage-guard.spec.ts`) and confirming GitHub Actions `matrix.include` merge semantics against the official docs, the recommendation is a **SEPARATE dedicated Windows job (option b)** -- it leaves the verified-live Linux dynamic-matrix wiring and GUARD-01b's existing assertions completely untouched, isolates the Windows-specific tuning (corepack, pnpm, the Verdaccio ECONNREFUSED retry), and directly expresses the "only this one project on Windows" intent. Option (a) works but requires an explicit `os: [ubuntu-latest]` base dimension and modifies the existing guarded matrix (see the dedicated section for the merge-semantics trap).

**Primary recommendation:** Copy `e2e/angular-typechecker-install-e2e/` into `e2e/angular-typechecker-cli-e2e/`, reuse `createVerdaccioGlobalSetup` verbatim, install the published package by-name (NOT pack-a-tgz -- sidesteps the Windows `tar` drive-letter gotcha) into per-PM consumer fixtures, and invoke the explicit `.bin` shim with `spawnSync` (`shell: true` on Windows) to read the literal `status`. Add a dedicated `e2e-windows` CI job for the Windows leg, add it to the `ci` aggregate `needs`, and extend GUARD-01b (or add GUARD-01f) to assert the OS-axis wiring. Produce a `28-<id>-UAT.md` for the human-run VER-05.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publish the shipped artifact to a local registry | CI / test infra (Verdaccio `globalSetup`) | -- | Reuses the exact `startLocalRegistry` + `nx release publish` publish-once flow already live in install-e2e / ng-cli-e2e. |
| Install the tarball via each package manager | Consumer-project temp workspace (spec `beforeAll`/`it`) | -- | The PM `.bin` shim only exists after a real install; each PM writes a different shim/layout. |
| Invoke the shipped bin + read the literal exit code | OS process boundary (`spawnSync` over the `.bin` shim) | -- | The shim (`.cmd`/`.ps1` on Windows, extensionless shebang script on POSIX) is the surface under test; the exit code is an OS-process property. |
| Verdict/exit-code logic (0/1/2) | Shipped `run()` + `bin.ts` (Phases 26/27, FROZEN) | -- | This phase asserts it; it does NOT re-derive or change it. |
| Windows divergence coverage | CI `e2e-windows` job (recommended) | Windows dev host (manual UAT) | The `.cmd`/`.ps1` shim is the one genuinely Windows-divergent CLI surface (D-04). |
| Real-world confidence | Human-run UAT over uncommitted OSS clones (VER-05) | CI-authoritative committed fixtures (VER-04) | Two-tier model used across every prior milestone (ACV-01 on top of ACV-02). |

## Standard Stack

No new runtime or dev dependencies. This phase composes only already-installed, verified-live tooling. Versions below are the workspace's current pins (confirmed present locally 2026-07-16).

### Core (all already installed -- reused, not added)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `vitest` (`@nx/vitest:test`) | 4.x | e2e runner for the new project | [VERIFIED: workspace] Every existing e2e project uses `@nx/vitest:test` with the serialized node-env config shape. |
| `verdaccio` (via `@nx/js/plugins/jest/local-registry`) | 6.x | Local publish-once registry | [VERIFIED: `node -e require.resolve` -> present] The exact publish-once model `createVerdaccioGlobalSetup` already drives. |
| `nx release publish` | nx 23.0.1 | Publish the built dist to Verdaccio once | [VERIFIED: `verdaccio-global-setup.ts`] `--first-release --excludeTaskDependencies`, provenance stripped, `127.0.0.1` SAFETY gate. |
| Node stdlib `node:child_process` (`spawnSync`/`execSync`) | Node 24 | Invoke the shim + capture literal exit code | [VERIFIED: `e2e-process.ts`, `ng-cli-e2e.ts`] Existing harness uses `execSync` try/catch -> `error.status`; `spawnSync` gives the literal `status` without a throw (cleaner for 0-vs-1-vs-2). |
| npm / yarn 4 (corepack) / pnpm | npm 11.16.0, yarn 4.17.0 (corepack), pnpm 11.9.0 (corepack/action-setup) | The PM matrix under test | [VERIFIED: local probe + `ng-add-ng-run-yarn`/`pnpm-symlink` specs] Same PM provisioning already proven for the Nx/ng harness. |

### Supporting (`@workspace/test-util` -- reuse the exports, add no helper lib)
| Export | Purpose | When to Use |
|--------|---------|-------------|
| `createVerdaccioGlobalSetup({ label })` | The publish-once globalSetup default | The new project's `src/global-setup.ts` delegates in one line (D-01/D-02). |
| `findWorkspaceRoot(dir)` | cwd-independent root resolution | Every spec/setup file. |
| `buildCleanEnv({ stripAllNpmConfig: true })` | Strip inherited `npm_config_*`/`NX_*`, set `FORCE_COLOR=0`, `NX_DAEMON=false` | Every nested install/run against Verdaccio. |
| `writeVerdaccioNpmrc(dir, url, token)` | Point a consumer at Verdaccio | Per-PM install provisioning (npm/pnpm read `.npmrc`; yarn reads `.yarnrc.yml`). |
| `sh(cmd, {cwd, env})` / `commandSucceeds(...)` | Install invocations + availability guards | PM install steps; `commandSucceeds('corepack yarn@4.17.0 --version')` to skip cleanly where corepack yarn is unavailable. |
| `removeTmpDir(dir)` | Best-effort Windows-safe temp teardown | `finally` blocks (handles Windows EPERM/lingering handles). |
| `plant(path, anchor, replacement)` | Anchor-checked source injection | Plant a diagnostic-code error into a fixture (asserts the anchor was found -> fails loud if the fixture drifts). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Install by-name from Verdaccio (like ACV-02) | Pack a `.tgz` + install the tarball path (like matrix-e2e) | By-name avoids the Windows/MSYS `tar` drive-letter gotcha entirely and matches D-02's publish-once reuse. Pack-a-tgz reintroduces the `/d/...` vs `D:/...` hazard on the Windows leg -- avoid it here. |
| `spawnSync` for exit-code capture | `execSync` try/catch -> `error.status` | `execSync` throws on ANY non-zero, so distinguishing `1` from `2` means reading `error.status` in a catch. `spawnSync` returns `{ status, stdout, stderr }` directly (no throw) -- cleaner for asserting an EXACT code. Both are acceptable; `spawnSync` recommended for the 0/1/2 precision VER-04 needs. |
| Dedicated Windows CI job (option b) | 2-D matrix `include` in the existing e2e job (option a) | Option (b) leaves the verified-live Linux matrix + GUARD-01b untouched; option (a) modifies the guarded matrix and depends on subtle `include` merge semantics (see dedicated section). |

**Installation:** none. `npm ci` already provisions everything; corepack/pnpm-action-setup provision the pinned yarn/pnpm in CI exactly as the existing e2e job does.

## Package Legitimacy Audit

**No external packages are installed by this phase.** The only "install" actions are: (1) the project's OWN artifact (`angular-typechecker`) via the Verdaccio round-trip, and (2) the consumer fixtures' Angular 22 peer deps (`@angular/compiler-cli`, `typescript`, etc.), which are the SAME pinned deps already committed in the existing e2e fixtures. slopcheck is therefore not applicable (no net-new registry dependency).

One supply-chain hazard is explicitly AVOIDED rather than installed: `atc@0.0.6` is a real, unrelated published npm package ("Manage fleet spawns", [VERIFIED: npm registry, per PITFALLS.md 2026-07-16]). `npx atc` in a directory WITHOUT a local install fetches and executes it. The e2e MUST invoke the installed `.bin/atc` shim (or `.bin/atc.cmd`) by path, NEVER `npx atc`. `npx angular-typechecker` is safe (package-name matches a bin name -> always resolves this package). This is a NON-install security invariant, tracked in `## Security Domain`.

## The Windows OS-Axis Decision (D-04 / D-05) -- RECOMMENDED: option (b)

### The verified-live wiring being extended

[VERIFIED: `.github/workflows/ci.yml:204-262` read 2026-07-16]

- The `e2e` job is a **1-D dynamic matrix**: `strategy.matrix.project: ${{ fromJSON(needs.discover.outputs.projects || '["angular-typechecker-cache-e2e"]') }}`, `runs-on: ubuntu-latest` FIXED, `fail-fast: false`.
- The `discover` job (`:153-174`) runs `node tools/ci/list-e2e-projects.mjs` (pure `fs` read of `e2e/*/project.json`, filters on `targets.e2e`, fails loud on empty) and emits `outputs.projects`.
- The matrix value reaches run steps via `PROJECT: ${{ matrix.project }}` env (never interpolated into a shell command -- the no-command-injection invariant), consumed as `nx run-many -t typecheck -p "$PROJECT"` then `nx run-many -t e2e -p "$PROJECT"`.
- Node-24 pin + `corepack enable` (corepack ships in Node 24, REMOVED in 25+); `pnpm/action-setup@...` pins pnpm 11.9.0.
- `ci-e2e-coverage-guard.spec.ts` GUARD-01b asserts (i) the matrix line contains `fromJSON(needs.discover.outputs.projects`, (ii) the `discover` job runs `tools/ci/list-e2e-projects.mjs`, (iii) each cell runs `run-many -t e2e`, (iv) the discovery CLI output equals the strict `e2e/*/project.json` enumeration.

### The GitHub Actions `include` merge trap (why option a is subtle)

[CITED: docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow, "Expanding or adding matrix configurations"]

An `include` object is MERGED into an existing matrix combination when it can be added "without overwriting any part of the original combinations"; otherwise it becomes a NEW combination. Concretely, with a base matrix of `project: [cache-e2e, install-e2e, cli-e2e, ...]` (no `os` key) and an include `{ os: windows-latest, project: angular-typechecker-cli-e2e }`:
- The include's `project: cli-e2e` matches the EXISTING `{project: cli-e2e}` combination (does not overwrite -- same value), and `os` is additive.
- So it MERGES into that one combination, producing `{project: cli-e2e, os: windows-latest}` -- it does NOT create a new cell. **The Linux `cli-e2e` leg silently disappears.**

To get BOTH Linux and Windows for `cli-e2e` under option (a), the base matrix must ALSO carry an `os` dimension (`os: [ubuntu-latest]`) so that the Windows include would OVERWRITE `os: ubuntu-latest` and is therefore forced to create a NEW combination. Only then do you get `{cli-e2e, ubuntu}` (via dynamic base) + `{cli-e2e, windows}` (via include). This means option (a) requires: `runs-on: ${{ matrix.os }}`, a new `os: [ubuntu-latest]` base dimension, the include, AND edits to GUARD-01b's matrix assertions -- i.e. it modifies the exact wiring the guard exists to protect.

### Option (a) vs option (b)

| Axis | (a) 2-D matrix in existing `e2e` job | (b) SEPARATE dedicated `e2e-windows` job |
|------|--------------------------------------|-------------------------------------------|
| Existing Linux dynamic matrix | MODIFIED (adds `os` base dim + `runs-on` expr + include) | UNCHANGED |
| GUARD-01b existing assertions | Must be re-checked/edited (matrix shape changed) | Stay green untouched |
| `discover` -> `fromJSON` contract | Preserved but now co-mingled with the `os` dim | Preserved, untouched (Windows job doesn't use `discover`) |
| Windows-only Verdaccio retry / setup tuning | Conditional-in-one-job (`if: runner.os == 'Windows'`) complexity | Isolated in its own job |
| "Only this project on Windows" intent | Expressed via a fragile merge rule | Expressed directly (job hardcodes the one project) |
| Diff size / risk | Larger, higher-risk to verified-live wiring | Additive, lowest-risk |
| Drift-guard cost | Extend GUARD-01b matrix assertions | Add one new guard `it` (windows job exists + runs the project + is in `ci` needs) |

### Recommendation: option (b) -- a dedicated `e2e-windows` job

Rationale: it is additive and leaves the verified-live Linux dynamic matrix + `discover` contract + GUARD-01b's four assertions completely intact (zero risk of silently dropping a Linux leg -- the exact failure mode the guard exists to catch). `cli-e2e` still runs on Linux via the dynamic matrix (auto-discovered, since it has an `e2e` target) AND on Windows via the dedicated job -- satisfying D-04's "BOTH Linux AND Windows." The only cost -- a hardcoded project name in the Windows job -- is minor (only ONE project wants Windows by design, D-04) and is guardable. Shape:

```yaml
  # Windows leg for the standalone-CLI tarball e2e ONLY (VER-04 SC-2, D-04). The
  # .cmd/.ps1 bin shim is the one genuinely Windows-divergent CLI surface, so this
  # single project -- not the whole e2e tier -- gets a Windows runner. The Linux
  # legs stay on the dynamic per-project matrix (`e2e` job) unchanged. Node 24 +
  # corepack (ships in Node 24; removed in 25+ -- see the coupling note on `e2e`).
  # PROJECT env, never interpolated into a shell command (no-command-injection).
  e2e-windows:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}
    runs-on: windows-latest
    env:
      NX_DAEMON: false
      PROJECT: angular-typechecker-cli-e2e
    steps:
      - uses: actions/checkout@<pinned-sha>
        with:
          persist-credentials: false
      - uses: actions/setup-node@<pinned-sha>
        with:
          node-version: 24
          cache: npm
      - run: corepack enable
      - uses: pnpm/action-setup@<pinned-sha>
        with:
          version: 11.9.0
      - run: npm ci
      - run: npx nx run-many -t typecheck -p "$PROJECT"
      - run: npx nx run-many -t e2e -p "$PROJECT"
```

Then add `e2e-windows` to the `ci` aggregate `needs` list (`:415-427`) so a Windows failure fails the required `ci` check (the `contains(needs.*.result, 'failure')` gate already covers it). Add a guard assertion (extend GUARD-01b or add GUARD-01f) that: (1) the `e2e-windows` job exists with `runs-on: windows-latest`, (2) it runs `nx run-many -t e2e -p "$PROJECT"` with `PROJECT: angular-typechecker-cli-e2e`, (3) `e2e-windows` is in the `ci` job's `needs`, and (4) `angular-typechecker-cli-e2e` is in the discovered set (so it also runs on Linux). This closes the silent-drift axis for the Windows leg the same way GUARD-01b closes it for the dynamic Linux matrix.

Note: `bash` is the default shell on `windows-latest` for GitHub-hosted runners only if `shell: bash` is set; the default is `pwsh`. The `-p "$PROJECT"` form works in both, but pin `shell: bash` on the run steps if you want byte-identical steps to the Linux `e2e` job (recommended for the guard's regex to match). [ASSUMED -- confirm the shell choice against how the run steps quote `$PROJECT`; `pwsh` expands `$PROJECT` too but `"$PROJECT"` quoting differs.]

## Architecture Patterns

### System flow (VER-04)

```
  nx run-many -t e2e -p angular-typechecker-cli-e2e
        |
        v  (dependsOn: angular-typechecker:build  -- GUARD-01e)
  [ build dist/packages/angular-typechecker ]
        |
        v  vitest globalSetup (createVerdaccioGlobalSetup, parallelism:false)
  [ startLocalRegistry @127.0.0.1 ] -> mint real token -> strip provenance
        |                              -> nx release publish --first-release
        |                                 --excludeTaskDependencies  (SAFETY: refuse non-127.0.0.1)
        v  provide(verdaccioUrl, verdaccioToken)
  +----------------------- per-PM spec (serialized) -----------------------+
  | for PM in { npm, yarn-flat, yarn-workspace, pnpm }:                    |
  |   mkdtemp consumer + copy Angular-22 fixture + writeVerdaccioNpmrc     |
  |   install angular-typechecker BY NAME from Verdaccio (PM-native)       |
  |   -> node_modules/.bin/{angular-typechecker,atc}[.cmd/.ps1] shim       |
  |                                                                        |
  |   spawnSync(shim, ['-c', <tsconfig>])  -> read literal status         |
  |     clean fixture        -> status 0                                   |
  |     planted TS/tmpl/NG8xxx or --max-warnings 0 -> status 1            |
  |     nonexistent/malformed tsconfig  -> status 2  (infra)             |
  |     unknown flag / missing -c       -> status 2  (usage)            |
  |   assert stdout !~ /ERR_REQUIRE_ESM/          (ESM bridge survived)   |
  |   runtime module-graph probe: no @nx/* / nx/  (D-07)                  |
  +------------------------------------------------------------------------+
        |
        v  Linux (dynamic matrix cell)  +  Windows (dedicated e2e-windows job)
```

### Recommended project structure

```
e2e/angular-typechecker-cli-e2e/
├── project.json          # name, tags [scope:fixture, type:e2e], e2e + typecheck targets,
│                         #   e2e.dependsOn build (GUARD-01e), e2e.parallelism:false (GUARD-01b)
├── vitest.config.mts     # node env, pool:forks + singleFork, fileParallelism:false,
│                         #   sequence.concurrent:false, testTimeout/hookTimeout 300000,
│                         #   globalSetup ./src/global-setup.ts
├── tsconfig.json / tsconfig.spec.json   # mirror install-e2e (typecheck target: tsc --noEmit -p tsconfig.spec.json)
├── src/
│   ├── global-setup.ts   # one line: createVerdaccioGlobalSetup({ label: 'angular-typechecker-cli-e2e' })
│   ├── cli-exit-codes.e2e.spec.ts       # the 0/1/2 x bin-name x invocation matrix (npm baseline)
│   ├── cli-exit-codes-yarn.e2e.spec.ts  # yarn flat + workspace (corepack, skipIf unavailable)
│   ├── cli-exit-codes-pnpm.e2e.spec.ts  # pnpm
│   └── nx-free-runtime.e2e.spec.ts      # D-07 runtime require-cache + ERR_REQUIRE_ESM probe
└── fixtures/
    └── cli-consumer/     # minimal on-stack Angular 22 workspace: package.json (compiler-cli+typescript
                          #   peers, pinned + lockfile), tsconfig.json (+ leaves), one clean component,
                          #   a known clean baseline; errors are PLANTED at runtime (plant helper)
```

Optionally add a shared `createCliRun` helper to `@workspace/test-util/lib/cli-e2e.ts` (analogous to `createNgRun`) if the shim-invocation + literal-status capture is reused across the three PM specs -- keep it tiny; do NOT invent a new helper LIB (D-02 forbids a new helper package, but a new module inside the existing `test-util` lib is consistent with how `ng-cli-e2e.ts` was added).

### Pattern 1: Publish-once, install-by-name per PM (reuse ACV-02, NOT pack-a-tgz)
**What:** The globalSetup publishes the built dist ONCE to `127.0.0.1` Verdaccio; each spec installs `angular-typechecker` BY NAME into a fresh temp consumer via the PM's native install, pointed at Verdaccio via `writeVerdaccioNpmrc` (npm/pnpm) or `.yarnrc.yml` (yarn 4).
**When to use:** All VER-04 cells. By-name install avoids local `tar`/pack entirely -- critical on the Windows leg where the MSYS `D:/` drive-letter gotcha bites pack-a-tgz flows.
**Fixture peer note:** the CLI reaches `@angular/compiler-cli` + `typescript` via the CONSUMER's node_modules (`await import`), so the fixture's `package.json` MUST declare the Angular 22 peer set with a committed lockfile -- reuse an existing e2e fixture's pinned dep set.

### Pattern 2: Invoke the SHIM, not `bin.js` (the shim is under test)
**What:** After install, run `node_modules/.bin/angular-typechecker` (POSIX) / `angular-typechecker.cmd` (Windows), `.bin/atc[.cmd]`, and `npx angular-typechecker`. NEVER `node dist/.../bin.js` and NEVER `npx atc`.
**When to use:** Every literal-exit-code assertion. The `.cmd`/`.ps1` shim PARSES the shebang to pick `node`, so a CRLF shebang would fire `env: node\r` on POSIX and the shim is genuinely divergent on Windows -- that is precisely the net-new surface (D-03, specifics).

### Anti-Patterns to Avoid
- **Piping the shim through `head`/`rg`:** the pipe tail's exit code masks the CLI's. Capture via `spawnSync`/`execSync`, read `status`/`error.status`. [VERIFIED: `e2e-process.ts` + PITFALLS Integration Gotchas]
- **`node bin.js` instead of the shim:** proves nothing about the shebang / `.bin` linking / `.cmd` shim -- the exact cross-platform surface (PITFALLS Technical Debt).
- **`npx atc`:** fetches the foreign `atc@0.0.6`. Use the installed `.bin/atc` shim by path.
- **Pack-a-tgz on the Windows leg:** the MSYS `D:/` drive-letter `tar` gotcha. Install by-name from Verdaccio instead.
- **Adding an `include` windows cell without a base `os` dimension (option a):** silently merges into the Linux `cli-e2e` cell and DROPS the Linux leg (see the OS-axis section).
- **Re-deriving the exit code from `errorCount`:** already owned + frozen in `run()`; the e2e only OBSERVES the shipped code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local registry + auth + publish | A bespoke npm-registry mock | `createVerdaccioGlobalSetup` (reuse verbatim) | Real token mint (Verdaccio 6 401s dummy bearers), provenance strip, `127.0.0.1` SAFETY gate, publish-once -- all solved. |
| Clean nested-install env | Manual `delete process.env[...]` | `buildCleanEnv({ stripAllNpmConfig: true })` | Strips the `npm_config_registry` that `startLocalRegistry` sets process-wide + NX_* runner keys; already load-bearing. |
| Windows-safe temp teardown | Bare `rmSync` | `removeTmpDir` | Handles Windows EPERM/lingering-handle retries best-effort. |
| Anchor-checked source planting | `readFileSync`/`replace` inline | `plant(path, anchor, replacement)` | Fails LOUD if the fixture anchor drifts (no silent plant-nothing pass). |
| Exit-code capture | Rolling exit-code parsing from stdout | `spawnSync(...).status` (or `execSync` catch -> `error.status`) | The OS gives the literal code directly; parsing stdout is fragile. |
| e2e project discovery / CI matrix wiring | A new static project list | `tools/ci/list-e2e-projects.mjs` (auto-discovers the new project) | The new project auto-flows into the Linux dynamic matrix with zero static-list edit (D-01). |

**Key insight:** the entire VER-04 harness already exists for the Nx/ng adapters. The ONLY net-new code is (1) a new e2e project that copies the template, (2) shim-invocation + literal `0/1/2` capture, (3) the runtime nx-free/ESM probe, and (4) the Windows CI leg. Everything else is reuse.

## Common Pitfalls

### Pitfall 1: Windows-Verdaccio ECONNREFUSED start-up race (D-06)
**What goes wrong:** After `startLocalRegistry` returns, the very first network touch (the `mintCiToken` `fetch`, then the first install) can hit `ECONNREFUSED`/`ECONNRESET` on Windows before Verdaccio's socket is actually accepting -- the readiness scrape resolves on the stdout "listening" line, which can slightly precede socket-accept on a slower Windows runner.
**Why it happens:** `startLocalRegistry` resolves by scraping the `http://127.0.0.1:PORT` log line; the numeric-loopback choice already fixes the dual-stack `localhost` family race (the Linux flake), but not a pure timing gap on a cold Windows runner.
**How to avoid:** Add a bounded retry loop (recommended: ~10 attempts, ~500ms linear backoff, ~10s total budget) on `ECONNREFUSED`/`ECONNRESET` around the FIRST network touch. Two surgical locations: (a) inside `mintCiToken`'s `fetch` (harmless to the working Linux path -- it only fires on connection-refused, which Linux never hits), and/or (b) a spec-level bounded install retry wrapping the PM install command. Prefer (a) as the primary (it gates the earliest network touch); add (b) only if install-time ECONNREFUSED is observed. Keep the existing `AbortSignal.timeout(10000)` on each attempt.
**Warning signs:** the Windows `e2e-windows` job fails intermittently at token mint or the first `npm install`/`pnpm add`/`yarn install` with a connection-refused error that passes on re-run.

### Pitfall 2: `spawnSync` of a `.cmd` shim on Windows requires `shell: true`
**What goes wrong:** Since the Node fix for CVE-2024-27980, `spawnSync`/`execFileSync` of a `.cmd`/`.bat` on Windows throws `EINVAL` unless `shell: true` is passed.
**Why it happens:** Node refuses to spawn batch files without a shell to close a command-injection class.
**How to avoid:** On Windows, invoke the shim with `shell: true` (and only FIXED args -- the tsconfig path + flags are not user-controlled, so `shell: true` is safe here). On POSIX the extensionless shim runs directly (no shell needed). Branch on `process.platform === 'win32'` for both the shim filename (`+ '.cmd'`) and `shell: true`. [VERIFIED: matches how the repo already reasons about Windows shims in comments; the CVE behavior is Node-documented.]
**Warning signs:** `EINVAL` / `spawnSync ... .cmd` on the Windows leg only.

### Pitfall 3: Fixture missing the Angular 22 peers -> false infra error
**What goes wrong:** The installed CLI does `await import('@angular/compiler-cli')` resolved from the CONSUMER's node_modules. If the fixture doesn't install `@angular/compiler-cli` + `typescript`, the CLI raises a `TypecheckInfrastructureError` -> exit `2` for the WRONG reason, and the clean-run-exit-0 assertion fails confusingly.
**How to avoid:** the fixture `package.json` declares the on-stack Angular 22 peer set with a committed lockfile; reuse an existing e2e fixture's pinned deps. Assert a sanity check that the installed bin resolves (mirror matrix-e2e's `executors.json` resolve check, adapted to the `.bin` shim existing).
**Warning signs:** clean fixture returns exit 2 with an "infrastructure error" message mentioning the compiler failing to load.

### Pitfall 4: Exit `1` vs `2` conflation in assertions
**What goes wrong:** Using `execSync` (throws on any non-zero) and only asserting "threw" cannot distinguish `1` from `2` -- but VER-04's headline is proving literal `2` distinctly from `1`.
**How to avoid:** `spawnSync(...).status === 2` for infra/usage, `=== 1` for verdict-fail, `=== 0` for clean. If using `execSync`, read `error.status` in the catch and assert the exact number. [VERIFIED: PITFALLS Pitfall 1/9 -- the whole point is the literal 0/1/2.]
**Warning signs:** a bad-flag test that only asserts non-zero (would pass on 1 too).

### Pitfall 5: `--max-warnings`/verdict cells must exercise the FROZEN two-step compose
**What goes wrong:** planting only a plain TS type error proves `1` but not the coverage-incomplete / warnings-exceeded `1` path (`errorCount === 0`, `success === false`) -- the silent-false-pass class Phase 26 exists to prevent.
**How to avoid:** include at least one `--max-warnings 0` (warnings-exceeded) OR `--strict` (dropped in-graph warning) cell asserting exit `1` through the shim. Optional but high-value -- the unit/integration tiers already cover it in-process; the e2e adds the shim-path confidence. [VERIFIED: `evaluate-result` contract, PITFALLS Pitfall 1.]

### Pitfall 6: Flushed-tail truncation on piped stdout (already mitigated in bin.ts)
**What goes wrong:** a large diagnostic dump could be truncated before the tail `TSxxxx` when piped.
**Why it's already safe:** `bin.ts` sets `process.exitCode` and returns (NEVER `process.exit(code)`), so the event loop drains stdout (Phase 27 D-02). The e2e only needs `maxBuffer: 20 * 1024 * 1024` on the capture to avoid ENOBUFS.
**How to avoid:** set the 20MB maxBuffer (matches `createNgRun`); do NOT re-introduce a `process.exit` in the shipped bin. [VERIFIED: `bin.ts` + `ng-cli-e2e.ts` maxBuffer:20MB.]

## Code Examples

### Shim invocation + literal exit-code capture (cross-platform)
```typescript
// Source: derived from libs/test-util/src/lib/ng-cli-e2e.ts (createNgRun) + PITFALLS
// Integration Gotchas (npm cmd-shim triple-file generation). Recommended shape for a
// `createCliRun`-style helper; keep args FIXED (no user input) so shell:true is safe.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function runShim(
  consumerDir: string,
  binName: 'angular-typechecker' | 'atc',
  args: string[],
  env: NodeJS.ProcessEnv,
): { code: number; stdout: string } {
  const isWin = process.platform === 'win32';
  const shim = join(
    consumerDir,
    'node_modules',
    '.bin',
    isWin ? `${binName}.cmd` : binName,
  );

  const result = spawnSync(shim, args, {
    cwd: consumerDir,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024, // avoid ENOBUFS truncating the tail TSxxxx
    shell: isWin, // .cmd requires a shell on Windows (CVE-2024-27980); args are fixed
  });

  return {
    code: result.status ?? 1, // literal OS exit code -- assert === 0 / 1 / 2
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

// exit 0 (clean), exit 1 (planted error), exit 2 (bad tsconfig path / bad flag):
// expect(runShim(dir, 'angular-typechecker', ['-c', 'tsconfig.json'], env).code).toBe(0);
// expect(runShim(dir, 'atc', ['-c', 'does-not-exist.json'], env).code).toBe(2); // infra
// expect(runShim(dir, 'atc', ['--nonsense'], env).code).toBe(2);               // usage
// expect(runShim(dir, 'atc', [], env).code).toBe(2);                           // missing -c
```

### `npx angular-typechecker` (the safe npx invocation)
```typescript
// Source: PITFALLS Pitfall 5 -- npx angular-typechecker resolves the local bin
// (package name matches a bin name). NEVER `npx atc` (fetches foreign atc@0.0.6).
import { execSync } from 'node:child_process';
try {
  execSync('npx angular-typechecker -c tsconfig.json', {
    cwd: consumerDir, env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  });
  // exit 0 path
} catch (e) {
  const code = (e as { status?: number }).status ?? 1; // 1 or 2
}
```

### Runtime nx-free + ESM-bridge probe (D-07)
```typescript
// Source: complements bin-static.spec.ts (STATIC dist require-walk). The RUNTIME
// half runs the INSTALLED bin against a real tsconfig and inspects the module graph
// AFTER `await import('@angular/compiler-cli')` completes. Discretion (D-07 CONTEXT)
// allows require-cache inspection vs a child --eval walk; the exit-hook variant
// captures the FINAL runtime graph (what static analysis cannot see).

// A tiny hook module dropped in the consumer temp dir:
//   dump-require-cache.cjs
//   process.on('exit', () => {
//     const nx = Object.keys(require.cache).filter((k) =>
//       /node_modules[\\/](@nx[\\/]|nx[\\/])/.test(k));
//     require('node:fs').writeFileSync(process.env.ATC_CACHE_OUT, JSON.stringify(nx));
//   });

// Run the INSTALLED bin.js with the hook preloaded (this runs the full CLI):
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const installedBin = join(consumerDir, 'node_modules', 'angular-typechecker', 'src', 'cli', 'bin.js');
const cacheOut = join(consumerDir, 'nx-cache.json');
try {
  execSync(`node -r "${hookPath}" "${installedBin}" -c tsconfig.json`, {
    cwd: consumerDir, env: { ...env, ATC_CACHE_OUT: cacheOut },
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  });
} catch { /* a planted-error run still exits non-zero; the exit hook still fires */ }
const loadedNx = JSON.parse(readFileSync(cacheOut, 'utf8')) as string[];
expect(loadedNx).toEqual([]); // runtime require graph never reaches @nx/* or nx/

// ESM-bridge half (rides on any real run's captured output):
expect(runOutput).not.toMatch(/ERR_REQUIRE_ESM/);
```
Note: the ESM-bridge `/ERR_REQUIRE_ESM/` assertion belongs on the shim runs (real type-check); the require-cache probe can run `node -r hook bin.js` directly (it does not need to go through the `.bin` shim -- the shim is validated separately by the exit-code cells).

### New project's `project.json` (copy install-e2e; add build dependsOn + serialize)
```json
// Source: e2e/angular-typechecker-install-e2e/project.json (verbatim shape).
{
  "name": "angular-typechecker-cli-e2e",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "e2e/angular-typechecker-cli-e2e/src",
  "tags": ["scope:fixture", "type:e2e"],
  "implicitDependencies": ["angular-typechecker"],
  "targets": {
    "e2e": {
      "executor": "@nx/vitest:test",
      "dependsOn": [{ "projects": ["angular-typechecker"], "target": "build" }],
      "outputs": ["{options.reportsDirectory}"],
      "parallelism": false,
      "options": { "reportsDirectory": "coverage/e2e/angular-typechecker-cli-e2e" }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "cache": true,
      "inputs": ["default", "^default", "{workspaceRoot}/tsconfig.base.json",
        { "externalDependencies": ["typescript", "vitest", "@nx/js", "@nx/vite"] }],
      "options": {
        "command": "tsc --noEmit -p e2e/angular-typechecker-cli-e2e/tsconfig.spec.json",
        "cwd": "."
      }
    }
  }
}
```
This satisfies GUARD-01 (has `e2e` target), GUARD-01c (has `typecheck` target), GUARD-01d (`type:e2e` tag), GUARD-01e (`e2e.dependsOn` builds angular-typechecker), and GUARD-01b (`parallelism: false` -- it starts a Verdaccio registry). Because it starts a registry, GUARD-01b's "every registry-starting e2e project serializes" test will auto-require `parallelism:false` -- set it.

## Real-Clone UAT (VER-05) -- manual, human-run

Model the artifact on `.planning/milestones/v0.2.1-phases/24-.../24-ACV-01-UAT.md` (frontmatter with `status/substrate/outcome`, an "About this gate" note, numbered `Tests` with `expected/steps/result/evidence`, a `Summary` tally). The `--auto --chain` pipeline PRODUCES the checklist; a human runs it (D-08). Key difference from Phase 24: the shipped surface is now the standalone `bin` (`atc -c <tsconfig>`), NOT `ng add`/`ng run`.

**CRITICAL flag correction:** the shipped CLI takes `--tsConfig` / `-c` (ARGS-02), NOT `-p`. The PITFALLS.md and `24-ACV-01-UAT.md` examples show `-p` from before the flag was locked -- `-p`/`--project` is deliberately UNREGISTERED and surfaces as an unknown-flag usage error (exit 2). [VERIFIED: `parse-args.ts:112`, `HELP_TEXT`.] Every UAT/e2e invocation uses `-c`/`--tsConfig`.

### Substrate + exact invocations

| Kind | Repo @ SHA | Install + run |
|------|-----------|---------------|
| Angular CLI (primary) | `bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc` | `git clone` + `git checkout <sha>`; `npm install`; install the shipped tarball (`npm i -D <packed-or-published>`); run `atc -c tsconfig.app.json`, `-c projects/ngx-leaflet/tsconfig.lib.json`, `-c tsconfig.spec.json`. |
| Angular CLI (second) | `realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b` | app-only; `atc -c tsconfig.app.json`, `-c tsconfig.spec.json`. |
| Nx workspace (primary) | `radix-ng/primitives @ <PIN FRESH>` | `atc -c packages/primitives/tsconfig.json` (solution reference-walk) + per-leaf `-c packages/primitives/tsconfig.lib.json`, `-c packages/primitives/tsconfig.spec.json`. |
| Nx workspace (alt) | `analogjs/analog @ <PIN FRESH>` | point `atc -c` at an Angular library package's tsconfig (noisier target selection; use for breadth). |

The Nx-kind SHAs are NOT recorded in the planning tree -- pin FRESH at UAT time and record them in the artifact (D-09). PITFALLS.md offers candidate SHAs verified 2026-07-16 (`radix-ng/primitives @ 4a7390a2b058457aa47c6f3e0e03b69b70dee025`; `analogjs/analog @ 04e32e2a873cc3a3d0d037cc24be5ad02ddb363a`) -- use as a starting point but re-verify at run time (repos move; the branches are `main`/`beta`). [CITED: PITFALLS.md Verification Substrate.]

### Assertion shape per clone
- **RED:** plant a distinct diagnostic CODE per leaf (TS2322 component / TS2345 spec / TS2554 lib -- the ACV-01 codes) via the `plant` pattern; `atc -c <leaf>` exits `1` and stdout contains the planted `TSxxxx`; no `ERR_REQUIRE_ESM`, no "infrastructure error". Revert.
- **GREEN:** clean tree; `atc -c <tsconfig>` exits `0`.
- **BAD-PATH:** `atc -c does-not-exist.json` exits `2` (infra); optionally `atc --nonsense` / `atc` (no `-c`) exits `2` (usage).
- Both bin names (`angular-typechecker`, `atc`) at least once; `npx angular-typechecker` for the uninstalled canonical path if desired.

**Windows/MSYS note (manual runs only):** use `/d/...` not `D:/...` paths (Git Bash mis-parses the drive letter as a remote host) -- relevant to local packing/UAT, not CI (D-09).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-job `--parallel=1` shared-tarball CI e2e | Per-project dynamic CI matrix (one runner per e2e project, auto-discovered) | 2026-07-15 (quick-260715-050) | The new project auto-covers on Linux with no static-list edit; `.planning/codebase/TESTING.md` (2026-07-09) is STALE on this -- trust `ci.yml` + `list-e2e-projects.mjs` + GUARD-01b. |
| `-p` as the CLI input flag (early research prose) | `--tsConfig` / `-c` (ARGS-02); `-p` is an unknown-flag usage error | Phase 26 | UAT/e2e must use `-c`; a `-p` invocation is itself a valid exit-2 usage-error test cell. |
| `process.exit(code)` in the bin | `process.exitCode = code` + return (flush-safe) | Phase 27 (D-02) | e2e capture gets the full tail; no `process.exit` truncation. |
| No CLI `bin` (0.2.1) | two-name `bin` -> `./src/cli/bin.js` | Phase 27 | the `.bin` shim exists after install -- the VER-04 surface. |

**Deprecated/outdated:**
- `.planning/codebase/TESTING.md` CI-shape description -- superseded by the per-project matrix (see above).
- `-p`/`--project` for the CLI -- deliberately unregistered (collides with Nx/ng workspace project selection).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dedicated `e2e-windows` job should pin `shell: bash` on its run steps to keep the `-p "$PROJECT"` quoting byte-identical to the Linux `e2e` job (and to let a guard regex match). | The Windows OS-Axis Decision | If left as default `pwsh`, `$PROJECT` still expands but quoting/guard-regex differ -- cosmetic, easily fixed; confirm at plan time. |
| A2 | A bounded ECONNREFUSED retry belongs primarily inside `mintCiToken`'s `fetch`, with a spec-level install retry added only if install-time refusal is observed on the Windows runner. | Common Pitfalls P1 | If the refusal is at install time not token-mint, the retry must move/extend to the install step; low risk (both locations are cheap to add). |
| A3 | The minimal `cli-consumer` fixture can reuse an existing e2e fixture's pinned Angular 22 peer dep set + lockfile rather than a new pin. | Architecture Patterns / Pitfall 3 | If the reused fixture's deps drift from on-stack Angular 22, the CLI's `await import` could fail -> false infra; mitigated by reusing a KNOWN-green fixture. |
| A4 | `radix-ng/primitives` / `analogjs/analog` remain on-stack Angular 22 + MIT at fresh-pinned SHAs at UAT time. | Real-Clone UAT | If a repo moved off-stack, pick another on-stack Angular 22 Nx workspace; the UAT step re-verifies stack before pinning. |
| A5 | `spawnSync` of a `.cmd` on `windows-latest` requires `shell: true` (Node CVE-2024-27980 behavior) under the runner's Node 24. | Common Pitfalls P2 | If a future Node relaxes this, `shell:true` is still harmless with fixed args; no downside. |

## Open Questions (RESOLVED)

1. **Which invocation exercises the Windows `.ps1` shim specifically (vs `.cmd`)?**
   - What we know: npm generates `<name>`, `<name>.cmd`, `<name>.ps1` per bin on Windows. `spawnSync` with `shell: true` on `windows-latest` (default cmd via the shell) hits `.cmd`; PowerShell would hit `.ps1`.
   - What's unclear: whether the plan should assert BOTH `.cmd` (cmd/bash shell) and `.ps1` (pwsh) explicitly, or accept `.cmd` as the representative Windows shim.
   - RESOLVED: assert the `.cmd` path (the dominant runner default) as the mandatory Windows shim leg; treat a `.ps1` cell as optional breadth. D-03 requires "the Windows `.cmd`/`.ps1` shim leg" -- one shim proven on Windows satisfies the divergent-surface intent. Adopted by plan 03 (`runShim` uses `${binName}.cmd`).

2. **Does the runtime require-cache probe need to go through the shim, or is `node -r hook bin.js` acceptable?**
   - What we know: D-07 requires the RUNTIME graph proof on the INSTALLED bin; the shim path is separately proven by the exit-code cells.
   - RESOLVED: run the probe via `node -r hook <installed bin.js>` (captures the runtime graph after `await import` completes); keep the `.bin` shim for the exit-code + `/ERR_REQUIRE_ESM/` cells. CONTEXT D-07 discretion allows this. Adopted by plan 02 Task 3 (`nx-free-runtime`).

## Environment Availability

| Dependency | Required By | Available (dev host) | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v24.18.0 | -- |
| npm | npm PM cell + `npm ci` | yes | 11.16.0 | -- |
| corepack | yarn 4 provisioning | yes | 0.35.0 | Node 24 only (removed in 25+) -- CI pins Node 24 |
| yarn 4 (via corepack) | yarn flat + workspace cells | yes | 4.17.0 | `commandSucceeds` guard skips cleanly if unavailable |
| pnpm | pnpm cell | yes (PATH 9.15.7; fixtures pin 11.9.0 via corepack/action-setup) | 11.9.0 (pinned) | corepack/action-setup provisions the pin |
| git | VER-05 clone/checkout | yes | 2.54.0 | -- |
| tar (GNU) | local pack (avoided via install-by-name) | yes | 1.35 | install-by-name avoids tar entirely on Windows |
| verdaccio + `@nx/js/.../local-registry` | Verdaccio publish-once | yes | 6.x | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking. `publint` did not resolve via `require.resolve` locally but is invoked via `npx` in the existing tarball-audit spec (not needed by this phase's new specs).

CI provisions all of the above per-job exactly as the existing `e2e` job does (`npm ci`, `corepack enable`, `pnpm/action-setup`). The new `e2e-windows` job mirrors those steps on `windows-latest`.

## Validation Architecture

> nyquist_validation is enabled (`config.json` -> `workflow.nyquist_validation: true`). For this verification phase, the validation architecture IS the test/UAT matrix -- each cell is a sample of the shipped-artifact behavior.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` (e2e target) |
| Config file | `e2e/angular-typechecker-cli-e2e/vitest.config.mts` (new -- Wave 0; copy install-e2e's shape: node env, `pool:forks`+`singleFork`, `fileParallelism:false`, `sequence.concurrent:false`, `testTimeout/hookTimeout` 300000, `globalSetup ./src/global-setup.ts`) |
| Quick run command | `npx nx run angular-typechecker-cli-e2e:e2e` (builds dist + publishes once + runs the specs) |
| Full suite command | `npx nx run-many -t e2e --parallel=2` (LOCAL full tier) / CI per-project matrix + `e2e-windows` job |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-04 | npm install + shim -> exit 0/1/2 (both bin names + `npx angular-typechecker`) | e2e | `nx run angular-typechecker-cli-e2e:e2e` | Wave 0 (`src/cli-exit-codes.e2e.spec.ts`) |
| VER-04 | yarn flat + workspace install + shim -> exit 0/1/2 | e2e | same | Wave 0 (`src/cli-exit-codes-yarn.e2e.spec.ts`) |
| VER-04 | pnpm install + shim -> exit 0/1/2 | e2e | same | Wave 0 (`src/cli-exit-codes-pnpm.e2e.spec.ts`) |
| VER-04 SC-3 | installed bin output !~ `/ERR_REQUIRE_ESM/` + runtime require-cache no `@nx/*`/`nx/` | e2e | same | Wave 0 (`src/nx-free-runtime.e2e.spec.ts`) |
| VER-04 SC-2 | tarball e2e runs on Windows (Node 24) with Verdaccio ECONNREFUSED robustness | CI | `e2e-windows` job (`nx run-many -t e2e -p angular-typechecker-cli-e2e` on windows-latest) | Wave 0 (`ci.yml` + retry in `mintCiToken`) |
| VER-04 (guard) | OS-axis + matrix wiring cannot silently drift | unit | `nx test angular-typechecker` (GUARD-01b/new GUARD-01f) | Wave 0 (extend `ci-e2e-coverage-guard.spec.ts`) |
| VER-05 | shipped bin at real tsconfigs in on-stack Angular 22 clones (both kinds): RED/GREEN/bad-path->2 | manual UAT | human-run per `28-<id>-UAT.md` | Wave 0 (`28-<id>-UAT.md` artifact) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast tier -- runs the GUARD specs on every OS x Node cell).
- **Per wave merge:** `nx run angular-typechecker-cli-e2e:e2e` (the new project) + `nx run-many -t e2e --parallel=2` (full local tier).
- **Phase gate:** full CI green (Linux dynamic matrix + `e2e-windows`) before `/gsd-verify-work`; VER-05 UAT is human-run and recorded in the UAT artifact (surfaced to the user at phase close, D-08).

### Wave 0 Gaps
- [ ] `e2e/angular-typechecker-cli-e2e/project.json` -- e2e + typecheck targets, serialized, build dependsOn (VER-04; satisfies GUARD-01/01c/01d/01e/01b).
- [ ] `e2e/angular-typechecker-cli-e2e/vitest.config.mts` -- copy install-e2e's serialized node-env shape.
- [ ] `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` -- `createVerdaccioGlobalSetup({ label })`.
- [ ] `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/` -- minimal on-stack Angular 22 fixture (peers + lockfile + clean tsconfig(s) + a clean component).
- [ ] `src/cli-exit-codes*.e2e.spec.ts` (npm / yarn / pnpm) + `src/nx-free-runtime.e2e.spec.ts`.
- [ ] `.github/workflows/ci.yml` -- add `e2e-windows` job + add it to `ci` aggregate `needs` (option b).
- [ ] Extend `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01b or new GUARD-01f) for the OS-axis wiring.
- [ ] Bounded ECONNREFUSED retry in `libs/test-util/src/lib/verdaccio-global-setup.ts` (`mintCiToken`) [+ optional spec-level install retry].
- [ ] `28-<id>-UAT.md` manual-UAT artifact (VER-05).
- [ ] Optional: `libs/test-util/src/lib/cli-e2e.ts` shared `createCliRun` helper (only if reused across the 3 PM specs).

## Security Domain

> `workflow.security_enforcement` is not present in `config.json` -> treated as ENABLED (block-on: high per phase brief). Each PLAN.md needs a `<threat_model>` block.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Matrix/project name reaches run steps via the `PROJECT` env var, NEVER interpolated into a shell command (verified-live invariant); the new `e2e-windows` job MUST preserve this. |
| V6 Cryptography | no | No crypto; the Verdaccio token is a local test bearer (couchdb sign-up), never a real credential. |
| V10 Malicious Code / Supply Chain | yes | `npx atc` foreign-fetch avoidance (invoke installed `.bin/atc` by path); Verdaccio non-`127.0.0.1` publish refuse-gate; SHA-pinned CI actions (all `e2e-windows` `uses:` must be 40-char SHA-pinned like the rest of `ci.yml`). |
| V12 Files / Resources | yes | Real OSS clones (VER-05) run through the read-only type-check engine (no shell-out of user input; the core reads tsconfigs via `ts`/`fs`, not a shell). |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via matrix/project name | Tampering / EoP | `PROJECT` env var, never `${{ matrix.project }}` inline in a `run` command (existing invariant; the Windows job hardcodes the single project name as an env value). |
| Accidental publish to public npm during e2e | EoP / repudiation | The `createVerdaccioGlobalSetup` SAFETY gate refuses any registry not starting `http://127.0.0.1:` before `nx release publish` -- reused verbatim (D-01). |
| `npx atc` fetches unrelated `atc@0.0.6` (arbitrary code) | Malicious code / supply chain | e2e invokes the installed `.bin/atc` shim by path; `npx angular-typechecker` for the npx path. NEVER `npx atc`. |
| Untrusted OSS clone content (VER-05) | Tampering | Type-check only reads tsconfigs/sources via `ts`/`fs`; no `exec` of clone content; clones stay UNCOMMITTED and pinned by SHA. |
| Mutable-tag CI action repoint (tj-actions class) | Tampering | Every `uses:` in the new `e2e-windows` job is 40-char SHA-pinned (Dependabot-managed), matching the rest of `ci.yml`. |

## Sources

### Primary (HIGH confidence)
- Live codebase (read 2026-07-16): `.github/workflows/ci.yml` (`e2e`/`discover`/`ci` jobs), `tools/ci/list-e2e-projects.mjs`, `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01..01e), `e2e/angular-typechecker-install-e2e/{project.json,vitest.config.mts,src/global-setup.ts,src/tarball-audit.e2e.spec.ts}`, `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts` + `ng-add-ng-run-yarn.e2e.spec.ts`, `e2e/angular-typechecker-matrix-e2e/src/{matrix-5types,pnpm-symlink}.e2e.spec.ts`, `libs/test-util/src/lib/{verdaccio-global-setup,e2e-process,e2e-fixture,ng-cli-e2e}.ts` + `index.ts`, `packages/angular-typechecker/src/cli/{bin.ts,main.ts,parse-args.ts,bin-static.spec.ts}`, `packages/angular-typechecker/package.json`.
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` -- Windows-Verdaccio robustness, flush-safe `process.exit` race, nx-transitive crash class, `npx atc` hazard, the verification-substrate SHAs, the "Looks Done But Isn't" checklist.
- `.planning/REQUIREMENTS.md` (VER-04/VER-05), `.planning/ROADMAP.md` (Phase 28 SC-1..4), `.planning/phases/28-.../28-CONTEXT.md` (D-01..D-09).
- `.planning/milestones/v0.2.1-phases/24-.../24-ACV-01-UAT.md` -- the UAT artifact shape + carry-forward Angular-CLI SHAs.

### Secondary (HIGH-MEDIUM confidence)
- docs.github.com "Running variations of jobs in a workflow" (fetched via markdown.new 2026-07-16) -- `matrix.include` merge-vs-new-combination semantics (the option-a trap), `runs-on: ${{ matrix.os }}`, `fromJSON(needs.*.outputs...)` dynamic matrix, `fail-fast`.
- Local environment probe 2026-07-16 -- node 24.18.0, npm 11.16.0, corepack 0.35.0, yarn 4.17.0, pnpm 9.15.7 (11.9.0 pinned), git 2.54.0, GNU tar 1.35, verdaccio + local-registry present.

### Tertiary (verify at plan/UAT time)
- PITFALLS.md candidate Nx-workspace SHAs (`radix-ng/primitives @ 4a7390a2...`, `analogjs/analog @ 04e32e2a...`) -- re-verify on-stack + pin fresh at UAT time (D-09).
- `spawnSync` `.cmd`-needs-`shell:true` (CVE-2024-27980 Node behavior) -- confirm on the CI Windows Node 24 at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack (all reuse, zero new deps): HIGH -- verified against the live codebase + local tool probe.
- Architecture / new e2e project shape: HIGH -- copies a verified-live template; guard invariants enumerated.
- Windows OS-axis mechanism: HIGH on the recommendation + rationale (merge semantics cited from official docs); the exact `e2e-windows` YAML + guard extension is prescriptive but subject to normal plan review.
- Windows-Verdaccio retry location: MEDIUM -- direction is clear (bounded ECONNREFUSED retry); the exact placement (token-mint vs install) confirmed at implementation time on a real Windows runner.
- Pitfalls: HIGH -- sourced from the milestone PITFALLS.md + the live specs.

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stable; the CI wiring and CLI contract are frozen for this milestone). Re-verify OSS clone SHAs at UAT time (repos move).
