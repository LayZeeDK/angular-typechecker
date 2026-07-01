# C4 -- CI / cross-platform / performance / DevEx lens (Round 2)

LENS: CI job mapping, the 6-cell `test` matrix + Linux-only `e2e` job, cross-platform
reliability (Windows-arm64 dev vs x64 CI), feedback latency, the single required `ci` check.
I judge D1-D6 by CONSEQUENCES for the CI graph and feedback loop, not test-design elegance.
A HOLD requires a fact the reconciliation gets wrong; principle alone is not enough.

Verdict: CONVERGE on all eight. The facts verified after round 1 resolve every CI-lens
concern I raised, and three of them trip my own round-1 mind-change triggers.

---

## D1 -- substrate: CONVERGE

In-memory `createTreeWithEmptyWorkspace` for generator unit tests; do not author
`createFsTree`/`flushFsTreeChanges`. This is exactly my round-1 position. In-memory is pure,
in-process, no disk I/O, no teardown -- runs identically on all six matrix cells including the
two Windows cells, adds near-zero latency, and avoids the real-disk + execSync Windows
file-handle/daemon-lock/cross-drive hazard family on the fast gate. Not authoring the bespoke
deep-import helper also keeps a drift tripwire OFF the `typecheck-drift` inputs that re-run per
cell. Decision B (generator edits `project.json` only, emits no read-back file, no per-type
branching) means there is no generator behavior that requires a real disk to observe. No fact
sustains a HOLD.

## D2-organization -- single enum-keyed data table: CONVERGE (concede from round 1)

Round 1 I argued for per-introduction-version files (matching the `angular13` convention).
**Fact A7 overrides that:** the would-be `executor.angular17.*` file was ALREADY renamed to an
`extended.promotion` file because its introduction-version signal was false -- only `angular13`
is populated today. The per-version taxonomy has observably rotted in this very repo, so
keying the catalog on version invites the same false signal again. A single `it.each` table
keyed on the `ExtendedTemplateDiagnosticName` enum (introduction-version as a row FIELD, not a
file split) is also better for my lens: fewer Vitest files = fewer cold module loads under the
parallel pool = less Windows-cell timeout exposure. The version-file argument cannot stand
against A7. CONVERGE.

## D2-scope -- all 18 + baseline by code+category+count, +1 promotion: CONVERGE

