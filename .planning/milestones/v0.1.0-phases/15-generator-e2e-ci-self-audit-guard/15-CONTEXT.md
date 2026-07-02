# Phase 15: Generator e2e + CI self-audit guard - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

> Captured autonomously via `/gsd-discuss-phase 15 --analyze --auto --chain`.
> Every decision below was auto-selected (recommended option) and is grounded in
> ROADMAP Phase 15 SC1-SC4, REQUIREMENTS GE2E-01..03 + GUARD-01, the shipped
> Phase 14 `configuration`/`init` generators + `generators.json`, the board
> strategy (fold into `install-e2e`, no Verdaccio, no new e2e project, in-plugin
> guard), and a concrete codebase scout of the existing e2e harness
> (`install-smoke`/`tarball-audit`/`release-hygiene` specs, the `consumer-app`
> fixture, `ci.yml`'s `e2e` job `-p` list, the shipped `generators.json`, and the
> serialized `vitest.config.mts`). Each gray area was rated on IMPACT x CONFIDENCE
> per the auto-lock discipline; NONE landed in the high-impact / not-high-confidence
> trap quadrant (this is the milestone's final phase -- no downstream phase inherits
> these choices, and every artifact here is a reversible internal test/fixture), so
> none is left as a BLOCKER. Two residual-uncertainty items (the GUARD-01 graph
> enumeration source, D-11; and whether to extend the tarball audit for the shipped
> generators, D-12) are auto-locked with explicit RESEARCH-VERIFY / discretion flags
> for the phase researcher and planner -- their uncertainty is a verifiable
> engineering fact, not a user preference. Trade-off tables are in
> `15-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Prove the Phase 14 generator suite END-TO-END against the installed tarball, and
make the CI `e2e` job's project coverage self-auditing. This phase writes TESTS
and (for the guard) reads CI config -- it ships NO new plugin source or generator
behavior (Phase 14 shipped `configuration`/`init`/`generators.json`; Phase 13/13.1
shipped the reference-walking engine + renamed executor id).

**In scope (the 4 requirements):**
- **GE2E-01:** The `angular-typechecker-install-e2e` consumer fixture gains a
  project WITHOUT a pre-wired target. An e2e scenario installs the freshly-packed
  tarball into an isolated tmp workspace, runs
  `nx g angular-typechecker:configuration <proj>`, and asserts BOTH (a) the
  resulting `project.json` (ONE `typecheck` target, executor
  `angular-typechecker:typecheck`, pointed at the project's solution
  `tsconfig.json`) AND (b) the `init`-seeded `nx.json`
  `targetDefaults["angular-typechecker:typecheck"]` (the WALK-02 cacheable block,
  `default`-not-`production` inputs).
- **GE2E-02:** The same scenario runs `nx run <proj>:typecheck --skip-nx-cache`
  and asserts the WALK verdict end-to-end: a clean project yields success (exit 0);
  errors injected into BOTH the lib leaf AND the spec leaf yield a failure with the
  diagnostic codes visible in the output (proving BOTH leaves were walked).
- **GE2E-03:** An e2e scenario proves `nx add angular-typechecker` runs the `init`
  generator and seeds `nx.json` `targetDefaults["angular-typechecker:typecheck"]`
  on install.
- **GUARD-01:** A guard test asserts the CI `e2e` job's explicit `-p` project list
  EQUALS the set of `e2e/*` projects in the workspace graph (predicate quantifier
  `every`, bidirectional), converting a forgotten/stale `-p` entry from a silent
  skip into a loud, located failure. The single required `ci` gate stays unchanged.

**Out of scope (this phase):**
- Any change to plugin source, the engine, the executor, or the generators
  (all shipped in Phases 12/13/13.1/14). This phase is tests + a CI-config guard.
- Verdaccio / a second registry mechanism -- the existing `npm pack` + tmp-install
  tarball harness is reused (board-locked; Windows-arm64 `execFileSync` hostility).
- A NEW nx e2e PROJECT -- the scenarios fold into `angular-typechecker-install-e2e`
  (board-locked). New FIXTURE workspaces under that project's `fixtures/` are
  fixture data, not new nx projects, and are allowed.
- The bespoke real-disk `createFsTree`/`flushFsTreeChanges` helper (FSTREE-01;
  the generators emit no files -- real-disk fidelity comes from THIS tarball e2e).
- `ng add` (Angular CLI) install schematic + Angular CLI `angular.json` support
  (GEN-FUT-02 / GEN-FUT-01, deferred). Nx's `nx add` IS in scope (GE2E-03).
- `createNodesV2` inferred granular per-leaf targets (WALK-FUT-01, deferred).
- The 0.1.0 version cut / Release PR -- that is the milestone Release PR after
  Phase 15 closes, NOT part of this phase.

</domain>

<decisions>
## Implementation Decisions

### New consumer fixture shape for the generator e2e (GA-1)
- **D-01 (Purpose-built multi-leaf solution fixture; do NOT reuse `consumer-app`):**
  Add a NEW fixture workspace under
  `e2e/angular-typechecker-install-e2e/fixtures/` (recommended name
  `consumer-generator/`) containing ONE un-wired Angular **library** project whose
  solution `tsconfig.json` has a non-empty `references[]` pointing at
  `tsconfig.lib.json` (a component with a template so template type-check is
  exercised) AND `tsconfig.spec.json` (a `*.spec.ts`). This is the exact shape the
  generator's D-07 case (2) resolves to (solution `tsconfig.json` with references ->
  point the ONE target at it -> WALK-01 walks the lib + spec leaves). The existing
  `consumer-app` fixture stays UNTOUCHED (it backs `install-smoke`, is flat, and
  points directly at `tsconfig.lib.json`).
  - **Why NOT add a 2nd project to `consumer-app`:** `consumer-app/nx.json`
    ALREADY declares `targetDefaults["angular-typechecker:typecheck"]` -- and with
    **`"production"`** inputs (the WALK-02 landmine: `production` excludes
    `*.spec.ts`). Two failures would follow: (i) `init`'s whole-entry `??=`
    don't-clobber (Phase 14 D-05) would SKIP seeding because the key already
    exists, making the GE2E-01 "init-seeded targetDefaults" assertion vacuous; and
    (ii) even if seeded, `production` under-hashes the walked spec leaf -> a
    potential stale-PASS masking GE2E-02's spec-leaf error. A purpose-built fixture
    avoids both.
- **D-02 (Fixture `nx.json` MUST NOT pre-declare the targetDefaults key):** The new
  fixture workspace's `nx.json` must have NO
  `targetDefaults["angular-typechecker:typecheck"]` entry before the generator
  runs, so `init` genuinely SEEDS it and GE2E-01(b)/GE2E-03 assert a real write.
  After seeding, assert the block equals the WALK-02 shape with **`default`** (NOT
  `production`) as the first input -- the load-bearing correctness invariant.

### E2E harness + scenario flow (GA-2)
- **D-03 (Reuse the established install-smoke harness verbatim):** Reuse the
  proven pattern from `install-smoke.int.spec.ts` / `tarball-audit.int.spec.ts`:
  `buildCleanEnv()` (strip the `NX_*` runner vars + the peer-override env keys;
  `NX_DAEMON=false`, `FORCE_COLOR=0`), a `beforeAll` that runs
  `npx nx build angular-typechecker --skip-nx-cache` then `npm pack --json` from
  the dist dir to capture the exact shipped `.tgz`, and a per-scenario
  `mkdtempSync` -> `cpSync(fixtureDir, tmp)` -> write an empty `.npmrc` ->
  `npm install <tarball>` (with `npm_config_userconfig` pointed at a nonexistent
  path, NO peer-override -- B-03 honesty) -> operate -> `rmSync(tmp)` in `finally`.
  The `run()` helper's execSync-throws-on-nonzero -> catch pattern captures the
  injected-error exit + stdout. NEVER pipe `nx` through `head`/`rg` (the pipe
  tail's exit code masks Nx's). Runs SEQUENTIALLY on the main tree under the
  existing serialized `vitest.config.mts` (forks/singleFork/no-parallel/node env,
  300000ms) -- worktree-hostile (D-22).
- **D-04 (GE2E-01/02 scenario flow):** In the tmp install: (1)
  `npx nx g angular-typechecker:configuration <proj> --output-style=static` (the
  un-wired project); (2) read the tmp `project.json` -> assert exactly one target
  named `typecheck` with `executor: "angular-typechecker:typecheck"` and
  `options.tsConfig` resolving to the solution `tsconfig.json`; (3) read the tmp
  `nx.json` -> assert the seeded `targetDefaults["angular-typechecker:typecheck"]`
  (WALK-02 block, `default` inputs, `cache:true`, `outputs:[]`); (4)
  `npx nx run <proj>:typecheck --skip-nx-cache` clean -> assert exit 0; (5) inject
  a known TS/NG code into the lib-leaf component source AND a distinct known code
  into the spec-leaf `*.spec.ts` source -> re-run `--skip-nx-cache` -> assert
  non-zero exit AND BOTH rendered diagnostic codes present in stdout (the
  two-leaf-walked proof), AND no `ERR_REQUIRE_ESM`, AND no `infrastructure error`
  meta message. Assert full code tokens (e.g. `TS2322`, not a bare `2322`
  substring) to avoid false-PASS on an incidental 4-digit occurrence (IN-02).
- **D-05 (Inject into a discarded tmp copy -- crash-safe, no sidecar):** Mutate the
  tmp workspace copy's sources (never the committed fixture); `rmSync` discards it.
  Build injected lines via `JSON.stringify` (no quote/apostrophe escaping hazard,
  ASCII-only). Use a hoisted const per injected code so a future code change is a
  single edit.

### `nx add` e2e (GA-3)
- **D-06 (GE2E-03 = a distinct scenario, same harness):** Prove
  `nx add angular-typechecker` runs `init` on install and seeds `targetDefaults`.
  Recommended flow: a fresh tmp workspace fixture whose `nx.json` does NOT
  pre-declare the key, then invoke the package's install-time init path the way
  `nx add` does. **RESEARCH-VERIFY (carry Phase 14 D-06 forward):** Phase 14
  registered `init` by literal key with NO `ng-add` alias, relying on the Nx 23.0.1
  `nx add` contract that runs a package's `init` generator on install. Confirm the
  EXACT, TESTABLE `nx add` invocation for an e2e against an INSTALLED tarball
  (whether `nx add <pkg>` can target a local tarball / already-installed package
  offline, or whether the scenario must install-then-`nx g angular-typechecker:init`
  to stand in for the add-time init run, or drive `npm install <tarball>` +
  `nx add angular-typechecker`). The assertion is invariant regardless of the
  invocation: after the add-time init runs, the tmp `nx.json` carries the seeded
  `targetDefaults["angular-typechecker:typecheck"]`. Do NOT ship an Angular-CLI
  `ng add` surface (GEN-FUT-02 stays deferred).

### Test-file organization (GA-4)
- **D-07 (New `*.int.spec.ts` files in `install-e2e/src/`, no new nx project):**
  The scenarios fold into the existing `angular-typechecker-install-e2e` project
  (board-locked: no Verdaccio, no new e2e project). Follow the per-concern
  one-file-per-spec convention (`install-smoke` / `tarball-audit` /
  `release-hygiene`). Recommended: `generator-e2e.int.spec.ts` (GE2E-01 + GE2E-02
  in one flow) and `nx-add-e2e.int.spec.ts` (GE2E-03) -- the planner MAY combine
  GE2E-03 into the first file as a second `describe` if that reduces redundant
  build/pack cost. The `include: ['src/**/*.int.spec.ts']` glob auto-picks them up;
  the serialized single-fork config already applies.
