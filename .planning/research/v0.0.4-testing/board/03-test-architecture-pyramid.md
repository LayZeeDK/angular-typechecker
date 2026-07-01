# Board Member 3 -- Test Architecture & Pyramid Economics

**Lens:** tier design and ROI -- right unit/integration/e2e balance, substrate per tier,
fixture strategy, no redundant tiers AND no gaps, flakiness/determinism, agent+CI loop speed,
and the cost/benefit of a bespoke real-disk FsTree wrapper (deep import + quarantine + drift tripwire).
**Bias:** a lean, durable, high-signal pyramid. Buy fidelity at the cheapest tier that can catch the regression.

Grounding read (this session): SANDBOX-TECHNIQUES, CONNECT-TECHNIQUES, NX-FSTREE-INTERNALS,
CURRENT-AUDIT-AND-GENERATOR, DIAGNOSTIC-CATALOG, codebase/TESTING, PROJECT `## Current Milestone`.
Source-verified: `executor.ts` is a thin adapter (`normalizeOptions -> runTypecheck -> renderReport -> evaluateResult`);
`runTypecheck({ tsConfigPath })` is the real-compiler core seam that 11 `*.integration.spec.ts` already call
directly against `fixtures/<scenario>/`; 12 committed fixture dirs exist today.

---

## D1 -- SUBSTRATE per tier (CORE)

**Recommendation:**

- **Generator unit/integration tests: in-memory `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing`. This is the whole substrate for the generator.** Seed the target project with `addProjectConfiguration`, run the generator, read back with `readProjectConfiguration`/`readJson`, assert. No disk, no flush, no teardown.
- **Do NOT author the bespoke real-disk `createFsTree`/`flushFsTreeChanges` in v0.0.4.** The generator under test is a pure `project.json` config edit (`readProjectConfiguration -> mutate targets -> updateProjectConfiguration -> formatFiles`). 100% of its observable behavior is a Tree transformation an in-memory tree captures exactly. There is no in-generator step that shells out to read its own emitted files, so real disk proves nothing the in-memory tree does not.
- **Real-disk fidelity, where it is genuinely needed, is bought ONE tier up at the existing tarball e2e** (`execSync('npx nx g angular-typechecker:typecheck-configuration ...')` against the installed pack), which exercises the full on-disk path AND the published-package resolution -- strictly more fidelity than a real-disk `FsTree`, with zero new internal-import surface.

**Rationale (pyramid economics):** The quarantine + drift-tripwire is real, recurring maintenance: one quarantined deep-import module, a `no-restricted-imports` rule, exclusion from `tsconfig.lib.json`/`files`, AND a drift spec pinned to `FsTree`/`flushChanges` shape -- a fourth gate to feed forever, plus a likely new `testing/` Nx project. That cost buys "the generator output lands on disk like a dev's disk," which the e2e already proves and the in-memory tree makes irrelevant for a config-edit generator. The deep import is internal (`nx/src/generators/tree`, no semver guarantee); every Nx bump is a potential silent break. Paying that for a tier with no unique signal is negative ROI. `createTreeWithEmptyWorkspace` is itself `FsTree('/virtual')` under the hood (per NX-FSTREE-INTERNALS), so we get FsTree's exact recorded-change semantics through a public, version-stable, zero-quarantine door. This matches all 452 Nx generator specs and both prior arts' generator-tier choice (sandbox committed test + Connect Impl-C both used `createTreeWithEmptyWorkspace`; real-disk FsTree appeared ONLY at an executor/e2e tier).

**Risk:** The in-memory tree cannot model a generator that mid-run reads files it just wrote. Mitigation: the generator spec is constrained to a config edit (no `generateFiles` of a tsconfig template in v0.0.4); IF a future generator needs that, author `createFsTree` THEN, exactly as NX-FSTREE-INTERNALS sketches (quarantine + tripwire). Documenting this as a fallback keeps the option open at ~zero carrying cost.