My round-1 worry was matrix latency: every new cold-compile `it` multiplies across 6 cells,
and the cold compile is the suite's only known flake source (it forced `testTimeout` to
30000ms on Windows-arm64). **Fact A1 settles it:** one real `performCompilation` is ~0.5s
(gate-b cold = 529ms); ~18 fixtures add ~9s of compile WORK per cell, parallelized across
Vitest workers, against a current suite that runs 155 tests in 8.75s wall-clock. My own
round-1 mind-change trigger was "per-`it` cold-compile cost low (<2s) -> latency watchdog
unneeded." 0.5s is well under 2s. The full catalog is affordable on every cell, including
Windows, given the existing 30000ms margin. The latency watchdog I proposed is unnecessary;
the complete catalog can ship without a budget gate. CONVERGE. ("Batch fixtures per program
where practical" further reduces cold loads -- strictly helps my lens.)

## D2-tripwire -- catalog rows === enum members, in `test`: CONVERGE

A completeness tripwire that asserts the catalog covers exactly the 18 enum members is a pure,
in-memory, sub-millisecond assertion (reads the enum + the catalog table; no compiler run). It
auto-routes into the 6-cell matrix via the include glob with no `ci.yml` change and negligible
latency, and it catches catalog drift when a future compiler-cli adds/removes an extended
diagnostic. Zero CI cost, real guard value. No fact opposes it. CONVERGE.

## D3 -- no separate mid-tier; fold the case into the unit spec: CONVERGE (trigger met)

Round 1 I supported ONE thin in-memory mid-tier spec to pull OS-sensitive `context.root` ->
`tsConfig` resolution into the fast cross-OS matrix, conditioned on it covering a NEW failing
mode. **Fact A4 trips my stated mind-change trigger exactly:** `context.root` -> `tsConfig` is
a pure two-branch function in `normalize-options.ts`
(`isAbsolute(tsConfig) ? tsConfig : joinPathFragments(context.root, tsConfig)`) with
`normalize-options.spec.ts` already present, and NO executor-only resolution branch was found
that is unreached by that unit spec + the e2e tier. My round-1 D3 said: "if resolution is
already fully covered by normalize-options + e2e -> drop it." It is. A separate tier would add
matrix surface with no new failing-mode coverage. §D's instruction -- if a `context.root`-
relative case is missing, add it to `normalize-options.spec.ts` (unit), not a new tier -- is
the right, cheaper placement and keeps it on the matrix anyway. CONVERGE.

## D4 -- one generator scenario inside install-e2e, --skip-nx-cache, no new project/Verdaccio: CONVERGE

This is my round-1 position, now confirmed feasible by **fact A6**: `install-e2e`'s
`consumer-app` already has the target pre-wired, so hosting a generator e2e needs only (a)
shipping `generators.json` + the generator and (b) adding an UN-WIRED project to the fixture to
run `nx g` against -- a small fixture addition, not a new e2e project. This means NO new `-p`
entry to forget, NO `ci.yml` edit, NO `implicitDependencies` wiring, and it reuses the tarball
that job already packs/installs -- near-zero added CI surface on the serialized Linux critical
path. `--skip-nx-cache` (failure-modes' addition) is correct: it prevents the generate->run
step reading a stale cached result and matches the existing e2e discipline (`NX_DAEMON:false`,
`singleFork`). Rejecting Verdaccio keeps one e2e mechanism (the proven `npm pack` + tmp-install
path; the scaffolded Verdaccio `start-local-registry` is Windows-broken). CONVERGE.

## D5 -- no ci.yml change for in-plugin specs; e2e rides install-e2e; add -p-list guard; single ci gate; no test-target split: CONVERGE

Every clause matches my lens:

- In-plugin specs (generator unit, catalog integration, tripwire) auto-route into the 6-cell
  matrix via the include glob with no `ci.yml` edit -- correct, and A1 confirms the matrix
  absorbs the catalog comfortably.
- **No `test`-target split:** my round-1 D5 mind-change trigger for splitting was "catalog
  mandatory+complete AND high per-cell cost." A1 shows per-cell cost is LOW (~0.5s/fixture,
  parallelized), so the trigger is NOT met. Keeping one `test` target preserves full cross-OS
  catalog coverage (Windows-arm64 ESM-load + path-separator behavior is exactly what we want
  exercised) and avoids a bigger `ci.yml` change. CONVERGE on no split.
- **The `-p`-list set-equality guard** (failure-modes' addition, justified by **fact A5** --
  no such guard exists): from the CI lens this is the highest-value cheap guard in the set. The
  `e2e` job's explicit `-p` list is a silent-gate-drop hazard -- a new e2e project is invisible
  to `ci` until added by name. A test asserting `-p` list === the e2e projects in the graph is
  fast, Linux-runnable, and converts that silent failure into a loud one. I endorse it.
- Single `ci` aggregate preserved: nothing here touches the `needs:` array or the
  `skipped`-tolerant/`failure`-fails semantics; the catalog stays in `test`, the generator e2e
  stays in `e2e`, both already `needs:` of `ci`.

CONVERGE.

## D6 -- generator in scope at decision-B shape; scope = unit + schema parity + 18-member catalog + tripwire + one folded generator e2e + -p guard; exclude createFsTree/mid-tier/Verdaccio/jscodeshift/cache+mode tests: CONVERGE

The included set is precisely the CI-cheap, hermetic, cross-OS-safe work I wanted prioritized,
plus the one Linux-only folded e2e and the cheap `-p` guard. The exclusions remove every item
that would add real CI cost or a second mechanism: `createFsTree` (drift gate x6 cells +
Windows real-disk flake), the mid-tier (A4: no new coverage), Verdaccio (Windows-broken second
mechanism), the jscodeshift injection toolkit (execSync-heavy, wrong near the matrix), and
cache/`dependsOn`-ordering + quiet/errors-only mode tests (out of scope, added CI surface).
The catalog is no longer open-ended-risk because A1 sized it as affordable. Versioning note
unchanged: pure test work is `test`-typed (no bump); only the `feat` shipping the generator
code under `packages/angular-typechecker/` bumps. No fact sustains a HOLD. CONVERGE.

---

```
ROUND2
D1: CONVERGE
D2-organization: CONVERGE -- fact A7 (the angular17 per-version file already rotted to an extended.promotion file; version is a false signal) overrides my round-1 per-version-files position in favor of the single enum-keyed it.each table.
D2-scope: CONVERGE -- fact A1 (~0.5s/cold-compile, ~9s added work/cell parallelized, vs 8.75s/155-test current suite) is under my <2s round-1 trigger; the full 18+baseline catalog is affordable on all 6 cells, latency watchdog unneeded.
D2-tripwire: CONVERGE
D3: CONVERGE -- fact A4 (context.root->tsConfig is a pure two-branch normalize-options function with a spec, no unreached executor-only branch) trips my round-1 trigger to drop the mid-tier; fold any missing case into normalize-options.spec.ts.
D4: CONVERGE -- fact A6 confirms install-e2e can host the generator scenario via a small un-wired-project fixture addition; --skip-nx-cache correct; no new project, no Verdaccio.
D5: CONVERGE -- fact A1 shows the matrix budget is comfortable, so no test-target split (my round-1 split-trigger not met); fact A5 (no -p-list guard exists) justifies the set-equality guard; single ci gate and aggregate semantics untouched.
D6: CONVERGE
NEW-FACTS-NEEDED: none
```
