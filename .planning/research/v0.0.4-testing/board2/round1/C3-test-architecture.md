# C3 - Test Architecture / Pyramid Economics & Maintainability

Board advisor lens: tier design, coverage-per-cost, determinism, flakiness, redundancy vs gaps,
long-term test maintainability. Positions on D1-D6 from FACTS.md sec.9. Connect prior art treated as
de-identified.

---

## Lens framing (what I optimize for)

A type-checking tool's product IS correctness, so the test suite is not overhead - it is the
deliverable's primary evidence. But the pyramid economics still bind: the most expensive tier (tarball
e2e) is slow, serialized, Linux-only in CI, and the highest-maintenance. The cheapest tier (in-memory
unit) is fast, parallel, cross-OS, and near-zero maintenance. My job is to push each class of regression
DOWN to the cheapest tier that can actually catch it, and to refuse to add a tier whose only justification
is "fidelity to prior art" rather than "catches a regression nothing cheaper can."

Three facts dominate every decision below:

1. **The current suite already has a working three-tier pyramid** (14 unit, 11 real-compiler integration,
   7 tarball-e2e across 3 e2e projects) and a build-time drift gate. The pyramid is healthy: heavy on
   cheap tiers, thin on expensive ones. (FACTS sec.3.)
2. **In-plugin specs are CI-free to add** - a new `*.spec.ts` / `*.integration.spec.ts` under
   `packages/angular-typechecker` runs in the existing 6-cell `test` matrix with no `ci.yml` change. A new
   _e2e project_ is invisible to CI until added by name to the `e2e` job's explicit `-p` list. (FACTS sec.5;
   CURRENT-AUDIT A.4.) This asymmetry is the single biggest economic lever in the whole strategy: it makes
   in-plugin coverage cheap to grow and e2e projects expensive to add.
3. **The generator under test is a pure `project.json` config-edit** - read config, mutate `targets`,
   write back, `formatFiles`. Its entire observable behavior is a Tree transformation. Nothing inside the
   generator boundary reads real disk. (CURRENT-AUDIT (2); CONNECT 2c; SANDBOX sec.1.)

---

## D1 - Test substrate

**Position: In-memory `createTreeWithEmptyWorkspace()` (option a) is the DEFAULT and the only substrate
the generator's unit/integration tier needs. Do NOT author `createFsTree`/`flushFsTreeChanges` (option b)
in this milestone. Reserve real-disk fidelity (option c, `fs`+`execSync` against a generated/installed
workspace) for the e2e tier only, where it already lives.**

Substrate-to-tier mapping I recommend:

- Generator unit/integration -> (a) in-memory `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`.
- Executor logic -> existing seam mocks (no Tree at all).
- End-to-end "does it run on disk / from the installed package" -> (c) `fs`+`execSync`, already the e2e
  harness.
- (b) real-disk `FsTree` -> NOT authored this milestone.

**Factual basis (test-architecture lens):**

- The in-memory tree "captures 100% of" the generator's observable behavior - it is a config transform,
  and `readProjectConfiguration`/`updateProjectConfiguration`/`readJson` read back the recorded changes
  directly with no flush (CURRENT-AUDIT (2); NX-FSTREE sec.9 table). Maintainability: it is public,
  version-stable (`@nx/devkit/testing`), needs no eslint-disable, no quarantine, no new project.
- (b) carries a permanent maintenance tax that buys nothing here: it is an _internal_ deep import
  (`nx/src/generators/tree`), not in any public `@nx/devkit` barrel (NX-FSTREE sec.4), so adopting it
  forces (i) an eslint-quarantine file, (ii) an eslint-disable, AND (iii) a build-time drift tripwire to
  catch the next Nx upgrade silently moving the symbol (NX-FSTREE sec.8). That is three durable
  liabilities to gain real-disk semantics the generator does not exercise.
