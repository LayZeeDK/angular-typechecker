---
phase: 26
phase_name: "pure-cli-core-exit-code-wiring"
project: "angular-typechecker"
generated: "2026-07-16"
counts:
  decisions: 10
  lessons: 6
  patterns: 4
  surprises: 3
missing_artifacts:
  - "UAT.md"
---

# Phase 26 Learnings: pure-cli-core-exit-code-wiring

## Decisions

### Two-step exit-code compose (the milestone's whole point)
`toExitCode` owns the literal `2` ONLY (infra catch, its first live consumer since the v0.0.3 COR-04 scaffold); a usage error returns `2` directly; a completed run returns `evaluateResult(result, { maxWarnings, strict }).success ? 0 : 1` -- NEVER `toExitCode`/raw counts.

**Rationale:** a coverage-incomplete or warnings-exceeded run has `errorCount === 0` but `success === false`; wiring the 0/1 split to raw counts would be a silent false pass that violates the never-false-pass charter. `git grep` confirms `toExitCode` appears only at `main.ts:179`.
**Source:** 26-CONTEXT.md D-01, 26-02-SUMMARY.md, 26-VERIFICATION.md

### `run(argv, env)` is pure -- no process.exit, no stream writes
`run(argv, env = process.env): Promise<{ exitCode, stdout, stderr }>` never calls `process.exit` and never writes a stream; stdout = the renderReport string, stderr = the buffered notice/error lines. The impure write + exit is deferred entirely to Phase 27's `bin.ts`.

**Rationale:** EXIT-02 -- keeping all decision logic in a pure function makes the exit-code compose unit-testable in-process with zero process side effects and no spawning.
**Source:** 26-CONTEXT.md D-02, 26-02-SUMMARY.md

### BufferingLogger for the stderr sink (not a live console logger)
`console-logger.ts` exports a `BufferingLogger` implementing the core `Logger` (info/warn/error) that accumulates lines into one in-memory buffer; `run()` joins them into the returned `stderr`.

**Rationale:** a buffering logger (vs injecting a live `console.error` logger into `run()`) is what keeps `run()` stream-free (EXIT-02) while still honoring the notices/errors-to-stderr routing (CLI-03).
**Source:** 26-CONTEXT.md D-04, 26-01-SUMMARY.md

### Short flag is `-c`, never `-p`/`--project`
`--tsConfig` short is `-c`; `-p`/`--project` is deliberately NOT registered (surfaces as an unknown-flag usage error).

**Rationale:** `-p`/`--project` would collide with Angular CLI / Nx workspace *project* selection. ROADMAP SC1 + REQUIREMENTS ARGS-02 lock `-c` and override the stale `-p` prose that the milestone research SUMMARY/FEATURES carried.
**Source:** 26-CONTEXT.md specifics, 26-RESEARCH.md, 26-01-SUMMARY.md

### Zero new dependencies (Node stdlib `util.parseArgs`)
The entire 7-flag surface is parsed with `node:util` `parseArgs` (`strict: true`, `allowPositionals: false`); no arg-parser, color, or bundler library was added.

**Rationale:** ARGS-01. `parseArgs` covers repeatable `-c` (`multiple: true`), short aliases, and strict unknown-flag rejection. Verified end-to-end: `package.json` was untouched by the phase.
**Source:** 26-CONTEXT.md D-12, 26-SECURITY.md (T-26-SC)

### Guarded `realpathSync.native` fall-through
The `\\`->`/` + `realpathSync.native` normalization is wrapped in try/catch; on ENOENT it falls through to the plain resolved absolute path so the core raises its canonical `TypecheckInfrastructureError` -> caught -> exit `2`.

**Rationale:** `realpathSync.native` throws ENOENT on a nonexistent path, but a nonexistent tsconfig must RETURN exit 2, never crash uncaught (PKG-03 / RESEARCH Open Question 1).
**Source:** 26-CONTEXT.md D-06, 26-02-SUMMARY.md, 26-03-SUMMARY.md

### nx-free `src/cli/**` boundary by relative core imports
`src/cli/**` imports ONLY pure-core modules by relative path (`../core/*`) plus Node stdlib -- never `@nx/devkit`/`nx`, never `executor.ts`/`builder.ts`, never the barrel.

**Rationale:** CLI-03 + the 24-06 yarn-4 chalk-crash lesson (importing the executor drags `@nx/devkit`->chalk). The CLI is inside the package, so like `executor.ts` it reaches internal core seams module-to-module (the barrel omits them anyway). The enforcing ESLint ban + static guard land in Phase 27.
**Source:** 26-CONTEXT.md D-15, 26-01/26-02-SUMMARY.md

