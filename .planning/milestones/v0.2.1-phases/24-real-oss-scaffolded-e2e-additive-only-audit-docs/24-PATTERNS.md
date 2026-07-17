# Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 13 new/modified (11 code/test + 2 docs) + 2 verification artifacts
**Analogs found:** 12 / 13 (one new root fixture has only a partial analog -- no existing `angular.json` fixture)

This phase ships NO production code. Every file below is a NEW test/e2e/tripwire file that COPIES an existing analog, or a docs edit that mirrors an existing section. The planner should treat "copy the analog and adapt" as the default action for all of them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `e2e/angular-typechecker-ng-cli-e2e/project.json` | config | N/A | `e2e/angular-typechecker-install-e2e/project.json` | exact |
| `e2e/angular-typechecker-ng-cli-e2e/vitest.config.mts` | config | N/A | `e2e/angular-typechecker-install-e2e/vitest.config.mts` | exact |
| `e2e/angular-typechecker-ng-cli-e2e/tsconfig.json` | config | N/A | `e2e/angular-typechecker-install-e2e/tsconfig.json` | exact |
| `e2e/angular-typechecker-ng-cli-e2e/tsconfig.spec.json` | config | N/A | `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` | exact |
| `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` | test (setup) | file-I/O + process-spawn | `e2e/angular-typechecker-install-e2e/src/global-setup.ts` | exact (copy verbatim) |
| `e2e/angular-typechecker-ng-cli-e2e/src/*.e2e.spec.ts` | test | request-response (execSync) | `e2e/angular-typechecker-install-e2e/src/nx-add-npm.e2e.spec.ts` | role-match |
| `e2e/angular-typechecker-ng-cli-e2e/fixtures/<scaffold>/` | fixture | file-I/O | `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` | role-match (Ng CLI workspace, not Nx consumer) |
| `src/builders/typecheck/builder.integration.spec.ts` | test | request-response (BuilderContext) | `src/builders/typecheck/builder.spec.ts` + `src/core/multi-tsconfig.integration.spec.ts` | role-match / partial |
| `fixtures/builder-context/` (+ `angular.json`) | fixture | file-I/O | `fixtures/multi-tsconfig-array/` (+ NO existing `angular.json` fixture) | partial |
| `src/index.drift.ts` | test (compile-time tripwire) | transform | `src/core/compiler-cli-types.drift.ts` | exact (idiom) |
| `packages/angular-typechecker/tsconfig.drift.json` | config | N/A | (self; add the new drift file to `files`) | exact |
| `src/angular-cli-docs.spec.ts` | test (docs tripwire) | file-I/O (README read) | `src/storybook-docs.spec.ts` | exact (idiom) |
| `packages/angular-typechecker/README.md` (`## Angular CLI`) | docs | N/A | the shipped `## Storybook` section (same file) | exact (tone/length precedent) |
| `CHANGELOG.md` (0.2.1 entry) | docs | N/A | the `0.2.0` entry (same file) | exact (style precedent) |
| ACV-01 UAT procedure (verification doc) | docs | N/A | `.planning/milestones/v0.2.0-phases/19-.../19-UAT.md` | exact (structure) |
| ACP-02 git-diff audit (verification output) | audit | N/A | recorded in VERIFICATION.md (RESEARCH.md ACP-02 commands) | procedure |

## Pattern Assignments

### `e2e/angular-typechecker-ng-cli-e2e/project.json` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/project.json` -- copy verbatim, change only the `name`, `sourceRoot`, `reportsDirectory`, and the `typecheck` command path.

**CRITICAL guard reconciliation (RESEARCH.md corrects CONTEXT D-03):** the CURRENT guard contract is a `typecheck` target + a `type:e2e` tag, NOT a `typecheck-e2e` target. The install-e2e project.json already shows the current shape (`tags: ["scope:fixture", "type:e2e"]`, `targets.e2e` + `targets.typecheck`). Copy that. Missing any of `e2e` target / `typecheck` target / `type:e2e` tag turns GUARD-01/01c/01d RED (see Shared Patterns).

