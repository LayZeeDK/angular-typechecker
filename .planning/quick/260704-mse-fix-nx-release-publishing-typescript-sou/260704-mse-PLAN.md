---
task: 260704-mse
title: fix nx release publishing TypeScript source instead of built dist
type: quick
autonomous: true
run_on: main-tree          # NOT a worktree: builds + runs the new e2e locally (real node_modules + npmjs uplink)
requirements: [RESEARCH-Goal-1, RESEARCH-Goal-2, RESEARCH-Goal-3, RESEARCH-Goal-4]
files_modified:
  - packages/angular-typechecker/project.json
  - e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts
  - package.json
  - package-lock.json
  - packages/angular-typechecker/README.md

must_haves:
  truths:
    - "The published npm package ships compiled .js (src/index.js + generator/executor .js), never raw .ts source."
    - "A reverted packageRoot fix fails the serialized e2e suite instantly (config guard), before any publish."
    - "A real `nx release publish` round-trip against a local Verdaccio produces an installable-by-name package whose node_modules tree has .js and no .ts / .spec."
    - "The README documents a pnpm-workspace install fallback next to the npm one."
  artifacts:
    - path: "packages/angular-typechecker/project.json"
      provides: "nx-release-publish target with options.packageRoot = dist/packages/angular-typechecker"
      contains: "nx-release-publish"
    - path: "e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts"
      provides: "packageRoot config guard (reads project.json)"
    - path: "e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts"
      provides: "post-build dist-vs-source version parity guard"
    - path: "e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts"
      provides: "Verdaccio publish + install-by-name + init/configuration/typecheck round-trip"
    - path: "package.json"
      provides: "verdaccio@6.7.4 devDependency"
      contains: "verdaccio"
    - path: "packages/angular-typechecker/README.md"
      provides: "pnpm add -Dw angular-typechecker install fallback"
      contains: "pnpm add -Dw angular-typechecker"
  key_links:
    - from: "packages/angular-typechecker/project.json nx-release-publish"
      to: "dist/packages/angular-typechecker"
      via: "options.packageRoot literal path"
    - from: "verdaccio-publish.int.spec.ts"
      to: "npx nx release publish --registry <verdaccio-url>"
      via: "the REAL publish path (not npm pack) that tarball-audit misses"
    - from: "installed node_modules/angular-typechecker"
      to: "src/index.js + compiled generator/executor .js, zero .ts source"
      via: "install-by-name from Verdaccio + recursive .ts/.spec assertion"
---

<objective>
Published `angular-typechecker` npm versions ship raw `.ts` source (0 `.js`, no
`src/index.js`) because `nx release publish` packs the project SOURCE root, not
`dist/`. Root cause is verified in RESEARCH.md against the installed Nx 23.0.1
executor: `release-publish.impl.js:68` joins `context.root + (options.packageRoot
?? projectConfig.root)`, and with no `packageRoot` set it falls back to the
project root, whose `package.json` `files: ["src", ...]` globs `src/**/*.ts`.

The fix (settled in RESEARCH.md, do not re-derive): add an `nx-release-publish`
target to `packages/angular-typechecker/project.json` with
`options.packageRoot: "dist/packages/angular-typechecker"` (literal path, not a
`{projectRoot}` token). No `nx.json` change; no `manifestRootsToUpdate` /
`currentVersionResolver`.

Purpose: stop shipping unusable TypeScript-source tarballs; lock the fix behind
regression guards so it can never silently revert.
Output: the fix + two cheap config/version guards + a Verdaccio publish
round-trip e2e + a README pnpm fallback.

CI decision (stated per task requirement 4): all new tests fold into the
existing `angular-typechecker-install-e2e` project, so they ride the already
serialized `e2e` job (`ci.yml:141-173`, `--parallel=1`). NO `ci.yml` change is
needed. Adding a whole new e2e project would require touching the `-p` list at
`ci.yml:172`; folding in avoids that and reuses the fixture/mkdtemp machinery.
</objective>

<execution_context>
This is a `/gsd-quick` task. Run every task on the MAIN checkout (NOT a
worktree): the Verdaccio spec builds, publishes, installs-by-name, and runs
nested `nx` - it needs the real `node_modules` and network access to the npmjs
uplink, which a fresh worktree lacks.

Commit each task atomically with Conventional Commits and NO AI attribution
(no `Co-Authored-By`, no `Generated with`). Do NOT commit the docs artifacts
(PLAN.md / SUMMARY.md / STATE.md) - the orchestrator does the docs commit.
</execution_context>

