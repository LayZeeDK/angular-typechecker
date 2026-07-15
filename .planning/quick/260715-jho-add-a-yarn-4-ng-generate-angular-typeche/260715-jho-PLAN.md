---
phase: quick-260715-jho
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts
  - packages/angular-typechecker/src/schematics/configuration/schematic.ts
  - packages/angular-typechecker/src/schematics/init/schematic.ts
  - packages/angular-typechecker/src/schematics/configuration/configuration.spec.ts
  - packages/angular-typechecker/src/schematics/init/init.spec.ts
  - packages/angular-typechecker/README.md
  - .planning/v0.2.1-MILESTONE-AUDIT.md
autonomous: true
requirements: [ACS-01, ACS-03, ACS-04, ACV-02]

# EXECUTION NOTE (orchestrator): run this plan on the MAIN checkout, NO worktree
# isolation. Task 1's e2e needs real node_modules + a Verdaccio build+publish + real
# yarn/`ng` installs (several minutes, shares the ng-cli-e2e globalSetup). Single-plan
# wave -> skip worktrees per AGENTS.md; the executor already has real node_modules.

must_haves:
  truths:
    - "The yarn-4 `ng generate angular-typechecker:configuration` path is empirically exercised on a real yarn 4 workspace and its outcome (chalk.blue crash vs safe) is recorded verbatim in SUMMARY."
    - "A committed ng-cli-e2e cell locks the SUCCESS end-state: `ng generate ...:configuration <app>` wires the app typecheck target and `ng run <app>:typecheck` catches a planted TSxxxx, with NO chalk.blue / ERR_REQUIRE_ESM / infrastructure error."
    - "IF the crash reproduced: the compiled `configuration` and `init` schematic.js load ZERO @nx/devkit; IF it did not: configuration/init stay convertNx (YAGNI, no refactor)."
    - "The v0.2.1-MILESTONE-AUDIT tech_debt item is resolved (verified-safe OR verified-crashed-then-fixed)."
    - "`nx test angular-typechecker`, `nx format:check`, and `nx lint` (maxWarnings:0) are green."
  artifacts:
    - path: "e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts"
      provides: "yarn-4 `ng generate ...:configuration` -> `ng run :typecheck` e2e cell (always)"
      contains: "ng generate angular-typechecker:configuration"
    - path: "packages/angular-typechecker/src/schematics/configuration/schematic.ts"
      provides: "CONDITIONAL (only if crash): vanilla @angular-devkit/schematics Rule over the shared core; ZERO @nx/devkit"
    - path: "packages/angular-typechecker/src/schematics/init/schematic.ts"
      provides: "CONDITIONAL (only if crash): vanilla Rule that logs NO_CACHING_NOTICE + returns tree; ZERO @nx/devkit"
    - path: ".planning/v0.2.1-MILESTONE-AUDIT.md"
      provides: "tech_debt item resolved with the observed outcome"
      contains: "tech_debt"
  key_links:
    - from: "e2e/.../ng-generate-configuration-yarn.e2e.spec.ts"
      to: "setupYarnWorkspace + global-setup.ts"
      via: "reuse the ng-add-ng-run-yarn sibling harness (build+publish once, enableMirror:false)"
      pattern: "setupYarnWorkspace"
    - from: "packages/angular-typechecker/src/schematics/configuration/schematic.ts (if refactored)"
      to: "src/core/angular-cli-wiring"
      via: "import resolveTargetName / resolveTsConfigLeaves / wireTypecheckTarget / NO_CACHING_NOTICE"
      pattern: "core/angular-cli-wiring"
    - from: "dist/.../schematics/{configuration,init}/schematic.js (if refactored)"
      to: "ZERO @nx/devkit"
      via: "rg -uu dist-grep acceptance gate == 0 matches"
      pattern: "@nx/devkit"
---

