---
phase: 17
phase_name: "input-set-membership-boundary-layout-support"
project: "angular-typechecker"
generated: "2026-07-06"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 3
missing_artifacts:
  - "*-UAT.md"
---

# Phase 17 Learnings: input-set-membership-boundary-layout-support

## Decisions

### Input-set membership replaces directory-containment (one boundary fix)
The boundary filter became a pure `keep(diagnostic, inputSet, options): boolean` keyed on compiler input-set membership, routed through the ONE shared `finalize() -> buildFinalizeFilter() -> filterDiagnostics()` chokepoint that both the walk path and the direct single-leaf path already use.

**Rationale:** Directory-containment silently dropped in-graph diagnostics whose files sat outside the base dir (the centralized Storybook host). Membership over the declared input set is the correctness-preserving boundary; a single chokepoint removes walk/direct drift (T-17-07).
**Source:** 17-01-PLAN.md, 17-03-SUMMARY.md, 17-CONTEXT.md (D-01/D-02)

### Dual-identity membership with KEEP-on-throw
Membership is checked against both the raw and the realpath-canonicalized form of a declared rootName, and the canonicalizer fails safe (KEEP) when `realpath` throws.

**Rationale:** A declared root must never be misclassified third-party due to a symlink/junction/case-variant path or a transient realpath failure — over-keep is the charter-safe direction.
**Source:** 17-01-SUMMARY.md (T-17-01)

### Branch 4a external-template attribution via public `relatedInformation`
An external-template NG8002 (`.html`) is mapped to its owning component `.ts` via public `ts.Diagnostic.relatedInformation`; kept iff that `.ts` is in the input set; the unmappable edge default-KEEPs.

**Rationale:** A rootNames-only filter would silently drop the `.html` diagnostic (the kill-shot case). Using only public TS fields (not ngtsc internals) keeps it stable across Angular patches.
**Source:** 17-01-SUMMARY.md, 17-CONTEXT.md (D-09.2)

### Split suppressed counter + coverage-incomplete verdict (D-06, 3-board locked)
`suppressedCount` was split into `suppressedThirdParty` + per-category `suppressedInGraphErrorCount`/`suppressedInGraphWarningCount` + advisory `suppressedInGraphFiles`. Any in-graph suppression, a `templateCheckAborted` (NG3004), or a zero-root-names first-party leaf folds into a distinct non-clean `coverage-incomplete` outcome.

**Rationale:** "Never a silent false pass" — a dropped first-party diagnostic must flip the verdict, not just log. Locked via a 3-board Opus advisory process ("hardened R1-plus").
**Source:** 17-DECISION-input-set-boundary.md, 17-03/17-04-SUMMARY.md

### Late-bound warning gate on the real `maxWarnings`
The suppressed-in-graph-**warning** trigger binds to the actual `maxWarnings` at `evaluateResult` time (errors are unconditional and checked first).

**Rationale:** A baked-in warning decision would silently pass under `maxWarnings: 0`; late binding preserves the HARD default (T-17-09).
**Source:** 17-04-SUMMARY.md

### Declared `readConfiguration().rootNames`, never `program.getRootFileNames()`
`WalkResult.rootNamePaths` accumulates the DECLARED rootNames of each surviving leaf, never the Program's root files.

**Rationale:** `getRootFileNames()` adds synthetic `.ngtypecheck.ts` shims that would corrupt the input set (spike 006). Guarded by a structural acceptance grep.
**Source:** 17-02-SUMMARY.md (D-02)

---

## Lessons

