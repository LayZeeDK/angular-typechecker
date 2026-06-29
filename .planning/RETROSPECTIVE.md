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