<objective>
Prove or disprove the `TypeError: chalk.blue is not a function` crash on the yarn-4
`ng generate angular-typechecker:configuration` path by adding a REAL e2e cell that
runs it against a Verdaccio-published local dist. IF the crash reproduces, rewrite the
`configuration` AND `init` Angular CLI schematics as VANILLA @angular-devkit/schematics
Rules over the existing shared `src/core/angular-cli-wiring.ts` (ZERO @nx/devkit at
factory load) -- mirroring the 24-06 vanilla ng-add fix. IF it does NOT reproduce, STOP
after the cell (YAGNI): the committed cell locks the good behavior.

This is CONDITIONAL work: Task 1's empirically observed outcome is the gate for Task 2.

Purpose: resolve the v0.2.1-MILESTONE-AUDIT tech_debt WARNING (gsd-integration-checker
2026-07-15) whose `suggested_resolution` is verbatim this task. Affected REQ-IDs:
ACS-01, ACS-03 (secondarily ACS-04, ACV-02).
Output: a committed yarn-4 `ng generate` e2e cell; conditionally, nx-free vanilla
configuration/init schematics + unit specs; a resolved tech_debt item.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260715-jho-add-a-yarn-4-ng-generate-angular-typeche/260715-jho-CONTEXT.md
@.planning/quick/260715-jho-add-a-yarn-4-ng-generate-angular-typeche/260715-jho-RESEARCH.md
@AGENTS.md
@CLAUDE.md

# The vanilla-schematic template + shared core to mirror (if Task 2 runs):
@packages/angular-typechecker/src/schematics/ng-add/schematic.ts
@packages/angular-typechecker/src/schematics/ng-add/ng-add.spec.ts
@packages/angular-typechecker/src/core/angular-cli-wiring.ts
# The generator CLI branch = the exact logic to replicate for configuration:
@packages/angular-typechecker/src/generators/configuration/generator.ts
@packages/angular-typechecker/src/generators/init/generator.ts
# The e2e harness to model the new cell on:
@e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts

<interfaces>
<!-- Contracts the executor uses directly. No codebase exploration needed. -->

From src/core/angular-cli-wiring.ts (all pure, framework-agnostic; already used by the
Nx configuration generator AND the vanilla ng-add schematic):
- resolveTargetName(targetName: string | undefined, project: string): string
- resolveTsConfigLeaves(root: string, projectType: 'application'|'library'|undefined, tsConfigOverride: string | undefined, project: string, exists: (path: string) => boolean): string[]
- resolveTsConfigOverride(root, tsConfig, project, exists): string  (called internally by resolveTsConfigLeaves when --tsConfig is set)
- wireTypecheckTarget(workspace: AngularJsonWorkspace, project: string, targetName: string, tsConfig: string[]): void
- const NO_CACHING_NOTICE: string
- interface AngularJsonWorkspace { projects: Record<string, AngularJsonProject>; [k: string]: unknown }
- interface AngularJsonProject { projectType?: 'application'|'library'; root?: string; architect?: Record<string, AngularJsonTarget>; [k: string]: unknown }

From src/generators/configuration/schema.d.ts:
- interface ConfigurationGeneratorSchema { project: string; tsConfig?: string; targetName?: string; skipFormat?: boolean }

From src/generators/init/schema.d.ts:
- interface InitGeneratorSchema { skipFormat?: boolean }

Fixture app project (e2e/.../fixtures/ng-cli-workspace/angular.json):
- APP project name = 'ng-cli-workspace', projectType 'application', root '' (flat root app).
  Expected leaf array = ['tsconfig.app.json', 'tsconfig.spec.json'].
- LIB project 'my-lib' exists but is OUT OF SCOPE for the single-project `configuration` command.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (ALWAYS): Add the yarn-4 `ng generate ...:configuration` e2e cell and OBSERVE the crash</name>
  <files>e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts</files>
  <action>
