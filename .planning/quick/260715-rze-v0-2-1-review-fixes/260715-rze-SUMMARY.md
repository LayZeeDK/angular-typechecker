---
quick_task: 260715-rze
title: v0.2.1 Angular-CLI-workspace review-fix batch (8 triaged thermo findings)
branch: gsd/v0.2.1-angular-cli-workspace-support
completed: 2026-07-15
status: complete
tasks_total: 8
commits: 7
findings:
  B3: b29324e
  B4: b94b0f0
  B6: 2dffcc0
  B1: 00cfd8f
  B2: verify-only (no commit)
  Q2: 221632a
  Q1: 97e6a5a
  Q3: 0aeb81f
key-files:
  created:
    - libs/test-util/src/lib/verdaccio-global-setup.ts
    - libs/test-util/src/lib/ng-cli-e2e.ts
  modified:
    - tools/ci/list-e2e-projects.mjs
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
    - packages/angular-typechecker/src/core/angular-cli-wiring.ts
    - packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts
    - packages/angular-typechecker/package.json
    - packages/angular-typechecker/eslint.config.mjs
    - packages/angular-typechecker/src/package-manifest.spec.ts
    - packages/angular-typechecker/src/schematics/ng-add/schematic.ts
    - packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts
    - packages/angular-typechecker/src/core/run-typecheck.ts
    - packages/angular-typechecker/src/core/walk-references.ts
    - libs/test-util/src/index.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
    - e2e/angular-typechecker-install-e2e/src/global-setup.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts
    - e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts
metrics:
  unit_tests: 380
  integration_tests: 107
  test_util_tests: 9
---

# Quick Task 260715-rze: v0.2.1 Angular-CLI-workspace review-fix batch Summary

Addressed the eight triaged findings from the two-reviewer thermo audit of the v0.2.1
Angular CLI workspace-support branch: hardened the shipped ng-add / CLI-wiring / CI-discovery
surfaces (B1, B3, B4, B6), verified a load-bearing discriminator (B2), and removed three
drift-risk duplications (Q1, Q2, Q3) with no observable behavior change. Seven atomic
public-safe commits; B2 was verify-only. No product/version change (stays 0.2.0).

## Findings resolved

### B3 -- CI e2e discovery robustness (commit b29324e)
`tools/ci/list-e2e-projects.mjs` now `existsSync`-guards each `e2e/<dir>/project.json` (a
future non-project subdir no longer ENOENT-crashes the CI `discover` job) and pushes a project
name only when it is truthy AND defines an `e2e` target (no null/undefined matrix cell). The
empty-discovery throw is preserved. A B3 regression test in `ci-e2e-coverage-guard.spec.ts`
runs the real CLI against a synthetic temp workspace (valid project + stray dir + nameless
project.json) and asserts only the valid project is returned. CLI still emits the real
4-project JSON.

### B4 -- backslash relative `--tsConfig` override (commit b94b0f0)
`resolveTsConfigOverride` (angular-cli-wiring.ts) normalizes a relative override's Windows
backslashes to forward slashes (`tsConfig.replace(/\\/g, '/')`) before the `posix.join`, so
`custom\tsconfig.app.json` probes `projects/lib/custom/tsconfig.app.json`. The absolute
short-circuit and the missing-relative throw are unchanged; the D-11 core boundary is intact
(node:path only). New unit coverage via both `resolveTsConfigOverride` and
`resolveTsConfigLeaves`.

### B6 -- `@angular-devkit/schematics` optional peer (commit 2dffcc0)
Declared `@angular-devkit/schematics` `^22.0.0` in `peerDependencies` +
`peerDependenciesMeta.optional: true` (the all-of-Angular-22 22.x-scheme range, not architect's
0.2200.x). Kept it in `@nx/dependency-checks` `ignoredDependencies` (the same
obsolete-vs-compiled-src precedent as architect/rxjs -- the ng-add schematic only type-imports
it). `package-manifest.spec.ts` asserts the optional peer. `nx lint` stays green at
maxWarnings:0.

