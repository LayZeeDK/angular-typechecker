# Quick Task 260715-jho: yarn-4 `ng generate angular-typechecker:configuration` e2e cell + conditional vanilla refactor - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-decided; none fell in the HIGH-IMPACT + LOW-CONFIDENCE trap quadrant, so no escalation was required)

<domain>
## Task Boundary

Add an e2e cell that runs a REAL `ng generate angular-typechecker:configuration <project>` on an
Angular CLI + yarn 4 (berry) workspace (installing the Verdaccio-published local dist), to
PROVE or DISPROVE the `TypeError: chalk.blue is not a function` crash on the `ng generate` path.

IF the crash reproduces: rewrite the Angular CLI `configuration` AND `init` schematics
(`src/schematics/configuration/schematic.ts`, `src/schematics/init/schematic.ts`) as VANILLA
`@angular-devkit/schematics` Rules that load ZERO `@nx/devkit`/`nx` at runtime, using the existing
shared framework-agnostic core `src/core/angular-cli-wiring.ts` -- mirroring the 24-06/Option C
`ng-add` fix. The Nx generators (`generators/configuration/generator.ts`, `generators/init/generator.ts`,
used by `nx g`) and `collection.json` stay unchanged.

This resolves the v0.2.1-MILESTONE-AUDIT tech_debt item (WARNING from gsd-integration-checker,
2026-07-15) whose `suggested_resolution` is verbatim this task. Affected REQ-IDs: ACS-01, ACS-03
(secondarily ACS-04, ACV-02).
</domain>

<decisions>
## Implementation Decisions