- **D-08 (Share the packed tarball to avoid N redundant builds -- planner
  discretion):** Each existing spec file re-runs `nx build --skip-nx-cache` +
  `npm pack` in its own `beforeAll`; adding 1-2 more files multiplies that cost on
  the Linux e2e gate. Preferred: pack ONCE and reuse across the new scenarios
  (e.g. a shared `beforeAll` within one file covering GE2E-01/02/03, or a
  module-scope helper), while keeping each tmp INSTALL isolated per scenario.
  Acceptable fallback: accept the per-file fresh build for isolation parity with
  the existing specs. LOW impact -- planner's call.

### GUARD-01 -- placement, graph enumeration, ci.yml parse (GA-5)
- **D-09 (In-plugin fast test -- 6-cell matrix, not the heavy e2e gate):** The
  guard is a cheap filesystem/text check (read `.github/workflows/ci.yml`, glob
  project files) with NO build/pack/install. Place it as an in-plugin spec under
  `packages/angular-typechecker/src/` so it auto-routes into the existing 6-cell
  `test` matrix (board decision; no `ci.yml` structural change), giving the
  loudest/earliest signal on every OS x Node cell. Resolve the workspace root from
  the spec's location the way `release-hygiene.int.spec.ts` does (it already reads
  root files -- `nx.json`, `.github/workflows/*.yml` -- from a spec).
