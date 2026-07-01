---
phase: 02
phase_name: 'core-type-check-engine-gatherer'
project: 'angular-typechecker'
generated: '2026-06-27'
counts:
  decisions: 6
  lessons: 6
  patterns: 5
  surprises: 3
missing_artifacts:
  - '02-*-UAT.md'
---

# Phase 02 Learnings: core-type-check-engine-gatherer

## Decisions

### CoreResult contract drops public `codes`, adds `tsConfigPath` + `rootNamesCount`, counts by category

The locked `CoreResult` exposes `tsConfigPath`, `rootNamesCount`, `diagnostics`, `errorCount`, `warningCount`, `durationMs` only. `errorCount` is `category === Error` and `warningCount` is `category === Warning` (explicit), never `length - errorCount`. Specs derive codes locally from `diagnostics.map(d => d.code)`.

**Rationale:** Fixes MD-02 (the count conflation that let Suggestion/Message hide as warnings or mask errors) and makes the contract the single load-bearing surface every downstream slice and Phase 3/4 consume.
**Source:** 02-01-PLAN.md, 02-01-SUMMARY.md

### Malformed/unreadable config is never a silent clean (D-03 prepend of `parsed.errors`)

After `ng.readConfiguration`, `[...parsed.errors]` is prepended to the final diagnostics on both return paths, so a malformed or unresolvable tsconfig surfaces as a returned Error diagnostic (errorCount >= 1) instead of "0 files / 0 errors / success".

**Rationale:** Closes MD-01, the "type-checker that LIES" failure mode where the Phase-1 seed dropped config errors entirely.
**Source:** 02-01-PLAN.md, 02-02-SUMMARY.md, 02-VERIFICATION.md

### Zero-rootNames guard synthesizes one Error with a private code (90001) naming leaf tsconfigs

When `parsed.rootNames.length === 0` (solution-style / references-only tsconfig), the engine short-circuits before `performCompilation` and synthesizes a single category-Error diagnostic (code `90001`, outside the TS and Angular `-99xxxx`/`500` ranges) whose message literally names `tsconfig.app.json` / `tsconfig.lib.json` / `tsconfig.spec.json`. Gating is on `rootNames.length === 0`, NEVER on TS18003 (which is suppressed when `references` is present).

**Rationale:** A references-only config that yields "0 files / 0 errors" is the silent-lie input; the guard returns a deterministic non-zero signal (rootNamesCount 0 + errorCount 1) with an actionable message (D-03a / L-2).
**Source:** 02-01-PLAN.md, 02-02-SUMMARY.md

### Infrastructure failures detected by `code === 500` only, then re-thrown

A returned `UNKNOWN_ERROR_CODE` (500) is detected purely by code and re-thrown as `TypecheckInfrastructureError` (exported from `index.ts` for the Phase-4 executor to catch). No `source === 'angular'` clause. A normal type error (e.g. code 2322) is counted, not thrown.

**Rationale:** A masked ESM-load or internal compiler crash must never be reported as "0 or 1 type errors". The auditor confirmed TypeScript defines zero diagnostics with code 500, so the check cannot collide with a real code (D-06 / V-3 / L-3).
**Source:** 02-01-PLAN.md, 02-VERIFICATION.md, 02-SECURITY.md

### Full D-05 emit-neutralizing override, keeping BOTH `noEmit: true` and `emitFlags: 0`

A fresh per-call options object spreads `...parsed.options` then clears every emit-coupled option (`composite: false`, `declaration`/`declarationMap`/`emitDeclarationOnly: false`, `incremental: false`, `tsBuildInfoFile`/`declarationDir`/source-map fields undefined) plus `diagnostics: false`, and keeps `emitFlags: 0` alongside `noEmit: true`.

**Rationale:** Without it, a composite/solution base throws a spurious TS5053/6304/6379 (a false FAIL, the inverse lie). Both `noEmit` and `emitFlags: 0` are load-bearing, not redundant (V-2). `diagnostics: false` suppresses the category-Message "Time for diagnostics" for deterministic agent-ready output (D-02).
**Source:** 02-01-PLAN.md, 02-03-SUMMARY.md

### Parallel Wave-2 execution gated on disjoint `files_modified`

