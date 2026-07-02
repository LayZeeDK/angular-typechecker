# Board Member 01 -- Lens: Nx plugin ecosystem & idioms

**Role:** Seasoned Nx 23 plugin author. Bias: convention over invention, low maintenance,
don't fight the framework, align with how `@nx/plugin` scaffolds and how Nx's own ~452
generator specs are written.

**One-line stance:** Build the generator the way `@nx/plugin:generator` would scaffold it,
test it the way Nx's own `library.spec.ts` / `executor.spec.ts` test theirs (public
in-memory `createTreeWithEmptyWorkspace`), and spend the real effort on the 14 missing
NG8xxx assertions -- the genuine product gap. Do NOT author the bespoke real-disk FsTree
wrapper; it is the single least-idiomatic, highest-maintenance idea on the table and the
prior art it claims fidelity to does not actually use it for generators.

---

## D1 SUBSTRATE per tier

**Recommendation:**
- Generator unit/integration: **AGREE -- use the public in-memory `createTreeWithEmptyWorkspace()`
  from `@nx/devkit/testing`. This is the only idiomatic choice.**
- Bespoke real-disk `createFsTree`/`flushFsTreeChanges`: **DO NOT author it for v0.0.4.**
  Not for the generator unit tier, and not as a dedicated "fidelity tier" either.
- Internal-import quarantine + drift tripwire: **moot if the wrapper isn't authored** -- and
  that is the point. The cleanest way to avoid the maintenance cost of a quarantine + tripwire
  is to not take on the internal import in the first place.

**Rationale (from this lens):**
1. **This is THE dominant Nx idiom, by a wide margin.** The NX-FSTREE-INTERNALS research counted
   452 Nx generator spec files importing `createTreeWithEmptyWorkspace`; ZERO `@nx/*` generator
   specs flush to real disk. The only real-disk consumer in all of Nx is `tree.spec.ts` -- the
   spec for `FsTree` *itself*. A seasoned Nx author reading our repo expects exactly the
   `@nx/plugin:executor`-scaffold shape: `createTreeWithEmptyWorkspace()` ->
   `addProjectConfiguration(...)` -> run generator -> `readProjectConfiguration(...)` ->
   `toEqual`. Both prior arts (sandbox `generator.spec.ts`, Connect Impl-C) used precisely this.
2. **`createFsTree` is a deep import into `nx/src/generators/tree` -- explicitly internal.** It is
   re-exported by NO public barrel; only the `Tree`/`FileChange` *types* are public. Adopting it
   buys an `eslint-disable`, a quarantine module, AND a build-time drift tripwire to maintain --
   a standing tax paid on every Nx upgrade -- to gain real-disk fidelity *this generator does not
   need*. The generator's entire observable behavior is a `project.json` config edit
   (`readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` -> `formatFiles`);
   the in-memory Tree captures 100% of that. Nothing reads the Tree off disk mid-generation.
3. **"Stay faithful to the prior art" is factually backwards here.** PROJECT.md D34 says the
   default "leans real-disk wrapper to stay faithful to the prior art." But the prior art's
   GENERATOR tests are in-memory: the sandbox `generator.spec.ts` uses
   `createTreeWithEmptyWorkspace` (the SANDBOX-TECHNIQUES "KEY CORRECTION" calls this out
   explicitly -- the real-disk FsTree existed only as a never-committed PROPOSAL,
   `PLAN-refactor-test-fixtures.md`); Connect Impl-C's generator test also used
   `createTreeWithEmptyWorkspace`. Real-disk FsTree appeared in the prior art ONLY at an
   EXECUTOR e2e tier (to mutate files a real `ngc` then read), never for a generator. So the
   faithful-to-prior-art choice IS the public in-memory tree. The "fidelity" argument for the
   wrapper rests on a misreading.
4. **Where real-disk fidelity is genuinely wanted, the repo already has a better tool.** "Does the
   generated target actually run?" is already answered end-to-end by the tarball e2e tier
   (`install-smoke`, `matrix-5types`) -- a higher-fidelity proof than a real-disk `FsTree`, using
   a mechanism the repo already maintains. A `createFsTree` fidelity tier would sit *between*
   in-memory unit and tarball e2e proving almost nothing the e2e tier doesn't, at high cost.

