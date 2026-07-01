---
phase: 8
phase_name: "Correctness & Completeness Fixes"
project: "angular-typechecker"
generated: "2026-06-29"
counts:
  decisions: 4
  lessons: 5
  patterns: 4
  surprises: 3
missing_artifacts:
  - "08-UAT.md"
---

# Phase 8 Learnings: Correctness & Completeness Fixes

## Decisions

### COR-04 exit-code policy lives in core; literal OS code deferred to the standalone CLI
A pure `toExitCode(result | TypecheckInfrastructureError) -> 0|1|2` policy was added to `core/exit-codes.ts` as the single source of truth, but it was deliberately NOT wired into the Nx executor's return; the executor keeps surfacing infra-vs-type within Nx's `{ success }` contract (typed error + distinct `logger.error`). The literal `2`-vs-`1` OS exit code is delivered later by the deferred standalone CLI surface, which owns its process.

**Rationale:** Verified prior art (nx 23.0.1): Nx hard-maps executor `{success}` to `success ? 0 : 1` (`run.ts:72`); the final `process.exit(0|1)` clobbers any `process.exitCode` (`command-object.ts:30`); and `process.exit` from an executor is hostile to in-process `runExecutor` / run-many / daemon / batch. The only official `process.exit(custom)` precedents are signal forwarding (>=128) in watch executors.
**Source:** 08-CONTEXT.md (D-07..D-10), 08-RESEARCH.md

### COR-01 fixture is a nonexistent tsconfig path, not a missing `extends` target
The config-resolution-crash integration test uses a NONEXISTENT tsconfig path (deterministic ENOENT -> code 500, cross-OS), with no fixture file added. A missing `extends` target was explicitly rejected as the trigger because it produces code 5012, not 500.

**Rationale:** Only `UNKNOWN_ERROR_CODE` (500) is the infra signal; 5012 is a genuine config diagnostic that must stay folded and counted (D-03 boundary).
**Source:** 08-RESEARCH.md, 08-01-SUMMARY.md

### COR-02 adds the global getter with no shim edit
`getTsProgram().getGlobalDiagnostics()` was appended as the 7th getter in `gatherAllDiagnostics`. The vendored `compiler-cli-types.ts` shim was NOT edited because `getGlobalDiagnostics` is on the public `ts.Program` interface and the shim already declares `TsProgram = ts.Program & {...}` (a green `nx build` is the type-check proof).

**Rationale:** Smaller blast radius; the drift-getter-set assertion for this new call is Phase 10 HARD-01's job (D-05, cross-phase).
**Source:** 08-02-SUMMARY.md, 08-RESEARCH.md

### Worktrees disabled for execution; sequential on the main tree
`workflow.use_worktrees` was set to `false` so the three executors ran sequentially on the main tree, where the installed `node_modules` exists.

**Rationale:** Every Phase 8 acceptance check runs `nx build`/`nx test`/`nx lint`, which need `node_modules`; a fresh worktree has none. (Refinement for later phases: a shared `node_modules` symlink/junction is safe when `package.json`/lockfile/Node version are unchanged, which would let parallel worktrees work.)
**Source:** this phase's execution (config + 08-0x-SUMMARY.md)

---

## Lessons

### A missing `extends` target is TS5012, not UNKNOWN_ERROR_CODE 500
Verified empirically against `@angular/compiler-cli@22.0.4`: a nonexistent `extends` target yields code 5012 (a real, foldable config diagnostic). The genuine 500 triggers are a nonexistent tsconfig path (ENOENT from `host.lstat`) and circular `extends` (RangeError). This corrected the imprecise "broken `extends`/host" phrasing carried from CONTEXT into the requirement example.

**Context:** The researcher reproduced both behaviors with a runtime probe rather than trusting the requirement's prose.
**Source:** 08-RESEARCH.md, 08-01-SUMMARY.md

### The 500 case has `rootNames: []`, so scan order is load-bearing
A config-resolution 500 returns empty `rootNames`, so the early `parsed.errors` 500 scan MUST run before the zero-rootNames guard. The RED proof reproduced the exact bug: pre-fix the engine returned `errorCount: 2` and resolved (a false non-crash) instead of throwing.

**Context:** Ordering, not just presence, of the scan is what makes COR-01 correct.
**Source:** 08-01-SUMMARY.md, 08-VERIFICATION.md

### Making `getTsProgram()` unconditional broke stub-based unit tests
Two pre-existing `gather-diagnostics.spec.ts` tests used a stub `program` that omitted `getTsProgram`; the now-unconditional call threw `TypeError`. Fixed by adding a `getTsProgram: () => ({ getGlobalDiagnostics: () => [] })` stub.

**Context:** Adding a getter to a hot path can break narrow test doubles that under-specified the surface.
**Source:** 08-02-SUMMARY.md

