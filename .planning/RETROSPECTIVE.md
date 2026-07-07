# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.0.1 -- Complete Angular type-check, decoupled from build/test

**Shipped:** 2026-06-29
**Phases:** 8 (1-7 + inserted 5.1) | **Plans:** 29 | **Commits:** 255 | **Timeline:** 3 days

### What Was Built

- A framework-agnostic core (`runTypecheck`) running `@angular/compiler-cli` whole-program no-emit with a custom unconditional all-diagnostics gatherer (TS + template type-check + extended NG8xxx), asserted against the v13->v22 catalog.
- A sub-50-line CommonJS Nx executor (`angular-typecheck`) that loads the ESM-only compiler-cli via `await import()` (no downlevel), with project-boundary filtering, report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` output.
- An Nx-cacheable target proven correct by a dependency-error-busts-cache test, validated across all five project types against the installed tarball plus a cross-OS / multi-Node CI matrix.
- A supply-chain-hardened npm publish (tokenless OIDC Trusted Publisher + SLSA v1 provenance) shipping 0.0.1 and 0.0.2, and a PR-only Release-PR workflow with a clean public changelog.

### What Worked

- **Riskiest-first, gated spike (Phase 1).** Proving the two scariest unknowns -- `import(` survival under `module: nodenext` and the unconditional gatherer surfacing NG8109 where `ngc` short-circuits -- before building the engine meant zero late-stage architecture rework.
- **Engine-before-Nx with a hard core/adapter boundary.** A fully testable, `@nx/devkit`-free core let every deferred surface (CLI, builder, generators) stay cheap, and ESLint module-boundary enforcement kept the boundary honest.
- **Built-artifact assertions (GATE A) over source assertions.** Asserting the emitted/packed bytes (not source) caught the exact failure modes that only appear post-compile and post-pack.
- **Vertical MVP slicing.** Packaging + one e2e smoke landed in Phase 5 (mid-project), so "does it actually install and run" was answered early rather than at the end.

### What Was Inefficient

- **Requirements status tracking lagged the work.** 20 verified-SATISFIED requirements still showed Pending/`[ ]` until the milestone audit closed them -- per-phase VERIFICATIONs kept deferring status closure to "the milestone audit". A per-phase status flip would have avoided the audit-time cleanup.
- **First OIDC publish 404 cost a whole inserted phase (5.1).** The root cause was the Trusted Publisher never being saved (a simultaneous Publishing-access change blocked it), not the registry-url contingency that was pre-baked into the roadmap -- a misleading hypothesis carried forward as if settled.
- **A CI skip-gate bug surfaced only on a live run** (Phase 7: the matrix did not actually skip on docs-only changes); `act` static checks did not catch it because Docker was unavailable on the dev box.

### Patterns Established

- **GATED spike phase** with an explicit GO/NO-GO checklist before committing to an engine approach.
- **Core (framework-agnostic) vs adapter (Nx)** split enforced by a files-scoped ESLint import ban, not just convention.
- **`@nx/devkit` pinned dependency, no `nx`; compiler-cli + typescript as peers** (the Nx publish-plugin recipe + registry-listing requirement).
- **Tarball-first audits** (`publint` + `attw --pack` against the packed `.tgz`, never the source tree).
- **Release-PR flow**: cut on a `release/*` branch (`git.tag:false`, `push:false`, `createRelease:false`) -> PR -> tag the merge commit -> tokenless OIDC publish; curate the public changelog to strip GSD phase/plan scopes.

### Key Lessons

1. **Assert built/packed artifacts, not source.** The `import(` downlevel and the type-resolution (`attw`) failures only exist after compile/pack -- source-level checks give false confidence.
2. **Close requirement statuses at phase verification, not at milestone audit.** Deferring status closure batches avoidable cleanup and makes mid-project coverage reads stale.
3. **A pre-baked failure contingency is a hypothesis, not a fact.** The "drop registry-url on 404" note was wrong; investigate the actual root cause before applying a carried-forward remedy.
4. **Static workflow checks are not a substitute for a live CI run** when the local box can't run the real engine (no Docker -> `act` can't schedule changes-dependent jobs). Gate path-aware CI logic on a real PR run.

### Cost Observations

- Model mix: quality profile (Opus) for all GSD planning/execution/verification agents (per `config.json model_overrides`).
- Notable: the gated-spike + vertical-MVP structure front-loaded the expensive risk discovery into Phase 1 and Phase 5, keeping later phases mostly mechanical.

---

## Milestone: v0.0.3 -- Engine hardening

**Shipped:** 2026-06-30
**Phases:** 4 (8-11) | **Plans:** 14 | **Commits:** ~150 | **Timeline:** 2 days

### What Was Built

- Correctness/completeness fixes on the existing engine: config-resolution 500 re-thrown as infrastructure, global TS diagnostics via `getGlobalDiagnostics()`, empty-`fileName` diagnostics kept, and a pure `toExitCode` 0/1/2 policy.
- Run-level resilience via a GATED-spike-chosen HYBRID per-file fault isolation (one `FatalDiagnosticError` no longer collapses the run) plus a loud, never-silent TCB-generation suppression notice, a `realpath()` try/catch, and `suppressOutputPathCheck`.
- A build-time `tsconfig.drift.json` + `typecheck-drift` CI target that breaks the build when the real `@angular/compiler-cli` `api.Program` drifts from the vendored shim or the NG error-code encoding changes; the `EmitFlags.None` fabrication corrected; greppable vendor markers.
- `fallow@2.103.0` adopted as a path-gated, SHA-pinned, new-only CI quality gate (least-privilege `contents: read`, single required check unchanged), green on adoption and proven RED on introduced dead code.

### What Worked

- **The gated spike paid off again (RES-01).** Probing the live `api.Program` for file-less non-template diagnostics BEFORE writing isolation code settled the SIMPLE-vs-HYBRID question with evidence (GO = HYBRID) instead of a guess, and surfaced the real `WholeProgram`-priming limitation early.
- **Every requirement grounded in verified prior art.** Tracing each COR/RES/HARD item to a numbered finding in `PRIOR-ART-SUMMARY.md` (re-verified against `@angular/build` + compiler-cli at 22.0.4) kept the milestone targeted and rejected speculative scope.
- **Honest, evidence-backed deferral over a forced feature.** RES-02 was reframed (run-level resilience + a loud notice) and the impossible-on-this-surface part (per-file template recovery) was deferred to REP-RES-02b, backed by a 5-lens Opus panel -- rather than forcing `OptimizeFor.SingleFile` semantics onto the `WholeProgram` surface.
- **Build-time drift tripwire as a maintainability seam.** Encoding the vendored-shim contract as a compiled `tsconfig.drift.json` assertion turns a silent future under-gather into a loud CI failure.
- **A deep code review created real value mid-milestone.** Phase 11 (the `fallow` gate) was an emergent phase the Phase-10 review surfaced; acting on it produced a durable CI quality gate.

### What Was Inefficient

- **Requirement-status lag RECURRED.** HARD-01/HARD-05 checkboxes stayed `[ ]` while their traceability + VERIFICATION already said Complete, and Phase 10 SUMMARY frontmatter `requirements_completed` was empty for 10-01/02/04 (IDs only in `tags:`/body). This is the SAME lesson v0.0.1 logged ("close statuses at phase verification") -- it was not fully internalized and the milestone audit again did cleanup.
- **PR-review rounds converged to cosmetic.** Three `/gsd-quick --full` review-fix rounds on PR #11 (260630-dyd/fg0/jnl) trended to cosmetic-only by round 3 (de-pinning comments, de-tautologizing a test) -- each still a full quick-task cycle.
- **Upstream tool drift cost a workaround.** GSD's `fallow` structural pre-pass is a silent no-op on fallow 2.x (CLI flag drift); the phase had to wire a gate around the manually-verified 2.x invocation rather than trust the integration.
- **The milestone-close audit mis-flagged complete quick tasks.** The `audit-open` scanner reads a bare `SUMMARY.md` while `/gsd-quick` writes `<id>-SUMMARY.md`, so three verified+shipped tasks showed as incomplete at close (resolved with marker files).

### Patterns Established

- **Build-time drift tripwire** (`tsconfig.drift.json` + a dedicated CI target) asserting a vendored-shim contract against the real upstream types.
- **Greppable vendored-divergence markers** (`// angular-typechecker: vendored -- <reason>`) so every intentional shim divergence is discoverable.
- **Never-silent incompleteness:** when a whole-program signal (TCB-generation Fatal) suppresses some diagnostics, emit a LOUD notice naming the offending file rather than silently under-reporting.
- **`fallow` as a new-only, least-privilege CI gate:** resolve current findings (not baseline them), keep `contents: read`, path-gate it, and keep the single required check stable so no branch-ruleset change is needed.
- **Evidence-backed deferral:** record a mechanically-impossible-here feature as a Future Requirement with a multi-lens verification trail, instead of forcing it onto the wrong engine surface.

### Key Lessons

1. **The "close statuses at phase verification" lesson must be enforced, not just noted.** It recurred in v0.0.3 (HARD checkboxes + empty SUMMARY frontmatter). Flip requirement checkboxes and fill `requirements_completed` at each phase's verification, not at the milestone audit.
2. **Add a stopping rule for review-fix rounds.** Once a review round produces only cosmetic findings, fold them into a single follow-up rather than spinning another full quick-task cycle.
3. **When an upstream CLI drifts, gate on the manually-verified invocation, not the stale integration.** The `fallow` pre-pass was a silent no-op; the working path was to run the real 2.x command in CI directly.
4. **Prefer an honest, evidence-backed deferral to an impossible feature.** REP-RES-02b deferral (with a 5-lens panel) was the right call over forcing per-file template recovery onto the `WholeProgram` surface.

### Cost Observations

- Model mix: quality profile (Opus) for all GSD planning/execution/verification agents (per `config.json model_overrides`).
- Notable: a small, independent-cluster phase structure (8/9/10 mostly parallel, single internal gate in 9) kept execution cheap; the costs concentrated in the RES-01 spike, the RES-02 reframe analysis, and the three PR-review rounds.

---

## Milestone: v0.1.0 -- Reference-walking engine, typecheck executor rename, and the configuration + init generator suite

**Shipped:** 2026-07-02
**Phases:** 5 (12-15 + inserted 13.1) | **Plans:** 16 | **Commits:** ~198 | **Timeline:** 3 days

### What Was Built

- A reference-walking engine mode: `runTypecheck` on a solution `tsconfig.json` walks its in-project referenced leaves (lib/app + spec) in one call, unions + dedupes by value identity, and applies a module-boundary guard -- GO-gated by spikes 001-005 before any production code was written.
- A BREAKING executor rename `angular-typechecker:angular-typecheck` -> `angular-typechecker:typecheck` across the full surface (executors.json, `nx.json`, fixtures, specs, README), driving the 0.0.3 -> 0.1.0 minor bump.
- A `configuration` + `init` generator suite (config-edit only, no file emission) that wires ONE minimal `typecheck` target and seeds `nx.json` caching, plus `nx add angular-typechecker` support.
- Generator e2e against the real installed tarball through both entry points, and a CI self-audit guard that turns a forgotten e2e project `-p` entry into a loud failure.
- A complete 18-member extended-diagnostic catalog + enum-completeness tripwire that fails CI loudly on future Angular drift.

### What Worked

- **The gated-spike pattern paid off a third time.** Spikes 001-005 proved runtime solution-tsconfig reference-walking feasible on the existing `performCompilation` engine BEFORE the milestone's shape was finalized, resolving an open generator-design question (per-project-type `tsConfig` vs. multiple targets vs. walking) with evidence instead of a guess -- the same pattern that worked in v0.0.1 (Phase 1) and v0.0.3 (RES-01).
- **A mid-milestone re-scope, taken decisively on new evidence.** When the spikes proved walking feasible, the milestone was re-versioned v0.0.4 -> v0.1.0 same-day, adding the breaking executor rename and expanding the generator into a suite (`configuration` + `init` + `nx add`) rather than shipping the originally-scoped narrower generator and deferring the improvement.
- **A multi-lens Opus board ratified the testing strategy before building it.** The 8-lens (5 constructive + 3 adversarial) board on the v0.0.4 testing strategy rejected speculative test infrastructure (bespoke `createFsTree`, a mid-tier executor-vs-workspace test, Verdaccio) up front, keeping the generator tests on the public in-memory substrate.
- **Review rounds converged to a verifiable zero.** Four PR-review rounds ran against PR #15 (two review-triage rounds + a `/simplify` complexity pass + a `/thermos:thermos` audit); the FOURTH round produced zero code changes because every finding was already satisfied, deliberately decided, or correctly deferred -- a clean signal that the earlier rounds had been thorough rather than a sign of churn.
- **Breaking changes taken cleanly pre-1.0.** Both the executor rename (EXEC-01) and a mid-milestone public-barrel trim (a PR-review finding, not originally planned) were shipped as `feat!`/`refactor!` commits rather than deferred or shimmed, keeping the 0.x public surface honest.

### What Was Inefficient

- **The requirement-status-lag lesson recurred a THIRD time.** v0.0.1 and v0.0.3 both logged "close statuses at phase verification, not at milestone audit" as a lesson to enforce -- it recurred again in v0.1.0 (CAT-05/WALK-02/GEN-06 missing from SUMMARY `requirements-completed` frontmatter, caught and backfilled by a dedicated quick task, commit `642d08d`). Three milestones in a row logging the same fix means the lesson is not actually enforced by process; it needs a mechanical check (e.g., a phase-verification step that fails if `requirements-completed` is empty), not another retrospective note.
- **The `audit-open` bare-`SUMMARY.md` bug recurred a SECOND time.** v0.0.3's retrospective already named this GSD scanner bug (reads `<dir>/SUMMARY.md`, but `/gsd-quick` writes `<id>-SUMMARY.md`) and predicted it "will recur at any future close" -- it did, flagging 3 completed quick tasks as missing at this v0.1.0 close. The workaround (bare marker files) is now applied a second time; the actual fix belongs upstream in the GSD scanner, not in this repo's workaround.
- **A CI gate flagged an accumulated diff, not a regression.** The `fallow` CI gate failed on PR #15 because it evaluates the CUMULATIVE diff vs. `origin/main`, and enough legitimate test-scaffolding/fixture code had accumulated across the branch's life to cross its thresholds -- required a dedicated quick task to tune `.fallowrc.jsonc` rather than being caught incrementally per-phase.
- **A shared-fixture race in e2e wasn't caught until CI.** All three e2e projects packed and installed the SAME dist tarball; running them concurrently in CI produced an intermittent `ENOENT` race that only manifested under CI's parallel scheduling, not locally -- required serializing the e2e job to `--parallel=1`.

### Patterns Established

- **Spike-gate any open engine-shape question before finalizing generator/executor design**, and be willing to re-scope the milestone version when the spike changes what's buildable.
- **Multi-lens (constructive + adversarial) board review for a testing strategy**, run to convergence across rounds, before writing test infrastructure.
- **Idiomatic first-party Nx `init`-seeds-`targetDefaults` pattern** (mirroring `@nx/eslint:lint-project` / `@nx/vitest:configuration`) for generator-suite caching, instead of inlining cache config on every generated target.
- **A dedicated CI self-audit guard** (set-equality between a CI job's explicit project list and the actual project graph) to convert a class of silent-skip landmine into a loud, located failure.
- **Stop review-fix rounds when a round produces zero changes**, treating that as the convergence signal rather than a reason to keep iterating.

### Key Lessons

1. **A lesson logged twice without a mechanical enforcement will recur a third time.** The requirements-completed-frontmatter gap and the audit-open bare-`SUMMARY.md` bug are the same category of failure: a documented process fix without a check that fails loudly when skipped. Convert both into an automated gate (a phase-verification lint, an upstream GSD scanner fix) rather than a fourth retrospective note.
2. **A path-gated CI quality tool needs periodic re-tuning as the branch accumulates diff, not just at adoption.** `fallow`'s new-only gate is evaluated against the cumulative branch diff, so a long-lived feature branch can cross a threshold the tool was originally green against.
3. **Fixtures shared across parallel CI jobs are a race waiting to happen.** Any e2e design that packs/installs a shared artifact (the dist tarball) across projects needs either isolation (per-project temp dirs, already used) or explicit serialization -- verify the concurrency model before, not after, a flaky CI failure.
4. **Deciding a breaking change on a review finding, not just the original plan, is fine pre-1.0.** The public-barrel trim wasn't in the original phase plan -- it surfaced from PR review -- and shipping it as a breaking `refactor!` was cheaper than deferring or shimming a public surface nobody outside the plugin actually used.

### Cost Observations

- Model mix: quality profile (Opus) for all GSD planning/execution/verification agents (per `config.json model_overrides`).
- Notable: the mid-milestone re-scope (v0.0.4 -> v0.1.0) and the four PR-review rounds were the two biggest cost concentrations; both paid for themselves -- the re-scope avoided shipping a narrower generator that would have needed a follow-up breaking change, and the review rounds converged to a verified-clean PR rather than merging with latent findings.

---

## Milestone: v0.1.2 -- Storybook story type-checking

**Closed:** 2026-07-07 (npm publish pending the human-gated Release-PR)
**Phases:** 5 (16-20, incl. the Phase 16 GO/NO-GO spike) | **Plans:** 20 | **Commits:** ~204 | **Timeline:** 3 days

### What Was Built

- One boundary-filter correctness fix: the diagnostic filter's directory-containment proxy replaced by a pure `keep(diagnostic, inputSet, options)` keyed on compiler input-set membership, shared by the walk + single-leaf paths, so a centralized Storybook host that aggregates cross-project stories/components is now checked completely (closing a live silent false pass) -- with zero Storybook-specific machinery.
- A SPLIT suppressed counter (`suppressedThirdParty` quiet vs `suppressedInGraph*` loud) whose `suppressedInGraph > 0` yields a verdict-affecting coverage-incomplete outcome -- the never-false-pass charter floor made structural, not a `logger.warn` beside `success:true`.
- Two verdict-neutral advisories: `notTypeCheckedDeclaredFiles` (`.mdx`/`.tsx`-without-`jsx`) and `bundlerQueryImports` (Vite/Analog `?query` `TS2307`), each surfaced loudly, self-gating, and structurally excluded from the verdict.
- An opt-in verdict-only `strict` mode (fail-additive; defaults false) and Storybook Composition as a zero-engine-code topology (per-project `typecheck` + Nx `^typecheck` fan-out).
- Packaged-tarball Storybook e2e proving the SHIPPED artifact catches planted story errors on both layouts via `nx add` + `nx g configuration` + `nx typecheck`, plus a curated end-user-facing README `## Storybook` section + CHANGELOG green->red callout.

### What Worked

- **The gated-spike pattern paid off a FOURTH time.** The Phase 16 GO/NO-GO spike (006-008) resolved the whole Layout-B premise on the official stack (forced `@storybook/angular@10.4.6`) BEFORE any production code -- G2 rootNames materialization, G3 forced-SB10 compile, G4 NG8xxx fire, and the G1/G5 external-template branch selection (4a) -- so the milestone committed to Layout B on evidence, not assumption. Same pattern as v0.0.1/v0.0.3/v0.1.0.
- **A 6-lens Opus advisory board reframed the milestone before scoping.** The board reframed "Storybook support" as ONE input-set-membership boundary fix (no version gate, no `*.stories.ts` selector, no new public option), which kept the engine change small and Storybook-agnostic and set the never-false-pass charter as the governing constraint.
- **Verdict-affecting-vs-advisory was decided deliberately.** The suppression floor is verdict-affecting (coverage-incomplete) precisely because a warning beside a green verdict is functionally silent to CI (exit code) and agents (structured verdict); the two genuinely-informational signals (`.mdx`/`.tsx`, `?query`) were kept verdict-neutral -- and each carries a tripwire test proving `evaluateResult` never reads it.
- **Real-OSS verification caught what synthetic fixtures could not.** The Phase-19 tarball UAT against real Angular 22 repos (radix-ng/primitives et al.) surfaced the Vite/Analog `?query` `TS2307` behavior that became the entire Phase 20 (SB-09); Gate B re-ran the shipped tarball against radix-ng/primitives (226 real `?query` `TS2307`) to confirm the advisory fires, `vite/client` clears, and plain-missing still fails.

### What Was Inefficient

- **The `audit-open` bare-`SUMMARY.md` bug recurred a THIRD time.** v0.0.3 and v0.1.0 both named this GSD scanner bug (reads `<dir>/SUMMARY.md`, but `/gsd-quick` writes `<id>-SUMMARY.md`); it flagged 7 completed quick tasks as "missing" at this close. The bare-marker workaround was applied a third time. Three consecutive closes with the same manual workaround; the fix still belongs upstream in the GSD scanner.
- **The milestone was re-opened after its own audit passed.** An initial audit closed phases 16-19; then SB-09 (Phase 20) was added from the Phase-19 OSS UAT and both signals committed, requiring a second audit pass over 16-20. Legitimate (real-user-value follow-up on evidence) but it meant auditing the milestone twice.
- **A stretch requirement's completion was overstated in frontmatter.** All three Phase-19 SUMMARYs carry `requirements-completed: [SB-08]` although two SB-08 sub-items were deliberately deferred ("not warranted"); a benign bookkeeping overstatement, but the same class of requirements-status-hygiene slip logged in prior milestones.

### Patterns Established

- **Verdict-neutral advisory pattern:** surface a real-but-informational signal (declared-uncheckable files, bundler `?query` imports) as a loud executor notice + a structured `CoreResult` field, self-gating (silent once resolved), with a tripwire proving the verdict function never reads it -- so it never becomes a silent false pass OR a spurious fail.
- **Verdict-affecting floor for dropped first-party diagnostics:** when correctness demands it, a suppression must move the verdict (coverage-incomplete), not just log -- because the only consumers are the exit code and the structured result.
- **Real-OSS repo verification as a phase-end gate (Gate B):** run the shipped tarball against a real, exact-stack public repo to confirm behavior that in-repo synthetic fixtures cannot exercise.

### Key Lessons

1. **A GSD scanner bug logged across three closes is now a standing tax, not a surprise.** The bare-`SUMMARY.md` audit-open mismatch is fully understood and worked around each time; the standing rule (add bare markers at close) is captured in memory, but the durable fix is upstream.
2. **Following real-user evidence can reopen a "done" milestone -- and that is correct.** SB-09 did not exist at milestone start; the OSS UAT surfaced it, and shipping it (verdict-neutral, charter-preserving) beat deferring a real consumer pain point. Budget for an audit re-run when a late evidence-driven requirement lands.
3. **User-facing text is a first-class deliverable, curated separately from internal framing.** The CHANGELOG/README must speak to Angular developers (no "Layout B" / "input-set membership" jargon), distinct from the board/plan vocabulary used internally -- curate at release time.

### Cost Observations

- Model mix: quality profile (Opus) for all GSD planning/execution/verification agents (per `config.json model_overrides`); the milestone audit's cross-phase integration check ran on Opus.
- Notable: the Phase-16 spike and the Phase-19 real-OSS UAT were the two highest-leverage spends -- the spike de-risked the entire Layout-B engine change up front, and the UAT surfaced the SB-09 follow-up that a synthetic-fixture-only strategy would have shipped blind to.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.0.1 | 8 | 29 | Baseline: gated spike, engine-before-Nx, vertical MVP, Release-PR flow with PR-only `main` |
| v0.0.3 | 4 | 14 | Evidence-backed deferral (Future Requirements with a multi-lens trail); build-time drift tripwire pattern; requirement-status-lag lesson RECURRED (logged, not yet enforced) |
| v0.1.0 | 5 (incl. 13.1) | 16 | Spike-gated mid-milestone re-scope (v0.0.4 -> v0.1.0); multi-lens Opus board for testing strategy before writing tests; requirement-status-lag lesson recurred a 3rd time; audit-open quick-task bug recurred a 2nd time |
| v0.1.2 | 5 (incl. 16 spike) | 20 | 6-lens Opus board reframed "Storybook support" as ONE input-set-membership boundary fix; verdict-neutral advisory pattern + verdict-affecting suppression floor; real-OSS Gate B verification; milestone re-opened post-audit for an evidence-driven follow-up (SB-09); audit-open quick-task bug recurred a 3rd time |

### Cumulative Quality

| Milestone | Package source LOC | Project types validated | Live npm publishes |
|-----------|--------------------|-------------------------|--------------------|
| v0.0.1 | ~1,162 (33 `.ts` files) | 5/5 | 2 (0.0.1, 0.0.2) |
| v0.0.3 | ~1,777 prod / ~5,263 incl. tests (15 / 41 `.ts` files) | 5/5 (carried) | 1 (0.0.3) |
| v0.1.0 | ~2,709 prod / ~8,552 incl. tests (22 / 56 `.ts` files) | 5/5 (carried) | 1 (0.1.0) |
| v0.1.2 | ~3,636 prod (67 `.ts` files incl. tests) | 5/5 (carried) | 0 (publish pending the Release-PR) |

### Top Lessons (Verified Across Milestones)

1. **Gated spike before committing to an approach** -- confirmed 3x: v0.0.1 Phase 1 (engine viability), v0.0.3 RES-01 (resilience shape), v0.1.0 spikes 001-005 (reference-walking feasibility, drove a mid-milestone re-scope).
2. **Close requirement statuses at phase verification, not at milestone audit** -- logged in v0.0.1, RECURRED in v0.0.3, RECURRED AGAIN in v0.1.0 (`642d08d`). Three occurrences without enforcement means this needs a mechanical gate, not another note.
3. **`audit-open`'s bare-`SUMMARY.md` scan is a real, repeatable GSD bug** -- hit at v0.0.3, v0.1.0, AND v0.1.2 closes (3x). Fix belongs in the GSD scanner (read `<id>-SUMMARY.md`, not a bare `SUMMARY.md`), not in a per-repo workaround; the bare-marker workaround is now a standing close-time tax captured in memory.
4. **Assert built/packed artifacts, not source** -- established v0.0.1, held throughout (tarball-first audits, GATE A byte assertions); extended in v0.1.2 to real-OSS-repo verification (Gate B against radix-ng/primitives), which surfaced the SB-09 follow-up synthetic fixtures would have missed.
5. **Evidence-backed deferral over a forced feature** -- established v0.0.3 (REP-RES-02b), reused in v0.1.0's Future Requirements (FSTREE-01, WALK-FUT-01/02) and v0.1.2 (SB-08 Layout-C/`.mdx`/`.tsx` recorded "not warranted" with cited rationale).
6. **User-facing text is a first-class, separately-curated deliverable** -- established v0.1.2: the public CHANGELOG/README speak to Angular developers (no internal "Layout B"/"input-set membership" jargon), curated at release time, distinct from the board/plan vocabulary used in `.planning/`.
