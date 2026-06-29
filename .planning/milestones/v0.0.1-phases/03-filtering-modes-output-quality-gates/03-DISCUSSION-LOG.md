# Phase 3: Filtering, Modes, Output + Quality Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 3-Filtering, Modes, Output + Quality Gates
**Areas discussed:** Core composition & API, Fail-fast semantics, Project-boundary + path base, Boundary enforcement, Output ordering & color, includeDeps/skipLibCheck

**Method:** `--analyze` mode with research-before-questions. Seven parallel research passes grounded every option in source: four against the authoritative clones (`@angular/compiler-cli`, `@angular/build`, `nrwl/nx`, the published reference plugins) + project docs; three complementary (the public Angular-18.2 sandbox prototype; a set of older private prior-art prototypes treated as inspiration only and read under a fail-closed sanitization protocol; and an external docs/article/community sweep). Net: no recommendation reversed. The user steered the output decisions by asking what `tsc`, `ngc`, and -- decisively -- `@angular/build` actually emit.

---

## Core composition & API -- CoreResult shape

| Option | Description | Selected |
|--------|-------------|----------|
| Filtered + `suppressedCount` scalar | `diagnostics` = in-project only; post-filter counts; scalar count of excluded out-of-project/node_modules; `includeDeps` folds back in | YES |
| Fully categorized (`inProject[]` + `outOfProject[]`) | Keep both arrays so the verdict can enumerate ignored dependency errors | |
| Flat filtered only | In-project diagnostics + counts, no record of what was hidden | |

**User's choice:** Filtered + `suppressedCount` (asked for a recommendation grounded in the project's purpose + scale).
**Notes:** Decided on the execution model -- the executor is per-project and Nx-cacheable, so each run is bounded by one project and the workspace scales via Nx orchestration across hundreds of independent runs. Re-enumerating a dependency's diagnostics across every consumer target is redundant (each dependency has its own target) and noisy; the scalar keeps the report honest without holding a redundant array on hundreds of runs. Hybrid composition (filter inside `runTypecheck`; verdict + formatter as pure edge functions) was confirmed by `@angular/build`, tsc internals, svelte-check, and vue-tsc, and is the only shape giving TEST-01 pure-function testability without mocking compiler-cli.

---

## Fail-fast semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Reporting-only | Always run the full all-getter; fail-fast truncates the reported list at the first error; no `failFast` flag on `runTypecheck` | YES |
| Short-circuiting gatherer | Stop at the first getter that errors (the literal ARCHITECTURE.md:240 reading) | |
| Getter-ordering + stop at first Error | Reorder getters, bail at first error-category | |

**User's choice:** Reporting-only (accepted recommendation).
**Notes:** Grounded in the compiler source -- `NgtscProgram` construction is setup-only; the cost is lazy inside the getters, so skipping getters is the only way to be "faster," and that is exactly the `ngc` short-circuit that suppresses template/extended diagnostics. Real-world validated: a reviewed prototype shipped that short-circuit and silently dropped all NG8xxx diagnostics behind one TS error. Brandon Roberts' article + peer tools (tsc/svelte-check report-all) confirm report-all is the contract and fail-fast is output brevity, not a speed-up.

---

## Quiet / errors-only output mode (scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to later milestone | Keep v0.0.1 to the three locked modes; record as deferred | YES |
| Add now (NG8xxx-safe) | Add an errors-only mode, gating suppression on code/source so NG8xxx is never hidden | |

**User's choice:** Defer (accepted recommendation).
**Notes:** Surfaced by a prior-art prototype that added a `quiet` mode fusing severity filtering into the boundary predicate; not in the locked requirements, and the naive form suppresses NG8xxx (warning-severity), killing the differentiator.

---

## Project-boundary + path base

