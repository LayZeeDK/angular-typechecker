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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.0.1 | 8 | 29 | Baseline: gated spike, engine-before-Nx, vertical MVP, Release-PR flow with PR-only `main` |

### Cumulative Quality

| Milestone | Package source LOC | Project types validated | Live npm publishes |
|-----------|--------------------|-------------------------|--------------------|
| v0.0.1 | ~1,162 (33 `.ts` files) | 5/5 | 2 (0.0.1, 0.0.2) |

### Top Lessons (Verified Across Milestones)

1. *(established this milestone)* Assert built/packed artifacts, not source.
2. *(established this milestone)* Close requirement statuses at phase verification, not at milestone audit.