- **D-10 (Bidirectional set equality, quantifier `every`):** Assert BOTH
  directions -- every `e2e/*` graph project appears in the `e2e` job's `-p` list
  (catches a FORGOTTEN entry -> silent skip, the primary landmine) AND every `-p`
  entry is a real `e2e/*` project (catches a STALE/typo entry). Use the `every`
  predicate quantifier (ROADMAP SC4; carried CI skip-gate discipline). Today the
  set is `{angular-typechecker-install-e2e, angular-typechecker-cache-e2e,
  angular-typechecker-matrix-e2e}` and the `-p` list matches exactly -- so the
  guard codifies the current-correct state and goes RED only on drift.
- **D-11 (Enumeration source -- glob `e2e/*/project.json` recommended;
  RESEARCH-VERIFY the authoritative alternative):** Recommended: glob
  `e2e/*/project.json`, read each `.name` -> the "e2e projects" set (deterministic,
  no nx daemon, cheap, matches the strict `e2e/`-dir convention every e2e project
  follows). **RESEARCH-VERIFY:** confirm whether to instead source the AUTHORITATIVE
  nx graph (`nx show projects` / `nx graph --file` JSON, filtered to `e2e/*` by
  `root` or a `scope:fixture`-style tag) if there is any risk the `-p` list or the
  graph could reference an e2e project NOT under `e2e/` (currently none do). If the
  authoritative graph is used, keep the guard cheap/daemon-independent. Also
  RESEARCH-VERIFY the robust extraction of the `-p` args from the `e2e:` job's
  folded (`>`) `run:` scalar -- reuse the `release-hygiene` no-YAML-parser regex
  precedent (string/regex over the workflow text; NO new YAML dependency).
