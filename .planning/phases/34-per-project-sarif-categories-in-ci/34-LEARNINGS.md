---
phase: 34
phase_name: "Per-project SARIF categories in CI"
project: "angular-typechecker"
generated: "2026-07-21"
counts:
  decisions: 5
  lessons: 4
  patterns: 3
  surprises: 2
missing_artifacts:
  - "34-UAT.md (no human-verification items; the real-CI item is deferred to Phase 35, not a UAT)"
---

# Phase 34 Learnings: Per-project SARIF categories in CI

## Decisions

### CI-side merge, never reporter-side
The per-project multi-run SARIF is assembled entirely in CI (`tools/ci/merge-sarif.mjs`); the published reporter keeps emitting ONE run per CLI invocation. Adding a `--category`/`automationDetails.id` reporter option would have made MULTI release-bearing and risked a non-additive SARIF change.

**Rationale:** keeps the "only RULE-01..04 bumps the version" charter intact -- MULTI ships zero published-package change (D-06 verified: only `tools/ci/*` + 2 specs + `ci.yml` changed, no `src/core/**`/manifest/version).
**Source:** 34-CONTEXT.md (D-02/D-05/D-06), 34-01-PLAN.md

### Pure-fs discovery scoped to `apps/`+`libs/`, not the Nx graph
`tools/ci/list-typecheck-projects.mjs` is a lean `node:fs` scan filtering `targets.*.executor === 'angular-typechecker:typecheck'`, mirroring the existing `list-e2e-projects.mjs`.

**Rationale:** root-scoping naturally excludes both the `e2e/*/fixtures/` project.jsons and the workspace-root project (all of which carry the executor) with no hardcoded exception; it needs no `npm ci`/graph spin, so it stays fast and directly execable from the drift-guard spec. The root-agnostic authority research wanted is delegated to the guard's independent enumeration.
**Source:** 34-CONTEXT.md (D-01), 34-RESEARCH.md

### Design B -- `spawnSync` the CLI inside the merge script
`merge-sarif.mjs` spawns the shipped dist CLI per discovered project (fixed arg array, no `shell: true`) and concatenates the single run from each into one file, rather than a bash loop + a separate pure-merge script.

**Rationale:** injection-free, unit-testable as a subprocess, and dodges the JSON-in-bash footgun the project's shell rules warn about.
**Source:** 34-RESEARCH.md ("Design B"), 34-01-SUMMARY.md

### `includeDeps` deliberately NOT threaded into the CI loop
`typecheck-consumer` declares `includeDeps: true`, and the standalone CLI supports `--include-deps`, but the per-project loop runs with defaults.

**Rationale:** matches the pre-rewire single-run baseline; per-project analyses each report their own scope while each dependency already gets its own analysis, so threading `includeDeps` would only add cross-analysis duplication/noise. Researched + dispositioned as Pitfall 5 / Assumption A2 (deliberate scope line, not a coverage bug); re-flagged by the deep code review and held as won't-fix.
**Source:** 34-RESEARCH.md (Pitfall 5 / A2), 34-REVIEW.md (deep-pass WR-01 disposition)

### Literal per-run id `angular-typecheck/<project>`; single upload, no `category`
Each merged run is stamped `run.automationDetails.id = angular-typecheck/<project>` (note: `angular-typecheck`, no `-er`) and uploaded once with NO `category` input.

**Rationale:** the per-run id becomes the per-analysis category; passing a single `category` across multiple runs re-triggers GitHub's (2025-07-21+) multi-run-same-category rejection. Byte-for-byte the pattern the shipped fallow step already uses.
**Source:** 34-01-PLAN.md, .github/workflows/ci.yml

## Lessons

### The workspace-root project.json also carries the executor
`@angular-typechecker/source` (the root `project.json`) declares a real `angular-typechecker:typecheck` target on `fixtures/tsconfig.clean.json`, so an executor-filter over ALL `project.json` yields 5, not 4.

**Context:** the drift-guard's independent enumeration MUST subtract BOTH `e2e/*/fixtures/` AND the workspace-root project, or it counts 5 vs discovery's 4 and false-fails RED on day one. Surfaced by the phase researcher; corrected CONTEXT D-01a/D-01b/D-04 before planning.
**Source:** 34-RESEARCH.md, 34-CONTEXT.md (D-01b)

### A cross-project `.mjs` dynamic import is not viable in a plugin spec
Loading a `tools/ci/*.mjs` from a spec under `packages/angular-typechecker/src/` fails both ways: a `file://`/absolute dynamic `import()` fails Vitest's module runner (cannot resolve outside the project root), and a relative `../../../tools/ci/...` import fails `@nx/enforce-module-boundaries` at `maxWarnings:0`.

