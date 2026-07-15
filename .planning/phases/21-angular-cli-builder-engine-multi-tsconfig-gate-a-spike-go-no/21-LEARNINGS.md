---
phase: 21
phase_name: "angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no"
project: "angular-typechecker"
generated: "2026-07-10"
counts:
  decisions: 4
  lessons: 5
  patterns: 4
  surprises: 3
missing_artifacts:
  - "21-UAT.md (verification passed with no human_needed items; no UAT file generated)"
---

# Phase 21 Learnings: angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no

## Decisions

### GATE A' = GO (human-authorized) authorizes the milestone
The CJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge was proven to survive `convertNxExecutor` + a real `ng run` on-stack Angular 22, so the milestone proceeds. The builder STAYS as the ACB-01 deliverable; the NO-GO fallback (a hand-written `@angular-devkit/architect` builder, D-04) was never needed.

**Rationale:** Spike 011 recorded verdict=GO with 15/15 assertions and an empty ESM-signature scan across three real `ng run` invocations; the human confirmed GO.
**Source:** 21-01-SUMMARY.md, .planning/spikes/011-builder-ng-run-esm-bridge/forensic-log.json

### Widened option type is mutable `string | string[]`, not `readonly string[]`
The plan's interface text specified `readonly string[]`, but the shipped type is mutable `string | string[]`.

**Rationale:** `Array.isArray()` narrows a `readonly`-array union only in the true branch, so a `readonly` member left the byte-unchanged single-string body typed as the whole union (TS2345, caught by `nx build`). Mutable satisfies BOTH the `Array.isArray` acceptance criterion and the byte-unchanged single-string body.
**Source:** 21-02-SUMMARY.md (deviation 1)

### ENG-01 aggregates via union-then-single-finalize over the COMBINED input set
`handleMultiTsConfig` loops each array entry through the existing single-tsConfig gather logic, unions the RAW per-entry diagnostics, then runs exactly ONE `finalize` with `buildFinalizeFilter(..., combinedRootNamePaths)`. It never calls `runTypecheck` per entry and merges CoreResults.

**Rationale:** Reuses the shipped `handleSolutionWalk` union-then-single-finalize tail and the v0.2.0 input-set-membership boundary over the combined declared set; per-entry finalize would double-finalize and drop each leaf's files as "out of the other's set" (D-06; RESEARCH "WRONG approach").
**Source:** 21-02-PLAN.md, 21-02-SUMMARY.md

### Single-plan-wave phases run sequentially on the main checkout (no worktrees)
All three waves were single-plan; each executor ran on the main tree with real `node_modules` instead of an isolated worktree.

**Rationale:** AGENTS.md single-plan-wave rule — no parallelism to gain, and 21-01's spike needs real `node_modules` to `nx build` + `npm pack` + install into the external clone. Avoids the worktree node_modules-junction hazard entirely.
**Source:** AGENTS.md, orchestration this phase

## Lessons

### The CJS->ESM bridge survives convertNxExecutor + a real ng run
A real `ng run <project>:typecheck` on Angular 22 completed with NO `ERR_REQUIRE_ESM` / `require() of ES Module` / `Cannot use import statement outside a module` — including through Nx's eager `retrieveProjectConfigurationsWithAngularProjects` project-graph prelude (nrwl/nx#19475). Proven for an app AND a library.

**Context:** This was the milestone's headline risk; the empirical answer retires it.
**Source:** 21-01-SUMMARY.md, forensic-log.json

### convertNxExecutor returns an Architect Builder OBJECT, not a bare function
The plan/RESEARCH assumed `typeof builderDefault === 'function'`. In fact `convertNxExecutor` -> `createBuilder` returns an Architect Builder object (own keys `handler` + `__OptionT`) branded with `Symbol.for('@angular-devkit/architect:builder') === true`.

**Context:** Verified empirically with a throwaway `require('@nx/devkit')` probe; the runtime parity assertion was corrected to check the brand symbol + `handler` function. Flag for any future plan reasoning about `convertNxExecutor`'s return shape.
**Source:** 21-03-SUMMARY.md (deviation)

### On-stack install into the real clone needed NO --legacy-peer-deps
Installing the packed dist tarball into the Angular 22 `bluehalo/ngx-leaflet` clone succeeded clean (`neededLegacyPeerDeps: false`), unlike the dev-repo Storybook/@nx/angular peer situations that require the flag.

**Context:** Confirms a consumer on a clean on-stack Angular 22 workspace installs the plugin without peer gymnastics.
**Source:** forensic-log.json

