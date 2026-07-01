# A2 -- Failure-Modes / Fragility Board Position (Round 1)

**Advisor mandate:** ADVERSARIAL -- failure modes and fragility. Attack every option for how it
breaks, rots, flakes, or silently passes: internal-import breakage on Nx upgrade, e2e
flakiness/slowness, the explicit-`-p` silent-skip in the `e2e` job, false-green gates, drift,
cross-platform divergence (Windows-arm64). I must still land a concrete recommendation per
decision, not only criticism.

**Sources read:** `FACTS.md`, `ci.yml`, the four research reports
(`SANDBOX-TECHNIQUES.md`, `CONNECT-TECHNIQUES.md`, `NX-FSTREE-INTERNALS.md`,
`CURRENT-AUDIT-AND-GENERATOR.md`), and repo source: `e2e/.../matrix-5types.int.spec.ts`,
`install-smoke.int.spec.ts`, the matrix-e2e `local-lib/project.json` (hand-wired targets),
plugin `project.json` (build assets, `typecheck-drift` target).

---

## Threat lens: what "fails" means for a type-checker's test suite

A type-checking tool has ONE catastrophic failure mode that dwarfs all others: **a false-green
gate** -- a test that passes while the checker is silently not checking. PROJECT.md states this
directly ("a type-checker that lies is worse than none"). Every decision below is scored first by
"can this rot into a false green?", then by "can this flake / break on upgrade / diverge across
OS?". Slowness matters only insofar as a slow tier gets disabled, skipped, or flaked-past --
slowness is a _second-order_ false-green risk (a tier that times out and is marked allow-fail is a
false green wearing a yellow hat).

The single highest-severity structural hazard already baked into this repo is **the `e2e` job's
explicit `-p` list** (ci.yml:141-143). It is a silent-skip generator: any new e2e project is
INVISIBLE to CI until a human edits that list by name, and nothing in the gate detects the
omission. This is the load-bearing fragility the mandate names, and it dominates D4 and D5.

---

## D1 -- Test substrate

\*\*Position: in-memory `createTreeWithEmptyWorkspace()` (option a) for ALL generator unit/integration
specs. Do NOT author `createFsTree`/`flushFsTreeChanges` (option b) in this milestone. Reserve `fs`

- `execSync` (option c) for the existing tarball e2e tier only. The generator's real-disk fidelity
  is already bought by the matrix-e2e tarball tier -- adding a real-disk `FsTree` substrate buys
  fidelity the generator does not need and pays for it with a permanent upgrade-fragility liability.\*\*

### Failure-mode attack on each option

**(b) Real-disk `FsTree` via `nx/src/generators/tree` -- the fragility magnet.** This is the
single most upgrade-fragile thing the milestone could introduce. `FsTree`/`flushChanges`/`printChanges`
are NOT in any public `@nx/devkit` barrel (NX-FSTREE-INTERNALS sec 4); they are reachable only by a
deep import `nx/src/generators/tree` with NO semver guarantee. The research itself flags it: "an Nx
upgrade can move/rename/restructure it with no semver guarantee" (sec 8). The proposed mitigation is
a _drift tripwire spec_ + an eslint-disable quarantine. Attack that mitigation:

