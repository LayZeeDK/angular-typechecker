# Board Member 5 -- Adversarial Risk & YAGNI / Scope Discipline

**Lens:** Red-team the whole plan. Challenge scope creep, fragile substrates, over-engineering vs under-testing, redundant tiers, and mis-prioritization. Argue for the smallest strategy that closes the REAL, verified gaps and name explicitly what NOT to do.

**One-line thesis:** The milestone has exactly ONE verified, high-value gap (14 of 16 NG8xxx unasserted) and one genuinely-trivial feature (the generator). Everything labeled "adopt the full sandbox/Connect technique stack" is prior-art cargo-culting that imports machinery the prior arts needed for their OWN architectures, not gaps this repo has. Cut the bespoke FsTree wrapper, cut the invented mid-tier executor variant, and right-size the generator e2e. Spend the saved budget on fixtures+assertions for the 14 missing diagnostics -- the only thing here that actually protects the product.

---

## D1 SUBSTRATE -- bespoke real-disk `createFsTree` / `flushFsTreeChanges`

**Recommendation: DO NOT BUILD IT. Use the public in-memory `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing`. Hard DISSENT against the milestone's stated default ("default leans real-disk wrapper to stay faithful to the prior art").**

**Rationale (the case for cutting):**

- The generator under test is a pure `project.json` config edit: `readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` -> `formatFiles`. 100% of its observable behavior is a Tree transformation. An in-memory Tree captures all of it. There is NO behavior inside the generator boundary that reads real disk mid-run. (CURRENT-AUDIT-AND-GENERATOR.md Recommendation (2) reaches the same conclusion independently.)
- "Stay faithful to the prior art" is not a requirement -- it is the textbook YAGNI trap. The prior arts that used real-disk `FsTree` (`flushChanges`) did so at their EXECUTOR e2e tier, where a real `ngc` must observe edits on disk (CONNECT-TECHNIQUES.md 2c, 6c). The sandbox's actual COMMITTED generator test uses in-memory `createTreeWithEmptyWorkspace` -- the real-disk `FsTree` approach there was "PROPOSED but never adopted" (SANDBOX-TECHNIQUES.md section 2 KEY CORRECTION + section 9.5). So "faithful to the prior art" actually means: use the in-memory tree, exactly as both prior arts' generator tests did.
- Nx's own 452 generator specs use the in-memory `/virtual` tree; ZERO `@nx/*` generator specs flush to real disk (NX-FSTREE-INTERNALS.md section 6b). Building the bespoke wrapper puts this repo in a camp of one, for a config-edit generator.

**Risk of building it anyway (the failure modes the other lenses will rationalize away):**

- **Unstable internal deep import.** `FsTree`/`flushChanges` are reachable ONLY via `nx/src/generators/tree` -- no public re-export, no semver guarantee (NX-FSTREE-INTERNALS.md sections 0, 4, 8). An Nx upgrade can move/rename/restructure it silently. The mitigation proposed is itself a tax: a quarantine file + an `eslint-disable` + a `no-restricted-imports` rule + a drift-tripwire spec that must be maintained on every Nx bump. That is THREE new maintenance artifacts to test a generator that needs NONE of them.
- **The drift tripwire is a permanent liability disguised as safety.** It pins constructor arity, `flushChanges` arity, and an 11-method prototype list (NX-FSTREE-INTERNALS.md section 8b). Every Nx minor/major risks a red CI on a path that protects test-only infrastructure -- a recurring false-alarm generator. The repo's `main` is PR-only with a single required `ci` check (AGENTS.md); a flaky internal-import tripwire can lock the merge button on an unrelated PR.
- **Cross-platform real-disk I/O on Windows-arm64.** `mkdtempSync` + `rmSync` + Windows file-locking is exactly the class of flake the repo already fights (CONNECT-TECHNIQUES.md section 7 "Windows/cross-drive gotchas"). In-memory has zero teardown and zero I/O.

**When (if ever) is real-disk justified?** Only if a FUTURE generator emits template files (`generateFiles`) AND something downstream must read those emitted files off disk mid-generation -- none of which exists in v0.0.4. The genuine "does the generated config actually run on disk" proof already lives in the tarball e2e tier (`install-smoke`, `matrix-5types`), which is HIGHER fidelity than a real-disk `FsTree` and uses zero internal imports. Reserve `createFsTree` as a documented fallback to be authored if-and-only-if such a need appears. Do not pre-build it.

**Net:** Cutting this removes the single largest source of fragility AND maintenance in the milestone, and removes a deliverable that exists only to discharge a v0.0.1 documentation drift. Close the drift by writing "superseded by the public `@nx/devkit/testing` helper," not by authoring fragile machinery to retroactively make a stale doc true.

---