### A real-compiler cold-start flake blocked the deterministic green gate
Real-compiler `*.integration.spec.ts` runs occasionally exceeded Vitest's 5000ms default under the parallel pool (cold compiler-cli load). Raised `testTimeout`/`hookTimeout` to 30000ms in `vitest.config.mts` (no test-semantics change); the suite then ran green across three consecutive runs.

**Context:** Pre-existing latent flake, surfaced because COR-02 added another real-compiler integration spec.
**Source:** 08-02-SUMMARY.md

### The decision-coverage gate counts D-NN only in must_haves/truths and honors an exact `[informational]` tag
gsd-sdk's `check.decision-coverage-plan` parses `- **D-NN [tags]:**` bullets in CONTEXT.md `<decisions>` and counts a decision covered only when its `D-NN` token appears in a plan's `must_haves`/`truths` (NOT `read_first`/`<action>`). A decision is excluded from tracking only when a comma-separated tag exactly equals `informational`/`folded`/`deferred`, or it sits under a "Claude's Discretion" heading. An `[informational; reason]` blob is one tag and does NOT match.

**Context:** Required adding D-01/D-04/D-06 to plan truths and tagging the cross-phase/deferred/meta decisions (D-05/D-09/D-10) with a bare `[informational]`.
**Source:** this phase (gsd-sdk `sdk/src/query/decisions.ts`)

---

## Patterns

### Pure core policy clones evaluate-result.ts
A new pure verdict/policy function in `core/` mirrors `evaluate-result.ts`: `Pick<CoreResult, ...>` (or a typed union) input, no `process`/`console`/`@nx/*`, enforced by the `**/src/core/**` ESLint ban. `toExitCode` added one `instanceof TypecheckInfrastructureError` branch.

**When to use:** Any framework-agnostic decision that multiple adapters (executor, builder, CLI) must share.
**Source:** 08-PATTERNS.md, exit-codes.ts

### Failing-then-passing where the RED reproduces the exact bug
Each COR fix shipped a spec that first FAILS against the pre-edit source by reproducing the precise defect (e.g. COR-01's `errorCount: 2`-and-resolves), then PASSES after the fix.

**When to use:** Correctness fixes to an existing engine — the RED proof is the regression guard and the documentation of the bug.
**Source:** 08-01/02/03-SUMMARY.md

### Two-stage defense-in-depth on the same error code
Detect `UNKNOWN_ERROR_CODE` (500) at two distinct pipeline stages — the config parse (`parsed.errors`) and post-`performCompilation` (`result.diagnostics`) — keyed on code only, never `source`/message.

**When to use:** When a single failure class can surface at more than one point in a pipeline and a miss is a false PASS.
**Source:** 08-01-PLAN.md/SUMMARY.md

### Verify version-sensitive compiler claims by runtime probe, not training data
Both the researcher and the code reviewer probed the installed `@angular/compiler-cli@22.0.4` / `typescript@6.0.3` at runtime (e.g. confirming `UNKNOWN_ERROR_CODE === 500`, that `getGlobalDiagnostics()` returns the file-less TS2318 set) instead of relying on memory.

**When to use:** Any claim about a pinned third-party compiler's internal behavior or error encoding.
**Source:** 08-RESEARCH.md, 08-REVIEW.md

---

## Surprises

### `toExitCode` silently diverges from the executor's `--max-warnings` gate
`toExitCode` keys solely on `errorCount`, so a warnings-only failure (`warningCount > maxWarnings`, `errorCount === 0`) maps to `0` (clean) while the executor's `evaluateResult` returns `{ success: false }` (exit 1). A latent cross-surface inconsistency that becomes live only when the deferred CLI wires `toExitCode`.

**Impact:** Recorded as a deferred-CLI design item (the CLI should delegate warnings-gating to `evaluateResult`). Does not affect Phase 8 (toExitCode is unwired by design).
**Source:** 08-REVIEW.md (WR-01)

### The lone lint warning is pre-existing, not a Phase 8 regression
The `'NG' is assigned a value but never used` warning at `config-resolution.integration.spec.ts:30` traces to plan 02-02 (commit `07af39e`), predating this phase. Lint reports 0 errors and the target succeeds.

**Impact:** Confirmed not a regression; left out of scope to avoid unrelated edits.
**Source:** 08-VERIFICATION.md, 08-REVIEW.md

### All three plans were parallelizable but ran sequentially
The plans modify fully disjoint files (the planner + checker confirmed zero `files_modified` overlap), so they were wave-1 parallel-eligible — yet they ran sequentially because worktree isolation was disabled for the `node_modules` constraint.

**Impact:** No correctness cost (a 3-plan wave), but it motivated the shared-`node_modules`-symlink approach for the larger Phases 9-10.
**Source:** 08-0x-PLAN.md frontmatter, this phase's execution