**Risk:** Low. The only residual risk is the documented nx#32588 hazard (an in-memory generator
spec accidentally resolving the real workspace instead of `/virtual`). Idiomatic mitigations
fully cover it: import `'nx/src/internal-testing-utils/mock-project-graph'` first when needed,
always seed via `addProjectConfiguration` against the empty tree, and never read `process.cwd()`.

**DISSENT (explicit):** I dissent from PROJECT.md D34's "default leans real-disk wrapper." From
the Nx-idioms lens this is the wrong default -- it adds an internal-API dependency, a quarantine,
and a drift gate to replicate behavior the public helper already covers, and it misattributes the
choice to prior art that does the opposite. Recommend flipping the default to the public in-memory
helper and closing the v0.0.1 FsTree carry-over as "superseded by `@nx/devkit/testing`," keeping
the bespoke wrapper only as a documented FALLBACK to author **iff** a concrete generator behavior
ever needs real-disk semantics (none does today).

---

## D2 NG8xxx CATALOG

**Recommendation:**
- Organization: **per-introduction-version drop-in files** (`extended.angularNN.integration.spec.ts`
  / `baseline.angularNN.integration.spec.ts`), NOT a single data-driven `it.each`. The repo has
  already established this naming (`extended.angular13.integration.spec.ts`) and the catalog
  prescribes it (`DIAGNOSTIC-CATALOG.md:60`). Inside each file, an `it.each` over that major's
  codes is fine and welcome -- but keep the FILE split by introduction version.
- Assertions: **assert all 16 extended (+ the missing baseline NG codes) by exact code + category
  + count**, using the repo's existing `NG()` negative-encoding helper. This matches Angular's
  OWN compiler-cli test idiom (`extended_template_diagnostics_spec.ts`: find by exact code, assert
  `.category`).
- Error injection: **committed fixtures** under `fixtures/extended-vNN/` (or per-code component
  dirs), NOT programmatic temp-dir/jscodeshift.

**Rationale (from this lens):**
1. **The per-version file split is a maintenance idiom, not just an aesthetic.** A future Angular
   major becomes a single new `*.angularNN.integration.spec.ts` drop-in file -- no edit to a
   central data table that every reviewer must re-read. This mirrors the sandbox's proven
   organization (`executor.angular13..21`) and the repo's already-chosen naming. A monolithic
   `it.each` of all 16 forces every future addition to touch one growing array and obscures which
   major a code belongs to. The introduction-version taxonomy IS the documentation.
2. **Committed fixtures match THIS repo's established substrate and Nx convention.** The repo
   already runs the real `performCompilation` against committed `fixtures/<scenario>/` dirs
   (`gate-b-error`, `extended-v13`, `extended-promoted`, ...) with paths resolved via
   `import.meta.url`. Committed fixtures are reviewable, diffable, debuggable, and stable across
   runs. The sandbox used jscodeshift + `execSync('nx generate ...')` ONLY because it built
   fixtures at test time inside a live workspace -- a heavy, lock-guarded, single-worker
   apparatus this repo deliberately does not have and should not grow. Programmatic jscodeshift
   injection adds a `jscodeshift` dev-dep and an AST-mutation toolkit (1373 lines in the sandbox)
   to solve a problem committed fixtures already solve. Don't import that complexity.
