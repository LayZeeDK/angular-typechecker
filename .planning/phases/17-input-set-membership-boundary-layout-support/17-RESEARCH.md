# Phase 17: Input-set-membership boundary + layout support - Research

**Researched:** 2026-07-05
**Domain:** Angular compiler diagnostic boundary-filtering (TypeScript public API; `@angular/compiler-cli` 22.0.4; Nx executor adapter)
**Confidence:** HIGH

This is a GROUNDING research pass. The design is LOCKED by the Phase-16 gate spike (verdict = GO, branch 4a). Every locked claim below was verified against the ACTUAL source at `packages/angular-typechecker/src/core/**` and the installed `typescript@6.0.3` lib. The blueprint holds; three plan-time shapes need ratification (flagged in Open Questions), and one genuine SEMANTIC tension in the split-counter definition must be resolved before the isolation integration test can be designed correctly (Pitfall 3 + Open Question 1 -- the single most important finding here).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace directory-containment (current `isUnderDir` as the primary keep test) with input-set membership. Implement a pure `keep(diagnostic, inputSet, options) -> boolean` and route BOTH the walk-union path and the direct single-leaf path through it (one boundary semantics; avoids drift). The boundary filter references **ZERO ngtsc/component-registry internals** -- enforced by a structural `git grep` gate in the test suite.
- **D-02:** `inputTs` = the canonical UNION of every walked leaf's DECLARED `readConfiguration(leaf).rootNames` `.ts` paths -- NOT `program.getTsProgram().getRootFileNames()` (a SUPERSET that adds one synthetic `<root>.ngtypecheck.ts` shim per root; spike 006). If rootNames are ever read off a Program, strip/ignore `.ngtypecheck.ts` shims (never treat a shim as first-party -- it would corrupt `suppressedInGraph`). Canonicalize `inputTs` AND diagnostic files with the SAME existing canonicalizer (realpath -> slash -> case-fold) or symlink/junction cases break (T8).
- **D-03:** keep-rule branches (per diagnostic `d`, canonical file `F`, `base` = solution/host tsconfig dir): (a) `d` file-less OR `F` unresolvable -> KEEP (existing fail-safe); (b) `F` has a `node_modules` path SEGMENT -> SUPPRESS (unless `includeDeps`); (c) `F` in `inputTs` OR `F` under `base` -> KEEP (covers `.ts` inputs + inline templates; Layout-A stories are both; a transitively-imported dependency `.ts` is neither -> suppressed = isolation); (d) `F` is a non-`.ts` external-template resource -> branch 4a (below).
- **D-04:** External-template branch = **4a** (spike 008; G1 = html, G5 = PASS): read the `.html` diagnostic's public `ts.Diagnostic.relatedInformation`, resolve the owning component `.ts`, **KEEP iff that `.ts` is in `inputTs`**, else SUPPRESS (a dependency's external-template error -> isolation). If an `.html` diagnostic has NO `.ts` `relatedInformation` (unmappable; not observed in the spike) -> **default-KEEP** (over-report safe; never a false pass).
- **D-05 (LOCKED):** Split the currently-silent `suppressedCount` into `suppressedThirdParty` (= `node_modules` suppressions, expected, INFO) + `suppressedInGraph` (= a compiled first-party source dropped: NEITHER `node_modules` NOR file-less). Surface BOTH counts in the structured `CoreResult` AND loudly in executor stdout. A correctly-classified supported layout has `suppressedInGraph == 0` BY CONSTRUCTION.
- **D-08 (LOCKED):** Layout A (SB-01) is already type-checked by the shipped reference-walk; Phase 17 adds it as a regression fixture + a docs note (docs body is Phase 18). Layout B (SB-03) is delivered PURELY by the SB-02 boundary change -- no Storybook-specific code. Check the WHOLE tsconfig-declared set (the `include` is the selector), never a filename allowlist.
- **D-09 (test scope AUTO-LOCKED per roadmap split):** Phase 17 ships exactly: (1) a pure UNIT test on `keep()` with synthetic diagnostics + a synthetic input set (proves every branch a-d, incl. the 4a `relatedInformation` map + the unmappable default-KEEP); (2) the **tripwire** test -- assert external-template diagnostics DO carry a `.ts` `relatedInformation`; (3) the MINIMUM integration proof of this phase's 5 success criteria. The FULL T1-T11 acceptance matrix, packaged-tarball e2e, and docs are Phase 18 (SB-06/SB-07) -- do NOT pull them forward.

### Claude's Discretion (for research + planning)

- Exact module location + signature of `keep()` (extend `filter-diagnostics.ts` vs a new module) and the `inputSet` data structure (a `Set<string>` of canonical rootName paths is the obvious choice).
- Exactly how `walk-references.ts` surfaces each leaf's declared rootNames (it currently holds `result.program` and discards everything but the count).
- Exact stdout wording/format for the two counts (loud is the requirement).
- The D-06 exit-code shape and the D-07 field-retention question (both flagged below).

### Residual decisions flagged for plan-time ratification (NOT locked)

- **D-06 (direction AUTO-LOCKED; shape flagged):** `suppressedInGraph > 0` yields a distinct non-clean **coverage-incomplete** outcome. RESIDUAL: gate it in the PURE core so both the Nx executor and the deferred CLI inherit one rule; map to Nx `success: false` (`evaluate-result.ts`); decide whether the deferred CLI gets a DISTINCT exit code vs reusing `1`, ratified against `exit-codes.ts` at plan time.
- **D-07 (flagged):** `suppressedCount` is a shipped public `CoreResult` field. Recommendation: KEEP it (= `suppressedThirdParty + suppressedInGraph`) alongside the two new fields for an additive / non-breaking 0.x change; planner to confirm vs a clean replacement.

### Deferred Ideas (OUT OF SCOPE)

