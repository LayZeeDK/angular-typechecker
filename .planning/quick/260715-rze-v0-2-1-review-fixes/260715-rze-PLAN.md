---
quick_task: 260715-rze
mode: quick-full
title: v0.2.1 Angular-CLI-workspace review-fix batch (8 triaged thermo findings)
branch: gsd/v0.2.1-angular-cli-workspace-support
autonomous: true
files_modified:
  - tools/ci/list-e2e-projects.mjs
  - packages/angular-typechecker/src/core/angular-cli-wiring.ts
  - packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts
  - packages/angular-typechecker/src/schematics/ng-add/schematic.ts
  - packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts
  - packages/angular-typechecker/package.json
  - packages/angular-typechecker/eslint.config.mjs
  - packages/angular-typechecker/src/package-manifest.spec.ts
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
  - libs/test-util/src/lib/ng-cli-e2e.ts
  - libs/test-util/src/lib/verdaccio-global-setup.ts
  - libs/test-util/src/index.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts
  - e2e/angular-typechecker-install-e2e/src/global-setup.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.ts
  - packages/angular-typechecker/src/core/walk-references.ts

must_haves:
  truths:
    - "`ng add angular-typechecker` (bulk, no --project) on a workspace containing one non-resolvable project wires every resolvable project and warns about the skipped one -- it does NOT abort the whole workspace, and angular.json is still overwritten."
    - "`ng add angular-typechecker --project <non-resolvable>` throws an actionable error that never names a flag ng-add lacks (no bare `--tsConfig explicitly`); it points at `ng generate angular-typechecker:configuration`."
    - "`tools/ci/list-e2e-projects.mjs` skips an e2e/ subdir that has no project.json (no ENOENT crash) and skips an entry whose project name is falsy (no null matrix cell)."
    - "A relative `--tsConfig` override written with Windows backslashes (e.g. `custom\\tsconfig.app.json`) resolves to the correct forward-slash path on the Angular CLI wiring core."
    - "`@angular-devkit/schematics` is declared as an OPTIONAL peer in the published manifest and `nx lint angular-typechecker` stays green at maxWarnings:0."
    - "The four ng-cli e2e specs and both Verdaccio global-setups draw their shared constants/helpers/setup from one source of truth in libs/test-util, with byte-for-byte unchanged runtime behavior."
    - "run-typecheck.ts and walk-references.ts share a single leaf-gather accumulator and a single union-finalize helper, with every existing unit + integration test still passing unchanged."
    - "The `angular.json && !nx.json` discriminator is confirmed sound (Angular CLI creates only a `.nx/` cache dir, never an nx.json FILE); the SUMMARY records the finding."
  artifacts:
    - path: "tools/ci/list-e2e-projects.mjs"
      provides: "existsSync guard for a stray non-project e2e subdir + falsy-name skip"
      contains: "existsSync"
    - path: "packages/angular-typechecker/src/core/angular-cli-wiring.ts"
      provides: "backslash-normalized relative --tsConfig override resolution"
      contains: "replace(/\\\\/g"
    - path: "packages/angular-typechecker/src/schematics/ng-add/schematic.ts"
      provides: "bulk skip-and-warn vs --project throw around resolveTsConfigLeaves"
      contains: "logger.warn"
    - path: "packages/angular-typechecker/package.json"
      provides: "@angular-devkit/schematics optional peer + peerDependenciesMeta"
      contains: "@angular-devkit/schematics"
    - path: "libs/test-util/src/lib/ng-cli-e2e.ts"
      provides: "shared ng-cli e2e constants, typecheckTarget, plant, ngRun factory, assertPerProjectScoping"
    - path: "libs/test-util/src/lib/verdaccio-global-setup.ts"
      provides: "createVerdaccioGlobalSetup factory (loopback safety gate preserved)"
    - path: "packages/angular-typechecker/src/core/run-typecheck.ts"
      provides: "finalizeUnion helper shared by handleSolutionWalk + handleMultiTsConfig"
    - path: "packages/angular-typechecker/src/core/walk-references.ts"
      provides: "gatherLeafInto accumulator shared by walkReferences + handleMultiTsConfig"
  key_links:
    - from: "packages/angular-typechecker/src/schematics/ng-add/schematic.ts"
      to: "resolveTsConfigLeaves (angular-cli-wiring.ts)"
      via: "try/catch: warn+continue on bulk, rethrow on --project"
      pattern: "resolveTsConfigLeaves"
    - from: "packages/angular-typechecker/eslint.config.mjs"
      to: "package.json peerDependencies"
      via: "@nx/dependency-checks ignoredDependencies (lint stays green)"
      pattern: "@angular-devkit/schematics"
    - from: "e2e/angular-typechecker-*-e2e/src/global-setup.ts"
      to: "createVerdaccioGlobalSetup (@workspace/test-util)"
      via: "one-line default export"
      pattern: "createVerdaccioGlobalSetup"
    - from: "e2e/angular-typechecker-ng-cli-e2e/src/*.e2e.spec.ts"
      to: "@workspace/test-util ng-cli-e2e helpers"
      via: "shared constants + ngRun factory + assertPerProjectScoping"
      pattern: "assertPerProjectScoping"
    - from: "handleMultiTsConfig + walkReferences"
      to: "gatherLeafInto"
      via: "identical per-surviving-leaf accumulate block"
      pattern: "gatherLeafInto"