**Full analog** (`project.json` lines 1-33):
```json
{
  "name": "angular-typechecker-install-e2e",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "e2e/angular-typechecker-install-e2e/src",
  "tags": ["scope:fixture", "type:e2e"],
  "implicitDependencies": ["angular-typechecker"],
  "targets": {
    "e2e": {
      "executor": "@nx/vitest:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "reportsDirectory": "coverage/e2e/angular-typechecker-install-e2e"
      }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "cache": true,
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/tsconfig.base.json",
        { "externalDependencies": ["typescript", "vitest", "@nx/js", "@nx/vite"] }
      ],
      "options": {
        "command": "tsc --noEmit -p e2e/angular-typechecker-install-e2e/tsconfig.spec.json",
        "cwd": "."
      }
    }
  }
}
```

---

### `e2e/angular-typechecker-ng-cli-e2e/vitest.config.mts` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/vitest.config.mts` -- copy verbatim, change `test.name`, `cacheDir`, and the setup path.

**Serialization block to preserve** (`vitest.config.mts` lines 22-40) -- every knob is load-bearing (node env for execSync, single fork, no file parallelism, 300000ms timeouts, the shared `globalSetup`):
```typescript
  test: {
    name: 'angular-typechecker-install-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    globalSetup: ['./src/global-setup.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
  },
```

---

### `e2e/angular-typechecker-ng-cli-e2e/tsconfig.json` + `tsconfig.spec.json` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/tsconfig.json` (lines 1-10) + `.../tsconfig.spec.json` (lines 1-15). Copy verbatim; the spec tsconfig `include` already globs `src/**/*.e2e.spec.ts`, `src/global-setup.ts`, `vitest.config.mts`. No change needed beyond copy.

```jsonc
// tsconfig.spec.json (analog)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node", "vitest/globals", "vitest/importMeta", "vitest"]
  },
  "include": ["vitest.config.mts", "src/**/*.e2e.spec.ts", "src/**/*.d.ts", "src/global-setup.ts"]
}
```

---

### `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` (test setup)

**Analog:** `e2e/angular-typechecker-install-e2e/src/global-setup.ts` -- **COPY VERBATIM** (RESEARCH.md "Don't Hand-Roll": the 127.0.0.1 loopback, real-token mint, provenance strip, and SAFETY gate are all load-bearing and already solved). No adaptation expected.

**Load-bearing SAFETY gate** (lines 109-117) -- refuses any non-local publish:
```typescript
    const registryUrl = process.env.npm_config_registry ?? '';
    if (!registryUrl.startsWith('http://127.0.0.1:')) {
      throw new Error(`refusing to publish to non-local registry: ${registryUrl}`);
    }
```

**Publish-once path** (lines 131-182) -- clean env, real token mint, `nx build ... --skip-nx-cache`, strip `publishConfig.provenance`, `nx release publish --first-release --excludeTaskDependencies`, `provide('verdaccioUrl'/'verdaccioToken')`. `--excludeTaskDependencies` is mandatory (nx-release-publish `dependsOn:["build"]` would re-materialize dist from cache and clobber the provenance strip).

**ProvidedContext augmentation** (lines 199-204) to keep for `inject()`:
```typescript
declare module 'vitest' {
  interface ProvidedContext {
    verdaccioUrl: string;
    verdaccioToken: string;
  }
}
```

---

### `e2e/angular-typechecker-ng-cli-e2e/src/*.e2e.spec.ts` (test, request-response)

**Analog:** `e2e/angular-typechecker-install-e2e/src/nx-add-npm.e2e.spec.ts` -- the `ng add`-by-name spec mirrors this `nx add`-by-name spec. Same skeleton: resolve workspace root, copy the committed fixture to a tmp dir, write a Verdaccio `.npmrc`, install fixture deps, run the by-name add, plant errors, assert per-project scoping, `removeTmpDir` in `finally`.

**Imports + helpers** (lines 1-15) -- reuse the `@workspace/test-util` helpers:
```typescript
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';
```

**The clean-env guard is load-bearing** (lines 49-54) -- strips inherited `npm_config_*` (incl. a leaked `legacy-peer-deps`) so an on-stack Ng22 result cannot be masked (RESEARCH Pitfall D):
```typescript
const env = buildCleanEnv({ stripAllNpmConfig: true });
```

**Core copy-fixture -> npmrc -> install -> add -> assert body** (lines 66-100) -- adapt the middle from `nx add angular-typechecker` to `ng add angular-typechecker`, then plant + assert per-project (`ng run <app>:typecheck` / `ng run <lib>:typecheck`):
```typescript
    const tmp = mkdtempSync(join(tmpdir(), 'atc-add-npm-'));
    try {
      cpSync(fixtureDir, tmp, { recursive: true });
      writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
      // ... baseline assert (non-vacuous) ...
      const npmEnv = { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') };
      sh('npm install', { cwd: tmp, env: npmEnv });
      sh('npx nx add angular-typechecker', { cwd: tmp, env: npmEnv }); // -> `ng add angular-typechecker`
      // ... post assert ...
    } finally {
      removeTmpDir(tmp);
    }
  }, 300000);
```