### `--max-warnings` accepts only a non-negative integer
Parse the parseArgs string with `Number(raw)`; reject `!Number.isInteger(n) || n < 0` as a usage error -> exit 2.

**Rationale:** ARGS-04 ("non-integer -> 2"); clearer UX than silently treating a negative as unset. `--max-warnings 0` stays valid (fail on any warning).
**Source:** 26-CONTEXT.md D-08, 26-01-SUMMARY.md

### Accepted deviation: a broken-`extends` malformed tsconfig -> exit 1, not 2
A `config-broken/tsconfig.malformed.json` whose `extends` target does not exist folds into a COUNTED 5012 config error on a COMPLETED run (never a `TypecheckInfrastructureError`), so `run()` returns `evaluateResult().success ? 0 : 1 = 1`. Only a truly nonexistent PATH (ENOENT) is the infra exit 2.

**Rationale:** locked by `config-resolution.integration.spec.ts`. Asserting exit 2 for the broken-extends file would be a knowingly-false test; the exit-2 infra path is proven instead via the nonexistent-path case. No production code changed.
**Source:** 26-03-SUMMARY.md, 26-VERIFICATION.md

### Accepted deviation: coverage-incomplete is driven via a two-entry array
The real coverage-incomplete case (errorCount 0, success false) is driven by `[cleanLeaf, solution-style-empty]`, not a single empty leaf.

**Rationale:** `run()`'s ARGS-03 collapse routes a single `-c` through the STRING walk-path, which surfaces the empty leaf's zero-root-names guard as a COUNTED 90001 error (a type-error). Only the ARRAY path records the zero-root-names SKIP that yields the genuine errorCount-0/success-false verdict; the clean sibling keeps errorCount 0.
**Source:** 26-03-SUMMARY.md, walk-references/multi-tsconfig integration specs

---

## Lessons

### A single empty `-c` leaf cannot exercise the coverage-incomplete verdict through `run()`
Because `run()` collapses a single `-c` to a string (D-13), an empty leaf becomes a counted 90001 (type-error), not the zero-root-names skip. Any end-to-end coverage-incomplete proof must union the empty leaf with a clean sibling as a two-entry array.

**Context:** discovered while reconciling the plan's fixture guidance with the locked `walk-references.integration.spec.ts` / `multi-tsconfig.integration.spec.ts` semantics.
**Source:** 26-03-SUMMARY.md

### "Malformed tsconfig" is not monolithic for exit codes
A broken-`extends` target = a counted config error on a completed run -> exit 1. Only a nonexistent path (or JSON that fails to parse) reaches the infra exit 2. VER-02's "malformed/nonexistent -> 2" had to be nuanced accordingly.

**Context:** the exit-2 branch is still proven (nonexistent path), but the requirement's wording over-generalized "malformed".
**Source:** 26-03-SUMMARY.md, 26-VERIFICATION.md, config-resolution.integration.spec.ts

### The blocking decision-coverage gate scans a narrow region, not the whole plan body
`check.decision-coverage-plan` reported 0/17 covered even though the plans referenced `D-NN` in prose/`<action>` blocks. Citing each `D-NN` in a plan's `must_haves.truths` flipped it to 17/17. (The word-boundary matcher used by the non-blocking post-planning gap-analysis is more lenient than the blocking gate.)

**Context:** cost the plan-phase flow an extra edit + re-run of the gate; cite decision ids in `truths`, not just body prose.
**Source:** plan-phase decision-coverage gate (this session)

### `realpathSync.native` throws on a nonexistent path
Unlike a no-op normalization, `fs.realpathSync.native(p)` raises ENOENT when `p` does not exist. A CLI that must return an exit code (not crash) on a bad path has to guard it.

**Context:** the D-06 try/catch fall-through exists precisely for this; proven by the nonexistent-tsconfig integration case.
**Source:** 26-RESEARCH.md Open Question 1, 26-03-SUMMARY.md

### `Number()` is lenient for numeric CLI args
`Number('0x10')`/`Number('1e3')`/`Number(' 3 ')` all succeed, and `Number('')` is `0`. The `Number(raw)` + `Number.isInteger` + `>= 0` guard fails SAFE (over-gates, never inverts the verdict) but accepts hex/exp/whitespace forms a `/^\d+$/` guard would reject.

