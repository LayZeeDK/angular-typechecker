# Phase 28: Shipped-tarball e2e + real-clone UAT - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discuss) `--analyze` `--chain`

<domain>
## Phase Boundary

Prove the SHIPPED CLI end-to-end. Two net-new verification surfaces close the
`v0.2.2` standalone-CLI milestone -- neither adds any engine, verdict, or
adapter behavior (all load-bearing correctness shipped in Phases 25-27):

1. **VER-04 -- Shipped-tarball e2e (automated, CI-authoritative):** a DEDICATED
   `angular-typechecker-cli-e2e` project INSTALLS the packed tarball from
   Verdaccio and RUNS the shipped `bin`s, asserting the literal OS process exit
   codes `0`/`1`/`2` come back through the real package-manager-generated `.bin`
   shim -- for both `angular-typechecker` and `atc`, plus `npx angular-typechecker`
   -- across the PM matrix **npm + yarn (flat + workspace) + pnpm**, on **Linux
   AND Windows** (Node 24). This is net-new coverage vs the existing Nx/ng
   `{success}` (0/1) harness: the literal exit **2** (infra + usage) and the shim
   path (incl. the Windows `.cmd`/`.ps1` shim) have never been asserted before.

2. **VER-05 -- Real-clone UAT (manual):** the shipped `bin`s run at REAL project
   tsconfigs in real on-stack Angular 22 OSS clones of BOTH kinds -- a real Nx
   workspace AND a real Angular CLI (`angular.json`) workspace -- asserting
   planted-error RED / clean GREEN / bad-path -> `2` (the ACV-01 pattern from
   Phase 24; uncommitted clones pinned by URL + SHA).

**In scope (this phase):**
- A NEW `e2e/angular-typechecker-cli-e2e/` project (Verdaccio publish-once +
  `execSync` install-and-RUN, node env, fully serialized) that auto-discovers into
  the CI `e2e` per-project matrix via `tools/ci/list-e2e-projects.mjs` (VER-04).
- Assertions of literal `0`/`1`/`2` through the real PM `.bin` shim for
  `angular-typechecker`, `atc`, and `npx angular-typechecker`, across npm + yarn
  (flat + workspace) + pnpm (VER-04).
- The CI `e2e` job gaining a Windows leg FOR THIS PROJECT (Node 24), including the
  known Windows-Verdaccio robustness handling (127.0.0.1 bind / ECONNREFUSED
  retry) -- a deliberate, plan-surfaced departure from the repo's Linux-only heavy
  default (VER-04, SC-2; RESEARCH-FLAGGED wiring, see D-04/D-05).
- A RUNTIME nx-free / no-`ERR_REQUIRE_ESM` probe on the INSTALLED bin (VER-04,
  SC-3) -- the runtime `require.cache` half Phase 27 D-10 explicitly deferred here.
- Guard consistency: the new project flows through GUARD-01 (`list-e2e-projects.mjs`
  == GUARD-01 enumeration); any ci.yml OS-axis change stays consistent with
  GUARD-01b's dynamic-matrix-wiring assertion.
- Manual real-clone UAT artifact (`28-...-UAT.md`, modeled on `24-ACV-01-UAT.md` /
  `24-HUMAN-UAT.md`) covering both workspace kinds with pinned URL + SHA (VER-05).

**Out of scope (later / earlier):** README `## Standalone CLI` + exit-code table +
curated CHANGELOG -- Phase 29 (DOC-01). Any engine/verdict/exit-code LOGIC change
-- already shipped and frozen in Phases 25-27; this phase only INSTALLS and RUNS
the artifact those phases produced. JSON/SARIF reporters, `--watch`, `--quiet` --
Future Requirements, out of this milestone.

</domain>

<decisions>
## Implementation Decisions

> **`--auto` note.** Every decision below was auto-locked in a single pass. All
> are HIGH-confidence -- locked by the ROADMAP Phase-28 success criteria (SC-1..4),
> the VER-04/VER-05 requirement implementation notes, the Phase-27 handoff
> (`27-CONTEXT.md` D-10/D-11 + its Out-of-Scope table scoped this phase exactly),
> the verified live CI wiring (`ci.yml` `e2e` job + `tools/ci/list-e2e-projects.mjs`
> + `ci-e2e-coverage-guard.spec.ts`), and recorded UAT SHAs. NONE was silently
> settled inside the "trap quadrant" (high-impact + low-confidence): the ONE
> high-impact area with genuine latitude -- the Windows CI OS-axis WIRING mechanism
> (D-04) -- is deliberately LEFT OPEN as a RESEARCH FLAG, not locked, because its
> DIRECTION is required by VER-04 SC-2 but its mechanism is a technical CI-plumbing
> detail owned by the researcher/planner, not a user-facing gray area. No user
> checkpoint was warranted.

