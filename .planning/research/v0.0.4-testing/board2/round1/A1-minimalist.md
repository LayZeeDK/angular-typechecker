# A1 -- Minimalist / YAGNI position (Board 2, Round 1)

**Role:** Adversarial testing-strategy advisor. Mandate: argue against any test, tier,
helper, or infrastructure not strictly justified by a VERIFIED gap in FACTS.md sec.3-4.
Cut or defer everything that does not protect correctness today. Still produce the
smallest defensible strategy.

**Frame the whole milestone against the cost of the existing suite.** The repo already
ships 25 in-plugin specs (14 unit + 11 integration), 7 e2e specs across 3 e2e projects,
a build-time drift gate, and 13 committed fixtures, running across a 6-cell matrix plus a
Linux-only e2e job (FACTS sec.3, sec.5). This is already a heavy suite for ~1,777 LOC
(FACTS sec.2). The bar for adding ANY new tier, helper, or project must be: "names a
regression class the current suite cannot catch, for code that will actually exist after
this milestone." Most candidates in the four reports fail that bar.

---

## D1 -- Test substrate

**Position: One substrate only -- the public in-memory `createTreeWithEmptyWorkspace()`
from `@nx/devkit/testing`, used for the generator's unit specs. Do NOT author
`createFsTree`/`flushFsTreeChanges`. Do NOT introduce a real-disk `FsTree` tier or a
`testing/` project.**

**Factual basis:**
- The `typecheck-configuration` generator is a pure `project.json` config edit:
  `readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` ->
  `formatFiles` (FACTS sec.7a; CURRENT-AUDIT B.1). Its entire observable behavior is a
  Tree transformation. The in-memory Tree captures 100% of that (NX-FSTREE sec.9;
  CURRENT-AUDIT Recommendation 2). Nothing in the generator boundary reads disk
  mid-run.
- `createTreeWithEmptyWorkspace` is public, version-stable, zero-quarantine, and is the
  substrate used by 452 generator specs in the Nx repo itself (FACTS sec.6;
  NX-FSTREE sec.6b). The sandbox's committed generator spec uses exactly this -- 46
  lines, in-memory, no flush, no teardown (SANDBOX sec.2). The `FsTree`/`flushChanges`
  real-disk approach was PROPOSED but NEVER adopted in the sandbox (SANDBOX sec.9 item 5).
- `FsTree`/`flushChanges` are NOT in any public `@nx/devkit` barrel; reaching them needs
  the deep import `nx/src/generators/tree`, which forces an eslint-disable quarantine
  file PLUS a drift tripwire to be maintained (NX-FSTREE sec.0, sec.8;
  CURRENT-AUDIT A.5). That is three new maintenance surfaces (quarantine file, lint
  exception, drift spec wired into `typecheck-drift` inputs) bought to gain real-disk
  fidelity the generator does not need.
- Real-disk fidelity that IS wanted ("the generated target actually runs") already exists
  at the tarball e2e tier -- `matrix-5types.int.spec.ts` runs the installed executor
  against all five project types on real disk (FACTS sec.3; matrix-e2e source confirmed:
  application, local non-buildable lib, buildable lib, publishable lib, spec-tsconfig).
  Buying it again via a quarantined `FsTree` tier is redundant.

**The "drift documentation" must NOT drive delivery.** PROJECT.md carries a v0.0.1
carry-over that `createFsTree`/`flushFsTreeChanges` were "planned but not delivered"
(CURRENT-AUDIT A.5). The minimalist resolution is to CLOSE that as "superseded by the
public `@nx/devkit/testing` helper," not to discharge it by authoring the bespoke wrapper.
A planned-but-undelivered artifact with no consumer is the textbook YAGNI cut.

**Facts missing (orchestrator can verify):** none material. The substrate question is
settled by the generator's shape, which is already known from prior art.