- **D-12 (Mandatory deliberate-RED proof for the guard):** Because a self-audit
  guard that silently false-PASSes defeats its entire purpose, the plan MUST
  include a deliberate-RED verification: transiently add a phantom `e2e/*` project
  (or drop a `-p` entry) and confirm the guard goes RED with a LOCATED message,
  then restore. (Same rigor as Phase 12's tripwire deliberate-RED proof.)

### Claude's Discretion
- **D-13 (Extend `tarball-audit` for the shipped generators -- recommended, but
  BEYOND the 4 named requirements):** Phase 14's CONTEXT flagged that "the Phase 15
  tarball-audit expected-files list will need the new generator paths." Recommended
  hardening: add `generators.json` +
  `src/generators/{configuration,init}/schema.json` +
  `src/generators/{configuration,init}/generator.js` to
  `tarball-audit.int.spec.ts`'s `REQUIRED_FILES`, and confirm the existing
  `.spec.`/`(libs|fixtures|e2e)/` leak guards do not false-positive on the new
  generator specs (they are excluded from the tarball by `tsconfig.lib`, same as
  executor specs). **CAVEAT (flag, do not silently expand scope):** this is NOT one
  of GE2E-01..03 / GUARD-01 -- the GE2E scenarios EMPIRICALLY prove the generators
  ship (you cannot `nx g angular-typechecker:configuration` from a clean install if
  `generators.json` is not packed), so the audit extension is belt-and-suspenders.
  Planner MAY include it as a small static gate or drop it to stay minimal; LOW
  impact either way.
- **D-14 (Fixture project name / component / spec specifics -- LOW impact):** Exact
  names (`consumer-generator`, the library/component/spec identifiers), the specific
  injected diagnostic codes (a TS code such as `TS2322` in the lib component; a
  distinct code in the spec -- template NG code or a second TS code), and whether
  the lib leaf uses a template-bearing component vs a plain class are the planner's
  choice, provided: two DISTINCT, individually-assertable codes (one per leaf), a
  non-empty `references[]`, and an absent targetDefaults key.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirement & goal
- `.planning/ROADMAP.md` -- "Phase 15: Generator e2e + CI self-audit guard"
  (Goal + SC1-SC4, the authoritative success criteria).
- `.planning/REQUIREMENTS.md` -- **GE2E-01, GE2E-02, GE2E-03, GUARD-01** (the full
  spec: what the fixture gains, what the generate/run scenario asserts, the nx-add
  proof, and the `-p` set-equality guard).

### Prior-phase context this phase proves end-to-end
- `.planning/phases/14-configuration-init-generators-nx-add/14-CONTEXT.md` -- the
  generator suite this phase exercises: D-04 (verbatim WALK-02 `default`-input
  block `init` seeds under the UNSCOPED id), D-05 (whole-entry `??=` don't-clobber
  -> why the fixture key must be ABSENT), D-06 (nx-add -> init wiring +
  RESEARCH-VERIFY carried into GE2E-03), D-07 (tsConfig resolution order the
  `configuration` target write follows), and the explicit note that "the Phase 15
  tarball-audit expected-files list will need the new generator paths" (D-13 above).
- `.planning/phases/13-engine-solution-tsconfig-reference-walking/13-CONTEXT.md` --
  the WALK contract GE2E-02 asserts end-to-end (union+dedupe, boundary-guard,
  coarse cache; both in-project leaves -- lib + spec -- walked).
- `.planning/phases/13.1-rename-angular-typecheck-executor-to-typecheck/13.1-CONTEXT.md`
  -- the renamed UNSCOPED published id `angular-typechecker:typecheck` the target
  and `targetDefaults` key use; the rename-discipline landmine.

### Strategy of record (WHY the shape is what it is)
- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` -- the board decisions
  this phase implements: generator e2e FOLDED into `angular-typechecker-install-e2e`
  (no Verdaccio, no new e2e project), a `-p` set-equality guard, in-plugin specs
  auto-route into the existing 6-cell `test` matrix (no `ci.yml` structural change),
  single required `ci` gate unchanged.

### Live source anchors (read before writing tests)
- `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts` -- THE harness
  template: `buildCleanEnv` (NX_* + peer-override strip), `beforeAll`
  build-`--skip-nx-cache`+`npm pack --json`, tmp-install with empty `.npmrc` +
  `npm_config_userconfig` (B-03 honesty), the `run()` execSync-catch verdict helper,
  the TS2322 full-token assertion + `ERR_REQUIRE_ESM`/`infrastructure error` guards,
  `rmSync` teardown.
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` -- the
  `REQUIRED_FILES` positive set + `.spec.`/`(libs|fixtures|e2e)/` leak guards to
  extend for the shipped generators (D-13); the Windows/BSD-safe relative-`tar`
  extraction idiom.
- `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` -- the
  precedent for reading root files (`nx.json`, `.github/workflows/*.yml`) from a
  spec and asserting YAML invariants via string/regex with NO YAML-parser
  dependency (`stripCommentLines`) -- the pattern GUARD-01's ci.yml `-p` parse
  reuses.
- `e2e/angular-typechecker-install-e2e/fixtures/consumer-app/` -- the existing flat
  fixture (project.json, nx.json, app.component.ts, tsconfig*.json). NOTE its
  `nx.json` pre-declares the targetDefaults key with `production` inputs -- the
  anti-pattern D-01/D-02 avoid for the new fixture.
- `e2e/angular-typechecker-install-e2e/vitest.config.mts` -- the serialized config
  (forks/singleFork/fileParallelism:false/node env/300000ms) the new specs inherit.
- `e2e/angular-typechecker-install-e2e/project.json` -- the `@nx/vitest:test` target
  the new specs run under.
- `.github/workflows/ci.yml` -- the `e2e:` job (lines ~125-145): the explicit
  `npx nx run-many -t test -p angular-typechecker-install-e2e
  angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` list GUARD-01 reads;
  the single required `ci` aggregate (`needs: [changes, test, e2e, fallow, ...]`).
- `packages/angular-typechecker/generators.json` -- the shipped registration
  (`configuration` + `init`, factory-keyed) GE2E invokes via `nx g`.
- `packages/angular-typechecker/src/generators/{configuration,init}/` -- the
  generators under e2e test; their `schema.json` for the `nx g` option surface.

### Execution mechanics (constraints, not scope)
- `AGENTS.md` -- "Parallel execution in git worktrees: the `node_modules` junction"
  (heavy e2e specs run SEQUENTIALLY on the MAIN tree -- D-22 -- NOT in worktrees:
  real `npm pack`/install + `nx run` are worktree-hostile) and the
  Conventional-Commits rules (a `test(...)` commit is a no-bump type; the 0.1.0 cut
  is the milestone Release PR, not this phase).
- `.planning/codebase/TESTING.md` -- the test taxonomy (unit / integration / e2e)
  and where these `*.int.spec.ts` live.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The install-e2e harness (`install-smoke` + `tarball-audit`):** `buildCleanEnv`,
  the `beforeAll` build+pack, the tmp-install-from-tarball flow, the empty-`.npmrc`
  + `npm_config_userconfig` peer-honesty guard, the execSync-catch `run()` verdict
  helper, and the full-token-assertion discipline are directly reusable for
  GE2E-01/02/03 -- copy the shape, change the operation (generate + run instead of
  smoke-run).
- **`release-hygiene`'s root-file + regex-YAML pattern** is the exact model for
  GUARD-01's `ci.yml` read (workspace-root resolution from the spec location +
  `stripCommentLines` + regex; no new YAML dependency).
