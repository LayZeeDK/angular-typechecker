# Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 18 new/modified files
**Analogs found:** 12 with in-repo analog / 18 total (6 are greenfield -> CONTEXT/RESEARCH skeletons)

## File Classification

| New/Modified File                                                    | Role                  | Data Flow                   | Closest Analog                                                              | Match Quality                  |
| -------------------------------------------------------------------- | --------------------- | --------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| `packages/angular-typechecker/package.json` (EDIT)                   | config (manifest)     | transform                   | itself (current 4-field manifest) + RESEARCH "Full published package.json"  | exact (extend)                 |
| `packages/angular-typechecker/LICENSE` (NEW)                         | config (legal)        | file-I/O                    | none in repo (`LICENSE` MISSING)                                            | no analog -> MIT text          |
| `packages/angular-typechecker/project.json` (EDIT)                   | config (build)        | transform                   | itself (current `assets` block)                                             | exact (edit)                   |
| `packages/angular-typechecker/README.md` (EDIT)                      | docs                  | file-I/O                    | `libs/typecheck-consumer/project.json` (recipe source)                      | role-match                     |
| `packages/angular-typechecker/eslint.config.mjs` (EDIT)              | config (lint)         | event-driven                | itself (`@nx/dependency-checks` block, lines 66-82)                         | exact (edit)                   |
| `packages/angular-typechecker/src/core/compiler-cli-types.ts` (EDIT) | model (type contract) | transform                   | itself (current deep-import shim)                                           | exact (refactor)               |
| `packages/angular-typechecker/src/package-manifest.spec.ts` (EDIT)   | test (unit)           | request-response            | itself (existing manifest spec)                                             | exact (extend)                 |
| `nx.json` (EDIT)                                                     | config (release)      | batch                       | none in repo (no `release` block) -> nx-verdaccio                           | no in-repo analog              |
| `e2e/angular-typechecker-install-e2e/project.json` (NEW)             | config (project)      | n/a                         | `e2e/angular-typechecker-cache-e2e/project.json`                            | exact (clone)                  |
| `e2e/angular-typechecker-install-e2e/vitest.config.mts` (NEW)        | config (test)         | n/a                         | `e2e/angular-typechecker-cache-e2e/vitest.config.mts`                       | exact (clone)                  |
| `e2e/angular-typechecker-install-e2e/tsconfig.json` (NEW)            | config (TS)           | n/a                         | `e2e/angular-typechecker-cache-e2e/tsconfig.json`                           | exact (clone)                  |
| `e2e/angular-typechecker-install-e2e/tsconfig.spec.json` (NEW)       | config (TS)           | n/a                         | `e2e/angular-typechecker-cache-e2e/tsconfig.spec.json`                      | exact (clone)                  |
| `e2e/.../src/tarball-audit.int.spec.ts` (NEW)                        | test (e2e)            | file-I/O + batch            | `e2e/.../src/cache-busts-on-dep-error.int.spec.ts` (execSync/tmp/teardown)  | role-match                     |
| `e2e/.../src/install-smoke.int.spec.ts` (NEW)                        | test (e2e)            | file-I/O + request-response | `e2e/.../src/cache-busts-on-dep-error.int.spec.ts` (run()/inject/exit-code) | role-match                     |
| `e2e/.../fixtures/<consumer-app>/project.json` (NEW)                 | config (fixture)      | n/a                         | `libs/typecheck-consumer/project.json` BUT D-18 PUBLISHED id, NO alias      | partial-match                  |
| `e2e/.../fixtures/<consumer-app>/` source + tsconfig (NEW)           | fixture               | n/a                         | `libs/typecheck-consumer/` (source + tsconfig.lib.json)                     | role-match                     |
| `SECURITY.md` (NEW)                                                  | docs (policy)         | file-I/O                    | none in repo                                                                | no analog -> RESEARCH skeleton |
| `.github/workflows/release.yml` (NEW)                                | config (CI)           | event-driven                | none in repo (no `.github/`)                                                | no analog -> RESEARCH skeleton |
| `.github/dependabot.yml` (NEW)                                       | config (CI)           | event-driven                | none in repo                                                                | no analog -> RESEARCH skeleton |
| `package.json` (root, EDIT)                                          | config (devDeps)      | n/a                         | itself (root devDependencies block)                                         | exact (edit)                   |

## Pattern Assignments

### `packages/angular-typechecker/package.json` (config/manifest, transform) -- plan 05-01

