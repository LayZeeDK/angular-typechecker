---
phase: 13
phase_name: "engine-solution-tsconfig-reference-walking"
project: "angular-typechecker"
generated: "2026-07-01"
counts:
  decisions: 5
  lessons: 6
  patterns: 6
  surprises: 4
missing_artifacts:
  - "UAT.md"
---

# Phase 13 Learnings: engine-solution-tsconfig-reference-walking

## Decisions

### Export the two path helpers rather than extract a new module
Made `createCanonicalizer` and `isUnderDir` `export`ed from `filter-diagnostics.ts` (two
`export` keywords, bodies byte-unchanged) instead of extracting a new `path-canonicalize.ts`.
`isNodeModulesPath` stayed private.

**Rationale:** Smallest delta that satisfies D-01 "reuse tested machinery verbatim" and avoids a
duplicate canonicalizer (RESEARCH Open Question 1 / Pitfall 6); minimizes public surface.
**Source:** 13-01-SUMMARY.md

### 90002 not-found is detected by code only, never by source/message text
The walk reclassifies a per-leaf `ng.readConfiguration` failure to a synthesized `90002` only
when `code === ng.UNKNOWN_ERROR_CODE` (500).

**Rationale:** Message/source text is locale- and version-fragile; a code check is stable and
matches the existing 90001 idiom. Fold-and-count then continues walking survivors.
**Source:** 13-03-SUMMARY.md

### skippedReferences threaded onto CoreResult non-empty-only, attached after finalize
`SkippedReference` lives in `walk-references.ts`, is re-exported from `index.ts`, and is attached
to `CoreResult` only when the array is non-empty (`[] -> undefined`) via the same conditional-spread
idiom as `templateCheckAborted` -- attached AFTER `finalize` returns rather than adding a `finalize`
parameter.

**Rationale:** Additive, non-breaking (0.x); keeps `finalize`'s signature untouched; mirrors the
existing pure-detection / adapter-render seam (RESEARCH Directive 2 / Open Question 2).
**Source:** 13-03-SUMMARY.md, 13-04-SUMMARY.md

### WALK-02 uses the `default` named input, not `production`
`nx.json` `targetDefaults` for the walk target swapped `production` -> `default`, retaining
`outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default`.

**Rationale:** `production` excludes `*.spec.ts`; with the walk now type-checking the spec leaf, a
spec-only edit under `production` would replay a stale PASS. `default` (lib+spec source union) is
the correct coarse input (L-5 / Spike 005).
**Source:** 13-06-SUMMARY.md

### Execute multi-plan waves in isolated worktrees, single-plan waves on the main tree
Waves 1 and 4 (two disjoint plans each) ran as parallel git-worktree executors with a shared
`node_modules` junction; waves 2 and 3 (single plan each) ran sequentially on the main checkout.

**Rationale:** Parallelism only pays off with 2+ disjoint plans; single-plan waves get real
`node_modules` with zero provisioning. Worktree waves need the AGENTS.md junction + link-only
teardown to stay safe on Windows.
**Source:** 13 execution (orchestrator), AGENTS.md parallel-execution rules

## Lessons

### The walk target's nx.json key is the executor id, and there are TWO of them
The plan assumed a `targetDefaults["angular-typecheck"]` key. The real keys are
`angular-typechecker:angular-typecheck` (dev-workspace executor id) AND
`@angular-typechecker/angular-typechecker:angular-typecheck` (published-package executor id) -- two
default forms of the SAME executor. The `production -> default` swap had to be applied to BOTH.

**Context:** A single-key swap would silently miss the published-id path. Any future nx.json
`targetDefaults` change for this executor must touch both keys.
**Source:** 13-06-SUMMARY.md (deviation, Rule 3)

### A fixture upgrade + engine wiring in the same phase breaks an existing spec before its rewrite plan runs
13-02 upgraded `fixtures/solution-style` (app+spec leaves, two TS2322) and 13-04 wired the walk;
together they made the pre-existing `config-resolution.integration.spec.ts` solution-style block
(which asserted the old zero-rootNames short-circuit) fail. 13-04 had to rewrite that block (SC4)
immediately to keep coverage green, pre-empting 13-05's Task 2 (which then became a no-op reconcile).