- **`tarball-audit`'s `REQUIRED_FILES` + leak guards** are the extension point for
  D-13 (add the generator paths).

### Established Patterns
- **Heavy e2e specs run serialized on the MAIN tree, `node` env, 300000ms** (the
  shared `vitest.config.mts`); new `src/**/*.int.spec.ts` files are auto-included.
- **In-plugin specs run in the 6-cell `test` matrix** (all OS x Node cells) -- the
  cheap GUARD-01 fs/text check belongs there, not in the Linux-only heavy e2e gate.
- **`--skip-nx-cache` on every nested `nx run`** in the e2e (the outer runner's
  cache-defeating env is stripped by `buildCleanEnv`; the walk verdict must reflect
  fresh sources, not a warm cache) -- and NEVER pipe `nx` through `head`/`rg`.
- **The UNSCOPED published id `angular-typechecker:typecheck`** is what binds in a
  consumer install (the dev workspace-scoped `@angular-typechecker/...` key would
  NOT bind) -- assert the unscoped id in the tmp workspace.

### Integration Points
- New fixture workspace under `e2e/angular-typechecker-install-e2e/fixtures/`
  (fixture data, NOT a new nx project) -- the un-wired multi-leaf solution the
  generator wires and the engine walks.
- `.github/workflows/ci.yml` `e2e:` job `-p` list <-> the `e2e/*` project graph:
  GUARD-01 reads both and asserts set equality (no `ci.yml` structural change; the
  guard is a TEST, not a workflow edit).
