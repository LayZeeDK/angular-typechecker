# C1 -- Nx plugin engineering / ecosystem conventions lens (Round 1)

LENS: what is idiomatic and maintainable for an Nx 23 plugin -- how Nx itself and the
Nx community author and test generators, executors, and plugin e2e. I weight alignment
with documented public APIs (`@nx/devkit`, `@nx/devkit/testing`, `@nx/plugin/testing`) and
the prevailing patterns in Nx's own 452 generator specs over bespoke prior-art cleverness.

The governing fact for this lens: **Nx ships a complete, public, documented testing surface
for plugins, and this repo's existing tests already sit mostly inside it.** The one place the
prior art reaches OUTSIDE that surface is the deep import `nx/src/generators/tree`
(`FsTree`/`flushChanges`), which is internal and unstable (FACTS §6: not in the `@nx/devkit`
public barrel; verified byte-identical 23.0.1 -> 23.1.0-beta.4, but with no semver guarantee).
My positions consistently prefer the public surface and treat the internal import as a
last-resort with a real maintenance tax.

---

## D1 -- Test substrate

**Position: Tier the substrate by what each tier must prove, and use the PUBLIC in-memory
`createTreeWithEmptyWorkspace()` for the generator's unit/integration tests. Do NOT author
the bespoke `createFsTree`/`flushFsTreeChanges` real-disk helpers in v0.0.4. Reserve Node
`fs`+`execSync`-against-a-generated-workspace for the e2e tier only (the tier that already
uses it).**

Concretely:

- (a) `createTreeWithEmptyWorkspace` (in-memory) -- the `typecheck-configuration` generator
  unit specs, and (if added) the mid-tier executor-against-workspace spec (D3).
- (b) real-disk `FsTree` via `nx/src/generators/tree` -- NOT in v0.0.4. Keep it as a
  documented, quarantined fallback to author only if a concrete generator behavior emerges
  that an in-memory Tree provably cannot model.
- (c) `fs`+`execSync` against a generated/installed workspace -- the e2e tier, exactly as the
  three existing e2e projects already do it.

The facts it rests on:

- The generator's entire observable behavior is a `project.json` config edit:
  `readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` ->
  `formatFiles` (CURRENT-AUDIT B.1; SANDBOX-TECHNIQUES §1 shows the 33-line prior-art
  generator does exactly this). An in-memory Tree captures 100% of that; nothing reads the
  Tree off real disk _during_ generation.
- This is overwhelmingly what Nx itself does: **452 generator spec files import
  `createTreeWithEmptyWorkspace`; exactly ONE spec (`nx/src/generators/tree.spec.ts`)
  constructs a real-disk `FsTree`** (FACTS §6; NX-FSTREE-INTERNALS §6). The real-disk path
  is reserved by Nx for testing `FsTree`/`flushChanges` themselves -- not for generator
  output. Authoring `createFsTree` for a config-edit generator puts this repo in a camp of
  one against the entire Nx ecosystem.
- `createTreeWithEmptyWorkspace` is public (`@nx/devkit/testing`), version-stable, and
  carries zero quarantine cost. The bespoke `createFsTree` requires three standing
  liabilities: an internal deep import, an `eslint-disable @nx/enforce-module-boundaries`,
  and a `typecheck-drift`-style drift tripwire to maintain across every Nx upgrade
  (NX-FSTREE-INTERNALS §8; CURRENT-AUDIT A.4/A.5).
- The `@nx/plugin` scaffolders themselves emit `createTreeWithEmptyWorkspace` +
  `mock-project-graph` + `setCwd` starter specs (FACTS §6) -- the canonical default the Nx
  CLI hands a plugin author.
- Real-disk fidelity is already bought, end-to-end, at the existing tarball e2e tier
  (`install-smoke`, `matrix-5types`): pack -> install -> run on real disk. That is HIGHER
  fidelity than a real-disk `FsTree` (it exercises the published `require()` path too) and
  needs no internal import (CURRENT-AUDIT (2)).