Create the new spec modeled on `ng-add-ng-run-yarn.e2e.spec.ts` (RESEARCH section 2).
Reuse VERBATIM from that sibling: `setupYarnWorkspace` (including the LOAD-BEARING
`enableMirror: false` and all other yarn-4 settings -- nodeLinker node-modules,
npmRegistryServer/authToken -> Verdaccio, unsafeHttpWhitelist 127.0.0.1,
npmMinimalAgeGate 0, enableImmutableInstalls false, per-fixture cacheFolder,
enableGlobalCache false), `typecheckTarget`, `ngRun`, `plant`, `buildCleanEnv({
stripAllNpmConfig: true })`, the `corepackAvailable` guard, the `writeVerdaccioNpmrc`
call, and the `900000` timeout. Shares the existing `global-setup.ts` (build + Verdaccio
publish ONCE) -- no new registry port.

DIFFERENCES from the sibling (per RESEARCH):
- SINGLE `it.skipIf(!corepackAvailable)` test (NOT `.each(['flat','workspace'])`). FLAT
  layout only, APP project `ng-cli-workspace` only (`configuration` is inherently
  single-project; the crash is schematic-factory-load, layout-independent).
- Install via PLAIN `corepack yarn add -D angular-typechecker` (NOT `ng add`): sequence
  is `corepack enable` -> `corepack yarn install` -> `corepack yarn add -D
  angular-typechecker` -> `corepack yarn ng generate angular-typechecker:configuration
  ng-cli-workspace`. Do NOT install `nx` explicitly (it comes in transitively as a direct
  dep since 24-04). No `ng add`. Drop the fixture npm lockfile before yarn install, same
  as the sibling.
- The `ng generate` command needs NO `--skip-confirmation` (no install step) and no
  interactive flag (project is the required positional arg, no x-prompt). Pass the
  project positionally: `... :configuration ng-cli-workspace`.
- ASSERT the SUCCESS end-state (mirror the sibling): after `ng generate`,
  `typecheckTarget(tmp, 'ng-cli-workspace')` has `builder === 'angular-typechecker:typecheck'`
  and `options.tsConfig` EQUALS `['tsconfig.app.json','tsconfig.spec.json']`; the clean
  scaffold `ng run ng-cli-workspace:typecheck` is GREEN (code 0); after `plant(...)` of a
  distinct TSxxxx into the app leaf, `ng run` is non-zero AND stdout contains that full
  'TSxxxx' token; stdout does NOT match `/ERR_REQUIRE_ESM/`, does NOT contain
  'chalk.blue', does NOT contain 'infrastructure error'. Reuse the sibling's
  APP_COMPONENT_ANCHOR/APP_COMPONENT_INJECTION + APP_SPEC_INJECTION plant pattern; only
  the app project is in scope (no library assertions).
- Add a file-header comment matching the sibling's style explaining this cell is the
  ARBITER for the yarn-4 `ng generate ...:configuration` crash prove/disprove.

Follow the project JS/TS style (blank lines around control flow/returns, always-braces,
singleQuote). No new dependency; no `npm pack`; no `nx build angular-typechecker` inside
the spec (build runs once upstream via dependsOn -- do not violate the coverage-guard
invariants noted in RESEARCH section 2).

Then BUILD + RUN the ng-cli-e2e suite on the MAIN checkout to OBSERVE the outcome:
`NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` (slow;
generous timeout / run in background). Because the crash proof is TRANSIENT, this cell
MAY FAIL with `chalk.blue is not a function` during `ng generate` -- that failure IS the
"prove" and is the expected HIGH-confidence outcome per RESEARCH. RECORD the observed
result in SUMMARY.md as ONE of THREE outcomes -- this observed outcome is the GATE for
Task 2 and Task 3:
- CRASH: the cell failed with `chalk.blue is not a function` (record the verbatim
  ANSI-stripped crash output) -> Task 2 RUNS.
- GREEN: the cell actually EXECUTED (vitest reports 1 test passed for this cell, NOT
  skipped) and passed with no crash -> Task 2 SKIPPED (YAGNI).