**DISSENT (explicit):** This contradicts `PROJECT.md:34` / Decision-table `[DEFERRED]` row, which "default leans real-disk wrapper to stay faithful to the prior art," and the milestone's stated target feature "Bespoke FsTree test utilities (`createFsTree`/`flushFsTreeChanges`)." I am dissenting from authoring them now. "Faithful to prior art" is the wrong objective function: the prior art used real-disk FsTree for an EXECUTOR/e2e tier that reads disk, not for a generator unit tier -- copying it here imports the cost without the reason. CURRENT-AUDIT-AND-GENERATOR Deliverable (2) reaches the same conclusion ("DEFER the bespoke wrapper unless a concrete real-disk need appears"). If the board wants to honor the milestone literally, the lowest-regret compromise is: author `createFsTree` as the documented fallback module + its tripwire, but DO NOT route the generator's primary specs through it -- keep them in-memory. That satisfies "the helper exists" while keeping the durable pyramid in-memory. My first-choice remains: do not author it at all this milestone; close the documentation drift as "superseded by the public helper."

---

## D2 -- NG8xxx CATALOG: organization + fixture strategy

**Recommendation:**

- **Organization: per-introduction-version drop-in files (`extended.angularNN.integration.spec.ts`, `baseline.angularNN.integration.spec.ts`) where each file uses an INTERNAL `it.each` table.** This is a hybrid, not an either/or. The file-per-major boundary is the unit of growth (a new Angular major = one new file, the convention is already established for v13 and prescribed by the catalog); the `it.each` table INSIDE each file is the unit of density (one row per NG code: `[name, fixtureScenario, expectedCode, expectedCategory, expectedCount]`). Mirrors the repo's existing `it.each` idiom (`run-typecheck.integration.spec.ts` app/lib; `matrix-5types`).
- **Fixture strategy: COMMITTED minimal fixtures, one per diagnostic, grouped `fixtures/extended-vNN/<code>/` (and `fixtures/baseline-vNN/<code>/`).** Each is a tiny component `.ts`(+`.html`) + a leaf `tsconfig` that triggers exactly that check under `strictTemplates`, with extended codes promoted via `extendedDiagnostics.defaultCategory: "error"` where the assertion needs Error category. This extends the existing `fixtures/extended-v13/` shape -- do NOT introduce jscodeshift AST injection or `nx generate`-at-test-time.

**Rationale:**

- _Data-driven table over hand-written `it` blocks:_ 14 missing extended + ~9 missing baseline codes as 23 near-identical `find(d => d.code === NG(NNNN))` blocks is copy-paste rot; an `it.each` table is one assertion body driven by a row, so adding a code is a one-line table edit + one fixture dir. Higher signal (every row asserts code AND category AND count, uniformly) and lower maintenance.
- _Per-version FILE over one mega-table:_ the catalog's taxonomy IS by introduction version, and "add a future major = drop-in file" is the explicit organizing goal. A single global table loses that and grows an ever-longer file. Per-file tables give both: drop-in growth at the file seam, density within.
- _Committed over generated fixtures (determinism + cold-compile economics):_ the dominant cost here is the COLD `performCompilation` ESM load (30000ms timeouts already in this repo; "slow" per the verified facts). Generating fixtures at test time (sandbox's `nx generate @nx/angular:library` via `execSync`) adds minutes of generation, a cross-suite filesystem lock, `NX_DAEMON=false` discipline, and a fixture-dir-vs-gitignore landmine -- all to avoid committing ~23 tiny files. Committed fixtures are deterministic (byte-identical inputs every run, no generator-version drift), reviewable in the PR, and need no lock/teardown. The repo ALREADY chose committed fixtures (`fixtures/<scenario>/`); stay consistent. Reserve programmatic injection only for a scenario too fiddly to express as a static file (none in the catalog are).
- _Assertion seam already solved:_ `runTypecheck` returns `CoreResult` exposing the diagnostic array, so exact code+count is asserted IN-PROCESS off `result.diagnostics` (no logger-capture or executor-seam change -- the sandbox's documented blocker does NOT apply here; the repo's `extended.angular13.integration.spec.ts` already does `find(d => d.code === NG(8101))`).

**Risk:** Committed fixtures can drift from the compiler if Angular changes a check's triggering condition. Mitigation: these are integration specs against the REAL `@angular/compiler-cli@22.0.4` -- a drift breaks the spec loudly (the point). Verify each code/name against the installed `error_code.d.ts` + `extended_template_diagnostic_name.d.ts` on implementation (catalog's VERIFY-ON-IMPLEMENTATION note). Second risk: 23 cold compilations is wall-clock cost; mitigate by keeping each fixture single-file-minimal (smallest program that triggers the check) and letting Nx cache the `test` target between unchanged runs.