**Would change my mind:** a concrete generator behavior that an in-memory Tree cannot
model -- e.g. the generator shells out to read its own emitted file mid-run, or it must
create a `tsconfig` on disk that a real `ngc`/`tsc` reads WITHIN the generator's execution
(not in a separate executor run). FACTS sec.7a says it does none of this (33-line sandbox
generator: no `generateFiles`, no project-type detection). If the milestone scope
expands the generator to emit a real tsconfig file consumed in-process, revisit -- but
even then, the cheaper proof is the existing tarball e2e, not a real-disk `FsTree` tier.

---

## D2 -- Diagnostic coverage

**Position: Assert the diagnostics by exact code + category ONLY where it protects a
behavior the tool actually promises, using committed fixtures and a single data-driven
table -- NOT one-file-per-Angular-version. Reject "assert all 18 (or 16) extended +
every baseline NG/TS code" as a blanket goal. The verified gap is the MECHANISM
(warning-by-default vs promoted-to-error, and the all-getter gatherer surfacing each
phase), not exhaustive per-code enumeration.**

**Factual basis:**
- The tool returns a structured `CoreResult` with per-diagnostic `code`, `errorCount`,
  `warningCount`, `suppressedCount`, `templateCheckAborted`, and `toExitCode` maps to
  0/1/2 (FACTS sec.2). Its CONTRACT is: surface the complete diagnostic set, count by
  category, map to an exit code. The contract is NOT "recognize each of 18 named extended
  checks individually" -- angular-typechecker does not implement those checks; the
  compiler does. Per-code assertions test ANGULAR's compiler, not this plugin.
- The repo already proves the load-bearing mechanisms by exact code:
  - NG8101 WARNING-by-default, counted in `warningCount` not `errorCount`
    (`extended.angular13.integration.spec.ts`, verified: finds `code === NG(8101)`,
    asserts `.category === Warning`, `errorCount === 0`).
  - NG8101 PROMOTED to Error via `extendedDiagnostics.defaultCategory: "error"` + the
    count invariant (`extended.promotion.integration.spec.ts`; FACTS sec.3,
    CURRENT-AUDIT A.3).
  - NG8109 in a real pass alongside TS2322 (`run-typecheck.integration.spec.ts`,
    `gate-b.spec.ts`).
  - The all-getter gatherer surfacing every phase, plus TCB fault-isolation (NG3004),
    global diagnostics (TS2318), no-emit overrides, TS99-leak suppression -- all already
    covered (CURRENT-AUDIT A.1, A.3).
  So the WARNING/Error-promotion mechanism and the all-getter gatherer are ALREADY
  proven. Adding NG8102..NG8117/NG8021 each re-proves the SAME two mechanisms with a
  different trigger string.
- The sandbox itself only asserted `success === false` per code -- it never asserted
  exact code/count, and it ran one fixture per code purely to prove failure
  (SANDBOX sec.4 CAVEAT). The "every NG8xxx by exact code" goal is BEYOND what any prior
  art demonstrates was load-bearing; it is an aspiration in the catalog
  (CURRENT-AUDIT PART C), not a regression class.
- Angular's OWN tests put exhaustive per-check coverage in per-check UNIT specs against
  the internal check factory -- a layer this repo CANNOT access (it runs public
  `performCompilation`) (CURRENT-AUDIT PART C). So per-check exhaustiveness is structurally
  Angular's job, not this plugin's.

**The minimal defensible coverage delta:**
1. Keep the existing exact-code assertions (NG8101 warning + promotion; NG8109).
2. Add at MOST a small representative set that exercises a DISTINCT mechanism the current
   suite does not: pick ~2-3 extended codes whose categories/behaviors differ in a way the
   tool's counting/exit logic must handle (e.g. one more default-WARNING extended code to
   prove the gatherer is not NG8101-specific; one baseline NG error code to prove a
   real-compiler-emitted NG error lands in `errorCount` and drives exit 1). NG8001 baseline
   is already covered, so the baseline-NG-error path is largely proven too.
