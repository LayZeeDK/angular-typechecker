---
task: 260704-mse
title: fix nx release publishing TypeScript source instead of built dist
type: quick
status: complete
completed: 2026-07-04
branch: release/0.1.1
commits:
  - 762be57 fix(release): publish built dist instead of TypeScript source
  - 5b24f32 test(e2e): guard nx-release-publish packageRoot and dist version parity
  - ac055c4 test(e2e): add verdaccio publish round-trip e2e
  - bba193b docs(readme): add pnpm install fallback
files_modified:
  - packages/angular-typechecker/project.json
  - e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts
  - package.json
  - package-lock.json
  - packages/angular-typechecker/README.md
---

# Quick task 260704-mse: publish built dist, not TypeScript source

One-liner: added the `nx-release-publish` `packageRoot` target so `nx release
publish` packs `dist/packages/angular-typechecker` (compiled `.js`) instead of the
source root (raw `.ts`), and locked the fix behind a config guard, a dist-vs-source
version-parity guard, and a full local-Verdaccio publish -> install-by-name ->
typecheck round-trip.

## What changed, per task

### Task 1 - the fix (commit 762be57)

`packages/angular-typechecker/project.json`: added an `nx-release-publish` target
with `options.packageRoot: "dist/packages/angular-typechecker"` (literal path,
matching `build.options.outputPath`; NOT a `{projectRoot}` token). Root cause
(verified in the installed executor at
`@nx/js/.../release-publish.impl.js:68`): `packageRoot = join(context.root,
options.packageRoot ?? projectConfig.root)` -- with no `packageRoot` it falls back
to the project SOURCE root, whose `package.json` `files: ["src", ...]` globs
`src/**/*.ts`. No `nx.json` change; no `manifestRootsToUpdate` /
`currentVersionResolver` (the decoupled build-off-tagged-source CI flow does not
need them).

### Task 2 - two cheap regression guards (commit 5b24f32)

- `release-hygiene.int.spec.ts`: a pure config read (`REL-04`) asserting
  `targets['nx-release-publish'].options.packageRoot === 'dist/packages/angular-typechecker'`.
  Fails instantly if the Task 1 fix is reverted, before any build/pack/publish.
- `tarball-audit.int.spec.ts`: reuses the existing fresh-dist `beforeAll` (no
  second build) to assert `dist/.../package.json` `version` equals the source
  `version` -- proves CI's build-off-tagged-source ships the bumped version.

### Task 3 - Verdaccio publish round-trip (commit ac055c4)

`verdaccio-publish.int.spec.ts` (new) + `verdaccio@6.7.4` devDependency + lockfile.
The only spec that exercises the REAL `nx release publish` path (which
`tarball-audit`/`install-smoke` cannot -- they `npm pack` from dist directly and
install the `.tgz` by path). Flow: free-port probe -> spawn Verdaccio (direct node
child, fresh per-run storage, `angular-typechecker` served local-only / everything
else proxied to npmjs) -> build fresh dist -> `nx release publish --registry
<local> --first-release` -> `npm install --save-dev angular-typechecker` BY NAME
into a fresh consumer -> `nx g ...:init` -> `nx g ...:configuration
consumer-generator` -> `nx typecheck consumer-generator`. Assertions: typecheck
exits 0; installed tree has `src/index.js` + `src/generators/init/generator.js` +
`src/executors/typecheck/executor.js`; a recursive walk finds ZERO `.ts` source
(excluding `.d.ts`) and ZERO `.spec.` files. Load-bearing SAFETY: an assertion
refuses any registry that is not `http://localhost:*` before publishing.

### Task 4 - README pnpm fallback (commit bba193b)

`packages/angular-typechecker/README.md`: added a `pnpm add -Dw
angular-typechecker` + `nx g angular-typechecker:init` variant next to the plain
npm fallback in `## Installation`.

## Deviations from plan (all within spec-writing scope; no architectural change)

The plan's Verdaccio recipe named three mechanisms that did not work as written on
Windows arm64 / Verdaccio 6.7.4 + npm 11.16. Each was root-caused and fixed inside
the spec (deviation Rules 1/3 - bugs / blocking issues), verified with a standalone
node repro before wiring in:

1. **[Rule 1] Dummy `_authToken` -> real minted token.** The plan (and its
   nx-verdaccio source note) said a dummy `_authToken` is accepted as anonymous.
   Verdaccio 6.7.4 instead 401-rejects an unverifiable bearer (npm surfaces it as
   "This command requires you to be logged in ... npm adduser"). Fix: the spec
   registers a throwaway `ci` user via `PUT /-/user/org.couchdb.user:ci` and uses
   the token the registry returns. Confirmed a direct `npm publish` with that token
   succeeds (`+ angular-typechecker@0.1.0`).