### New `angular-typechecker-cli-e2e` project (VER-04, SC-1)
- **D-01:** Add a NEW `e2e/angular-typechecker-cli-e2e/` project modeled on
  `e2e/angular-typechecker-install-e2e/` -- Verdaccio `globalSetup` (`startLocalRegistry`
  on `127.0.0.1`, real couchdb bearer token, build-and-publish ONCE via
  `nx release publish --first-release --excludeTaskDependencies`, the non-`127.0.0.1`
  SAFETY refuse-gate), node env, `pool: forks` + `singleFork` + `fileParallelism:false`
  + `sequence.concurrent:false`, long timeout (~300000ms). It defines an `e2e` target
  so `tools/ci/list-e2e-projects.mjs` auto-discovers it into the dynamic CI matrix
  with NO static list edit (verified: discovery filters on `project.json.targets.e2e`).
- **D-02:** Reuse the EXISTING Verdaccio pattern verbatim -- ONE registry on
  `127.0.0.1` (the numeric IPv4 loopback that fixes the yarn-4 dual-stack ECONNREFUSED
  flake), `buildCleanEnv({ stripAllNpmConfig: true })` so an inherited
  `npm_config_registry` cannot leak the install to the public registry. NO second
  registry port. Shared `@workspace/test-util` helpers (`findWorkspaceRoot`,
  `buildCleanEnv`, `run`/`sh`, `removeTmpDir`) -- no new helper lib.

### Exit-code x PM x bin-name assertion matrix (VER-04, SC-1)
- **D-03:** Assert the NET-NEW surface deliberately. Install the packed tarball with
  each of npm + yarn (flat) + yarn (workspace) + pnpm, then run the installed bins
  through the PM-generated `.bin` shim (NOT a direct `node dist/...bin.js` call --
  the shim IS the surface under test) and assert `process.exitCode`:
  - `0` on a clean fixture, `1` on a planted-error fixture (type/template/NG8xxx or
    warnings-exceeded), `2` on infra (malformed/nonexistent tsconfig) AND on usage
    (unknown flag / missing required `--tsConfig`) -- `2` is the highest-value cell
    (never asserted by the 0/1 `{success}` harness).
  - Cover BOTH bin names (`angular-typechecker`, `atc`) and `npx angular-typechecker`
    at least for the representative exit codes; the planner may prune provably-redundant
    (PM x invocation x code) cells but MUST keep >=1 shim-resolution assertion per PM,
    each exit code per bin name, and the Windows `.cmd`/`.ps1` shim leg.

### Windows CI OS-axis (VER-04, SC-2) -- RESEARCH-FLAGGED, direction locked / mechanism open
- **D-04:** DIRECTION (locked by VER-04 SC-2, RISK explicitly accepted in the
  requirement): the CI `e2e` job runs `angular-typechecker-cli-e2e` on BOTH Linux
  AND Windows (Node 24), because the `.cmd`/`.ps1` bin shim is the one genuinely
  Windows-divergent CLI surface. The other e2e projects stay Linux-only (the repo's
  deliberate heavy-e2e default) -- do NOT cartesian-expand every e2e project onto
  Windows.
- **D-05:** MECHANISM (OPEN -- researcher/planner decides; do NOT treat as settled):
  the current `e2e` job matrix is 1-D over `project:` with `runs-on: ubuntu-latest`
  fixed (`ci.yml:207-211`). Adding Windows for ONLY this project needs ci.yml surgery.
  Candidate shapes to evaluate (NOT pre-picked): (a) `runs-on: ${{ matrix.os }}` with
  `matrix.include` adding an `os: windows-latest` cell ONLY for
  `angular-typechecker-cli-e2e`; (b) a SEPARATE dedicated Windows job outside the
  dynamic project matrix. Whichever is chosen MUST (1) keep the `discover` ->
  `fromJSON(needs.discover.outputs.projects)` dynamic-matrix contract intact for the
  Linux legs, (2) stay consistent with `ci-e2e-coverage-guard.spec.ts` GUARD-01/01b
  (extend the guard if the wiring shape changes -- silent matrix drift is the failure
  mode the guard exists to catch), and (3) respect the Node-24/corepack coupling note
  already in `ci.yml` (corepack ships in Node 24, removed in 25+).