3. Use ONE data-driven table (`it.each` over `{ tsConfigPath, code, category, expect }`)
   in a single file -- NOT one file per Angular major. The version-split scaffolding
   (`*.angularNN.integration.spec.ts`) is documentation taxonomy; a flat table is fewer
   files, fewer fixtures registered, and a "future Angular major" is still a drop-in row.
   The catalog's "drop-in file per major" framing buys nothing the table does not, and the
   one version-named file that was already mis-tagged (`extended.angular17` renamed to
   `extended.promotion` because its v17 signal was false -- CURRENT-AUDIT A.3) is direct
   evidence the version-naming is fragile.
4. Use committed fixtures (3-file dirs, like `fixtures/extended-v13/`). Do NOT build a
   jscodeshift AST-injection toolkit. The sandbox's 1,373-line `test-fixtures.ts` with 28
   fixtures and jscodeshift helpers (SANDBOX sec.5) is enormous infrastructure justified
   only when fixtures are generated at test time from CLI scaffolds. This repo commits
   static fixtures (FACTS sec.3) -- a new fixture is three small files, verified against
   the live compiler once. No AST machinery needed.

**Facts missing (orchestrator can verify):**
- Which of the 18 extended codes have a category/counting behavior NOT already exercised
  by the NG8101-warning and NG8101-promoted cases? If the answer is "none -- all 18 are
  warning-by-default and all promote the same way," then exactly ONE additional extended
  code is justified (to disprove NG8101-specificity), and the other 13-17 are pure
  enumeration of Angular's behavior. (FACTS sec.4 strongly implies they share the
  warning-default mechanism.)
- Does any baseline NG code (NG2003/2005/2007/2009/1001/3003/6100/8002/8004) flow through
  a DIFFERENT counting/exit path than NG8001 (already covered) or NG3004 (already covered
  as TCB-fatal)? If not, baseline enumeration is also redundant.

**Would change my mind:** evidence that the tool itself BRANCHES on specific NG codes
(e.g. a hard-coded suppression list, per-code remapping, or category overrides keyed by
code) -- then each branched code is a real code path in THIS repo and deserves a test. The
only code-specific branch in evidence is NG3004 (TCB-fatal -> SUPPRESSED), and it is
already covered (CURRENT-AUDIT A.1 fault-isolation). Absent more such branches, exhaustive
per-code testing is testing Angular, not angular-typechecker.

---

## D3 -- Executor-against-workspace test (mid-tier)

**Position: Do NOT add a mid-tier "executor against a constructed
`ExecutorContext`/workspace" spec. Cut it.**

**Factual basis:**
- The reports flag a "gap" between the seam-mocked `executor.spec.ts` and the tarball e2e
  (CURRENT-AUDIT A.2, item (3) in recommendations). But the three things this mid-tier
  would prove are ALREADY covered:
  1. `context.root` + `tsConfig` -> real on-disk path resolution: proven by
     `install-smoke` and `matrix-5types` (FACTS sec.3; CURRENT-AUDIT A.2 explicitly says
     (1) and (3) are covered at e2e).
  2. `normalizeOptions` against options: covered by the pure `normalize-options.spec.ts`
     (FACTS sec.3).
  3. Executor binds under its PUBLISHED id: proven by the tarball e2e (the executor only
     resolves if `executors.json` + the published id are correct).
- So the mid-tier spec would re-prove path resolution (already e2e-proven) and option
  normalization (already unit-proven) with no new regression class. The "gap" is an
  aesthetic pyramid-completeness argument (CONNECT sec.7 notes NO single prior-art branch
  had a complete pyramid -- and that was fine), not a correctness gap.
- The Connect prior art's mid-tier (`runExecutorInWorkspace`) existed primarily to support
  `quiet`-mode STDERR-text assertions (CONNECT sec.4b), a feature NOT in this milestone's
  scope (FACTS sec.1 names only the generator + testing).

