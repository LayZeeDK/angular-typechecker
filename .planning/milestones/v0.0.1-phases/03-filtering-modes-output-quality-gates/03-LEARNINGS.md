---
phase: 3
phase_name: "filtering-modes-output-quality-gates"
project: "angular-typechecker"
generated: "2026-06-28"
counts:
  decisions: 7
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "*-UAT.md (no human verification items; verifier returned passed)"
---

# Phase 3 Learnings: filtering-modes-output-quality-gates

## Decisions

### Pure, dependency-free core functions tested with plain literals (D-01/D-13)
The three slices (`filterDiagnostics`, `evaluateResult`, `formatReport`) are pure functions that take only data (or an injected `Pick<>` of the compiler surface), so unit tests use 2-field count literals and synthetic diagnostics with no compiler mock.

**Rationale:** The Phase-2 hybrid split (counts bucketed by `ts.DiagnosticCategory` upstream) pays off here: the verdict/filter/format layers never touch the real compiler, making them fast and trivially testable. Avoids the prior-art landmine of "testable only through full `ExecutorContext` fakes."
**Source:** 03-02-SUMMARY.md, 03-03-SUMMARY.md

### Boundary filter classifies on realpath-normalized fileName, by path segment (D-06)
`node_modules` is excluded by a path-SEGMENT test (`split('/').includes`), containment uses a segment-bounded prefix (`dir + '/'`), and realpath runs BEFORE case-fold.

**Rationale:** Defeats three naive-filter landmines at once: `toLowerCase()` + bare `startsWith` + `includes('node_modules')` breaks on pnpm symlinks, case-sensitive Linux CI, and the `node_modules-tools` sibling-dir false match.
**Source:** 03-01-PLAN.md, filter-diagnostics.ts

### basePath = leaf tsconfig basePath, NEVER parsed.options.rootDir
The in-project baseline is the directory `readConfiguration` injects, not `rootDir`.

**Rationale:** In a `--preset=apps` workspace `rootDir` is the workspace root, which would mark every file in-project and silently defeat the filter.
**Source:** run-typecheck.ts (D-05/D-06)

### Diagnostics sorted + deduped unconditionally in finalize (D-09)
`ts.sortAndDeduplicateDiagnostics` runs on every path, including the zero-rootNames guard path.

**Rationale:** Deterministic report order (alphabetical by file, file-less first) on every path; removes accidental cross-phase duplicates from the unconditional all-getter. (Made unconditional as IN-01/IN-05 review follow-up.)
**Source:** run-typecheck.ts, 03-REVIEW.md

### Deterministic FormatDiagnosticsHost: absolute paths + forced newline (D-04/D-08/D-10)
Absolute paths by default (relativized only when `pathBase` is set), `getNewLine: () => '\n'`, TTY-gated ANSI stripping, fail-fast truncation at the reporter layer (NOT a gather short-circuit).

**Rationale:** Non-determinism (cwd-relative paths, `\r\n`) is the OUT-03 idempotency threat; pinning the host makes output byte-identical on repeat.
**Source:** 03-03-SUMMARY.md, format-report.ts

### ESLint core/** import ban includes type-only imports; dependency-checks untouched (D-11/D-12)
`@typescript-eslint/no-restricted-imports` bans nx/@nx/devkit/@angular-devkit + yargs with `allowTypeImports` OMITTED, plus `no-console` and a `process.exit` ban. `@nx/dependency-checks` left as-is.

**Rationale:** A type-only `import type { ExecutorContext }` would still fuse the engine to the adapter; banning type imports keeps core/ truly framework-agnostic. dependency-checks is orthogonal — it WANTS core+adapter in one project so the adapter's devkit import is a declared dependency.
**Source:** 03-04-SUMMARY.md, eslint.config.mjs

### Run the dependency-heavy final wave sequentially on the main tree, not a worktree
03-04 (the WS-04 lint-gate owner) ran as a sequential executor on the main checkout instead of an isolated worktree.

**Rationale:** A single-plan wave gains no parallelism from isolation, and the main tree has the real `node_modules` so the lint/build/test gates run for real with zero provisioning and no junction/realpath nuance.
**Source:** orchestration (this session)

---

## Lessons