- **D-06:** Windows-Verdaccio robustness (direction locked, mechanism = research):
  the Windows leg MUST handle the known `127.0.0.1` bind / ECONNREFUSED-retry issues
  that motivated the Linux-only default (the `127.0.0.1` numeric-loopback choice
  already addresses the dual-stack half; a bounded start-up retry loop is the likely
  addition). The planner sources the exact retry shape from
  `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` + a targeted researcher pass.

### Installed-bin runtime nx-free / ESM-bridge probe (VER-04, SC-3)
- **D-07:** Add the RUNTIME half Phase 27 D-10 deferred: assert the installed bin's
  output NEVER matches `/ERR_REQUIRE_ESM/` (the `await import('@angular/compiler-cli')`
  bridge survived install un-downleveled) AND a module-graph probe confirms the
  INSTALLED bin's `require` cache never reaches `@nx/*`/`nx/` at runtime (complements
  Phase 27's STATIC dist-graph walk in `gate-a-static.spec.ts`/`bin-static.spec.ts`).

### Real-clone UAT (VER-05) -- manual
- **D-08:** MANUAL UAT (as VER-05 states), captured in a
  `28-<id>-UAT.md` artifact modeled on
  `.planning/milestones/v0.2.1-phases/24-.../24-ACV-01-UAT.md` and `24-HUMAN-UAT.md`.
  For each clone: planted-error RED (a known NG/TS/template code in stdout), clean
  GREEN (exit 0), bad tsconfig path -> exit 2. Clones stay UNCOMMITTED, pinned by URL
  + SHA. The `--auto --chain` pipeline PRODUCES the UAT checklist/script; a HUMAN runs
  the manual UAT (it is not auto-executed) -- surface this to the user at phase close.
- **D-09:** UAT substrate (both kinds, on-stack Angular 22):
  - Angular CLI (`angular.json`) kind: `bluehalo/ngx-leaflet`
    @ `818e9ae55240b570397ede5a15cb4d466785abdc` (primary) and
    `realworld-angular/realworld-angular`
    @ `9e3528ff27bad5fedaefb879ccc4aaf4717b137b` (second) -- both carry-forward SHAs
    proven in v0.2.1 Phase 24.
  - Nx-workspace kind: `radix-ng/primitives` (primary), `analogjs/analog` (alt) --
    SHAs are NOT recorded in the planning tree (they were referenced by name in the
    v0.2.0 Storybook milestone, never SHA-pinned for a CLI UAT); the researcher/UAT
    step pins FRESH SHAs at run time (repos move) and records them in the UAT artifact.
  - MSYS/Windows manual runs use `/d/...` not `D:/...` paths (Git Bash mis-parses the
    drive letter as a remote host) -- relevant only to manual packing/UAT, not CI.

### Claude's Discretion
- Fixture design inside the new project (which planted-error fixtures; reuse
  `fixtures/` project shapes vs minimal inline ones), provided each asserts a
  diagnostic CODE (never message text) per the repo convention.
- The exact pruning of the (PM x bin-name x invocation x exit-code) cell set within
  D-03's mandatory-coverage floor.
- The module-graph runtime-probe implementation (require-cache inspection vs a
  child-process `--eval` walk), provided it proves no `@nx/*`/`nx/` at runtime (D-07).
- The exact `execSync`/`spawnSync` capture mechanics for reading the shim's literal
  exit code, provided the flush-safe bin contract (Phase 27 D-02) is honored and the
  tail `TSxxxx` code is never truncated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (what + why)
- `.planning/REQUIREMENTS.md` -- VER-04 (shipped-tarball e2e: dedicated
  `angular-typechecker-cli-e2e`, literal `0`/`1`/`2` through the real PM `.bin` shim,
  npm + yarn flat/workspace + pnpm, Linux AND Windows Node 24, Verdaccio, the OS-axis
  + Windows-Verdaccio-robustness implementation notes), VER-05 (manual real-clone UAT,
  both workspace kinds, planted RED / clean GREEN / bad-path -> 2, URL+SHA pinning).
- `.planning/ROADMAP.md` -- "### Phase 28: Shipped-tarball e2e + real-clone UAT"
  (goal + SC-1..SC-4) + the v0.2.2 milestone framing.