- Full T1-T11 negative-test acceptance matrix + in-repo generator fixtures + the packaged-tarball e2e (`nx add` + `nx g configuration` + `nx typecheck`) -> **Phase 18 (SB-06)**.
- README + changelog: exact coverage claim + caveats -> **Phase 18 (SB-07)**.
- `.mdx` / `.tsx`-without-`jsx` loud "not type-checked" notice (T11) -> Phase 18 validation.
- Layout C (flat root tsconfig, no `references[]`) beyond the no-silent-pass guard -> **Phase 19 (SB-08, stretch)**.
- Migrate the DIRECT single-leaf path's user-visible behavior onto the shared `keep()` boundary (the shared function ships in SB-02; broadening its behavioral role is deferred -- SB-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SB-02** | Replace directory-containment with a pure `keep(diagnostic, inputSet, options)` routed by BOTH walk + single-leaf; branch 4a; canonicalization symmetry; zero ngtsc internals. | Grounded: current filter is `filterDiagnostics()` in `filter-diagnostics.ts` (verified). Both callers already funnel through the single `finalize()` -> `buildFinalizeFilter()` chokepoint in `run-typecheck.ts` (verified). `relatedInformation` is public `ts.Diagnostic` API in `typescript@6.0.3` -- NO vendored-shim widening needed (verified against `node_modules/typescript/lib/typescript.d.ts:6923-6937`). Structural gate is satisfiable: `filter-diagnostics.ts` today contains ZERO ngtsc/`getSourceFiles`/registry tokens (verified via `git grep`). |
| **SB-04** | Split `suppressedCount` into `suppressedThirdParty` + `suppressedInGraph`; surface both loudly (stdout + structured); `suppressedInGraph > 0` => non-clean coverage-incomplete. | Grounded: `suppressedCount` today is a `FilterResult` field -> `CoreResult` field, and is **100% silent** -- `render-report.ts` reads ONLY `result.diagnostics`; the executor never surfaces it (verified). The detection(core)-vs-rendering(executor) split has TWO existing templates to mirror: `templateCheckAborted` and `skippedReferences` (verified in `run-typecheck.ts` + `executor.ts`). Coverage-incomplete verdict wires through `evaluate-result.ts` (Nx) and `exit-codes.ts` (deferred CLI). |
| **SB-01** | Layout A `*.stories.ts` type-checked by the shipped walk; regression fixture + docs note. | Grounded: the walk keeps files that are rootNames AND under base (rule c). Layout-A stories are both. Delivered as an in-repo fixture mirroring `fixtures/solution-style/` (verified fixture layout). Docs body deferred to Phase 18. |
| **SB-03** | Layout B centralized-host aggregated cross-project stories/components type-checked via SB-02; broken aggregated story (incl. external `templateUrl`) FAILS; clean passes; dependency + `node_modules` isolation. | Grounded: delivered PURELY by the SB-02 boundary change (no Storybook code). The kill-shot (external-template NG8002) is exactly the case rule (d)/4a exists to catch -- see Architecture Patterns. Integration fixture is a plain-Angular widened-include host; does NOT require `@storybook/angular` to be installed (spike 008 ran attribution against the bare workspace toolchain -- verified). |
</phase_requirements>

## Summary

Phase 17 is a single boundary-filter correctness fix plus additive structured signalling. The blueprint grounds cleanly against the real code:

- The two callers (solution walk-union and direct single-leaf) already merge into ONE `finalize()` -> `buildFinalizeFilter()` -> `filterDiagnostics()` chokepoint in `run-typecheck.ts`. Threading `inputTs` through that single seam gives "one boundary semantics" for free -- no new plumbing, just an added field on `FinalizeFilter`/`FilterOptions` and a `keep()` extraction.
- `ts.Diagnostic.relatedInformation` is **public TypeScript API** (`typescript@6.0.3`, verified). Branch 4a reads it directly on the existing `import type ts from 'typescript'` surface. **No `compiler-cli-types.ts` shim change is required**, and the structural "zero ngtsc internals" `git grep` gate is satisfiable (the module is clean today).
- The declared root-name paths the boundary needs are ALREADY in hand in both paths as `parsed.rootNames` (from `readConfiguration`). The walk currently discards them (`rootNamesCount += parsed.rootNames.length`); surfacing the paths is a one-line accumulation. This is the exact `readConfiguration().rootNames` declared set (D-02) -- NOT `program.getRootFileNames()` -- so the `.ngtypecheck.ts` shim landmine never arises.

**Primary recommendation:** Extract `keep(diagnostic, inputSet, options): boolean` inside `filter-diagnostics.ts` from the current inline loop; `filterDiagnostics` becomes the caller that (1) builds one canonical `inputSet` from raw `rootNames` with its own canonicalizer (guaranteeing T8 symmetry structurally), (2) calls `keep()`, and (3) buckets each SUPPRESSED diagnostic into `suppressedThirdParty` (node_modules) vs `suppressedInGraph` (everything else suppressed). Thread `inputTs` (raw paths) through `FinalizeFilter`; surface both counts on `CoreResult`; render them in the executor (INFO for third-party, WARN for in-graph); gate `suppressedInGraph > 0` as coverage-incomplete in the pure core.

**The one thing the planner MUST get right:** the split-counter definition (D-05) literally classifies a CORRECTLY-isolated dependency `.ts` error as `suppressedInGraph` -- which (per the D-06 ratified direction) makes a host that imports a broken dependency **coverage-incomplete (non-clean)**. This is consistent with the charter and the trust-lens ruling, but it means the isolation integration test (criterion 3) must assert *not-reported-in-codeframe*, NOT *clean-verdict*. See Pitfall 3 and Open Question 1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `keep(diagnostic, inputSet, options)` decision + counter split | Pure core (`filter-diagnostics.ts`) | -- | Pure, dependency-free, unit-testable with synthetic literals; no `console`/`process` (eslint-banned in `src/core/**`). |
| Surfacing declared rootName PATHS per leaf | Pure core (`walk-references.ts`) | -- | The walk already reads `readConfiguration(leaf).rootNames`; add a `rootNamePaths` accumulator to `WalkResult`. |
| Building `inputTs` union + threading it into the filter | Pure core (`run-typecheck.ts` `buildFinalizeFilter`/`finalize`) | -- | Single chokepoint both callers already share -- the one place that prevents walk/direct drift. |
| Coverage-incomplete verdict (pure policy) | Pure core (`evaluate-result.ts` + `exit-codes.ts`) | -- | One rule inherited by BOTH the Nx executor and the deferred CLI (D-06). |
| Rendering the two counts + the coverage-incomplete notice | Nx executor adapter (`executor.ts`) | -- | Only tier allowed to touch `@nx/devkit` `logger`; mirrors the existing `templateCheckAborted`/`skippedReferences` render split. |
| Mapping `CoreResult` -> Nx `{ success }` | Nx executor adapter (`executor.ts` via `evaluateResult`) | -- | Nx contract boundary; the CLI exit-code path is deferred scaffold (`toExitCode`, no live consumer). |