## D2 NG8xxx CATALOG -- cheapest reliable way to close the 14 missing

**Recommendation: ONE fixture per diagnostic + per-introduction-version integration files (`extended.angularNN.integration.spec.ts`), asserting exact code + `.category` via the existing `NG()` + `CoreResult` seam. This is the ONE place to spend real effort. No new infrastructure.**

**Rationale:**

- The seam already exists. Integration specs call `runTypecheck` and assert off `CoreResult` (`diagnostics.map(d => d.code)`, `errorCount`, category) -- TESTING.md and the audit confirm this is the established idiom, already used for NG8101/NG8109. Closing the gap is "add fixtures + assertions," NOT "build a code/count assertion seam." The sandbox brief's hand-wringing about "the executor only returns `{ success }`" does NOT apply -- this repo's `runTypecheck` already returns the diagnostics array.
- Version-split scaffolding already exists (`baseline.angular13` / `extended.angular13`); only v13 is populated. Per-version files keep "add a future major" a drop-in (DIAGNOSTIC-CATALOG.md section 60-62), match Angular's own two-layer organization (CURRENT-AUDIT-AND-GENERATOR.md Part C), and match the repo's already-chosen convention. No reason to relitigate organization.

**What's OVER-ENGINEERING here (cut it):**

- **jscodeshift / AST-injection toolkit.** The sandbox generates fixtures at test time and mutates them with a 1373-line jscodeshift toolkit (SANDBOX-TECHNIQUES.md sections 4-5). This repo uses COMMITTED `fixtures/<scenario>/` dirs and a real `performCompilation` (TESTING.md). Committed fixtures are simpler, deterministic, reviewable, and already the repo's pattern. Do NOT import jscodeshift. A broken `.html`/`.ts` checked into `fixtures/extended-vNN/` is the entire fixture.
- **A single data-driven mega-table over all 16.** Tempting for DRY, but it couples every diagnostic into one spec: a single fixture-resolution bug or one compiler quirk fails the whole table, and the per-code `it` sentence (which the repo uses to cross-reference requirement ids) is lost. Prefer one `it` per code (with its NG code in the title) grouped into the version file. `it.each` over a per-version array is acceptable WITHIN a version file (the repo already uses `it.each`), but do not collapse all majors into one global table.
- **`forceExtendedDiagnosticsAsErrors` as a general toggle.** The repo already proved promotion via `defaultCategory: "error"` for NG8101 (`extended.promotion`). Generalize that ONE mechanism; do not build a per-fixture tsconfig-rewriting helper. Most NG8xxx assertions only need to find the code and assert `.category === Warning` (default) -- promotion to Error is a single shared mechanism test, not per-code.

**Risk:** The real risk is UNDER-testing here while OVER-investing in D1/D3/D4. Mis-prioritization is the milestone's central flaw: the verified gap (14 codes) is the cheapest tier to close and the only one protecting the product, yet it is presented as co-equal with three speculative infrastructure tiers. VERIFY each code/name against installed `@angular/compiler-cli@22.0.4` on implementation (catalog's VERIFY-ON-IMPLEMENTATION note) -- some codes have aliases (NG8004/NG1019) and the docs lag the compiler; a wrong code number is the only way this tier fails.

---

## D3 IN-MEMORY EXECUTOR VARIANT -- real gap or invented tier?

**Recommendation: INVENTED TIER. CUT IT (or downgrade to at most one tiny test). DISSENT against treating it as a requirement.**

**Rationale (push-back):**

- The audit itself flags this as "optional but recommended" and describes the supposed gap as: the executor resolves `context.root` + `tsConfig` to a real path (1), `normalizeOptions` against a real `project.json` (2), and binds under its published id (3). But: (2) is ALREADY covered by `normalize-options.spec.ts` (pure), and (1)+(3) are ALREADY covered end-to-end at the e2e tier (`install-smoke`, `matrix-5types`) per CURRENT-AUDIT-AND-GENERATOR.md A.2. So every claimed gap is already covered by an EXISTING tier.
- The argument "the jump is mocked-unit -> full-tarball-e2e with nothing in between" is an aesthetic test-pyramid argument, not a regression-catching one. A tier is justified only if it catches a class of bug that no other tier catches. Name that bug class -- nobody has. Path resolution that the e2e tier already exercises against a real installed tarball is strictly higher fidelity than running the executor against a `createTreeWithEmptyWorkspace`-seeded fake context.
- This tier exists primarily to give the bespoke `createFsTree` a second consumer ("the executor could reuse it" -- A.2). That is the tell: a substrate looking for a justification. Cut D1, and the only remaining rationale for D3 evaporates with it.