### Milestone research (HIGH confidence -- 4 researchers converged)
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` -- Windows-Verdaccio
  robustness (127.0.0.1 bind / ECONNREFUSED retry), the flush-safe `process.exit`
  race (Pitfall 6, why the shim's tail exit code must not truncate), the nx-transitive
  crash class (Pitfall 3), the "Looks Done But Isn't" checklist, and the verification-
  substrate recommendation (the real-clone SHAs are THIS phase).
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md` -- the third-thin-adapter
  design (context for the nx-free installed-bin probe).
- `.planning/research/v0.2.2-standalone-cli/STACK.md` -- build/packaging + Verdaccio /
  publish stack (`nx release publish`, `publint`, PM matrix).
- `.planning/research/v0.2.2-standalone-cli/SUMMARY.md` -- milestone synthesis.

### CI wiring the phase extends (read to mirror; verified live 2026-07-16)
- `.github/workflows/ci.yml` -- the `e2e` job (`:204-262`, 1-D `project:` matrix,
  `runs-on: ubuntu-latest`, `PROJECT` env no-injection pattern, the
  `run-many -t e2e -p "$PROJECT"` per-cell invocation, the Node-24/corepack coupling
  note) and the `discover` job (`:141-176`) feeding the dynamic matrix. D-04/D-05's
  OS axis edits here.
- `tools/ci/list-e2e-projects.mjs` -- pure `fs`+JSON e2e-project discovery (filters on
  `project.json.targets.e2e`, fails loud on empty); the new project auto-flows through
  it with no static-list edit.
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- GUARD-01/01b/01c;
  asserts `list-e2e-projects.mjs` output == the strict `e2e/<dir>/project.json`
  enumeration and the dynamic-matrix wiring. Keep green; extend for the OS-axis if the
  wiring shape changes.

