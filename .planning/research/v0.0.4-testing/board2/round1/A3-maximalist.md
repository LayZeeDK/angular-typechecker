# A3 -- Maximalist (completeness / anti-under-testing)

Board role: ADVERSARIAL advocate for MAXIMAL diagnostic coverage, real-execution
fidelity, and defense-in-depth redundancy across tiers. Mandate: attack
under-testing. The product IS correctness, so a "minimal" strategy that leaves
diagnostic holes is shipping a type-checker that silently fails to catch types.

This is an adversarial position by design. It is deliberately weighted toward
completeness; the orchestrator should read it against the minimalist position and
the cost facts, not adopt it whole.

---

## Framing: why maximalism is the correct default for THIS tool

Three facts make under-testing uniquely dangerous here, and they are the spine of
every position below.

1. **The entire value proposition is "the COMPLETE Angular type-check"**
   (PROJECT.md core value; CLAUDE.md: "TypeScript + template type-check + extended
   diagnostics"). A regression that drops a single NG8xxx code is not a cosmetic
   bug -- it is the tool silently returning a false PASS on code that Angular's own
   compiler would flag. For a tool sold to AI agents and CI as the trustworthy
   static gate, a false PASS is the worst possible failure mode: it is invisible,
   it propagates, and it destroys the only thing the tool offers.

2. **The cost of maximal diagnostic coverage is already paid down to near-zero by
   the existing architecture.** `runTypecheck` returns the full
   `diagnostics: readonly ts.Diagnostic[]` array (run-typecheck.ts:42), and the
   committed idiom `result.diagnostics.find(d => d.code === NG(8101))` +
   `.category` assertion (extended.angular13.integration.spec.ts:36-44) is the
   exact, working assertion shape Angular's own compiler-cli uses. There is NO new
   seam to build, NO executor refactor, NO logger-capture machinery. The minimalist
   "it's too expensive" argument is largely a phantom: the marginal cost of one more
   NG-code assertion is one fixture dir + one `it`. The expensive infrastructure
   (real `performCompilation`, fixture loading, the `NG()` helper, sort/dedup,
   category counting) is BUILT AND PAID FOR.

3. **There is verified, named prior art for exactly the gap that exists.** The
   sandbox demonstrates the per-introduction-version file organization and an
   injection toolkit covering v13-v21; Connect demonstrates per-getter phase
   coverage and per-project-type wiring; Angular's own compiler-cli demonstrates the
   centralized-integration + exact-code-+-category assertion idiom. The audit
   (CURRENT-AUDIT-AND-GENERATOR.md A.3) proves the current repo asserts only **2 of
   16** documented extended diagnostics by exact code, and **14 are MISSING**.
   "Under-tested" here is not a hypothetical -- it is a measured 12.5%-covered
   surface on the product's headline feature.

The minimalist will argue YAGNI and maintenance burden. The rebuttal is that the
"you aren't gonna need it" calculus inverts when (a) the need is the product's
definition, (b) the implementation cost is already sunk, and (c) the failure mode is
silent. None of those hold for ordinary feature code; all three hold here.

---

## D1 -- Test substrate

### Position

Use ALL THREE substrates, each at the tier where it catches a distinct regression
class -- this is defense-in-depth, not redundancy-for-its-own-sake:

- **(a) in-memory `createTreeWithEmptyWorkspace`** -- the DEFAULT for the
  generator's pure config-transformation unit tests (fast, public, version-stable,
  exhaustive via `describe.each` across every project type).
- **(b) real-disk `FsTree` via `createFsTree`/`flushFsTreeChanges`** -- AUTHOR these
  helpers (resolving the v0.0.1 documentation-drift in code, not prose) and use them
  for at least ONE generator test that flushes the emitted config to disk and then
  runs the REAL Angular type-check against it. For a type-checking tool, "the
  generated target config actually produces a runnable, correct type-check on disk"
  is a correctness claim the in-memory tree CANNOT make.
- **(c) `fs` + `execSync` against a generated/installed workspace** -- the existing
  tarball e2e mechanism, extended to the generator (D4).

