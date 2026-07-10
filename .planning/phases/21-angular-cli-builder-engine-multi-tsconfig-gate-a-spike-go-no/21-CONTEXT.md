# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO) - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended options auto-locked; trade-off tables logged in DISCUSSION-LOG.md). **Revised 2026-07-10 after two user directives** changed the proof substrate (see D-01, D-07) and dropped off-stack Angular 21 (see the RESOLVED note; U-01 removed).

<domain>
## Phase Boundary

Two things, gated by a spike:

1. **GATE A' (GO/NO-GO, ACB-02)** -- empirically prove that the shipped
   CommonJS-executor-loads-ESM-`@angular/compiler-cli`-via-`await import()` bridge
   SURVIVES `convertNxExecutor` + a **real `ng run <project>:typecheck`** (including
   the wrapper's eager `retrieveProjectConfigurationsWithAngularProjects` project-graph
   prelude), **on-stack Angular 22**, with NO `ERR_REQUIRE_ESM`. Off-stack Angular 21 is
   NO LONGER part of this gate (user directive 2026-07-10).
2. **Ship the builder + widen the engine** (contingent on GO) -- re-export the executor
   as an Angular CLI builder (`src/builders/typecheck/builder.ts` = `convertNxExecutor(...)`),
   add `builders.json` + the `package.json` `builders` field additively (ACB-01, ACB-03),
   and widen `CoreOptions.tsConfig` to `string | string[]` (ENG-01).

**In scope:** the GATE A' spike; the `convertNxExecutor` builder re-export; `builders.json` +
`builders` field; a sanitized builder `schema.json`; the `tsConfig` array widening; the
`nx run` non-regression assertion; optional `@angular-devkit/architect` + `rxjs` peer
classification IF the builder spike surfaces it here (else Phase 23).

**Out of scope (other phases / charter):** the `configuration` `angular.json` write-fork
(Phase 22); `init` parity + first-party `ng-add` (Phase 23); the scaffolded-workspace e2e +
additive-only audit + docs (Phase 24); any hand-written `@angular-devkit/architect` builder or
breaking change (v0.3.0 only); off-stack Angular 21 support.

</domain>

<decisions>
## Implementation Decisions