---

## D3 -- IN-MEMORY EXECUTOR VARIANT (CORE)

**Recommendation: ADD one small mid-tier spec, but scope it tightly to the executor's UNIQUE logic, and use the in-memory tree + a real-compiler `runTypecheck` (NOT a re-mock).** Concretely: `executor.workspace.integration.spec.ts` -- build a real `ExecutorContext` (in-memory `createTreeWithEmptyWorkspace` seeded with one project pointing `tsConfig` at a committed `fixtures/` tsconfig, or a hand-built context with `root` + `projectsConfigurations`), run the published-id executor, assert it resolves `context.root` + `options.tsConfig` to the real on-disk fixture and returns the right `{ success }`. 2-4 cases (clean -> success; planted error -> failure; tsConfig path resolution; binds under published id).

**Rationale:** The jump from mocked-unit (`executor.spec.ts`) to tarball-e2e is a REAL but NARROW gap. The audit (A.2) is precise: today path-resolution (`context.root` + `tsConfig` -> absolute) and published-id binding are proven ONLY at the e2e tier, and `normalizeOptions`-against-a-real-`project.json` only via the pure spec. That is the single seam the executor adds over the already-well-covered core. It is NOT redundant with the real-compiler integration tier because that tier calls `runTypecheck({ tsConfigPath })` directly and never exercises `ExecutorContext`/`normalizeOptions`/`context.root` resolution. One spec closes the gap at a fraction of e2e cost (no pack/install). Keep it THIN -- the executor is a thin adapter, so its unique surface is tiny; do not re-litigate compiler behavior or composition here (covered by integration + mocked-unit respectively).

**Risk:** Scope creep into "re-test everything through the executor," duplicating the integration tier at higher cost. Mitigation: hard-cap at path-resolution + verdict + published-id; everything compiler-behavioral stays in `*.integration.spec.ts`; everything composition/error-classification stays in the mocked `executor.spec.ts`. If the substrate must be real-disk for the context's `tsConfig` to resolve, point at a committed `fixtures/` tsconfig on the REAL disk (it is already there) rather than authoring `createFsTree`.

---

## D4 -- GENERATOR E2E

**Recommendation: EXTEND the existing `npm pack` + tmp-install harness. Do NOT add Verdaccio. Do NOT use real-disk FsTree edits.** Add one generator-e2e spec to the existing `install-e2e` project (preferred -- reuses its `buildCleanEnv`/nested-nx env-strip/empty-`.npmrc` pattern and needs no new CI `-p` entry) that: packs+installs the tarball into an `mkdtempSync` consumer, runs `execSync('npx nx g angular-typechecker:typecheck-configuration <proj>', { cwd, env })`, asserts the on-disk `project.json` gained the target, then runs `nx run <proj>:angular-typecheck` and asserts exit 0. One case (plus optionally one per project type via `it.each`, reusing the matrix consumer workspace).

**Rationale (cost/benefit + flakiness):**

