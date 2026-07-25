---
phase: 34-per-project-sarif-categories-in-ci
verified: 2026-07-21T17:15:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "MULTI-01 end-to-end: GitHub Code Scanning ACCEPTS the merged multi-run file and lands N distinct `angular-typecheck/<project>` analyses"
    addressed_in: "Phase 35"
    evidence: "REQUIREMENTS.md PROOF-01: 'A CI check emits one known diagnostic per family from an ISOLATED fixture ... and asserts via the gh CLI (code-scanning/analyses + code-scanning/alerts) that each expected alert lands in Code Scanning with the expected category, tags, and severity.' PROOF-02 requires the check to fail loudly on any missing alert/category/tag. The plan's own `real_ci_only` frontmatter section states: 'This plan WIRES it correctly; Phase 35 (PROOF) automates the gh api assertion. Do NOT gate this plan on a locally-green upload check.' Code Scanning ingestion is async/server-side and not locally provable; local schema-validate + actionlint + act-compat can pass while GitHub still rejects a class of upload, so only a real CI run (Phase 35's automated proof) can confirm the landing."
---

# Phase 34: Per-project SARIF categories in CI Verification Report

**Phase Goal:** angular-typechecker's CI SARIF upload reports one Code Scanning analysis per workspace project that uses the `angular-typechecker:typecheck` executor -- auto-discovered so the set cannot silently drift -- with zero change to the published package (the reporter stays single-run per invocation; the multi-run merge is assembled CI-side).
**Verified:** 2026-07-21T17:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MULTI-01/SC1 (local): code-scanning job assembles ONE merged multi-run SARIF via `merge-sarif.mjs`, each run stamped `automationDetails.id = angular-typecheck/<project>`, uploaded with a single `upload-sarif` and NO `category` input | VERIFIED | Ran `node tools/ci/merge-sarif.mjs` after a real `nx build angular-typechecker`: produced a 4-run `angular-typechecker.sarif` with ids `angular-typecheck/{ng-spike-app,typecheck-consumer,typecheck-consumer-dep,typecheck-walk-consumer}`, `version: "2.1.0"`, `$schema` present. `git grep` confirms the `Upload angular-typechecker SARIF` step's `with:` block contains only `sarif_file:` -- no `category:` key anywhere except explanatory comments. |
| 2 | MULTI-02/SC2: reported project set is discovered by filtering the `angular-typechecker:typecheck` EXECUTOR id (never a target-name match), root-scoped to `apps/`+`libs/`, yielding exactly the four consumers | VERIFIED | Ran `node tools/ci/list-typecheck-projects.mjs`: printed exactly `[{name:"ng-spike-app",tsConfig:["apps/ng-spike-app/tsconfig.app.json"]}, {name:"typecheck-consumer",...}, {name:"typecheck-consumer-dep",...}, {name:"typecheck-walk-consumer",...}]` -- matches the plan's exact expected tsConfig leaves (coverage not reduced vs the old hardcoded step). Source confirms the filter is `candidate?.executor === EXECUTOR` via `.filter()` (post-review-fix: unions every matching target, not just the first -- see truth 7 below), never a target-NAME or string-grep match. |
| 3 | MULTI-02/D-01b: the workspace-root `@angular-typechecker/source` project and `e2e/*/fixtures/` project.json files -- both of which carry the real executor -- are absent from the discovery output by root-scoping construction | VERIFIED | `git grep -n "angular-typechecker:typecheck" project.json` confirms the root project DOES declare the executor (on `fixtures/tsconfig.clean.json`), yet it is absent from the actual discovery output above -- proving the apps/+libs/ root-scoping exclusion is real, not just documented. `rg -uu` under `e2e/` found 8+ files carrying the executor literal (fixture project.json files + generator schema.json/test files), none of which appear in the discovery output. |
| 4 | MULTI-02/SC3: an in-plugin drift-guard spec fails loud if the discovery script's output diverges from an independent root-agnostic enumeration (mirrors GUARD-01b); non-vacuous | VERIFIED | `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` exists; its `independentTypecheckProjects()` parses `targets.*.executor` (never string-greps) and subtracts exactly `rel === 'project.json'` and `rel.startsWith('e2e/')` -- the two load-bearing exclusions. Re-ran `npx nx test angular-typechecker --skip-nx-cache -- --reporter=verbose` and confirmed all 3 tests in this file pass, including the non-vacuous `expect(independent.length).toBeGreaterThan(0)` assertion BEFORE the `toEqual` equality check, and the WR-01 regression test (multi-target tsConfig union). |
| 5 | MULTI-01/D-02/D-03: `merge-sarif.mjs` writes ONE file with one run per non-empty project, envelope `{version,$schema}` preserved from the first valid run, and writes NOTHING when zero runs are collected | VERIFIED | `packages/angular-typechecker/src/merge-sarif.spec.ts` drives the real script as a subprocess against a hermetic temp workspace + stub CLI. Re-ran both tests: (a) 2-run merge with exact ids + envelope preserved + `proj-empty` skipped, PASS; (b) all-empty-stdout scenario asserts `existsSync(...) === false` -- no file written on zero collected runs, PASS. This is a genuine behavioral proof (state-transition: file-write vs. no-write), not just source presence. |
| 6 | D-05: `ci.yml` code-scanning job preserves every existing security/structural invariant verbatim (fallow steps, fork-PR skip gate, job-scoped `security-events: write`, `fetch-depth: 0`, SHA-pinned `upload-sarif`, path-gated `if:`, the restored `\|\| true` shell tolerance) and stays OUT of the required `ci` aggregate `needs[]` | VERIFIED | Read `ci.yml` lines 488-654 directly. `atc-sarif` step: `node tools/ci/merge-sarif.mjs \|\| true` (WR-02 fix confirmed restored) then the unchanged `[ -s angular-typechecker.sarif ]` produced-guard. `git grep -c "upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a"` = 2; `git grep -c "pull_request.head.repo.fork == false"` = 2; `persist-credentials: false` + `fetch-depth: 0` present on checkout; job `permissions: {contents: read, security-events: write}` unchanged; `if: needs.changes.outputs.code != 'false'` unchanged. The `ci` aggregate's `needs: [changes, discover, test, e2e, e2e-windows, fallow, cve-lite, format-lint, act-compat, lint-workflows, scoped-name-guard]` does NOT list `code-scanning`. |
| 7 | SC4/D-06: the published package is byte-unchanged -- no new dependency, no reporter/API/schema change, no version bump | VERIFIED | `git diff 5cc630b..HEAD -- packages/angular-typechecker/package.json` is empty. `git diff --stat 5cc630b..HEAD -- 'packages/angular-typechecker/src/core/**' 'packages/angular-typechecker/src/cli/**'` is empty. `git show HEAD:packages/angular-typechecker/package.json` shows `"version": "0.2.3"` (unchanged). `git diff --name-only 5cc630b..HEAD` touches only `.github/workflows/ci.yml`, `tools/ci/list-typecheck-projects.mjs`, `tools/ci/merge-sarif.mjs`, the two new plugin specs, and `.planning/` docs -- exactly the plan's declared `files_modified` set, nothing else. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Deferred Items

