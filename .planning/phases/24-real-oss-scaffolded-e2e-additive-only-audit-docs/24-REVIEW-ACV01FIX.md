---
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
subject: ACV-01 fix review (commit 1837b25)
reviewed: 2026-07-11T00:00:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - packages/angular-typechecker/src/generators/configuration/generator.ts
  - packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts
  - packages/angular-typechecker/src/generators/configuration/configuration.spec.ts
findings:
  blocker: 0
  major: 1
  minor: 2
  total: 3
status: resolved
disposition: changes-applied
resolution_commit: 49974f1
---

> **RESOLUTION (2026-07-11, commit `49974f1`):** MAJOR-01 addressed -- the two vacuous
> SUBDIR regression cases now seed `pnpm-workspace.yaml` with `packages: ['.']` (which
> DOES form the shadowing root-package stub), and were proven non-vacuous by restoring the
> pre-fix generator and observing all cases FAIL (root app -> spec-only; subdir app/lib ->
> throw), then GREEN on the fix. MINOR-01 addressed -- added a case for the new
> "project not found in angular.json" throw branch. MINOR-02 accepted as-is (Angular CLI
> always writes `projectType`; the library-leaf default matches the Nx branch) -- no code
> change. Full suite 328 passing; lint/typecheck/build/format green.

# ACV-01 Fix Review (commit 1837b25)

**Reviewed:** 2026-07-11
**Depth:** deep (cross-referenced against installed `nx@23.0.1` project-inference internals + empirical probes)
**Scope:** ONLY commit `1837b25` (3 files). Existing `24-REVIEW.md` untouched.
**Status:** issues_found -> changes-needed

## Summary

The production fix in `generator.ts` is **correct and minimal**. Reading `root`/`projectType`
STRAIGHT from `angular.json` on the CLI write-fork is the right root-cause fix: `nx`'s
`readProjectConfiguration` returns a package-inference stub (`root:"."`, `projectType`
undefined) that shadows the angular.json project whenever a pnpm-workspace glob captures a
`package.json` whose `name` collides with the angular.json project name (verified against
`nx/dist/src/generators/utils/project-configuration.js` lines 118-209 and empirically
reproduced). The Nx else-branch is byte-unchanged, the change is additive-only, and the full
suite is green (`configuration-angular-cli.spec.ts` 14 tests, `configuration.spec.ts` 15
tests).