**Analog:** the file itself. Current state is only the 4 core fields + deps/peers/engines (verified, lines 1-19 of current). Phase 5 ADDS D-01..D-06 fields. The target shape is the RESEARCH "Full published package.json" example (05-RESEARCH.md lines 366-402).

**Current manifest (verbatim -- the base to extend):**

```jsonc
{
  "name": "angular-typechecker",
  "version": "0.0.1",
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "executors": "./executors.json",
  "dependencies": { "@nx/devkit": "23.0.1", "tslib": "^2.3.0" },
  "peerDependencies": {
    "@angular/compiler-cli": "^22.0.0",
    "typescript": ">=6.0.0 <6.1.0",
  },
  "engines": { "node": "^22.22.3 || ^24.15.0 || ^26.0.0" },
}
```

**Fields to ADD (D-01..D-06; copy shapes from 05-RESEARCH.md Code Examples):**

- `description` / `keywords` (MUST include `nx`+`nx-plugin`) / `author` (PUBLIC email `larsbrinknielsen@gmail.com` -- NEVER work email) / `license: "MIT"` / `homepage` / `bugs` / `repository` (`type`/`url`/`directory: "packages/angular-typechecker"`). `repository.url` casing `LayZeeDK` is load-bearing (OIDC byte-match, D-03).
- `exports: { ".": "./src/index.js", "./package.json": "./package.json" }` (D-02; NO conditional import/require/types).
- `files: ["src", "executors.json", "README.md", "LICENSE"]` (D-01).
- `publishConfig: { "provenance": true }` (D-04; DROP `access`).
- Keep peers exactly as-is (`^22.0.0` / `>=6.0.0 <6.1.0`, D-06). Keep `tslib` UNLESS `@nx/dependency-checks` reports it obsolete (D-05).

**Anti-pattern (D-06):** NEVER run `eslint --fix` on this file -- `@nx/dependency-checks` autofix rewrites `^22.0.0` -> `22.0.4`. Mitigated by the eslint edit below + the spec backstop.

---

### `packages/angular-typechecker/LICENSE` (config/legal, file-I/O) -- plan 05-01

**Analog:** NONE in repo (verified: no `LICENSE` exists anywhere). The repo-root `package.json` declares `"license": "MIT"` (root line 4) -- use that as the consistency anchor.

**Action:** Write standard MIT license text, copyright line `Copyright (c) 2026 Lars Gyrup Brink Nielsen` (D-07). This is the per-package file that SHIPS via the project.json asset glob below. (RESEARCH note: a repo-root `LICENSE` is optional hygiene; the load-bearing one is the per-package file.)

---

### `packages/angular-typechecker/project.json` (config/build, transform) -- plan 05-01

**Analog:** the file itself, `build.options.assets` (current lines 17-39).

**Current assets (verbatim):**

```jsonc
"assets": [
  "packages/angular-typechecker/*.md",
  { "input": "./packages/angular-typechecker/src", "glob": "**/!(*.ts)", "output": "./src" },
  { "input": "./packages/angular-typechecker/src", "glob": "**/*.d.ts", "output": "./src" },
  { "input": "./packages/angular-typechecker", "glob": "generators.json", "output": "." },
  { "input": "./packages/angular-typechecker", "glob": "executors.json", "output": "." }
]
```

**Two edits (D-07, D-08):**

1. REMOVE the `generators.json` entry (matches nothing; latent footgun, D-08).
2. ADD a LICENSE entry, same shape as the `executors.json` entry:
   ```jsonc
   { "input": "./packages/angular-typechecker", "glob": "LICENSE", "output": "." }
   ```
   Keep BOTH `**/!(*.ts)` (carries `schema.json` + maps) and `**/*.d.ts` (carries hand-authored `schema.d.ts`) globs verbatim (D-08).

---

### `packages/angular-typechecker/eslint.config.mjs` (config/lint, event-driven) -- plan 05-01

**Analog:** the file itself, the `@nx/dependency-checks` block (current lines 66-82).

**Current block (verbatim):**

```javascript
{
  files: ['**/*.json'],
  rules: {
    '@nx/dependency-checks': [
      'error',
      {
        ignoredFiles: [
          '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
          '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
        ],
      },
    ],
  },
  languageOptions: { parser: await import('jsonc-eslint-parser') },
},
```