Facts I am missing (orchestrator can verify):

- Whether the `typecheck-configuration` generator's FINAL design will emit any file via
  `generateFiles` (e.g. scaffold a `tsconfig.typecheck.json`), or whether it remains a pure
  `project.json` edit. If it emits a tsconfig whose VALUE is that the file is consumable on
  disk by a real `ngc`, that is the one scenario that could justify a real-disk tier -- but
  even then, the e2e tier (route 2 below) covers it better.
- Whether `.planning/PROJECT.md`/`ARCHITECTURE.md` treat the bespoke `createFsTree` as a
  _committed contract_ (a v0.0.1 carry-over deliverable that MUST land) vs. a design intent
  that can be closed as "superseded by the public helper." CURRENT-AUDIT A.5 reads it as
  drift now correctly acknowledged, i.e. re-openable.

The specific fact that would change my position:

- If the generator is specified to write a standalone tsconfig (or any file) that a test must
  flush to disk and feed to the REAL compiler _within the generator's own test boundary_
  (not the e2e tier), then I would adopt the quarantined `createFsTree` for that one spec --
  the in-memory `/virtual` Tree cannot back a real `performCompilation` read
  (NX-FSTREE-INTERNALS §9: disk reads always miss on a `/virtual` tree).

---

## D2 -- Diagnostic coverage

**Position: Organize as per-introduction-version integration files
(`extended.angularNN.integration.spec.ts` / `baseline.angularNN.integration.spec.ts`), one
`it` per diagnostic code, each backed by a committed minimal fixture; assert by EXACT code +
`.category`, and assert WARNING-default-vs-promoted-Error via
`extendedDiagnostics.defaultCategory: "error"`. Do NOT assert via a single opaque data-driven
table, and do NOT switch the fixture mechanism to programmatic injection.**

This is the lens-aligned choice on three axes:

1. **Organization -- mirror Angular's own compiler-cli test layout, not a flat table.**
   Angular structures extended diagnostics as a centralized integration spec
   (`extended_template_diagnostics_spec.ts`) with many `it`s, grouped by check, plus a
   config-validation layer (`template_typecheck_spec.ts`) (CURRENT-AUDIT Part C). The repo
   cannot reach the internal per-check factories (it runs the public `performCompilation`),
   so the per-introduction-version file split is the right public-API analogue, and it is
   already the established convention here (`baseline.angular13` / `extended.angular13`
   exist; the scaffold is prescribed by DIAGNOSTIC-CATALOG). "Add a future Angular major" =
   a drop-in file (SANDBOX-TECHNIQUES §4). A single mega-table optimizes for terseness over
   the maintainability property the version split buys.
2. **Production mechanism -- committed fixtures, NOT programmatic injection.** The repo
   already runs the real `performCompilation` against committed `fixtures/<scenario>/`
   tsconfigs (FACTS §3; confirmed: 12 fixture dirs on disk). Committed fixtures are
   deterministic, reviewable in a PR diff, and resolve via `fileURLToPath(import.meta.url)`.
   The sandbox's jscodeshift AST-injection toolkit (SANDBOX-TECHNIQUES §5) is powerful but is
   an e2e/temp-workspace technique built on `@nx/angular:library` generation -- it is a heavy,
   version-fragile dependency that does not belong in the integration tier where the repo
   already has a working committed-fixture substrate. Keep injection (if at all) confined to
   the e2e tier where a real workspace is generated anyway.
3. **Assertion -- exact code + category, count as an invariant.** This is already the repo's
   idiom (`NG()` negative-encoding helper; `result.diagnostics.find(d => d.code === NG(8101))`
   then `expect(...category).toBe(...Warning)`) and it matches Angular's own assertion idiom
   exactly (CURRENT-AUDIT Part C). Counting by `.category` (never code sign) is the
   established L-4 rule. The promotion test generalizes the existing
   `extended.promotion.integration.spec.ts` pattern.

