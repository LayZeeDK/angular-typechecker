---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
fixed_at: 2026-07-11T21:32:30Z
review_path: .planning/phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-REVIEW-ADDED-TESTS.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report -- Added Tests (ACV-01 gap-fix)

**Fixed at:** 2026-07-11T21:32:30Z
**Source review:** `.planning/phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-REVIEW-ADDED-TESTS.md`
**Iteration:** 1

These are TEST-QUALITY fixes only. The production generator was NOT touched (it
is reviewed + verified separately). No source-code behavior changed, so no
`feat`/`fix` commit and no version bump.

**Summary:**

- Findings in scope: 4 (WR-01, WR-02, IN-02, IN-04)
- Fixed: 4
- Skipped (in scope): 0
- Not attempted (out of fix scope by charter): 2 (IN-01, IN-03)

**Final gate status (run in the isolated worktree with a node_modules junction):**

- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -> 38 files, 349 tests, all pass (matrix suite 19 tests).
- `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` -> all files pass (the `@nx/eslint:lint` deprecation notice is pre-existing, unrelated).
- `npx prettier --check` on both changed specs -> all matched files use Prettier code style.

## Fixed Issues

### WR-01: ng-add ACV-01 collision tests rested on a false premise about `getProjects`

**Files modified:** `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts`
**Commit:** 6113a08
**Type:** `docs` (comment-only)

**Applied fix:** Rewrote the `describe('... ACV-01 regression')` rationale block
and the in-body auto-wire comment. Removed the false claim that `getProjects(tree)`
returns the shadowing stub so ng-add would skip the colliding app. The comment now
states accurately that `getProjects` returns the CORRECT angular.json project
(projectType `application`) on this in-memory substrate -- only
`readProjectConfiguration(tree, name)` returns the stub -- so a `getProjects`-based
skip cannot be reproduced here (deferred to the real-clone / e2e tier). What the two
cases lock is the COMPOSED `ng add` entry point end-to-end: `ngAddGenerator` composes
`configurationGenerator` per in-scope project and thus INHERITS the CLI-branch
leaf-resolution fix; the cases prove the composed path still writes the full
`[app, spec]` leaf array under the pnpm-collision substrate (they regress RED if the
composed inner generator drops the leaf). Both test cases were KEPT (valid end-to-end
coverage). No assertions changed.

### WR-02: matrix Nx-branch `collision` dimension was behaviorally inert / mislabeled

**Files modified:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts`
**Commit:** 1dd48fb
**Type:** `test`

**Applied fix:** Made the Nx cells honest. `writeManifest` always emitted
`packages: ['.']` for the pnpm column, which shadows only the root and never covers
`libs/demo-app`, so the Nx `collision` flag created no real workspace-member collision
and behaved identically to `clean`. Parameterized `writeManifest` with a `pnpmGlob`
argument (default `.`, preserving the CLI branch's root-shadow behavior) and seeded the
Nx branch with `'libs/*'` so the project-dir `package.json` (name === `project.json`
name) is a genuine pnpm workspace member that Nx merges with `project.json`
(project.json wins). Reframed the Nx section as a ROBUSTNESS LOCK with an explanatory
comment: the Nx branch is `project.json`-authoritative, so BOTH collision and clean
resolve to the same solution tsconfig BY DESIGN -- the dimension proves the invariant
holds across the manifest cross-product, it is not a discriminating regression test.
Cross-referenced the dedicated same-root collision assertion in `configuration.spec.ts`.
The CLI matrix cells (which DO discriminate the ACV-01 bug) were left unchanged -- they
keep the default `.` root-shadow glob. All 6 Nx cells + the pathological loud-throw cell
still pass; the loud-throw cell keeps the default `.` glob (root package named `demo-app`
-> two `demo-app` at different roots -> Nx throws).

### IN-02: logger.info spies restored in the test body, not in `afterEach`

**Files modified:** `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts`
**Commit:** dd618e0
**Type:** `test`

**Applied fix:** Three tests did `vi.spyOn(logger, 'info')` then
`infoSpy.mockRestore()` as the last body statement; `vitest.config.mts` sets neither
`restoreMocks` nor `clearMocks`, so a thrown assertion before `mockRestore()` would leak
the stub. Added a module-level `afterEach(() => vi.restoreAllMocks())` (imported
`afterEach`) and removed the three inline `infoSpy.mockRestore()` calls. Restoration is
now unconditional regardless of assertion failures.

### IN-04: dead `|same name` alternative in the ambiguous-duplicate throw regex

**Files modified:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts`
**Commit:** 1dd48fb (combined with WR-02 -- same file; per the repo rule against handcrafted partial-hunk staging)
**Type:** `test`

**Applied fix:** Changed `/defined in multiple locations|same name/i` to
`/defined in multiple locations/i`. The real current Nx error is
"The following projects are defined in multiple locations: ..."; the passing loud-throw
test confirms the first alternative matches, so `|same name` was dead. Regex is now
tightened to the exact current Nx wording.

## Not Attempted (out of fix scope by charter)

These were explicitly deferred by the fix task and by the review's own guidance
("No action required for correctness" / "Optional; low priority"). Neither is a
false-pass and neither was a fix failure.

### IN-01: matrix CLI cells 10/12 non-discriminating; overlap the dedicated CLI spec

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts:82-167`
**Reason:** Accepted redundancy. The non-pnpm/non-collision CLI cells are a legitimate
blast-radius / `resolveTsConfigLeaves` lock; trimming is optional maintainability, not a
correctness fix. Skipped per task instruction ("Skip IN-01").

### IN-03: verbatim test-helper duplication across the CLI and ng-add specs

**File:** `configuration-angular-cli.spec.ts` + `ng-add.spec.ts` (helper duplication)
**Reason:** Extracting a shared `__testing__/cli-substrate.ts` is a new file plus a
cross-spec refactor -- not trivial, and low priority per the review. Skipped per task
instruction ("Skip IN-03").

---

_Fixed: 2026-07-11T21:32:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