### Code the phase models / reuses (read to mirror, do NOT re-implement)
- `e2e/angular-typechecker-install-e2e/src/global-setup.ts` -- the EXACT Verdaccio
  publish-once model (`startLocalRegistry` on `127.0.0.1`, real token, `nx release
  publish`, SAFETY gate, `provide(verdaccioUrl/Token)`) the new project copies (D-01/D-02).
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` -- Phase 27 D-11
  extended this with the publint BIN audit (bin map + LF shebang); the new install-and-
  RUN specs live in the NEW project, not here.
- `e2e/angular-typechecker-install-e2e/vitest.config.mts` + `project.json` -- the node-env,
  fully-serialized, long-timeout, `e2e`-target config shape to copy.
- `packages/angular-typechecker/src/cli/main.ts` + `src/cli/bin.ts` -- the shipped
  `run()` contract + the flush-safe `bin.ts` shell (Phase 26/27) whose installed
  artifact this phase exercises; NOTHING here changes.
- `packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts` +
  `src/cli/bin-static.spec.ts` -- Phase 27's STATIC nx-free/shebang guards; D-07 adds
  the complementary RUNTIME probe on the INSTALLED bin.
- `libs/test-util/src/index.ts` -- `findWorkspaceRoot`, `buildCleanEnv`, `run`/`sh`,
  `commandSucceeds`, `removeTmpDir` (cwd-independent, no new helper needed).

### Real-clone UAT model + recorded SHAs (VER-05)
- `.planning/milestones/v0.2.1-phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-ACV-01-UAT.md`
  and `24-HUMAN-UAT.md` -- the UAT artifact shape + the recorded `ngx-leaflet @818e9ae`
  / `realworld-angular @9e3528f` SHAs to carry forward.

### Prior context (this milestone)
- `.planning/phases/27-bin-shell-cross-platform-packaging/27-CONTEXT.md` -- D-10
  (deferred the RUNTIME installed-bin probe to this phase) + D-11 (tarball publint bin
  audit) + its Out-of-Scope table scoping VER-04/05 here.
- `.planning/phases/26-pure-cli-core-exit-code-wiring/26-CONTEXT.md` -- the exit-code
  contract (two-step compose; literal 2 for infra/usage) the shim must faithfully carry.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`e2e/angular-typechecker-install-e2e/`** -- the complete template for the new
  project: Verdaccio global-setup, node-env serialized vitest config, `e2e` target.
  Copy-and-adapt, do NOT invent a new e2e harness.
- **`tools/ci/list-e2e-projects.mjs`** -- auto-discovers the new project into the CI
  matrix; zero static-list edits needed (the "NEW e2e project auto-covered" contract).
- **`@workspace/test-util` helpers** -- `findWorkspaceRoot`/`buildCleanEnv`/`run`/`sh`
  cover cwd-independence + clean-env install; no new helper lib.
- **`gate-a-static.spec.ts` / `bin-static.spec.ts`** -- the STATIC nx-free proof; D-07
  is the RUNTIME counterpart on the installed artifact.

### Established Patterns
- **Thin-adapter charter:** the CLI is the third adapter over the ONE `run()` core;
  this phase INSTALLS + RUNS that artifact and asserts behavior -- it changes no logic.
- **Two-tier verification:** committed CI-authoritative specs (VER-04) + a manual
  real-clone UAT (VER-05) -- the same split used across every prior milestone.
- **Per-project e2e CI matrix (2026-07-15):** the `e2e` tier is a dynamic per-project
  matrix (one runner per e2e project; `nx run-many -t e2e --parallel=2` is the LOCAL
  full-tier command only). No cross-runner build-artifact handoff (a foreign `.nx/cache`
  restore is a no-op) -- each cell rebuilds the plugin via `dependsOn:build`.
  NOTE: `.planning/codebase/TESTING.md` (dated 2026-07-09) still describes the OLDER
  `--parallel=1` single-job shared-tarball model and is STALE on the CI shape -- trust
  `ci.yml` + `list-e2e-projects.mjs` + GUARD-01b as verified live here.
- **Verdaccio invariants:** `127.0.0.1` numeric loopback (dual-stack fix), real couchdb
  token (dummy 401s on Verdaccio 6), `stripAllNpmConfig`, non-`127.0.0.1` publish refuse-gate.
- **Assert by diagnostic CODE, never message text**; `execSync` throws on non-zero exit,
  so the assertion IS the gate.

### Integration Points
- NEW `e2e/angular-typechecker-cli-e2e/` (project.json + vitest.config.mts + global-setup
  + install-and-run specs + fixtures) -- auto-discovered by `list-e2e-projects.mjs`.
- `.github/workflows/ci.yml` `e2e` job gains a Windows leg for this project (D-04/D-05).
- `ci-e2e-coverage-guard.spec.ts` (GUARD-01b) stays consistent with the OS-axis wiring.
- A `28-<id>-UAT.md` manual-UAT artifact (human-run).

</code_context>

<specifics>
## Specific Ideas

- **Exit `2` is the headline net-new assertion** -- the pre-existing Nx/ng `{success}`
  harness only ever proves `0`/`1`; the literal OS `2` (infra + usage) and the real PM
  `.bin` shim path are what this phase adds. Weight the matrix toward proving `2`.
- **The shim, not the file, is under test** -- run `angular-typechecker`/`atc`/`npx
  angular-typechecker` through the PM-generated `.bin` (incl. Windows `.cmd`/`.ps1`),
  never a direct `node .../bin.js`.
- **Windows is a deliberate, plan-surfaced RISK** -- VER-04 SC-2 accepts departing from
  the Linux-only heavy-e2e default because the shim is the one Windows-divergent surface;
  the plan MUST call this out (and the Windows-Verdaccio retry handling) explicitly.
- **`npx atc` supply-chain hazard** -- `atc@0.0.6` is a real unrelated npm package; this
  phase never invokes `npx atc` (it uses the installed `.bin/atc` shim). Steering docs to
  `npx angular-typechecker` is Phase 29.
- **UAT is human-run** -- `--auto --chain` produces the checklist; the human executes the
  manual real-clone UAT. Do not mark the phase's VER-05 done from automation alone.

</specifics>

<deferred>
## Deferred Ideas

- README `## Standalone CLI` section + exit-code contract table + curated public
  CHANGELOG entry -- Phase 29 (DOC-01).
- JSON / SARIF reporters (REP-01/02), `--watch` (CLIX-01), `--quiet` / explicit
  `--color`/`--no-color` / a `--project` alias (CLIX-02) -- Future Requirements, out of
  scope this milestone.
- GitHub-backed self-hosted Nx remote cache (CI cache optimization) -- ROADMAP Backlog,
  not this phase.
- Cartesian OS-expansion of ALL e2e projects onto Windows -- deliberately NOT done; only
  `angular-typechecker-cli-e2e` gets the Windows leg (the shim is the one divergent surface).

None beyond the above -- discussion stayed within phase scope.

</deferred>

---

*Phase: 28-shipped-tarball-e2e-real-clone-uat*
*Context gathered: 2026-07-16*