**Context:** When a fixture change and the engine change that consumes it land in the same phase,
the spec that pins the OLD behavior fails at the wiring step -- plan the rewrite into the wiring
plan, not a later validation plan.
**Source:** 13-04-SUMMARY.md, 13-05-SUMMARY.md

### Distinguish vitest/esbuild transpile-noise from real lint findings via `nx lint`, not the editor
The editor TS LSP flagged `import.meta`/`node16`-extension/implicit-`any` errors across the new
`*.spec.ts` files. All were false positives (vitest transpiles specs via esbuild without full
type-check; the spec tsconfig differs from the editor view) -- `nx lint` reported 0 errors and
`nx test` was green. BUT a genuinely unused `const NG` helper WAS a real `no-unused-vars` finding.

**Context:** `nx lint`/`nx test` are authoritative here; the LSP feed is not. Do not chase LSP
transpile-noise, but do not dismiss all editor flags either -- confirm each against `nx lint`.
**Source:** 13-REVIEW.md (WR-01/WR-02), 13-VERIFICATION.md

### CI has no lint gate, so dead code persists unflagged
`.github/workflows/ci.yml` runs `typecheck-drift` + `test` but NOT `lint`. The two unused-`NG`
warnings would have shipped silently if the code review had not caught them.

**Context:** Until CI adds a lint gate, `no-unused-vars`-class issues must be caught by review.
Consider adding `nx lint` to CI (candidate for a later phase).
**Source:** 13-REVIEW.md

### Windows path resolution: key stub programs on the module's own resolve() output
The `walk-references.spec.ts` unit spec initially hardcoded POSIX leaf paths; on Windows
`resolve(solutionDir, ref.path)` yields drive-prefixed backslash paths, so 5 tests failed for a
path-fixture reason (the module was correct). Fix: compute every expected leaf path with the same
`resolve()` the module uses and force a case-sensitive/identity-realpath `ts.sys` stub.

**Context:** Pure specs that assert on resolved absolute paths must derive expectations from the
same resolver the code uses -- never hardcode POSIX separators on a Windows-primary repo.
**Source:** 13-03-SUMMARY.md (deviation, Rule 3)

### The cache-e2e harness is graph-driven, not tarball/Verdaccio-based
`angular-typechecker-cache-e2e` drives in-workspace fixture libs through the real `nx run` CLI +
project graph; it does NOT install a tarball or use Verdaccio (contrary to the plan's read_first
description). The new WALK-02 cache-bust scenario mirrored that existing graph-driven harness.

**Context:** Extend cache-e2e by adding a fixture lib + a graph-driven scenario; do not introduce a
tarball or a new e2e project.
**Source:** 13-06-SUMMARY.md

## Patterns

### File-less synthesized diagnostic (90001/90002)
Mirror `synthesizeZeroRootNamesDiagnostic`: a `ts.Diagnostic` with `file/start/length` undefined,
`category` Error, and a bare positive code chosen OUTSIDE the TS (1xxx-9xxx / TS18xxx), Angular
(negative-encoded), and 500 UNKNOWN_ERROR_CODE ranges.

**When to use:** Synthesizing an engine-level verdict (empty project, none-in-project, referenced
tsconfig not found) that must survive the file-less-keep rule and be counted by category.
**Source:** 13-03-SUMMARY.md, 13-04-SUMMARY.md

### Confine a guard split to one branch to keep sibling paths byte-unchanged
The three-way D-03a split lives entirely inside the `parsed.rootNames.length === 0` branch, so the
`rootNames > 0` direct-leaf path and the COR-01 direct-500 scan/rethrow are provably byte-unchanged
(verified by `git diff` + the untouched COR-01 pinning test).

**When to use:** Extending a hot function while a reviewer/verifier must prove existing behavior did
not regress -- scope the new branch, then assert the diff touches nothing else.
**Source:** 13-04-SUMMARY.md, 13-REVIEW.md

### RAW union into one finalize
The walk returns the RAW (pre-filter, pre-dedupe) union of per-leaf diagnostics; the single existing
`finalize` does filter + `ts.sortAndDeduplicateDiagnostics` + explicit category counts ONCE over the
union (one dedupe call, `includeDeps` applied once).