**Planted-diagnostics convention (Shared Patterns below):** distinct raw TS codes per leaf (`TS2322` app component, `TS2345` spec, a third distinct code in the library component); assert raw TS codes directly, Angular NG8xxx via `NG = (code) => -990000 - code`. Prove the app target catches app+spec errors and NOT the lib error, and vice versa (COV-01 semantics at the e2e tier). Assumption A2: if `ng add`'s install path differs materially from `nx add`, fall back to `npm install <tgz>` + `ng g angular-typechecker:ng-add`.

---

### `e2e/angular-typechecker-ng-cli-e2e/fixtures/<scaffold>/` (fixture)

**Analog:** `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` (committed consumer-workspace layout) -- SAME committed-fixture pattern, but the content is a full Angular CLI workspace (`angular.json` + `src/` + `projects/<lib>/` + `tsconfig.*.json` + committed `package-lock.json`), NOT an Nx consumer.

**Provenance (RF-01, resolved -> Option B):** generate once with `npm init @angular@22 <name> --defaults --skip-install` + `ng g library <lib> --skip-install`, strip `node_modules/`/`.angular/`/`dist/`/`.git/`, pin `package.json` to `@angular/cli ~22.0.x` + `@angular/*` `^22.0.0` + `typescript ~6.0.3`, commit `package-lock.json`. The fixture's `.npmrc` must NOT carry `legacy-peer-deps=true`. Add a short "regenerate on Angular bumps" drift note co-located (mirrors the repo's `*.drift.ts` honesty convention). App+lib leaf shape confirmed identical to ngx-leaflet (RESEARCH "Freshly scaffolded" section).

---

### `src/builders/typecheck/builder.integration.spec.ts` (test, request-response)

**Analogs (two):**
1. `src/builders/typecheck/builder.spec.ts` -- the EXISTING structural/brand guard (asserts source shape + the Architect brand + a `handler` function but NEVER RUNS the builder). This is the partial coverage; the new file adds the RUN.
2. `src/core/multi-tsconfig.integration.spec.ts` -- the integration-tier harness idiom (real compiler, `findWorkspaceRoot`, `join(workspaceRoot, 'fixtures', ...)`, `runTypecheck` parity).

**From `builder.spec.ts` -- the runtime-brand assertion that already exists** (lines 55-64); the new file goes further and executes:
```typescript
    const builder = builderDefault as { handler?: unknown; [key: symbol]: unknown };
    expect(typeof builder).toBe('object');
    expect(builder[Symbol.for('@angular-devkit/architect:builder')]).toBe(true);
    expect(typeof builder.handler).toBe('function');
```

**From `multi-tsconfig.integration.spec.ts` -- the fixture-root resolution idiom to reuse** (lines 24-27):
```typescript
const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = join(workspaceRoot, 'fixtures', 'multi-tsconfig-array');
```

**New harness (RESEARCH.md, from `@angular-devkit/architect/testing@0.2200.6`, installed):**
```typescript
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import builderDefault from './builder';

const registry = new schema.CoreSchemaRegistry();
const host = new TestingArchitectHost(fixtureRoot, fixtureRoot);
host.addBuilder('angular-typechecker:typecheck', builderDefault);
const architect = new Architect(host, registry);
const run = await architect.scheduleBuilder('angular-typechecker:typecheck', {
  tsConfig: [/* fixture build leaf, spec leaf */],
});
const output = await run.result; // BuilderOutput
await run.stop();
expect(output.success).toBe(/* true on clean, false on planted-error fixture */);
```

**Placement:** this belongs in the `integration` tier (`vitest.integration.config.mts`), not the fast `test` tier -- it loads the real compiler. Assumption A1 (MEDIUM, confirm in impl): `TestingArchitectHost(workspaceRoot)` must scope the wrapper's eager `retrieveProjectConfigurationsWithAngularProjects(workspaceRoot)` to the fixture, not the dev-repo nx context. Fallback: call `builderDefault.handler(options, { workspaceRoot, logger, target })` directly (same eager prelude, fewer abstractions -- do NOT shortcut to driving the executor, that skips the wrapper).