- INCONCLUSIVE: the cell was SKIPPED because `corepackAvailable` is false (corepack yarn
  4.17.0 could not provision in this environment), so nothing was empirically exercised.
  MANDATORY GUARD against a false "verified safe": you MUST confirm the cell truly ran by
  inspecting the vitest output -- a skipped test is NOT a pass. If INCONCLUSIVE, STOP after
  recording it: do NOT run Task 2, and do NOT let Task 3 resolve the tech_debt as
  verified-safe (leave the ACS-01/ACS-03 `*` caveats in place and record that the yarn
  `ng generate` verification could not be run here). (In this repo corepack yarn already
  provisions -- the existing yarn ng-add e2e proved the 24-06 fix -- so a CRASH or GREEN is
  expected; the INCONCLUSIVE branch exists only so an environment failure cannot silently
  masquerade as a clean result.)
  </action>
  <verify>
    <automated>test -f e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts &amp;&amp; rg -q "corepack yarn ng generate angular-typechecker:configuration" e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts &amp;&amp; rg -q "enableMirror: false" e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts</automated>
    <human-check>The ng-cli-e2e suite was executed on the main checkout and the ng-generate-configuration-yarn cell's outcome (CRASH / GREEN-and-actually-ran / INCONCLUSIVE-corepack-skip) is recorded in SUMMARY.md as the Task 2 gate. A skipped test is NOT a GREEN pass.</human-check>
  </verify>
  <done>The new spec file exists, models the yarn sibling harness (reuses setupYarnWorkspace incl. enableMirror:false), runs `corepack yarn add -D angular-typechecker` then `corepack yarn ng generate angular-typechecker:configuration ng-cli-workspace`, and asserts the wired target + planted-TSxxxx catch + no chalk.blue/ERR_REQUIRE_ESM/infrastructure error. The ng-cli-e2e suite has been RUN on the main checkout and the observed crash-vs-green outcome is recorded verbatim in SUMMARY.md. That outcome gates Task 2.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (CONDITIONAL -- only if Task 1 observed the chalk.blue crash): rewrite configuration + init as vanilla nx-free schematics</name>
  <files>packages/angular-typechecker/src/schematics/configuration/schematic.ts, packages/angular-typechecker/src/schematics/init/schematic.ts, packages/angular-typechecker/src/schematics/configuration/configuration.spec.ts, packages/angular-typechecker/src/schematics/init/init.spec.ts</files>
  <behavior>
    (Unit specs via @angular-devkit/schematics/testing, mirroring ng-add.spec.ts -- the
    Rule is SYNCHRONOUS, invoked directly with a `{ logger: runner.logger }` context so
    context.logger notices are capturable; wrap in an async helper so a synchronous throw
    surfaces for rejects.toThrow.)
    configuration:
    - Seeds angular.json with a root app + leaf tsconfigs -> wires
      architect.typecheck = { builder: 'angular-typechecker:typecheck', options.tsConfig:
      ['tsconfig.app.json','tsconfig.spec.json'] }.
    - Idempotent re-run preserves user-added options/configurations.
    - A same-named NON-ours target throws /already has a "typecheck" target/.
    - `--project` not found in angular.json throws /was not found in angular.json/.
    - `--tsConfig` override yields the single-element resolved array.
    - Prints NO_CACHING_NOTICE exactly once on the wire path.
    init:
    - Prints NO_CACHING_NOTICE and returns the tree unchanged; creates NO nx.json;
      loads ZERO @nx/devkit.
  </behavior>
  <action>
GATE: SKIP this entire task if Task 1 observed GREEN (no crash). Per CONTEXT/RESEARCH
YAGNI: if the cell passed, configuration/init stay convertNx untouched -- do not refactor
speculatively. Only proceed if Task 1 recorded the `chalk.blue is not a function` crash.