**Facts missing:** Is there ANY executor behavior (context resolution, option mapping)
that is currently UNTESTED at both the unit and e2e tiers? CURRENT-AUDIT A.2 says no --
(1)/(3) are e2e-covered, (2) is unit-covered. If the orchestrator finds a specific
resolution branch covered nowhere, that ONE branch could justify a narrow test -- but not
a whole new tier.

**Would change my mind:** a concrete executor code path (e.g. context.root vs cwd
disambiguation, a target-default tsConfig fallback inside the executor) that neither the
mocked unit spec nor the tarball e2e exercises. Then add ONE targeted spec for that path
on the in-memory substrate -- still not a standing "mid-tier" tier.

---

## D4 -- Generator e2e

**Position: Do NOT create a new e2e project. Add at most ONE thin generator scenario to
the EXISTING `install-e2e` project, and only if D6 keeps the generator in this milestone.
Reject Verdaccio entirely.**

**Factual basis:**
- A new e2e project must be added by NAME to the `e2e` job's explicit `-p` list in
  ci.yml, needs its own `project.json` with `implicitDependencies: ["angular-typechecker"]`,
  its own vitest config (pool:forks, singleFork, 300s timeouts, NX_* strip), and joins the
  serialized Linux-only run (FACTS sec.5; CURRENT-AUDIT A.4). That is real standing cost
  per project.
- The existing `install-e2e` project ALREADY packs the tarball, installs into a temp
  consumer, and runs the executor (FACTS sec.3). Adding `execSync('npx nx g
  angular-typechecker:typecheck-configuration <proj>')` + asserting the resulting
  on-disk `project.json` is one more `it` in a harness that already pays the pack/install
  cost in `beforeAll` (CURRENT-AUDIT B.3 route 2). Marginal cost: one spec, zero new CI
  wiring, zero new project.
- The generator's Tree transformation is already fully covered in-memory (D1). The ONLY
  thing a generator e2e adds is "the generator resolves from the INSTALLED package and
  writes a target that then RUNS." That is a single smoke assertion, not a project.
- Verdaccio is explicitly rejected by the repo's own posture: the repo uses direct
  `npm pack` + tmp install, NOT a local registry, and the scaffolded Verdaccio path is
  known-broken on Windows (`execFileSync(nx)` ENOENT) (CURRENT-AUDIT B.3;
  CONNECT sec.7 Windows gotchas). Introducing Verdaccio is new infrastructure for zero
  benefit over the existing pack/install mechanism.

**Facts missing:** Does the `install-e2e` `beforeAll`/harness expose a generated consumer
project that a generator scenario can target without a second scaffold? (CURRENT-AUDIT
B.3 implies the harness already scaffolds a consumer; confirm it can host an
`nx g` + assert + `nx run` sequence without a fresh workspace per scenario.)

**Would change my mind:** if the generator e2e cannot share the existing `install-e2e`
harness (e.g. it needs a `create-nx-workspace` consumer that the install harness does not
build, and bolting it on would serialize a 4-8 min bootstrap into an already-heavy spec).
Then a dedicated project is the lesser evil -- but still NO Verdaccio, and still gated on
D6 keeping the generator in scope.

---

## D5 -- CI mapping

**Position: Add ZERO CI changes for the in-plugin work. Generator unit specs and any
catalog integration specs land automatically in the existing `test` 6-cell matrix via the
include glob. Only if D4 yields a NEW e2e project (which I argue against) is a one-line
`-p` addition needed.**

**Factual basis:**
- A new `*.spec.ts`/`*.integration.spec.ts` under `packages/angular-typechecker` runs in
  the `test` job with NO ci.yml change -- it matches `vitest.config`'s include glob and
  the existing `nx run-many -t typecheck-drift test` (FACTS sec.5; CURRENT-AUDIT A.4).