Author `createFsTree`/`flushFsTreeChanges` now. NX-FSTREE-INTERNALS.md sections 7-8
already give the exact, verified implementation (sketched against `nx@23.0.1`), the
quarantine (one file + eslint-disable), AND the drift tripwire (modeled on the
existing `typecheck-drift` gate). The infrastructure to do this SAFELY is fully
specified.

### Factual basis

- In-memory tree captures 100% of a pure config-edit generator
  (CURRENT-AUDIT-AND-GENERATOR.md (2) reasoning; 452 Nx generator specs use it).
- `FsTree`/`flushChanges` are reachable, verified present at `nx@23.0.1`, and
  byte-identical 23.0.1 -> 23.1.0-beta.4 (NX-FSTREE-INTERNALS.md sections 0, 4, 8).
- The quarantine + drift tripwire pattern is already proven in this repo
  (`typecheck-drift` target, project.json) -- the maintenance cost is a known,
  bounded, ONE-file cost, not an open-ended liability.
- Connect used `FsTree` for the executor e2e precisely so a real compiler run could
  observe Tree edits (CONNECT-TECHNIQUES.md 2c) -- named prior art that real-disk
  fidelity is the right tool when a compiler must see the output.

### Facts the orchestrator can verify

- Whether the generator's intended behavior stays a pure `project.json` edit, or
  whether milestone scope adds `generateFiles` (a `tsconfig.typecheck.json` template,
  per-project-type tsconfig emission). If it emits FILES, the real-disk "is the
  emitted file consumable" proof becomes load-bearing, not optional.
- Whether `createFsTree` is reused by the D3 mid-tier executor-against-workspace
  test (it should be -- one helper, two consumers).

### What would change my position

If the generator is GUARANTEED (locked in scope) to never emit files and only ever
edit `project.json` targets, AND the D4 tarball e2e is committed to run the generated
target end-to-end, then the real-disk `FsTree` tier's UNIQUE catch (compiler reads
flushed output) is fully covered at the e2e tier, and I would downgrade (b) from
"author now" to "author the helper but gate its single use on the file-emission
question." I would still author the helper, because deferring it perpetuates the
documentation-drift and leaves the mid-tier (D3) without a real-disk option.

---

## D2 -- Diagnostic coverage

### Position

MAXIMAL coverage is mandatory and cheap. Specifically:

1. **Assert ALL 18 `ExtendedTemplateDiagnosticName` members by exact code +
   category**, not the 16 "documented" subset and not the current 2. The enum has 18
   members verified against the installed compiler-cli (FACTS.md section 4); the
   catalog's "16 documented" framing is a documentation artifact, not a coverage
   boundary. `controlFlowPreventingContentProjection` and the second "undocumented"
   code are real, `@publicApi`, shippable diagnostics -- a consumer's template can
   trigger them, so the tool must be PROVEN to surface them. Under-testing the two
   "undocumented" codes is exactly the silent-hole failure mode.
2. **Assert ALL baseline TS/NG codes the catalog enumerates** (NG2003, NG2005,
   NG2007, NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004 + the TS set). The
   audit shows only NG8001 and NG3004 are real-compiler-asserted on the NG baseline
   side -- the rest are either literal-data-only or absent. Baseline NG codes are the
   bread-and-butter diagnostics; leaving them to a boolean or to no assertion at all
   is the largest blind spot after the extended set.
3. **Assert on FOUR axes per code, not one**: exact `code`, `category`
   (Warning-by-default vs Error), `count` (the D-01 invariant
   `errorCount + warningCount <= diagnostics.length`), AND the
   severity-PROMOTION behavior via `extendedDiagnostics.defaultCategory: "error"`.
   The promotion axis is the version-independent mechanism test and is the one most
   likely to silently break on an Angular upgrade -- it is already proven for NG8101
   (extended.promotion.integration.spec.ts) and that pattern generalizes to every
   code at near-zero cost.