### Worktrees start with NO node_modules; executors must self-provision
Claude Code worktrees branch from a clean tree; `node_modules` is gitignored so it is absent. Executors that need build/lint/test must provision it (a gitignored directory junction to the main repo's `node_modules`, the established pattern since 02-03).

**Context:** 03-01 and 03-03 junctioned and verified fully (build + 50-74 tests + lint); 03-02 did NOT and deferred its build/GATE-A gate. Same situation, two different choices — a consistency gap, not a capability gap. The merged-repo post-merge gate is the authoritative backstop either way.
**Source:** 03-01/03-02/03-03 SUMMARY.md, orchestration

### The `?? ''` sentinel silently disables the boundary filter (WR-01)
`basePath: parsed.options.basePath ?? ''` — on the defensive path where basePath is undefined, the empty-string base makes `isUnderDir` treat `'' + '/'` as `/`, matching every absolute path on POSIX and disabling the filter. `??` also does not catch an empty string.

**Context:** Found by deep code review, not by tests (no test exercised the undefined-basePath path). Fixed with `resolveFilterBasePath` falling back to `dirname(tsConfigPath)` and guarding both `undefined` and `''`, plus a regression spec.
**Source:** 03-REVIEW.md (WR-01), run-typecheck.spec.ts

### The compiler-cli-types.ts deep-import shim trips enforce-module-boundaries
The nodenext deep-import shim (`../../../../node_modules/@angular/compiler-cli/...`) produces 2 `@nx/enforce-module-boundaries` errors; the "lint passes clean" gate (WS-04) owner had to resolve them.

**Context:** Resolved in 03-04 via two targeted `eslint-disable-next-line` directives (chosen over widening the root allow-regex, so enforcement stays intact elsewhere). The underlying shim fragility is tracked in STATE.md [01-03 CAVEAT].
**Source:** deferred-items.md, 03-04-SUMMARY.md

### A node_modules junction realpath-resolves OUTSIDE the worktree, but did not distort the filter tests
The junction makes a dependency file realpath to `<main>/node_modules/...` (outside the worktree project root).

**Context:** This was the one case feared to affect the realpath-based boundary filter, but 03-01's sibling-import fixture tests (real Angular 22 compiler) passed under the junction — the "exclude node_modules / out-of-project" behavior is exactly what the junction's out-of-root resolution yields.
**Source:** 03-01-SUMMARY.md, orchestration

### Parallel worktrees collide only on append-only planning logs
The three Wave-1 branches touched fully disjoint source files; the ONLY merge conflict was `deferred-items.md` (absent at base, created independently by all three: add/add).

**Context:** SUMMARY files are per-plan distinct (no conflict). Planning the wave with disjoint `files_modified` paid off — code merged cleanly.
**Source:** orchestration (wave-1 merge)

---

## Patterns

### Injected-compiler-surface pure functions
Pass the compiler-cli/ts surface as an injected `Pick<>` parameter (e.g. `formatReport(diagnostics, ng, ts, opts)`) rather than importing it.

**When to use:** Any function that needs a tiny slice of a heavy/ESM-only dependency but must stay unit-testable and pure. Enables fakes without a module mock.
**Source:** 03-03-SUMMARY.md

### Negative-control verification of enforcement rules
Prove a lint/boundary rule is LIVE (not dead config) by temporarily introducing a violation and asserting it errors + non-zero exit, then cleaning up.

**When to use:** Whenever a quality gate's value depends on it actually firing (import bans, module boundaries). The verifier dropped a temp type-only `@nx/devkit` import into core/ and confirmed 2 errors.
**Source:** 03-VERIFICATION.md

### Union-merge for append-only planning logs across parallel worktrees
Resolve add/add conflicts on append-only bookkeeping files (deferred-items.md) by unioning both sides into one document, deduping overlapping observations.

**When to use:** Merging parallel worktree branches that each append to a shared phase log. Reaching for `-X ours/theirs` would drop one branch's entries.
**Source:** orchestration (wave-1 merge)

### Junction-safe worktree teardown on Windows
Before `git worktree remove`, delete any `node_modules` directory junction link-only (`[System.IO.Directory]::Delete(path, false)` / `cmd rmdir` without `/s`); verify the main `node_modules` entry count is unchanged.

**When to use:** Cleaning up Windows worktrees that contain junctions to a shared directory — a naive recursive delete that follows the junction would wipe the target (the main repo's deps).
**Source:** orchestration (wave-1 cleanup)

### Post-merge gate in the main checkout as the authoritative verification
Run the full build + test (+ lint) on the MERGED result in the main checkout (which has real node_modules), regardless of per-executor in-worktree self-checks.

**When to use:** Any parallel-worktree wave — catches cross-plan integration issues that isolated self-checks cannot, and covers any executor that deferred its in-worktree gate.
**Source:** orchestration (post-merge gate)

---

## Surprises

### A defensive default was the "worst possible" value
WR-01's `?? ''` is a defensive fallback that, far from being safe, silently disables the product's core value (boundary filtering). The safe-looking sentinel was the bug.

**Impact:** One-line fix + regression test; reinforced that defensive paths need their own tests, not just the happy path.
**Source:** 03-REVIEW.md

### ROADMAP goal text implied more than the phase scoped
The goal mentions `--max-warnings`, report-all/fail-fast "modes", and exit behavior — which read as user-facing CLI wiring, but Phase 3 only delivers the composable CORE (the CLI parse, `{success}`->exit, `pathBase`<-`context.root` are Phase-4).

**Impact:** The verifier explicitly traced each implied-but-deferred behavior to Phase 4 and recorded them as Deferred Items (not gaps), avoiding a false "gaps_found".
**Source:** 03-VERIFICATION.md

### mode: mvp on an engineering-deliverable goal
ROADMAP declares `mode: mvp`, but the phase goal is an engineering statement, not an "As a... I want..." user story (`user-story.validate` returned false).

**Impact:** The verifier followed the Phase-1/2 precedent — verified goal-backward against the 5 explicit success criteria + 20 plan must-haves with a documented `mode_note`, rather than refusing under the MVP user-story guard.
**Source:** 03-VERIFICATION.md

### All plan-time threats closed with zero auditor work
Every threat in the 4 plans' threat models was either a verified `mitigate` or a documented `accept`; the deep code review had already independently cleared the scary ones (ReDoS, realpath crash, count integrity).

**Impact:** secure-phase short-circuited (threats_open: 0, plan-time register) without spawning the security auditor — the mitigations were confirmed present by direct code inspection + the existing review/verification evidence.
**Source:** 03-SECURITY.md, 03-REVIEW.md