<scope_boundaries>
CODE + TESTS ONLY (no `ci.yml` change; see CI decision above). The executor
MUST NOT:
- bump the package version, edit `CHANGELOG.md`, open a PR, push, or create tags;
- run `nx release publish` against the REAL npm registry (Verdaccio only, always
  `--registry <local-url>`);
- touch the external OSS repos under `D:/projects/github/{mihajm,ngx-lottie,radix-ng}`.

The ORCHESTRATOR (human-gated) owns the version bump, CHANGELOG curation, the
Release-PR, and the OSS black-box validation. See AGENTS.md for the Release-PR
flow.

SAFETY (load-bearing): the Verdaccio publish exercises the real `nx release
publish` command. It MUST target the local Verdaccio URL via `--registry`. A
publish that reaches `registry.npmjs.org` is a real-world side effect and is
forbidden. Verify the `--registry` flag is present on every publish invocation.
</scope_boundaries>

<context>
@.planning/quick/260704-mse-fix-nx-release-publishing-typescript-sou/260704-mse-RESEARCH.md
@packages/angular-typechecker/project.json
@nx.json
@.github/workflows/ci.yml

<interfaces>
<!-- Patterns the new/edited specs must mirror. Extracted from the repo; use directly. -->

Workspace-root resolution (all e2e specs):
  import { findWorkspaceRoot } from '@workspace/test-util';
  const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

Serialized e2e config (e2e/angular-typechecker-install-e2e/vitest.config.mts):
  environment: 'node', pool: 'forks', singleFork: true, fileParallelism: false,
  sequence.concurrent: false, testTimeout/hookTimeout: 300000, include: 'src/**/*.int.spec.ts'.

Nested-nx env hygiene (install-smoke / nx-add-e2e / tarball-audit):
  buildCleanEnv() clones process.env, deletes NX_RUNNER_ENV_KEYS
  (NX_SKIP_NX_CACHE, NX_TASK_HASH, NX_INVOCATION_ROOT_PID, NX_FORKED_TASK_EXECUTOR,
   NX_TASK_TARGET_PROJECT, NX_TASK_TARGET_TARGET, NX_CLI_SET, NX_TERMINAL_CAPTURE_STDERR)
  and npm_config_legacy_peer_deps / NPM_CONFIG_LEGACY_PEER_DEPS, then sets
  NX_DAEMON: 'false', FORCE_COLOR: '0'. Reuse this verbatim in the Verdaccio spec.

Fresh dist + capture dist path (install-smoke beforeAll):
  execSync('npx nx build angular-typechecker --skip-nx-cache', { cwd: workspaceRoot, env });
  const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');

Fixture copy into tmp workspace (install-smoke / nx-add-e2e):
  const tmp = mkdtempSync(join(tmpdir(), 'atc-<tag>-'));
  cpSync(fixtureDir, tmp, { recursive: true });     // fixtures/consumer-generator
  writeFileSync(join(tmp, '.npmrc'), '');            // empty by default; overwrite for Verdaccio
  removeTmpWorkspace(tmp)  // best-effort recursive rmSync (Windows EPERM swallowed) - copy from nx-add-e2e

Config-assertion style (release-hygiene.int.spec.ts): read a repo JSON file
directly with readFileSync + JSON.parse and assert shape. No build.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the nx-release-publish packageRoot fix</name>
  <files>packages/angular-typechecker/project.json</files>
  <action>Add a new `nx-release-publish` entry to the `targets` object with
  `options.packageRoot` set to the literal string `dist/packages/angular-typechecker`
  (matches `build.options.outputPath` at line 12; do NOT use the `{projectRoot}`
  token - the publish impl joins `context.root + options.packageRoot` directly and
  does not interpolate tokens). This is the entire fix per RESEARCH.md Goal 1 - add
  ONLY `packageRoot`; do NOT add `manifestRootsToUpdate`, `currentVersionResolver`,
  or any `nx.json` change (the decoupled build-off-tagged-source CI flow does not
  need them). Preserve the existing targets untouched and keep the file
  Prettier-clean (2-space indent, trailing key ordering consistent with the file).</action>
  <verify>
    <automated>npx nx show project angular-typechecker --json | node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8'));if(p.targets['nx-release-publish'].options.packageRoot!=='dist/packages/angular-typechecker'){throw new Error('packageRoot not set correctly')}"</automated>
  </verify>
  <done>`nx show project angular-typechecker --json` reports
  `targets['nx-release-publish'].options.packageRoot === "dist/packages/angular-typechecker"`.
  Commit: `fix(release): publish built dist instead of TypeScript source`.</done>
</task>

