---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
reviewed: 2026-07-11T23:15:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts
  - packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts
  - packages/angular-typechecker/src/generators/configuration/configuration.spec.ts
  - packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 24: Code Review Report -- Added Tests (ACV-01 gap-fix)

**Reviewed:** 2026-07-11T23:15:00Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the four spec files added/extended by the ACV-01 gap-fix work: the full
workspace matrix (`configuration-matrix.spec.ts`), the CLI write-fork + pnpm-collision
regression cases (`configuration-angular-cli.spec.ts`), the Nx-branch collision case
(`configuration.spec.ts`), and the ng-add orchestration + collision cases
(`ng-add.spec.ts`). All 349 tests in the fast tier pass. The production generator was
NOT reviewed (out of scope; covered by 24-REVIEW-ACV01FIX.md).

To settle the non-vacuity and substrate-fidelity questions empirically I ran three
throwaway probe specs against the same in-memory substrate the tests use (then deleted
them). Findings:

- **The load-bearing ACV-01 cases ARE non-vacuous.** `readProjectConfiguration(tree, name)`
  genuinely returns the shadowing stub (`root: "."`, `projectType: undefined`) under the
  root pnpm collision. So the direct-generator CLI collision cases in
  `configuration-angular-cli.spec.ts` (and the pnpm+collision cells of the matrix) fail
  RED if the fix is reverted -- confirmed by tracing the pre-fix resolution path
  (root app -> spec-only, subdir app -> throw). This is the code the fix exists to lock,
  and it is locked correctly. No BLOCKER.
- **Two substrate-fidelity defects** were found (WR-01, WR-02): the ng-add collision
  tests rest on a factually false premise about `getProjects`, and the matrix Nx-branch
  `collision` dimension is behaviorally inert. Neither is a false-pass, but both mislead
  future maintainers about what is covered.

Assertions are otherwise correct: reading `angular.json` directly (not
`readProjectConfiguration`) in the collision cases is the RIGHT choice, because the stub
carries no typecheck target; the `it.each` label/data plumbing is sound; and the
loud-throw regex matches the real Nx error text.

## Warnings

### WR-01: ng-add ACV-01 collision tests rest on a false premise about `getProjects` and do not exercise the failure mode they claim

**File:** `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts:289-365` (rationale block + both `describe('... ACV-01 regression')` cases)

**Issue:** The block comment asserts (lines 293-298):

> "getProjects uses the SAME Nx project inference that returns the shadowing package
> stub (projectType undefined) under the pnpm-workspace name collision. If that stub
> reaches the filter, ng-add would SKIP the colliding app entirely (wire ZERO targets)."

That is empirically FALSE for the in-memory substrate these tests use. Probed directly:

```
readProjectConfiguration(tree, 'demo-app') -> { root: "." }            // stub (no projectType)
getProjects(tree)                          -> [{ n: 'demo-app', root: '', pt: 'application' }]  // CORRECT
```

`getProjects(tree)` returns the correct angular.json project with `projectType: 'application'` --
it does NOT surface the stub. Only `readProjectConfiguration(tree, name)` returns the
stub. Consequences:

1. ng-add's filter (`project.projectType === 'application' | 'library'`) never sees
   `undefined`, so the "skip the colliding app / wire zero targets" failure mode the
   comment describes is NOT reproduced by this substrate. The tests cannot fail for that
   reason.
2. The tests ARE non-vacuous, but only transitively: ng-add composes
   `configurationGenerator`, whose CLI branch (pre-fix) called
   `readProjectConfiguration` and got the stub -> leaf-drop. That is the exact bug
   `configuration-angular-cli.spec.ts` already locks directly, so the ng-add cases add
   near-zero marginal coverage while claiming a distinct, "arguably worse" failure mode.

Net effect: a future maintainer reading this block believes ng-add's `getProjects`
enumeration path is guarded against the stub. It is not (the substrate can't reproduce a
stub via `getProjects`), so a genuine `getProjects`-based skip regression would slip
through with these tests green.

**Fix:** Correct the rationale to match reality -- state that `getProjects` returns the
correct `projectType` on this substrate and that these cases are an end-to-end guard that
ng-add's per-project composition still writes the full `[app, spec]` array through the
inner (angular.json-reading) `configurationGenerator`. If the intent is genuinely to lock
the `getProjects`-filter-skip mode, note that the in-memory tree cannot reproduce it and
defer that assurance to the real-clone / e2e tier. Otherwise consider these redundant with
`configuration-angular-cli.spec.ts` and either delete them or keep a single end-to-end
case with an accurate comment.