The problem is in the **regression tests, not the fix**: two of the three new CLI-branch
regression tests are **vacuous** -- they never construct the shadowing stub, so they pass
against the pre-fix (buggy) code. Their titles/comments ("was: throw", "despite the pnpm
stub") are factually wrong for the substrates they build. The single documented failure mode
they were written to lock (the subdir throw) is therefore **unguarded**.

No BLOCKER: production behavior is fixed and correct; the defect is test protective-value.

## Verification performed

Empirical probe of `readProjectConfiguration(tree, name)` on each test's exact substrate
(read-only, against the repo's installed `@nx/devkit` + `createTreeWithEmptyWorkspace`):

| Test | pnpm `packages` | `readProjectConfiguration` returns | Stub shadows? | Pre-fix result | Asserted | Catches regression? |
|------|-----------------|-------------------------------------|---------------|----------------|----------|---------------------|
| ROOT app | `['.']` | `{root:"."}`, no projectType | YES | `[spec]` only | `[app, spec]` | **YES (non-vacuous)** |
| SUBDIR app | `['apps/*']` | `{root:"apps/demo-app", projectType:"application"}` | **NO** | `[app, spec]` (correct) | `[app, spec]` | **NO (vacuous)** |
| SUBDIR lib | `['projects/*']` | `{root:"projects/demo-lib", projectType:"library"}` | **NO** | `[lib, spec]` (correct) | `[lib, spec]` | **NO (vacuous)** |

Root cause of the vacuity: `normalizePatterns` (nx `plugins/package-json/create-nodes.js`
line 226) maps a pnpm `packages` entry to `<entry>/package.json`. `'.'` -> `package.json`
(matches the ROOT `package.json` that carries the colliding name -> stub at root `"."`).
`'apps/*'` -> `apps/*/package.json` and `'projects/*'` -> `projects/*/package.json` match
only NESTED package.json files -- of which the subdir tests write NONE -- and do NOT match
the root `package.json`. With no colliding package project inferred, `allProjects[name]` is
empty and `readProjectConfiguration` falls through to the angular.json polyfill
(project-configuration.js lines 120-126), returning the CORRECT `root`/`projectType`. So the
pre-fix code (which fed `readProjectConfiguration` output into `resolveTsConfigLeaves`)
produces results IDENTICAL to the fix for tests 2 and 3.

## Major Findings

### MAJOR-01: SUBDIR app + SUBDIR library regression tests are vacuous (do not reproduce the bug)

**File:** `packages/angular-typechecker/src/generators/configuration/configuration-angular-cli.spec.ts:311-343`
**Issue:**
The "SUBDIR app despite the pnpm stub (was: throw)" and "SUBDIR library despite the pnpm
stub" tests seed `seedPnpmCollision(name, 'apps/*')` / `seedPnpmCollision(name, 'projects/*')`.
Those globs never match the ROOT `package.json` where the colliding name is written, so Nx
infers NO shadowing stub, `readProjectConfiguration` returns the correct angular.json
`root`/`projectType`, and the pre-fix code resolves the SAME `[build, spec]` array these tests
assert. Both tests pass on the buggy code -> they lock nothing and their "(was: throw)" /
"despite the pnpm stub" claims are false (there is no stub in these substrates). The documented
subdir failure mode (throw when the root-"." stub shadows a subdir project) has zero coverage:
a future revert to `readProjectConfiguration` would still leave these two tests green.

**Fix:** Make the subdir substrates use the ROOT-glob collision (`'.'`), which is what
actually produces the shadowing `root:"."` stub for a subdir project (empirically confirmed:
the subdir cases then return `{root:"."}` with no `projectType`, so the pre-fix code resolves
build+spec leaves at `"."` -> both absent -> throws, exactly the claimed reproduction):

```ts
// SUBDIR app (was: 'apps/*')
seedPnpmCollision('demo-app', '.');
// SUBDIR library (was: 'projects/*')
seedPnpmCollision('demo-lib', '.');
```

With `'.'`, the pre-fix code throws (`Could not resolve a tsconfig ... no "tsconfig.lib.json"
and no "tsconfig.spec.json"`) while the fixed code reads angular.json and asserts the full
`[apps/demo-app/tsconfig.app.json, apps/demo-app/tsconfig.spec.json]` array -- the tests then
genuinely fail on the buggy code. (The ROOT-app test at :294-309 already uses `'.'` and is
correctly non-vacuous; leave it.)

Alternatively, if the intent was to lock the *under-check* (spec-only) variant for a subdir
project rather than the throw, seed a NESTED colliding package.json at the project root
(`writeJson(tree, 'apps/demo-app/package.json', { name: 'demo-app' })` with `packages:['apps/*']`)
-- that yields a stub at `root:"apps/demo-app"` / `projectType:undefined`, so the pre-fix code
drops the app leaf to spec-only. Either way the current substrate reproduces neither.

## Minor Findings

### MINOR-01: New `!cliProject` throw branch is untested

**File:** `packages/angular-typechecker/src/generators/configuration/generator.ts:263-267`
**Issue:**
The fix adds `if (!cliProject) throw new Error('Project "..." was not found in angular.json.')`.
No test drives a CLI-branch project name that is absent from `angular.json.projects`, so the
new error path and its message are uncovered. Given this repo's Nyquist-validation discipline
(and that this branch replaces the prior `readProjectConfiguration`-thrown error with a
different message), the branch should be locked.
**Fix:** Add a CLI-fork test:
```ts
it('throws a located error when the project is absent from angular.json', async () => {
  writeAngularJson(tree, { present: { projectType: 'application', root: '' } });
  await expect(
    configurationGenerator(tree, { project: 'missing' }),
  ).rejects.toThrow(/Project "missing" was not found in angular\.json/);
});
```

### MINOR-02: `projectType`-absent defaults to the library leaf (accepted risk -- documentation-only)

**File:** `packages/angular-typechecker/src/generators/configuration/generator.ts:166-169`
**Issue:**
`projectType === 'application' ? tsconfig.app.json : tsconfig.lib.json` means a missing
`projectType` in angular.json resolves an APP as a library leaf. This is acceptable in
practice -- the Angular CLI always writes `projectType`, the existence-probe + empty-result
throw prevents a silently-broken target, and the behavior is consistent with the Nx-branch
`resolveTsConfig` (line 99). No production change needed; flagging only so the assumption
("angular.json always carries projectType") is explicit and inherited knowingly.
**Fix:** None required. Optionally add a one-line `// ponytail:`-style comment noting the
Angular-CLI-always-writes-projectType assumption at the `buildLeaf` ternary.

## Explicitly cleared

- **Fix correctness / root cause:** Correct. Root-cause fix at the shared resolution point
  (reads angular.json authoritatively); the Nx-branch shadow hazard does not apply there
  because project.json wins the same-root merge (`if (!rootMap[config.root])`, project-
  configuration.js line 201).
- **`?? ''` and root ""/subdir handling:** Correct. `joinPathFragments('', x) === x` (root
  app), subdir roots join normally. Angular CLI root apps use `root:""`.
- **Nx-branch lock test (`configuration.spec.ts:328-361`):** Meaningful and non-vacuous as a
  *robustness lock* -- it builds a real same-root package.json/project.json collision under a
  pnpm workspace and asserts project.json wins (target lands correctly). It does not test the
  fix (the Nx branch is unchanged) but guards against a future Nx-inference change letting the
  package stub shadow the Nx path. Keep it.
- **Regression risk to Nx branch / plain-npm CLI path:** None. The Nx else-branch is
  byte-unchanged (diff confirms only the CLI branch changed). A CLI workspace without
  pnpm-workspace.yaml previously hit the angular.json polyfill and now reads angular.json
  directly -- identical result.
- **Additive-only:** Confirmed. Only `generator.ts` + 2 spec files changed. No `schema.json`,
  `schema.d.ts`, `executors.json`, executor-id (`TYPECHECK_EXECUTOR_ID` unchanged), builder-id,
  collection, or public barrel (`index.ts`) change. `resolveTsConfigLeaves` is a private
  (non-exported) function; its signature change is internal only. The `AngularJsonProject`
  interface additions (`projectType?`, `root?`) are internal and additive.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer), deep_
_Method: source read + cross-reference of nx@23.0.1 project-inference internals + 2 empirical read-only probes of `readProjectConfiguration` on each test substrate + full `nx test` suite run (green)_