Facts it rests on:

- 18 `ExtendedTemplateDiagnosticName` members verified against installed
  `@angular/compiler-cli@22.0.4` (FACTS §4); only 2 of 16 catalog extended codes asserted by
  exact code today, 14 missing (CURRENT-AUDIT A.3).
- The repo's executor/core returns a structured `CoreResult` holding the diagnostics array
  with numeric `code` (FACTS §2) -- so exact-code/category/count assertions are available
  in-process at the integration tier WITHOUT capturing logger output (the sandbox could only
  assert `success` boolean because its executor returned only `{ success }` --
  SANDBOX-TECHNIQUES §4 caveat; this repo does not have that limitation).

Facts I am missing:

- The exact `ErrorCode` enum value for each of the 18 names in installed compiler-cli 22.0.4
  (FACTS §4 says "to be read during work"), and whether `controlFlowPreventingContentProjection`
  (in the enum but absent from the catalog) and the two "undocumented" catalog codes
  (`unusedLetDeclaration` NG8112 + one other) are reachable/triggerable under Angular 22.
- Whether every one of the 18 can be triggered by a minimal standalone-component fixture
  under `strictTemplates` (some extended checks have narrow preconditions, e.g.
  `skipHydrationNotStatic` needs hydration context).

The specific fact that would change my position:

- If several extended codes turn out to be un-triggerable by a committed standalone fixture
  (require runtime/hydration/build context the static `performCompilation` path cannot
  produce), I would split coverage: exact-code/category for the triggerable set via fixtures,
  and a documented `it.skip` with the reason for the rest (the sandbox's "record WHY a phase
  isn't exercised" habit, CONNECT-TECHNIQUES §6a) -- rather than forcing programmatic
  injection just to hit a number.

---

## D3 -- Executor-against-workspace test (mid-tier)

**Position: Add ONE thin mid-tier spec that runs the executor against a constructed
`ExecutorContext` over an in-memory `createTreeWithEmptyWorkspace`-seeded project. It is
worth its weight only if it covers the seam currently jumped: `context.root` + `tsConfig`
option -> real path resolution, and `normalizeOptions` against a real `project.json` target.
Keep it small; do not duplicate what the mocked-unit or tarball-e2e tiers already prove.**

Facts it rests on:

- Today the executor coverage jumps from seam-mocked unit specs (which build an
  `ExecutorContext` literal and `vi.mock` the four core seams + logger -- FACTS §3) straight
  to the tarball e2e, with nothing between (CURRENT-AUDIT A.2). Path resolution and
  option-normalization against a real target config are proven ONLY at e2e today.
- The `@nx/plugin` executor-impl template itself constructs an `ExecutorContext` literal and
  asserts `{ success }` (FACTS §6) -- so an `ExecutorContext`-against-substrate spec is an
  idiomatic Nx pattern, not an invention.
- The generator's substrate decision (D1) is reusable here: the same in-memory
  `createTreeWithEmptyWorkspace` seeds the project the executor reads (CURRENT-AUDIT A.2
  flags this as "the natural home for the substrate decision").

Facts I am missing:

- Whether the executor reads project configuration off the Tree/`context` at all, or whether
  it only consumes the resolved `tsConfig` path + `context.root` (FACTS §2 says the executor
  maps a `CoreResult` to `{ success }` over the core `runTypecheck`; the path-resolution
  surface is what I cannot see without reading `executor.ts`/`normalize-options.ts`). If the
  executor does no `context`-driven path resolution beyond what `normalize-options.spec.ts`
  already covers purely, the mid-tier spec's value shrinks toward zero.

The specific fact that would change my position:

- If reading the executor source shows `context.root`/`projectsConfigurations`-driven
  `tsConfig` resolution is ALREADY exercised by an existing integration spec (e.g.
  `run-typecheck.integration.spec.ts` runs app + lib tsconfigs via `it.each` -- FACTS §3),
  then the mid-tier spec is redundant and I would drop it (push the one uncovered assertion,
  if any, into that existing spec instead of a new file).

---

## D4 -- Generator e2e

**Position: Test the generator end-to-end by EXTENDING the existing tarball harness, not by
introducing Verdaccio. Run `npx nx g angular-typechecker:typecheck-configuration <proj>`
against the installed tarball, then assert the on-disk `project.json` target AND that
`nx run <proj>:angular-typecheck` subsequently runs. Add it to the existing `install-e2e`
project (preferred) rather than spinning up a new e2e project, unless isolation forces a new
one.**

Facts it rests on:

- Nx's canonical plugin e2e is Verdaccio-backed (`@nx/js:verdaccio` globalSetup +
  `@nx/plugin/testing` `createTestProject` + `npx nx add <plugin>@e2e` -- FACTS §6;
  CURRENT-AUDIT B.3 route 2). BUT this repo deliberately does NOT use Verdaccio -- it uses
  direct `npm pack` + tmp install, already proven across three e2e projects (FACTS §3).
  Introducing Verdaccio now would add a SECOND e2e mechanism for no fidelity gain, and the
  scaffolded Verdaccio `start-local-registry.ts` `execFileSync(nx)` path is known to fail on
  Windows arm64 -- the primary dev environment (CURRENT-AUDIT B.3; CONNECT-TECHNIQUES §7
  Windows gotchas). One e2e mechanism is the maintainable choice.