- Determinism/parallelism: the in-memory tree is fully isolated per `createTree*` call and does real _no_
  I/O - it parallelizes safely across the 6-cell matrix with zero flake surface. A real-disk `FsTree`
  needs `mkdtemp` + `rmSync` teardown (a `try/finally` cleanup hazard) and real I/O on every test
  (NX-FSTREE sec.9). On Windows arm64 - the primary dev env - real-disk + daemon file handles are the
  exact source of the flakes the existing e2e harness already fights (`NX_DAEMON:false`, singleFork, long
  timeouts; CONNECT sec.7 "Always... stop the Nx daemon... before deleting the temp workspace (Windows
  file-locking)").
- Prior art does NOT contradict this: the sandbox's committed generator spec uses in-memory
  `createTreeWithEmptyWorkspace`, and its `FsTree`/`flushChanges` proposal was _never committed_
  (SANDBOX sec.2, sec.9 item 5). Connect used in-memory for the generator and reserved `FsTree` for the
  _executor_ e2e where a real `ngc` must observe edits (CONNECT 2c). Both prior arts already place the
  substrate boundary exactly where I do.
- Across the whole Nx monorepo, 452 generator specs use in-memory `createTreeWithEmptyWorkspace`; exactly
  ONE spec (`tree.spec.ts`, the test OF `FsTree` itself) uses real-disk + flush (FACTS sec.6;
  NX-FSTREE sec.6). The canonical generator-testing substrate is in-memory by a 452:1 margin.

**Facts I'm missing (orchestrator can verify):**

- Whether the planned generator will EVER scaffold a `tsconfig` file (call `generateFiles`) rather than
  only edit `project.json`. FACTS sec.7a says the sandbox generator writes no files; FACTS sec.2 says
  "add/update the target." If it stays a pure target-edit, (b) is decisively unjustified.