- The `test` matrix is 6 cells; the catalog and generator specs run in EVERY cell. This is
  a cost argument FOR keeping the catalog minimal (D2): every fixture/`it` added runs 6x
  in CI (plus integration cold-compile overhead with 30s timeouts -- FACTS sec.3). 14 new
  exact-code integration cases x 6 cells x cold `performCompilation` is a real CI-time
  tax that the minimalist D2 (a handful of representative cases) avoids.
- The `ci` aggregate already fails-closed on `failure`/`cancelled` and tolerates
  `skipped`; the path-filter (`predicate-quantifier: every`) already skips the matrix on
  planning-only PRs (FACTS sec.5). No change needed -- the gate semantics already
  accommodate new in-plugin specs.

**Facts missing:** none. CI mapping is mechanical and the workflow is already structured
to absorb in-plugin specs with no edit.

**Would change my mind:** if a new e2e PROJECT is created (D4) -- then exactly one `-p`
token addition to the `e2e` job is mandatory (a new e2e project is invisible to CI
otherwise -- FACTS sec.5). That is the only CI edit any path here can require.

---

## D6 -- Scope

**Position: KEEP the `typecheck-configuration` generator (it is the milestone's named
deliverable) but ship the SMALLEST version: the 33-line sandbox shape (read config -> set
one target with a defaulted `tsConfig` -> `formatFiles`), in-memory unit tests + schema
parity + one piggybacked e2e scenario. CUT the broad testing expansion: no
exhaustive NG catalog, no FsTree helpers, no `testing/` project, no mid-tier, no Verdaccio,
no jscodeshift toolkit, no per-version file split.**

**Factual basis:**
- FACTS sec.1: the milestone's named scope is "a `typecheck-configuration` Nx generator
  plus testing work." The generator is the deliverable; "testing work" is a means, not a
  mandate to maximize coverage. The generator does not yet exist (FACTS sec.2), so it is
  the one genuinely NEW code path -- and new code DOES deserve tests (its in-memory unit
  spec + schema parity + one e2e smoke). That is the only NET-NEW correctness surface this
  milestone introduces.
- Everything else proposed across the reports (FsTree real-disk tier, mid-tier executor
  spec, exhaustive 18-code catalog, jscodeshift injection, Verdaccio, a new e2e project)
  tests EXISTING code that is already covered by 25 specs + 7 e2e + drift, or tests
  Angular's compiler rather than this plugin (D2). None names a verified regression class
  in shipped code.
- Pre-1.0 versioning: a `feat` (the generator) bumps patch 0.0.3 -> 0.0.4; `test`/`ci`
  commits do not bump (FACTS sec.8). So the version moves on the generator alone -- the
  testing expansion does not even change the released version. That reinforces: the
  generator is the milestone; gold-plated tests are not.
- The generator's idempotency contract (don't clobber an existing target on re-run) IS a
  real behavior worth one test (CONNECT sec.2b; CURRENT-AUDIT B.2). Keep that. The
  per-project-type SHAPE branching (app gets explicit tsConfig, lib defaults) is the only
  defensible complexity, and even that is OPTIONAL for v0.0.4 -- the sandbox shipped a
  single hard-coded `tsconfig.lib.json` default with NO project-type detection
  (FACTS sec.7a; SANDBOX sec.1). Start with the sandbox's single default; add project-type
  branching only if a consumer need is proven.

**Minimal defensible strategy (the smallest that protects correctness):**
1. Generator: sandbox-shape 33-liner (`readProjectConfiguration` ->
   `updateProjectConfiguration` -> `formatFiles`), idempotent (overwrite-or-skip the one
   target), `generators.json` + `generators` package field + build-asset glob + `files`
   entry.