<task type="auto">
  <name>Task 2: Add cheap regression guards (packageRoot + version parity)</name>
  <files>e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts, e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts</files>
  <action>Two small guards, folded into the two existing specs to avoid a redundant
  300s build (lazy reuse; both live in the same serialized project).
  (a) packageRoot guard - in `release-hygiene.int.spec.ts` (pure config read, no
  build), add a `describe` that reads `packages/angular-typechecker/project.json`
  via `readFileSync` + `JSON.parse` (same style as its `nx.json` reads) and asserts
  `targets['nx-release-publish'].options.packageRoot === 'dist/packages/angular-typechecker'`.
  Add a comment explaining this fails instantly if the Task 1 fix is reverted, and
  why it matters (published tarball would ship .ts source).
  (b) version-parity guard - in `tarball-audit.int.spec.ts` (which ALREADY builds
  fresh dist in `beforeAll` and has `distDir` + `workspaceRoot` in scope), add ONE
  `it` that reads `dist/packages/angular-typechecker/package.json` and
  `packages/angular-typechecker/package.json` and asserts their `version` fields are
  equal. This proves CI's build-off-tagged-source yields the bumped dist version.
  Reuse the existing `distDir` constant; do NOT add a second build. Honor CLAUDE.md
  JS/TS style: blank lines around control flow and returns, braces always.</action>
  <verify>
    <automated>npx vitest run --config e2e/angular-typechecker-install-e2e/vitest.config.mts release-hygiene tarball-audit</automated>
  </verify>
  <done>Both filtered specs pass; the packageRoot assertion and the
  dist-vs-source version assertion are present and green. Commit:
  `test(e2e): guard nx-release-publish packageRoot and dist version parity`.</done>
</task>

<task type="auto">
  <name>Task 3: Add the Verdaccio publish round-trip e2e (highest risk)</name>
  <files>e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts, package.json, package-lock.json</files>
  <action>Add `verdaccio` at `6.7.4` to root `package.json` devDependencies (keep
  the list alphabetized; it slots between `typescript-eslint` region per existing
  ordering - place it correctly), then run `npm install` to update
  `package-lock.json`. Create `verdaccio-publish.int.spec.ts` in the install-e2e
  project. It proves the REAL publish path (`nx release publish`) that
  `tarball-audit` misses. Structure, reusing the repo patterns from the interfaces
  block:

  Setup (beforeAll, 300000ms timeout): reuse `buildCleanEnv()` /
  `NX_RUNNER_ENV_KEYS` verbatim. Find a FREE ephemeral port first (open a
  `node:net` server on port 0, read `address().port`, close it) rather than guessing
  a port. Write a minimal Verdaccio config yaml to a fresh `mkdtempSync` dir with:
  `storage` pointing at another fresh temp dir (so re-runs never collide with a
  previously-published same-version package), an `uplinks.npmjs.url` of
  `https://registry.npmjs.org/`, and a `packages` block where `'**'` grants
  `access: $all`, `publish: $all`, `unpublish: $all`, and `proxy: npmjs` (so
  Angular/Nx/TS deps still resolve from npmjs while `angular-typechecker` is served
  from local storage). Spawn `npx verdaccio --config <yaml> --listen <freePort>`
  detached; resolve a promise when stdout matches
  `/(https?):\/\/([^:]+):(\d+)/` (Verdaccio logs its URL) with a timeout guard.
  Build fresh dist: `npx nx build angular-typechecker --skip-nx-cache`.

  Publish (the real path): write a temp `.npmrc` (in a temp dir) containing
  `registry=<verdaccioUrl>` and `//<host>:<port>/:_authToken="dummy"` (Verdaccio
  accepts a dummy token). Run `npx nx release publish --registry <verdaccioUrl>`
  from `workspaceRoot`, pointing npm at the temp `.npmrc` via
  `npm_config_userconfig=<temp .npmrc path>` in the env so the repo `.npmrc` is not
  consulted. The `--registry` flag is MANDATORY and load-bearing (never publish to
  real npm). This exercises the `nx-release-publish` target's `packageRoot`.

  Install-by-name + documented flow: `mkdtempSync` a consumer workspace, `cpSync`
  the committed `fixtures/consumer-generator` into it, write its project `.npmrc`
  with `registry=<verdaccioUrl>` + the dummy `_authToken`. Install by NAME (not by
  tarball path): `npm install --save-dev angular-typechecker` from the consumer dir
  (Verdaccio serves the just-published package; uplink resolves the rest). Run the
  documented flow: `npx nx g angular-typechecker:init --skipFormat`, then
  `npx nx g angular-typechecker:configuration consumer-generator --skipFormat`, then
  `npx nx typecheck consumer-generator`.

  Assertions: (1) the typecheck run exits 0 (green - capture like install-smoke's
  `run()` try/catch). (2) the installed `<tmp>/node_modules/angular-typechecker`
  tree contains `src/index.js` AND at least the compiled
  `src/generators/init/generator.js` and `src/executors/typecheck/executor.js`.
  (3) a recursive walk of that installed tree finds ZERO source `.ts` files
  (exclude `.d.ts`) and ZERO `.spec.` files - this is the direct proof the fix
  ships compiled JS, the whole point.

  Teardown (afterAll): `child.kill()` the Verdaccio process (capture the pid);
  `removeTmpWorkspace` the consumer + config + storage temp dirs (best-effort, swallow
  Windows EPERM like nx-add-e2e). Honor CLAUDE.md JS/TS style throughout.

  PITFALLS to call out in comments: unique FREE port (net probe, not a guess);
  detached spawn + kill in afterAll (on Windows the detached npx wrapper may orphan
  the node child - CI e2e is Linux-only so treat Windows-local kill as best-effort,
  matching the removeTmpWorkspace precedent); dummy `_authToken` via
  `npm_config_userconfig` isolation; uplink proxy so non-local deps resolve; fresh
  temp `storage` per run to dodge same-version republish rejection; the spec
  serializes with the other e2e specs (same project, singleFork, `--parallel=1`) and
  shares `distDir` - keep its own build `--skip-nx-cache`.</action>
  <verify>
    <automated>npx vitest run --config e2e/angular-typechecker-install-e2e/vitest.config.mts verdaccio</automated>
  </verify>
  <done>The Verdaccio spec passes on the main tree: publish via
  `nx release publish --registry <local>` succeeds, install-by-name resolves,
  init/configuration/typecheck runs green, and the installed package tree has
  compiled `.js` with zero `.ts` source / zero `.spec`. `verdaccio@6.7.4` is in
  devDependencies + lockfile. Commit (single atomic unit - the dep exists only for
  this spec): `test(e2e): add verdaccio publish round-trip e2e`.</done>