Rewrite `src/schematics/configuration/schematic.ts` as a VANILLA
@angular-devkit/schematics Rule mirroring `src/schematics/ng-add/schematic.ts` over the
shared core (RESEARCH section 3). Import `Rule`, `Tree`, `SchematicContext` TYPE-ONLY
from `@angular-devkit/schematics` (erased at compile so the compiled schematic.js
requires ONLY `../../core/angular-cli-wiring`). Default-export
`function configuration(options: ConfigurationGeneratorSchema): Rule` returning `(tree,
context) => Tree`. Replicate the generator's CLI branch
(generators/configuration/generator.ts lines 136-178): resolve `targetName` via
`resolveTargetName(options.targetName, options.project)`; read+parse angular.json via
`tree.read('angular.json')` cast to `AngularJsonWorkspace`; look up
`workspace.projects[options.project]` and throw `Project "<project>" was not found in
angular.json.` if absent; resolve leaves via `resolveTsConfigLeaves(project.root ?? '',
project.projectType, options.tsConfig, options.project, (p) => tree.exists(p))`; call
`wireTypecheckTarget(workspace, options.project, targetName, tsConfig)`; persist via
`tree.overwrite('angular.json', ...JSON.stringify(workspace, null, 2)...\n)`; then
`context.logger.info(NO_CACHING_NOTICE)` and `return tree`. `--skipFormat` is accepted for
schema parity but is a NO-OP on the vanilla path (no devkit Prettier pass) -- same as
ng-add. Preserve every error string byte-for-byte from the CLI branch/shared core. The Nx
solution-walk branch is DROPPED from the vanilla schematic (only reachable when nx.json
exists; Nx users invoke `nx g`, the unchanged generator) -- flag this edge in the doc
comment as RESEARCH pitfall 2 describes.

Rewrite `src/schematics/init/schematic.ts` as a VANILLA Rule: default-export
`function init(options: InitGeneratorSchema): Rule` returning `(tree, context) => Tree`
that logs `context.logger.info(NO_CACHING_NOTICE)` and returns the tree unchanged (the
generator's Angular-CLI CLI branch behavior; do NOT silently return without the notice --
the ACS-03 behavior is asserted). ZERO @nx/devkit.

Add unit specs `configuration.spec.ts` and `init.spec.ts` in the respective schematics
dirs via @angular-devkit/schematics/testing, mirroring ng-add.spec.ts exactly (direct
synchronous Rule invocation with a `runner.logger`-backed context; async run helper for
rejects.toThrow). Cover the behaviors listed above.

Keep UNCHANGED: both generators (`generators/configuration/generator.ts`,
`generators/init/generator.ts`), `collection.json`, `generators.json`, all
`schema.json`/`schema.d.ts`, and `src/core/angular-cli-wiring.ts` (the core already
exports everything needed). `@angular-devkit/schematics` is ALREADY in the eslint
`@nx/dependency-checks` `ignoredDependencies` (eslint.config.mjs) -- verify, do NOT
re-add. Follow the JS/TS style (blank lines around control flow/returns, always-braces,
singleQuote).

Rebuild the plugin (`NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache`)
and prove the LOAD-BEARING invariant with the dist-grep (dist is gitignored -> `rg -uu`,
NOT git grep). Then re-run the ng-cli-e2e suite -> the new cell must now be GREEN.
  </action>
  <verify>
    <automated>if git grep -q "convertNxGenerator" -- packages/angular-typechecker/src/schematics/configuration/schematic.ts; then echo "Task 2 SKIPPED (configuration still convertNx -- Task 1 was GREEN/INCONCLUSIVE) -- dist-grep N/A, OK"; else test "$(rg -uu -l "@nx/devkit" dist/packages/angular-typechecker/src/schematics/configuration/schematic.js dist/packages/angular-typechecker/src/schematics/init/schematic.js 2>/dev/null | wc -l)" -eq 0; fi</automated>
    <human-check>SKIPPED if Task 1 did not observe the crash (configuration/init stay convertNx -- the automated check short-circuits on the surviving `convertNxGenerator` import and passes trivially). Otherwise (crash observed): `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` is GREEN (the ng-generate-configuration-yarn cell now passes), and `nx test angular-typechecker` covers the new configuration.spec.ts + init.spec.ts.</human-check>
  </verify>
  <done>SKIPPED if Task 1 did not observe the crash (configuration/init stay convertNx, YAGNI). IF the crash was observed: `configuration` and `init` are vanilla @angular-devkit/schematics Rules over the shared core with type-only devkit imports; compiled `dist/.../schematics/{configuration,init}/schematic.js` contain ZERO @nx/devkit (rg -uu == 0); new unit specs pass; the ng-cli-e2e ng-generate-configuration-yarn cell is now GREEN; generators/collection.json/generators.json/schema files are byte-unchanged.</done>
