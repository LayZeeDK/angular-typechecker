---
status: complete
phase: quick-260715-jho
plan: 01
subsystem: angular-cli-schematics / e2e
tags: [e2e, yarn-4, ng-generate, configuration, chalk.blue, tech_debt, ACS-01, ACS-03]
dependency_graph:
  requires:
    - "e2e/angular-typechecker-ng-cli-e2e (shared Verdaccio globalSetup + yarn harness)"
    - "packages/angular-typechecker (Verdaccio-published local dist, v0.2.0)"
  provides:
    - "CI-authoritative yarn-4 `ng generate :configuration` -> `ng run :typecheck` e2e cell"
    - "empirical resolution of the v0.2.1-MILESTONE-AUDIT tech_debt (verified safe)"
  affects:
    - ".planning/v0.2.1-MILESTONE-AUDIT.md (tech_debt resolved; status passed)"
tech_stack:
  added: []
  patterns:
    - "arbiter e2e cell: install the real dist via `corepack yarn add -D` then run the real `ng generate`; a factory-load crash surfaces LOUDLY via sh() rethrow"
key_files:
  created:
    - "e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts"
  modified:
    - ".planning/v0.2.1-MILESTONE-AUDIT.md (uncommitted -- orchestrator commits .planning)"
decisions:
  - "Task 1 outcome = GREEN (ran, 1 passed, ~84s -- NOT skipped): yarn-4 `ng generate angular-typechecker:configuration` did NOT crash with chalk.blue."
  - "Task 2 SKIPPED (YAGNI): configuration/init stay convertNx -- no speculative refactor because the crash did not reproduce."
  - "Task 3 resolved the tech_debt as verified-safe (GREEN branch); ACS-01/ACS-03 `*` caveats lifted to e2e-verified-safe; no README change (docs already accurate)."
metrics:
  duration: ~15 min (dominated by the ~556s e2e suite run)
  completed: 2026-07-15
requirements_completed: [ACS-01, ACS-03, ACS-04, ACV-02]
---

# Phase quick-260715-jho Plan 01: yarn-4 `ng generate :configuration` e2e cell + conditional vanilla refactor Summary

Added a CI-authoritative yarn-4 `ng generate angular-typechecker:configuration` e2e cell that
empirically DISPROVED the `chalk.blue is not a function` crash prediction, so the convertNx
`configuration`/`init` schematics were verified safe and left untouched (no refactor), and the
v0.2.1-MILESTONE-AUDIT tech_debt closed as verified-safe.

## Task 1 (ALWAYS) -- observed outcome: **GREEN (ran, did NOT crash)**

Created `e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts`, modeled
on the yarn sibling (`ng-add-ng-run-yarn.e2e.spec.ts`): reuses the yarn-4 harness verbatim
(`enableMirror: false` + nodeLinker node-modules + Verdaccio registry/authToken + unsafeHttpWhitelist
127.0.0.1 + npmMinimalAgeGate 0 + enableImmutableInstalls false + per-fixture cacheFolder +
enableGlobalCache false), `typecheckTarget` / `ngRun` / `plant` / `buildCleanEnv({ stripAllNpmConfig:
true })` / the `corepackAvailable` guard / `writeVerdaccioNpmrc` / the `900000` timeout, and shares the
build-once Verdaccio `global-setup.ts` (no new registry port). Differences per plan: SINGLE
`it.skipIf(!corepackAvailable)` test, FLAT layout, APP project `ng-cli-workspace` only; install via
plain `corepack yarn add -D angular-typechecker` (NOT `ng add`); command
`corepack yarn ng generate angular-typechecker:configuration ng-cli-workspace` (project positional, no
`--skip-confirmation`, no interactive flag).

Ran `NX_DAEMON=false npx nx e2e angular-typechecker-ng-cli-e2e --skip-nx-cache` on the MAIN checkout
(no worktree). **Observed result: GREEN.** The new cell EXECUTED (it was NOT skipped -- corepack yarn
4.17.0 provisioned) and PASSED:

```
 ✓ |angular-typechecker-ng-cli-e2e| src/ng-generate-configuration-yarn.e2e.spec.ts (1 test) 84012ms
     ✓ ng generate wires the app typecheck target and ng run catches planted leaf errors (chalk.blue arbiter)  84010ms
 ...
 Test Files  4 passed (4)
      Tests  5 passed (5)
   Duration  556.42s
 NX   Successfully ran target e2e for project angular-typechecker-ng-cli-e2e and 2 tasks it depends on
```