### B1 -- ng-add bulk skip-and-warn vs `--project` throw (commit 00cfd8f)
`schematic.ts` wraps per-project leaf resolution in a try/catch. On the bulk path (no
`--project`) a non-resolvable project is warned (naming the project and routing to
`ng generate angular-typechecker:configuration <name> --tsConfig <path>`) and skipped -- the
rest are still wired and angular.json is still overwritten. With `--project`, the same failure
throws an actionable Error that never names a flag ng-add lacks (no `Pass --tsConfig
explicitly`). Two new tests cover both paths. Core string + Nx generator behavior untouched.

### B2 -- `angular.json && !nx.json` discriminator (VERIFY-ONLY, no commit)
Confirmed sound. The CLI fork in both generators writes NO nx.json:
- `init/generator.ts:83` returns immediately after `logger.info(NO_CACHING_NOTICE)`, BEFORE
  the only `updateNxJson` call (line 94).
- `configuration/generator.ts:136` writes only angular.json via `updateJson` and returns before
  the Nx-path `initGenerator` that would seed nx.json.
A grep for nx.json writes across `src/generators` + `src/schematics` shows the sole
`updateNxJson` is unreachable on the CLI fork. The Angular CLI flow creates only a `.nx/` cache
DIRECTORY, never an `nx.json` FILE; the discriminator tests the FILE, so it keeps CLI
workspaces on the CLI fork. Backed by three shipped CI-authoritative e2e assertions
(`expect(() => readFileSync(join(tmp, 'nx.json'), 'utf8')).toThrow()`) in the pnpm, yarn, and
ng-generate-configuration-yarn specs after `ng add`/`ng run`/`ng generate`. No code change.

### Q2 -- shared Verdaccio global-setup (commit 221632a)
Extracted `createVerdaccioGlobalSetup(options?)` into `libs/test-util/src/lib/verdaccio-global-setup.ts`
(the byte-identical publish-once flow + 127.0.0.1 loopback safety gate). Both e2e global-setups
collapse to a one-line delegation; the vitest `ProvidedContext` augmentation is declared once in
the factory module (verified propagating to the e2e specs via the `@workspace/test-util` import
chain -- both e2e typechecks pass).

### Q1 -- shared ng-cli e2e helpers (commit 97e6a5a)
Extracted the planted per-leaf codes/anchors/injections, `typecheckTarget`, `plant`,
`createNgRun(commandPrefix)` factory, and `assertPerProjectScoping` into
`libs/test-util/src/lib/ng-cli-e2e.ts`. All four ng-cli specs import them from
`@workspace/test-util` and keep only their package-manager-specific provisioning
(npm install / pnpm strictDepBuilds+collision / yarn .yarnrc.yml+layouts / yarn ng-generate).
Planted-code assertions preserved byte-for-byte.

### Q3 -- core leaf-gather + union-finalize dedup (commit 0aeb81f, regression-sensitive)
Extracted `gatherLeafInto` (+ `LeafAccumulator`) in walk-references.ts -- the identical
per-surviving-leaf gather block used by both `walkReferences` and `handleMultiTsConfig` (no new
import cycle; walk-references imports nothing from run-typecheck). Extracted module-private
`finalizeUnion` in run-typecheck.ts -- the union-finalize tail shared by `handleSolutionWalk`'s
>=1-leaf branch and `handleMultiTsConfig`. The direct single-leaf path, per-leaf vetting
semantics (out-of-project / zero-root-names / not-found), and the 0-in-project-leaves branch are
untouched. Full unit (380) + integration (107) suites pass with no outcome change.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking] B3 test uses the real CLI via execFileSync, not a `file://` dynamic import**
- Found during: Task 1.
- Issue: the plan specified `await import(pathToFileURL(...).href)`. vitest's module runner
  cannot resolve a `file://` URL for a module outside the project root (even with `@vite-ignore`),
  and `@nx/enforce-module-boundaries` bans a literal cross-project relative import path.
- Fix: the B3 test runs the real discovery CLI via `execFileSync('node', [script], { cwd:
  tempRoot })`. The CLI calls `listE2eProjects(process.cwd())`, so this exercises the identical
  code path with the same temp workspace + assertion, and matches GUARD-01b's existing
  CLI-invocation precedent in the same file.
- Files: packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts. Commit b29324e.