- The prior art confirms the generator IS worth an e2e: the sandbox e2e dogfoods the
  generator to wire the target before running (SANDBOX-TECHNIQUES §6, §9.3), and Connect's
  Impl-C tested the generator both as an in-memory unit AND via the installed-plugin e2e
  (CONNECT-TECHNIQUES §1c). The high-value e2e assertion is the one neither lower tier can
  give: the generator resolves from the INSTALLED package id and the wired target then RUNS.
- CI wiring is well understood (FACTS §5; CURRENT-AUDIT A.4): in-plugin specs need no
  `ci.yml` change; a NEW e2e project must be added by name to the `e2e` job's explicit `-p`
  list and needs `implicitDependencies: ["angular-typechecker"]` (confirmed shape in
  `install-e2e/project.json`). Extending `install-e2e` avoids the `ci.yml` edit entirely.

Facts I am missing:

- Whether the existing `install-e2e` harness's isolation model (per-spec tmp install, env
  strip) cleanly accommodates a `nx g` invocation, or whether the generator e2e needs a
  fully `create-nx-workspace`-scaffolded consumer (the generator needs a real project to
  target, which the bare tarball-install consumer may not have). The sandbox e2e scaffolds a
  full `create-nx-workspace --preset angular-monorepo` consumer for exactly this reason
  (SANDBOX-TECHNIQUES §6).

The specific fact that would change my position:

- If the generator requires a real, fully-generated Angular project to target (so the e2e
  must `create-nx-workspace` + `nx g @nx/angular:library` first), and that bootstrap does not
  fit the existing lean `install-e2e` harness, I would add a dedicated
  `angular-typechecker-generator-e2e` project (added to the `ci.yml` `-p` list) rather than
  bloat `install-e2e`. The decision is "extend vs new project," not "tarball vs Verdaccio" --
  Verdaccio stays out either way.

---

## D5 -- CI mapping

**Position: Land all new IN-PLUGIN tests (generator unit, mid-tier executor, NG8xxx catalog
integration) in the existing 6-cell `test` matrix automatically via the glob -- no `ci.yml`
change. Wire generator e2e by EXTENDING `install-e2e` (no `ci.yml` change) or, if a new e2e
project is unavoidable, add it by name to the Linux-only `e2e` job's explicit `-p` list. Add
NO new required check; the single aggregate `ci` check stays the gate.**

Facts it rests on:

- A new `*.spec.ts`/`*.integration.spec.ts` under `packages/angular-typechecker` runs in the
  `test` job with no `ci.yml` change (FACTS §5; CURRENT-AUDIT A.4 -- matches the
  `vitest.config.mts` include glob). The drift gate is folded into the same `run-many`.
- The `e2e` job uses an EXPLICIT `-p` project list by design (gate-meaning consistency,
  RD-03) -- a new e2e project is invisible to CI until named there (FACTS §5). Extending an
  existing e2e project sidesteps this.
- The `ci` aggregate is the single required check (FACTS §5/§8); its `if: always()` +
  `contains(needs.*.result, 'failure'|'cancelled')` form already aggregates every matrix cell
  and tolerates intentional path-skips. Nothing about new in-plugin tests changes that
  contract.
- Generator unit + catalog integration are OS-portable pure-JS/ngtsc checks (no arch
  sensitivity -- the matrix comment notes arch is correctness-irrelevant), so the existing
  6-cell matrix is the right and sufficient breadth; no new cells needed.

Facts I am missing:

- The current `test`-job wall-clock budget per cell, and how much the 14 new NG8xxx
  integration specs (each a cold `performCompilation`, `testTimeout: 30000` -- FACTS §3) add
  to the slowest cell x6. A large catalog of cold compilations could push the matrix runtime
  enough to warrant Nx caching tuning, but that is an optimization, not a gate-correctness
  issue.

The specific fact that would change my position:

- If the 14 cold-compilation catalog specs materially blow the `test`-job time budget on the
  slowest cell, I would consider running the FULL catalog on Linux-only (one cell) and a
  representative SUBSET cross-OS -- but only with evidence, since splitting the catalog across
  jobs weakens the "one required check covers everything" simplicity. Absent timing evidence,
  keep it uniform in the existing matrix.

---

## D6 -- Scope

**Position: YES -- the `typecheck-configuration` generator belongs in this milestone, and it
should be the milestone's anchor. The testing work splits into two coherent, independently
shippable workstreams: (1) the generator + its idiomatic test stack (unit via
`createTreeWithEmptyWorkspace`, schema-parity gate, e2e via the existing tarball harness);
(2) closing the NG8xxx exact-code catalog gap (14 missing extended + missing baseline codes).
EXCLUDE the bespoke `createFsTree` deliverable, Verdaccio, and any cache/`dependsOn`-ordering
correctness tests from this milestone.**

Facts it rests on:

- The milestone's NAMED scope is "a `typecheck-configuration` Nx generator plus testing work"
  (FACTS §1). The generator does not yet exist; `package.json` has `executors` but no
  `generators` field (FACTS §2; confirmed: only `"executors": "./executors.json"` present).
  Shipping the generator (with `generators.json`, the `generators` package field, build-asset
  glob, and `files` whitelist entry) is the headline maintainability/ecosystem-conventions
  task, and it unblocks the registry-listing/usability story for the plugin.
- Both workstreams are well-scoped by prior art: the generator pattern is a 33-line
  config-edit (SANDBOX-TECHNIQUES §1) + idempotency (CONNECT-TECHNIQUES §2b); the catalog gap
  is enumerated precisely (CURRENT-AUDIT A.3: 14 missing extended codes).
- Excluding `createFsTree` (D1), Verdaccio (D4), and cache/ordering tests is conventions- and
  prior-art-backed: Nx's 452:1 in-memory:real-disk ratio; the repo's no-Verdaccio stance; and
  the explicit prior-art finding that Nx cache hit/miss and `dependsOn` ordering were "very
  expensive to test end-to-end and were not attempted" (CONNECT-TECHNIQUES §5c). Adding any of
  those is scope creep against both convention and evidence.

Facts I am missing:

- Whether the generator's required SHAPE includes per-project-type branching (app gets an
  explicit editor `tsConfig`; lib defers to a `targetDefaults` / `tsconfig.lib.json` -- the
  Connect Impl-C asymmetry, CONNECT-TECHNIQUES §2a/§3a) or is the single-shape sandbox
  default. Per-project-type branching meaningfully enlarges the generator + its
  `describe.each` test matrix (CONNECT-TECHNIQUES §2b) and is the main scope-sizing unknown.
- Whether v0.0.4 intends buildable/publishable-lib and spec-tsconfig as DISTINCT generator
  shapes. Prior art flags these as a GAP to design fresh, not inherit (CONNECT-TECHNIQUES
  §3b/§6) -- if in scope they are net-new design, not a drop-in.

The specific fact that would change my position:

- If the generator is specified with full per-project-type branching across all five project
  types (app/local-lib/buildable-lib/publishable-lib/spec-tsconfig) AND distinct tsconfig
  shapes per type, the testing work roughly doubles (a `describe.each` project-type matrix +
  per-type e2e smoke), and I would recommend splitting the milestone -- ship the
  app-vs-library generator + catalog first, defer the buildable/publishable/spec-tsconfig
  shapes to a follow-up -- rather than overload one milestone with net-new design the prior
  art does not de-risk.

---

```
POSITIONS
D1: Public in-memory createTreeWithEmptyWorkspace for generator (and mid-tier) specs; defer the bespoke real-disk createFsTree/flushFsTreeChanges; keep fs+execSync only at the existing e2e tier.
D2: Per-introduction-version integration files (one it per code) backed by committed fixtures; assert exact code + .category + count, plus the defaultCategory:"error" promotion contrast; no flat table, no AST injection at the integration tier.
D3: Add one thin executor-against-in-memory-workspace mid-tier spec ONLY to cover context.root/tsConfig path resolution + normalizeOptions against a real project.json; drop it if an existing integration spec already covers that.
D4: Test the generator e2e by extending the existing npm-pack tarball harness (assert on-disk project.json + that nx run <proj>:angular-typecheck runs); do NOT introduce Verdaccio.
D5: In-plugin tests ride the existing 6-cell test matrix glob (no ci.yml change); wire generator e2e by extending install-e2e, or add a new e2e project by name to the Linux-only e2e -p list; add no new required check.
D6: Ship the typecheck-configuration generator as the milestone anchor + close the NG8xxx exact-code catalog gap; exclude createFsTree, Verdaccio, and cache/dependsOn-ordering tests from scope.
FACTS-NEEDED: Does the final generator emit any file via generateFiles (e.g. a tsconfig) or is it a pure project.json edit; the exact compiler-cli@22.0.4 ErrorCode value per extended name and whether each is triggerable by a committed standalone fixture under strictTemplates; whether executor.ts does context.root/tsConfig path resolution not already covered by an existing integration spec; whether the generator needs a fully create-nx-workspace-scaffolded consumer for its e2e; the per-cell test-job time budget vs 14 new cold-compilation catalog specs; whether the generator's required shape includes per-project-type branching across all five project types.
WOULD-CHANGE-MIND: D1 -> if the generator must emit a tsconfig a test feeds to the REAL compiler within the generator's own boundary, adopt quarantined createFsTree for that spec. D2 -> if several extended codes are un-triggerable by a committed static fixture, split into exact-code-via-fixtures + documented it.skip rather than forcing AST injection. D3 -> if an existing integration spec (e.g. run-typecheck.integration) already exercises context-driven tsConfig resolution, drop the mid-tier spec. D4 -> if the generator needs a full create-nx-workspace consumer that the lean install-e2e harness can't host, add a dedicated generator-e2e project (Verdaccio still out). D5 -> if 14 cold-compilation specs blow the slowest cell's time budget, run the full catalog Linux-only with a cross-OS subset. D6 -> if the generator is specified with full per-project-type branching across all five types, split the milestone (app-vs-lib generator + catalog now; buildable/publishable/spec-tsconfig shapes later).
```