**Edit (D-06):** add `checkVersionMismatches: false` to the rule options object (alongside `ignoredFiles`) so the autofix cannot clobber the public `^22.0.0` peer range -> installed `22.0.4`. Still catches MISSING/OBSOLETE deps.

---

### `packages/angular-typechecker/src/core/compiler-cli-types.ts` (model/type-contract, transform) -- plan 05-01 (THE D-10/B-02 fix)

**Analog:** the file itself (current deep-import shim, verified lines 1-60). This is the central risk of the phase (RESEARCH Pitfall 1 confirms `attw --pack` returns `InternalResolutionError` on ALL profiles).

**The defect (current lines 22-35 -- the deep imports that escape the published package):**

```typescript
// eslint-disable-next-line @nx/enforce-module-boundaries -- documented nodenext deep-import workaround
import type { EmitFlags, Program, UNKNOWN_ERROR_CODE } from '../../../../node_modules/@angular/compiler-cli/src/transformers/api';
// eslint-disable-next-line @nx/enforce-module-boundaries -- documented nodenext deep-import workaround
import type { defaultGatherDiagnostics, formatDiagnostics, ParsedConfiguration, performCompilation, readConfiguration } from '../../../../node_modules/@angular/compiler-cli/src/perform_compile';
```

**Public surface that REACHES these types (verified `src/index.ts` lines 1-15, so erasure is NOT viable, D-10 option b ruled out):**

- `loadCompilerCli` returns `CompilerCli`
- `formatReport` param `Pick<CompilerCli, 'formatDiagnostics'>`
- `gatherAllDiagnostics` param `Program`

**Required fix (D-10 option a -- self-contained types):** replace the two deep `import type` statements with hand-declared structural types on the `typescript` substrate (e.g. `Program` over `ts.Program`; `EmitFlags` as a numeric union/const-enum; `UNKNOWN_ERROR_CODE` as literal `500`; `formatDiagnostics`/`readConfiguration`/`performCompilation`/`defaultGatherDiagnostics` as function-type declarations over `ts.Diagnostic[]`). Preserve the EXPORTED names verbatim (`CompilerCli`, `Program`, `EmitFlags`, `ParsedConfiguration` -- current exports lines 37, 45-60) so the public contract holds. Runtime is unchanged (the value is still `await import('@angular/compiler-cli')`). The build itself guards signature drift (engine code that calls these would fail type-check). ESCALATE only if a structural copy proves infeasible under nodenext (B-02). Verified by the `attw` assertion in the 05-02 audit gate.

---

### `packages/angular-typechecker/src/package-manifest.spec.ts` (test/unit, request-response) -- plan 05-01

**Analog:** the file itself (verified lines 1-71). It already reads the SOURCE manifest via `readFileSync` and asserts the dependency model. EXTEND it -- do not rewrite.

**Existing pattern to mirror for the new assertions (current lines 29-43, 45-70):**

```typescript
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(packageRoot, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PluginManifest;

it('declares @angular/compiler-cli and typescript as the consumer-supplied peer ranges', () => {
  expect(manifest.peerDependencies?.['@angular/compiler-cli']).toBe('^22.0.0');
  expect(manifest.peerDependencies?.['typescript']).toBe('>=6.0.0 <6.1.0');
});
```

**Extend the `PluginManifest` interface + add `it(...)` blocks for the new PKG-01 fields:** `files` array contents (D-01), `exports` map shape (D-02), `keywords` includes `nx`+`nx-plugin` (D-03), `repository.url`/`repository.directory` exact strings (D-03), `license: "MIT"`, `description` present, `publishConfig.provenance === true` (D-04). This is the peer-range + manifest regression backstop (D-06). Runs in the fast `nx test` loop (no build needed -- pure filesystem read).

---

### `nx.json` (config/release, batch) -- plan 05-04

**Analog:** NO in-repo analog (verified: `nx.json` has `namedInputs`/`targetDefaults`/`generators` but NO `release` block). Cite the external nx-verdaccio reference per CONTEXT canonical_refs: `D:/projects/github/push-based/nx-verdaccio/nx.json` (Nx 22.3-era, patterns only). Use the RESEARCH Code Example (05-RESEARCH.md lines 405-419) as the authoritative target shape.

**Target block to add (D-11):**

```jsonc
"release": {
  "projects": ["angular-typechecker"],
  "version": {
    "conventionalCommits": true,
    "preVersionCommand": "npx nx run-many -t build"
  },
  "changelog": { "workspaceChangelog": { "createRelease": "github" } }
}
```