### A co-located hermetic fixture can give false coverage confidence
The original ENG-01 integration fixture put both leaves under one base dir, so `finalize`'s base-containment clause kept both leaves' files regardless of input-set membership. The `[appLeaf, specLeaf]` "both codes surface" test would still pass even if `handleMultiTsConfig` regressed to first-leaf-only rootNames — it did not actually guard the combined-input-set property (T-21-05) it claimed to.

**Context:** Surfaced by deep code review (WR-03); closed with a sibling-dir fixture where base-containment cannot mask input-set membership.
**Source:** 21-REVIEW.md (WR-03), 21-VALIDATION.md

### Reusing one output channel across two provenances can leak a wrong message
The array path records a `zero-root-names` skip through the walk's `skippedReferences` channel, and the executor's `warnSkippedReferences` hardcoded "...during the solution-tsconfig reference walk" / "referenced tsconfig" — false for a directly-supplied array. Reworded provenance-neutral.

**Context:** Code review WR-01; the verdict was always correct, only the wording lied.
**Source:** 21-REVIEW.md (WR-01), fix commit 08d0658

## Patterns

### Thin Angular CLI builder from an Nx executor
`export default convertNxExecutor(typecheckExecutor)` is the whole builder. Ship a sanitized `schema.json` (strip Nx-only `cli`/`version`/`$id`, keep everything else verbatim), an additive `builders.json`, a `builders` field in package.json, and a build-asset glob copying `builders.json` to dist. Nx's `executors ?? builders` precedence keeps `nx run <p>:typecheck` resolvable because `executors` stays declared.

**When to use:** Exposing an existing Nx executor as an Angular CLI builder additively, with zero engine fork.
**Source:** 21-01-PLAN.md, 21-03-PLAN.md

### Mutation-killing fixture for an input-set-membership boundary
To prove a diagnostic survives via combined input-set membership (not incidentally via base-containment), place the leaves' in-project files in DIFFERENT directories, so only the union of `rootNamePaths` keeps the second leaf's diagnostic. The test fails if the aggregation regresses to first-leaf-only.

**When to use:** Any test that must guard a set-membership/boundary property where a broader containment rule could otherwise mask a regression.
**Source:** 21-VALIDATION.md, multi-tsconfig.integration.spec.ts (WR-03 fix)

### Assertion-bearing GATE spike harness against a real clone
Orchestrator harness: `nx build` -> `npm pack` dist -> assert tarball contents -> install into a real OSS clone (no `--legacy-peer-deps`) -> hand-wire the target -> plant one diagnostic + keep another clean -> run the real tool -> scan output for failure signatures -> write `forensic-log.json` with a verdict COMPUTED from `results.every(r => r.pass)` (never hardcoded) -> exit(0/1). Record-only; never commit the clone or its node_modules; clean up after.

**When to use:** A GO/NO-GO gate that must prove real end-to-end behavior against real external tooling, with anti-fabrication built in.
**Source:** 21-01-PLAN.md, spike 011

### Structural + source-regex parity guard for a thin wrapper
A spec that reads the wrapper's own source (regex: imports the exact inner symbol, exports `convertNxExecutor(<inner>)`) plus a runtime brand assertion catches any future edit that forks the engine or wraps a different executor — a fast in-repo backstop behind an expensive real-`ng run` gate.

**When to use:** Locking a "must stay a thin re-export" invariant in CI without loading the heavy runtime.
**Source:** 21-03-PLAN.md, builder.spec.ts

## Surprises

### The TS LSP feed flagged ~15 stale false errors on run-typecheck.ts
Right after the ENG-01 edits, the IDE reported many "`string | readonly string[]` not assignable to string" errors on `run-typecheck.ts` and unused-binding (TS6133) errors on the new specs. `nx build` + `nx test` were green — all were stale (pre-`Array.isArray`-guard) or non-authoritative snapshots.

**Impact:** Reinforced the repo rule (LSP feed is NOT authoritative; trust `nx build`/`nx test`); each spike of alarm was resolved by an authoritative re-run, not by chasing the LSP.
**Source:** session diagnostics feed, verifier re-run

### The plan's convertNxExecutor return-shape assumption was wrong
A `typeof === 'function'` runtime assertion baked into the plan and RESEARCH would have failed; `convertNxExecutor` returns a branded Architect Builder object.

**Impact:** The executor caught and corrected it mid-plan (deviation, commit a51e540); documented for future convertNxExecutor work.
**Source:** 21-03-SUMMARY.md

### The bridge works for a library project, not only an app
The clean `ng run ngx-leaflet:typecheck` (a library) exited GREEN, proving the CJS->ESM bridge survives for a library project type too, not just the application.

**Impact:** Broadens the GATE A' evidence to both project types with a single spike.
**Source:** forensic-log.json