**Risk of building it:** A redundant mid-tier adds a spec that overlaps two existing tiers, must be maintained, and gives false confidence that something new is covered. The real risk it papers over is that the executor's context/path handling is only proven on Linux at the e2e tier -- if THAT is the worry, the fix is a Windows e2e cell, not a fake-context unit tier. (Note: the e2e job is Linux-only by design, RD-03; a genuine cross-platform executor-resolution concern belongs in the matrix `test` job, which IS multi-OS, not in a new in-memory tier.)

**Concession:** If the board insists on closing the "executor never exercised against any workspace context in-process" item, the MINIMUM is ONE test that builds a literal `ExecutorContext` (as `executor.spec.ts` already does for its mocked cases) pointing at a committed `fixtures/` tsconfig and asserts the executor resolves+runs. That needs NO Tree substrate at all -- just the existing fixtures. It is one `it`, not a tier.

---

## D4 GENERATOR E2E -- warranted for a trivial config edit?

**Recommendation: Extend the EXISTING tarball harness with ONE generator smoke test inside the EXISTING `install-e2e` project. Do NOT create a new `generator-e2e` Nx project. Do NOT introduce Verdaccio. DISSENT against a dedicated e2e project.**

**Rationale:**

- The generator is a ~33-line `project.json` edit (SANDBOX-TECHNIQUES.md section 1). Its Tree behavior is fully covered by the in-memory unit test (D1). The ONLY thing a unit test cannot prove is "the generator resolves from the INSTALLED package and `nx g angular-typechecker:typecheck-configuration` works as a consumer runs it." That is ONE assertion: pack+install (already done by `install-smoke`), `execSync('npx nx g ...')`, assert the on-disk `project.json` target, optionally `nx run <proj>:angular-typecheck`. (CURRENT-AUDIT-AND-GENERATOR.md B.3 route 2.)
- A NEW Nx e2e project is pure overhead: a new `project.json` with `implicitDependencies`, a new vitest config, a new `tsconfig.spec.json`, AND a mandatory edit to ci.yml's explicit `-p` list (or it silently never runs -- see D5). All to host a single `execSync` that the existing `install-e2e` project can host with zero new wiring.
- Verdaccio is a hard NO. The repo deliberately uses `npm pack` + tmp install, not Verdaccio (CURRENT-AUDIT-AND-GENERATOR.md B.3). The scaffolded Verdaccio `start-local-registry.ts` `execFileSync(nx)` is a KNOWN Windows failure (B.3 Windows caveat). Introducing a second e2e mechanism for one generator test is the definition of scope creep.

**Risk:** A dedicated generator-e2e project that someone forgets to add to ci.yml's `-p` list is WORSE than no e2e -- it's a green-looking spec that never runs (D5 trap). Folding the generator smoke into `install-e2e` inherits an already-CI-wired project and removes that failure mode entirely.

---

## D5 CI JOBS -- minimal wiring + the silent-skip trap

**Recommendation: ZERO ci.yml changes for the high-value work; ONE line ONLY if a new e2e project is created (which D4 says not to). Loudly flag the explicit-`-p`-list silent-skip trap as the dominant CI risk.**

**Rationale + the trap:**

- In-plugin specs (generator unit + the 14 NG8xxx integration specs) land AUTOMATICALLY in the 6-cell `test` matrix the moment they match the include glob -- NO ci.yml edit needed (CURRENT-AUDIT-AND-GENERATOR.md A.4). This is the good path and covers everything that matters in this milestone.
- **THE TRAP:** the `e2e` job runs an EXPLICIT `npx nx run-many -t test -p <list>` (A.4, ci.yml ~142-143). A new e2e project is INVISIBLE to CI until added by name to that list. The `ci` aggregate gate tolerates `skipped` jobs (it must, for the planning-only path via `predicate-quantifier: every`). So a new-but-unlisted e2e project produces NO failure and NO signal -- it simply never runs, and the required check stays green. This is the single most dangerous CI failure mode in the milestone: a test you believe is gating that is silently absent.
- This trap is the strongest concrete argument FOR D4's "fold into the existing `install-e2e` project" recommendation: an existing project in the list cannot be silently skipped.

**Risk / must-do if a new project IS created despite D4:** add it to the `-p` list AND give it `implicitDependencies: ["angular-typechecker"]` so the fresh tarball builds first. Then verify it actually executed in a CI run (check the job log shows the project, not just a green check) -- do not trust the green tick alone, because a typo'd project name in `-p` also passes silently. The drift gate (if D1 is wrongly adopted) similarly needs its path added to the `typecheck-drift` target `inputs` or it won't re-run on change -- another silent-skip variant.

---

## D6 SCOPE / RISK (CORE) -- generator in a "testing" milestone; smallest closing strategy

