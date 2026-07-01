# C5 - Product value / consumer lens (Round 1)

**Advisor seat:** Product value / consumer.
**Lens question for every decision:** Does this test protect what AI coding agents and CI
pipelines depend on -- a fast, complete, trustworthy type-check _pass/fail and diagnostic
signal_, decoupled from building or running tests? Tests that protect that signal earn their
keep; tests that protect implementation trivia or duplicate an already-covered guarantee do not.

The product's promise (PROJECT.md, FACTS.md S2/S8) decomposes into four consumer-facing
guarantees. I grade every decision against these:

- **G1 - Completeness.** EVERY relevant diagnostic surfaces: TypeScript + Angular template +
  extended (NG8xxx). The all-getter gatherer means a consumer can trust "green" to mean
  "no diagnostic of any class was silently dropped." A missed NG8xxx is a _false green_ -- the
  worst failure mode for a tool whose entire value is being the trustworthy "elsewhere" the
  fast compilers skip.
- **G2 - Correct verdict.** The exit code / `{ success }` maps faithfully to error presence
  (toExitCode: 0/1/2). An agent or CI gate keys off this; a wrong verdict is a broken gate.
- **G3 - Installs and runs as shipped.** The published tarball, when added to a real consumer
  workspace, actually loads (no `ERR_REQUIRE_ESM`), binds under its published id, resolves the
  tsConfig path, and runs across the project types consumers have (app / local-lib /
  buildable-lib / publishable-lib / spec-tsconfig).
- **G4 - Frictionless adoption.** The consumer can wire the target onto a project without
  hand-editing JSON -- the `typecheck-configuration` generator. The generator's output must be
  _correct_ (right executor id, right tsConfig) and _safe_ (idempotent; never clobbers existing
  config), because a generator that silently mis-wires a target produces a typecheck that checks
  the wrong tsconfig -- a false green by a different route.

A note on what the consumer does NOT see, which shapes my whole posture: consumers never import
`runTypecheck`, never construct an `FsTree`, never see a `ts.Program` stub. They see `nx run
proj:angular-typecheck` either pass or fail, and they see diagnostics printed. So the tests with
the highest product value are the ones closest to that observable surface (integration with the
real compiler; tarball e2e), and the lowest-value tests are the ones deep in the mock-the-seam
interior. The current suite is, encouragingly, already weighted toward the high-value end (11
real-compiler integration specs, 7 real-tarball e2e specs, mocking confined to 2 composition
specs -- FACTS.md S3). My recommendations push to _keep_ that weighting and spend the v0.0.4
budget where a consumer-visible guarantee is currently unproven.

---

## D1 - Test substrate

**Position:** Use the **public in-memory `createTreeWithEmptyWorkspace()`** (`@nx/devkit/testing`)
for the generator unit/integration tier. Use the existing **Node `fs` + `execSync` real-tarball
harness** for any executor- or generator-against-workspace fidelity. **Do NOT author the bespoke
real-disk `createFsTree`/`flushFsTreeChanges` helpers** in this milestone. From the product lens,
the substrate choice is almost irrelevant to the consumer _except_ where it buys end-to-end
fidelity -- and a virtual `FsTree` rooted at `/virtual` buys none.

**Factual basis:**

- The generator's entire observable behavior is a `project.json` Tree transformation
  (`readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` -> `formatFiles`)
  (CURRENT-AUDIT B.1; SANDBOX S1: the sandbox generator is 33 lines, no `generateFiles`). The
  in-memory tree captures 100% of that; nothing reads the tree from real disk mid-generation.
- `createTreeWithEmptyWorkspace` is the public, version-stable path (`@nx/devkit/testing`,
  verified on nx@23.0.1) and is what all 452 nx generator specs use (FACTS.md S6;
  NX-FSTREE S3/S6b). Zero quarantine, zero eslint-disable, zero drift tripwire to maintain.
