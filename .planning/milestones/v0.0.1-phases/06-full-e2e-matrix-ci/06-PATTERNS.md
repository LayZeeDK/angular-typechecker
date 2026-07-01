# Phase 6: Full e2e Matrix + CI - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 13 new + 2 extended
**Analogs found:** 15 / 15 (every new/extended file has a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/ci.yml` | config (CI workflow) | event-driven (PR/push) | `.github/workflows/release.yml` | role-match (release.yml is tag-push publish; ci.yml is PR/push test gate -- same hardening envelope + SHAs) |
| `e2e/angular-typechecker-matrix-e2e/project.json` | config (Nx project) | batch (test target) | `e2e/angular-typechecker-install-e2e/project.json` | exact |
| `e2e/angular-typechecker-matrix-e2e/vitest.config.mts` | config (test runner) | batch | `e2e/angular-typechecker-install-e2e/vitest.config.mts` | exact (clone verbatim) |
| `e2e/angular-typechecker-matrix-e2e/tsconfig.json` | config | n/a | `e2e/angular-typechecker-install-e2e/tsconfig.json` | exact |
| `e2e/angular-typechecker-matrix-e2e/tsconfig.spec.json` | config | n/a | `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` | exact |
| `e2e/.../fixtures/consumer-workspace/nx.json` | config (fixture workspace) | n/a | `e2e/.../fixtures/consumer-app/nx.json` | exact |
| `e2e/.../fixtures/consumer-workspace/package.json` | config (fixture deps) | n/a | `e2e/.../fixtures/consumer-app/package.json` | exact (EXACT pins; NO @nx/angular -- OQ-1) |
| `e2e/.../fixtures/consumer-workspace/apps/app/{project.json,tsconfig.app.json,src/*}` | config + component (app type) | request-response (executor reads tsConfig) | `consumer-app` fixture + `apps/ng-spike-app` | exact + role-match |
| `e2e/.../fixtures/consumer-workspace/libs/local-lib/{project.json,tsconfig.lib.json,src/*}` | config + component (local lib type) | request-response | `libs/typecheck-consumer/` | exact |
| `e2e/.../fixtures/consumer-workspace/libs/buildable-lib/{project.json,tsconfig.lib.json,ng-package.json,src/*}` | config (buildable lib type) | request-response | `libs/typecheck-consumer/` + RESEARCH Pattern 1 (no in-repo `ng-package.json`) | role-match |
| `e2e/.../fixtures/consumer-workspace/libs/publishable-lib/{project.json,tsconfig.lib.json,ng-package.json,package.json,src/*}` | config (publishable lib type) | request-response | `libs/typecheck-consumer/` + RESEARCH Pattern 1 | role-match |
| `e2e/.../fixtures/consumer-workspace/.../tsconfig.spec.json` (spec-tsconfig type) | config | request-response | `e2e/.../install-e2e/tsconfig.spec.json` shape | partial (existing spec tsconfigs are test-runner specs, not Angular spec sets) |
| `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` | test (e2e) | batch / request-response | `e2e/.../install-e2e/src/install-smoke.int.spec.ts` | exact (reuse harness verbatim) |
| `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` | test (e2e) | file-I/O + request-response | `e2e/.../install-e2e/src/install-smoke.int.spec.ts` | role-match (pnpm add + realpath probe) |
| EXTEND `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` | test (unit) | transform (pure fn) | itself (existing mixed-case + realpath cases) | exact |
| EXTEND `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` | test (integration) | request-response (real compiler) | itself + `run-typecheck.ts` host seam | exact |

## Pattern Assignments

### `.github/workflows/ci.yml` (config, event-driven)

**Analog:** `.github/workflows/release.yml`

Copy the hardening envelope verbatim; reuse the EXACT action SHAs so Dependabot bumps both workflows in lockstep (D-05). The RESEARCH `ci.yml` skeleton (06-RESEARCH.md lines 292-359) is the authoritative target shape -- the analog supplies the proven envelope primitives.

**Top-level hardening** (release.yml lines 33-34):
```yaml
permissions:
  contents: read
```
ci.yml ADDS a `concurrency` block (release.yml has none -- it is single-run on tag push):
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Checkout pin + persist-credentials** (release.yml lines 49-51) -- copy verbatim onto every checkout step:
```yaml
- uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
  with:
    persist-credentials: false
```

**setup-node pin** (release.yml lines 52-54) -- copy the SHA; ci.yml changes `node-version` to `${{ matrix.node }}` (test job) / `24` (e2e job) and adds `cache: npm`; ci.yml does NOT set `registry-url` (release.yml-only, D-04):
```yaml
- uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
  with:
    node-version: ${{ matrix.node }}
    cache: npm
```

**Install step** (release.yml lines 71-72) -- `npm ci` honors the committed root `.npmrc` `legacy-peer-deps=true` (D-04). The `npm i -g npm@latest` line is OPTIONAL parity (Claude's discretion):
```yaml
- run: npm i -g npm@latest   # optional parity with release.yml
- run: npm ci
```

**NEW (no analog -- from RESEARCH):** the `test` 3x3 matrix (`fail-fast: false`, `node: [22,24,26]`, `os: [ubuntu-latest, windows-latest, macos-latest]`, `env: NX_DAEMON: false`, run `npx nx run-many -t test -p angular-typechecker`); the Linux-only `e2e` job (adds `pnpm/action-setup@008330803749db0355799c700092d9a85fd074e9 # v6.0.9` with `version: 11.9.0`, then `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`); the aggregate `ci` gate (`needs: [test, e2e]`, `if: always()`, the `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` step). See RESEARCH Pattern 2 (lines 208-221) and the skeleton (lines 292-359).

**Do NOT modify `release.yml`** (Phase 5.1 froze it OIDC-only). Dependabot already covers the new workflow via `.github/dependabot.yml` (`github-actions` ecosystem) -- no edit needed there.

---

### `e2e/angular-typechecker-matrix-e2e/project.json` (config, batch)

**Analog:** `e2e/angular-typechecker-install-e2e/project.json` (exact)

Clone and rename. The shape (`@nx/vitest:test`, `outputs`, `reportsDirectory`, `tags: ["scope:fixture"]`, `implicitDependencies: ["angular-typechecker"]`) carries verbatim:
```json
{
  "name": "angular-typechecker-matrix-e2e",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "e2e/angular-typechecker-matrix-e2e/src",
  "tags": ["scope:fixture"],
  "implicitDependencies": ["angular-typechecker"],
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "reportsDirectory": "coverage/e2e/angular-typechecker-matrix-e2e"
      }
    }
  }
}
```
Note: `cache-e2e/project.json` shows `implicitDependencies` MAY list more than `angular-typechecker` (it lists `typecheck-consumer`, `typecheck-consumer-dep`). matrix-e2e's fixture is self-contained, so `["angular-typechecker"]` (the install-e2e shape) is correct.

---

### `e2e/angular-typechecker-matrix-e2e/vitest.config.mts` (config, batch)

**Analog:** `e2e/angular-typechecker-install-e2e/vitest.config.mts` (clone VERBATIM per D-08)

Every serialization knob is load-bearing and must clone unchanged: `environment: 'node'`, `pool: 'forks'`, `poolOptions.forks.singleFork: true`, `fileParallelism: false`, `sequence.concurrent: false`, `testTimeout: 300000`, `hookTimeout: 300000`, `include: ['src/**/*.int.spec.ts']`. ONLY change the three identity strings:
```typescript
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-matrix-e2e',  // CHANGE
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-matrix-e2e',  // CHANGE
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
  },
}));
```

---

### `e2e/angular-typechecker-matrix-e2e/{tsconfig.json,tsconfig.spec.json}` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/{tsconfig.json,tsconfig.spec.json}` (exact)

These are the E2E PROJECT's tsconfigs (NOT the fixture's). They DO extend `../../tsconfig.base.json` and reference the spec tsconfig. Clone verbatim:

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.spec.json" }]
}
```
`tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node", "vitest/globals", "vitest/importMeta", "vitest"]
  },
  "include": ["vitest.config.mts", "src/**/*.int.spec.ts", "src/**/*.d.ts"]
}
```

---

### `e2e/.../fixtures/consumer-workspace/nx.json` (config)

**Analog:** `e2e/.../fixtures/consumer-app/nx.json` (exact)

This is the FIXTURE workspace's nx.json -- self-contained, keyed on the PUBLISHED executor id (NOT the dev `@angular-typechecker/...` workspace-scoped key). The whole file is reusable:
```json
{
  "$schema": "node_modules/nx/schemas/nx-schema.json",
  "analytics": false,
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/eslint.config.mjs",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json"
    ],
    "sharedGlobals": []
  },
  "targetDefaults": {
    "angular-typechecker:angular-typecheck": {
      "cache": true,
      "outputs": [],
      "inputs": [ "production", "{projectRoot}/tsconfig*.json", "{projectRoot}/package.json", "^default",
        { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
        { "externalDependencies": ["typescript", "@angular/compiler-cli"] } ]
    }
  }
}
```

---

### `e2e/.../fixtures/consumer-workspace/package.json` (config)

**Analog:** `e2e/.../fixtures/consumer-app/package.json` (exact)

EXACT pins mirroring `consumer-app` (Angular 22.0.4 / Nx 23.0.1 / TS 6.0.3). **CRITICAL (OQ-1, RESEARCH lines 53/231): do NOT add `@nx/angular`** -- the executor never RUNS the build targets, only reads each project's `tsConfig`, so build-target executor names are purely structural markers; adding `@nx/angular@23.0.1` would re-introduce the Angular-22-vs-@nx/angular-23 peer mismatch and burn the B-03 clean-install honesty signal. Start from this analog verbatim:
```json
{
  "name": "consumer-workspace",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "dependencies": {
    "@angular/common": "22.0.4",
    "@angular/compiler": "22.0.4",
    "@angular/core": "22.0.4",
    "rxjs": "7.8.2",
    "zone.js": "0.16.0"
  },
  "devDependencies": {
    "@angular/compiler-cli": "22.0.4",
    "@nx/devkit": "23.0.1",
    "nx": "23.0.1",
    "typescript": "6.0.3"
  }
}
```
**Spike gate (OQ-1):** the planner must run a clean `npm install` of the fully-shaped fixture FIRST. If it ERESOLVEs in a way hand-authoring cannot avoid, ESCALATE -- do NOT auto-add a peer override (preserves B-03).

---

### `e2e/.../fixtures/consumer-workspace/apps/app/*` (config + component, app type)

**Analog:** `consumer-app` fixture `project.json` + `tsconfig.json`/`tsconfig.lib.json` + `src/app.component.ts`; cross-ref `apps/ng-spike-app/tsconfig.app.json` for the `tsconfig.app.json` filename convention.

**project.json** -- template on `consumer-app/project.json`; the app type uses `tsConfig: apps/app/tsconfig.app.json` (RESEARCH Pattern 1, lines 174-176):
```json
{ "name": "app", "projectType": "application",
  "targets": { "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "apps/app/tsconfig.app.json", "includeDeps": true } } } }
```

**self-contained tsconfig** (consumer-app/tsconfig.json -- NO `tsconfig.base.json` extension, the deliberate self-contained shape):
```json
{ "files": [], "include": [], "references": [{ "path": "./tsconfig.app.json" }] }
```

**leaf tsconfig compilerOptions** (consumer-app/tsconfig.lib.json -- the proven self-contained Angular shape; note `types: []` and `strictTemplates: true`):
```json
{
  "compilerOptions": {
    "noEmit": true, "target": "es2022", "module": "preserve", "moduleResolution": "bundler",
    "strict": true, "skipLibCheck": true, "experimentalDecorators": false,
    "emitDecoratorMetadata": false, "lib": ["es2022", "dom"], "types": []
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "include": ["src/**/*.ts"]
}
```
`apps/app/tsconfig.app.json` should match this and (per `ng-spike-app/tsconfig.app.json`) `exclude` the `*.spec.ts`/`*.test.ts` set so the spec-tsconfig type stays a genuinely distinct file set.

**Standalone component** (consumer-app/src/app.component.ts) -- copy the committed-clean standalone component; the matrix spec injects a TS2322 into a per-run TMP copy:
```typescript
import { Component } from '@angular/core';