2. Generator unit spec: `createTreeWithEmptyWorkspace` + `addProjectConfiguration` seed +
   read-back `toEqual` on the target; one idempotency case (run-twice-equal); one
   missing-project error case. `skipFormat: true`. (~Sandbox's 46-line spec.)
3. Schema parity: extend the existing `schema-parity.spec.ts` idiom to the generator's
   `schema.json`/`schema.d.ts` (FACTS sec.3; CURRENT-AUDIT B.1).
4. Diagnostic coverage delta (D2): keep existing exact-code assertions; add ~2-3
   representative codes via one `it.each` table over committed fixtures -- NOT 14-18.
5. Generator e2e: ONE scenario piggybacked on `install-e2e` (D4) -- IF the harness can host
   it without a new workspace; otherwise defer to a follow-up.
6. CI: no edits (D5), unless a new e2e project is unavoidable.

**Facts missing:** Does the milestone's "testing work" have an EXPLICIT requirement (in a
REQUIREMENTS/ROADMAP doc) that mandates "every NG8xxx by exact code" or the FsTree
helpers as a contractual deliverable? FACTS deliberately omits recommendations and only
cites the catalog's aspiration. If a LOCKED requirement mandates exhaustive coverage, the
scope floor rises -- but the minimalist reading of "plus testing work" is "test the new
generator + close real gaps," not "enumerate Angular's diagnostics."

**Would change my mind:** a LOCKED v0.0.4 requirement that names exhaustive NG-code
coverage or the bespoke FsTree helpers as an explicit acceptance criterion (not just a
catalog wish). Then those become in-scope by contract -- but I would still push to
implement them with the cheapest mechanism (committed fixtures + flat `it.each` table; and
challenge the FsTree requirement as unbacked by any failing test).

---

```
POSITIONS
D1: One substrate only -- public in-memory createTreeWithEmptyWorkspace for the generator unit specs; do NOT author createFsTree/flushFsTreeChanges and add no FsTree tier or testing/ project.
D2: Assert ~2-3 representative codes by exact code+category via a single it.each table over committed fixtures (keep existing NG8101 warn/promote + NG8109); reject exhaustive 18-extended/all-baseline enumeration and the jscodeshift toolkit and per-Angular-version file split.
D3: Cut the mid-tier executor-against-workspace spec -- path resolution and publish-id binding are already e2e-covered and option normalization is unit-covered.
D4: No new e2e project and no Verdaccio; add at most one generator scenario piggybacked on the existing install-e2e harness, gated on D6.
D5: Zero CI edits for in-plugin specs (they auto-run in the 6-cell test matrix); a single -p token addition only if a new e2e project is unavoidably created.
D6: Keep the generator as the milestone's named deliverable in its minimal 33-line sandbox shape with in-memory unit tests + schema parity + one piggybacked e2e; cut the broad testing expansion as testing-already-covered-code or testing-Angular.
FACTS-NEEDED: Whether any of the 18 extended codes (or baseline NG codes) flow through a category/counting/exit path NOT already exercised by NG8101-warning/NG8101-promoted/NG8001/NG3004; whether the tool branches on specific NG codes beyond NG3004; whether the install-e2e harness can host an `nx g`+assert+`nx run` scenario without a fresh workspace; whether a LOCKED v0.0.4 requirement mandates exhaustive NG-code coverage or the bespoke FsTree helpers as an acceptance criterion; whether any executor resolution branch is covered at neither the unit nor e2e tier.
WOULD-CHANGE-MIND: D1 -> a generator behavior an in-memory Tree cannot model (in-process read of its own emitted file consumed by a real ngc/tsc). D2 -> evidence the tool branches on specific NG codes (per-code suppression/remap/category override) beyond NG3004. D3 -> a concrete executor resolution path covered at neither unit nor e2e tier. D4 -> the install-e2e harness cannot host a generator scenario without a 4-8 min fresh bootstrap. D5 -> a new e2e project is created (forces one -p addition). D6 -> a LOCKED v0.0.4 requirement names exhaustive NG-code coverage or the FsTree helpers as a contractual acceptance criterion.
```
