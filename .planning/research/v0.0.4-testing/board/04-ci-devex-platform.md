# Board member 4 -- CI, DevEx, Platform (Windows-arm64) & Performance

**Lens:** CI job topology, agent/contributor feedback speed, the Node 22/24/26 x 3-OS matrix,
Linux-only scoping, the single required `ci` aggregate check, Nx cache correctness, the nx daemon,
and recurring Windows-arm64 harness mitigations.

**Grounding:** existing `ci.yml` (7 jobs: `changes`, `test`, `e2e`, `fallow`, `act-compat`,
`lint-workflows`, `ci`), the established e2e harness (`buildCleanEnv` / `NX_RUNNER_ENV_KEYS` strip,
`mkdtempSync(tmpdir())`, `pool:'forks'` + `singleFork` + `testTimeout:300000`, `NX_DAEMON:false`),
the plugin's `vitest.config.mts` (`testTimeout:30000` for cold `performCompilation`), and PROJECT.md
`## Current Milestone` (v0.0.4).

---

## D1 -- SUBSTRATE per tier (CI/perf angle)

**Recommendation:** Generator unit/integration -> **in-memory `createTreeWithEmptyWorkspace`** (public
`@nx/devkit/testing`). Generator "does it actually land on disk and run" -> the **existing tarball
e2e** (real disk, real `nx`). Treat the bespoke real-disk `createFsTree`/`flushFsTreeChanges`
(internal deep import) as a deliberately-not-used fallback for v0.0.4.

**Rationale (CI/perf):** the in-memory tree is `FsTree('/virtual')` -- zero disk I/O, no `mkdtemp`,
no `rmSync`, no teardown, fully isolated per call, so it is parallel-safe and cross-platform-identical
on Linux/Windows/macOS x Node 22/24/26. It adds milliseconds to the `test` matrix that already runs 6
cells. The real-disk `FsTree` path costs real I/O on every cell, and on Windows-arm64 it inherits the
exact failure modes the e2e harness already had to fight (file-locking on teardown, path-separator
normalization, the daemon holding handles). For a generator whose entire observable behavior is a
`project.json` config edit, real disk buys no CI signal the e2e tier doesn't already provide end-to-end.
A second internal-deep-import (`nx/src/generators/tree`) would also add a drift-gate target to maintain
per `test`-matrix cell -- cost with no matching benefit.

**Risk:** in-memory misses the "config the generator emits is actually consumable by the real compiler
on disk" proof. **Mitigated** because that proof already exists at the tarball e2e tier
(`install-smoke`/`matrix-5types`), which is higher-fidelity than a real-disk `FsTree` and reuses the
proven harness.

**DISSENT (flagged):** PROJECT.md `## Current Milestone` LOCKS the bespoke FsTree utilities as a named
deliverable ("default leans real-disk wrapper to stay faithful to the prior art") and as the *vehicle*
for the FsTree generator-testing technique. From a CI/perf+platform lens I dissent: the real-disk
wrapper is a cross-platform-fragility and maintenance tax (deep import + eslint quarantine + a new
drift tripwire per matrix cell) that buys nothing the in-memory tree + existing e2e don't already give.
If the milestone insists on authoring the wrapper for prior-art fidelity, confine it to ONE Linux-only
test (where its I/O cost and Windows file-locking are irrelevant) and DEFAULT the generator's
unit/integration specs to the in-memory tree so the 6-cell matrix stays fast and platform-uniform.

---

## D2 -- NG8xxx CATALOG: per-version files vs single data-driven suite (cheaper/faster/less flaky)

**Recommendation:** **Single data-driven suite per introduction-version FILE, fixtures built ONCE and
shared** -- i.e. keep the prescribed `extended.angularNN.integration.spec.ts` file split for taxonomy,
but inside drive the codes via `it.each(catalogForMajor)` over a shared, pre-built fixture set rather
than one bespoke `beforeAll` cold-compile per code.