**When to use:** Aggregating diagnostics across multiple compilations -- never filter/dedupe per
source; fold everything into the one finalize so cross-Program overlap collapses correctly and the
pre-filter TCB-abort scan sees the whole union (Pitfalls 1/2, Directive 6).
**Source:** 13-03-SUMMARY.md, 13-04-SUMMARY.md

### Reuse tested containment machinery verbatim across core modules
The walk imports `createCanonicalizer`/`isUnderDir` from `filter-diagnostics.ts` rather than
re-implementing realpath/case-fold path-containment.

**When to use:** Any new core module needing path containment -- promote the existing helper's
visibility instead of duplicating the logic (a duplicate would silently diverge from the tested one).
**Source:** 13-01-SUMMARY.md, 13-SECURITY.md (T-13-01)

### Stub-program pure unit spec (no cold compiler)
`walk-references.spec.ts` builds a stub `ng` (hand-built `ParsedConfiguration` per path,
`performCompilation` returning hand-built `ts.Diagnostic[]`, `UNKNOWN_ERROR_CODE = 500`) and passes
the real `ts`, proving every walk decision (resolution, self/dup dedupe, boundary skip, 90002 synth,
zero-rootNames) with no ~30s cold-compiler run.

**When to use:** Unit-proving pure decision logic that would otherwise require a real compiler; keeps
the fast feedback loop while the integration spec covers the real-compiler proofs.
**Source:** 13-03-SUMMARY.md

### Worktree-parallel wave with node_modules junction + link-only teardown
For a multi-plan disjoint wave: spawn one worktree executor per plan (staggered to avoid
`.git/config.lock` races), each creating a `node_modules` junction into the main checkout as its
first action, running Nx with `NX_DAEMON=false --skip-nx-cache`. Teardown: merge branches, delete
each junction LINK-ONLY (`Directory.Delete(path, recursive=false)` / `cmd rmdir`) BEFORE
`git worktree remove`, then verify the main `node_modules` count is unchanged.

**When to use:** Parallelizing 2+ disjoint plans on a Windows dev-drive repo where the GSD worktree
cleanup's `git worktree remove --force` would otherwise follow the junction and wipe main deps.
**Source:** 13 execution (orchestrator), AGENTS.md

## Surprises

### The nx.json executor default appears under two keys
`targetDefaults` carried both the dev-workspace executor id and the published-package executor id as
separate keys for the same executor -- the plan (and a naive swap) assumed one.

**Impact:** Required editing both keys and asserting both in the manifest spec; a one-key edit would
have left the published-id path on the stale `production` input.
**Source:** 13-06-SUMMARY.md

### 13-05 Task 2 produced no commit (pre-empted by 13-04)
Because 13-04's necessary SC4 rewrite already put the config-resolution block in its walk-asserting
form, 13-05's "rewrite the solution-style block" task became a verify-only reconcile with zero source
change -- the plan artifact was "provided" by the base, not by 13-05.

**Impact:** A plan's `must_haves.artifacts` was satisfied by a prior plan's deviation; surfaced to the
verifier so it did not read the empty diff as missing work.
**Source:** 13-05-SUMMARY.md

### A stock-Nx emoji in README broke the ASCII gate
README line 5 carried a stock Nx-generated non-ASCII glyph that failed 13-06 Task 3's ASCII gate (and
the repo's ASCII-only rule); it was replaced with ASCII.

**Impact:** Pre-existing generated content violated a repo invariant only caught when a new gate ran
over the file -- worth an ASCII sweep of other generated docs.
**Source:** 13-06-SUMMARY.md

### Fixture types-array inconsistency across spec leaves
`fixtures/solution-style/tsconfig.spec.json` uses `["vitest/globals","node"]` while the sibling spec
fixtures use `[]`. Both compile and prove their point, so it is cosmetic, but the inconsistency was
unintended.

**Impact:** Info-only (code review IN-03); no behavior/verdict effect. A future fixture cleanup could
normalize the `types` arrays.
**Source:** 13-REVIEW.md