---

### `fixtures/builder-context/` (+ `angular.json`) (fixture)

**Analog:** `fixtures/multi-tsconfig-array/` (existing real-compiler fixture layout: co-located app + spec leaves with a planted diagnostic in each). **PARTIAL** -- no `angular.json` fixture exists anywhere under root `fixtures/` (confirmed: `find fixtures -name angular.json` returns nothing). The builder's eager prelude reads `workspaceRoot` from disk and needs a resolvable Angular workspace root, so this fixture MUST add a minimal `angular.json` (one project + its tsconfig leaves + a component). RESEARCH Pitfall F + Open Question 2: add a dedicated `fixtures/builder-context/` with `angular.json`, or extend an existing fixture. One clean case + one planted-error case suffices.

---

### `src/index.drift.ts` (compile-time tripwire)

**Analog:** `src/core/compiler-cli-types.drift.ts` -- the repo's established `*.drift.ts` `tsc --noEmit` idiom (type-only, never ships, excluded from lib/spec tsconfigs, rides the `typecheck-drift` compile via `tsconfig.drift.json`). Also `src/core/extended-catalog.drift.ts`.

**RESEARCH.md-recommended content (RF-02 -> LIGHT YES)** -- imports all five barrel exports (2 value + 3 type) so a removal/rename fails `tsc --noEmit` loudly:
```typescript
// src/index.drift.ts -- additive-only barrel tripwire (rides the drift target)
import { runTypecheck, TypecheckInfrastructureError } from './index';
import type { CoreOptions, CoreResult, SkippedReference } from './index';
void runTypecheck; void TypecheckInfrastructureError;
type _Guard = [CoreOptions, CoreResult, SkippedReference];
```

**The five exports it must reference** (from `src/index.ts` lines 14-19): `runTypecheck`, `TypecheckInfrastructureError` (value); `CoreOptions`, `CoreResult`, `SkippedReference` (type). The drift file's `void`/tuple idiom mirrors `compiler-cli-types.drift.ts` lines 107-108, 170-177.

**MUST also wire it in** (see next file) -- an unreferenced drift file is never compiled.

---

### `packages/angular-typechecker/tsconfig.drift.json` (config -- one-line edit)

**Analog:** self. Add `"src/index.drift.ts"` to the `files` array. Current (full file):
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs", "moduleResolution": "node", "ignoreDeprecations": "6.0",
    "noEmit": true, "declaration": false, "types": ["node"], "skipLibCheck": true
  },
  "files": [
    "src/core/compiler-cli-types.drift.ts",
    "src/core/extended-catalog.drift.ts"
    // ADD: "src/index.drift.ts"
  ]
}
```
`index.drift.ts` uses `moduleResolution: node` (classic) here, which is why it belongs in the drift target, not lib/spec. The `typecheck` project target already runs `tsc --noEmit -p .../tsconfig.drift.json` (plugin `project.json` line 94), so no target wiring is needed beyond the `files` entry.

---

### `src/angular-cli-docs.spec.ts` (docs tripwire, file-I/O)

**Analog:** `src/storybook-docs.spec.ts` -- EXACT idiom. Reads `../README.md`, normalizes whitespace (`\s+` -> single space) so claims survive re-wrapping, asserts the load-bearing MUST/MUST-NOT claims.

**Full skeleton to copy** (lines 18-24):
```typescript
const readmePath = join(dirname(fileURLToPath(import.meta.url)), '../README.md');
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');
```

**Assertion style** (lines 58-70) -- lock the `## Angular CLI` claims: `ng add` auto-wire-all, the no-target-caching notice, the `nx`-transitive/`.nx/` note, the off-stack `--legacy-peer-deps` note:
```typescript
  it('carries a flat-config note: not officially supported, but guarded', () => {
    expect(normalized).toContain("isn't an officially supported Storybook setup");
    expect(normalized).toContain('a config that declares no files fails the run');
  });
```

**Tension to reconcile (RESEARCH.md):** `storybook-docs.spec.ts` lines 67-70 assert the README says the "Angular CLI Storybook setup ... is not supported". The new `## Angular CLI` section says Angular CLI workspaces ARE supported for typecheck. NOT contradictory (Storybook-on-Ng-CLI special-casing stays out of scope; general typecheck is supported) -- word the new section so it does not appear to contradict, and do NOT delete/weaken the Storybook caveat (its tripwire will fail).

