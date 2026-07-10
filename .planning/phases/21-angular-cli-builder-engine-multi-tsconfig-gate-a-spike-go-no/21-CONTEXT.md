# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO) - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-locked; trade-off tables logged in DISCUSSION-LOG.md)

<domain>
## Phase Boundary

Two things, gated by a spike:

1. **GATE A' (GO/NO-GO, ACB-02)** -- empirically prove that the shipped
   CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge
   SURVIVES `convertNxExecutor` + a **real `ng run <project>:typecheck`** (including
   the wrapper's eager `retrieveProjectConfigurationsWithAngularProjects` project-graph
   prelude), on-stack (Angular 22) AND off-stack (Angular 21), with NO `ERR_REQUIRE_ESM`.
2. **Ship the builder + widen the engine** (contingent on GO) -- re-export the executor
   as an Angular CLI builder (`src/builders/typecheck/builder.ts` = `convertNxExecutor(...)`),
   add `builders.json` + the `package.json` `builders` field additively (ACB-01, ACB-03),
   and widen `CoreOptions.tsConfig` to `string | string[]` (ENG-01).

**In scope:** the GATE A' spike; the `convertNxExecutor` builder re-export; `builders.json` +
`builders` field; a sanitized builder `schema.json`; the `tsConfig` array widening; the
`nx run` non-regression assertion; optional `@angular-devkit/architect` + `rxjs` peer
classification IF the builder spike surfaces it here (else Phase 23).

**Out of scope (other phases / charter):** the `configuration` `angular.json` write-fork
(Phase 22); `init` parity + first-party `ng-add` (Phase 23); real-OSS + scaffolded e2e +
docs (Phase 24); any hand-written `@angular-devkit/architect` builder or breaking change
(v0.3.0 only).

</domain>

<decisions>
## Implementation Decisions