- Whether any generator test needs to assert behavior of a _real_ type-check over the _generated_ config
  (not just the config's shape). If yes, that assertion belongs at the e2e tier (option c), not a
  real-disk unit `FsTree`.

**Fact that would change my position:** Evidence that the v0.0.4 generator must emit a real on-disk file
that a subsequent step _inside the same generator/test boundary_ reads back (e.g. it generates a tsconfig
then immediately runs a compiler pass over it in the same spec). That is the one shape the in-memory tree
cannot model (NX-FSTREE sec.9: "tools that statSync/read the real FS see nothing"), and it would justify
authoring the quarantined `createFsTree` for that tier only.

---

## D2 - Diagnostic coverage organization

**Position: One data-driven table per Angular-introduction-version FILE
(`extended.angularNN.integration.spec.ts` / `baseline.angularNN.integration.spec.ts`), each file holding a
`describe`+`it.each` (or per-`it`) row per code introduced in that major; committed fixtures (NOT
programmatic injection) as the substrate; assert by EXACT `code` + `.category`, plus a count invariant
on promotion, with severity-promotion driven by `extendedDiagnostics.defaultCategory: "error"`.**

This is "per-version file" as the outer organization and "data-driven table" as the inner organization -
they are complementary, not exclusive. It extends the convention the repo _already started_ (v13 files
exist; CURRENT-AUDIT A.3) rather than inventing a new structure.

**Factual basis (maintainability + coverage-per-cost):**

- The version-split is already a committed convention with an explicit prescription
  (`DIAGNOSTIC-CATALOG.md`: "Mirror the sandbox's per-introduction-version split so adding a future
  Angular major's diagnostics is a drop-in file"; CURRENT-AUDIT A.3). Adding a future major is then a new
  file, not a surgical edit to a monolith - the lowest-churn extension shape, and it isolates merge
  conflicts per major. The sandbox proves this scales (9 version files, thin drop-ins; SANDBOX sec.4).
- The repo _deliberately renamed_ `extended.angular17` -> `extended.promotion` because the version signal
  was false (CURRENT-AUDIT A.3). Lesson: the version in the filename must be load-bearing (the major a
  code was INTRODUCED in), not decorative. A data-driven table keyed by `{ code, name, fixture,
defaultCategory }` makes the version grouping honest and removes per-`it` boilerplate.
- Committed fixtures beat programmatic injection HERE for determinism and maintenance. The repo already
  runs real `performCompilation` against committed `fixtures/<scenario>/` resolving via
  `fileURLToPath(import.meta.url)` (FACTS sec.3). The sandbox's jscodeshift AST-injection toolkit is 1,373
  LOC of `test-fixtures.ts` plus a lock/ready-flag/reference-count lifecycle (SANDBOX sec.5) - a large,
  fragile, version-sensitive surface (jscodeshift `withParser('tsx')`, `@Component.imports` array edits).
  Connect's own test plan DEPRECATED static-on-disk fixtures in favor of inline temp-dir generation, but
  that was because Connect's executor unit spec mocked the compiler entirely so the fixtures went unused
  (CONNECT 6b) - not applicable here, where the integration tier runs the real compiler against committed
  fixtures by design. For a catalog that asserts EXACT codes, a committed fixture is a stable, reviewable,
  greppable artifact; an AST injector is code that can drift with each Angular template-syntax change.
- Assert-by-exact-code+category is already the repo's idiom and matches Angular's own compiler-cli tests
  (`result.diagnostics.find(d => d.code === NG(8101))` then `expect(...category).toBe(Warning)`;
  CURRENT-AUDIT Part C). The current GAP is coverage, not technique: 2 of 16 documented extended codes are
  asserted; 14 are missing, plus several baseline NG codes (CURRENT-AUDIT A.3). This is the single largest
  correctness gap and lives entirely in the cheap in-plugin tier (CI-free to add; lever sec.2).
- The promotion mechanism (`forceExtendedDiagnosticsAsErrors` via `strictTemplates` +
  `extendedDiagnostics.defaultCategory: 'error'`; SANDBOX sec.5) is essential because most NG81xx are
  warnings by default - and is the version-independent, portable test that complements the per-code
  fixtures (CONNECT 4b; CURRENT-AUDIT Part C). The count-invariant on promotion is already proven for
  NG8101 (`extended.promotion.integration.spec.ts`, D-01 count invariant; CURRENT-AUDIT A.1).

**Facts I'm missing:**

- The exact `ErrorCode` enum -> NG-number mapping for all 18 `ExtendedTemplateDiagnosticName` members in
  the _installed_ `@angular/compiler-cli@22.0.4` (FACTS sec.4 says read during work; the catalog labels
  some "undocumented" and omits `controlFlowPreventingContentProjection`). The fixture-per-code table can
  only be finalized after that read.
- Whether all 18 are reproducible by a minimal committed fixture under Angular 22 (some may require
  specific template constructs that are awkward to trigger in isolation; SANDBOX sec.4 documented 6 codes
  it could not assert).

**Fact that would change my position:** If a material fraction of the 18 codes turn out to be _infeasible_
to trigger with a static committed fixture under Angular 22 (e.g. they need cross-file or build-graph
context), I would shift those specific codes to programmatic injection (a small, scoped injector per
hard-to-trigger code), keeping committed fixtures as the default for the rest. I would NOT flip the whole
catalog to AST injection.

---

## D3 - Executor-against-workspace test (the mid-tier)

**Position: Add a SMALL, in-memory mid-tier spec that runs the executor against a constructed
`ExecutorContext` + a `createTreeWithEmptyWorkspace`-seeded project, asserting only the two things the
current pyramid jumps over: (1) `context.root` + `tsConfig`-option -> real on-disk path resolution and
(2) `normalizeOptions` against a real `project.json` target. Keep it ONE spec; do not duplicate compiler
or filtering coverage already proven elsewhere.**

This is a genuine pyramid GAP, not gold-plating - but it must be bounded tightly to avoid becoming a
redundant third copy of integration coverage.

**Factual basis:**

- The current pyramid jumps from seam-mocked unit (`executor.spec.ts` mocks `runTypecheck`,
  `renderReport`, `evaluateResult`, `normalizeOptions` + the devkit logger; FACTS sec.3, CURRENT-AUDIT
  A.2) straight to full tarball e2e, "with nothing in between." Path resolution
  (`context.root` -> tsConfig) and binding under the published id are covered ONLY at the e2e tier today;
  `normalizeOptions` only via the pure unit spec (CURRENT-AUDIT A.2). So a real regression in
  context->path resolution is currently caught only by the slowest, Linux-only tier - bad economics.
- The mid-tier substrate reuses D1's in-memory tree (CURRENT-AUDIT A.2: "the natural home for the FsTree
  substrate decision... the executor could reuse it"). No new substrate, no new CI wiring (in-plugin spec;
  lever sec.2).
- Prior art supports a bounded mid-tier: Connect's `runExecutorInWorkspace` ran the executor in-process
  via devkit's `runExecutor` returning `{ success }` for pass/fail (CONNECT 4b), and the sandbox's
  integration harness drives the real executor via `runExecutor` from a live project graph (SANDBOX sec.5).
  The cheap, in-memory variant of that is exactly the mid-tier.

**Redundancy guardrail (lens-critical):** This spec must NOT re-assert diagnostic codes/counts (that is D2's
integration tier) nor success/failure exit logic across diagnostic phases (that is the existing pure
`gather-diagnostics`/`evaluate-result`/`exit-codes` specs). Its ONLY value is the context->path->options
plumbing. If it grows beyond that it becomes a redundant integration copy and should be cut.

**Facts I'm missing:**

- Whether `runExecutor` (in-process) can resolve the executor against an in-memory tree WITHOUT an
  installed/built package - i.e. whether the seam can be exercised without the tarball. Connect/sandbox
  used a real project graph; if in-process `runExecutor` requires real registration, the cheap mid-tier may
  not be reachable and the value collapses back into the e2e tier.
- Whether the executor reads anything off the Tree at all, or only off `context` + the `fs` directly. If it
  only reads `context.root` + `fs`, a hand-built `ExecutorContext` literal (as the existing `executor.spec`
  and both prior arts do) plus a temp-dir tsconfig may be simpler than a seeded Tree.

**Fact that would change my position:** If in-process `runExecutor` cannot resolve the executor without the
built/installed package (so the mid-tier would require the same tarball bootstrap as e2e), I would DROP the
mid-tier and instead add the cheapest possible assertion of context->path resolution as a pure unit test
against an exported path-resolution function - pushing the coverage even further down the pyramid rather
than creating a costly middle tier with no economic advantage.

---

## D4 - Generator e2e

**Position: Test the generator end-to-end by EXTENDING the existing `npm pack` + tmp-install tarball
harness (specifically the `install-e2e` project), NOT by adding a new e2e project and NOT by introducing
Verdaccio. Keep it to ONE thin smoke scenario: install the tarball, `nx g
angular-typechecker:typecheck-configuration <proj>`, assert the on-disk `project.json` target, then
`nx run <proj>:angular-typecheck` exits as expected.**

**Factual basis (coverage-per-cost + maintainability):**

- Adding a NEW e2e project costs a `ci.yml` edit (the `e2e` job's explicit `-p` list; FACTS sec.5,
  CURRENT-AUDIT A.4) plus a new `project.json` with `implicitDependencies: ["angular-typechecker"]` plus a
  cloned-verbatim serialized vitest config (the matrix-e2e config is "cloned VERBATIM from the install-e2e
  analog - only name + cacheDir differ"; confirmed in `e2e/angular-typechecker-matrix-e2e/vitest.config.mts`).
  Extending the _existing_ `install-e2e` project adds a spec file with ZERO ci.yml change and reuses the
  proven `buildCleanEnv`/nested-nx env-strip/empty-`.npmrc` harness (CURRENT-AUDIT B.3 route 2). Fewer
  serialized e2e projects = less wall-clock on the slowest gate and one fewer harness to maintain.
- Verdaccio is the Nx-canonical route but the repo DELIBERATELY does not use it - it uses direct
  `npm pack` + tmp install (CURRENT-AUDIT B.3). Introducing Verdaccio would add a second e2e mechanism, a
  global-setup registry lifecycle, and a known Windows `execFileSync(nx)` failure
  (CURRENT-AUDIT B.3 Windows caveat; SANDBOX sec.6). Keeping ONE e2e mechanism is the maintainability win.
- The generator e2e is the one tier where real-disk fidelity is genuinely required (a real `nx g` must
  write a real `project.json`, and a real `nx run` must consume it) - which is exactly why D1 keeps the
  unit tier in-memory: the on-disk proof lives here, not in a real-disk unit `FsTree` (CURRENT-AUDIT (2)
  "Real-disk fidelity, where actually needed, is better bought at the e2e tier"). This e2e is also where
  the per-project-type wiring (app/local-lib/buildable-lib/publishable-lib) can be exercised, since
  `matrix-e2e` already commits a 4-project consumer workspace (confirmed
  `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/...`).
- Prior art keeps this tier THIN: Connect's tarball tier was "kept SMALL" (minutes-long bootstrap;
  CONNECT sec.7), and the sandbox's e2e is 3 `it`s (SANDBOX sec.6). A single generator smoke scenario fits.

**Facts I'm missing:**

- Whether dogfooding the generator inside the EXISTING matrix-e2e fixture setup (generate the target via
  the plugin's own generator, as the sandbox does in `createAngularLibraryFixture`; SANDBOX sec.9 item 3)
  would let the generator e2e ride entirely on matrix-e2e with no new spec at all - folding D4 into an
  existing run. Need to confirm whether matrix-e2e currently wires targets via committed `project.json` or
  could call the generator.
- Whether the generator should be exercised per project type at e2e (4 types) or once (one smoke). The
  per-type SHAPE differences (app gets explicit tsConfig; lib defaults) are cheaply covered at the
  generator UNIT tier via `describe.each` (CONNECT 2b); e2e should prove "it runs from the package," not
  re-prove every shape.

**Fact that would change my position:** If the generator's per-project-type target SHAPE branches in a way
that depends on real Nx project-graph inference (project type detected from the installed workspace, not
from in-memory config), the unit-tier `describe.each` could not fully cover the branching and I would
expand the generator e2e to run across the matrix-e2e's 4 committed project types rather than a single
smoke. Conversely, if matrix-e2e can dogfood the generator directly, I would fold D4 into matrix-e2e and
add no new generator-e2e spec.

---

## D5 - CI mapping

**Position: Route ALL new generator + catalog + mid-tier specs into the EXISTING 6-cell `test` matrix as
in-plugin `*.spec.ts` / `*.integration.spec.ts` (zero `ci.yml` change). Add the generator e2e to the
EXISTING `install-e2e` project so it rides the current `e2e` job's `-p` list (zero `ci.yml` change).
Avoid creating any new e2e project; if one is unavoidable, the ONLY `ci.yml` edit is adding it by name to
the `e2e` job's `-p` list. The single required `ci` aggregate check needs no change.**

**Factual basis (the asymmetry is the strategy):**

- In-plugin specs land automatically in the `test` matrix the moment they match the include glob
  (`{src,tests}/**/*.{test,spec}.{js,mjs,cjs,...}`); no ci.yml edit (FACTS sec.5; CURRENT-AUDIT A.4;
  confirmed `vitest.config.mts` include). The catalog (D2), generator unit (D1), and mid-tier (D3) are all
  in-plugin -> all free to add to CI. This is why the strategy pushes coverage into in-plugin tiers.
- A new e2e PROJECT runs only if added by name to the `e2e` job's explicit `-p` list - the list is
  intentional ("consistent gate meaning," RD-03) so a new project is invisible until listed
  (FACTS sec.5; CURRENT-AUDIT A.4). Extending `install-e2e` avoids that edit entirely.
- The catalog specs run real `performCompilation` on all 6 cells (3 Node x Linux, 2 Node x Windows, 1
  macOS). The vitest config already raised `testTimeout`/`hookTimeout` to 30000 specifically because a cold
  `performCompilation` exceeds the 5000ms default and produced a rotating timeout flake on Windows arm64
  (confirmed `vitest.config.mts` comment lines 15-24). Adding ~14 more cold-compile specs MULTIPLIES that
  cost across 6 cells - a real coverage-per-cost concern (see D5 facts-missing). The 30000ms patience
  protects determinism but does not bound total wall-clock.
- The `ci` aggregate already tolerates intentional `skipped` (planning-only PRs) and fails on
  `failure`/`cancelled` via `contains(needs.*.result, ...)` which correctly aggregates every matrix cell
  (FACTS sec.5; ci.yml lines 226-238). New in-plugin specs inherit this gate unchanged.
- The drift gate is folded into the `test` run-many (`typecheck-drift test`); if D1's fallback (b) were
  ever taken, its new drift file's path goes into the `typecheck-drift` target `inputs` and rides the same
  run-many (CURRENT-AUDIT A.4). With the in-memory default, no new drift gate is needed.

**Facts I'm missing:**

- Current wall-clock of the `test` matrix's slowest cell (Windows arm64 / macOS) and the cold-compile cost
  per integration spec. If adding 14+ catalog specs pushes the slowest cell past a tolerable budget, the
  catalog may need a shared build-once fixture lifecycle (SANDBOX sec.5 lock/ready-flag/reference-count) or
  a single multi-`it` file rather than 14 cold `performCompilation` runs. This is a determinism-vs-runtime
  tradeoff I can only resolve with timing data.
- Whether the e2e job's wall-clock has headroom for one more generator scenario inside `install-e2e`
  (serialized, singleFork, 300000ms timeout per `e2e/.../vitest.config.mts`).

**Fact that would change my position:** If the catalog's per-code cold-compile runs blow the `test` matrix
budget, I would consolidate the catalog into fewer spec files that share ONE warm compiler/program setup
per fixture-group (amortizing the cold `performCompilation`), trading the clean one-file-per-version
organization (D2) for matrix wall-clock - i.e. D5 runtime data can force a D2 organization change.

---

## D6 - Scope

**Position: YES - the `typecheck-configuration` generator belongs in this milestone; it is the milestone's
named scope (FACTS sec.1) and it UNBLOCKS the testing work rather than competing with it. Scope the
testing work as: (1) close the NG8xxx/baseline catalog gap (highest correctness value, cheapest tier),
(2) the generator + its in-memory unit tests + schema-parity gate, (3) ONE thin generator e2e on the
existing harness, (4) the bounded executor mid-tier spec. EXCLUDE bespoke FsTree utilities, Verdaccio, Nx
cache/`dependsOn`-ordering correctness tests, and any `quiet`/warnings-as-errors mode work not already in
the executor.**

Priority order by coverage-per-cost (highest value per unit of cost first): (1) catalog gap, (2) generator

- unit tests, (3) generator e2e, (4) mid-tier. The catalog gap is FIRST because it is the largest standing
  correctness hole (14 of 16 extended codes unasserted; CURRENT-AUDIT A.3), lives in the cheapest CI-free
  tier, and directly serves the product's core value (complete diagnostic coverage).

**Factual basis:**

- The generator is the milestone's named deliverable (FACTS sec.1) and is a small, well-understood, low-risk
  artifact - the sandbox's is 33 lines (FACTS sec.7a; SANDBOX sec.1). It is the _consumer_ that justifies
  writing the generator tests at all, so generator + tests are one coherent unit, not separable scope.
- The generator + tests reuse existing patterns wholesale: in-memory tree (D1), schema-parity gate
  (extend the existing `schema-parity.spec.ts`; CURRENT-AUDIT A.1/(3)), `generators.json` + build-asset glob
  mirroring the existing `executors.json` block (CURRENT-AUDIT B.1). Low marginal cost.
- Things to EXCLUDE are explicitly flagged by prior art as un-covered/expensive with no prior art to lean
  on: buildable-vs-publishable-lib as distinct generator branches were NOT validated in any Connect branch
  (CONNECT 3b "treat as a GAP to design, not inherit"); Nx cache hit/miss and `dependsOn` ordering "are
  very expensive to test end-to-end and were not attempted" (CONNECT 5c); `quiet` x warnings-as-errors
  interaction is "UNTESTED prior art" (CONNECT 4c). Pulling any of these in would blow scope on the
  most expensive, lowest-prior-art surfaces. (Note: per-project-type _coverage_ is already partly bought
  by the committed `matrix-e2e` 4-project consumer workspace, so it need not be re-litigated as new generator
  scope.)
- Versioning makes the scope cheap to ship incrementally: `feat` and `test`/`ci`/`chore` are
  patch-or-no-bump pre-1.0 (FACTS sec.8), so the catalog (test-only) and the generator (feat) can land in
  separate PRs without version churn pressure.

**Facts I'm missing:**

- Whether the milestone has a hard date/size budget that forces choosing between the catalog gap and the
  generator. If forced, I would ship the catalog gap first (larger correctness value, cheaper) and the
  generator second - but FACTS sec.1 names the generator as scope, so I assume both are in.
- Whether downstream milestones depend on the generator's target SHAPE (app vs lib tsConfig default;
  CONNECT 2a asymmetry). If a later milestone freezes that contract, the generator's shape decision is
  HIGH-IMPACT and should be deliberately settled now, not auto-defaulted.

**Fact that would change my position:** If the generator's design turns out to require real project-type
inference, cache-output config, or a mode interaction (i.e. it is NOT a 33-line pure config-edit), its
testing cost rises sharply (per-type e2e, cache correctness) and I would split it OUT of this milestone,
ship the catalog gap + schema/parity hardening alone here, and give the generator its own milestone with
the FsTree/mode/cache decisions properly scoped.

---

## Cross-decision coherence note

D1 (in-memory default), D3 (in-memory mid-tier), D4 (real-disk only at e2e), and D5 (in-plugin specs are
CI-free; e2e projects are not) reinforce each other: real-disk fidelity is bought exactly once, at the
e2e tier, on the existing harness; everything cheaper stays in-memory and in-plugin where it is free to
add and deterministic to run. The single biggest risk to the whole plan is NOT a substrate choice - it is
the catalog's cold-compile cost across the 6-cell matrix (D5 facts-missing), which is the one place
runtime data could force a reorganization.

---

```
POSITIONS
D1: In-memory createTreeWithEmptyWorkspace is the default; do NOT author bespoke FsTree; real-disk only at e2e.
D2: Per-introduction-version files with data-driven tables, committed fixtures, assert exact code+category+promotion-count.
D3: Add ONE bounded in-memory mid-tier executor-vs-workspace spec covering only context->path and normalizeOptions plumbing.
D4: Extend the existing npm-pack install-e2e harness with ONE thin generator smoke; no new e2e project, no Verdaccio.
D5: All new generator/catalog/mid-tier specs ride the existing test matrix (no ci.yml change); generator e2e rides install-e2e.
D6: Generator IS in scope; order work catalog-gap > generator+unit > generator-e2e > mid-tier; exclude FsTree/Verdaccio/cache-ordering/mode tests.
FACTS-NEEDED: per-spec cold performCompilation cost and slowest test-matrix cell wall-clock; whether in-process runExecutor resolves the executor without an installed/built package; whether the generator only edits project.json or also generateFiles; whether all 18 ExtendedTemplateDiagnosticName codes are reproducible by minimal committed fixtures under Angular 22; whether matrix-e2e can dogfood the generator; whether generator target shape needs real project-graph inference.
WOULD-CHANGE-MIND: D1: generator must emit an on-disk file a later in-boundary step reads back -> author quarantined createFsTree for that tier only. D2: many of the 18 codes infeasible to trigger via static fixture -> programmatic injection for those specific codes only. D3: in-process runExecutor needs the built/installed package -> drop the mid-tier, push context->path coverage into a pure unit test. D4: per-type shape needs real project-graph inference (or matrix-e2e can dogfood the generator) -> run generator e2e across matrix-e2e's 4 types / fold D4 into matrix-e2e. D5: catalog cold-compiles blow the matrix budget -> consolidate catalog into fewer files sharing a warm program per fixture-group. D6: generator is NOT a simple config-edit (needs type inference/cache/mode) -> split the generator into its own milestone, ship catalog gap alone here.
```