**Context:** advisory code-review finding WR-01 (fail-safe, not a threat) -- a future hardening candidate.
**Source:** 26-REVIEW.md WR-01, 26-SECURITY.md

### Extend a stale in-code comment when a scaffold gains its first consumer
`core/exit-codes.ts` still says `toExitCode` "has no live consumer"; `main.ts:179` is now the first. A scaffold's doc-comment should be updated when the deferred consumer lands.

**Context:** advisory code-review IN-02 (doc drift, non-blocking).
**Source:** 26-REVIEW.md IN-02

---

## Patterns

### Third thin adapter over the shared core
`run()` mirrors `executor.ts`'s compose verbatim: normalize -> `runTypecheck` -> `emitAdvisoryNotices(result, logger)` -> `renderReport` -> `evaluateResult` -> return; catch `TypecheckInfrastructureError`. Only the injected logger (BufferingLogger vs @nx/devkit) and the return shape (`{exitCode,stdout,stderr}` vs `{success}`) differ.

**When to use:** any new surface (CLI, builder, future reporter) that must produce the SAME Angular type-check verdict -- compose the core, never re-implement.
**Source:** 26-PATTERNS.md, 26-02-SUMMARY.md

### Injected structural `Logger` + a buffering implementation
The Phase-25 `core/logger.ts` `Logger` seam lets each adapter inject its own sink. A `BufferingLogger` (accumulate then join) is the pure-function-friendly implementation; the real stream write is a separate impure tier.

**When to use:** whenever a pure function must EMIT notices but must not own I/O -- buffer through the seam, let the caller flush.
**Source:** 26-CONTEXT.md D-04, 26-01-SUMMARY.md

### Stubbed-core unit tier + real-fixture integration tier
Unit specs mock the core (`vi.hoisted` + `vi.mock`, keeping the REAL `TypecheckInfrastructureError` via `importOriginal`) to pin the exit-code branch matrix -- including the `errorCount===0 && success===false` cases a real run cannot cheaply fake. The integration tier drives `run(argv)` against real cold-compiler fixtures to prove the genuine verdict + the CJS->ESM bridge + path normalization.

**When to use:** for a thin adapter whose subtlest logic is composition/branching over a heavy core -- stub the core for the branch matrix, use real fixtures for the end-to-end truth.
**Source:** 26-02-SUMMARY.md, 26-03-SUMMARY.md, 26-VALIDATION.md

### Two-step exit-code compose (adapter owns the infra code, the verdict owns 0/1)
Split the exit code: a verdict-blind `toExitCode` owns the literal infra `2` in the catch; the completed-run 0/1 comes from the shared verdict (`evaluateResult().success`). Never re-derive the verdict from raw counts in the adapter.

**When to use:** any adapter that maps a rich verdict to literal OS exit codes and must distinguish "could not run" (2) from "verdict failed" (1) without a false pass.
**Source:** 26-CONTEXT.md D-01, 26-02-SUMMARY.md

---

## Surprises

### The plan's fixture guidance contradicted already-locked core behavior in two places
Both the malformed-tsconfig exit code and the single-empty-leaf coverage-incomplete case were wrong in the plan table; the executor found the truth by reading the existing locked integration specs rather than trusting the plan.

**Impact:** two Rule-1/Rule-3 deviations (no production code changed); the coverage-incomplete verdict ended up proven MORE faithfully than the plan would have allowed. Reinforces: read the locked specs, don't trust a plan's fixture-semantics claims.
**Source:** 26-03-SUMMARY.md

### The decision-coverage gate failed at 0/17 despite pervasive D-NN references
Plans cited `D-01`, `D-05`, `D-06`, etc. throughout their bodies, yet the blocking gate reported zero coverage until the ids were cited in `must_haves.truths`.

**Impact:** an extra citation edit + gate re-run in the plan-phase flow; the matcher's scanned region is narrower than the plan prose.
**Source:** plan-phase decision-coverage gate (this session)

### Two spend-limit interruptions mid-chain, both cleanly resumable
The planner (before writing) and the wave-3 executor (after committing the spec + self-check, before the tracking-file closeout) were each cut off by the org monthly spend limit.

**Impact:** none to correctness -- per-task atomic commits + written-but-uncommitted SUMMARY made both points resumable; the orchestrator finished the wave-3 closeout (ROADMAP progress + SUMMARY/STATE commit) after verifying the tests independently. Argues for the atomic-commit + write-SUMMARY-before-narrate discipline.
**Source:** execute-phase orchestration (this session), 26-03-SUMMARY.md