- _vs Verdaccio:_ the repo deliberately uses direct `npm pack` + tmp install -- simpler, already proven for the executor (`install-smoke`, `matrix-5types`). Verdaccio adds a long-lived registry process, global setup/teardown, an auth `.npmrc`, and a port; its scaffolded `start-local-registry.ts` `execFileSync(nx)` is KNOWN to fail on Windows arm64 (the dev platform). Introducing a second e2e mechanism for one generator spec is pure overhead. One e2e mechanism = lower flakiness surface.
- _vs real-disk FsTree edits (Connect-style):_ that mutates a generated workspace in-process to feed a real compiler -- the right tool when you lack an installed package, but here the tarball harness already gives a real installed package AND real disk AND the real `nx g` CLI path -- strictly higher fidelity and no internal deep-import.
- _Dogfooding bonus:_ the catalog/matrix fixtures can wire their target via THIS generator (sandbox's dogfooding), giving the generator extra end-to-end exercise for free.

**Risk:** e2e flakiness from pack/install timing on Windows. Mitigation: it is Linux-only in CI by design (RD-03), and the existing harness already sets `pool:'forks'`, `singleFork`, serialized, 300000ms -- inherit those verbatim. If a NEW `generator-e2e` project is created instead of folding into `install-e2e`, it MUST be added by name to ci.yml's `e2e` job `-p` list and carry `implicitDependencies: ["angular-typechecker"]`; folding into `install-e2e` avoids both. **Recommend folding in.**

---

## D5 -- CI JOBS: tier-to-job mapping

**Recommendation: change NOTHING structural; let glob-match carry the new in-plugin specs, and fold the generator e2e into the existing e2e project so no `-p` edit is needed.**

| Tier                                                        | Job                                                 | Runs where                              | CI action needed                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Generator unit/integration (in-memory tree)                 | `test` (6-cell: ubuntu 22/24/26, win 24/26, mac 24) | everywhere                              | NONE -- matches `vitest.config.mts` include glob automatically                                |
| NG8xxx catalog `*.integration.spec.ts` (cold real compiler) | `test` (6-cell)                                     | everywhere                              | NONE -- glob match                                                                            |
| In-memory executor variant `*.integration.spec.ts`          | `test` (6-cell)                                     | everywhere                              | NONE -- glob match                                                                            |
| Generator e2e (pack+install+`nx g`)                         | `e2e`                                               | ubuntu Node 24 ONLY (Linux-only, RD-03) | NONE if folded into `install-e2e`; ELSE add new project to `-p` list + `implicitDependencies` |
| (No new drift gate)                                         | --                                                  | --                                      | NONE -- in-memory default carries no internal-import risk                                     |

**Rationale:** Keep correctness-critical specs (generator + full catalog) on ALL 6 cells -- they are fast-ish and the cross-OS signal (Windows arm64 path/case sensitivity, mac) is exactly where this tool's realpath/boundary logic has historically bitten. Keep the heavy pack/install e2e Linux-only single-cell -- it is slow and OS-portability of the install path is not the value (RD-03's "consistent gate meaning"). The single required `ci` aggregate check is preserved unchanged: every new spec lands inside jobs it already gates on. Critically, choosing the in-memory substrate (D1) means NO new `typecheck-drift` input and NO new internal-import tripwire to wire -- one fewer moving part in CI.

**Risk:** A new e2e PROJECT would be invisible to CI until added to the explicit `-p` list (a real footgun -- the list is intentional, not auto-discovered). Mitigation: fold the generator e2e into `install-e2e` (no list edit). If a new project is unavoidable, the requirement MUST call out the `-p` edit + `implicitDependencies` as a checklist item.

---

## D6 -- SCOPE/RISK: the minimal coherent pyramid

**The lean pyramid that closes the real gaps without redundant tiers or over-engineered infra:**