**Context:** the plan-checker caught this as a BLOCKER on the first plan; the fix is the `execFileSync`/temp-dir subprocess technique (mirroring `ci-e2e-coverage-guard.spec.ts`'s B3 test) -- drive the real `.mjs` as a child process, assert on its output.
**Source:** plan-checker (iteration 1), 34-01-SUMMARY.md

### Restoring the `|| true` + produced-guard tolerance is load-bearing
The initial rewire dropped the `atc-sarif` step's `|| true` + `[ -s file ]` produced-guard; a discovery/merge `throw` would then abort the whole `code-scanning` job -- taking down the fallow SARIF generation and BOTH uploads, not just angular-typechecker's.

**Context:** flagged by the deep code review (WR-02) as a deviation from CONTEXT D-05 ("preserve the produced-guard verbatim") and fixed. The step must tolerate a non-zero exit and gate the upload on a non-empty file.
**Source:** 34-REVIEW.md (deep, WR-02), 34-REVIEW-FIX.md

### Merge envelope must come from the first CONTRIBUTING run, not the first discovered entry
`mergeSarifRuns` skips a per-project file that parses but has zero runs (`if (!run) continue`), yet every existing fixture had the alphabetically-first-discovered project also be the first valid one -- so the skip path was never exercised, and a regression sourcing the envelope from `entries[0]` unconditionally would have passed.

**Context:** the retroactive Nyquist audit found this untested behavioral path (which the standard review, deep review, and the full gate battery all missed) and added an adversarial case (`aaa-no-run` empty first, `zzz-has-run` valid second).
**Source:** 34-VALIDATION.md (Audit Trail)

## Patterns

### Lean-fs discovery + independent-enumeration drift guard
An auto-discovered CI set (project list, matrix) is a lean `node:fs` script; an in-plugin regression-guard spec cross-checks the script's output against an INDEPENDENT root-agnostic enumeration, so the set "cannot silently drift" (a member added under an unscanned root, or dropped, trips a loud RED).

**When to use:** any CI wiring whose coverage is auto-derived and must not silently under/over-report. Mirrors `list-e2e-projects.mjs` + `ci-e2e-coverage-guard.spec.ts` (GUARD-01b).
**Source:** 34-CONTEXT.md (D-01/D-04), 34-01-SUMMARY.md

### Exercise a sibling `.mjs` via `execFileSync` against a temp workspace
Prove a `tools/ci/*.mjs`'s behavior by `mkdtempSync` a fixture workspace (fixture `project.json`s + a stub `bin.js`), `execFileSync('node', [script], { cwd: tempRoot })`, and assert on the written output -- never by importing the module.

**When to use:** unit-testing cross-project Node scripts from inside a plugin project where a direct import breaks Vitest resolution AND the module-boundary lint. The subprocess runs the REAL module outside both restrictions.
**Source:** 34-01-SUMMARY.md, packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts (B3)

### CI-side multi-run SARIF merge with per-run `automationDetails.id`
To report N per-project GitHub Code Scanning analyses from one tool without a reporter change: run the single-run reporter per project, concat the runs into one file, stamp each `run.automationDetails.id`, and `upload-sarif` once with NO `category`.

**When to use:** per-project (or per-target) Code Scanning categories for a third-party tool whose reporter is single-run; avoids the multi-run-same-category rejection. Generalizes the shipped fallow `node -e` id-stamp step.
**Source:** 34-01-PLAN.md, .github/workflows/ci.yml

## Surprises

### Layered independent audits each caught a distinct real gap
The standard code review found 3 warnings; the deep review (run only after noticing `code_review_depth: deep` had been missed) found 2 MORE the standard pass missed; and the Nyquist audit found a genuine untested behavioral path (envelope-ordering) that the standard review, deep review, AND the full green gate battery all missed.

**Impact:** confirmed the value of honoring the configured review depth and of the retroactive Nyquist audit as an independent adversarial pass -- a green battery + passing verification did not imply full behavioral coverage.
**Source:** 34-REVIEW.md, 34-VALIDATION.md (Audit Trail)

### The real-CI-only ceiling on the phase's headline contract
Every local gate (unit/integration tests, SARIF schema-validate, actionlint, act-compat, lint, format) passes, yet whether GitHub actually ACCEPTS the merged multi-run file and lands it as N distinct `angular-typecheck/<project>` analyses is asynchronous, server-side, and NOT locally provable.

**Impact:** MULTI-01's headline success criterion is recorded as a real-CI/manual verification (deferred to Phase 35's automated `gh api` proof), NOT a locally-green check -- verification passed on the local contract without over-claiming the ingestion contract.
**Source:** 34-RESEARCH.md (Nyquist note), 34-VERIFICATION.md (deferred item)