</task>

<task type="auto">
  <name>Task 4: Add the pnpm install fallback to the package README</name>
  <files>packages/angular-typechecker/README.md</files>
  <action>In the `## Installation` section, immediately after the existing plain-npm
  fenced block (`npm install --save-dev angular-typechecker` + `nx g
  angular-typechecker:init`, around lines 83-88), add a short pnpm-workspace variant
  documenting `pnpm add -Dw angular-typechecker` followed by
  `nx g angular-typechecker:init` (RESEARCH.md Goal 4: the pnpm-workspace equivalent
  of the npm fallback, reaching the generator directly since `nx add` is fragile
  under pnpm). Keep it to one brief lead-in line + one fenced `sh` block, matching
  the surrounding prose style. Do not restructure the section. Keep it Prettier-clean.</action>
  <verify>
    <automated>git grep -n "pnpm add -Dw angular-typechecker" -- packages/angular-typechecker/README.md</automated>
  </verify>
  <done>README `## Installation` shows the `pnpm add -Dw angular-typechecker`
  fallback next to the npm line; `nx format:check` clean. Commit:
  `docs(readme): add pnpm install fallback`.</done>
</task>

</tasks>

<verification>
Before handing off (on the merged main tree, real node_modules):
1. Full serialized e2e suite green (includes all new + existing assertions):
   `npx nx run angular-typechecker-install-e2e:test`
2. CI gates that would run on the PR pass locally:
   `npx nx format:check` (changed files) and `npx nx run-many -t lint`
   (maxWarnings:0 is baked into nx.json - any warning fails).
3. Confirm no `ci.yml` change was made (tests fold into the existing e2e job).
4. Confirm NO version bump, NO CHANGELOG edit, NO tag, NO push, NO publish to the
   real npm registry occurred.
</verification>

<success_criteria>
- `packages/angular-typechecker/project.json` has an `nx-release-publish` target
  with `options.packageRoot === "dist/packages/angular-typechecker"`.
- The packageRoot config guard and the dist-vs-source version-parity guard pass in
  the serialized e2e project.
- The Verdaccio round-trip spec passes: a real `nx release publish --registry
  <local>` yields an install-by-name package that runs the documented
  init/configuration/typecheck flow green and ships compiled `.js` with zero `.ts`
  source and zero `.spec` files.
- `verdaccio@6.7.4` is a root devDependency (in lockfile).
- The README documents the `pnpm add -Dw angular-typechecker` fallback.
- Four atomic Conventional-Commit commits (fix / test / test / docs), no AI
  attribution, no docs-artifact commits.
</success_criteria>

<output>
Create `.planning/quick/260704-mse-fix-nx-release-publishing-typescript-sou/260704-mse-SUMMARY.md`
when done. Do NOT commit the SUMMARY (or PLAN/STATE) - the orchestrator commits
docs artifacts.
</output>