3. **`forceExtendedDiagnosticsAsErrors` is the one technique to carry, as fixture config.** Most
   NG81xx are warnings unless `strictTemplates: true` + `extendedDiagnostics.defaultCategory:
   "error"`. The repo already proves promotion for NG8101 (`extended.promotion.integration.spec.ts`).
   Bake that into each extended fixture's `tsconfig` (committed), rather than mutating tsconfig at
   runtime. Assert BOTH default-WARNING and promoted-ERROR for at least one code per major to lock
   the category contract (Angular's `template_typecheck_spec.ts` config-validation layer analogue).

**Risk:** Medium-low. (a) Authoring ~14 minimal triggering fixtures is real work and each must be
verified to emit EXACTLY its target code on Angular 22.0.4 (some codes are easy to co-trigger).
Mitigation: assert by exact code AND count so a fixture that accidentally trips a second check
fails loudly. (b) Code/name drift across Angular versions -- mitigated by the catalog's
VERIFY-ON-IMPLEMENTATION step against `@angular/compiler-cli@22.0.4`'s
`extended_template_diagnostic_name.d.ts`, plus the existing `typecheck-drift` gate.

**No dissent.** This is the milestone's real product gap (2/16 -> 16/16) and the recommended shape
is consistent across the repo's existing tests, the catalog, the sandbox organization, and
Angular's own compiler-cli tests.

---

## D3 IN-MEMORY EXECUTOR VARIANT (mid-tier)

**Recommendation:** **Add it, but keep it minimal -- and build it on the SAME public in-memory
substrate (D1), not a real-disk wrapper.** It is a real, currently-empty rung, not redundant.

**Rationale (from this lens):**
- The audit (CURRENT-AUDIT A.2) shows a genuine gap: today the ladder jumps from mocked-unit
  (`executor.spec.ts` mocks the 4 seams + logger; never touches an `ExecutorContext` against any
  workspace) straight to full-tarball-e2e, with nothing between. The mid-tier proves the executor
  resolves `context.root` + the `tsConfig` option to a real path and normalizes options against a
  real `project.json` target -- behavior covered today ONLY at the expensive e2e tier (for
  path/binding) or only as a pure function (`normalize-options.spec.ts`).
- It is NOT redundant with the real-compiler integration tier: that tier calls `runTypecheck`
  directly against a `fixtures/` tsconfig and asserts off `CoreResult`; it bypasses the
  Nx-executor adapter and `ExecutorContext` entirely. The mid-tier's value is the executor+context
  seam, which neither the mocked-unit nor the integration tier exercises.
- Idiomatically, this is "run the executor's default export against an `ExecutorContext` built from
  a `createTreeWithEmptyWorkspace`-seeded project." It reuses the D1 substrate the generator tests
  already establish -- one substrate, two consumers. No new mechanism.

**Risk:** Low, but watch scope. The mid-tier should assert *plumbing* (path resolution, option
normalization, binding under the published id where cheap), NOT re-prove diagnostic behavior
(that is the integration tier's job) or full install fidelity (the e2e tier's). Keep it to a
handful of cases or it duplicates two neighbors.

**Soft dissent / flag:** This is the LOWEST-priority of the three substantive asks (generator,
NG8xxx, mid-tier). If milestone time is tight, NG8xxx coverage and the generator must land first;
the mid-tier can be a thin follow-on. It is worth doing, but it is not the headline gap.

---

## D4 GENERATOR E2E

**Recommendation:** **Extend the EXISTING `npm pack` + tmp-install harness. Do NOT introduce
Verdaccio. Do NOT use a real-disk FsTree workspace for the generator e2e.**

**Rationale (from this lens):**
1. **One e2e mechanism is a maintenance virtue.** The repo already has a proven, hardened tarball
   harness (`install-smoke.int.spec.ts`) with `buildCleanEnv`/nested-nx env-strip, empty-`.npmrc`
   honesty, `mkdtempSync` isolation, `pool: 'forks'` + `singleFork` serialization, and Windows-arm64
   mitigations baked in. The generator e2e is one more spec in that idiom: pack -> install ->
   `execSync('npx nx g angular-typechecker:typecheck-configuration <proj>')` -> assert the on-disk
   `project.json` target -> `nx run <proj>:angular-typecheck` exits as expected.
2. **Verdaccio is the Nx-canonical scaffold, but it is the wrong fit HERE.** Yes, `@nx/plugin`'s
   e2e preset and nx-verdaccio use a local registry + `createTestProject()` + `nx add ...@e2e`.
   But this repo deliberately chose direct `npm pack` + tmp install (simpler, already proven for
   the executor), and the Verdaccio `start-local-registry.ts` `execFileSync(nx, ...)` path is
   documented to fail on Windows arm64 -- the primary dev environment. Adding Verdaccio means a
   new dev-dep, a global-setup lifecycle, a registry process to start/stop, and a Windows
   liability, to gain fidelity the `npm pack` route already delivers. Not fighting the framework
   here means not adopting a second, heavier e2e mechanism when the existing one covers the case.
3. **Connect-style real-disk FsTree workspace edits are an executor-e2e technique, not a generator
   one.** The generator's job is to write a target into `project.json`; the faithful e2e proof is
   "the installed plugin's generator runs as a consumer invokes it and produces a runnable target,"
   which `execSync('npx nx g ...')` against the tarball gives directly. A real-disk FsTree would
   re-implement, in-process and with an internal import, what the CLI does natively.

**CI wiring note:** If this lands as a NEW Nx e2e project (e.g. `angular-typechecker-generator-e2e`),
it MUST be added by name to ci.yml's `e2e` job explicit `-p` list (the list is intentionally
explicit, RD-03) and carry `implicitDependencies: ["angular-typechecker"]` so the fresh tarball is
built/packed first. Cheaper alternative: add the generator e2e spec to the EXISTING `install-e2e`
project (no new project, no ci.yml edit, one tarball build shared) -- prefer this unless isolation
is needed.