---

<objective>
Address the eight triaged, user-approved findings from the two-reviewer thermo audit of the
v0.2.1 Angular CLI workspace-support branch. ONE plan, ONE task per finding, ONE atomic commit
per finding (B2 is verify-only, no commit).

Purpose: harden the shipped ng-add / CLI-wiring / CI-discovery surfaces (B1, B3, B4, B6),
confirm a load-bearing discriminator (B2), and remove three real drift-risk duplications
(Q1, Q2, Q3) without changing any observable behavior.

Output: hardened production behavior + de-duplicated tests/helpers/core, all gates green, and
a SUMMARY recording the B2 verification.
</objective>

<constraints>
Global (from CLAUDE.md / AGENTS.md), apply to EVERY task:
- JS/TS style: braces on all control-flow bodies; blank line before/after if/else/for/while/
  try/catch/return (except first/last line in a block); single-quote Prettier.
- Windows/RTK: never use the `grep` command or Grep tool -- use `git grep` / `rg`. Run scripts
  through the Bash tool (Git Bash). No emojis / non-ASCII in any file or output.
- Do NOT touch: `.github/workflows/*` (CI YAML), `.planning/**` (except this quick task's own
  artifacts), the generated `e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/**`.
  `.fallowrc*` is out of scope (fallow gates in CI, not via the GSD pre-pass; the stale
  duplicate-ignore entries for the global-setups / run-typecheck block become harmless no-ops
  after Q2/Q3 -- leave them).
- Every code task ends GREEN: the relevant `nx test angular-typechecker` (and `nx integration
  angular-typechecker` for Q3), `nx lint angular-typechecker` (maxWarnings:0), and
  `npx prettier --check` on the files it changed.
- Atomic commit per finding, conventional-commits `type(scope):` with a public-safe scope
  (core / ng-add / deps / test-util / ci-tools) -- NEVER an internal plan-id scope. No AI
  attribution. Stage files by name (never `git add .`).
- The branch is already the v0.2.1 feature branch, so committing per task is expected.
</constraints>

<context>
@.planning/STATE.md
@CLAUDE.md
@AGENTS.md