**Recommendation on scope:** The generator and the testing work CAN ride together, but ONLY because the generator is trivial and is the legitimate VEHICLE for the one generator-testing technique the repo lacks. I do NOT recommend a full milestone split -- that's process overhead for a ~33-line feature. BUT the milestone's framing ("adopt the FULL testing-technique stack proven in the sandbox + Connect prior art") is the actual problem, independent of the generator. That framing treats "techniques the prior arts used" as "gaps this repo has," and they are not the same set.

**The honest scope read:** v0.0.4 is really TWO things: (a) ship a trivial generator + its idiomatic in-memory unit test (small, clean, justified), and (b) close the 14-NG8xxx gap (the verified, high-value work). Everything else -- bespoke FsTree, drift tripwire, in-memory executor tier, dedicated generator-e2e project, Verdaccio, jscodeshift -- is prior-art adoption masquerading as gap-closure. The generator pulling a "full technique stack" into the milestone IS the scope creep; the generator itself is not.

**Smallest strategy that closes the verified gaps:**

1. Ship the generator (`generator.ts` + `schema.json` + `schema.d.ts` + `generators.json` + `package.json` `generators` field + build-asset glob). Trivial.
2. Generator unit test via in-memory `createTreeWithEmptyWorkspace` (D1): target-added, executor-id, options shape, idempotency (run-twice-equal), error-on-missing-project. Extend the existing `schema-parity.spec.ts` idiom to the generator's schema.
3. One generator smoke test folded into the EXISTING `install-e2e` project (D4): `nx g` against the installed tarball -> assert on-disk `project.json` -> `nx run`.
4. Close the 14 missing NG8xxx (+ the missing baseline NG codes the catalog scopes) via committed fixtures + exact-code/category assertions in per-version files (D2). THIS is where the budget goes.
5. Zero ci.yml changes (everything in-plugin auto-runs); verify the one e2e smoke actually executes.

**Top 3 CUTS (what to NOT do):**

1. **CUT the bespoke `createFsTree`/`flushFsTreeChanges` real-disk wrapper** -- and with it the `eslint-disable` quarantine, the `no-restricted-imports` rule, and the FsTree drift tripwire. Use public `createTreeWithEmptyWorkspace`. (Removes the milestone's biggest fragility + maintenance liability; the deep import has no semver guarantee.)
2. **CUT the in-memory executor variant tier** -- every claimed gap is already covered by `normalize-options.spec.ts` + the e2e tier. At most one fixture-backed `it`, no new substrate.
3. **CUT the dedicated `generator-e2e` Nx project AND Verdaccio AND the jscodeshift injection toolkit** -- fold the generator smoke into `install-e2e`; keep committed fixtures for diagnostics.

**Top 3 MUST-DOs:**

1. **Assert the 14 missing NG8xxx (+ scoped baseline NG codes) by exact code/count** on committed fixtures, organized per introduction version. This is the only verified, product-protecting gap -- do it first and well; verify each code against `@angular/compiler-cli@22.0.4` on implementation.
2. **Ship the generator + its in-memory unit test + idempotency + schema-parity gate.** Small, clean, the legitimate core of the "generator" half.
3. **Add exactly one generator smoke to the existing `install-e2e` project and confirm it actually runs in CI** (guard against the explicit-`-p`-list silent-skip trap; trust the job log, not the green tick).

---

## Recommended strategy (this lens)

Treat v0.0.4 as "close the 14-NG8xxx gap, ship a trivial generator, and prove the generator works as installed" -- nothing more. The single verified, high-value gap (14 of 16 extended diagnostics unasserted) is also the CHEAPEST to close because the assertion seam (`CoreResult` + `NG()`), the fixture convention (committed `fixtures/`), and the version-split scaffolding all already exist; it needs fixtures and assertions, not infrastructure. The generator is a 33-line config edit whose behavior is fully captured by the public in-memory Tree that both prior arts' committed generator tests actually used; building a bespoke real-disk wrapper over an UNSTABLE internal deep import (`nx/src/generators/tree`) -- plus its mandatory quarantine and drift-tripwire tax -- imports fragility and recurring maintenance to gain fidelity the generator does not need and the tarball e2e already provides at higher fidelity. The "in-memory executor variant" is a redundant tier whose every claimed gap is already covered, kept alive mainly to justify the FsTree wrapper; cut the wrapper and it falls with it. The generator e2e is one `execSync` that belongs in the existing `install-e2e` project, not a new Nx project (a new unlisted e2e project silently never runs against the explicit `-p` gate -- the milestone's most dangerous CI failure mode). The discipline move is to stop equating "techniques the prior arts used" with "gaps this repo has": the prior arts needed real-disk FsTree and jscodeshift for THEIR architectures; this repo's architecture (committed fixtures, `runTypecheck` returning diagnostics, an existing tarball harness) already neutralizes those needs. Spend the budget saved by the three cuts on more, better diagnostic fixtures.