### The `grep` deny-rule can stall an executor mid-run
Executor 17-01 used a bare `grep` in a compound command (despite CLAUDE.md's deny rule); the block tripped and the stream watchdog could not recover, failing the agent after committing 2 of 3 tasks.

**Context:** Resuming the parked worktree agent with an explicit "NEVER grep — use `rg`/`git grep`" instruction finished it cleanly; adding that line to every later wave's executor prompt prevented recurrence. Bake tool-deny rules into subagent prompts, not just CLAUDE.md.
**Source:** 17-01 execution (failure + resume)

### A cross-wave API migration has an intentional intermediate RED state
Wave 1 changed the `filter-diagnostics` API (added required `FilterOptions.inputTs`, removed `suppressedCount`), which broke the `run-typecheck.ts` caller: 2 compile errors AND 6 runtime integration failures (`options.inputTs is not iterable`), all from the un-rewired caller. Wave 2 (17-03) threaded `inputTs` and turned it green.

**Context:** The Wave-1 post-merge FULL build/test gate is expected to fail on exactly the dependent-caller errors; defer the authoritative green gate to after the wave that owns the caller. Classify the red state by tracing every failure to one root cause before proceeding.
**Source:** 17-01-SUMMARY.md, phase execution

### Fixture intent must match the boundary rule being proven
The `sibling-import` fixture DECLARED the transitive dep in its tsconfig `files`, which under the new D-02 rule made it charter-never-dropped (KEPT) — contradicting the fixture's "transitive-only via paths alias" comments AND blocking the plan's suppressed-in-graph proof. Removing the declared entry made the dep genuinely transitive.

**Context:** When a membership rule changes, existing fixtures whose geometry encoded the OLD rule can silently invert the test's intent. Re-audit fixture geometry against the new boundary.
**Source:** 17-03-SUMMARY.md (deviation #3)

### A poison fixture cannot prove `coverage-incomplete` if it also has errors
17-07's literal Task-3 assertion (`outcome === 'coverage-incomplete'` on a fixture with `errorCount >= 2`) was impossible because `evaluateResult` returns `type-error` first when errors exist. Intent (FM-9 is verdict-affecting) was preserved by feeding the fixture's real `templateCheckAborted` into an isolated `errorCount: 0` evaluate input.

**Context:** Ordered verdict discriminants mean a single fixture can't exercise a lower-priority outcome while a higher-priority one is present; isolate the signal.
**Source:** 17-07-SUMMARY.md (deviation)

### The editor LSP diagnostics feed is not authoritative here
Throughout the phase the `<new-diagnostics>` feed reported stale errors: references to already-deleted worktree paths, "errors" that were intentional planted errors in dirty fixtures, and pre-fix errors on files already fixed (line numbers even mismatched the real ones).

**Context:** `nx build` / `nx test` (and an explicit `git grep`) are the ground truth; treat the LSP feed as a hint only. Verified repeatedly against the green runner.
**Source:** phase execution (orchestrator)

---

## Patterns

### Wave-based worktree parallelism with a `node_modules` junction (Pattern A)
Parallel plans run in isolated worktrees sharing the main checkout's installed `node_modules` via a Windows directory junction; every `nx` run uses `NX_DAEMON=false --skip-nx-cache` to avoid racing on the shared cache.

**When to use:** Disjoint-file plans in the same wave when no dependency changes. Teardown is LINK-ONLY (`rm` the junction symlink) BEFORE `git worktree remove`, then verify main `node_modules` count is unchanged.
**Source:** AGENTS.md, phase execution (Waves 1/3/4)

### Single-plan wave runs sequentially on the main checkout
A wave with one plan (Wave 2 / 17-03) skips worktree isolation entirely and runs on the main tree — real `node_modules`, no junction, no merge-back.

**When to use:** Any wave with no intra-wave parallelism to gain; it also lets that plan's own full-suite run be the authoritative post-migration gate.
**Source:** phase execution (Wave 2)

### Structural `git grep` gate as a first-class test
`filter-diagnostics.structural.spec.ts` asserts the boundary module references zero ngtsc/component-registry/`@angular/compiler-cli` tokens.

**When to use:** To pin a "public-API-only" invariant against silent coupling drift when a dependency (Angular) ships internal changes across patches.
**Source:** 17-01-SUMMARY.md (T-17-03)

### Cold-compiler fixtures placed OUTSIDE the host base dir
Layout B fixtures put the aggregated story, external-template component, and its dependency outside the host base dir so input-set membership + branch 4a are the load-bearing keep path (not the base-containment fallback).

**When to use:** When an integration test must exercise the NEW boundary rule, not an incidental fallback that would pass regardless.
**Source:** 17-06-SUMMARY.md

### D-09a tripwire fixtures pin undocumented invariants
Dedicated tripwires assert dual-identity membership, external-template `relatedInformation` attribution, and the NG3004-only fatal-code surface, so a future Angular/TS change that breaks them fails CI loudly.

**When to use:** When correctness depends on undocumented upstream behavior (a compiler's diagnostic shape) that could silently change.
**Source:** 17-07-SUMMARY.md

---

## Surprises

### Windows junctions look like symlinks in Git Bash, and `cmd rmdir` failed on the path
`mklink /J` junctions display as `lrwxrwxrwx` in Git Bash; the documented `cmd //c "rmdir <win-path>\node_modules"` teardown failed with "path not found", while the POSIX-equivalent `rm <link>` (non-recursive) removed the link cleanly.

**Impact:** The AGENTS.md teardown had to fall back to `rm <link>`; the LINK-BEFORE-`worktree remove` ordering (and main-`node_modules` count check) is what kept the shared deps safe — a recursive delete over an intact junction would have wiped them.
**Source:** phase execution (orchestrator teardown)

### Two agent failures were non-code causes, both recoverable
17-01 died on the `grep` deny-rule stall; the first verifier died on the org monthly spend limit (quota). Neither was a logic failure.

**Impact:** Resume/re-spawn recovered both with no lost work (verification is idempotent; the executor resumed in its own worktree with prior commits intact). Distinguish infra/quota failures from logic failures before re-planning.
**Source:** phase execution (orchestrator)

### A prior plan pre-absorbed a cross-plan test cascade
17-03 had already updated `executor.spec.ts`'s `coreResult()` mock builder for the `suppressedCount` field rename, so 17-05's Task 2 collapsed to just adding the new count-rendering assertions.

**Impact:** Less work than planned for 17-05; a shared-type rename rippled into a sibling plan's test fixture earlier than its own wave.
**Source:** 17-05-SUMMARY.md
