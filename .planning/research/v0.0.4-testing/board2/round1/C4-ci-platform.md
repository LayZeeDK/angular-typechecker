# C4 -- CI / cross-platform / performance / DevEx lens (Round 1)

LENS: judge CI job mapping, the 6-cell `test` matrix and Linux-only `e2e` job,
cross-platform reliability (incl. Windows-arm64), feedback latency, and the
single required `ci` check. I evaluate D1-D6 by their CONSEQUENCES for the CI
graph, not by test-design elegance.

Grounding facts I rely on (verified this round):
- `ci.yml`: `test` is a 6-cell matrix `{ubuntu:22,24,26; windows:24,26; macos:24}`,
  `fail-fast:false`, `NX_DAEMON:false`, runs `nx run-many -t typecheck-drift test
  -p angular-typechecker`. A new in-plugin `*.spec.ts`/`*.integration.spec.ts`
  runs in ALL SIX cells automatically (glob match, no ci.yml edit).
- `e2e` is Linux-only, Node 24, runs an EXPLICIT `-p` project list of three e2e
  projects. A new e2e project is invisible to CI until added by name to that list.
- `changes` path-filter gates `test`/`e2e`/`fallow` with the NEGATIVE `if:`
  (`!= 'false'`). `ci` aggregate is `if: always()`, fails on `failure`/`cancelled`,
  TOLERATES `skipped`. Job id AND name are exactly `ci` (the one required check on
  the PR-only `main`).
- Plugin unit config: `environment: jsdom`, `testTimeout/hookTimeout: 30000`
  (raised specifically because a cold `performCompilation` flaked on Windows-arm64).
- e2e configs: `environment: node`, `pool:'forks'`, `singleFork:true`,
  `fileParallelism:false`, `sequence.concurrent:false`, `testTimeout:300000`.
- Integration specs run a COLD `performCompilation` per file (ESM load + whole-
  program no-emit check); these are the suite's only known flake source.
- Versioning: `test`/`ci`/`chore` commits do NOT bump the package; only
  `feat`/`fix` touching `packages/angular-typechecker/` do.

---

## D1 -- Test substrate

**Position: in-memory `createTreeWithEmptyWorkspace()` for ALL generator and any
mid-tier executor unit/integration specs; reserve real-disk (`fs`+`execSync`
against a generated/installed workspace) for the e2e tier ONLY; do NOT author the
bespoke `createFsTree`/`flushFsTreeChanges` deep-import helper in this milestone.**

From the CI/DevEx lens the substrate choice is really a question of *where each
test runs and how reliably it runs cross-platform*:

- In-memory `createTreeWithEmptyWorkspace` is pure, in-process, no disk I/O, no
  teardown. It runs identically on all six matrix cells including Windows-arm64,
  and adds near-zero latency. It is the correct substrate for the `test` matrix,
  which is meant to be the FAST cross-OS gate. (NX-FSTREE-INTERNALS S9 tradeoff
  table: in-memory = no I/O, no teardown, safe in parallel.)
- Real-disk `FsTree` via `nx/src/generators/tree` is an INTERNAL deep import. Its
  cross-platform hazards land squarely in this lens: NX-FSTREE-INTERNALS notes the
  root must be normalized to NATIVE separators for Windows, and CONNECT-TECHNIQUES
  S7 logs the exact Windows file-handle / daemon-lock / cross-drive ENOENT family
  that real-disk + execSync workspaces suffer. Putting that on the *matrix* (which
  includes two Windows cells) imports flake into the fast gate for a generator
  whose entire behavior is a `project.json` edit fully captured in memory.
- The bespoke helper also adds a maintenance surface that the CI must carry: an
  eslint quarantine and a drift tripwire (NX-FSTREE-INTERNALS S8). The drift file
  would join the `typecheck-drift` inputs and re-run per matrix cell. That is six
  extra executions of a tripwire guarding a helper the generator does not need
  (CURRENT-AUDIT Recommendation 2 reaches the same conclusion on test-design
  grounds; my lens reaches it on flake + matrix-cost grounds).
- Real-disk fidelity that genuinely matters ("the generated target actually RUNS")
  is bought MORE faithfully and MORE cheaply at the existing Linux-only e2e tier
  via the proven `npm pack` + tmp-install + `execSync('npx nx g ...')` harness
  (CURRENT-AUDIT B.3 route 2) -- one OS, serialized, where the Windows hazards are
  not even on the runner.

Net: keep the matrix pure/in-memory; keep disk in the serialized Linux e2e job.