02-02 (config-resolution fixtures + spec) and 02-03 (catalog fixtures + diagnostic-codes.ts + integration specs) ran as concurrent worktree agents because their declared `files_modified` sets share no file; 02-01's `tsconfig.lib.json` exclude of `fixtures/**` was the enabler so both slices were purely additive.

**Rationale:** Disjoint file ownership lets the merge-back run conflict-free (02-02 fast-forward, 02-03 a clean `--no-ff` over the same base), so parallelism costs nothing in merge risk.
**Source:** 02-01-PLAN.md (Task 3), 02-02-SUMMARY.md, 02-03-SUMMARY.md

---

## Lessons

### TypeScript LSP diagnostics are near-useless inside executor worktrees

The `new-diagnostics` feed reported "Cannot find module", "import.meta not allowed in CommonJS", and extensionless-import errors against spec files, and kept emitting them against the worktree path AFTER the worktree was removed. Every one was a false positive: `npx nx build` and `npx nx test` were green throughout.

**Context:** Spec files are compiled by the test tsconfig (Vitest/esbuild), not the lib tsconfig the LSP reads them under; stale LSP entries also pointed at already-deleted `.claude/worktrees/` paths. The authoritative signal is the runner, confirmed by re-running build+test on the merged main tree.
**Source:** execution new-diagnostics reminders, 02-VERIFICATION.md

### Claude Code worktrees have no `node_modules`; a directory junction to the main install is the workaround

All three executors independently found their fresh worktree lacked `node_modules` and could not resolve the toolchain or the deep `compiler-cli-types.ts` import. Each created a read-only Windows directory junction at the worktree root pointing at the main repo's locked install, gitignored and non-destructive; `git worktree remove --force` is safe (junctions are removed without following into the target).

**Context:** Worktrees branch from local HEAD (`worktree.baseRef: head` is set) but do not copy or symlink the gitignored `node_modules`. Without the junction the build/test gate cannot run inside the worktree.
**Source:** 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md

### The `fixtures/**` excludes in `tsconfig.lib.json` are dead weight

Plan 02-01 Task 3 added `fixtures/**/*` to the lib tsconfig `exclude` believing it was needed to keep broken fixtures out of the published package. Code review found the excludes resolve relative to the project root (`packages/angular-typechecker/`), where no `fixtures/` dir exists — the real guard keeping fixtures out is `include: ["src/**/*.ts"]`. Several fixtures also carry false comments claiming they are "excluded via fixtures/\*_/_".

**Context:** No fixture leaks to `dist` (build verified), so this is a quality/maintainability defect (REVIEW WR-01), not a correctness one — but the mental model that drove the change was wrong.
**Source:** 02-REVIEW.md (WR-01)

### `durationMs` under-reports cold-start cost

`durationMs` is labeled "cold-run wall-clock" but the `performance.now()` start is captured AFTER the ESM `@angular/compiler-cli` load and config parse, so the dominant cold-start costs are excluded.

**Context:** Metric semantics, not count correctness (REVIEW WR-02). Matters if the timing is ever used as a perf budget or compared against `ngc` cold-runs.
**Source:** 02-REVIEW.md (WR-02)

### Plan-time STRIDE registers made the security audit a fast verification, not a discovery

All three plans carried `<threat_model>` blocks (16 rows, 13 unique after dedup of T-02-SC). Because `register_authored_at_plan_time` was true, secure-phase verified each mitigation against actual source lines rather than reconstructing a register, and closed 13/13 with zero open threats.

**Context:** Authoring the threat register during planning (not retroactively) keeps the audit in verify-mode and avoids the retroactive-STRIDE path entirely.
**Source:** 02-01/02-02/02-03-PLAN.md threat models, 02-SECURITY.md

### Isolated per-slice test counts are stale once merged; only the post-merge suite count is real

02-02 reported 32/32 and 02-03 reported 34/34, each measured in isolation on top of 02-01. The true merged total is 39/39 across 12 files. The verifier flagged 02-03's "34/34 across 11 files" as a stale snapshot.

**Context:** Each worktree sees only 02-01 + its own additions; the post-merge build & test gate on main is the only count that reflects the integrated phase.
**Source:** 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-VERIFICATION.md

---

## Patterns

### `NG()` negative-encoding helper for asserting extended diagnostics