</task>

<task type="auto">
  <name>Task 3 (ALWAYS): regression + docs -- run in-repo gates green, resolve tech_debt, update README if behavior changed</name>
  <files>.planning/v0.2.1-MILESTONE-AUDIT.md, packages/angular-typechecker/README.md</files>
  <action>
Run the affected in-repo suites GREEN on the main checkout:
`NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` (covers the
configuration/init generator specs, the schematic specs incl. any new ones from Task 2,
nx-generators-surface-regression, package-manifest, angular-cli-docs, ci-e2e-coverage-guard),
plus the two required CI gates that phase verification frequently skips (memory:
verify-format-and-lint-before-release): `npx nx lint angular-typechecker` (maxWarnings:0)
and `npx nx format:check` (or `nx format:check --base origin/main`).

Update `.planning/v0.2.1-MILESTONE-AUDIT.md` to RESOLVE the tech_debt item per the
observed outcome:
- IF Task 2 ran (crash verified -> fixed vanilla): rewrite the tech_debt item to
  "RESOLVED (quick 260715-jho): yarn-4 `ng generate ...:configuration` DID crash with
  `chalk.blue is not a function`; configuration + init are now nx-free vanilla schematics
  (dist schematic.js @nx/devkit-free), proven by the new ng-cli-e2e cell + unit specs."
  Lift the ACS-01/ACS-03 `*` unverified-caveats in the requirements table and the audit
  prose (they are now e2e-proven, not just unit-proven). Update `status`/`scores` if the
  1-warning integration gap is now closed.
- IF Task 2 was SKIPPED because Task 1 was GREEN-AND-ACTUALLY-RAN (verified safe): rewrite
  the tech_debt item to "RESOLVED (quick 260715-jho): yarn-4 `ng generate ...:configuration`
  was empirically exercised and did NOT crash; the convertNx configuration/init schematics
  are safe on yarn 4. Locked by the new ng-cli-e2e cell." Adjust the ACS-01/ACS-03 `*`
  caveats to reflect e2e-verified-safe.
- IF Task 1 was INCONCLUSIVE (corepack yarn could not provision -> the cell was SKIPPED,
  nothing exercised): do NOT resolve the tech_debt as safe or fixed. LEAVE the ACS-01/ACS-03
  `*` caveats IN PLACE and update the tech_debt item to note "quick 260715-jho added the
  e2e cell but could not execute it here (corepack yarn unavailable); the yarn-4 `ng
  generate ...:configuration` verification remains OUTSTANDING -- re-run
  `nx e2e angular-typechecker-ng-cli-e2e` in an environment with corepack yarn." Make NO
  README behavior claim. This branch prevents a false "verified safe" resolution.

Update README `## Angular CLI` note ONLY if the yarn `ng generate` behavior changed
(packages/angular-typechecker/README.md, around the "Wire a single project" section): if
Task 2 ran, ensure the `ng generate angular-typechecker:configuration <project>` docs
carry no stale yarn caveat and match the now-nx-free behavior; if verified-safe, no README
change is needed beyond confirming the existing text is accurate. Keep README/CHANGELOG
prose end-user-facing (no internal plan/board ids) per the CHANGELOG-readme rule. Do NOT
cut a release, do NOT bump package.json version (stays 0.2.0).

COMMITS (AGENTS.md; stage by name, never `git add .`/`-A`/`-u`; no AI attribution):
- The e2e cell (Task 1): `test(e2e): add yarn-4 ng generate configuration cell`.
- IF Task 2 ran, the vanilla refactor: `fix(schematics): make configuration + init
  vanilla nx-free (yarn-4 chalk.blue crash)` (release-meaningful scope; touches
  packages/angular-typechecker -> changelog-relevant).