---

### `packages/angular-typechecker/README.md` -- `## Angular CLI` section (docs)

**Analog:** the shipped `## Storybook` section in the SAME README (length/tone precedent per CONTEXT D-06). The `storybook-docs.spec.ts` shows the anchor strings the existing section carries (`### Storybook Composition`, `dependsOn: ["^typecheck"]`, MUST/MUST-NOT phrasing).

**Content (RESEARCH ACD-01, verified command syntax):** `ng add angular-typechecker` (auto-wire-all every app+lib, idempotent, on-stack needs no `--legacy-peer-deps`); `ng generate angular-typechecker:configuration <project>` (single project); `ng run <project>:typecheck`; per-project target shape (`architect.typecheck = { builder: "angular-typechecker:typecheck", options: { tsConfig: [<build leaf>, <spec leaf>] } }`); the `tsConfig` array union; the `nx`-transitive + `.nx/` + no-target-caching notes; the off-stack `--legacy-peer-deps` note. ALL end-user language, no internal ids ([[changelog-readme-end-user-facing]]).

---

### `CHANGELOG.md` -- 0.2.1 entry (docs, prose only)

**Analog:** the `0.2.0` entry (lines 5-70) -- headline sentence in bold, a prose paragraph, a `### Features` list. PROSE ONLY; NO version cut / NO release machinery in this phase (separate human-gated Release-PR per AGENTS.md).

**Style to mirror** (lines 5-14):
```markdown
## 0.2.0 (2026-07-07)

**Storybook story type-checking.** `nx typecheck` now type-checks your Storybook
stories ... No configuration and no Storybook-specific option is required ...
```

**New entry describes (RESEARCH ACD-01):** Angular CLI (`angular.json`) workspace support -- `ng add` auto-wires a `typecheck` target into every app + library; `ng run <project>:typecheck` runs the complete Angular type-check; per-project scoping via the `tsConfig` array; notes on `nx` transitivity/no caching and off-stack `--legacy-peer-deps`. End-user language only.

---

### ACV-01 real-clone UAT procedure (verification doc)

**Analog:** `.planning/milestones/v0.2.0-phases/19-stretch-.../19-UAT.md` -- the `## Current Test` / `## Tests` / per-test `expected:` / `result:` / `evidence:` structure (with a YAML frontmatter: `status`, `phase`, `source`, `scope`, timestamps). Reproduce the two on-stack clones IN ORDER: `bluehalo/ngx-leaflet` @ SHA `818e9ae55240b570397ede5a15cb4d466785abdc` (app+lib), THEN `realworld-angular/realworld-angular` @ SHA `9e3528ff27bad5fedaefb879ccc4aaf4717b137b` (app-only). Steps: pack tarball -> `ng add` -> plant -> `ng run <project>:typecheck` -> assert -> clean. MSYS tar gotcha: use `/d/...` paths not `D:/...` ([[oss-real-repo-verification]]).

---

### ACP-02 git-diff audit (verification output)

**Not a source file** -- a documented verdict recorded in the phase VERIFICATION/audit output. Run the four `git diff angular-typechecker@0.2.0..HEAD` commands from RESEARCH.md ACP-02 over `src/index.ts`, the four schema.json files, and `executors.json`/`generators.json`. Assert widen-only (never narrowed/removed/renamed). Expected verdict (confirmed this session): barrel UNCHANGED since 0.2.0; the only executor-schema change is the ENG-01 `tsConfig` `oneOf string|array` widening.

## Shared Patterns