### Proof substrate (REVISED per user directives 2026-07-10)
- **D-07:** Substrate roles (three tiers):
  1. **In-repo Vitest unit/integration** -- CI-authoritative. Proves the static byte-assertion
     (extended to the builder entry), the schema-parity guard, the `tsConfig`-array union, and
     the `nx run` `executors ?? builders` regression. This is the committed, repeatable gate.
  2. **Real cloned OSS Angular 22 workspace -- QUICK VERIFICATION/DEBUG (Phase 21) + the
     milestone's FINAL tarball e2e GATE (Phase 24).** A real `ng run <project>:typecheck` against
     a REAL cloned Angular CLI (`angular.json`) workspace with apps + libs, used to (a) quickly
     confirm GATE A' before e2e exists and for debugging (Phase 21), AND (b) serve as the
     milestone's FINAL tarball end-to-end verification gate (Phase 24): pack the SHIPPED tarball
     -> `ng add` -> `ng run <project>:typecheck` against the clone -> assert planted diagnostics
     (the on-stack Ng22 successor to v0.2.0's radix-ng real-repo gate). The clone is UNCOMMITTED
     and not a fixture; evidence is recorded with the repo URL + commit SHA reproduction
     (spike-007 "commit the record only" pattern).
  3. **Scaffolded fresh Angular CLI workspace -- the repeatable AUTOMATED e2e (Phase 24, ACV-02).**
     e2e tests SCAFFOLD a fresh workspace programmatically (`npm init @angular` + `ng g library`)
     and run fully in CI with no external clone. This is the repeatable automated coverage; the
     real clone (tier 2b) is the final real-repo gate on top of it.

### GATE A' proof methodology
- **D-01:** Prove GATE A' with a **real `ng run <project>:typecheck`** against the **real cloned
  OSS Angular 22 workspace `bluehalo/ngx-leaflet`** (chosen by the user 2026-07-10):
  - Repo: https://github.com/bluehalo/ngx-leaflet (MIT), cloned to
    `D:\projects\github\bluehalo\ngx-leaflet` at commit `818e9ae55240b570397ede5a15cb4d466785abdc`
    (default branch `master`). UNCOMMITTED (OSS-reference-clone convention); reproduction = repo
    URL + SHA.
  - Stack: `@angular/core ^22.0.0`, `@angular/cli ^22.0.0`, `@angular/build ^22.0.0`,
    `typescript ~6.0.3`, `ng-packagr ^22.0.0`; non-Nx (`angular.json` present, no `nx.json`);
    npm lockfile. On-stack -- NO `--legacy-peer-deps`.
  - Workspace shape (drives the ENG-01 + per-project targets proof):
    - `ngx-leaflet-demo` (`application`, root) -> leaves `tsconfig.app.json`, `tsconfig.spec.json`
    - `ngx-leaflet` (`library`, `projects/ngx-leaflet`) -> leaves
      `projects/ngx-leaflet/tsconfig.lib.json`, `projects/ngx-leaflet/tsconfig.spec.json`
  - NO synthetic `npm init @angular` sandbox for the gate; NO off-stack Angular 21 leg. (An
    `.mjs`-only harness is INSUFFICIENT -- it cannot trigger the wrapper's eager project-graph
    prelude, Pitfall 1 / nrwl/nx#19475.)
- **D-02:** Record the gate under `.planning/spikes/NNN-*` per CONVENTIONS.md (assertion-bearing
  harness ending in `[PASS]/[FAIL]` + `VERDICT` + `process.exit`; committed `forensic-log.json`;
  README frontmatter). Because the substrate is an external clone, the harness references it by
  absolute path and documents the repo URL + SHA reproduction; the clone's `node_modules` is never
  committed. Add the verdict row to `.planning/spikes/MANIFEST.md` and surface findings through the
  `spike-findings-angular-typechecker` skill -- the same channel that carried the Phase-16 gate
  (spikes 006-008).

### GATE A' GO/NO-GO checklist + gate ordering
- **D-03:** A **GO** requires ALL of:
  1. A real `ng run <project>:typecheck` on-stack Angular 22 (the cloned `ngx-leaflet` workspace)
     completes with NO `ERR_REQUIRE_ESM` (incl. the eager
     `retrieveProjectConfigurationsWithAngularProjects` prelude).
  2. Builder diagnostics + `formatDiagnostics` human output + `BuilderOutput.success` verdict
     are **IDENTICAL** to the Nx executor on the same inputs (ACB-01 parity is part of the gate,
     not a later check).
  3. The static byte-assertion (`gate-a-static.spec.ts`) is EXTENDED to the built builder entry
     and still passes (retains literal `import(`, never `require('@angular/compiler-cli')`).
  4. `nx run <project>:typecheck` still resolves after the `builders` field lands
     (`executors ?? builders` precedence -- the ACB-03 Nx-surface regression assertion).
  (Off-stack Angular 21 is NOT a GO criterion -- removed 2026-07-10.)
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
  byte-unchanged. (The `ngx-leaflet` clone exercises this directly: the lib target's
  `tsConfig: ["projects/ngx-leaflet/tsconfig.lib.json", "projects/ngx-leaflet/tsconfig.spec.json"]`
  and the demo target's `tsConfig: ["tsconfig.app.json", "tsconfig.spec.json"]`.)

### Claude's Discretion
- Plan decomposition (how many plans; whether the gate runs via `/gsd:spike` or as an inline
  gating plan of Phase 21; the exact spike number NNN); whether optional-peer classification
  (ACP-01) is pulled into this phase or left to Phase 23. Researcher + planner decide, grounded
  in the refs below.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (LOCKED decisions)
- `.planning/research/v0.2.1-angular-cli/SUMMARY.md` -- **CORRECTION & LOCKED DECISIONS wins over
  everything else**: Option A `tsConfig: string|string[]`, the executor-unchanged /
  generator-write-fork ASYMMETRY, GATE A' framing, the `executors ?? builders` precedence,
  Pitfalls 1/5/7 (this phase) and 8 (VOID). NOTE: the off-stack Angular 21 GATE leg and the
  real-OSS-clone tarball-e2e described there are SUPERSEDED by the 2026-07-10 substrate directives
  (see D-01/D-07 and the RESOLVED note).
- `.planning/research/v0.2.1-angular-cli/STACK.md` -- `convertNxExecutor` ships in the pinned
  `@nx/devkit@23.0.1` (non-deprecated); optional-peer classification (`@angular-devkit/architect`
  `^0.2200.0`, `rxjs` `^7.8.0`); `nx` transitive + `.nx/` tradeoff.
- `.planning/research/v0.2.1-angular-cli/ARCHITECTURE.md` -- builder = `convertNxExecutor(typecheckExecutor)`;
  additive-safety source-verified (`executor-utils.js` L76, `generator-utils.js` L57); build order.
- `.planning/research/v0.2.1-angular-cli/PITFALLS.md` -- Pitfall 1 (ESM bridge through `ng run`),
  Pitfall 7 (builder schema dialect), Pitfall 5 (undeclared runtime `require()`s).
- `.planning/phases/21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no/21-RESEARCH.md`
  -- the Phase-21-specific plan-ready research (spike mechanics against the real clone, builder
  wiring, tsConfig-array, Validation Architecture).

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` -- ENG-01, ACB-01, ACB-02 (GATE A', amended 2026-07-10), ACB-03;
  the ADDITIVE-ONLY charter.
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

### Real-clone substrate (dev/debug; uncommitted)
- `D:\projects\github\bluehalo\ngx-leaflet` @ `818e9ae` -- the on-stack Angular 22 `angular.json`
  workspace for GATE A' quick verification (app `ngx-leaflet-demo` + lib `ngx-leaflet`).

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
- **`bluehalo/ngx-leaflet` clone** -- a real app+lib Angular 22 `angular.json` workspace to point a
  wired `typecheck` builder target at for the GATE A' quick `ng run` verification.

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

- Substrate is a real Angular 22 workspace, on-stack, no `--legacy-peer-deps` (npm lockfile).
- The gate is GO/NO-GO by EVIDENCE (`ng run` either throws `ERR_REQUIRE_ESM` or does not), recorded
  in `forensic-log.json` -- not a subjective approval.
- e2e (Phase 24) scaffolds a fresh workspace; the real clone is dev/debug only and is not committed.

</specifics>

<resolved>
## RESOLVED (was U-01 -- trap quadrant; decided by the user 2026-07-10)

- **Off-stack Angular 21 dropped from the GATE.** The prior UNRESOLVED item (U-01) asked what a
  split spike result -- Ng22 GO / Ng21 NO-GO -- would mean, because ACB-02's literal "on-stack AND
  off-stack (Angular 21)" wording conflicted with the charter's "Angular 21 is only an off-stack
  cross-check." The user resolved it: **drop off-stack Angular 21 entirely.** GATE A' proves
  on-stack Angular 22 only (real clone now + scaffolded e2e in Phase 24). ACB-02 and ACV-01 are
  amended accordingly; there is no off-stack leg, so the split-result contingency is moot. Off-stack
  / cross-version support is not tracked as a Future Requirement for now (revisit only if a user
  asks).

</resolved>

<deferred>
## Deferred Ideas

None new -- discussion stayed within phase scope. (Already-tracked deferrals live in
REQUIREMENTS.md Future Requirements / Out of Scope: WALK-FUT-01 `createNodesV2` inference, the
`configuration` write-fork -> Phase 22, `ng-add` -> Phase 23, e2e/docs -> Phase 24.)

</deferred>

---

*Phase: 21-angular-cli-builder-engine-multi-tsconfig-gate-a-spike-go-no*
*Context gathered: 2026-07-10 (revised 2026-07-10 for the real-clone substrate + off-stack-Ng21 drop)*