**Critical:** `projects: ["angular-typechecker"]` scoping is MANDATORY so the cache-e2e, install-e2e, and `libs/typecheck-consumer*` fixtures are never versioned. Verify those fixtures carry `"private": true` (confirmed for `libs/typecheck-consumer/package.json` -> `"private": true`, line 5). The `version: "0.0.1"` on disk must stay valid (`--first-release` breaks on a missing version).

---

### e2e install-e2e project scaffold (config) -- plan 05-02/05-03 (clone Phase-4 cache-e2e)

**Analog:** `e2e/angular-typechecker-cache-e2e/` -- the single richest analog. Clone all four config files; rename `angular-typechecker-cache-e2e` -> `angular-typechecker-install-e2e` throughout.

**`vitest.config.mts`** (analog verified lines 1-34): clone the FULL determinism block, change `name` + `cacheDir`, and bump timeouts to `>= 300000` (D-21, install is slower):

```typescript
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-install-e2e',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-install-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000, // install is slower than a bare nx run (was 180000)
    hookTimeout: 300000,
  },
}));
```

**`project.json`** (analog verified lines 1-21): clone; keep `projectType: "application"`, `tags: ["scope:fixture"]`, the `@nx/vitest:test` target. Set `implicitDependencies: ["angular-typechecker"]` (D-21; drop the consumer/dep deps -- the install-e2e packs the plugin and installs the tarball into a tmp copy of its OWN committed fixture, it does NOT use the dev-graph consumer).

**`tsconfig.json`** (analog verified lines 1-11): clone verbatim (references `./tsconfig.spec.json`).

**`tsconfig.spec.json`** (analog verified lines 1-15): clone verbatim (`module: esnext`, `moduleResolution: bundler`, `types: ["node", "vitest/globals", ...]`, includes `src/**/*.int.spec.ts`).

---

### `e2e/.../src/tarball-audit.int.spec.ts` (test/e2e, file-I/O + batch) -- plan 05-02

**Analog:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` (verified lines 1-239) for the harness shape; the assertion bodies come from the RESEARCH "PKG-02 audit-gate assertions" example (05-RESEARCH.md lines 425-472).

**Imports + workspace-root + teardown patterns to copy (analog lines 1-7, 37-42, 91-92, 143-148):**

```typescript
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 4 dirs up from src/<file> -> workspace root (cwd-independent)
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