**Risk:** Low. The harness is proven. Main risk is a slow extra install cycle; folding the spec
into `install-e2e` (sharing one pack/install) mitigates it.

**No dissent.**

---

## D5 CI JOBS

**Recommendation:**
- **Generator unit/integration + the NG8xxx catalog specs: ZERO ci.yml change needed.** They land
  automatically in the existing `test` 6-cell matrix the moment they match the plugin
  `vitest.config.mts` include glob. This is the idiomatic, low-friction path -- do nothing.
- **Generator e2e:** prefer folding into the existing `install-e2e` project (no ci.yml edit). If a
  separate project is chosen, add it BY NAME to the `e2e` job `-p` list + set
  `implicitDependencies: ["angular-typechecker"]`.
- **Keep the single required `ci` aggregate check unchanged.** Do not add new required checks.
- **Heavy tiers stay Linux-only** (the `e2e` job is ubuntu/Node-24-only by design, RD-03). The
  in-plugin generator + catalog specs run on all 6 cells because they are cheap and in-process --
  that is correct and free.
- **Windows-arm64 mitigations are e2e-tier only** (OS temp not Dev Drive, inherit full env,
  `NX_DAEMON=false`, stop nx daemon, git-reset isolation, lmdb resolution). The new in-memory
  generator/catalog specs need NONE of these (no subprocess, no disk, no daemon) -- another reason
  the in-memory substrate (D1) is the low-maintenance choice.

**Rationale (from this lens):** The repo's CI is already well-factored around a single required
aggregate (`ci`, `if: always()`, tolerates intentional `skipped`) with `dorny/paths-filter`
(`predicate-quantifier: every`) so planning-only PRs skip the matrix. The idiomatic move is to let
in-plugin specs ride the existing glob and touch ci.yml ONLY for a genuinely new e2e PROJECT. Adding
required checks or new matrix cells would be fighting a deliberately minimal gate design.

**Risk:** Low. The one trap: a new e2e PROJECT is INVISIBLE to CI until added to the explicit `-p`
list -- a silent-no-coverage hazard. Mitigation: prefer folding into `install-e2e`; if a new
project is unavoidable, the ci.yml `-p` edit is a checklist item in the same PR.

**No dissent.**

---

## D6 SCOPE / RISK

**Recommendation:** **Pulling the generator in IS justified -- it is not scope creep -- BUT the
minimal coherent strategy is: ship the generator the idiomatic (in-memory-tested) way, close the
14 missing NG8xxx, and add a thin mid-tier; explicitly DROP the bespoke FsTree wrapper, the
jscodeshift toolkit, and Verdaccio.**

**Rationale (from this lens):**
- The generator is justified on two grounds: (a) it is a real deferred deliverable (the GEN-family
  config generator), and (b) it is the natural VEHICLE for the generator-testing technique the
  milestone wants. A `feat` legitimately bumps 0.0.3 -> 0.0.4. The 33-line sandbox generator +
  schema + `generators.json` registration + build-asset glob is a small, well-understood, idiomatic
  add. Not creep.
- **The scope-creep risk is NOT the generator -- it is the testing apparatus around it.** Three
  ideas on the table are over-engineering relative to the gap they close:
  1. Bespoke real-disk `createFsTree` + quarantine + drift tripwire (D1) -- internal-API tax for
     fidelity the generator doesn't need and the e2e tier already provides.
  2. jscodeshift error-injection toolkit (D2) -- 1300+ lines of AST mutation to replace committed
     fixtures the repo already uses.
  3. Verdaccio (D4) -- a second e2e mechanism with a Windows-arm64 liability.
  Each is "faithful to the sandbox" in letter but the sandbox needed them for a live-workspace
  fixture-build apparatus this repo does not have. Carrying technique without carrying the context
  that motivated it is the creep.