@Component({ selector: 'app-root', standalone: true, template: '<p>{{ label }}</p>' })
export class AppComponent {
  readonly label: string = 'angular-typechecker matrix app';
}
```

---

### `e2e/.../fixtures/consumer-workspace/libs/local-lib/*` (config + component, local non-buildable lib type)

**Analog:** `libs/typecheck-consumer/project.json` + `tsconfig.lib.json` (exact -- this IS the local non-buildable lib shape in-repo)

`project.json` -- `projectType: "library"`, NO build target, `tsConfig: tsconfig.lib.json`. Template on `typecheck-consumer` but use the PUBLISHED executor id (`angular-typechecker:angular-typecheck`, NOT the dev `@angular-typechecker/...` key the in-repo lib uses):
```json
{ "name": "local-lib", "projectType": "library",
  "targets": { "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "libs/local-lib/tsconfig.lib.json", "includeDeps": true } } } }
```
`tsconfig.lib.json` -- mirror the self-contained app leaf tsconfig above (the in-repo `typecheck-consumer/tsconfig.lib.json` extends `tsconfig.base.json`, but the fixture is self-contained, so use consumer-app's no-base shape).

---

### `e2e/.../libs/buildable-lib/*` + `libs/publishable-lib/*` (config, buildable/publishable lib types)

**Analog:** `libs/typecheck-consumer/` for the lib + tsconfig shape; RESEARCH Pattern 1 (lines 183-204) for the structural `build` target + `ng-package.json` (NO in-repo `ng-package.json` analog exists).

The `angular-typecheck` target is identical to local-lib; the ONLY difference is the structural `build` target (executor name never resolved at run time -- OQ-1):

**buildable** (`@nx/angular:ng-packagr-lite`):
```json
{ "name": "buildable-lib", "projectType": "library",
  "targets": {
    "build": { "executor": "@nx/angular:ng-packagr-lite",
      "options": { "project": "libs/buildable-lib/ng-package.json" } },
    "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
      "options": { "tsConfig": "libs/buildable-lib/tsconfig.lib.json", "includeDeps": true } } } }
```

**publishable** (`@nx/angular:package` + `importPath` + per-lib `package.json`):
```json
{ "name": "publishable-lib", "projectType": "library",
  "targets": {
    "build": { "executor": "@nx/angular:package",
      "options": { "project": "libs/publishable-lib/ng-package.json" } },
    "angular-typecheck": { "executor": "angular-typechecker:angular-typecheck",
      "options": { "tsConfig": "libs/publishable-lib/tsconfig.lib.json", "includeDeps": true } } } }
```

`ng-package.json` minimal shape (RESEARCH line 204; `$schema` MAY be omitted since `build` never runs):
```json
{ "dest": "../../dist/buildable-lib", "lib": { "entryFile": "src/index.ts" } }
```
publishable-lib's per-lib `package.json` -- template on `libs/typecheck-consumer/package.json` (use a scoped `importPath`-matching name):
```json
{ "name": "@fixtures/publishable-lib", "version": "0.0.0", "private": true }
```

---

### spec-tsconfig type (config, RESEARCH Pattern 1)

**Analog:** RESEARCH Pattern 1 (lines 199-202) + the install-e2e `tsconfig.spec.json` shape for the distinct file set.

A target whose `tsConfig` points at a `tsconfig.spec.json` that includes the `*.spec.ts` source set + test-runner ambient types -- the file set the app/lib targets EXCLUDE (assumption A3, RESEARCH line 401):
```json
{ "targets": { "angular-typecheck-spec": { "executor": "angular-typechecker:angular-typecheck",
    "options": { "tsConfig": "libs/local-lib/tsconfig.spec.json", "includeDeps": true } } } }
```
This can live on the local-lib project (a sibling target) rather than a 6th project.

---

### `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` (test, e2e)

**Analog:** `e2e/.../install-e2e/src/install-smoke.int.spec.ts` (reuse the harness VERBATIM -- D-07, D-08, RESEARCH Pattern 3)

**Imports + constants** (install-smoke lines 1-29) -- copy verbatim including the `INJECTED_TS_CODE = 'TS2322'` token-assertion constant:
```typescript
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const INJECTED_TS_CODE = 'TS2322';
```

**`buildCleanEnv`** (install-smoke lines 57-96) -- copy VERBATIM (the 8 `NX_*` runner keys + both legacy-peer-deps env forms + `NX_DAEMON: 'false'` / `FORCE_COLOR: '0'`). This is the Phase-4 nested-nx isolation pattern; do not abbreviate:
```typescript
const NX_RUNNER_ENV_KEYS = [
  'NX_SKIP_NX_CACHE', 'NX_TASK_HASH', 'NX_INVOCATION_ROOT_PID', 'NX_FORKED_TASK_EXECUTOR',
  'NX_TASK_TARGET_PROJECT', 'NX_TASK_TARGET_TARGET', 'NX_CLI_SET', 'NX_TERMINAL_CAPTURE_STDERR',
];

function buildCleanEnv(): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };
  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }
  delete cleaned['npm_config_legacy_peer_deps'];
  delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];
  return { ...cleaned, NX_DAEMON: 'false', FORCE_COLOR: '0' };
}
```

**`run(cwd)` helper** (install-smoke lines 112-132) -- copy verbatim; it execSyncs `npx nx run ${TARGET} --output-style=static` and catches non-zero to capture the injected-error output. NEVER pipe through head/rg (anti-pattern). The matrix spec parameterizes `TARGET` per project type (`app:angular-typecheck`, `local-lib:angular-typecheck`, `buildable-lib:angular-typecheck`, `publishable-lib:angular-typecheck`, `local-lib:angular-typecheck-spec`):
```typescript
function run(cwd: string, target: string): RunResult {
  try {
    const stdout = execSync(`npx nx run ${target} --output-style=static`, { cwd, env, encoding: 'utf8' });
    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`, code: execError.status ?? 1 };
  }
}
```

**`beforeAll` pack-to-tmp** (install-smoke lines 134-153) -- copy verbatim: `nx build angular-typechecker --skip-nx-cache` -> `npm pack --json` from `distDir` -> capture `tarballPath`. D-07: install the tarball ONCE into ONE tmp consumer-workspace (in `beforeAll`), then `it.each` over the 5 targets so each project type is a named green + injected-`TS2322` pairing. `afterAll` removes the `.tgz` (lines 155-161).

**The 4-way green/injected assertion shape** (install-smoke lines 207-236) -- reuse for EVERY project type:
```typescript
const green = run(tmp, target);
expect(green.code).toBe(0);
// ...inject TS2322 into the type's source...
const bad = run(tmp, target);
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain(INJECTED_TS_CODE);
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
expect(bad.stdout).not.toContain('infrastructure error');
```

**Clean-install honesty** (install-smoke lines 170-187) -- copy the empty `.npmrc` write + `npm_config_userconfig: join(tmp, '.npmrc.nonexistent')` env override so no ancestor/user `.npmrc` reintroduces the peer override (B-03). Mutate only the TMP copy (rmSync'd in `finally`), never the committed fixture.

---

### `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` (test, e2e)

**Analog:** `e2e/.../install-e2e/src/install-smoke.int.spec.ts` (same harness) + RESEARCH "Install the tarball under pnpm" (lines 362-372)

Reuse `buildCleanEnv`, `run`, the pack-to-tmp `beforeAll`, and the empty-`.npmrc` honesty pattern. Differences from the npm spec:
- Install via pnpm: `execSync(\`pnpm add ${JSON.stringify(tarballPath)} --no-frozen-lockfile\`, { cwd: tmp, env })` (RESEARCH line 369).
- Run with `includeDeps: true` so pnpm's `.pnpm/`-symlinked store is genuinely traversed (D-09).
- **Linux-only realpath PROBE before asserting** (Pitfall 1, B-02): assert the installed `node_modules/<pkg>` path is a symlink (`lstatSync(p).isSymbolicLink()`) AND its `realpathSync` crosses into `.pnpm/` BEFORE asserting filter behavior. If the layout does not produce a boundary-crossing realpath, fall back to asserting the symlinked layout simply WORKS (D-09 option a) and lean on the `filter-diagnostics.spec.ts` unit coverage as the load-bearing guard.
- Construct an in-project source resolved THROUGH a pnpm symlink such that a naive non-realpath `startsWith(basePath)` filter would MIS-SUPPRESS an in-project diagnostic; assert it is KEPT (and an out-of-project one is suppressed via realpath).
- Commit a `pnpm-lock.yaml` matching the pinned pnpm `version: 11.9.0` (or use `--no-frozen-lockfile`).

**WARNING (RESEARCH Pitfall 1, lines 262-266):** this construction CANNOT be authored/validated on the Windows arm64 dev box -- Git Bash `ln -s` produces a copy. Validate on the Linux CI runner (the gate is Linux-only anyway).

---

### EXTEND `packages/angular-typechecker/src/core/filter-diagnostics.spec.ts` (test, unit)

**Analog:** itself (D-10 -- extend the existing mixed-case + realpath cases)

The file ALREADY has the exact idiom to extend: the `diag(fileName, code)` literal builder (lines 14-23), the `base` object with `useCaseSensitiveFileNames: true` + injectable `realpath` (lines 26-30), and two seed cases -- the realpath-before-case-fold case (lines 73-91) and the `useCaseSensitiveFileNames: false` mixed-case in-project case (lines 93-103). D-10 asks for MORE mixed-case cases under both case modes:
```typescript
it('case-insensitive FS folds case so /WS/PROJ/src/A.ts is in-project under /ws/proj (OUT-02)', () => {
  const result = filterDiagnostics([diag('/WS/PROJ/src/A.ts')], {
    basePath: '/ws/proj',
    useCaseSensitiveFileNames: false,
    realpath: (p: string) => p,
    includeDeps: false,
  });

  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
```
Add parallel cases for: mixed-case OUT-of-project (suppressed under `false`), mixed-case `node_modules` SEGMENT (suppressed under `false`), and the SAME mixed-case inputs under `useCaseSensitiveFileNames: true` (NOT folded -> suppressed) to prove the fold is gated on the flag. Match style: blank lines around the `expect` after `filterDiagnostics`, braces always, single quotes, `it('... (OUT-02)', ...)` naming.

---

### EXTEND `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts` (test, integration)

**Analog:** itself + the host-derived seam in `run-typecheck.ts` (lines 199-204)

ADD ONE integration assertion (D-10) that the executor/host derives `useCaseSensitiveFileNames` from the real program host -- NOT a hard-coded constant. The seam is already wired in `run-typecheck.ts`:
```typescript
useCaseSensitiveFileNames: result.program.getTsProgram().useCaseSensitiveFileNames(),
realpath: (filePath: string): string => ts.sys.realpath?.(filePath) ?? filePath,
```
The existing spec runs the REAL compiler against committed fixtures (`gate-b-error`, `sibling-import`) on all 3 OS -- so on the macOS/Windows matrix legs the host-derived value is `false` (case-insensitive exercise), on Linux `true`. Add a case asserting a mixed-case `tsConfigPath` (or a mixed-case in-project fileName) is correctly classified in-project on every leg -- live on mac/win, case-sensitive on Linux. Reuse the `diagnosticsOnFile` normalized-forward-slash comparator (lines 54-65) and the `describe.each` parameterization idiom (lines 67-70). Match style as above.

---

## Shared Patterns

### CI workflow hardening envelope
**Source:** `.github/workflows/release.yml` (lines 33-34, 49-54)
**Apply to:** `.github/workflows/ci.yml`
```yaml
permissions:
  contents: read
# ...
- uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
  with:
    persist-credentials: false
- uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
```
Full 40-char SHA pins with `# vN` trailing comments; reuse the EXACT release.yml SHAs so Dependabot bumps both in lockstep (D-05). Add `concurrency` (release.yml has none).

### Serialized e2e vitest config
**Source:** `e2e/angular-typechecker-install-e2e/vitest.config.mts` (lines 22-35)
**Apply to:** the new `matrix-e2e/vitest.config.mts` (D-08)
The `pool:'forks'` + `singleFork:true` + `fileParallelism:false` + `sequence.concurrent:false` + `environment:'node'` + 300000 timeouts block is the hardened serialization; clone verbatim, change only `name` + `cacheDir`. (Same block in `cache-e2e/vitest.config.mts` -- the one-project-per-concern precedent.)

### Nested-nx clean environment (`buildCleanEnv`)
**Source:** `e2e/.../install-e2e/src/install-smoke.int.spec.ts` (lines 57-96)
**Apply to:** both new matrix-e2e specs
Strips the 8 `NX_*` runner vars + both legacy-peer-deps env forms; sets `NX_DAEMON: 'false'` + `FORCE_COLOR: '0'` (Phase-4 pattern). Use `FORCE_COLOR=0`, NEVER the `--no-color` CLI flag (the schema's `additionalProperties:false` rejects the forwarded `color:false` option).

### Clean-install honesty (B-03)
**Source:** `e2e/.../install-e2e/src/install-smoke.int.spec.ts` (lines 170-187)
**Apply to:** both new matrix-e2e specs + the fixture `package.json` (OQ-1)
Empty `.npmrc` in the tmp workspace + `npm_config_userconfig` -> a non-existent path so no ancestor/user `.npmrc` reintroduces `legacy-peer-deps`. A clean install must honestly succeed or ERESOLVE -- if it ERESOLVEs in a way hand-authoring cannot avoid, ESCALATE; do NOT auto-add an override.

### Green + injected-TS2322 4-way assertion
**Source:** `e2e/.../install-e2e/src/install-smoke.int.spec.ts` (lines 207-236)
**Apply to:** the matrix-5types spec (per type) + the pnpm spec
non-zero exit + full `TS2322` token (NOT a bare `2322` substring) + NO `ERR_REQUIRE_ESM` + NO `'infrastructure error'`. This is what distinguishes a real check from a no-op exit 0.

### Self-contained fixture workspace (PUBLISHED executor id)
**Source:** `e2e/.../install-e2e/fixtures/consumer-app/` (`nx.json`, `tsconfig.json`, `tsconfig.lib.json`, `project.json`)
**Apply to:** every project under `fixtures/consumer-workspace/`
Own `nx.json` keyed on `angular-typechecker:angular-typecheck` (the PUBLISHED id, NOT the dev `@angular-typechecker/...` key the in-repo `libs/typecheck-consumer` uses); NO `tsconfig.base.json` extension; NO source path-aliases. `types: []` + `strictTemplates: true` on the leaf tsconfig.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `e2e/.../fixtures/consumer-workspace/libs/{buildable,publishable}-lib/ng-package.json` | config | n/a | No `ng-package.json` exists anywhere in this repo (no buildable/publishable Angular lib). Use RESEARCH Pattern 1's minimal shape (06-RESEARCH.md line 204). |
| pnpm realpath regression-guard symlink construction | test fixture | file-I/O | No pnpm fixture or symlink-crossing construction exists in-repo; must be authored + validated on the Linux CI runner (B-02 / Pitfall 1). |
| `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/pnpm-lock.yaml` | config | n/a | No committed `pnpm-lock.yaml` in-repo; generate at the pinned pnpm 11.9.0 or use `--no-frozen-lockfile`. |
| the `test` 3x3 matrix + Linux-only `e2e` job + aggregate `ci` gate jobs | config | event-driven | `release.yml` is a single tag-push publish job with no matrix/needs/aggregate-gate. The job topology is genuinely new -- follow RESEARCH skeleton (06-RESEARCH.md lines 292-359) + Pattern 2 (lines 208-221). |

## Metadata

**Analog search scope:** `.github/workflows/`, `.github/dependabot.yml`, `e2e/angular-typechecker-install-e2e/`, `e2e/angular-typechecker-cache-e2e/`, `packages/angular-typechecker/src/core/`, `libs/typecheck-consumer/`, `apps/ng-spike-app/`
**Files scanned:** 23 (read in full or targeted)
**Pattern extraction date:** 2026-06-29