afterAll(() => {
  rmSync(tmpThing, { recursive: true, force: true }); // WR-02 cleanup discipline
});
```

**Core audit pattern (D-09; from RESEARCH Code Example):** `beforeAll` runs `nx build angular-typechecker` then `npm pack --json` in the dist dir; parse `packJson[0].files.map(f => f.path)`; gates -> `publint <tgz> --strict` (execSync throws on error), `attw <tgz> --profile node16 --format json` (parse, `expect(analysis.problems ?? []).toEqual([])`), positive-presence loop (`executors.json`, `src/executors/angular-typecheck/{schema.json,executor.js}`, `src/index.{js,d.ts}`, `README.md`, `LICENSE`), negative-leak loop (`not.toMatch(/\.spec\./ | /tsconfig\.spec/ | /(libs|fixtures|e2e)\//  | /typecheck-consumer/)`), `@fixtures` non-leak grep, no-install-scripts (`scripts.{preinstall,install,postinstall,prepare,prepublish}` undefined). `rm` the `.tgz` in `afterAll`. NOTE: `files[].path` is package-relative WITHOUT the `package/` prefix.

---

### `e2e/.../src/install-smoke.int.spec.ts` (test/e2e, file-I/O + request-response) -- plan 05-03 (THE tracer bullet)

**Analog:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` -- reuse its `run()` execSync-with-catch helper, the `buildCleanEnv`/`NX_RUNNER_ENV_KEYS` nested-nx isolation, the inject-error-then-assert flow, and the `RunResult` shape. Smoke specifics from RESEARCH "TEST-05 smoke shape" (05-RESEARCH.md lines 476-495).

**`run()` helper + RunResult (copy verbatim, analog lines 94-123):**

```typescript
interface RunResult {
  stdout: string;
  code: number;
}

function run(extra = ''): RunResult {
  try {
    const stdout = execSync(`npx nx run ${TARGET} --output-style=static ${extra}`.trim(), { cwd: workspaceRoot, env, encoding: 'utf8' });
    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}
```

(For the smoke, `cwd` is the per-test tmp workspace, not `workspaceRoot`.)

**Injected-error recipe (copy the JSON.stringify idiom, analog lines 188-191; assertion trio, analog lines 200-210):**

```typescript
const INJECTED_TS_CODE = 'TS2322';
// inject `const x: number = 'str';` into a fixture source, re-run:
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain(INJECTED_TS_CODE);
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/); // CJS import() survived packaging (D-19)
expect(bad.stdout).not.toContain('infrastructure error');
```

**Smoke-specific shape (D-17/D-18/D-20):** `beforeAll` -> `nx build` + `npm pack` -> capture ABSOLUTE tgz path. Per test: `mkdtempSync(join(tmpdir(), 'atc-smoke-'))` -> copy the committed fixture into tmp (do NOT copy the repo `.npmrc` -- D-20 honesty, masks ERESOLVE) -> `npm install <absoluteTgz>` WITHOUT `--legacy-peer-deps` (B-03) -> green run (`exit 0`) -> mutate the TMP copy (inherently crash-safe, no `.pristine` sidecar needed per D-18) -> injected-error run. `afterEach`/`afterAll` `rmSync(tmp, {recursive,force})`. Anti-pattern: NEVER `--no-color` (Nx forwards `color:false` -> rejected by `additionalProperties:false`; use `FORCE_COLOR=0`/`--output-style=static`).

---

### `e2e/.../fixtures/<consumer-app>/` (config/fixture) -- plan 05-03

**Analog:** `libs/typecheck-consumer/` (project.json + src + tsconfig.lib.json) -- BUT with two CRITICAL D-18 divergences from the dev-graph consumer.

**Dev consumer `project.json` (analog, verified `libs/typecheck-consumer/project.json` lines 7-15) -- what NOT to copy verbatim:**

```jsonc
"angular-typecheck": {
  "executor": "@angular-typechecker/angular-typechecker:angular-typecheck",  // DEV workspace-scoped key
  "options": { "tsConfig": "libs/typecheck-consumer/tsconfig.lib.json", "includeDeps": true }
}
```

**Fixture MUST instead use (D-18, STATE carryforward):**

```jsonc
"angular-typecheck": {
  "executor": "angular-typechecker:angular-typecheck",   // PUBLISHED UNSCOPED id (the dev key would NOT bind in a consumer)
  "options": { "tsConfig": "<fixture>/tsconfig.lib.json", "includeDeps": true }
}
```

**Two divergences (D-18):**

1. PUBLISHED unscoped executor id `angular-typechecker:angular-typecheck` (NOT the dev `@angular-typechecker/...` key) -- the install installs from the tarball, so the published id is what binds.
2. NO tsconfig path-alias to plugin source. The dev consumer imports via `@fixtures/...` (verified `consumer.component.ts` line 3); the fixture must be SELF-CONTAINED (its own minimal tsconfig, no `@angular-typechecker/*` or `@fixtures/*` alias bleed-through -- A3) so the smoke genuinely proves resolution FROM the installed package. App project type recommended (most representative). The fixture's `targetDefaults`/options recipe (incl. `includeDeps: true`) IS the consumer README example. Mirror the `tsconfig.lib.json` Angular shape (analog `libs/typecheck-consumer/tsconfig.lib.json` lines 1-16: `noEmit`, `strictTemplates`, `strict`) and a minimal standalone-component source (analog `consumer.component.ts` minus the `@fixtures` dep import).

---

### `package.json` (root, EDIT) -- plan 05-02

**Analog:** the file itself (root `devDependencies` block, verified lines 7-45).

**Action (D-09):** add two ROOT devDependencies (tooling, NEVER in the plugin's published manifest):

```jsonc
"@arethetypeswrong/cli": "0.18.4",
"publint": "0.3.21"
```

Both are slopcheck-verified, postinstall-free, mature (RESEARCH Package Legitimacy Audit). Optionally expose `publint`/`attw` as root npm `scripts` for local/CI ergonomics (D-09).

---

## Shared Patterns

### Serialized e2e determinism (clone from Phase-4)

**Source:** `e2e/angular-typechecker-cache-e2e/vitest.config.mts` (lines 14-34)
**Apply to:** both new e2e spec files (via the cloned `vitest.config.mts`)
The `pool:'forks'` + `singleFork:true` + `fileParallelism:false` + `sequence.concurrent:false` + `environment:'node'` block is mandatory for any execSync/`nx run`/`npm install` harness (parallel workers race on the shared graph/cache/daemon). Bump timeouts to `>= 300000` for install.

### Nested-`nx run` env hygiene (`buildCleanEnv`)

**Source:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` (lines 59-89)
**Apply to:** any nested `nx run`/`npm install` inside the new specs

```typescript
const NX_RUNNER_ENV_KEYS = ['NX_SKIP_NX_CACHE', 'NX_TASK_HASH', 'NX_INVOCATION_ROOT_PID', 'NX_FORKED_TASK_EXECUTOR', 'NX_TASK_TARGET_PROJECT', 'NX_TASK_TARGET_TARGET', 'NX_CLI_SET', 'NX_TERMINAL_CAPTURE_STDERR'];
function buildCleanEnv(cacheDirectory) {
  const cleaned = { ...process.env };
  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }
  return { ...cleaned, NX_DAEMON: 'false', FORCE_COLOR: '0', NX_CACHE_DIRECTORY: cacheDirectory };
}
```

The outer `nx run <e2e>:test` injects cache-defeating `NX_*` vars; strip them so nested runs are clean top-level invocations. `FORCE_COLOR=0` NOT `--no-color` (the flag is rejected by the executor schema's `additionalProperties:false`).

### Exit-code capture + diagnostic assertion (`run()` + trio)

**Source:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` (lines 94-123, 200-210)
**Apply to:** the install-smoke green/error runs
`execSync` throws on non-zero exit; the try/catch concatenates `stdout`+`stderr` and reads `error.status`. Assert the full `TS2322` token (not a bare `2322`), `not.toMatch(/ERR_REQUIRE_ESM/)`, `not.toContain('infrastructure error')` -- this trio distinguishes a real type error from an infra crash / a packaging-broken `import()`.

### Crash-safe fixture mutation

**Source:** `e2e/angular-typechecker-cache-e2e/src/cache-busts-on-dep-error.int.spec.ts` (`healFromPristine` lines 125-148, byte-restore `finally` lines 211-214)
**Apply to:** the injected-error smoke -- BUT D-18 simplifies this: because the smoke mutates a TMP COPY (discarded via `rmSync`), the `.pristine` sidecar is NOT needed. Use the audit/cache `.pristine` pattern only if a committed source must be mutated in place. Anti-pattern (both): NEVER `git checkout` to revert (masks edits, touches index, defeated by a killed worker).

### Manifest read-and-assert (unit)

**Source:** `packages/angular-typechecker/src/package-manifest.spec.ts` (lines 29-43)
**Apply to:** the extended manifest spec -- pure `readFileSync(manifestPath)` + `JSON.parse`; deterministic, no build prerequisite, fast `nx test` loop.

### Build-then-pack-from-dist (PKG-02 fidelity)

**Source:** RESEARCH Architecture Pattern 1 + Code Example (05-RESEARCH.md lines 226-230, 427-433); harness shape from the cache-e2e `execSync(... nx build ...)` + `beforeAll`
**Apply to:** both new e2e specs' `beforeAll`
`@nx/js:tsc` copies the source manifest VERBATIM to `dist/`; `npm pack` packs from `dist`, and the `files` allowlist applies at pack time. ALWAYS audit/install the TARBALL (`npm pack --json` in the dist dir), never the source tree.

## No Analog Found

Files with no close in-repo match (planner uses CONTEXT.md/RESEARCH.md skeletons + the cited external clones):

| File                                                         | Role             | Data Flow    | Reason / Source to use                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json` `release` block                                    | config (release) | batch        | No `release` block in repo. Use RESEARCH Code Example (lines 405-419); external pattern `D:/projects/github/push-based/nx-verdaccio/nx.json` (Nx 22.3-era, patterns only).                                                                                                                                                                                                                                                                   |
| `SECURITY.md`                                                | docs (policy)    | file-I/O     | No security policy in repo. Use RESEARCH skeleton (05-RESEARCH.md lines 533-555); D-14 (GitHub PVR primary + public email fallback, "latest 0.x only", ~7-day ack).                                                                                                                                                                                                                                                                          |
| `.github/workflows/release.yml`                              | config (CI)      | event-driven | No `.github/` in repo (greenfield). Use RESEARCH hardened-workflow skeleton (lines 499-528); external precedent `D:/projects/github/analogjs/analog/.github/workflows/release.yml` (`id-token: write` for provenance) per canonical_refs. D-15 envelope (tag-push trigger, `contents: read` top-level, `id-token: write` job-only, SHA-pin all actions, required-reviewer environment, `persist-credentials: false`, NODE_AUTH_TOKEN UNSET). |
| `.github/dependabot.yml`                                     | config (CI)      | event-driven | No `.github/` in repo. Use RESEARCH skeleton (lines 560-568); D-16 (`package-ecosystem: github-actions`, weekly, keeps SHA pins fresh).                                                                                                                                                                                                                                                                                                      |
| `packages/angular-typechecker/LICENSE`                       | config (legal)   | file-I/O     | No LICENSE in repo. Standard MIT text, (c) 2026 Lars Gyrup Brink Nielsen (D-07); root `package.json` `"license": "MIT"` is the consistency anchor.                                                                                                                                                                                                                                                                                           |
| `packages/angular-typechecker/README.md` (flesh-out content) | docs             | file-I/O     | Current stub ~267 bytes; no rich-doc analog. Content sources: the fixture's proven `targetDefaults` recipe (the executed consumer example, D-18) + Brandon Roberts positioning (D-07).                                                                                                                                                                                                                                                       |

## Metadata

**Analog search scope:** `packages/angular-typechecker/` (manifest, project.json, eslint, core types, index barrel, manifest spec); `e2e/angular-typechecker-cache-e2e/` (all 4 config files + both `.int.spec.ts`); `libs/typecheck-consumer/` (project.json, tsconfig, source); `nx.json`; root `package.json`; repo root (LICENSE/SECURITY.md/.github absence confirmed).
**Files scanned:** 20 (16 read in full + 4 globbed for existence).
**External references (read-only, NOT scanned -- cited per CONTEXT canonical_refs):** `D:/projects/github/push-based/nx-verdaccio`, `D:/projects/github/analogjs/analog`. PRIVACY: the private "connect" repo was NOT read or referenced (fail-closed).
**Pattern extraction date:** 2026-06-28

## PATTERN MAPPING COMPLETE

**Phase:** 5 - Packaging, Publish Hardening + e2e Smoke (MVP)
**Files classified:** 18 distinct new/modified files (20 incl. fixture sub-files)
**Analogs found:** 12 with in-repo analog / 18 total

### Coverage

- Files with exact analog (clone/extend/edit the same or a sibling repo file): 11
- Files with role-match / partial-match analog: 4 (README, both new specs, fixture project.json)
- Files with no in-repo analog (skeleton-driven): 6 (nx.json release block, SECURITY.md, release.yml, dependabot.yml, LICENSE, README content)

### Key Patterns Identified

- The Phase-4 `e2e/angular-typechecker-cache-e2e/` harness is the single richest analog: clone its 4 config files for the new install-e2e project, and reuse its `buildCleanEnv`/`NX_RUNNER_ENV_KEYS` nested-nx isolation + `run()` exit-code-capture + injected-`TS2322` + `ERR_REQUIRE_ESM`-guard trio for both new specs.
- All packaging fidelity audits run against the `npm pack` TARBALL built from `dist` (source -> dist is a verbatim `@nx/js:tsc` copy), never the source tree -- the build-then-pack-from-dist `beforeAll` is shared by the audit gate and the smoke.
- The D-10/B-02 self-contained-types fix to `core/compiler-cli-types.ts` is the central production-code risk; the public `index.d.ts` surface reaches the deep-import types so erasure is ruled out -- hand-declare structural types on the `typescript` substrate, preserving exported names, and gate with `attw --pack` (`problems` empty).
- The install fixture deliberately DIVERGES from `libs/typecheck-consumer/`: it uses the PUBLISHED unscoped executor id `angular-typechecker:angular-typecheck` and carries NO source path-alias, so the smoke proves resolution FROM the installed tarball.
- The release/CI/security files (nx.json release block, release.yml, SECURITY.md, dependabot.yml, LICENSE) have no in-repo analog and are skeleton-driven from CONTEXT/RESEARCH + the cited nx-verdaccio/analog external clones.

### File Created

`.planning/phases/05-packaging-publish-hardening-e2e-smoke-mvp/05-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. The planner can reference these analog files + line-numbered excerpts directly in the 05-01..05-05 PLAN.md action sections.