2. **[Rule 3] Strip ALL inherited `npm_config_*` env, not just legacy-peer-deps.**
   The spec runs under `npx vitest` / `nx run ...:test`, which injects
   `npm_config_*` env vars (including `npm_config_registry`) reflecting the dev
   repo config. npm precedence is `cli > env > project .npmrc`, so an inherited
   `npm_config_registry=https://registry.npmjs.org/` silently overrode the
   consumer's `.npmrc registry=<verdaccio>` -- redirecting the nested publish
   (401, wrong registry) and the install (would fetch the REAL published 0.1.0
   from npmjs, not our dist). Verified: `npm_config_registry=...npmjs... npm config
   get registry` returns npmjs even with a userconfig `.npmrc` pointing at
   localhost. Fix: `buildCleanEnv()` deletes every `^npm_config_` key so the nested
   npm reads registry + token solely from the `.npmrc` the spec writes + the
   `--registry` flag.

3. **[Rule 3] Neutralize the CI-only `publishConfig.provenance`.** The dist
   manifest carries `publishConfig.provenance: true` for the OIDC release job.
   Provenance generation only works inside a supported CI with `id-token`, so it
   would abort a local publish. The spec sets `provenance: false` on the dist
   artifact (gitignored, rebuilt each run) before publishing; provenance is a CI
   concern orthogonal to the compiled-JS packaging this round-trip proves.

4. **[robustness, plan-sanctioned] Readiness by HTTP port-poll, not log-scrape.**
   The plan suggested resolving when Verdaccio's stdout matches a URL regex; the
   spec polls the chosen port with a `node:http` GET instead (log level / ANSI /
   buffering vary on Windows). The child's stdout/stderr are still captured for
   error diagnostics, and readiness fails fast if the child exits early.

None of these bumped the version, edited CHANGELOG, created a tag, pushed, or
published to the real npm registry. `dist/` is gitignored, so the provenance strip
is never tracked.

## Verification (commands run + results)

- Build + dist breakdown: `npx nx build angular-typechecker --skip-nx-cache`
  -> "Successfully ran target build". `dist/packages/angular-typechecker/src`
  contains all three required runtime files (`src/index.js`,
  `src/generators/init/generator.js`, `src/executors/typecheck/executor.js`) and a
  recursive count reports **js: 17, ts (non-d.ts): 0, spec: 0**.
- Verdaccio spec (isolated): `npx vitest run --config
  e2e/angular-typechecker-install-e2e/vitest.config.mts verdaccio`
  -> **1 passed** (54.1s test / 58.8s file); publish succeeded, install-by-name
  resolved, init/configuration/typecheck ran green, zero-`.ts`/zero-`.spec`
  assertions held.
- Task-2 specs (isolated): `npx vitest run --config
  e2e/angular-typechecker-install-e2e/vitest.config.mts release-hygiene
  tarball-audit` -> **25 passed** (release-hygiene 18, tarball-audit 7).
- Full serialized e2e suite: `npx nx run angular-typechecker-install-e2e:test
  --skip-nx-cache` -> **6 files passed, 29 tests passed**, "Successfully ran target
  test". (The `consumer-app:typecheck` / `consumer-generator` "failed" lines in the
  stream are the deliberate injected-error / green-run captures inside the specs'
  `run()` helpers, not test failures.)
- Format gate: `npx nx format:check` -> exit 0 (clean).
- Lint gate (maxWarnings:0): `npx nx run-many -t lint --skip-nx-cache`
  -> "Successfully ran target lint for 3 projects", all files pass.

## Caveats

- **Windows-local Verdaccio lifecycle is best-effort.** The spec spawns Verdaccio
  as a DIRECT node child (`process.execPath <verdaccio/bin>`) rather than `npx
  verdaccio`, so `child.kill()` reliably terminates it (an `npx` cmd shim would
  orphan the node grandchild on Windows). Temp-dir teardown swallows Windows EPERM
  (a just-run nx subprocess / node_modules handle can hold the dir open past
  execSync's return) -- a leftover unique `mkdtemp` dir is harmless and the OS
  reclaims it. The CI e2e gate is Linux-only, where neither issue manifests.
- **Consumer install cost.** The consumer `npm install` routes the full Angular 22
  + Nx 23 + TS tree through Verdaccio's npmjs uplink (fresh per-run storage), which
  is the dominant runtime (~50s locally with a warm npm cache). On a cold network
  it could approach the 300000ms test timeout; if that proves flaky in CI, raise
  the per-test timeout or warm the uplink. Fresh storage is intentional (dodges
  same-version republish and guarantees the round-trip exercises the just-built
  dist, not a prior run's).

## Known stubs

None.

## No ci.yml change

The new specs fold into the existing `angular-typechecker-install-e2e` project, so
they ride the already-serialized CI `e2e` job (`--parallel=1`). No `ci.yml` edit
was needed or made.

## Self-Check: PASSED

- Created file exists: `e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts` (committed in ac055c4).
- All 4 commits exist on `release/0.1.1`: 762be57, 5b24f32, ac055c4, bba193b (`git log --oneline -4` confirmed).
- Only the 7 intended files changed since 72d730a; no ci.yml / CHANGELOG / tag / push; source version still 0.1.0.