**Rationale (CI/perf):** the dominant cost is the COLD `performCompilation` (the very reason the plugin
config raises `testTimeout` to 30000ms). Cost scales with the number of distinct compiler invocations,
NOT the number of files. 14 missing extended + ~9 missing baseline codes is ~23 new assertions; if each
gets its own cold compile that is ~23 x (ESM load + whole-program check) per matrix cell x 6 cells.
The lever that actually controls CI time is **compile-once-assert-many**: compile a fixture program once
and find each expected code in the resulting `diagnostics` array (the repo's `NG()` + `find(d => d.code
=== NG(8101))` idiom already does this; `extended.angular13.integration.spec.ts` asserts multiple codes
off one run). Group codes that can co-exist in one `strictTemplates`+`defaultCategory:'error'` program
into a single fixture/compile, and assert each by exact code/category. The file-per-version split is for
human/drop-in organization (cheap); the data-driven `it.each` inside is for assertion density (cheap);
the expensive thing -- cold compiles -- is what you minimize.

**Flakiness across the matrix:** exact-code/exact-category assertions are deterministic and
platform-independent (the compiler emits the same NG codes on every OS/Node). The only matrix flake
risk is the cold-compile timeout on Windows-arm64 -- already mitigated by `testTimeout:30000`; keep that
ceiling (raise to 45000 only if a real timeout appears, do not lower it). Avoid asserting on rendered
message TEXT (locale/format drift); assert code + `.category` only, which the repo already mandates.

**Parallelism:** the plugin `test` target currently runs the DEFAULT vitest pool (no `singleFork`), so
integration spec files already parallelize across workers. Adding cold compiles raises per-cell wall
time roughly linearly with distinct compiles -- another reason to minimize compiles, not files. Do NOT
force `singleFork` on the plugin project (that would serialize all integration specs and balloon the
matrix); the shared-fixture lock pattern from the sandbox is only needed if fixtures are GENERATED at
test time -- this repo uses committed `fixtures/`, so there is no cross-worker generation race to guard.

**Risk:** committed per-code fixtures add repo files and a small `nx build`/discovery surface; trivial
vs. the compile-count cost. One over-stuffed fixture could make a failure ambiguous about WHICH code
regressed -- keep fixtures small and grouped by what legitimately co-triggers.

---

## D3 -- IN-MEMORY EXECUTOR VARIANT: does a fast mid-tier reduce reliance on the slow e2e in CI?

**Recommendation:** **Yes -- add the mid-tier, but it does NOT remove the need for the tarball e2e.**
Add one in-plugin spec that runs the executor against a `createTreeWithEmptyWorkspace`-seeded project +
a hand-built `ExecutorContext`, covering `context.root` -> `tsConfig` path resolution and
`normalizeOptions` against a real `project.json` target -- the layer currently jumped over between
mocked-unit and full-tarball-e2e.

**Rationale (CI/perf):** this lands AUTOMATICALLY in the fast 6-cell `test` matrix (glob match, no
ci.yml edit), runs in-memory (no disk, cross-platform-uniform), and shifts the "executor resolves paths
and binds options correctly" signal LEFT -- agents and contributors get it in seconds on every push,
across all three OSes, instead of only from the Linux-only e2e. That is a real DevEx win: more of the
trust-bearing signal arrives fast and everywhere.

**But it cannot retire the e2e.** The two things ONLY the tarball e2e proves are (1) the executor binds
under its PUBLISHED unscoped id from an installed package, and (2) no `ERR_REQUIRE_ESM` / peer-resolution
failure in a clean consumer install. A `/virtual` in-memory context cannot exercise either -- there is
no installed package, no published id resolution, no real `node_modules`. So the mid-tier REDUCES how
often a regression first surfaces only in the slow Linux-only gate, but the e2e stays as the
publish-fidelity backstop.

**Risk:** importing `@nx/devkit` for a real(ish) context can leave open native-binding/pseudo-terminal
handles that keep the runner alive (nx#26346). **Mitigated** by the repo's existing `NX_DAEMON:false`
in the `test` job and the 30000ms timeout; if a hang appears, raise the timeout before reaching for a
pool change.

---

## D4 -- GENERATOR E2E: extend `npm pack`+tmp-install vs Verdaccio vs FsTree edits (most CI-reliable cross-platform)

**Recommendation:** **Extend the existing `npm pack` + `mkdtempSync` tmp-install harness.** Do NOT
introduce Verdaccio. Do NOT use real-disk `FsTree` edits for the e2e.

**Rationale (CI/perf + platform):** the repo already has a battle-tested tarball harness with every
Windows-arm64/nested-nx mitigation baked in (`buildCleanEnv`, `NX_RUNNER_ENV_KEYS` strip, empty
`.npmrc`, `npm_config_userconfig` to a non-existent path, `NX_DAEMON:false`, `FORCE_COLOR:0`,
`mkdtempSync(tmpdir())` so the workspace is in OS temp NOT the Dev Drive, `pool:'forks'`+`singleFork`+
`testTimeout:300000`). A generator e2e is the same shape as `install-smoke`: pack -> install -> `npx nx
g angular-typechecker:typecheck-configuration <proj>` -> assert the on-disk `project.json` -> optionally
`nx run <proj>:angular-typecheck`. Reusing it means ZERO new harness surface and ZERO new cross-platform
failure modes.

Verdaccio adds a long-lived local-registry process (start/stop lifecycle, `/-/ping` polling, port 4873,
a temp storage dir) and the research explicitly flags the scaffolded Verdaccio `execFileSync(nx)` start
script as KNOWN-BROKEN on Windows. Since the e2e tier is Linux-only in CI anyway, Verdaccio's only
benefit (multi-package registry fidelity) is unneeded for a single-package plugin. Real-disk `FsTree`
edits don't model an installed consumer at all -- wrong tier for an e2e.

**Single-mechanism principle:** keeping ONE e2e mechanism (direct tarball) means one set of Windows
mitigations to maintain and reason about, not two. That is the highest-reliability cross-platform choice.

**Risk:** the generator e2e adds a real `nx build` + `npm pack` + install + `nx g` to the (already slow,
serialized, Linux-only) e2e job. **Mitigated** by Linux-only scoping and `singleFork` serialization
(no worker race on the shared dist/`.tgz`); it adds wall time to one job, not to the 6-cell matrix.

---

## D5 -- CI JOBS (core): exact wiring, full-matrix vs Linux-only, the `-p` list pitfall, the single `ci` check, Windows mitigations, cache

This is the load-bearing decision for my lens. The current topology is good; v0.0.4 should EXTEND it
without changing its shape.

### What runs WHERE (proposed v0.0.4 wiring)

| New test artifact | Job | Matrix | ci.yml change? |
|---|---|---|---|
| Generator unit specs (in-memory tree) | `test` | full 6-cell (Linux 22/24/26 + Win 24/26 + macOS 24) | **NO** -- glob auto-pickup |
| Generator schema-parity gate | `test` | full 6-cell | NO -- glob auto-pickup |
| In-memory executor mid-tier (D3) | `test` | full 6-cell | NO -- glob auto-pickup |
| NG8xxx catalog integration specs (D2) | `test` | full 6-cell | NO -- glob auto-pickup |
| Drift-gate negative test | `test` | full 6-cell | NO -- glob auto-pickup |
| Generator e2e (if a NEW Nx e2e project) | `e2e` | **Linux-only, Node 24** | **YES -- add to `-p` list** |

**Rule of thumb for the OS/Node split:** anything that is pure-JS ngtsc logic + an in-memory tree is
correctness-identical across OS/arch, so it belongs in the full `test` matrix where cross-platform/Node
signal is essentially free (it's the same fast spec on every cell). Anything that shells out to real
`nx`/`npm`/`pack`/`install` (slow, serialized, the Windows-fragile surface) belongs in the Linux-only
`e2e` job -- which is exactly RD-03's existing posture. Do NOT add the generator e2e to the Windows or
macOS matrix; its cross-platform value is low and its Windows flake surface is high, and CI minutes on
Windows/macOS runners are the scarcest.

### The explicit `-p` list pitfall (most important operational note)

The `e2e` job runs `npx nx run-many -t test -p angular-typechecker-install-e2e
angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` -- an EXPLICIT, by-name project list
(deliberate per RD-03 for consistent gate meaning). **A new `angular-typechecker-generator-e2e` project
is INVISIBLE to CI until its name is added to that list (ci.yml line 142-143).** This is a silent-skip
trap: the project builds and even passes locally via `nx test <proj>`, the PR goes green, and the
generator e2e simply never ran in CI. Two-part mitigation:

1. **Add the project by name to the `-p` list** in the same PR that creates the project, AND give it
   `implicitDependencies: ["angular-typechecker"]` in its `project.json` (so the fresh tarball is
   built/packed first -- matches `install-e2e`).
2. **Add a guard test** that asserts every `e2e/*` Nx project name appears in the ci.yml `e2e` job's
   `-p` list (parse the workflow, list the e2e project dirs, diff). This converts the silent-skip into a
   red `test`-matrix failure the moment someone adds an e2e project without wiring it. `act-compat` and
   `lint-workflows` validate workflow SYNTAX/trigger fidelity, not project-list COMPLETENESS -- so this
   gap is currently unguarded. (Alternatively, reconsider whether the generator e2e should be a NEW
   project at all: folding the generator smoke into the EXISTING `install-e2e` project sidesteps the
   `-p` pitfall entirely, since `install-e2e` is already in the list. **Preferred:** add the generator
   smoke as a new `*.int.spec.ts` inside `angular-typechecker-install-e2e` rather than a new project --
   no ci.yml edit, no `-p` pitfall, reuses the harness verbatim.)

### Keeping the single required `ci` aggregate intact

`ci` is the one required status check (job id AND name exactly `ci`, consumed by the Default-branch
ruleset). It `needs: [changes, test, e2e, fallow, act-compat, lint-workflows]`, runs `if: always()`,
and fails on `contains(needs.*.result,'failure'||'cancelled')` while TOLERATING `skipped` (so a
planning-only PR that path-skips the heavy jobs still reports green). v0.0.4 must NOT:
- add a NEW top-level job without adding it to `ci`'s `needs` (an un-needed job's failure wouldn't gate);
- rename/restructure `ci` (the ruleset name is a cross-phase contract);
- add a separately-required check (that would break the single-required-check invariant).

Since all new in-plugin specs ride inside the existing `test` job and the generator e2e rides inside
the existing `e2e` job (per the D4/D5 "fold into install-e2e" preference), **no new top-level job is
needed and `ci`'s `needs` list is unchanged.** That is the cleanest possible footprint.

### Windows-arm64 mitigations to bake into ANY new harness

For anything that touches real disk / shells out (the generator e2e specifically), inherit the EXISTING
patterns verbatim -- they are already proven in `install-smoke.int.spec.ts`:
- Workspace in **OS temp, not the Dev Drive**: `mkdtempSync(join(tmpdir(), ...))` (the install harness
  already does this; the cross-drive `create-nx-workspace` ENOENT bug the research cites is why).
- **Inherit env** into spawned children: spread `process.env`, but **strip the nested-nx runner vars**
  (`NX_RUNNER_ENV_KEYS`) and the peer-override vars so `PATH`/`ComSpec` survive while the nested run is a
  clean top-level invocation.
- **`NX_DAEMON:false`** on every spawned `nx` so a stale daemon can't serve an outdated graph and so the
  daemon doesn't hold file handles that block teardown `rmSync` on Windows.
- **Stop the daemon / release handles before deleting the temp workspace** (afterAll `rmSync` with
  `recursive:true, force:true`) -- Windows file-locking.
- **lmdb resolution for Windows-arm64**: the research flags an `lmdb` resolution may be needed; if the
  generator e2e bootstraps a fresh `create-nx-workspace` (rather than installing into a committed
  fixture), watch for the Windows-arm64 lmdb native-binding resolution and pin/override it as the prior
  art did. (Folding into `install-e2e`, which installs into a COMMITTED fixture consumer, largely
  sidesteps this.)
- **git-reset isolation** for any harness that mutates a committed fixture workspace and must restore it
  between cases (`git checkout -- .`), rather than re-bootstrapping.
- `pool:'forks'` + `singleFork` + `fileParallelism:false` + `sequence.concurrent:false` +
  `testTimeout:300000` + `environment:'node'` -- the e2e serialization profile; the generator smoke must
  match it (it shells out and shares the dist/`.tgz`).

### Nx cache correctness

- The generator is a `Tree` mutation with no `nx` target of its own, so it has **no cache surface** --
  nothing to configure. Good.
- The generator e2e (folded into `install-e2e`) inherits that project's existing inputs/outputs and the
  `NX_RUNNER_ENV_KEYS` strip that keeps nested `nx run` cache behavior clean.
- If the bespoke `createFsTree` IS authored (against the dissent), its drift file's path must be added to
  the `typecheck-drift` target `inputs` so cache invalidation tracks the internal import -- and it then
  rides the existing per-cell `typecheck-drift` run (cheap, OS-independent). With the in-memory default,
  **no new drift gate and no cache change** are needed.
- Keep `NX_DAEMON:false` in CI (already set on `test` and `e2e`) so concurrent matrix cells / nested
  runs never race on the daemon's project graph or `node_modules/.cache/nx`.

---

## D6 -- SCOPE/RISK: minimal CI footprint that gives trustworthy cross-platform signal without ballooning CI time

**Recommendation (minimal footprint):**
1. ALL new fast specs (generator unit, schema-parity, in-memory executor mid-tier, NG8xxx catalog,
   drift-negative) ride the EXISTING `test` 6-cell matrix via glob -- **zero ci.yml edits, full
   cross-platform/Node signal for free**.
2. The generator e2e is a NEW `*.int.spec.ts` **inside `angular-typechecker-install-e2e`** (already in
   the `-p` list, Linux-only) -- **zero ci.yml edits, no `-p` pitfall, reuses every Windows mitigation**.
3. The ONLY net-new CI artifact is the guard test asserting `e2e/*` projects appear in the `-p` list --
   and that itself rides the `test` matrix (a pure file/workflow parse, fast, cross-platform).

**Net CI cost:** +N cold compiles in the `test` matrix (minimize N via compile-once-assert-many, D2) and
+1 pack/install/generate in the serialized Linux-only `e2e` job. The matrix cell COUNT is unchanged (6);
no new top-level job; `ci`'s `needs` list is unchanged; the single required check is intact.

**Risk if scope balloons:** the two ways CI time/risk balloon are (a) giving the catalog one cold compile
per code, and (b) creating a new e2e PROJECT and running it on the full OS matrix. Both are avoidable --
(a) by grouping codes into shared fixture compiles, (b) by folding the generator smoke into `install-e2e`
and keeping e2e Linux-only. Resist both.

---

## Recommended strategy (this lens)

Keep the CI topology exactly as-is and extend it by GLOB, not by new jobs. Every fast, OS-uniform spec
(generator unit on the in-memory tree, schema-parity, the in-memory executor mid-tier, the NG8xxx
catalog, the drift-negative test) lands automatically in the existing 6-cell `test` matrix, giving
agents and contributors fast cross-platform/Node signal on every push with zero ci.yml churn. Push the
catalog's cost down by compiling fixtures ONCE and asserting many exact codes/categories per compile
(the expensive thing is cold `performCompilation`, not file count), and keep `testTimeout:30000` so
Windows-arm64 cold compiles stay deterministic. Add the generator's real-world proof as a new
`*.int.spec.ts` inside the EXISTING Linux-only `install-e2e` project -- this sidesteps the explicit `-p`
list silent-skip trap entirely, reuses the proven `buildCleanEnv` / OS-temp-`mkdtemp` / `NX_DAEMON:false`
/ `singleFork` Windows-arm64 harness verbatim, and avoids a second e2e mechanism (no Verdaccio). Default
the generator's test substrate to the public in-memory `createTreeWithEmptyWorkspace` (fast,
cross-platform-identical, zero quarantine, zero new drift gate) -- I DISSENT from PROJECT.md's lean
toward the bespoke real-disk `createFsTree`, which is a Windows-fragility and maintenance tax that buys
no CI signal the in-memory tree + existing tarball e2e don't already provide. The single required `ci`
aggregate, its `needs` list, and the Linux-only e2e scoping all stay byte-stable.

## Top 3 priorities

1. **Glob-in, don't job-in.** Route every new in-plugin spec through the existing `test` 6-cell matrix
   and fold the generator e2e into `angular-typechecker-install-e2e` -- net result is ZERO ci.yml edits,
   an unchanged matrix-cell count, and an intact single required `ci` check.
2. **Defuse the explicit `-p` list silent-skip trap.** Prefer folding the generator smoke into an e2e
   project already in the list; if a NEW e2e project is unavoidable, add it to the `-p` list AND add a
   guard test (in the `test` matrix) asserting every `e2e/*` project name is present in the list.
3. **Minimize cold compiles, not files, and keep the Windows-arm64 mitigations verbatim.** Drive the
   NG8xxx catalog with compile-once-assert-many (exact code + category, never message text), hold
   `testTimeout:30000`, and inherit `buildCleanEnv`/OS-temp-`mkdtemp`/`NX_DAEMON:false`/`singleFork`/
   git-reset isolation for any harness that touches disk. Default to the in-memory tree to keep the
   matrix fast and platform-uniform (DISSENT on the bespoke real-disk FsTree wrapper).