- **The minimal coherent strategy:**
  1. Generator: `@nx/plugin`-idiomatic; `readProjectConfiguration`/`updateProjectConfiguration`/
     `formatFiles`; idempotent (`OverwriteStrategy.KeepExisting` semantics or skip-if-present);
     `generators.json` + `package.json` `generators` field + `files` + build-asset glob mirroring
     the `executors.json` block; extend `schema-parity.spec.ts` to the generator schema.
  2. Generator tests: in-memory `createTreeWithEmptyWorkspace` (seed -> run -> read-back `toEqual`/
     snapshot; absent->added; present->preserved idempotency; error on missing project).
  3. NG8xxx: 16/16 by exact code+category+count, per-introduction-version files, committed fixtures,
     `defaultCategory: "error"` promotion baked into fixture tsconfigs.
  4. Mid-tier executor-against-context spec (thin), same in-memory substrate.
  5. Generator e2e folded into `install-e2e`.
  6. Drift-gate negative test: keep this -- but as a test of the EXISTING `typecheck-drift`
     mechanism ("does it actually fail when the shim drifts?"), NOT as a new FsTree-import tripwire
     (no FsTree import to guard, given D1).

**Risk of OVER-doing it:** Maintenance debt that outlives its value -- a quarantine + tripwire to
chase across Nx upgrades, an AST toolkit to keep current with Angular template syntax, and a
Verdaccio process to keep green on Windows. For a plugin whose whole pitch is "fast, low-friction,
Nx-native," accreting heavy bespoke test infrastructure undercuts the maintainability story and the
registry-listing posture.

**Risk of UNDER-doing it:** The only thing that MUST NOT be cut is the NG8xxx coverage (14 missing).
That is the milestone's stated product gap and the differentiator over a bare `ngc --noEmit`.

**DISSENT (explicit, reiterated):** Against PROJECT.md D34's real-disk-wrapper default and against
treating the full sandbox technique stack (FsTree wrapper, jscodeshift, Verdaccio) as
must-adopt-for-fidelity. From this lens, fidelity is bought more cheaply and more idiomatically by
public in-memory unit tests + the existing tarball e2e tier.

---

## Recommended strategy (this lens)

Build the `typecheck-configuration` generator exactly as `@nx/plugin:generator` would scaffold it
and test it the way Nx's own ~452 generator specs test theirs: the public, version-stable,
zero-quarantine in-memory `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing` (seed a project
with `addProjectConfiguration`, run the generator, read back with `readProjectConfiguration`, assert
the target shape and idempotency). Reserve real-disk fidelity for the tarball e2e tier the repo
already maintains -- fold a `execSync('npx nx g ...')` generator e2e into the existing `install-e2e`
project rather than standing up Verdaccio or a bespoke real-disk `FsTree` wrapper. Spend the
milestone's real effort on the genuine product gap: assert all 16 extended NG8xxx (plus the missing
baseline NG codes) by exact code + category + count, organized as per-introduction-version drop-in
integration files backed by committed fixtures with `defaultCategory: "error"` promotion baked in --
matching the repo's existing fixture substrate and Angular's own compiler-cli test idiom. Add a thin
mid-tier executor-against-`ExecutorContext` spec on the same in-memory substrate to fill the empty
rung between mocked-unit and tarball-e2e. Decline the three over-engineering temptations (bespoke
FsTree wrapper + quarantine + drift tripwire; jscodeshift AST toolkit; Verdaccio) -- each replicates
something the public Nx API or the repo's existing harness already covers, at standing maintenance
cost, and each is "faithful to the sandbox" only by copying technique without the live-workspace
context that motivated it. In-plugin specs ride the existing `test` matrix glob with zero ci.yml
change; the single required `ci` aggregate stays unchanged; heavy tiers and Windows-arm64
mitigations stay confined to the Linux-only e2e job.

## Top 3 priorities (this lens)

1. **Close the NG8xxx gap (2/16 -> 16/16) with committed fixtures + per-introduction-version files,
   asserting exact code + category + count.** This is the milestone's real product value and the
   differentiator over `ngc --noEmit`; everything else is secondary.
2. **Use the public in-memory `createTreeWithEmptyWorkspace` for the generator (and the mid-tier
   executor) tests -- do NOT author the bespoke real-disk FsTree wrapper.** This is the single
   highest-leverage idiom/maintenance decision; it removes a quarantine + drift tripwire + internal
   import and aligns with what both prior arts and all of Nx actually do. Flip PROJECT.md D34's
   default.
3. **Reuse the existing `npm pack` tarball e2e harness (fold the generator e2e into `install-e2e`)
   and leave CI structure untouched.** One e2e mechanism, one required `ci` check, no Verdaccio, no
   jscodeshift -- decline the heavy bespoke apparatus the sandbox needed for its live-workspace
   fixture builds.