Key facts established during planning (do not re-derive):
- `resolveTsConfigLeaves`, `resolveTsConfigOverride`, `resolveTargetName`, `wireTypecheckTarget`
  live in `src/core/angular-cli-wiring.ts`, under the D-11 lint boundary (NO @nx/devkit,
  @nx/*, @angular-devkit/*, nx, yargs, no console, no process.exit). The vanilla ng-add
  schematic AND the Nx configuration generator both import them. Do NOT regress that boundary.
- The core `resolveTsConfigLeaves` error string ("... Pass --tsConfig explicitly.") is CORRECT
  for the Nx generator + configuration schematic callers (they accept `--tsConfig`). It is only
  wrong for ng-add (NgAddSchema has no `--tsConfig`). B1 must NOT change the core string or the
  Nx generator behavior -- fix it at the ng-add caller.
- `@angular-devkit/schematics` is versioned `22.x` (installed 22.0.6), same scheme as
  `@angular/compiler-cli` -- NOT the `0.2200.x` scheme `@angular-devkit/architect` uses. So its
  all-of-Angular-22 optional-peer range is `^22.0.0`, NOT architect's literal `0.2200.x`.
- The four ng-cli e2e specs each redefine APP_COMPONENT_CODE/APP_SPEC_CODE/LIB_COMPONENT_CODE,
  APP_PROJECT/LIB_PROJECT, the anchor/injection constants, `interface TypecheckArchitectTarget`,
  `typecheckTarget()`, `plant()`, and a near-identical `ngRun()` (only the command prefix
  differs: `npx` vs `corepack yarn`). The planted TS codes are the load-bearing assertion.
- The two Verdaccio global-setups are byte-identical in code (project name is DERIVED from the
  root package.json via `rootProjectName`, not hardcoded); they differ only in a header comment.
- The identical per-surviving-leaf gather block lives at walk-references.ts ~261-288 and
  run-typecheck.ts (handleMultiTsConfig) ~647-660; the union-finalize tail is shared by
  handleSolutionWalk's rootNamesCount>0 branch (~503-536) and handleMultiTsConfig (~676-703).
  The direct single-leaf path in `runTypecheck` uses the LIVE program host case-sensitivity +
  a `result.program === undefined` guard and is NOT part of the shared extraction.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (B3): guard tools/ci/list-e2e-projects.mjs against a stray subdir + a falsy name</name>
  <files>tools/ci/list-e2e-projects.mjs, packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts</files>
  <behavior>
    - listE2eProjects skips an e2e/ subdir that has NO project.json (no ENOENT throw).
    - listE2eProjects skips an entry whose project.json has a falsy `name` (empty/missing).
    - A valid e2e project (project.json with a truthy name + an `e2e` target) is still returned.
    - The existing empty-discovery throw is preserved (an all-skipped tree still throws loudly).
  </behavior>
  <action>
    In `listE2eProjects`, import `existsSync` from `node:fs`. Inside the readdir loop, before
    reading `join(e2eRoot, entry.name, 'project.json')`, `continue` when that file does not
    exist (existsSync false) -- a future non-project e2e/ subdir must not ENOENT-crash the CI
    discover job. After parsing, push `projectJson.name` ONLY when it is truthy AND
    `projectJson.targets?.e2e` is present (a missing/empty name must never inject a null/undefined
    matrix cell). Keep the module PURE fs + JSON (no nx import) and keep the existing empty-array
    throw at the end unchanged. Preserve the existing forward-slash / sort behavior.
    Add a focused regression test: extend `ci-e2e-coverage-guard.spec.ts` with a new describe
    that dynamically imports the ESM module via `await import(pathToFileURL(join(workspaceRoot,
    'tools','ci','list-e2e-projects.mjs')).href)`, builds a temp workspace root (mkdtempSync)
    containing an `e2e/` dir with (a) one valid project (project.json with a name + an `e2e`
    target), (b) a stray dir with NO project.json, and (c) a dir whose project.json has no `name`
    and no `e2e` target, then asserts `listE2eProjects(tempRoot)` returns exactly the one valid
    name and does NOT throw. Clean up the temp dir in a finally.
    Commit: `fix(ci-tools): skip a stray e2e subdir and a falsy project name in the CI e2e matrix discovery`.
  </action>
  <verify>
    <automated>node tools/ci/list-e2e-projects.mjs && nx test angular-typechecker && nx lint angular-typechecker && npx prettier --check tools/ci/list-e2e-projects.mjs packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts</automated>
  </verify>
  <done>listE2eProjects tolerates a missing project.json and a falsy name; the CLI still emits the real 4-project JSON; the new test proves the two skips; GUARD-01b's existing execSync equality test still passes; all gates green; committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (B4): normalize a backslash relative --tsConfig override in resolveTsConfigOverride</name>
  <files>packages/angular-typechecker/src/core/angular-cli-wiring.ts, packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts</files>
  <behavior>
    - resolveTsConfigOverride('projects/lib', 'custom\\tsconfig.app.json', 'lib', exists) resolves
      to 'projects/lib/custom/tsconfig.app.json' when that forward-slash path exists.
    - An absolute override still short-circuits verbatim (unchanged).
    - A genuinely missing relative override still throws the located error (unchanged).
  </behavior>
  <action>
    In `resolveTsConfigOverride` (angular-cli-wiring.ts ~line 100), normalize the relative override
    BEFORE the `posix.join`: replace backslashes with forward slashes with a pure
    `tsConfig.replace(/\\/g, '/')`, then `posix.join(root, <normalized>)`. Do NOT import devkit or
    anything under the D-11 ban -- pure `node:path` only. The `isAbsolute(tsConfig)` short-circuit
    stays ABOVE this (absolute paths pass through unchanged). Do not normalize `root` (it already
    arrives forward-slash from angular.json / Nx). Update the doc comment's OQ-1 note to mention the
    backslash normalization in one line.
    Add unit coverage in angular-cli-wiring.spec.ts (the `resolveTsConfigOverride` describe): a
    backslash relative override `'custom\\tsconfig.app.json'` with `existsIn(['projects/lib/custom/tsconfig.app.json'])`
    resolves to `'projects/lib/custom/tsconfig.app.json'`. (Optionally add the parallel case through
    `resolveTsConfigLeaves` so the whole override path is covered.)
    Commit: `fix(core): normalize backslashes in a relative --tsConfig override before probing`.
  </action>
  <verify>
    <automated>nx test angular-typechecker && nx lint angular-typechecker && npx prettier --check packages/angular-typechecker/src/core/angular-cli-wiring.ts packages/angular-typechecker/src/core/angular-cli-wiring.spec.ts</automated>
  </verify>
  <done>A backslash relative override resolves correctly; absolute + missing-relative behavior unchanged; the D-11 lint boundary is intact; new test passes; gates green; committed.</done>
</task>

<task type="auto">
  <name>Task 3 (B6): declare @angular-devkit/schematics as an optional peer</name>
  <files>packages/angular-typechecker/package.json, packages/angular-typechecker/eslint.config.mjs, packages/angular-typechecker/src/package-manifest.spec.ts</files>
  <action>
    In `packages/angular-typechecker/package.json`, add `@angular-devkit/schematics` to
    `peerDependencies` with range `^22.0.0` (the all-of-Angular-22 spelling for a 22.x-scheme
    package -- verified installed 22.0.6; do NOT copy architect's `0.2200.x`, which is a DIFFERENT
    version scheme and would not match). Add a `peerDependenciesMeta["@angular-devkit/schematics"] =
    { optional: true }` entry. It is a runtime need of the configuration convertNxGenerator
    schematic path. This mirrors EXACTLY the structure used for `@angular-devkit/architect` + `rxjs`
    (optional peer + meta entry).
    In `eslint.config.mjs`, KEEP `@angular-devkit/schematics` in `@nx/dependency-checks`
    `ignoredDependencies` -- this is the exact architect/rxjs precedent: those two are declared
    optional peers AND stay ignored because the plugin's OWN compiled `src/` never `require()`s
    them at runtime (the ng-add schematic only TYPE-imports schematics, erased at compile), so
    `@nx/dependency-checks` would otherwise flag it obsolete and fail `nx lint` at maxWarnings:0
    (`peerDependenciesMeta.optional` does not exempt the obsolete check). Update the existing
    24-06 comment for `@angular-devkit/schematics` to say it is now a DECLARED optional peer,
    ignored for the same obsolete-vs-compiled-src reason as architect/rxjs.
    In `package-manifest.spec.ts`, extend the "declares the converted builder runtime peers"
    area: assert `manifest.peerDependencies['@angular-devkit/schematics'] === '^22.0.0'` and
    `manifest.peerDependenciesMeta['@angular-devkit/schematics'].optional === true`.
    If `nx lint` unexpectedly stays green WITHOUT the ignore, that is a bonus but not required --
    match the architect/rxjs precedent (keep it ignored) and let `nx lint` be the arbiter; the
    hard requirement is that `nx lint angular-typechecker` is green at maxWarnings:0.
    Commit: `build(deps): declare @angular-devkit/schematics as an optional peer dependency`.
  </action>
  <verify>
    <automated>nx test angular-typechecker && nx lint angular-typechecker && npx prettier --check packages/angular-typechecker/package.json packages/angular-typechecker/eslint.config.mjs packages/angular-typechecker/src/package-manifest.spec.ts</automated>
  </verify>
  <done>The manifest declares @angular-devkit/schematics as an optional peer at ^22.0.0 with a meta entry; the manifest spec asserts it; `nx lint` is green at maxWarnings:0; committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 (B1): ng-add bulk path skips-and-warns a non-resolvable project; --project still throws</name>
  <files>packages/angular-typechecker/src/schematics/ng-add/schematic.ts, packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts</files>
  <behavior>
    - Bulk path (no --project) with one resolvable + one non-resolvable project: wires the
      resolvable one, emits a context.logger.warn naming the skipped project, does NOT throw, and
      overwrites angular.json (wired === 1).
    - The bulk warn text does NOT contain the bare `--tsConfig explicitly` guidance (ng-add lacks
      that flag); it points at `ng generate angular-typechecker:configuration <name> --tsConfig <path>`.
    - `--project <non-resolvable>` (an app/library project whose leaves cannot resolve) still THROWS
      with an actionable message that does NOT name a flag ng-add lacks (points at the configuration
      command); the WR-03 "matched no app/library project" throw is unchanged.
  </behavior>
  <action>
    In `schematic.ts`, wrap the per-project `resolveTsConfigLeaves(...)` + `wireTypecheckTarget(...)`
    body (the loop at ~lines 79-92) in a try/catch. On catch, branch on `options.project`:
    - if `options.project` is set (an explicit target that matched this app/library project but
      failed leaf resolution): `throw` an ng-add-appropriate Error whose message names the project
      and routes to `ng generate angular-typechecker:configuration ${name} --tsConfig <path>` (which
      DOES accept --tsConfig). Do NOT re-throw the raw core "Pass --tsConfig explicitly." string.
    - else (bulk path): `context.logger.warn(...)` with the same ng-add-appropriate guidance
      (name the skipped project + the configuration-command route) and `continue` WITHOUT
      incrementing `wired` -- partial wiring beats aborting the whole workspace.
    Only successfully-wired projects increment `wired`, so the existing IN-01 (`wired === 0` return)
    and WR-03 (`options.project && wired === 0`) guards keep working: a --project that matched no
    app/library project at all still hits WR-03; a --project that matched but failed resolution now
    throws inside the loop (before WR-03). Do NOT modify `angular-cli-wiring.ts` (leave the core
    string), the configuration generator, or the schema.
    Extend `ng-add.spec.ts` with two tests:
    (1) Bulk, one resolvable + one non-resolvable: seed two application projects; give the first
        its `tsconfig.app.json`/`tsconfig.spec.json` leaves, give the second NO leaf files (so
        resolveTsConfigLeaves throws for it). Run `await run()`; assert the first project's
        typecheck target is wired, the second's is undefined, angular.json was overwritten (target
        present), a warn message mentions the second project, and NO warn/error contains
        `Pass --tsConfig explicitly` (assert it references `angular-typechecker:configuration`
        instead). Use the direct-invocation `run()` harness already in the file (logger-backed
        SchematicContext) so the warn is captured.
    (2) --project non-resolvable: seed an application project with NO leaf files; run
        `await expect(run({ project: '<that-app>' })).rejects.toThrow(...)` asserting the message
        references the configuration command and does NOT contain a bare `--tsConfig explicitly`.
    Commit: `fix(ng-add): skip-and-warn a non-resolvable project on the bulk path instead of aborting`.
  </action>
  <verify>
    <automated>nx test angular-typechecker && nx lint angular-typechecker && npx prettier --check packages/angular-typechecker/src/schematics/ng-add/schematic.ts packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts</automated>
  </verify>
  <done>Bulk ng-add partial-wires + warns (no throw, angular.json overwritten); --project failure throws an actionable non-misleading message; core string + Nx generator behavior untouched; both new tests pass; gates green; committed.</done>
</task>

<task type="auto">
  <name>Task 5 (B2): VERIFY the `angular.json && !nx.json` discriminator is sound (no commit)</name>
  <files>packages/angular-typechecker/src/generators/configuration/generator.ts, packages/angular-typechecker/src/generators/init/generator.ts, e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts</files>
  <action>
    VERIFY-ONLY -- expect NO code change. Confirm the `tree.exists('angular.json') &&
    !tree.exists('nx.json')` discriminator (configuration/generator.ts:136, init/generator.ts:83)
    is sound: an Angular CLI flow (`ng run`, `ng add`) creates only a `.nx/` cache DIRECTORY, never
    an `nx.json` FILE, so the discriminator correctly keeps CLI workspaces on the CLI fork and Nx
    workspaces on the Nx fork.
    Evidence to gather and record: (a) the existing CI-authoritative e2e assertion that the CLI
    flow leaves no nx.json -- `ng-add-ng-run-yarn.e2e.spec.ts` asserts `expect(() =>
    readFileSync(join(tmp, 'nx.json'), 'utf8')).toThrow()` after `ng add` + `ng run`; the pnpm
    ACV-01 collision e2e and the yarn ng-generate arbiter cell make the same no-nx.json assertion.
    (b) Reason: the CLI init fork returns BEFORE readNxJson/updateNxJson (no nx.json write), and
    `ng`/Nx target caching writes only `.nx/` (a dir), which the discriminator does not test.
    Use `git grep` to confirm no code on the CLI fork writes `nx.json`. Record the confirmation
    (discriminator sound, no code change) in the quick-task SUMMARY. ONLY if verification actually
    finds nx.json being written on a CLI flow (NOT expected) do you add a code change -- and if so,
    stop and re-scope, because that would contradict the shipped e2e assertions.
    No commit for this task (unless a code change is unexpectedly required).
  </action>
  <verify>
    <automated>git grep -n "tree.exists('angular.json') && !tree.exists('nx.json')" -- packages/angular-typechecker/src/generators && git grep -n "readFileSync(join(tmp, 'nx.json'" -- e2e/angular-typechecker-ng-cli-e2e/src</automated>
  </verify>
  <done>The discriminator is confirmed sound (CLI writes only `.nx/`, never nx.json), backed by the shipped e2e no-nx.json assertions + code reasoning; the SUMMARY records the finding; no code change made.</done>
</task>

<task type="auto">
  <name>Task 6 (Q2): extract createVerdaccioGlobalSetup into libs/test-util</name>
  <files>libs/test-util/src/lib/verdaccio-global-setup.ts, libs/test-util/src/index.ts, e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts, e2e/angular-typechecker-install-e2e/src/global-setup.ts</files>
  <action>
    Create `libs/test-util/src/lib/verdaccio-global-setup.ts` exporting
    `createVerdaccioGlobalSetup(options?)` -- a factory that returns the vitest globalSetup default
    function. Move the entire load-bearing body VERBATIM from the current global-setup files:
    `mintCiToken`, `findWorkspaceRoot(__dirname)` root resolution (walks up to nx.json, so a
    test-util-relative __dirname still finds the workspace root), the `delete
    process.env.NX_INVOCATION_ROOT_PID` step, `resetVerdaccioPublishState`, `startLocalRegistry`
    ({ localRegistryTarget derived from the root package.json name, storage, clearStorage:false,
    listenAddress:'127.0.0.1' }), the 127.0.0.1 loopback SAFETY gate (PRESERVE EXACTLY -- refuse any
    non-`http://127.0.0.1:` registry), the stripAllNpmConfig assertion, the provenance strip on the
    dist manifest, and the `nx release publish --registry ... --first-release
    --excludeTaskDependencies` call with `provide('verdaccioUrl'/'verdaccioToken')`. Move the
    `declare module 'vitest' { interface ProvidedContext { verdaccioUrl: string; verdaccioToken:
    string } }` augmentation into this factory module so it is declared once.
    The two global-setups are byte-identical in code (project name is DERIVED, not hardcoded), so
    the factory needs no behavioral per-project argument. To honor the finding's "project-specific
    arg" without inventing behavior, accept an OPTIONAL `{ label?: string }` used only in a startup
    log/error-context string; behavior stays byte-identical regardless.
    Re-export `createVerdaccioGlobalSetup` from `libs/test-util/src/index.ts` (beside
    resetVerdaccioPublishState / writeVerdaccioNpmrc).
    Collapse BOTH `e2e/*/src/global-setup.ts` files to a short module: import the factory and
    `export default createVerdaccioGlobalSetup({ label: '<project-name>' })`. Keep each file's
    top-of-file comment to one line noting it delegates to the shared factory.
    Behavior must be unchanged (same publish-once flow, same safety gate). This is test harness
    only -- do NOT run the full Verdaccio e2e locally.
    Commit: `refactor(test-util): extract createVerdaccioGlobalSetup shared by both e2e global-setups`.
  </action>
  <verify>
    <automated>nx test test-util && nx run-many -t typecheck --projects=angular-typechecker-ng-cli-e2e,angular-typechecker-install-e2e && nx lint test-util && npx prettier --check libs/test-util/src/lib/verdaccio-global-setup.ts libs/test-util/src/index.ts e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts e2e/angular-typechecker-install-e2e/src/global-setup.ts</automated>
  </verify>
  <done>Both global-setups are one-line delegations to createVerdaccioGlobalSetup; the loopback safety gate + publish-once flow are byte-preserved; test-util unit tests + e2e type-check + lint + prettier green; committed.</done>
</task>

<task type="auto">
  <name>Task 7 (Q1): extract shared ng-cli e2e helpers into libs/test-util</name>
  <files>libs/test-util/src/lib/ng-cli-e2e.ts, libs/test-util/src/index.ts, e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts, e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts, e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts, e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts</files>
  <action>
    Create `libs/test-util/src/lib/ng-cli-e2e.ts` providing the currently-duplicated pieces:
    - Constants: APP_COMPONENT_CODE ('TS2322'), APP_SPEC_CODE ('TS2345'), LIB_COMPONENT_CODE
      ('TS2554'), APP_PROJECT ('ng-cli-workspace'), LIB_PROJECT ('my-lib'), and the
      anchor/injection constants (APP_COMPONENT_ANCHOR, APP_COMPONENT_INJECTION, APP_SPEC_INJECTION,
      LIB_COMPONENT_ANCHOR, LIB_COMPONENT_INJECTION) exactly as currently defined (JSON.stringify
      forms preserved byte-for-byte -- these planted codes are the load-bearing assertions).
    - `interface TypecheckArchitectTarget { builder?: string; options?: { tsConfig?: unknown } }`.
    - `typecheckTarget(cwd, project)`: reads angular.json and returns
      projects[project].architect.typecheck.
    - `plant(path, anchor, replacement)`: the anchor-found-assert + write helper (imports `expect`
      from vitest, same as the existing e2e-fixture helper does).
    - `ngRun(commandPrefix)`: a FACTORY returning `(cwd, target, runEnv) => RunResult` that runs
      `${commandPrefix} ng run ${target}` via execSync with maxBuffer 20*1024*1024 and the same
      throw-to-capture try/catch. Call sites pass `'npx'` (npm/pnpm) or `'corepack yarn'` (yarn).
    - `assertPerProjectScoping(...)`: the duplicated "plant the three leaves (app.ts component,
      app.spec.ts spec, projects/my-lib/.../my-lib.ts) + run appBad/libBad + assert app catches
      TS2322+TS2345 and not TS2554, lib catches TS2554 and neither app code, and neither output
      matches /ERR_REQUIRE_ESM/ nor contains 'infrastructure error'" block. Parameterize it with
      `{ tmp, ngRun, env }` (project names default to APP_PROJECT/LIB_PROJECT). Preserve every
      existing assertion verbatim.
    Re-export all of these from `libs/test-util/src/index.ts`.
    Repoint all FOUR ng-cli specs to import these from `@workspace/test-util` and delete their
    local copies. Each spec KEEPS ONLY its genuinely PM-specific setup: the base (npm) spec keeps
    its `npm install` + Verdaccio .npmrc + `ng add`; the pnpm spec keeps its pnpm-workspace.yaml /
    strictDepBuilds provisioning + collision setup; the yarn spec keeps its .yarnrc.yml (enableMirror
    false, npmMinimalAgeGate, 127.0.0.1 whitelist), corepack availability guard, and flat/workspace
    parametrization; the ng-generate-configuration-yarn spec keeps its yarn provisioning + the
    `ng generate ...:configuration` invocation. Build each spec's `ngRun` from the factory with its
    own command prefix. Behavior MUST be unchanged -- the same assertions still run.
    These are e2e specs (not in the fast CI unit tier). Verify by the test-util unit tests + a
    type-check + lint of the e2e specs. Do NOT run the full Verdaccio e2e locally.
    Commit: `refactor(test-util): share the ng-cli e2e constants, ngRun factory, and per-project scoping helper`.
  </action>
  <verify>
    <automated>nx test test-util && nx typecheck angular-typechecker-ng-cli-e2e && nx lint test-util && nx lint angular-typechecker-ng-cli-e2e && npx prettier --check libs/test-util/src/lib/ng-cli-e2e.ts libs/test-util/src/index.ts e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts</automated>
  </verify>
  <done>All four ng-cli specs import the shared constants/helpers/ngRun-factory/assertPerProjectScoping from @workspace/test-util; only PM-specific setup remains per spec; the planted-code assertions are byte-preserved; test-util tests + e2e type-check + lint + prettier green; committed.</done>
</task>

<task type="auto">
  <name>Task 8 (Q3): extract gatherLeafInto + finalizeUnion in the core (regression-sensitive)</name>
  <files>packages/angular-typechecker/src/core/run-typecheck.ts, packages/angular-typechecker/src/core/walk-references.ts</files>
  <action>
    Extract ONLY the pure, identical parts shared by walkReferences, handleSolutionWalk, and
    handleMultiTsConfig. Do NOT touch the direct single-leaf path in `runTypecheck` (it uses the
    LIVE program host case-sensitivity + the `result.program === undefined` guard and is not part
    of this dedup). PRESERVE every vetting difference exactly -- do NOT collapse or change them:
    the walk canonicalizes/dedups/boundary-checks references and folds a missing reference into a
    counted 90002; the array path treats a zero-rootNames entry as a 'zero-root-names' skip and an
    explicit missing/crash path as an infra-500. Those stay in their own loops.
    (1) `gatherLeafInto`: an accumulator helper capturing the IDENTICAL per-surviving-leaf block
        (runNoEmitCompilation -> push parsed.errors + result.diagnostics -> rootNamesCount += ->
        push parsed.rootNames -> push detectUncheckedDeclaredFiles). Define a small
        `LeafAccumulator` shape carrying `rawDiagnostics: ts.Diagnostic[]`, `rootNamePaths:
        string[]`, `notTypeCheckedDeclaredFiles: string[]`, and `rootNamesCount: number`, and have
        `gatherLeafInto(acc, ng, ts, parsed, entryPath)` mutate all four. It is used by
        walkReferences (its surviving-leaf tail) AND handleMultiTsConfig (its surviving entry).
        Home: export it from `walk-references.ts` (the canonical block already lives there, it is
        pure, and run-typecheck.ts already imports from walk-references -- so importing gatherLeafInto
        into handleMultiTsConfig creates NO new cycle; walk-references must NOT import run-typecheck).
    (2) `finalizeUnion`: a private helper in `run-typecheck.ts` capturing the shared union-finalize
        tail (finalize with buildFinalizeFilter over the union rootNamePaths using
        ts.sys.useCaseSensitiveFileNames + spread presentIfNonEmpty('skippedReferences', ...) +
        presentIfNonEmpty('notTypeCheckedDeclaredFiles', ...)). Both callers are already in
        run-typecheck.ts (handleSolutionWalk's rootNamesCount>0 branch + handleMultiTsConfig's tail),
        so finalizeUnion stays module-private -- no cross-module extraction of finalize/
        buildFinalizeFilter/presentIfNonEmpty. The caller passes the combined diagnostics array
        (handleSolutionWalk prepends configDiagnostics; handleMultiTsConfig passes rawDiagnostics),
        the representative `parsed` for the basePath fallback, rootNamesCount, rootNamePaths, start,
        the tsConfigPath, and the skipped/notTypeChecked arrays.
    Do NOT move handleMultiTsConfig into its own module (that decompression is OPTIONAL per the
    finding and would force extracting finalize/buildFinalizeFilter/presentIfNonEmpty to a shared
    module -- unnecessary blast radius on a regression-sensitive change). Keep run-typecheck.ts's
    structure otherwise intact.
    REQUIREMENT: after the extraction, run the FULL unit + integration suite. Every existing test
    must still pass byte-for-byte -- no test outcome may change. If ANY test changes outcome, the
    refactor changed semantics: revert and correct until behavior is identical.
    Commit: `refactor(core): share the leaf-gather accumulator and union-finalize tail across the walk and multi-tsconfig paths`.
  </action>
  <verify>
    <automated>nx test angular-typechecker && nx integration angular-typechecker && nx lint angular-typechecker && npx prettier --check packages/angular-typechecker/src/core/run-typecheck.ts packages/angular-typechecker/src/core/walk-references.ts</automated>
  </verify>
  <done>gatherLeafInto (in walk-references, no new cycle) and finalizeUnion (private in run-typecheck) replace the two identical blocks; per-leaf vetting semantics unchanged; the direct single-leaf path untouched; the FULL unit + integration suite passes with no outcome change; lint + prettier green; committed.</done>
</task>

</tasks>

<verification>
After all eight tasks, the authoritative post-merge gate on the main checkout:
- `nx run-many -t build test lint --projects=angular-typechecker --skip-nx-cache` (build ok,
  373+ tests pass with the new B1/B3/B4 tests added, lint maxWarnings:0).
- `nx integration angular-typechecker` (107 integration tests still pass -- Q3 gate).
- `nx test test-util` + `nx run-many -t typecheck lint --projects=angular-typechecker-ng-cli-e2e,angular-typechecker-install-e2e,test-util`
  (Q1/Q2 dedup type-checks + lints clean).
- `node tools/ci/list-e2e-projects.mjs` emits the real 4-project JSON (B3).
- `nx format:check --base origin/main` (or `npx prettier --check` on every changed file) is clean.
Seven atomic commits land (B3, B4, B6, B1, Q2, Q1, Q3); B2 adds no commit (SUMMARY-only).
</verification>

<success_criteria>
- B1: bulk ng-add partial-wires + warns (no abort); --project failure throws an actionable,
  non-misleading message; core string + Nx generator behavior untouched.
- B3: list-e2e-projects tolerates a stray subdir + a falsy name; empty-discovery throw preserved.
- B4: a backslash relative --tsConfig override resolves correctly; D-11 boundary intact.
- B6: @angular-devkit/schematics is a declared optional peer at ^22.0.0; nx lint green at maxWarnings:0.
- B2: discriminator confirmed sound; recorded in SUMMARY; no code change.
- Q1/Q2: the four ng-cli specs + both global-setups share one source of truth; behavior unchanged.
- Q3: core dedup done with the FULL unit + integration suite unchanged (byte-for-byte behavior).
- All gates green; seven public-safe atomic commits; no CI YAML / .planning / fixture edits.
</success_criteria>

<output>
Create `.planning/quick/260715-rze-v0-2-1-review-fixes/260715-rze-SUMMARY.md` when done,
recording each finding's resolution (including B2's discriminator confirmation) and the commit
SHAs.
</output>
