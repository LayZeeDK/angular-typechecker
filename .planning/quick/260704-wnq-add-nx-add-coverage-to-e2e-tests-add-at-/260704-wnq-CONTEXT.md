# Quick Task 260704-wnq: Add nx add coverage to e2e tests (pnpm + yarn) - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-resolved; no human checkpoint per --auto)

<domain>
## Task Boundary

Add e2e coverage for the REAL `nx add angular-typechecker` command (not the
`nx g angular-typechecker:init` substitute the current `nx-add-e2e.int.spec.ts`
uses). Add at least one e2e test for **pnpm** and one for **yarn**, using the
latest major versions of each that are compatible with Angular 22 + Nx 23.

Scope is e2e test coverage ONLY. The README pnpm caveat (handoff task 1) and the
optional upstream Nx issue (handoff task 3) are OUT of scope for this task.
</domain>

<decisions>
## Implementation Decisions (auto-resolved)

### Registry + fixture reuse
- REUSE the existing `angular-typechecker-install-e2e` project's Verdaccio
  `global-setup.ts` (it already builds dist once, mints a token, and publishes the
  real dist via `nx release publish` to a local `http://localhost:PORT` registry
  and provides `verdaccioUrl` + `verdaccioToken`). New specs CONSUME that registry
  via `inject('verdaccioUrl')` / `inject('verdaccioToken')` -- do NOT stand up a
  second registry. This is why `nx add <bare-name>` (which resolves `@latest` from
  the registry) becomes feasible OFFLINE: pointed at Verdaccio, it resolves the
  freshly-published local version.
- Add the new specs as new `src/*.int.spec.ts` files in that SAME project so they
  inherit the serialized vitest config (`singleFork`, `fileParallelism:false`,
  `node` env, 300000ms timeouts) and the shared globalSetup. Rationale: the whole
  install-e2e suite already shares one registry + one packed dist and MUST run
  serialized (memory: e2e-projects-share-one-tarball-serialize).

### What the tests assert (REAL nx add, empirical behavior)
- Each spec creates a fresh tmp fixture that is a REAL package-manager workspace
  (pnpm workspace / yarn workspace), points that PM at Verdaccio, and runs the
  ACTUAL `nx add angular-typechecker` command -- NOT `nx g ...:init`. This is the
  blocking acceptance criterion (handoff anti-pattern #1).
- **pnpm:** the handoff root-caused that `nx add` FAILS on pnpm workspaces when
  pnpm's `onlyBuiltDependencies` gate is unmet -> `pnpm add` exits non-zero with
  `ERR_PNPM_IGNORED_BUILDS` -> `nx add` reports "Failed to install". The pnpm spec
  must reproduce a real pnpm workspace with a build-script dep so this gate can
  fire (handoff anti-pattern #2), and assert the OBSERVED behavior. The exact
  assertion shape (assert the failure signature, and/or assert the documented
  fallback `pnpm add --ignore-scripts` + `nx g init` succeeds) is deferred to
  RESEARCH + the executor observing the real command output -- the test must
  reflect reality, not a guess. If a committed `onlyBuiltDependencies` allowlist
  makes `nx add` succeed, assert success instead. The test empirically observes.
- **yarn:** run the real `nx add angular-typechecker` in a yarn workspace pointed
  at Verdaccio and assert the observed outcome (expected: success -> init runs ->
  the `angular-typechecker:typecheck` targetDefaults seeded, mirroring the npm
  `verdaccio-publish` spec). RESEARCH confirms yarn's real behavior; the executor
  asserts what actually happens.

### Package manager versions (latest major compatible w/ Angular 22 + Nx 23)
- Pin EXACT versions via corepack (`corepack prepare <pm>@<version> --activate`
  and/or a `packageManager` field in the fixture) so the test is deterministic and
  does not depend on the host's global pnpm/yarn. RESEARCH determines the exact
  latest-major versions Nx 23 + Angular 22 support (candidates: pnpm 10.x or 11.x;
  yarn 4.x berry). Do NOT use yarn classic (1.x) -- it is legacy.
- Node is already `^22 || ^24 || ^26` (corepack ships with Node 22+).

### Environment hygiene (reuse existing patterns)
- Reuse `@workspace/test-util` (`buildCleanEnv({ stripAllNpmConfig: true })`, `sh`,
  `run`, `findWorkspaceRoot`, `removeTmpDir`) exactly as the sibling specs do. The
  `stripAllNpmConfig` is load-bearing: globalSetup sets `npm_config_registry`
  process-wide (inherited by the singleFork worker) and would outrank a fixture's
  PM registry config. For pnpm/yarn, additionally point THEIR registry config
  (`.npmrc` for pnpm; `.yarnrc.yml` `npmRegistryServer` for yarn 4) at Verdaccio.

### Claude's Discretion
- Whether pnpm + yarn are two separate spec files or one parametrized file: leave
  to the planner/executor (favor two clearly-named files for readable failures).
- Whether to also cover npm's real `nx add` (npm currently only has the init
  substitute): a bonus, not required by the task. Add only if cheap.
</decisions>

<specifics>
## Specific Ideas

- Anchor files (extend these patterns, do not reinvent):
  - `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (registry + provide)
  - `e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts`
    (install-by-name from Verdaccio + init/configuration/typecheck green -- the
    closest analog; the yarn spec should mirror its shape)
  - `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts` (the current
    `nx g ...:init` SUBSTITUTE these new specs supersede/complement with real `nx add`)
  - `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator` (the base
    fixture; new PM fixtures adapt it into pnpm/yarn workspaces)
- The fixture's Angular/Nx/TS deps resolve from the PUBLIC registry while
  angular-typechecker resolves from Verdaccio -- match how the existing specs scope
  registries (only angular-typechecker via Verdaccio if possible; else full
  Verdaccio proxy per `.verdaccio/config.yml`).
</specifics>

<canonical_refs>
## Canonical References

- Memory `nx-add-fails-on-pnpm-workspaces` -- precise pnpm/nx-add failure mechanism
  + the test-coverage gap this task closes + the documented fallback.
- Memory `e2e-projects-share-one-tarball-serialize` -- why the install-e2e suite
  must run serialized (`--parallel=1` / singleFork).
- Memory `angular-typechecker-npm-releases-ship-source` -- v0.1.1 packaging fix
  context (the registry now ships real `.js`).
- `.planning/.continue-here.md` + `.planning/HANDOFF.json` -- the post-v0.1.1
  follow-up handoff defining this work (remaining task 2) and its two blocking
  anti-patterns (real nx add; real pnpm workspace with onlyBuiltDependencies).
- `.planning/quick/260704-mse-fix-nx-release-publishing-typescript-sou/260704-mse-A1-RESEARCH.md`
  -- the @nx/js Verdaccio globalSetup design the new specs build on.
</canonical_refs>