1. **Generator unit (in-memory tree)** -- target shape + executor-id + options + idempotency (run-twice-equal) + error-on-missing-project + a `toMatchSnapshot` of the resulting `project.json`. Extend `schema-parity.spec.ts` to gate the generator's `schema.json`/`schema.d.ts`. **(fast, public API, zero quarantine)**
2. **NG8xxx catalog integration (committed fixtures + per-version `it.each`)** -- the 14 missing extended + missing baseline codes by exact code/category/count. **(closes the headline gap; reuses `runTypecheck`/`CoreResult`)**
3. **In-memory executor variant (one thin spec)** -- `context.root`+`tsConfig` path resolution + verdict + published-id binding. **(closes the mocked-unit -> tarball-e2e gap at low cost)**
4. **Generator e2e (folded into `install-e2e`)** -- one pack/install/`nx g`/`nx run` case (optionally per project type). **(real-disk + real-CLI + real-package fidelity, one mechanism)**

**Explicitly OUT (over-engineering / redundant):**

- Bespoke `createFsTree`/`flushFsTreeChanges` + quarantine + drift tripwire + new `testing/` project -- **DEFER** (D1 dissent). Negative ROI for a config-edit generator; fidelity bought at e2e instead.
- Verdaccio -- redundant second e2e mechanism (D4).
- jscodeshift AST-injection / `nx generate`-at-test-time fixture builders + cross-suite filesystem lock + reference-counted lifecycle -- the sandbox needed these because it generated fixtures; committed fixtures make them unnecessary (D2).
- A `quiet`-mode CLI-spawning runner -- not in v0.0.4 scope (no new mode); `--max-warnings` verdict is already covered.

**Risk to the whole strategy:** the milestone's stated target features LIST the bespoke FsTree utilities, so deferring them is a scope deviation that needs an explicit decision (see D1 DISSENT). Second risk: cold-compile wall-clock for ~23 new catalog fixtures; mitigated by minimal single-file fixtures + Nx caching of the `test` target.

---

## Recommended strategy (this lens)

Build a four-tier pyramid whose substrate is chosen by what each tier uniquely proves, not by fidelity for its own sake. The generator is a pure `project.json` edit, so its tests live entirely on the **public in-memory `createTreeWithEmptyWorkspace`** -- fast, version-stable, zero-quarantine, and identical to how all of Nx and both prior arts test generators; the bespoke real-disk `createFsTree` wrapper and its deep-import quarantine + drift tripwire are **deferred** (documented as a fallback) because they are pure maintenance cost for a tier with no real-disk signal, and the genuine on-disk proof is bought one tier up at the existing tarball e2e. The headline gap -- 14 of 16 extended NG8xxx (plus missing baseline NG codes) unasserted -- closes with **committed minimal fixtures driven by a per-introduction-version `it.each` table** (drop-in file for growth, data-driven density within, exact code+category+count off `CoreResult`), staying consistent with the repo's existing committed-fixture choice and avoiding the sandbox's generate-at-test-time machinery and its flakiness. One **thin in-memory executor spec** closes the narrow mocked-unit-to-e2e gap (path resolution + verdict + published-id), and one **generator e2e folded into `install-e2e`** gives full real-CLI/real-package fidelity with a single e2e mechanism and no CI `-p` churn. Net: every new spec lands in jobs the single required `ci` check already gates, correctness specs run on all six OS/Node cells, the heavy e2e stays Linux-only, and the durable surface adds zero new internal-import or new-project maintenance.

## Top 3 priorities

1. **Close the NG8xxx coverage gap (D2)** -- the milestone's headline deliverable: committed per-code fixtures + per-version `it.each` integration files asserting all 16 extended + missing baseline codes by exact code/category/count. Highest signal, directly serves the type-checking tool's correctness-is-the-product mandate.
2. **DEFER the bespoke FsTree wrapper; use in-memory `createTreeWithEmptyWorkspace` (D1)** -- the highest-leverage architecture decision. Avoids a permanent quarantine + drift-tripwire + new-project tax for zero unique signal; raise the DISSENT against the milestone's literal target-feature list so it is a deliberate, recorded choice (HIGH-IMPACT, decide explicitly).
3. **Add ONE thin in-memory executor spec (D3) + fold the generator e2e into `install-e2e` (D4/D5)** -- close the only other real gap cheaply and keep e2e to one mechanism with no CI list churn, preserving the single required check.