### GATE A' proof methodology
- **D-01:** Prove GATE A' with a **real `ng run <project>:typecheck`** in TWO isolated,
  throwaway Angular CLI scaffolds created under the **session scratchpad** (never the dev
  repo's `node_modules`/`package.json`), following the spike-007 forced-dep isolated-scaffold
  pattern (CONVENTIONS.md):
  - **on-stack:** Angular 22.0.x (`npm init @angular`), no `--legacy-peer-deps`.
  - **off-stack:** Angular 21.2, installed with `--legacy-peer-deps`.
  - Each scaffold: install the LOCALLY-PACKED `angular-typechecker` builder tarball, wire a
    `typecheck` architect target into `angular.json`, run `ng run`, capture stdout + exit code
    + any `ERR_REQUIRE_ESM`. An `.mjs`-only harness is explicitly INSUFFICIENT -- it cannot
    trigger the wrapper's eager project-graph prelude, which is the exact ESM-sensitive phase
    the gate must exercise (Pitfall 1, nrwl/nx#19475).
- **D-02:** Record the gate under `.planning/spikes/NNN-*` per CONVENTIONS.md (assertion-bearing
  harness ending in `[PASS]/[FAIL]` + `VERDICT` + `process.exit`; committed `forensic-log.json`;
  README frontmatter; hermetic `fixture/`; commit the RECORD only -- scaffold `package.json` +
  `fixture/` + `harness` + `forensic-log.json` + reproduction notes, NEVER the scaffold
  `node_modules`). Add the verdict row to `.planning/spikes/MANIFEST.md` and surface findings
  through the `spike-findings-angular-typechecker` skill -- the same channel that carried the
  Phase-16 gate (spikes 006-008).

### GATE A' GO/NO-GO checklist + gate ordering
- **D-03:** A **GO** requires ALL of:
  1. `ng run` on-stack Ng22 completes with NO `ERR_REQUIRE_ESM` (incl. the eager
     `retrieveProjectConfigurationsWithAngularProjects` prelude).
  2. `ng run` off-stack Ng21 completes with NO `ERR_REQUIRE_ESM` (subject to U-01 below on a
     split result).
  3. Builder diagnostics + `formatDiagnostics` human output + `BuilderOutput.success` verdict
     are **IDENTICAL** to the Nx executor on the same inputs (ACB-01 parity is part of the gate,
     not a later check).
  4. The static byte-assertion (`gate-a-static.spec.ts`) is EXTENDED to the built builder entry
     and still passes (retains literal `import(`, never `require('@angular/compiler-cli')`).
  5. `nx run <project>:typecheck` still resolves after the `builders` field lands
     (`executors ?? builders` precedence -- the ACB-03 Nx-surface regression assertion).
- **D-04:** Within Phase 21 the spike **gates**: prove GO FIRST, THEN ship the builder
  (`builder.ts` + `builders.json` + `builders` field) and ENG-01. A **NO-GO STOPS Phase 21**
  with a documented re-scope, and NEVER falls back to a hand-written `@angular-devkit/architect`
  builder; downstream Phases 22-24 do not proceed against the builder until GO. (Locked by the
  roadmap GATE + the ADDITIVE-ONLY charter.)

### Builder schema.json
- **D-05:** Give the builder a **sanitized `schema.json` copy** (strip `cli:"nx"`, `x-*`
  keywords, `$default` positional args) over the SAME TS options interface as the executor,
  guarded by a schema-parity test mirroring the existing
  `src/executors/typecheck/schema-parity.spec.ts`. The spike CONFIRMS whether Architect accepts
  the executor `schema.json` verbatim (Pitfall 7, MEDIUM confidence); if it does, collapse to
  reuse -- the sanitized copy is the safe default, not a hard commitment.

### Engine -- tsConfig array (ENG-01)
- **D-06:** `tsConfig: string | string[]`. An array runs each entry through the EXISTING
  single-`tsConfig` logic, UNIONs the raw per-entry diagnostics, then runs ONE `finalize`
  (boundary-filter + `ts.sortAndDeduplicateDiagnostics` + explicit `DiagnosticCategory` counts)
  over the union -- reusing the spike-001 union-then-single-`finalize` aggregation and the
  v0.2.0 input-set-membership boundary over the COMBINED declared input sets. Additive-only:
  widen `CoreOptions.tsConfig` + the executor `schema.json` (`oneOf` string|array) +
  `normalize-options` ONLY; the single-string behavior and the entire Nx path stay
  byte-unchanged.

### Claude's Discretion
- Plan decomposition (how many plans; whether the gate runs via `/gsd:spike` or as an inline
  gating plan of Phase 21; the exact spike number NNN); hermetic fixture contents (which planted
  app/spec errors prove parity); whether optional-peer classification (ACP-01) is pulled into
  this phase or left to Phase 23. Researcher + planner decide, grounded in the refs below.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (LOCKED decisions)
- `.planning/research/v0.2.1-angular-cli/SUMMARY.md` -- **CORRECTION & LOCKED DECISIONS wins over
  everything else**: Option A `tsConfig: string|string[]`, the executor-unchanged /
  generator-write-fork ASYMMETRY, GATE A' framing, the `executors ?? builders` precedence,
  Pitfalls 1/5/7 (this phase) and 8 (VOID).
- `.planning/research/v0.2.1-angular-cli/STACK.md` -- `convertNxExecutor` ships in the pinned
  `@nx/devkit@23.0.1` (non-deprecated); optional-peer classification (`@angular-devkit/architect`
  `^0.2200.0`, `rxjs` `^7.8.0`); `nx` transitive + `.nx/` tradeoff.
- `.planning/research/v0.2.1-angular-cli/ARCHITECTURE.md` -- builder = `convertNxExecutor(typecheckExecutor)`;
  additive-safety source-verified (`executor-utils.js` L76, `generator-utils.js` L57); build order.
- `.planning/research/v0.2.1-angular-cli/PITFALLS.md` -- Pitfall 1 (ESM bridge through `ng run`),
  Pitfall 7 (builder schema dialect), Pitfall 5 (undeclared runtime `require()`s).

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` -- ENG-01, ACB-01, ACB-02 (GATE A'), ACB-03; the ADDITIVE-ONLY charter.
- `.planning/ROADMAP.md` -- Phase 21 Goal / GATE semantics / Success Criteria; Phase 22-24 dependencies.

### Existing code to extend / mirror
- `packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts` -- the existing GATE A
  STATIC byte-assertion (reads built `dist/` `.js`); GATE A' EXTENDS this to the builder entry.
- `packages/angular-typechecker/src/executors/typecheck/schema-parity.spec.ts` -- the parity-test
  pattern to mirror for the sanitized builder `schema.json`.
- `packages/angular-typechecker/src/executors/typecheck/{schema.json,schema.d.ts,executor.ts,normalize-options.ts}`
  -- the executor schema to sanitize/mirror, the default export `convertNxExecutor` wraps, and the
  `normalize-options` seam to widen for the `tsConfig` array.
- `packages/angular-typechecker/src/core/compiler-loader.ts` (built `.../core/compiler-loader.js`) --
  where the `await import('@angular/compiler-cli')` lives under the core/adapter split (D-08); the
  bridge GATE A' must not downlevel or break.
- `packages/angular-typechecker/package.json` -- current `executors`/`generators` fields; where the
  additive `builders` field lands.

### Spike convention + prior-gate precedent
- `.planning/spikes/CONVENTIONS.md` -- harness/forensic/fixture/isolated-scaffold (spike-007) rules.
- `.planning/spikes/MANIFEST.md` -- the spike table + verdict recording format.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- the findings consumption channel.

### Codebase maps (orientation)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`gate-a-static.spec.ts`** -- extend the built-artifact byte-assertion to the builder entry
  (positive `import(` retained; negative no `require('@angular/compiler-cli')`), reading the
  dist path from `project.json` `build.options.outputPath` (already done for the executor).
- **`schema-parity.spec.ts`** -- clone the parity pattern to keep the sanitized builder schema in
  lock-step with the executor options interface.
- **Reference-walk union-then-single-`finalize`** (spike 001 / shipped v0.1.0 walk) -- the exact
  aggregation ENG-01's array path reuses; dedupe identity keyed on `file.path + start + length +
  code + messageText` (`ts.sortAndDeduplicateDiagnostics`).
- **v0.2.0 input-set-membership boundary** (`filter-diagnostics`) -- filters the ENG-01 union over
  the COMBINED declared input sets (not directory containment).
- **Spike-007 isolated-scratchpad scaffold** -- the established pattern for exercising an external
  toolchain (forced/off-stack deps) without touching the dev repo `node_modules`.

### Established Patterns
- **Core/adapter split (D-08):** `await import()` lives in CORE (`compiler-loader.js`); the executor
  is a thin `require()`-based delegate. `convertNxExecutor` wraps the executor default export, so the
  ESM load remains in the untransformed core module -- the mechanistic reason the bridge SHOULD survive.
- **Additive-safety precedence:** Nx reads `packageJson.executors ?? packageJson.builders` and
  `generators ?? schematics`; keeping `executors`/`generators` declared makes the new `builders`
  manifest Nx-invisible (byte-unchanged Nx surface) -- assert it, don't assume it (ACB-03).

### Integration Points
- New: `src/builders/typecheck/builder.ts`, `builders.json`, the `builders` `package.json` field,
  a `files` whitelist entry, a sanitized builder `schema.json`. The engine/core/public barrel are
  UNTOUCHED except the ENG-01 `tsConfig` widening at `CoreOptions` + `normalize-options` + executor
  `schema.json`.

</code_context>

<specifics>
## Specific Ideas

- On-stack scaffold pins the exact supported stack (Angular 22.0.x / TS 6.0.3); off-stack pins
  Angular 21.2 and documents `--legacy-peer-deps` (Pitfall 6 -- document, never gate in code).
- The gate is GO/NO-GO by EVIDENCE (`ng run` either throws `ERR_REQUIRE_ESM` or does not), recorded
  in `forensic-log.json` -- not a subjective approval. The one place human judgment enters is a SPLIT
  result (see U-01).

</specifics>

<unresolved>
## UNRESOLVED -- trap quadrant (HIGH impact, LOW confidence; NOT auto-decided)

- **U-01: Split-result contingency -- on-stack Ng22 = GO but off-stack Ng21 = NO-GO.**
  Requirement ACB-02 literally requires "on-stack (Angular 22) AND off-stack (Angular 21) ... no
  `ERR_REQUIRE_ESM`" for a GO, but the ADDITIVE-ONLY charter states the supported stack is Angular 22
  and "Angular 21 appears only as an off-stack e2e cross-check." These pull in opposite directions,
  the decision is hard to reverse (it decides whether an off-stack-only failure kills the whole
  builder feature), and there is NO evidence yet which branch the spike hits (research: LOW-to-MEDIUM
  risk, "should survive").
  - **Option A (on-stack is the true gate):** an off-stack-only Ng21 failure becomes a DOCUMENTED
    off-stack limitation (extend the README `--legacy-peer-deps` note to "builder unsupported on
    Ng21") and the milestone PROCEEDS on the Ng22 GO.
  - **Option B (literal reading):** a split is a NO-GO -- the builder feature re-scopes.
  - **Resolution:** CONTINGENCY only -- decide ONLY if the spike actually produces a split. On a
    split, SURFACE to the user for the GO/NO-GO call (a human decision); the executor/verifier MUST
    NOT silently pick. The most-likely outcome (both GO) makes this moot. Do not treat A or B as
    settled during planning/execution.

</unresolved>

<deferred>
## Deferred Ideas

None new -- discussion stayed within phase scope. (Already-tracked deferrals live in
REQUIREMENTS.md Future Requirements / Out of Scope: WALK-FUT-01 `createNodesV2` inference, the
`configuration` write-fork -> Phase 22, `ng-add` -> Phase 23, e2e/docs -> Phase 24.)

</deferred>

---

*Phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no*
*Context gathered: 2026-07-10*