**2. [Rule 1 - Bug] B1 catch scopes to leaf resolution only, not `wireTypecheckTarget`**
- Found during: Task 4.
- Issue: the plan text said to wrap "resolveTsConfigLeaves + wireTypecheckTarget" in the
  try/catch. Doing so swallowed a genuine target COLLISION (wireTypecheckTarget throwing) on the
  bulk path -- the pre-existing "throws on a same-named NON-ours target" test regressed
  (warn-and-continue instead of throw).
- Fix: the try/catch wraps ONLY `resolveTsConfigLeaves`; `wireTypecheckTarget` stays outside, so a
  collision still aborts on BOTH the bulk and `--project` paths. This preserves the existing
  collision-throw behavior the plan also requires. Behavior spec + both new tests pass.
- Files: packages/angular-typechecker/src/schematics/ng-add/schematic.ts. Commit 00cfd8f.

**3. [Rule 3 - Blocking] Q2 bracket-access + GUARD-01b marker update**
- Found during: Task 6.
- (a) The moved factory body needed two `process.env.X` dot-accesses converted to bracket
  notation (`process.env['NX_INVOCATION_ROOT_PID']`, `process.env['npm_config_registry']`)
  because test-util's lib build enables `noPropertyAccessFromIndexSignature` (stricter than the
  e2e projects' vitest typecheck where the code originated). Byte-identical runtime.
- (b) Moving `startLocalRegistry` into the factory drifted GUARD-01b's registry-starter detection
  (it scanned e2e global-setups for `startLocalRegistry`; they now delegate via
  `createVerdaccioGlobalSetup`). Updated the detection in `ci-e2e-coverage-guard.spec.ts` (a file
  not in Task 6's list) to match BOTH markers -- a direct, necessary consequence of the refactor,
  committed atomically with it.
- (c) The optional `label` is used only in setup-failure error context, so the publish-once flow +
  safety gate are byte-identical whether or not it is passed.
- Files: libs/test-util/src/lib/verdaccio-global-setup.ts, packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts. Commit 221632a.

**4. [Adjustment] Q1 factory naming, shared comment, inapplicable lint verify**
- Found during: Task 7.
- (a) The ngRun factory is exported as `createNgRun` (not `ngRun`) so each spec's bound local can
  stay `ngRun` without shadowing; the plan referred to it generically as the "ngRun factory".
- (b) The shared `APP_SPEC_INJECTION` carries the `per-project scoping proof` comment; the
  ng-generate spec previously used `single-project wiring proof`. This is a cosmetic comment
  INSIDE a planted (never-asserted) source file -- the load-bearing `Math.abs(...)` statement that
  triggers TS2345 is byte-identical.
- (c) The plan's `nx lint angular-typechecker-ng-cli-e2e` verify step is inapplicable: e2e projects
  define only `e2e` + `typecheck` targets (no `lint`). The `typecheck` gate is the e2e specs'
  static check and passed.
- Files: libs/test-util/src/lib/ng-cli-e2e.ts + the four ng-cli specs. Commit 97e6a5a.

## Verification (authoritative post-merge gate, all GREEN)

- `nx run-many -t build test lint --projects=angular-typechecker --skip-nx-cache`: build ok,
  380 unit tests pass, lint maxWarnings:0.
- `nx integration angular-typechecker`: 107 integration tests pass (Q3 regression gate --
  unchanged).
- `nx test test-util`: 9 pass. `nx run-many -t typecheck lint --projects=
  angular-typechecker-ng-cli-e2e,angular-typechecker-install-e2e,test-util`: typecheck + lint
  clean (Q1/Q2 dedup).
- `node tools/ci/list-e2e-projects.mjs`: emits the real 4-project JSON (B3).
- `nx format:check --base origin/main`: clean (exit 0).

## Self-Check: PASSED

- Created files exist: libs/test-util/src/lib/verdaccio-global-setup.ts,
  libs/test-util/src/lib/ng-cli-e2e.ts.
- All 7 commits present in git log: b29324e, b94b0f0, 2dffcc0, 00cfd8f, 221632a, 97e6a5a, 0aeb81f.
- B2 verify-only: no commit (as planned).