- `tarball-audit.int.spec.ts` `REQUIRED_FILES` <-> the shipped `generators.json` +
  generator schema/impl (D-13, discretionary).

</code_context>

<specifics>
## Specific Ideas

- Concrete recommended new files: `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts`
  (GE2E-01+02), `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts`
  (GE2E-03), a new fixture workspace
  `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` (un-wired
  library, solution `tsconfig.json` referencing `tsconfig.lib.json` +
  `tsconfig.spec.json`, `nx.json` WITHOUT the targetDefaults key), and an in-plugin
  GUARD-01 spec under `packages/angular-typechecker/src/` (name at planner's
  discretion, e.g. `ci-e2e-coverage-guard.spec.ts`).
- Assert the seeded `targetDefaults` block equals the WALK-02 shape with the FIRST
  input `"default"` (never `"production"`) -- the load-bearing spec-leaf-hashing
  invariant.
- Prefer sharing ONE packed tarball across the GE2E scenarios (pack once, install
  per-scenario) to avoid multiplying the Linux e2e gate's build cost.

</specifics>

<deferred>
## Deferred Ideas

All already tracked in REQUIREMENTS.md "Future Requirements" / "Out of Scope" and
STATE.md "Deferred Items" -- none newly surfaced this phase:
- **FSTREE-01** -- bespoke real-disk `createFsTree`/`flushFsTreeChanges` (board
  Option A; only if a future generator emits files; this phase's tarball e2e gives
  real-disk fidelity instead).
- **GEN-FUT-01 / GEN-FUT-02** -- Angular CLI `angular.json` generator support /
  `ng add` (Angular CLI) install schematic (Nx's `nx add` IS in scope -- GE2E-03).
- **WALK-FUT-01** -- `createNodesV2` inferred granular per-leaf `typecheck` targets.
- **The 0.1.0 version cut / Release PR** -- the milestone Release PR AFTER Phase 15
  closes (per AGENTS.md Release-PR flow), NOT part of this phase.

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 15-generator-e2e-ci-self-audit-guard*
*Context gathered: 2026-07-02*