## Standard Stack

No new runtime or dev dependencies are introduced by this phase. Everything is in-repo and already installed. [VERIFIED: codebase]

### Core (all pre-existing, versions locked by PROJECT.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `6.0.3` | `ts.Diagnostic` / `ts.DiagnosticRelatedInformation` shapes read by `keep()` and 4a | Locked peer; `relatedInformation` is public API since TS 2.9 [VERIFIED: node_modules/typescript@6.0.3 lib.d.ts] |
| `@angular/compiler-cli` | `22.0.4` | Produces the diagnostics (incl. external-template NG8002/NG8102 with `.ts` `relatedInformation`) | Locked peer; attribution behavior proven in spike 008 [CITED: .planning/spikes/008-external-template-attribution/README.md] |
| `vitest` | `4.x` (`@nx/vitest:test`) | Unit + integration test runner (`*.spec.ts` / `*.integration.spec.ts`) | Project test runner [VERIFIED: vitest.config.mts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff / Why rejected |
|------------|-----------|-------------------------|
| `readConfiguration(leaf).rootNames` (declared set) | `program.getTsProgram().getRootFileNames()` | REJECTED (D-02): adds a synthetic `<root>.ngtypecheck.ts` shim per root; would corrupt `inputTs`/`suppressedInGraph` [CITED: spike 006] |
| `relatedInformation` (public) ownership map | ngtsc component registry / `TemplateTypeChecker` internals | REJECTED (D-04, D-01): brittle across Angular patches -> silent break -> false pass; also fails the structural git-grep gate |
| rootNames-only membership (drop non-`.ts`) | -- | REJECTED: drops external `.html` diagnostics -> false pass (the kill shot) |
| `program.getSourceFiles()` membership | -- | REJECTED: includes transitive imports -> breaks isolation |
| `includeDeps: true` as the Layout-B answer | -- | REJECTED: re-admits `node_modules` noise; forced SB10/TS6 `.d.ts` can themselves error -> false FAIL |

**Installation:** none.

## Package Legitimacy Audit

Not applicable -- this phase installs no external packages. All code changes are in-repo edits to `packages/angular-typechecker/src/core/**` + `.../executors/typecheck/executor.ts`, plus in-repo test fixtures under `fixtures/`. No `npm install`, no new `dependencies`/`devDependencies`. `@nx/dependency-checks` remains satisfied (no new imports beyond `typescript` types already imported). [VERIFIED: codebase]

## Architecture Patterns

### System Architecture Diagram (data flow, both entry paths)

```
runTypecheck(options)
  |
  ng.readConfiguration(tsConfigPath) --> parsed { rootNames, options.basePath, projectReferences, errors }
  |
  +-- rootNames.length === 0 AND hasProjectReferences ----> walkReferences(...)          [SOLUTION / Layout B]
  |        |                                                    |
  |        |   per surviving leaf:                              |
  |        |     parsed_leaf = readConfiguration(leafPath)      |
  |        |     rawDiagnostics += runNoEmitCompilation(...)    |
  |        |     rootNamesCount += parsed_leaf.rootNames.length |
  |        |  >> NEW: rootNamePaths += parsed_leaf.rootNames << |  (the declared set, D-02)
  |        v                                                    v
  |   WalkResult { rawDiagnostics, rootNamesCount, skippedReferences, rootNamePaths(NEW) }
  |        |
  |        +--> finalize(..., union, buildFinalizeFilter(parsed, options, ts.sys.useCaseSensitiveFileNames,
  |                                                       inputTs = walk.rootNamePaths (NEW)))
  |
  +-- rootNames.length > 0 --------------------------------> runNoEmitCompilation(...)     [DIRECT / Layout A leaf]
           |
           +--> finalize(..., diagnostics, buildFinalizeFilter(parsed, options,
                                            program.getTsProgram().useCaseSensitiveFileNames(),
                                            inputTs = parsed.rootNames (NEW)))
                                            |
                                            v
                   filterDiagnostics(diagnostics, { basePath, includeDeps, ...casefold, realpath, inputTs })
                        |
                        |  build canonicalize() ONCE; inputSet = Set(inputTs.map(canonicalize))   (T8 symmetry)
                        |  for each d:
                        |     keep(d, inputSet, {canonicalize, canonicalBase, includeDeps})  -->  boolean
                        |     kept? push : bucket( node_modules ? suppressedThirdParty++ : suppressedInGraph++ )
                        v
                   FilterResult { kept, suppressedThirdParty(NEW), suppressedInGraph(NEW), suppressedCount(=sum) }
                        |
                        v
                   CoreResult { ..., suppressedThirdParty, suppressedInGraph, suppressedCount }
                        |
        executor.ts:  logger.info(thirdParty)  /  logger.warn(inGraph>0 => coverage-incomplete)
                      evaluateResult(result) --> { success }  (fails on errorCount>0 OR suppressedInGraph>0)
```

### Pattern 1: The `keep()` decision tree (grounded, ORDERED)

The blueprint lists branches (a)-(d); grounding them against rule (c)'s isolation clause exposes an implicit ordering the planner MUST make explicit: after (c) fails, a `.ts` file is a dependency source (SUPPRESS for isolation) and a non-`.ts` file is an external template (branch 4a). Do not treat (d) as a blanket "else -> 4a" -- that would run `relatedInformation` on a dependency `.ts` diagnostic (which has none) and default-KEEP it, breaking isolation.

```typescript
// Source: grounded from filter-diagnostics.ts (current loop) + CONSENSUS D2 + spike 008.
// Pure; reads ONLY public ts.Diagnostic fields. Zero ngtsc internals (structural git-grep gate).
export function keep(
  diagnostic: ts.Diagnostic,
  inputSet: ReadonlySet<string>,          // canonical rootName paths
  options: {
    canonicalize: (p: string) => string | undefined;  // realpath -> slash -> case-fold (shared)
    canonicalBase: string | undefined;
    includeDeps: boolean;
  },
): boolean {
  if (options.includeDeps) {
    return true; // D-07 fold-back
  }

  // (a) file-less OR present-but-empty fileName -> KEEP (existing fail-safe, COR-03/D-03)
  if (diagnostic.file === undefined || diagnostic.file.fileName === '') {
    return true;
  }

  const F = options.canonicalize(diagnostic.file.fileName);

  // (a') unresolvable (realpath threw) -> KEEP (RES-03 fail-safe)
  if (F === undefined) {
    return true;
  }

  // (b) node_modules segment -> SUPPRESS
  if (isNodeModulesPath(F)) {
    return false;
  }

  // (c) in the declared input set OR under base -> KEEP (covers .ts inputs + inline templates)
  if (inputSet.has(F) || isUnderDir(F, options.canonicalBase)) {
    return true;
  }

  // reached: F is resolved, non-node_modules, NOT a rootName, NOT under base.
  // A .ts/.tsx here is a transitively-imported DEPENDENCY source -> SUPPRESS (isolation).
  if (F.endsWith('.ts') || F.endsWith('.tsx')) {
    return false;
  }

  // (d) F is a non-.ts external-template resource (e.g. .html) -> branch 4a
  const owner = owningComponentTs(diagnostic); // reads d.relatedInformation (public API)
  if (owner === undefined) {
    return true;               // unmappable edge -> default-KEEP (over-report safe; board G8)
  }
  return inputSet.has(options.canonicalize(owner) ?? owner); // KEEP iff owner .ts in-graph
}
```

### Pattern 2: Branch 4a -- resolve the owning component `.ts` via public `relatedInformation`

`ts.Diagnostic.relatedInformation?: DiagnosticRelatedInformation[]`; each entry has `file: SourceFile | undefined` and `start: number | undefined`. [VERIFIED: node_modules/typescript/lib/typescript.d.ts:6923-6937]

Spike 008 verified: an external-`templateUrl` `.html` diagnostic (NG8002 core AND NG8102 extended) carries `relatedInformation` pointing back to the component `.ts` with the message "Error/Warning occurs in the template of component X". [CITED: .planning/spikes/008-external-template-attribution/README.md]

```typescript
// Source: grounded from spike 008 + typescript@6.0.3 public types. NO ngtsc internals.
function owningComponentTs(diagnostic: ts.Diagnostic): string | undefined {
  const related = diagnostic.relatedInformation ?? [];
  for (const info of related) {
    const name = info.file?.fileName;
    if (name !== undefined && (name.endsWith('.ts') || name.endsWith('.tsx'))) {
      return name; // the owning component source; keep iff in inputSet (branch 4a)
    }
  }
  return undefined; // unmappable -> caller default-KEEPs
}
```
Recommendation: match by `.ts`/`.tsx` extension only (do NOT match on the English message text -- that is locale/wording-fragile). The tripwire test (D-09.2) protects the assumption that this `.ts` `relatedInformation` exists.

### Pattern 3: Surface declared rootName paths from the walk

```typescript
// walk-references.ts -- WalkResult gains rootNamePaths; the loop already has parsed.rootNames.
export interface WalkResult {
  rawDiagnostics: readonly ts.Diagnostic[];
  rootNamesCount: number;
  skippedReferences: readonly SkippedReference[];
  rootNamePaths: readonly string[]; // NEW: union of surviving leaves' readConfiguration().rootNames (D-02)
}
// in the surviving-leaf tail, alongside `rootNamesCount += parsed.rootNames.length;`:
rootNamePaths.push(...parsed.rootNames);
```
The direct single-leaf path already has `parsed.rootNames` in `runTypecheck`; pass it straight into `buildFinalizeFilter`.

### Pattern 4: Split the counter in the CALLER, keep `keep()` a clean boolean

`keep()` returns `boolean` (locked signature, D-01). A SUPPRESSED diagnostic always has a resolved, non-empty file (branches a/a' keep every file-less/unresolvable case), so the caller distinguishes the two buckets with a single `isNodeModulesPath` re-check on the memoized canonical path -- cheap, no double `realpath` syscall (`createCanonicalizer` memoizes). `suppressedCount` stays as the additive sum (D-07 recommendation).

### Recommended Project Structure (files touched -- NO new modules recommended)

```
packages/angular-typechecker/src/core/
  filter-diagnostics.ts    # extract keep(); split FilterResult counters; add inputTs to FilterOptions
  walk-references.ts       # add rootNamePaths to WalkResult + accumulate parsed.rootNames
  run-typecheck.ts         # thread inputTs through FinalizeFilter/buildFinalizeFilter/finalize; add CoreResult fields
  evaluate-result.ts       # gate suppressedInGraph > 0 -> { success: false } (D-06)
  exit-codes.ts            # gate suppressedInGraph > 0 -> non-zero (deferred CLI; distinct-vs-1 = Open Q 2)
packages/angular-typechecker/src/executors/typecheck/
  executor.ts              # render both counts (INFO third-party, WARN in-graph)
fixtures/                  # NEW Layout-A + Layout-B integration fixtures (plain Angular, no @storybook/angular)
```
Extending `filter-diagnostics.ts` in place (vs a new module) is the lazy/correct choice: the canonicalizer, `isNodeModulesPath`, and `isUnderDir` all already live there, and the structural git-grep gate already targets that file.

### Anti-Patterns to Avoid

- **Treating branch (d) as a blanket else -> 4a.** A dependency `.ts` reaching the else must SUPPRESS (isolation), not run `relatedInformation`. Order the `.ts`/`.tsx` suppress check BEFORE 4a (see Pattern 1).
- **Building `inputTs` and canonicalizing diagnostic files with two different canonicalizers.** Breaks T8. Build ONE canonicalizer in `filterDiagnostics` and run both through it.
- **Matching 4a ownership on the diagnostic message string.** Locale/wording-fragile; match on the related `.ts` file extension.
- **Surfacing the counts via `render-report.ts`.** That seam reads only `diagnostics` and writes byte-deterministic codeframes to raw stdout; the counts belong on `logger.info`/`logger.warn` from the executor (mirror `skippedReferences`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonicalizing paths (realpath -> slash -> case-fold, memoized) | A new normalizer | `createCanonicalizer` (already exported from `filter-diagnostics.ts`) | T8 symmetry demands the SAME canonicalizer for inputTs + diagnostic files [VERIFIED] |
| node_modules-segment detection | `includes('node_modules')` | `isNodeModulesPath` (existing, segment-bounded) | Avoids the `node_modules-tools` substring false-positive [VERIFIED: existing spec] |
| Segment-bounded containment | `startsWith(dir)` | `isUnderDir` (existing, exported, reused by the walk) | Avoids `/foo/bar-other` under `/foo/bar` [VERIFIED] |
| Owning-component lookup | ngtsc registry / template-type-checker | public `ts.Diagnostic.relatedInformation` | Stable public API; passes the structural gate [VERIFIED + CITED spike 008] |
| Merging walk + direct filter semantics | A second filter path | the single `finalize()` -> `buildFinalizeFilter()` chokepoint | Both callers already funnel through it -- prevents drift (D-01) [VERIFIED] |
| Detection-vs-rendering split for the new counts | Logging from core | mirror `templateCheckAborted`/`skippedReferences` | Core is pure (eslint bans `console`/`process` in `src/core/**`) [VERIFIED] |

**Key insight:** Every primitive this phase needs already exists in `filter-diagnostics.ts` and is battle-tested by the current spec. Phase 17 is a re-composition (extract `keep`, thread `inputTs`, split the counter), not new machinery.

## Runtime State Inventory

This is a code refactor of a pure in-process boundary filter. There is NO runtime state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- the tool holds no database/datastore; diagnostics are in-process arrays. | None. |
| Live service config | None -- no external service. | None. |
| OS-registered state | None -- no OS registrations. | None. |
| Secrets/env vars | None -- no secrets/env names reference the filter. | None. |
| Build artifacts | The shipped `CoreResult`/`FilterResult` shapes are consumed only within the package + its specs; `suppressedCount` is a public `CoreResult` field. Additive new fields (`suppressedThirdParty`/`suppressedInGraph`) are non-breaking; keep `suppressedCount` (D-07). No compiled artifact carries a stale value once rebuilt. | Rebuild via `nx build` (standard). Update the executor.spec `coreResult()` helper (adds the two fields) -- verified it currently hardcodes `suppressedCount: 0`. |

**Nothing found in categories 1-4:** verified -- angular-typechecker is a stateless CLI/executor type-checker; the boundary filter is a pure function over in-memory `ts.Diagnostic[]`.

## Common Pitfalls

### Pitfall 1: The `.ngtypecheck.ts` shim landmine (D-02)
**What goes wrong:** Reading `program.getTsProgram().getRootFileNames()` for `inputTs` adds one synthetic `<root>.ngtypecheck.ts` per root -- an in-memory, on-nothing-on-disk shim.
**Why it happens:** The Program's root file set is a SUPERSET of the declared set. [CITED: spike 006]
**How to avoid:** Key `inputTs` on `readConfiguration(leaf).rootNames` (the declared set) -- which both paths already hold as `parsed.rootNames`. Never read rootNames off a Program here. If a future refactor ever must, strip `.ngtypecheck.ts` before building `inputTs`.
**Warning signs:** A `suppressedInGraph` that never reaches 0 on a clean host; a shim path appearing in `inputTs`.

### Pitfall 2: Canonicalization asymmetry breaks T8 (symlink/junction)
**What goes wrong:** A story reached via a junction whose realpath resolves OUTSIDE the host dir is wrongly suppressed if `inputTs` and the diagnostic file are canonicalized differently.
**Why it happens:** Two canonicalizers (or one applied to only one side) diverge on realpath/case-fold.
**How to avoid:** Build ONE `createCanonicalizer` in `filterDiagnostics`; canonicalize `inputTs` paths and diagnostic files with it. This is a Windows-dev-box concern (case-insensitive + junctions).
**Warning signs:** Layout-B integration green on Linux, `suppressedInGraph > 0` (coverage-incomplete) on Windows for the same fixture.

### Pitfall 3: The split-counter classifies CORRECT isolation as `suppressedInGraph` (THE load-bearing finding)
**What goes wrong:** D-05 defines `suppressedInGraph` = suppressed AND (NOT node_modules) AND (NOT file-less). A transitively-imported DEPENDENCY `.ts` with a real error is suppressed by rule (c)-fail (isolation) and is neither node_modules nor file-less -> it increments `suppressedInGraph`. Per the D-06 ratified direction, `suppressedInGraph > 0` => **coverage-incomplete => non-clean verdict**. So a host importing a broken dependency is non-clean even though the dependency error is NOT reported in the codeframe.
**Why it happens:** "isolation" (criterion 3) means *not attributed/reported*, NOT *clean verdict*. A clean host (criterion 4a) has no errors anywhere, so `suppressedInGraph == 0` trivially -- the "== 0 by construction" guarantee is about CLEAN supported layouts, not about hosts that import broken code.
**How to avoid / design implication:** The isolation integration test (criterion 3 / T4) MUST assert the dependency error's CODE is absent from `result.diagnostics` (not reported) -- and, under the recommended reading (R1), that the verdict is non-clean / `suppressedInGraph >= 1`. Do NOT write the isolation test to assert `success: true`. See Open Question 1 for the full R1-vs-R2 decision; R1 (charter-maximal, matches the D-06 ratified direction + the CONSENSUS trust lens) is recommended.
**Warning signs:** A planner-authored isolation test asserting a clean verdict -- it would contradict the coverage-incomplete gate and force one of the two to be wrong.

### Pitfall 4: External template dropped by a rootNames-only shortcut (the kill shot)
**What goes wrong:** An aggregated component's external `templateUrl` `.html` is neither a rootName nor under base; a naive `inputSet.has(F)`-only membership drops it -> false pass on a real NG8002.
**Why it happens:** The `.html` file is not in `parsed.rootNames`; attribution is to the `.html`, not the `.ts` (G1 = html). [CITED: spike 008]
**How to avoid:** Implement branch (d)/4a fully; the kill-shot integration proof (criterion 2) is the guard.
**Warning signs:** Criterion 2 fixture passes when it should fail.

### Pitfall 5: Surfacing counts silently (the SB-04 charter floor)
**What goes wrong:** Adding `suppressedInGraph` to `CoreResult` but not rendering it -- CI gates on exit code, agents on the structured verdict; a log line beside `success:true` is functionally silent, but NO log line is worse.
**How to avoid:** Surface both counts in BOTH the structured `CoreResult` AND executor stdout (`logger.info` third-party, `logger.warn` in-graph), and make `suppressedInGraph > 0` verdict-affecting so exit code + `{ success }` both flip. [CITED: CONSENSUS D2 split-counter]

## Code Examples

### Coverage-incomplete verdict wiring (pure core, one rule for both adapters)

```typescript
// evaluate-result.ts -- extend the Pick + add the gate (errors still always fail first).
// Source: grounded from current evaluate-result.ts + D-06.
export function evaluateResult(
  result: Pick<CoreResult, 'errorCount' | 'warningCount' | 'suppressedInGraph'>,
  options: EvaluateOptions = {},
): { success: boolean } {
  if (result.errorCount > 0) {
    return { success: false };
  }
  if (result.suppressedInGraph > 0) {
    return { success: false }; // coverage-incomplete: a first-party diagnostic was dropped
  }
  // ...existing maxWarnings gate unchanged...
  return { success: true };
}
```
```typescript
// exit-codes.ts -- deferred CLI; Open Question 2 = reuse 1 vs a distinct code.
// Recommendation: reuse 1 (non-clean, non-infra) with a ponytail note; toExitCode has NO live consumer.
export function toExitCode(
  input: Pick<CoreResult, 'errorCount' | 'suppressedInGraph'> | TypecheckInfrastructureError,
): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) return 2;
  if (input.errorCount > 0) return 1;
  if (input.suppressedInGraph > 0) return 1; // coverage-incomplete -> non-clean (see Open Q 2)
  return 0;
}
```

### Executor rendering (mirror the skippedReferences pattern)

```typescript
// executor.ts -- after runTypecheck, before renderReport. logger is @nx/devkit (adapter-only).
if (result.suppressedThirdParty > 0) {
  logger.info(
    `angular-typechecker: ${result.suppressedThirdParty} node_modules diagnostic(s) suppressed ` +
      `(expected; pass includeDeps to include them).`,
  );
}
if (result.suppressedInGraph > 0) {
  logger.warn(
    `angular-typechecker: ${result.suppressedInGraph} first-party diagnostic(s) were dropped by the ` +
      `project boundary -- this run's coverage is INCOMPLETE and the verdict is NOT clean. ` +
      `A real error on a checked file may have been suppressed.`,
  );
}
```

## State of the Art

Stable domain -- no recent API churn affects this phase.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Directory-containment boundary (`isUnderDir` as primary keep test) | Compiler input-set membership (`keep(diagnostic, inputSet, options)`) | This phase (v0.1.2) | Fixes the Layout-B silent false pass; a green->red flip on affected Layout-B builds is a true-fail CORRECTION (loud changelog callout deferred to Phase 18) |

**Deprecated/outdated:** none relevant. `ts.Diagnostic.relatedInformation` has been public and stable since TS 2.9; no deprecation in TS 6.0.3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | External-template `.html` diagnostics reliably carry a `.ts` `relatedInformation` on the official stack. | Pattern 2 / Branch 4a | LOW -- proven in spike 008; the D-09.2 tripwire test is the explicit guard, and the unmappable edge default-KEEPs (never a false pass). [MITIGATED by tripwire] |
| A2 | Phase-17 Layout-B integration fixtures do NOT require `@storybook/angular` to be installed (a plain-Angular widened-include host reproduces the boundary case). | Environment Availability / phase_requirements SB-03 | LOW -- spike 008 ran attribution against the bare workspace toolchain; the boundary fix is Storybook-agnostic. Forced-SB10 install is a Phase-18 tarball/e2e concern. |
| A3 | The R1 reading (isolation-suppressed dependency `.ts` counts as `suppressedInGraph` -> coverage-incomplete) is the intended semantics. | Pitfall 3 / Open Q 1 | MEDIUM -- this is a genuine ratification point; if the planner/user chooses R2, the isolation test's verdict expectation flips. Flagged as the top Open Question. |
| A4 | Reusing exit code `1` for coverage-incomplete is acceptable for the deferred CLI. | Open Q 2 / exit-codes.ts | LOW -- `toExitCode` has no live consumer; additive and reversible when the CLI ships. |

## Open Questions

1. **Does a CORRECTLY-isolated dependency error make the host coverage-incomplete (non-clean)?** (HIGH impact -- defines the verdict semantics AND the isolation test design.)
   - **What we know:** D-05's literal definition (`suppressedInGraph` = suppressed AND not-node_modules AND not-file-less) INCLUDES a transitively-imported dependency `.ts`. The D-06 auto-locked *direction* and the CONSENSUS trust lens both say "a non-node_modules diagnostic suppressed IS the false pass -> make the run non-clean." Criterion 3 requires only that the dependency error is NOT REPORTED (isolation of attribution), and is silent on the verdict. Criterion 4a's `== 0` guarantee is for CLEAN supported layouts (no errors -> nothing suppressed).
   - **What's unclear:** Whether the team wants the strict reading (R1: any first-party suppression -> coverage-incomplete, so importing a broken dependency flips the host non-clean) or a graph-aware reading (R2: only canonicalization-mismatch / genuinely-should-have-been-kept suppressions count; correctly-isolated dependencies do not).
   - **Recommendation: R1 (strict/charter-maximal).** It matches the D-06 ratified direction, the trust lens, and "never a silent false pass." It is also the SIMPLER implementation (bucket = node_modules ? third-party : in-graph). R2 (an opt-in strict mode is already SB-08-deferred; here the DEFAULT would be lenient) adds a third classification and defers the charter guarantee -- avoid. **Design consequence the planner MUST honor:** the isolation integration test (criterion 3 / T4) asserts *dependency error absent from `result.diagnostics`* AND (R1) *verdict non-clean / `suppressedInGraph >= 1`* -- NOT `success: true`.

2. **Deferred-CLI exit code for coverage-incomplete: reuse `1` or add a distinct code (e.g. `3`)?** (LOW impact -- `toExitCode` has no live consumer; deferred CLI scaffold.)
   - **What we know:** current policy is `0` clean / `1` type-error / `2` infra (ngc parity). `evaluate-result.ts` (the LIVE Nx path) maps to `{ success: false }` regardless.
   - **Recommendation:** reuse `1` (non-clean, non-infra) now, with a `// ponytail:` note that a distinct code can be added when the CLI actually ships and a consumer needs to distinguish coverage-incomplete from type-error. Additive and low-risk. Ratify at plan time against `exit-codes.ts`.

3. **`suppressedCount` retention (D-07): keep as the additive sum, or replace?** (LOW impact.)
   - **Recommendation:** KEEP `suppressedCount = suppressedThirdParty + suppressedInGraph` alongside the two new fields (additive / non-breaking 0.x). Confirm at plan time; a clean replacement would be a gratuitous shape change to a shipped public field.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `typescript` | `keep()` types + 4a `relatedInformation` | Yes | 6.0.3 | -- [VERIFIED] |
| `@angular/compiler-cli` | integration fixtures produce real NG8002/NG8102 + `relatedInformation` | Yes | 22.0.4 | -- (locked peer) |
| `vitest` + `@nx/vitest` | unit + integration specs | Yes | 4.x | -- [VERIFIED: vitest.config.mts] |
| `@storybook/angular` | (NOT needed for Phase 17 fixtures) | N/A | -- | Plain-Angular widened-include host fixture reproduces Layout B; forced-SB10 install is a Phase-18 e2e concern (A2) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none required for Phase 17 (the `@storybook/angular` force-install belongs to Phase 18's tarball e2e).

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` -- this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (`testTimeout`/`hookTimeout` 30000 for cold-compiler specs) [VERIFIED] |
| Quick run command | `npx nx test angular-typechecker -- filter-diagnostics` (pure unit specs, sub-second) |
| Full suite command | `npx nx test angular-typechecker` |
| Unit vs integration | unit = `*.spec.ts` (synthetic literals, no compiler); real-compiler = `*.integration.spec.ts` (cold `performCompilation`) [VERIFIED convention] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SB-02 | `keep()` branch (a): file-less / present-but-empty / unresolvable -> KEEP | unit | `npx nx test angular-typechecker -- filter-diagnostics` | ❌ Wave 0 (extend `filter-diagnostics.spec.ts`) |
| SB-02 | `keep()` branch (b): node_modules segment -> SUPPRESS (unless includeDeps) | unit | same | ✅ exists (segment tests) -- extend for the split counter |
| SB-02 | `keep()` branch (c): F in `inputSet` OR under base -> KEEP (Layout-A story = both) | unit | same | ❌ Wave 0 (synthetic inputSet) |
| SB-02 | `keep()` else: dependency `.ts` (not rootName, not under base) -> SUPPRESS (isolation) | unit | same | ❌ Wave 0 |
| SB-02 | `keep()` branch (d)/4a: `.html` with `.ts` `relatedInformation` in inputSet -> KEEP; owner NOT in inputSet -> SUPPRESS; unmappable -> default-KEEP | unit | same | ❌ Wave 0 (synthetic diag with `relatedInformation`) |
| SB-02 | Canonicalization symmetry (T8): inputSet + diagnostic file share one canonicalizer; junction/case-fold kept | unit | same | ❌ Wave 0 (injected realpath, mirror existing OUT-02 tests) |
| SB-02 | Tripwire (D-09.2): external-template diagnostics DO carry a `.ts` `relatedInformation` | integration | `npx nx test angular-typechecker -- external-template` | ❌ Wave 0 (`*.integration.spec.ts` against a fixture with an external `templateUrl`) |
| SB-02 | Structural gate: `filter-diagnostics.ts` references ZERO ngtsc/registry/`getSourceFiles` tokens | unit (git grep) | `npx nx test angular-typechecker -- structural` | ❌ Wave 0 (a spec that reads the file and asserts a denylist has no matches) |
| SB-04 | `filterDiagnostics` splits suppressions into `suppressedThirdParty` + `suppressedInGraph`; `suppressedCount` == sum | unit | `npx nx test angular-typechecker -- filter-diagnostics` | ❌ Wave 0 |
| SB-04 | `evaluateResult`: `suppressedInGraph > 0` -> `{ success: false }`; `== 0` unaffected | unit | `npx nx test angular-typechecker -- evaluate-result` | ❌ Wave 0 (extend `evaluate-result.spec.ts`) |
| SB-04 | `toExitCode`: `suppressedInGraph > 0` -> non-zero (Open Q 2 code) | unit | `npx nx test angular-typechecker -- exit-codes` | ❌ Wave 0 (extend `exit-codes.spec.ts`) |
| SB-04 | executor renders both counts (INFO third-party, WARN in-graph) via `logger` | unit | `npx nx test angular-typechecker -- executor` | ❌ Wave 0 (extend `executor.spec.ts`, mock `logger`; update `coreResult()` helper) |
| SB-01 | Layout A: broken `*.stories.ts` FAILS, clean PASSES (regression) | integration | `npx nx test angular-typechecker -- layout-a` | ❌ Wave 0 (fixture mirroring `fixtures/solution-style/` + a story file) |
| SB-03 | Layout B: broken aggregated out-of-dir story FAILS, clean PASSES | integration | `npx nx test angular-typechecker -- layout-b` | ❌ Wave 0 (widened-include host fixture, plain Angular) |
| SB-03 | Kill shot (criterion 2): aggregated external-`templateUrl` NG8002 FAILS with `.html`/component codeframe | integration | same | ❌ Wave 0 |
| SB-03 | Isolation (criterion 3): dependency internal error + node_modules NOT reported; (R1) verdict non-clean via coverage-incomplete | integration | same | ❌ Wave 0 (see Pitfall 3 / Open Q 1 for verdict expectation) |
| SB-04 | Clean Layout-B host (criterion 4): `suppressedInGraph == 0`, both counts in stdout AND structured result | integration | same | ❌ Wave 0 |
| SB-02 | No Layout-A regression (criterion 5): boundary is a pure shared `keep()`; git grep shows zero ngtsc/registry internals | integration + git grep | full suite + structural spec | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker -- filter-diagnostics` (pure `keep()` unit tier -- fast, cannot rot).
- **Per wave merge:** `npx nx test angular-typechecker` (full package suite incl. `*.integration.spec.ts` cold-compiler proofs).
- **Phase gate:** full suite green + `npx nx run angular-typechecker:lint` + `npx nx run angular-typechecker:build` (the drift guard) before `/gsd-verify-work`. (Global rule: format:check + lint are CI gates -- run them; do not skip.)

### Wave 0 Gaps
- [ ] Extend `filter-diagnostics.spec.ts` -- `keep()` branches (a)-(d), 4a `relatedInformation` map, unmappable default-KEEP, split-counter buckets, T8 symmetry. (Covers SB-02, SB-04.)
- [ ] New `*.integration.spec.ts` (external-template tripwire) -- covers SB-02 D-09.2.
- [ ] New structural-gate spec -- `git grep`/read-file denylist over `filter-diagnostics.ts` (SB-02).
- [ ] Extend `evaluate-result.spec.ts` + `exit-codes.spec.ts` -- coverage-incomplete gate (SB-04).
- [ ] Extend `executor.spec.ts` -- count rendering; UPDATE the `coreResult()` helper to include `suppressedThirdParty`/`suppressedInGraph` (currently hardcodes `suppressedCount: 0`).
- [ ] New in-repo fixtures under `fixtures/` -- Layout A (`layout-a-storybook` mirroring `solution-style/`) and Layout B (`layout-b-host` widened-include host + a sibling dependency + an aggregated component with an external `templateUrl`). Plain Angular; NO `@storybook/angular` install (A2).
- [ ] Framework install: none -- Vitest infrastructure already present.

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (absent = enabled). This is a pure, offline type-checker boundary filter -- no auth, session, network, or crypto surface. The relevant security property is INTEGRITY OF THE VERDICT.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | The boundary filter is itself the control: it must never DROP a real first-party diagnostic (a false PASS is the security failure). Fail-safe bias -- file-less/unresolvable/unmappable all KEEP; `suppressedInGraph > 0` fails the verdict. |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted path / symlink / junction whose realpath evades the boundary and drops a real error (false PASS) | Tampering / Repudiation (of a verdict) | Canonicalize inputSet + diagnostic files with the SAME `createCanonicalizer` (T8); on a canonicalization throw, KEEP (fail-safe); `suppressedInGraph > 0` -> coverage-incomplete (never silent). |
| A future Angular attribution flip (external template no longer carries `.ts` `relatedInformation`) silently drops diagnostics | Tampering (of coverage) | The D-09.2 tripwire test fails LOUD; the unmappable edge default-KEEPs (over-report, never under-report). |
| Brittle ngtsc-internal coupling silently breaking across an Angular patch -> false pass | Tampering | Use only public `ts.Diagnostic.relatedInformation`; enforce with the structural `git grep` gate. |

## Sources

### Primary (HIGH confidence)
- Codebase (read/grep this session): `filter-diagnostics.ts`, `run-typecheck.ts`, `walk-references.ts`, `evaluate-result.ts`, `exit-codes.ts`, `executor.ts`, `gather-diagnostics.ts`, `compiler-cli-types.ts`, `render-report.ts`, `filter-diagnostics.spec.ts`, `executor.spec.ts`, `walk-references.integration.spec.ts`, `exit-codes.spec.ts`, `vitest.config.mts` -- the actual API surface + test patterns.
- `node_modules/typescript/lib/typescript.d.ts:6923-6937` (installed `typescript@6.0.3`) -- `Diagnostic.relatedInformation?: DiagnosticRelatedInformation[]`; `DiagnosticRelatedInformation.file: SourceFile | undefined`, `.start: number | undefined`. Confirms branch 4a uses public API; no shim widening.
- `git grep` structural checks -- `filter-diagnostics.ts` contains zero ngtsc/`getSourceFiles`/registry tokens; no prior `relatedInformation`/`keep`/`inputTs`/`suppressedInGraph` usage in `src`.
- `.planning/spikes/008-external-template-attribution/README.md` -- G1 = html, G5 = PASS (4a); `relatedInformation` -> owning `.ts`.
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` -- D2 keep-rule, split-counter, D-06 residual + executor recommendation.
- `.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md` -- the locked build blueprint.
- `.planning/REQUIREMENTS.md`, `17-CONTEXT.md`, `16-SUMMARY.md`, `SKILL.md` -- requirements + locked decisions + gate verdict.

### Secondary (MEDIUM confidence)
- None -- all claims grounded against primary in-repo/installed sources.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps; versions verified against installed packages.
- Architecture / integration points: HIGH -- every touch point read in source; both callers already share the single `finalize` chokepoint.
- Branch 4a / `relatedInformation`: HIGH -- verified against installed TS 6.0.3 types + spike 008.
- Split-counter SEMANTICS (isolation vs coverage-incomplete): MEDIUM -- a genuine ratification point (Open Q 1); the mechanics are HIGH, the intended verdict for the broken-dependency case needs a plan-time lock.
- Pitfalls: HIGH -- grounded from the existing spec + spike records.

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (stable domain; `ts.Diagnostic` shape + Angular 22.0.4 attribution are locked-peer stable)