**Decisions (no competing user-facing options -- mechanism locked by OUT-02; baseline + path-base were the open sub-questions):**
- In-project baseline = leaf-tsconfig `basePath` directory prefix (NOT `rootDir`, which Angular's lib/app templates leave unset -- Nx generator tests assert it absent), realpath + `getCanonicalFileName` normalized, `node_modules` excluded by path-segment (not substring).
- CI-relative paths via optional `pathBase` CoreOption consumed only by the formatter; default absolute (not cwd) when unset; adapter fills from `context.root`.

**Notes:** Confirmed by GitHub Actions problem-matcher path expectations (`$GITHUB_WORKSPACE`) and Nx's `{projectRoot}`/`{workspaceRoot}` model. Reviewed prototypes all used naive `toLowerCase()`+`startsWith`/substring filtering -- the realpath/canonical + path-segment approach is the hardening. Watch-item flagged for the planner: the `rootDir` -> TS6059 trap.

### includeDeps vs skipLibCheck

| Option | Description | Selected |
|--------|-------------|----------|
| Two orthogonal controls | `includeDeps` governs our boundary filter; `skipLibCheck` (honored verbatim) governs node_modules .d.ts depth | YES |
| Single conflated control | includeDeps re-includes everything including node_modules typings unconditionally | |

**User's choice:** Orthogonal (accepted recommendation).

---

## Output ordering & color

**Triggered by the user's questions:** "What do the Angular and TypeScript compilers output?" then "What does `@angular/build` do? This is what end-users are most used to consuming."

**Findings (from source):** `tsc --noEmit` emits one globally sorted + de-duplicated list (file -> pos -> code). `ngc` `formatDiagnostics` emits phase-grouped, unsorted, un-deduped, ALWAYS color. `@angular/build` emits per-file-grouped (a file's TS + template diagnostics adjacent) in source order, splits errors/warnings, renders via esbuild with TTY-gated color. Triangulation: users expect file-grouped output + TTY-gated color; ngc's phase-grouped always-color order is the outlier on both axes.

| Sub-decision | Options | Selected |
|--------------|---------|----------|
| 5a Ordering | (i) file-grouped via `ts.sortAndDeduplicateDiagnostics` + dedup, single stream, deterministic alphabetical / (ii) preserve ngc phase order | (i) |
| 5b Color | (i) TTY-gated, plain for non-TTY (CI/agents) / (ii) always color (ngc parity) | (i) |

**User's choice:** Accept 5a + 5b.
**Notes:** Correction recorded -- compiler-cli `formatDiagnostics` calls `formatDiagnosticsWithColorAndContext` unconditionally (always color), so color is a real OUT-03 decision (earlier claimed resolved). Net output design: `@angular/build`-grade file grouping + ngc-grade rendering (NG codes/codeframes, OUT-01) + tsc-grade determinism, dedup, and TTY-gated color. Dedup is a correctness safety net specific to our unconditional all-getter. TS clone deemed unnecessary -- grounded against the pinned installed `typescript@6.0.3`.

---

## Boundary enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Specifier ban only | `@typescript-eslint/no-restricted-imports` on `src/core/**` banning @nx/devkit/nx/@angular-devkit/architect/yargs (incl. type-only) | YES |
| Also add directory-zone rule | Additionally `import/no-restricted-paths` to forbid core/ importing the adapter directory | |

**User's choice:** Specifier ban only (accepted recommendation).
**Notes:** Nx docs confirm `@nx/enforce-module-boundaries` is project/tag-granular and "cannot restrict imports between folders inside the same project" -- so it can't enforce the intra-package core/ ban without splitting core into a second Nx project (contradicts the single-package design). `@nx/dependency-checks` already wired and orthogonal. Also forbid `process.exit`/`console` in core to keep verdict/format pure.

## Claude's Discretion
- Exact option/module/file names; ANSI-strip mechanism; fail-fast truncation footer; first-error ordering; mock strategy (`vi.mock` vs DI).
- Scale impl: memoize canonicalized directory paths in the boundary filter.
- Verify the no-emit override neutralizes the `rootDir` -> TS6059 trap; add a fixture if it can fire.

## Deferred Ideas
- Quiet/errors-only mode (NG8xxx-safe gating if ever added).
- Errors/warnings split + structured per-diagnostic category -> JSON/SARIF reporter (REP-01).
- `outOfProject[]` enumeration in CoreResult (0.x widening if a reporter needs it).
- `import/no-restricted-paths` directory-zone rule (only if internal coupling appears).
- Executor adapter / cacheable target / exit-code mapping -> Phase 4.
- Buildable + publishable lib fixtures, 5-project-type matrix, pnpm/mixed-case assertions -> Phase 6.
- `NgtscProgram` per-file incremental + `--watch` -> deferred milestone (REP-02).