A dependency-free `NG = (code) => -990000 - code` (and inverse `ngCodeOf`) encodes Angular extended-diagnostic codes the way the compiler stores them on `ts.Diagnostic.code` (NG8109 === -998109). Specs assert via `NG(8109)`, never a bare negative literal.

**When to use:** Any assertion against Angular template / extended (NG8xxx) diagnostics, where the code is stored negative. Reused across all per-version integration specs.
**Source:** 02-03-SUMMARY.md, diagnostic-codes.ts

### Per-introduction-version integration spec naming (`*.angularNN.integration.spec.ts`)

Catalog fixtures are organized by the Angular major that introduced each check, and specs are named `baseline.angular13`, `extended.angular13`, `extended.angular17`, asserting exact codes and exact counts on Angular 22.

**When to use:** Building a diagnostic catalog that spans multiple framework versions; the filename documents provenance and keeps additive growth obvious.
**Source:** 02-03-PLAN.md, 02-03-SUMMARY.md, 02-VALIDATION.md

### Single focused stub for the infra-failure path; broad mocking deferred

D-06 is proven with one focused stub of the loaded namespace's `performCompilation` returning a code-500 diagnostic, plus a contrasting code-2322 case that does NOT throw. This is the only justified Phase-2 mock; broad mocking is Phase-3 TEST-01.

**When to use:** Proving a re-throw / error-classification branch without standing up a full mock harness — stub exactly the seam under test and add a negative-control case.
**Source:** 02-01-PLAN.md (Task 2), 02-RESEARCH.md Open Q2, infra-failure.spec.ts

### `describe.each` over app + lib tsconfig variants

The real-compiler integration proofs run the same assertions across both the app and lib tsconfig of a fixture via `describe.each`, proving project-type independence in one spec.

**When to use:** When a behavior must hold identically across application and library project types (a core value of the tool).
**Source:** 02-01-PLAN.md (Task 2), 02-01-SUMMARY.md

### Sequential worktree dispatch, parallel execution (avoid `.git/config.lock` race)

For a 2+ agent wave, dispatch each worktree `Agent()` in its own message (confirm the first worktree exists before spawning the second) rather than firing both at once; simultaneous `git worktree add` calls race on `.git/config.lock` on Windows. Agents still run concurrently once created.

**When to use:** Any parallel worktree-isolated wave, especially on Windows. Pair with a fresh `EXPECTED_BASE` captured after the prior wave's merge.
**Source:** execute-phase wave execution (Wave 2 dispatch)

---

## Surprises

### `extended.angular17.integration.spec.ts` contains no v17-specific code

The spec named for Angular 17 reuses the v13 NG8101 default-Warning-vs-promoted-Error case; there is no `extended-v17` fixture and no v17-introduced code.

**Impact:** The per-version filename convention implies coverage that is not version-distinct (REVIEW IN-01); a real v17+ check would need a new fixture. Documented decision, additive to fix later.
**Source:** 02-REVIEW.md (IN-01), 02-VERIFICATION.md

### Two inert `@ts-nocheck` comments survived in fixtures despite "no @ts-nocheck" claims

The verifier found `@ts-nocheck` text in `fixtures/gate-b-error/error.component.ts` and `fixtures/config-broken/error.component.ts` — the wrapped tail of a "Do NOT add @ts-nocheck" comment placed AFTER the import, so TypeScript does not apply it (the fixtures' planted errors still surface, confirmed empirically). The 02-02/02-03 SUMMARYs claimed no `@ts-nocheck` exists.

**Impact:** None functionally (the comments are non-functional), but it is a SUMMARY-vs-reality mismatch worth knowing if fixture comments are ever reformatted onto their own line.
**Source:** 02-VERIFICATION.md

### Both audits and verification came back clean on the first pass

verify_phase_goal (4/4 criteria, 13/13 truths, 5/5 requirements), secure-phase (13/13 threats closed), and validate-phase (12/12 rows covered, 0 gaps to fill) all passed without a gap-closure loop, and code review found 0 critical/0 warning correctness issues.

**Impact:** No replanning cycle was needed; the only follow-ups are advisory quality items (dead excludes, mislabeled metric, misnamed spec) safe to defer.
**Source:** 02-VERIFICATION.md, 02-SECURITY.md, 02-VALIDATION.md, 02-REVIEW.md