- The bespoke `createFsTree` requires a deep import of the **internal** `nx/src/generators/tree`
  (not in `@nx/devkit`'s public barrel; NX-FSTREE S0/S4), which means an eslint-disable + a new
  drift gate -- pure maintenance cost with no consumer-visible payoff, because the real-disk
  proof that a consumer cares about (the generated target actually runs on disk) is already
  delivered by the tarball e2e tier (CURRENT-AUDIT (2) recommendation; install-smoke /
  matrix-5types).
- The `createFsTree`/`flushFsTreeChanges` helpers were a v0.0.1 paper deliverable never written
  (CURRENT-AUDIT A.5). There is no installed consumer of them.

**Facts I am missing (orchestrator can verify):** Whether the planned generator will ever
_generate a tsconfig file_ (e.g. a `tsconfig.typecheck.json`) rather than only edit
`project.json`. If it writes a tsconfig the executor then consumes, proving that file is
_on-disk correct and runnable_ becomes a real consumer guarantee (G3) and tips the real-disk
question -- though even then I would buy that proof at the tarball e2e tier, not via `createFsTree`.

**Fact that would change my position:** If the generator emits a file that a real `ngc`/executor
run must read mid-flow AND the orchestrator rules the tarball e2e too slow/coarse to cover it,
then a real-disk `createFsTree` tier becomes the cheapest way to prove G3 for that file, and I
would accept the quarantined deep import for that one tier.

---

## D2 - Diagnostic coverage

**Position:** This is **the** product-value decision of the milestone and where the bulk of the
budget should go. Assert **every one of the 18 `ExtendedTemplateDiagnosticName` members and the
catalog's baseline TS/NG codes by EXACT code + category**, against the **real compiler** via
committed fixtures, organized as **per-introduction-version integration files**
(`extended.angularNN.integration.spec.ts` / `baseline.angularNN.integration.spec.ts`), one `it`
per code. Assert the **warning-default vs promoted-error** contrast for extended diagnostics (via
`extendedDiagnostics.defaultCategory: "error"`) because that promotion is the version-independent
mechanism a consumer relies on to make NG8xxx fail a gate. Prefer committed fixtures over
programmatic injection.

**Factual basis:**

- Completeness (G1) is the headline promise; a missed NG8xxx is a false green. The suite asserts
  only **2 of 16** documented extended diagnostics by exact code today (NG8101, NG8109), 14
  missing (CURRENT-AUDIT A.3). This is the single largest unguarded consumer guarantee in the repo.
- Exact-code + `.category` assertion is the right shape and is already the repo idiom (`NG()`
  helper; count by category, never code sign -- CURRENT-AUDIT A.3 / PART C). Angular's own
  compiler-cli tests assert by exact code + category (CURRENT-AUDIT PART C). A boolean
  `success === false` (the sandbox's coarse assertion -- SANDBOX S4 caveat) does NOT protect G1:
  it cannot tell "NG8113 fired" from "some unrelated error fired," so it would pass even if the
  intended diagnostic silently stopped being emitted.
- The 18-member enum is verified against the installed compiler-cli (FACTS.md S4); the catalog's
  16-vs-18 discrepancy (`controlFlowPreventingContentProjection` unlisted;
  `unusedLetDeclaration` flagged undocumented) means the work must re-derive each name->code from
  the compiler-cli `ErrorCode` enum during implementation, not trust the catalog.
- Committed fixtures (vs jscodeshift injection) match this repo's existing substrate
  (`fixtures/` is committed, real tsconfigs -- FACTS.md S3) and Angular's own test style. From
  the consumer lens, committed fixtures are also _more trustworthy as a regression record_: the
  exact source that triggers NG8113 is reviewable in the diff, not synthesized at runtime.
- Severity-promotion already proven for NG8101 (`extended.promotion.integration.spec.ts`)
  generalizes; the warning-default/promoted-error contrast is what a consumer toggles to make
  template hygiene gate-failing (CONNECT S4b: NG8xxx are warnings by default).

**Facts I am missing:** The exact NG code for each of the 18 names in
`@angular/compiler-cli@22.0.4`'s `ErrorCode` enum (FACTS.md S4 says "to be read during work"),
and which of the 18 are _reachable_ via a public `performCompilation` run vs gated behind
internal-only conditions. A few may be hard or impossible to trigger through the public surface;
those need an explicit, commented `it.skip` with the reason (the CONNECT habit -- CONNECT S6a),
not silent omission -- because a silently-uncovered code is indistinguishable to a future reader
from a forgotten one.

**Fact that would change my position:** If some NG8xxx members are provably unreachable through
the public `performCompilation` path (only emitted by internal check factories the plugin never
invokes), then "every member" is the wrong target for those; the position narrows to "every
member reachable via the shipped engine, with documented skips for the rest." I would not weaken
the exact-code assertion under any fact -- coarse boolean assertions do not protect G1.

---

## D3 - Executor-against-workspace test

**Position:** **Yes, add a thin mid-tier spec** that runs the executor against a constructed
`ExecutorContext` over a seeded workspace -- but justify it strictly by the consumer guarantee it
closes, and keep it SMALL. Today the only things proving "the executor resolves `context.root` +
the `tsConfig` option to a real path and binds under its published id" are the tarball e2e specs
(CURRENT-AUDIT A.2). A mid-tier spec that exercises `context.root`->`tsConfig` resolution and
`normalizeOptions` against a real `project.json` gives an earlier, faster signal for a G2/G3
seam that is otherwise only caught minutes later in the Linux-only e2e job.

**Factual basis:**

- The current ladder jumps from seam-mocked unit (`executor.spec.ts` mocks the four core seams +
  logger -- FACTS.md S3) straight to full-tarball e2e, with nothing between (CURRENT-AUDIT A.2:
  "no mid-tier"). Path-resolution bugs (the wrong `tsConfig` resolved relative to the wrong root)
  are exactly the kind of consumer-visible G3 break that the mocked unit cannot see and that
  currently waits for the e2e tier.
- Connect's prior art distinguished `runExecutorInWorkspace` (in-process `runExecutor`, returns
  `{ success }`) from a CLI-spawning runner (CONNECT S4b) -- the in-process mid-tier is cheap and
  runs in the `test` matrix (D5), so it lands an early signal on all 6 OS/Node cells, not just
  Linux.

**Facts I am missing:** Whether `normalizeOptions` + the `context.root`->`tsConfig` resolution
path has any branch _not_ already exercised by the pure `normalize-options.spec.ts` plus the e2e
matrix. If the resolution logic is trivial and fully covered by the pure unit spec, the mid-tier
spec's marginal product value drops toward zero and it becomes optional polish.

**Fact that would change my position:** If path resolution is genuinely a one-liner with no
context-dependent branching (so the pure `normalize-options.spec.ts` already proves it), I would
**drop** D3 as redundant -- it would be testing the framework, not a consumer guarantee. The
mid-tier earns its place only if it covers a real resolution branch nothing else does.

---

## D4 - Generator e2e

**Position:** **Yes -- but do it by extending the EXISTING tarball harness, not by adding
Verdaccio**, and assert the consumer-meaningful end state: after `npx nx g
angular-typechecker:typecheck-configuration <proj>` against the installed tarball, the on-disk
`project.json` carries the right target AND `nx run <proj>:angular-typecheck` then runs. This is
the test that proves G4 _and_ G3 together: the generator a consumer actually invokes, from the
package they actually install, producing a target that actually executes.

**Factual basis:**

- The generator is the consumer's adoption path (G4). An in-memory generator unit test proves the
  Tree transform but NOT that the generator resolves from an installed package and that its output
  is runnable (CURRENT-AUDIT B.3). The sandbox e2e proves exactly this end-to-end ("add the target
  and run it" + a sentinel-token template-error assertion -- SANDBOX S6); Connect e2e wires the
  target then runs the executor (CONNECT S2/S3).
- The repo deliberately uses `npm pack` + tmp install rather than Verdaccio (CURRENT-AUDIT B.3),
  and the scaffolded Verdaccio path has a known Windows `execFileSync(nx)` failure
  (CURRENT-AUDIT B.3 Windows caveat; CONNECT S7 Windows-arm64 mitigations). Reusing one e2e
  mechanism is lower-friction and keeps the gate's meaning consistent.
- The **sentinel-token stdout assertion** (SANDBOX S6.6) is worth carrying: it proves the
  diagnostic _text_ reaches the consumer through the subprocess boundary, not merely that the
  exit code was non-zero -- which is the real product promise (a useful diagnostic signal, G1, not
  just a red light).

**Facts I am missing:** Whether to extend `install-e2e` in place or add a new
`angular-typechecker-generator-e2e` project. A new project must be added by name to the `e2e`
job's explicit `-p` list and needs `implicitDependencies: ["angular-typechecker"]`
(CURRENT-AUDIT A.4 / FACTS.md S5). I do not have the bootstrap-time budget of the e2e job to
judge whether one more scaffold+install fits.

**Fact that would change my position:** If a fresh `create-nx-workspace` + install per generator
scenario is prohibitively slow on the CI runner, I would fold the generator e2e into the existing
`install-e2e` workspace (reuse the already-installed tarball + already-scaffolded consumer) rather
than spin a second project -- but I would NOT drop the run-it-after-generating assertion, since
the "generate then run" round trip is the load-bearing consumer guarantee.

---

## D5 - CI mapping

**Position:** In-plugin generator unit specs and the NG8xxx catalog integration specs should ride
the existing **6-cell `test` matrix automatically** (they match the glob; no `ci.yml` change). The
generator e2e (if a new project) must be **added by name to the `e2e` job's `-p` list**. The whole
new suite must continue to roll up under the single required **`ci`** aggregate. From the consumer
lens, the priority is that _completeness coverage runs cross-OS_ (NG8xxx behavior can differ by
path handling / line endings on Windows vs Linux), and that the required gate stays a single,
honest signal.

**Factual basis:**

- The `test` job runs `nx run-many -t typecheck-drift test -p angular-typechecker` across
  {ubuntu 22/24/26, windows 24/26, macos 24}; a new `*.integration.spec.ts` under the plugin runs
  in every cell with no workflow edit (FACTS.md S5; CURRENT-AUDIT A.4). The catalog's value (G1)
  is multiplied by running on all 6 cells -- a Windows-only template-path regression in an NG8xxx
  fixture is exactly the kind of thing a Linux-only run would miss.
- The `e2e` job is Linux-only by design (RD-03) with an explicit project list; a new e2e project
  is invisible until named (FACTS.md S5). That is acceptable: the generator e2e proves a
  packaging/adoption guarantee that is OS-portable enough to gate on Linux, consistent with the
  existing tarball tier.
- The `ci` aggregate (`needs: [...]`, `if: always()`, fails on failure/cancelled, tolerates
  skipped) is the one required check (FACTS.md S5). Keeping everything under it preserves the
  single trustworthy merge gate.

**Facts I am missing:** Whether the added NG8xxx integration specs (each a cold
`performCompilation`, 30s timeouts -- FACTS.md S3) materially lengthen the `test` job on the
slowest cell (e.g. macOS or Windows arm-emulated). Cold-compile-per-`it` across ~16 new fixtures x
6 cells could be a real wall-clock cost.

**Fact that would change my position:** If the cold-compile cost per fixture makes the 6-cell
`test` job unacceptably slow, I would (a) consolidate fixtures so one `performCompilation` run
yields several asserted codes where the compiler emits them together, or (b) as a last resort run
the _full_ catalog on the Linux cells and a representative subset on the OS-axis cells -- but I
would resist cutting cross-OS coverage of the catalog wholesale, because OS-specific false greens
are precisely a consumer-trust failure.

---

## D6 - Scope

**Position:** **Yes -- the `typecheck-configuration` generator belongs in this milestone**, and it
should be scoped as a _first-class deliverable with its own e2e_, not a side quest. From the
product lens the milestone's two headline consumer wins are (1) frictionless adoption via the
generator (G4) and (2) trustworthy completeness via the full NG8xxx catalog (G1). Scope the
testing work to lock those two, plus close the executor mid-tier gap (D3) opportunistically. Treat
buildable/publishable-lib and spec-tsconfig as _distinct generator/executor shapes_ only to the
extent the matrix-e2e already exercises them; deeper per-shape generator branching is a documented
gap to design, not inherit (no prior art covers it).

**Factual basis:**

- The milestone's named scope is exactly "a `typecheck-configuration` generator plus testing work"
  (FACTS.md S1). The generator is the missing adoption surface (no `generators` field, no generator
  today -- FACTS.md S2; CURRENT-AUDIT A.5).
- The two biggest _unguarded consumer guarantees_ are the NG8xxx completeness gap (14/16 missing --
  D2) and the generator's existence/correctness (G4). Both are squarely in scope.
- Per-project-type _generator_ branching (app gets explicit `tsConfig`, lib defaults; buildable vs
  publishable vs spec as distinct shapes) is NOT covered by any prior art at the generator tier
  (CONNECT S3a/S3b: only app-vs-library fork existed; buildable/publishable/spec are flagged as a
  GAP to design). Over-scoping that now risks freezing a contract under low confidence.
- Versioning is favorable: `feat` -> patch bump pre-1.0 (FACTS.md S8), so shipping the generator is
  a clean 0.0.3 -> 0.0.4, and the testing work (`test`/`ci` commits) does not itself bump.

**Facts I am missing:** Whether the milestone intends the generator to _auto-detect project type_
and emit different tsConfig defaults per type (app's editor tsconfig vs lib's `tsconfig.lib.json`
vs a spec tsconfig), or to ship the sandbox's single hard-coded `tsconfig.lib.json` default with a
`--tsConfig` override. That decision drives how much generator test surface (the `describe.each`
project-type matrix from CONNECT S2b) is in scope.

**Fact that would change my position:** If the milestone's real intent is the broader per-project-
type generator (apps/buildable/publishable/spec each wired correctly and idempotently), then the
generator's own test scope expands materially (a project-type `describe.each` + idempotency per
type) and I would argue for _narrowing_ the NG8xxx catalog to the highest-traffic codes this
milestone, to keep the milestone shippable -- because a half-built per-type generator is a worse
consumer outcome (mis-wired targets = false greens) than a partial-but-honest catalog.

---

## Summary of the product-value posture

The consumer never sees the interior; they see green/red, the printed diagnostics, and whether
`nx g` + `nx run` work from the installed package. So spend the budget where a consumer-visible
guarantee is currently unproven: the **NG8xxx exact-code catalog** (G1, the biggest gap) and the
**generator's existence + run-it-after-generating e2e** (G4+G3). Keep substrate cheap and public
(in-memory tree, existing tarball harness); add the executor mid-tier only if it covers a real
resolution branch. Coarse boolean assertions are the one thing I will not accept for the catalog --
they cannot distinguish a real diagnostic from an unrelated one and so do not protect completeness.

```
POSITIONS
D1: In-memory createTreeWithEmptyWorkspace for the generator tier; reuse the existing fs/execSync tarball harness for on-disk fidelity; do NOT author bespoke createFsTree (no consumer-visible payoff).
D2: Assert all 18 ExtendedTemplateDiagnosticName members + baseline TS/NG codes by EXACT code+category against the real compiler, committed fixtures, organized per-introduction-version; include warning-default-vs-promoted-error; coarse boolean assertions are unacceptable.
D3: Add a thin in-process executor-against-workspace mid-tier spec for context.root->tsConfig resolution + normalizeOptions, only if it covers a resolution branch the pure unit + e2e do not.
D4: Yes -- generator e2e by EXTENDING the existing npm-pack/tmp-install tarball harness (not Verdaccio); assert on-disk project.json AND that nx run proj:angular-typecheck then runs; carry the sentinel-token stdout assertion.
D5: In-plugin generator + catalog specs ride the 6-cell test matrix automatically (cross-OS is load-bearing for completeness); a new generator-e2e project must be named in the e2e job -p list; all roll up under the single required ci gate.
D6: Yes, the typecheck-configuration generator belongs in this milestone; scope testing around G4 (generator correct+idempotent+e2e) and G1 (full NG8xxx catalog), with deeper per-project-type generator branching treated as a design gap, not inherited.
FACTS-NEEDED: exact ErrorCode value per NG8xxx name in compiler-cli@22.0.4 and which are reachable via public performCompilation; whether the generator emits a tsconfig file or only edits project.json; whether normalizeOptions/context.root->tsConfig has a branch not already covered by normalize-options.spec.ts + e2e; per-cell wall-clock cost of ~16 cold-compile fixtures x 6 matrix cells; e2e-job bootstrap budget for a new generator-e2e project; whether the generator must auto-detect project type and vary the tsConfig default.
WOULD-CHANGE-MIND: D1 -> generator emits a file a real ngc/executor run must read mid-flow AND tarball e2e is ruled too coarse; D2 -> some NG8xxx are provably unreachable via public performCompilation (narrow to reachable + documented skips); D3 -> path resolution is a trivial no-branch one-liner already proven by normalize-options.spec.ts (drop it); D4 -> fresh-workspace-per-scenario is too slow (fold into install-e2e but keep the generate-then-run assertion); D5 -> cold-compile cost forces fixture consolidation or full-catalog-on-Linux/subset-on-OS-axis; D6 -> milestone intends the broad per-project-type generator (expand generator tests, narrow the catalog to ship).
```