- The audit/README docs: `docs(v0.2.1): resolve ng generate yarn-4 tech_debt`.
Commit STATE.md is NOT this plan's job (the quick-task workflow owns it).
  </action>
  <verify>
    <automated>NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache</automated>
    <human-check>`nx lint angular-typechecker` (maxWarnings:0) and `nx format:check` are both green; the v0.2.1-MILESTONE-AUDIT tech_debt item reads RESOLVED with the observed outcome; README `## Angular CLI` is accurate for the yarn `ng generate` behavior; changes committed by name with the AGENTS.md conventions (no version bump, no release).</human-check>
  </verify>
  <done>`nx test angular-typechecker`, `nx lint` (maxWarnings:0), and `nx format:check` are green. The milestone-audit tech_debt item is resolved (either "verified crashes -> fixed vanilla" with ACS-01/ACS-03 `*` caveats lifted, or "verified safe"). README `## Angular CLI` matches the observed behavior. Changes are committed with the correct AGENTS.md scopes (test/fix/docs), staged by name, no version bump, no release.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Verdaccio registry -> yarn install (e2e) | The e2e installs the locally-built angular-typechecker dist (own package) from a loopback Verdaccio; no external/untrusted package crosses. |
| Angular CLI schematic-factory load -> nx runtime | The convertNx schematics `require('@nx/devkit')` at load, pulling nx's transitive chain -- the yarn-4 crash surface this task removes (conditionally). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jho-01 | Denial of Service | `ng generate ...:configuration` on yarn 4 | mitigate | The e2e cell PROVES/DISPROVES the chalk.blue crash; if it crashes, the vanilla rewrite removes the @nx/devkit load path entirely (dist-grep == 0). |
| T-jho-02 | Tampering | `configuration`/`init` public surface | mitigate | Generators, collection.json, generators.json, all schema.json/schema.d.ts stay byte-unchanged; surface-regression + schema-parity + package-manifest specs lock the surface; only the compiled impl changes. |
| T-jho-03 | Tampering | npm/yarn installs (e2e) | accept | No NEW dependency added; the e2e installs only the project's own Verdaccio-published dist over loopback. No package-legitimacy gate required (RESEARCH: no new packages). |
</threat_model>

<verification>
- Task 1: new spec exists, reuses the yarn harness (enableMirror:false), runs the real
  `corepack yarn ng generate ...:configuration`, and its crash-vs-green outcome is
  recorded in SUMMARY as the Task 2 gate.
- Task 2 (conditional): dist `schematic.js` for configuration + init contain ZERO
  @nx/devkit (rg -uu == 0); the ng-cli-e2e cell is GREEN; new unit specs pass; surface
  byte-stable.
- Task 3: `nx test angular-typechecker` + `nx lint` (maxWarnings:0) + `nx format:check`
  green; tech_debt resolved; README accurate; committed with AGENTS.md conventions.
</verification>

<success_criteria>
- The yarn-4 `ng generate angular-typechecker:configuration` path is empirically settled
  and its outcome recorded.
- A committed ng-cli-e2e cell locks the SUCCESS end-state on yarn 4.
- IF crash: configuration + init are nx-free vanilla schematics (dist @nx/devkit-free),
  with unit specs; the e2e cell is green. IF safe: no refactor (YAGNI).
- The v0.2.1-MILESTONE-AUDIT tech_debt item is resolved; ACS-01/ACS-03 caveats updated.
- `nx test` / `nx lint` (maxWarnings:0) / `nx format:check` all green. No version bump, no
  release.
</success_criteria>

<output>
Create `.planning/quick/260715-jho-add-a-yarn-4-ng-generate-angular-typeche/260715-jho-SUMMARY.md` when done.
CRITICAL: record the Task 1 observed outcome (verbatim ANSI-stripped crash output OR
"GREEN, no crash") -- it is the gate that determined whether Task 2 ran.
</output>