Facts missing (orchestrator can verify): the wall-clock delta of one cold
`performCompilation` integration spec on a `windows-latest` GitHub runner (the
matrix's slowest realistic cell) vs ubuntu -- to size how much catalog growth the
matrix can absorb (feeds D2/D5).

Would change my mind: if a generator requirement emerges whose observable behavior
CANNOT be asserted on an in-memory Tree (e.g. the generator shells out to read its
own emitted files mid-run) AND that behavior must be proven cross-OS rather than
Linux-only -- then a quarantined `createFsTree` becomes justified, but I would
still keep it OUT of the Windows/macOS matrix cells.

---

## D2 -- Diagnostic coverage

**Position: organize as per-introduction-version integration files
(`extended.angularNN.integration.spec.ts` / `baseline.angularNN.integration.spec.ts`)
matching the established v13 convention; committed fixtures (not programmatic
injection); assert exact `code` + `.category`. From the CI lens, ADD A WATCHDOG ON
MATRIX LATENCY: bound the number of cold `performCompilation` files and/or warm the
compiler, because every new integration file multiplies across all 6 cells and the
cold compile is the suite's known flake source.**

This is the decision with the largest CI blast radius, because integration specs
auto-join the 6-cell matrix (CURRENT-AUDIT A.4: "land AUTOMATICALLY in the `test`
job"). Closing the 14 missing extended codes + ~9 missing baseline codes means
~20+ new `it`s, each triggering a cold `performCompilation` (the exact operation
that forced `testTimeout` from 5000ms to 30000ms on Windows-arm64, per the
vitest.config comment). The latency and flake of that gate scale with file/`it`
count TIMES six cells.

Lens-driven choices among the otherwise-equivalent options:
- DATA-TABLE within a per-version file (`it.each` over `[name, code, fixture]`)
  over one-file-per-code: fewer Vitest files = fewer cold module loads under the
  parallel pool = less Windows timeout exposure. Angular's own prior art is ONE
  centralized integration spec with many `it`s (CURRENT-AUDIT Part C), which also
  argues against file-per-code proliferation.
- COMMITTED fixtures over programmatic AST injection (jscodeshift / `execSync nx
  generate`): committed fixtures need no `nx generate` subprocess, no
  `NX_DAEMON=false` discipline, no fixture-dir-vs-gitignore trap (SANDBOX S9), and
  no shared-fixture lock. The repo already uses committed `fixtures/<scenario>/`.
  Programmatic injection (SANDBOX) is execSync-heavy and belongs nowhere near the
  cross-OS matrix; committed fixtures keep the matrix hermetic and fast.
- If aggregate cold-compile time threatens the matrix, prefer a SHARED warm
  program / reusing one `performCompilation` per fixture-set over re-spreading the
  set across more cells. (A reliability watchdog, not a hard requirement yet.)

Facts missing: current `test`-job wall-clock per cell today (especially the two
windows cells and macos), so the orchestrator can set a latency budget for the
catalog before it is written. Also: whether `performCompilation` setup can be
shared across `it`s within a file without cross-test diagnostic bleed.

Would change my mind: if measured per-`it` cold-compile cost on Windows is low
(say <2s) and total added matrix time is small, the latency watchdog is
unnecessary and any organization (incl. one-file-per-code) is fine.

---

## D3 -- Executor-against-workspace test (mid-tier)

**Position: add ONE thin mid-tier spec that runs the executor against a
hand-built `ExecutorContext` + an in-memory `createTreeWithEmptyWorkspace`-seeded
project, placed in the in-plugin `test` matrix. Do NOT make it a real-disk or
subprocess test. Keep the heavyweight "installed executor actually runs" proof at
the existing e2e tier.**

CURRENT-AUDIT A.2 identifies a real gap: the executor jumps from seam-mocked unit
straight to full-tarball e2e, with `context.root` -> `tsConfig` resolution and
`normalizeOptions`-against-a-real-`project.json` proven ONLY on the Linux-only e2e
job. From the CI lens this is a feedback-latency problem: a regression in context/
path resolution is currently invisible on the fast 6-cell matrix and only fails in
the slow Linux e2e tier (or post-merge). Pulling a cheap in-memory version of that
check into the matrix gives cross-OS, sub-second coverage of path-resolution logic
that is genuinely OS-sensitive (separators, `joinPathFragments`).

It must stay in-memory / in-process: a real-disk or `execSync` mid-tier would
reintroduce the Windows hazards (D1) into the matrix and blur the line with the
e2e tier. One spec is enough; this is gap-closure, not a new tier.

Facts missing: whether the executor's path resolution can be exercised without a
real compiler run (i.e. mock `runTypecheck` but use a real context/tsConfig
resolution path) -- if the resolution is entangled with the compiler call, the
mid-tier value shrinks.

Would change my mind: if `context.root`/`tsConfig` resolution is already fully
covered by `normalize-options.spec.ts` + the e2e matrix such that the mid-tier
adds no NEW failing-mode coverage, drop it (net-zero matrix cost is the only thing
that would keep it).

---

## D4 -- Generator e2e

**Position: test the generator end-to-end by EXTENDING the existing
`angular-typechecker-install-e2e` project (add a generator spec there), NOT by
creating a new e2e project and NOT by introducing Verdaccio. Keep it Linux-only,
serialized, in the existing `e2e` job. The in-memory generator unit specs (D1) are
the cross-OS coverage; the e2e is a single Linux smoke that `nx g` wires a target
that then runs.**

CI-lens reasoning:
- A NEW e2e project is a CI liability: it is invisible until added BY NAME to the
  `e2e` job's explicit `-p` list (CURRENT-AUDIT A.4; FACTS S5). That explicit list
  is deliberate (RD-03, "consistent gate meaning"), so every new project is a
  manual ci.yml edit + an `implicitDependencies: ["angular-typechecker"]` wiring
  to force the tarball build. Each new e2e project also adds a fresh `nx build` +
  `npm pack` + `npm install` cycle (300000ms-class timeouts, serialized) to the
  critical path of the single required `ci` check. Extending install-e2e reuses
  the tarball that job ALREADY packs/installs -- near-zero added CI surface, no
  ci.yml edit, no new explicit-list entry to forget.
- REJECT Verdaccio: CURRENT-AUDIT B.3 + the dev-tree-2.x notes flag the scaffolded
  `start-local-registry.ts` `execFileSync(nx)` as Windows-broken, and it adds a
  second e2e mechanism to maintain. The repo's `npm pack` + tmp-install path is
  proven and Linux-only-clean. One e2e mechanism is a DevEx win.
- Keep it Linux-only: the generator's cross-OS correctness (path separators via
  `joinPathFragments`) is already covered by the in-memory unit specs on the
  matrix (D1). Re-running the slow tarball+generate path on Windows/macOS buys
  little and would either bloat the e2e job or force a new matrix.

Facts missing: the current wall-clock of the `e2e` job and how much an added
`execSync('npx nx g ...')` + on-disk `project.json` assertion + one `nx run`
adds to install-e2e specifically (it reuses the already-installed tarball, so this
should be small, but the orchestrator can confirm).

Would change my mind: if the milestone scope drops the generator (see D6) -- then
there is no generator e2e to add. Also, if extending install-e2e is impossible
because the generator e2e needs a DIFFERENT installed workspace shape that would
contaminate the existing install smoke, then a dedicated project (with the ci.yml
`-p` edit) becomes the lesser evil.

---

## D5 -- CI mapping (primary lens)

**Position:**
1. **In-plugin generator unit specs + the NG8xxx catalog integration specs + the
   D3 mid-tier spec: route to the existing 6-cell `test` matrix automatically via
   the include glob. NO ci.yml change.** This is correct: these are fast,
   hermetic, in-memory/committed-fixture tests whose cross-OS behavior we WANT
   exercised (path separators, ESM compiler load on Windows-arm64).
2. **Generator e2e: route into the existing `e2e` job by extending install-e2e
   (D4), so NO new `-p` entry and NO new project.** If the board overrides D4 and
   creates a new e2e project, then the ci.yml `-p` list MUST be edited by name and
   the project MUST carry `implicitDependencies: ["angular-typechecker"]` -- and
   that edit needs review because a forgotten entry silently drops the gate.
3. **Drift tripwire: only if D1's bespoke `createFsTree` is authored** -- add its
   path to `typecheck-drift` inputs (covered by the same matrix run-many). With the
   in-memory default, no new drift gate, no extra matrix work.
4. **Preserve the aggregate `ci` invariants.** None of the above touches the
   `needs:` array semantics. The catalog growth stays inside `test`; the generator
   e2e stays inside `e2e`; both are already `needs:` of `ci`. The path-filter's
   negative-`if` + `skipped`-tolerant aggregate keeps planning-only PRs green. The
   one thing to PROTECT: do not add a job that is `needs:`-ed by `ci` but can be
   legitimately `skipped` in a way that should fail -- the aggregate tolerates
   `skipped`, so any NEW required sub-gate must fail via `failure`, never by being
   skipped.

CI-lens watch-items this milestone introduces:
- **Matrix latency creep** from the catalog (D2): the 6-cell fan-out multiplies
  every new cold-compile `it`. Monitor `test`-job duration; this is the feedback-
  latency risk for the whole team since `ci` is the sole required check.
- **Windows-arm64 dev parity**: dev is Windows-arm64 but the matrix's Windows
  cells are `windows-latest` (x64) and macos is arm64. arm64-specific flake (the
  ESM/path family that already forced the 30000ms timeout) can appear locally yet
  pass CI. Keep the raised timeouts and in-memory substrate to minimize this gap;
  arch is correctness-irrelevant for a pure-JS ngtsc check (ci.yml comment), so no
  arm64 runner is warranted -- but local-vs-CI divergence is a known DevEx tax.
- **Versioning**: catalog + generator-test commits are `test`/`feat`-typed; only a
  `feat` touching `packages/angular-typechecker/` (the generator code itself)
  bumps the package. Pure test-only work produces no release -- expected, no action.

Facts missing: per-cell `test`-job duration today and the projected delta from the
full catalog; whether `windows-latest` runners are x64-only (assumed) so I can
quantify the dev(arm64)-vs-CI(x64) parity gap.

Would change my mind: if the orchestrator decides the catalog should run on FEWER
cells (e.g. integration specs Linux-only, unit specs on the full matrix) to cap
latency -- that is a reasonable CI-lens alternative I would support, but it
requires SPLITTING the `test` target (integration vs unit) so the matrix can run a
subset, which is a bigger ci.yml change than "glob auto-routes everything."

---

## D6 -- Scope

**Position: the `typecheck-configuration` generator BELONGS in this milestone
(it is the milestone's named scope), but from the CI/DevEx lens, SEQUENCE and
BOUND the testing work so the single required `ci` check stays fast and the
gate's meaning stays stable. Priority order by CI value: (1) the generator + its
in-memory unit specs (matrix, no ci.yml change, cheap); (2) the executor mid-tier
spec (D3, gap-closure, cheap); (3) the NG8xxx catalog (D2, HIGH matrix-latency
blast radius -- do with a latency budget); (4) the generator e2e by extending
install-e2e (D4, Linux-only, small). DEFER anything requiring a new e2e project,
Verdaccio, or the bespoke real-disk helper unless a concrete need forces it.**

Rationale from this lens: the work that is "free" to CI (auto-routed, in-memory,
cross-OS-safe) should land first and fully; the work with real CI cost (catalog
latency on 6 cells, a possible new e2e project + ci.yml edit) should be bounded and
sequenced so it does not silently inflate the one required check or the e2e
critical path. The catalog is the only item that can degrade team-wide feedback
latency, so it is the one to gate on a measured budget rather than ship open-ended.

Facts missing: whether the milestone REQUIRES 100% of the 18 extended +
all baseline codes asserted this cycle, or whether a representative subset closes
scope (this directly sets the matrix-latency cost). Also whether the generator
must support all 5 project types now (app/local-lib/buildable/publishable/spec)
-- CONNECT-TECHNIQUES + CURRENT-AUDIT both flag buildable/publishable/spec as
UNCOVERED prior art / a fresh-design GAP, which expands generator-test scope.

Would change my mind: if the orchestrator confirms the catalog is mandatory and
complete this milestone AND per-cell cold-compile cost is high, I would push to
split the `test` target so integration specs run Linux-only while unit specs keep
the full matrix -- trading some cross-OS catalog coverage for a fast required `ci`.

---

```
POSITIONS
D1: In-memory createTreeWithEmptyWorkspace for matrix tests; real-disk only at the Linux e2e tier; do NOT author the bespoke createFsTree this milestone.
D2: Per-introduction-version files + committed fixtures + exact code/category, but consolidate via it.each data tables and gate the catalog on a matrix-latency budget (cold performCompilation x 6 cells is the flake/latency risk).
D3: Add one thin in-memory mid-tier executor-vs-context spec on the matrix to pull OS-sensitive path resolution into the fast cross-OS gate; keep real-run proof at e2e.
D4: Test the generator e2e by EXTENDING install-e2e (Linux-only, reuse the packed tarball); no new e2e project, no Verdaccio.
D5: Auto-route in-plugin specs to the 6-cell test matrix (no ci.yml change); keep generator e2e inside the existing e2e job; preserve ci-aggregate semantics; watch matrix latency and the arm64-dev/x64-CI parity gap.
D6: Generator is in-scope (it is the milestone); sequence by CI cost (cheap auto-routed work first, latency-heavy catalog bounded), defer new-e2e-project/Verdaccio/real-disk-helper unless forced.
FACTS-NEEDED: Per-cell test-job wall-clock today and projected delta from the full NG8xxx catalog; cost of one cold performCompilation it on windows-latest vs ubuntu; whether windows-latest runners are x64 only (dev-arm64 parity gap); added e2e-job time from an execSync nx-g spec inside install-e2e; whether the milestone mandates the COMPLETE catalog (all 18 extended + baseline) this cycle and all 5 project-type generator shapes.
WOULD-CHANGE-MIND: D1: a generator behavior unprovable in-memory that must also be proven cross-OS. D2: measured per-it cold-compile cost low -> latency watchdog unneeded. D3: path resolution already fully covered by normalize-options + e2e -> drop it. D4: generator dropped from scope, or install-e2e cannot host it without contaminating the smoke. D5: decision to run the catalog on fewer cells -> split the test target (integration Linux-only). D6: catalog mandatory+complete AND high per-cell cost -> split test target so integration is Linux-only while unit stays full-matrix.
```