### e2e project guard contract (applies to the new e2e project)
**Source:** `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01/01b/01c/01d)
**Apply to:** `e2e/angular-typechecker-ng-cli-e2e/project.json`
The 4th e2e project MUST define an `e2e` target (GUARD-01), a `typecheck` target (GUARD-01c), and carry the `type:e2e` tag (GUARD-01d); the ci.yml `--parallel=1` must stay (GUARD-01b -- no ci.yml edit needed). CONTEXT D-03's "`typecheck-e2e` target" is STALE -- the current shape is `typecheck` + `type:e2e`. Omitting any of these silently drops the project from coverage; the guards make it a loud located failure.
```typescript
// GUARD-01c enforcement (lines 220-235): every e2e/* project defines `typecheck`
expect(projectJson.targets?.['typecheck']).toBeDefined();
// GUARD-01d (lines 261-276): every e2e/* project carries `type:e2e`
expect(projectJson.tags ?? []).toContain('type:e2e');
```

### Shared-tarball serialization
**Source:** `ci-e2e-coverage-guard.spec.ts` GUARD-01b (lines 188-203) + memory [[e2e-projects-share-one-tarball-serialize]]
**Apply to:** the new e2e specs' `beforeAll`/`afterAll` (if they pack the shared dist tarball)
All e2e projects pack the SAME `dist/.../angular-typechecker-<ver>.tgz` and `rmSync` it; the CI `e2e` job MUST run `nx run-many -t e2e --parallel=1` or a sibling's teardown ENOENTs a live install. Note: this new project resolves the package BY NAME from Verdaccio (`ng add`), like `nx-add-npm.e2e.spec.ts`, so it may not `npm pack` directly -- but it shares the same globalSetup publish and must not break the `--parallel=1` invariant.

### Clean-env / anti-peer-mask
**Source:** `@workspace/test-util` `buildCleanEnv({ stripAllNpmConfig: true })` (used in `nx-add-npm.e2e.spec.ts` line 54, `global-setup.ts` line 123)
**Apply to:** every new e2e spec + the global-setup
Strips inherited `npm_config_*` (incl. a leaked `legacy-peer-deps`) so a real on-stack Ng22 peer result cannot be masked (Pitfall D). On-stack Angular 22 must install with NO flag -- assert it.

### `*.drift.ts` compile-time tripwire idiom
**Source:** `src/core/compiler-cli-types.drift.ts` + `tsconfig.drift.json` + plugin `project.json` `typecheck` target (line 94)
**Apply to:** `src/index.drift.ts` (+ the `tsconfig.drift.json` `files` entry)
Type-only, never ships, excluded from lib/spec tsconfigs, referenced via the drift tsconfig's `files` list, run by the `typecheck` target's `tsc --noEmit -p .../tsconfig.drift.json`. Covers erased type-only exports a runtime `.spec.ts` cannot see.

### Docs content tripwire idiom
**Source:** `src/storybook-docs.spec.ts` (README read + `\s+`->` ` normalize + `toContain` claim locks)
**Apply to:** `src/angular-cli-docs.spec.ts`
Pure filesystem read (no compiler load), rides the fast `test` loop, fails loudly if a load-bearing README claim is deleted/softened/over-claimed. Also `src/scoped-name-guard.spec.ts` is the sibling content tripwire policing scoped-name references.

### Planted-diagnostic encoding
**Source:** `src/core/multi-tsconfig.integration.spec.ts` (lines 21-22) + CONTEXT `<code_context>`
**Apply to:** the new e2e specs + the builder integration spec
Raw TS codes asserted directly (`const TS2322 = 2322; const TS2345 = 2345;`); Angular NG8xxx via the negative helper `NG = (code) => -990000 - code`. Distinct per-leaf codes so each planted error uniquely pins its own leaf, proving per-project scoping (COV-01).

### cwd-independent workspace-root resolution
**Source:** `@workspace/test-util` `findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))` (walks up to nx.json)
**Apply to:** every new spec (e2e, integration, docs tripwire)
Used uniformly across the analogs (`nx-add-npm` line 37, `multi-tsconfig.integration` line 24, `ci-e2e-coverage-guard` line 33, `storybook-docs` line 18). Keeps every path cwd-independent on the main tree.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `fixtures/builder-context/angular.json` | fixture | file-I/O | No `angular.json` fixture exists anywhere under root `fixtures/` (all existing fixtures are bare tsconfig/component trees for the engine). The builder's eager prelude needs a resolvable Angular workspace root, so a minimal `angular.json` (one project + leaves + a component) is genuinely new. Nearest layout precedent: `fixtures/multi-tsconfig-array/`. |

## Metadata

**Analog search scope:** `e2e/angular-typechecker-install-e2e/`, `packages/angular-typechecker/src/{builders,core,index.ts}`, `packages/angular-typechecker/{project.json,tsconfig.drift.json}`, `packages/angular-typechecker/README.md` + `CHANGELOG.md`, `fixtures/`, `.planning/milestones/v0.2.0-phases/19-.../19-UAT.md`
**Files scanned:** ~14 read in full/part; e2e + drift + guard + docs-tripwire + integration analogs all confirmed present on disk
**Pattern extraction date:** 2026-07-11