- **The tripwire only fires on `nx test`** -- which on a planning/docs-only PR is path-skipped
  (ci.yml `changes` job). So the tripwire's protection has a hole exactly when a dependency bump PR
  also touches only lockfiles classified by `dorny/paths-filter`. (Lockfile IS code per the
  `!**/*.md` / `!.planning/**` negation, so this specific hole is narrow -- but the tripwire is only
  as good as the path filter's classification of the file that bumps Nx.)
- **A drift tripwire is itself code that rots.** It pins constructor arity (`FsTree.length === 2`)
  and a method-name list. Nx can change _behavior_ (e.g. how `flushChanges` handles a mode bit, or
  `normalize()` path semantics) while keeping arity and method names identical -- the tripwire goes
  green, the helper silently misbehaves. Arity/method-name pinning is a SHALLOW contract; it cannot
  catch a semantic regression, which is the failure that actually corrupts a real-disk generator
  test.
- **It adds a maintenance tax with no offsetting catch.** The generator under test is a pure
  `project.json` edit (CURRENT-AUDIT sec B.1): `readProjectConfiguration` -> mutate `targets` ->
  `updateProjectConfiguration` -> `formatFiles`. 100% of its observable behavior is a Tree
  transformation that the in-memory tree captures perfectly. There is NO generator behavior that
  reads its own emitted files from disk mid-run. So the real-disk substrate's entire value
  proposition ("prove the emitted config is consumable on disk") is for a behavior this generator
  does not have -- and where that proof IS wanted, the tarball e2e already provides it at higher
  fidelity (a real `nx run` against a real install).

**(a) In-memory `createTreeWithEmptyWorkspace` -- the robust default, with two real hazards to
guard.** Public, version-stable, zero quarantine. Its failure modes are documented and cheap to
defend:

- **`/virtual` leakage (nx#32588):** a generator unit test can accidentally pick up the REAL
  workspace instead of `/virtual` and false-green. Mitigation is mechanical and must be MANDATED in
  the plan: always `import 'nx/src/internal-testing-utils/mock-project-graph'` as the first
  side-effecting import, always seed via `addProjectConfiguration`, never read `process.cwd()`,
  assert against `/virtual`-rooted paths. (NX-FSTREE sec 6b; CURRENT-AUDIT B.2 pitfall 2.) Note the
  irony: the leakage-mitigation import is ITSELF a `nx/src/internal-testing-utils/*` deep import --
  so "in-memory has zero internal imports" is not strictly true, but this one is the dominant Nx
  spec idiom (452 spec files) and far lower-risk than `nx/src/generators/tree`.
- **Open-handle hangs (nx#26346):** importing `@nx/devkit` loads native bindings + a pseudo-terminal
  that can keep Vitest alive. `NX_DAEMON: false` (already set in every CI cell) is the mitigation;
  the plugin already sets `testTimeout: 30000`.

**(c) `fs` + `execSync` against a generated workspace -- correct for e2e, hostile everywhere else.**
This is the heaviest, flakiest substrate (minutes per run, Windows file-locking on teardown,
daemon-handle leaks). It belongs ONLY at the tarball tier where the question is "does the published
artifact work," and it is already in use there (matrix/install e2e). Pulling it down into generator
testing would be a self-inflicted flake source.

### Facts this rests on

- Generator is a pure config edit (CURRENT-AUDIT B.1); in-memory tree captures it fully (sec 2/289).
- `createTreeWithEmptyWorkspace` is public + byte-stable 23.0.1->23.1.0-beta.4 (NX-FSTREE sec 0).
- `FsTree` deep import is internal, no semver guarantee (NX-FSTREE sec 8).
- Real-disk fidelity already exists at the tarball tier (matrix-5types runs all 5 types).

### Facts I'm missing (orchestrator can verify)

- Whether ANY planned v0.0.4 generator behavior reads back its own on-disk output mid-run (e.g. a
  generator that scaffolds a tsconfig and then re-parses it). If yes for even one generator, that
  ONE spec may justify `createFsTree` -- but only that spec.
- Whether `formatFiles` is called by the generator (it is, per the sandbox 33-line template). If so,
  the in-memory tree must seed `.prettierrc` (createTreeWithEmptyWorkspace seeds `{ singleQuote:
true }` already -- confirm it matches repo Prettier config so format assertions don't drift).

### What would change my mind

A concrete, planned generator step that consumes its own emitted file from disk DURING generation
(not after). That is the only behavior in-memory cannot model, and it would justify `createFsTree`
**for that one spec**, with the full quarantine + drift tripwire -- never as the default substrate.

---

## D2 -- Diagnostic coverage organization

**Position: a SINGLE data-driven catalog table keyed by exact NG/TS code, asserting code +
category + count, backed by committed fixtures -- NOT one-file-per-Angular-major, and NOT
programmatic jscodeshift injection. The per-introduction-version file split is a fragility and
false-green trap for THIS repo; collapse it. The mandatory assertion is exact code + category, never
`success` boolean alone.**

### Failure-mode attack

**The boolean-only assertion is the canonical false green, and it is the prior art's documented
sin.** The sandbox catalog asserts ONLY `expect(result.success).toBe(false)` (SANDBOX sec 4: "It
does NOT assert exact diagnostic CODE or COUNT... The mapping 'this fixture produces NG8115' is
documentation, enforced only by the fact that the fixture is intentionally broken"). This is a
LANDMINE: a fixture intended to trigger NG8115 that instead trips a _different_ error (a typo in the
template, a TS syntax error, a config error) still returns `success: false` and the boolean test
passes -- while NG8115 is never actually exercised. The checker could stop emitting NG8115 entirely
and the suite stays green. For a tool whose entire value is "surface EVERY Angular diagnostic," a
boolean assertion is indistinguishable from no test. **Exact-code + category assertion is
non-negotiable** and is already the repo's idiom (`result.diagnostics.find(d => d.code ===
NG(8101))` then assert `.category`; CURRENT-AUDIT C). Add a COUNT assertion too, because a fixture
that accidentally triggers the target code TWICE (or triggers it plus an unintended sibling) is a
silent fixture-drift signal.

**One-file-per-Angular-major rots into a misleading taxonomy -- the repo already proved this.** The
third extended file was RENAMED from `extended.angular17.integration.spec.ts` to
`extended.promotion.integration.spec.ts` precisely because "its `angular17` signal was FALSE -- it
carries no v17-specific code" (CURRENT-AUDIT A.3). The version-in-filename is a lie waiting to
happen: the code a diagnostic was _introduced_ in is metadata about Angular's history, not about
what the running compiler-cli@22.0.4 emits. The repo runs ONE Angular version (22). A
`baseline.angular13` file tested against compiler-cli 22 asserts nothing about Angular 13; the "13"
is pure decoration that invites a future maintainer to believe version coverage exists that does
not. **The drop-in-file-per-major argument is weak here** because this repo is NOT multi-version
(unlike the sandbox, which named files by introduction version as a historical catalog but still
ran ONE version). A single data table `[{ code: NG(8102), name, category, fixture }]` driven by
`it.each` is: (1) impossible to mis-label by filename, (2) trivially auditable for completeness
against the 18-member `ExtendedTemplateDiagnosticName` enum (FACTS sec 4), (3) a single edit to add
a code. The completeness audit itself should be a TEST: assert the catalog table's code set EQUALS
the enum's 18 members, so a future compiler-cli that adds a 19th extended diagnostic FAILS the suite
loudly instead of silently leaving it uncovered. That enum-vs-table parity test is the structural
defense against coverage drift -- the most valuable single test in D2.

**Committed fixtures vs jscodeshift injection -- prefer committed, but with a drift guard.**

- _jscodeshift injection_ (sandbox/Connect 6a) is powerful but fragile: it depends on a specific AST
  shape of a CLI-generated component, breaks when `@nx/angular:library` changes its scaffold output
  (an Nx-upgrade fragility), needs `jscodeshift` as a dep (a new dep with its own version surface),
  and the injection helpers are 1373 lines of test infrastructure (SANDBOX sec 5) that can itself
  harbor bugs that produce the wrong diagnostic. It also requires generating real libs via
  `execSync` -- pulling the slow/flaky e2e substrate into what should be a fast integration tier.
- _Committed fixtures_ (the repo's current `fixtures/<scenario>/` approach, FACTS sec 3) are static,
  inspectable, fast (cold `performCompilation`, no `nx generate`), and cross-platform-stable. Their
  failure mode is **silent fixture rot**: a fixture edited to no longer trigger its code, or a
  compiler-cli upgrade that changes which code a fixture produces. The exact-code + category + count
  assertion IS the guard against that rot -- which is why D2's assertion granularity and fixture
  strategy are coupled.

**Severity-promotion coverage is mandatory and version-independent.** Extended diagnostics
(NG81xx) are WARNINGS by default (CONNECT 4c, SANDBOX `forceExtendedDiagnosticsAsErrors`). A test
that triggers NG8101 without `extendedDiagnostics.defaultCategory: 'error'` and asserts only
`success` would see `success: true` (warnings don't fail) -- another false green. Assert the
WARNING-default category in one pass AND the promoted-Error category in another (the repo already
does this for NG8101 via `extended.promotion.integration.spec.ts`). This warning/error contrast is
the portable mechanism test; generalize it across the catalog.

### Facts this rests on

- Boolean-only assertion is the sandbox's documented gap (SANDBOX sec 4).
- The repo already renamed a falsely-version-tagged file (CURRENT-AUDIT A.3).
- 18-member enum is verified against installed compiler-cli (FACTS sec 4); 2/16 currently asserted.
- Repo runs ONE Angular version; exact-code + category + `NG()` idiom already present.

### Facts I'm missing

- The exact NG-code for each of the 18 enum members (FACTS sec 4: "to be read during work" from the
  `ErrorCode` enum). The catalog table cannot be built until each name->code is verified against
  `error_code.d.ts` in compiler-cli@22.0.4. DIAGNOSTIC-CATALOG.md disagrees with the enum
  (lists 16 "documented", omits `controlFlowPreventingContentProjection`) -- this discrepancy MUST be
  resolved against source before the table is authoritative.
- Whether all 18 can be triggered by a minimal committed fixture under `strictTemplates` (some, e.g.
  `skipHydrationNotStatic`, need specific component setups; confirm each is reproducible).

### What would change my mind

If more than ~3 of the 18 codes CANNOT be triggered by a static committed fixture and genuinely
require programmatic AST construction (e.g. a code that only fires on a generated-output shape), then
a hybrid is justified: committed fixtures for the reproducible majority, narrow per-code programmatic
construction for the stubborn few -- but still asserted by exact code + category, never boolean, and
still indexed by the single completeness table.

---

## D3 -- Executor-against-workspace mid-tier test

**Position: do NOT add a new in-memory/real-disk "executor against a constructed
`ExecutorContext`/workspace" tier. It is the lowest-value, highest-false-green-risk addition on the
table. The path-resolution and published-id binding it would cover are ALREADY covered with higher
fidelity by the matrix-e2e tarball tier; a mid-tier reconstruction would re-assert the same thing
against a HAND-BUILT context that can drift from the real one and silently green.**

### Failure-mode attack

The mid-tier's pitch (CURRENT-AUDIT A.2/B.3 route 1) is to cover the gap between seam-mocked unit
specs and the full tarball e2e: prove `context.root` + `tsConfig` resolve to a real path, and the
executor binds under its published id. Attack each:

- **A hand-built `ExecutorContext` literal is a fiction the test author controls.** The sandbox and
  Connect both built context literals by hand (`{ root: '/workspace', projectsConfigurations: {...} }
as ExecutorContext`; SANDBOX sec 3, CONNECT 1a). The DANGER: the hand-built context can diverge
  from what Nx actually passes (missing `projectGraph`, wrong `nxJsonConfiguration`, a
  `projectsConfigurations` shape that real Nx would populate differently), and the test passes
  against the fiction while the real invocation behaves differently. That is a false green by
  construction -- the test proves the executor works against a context the test made up.
- **Published-id binding CANNOT be proven without a real install.** The executor id
  `angular-typechecker:angular-typecheck` only "binds" when Nx resolves it from an installed
  package's `executors.json`. A mid-tier in-process test using a dev path-alias proves the dev-scoped
  resolution, not the published one (install-smoke's comment D-18 makes this exact point: "proves the
  executor resolves FROM the install, not from a dev path-alias"). So the mid-tier literally cannot
  cover the binding it claims to -- only the tarball tier can. The mid-tier would give a FALSE sense
  that binding is tested.
- **Path resolution is already exercised end-to-end.** matrix-5types runs the real executor against
  5 real `tsConfig` options on real on-disk projects via the installed tarball. That is strictly
  higher fidelity than a mid-tier in-memory resolution check.

The mid-tier adds a maintenance surface and a new false-green vector to re-cover ground the e2e tier
covers truthfully. The honest gap (normalize-options against a real `project.json`) is better closed
by EXTENDING the existing pure `normalize-options.spec.ts` with table-driven option shapes than by
standing up a workspace substrate.

### Facts this rests on

- matrix-5types runs the executor against all 5 types' real tsConfigs via the installed tarball.
- Published-id binding is only real under install (install-smoke D-18 comment).
- Hand-built `ExecutorContext` literals are the prior-art pattern (SANDBOX 3, CONNECT 1a) -- and
  their divergence-from-real is the documented hazard.

### Facts I'm missing

- Whether the executor has untested branches that depend on `ExecutorContext` fields NOT reachable
  from the pure seams (e.g. logic keyed on `context.projectGraph` or `context.nxJsonConfiguration`).
  If such a branch exists AND is not covered by e2e, a narrow mid-tier spec for THAT branch only
  could be justified.

### What would change my mind

An executor code path that (a) reads a specific `ExecutorContext` field, (b) is not exercised by any
e2e row, and (c) is too expensive to reach via e2e. Then a single targeted mid-tier spec for that
path -- not a general "executor against a workspace" tier.

---

## D4 -- Generator e2e

**Position: do NOT create a new `angular-typechecker-generator-e2e` Nx project. EXTEND the existing
`angular-typechecker-install-e2e` project with one generator spec that packs+installs the tarball,
runs `npx nx g angular-typechecker:typecheck-configuration <proj>`, and asserts the resulting on-disk
`project.json` + that `nx run <proj>:angular-typecheck` then executes. A NEW e2e project is a
silent-skip landmine because of the `e2e` job's explicit `-p` list. Do NOT use Verdaccio.**

### Failure-mode attack -- this is where the `-p` list bites hardest

**A new e2e project that is not added to ci.yml's `-p` list runs LOCALLY but is INVISIBLE in CI, and
nothing detects the omission.** ci.yml:141-143 runs `nx run-many -t test -p
angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` -- an
EXPLICIT, hand-maintained project list. The audit confirms it: "a new e2e project is invisible to CI
until added there" (CURRENT-AUDIT A.4). Now compound it with the `ci` aggregate gate's logic
(ci.yml:226-237): the gate fails only on `failure`/`cancelled` and now TOLERATES `skipped`
(intentionally, for path-skips). A generator-e2e project that was never added to the list is not
"skipped" -- it simply never runs as a node in the graph, so `needs.*.result` never includes it, and
the green `ci` check is computed without ever considering it. **The author sees a green PR and a
passing required check while the generator's end-to-end behavior was never tested in CI.** This is
the textbook false green, and it is structurally invited by the new-project route.

Extending `install-e2e` sidesteps the landmine entirely: `install-e2e` is ALREADY in the `-p` list,
so a new spec file inside it runs in CI with zero ci.yml edit and zero chance of the human-omission
failure. The author cannot forget to wire something they don't have to wire.

**Verdaccio is a flake/maintenance liability with no offsetting benefit here.** The Nx-canonical
generator-e2e uses Verdaccio + `createTestProject` (FACTS sec 6; CURRENT-AUDIT B.3). Attack it:

- The scaffolded `start-local-registry.ts` uses `execFileSync(nx, ...)` which is "known to fail on
  Windows" (CURRENT-AUDIT B.3 Windows caveat) -- a cross-platform-divergence bug on the exact primary
  dev environment (Windows-arm64).
- Verdaccio is a long-running background process (spawn, health-poll, teardown) -- a new flake
  surface (port races, zombie processes, storage-dir leaks) the repo currently does NOT have.
- The repo deliberately uses direct `npm pack` + tmp install instead (proven for the executor across
  matrix-5types and install-smoke). Introducing Verdaccio would mean TWO e2e mechanisms to maintain,
  doubling the harness surface for no fidelity gain (a tarball install is already the faithful
  "published package works" check).

**A subtle false-green specific to a generator e2e: the cached green.** matrix-5types learned this
the hard way (`--skip-nx-cache` comment lines 119-130): the `angular-typecheck` target's
`production` input excludes `*.spec.ts`, so mutating a spec does NOT bust the cache, and without
`--skip-nx-cache` an injected-error run is served the CACHED green (exit 0) and false-passes. A
generator e2e that runs the generator then runs the wired target MUST pass `--skip-nx-cache` (or
strip `NX_*` env per the existing `buildCleanEnv` pattern) or the post-generate run can be served a
stale cached result and lie.

**Note on partial existing coverage:** the matrix-e2e fixtures already wire the
`angular-typecheck` target by HAND in committed `project.json` (verified: `local-lib/project.json`).
So the _target shape_ the generator must produce is already validated end-to-end. The generator e2e's
unique job is narrow: prove the GENERATOR writes that exact shape from a clean install. That narrow
job fits a single spec in `install-e2e`, not a whole new project.

### Facts this rests on

- ci.yml `e2e` uses an explicit `-p` list; new projects are invisible until hand-added (CURRENT-AUDIT
  A.4; ci.yml:141-143).
- `ci` aggregate tolerates `skipped`, fails on failure/cancelled (ci.yml:226-237) -- a never-listed
  project isn't even `skipped`.
- Verdaccio `execFileSync(nx)` fails on Windows (CURRENT-AUDIT B.3); repo uses `npm pack` + tmp.
- matrix-e2e wires targets by hand in committed project.json (verified); `--skip-nx-cache` is
  load-bearing against cached-green (matrix-5types:119-130).

### Facts I'm missing

- Whether `nx g <plugin>:<gen>` resolves correctly from a tarball install inside the existing
  `install-e2e` harness's tmp workspace (the harness was built for `nx run`, not `nx generate` --
  confirm `nx generate` against an installed plugin works there; CURRENT-AUDIT B.3 route 2 asserts it
  should but it is unproven in THIS harness).
- Whether the install-e2e consumer fixture has a project the generator can target (it has
  `consumer-app`; confirm it lacks a pre-wired `angular-typecheck` target so the generator's add is
  observable, and that re-running proves idempotency).

### What would change my mind

If `nx generate` provably cannot resolve from the tarball install inside `install-e2e` (e.g. a
generators.json packaging gap that only Verdaccio's full publish surfaces), then a dedicated
generator-e2e is forced -- but it MUST be added to the `-p` list in the SAME commit, and the plan
must include a CI assertion that the list contains every `*-e2e` project (see D5).

---

## D5 -- CI mapping

**Position: route all new in-plugin specs (generator unit + NG8xxx catalog integration) into the
existing 6-cell `test` matrix (zero ci.yml change -- they match the glob). Put the generator e2e
inside `install-e2e` (already in the `-p` list). And ADD A STRUCTURAL GUARD against the `-p`
silent-skip: a cheap workflow-lint / test assertion that the `e2e` job's `-p` list contains EVERY
Nx project tagged as an e2e project. Without that guard, the `-p` list is a permanent false-green
generator.**

### Failure-mode attack

The good news (low fragility): in-plugin specs land in the `test` matrix automatically via
`vitest.config.mts`'s include glob (CURRENT-AUDIT A.4), so the NG8xxx catalog and generator unit
specs need NO ci.yml edit and CANNOT be silently dropped -- the glob is the opposite of the explicit
`-p` list. The 6-cell matrix gives the Windows-arm64-relevant coverage (windows-latest x Node
24/26) for free; the catalog's `performCompilation` runs are pure-JS ngtsc and OS-independent, so
matrix divergence risk is low. `fail-fast: false` (ci.yml:89) means one red cell can't mask others.

The bad news (high fragility): the `e2e` job's explicit `-p` list is an UNGUARDED human-maintenance
contract. Three distinct false-green paths flow from it:

1. **New e2e project never added** (D4) -- runs locally, invisible in CI, `ci` greens without it.
2. **Existing e2e project removed from the list by a careless edit** -- the gate's "meaning" silently
   shrinks; nothing detects that `cache-e2e` stopped running.
3. **A new e2e project added to the list but its `implicitDependencies: ["angular-typechecker"]` is
   forgotten** -- the fresh tarball isn't built/packed first, so the e2e runs against a stale dist
   (matrix-e2e and install-e2e both rebuild via `--skip-nx-cache` in `beforeAll`, but a new project
   that forgets that pattern packs a stale artifact -- Pitfall 6 in install-smoke).

The repo already has `lint-workflows` (actionlint) and `act-compat` jobs -- but actionlint
type-checks expression syntax, NOT the SEMANTIC correctness of the `-p` list against the project
graph. The structural guard I recommend is cheap: a test (in the `test` matrix, so it runs
everywhere and gates) that reads `ci.yml`, extracts the `e2e` job's `-p` arguments, queries
`nx show projects` (or reads project.json `tags`) for all projects tagged `scope:fixture` /
matching `*-e2e`, and asserts SET EQUALITY. A mismatch fails loudly with the missing/extra project
named. This converts the silent-skip landmine into a loud, located failure -- exactly the
transformation the FsTree drift tripwire does for the internal import. It is the highest-leverage
single test in the whole milestone because it defends the gate's integrity itself.

**Secondary CI fragility -- the `changes` path filter and the catalog.** The catalog fixtures live
under `fixtures/` (or `packages/.../fixtures/`). Confirm a change to a fixture file is classified as
`code` (not swallowed by `!**/*.md` etc.) so a fixture edit actually triggers the `test` matrix. If a
fixture is, say, an `.html` template, it's code (not `*.md`), so it's fine -- but a fixture that is
ONLY a `.json` tsconfig under a path the filter could misclassify deserves a one-line check.

### Facts this rests on

- In-plugin specs auto-match the `test` glob, no ci.yml edit (CURRENT-AUDIT A.4).
- `e2e` `-p` list is explicit + hand-maintained; new projects invisible until added (ci.yml:141-143).
- `ci` aggregate tolerates `skipped`, can't see a never-graphed project (ci.yml:226-237).
- `lint-workflows`/`act-compat` check syntax/trigger fidelity, not `-p`-vs-graph semantics.

### Facts I'm missing

- Whether `nx show projects --type app`/tag query is stable enough to drive the set-equality guard in
  every matrix cell (it shells `nx`, which loads the daemon-off graph; confirm it's fast + reliable
  with `NX_DAEMON: false`). A lighter alternative: glob `e2e/*/project.json`, read `name`, compare to
  the parsed `-p` list -- no `nx` invocation, pure fs + parse, fully cross-platform.
- The exact include glob in `vitest.config.mts` (CURRENT-AUDIT cites
  `{src,tests}/**/*.{test,spec}...`) -- confirm catalog specs under `src/core/` match it.

### What would change my mind

If a maintainer convention or a pre-existing meta-test already enforces `-p`-list completeness, the
new guard is redundant -- drop it. Absent that, the guard stands as the milestone's most important
fragility defense.

---

## D6 -- Scope

**Position: the `typecheck-configuration` generator BELONGS in this milestone (its absence is the
named milestone scope), but the testing scope must be RANK-ORDERED by false-green-prevention value,
not by prior-art completeness. Land, in order: (1) NG8xxx exact-code catalog + the enum-vs-table
completeness test; (2) the `-p`-list set-equality CI guard; (3) generator + in-memory unit specs +
schema-parity gate; (4) generator e2e inside install-e2e. EXPLICITLY DESCOPE: bespoke `createFsTree`,
the mid-tier executor-against-workspace tier, Verdaccio, jscodeshift injection, and any Nx
cache/`dependsOn`-ordering correctness tests.**

### Failure-mode attack on over-scoping

The fragility risk in D6 is **scope-driven test-debt**: adopting the full prior-art union (sandbox's
1373-line injection toolkit + 9 version files + Verdaccio harness + real-disk FsTree wrapper) imports
that prior art's fragility surface wholesale. Each of those is a maintenance liability that can rot
into a false green or a flake (analyzed in D1-D4). CONNECT sec 1 makes the meta-point: "no single
branch had all tiers" and the prior art's value is the DIFFERENCES, not a directive to build the
union. Building the union maximizes surface area and thus maximizes the number of things that can
silently break.

The descope list is chosen by failure-mode severity:

- **`createFsTree`:** permanent internal-import upgrade fragility for fidelity the generator doesn't
  need (D1).
- **Mid-tier executor-workspace:** re-covers e2e ground against a fictional context -- a false-green
  vector (D3).
- **Verdaccio:** Windows-arm64 divergence + flake surface + a second e2e mechanism (D4).
- **jscodeshift injection:** Nx-scaffold-shape fragility + a 1373-line infra surface + a new dep
  (D2).
- **Nx cache / `dependsOn` ordering correctness:** CONNECT 5c explicitly: "very expensive to test
  end-to-end and were not attempted." The repo already has a `cache-e2e` project for the ONE cache
  invariant that matters (dep-error busts cache); a general cache-correctness tier is a flake
  generator with low marginal value.

The two MUST-LAND items (catalog completeness test + `-p` guard) are chosen because each closes a
_systemic_ false-green hole rather than adding a point test: the enum-vs-table test makes diagnostic
coverage self-auditing as compiler-cli evolves, and the `-p` guard makes the e2e gate self-auditing
as projects are added. Both convert silent drift into loud failure -- the single most valuable
property a type-checker's test suite can have.

### Facts this rests on

- Generator absence IS the named milestone scope (FACTS sec 1, sec 2).
- Prior art's value is the differences, not the union (CONNECT sec 1).
- Cache/ordering correctness deliberately not attempted in prior art (CONNECT 5c).
- 14/16 extended codes + most baseline NG codes currently unasserted (CURRENT-AUDIT A.3) -- the
  highest-value, lowest-fragility gap to close.

### Facts I'm missing

- The milestone's stated definition-of-done (does it require the generator e2e, or only generator +
  unit + catalog?). If the milestone explicitly scopes only the generator + its unit tests + the
  catalog, the generator e2e drops to optional.
- Whether buildable/publishable-lib and spec-tsconfig are required as DISTINCT generator behaviors
  (CONNECT 3b: prior art only forked app-vs-library; buildable/publishable/spec were a GAP). If the
  generator must branch on those, the schema + unit-test matrix grows -- but still in-memory, still
  table-driven.

### What would change my mind

If the milestone DoD mandates the full prior-art union (explicit requirement for real-disk generation
proof, or per-version files, or Verdaccio), then those items move from descoped to in-scope -- but I
would still insist each ships with its fragility mitigation (drift tripwire for FsTree, `-p` guard
for any new e2e project) as a hard gate, because the mandate is to minimize failure modes, not to
forbid the fragile options outright.

---

```
POSITIONS
D1: In-memory createTreeWithEmptyWorkspace for ALL generator specs; do NOT author createFsTree (internal-import upgrade fragility for fidelity the pure config-edit generator does not need); fs+execSync stays e2e-only.
D2: Single data-driven catalog table keyed by exact code, asserting code+category+count (never boolean), backed by committed fixtures, plus a MANDATORY enum-vs-table completeness test; collapse the per-Angular-major file split (false-taxonomy rot, already proven by the angular17->promotion rename).
D3: Do NOT add the mid-tier executor-against-workspace tier; a hand-built ExecutorContext is a fiction that false-greens, and published-id binding + path resolution are already covered truthfully by the matrix-e2e tarball tier.
D4: Extend the existing install-e2e project with one generator spec (pack+install, nx g, assert on-disk project.json + nx run); do NOT create a new e2e project (the explicit -p list makes it a silent-skip false green); no Verdaccio (Windows-arm64 execFileSync failure + flake surface); MUST use --skip-nx-cache against cached-green.
D5: In-plugin specs auto-route into the 6-cell test matrix (no ci.yml edit); generator e2e goes in install-e2e; ADD a set-equality guard test asserting the e2e job -p list equals all e2e projects in the graph -- the single highest-leverage fragility defense, converting the silent-skip landmine into a loud located failure.
D6: Generator IS in scope (named milestone); rank testing by false-green prevention -- land catalog+completeness-test, then -p-guard, then generator+unit+schema-parity, then generator-e2e-in-install-e2e; EXPLICITLY DESCOPE createFsTree, mid-tier, Verdaccio, jscodeshift, and cache/dependsOn-ordering correctness.
FACTS-NEEDED: each of the 18 ExtendedTemplateDiagnosticName members' exact NG ErrorCode (verify against compiler-cli@22.0.4 error_code.d.ts; resolve the DIAGNOSTIC-CATALOG 16-vs-18 discrepancy); whether any 18 codes cannot be triggered by a static committed fixture under strictTemplates; whether `nx generate <plugin>:<gen>` resolves from a tarball install inside the existing install-e2e harness; whether the install-e2e consumer fixture has a generator-targetable project lacking a pre-wired target; whether any v0.0.4 generator reads its own emitted file from disk mid-run; whether any executor branch keyed on an ExecutorContext field is unreached by e2e; the milestone DoD (does it mandate generator-e2e / real-disk proof / per-version files / buildable-publishable-spec as distinct generator branches).
WOULD-CHANGE-MIND: D1 -- a planned generator that consumes its own emitted file from disk DURING generation (justifies createFsTree for that one spec only). D2 -- more than ~3 of 18 codes irreproducible by static fixture (justifies narrow per-code programmatic construction, still exact-code asserted). D3 -- an executor path reading a specific ExecutorContext field, unreached by e2e, too costly to reach via e2e (one targeted spec only). D4 -- nx generate provably cannot resolve from a tarball install in install-e2e (forces a dedicated generator-e2e, added to -p list in the same commit). D5 -- a pre-existing meta-test already enforces -p-list completeness (guard becomes redundant). D6 -- milestone DoD mandates the full prior-art union (fragile items move in-scope, each gated on its fragility mitigation).
```