One item is not yet locally provable but is explicitly and concretely addressed by the next phase in this milestone.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | MULTI-01 end-to-end: GitHub Code Scanning ACCEPTS the merged multi-run file and lands N distinct `angular-typecheck/<project>` analyses | Phase 35 | `REQUIREMENTS.md` PROOF-01/PROOF-02 (isolated-fixture `gh api` assertion, fails loud on any missing alert/category/tag); the plan's own `real_ci_only` section explicitly defers this and instructs "Do NOT gate this plan on a locally-green upload check." Code Scanning ingestion is async/server-side; local schema-validate/actionlint/act-compat all pass while GitHub can still reject a class of multi-run upload -- only a real CI run against a real PR (Phase 35) can confirm the landing. |

This deferred item does not affect the phase status (Step 9b): every truth this phase's own local contract requires is verified above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tools/ci/list-typecheck-projects.mjs` | Executor-id discovery, apps/+libs/ scoped, sorted `{name,tsConfig[]}[]`, throws on empty | VERIFIED | 96 lines, real logic (not a stub); executed directly and produced the exact expected 4-consumer output; `.filter()` (not `.find()`) collects every matching target per project (WR-01 fix present, lines 61-74); imported by `merge-sarif.mjs`; exercised by its own drift-guard spec via subprocess. |
| `tools/ci/merge-sarif.mjs` | Pure `mergeSarifRuns(entries)` + CLI entry that spawns the shipped dist CLI per project and writes the merged file (or nothing on zero runs) | VERIFIED | 132 lines; executed against a real `nx build` output and produced a correct 4-run merged file; stderr breadcrumb on empty-stdout skip present (WR-03 fix, lines 101-107); imports `listTypecheckProjects` from the sibling module (no re-implementation); no `node-sarif-builder` import. |
| `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` | MULTI-02 drift guard riding the `test` target | VERIFIED | 274 lines, 3 tests, all pass (re-ran verbose reporter); reuses `IGNORED_DIRS`/`collectProjectJsonPaths` from the `ci-e2e-coverage-guard.spec.ts` analog (no fresh walker); imports only node builtins + vitest + `@workspace/test-util` (no cross-project import). |
| `packages/angular-typechecker/src/merge-sarif.spec.ts` | MULTI-01 merge-shape spec, subprocess-driven, no cross-project import | VERIFIED | 145 lines, 2 tests, both pass; drives the real `merge-sarif.mjs` via `execFileSync` against a `mkdtempSync` temp workspace + stub `dist/.../cli/bin.js`; imports only node builtins + vitest + `@workspace/test-util`. |
| `.github/workflows/ci.yml` (code-scanning job) | Rewired `atc-sarif` step + no-category upload; invariants preserved; job stays out of `ci` aggregate | VERIFIED | Confirmed via direct read (lines 488-654) + targeted `git grep` counts (SHA pins x2, fork gates x2, no real `category:` key, `\|\| true` restored); `ci` aggregate `needs[]` excludes `code-scanning`; YAML parses cleanly (`js-yaml` sanity check, all 13 jobs enumerated). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tools/ci/merge-sarif.mjs` | `tools/ci/list-typecheck-projects.mjs` | `import { listTypecheckProjects } from './list-typecheck-projects.mjs'` | WIRED | Confirmed by source read (line 26) and by successfully running `merge-sarif.mjs` end-to-end (it could not have produced 4 correct entries without a working import). |
| `multi-typecheck-discovery-guard.spec.ts` | discovery CLI | `execSync('node tools/ci/list-typecheck-projects.mjs', {cwd: workspaceRoot})` | WIRED | The guard execs the exact script CI's `merge-sarif.mjs` imports; re-ran the test and it passed, proving the CLI output equals the independent enumeration today. |
| `.github/workflows/ci.yml` `atc-sarif` step | `tools/ci/merge-sarif.mjs` | `node tools/ci/merge-sarif.mjs \|\| true` | WIRED | Confirmed by direct read of the step body; `id: atc-sarif` preserved so the existing `if:` on the upload step still resolves. |
| `merge-sarif.mjs` output | Code Scanning category | `run.automationDetails = { id: 'angular-typecheck/' + name }`, no `category:` upload input | WIRED | Confirmed both by source read and by the actual merged file produced during verification (`angular-typecheck/ng-spike-app`, etc.); the upload step's `with:` block carries only `sarif_file:`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `tools/ci/merge-sarif.mjs` | `entries` (per-project SARIF docs) | `spawnSync` of the REAL compiled `dist/packages/angular-typechecker/src/cli/bin.js` against each discovered project's real `tsConfig` | Yes -- verified by actually building the plugin (`nx build angular-typechecker`) and running the merge script unmodified against the real workspace; it produced 4 real single-run SARIF docs from real Angular type-checks, not stubs or static fixtures | FLOWING |
| `tools/ci/list-typecheck-projects.mjs` | discovered project list | Real `fs.readFileSync` of the actual `apps/*/project.json` + `libs/*/project.json` files in this repo | Yes -- output matched the real, current `tsConfig` values documented in the plan (e.g., `ng-spike-app` -> `apps/ng-spike-app/tsconfig.app.json`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Discovery CLI prints exactly the 4 real consumers | `node tools/ci/list-typecheck-projects.mjs` | Exact expected JSON array (4 entries, correct tsConfig leaves) | PASS |
| Merge script produces a correct 4-run SARIF from a real build | `nx build angular-typechecker && node tools/ci/merge-sarif.mjs` | `runs.length === 4`; ids `angular-typecheck/{ng-spike-app,typecheck-consumer,typecheck-consumer-dep,typecheck-walk-consumer}`; `version: "2.1.0"` | PASS |
| Full plugin unit-test suite (both new specs + GUARD-01 family regression) | `npx nx test angular-typechecker --skip-nx-cache` | 55 test files, 570 tests, 0 failures (matches the REVIEW-FIX gate-battery count exactly) | PASS |
| Discovery + merge-shape specs individually confirmed passing | `npx nx test angular-typechecker --skip-nx-cache -- --reporter=verbose` filtered on the two new spec file names | All 5 individual `it()` blocks across both new spec files pass | PASS |
| `ci-e2e-coverage-guard.spec.ts` (GUARD-01 family) unaffected by the code-scanning edit | same verbose run, filtered | All 21 assertions across GUARD-01/01b/01c/01d/01e/01f pass unchanged | PASS |
| Lint | `npx nx lint angular-typechecker --skip-nx-cache` | "All files pass linting" (maxWarnings:0) | PASS |
| Typecheck (specs + tools tsconfig) | `npx nx typecheck angular-typechecker --skip-nx-cache` | Clean across `tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json` (the latter type-checks the two new `.mjs` files) | PASS |
| Format | `npx nx format:check --base=5cc630b --head=HEAD` | Exit 0, no unformatted files | PASS |
| No debt markers / stub language in the 4 phase-created/modified source files | `git grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` + placeholder-language grep | No matches | PASS |
| ASCII-only (Windows cp1252 constraint) | Node byte-scan of all 4 new/modified source files | 0 non-ASCII bytes in every file | PASS |

### Probe Execution

SKIPPED (no runnable entry points) -- no `scripts/*/tests/probe-*.sh` files exist in this repo, and neither the PLAN, SUMMARY, nor REVIEW files for this phase reference any probe script. This phase's verification is instead covered by the direct script executions and Vitest specs above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| MULTI-01 | 34-01-PLAN.md | One SARIF run per workspace project using the executor, each landing under a distinct category `angular-typecheck/<project>`, merged into one file, single `upload-sarif`, no `category` input | SATISFIED | Truths 1, 5, 6, 7 above. The "lands as N distinct analyses in GitHub" sub-clause is real-CI-only and deferred to Phase 35 (see Deferred Items) -- the plan itself scopes this split. |
| MULTI-02 | 34-01-PLAN.md | Auto-discovered project set (executor-filtered, not target-name), with a guard so the set cannot silently drift | SATISFIED | Truths 2, 3, 4 above. |

**Orphaned requirements check:** `git grep -n "Phase 34" .planning/REQUIREMENTS.md` returns only the MULTI-01 and MULTI-02 traceability rows (both "Complete") plus the coverage-summary line -- no additional requirement ID maps to Phase 34 that isn't already claimed by the plan's `requirements: [MULTI-01, MULTI-02]` frontmatter. No orphans.

### Anti-Patterns Found

None. Scanned all 4 phase-created/modified source files (`tools/ci/list-typecheck-projects.mjs`, `tools/ci/merge-sarif.mjs`, `multi-typecheck-discovery-guard.spec.ts`, `merge-sarif.spec.ts`) plus the `ci.yml` diff region for debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER), placeholder language, and empty-implementation patterns. The one `return null` found in `merge-sarif.mjs` (line 60) is the deliberate, documented, and behaviorally-tested "zero runs collected -> write nothing" contract (must-have truth 5) -- not a stub. Confirmed all 3 code-review Warnings (WR-01, WR-02, WR-03) from `34-REVIEW.md` were genuinely fixed in the actual code (not just claimed in `34-REVIEW-FIX.md`): WR-01's `.filter()`/union logic is present and has its own regression test; WR-02's `\|\| true` is present in the live `ci.yml`; WR-03's stderr breadcrumb is present in the live `merge-sarif.mjs`. The two Info-level findings (IN-01: multi-entry `tsConfig[]` array path untested end-to-end; IN-02: generated `.sarif` not gitignored) were correctly left unaddressed -- both are pre-existing/low-priority per the review, not blockers, and independently confirmed (`.gitignore` still has no `*.sarif` entry; no `.sarif` file is tracked in git).

### Human Verification Required

None required to close this phase. The one item that ultimately needs a human/real-CI observation (GitHub Code Scanning actually landing the N distinct analyses once this branch runs in real Actions) is tracked under Deferred Items above, addressed automatically by Phase 35's planned `gh api` proof rather than requiring a manual check here.

### Gaps Summary

No gaps. All 7 local must-have truths verified with direct, independent evidence (live script execution against a real build, a full re-run of the Vitest suite including both new specs and the pre-existing GUARD-01 family, lint/typecheck/format checks, and git-diff scope confirmation for the no-release constraint). The three code-review Warnings from the initial pass (WR-01/02/03) were genuinely fixed in the committed code, not just claimed. The only unresolved item -- GitHub's real acceptance of the merged multi-run upload -- is explicitly out of local-verification scope by the plan's own design and is deferred to Phase 35, which is purpose-built to automate exactly that proof.

---

*Verified: 2026-07-21T17:15:00Z*
*Verifier: Claude (gsd-verifier)*
