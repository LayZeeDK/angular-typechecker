---
phase: 9
phase_name: "Resilience (per-file fault isolation + boundary robustness)"
project: "angular-typechecker"
generated: "2026-06-29"
counts:
  decisions: 4
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "UAT.md (verification passed with no human_needed items)"
---

# Phase 9 Learnings: Resilience (per-file fault isolation + boundary robustness)

## Decisions

### GO = HYBRID for the per-file isolation shape (RES-01 gate)
The RES-01 spike chose HYBRID (residual whole-program `getNgSemanticDiagnostics()` + a per-file `getNgSemanticDiagnostics(sf.fileName)` loop, `OptimizeFor.WholeProgram`) over SIMPLE (per-file loop only).

**Rationale:** SIMPLE required POSITIVE proof that no Angular non-template diagnostic is file-less or attached to a non-iterated source file; the spike could not positively enumerate that, and the `IMPORT_GENERATION_FAILURE` Fatal attaches to a generated `.ngtypecheck.ts` shim (not the iterated `.component.ts`), proving the `d.file === file` filter is genuinely fragile. Per D-03, inconclusive defaults to the HYBRID superset, which never under-gathers.
**Source:** 09-RES-01-SPIKE.md, 09-02-SUMMARY.md

### RES-02/SC2 reframed to run-level resilience + a loud notice; faithful template recovery deferred (REP-RES-02b)
The literal SC2 ("surviving files' TEMPLATE diagnostics still reported" after a TCB-gen Fatal) was reframed to the achievable contract (no whole-run 500 collapse; poison = one diagnostic; survivors' TS + non-template diagnostics reported; a loud notice when template diagnostics are suppressed). The faithful per-file-template recovery was deferred to the NgtscProgram/incremental milestone.

**Rationale:** literal SC2 is mechanically unachievable on the locked `api.Program`/`OptimizeFor.WholeProgram` surface. Settled by web research + a 5-lens Opus panel (4/5 HIGH for reframe). D1 (recompile excluding the poison) was rejected as semantically unfaithful (phantom `cannot find module` for survivors importing the poison) + conditional + scope creep. Mirrors the COR-04 reframe precedent.
**Source:** 09-RES-02-DECISION.md

### RES-04: pass `suppressOutputPathCheck` as the `readConfiguration` second arg (not the override object)
Deviated from ENGINE-REF #4's "prefer the override object."

**Rationale:** the output-path check fires in TS `verifyCompilerOptions()` at the end of `createProgram`, gated by `!options.noEmit && !options.suppressOutputPathCheck` -- NOT in `readConfiguration`. So `noEmit: true` already suppresses it, the "fires too late in `parsed.errors`" hazard does not exist, and the second-arg placement matches `@angular/build` exactly.
**Source:** 09-RESEARCH.md (Pitfall 3 / Open Q1), 09-04-SUMMARY.md

### Loud suppression notice: pure-core detection + adapter render; detect NG3004 only
`CoreResult.templateCheckAborted` is set by a pure, code-only scan in core; the executor renders the `logger.warn`. Detection keys on `NG(3004) === -993004` only.

**Rationale:** core is PURE (eslint bans console/process in `**/src/core/**`), so detection must be side-effect-free and the I/O lives in the adapter. NG3004 (`IMPORT_GENERATION_FAILURE`) is the only TCB-generation Fatal that reaches `getDiagnosticsForFile`'s `isFatalDiagnosticError` catch at v22.0.4; 3001/3003 are analysis-phase and excluded.
**Source:** 09-05-SUMMARY.md, 09-REVIEW.md

---

## Lessons

### A `WholeProgram` per-file loop does NOT isolate template diagnostics from a TCB-generation Fatal
The shared `ensureAllShimsForAllFiles()` priming (triggered by `OptimizeFor.WholeProgram` on the first per-file call) aborts shim generation for ALL files when one component's TCB-gen Fatal throws -- so surviving files' template diagnostics vanish in both the whole-program and per-file paths. The prior assumption (ENGINE-REF) that a per-file loop isolates was wrong for this case.

**Context:** only `OptimizeFor.SingleFile` (per-file priming via `ensureAllShimsForOneFile`) isolates -- which is exactly why the Angular Language Service uses it.
**Source:** 09-02-SUMMARY.md, 09-RES-02-DECISION.md

### `OptimizeFor.SingleFile` is unreachable through the `api.Program` surface
`getNgSemanticDiagnostics(fileName)` hardcodes `WholeProgram` (`program.ts:241`); reaching `SingleFile` requires `NgCompiler`/`TemplateTypeChecker` internals, past the locked vendored surface. This is why the faithful fix belongs to the NgtscProgram migration.

**Context:** drove the reframe-and-defer decision; B/C options were disqualified for breaching the surface.
**Source:** 09-RESEARCH.md, 09-RES-02-DECISION.md

### Do not fake a failing-then-passing test for a mechanically impossible differentiator
The plan's literal "survivor template diagnostic 0 -> >=1" differentiator could not pass on the locked surface. The executor asserted the genuinely-provable contract instead (poison = one diagnostic, no 500 collapse, survivor TS diagnostic reported) and escalated the gap, rather than shipping a test that pretends a difference exists.

**Context:** the empirical, not structural, proof was the load-bearing requirement (09-01 hand-off).
**Source:** 09-02-SUMMARY.md

### The TCB-gen Fatal attaches to the generated `.ngtypecheck.ts` shim, not the source
The notice had to invert the shim name (`<name>.ngtypecheck.ts` -> `<name>.ts`) to point the developer at a file they can open. The inversion is LOSSY (`.ts` and `.tsx` sources collapse to the same shim), so a `.tsx` source is reported as `.ts` -- documented as a limitation.

**Context:** notice-path only; the verdict and the diagnostic's own codeframe are unaffected.
**Source:** 09-05-SUMMARY.md, 09-REVIEW.md (WR-01)

### Inheriting a prior phase's `use_worktrees=false` silently serialized a parallel-friendly wave
The phase started on the main tree because Phase 8 had left `use_worktrees=false`; the user corrected it mid-flight. A node_modules junction unblocks worktree parallelism (deps unchanged), and a wave containing a spike plan does NOT force serialization -- independent plans (incl. the spike) parallelize; only true `depends_on` plans wait.

**Context:** re-enabled worktrees + junction for the remaining plans; recorded in the `worktree-executors-need-node-modules` memory.
**Source:** session correction; STATE.md / config.json

---

## Patterns

### Gated spike with a recorded GO artifact, safe-superset default on inconclusive
When an approach shape is genuinely unknown and static analysis cannot settle it, gate the dependent plan on a throwaway empirical spike that records a durable GO artifact; default to the safe superset if the spike is inconclusive.

**When to use:** any high-impact approach decision where "I didn't see a counter-example" is not the same as proof.
**Source:** 09-01-PLAN.md, 09-CONTEXT.md (D-01..D-03), 09-RES-01-SPIKE.md

### Pure-core-detect / adapter-render for user-facing signals from a pure engine
Detect a condition with a pure, side-effect-free field on the core result; render the user-facing message in the adapter (executor logger). Keeps the engine framework-agnostic + eslint-pure and lets every surface (executor, future CLI) render its own way.

**When to use:** any advisory/diagnostic signal that a pure engine must surface to a human.
**Source:** 09-05-PLAN.md, 09-05-SUMMARY.md

### node_modules junction for parallel worktree executors (+ junction-safe teardown)
Provision a Windows directory JUNCTION from each worktree's `node_modules` to the main repo's locked deps (valid only when `package.json`/lockfile/Node are unchanged). Teardown is junction-safe: delete the junction LINK first (`[System.IO.Directory]::Delete(path, false)`), verify the main `node_modules` entry count is unchanged, THEN `git worktree remove`. Prefer PowerShell `New-Item -ItemType Junction` over `cmd mklink /J` on arm64.

**When to use:** parallel worktree executors that must run `nx test`/`nx build` (which need node_modules).
**Source:** session; [[worktree-executors-need-node-modules]] memory

### Reframe-and-defer for a locked SC that exceeds the locked surface
When mid-execution proves a locked success criterion is mechanically unachievable on the locked surface, reframe the SC to the achievable contract and defer the literal to the milestone whose surface CAN deliver it -- recorded in a decision doc + amended ROADMAP/REQUIREMENTS, never silently narrowed.

**When to use:** a requirement is discovered to exceed the current architecture's reach (COR-04 + RES-02 are two instances).
**Source:** 09-RES-02-DECISION.md

### Research-then-multi-lens-panel for a locked-decision re-open
For a high-impact, hard-to-reverse decision: run web/source research first, then N independent single-lens agents (completeness, architecture, perf/correctness, scope/charter, risk/feasibility) in parallel, synthesize, and escalate to the human with a recommendation.

**When to use:** re-opening a locked decision or any irreversible architecture choice.
**Source:** 09-RES-02-DECISION.md, .planning/research/RES-02-isolation-alternatives.md

---

## Surprises

### `@angular/build` (the fidelity model) has the SAME limitation
Its cold/multi-file path uses `OptimizeFor.WholeProgram` and also loses survivors' template diagnostics on a TCB-gen Fatal. So literal SC2 would have made angular-typechecker EXCEED its own north-star reference, not merely match it.

**Impact:** reframed the "faithful to @angular/build" bar and reinforced deferring the faithful recovery to the NgtscProgram surface.
**Source:** 09-RESEARCH.md, 09-RES-02-DECISION.md

### The reviewer's proposed WR-01 "fix" was functionally identical to the existing code
The `.tsx` extension is unrecoverable from the shim name, so the regex tweak produced the same output; the real fix was a documenting comment, not a code change.

**Impact:** avoided a no-op code churn; added an honest limitation comment instead.
**Source:** 09-REVIEW.md (WR-01)

### `cmd mklink /J` failed for the junction on arm64; PowerShell succeeded
One executor's `cmd //c mklink /J` failed and it self-recovered via PowerShell `New-Item -ItemType Junction`.

**Impact:** PowerShell is the more reliable junction primitive on this machine; encoded in the junction pattern + memory.
**Source:** 09-04-SUMMARY.md

### NG3004 is the ONLY TCB-generation Fatal reaching the per-file catch at v22.0.4
The structural siblings (NG3001 SYMBOL_NOT_EXPORTED, NG3003 IMPORT_CYCLE_DETECTED) are analysis-phase and never reach `getDiagnosticsForFile`'s `isFatalDiagnosticError` catch.

**Impact:** single-code detection (`-993004`) is complete and correct; no need for a code range.
**Source:** 09-05-SUMMARY.md, 09-REVIEW.md