4. **Produce error conditions with COMMITTED fixtures** (the repo's established
   substrate -- `fixtures/extended-v13/`, etc.), organized as per-introduction-version
   files (`extended.angularNN.integration.spec.ts` / `baseline.angularNN...`), one
   `it` per code, so a future Angular major is a drop-in file. This is the catalog's
   own prescription (DIAGNOSTIC-CATALOG.md:60), the sandbox's proven organization,
   AND Angular's own two-layer split.

Committed fixtures over programmatic injection: the repo already commits fixtures and
runs the REAL `performCompilation` against real tsconfigs. Committed fixtures are
deterministic, reviewable in diff, debuggable, and platform-independent -- they avoid
the sandbox's entire `jscodeshift` + lock + reference-count + `NX_DAEMON` apparatus
(1373 LOC of fixture toolkit) and the Windows-arm64 generation hazards. Programmatic
injection buys nothing here because the repo does not generate workspaces at test
time for the integration tier; it loads committed tsconfigs.

### Factual basis

- `runTypecheck` returns the full `diagnostics` array; the exact-code +
  `.category` assertion is committed and working (run-typecheck.ts:42;
  extended.angular13.integration.spec.ts). Marginal cost per code = one fixture +
  one `it`. This is the single most important fact: **maximal coverage is already
  affordable.**
- Audit measures 2/16 extended asserted, 14 missing
  (CURRENT-AUDIT-AND-GENERATOR.md A.3). The gap is real and quantified.