### Crash mechanism (established, not re-derived)
- nx's bundled CJS `log-symbols@4` calls `chalk.blue()` at MODULE LOAD expecting chalk v4.
  The Angular CLI schematic process ALSO carries chalk v5 (ESM, no named `.blue`) via
  `@angular-devkit/schematics -> ora@8 -> log-symbols@6 -> chalk@5`. Under yarn 4's last-in-wins
  hoist the CJS `log-symbols@4`'s `require('chalk')` reaches the hoisted v5 -> `chalk.blue is not a
  function`. `configuration`/`init` schematics are still `convertNxGenerator(...)` -> their compiled
  `schematic.js` does `require('@nx/devkit')` -> nx -> log-symbols@4. Full proof in
  `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md`.
- OPEN (this is the prove/disprove): whether `ng generate` (a DIFFERENT command from `ng add`)
  actually triggers the crash. The earlier "listr2 in the add command" attribution was REFUTED
  (listr2 uses colorette); the corrected v5-chalk source is schematics' `ora@8`, which `ng generate`
  ALSO loads. So the strong hypothesis is that `ng generate ...:configuration` DOES crash on yarn 4 --
  but a clean standalone nx-chain load did NOT reproduce it in prior spikes, so it is genuinely open.
  The e2e cell is the experiment.

### Cell location & harness
- NEW spec file: `e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts`.
  Reuses the existing ng-cli-e2e `global-setup.ts` (build + Verdaccio publish ONCE) and the
  `setupYarnWorkspace` recipe from `ng-add-ng-run-yarn.e2e.spec.ts` (nodeLinker node-modules,
  npmRegistryServer/authToken -> Verdaccio, unsafeHttpWhitelist 127.0.0.1, npmMinimalAgeGate 0,
  enableImmutableInstalls false, per-fixture cacheFolder, enableGlobalCache false,
  **enableMirror false** -- all load-bearing).
  Rationale: separate concern from `ng add`; one-file-per-flow matches the existing layout; shares
  the build-once globalSetup so no extra Verdaccio port.

### What the cell runs
- `corepack enable` -> `corepack yarn install` -> `corepack yarn add -D angular-typechecker`
  (plain add: installs the Verdaccio local dist + `nx` transitively -- nx is a DIRECT dep since 24-04;
  yarn only skips the `@nx/devkit` peer) -> `corepack yarn ng generate angular-typechecker:configuration <APP_PROJECT>`.
  NO `ng add` (that path is already covered + already nx-free). The `ng generate` command is the
  UNTESTED path that loads the convertNx schematic.
- Then assert the typecheck target wired into `<APP_PROJECT>`, and `ng run <APP_PROJECT>:typecheck`
  catches a planted leaf error (proves the wired target actually runs), mirroring the sibling yarn spec.

### Assertion strategy (prove/disprove -> lock the good state)
- The COMMITTED cell asserts the SUCCESS end-state (target wired with `angular-typechecker:typecheck`
  builder + `[tsconfig.app.json, tsconfig.spec.json]` leaf array; `ng run :typecheck` green then
  catches a planted `TSxxxx`; NO `chalk.blue`, NO `ERR_REQUIRE_ESM`, NO "infrastructure error").
- The crash proof is TRANSIENT: if the current convertNx schematic crashes, the cell FAILS with
  `chalk.blue` during execution -- that failure IS the "prove". The executor then applies the
  refactor to make it pass, and records the observed crash output in SUMMARY.md. The cell locks the
  correct long-term behavior, not the crash.

### Layout
- FLAT layout only, wiring the APP project (`ng-cli-workspace`) via `--project`. The crash is
  layout-independent (schematic-factory load, not project topology), and `configuration` is inherently
  single-project. YAGNI on a second layout; `ng add`'s two-layout matrix already covers wiring topology.

### Refactor scope IF the crash reproduces (user pre-decided: "if it crashes, make ... vanilla")
- Rewrite `src/schematics/configuration/schematic.ts` as a VANILLA `@angular-devkit/schematics` Rule:
  type-only devkit-schematics imports (erased at compile), ZERO `@nx/devkit`. Reads angular.json
  directly for the single `--project`; uses `resolveTargetName` + `resolveTsConfigLeaves`
  (+ `resolveTsConfigOverride` via the leaves helper) + `wireTypecheckTarget` from the shared core;
  honors `--tsConfig`, `--targetName`; `--skipFormat` is a no-op on the vanilla path (schema parity).
  This is the generator's CLI branch, hand-written over the shared core -- NOT a blind duplicate.
- Rewrite `src/schematics/init/schematic.ts` as a VANILLA Rule. On an Angular CLI workspace `init` is a
  near-no-op (seeds no caching, creates no nx.json); the vanilla Rule returns the tree unchanged
  (matching the current CLI-branch behavior). ZERO `@nx/devkit`.
- UNCHANGED: `generators/configuration/generator.ts`, `generators/init/generator.ts` (the `nx g` path
  stays convertNx-free-of-change), `collection.json`, all `schema.json`/`schema.d.ts` (so the surface
  is byte-stable). `generators.json` untouched -> `nx g`/`nx add` resolve via `generators ?? schematics`.
- LOAD-BEARING invariant (same as 24-06): the COMPILED `dist/.../schematics/configuration/schematic.js`
  and `.../init/schematic.js` must contain ZERO `@nx/devkit`. A dist-grep acceptance check proves it.
- Add `@angular-devkit/schematics` to the eslint `@nx/dependency-checks` `ignoredDependencies` IF not
  already present (24-06 added it for ng-add; likely already there -- verify, don't double-add).

### Tests to keep green (regression gate)
- Migrate/add unit specs for the vanilla `configuration` (and `init`) schematics via
  `@angular-devkit/schematics/testing` (pattern: `schematics/ng-add/ng-add.spec.ts`), IF refactored.
- Keep green: all `generators/configuration/*.spec.ts` (generator unchanged), `generators/init/*.spec.ts`,
  `schematics/**` specs, `nx-generators-surface-regression.spec.ts`, `package-manifest.spec.ts`,
  `angular-cli-docs.spec.ts`, `ci-e2e-coverage-guard.spec.ts` (a new e2e spec file may need registering).
- Run `format:check` + `lint` (maxWarnings:0) before declaring done -- both are required CI gates and
  are frequently skipped by phase verification (see memory: verify-format-and-lint-before-release).

### Execution environment
- Run on the MAIN checkout, NO worktree isolation. The e2e needs real `node_modules` + a Verdaccio
  build+publish + real yarn/`ng` installs; it is SLOW (several minutes) and shares the ng-cli-e2e
  globalSetup. Command: `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache`
  with a generous timeout / background run. (AGENTS.md: single-plan wave -> skip worktrees.)
</decisions>

<specifics>
## Specific Ideas

- Model the new spec on `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts`
  (reuse `setupYarnWorkspace`, `typecheckTarget`, `ngRun`, `plant`, the corepack availability guard,
  `buildCleanEnv({ stripAllNpmConfig: true })`, `writeVerdaccioNpmrc`, the 900000ms timeout).
- The refactor mirror is `src/schematics/ng-add/schematic.ts` (already vanilla) + the shared core
  `src/core/angular-cli-wiring.ts`.
- If the crash does NOT reproduce: STOP after the cell. Do NOT refactor (YAGNI) -- configuration/init
  stay convertNx, the cell locks the good behavior, and the tech_debt is resolved as "verified safe".
  Update the milestone-audit tech_debt note + README accordingly.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/debug/resolved/cli-yarn-e2e-wrong-version.md` -- full chalk.blue root-cause + Option C/D spikes.
- `.planning/v0.2.1-MILESTONE-AUDIT.md` -- tech_debt item + `suggested_resolution` (this task).
- `.planning/HANDOFF.json` -- 24-06 decisions (vanilla ng-add; configuration/init stay convertNx UNTIL proven broken).
- `src/core/angular-cli-wiring.ts` -- the shared framework-agnostic wiring core (already exists).
- `src/schematics/ng-add/schematic.ts` -- the vanilla-schematic pattern to mirror.
- AGENTS.md -- worktree/node_modules rules; Windows arm64 shell rules; release gates.
</canonical_refs>