The full suite (yarn ng-add flat+workspace, this new ng-generate arbiter, npm ng-add, pnpm ng-add) is
green -- no regression. `ng generate angular-typechecker:configuration ng-cli-workspace` under real
yarn 4:
- did NOT throw `TypeError: chalk.blue is not a function` (the convertNx factory-load crash did NOT
  reproduce, contradicting the RESEARCH HIGH-confidence prediction);
- wired the app `typecheck` target with `builder: angular-typechecker:typecheck` and
  `options.tsConfig === ['tsconfig.app.json', 'tsconfig.spec.json']`;
- created no stray `nx.json`;
- `ng run ng-cli-workspace:typecheck` was GREEN on the clean scaffold, then caught the planted TS2322
  (app build leaf) + TS2345 (app spec leaf), with no `ERR_REQUIRE_ESM`, no `chalk.blue`, no
  `infrastructure error`.

There is NO verbatim crash output to record because there was NO crash: the observed outcome is
GREEN-and-actually-ran, not CRASH and not INCONCLUSIVE (the skip guard did not fire -- the cell shows
`✓ (1 test) 84012ms`, a real 84s execution, not a `↓ skipped`).

## Task 2 (CONDITIONAL) -- **SKIPPED**

Task 2 was gated on Task 1 observing the crash. Task 1 was GREEN, so per YAGNI (CONTEXT/RESEARCH: "if
it does NOT reproduce, STOP -- do not refactor") Task 2 did NOT run. `configuration`/`init` remain
`convertNxGenerator(...)`-based, untouched. No source code under `packages/angular-typechecker/`
changed. The committed cell locks the good behavior; the schematics are verified safe on yarn 4 as-is.

## Task 3 (ALWAYS) -- in-repo gates + tech_debt resolution

In-repo gates on the MAIN checkout, all GREEN:

- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` -> **39 files, 373 tests passed**.
- `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` -> **All files pass linting**
  (maxWarnings:0). The new spec (in the `angular-typechecker-ng-cli-e2e` project, which has no `nx`
  lint target) was validated directly with `npx eslint <spec>` (exit 0) and `npx prettier --check`
  (clean).
- `NX_DAEMON=false npx nx format:check` -> **exit 0**.

Milestone audit (`.planning/v0.2.1-MILESTONE-AUDIT.md`, edited but UNCOMMITTED -- orchestrator commits
`.planning/`): resolved the tech_debt via the GREEN branch. `status: tech_debt` -> `passed`;
`integration: 7-of-8-wired (1 warning)` -> `8-of-8-wired`; `flows: 3/4 proven` -> `4/4 proven`. The
`tech_debt` list is now empty with a `resolved_debt` record. The verdict prose, requirements table
(ACS-01/ACS-03 `*` caveats lifted to e2e-verified-safe), Cross-Phase Integration section (8th seam
WIRED), E2E Flows section (flow 4 PROVEN), the Resolved Debt section, and Notable findings #2 were all
updated to the verified-safe outcome.

README (`packages/angular-typechecker/README.md`): NO change. The `## Angular CLI` `ng generate
angular-typechecker:configuration <project>` docs carry no yarn caveat, which is now confirmed
accurate (the path is verified safe on yarn 4). No version bump (stays `0.2.0`); no release cut.

## Deviations from Plan

None. Task 1 ran and produced a clean GREEN outcome; Task 2 was correctly gated out; Task 3 followed
the GREEN-branch resolution verbatim. No auto-fixes, no auth gates, no architectural decisions.

## Commits (this plan)

```
08cb451 test(e2e): add yarn-4 ng generate configuration cell
```

Only the Task 1 e2e cell was committed (code). Task 2 did not run (no `fix(schematics)` commit). The
README was unchanged (no `docs(cli)` commit). The milestone-audit edits are left uncommitted for the
orchestrator (`.planning/` is orchestrator-owned).

## Self-Check: PASSED

- `e2e/angular-typechecker-ng-cli-e2e/src/ng-generate-configuration-yarn.e2e.spec.ts` -> FOUND (committed in 08cb451).
- Commit `08cb451` -> FOUND in `git log`.
- `.planning/v0.2.1-MILESTONE-AUDIT.md` -> modified in working tree (uncommitted, by design).