### WR-02: matrix Nx-branch `collision` dimension is behaviorally inert and mislabeled ("name-COLLISION")

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts:90-103,169-209` (`nxCells` + the Nx `it.each`, via `writeManifest` at 56-69)

**Issue:** The Nx cells vary `collision` (true/false) x `manifest`, but the `collision`
flag only writes an extra `libs/demo-app/package.json` and `writeManifest` always emits
`packages: ['.']` for the pnpm column. Probed against the exact matrix seeding:

```
nx|flat|collision=true   -> getProjects [{demo-app, libs/demo-app, application}]
nx|flat|collision=false  -> getProjects [{demo-app, libs/demo-app, application}]   // identical
nx|npm|collision=true    -> getProjects [{demo-app, libs/demo-app, application}]   // identical
nx|pnpm|collision=true   -> getProjects [{workspace-root, .}, {demo-app, libs/demo-app, application}]
nx|pnpm|collision=false  -> getProjects [{workspace-root, .}, {demo-app, libs/demo-app, application}]  // identical
```

`readProjectConfiguration(tree, 'demo-app')` returns `libs/demo-app` / `application` in
every cell. So `collision=true` is observationally identical to `collision=false` for the
generator in all three manifests -- the dimension has zero discriminating power. The pnpm
column is doubly wrong: `packages: ['.']` makes the ROOT package a project but never
includes `libs/demo-app`, so it does not reproduce "the colliding lib is a pnpm workspace
package." The dedicated `configuration.spec.ts` test (line 351) correctly uses
`packages: ['libs/*']` for that. The matrix cells therefore do NOT create the condition
their `name-COLLISION` label claims, and the six Nx cells collapse to three distinct
behaviors.

This is not a false-pass (the cells pass correctly), but per the review charter it is a
vacuous cell set: seeding that does not create the labeled condition, giving false
confidence that the Nx x collision cross-product is matrix-covered.

**Fix:** The real Nx pnpm-collision case is already covered by
`configuration.spec.ts:328-361` (with the correct `packages: ['libs/*']` glob and the
merge-project.json-wins assertion). Simplest: drop the `collision` dimension from
`nxCells` (halve to three manifest-only cells, or remove entirely) and rely on that
dedicated test. If the dimension is kept, at minimum use `packages: ['libs/*']` for the
Nx pnpm column so the colliding lib is actually a workspace package, and relabel to
reflect that the cell only co-locates a merging `package.json` (project.json still wins
unobservably).

## Info

### IN-01: matrix CLI cells are 10/12 non-discriminating for ACV-01 and overlap the dedicated CLI spec

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts:82-167`

**Issue:** Only the two `pnpm-workspace + collision` CLI cells (root app, subdir app) are
non-vacuous with respect to the ACV-01 bug -- the comment (line 32-33) states this
honestly ("Only ONE cell silently broke pre-fix"). The other ten CLI cells (flat,
npm-workspaces, or non-collision) pass identically against the pre-fix generator because
no stub is produced (probe: `npm-workspaces` -> correct project). They serve as a
blast-radius / `resolveTsConfigLeaves` lock, which is legitimate, but they duplicate the
`configuration-angular-cli.spec.ts` collision block (root + subdir pnpm cases appear in
both files).

**Fix:** No action required for correctness. If trimming for maintainability, keep the two
pnpm+collision CLI cells (the discriminating ones) and drop the non-pnpm/non-collision
cells, or de-duplicate against `configuration-angular-cli.spec.ts`. Optional.

### IN-02: logger.info spies are restored in the test body, not in afterEach; no `restoreMocks` in the vitest config

**File:** `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts:225-239,270-286,375-403`

**Issue:** Three tests do `vi.spyOn(logger, 'info')` and call `infoSpy.mockRestore()` as
the last statement in the body. `vitest.config.mts` does not set `restoreMocks`/
`clearMocks` (both default false), so if any assertion in a spy-test throws before
`mockRestore()`, the `logger.info` stub leaks into subsequent tests. In the current suite
no later assertion depends on an unstubbed `logger.info` (the pnpm-collision block logs
but does not assert on the log), so this is latent, not active -- but it is a fragility.

**Fix:** Move restoration to `afterEach(() => vi.restoreAllMocks())` for the describe
blocks that spy, or wrap the spy lifetime in `try { ... } finally { infoSpy.mockRestore() }`.
Alternatively set `test.restoreMocks: true` in `vitest.config.mts`.

### IN-03: verbatim test-helper duplication across the CLI and ng-add specs

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts:28-57,282-296` and `packages/angular-typechecker/src/generators/ng-add/ng-add.spec.ts:31-60,313-327`

**Issue:** `writeAngularJson`, `writeLeaf`, `assertCliSubstrate`, `seedNgxLeafletWorkspace`,
`seedPnpmCollision`, and `writtenTsConfig` are duplicated near-verbatim between the two
files (and partially in `configuration-matrix.spec.ts`). Some duplication is acceptable in
tests, but the `seedPnpmCollision` + `writtenTsConfig` pair is load-bearing (it encodes
the "read angular.json directly because the stub shadows" contract) and would drift silently
if only one copy is updated.

**Fix:** Extract a shared `configuration/__testing__/cli-substrate.ts` (or similar)
exporting these helpers and import from both specs. Optional; low priority.

### IN-04: ambiguous-duplicate regex has a dead `|same name` alternative

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-matrix.spec.ts:230`

**Issue:** `rejects.toThrow(/defined in multiple locations|same name/i)`. Probed, the real
Nx error is `"The following projects are defined in multiple locations: ..."`, so the first
alternative matches and `|same name` never fires against current Nx. The regex is correctly
scoped (it will not match unrelated errors), but the second alternative is dead weight.

**Fix:** Either drop `|same name` (tighter, asserts the exact current Nx wording) or keep it
as intentional forward-compat breadth and add a one-line comment noting it is a fallback for
a future Nx wording change. Cosmetic.

---

_Reviewed: 2026-07-11T23:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