- Promotion test exists for NG8101 and is generalizable
  (extended.promotion.integration.spec.ts; CONNECT-TECHNIQUES.md 4b "case 3 is the
  load-bearing one").
- The sandbox's coarse `success === false`-only assertion is documented as the gap
  this milestone closes (SANDBOX-TECHNIQUES.md section 4 caveat). Carrying forward
  organization but UPGRADING assertions to exact code is the explicit instruction.
- 18 vs 16: FACTS.md section 4 -- the enum value (18) is verified against the
  installed compiler; the catalog's 16 is a labeling choice.

### Facts the orchestrator can verify

- The exact NG-code for each of the 18 names, read from the compiler-cli `ErrorCode`
  enum at `@angular/compiler-cli@22.0.4` (FACTS.md section 4 flags this as
  read-during-work). Two names (`controlFlowPreventingContentProjection`, the second
  "undocumented") need their codes confirmed before a fixture can target them.
- Whether every one of the 18 is independently TRIGGERABLE by a minimal committed
  fixture under `strictTemplates` at v22.0.4 (some extended checks have narrow
  preconditions; a couple may need `defaultCategory: "error"` to be observable, like
  the sandbox's `forceExtendedDiagnosticsAsErrors`).

### What would change my position

If the orchestrator verifies that one or more of the 18 enum members is NOT
independently triggerable at v22.0.4 (the check is gated behind a config combo the
tool never runs, or the code was reserved-but-unimplemented), I would scope THAT
specific code to a documented `it.skip` with the reason recorded (the sandbox's
healthy "record WHY a phase isn't exercised" habit, SANDBOX-TECHNIQUES.md /
CONNECT-TECHNIQUES.md 6a). I would NOT drop it silently. The position changes from
"assert all 18" to "assert all triggerable; skip-with-reason the untriggerable" --
the maximalist principle (no silent holes) is preserved either way.

---

## D3 -- Executor-against-workspace test (the mid-tier)

### Position

ADD IT. The current architecture jumps from seam-mocked unit specs straight to the
full-tarball e2e with NOTHING in between (CURRENT-AUDIT-AND-GENERATOR.md A.2). That
missing mid-tier is exactly where a whole class of regressions hides: `context.root`

- `tsConfig` option -> real on-disk path resolution; `normalizeOptions` against a
  real `project.json` target; the executor binding under its PUBLISHED id against a
  real `ExecutorContext`. Today (per the audit) path-resolution and id-binding are
  proven ONLY at the slow Linux-only tarball tier, and option-normalization only via a
  pure unit. A bug in `context.root` join logic on Windows would currently be invisible
  until the e2e tier -- which does not run on Windows in CI (e2e is Linux-only).

Build it on the `createFsTree` substrate from D1 (the helper pays for itself by
serving two tiers). Run the executor against a real-disk seeded workspace +
constructed `ExecutorContext`, asserting `{ success }` AND that the resolved tsconfig
path is the on-disk one. This runs in the 6-cell `test` matrix -- so it gets the
Windows + macOS coverage the e2e tier lacks, closing a real cross-platform hole.

### Factual basis

- The mid-tier gap is explicitly identified (CURRENT-AUDIT-AND-GENERATOR.md A.2:
  "There is no mid-tier ... the jump is mocked-unit -> full-tarball-e2e with nothing
  in between").
- Path resolution + published-id binding are e2e-only today; e2e is Linux-only
  (ci.yml e2e job; FACTS.md section 5). The `test` matrix runs Windows 24/26 + macOS 24. A mid-tier executor test in the `test` matrix is the ONLY way path-resolution
  gets cross-platform coverage without making e2e multi-OS (which would be far more
  expensive).
- The substrate decision is reusable (CURRENT-AUDIT-AND-GENERATOR.md (3) "this is
  where the FsTree substrate choice is reused").

### Facts the orchestrator can verify

- Whether `context.root` + tsConfig resolution has any OS-sensitive path logic
  (separators, drive letters) that a Linux-only e2e would miss. If the executor
  delegates 100% to `node:path` with no manual string joins, the cross-platform
  catch is weaker (still nonzero -- normalizeOptions against a real target is
  OS-independent value).

### What would change my position

If the orchestrator confirms (a) the executor does ALL path resolution via
`node:path`/devkit helpers with zero hand-rolled separator logic, AND (b) a cheap
ADDITION to the existing matrix-e2e (already runs all 5 project types) would assert
path resolution per type, THEN the mid-tier's marginal catch shrinks and I would
accept folding its assertions into matrix-e2e instead of a new spec -- but I would
still require the path-resolution + published-id assertions to exist SOMEWHERE that
runs on Windows. The non-negotiable is cross-platform coverage of path resolution,
not the specific tier.

---

## D4 -- Generator e2e

### Position

YES, test the generator end-to-end, with FULL fidelity: pack + install the real
tarball, run `npx nx g angular-typechecker:typecheck-configuration <proj>` as a
consumer would, assert the on-disk `project.json` got the target, AND assert that
`nx run <proj>:angular-typecheck` then actually RUNS (green on a clean project,
non-zero on an injected error). A generator that writes a target the executor cannot
consume is a broken generator; only the run-the-generated-target assertion proves the
generator + executor CONTRACT, not just the generator's Tree output.

Run it across MULTIPLE project types, not one. The matrix-e2e fixture workspace
already commits all five project types (app, local-lib, buildable-lib,
publishable-lib, + spec tsconfig) -- the consumer-workspace is BUILT. Generating the
target onto each and running it is the faithful per-project-type validation that
prior art (Connect 3b) flags as a GAP nobody covered. This milestone can be the first
to close it, cheaply, because the fixtures exist.

Mechanism: EXTEND the existing `npm pack` + tmp-install harness (do NOT introduce
Verdaccio). The repo deliberately uses direct tarball install (simpler, proven,
Windows-safe vs the known Verdaccio `execFileSync(nx)` Windows failure). Prefer
adding the generator scenario to the EXISTING `install-e2e` or `matrix-e2e` project
rather than a brand-new e2e project -- a new project must be hand-added to ci.yml's
explicit `-p` list (FACTS.md section 5) and is invisible to CI until then, a
foot-gun. Reusing an existing project means zero ci.yml change and automatic
inclusion.

### Factual basis

- The generator does not exist yet; the tarball harness DOES and is proven
  (install-smoke, matrix-5types; FACTS.md section 3).
- matrix-e2e already commits a 5-project-type consumer workspace
  (git ls-files: `consumer-workspace/{apps/app, libs/{local,buildable,publishable}-lib}`
  - a `local-lib` spec tsconfig). The per-type substrate is sunk cost.
- Verdaccio is deliberately avoided; Windows `execFileSync(nx)` failure is a named
  hazard (CURRENT-AUDIT-AND-GENERATOR.md B.3; CONNECT-TECHNIQUES.md section 7).
- A new e2e project is CI-invisible until added to the `-p` list (FACTS.md section
  5; CURRENT-AUDIT-AND-GENERATOR.md A.4).

### Facts the orchestrator can verify

- Whether the matrix-e2e fixture workspace can host a `nx g` invocation without
  Verdaccio (it installs the tarball; running a generator from an installed plugin in
  a committed workspace needs the plugin resolvable from that workspace's
  node_modules -- the same resolution path the executor already uses there).
- Whether dogfooding the generator inside the matrix-e2e setup (sandbox technique 3:
  the fixture wiring calls the plugin's OWN generator) is preferable to committed
  static target config -- dogfooding gives the generator e2e coverage "for free" as a
  side effect of fixture wiring.

### What would change my position

If the orchestrator finds the existing `install-e2e`/`matrix-e2e` projects cannot
host a generator invocation without a NEW e2e project (resolution constraints), I
would accept a new `generator-e2e` project ONLY with the ci.yml `-p`-list addition
AND `implicitDependencies: ["angular-typechecker"]` committed in the SAME change, so
it is never silently uncovered. The fidelity requirement (run the generated target,
across project types) does not change.

---

## D5 -- CI mapping

### Position

Maximal coverage must run where it catches the MOST regression classes, and CI must
FAIL CLOSED on every new tier:

1. **All in-plugin generator + NG8xxx catalog specs land in the 6-cell `test`
   matrix automatically** (glob match, no ci.yml change). KEEP them there -- this is
   the maximalist win: the full extended-diagnostic catalog runs on ubuntu
   {22,24,26} + windows {24,26} + macos {24}. Diagnostic surfacing CAN differ by Node
   major and by OS (path/case-sensitivity in the boundary filter; the repo already
   carries `useCaseSensitiveFileNames` + `realpath` logic). Running the catalog on
   all 6 cells is precisely the defense-in-depth that catches an OS/Node-specific
   diagnostic regression a single-cell run would miss.
2. **The generator e2e runs in the Linux-only `e2e` job** -- acceptable for the
   tarball-resolution proof (OS-independent), PROVIDED the D3 mid-tier executor test
   (which IS OS-sensitive) runs in the `test` matrix to cover Windows/macOS path
   resolution. This is the crux: do not let the Linux-only e2e be the ONLY place
   path/id logic is exercised.
3. **If `createFsTree` is authored (D1), add its drift tripwire to the existing
   `typecheck-drift` target inputs** so the internal `nx/src/generators/tree` import
   fails LOUDLY on the next Nx upgrade -- it then runs in every `test` cell at near-
   zero cost (the gate is Nx-cached). This is the maximalist's insurance against the
   one real risk of the real-disk substrate (internal-API drift).
4. **Any new e2e PROJECT must be added to the `e2e` job `-p` list in the same PR**
   (FACTS.md section 5: a new e2e project is invisible to CI otherwise). The `ci`
   aggregate's `skipped`-tolerant gate means a forgotten project does not even turn
   the build red -- so the explicit list is a fail-OPEN hazard the maximalist must
   guard by review discipline + the D4 "extend existing project" preference.

### Factual basis

- In-plugin specs auto-join the `test` matrix; new e2e projects need explicit `-p`
  addition (FACTS.md section 5; CURRENT-AUDIT-AND-GENERATOR.md A.4).
- The boundary filter is OS-sensitive (`useCaseSensitiveFileNames`, `realpath` in
  run-typecheck.ts finalize / FinalizeFilter). The 6-cell matrix exists to catch
  cross-OS/Node regressions (ci.yml `test` job comment).
- `typecheck-drift` is the proven in-repo tripwire pattern for an external/internal
  contract (project.json `typecheck-drift` target).
- The `ci` aggregate tolerates `skipped` (ci.yml lines ~219-237) -- so a mis-skipped
  e2e project would NOT fail the gate (fail-open hazard).

### Facts the orchestrator can verify

- Whether running the FULL 14-fixture catalog in all 6 cells materially increases CI
  wall-clock (each fixture is a cold `performCompilation`; `testTimeout`/`hookTimeout`
  are 30000). If the catalog adds, say, 14 x cold-compile x 6 cells, the matrix time
  could grow non-trivially.

### What would change my position

If the orchestrator measures that running the full catalog on all 6 cells pushes the
`test` matrix past an acceptable wall-clock budget, I would accept running the full
catalog on ONE Linux cell (Node 24) and a REDUCED smoke subset (one warning, one
error, one promotion) on the other 5 cells -- preserving cross-OS coverage of the
MECHANISM while not paying 6x for every code. I would not accept dropping the catalog
to a single cell entirely: the OS-sensitivity of the boundary filter means at least
one Windows cell must run enough of the catalog to exercise case-folding/realpath.

---

## D6 -- Scope

### Position

The `typecheck-configuration` generator BELONGS in this milestone (it is the
milestone's named scope -- FACTS.md section 1), and the testing work should be
SCOPED MAXIMALLY around correctness, not minimally around effort. Concretely, the
milestone should deliver, as ONE coherent body:

1. The generator + `generators.json` + package wiring (the feature).
2. The FULL NG8xxx + baseline catalog at exact-code/category/count/promotion
   assertions (D2) -- this is the milestone that finally closes the headline-feature
   coverage hole, and it is cheap given the existing seam.
3. The generator unit tests (in-memory, exhaustive via `describe.each`) + schema
   parity (extend the existing `schema-parity.spec.ts` idiom to the generator).
4. The `createFsTree`/`flushFsTreeChanges` helpers (resolving the v0.0.1 drift in
   code) + their drift tripwire.
5. The D3 mid-tier executor-against-workspace test.
6. The D4 generator e2e across project types.
7. Idempotency + project-type-shape coverage for the generator (Connect's
   load-bearing "don't clobber user config" + app-vs-lib shape asymmetry).

The minimalist will call this gold-plating. The rebuttal: items 2-4 are not
gold-plating, they are CLOSING DRIFT AND HOLES that already exist and are documented
as this milestone's job (PROJECT.md "authored for real in v0.0.4"; the catalog's
TEST-02 "assert EVERY NG8xxx"). Shipping the generator while leaving 14 extended
diagnostics unasserted would be the milestone that adds a feature to a tool whose
core feature is still 12.5%-verified. For a correctness tool, that is the wrong
trade.

The ONE scope boundary I accept: cache hit/miss correctness and `dependsOn` ordering
are documented across all prior art as expensive-to-test and uncovered
(CONNECT-TECHNIQUES.md 5c). The existing `cache-e2e` project already asserts
dependency-error-busts-cache, which is the high-value cache invariant. I do NOT push
for deeper Nx-scheduler testing -- that is the genuine YAGNI line.

### Factual basis

- Generator is the milestone's named scope (FACTS.md section 1).
- The catalog gap (14/16 missing) and the FsTree drift are DOCUMENTED as v0.0.4's
  job (CURRENT-AUDIT-AND-GENERATOR.md A.3, A.5; PROJECT.md references).
- Cache/dependsOn deep testing is uncovered by all prior art and flagged as
  not-worth-it (CONNECT-TECHNIQUES.md 5c); cache-busts-on-dep-error already exists
  (e2e/angular-typechecker-cache-e2e).
- Pre-1.0: `feat`/`fix` both bump patch (FACTS.md section 8) -- the version cost of
  shipping more is identical, so scope is not constrained by release mechanics.

### Facts the orchestrator can verify

- Whether the milestone has a stated time/effort budget that the full body (1-7)
  exceeds. The maximalist case rests on the marginal cost being low; if the
  orchestrator has a hard budget, items 2 (full catalog) and 4 (FsTree) are the
  highest-value-per-cost (close documented holes) and items 5-6 (mid-tier + generator
  e2e) are the next; 7 is cheap; nothing here is genuinely expensive given sunk
  infrastructure.

### What would change my position

If the orchestrator establishes that the generator's behavior is genuinely trivial
(33-line sandbox-grade, pure `project.json` edit, no project-type branching, no file
emission) AND a hard milestone budget exists, I would still hold items 2 + 4 as
non-negotiable (they close documented drift/holes that are this milestone's stated
purpose) but accept deferring the D3 mid-tier (item 5) to a follow-up IF its
path-resolution catch is independently covered on Windows elsewhere. I would not
defer the catalog: deferring the headline-feature coverage to "later" is the
under-testing the mandate exists to attack.

---

## Risk ledger (where cutting creates correctness holes)

- **Cut the 14 missing extended codes -> silent false PASS** on any template using
  those checks. Highest-severity hole; cheapest to close.
- **Cut the promotion axis -> a strictTemplates/defaultCategory regression** flips
  errors to warnings (or vice versa) undetected; exit code silently wrong.
- **Cut the mid-tier / keep path-resolution e2e-only -> Windows path bugs invisible**
  (e2e is Linux-only; primary dev env is Windows-arm64).
- **Defer FsTree helpers -> documentation-drift persists** and the generator's
  "emitted config is consumable" claim stays unproven on disk.
- **New e2e project without the `-p`-list + `skipped`-tolerant gate -> fail-open**:
  a forgotten generator e2e is green-by-omission.
- **Cut baseline NG codes -> the non-extended diagnostic surface (NG2xxx/NG3xxx)**
  is asserted for only 2 codes; a regression in the baseline gatherer phase is
  caught only by the boolean-grade e2e.

---

```
POSITIONS
D1: Use all three substrates; author createFsTree/flushFsTreeChanges now (quarantined + drift-pinned) for the real-disk generator/mid-tier tier, in-memory createTreeWithEmptyWorkspace as the default unit substrate, execSync tarball for e2e.
D2: Assert ALL 18 extended diagnostics + the full baseline NG/TS set by exact code + category + count + promotion, via committed per-introduction-version fixtures (skip-with-reason only any code proven untriggerable at v22.0.4).
D3: Add the mid-tier executor-against-workspace test on the FsTree substrate, in the 6-cell test matrix, so path resolution + published-id binding get Windows/macOS coverage the Linux-only e2e lacks.
D4: Full-fidelity generator e2e -- pack/install the real tarball, run `nx g`, then RUN the generated target across all five committed project types; extend an existing e2e project (avoid Verdaccio and a CI-invisible new project).
D5: Catalog + generator specs run in all 6 test cells (auto, fail-closed); generator e2e in the Linux e2e job; add the FsTree drift tripwire to typecheck-drift; any new e2e project added to the -p list in the same PR.
D6: Generator IS in scope; pursue MAXIMAL testing scope -- close the 14-code catalog hole and the FsTree drift (this milestone's documented job) plus mid-tier + generator e2e + idempotency/project-type shapes; the only genuine YAGNI line is deeper Nx cache/dependsOn scheduler testing.
FACTS-NEEDED: exact NG codes + per-code triggerability at v22.0.4 for all 18 ExtendedTemplateDiagnosticName members (esp. controlFlowPreventingContentProjection + the 2nd "undocumented" code); whether the generator emits FILES or only edits project.json; whether matrix-e2e/install-e2e can host an `nx g` invocation without a new project; CI wall-clock delta of running the full catalog x6 cells; whether the milestone has a hard effort budget.
WOULD-CHANGE-MIND: D1 -> generator guaranteed file-emission-free AND D4 runs the generated target (then gate FsTree's single use). D2 -> a code proven untriggerable at v22.0.4 (skip-with-reason, never silent). D3 -> executor path logic is 100% node:path with zero hand-rolled separators AND matrix-e2e asserts per-type path resolution on a Windows-running tier. D4 -> existing e2e projects cannot host `nx g` (accept a new project only with same-PR -p-list + implicitDependencies). D5 -> full catalog x6 cells busts the CI budget (reduce to full-on-1-cell + smoke-on-5, keep >=1 Windows cell running case-fold/realpath). D6 -> trivial generator AND hard budget (defer only D3; never defer the catalog).
```
