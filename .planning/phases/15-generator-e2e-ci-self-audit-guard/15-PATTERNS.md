# Phase 15: Generator e2e + CI self-audit guard - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 5 (3 new specs, 1 new multi-file fixture workspace, 1 optional spec modification)
**Analogs found:** 5 / 5 (every file has an exact or near-exact in-repo analog)

> This phase ships NO plugin/engine/generator source. Every artifact is a TEST or
> test-fixture that mirrors an existing, proven pattern in the same repo. The
> analogs below are load-bearing: the planner should have the executor COPY the
> named excerpts verbatim (changing only the operation), not re-derive them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `e2e/angular-typechecker-install-e2e/fixtures/consumer-generator/` (NEW: `package.json`, `nx.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `src/*.component.ts`, `src/*.component.spec.ts`) | test fixture workspace (static data) | file-I/O (read by the generator + engine) | `matrix-e2e/.../libs/local-lib/` (multi-leaf solution) + `install-e2e/fixtures/consumer-app/` (installable flat shape) | exact (composite of two) |
| `e2e/angular-typechecker-install-e2e/src/generator-e2e.int.spec.ts` (NEW) | test spec (heavy tarball e2e) | request-response / process-orchestration (pack -> install -> generate -> run verdict) | `matrix-5types.int.spec.ts` (primary) + `install-smoke.int.spec.ts` | exact |
| `e2e/angular-typechecker-install-e2e/src/nx-add-e2e.int.spec.ts` (NEW; MAY fold into above as a 2nd `describe`) | test spec (heavy tarball e2e) | process-orchestration (install -> `nx g ...:init` -> assert seed) | `install-smoke.int.spec.ts` harness + RESEARCH Finding 1 recipe | exact (harness) / role-match (assertion) |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (NEW, plain `*.spec.ts`, in-plugin) | test spec (cheap static, 6-cell matrix) | file-I/O + transform (read `ci.yml` + `e2e/*/project.json`, regex-extract, set-compare) | `release-hygiene.int.spec.ts` | role-match (read-repo-files-from-a-spec pattern) |
| `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts` (MODIFY, optional D-13) | test spec modification | file-I/O (extend a positive `REQUIRED_FILES` set) | itself (extend in place) | exact (self) |

## Pattern Assignments

### `e2e/.../fixtures/consumer-generator/` (test fixture workspace)

Two analogs combine into one fixture: copy the **multi-leaf solution tsconfig +
component + spec** shape from `local-lib`, and the **installable flat-workspace
package.json / nx.json** shape from `consumer-app`. It must be a root-level
`projectType: "library"` that is **un-wired** (no `typecheck` target) with a
solution `tsconfig.json` carrying a non-empty `references[]`.

**Solution `tsconfig.json` (COPY the two-reference shape from `local-lib/tsconfig.json` lines 1-8):**
```json
{
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```
This is the LOAD-BEARING difference from `consumer-app/tsconfig.json` (which
references only `./tsconfig.lib.json`). A non-empty `references[]` is what makes
`resolveTsConfig` take case (2) -> points the ONE target at `tsconfig.json` ->
the engine walks BOTH the lib and spec leaves. `configuration/generator.ts`
lines 78-87 read this exact shape:
```typescript
// 2. solution tsconfig.json WITH a non-empty references[] -> point at it.
const solution = joinPathFragments(root, 'tsconfig.json');
if (tree.exists(solution)) {
  const json = readJson<{ references?: unknown[] }>(tree, solution);
  if (Array.isArray(json.references) && json.references.length > 0) {
    return solution;
  }
}
```

**`tsconfig.lib.json` (COPY `local-lib/tsconfig.lib.json` verbatim, lines 1-19)** — note the `exclude` of `*.spec.ts` and `strictTemplates: true`:
```json
{
  "compilerOptions": {
    "noEmit": true, "target": "es2022", "module": "preserve",
    "moduleResolution": "bundler", "strict": true, "skipLibCheck": true,
    "experimentalDecorators": false, "emitDecoratorMetadata": false,
    "lib": ["es2022", "dom"], "types": []
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

**`tsconfig.spec.json` (COPY `local-lib/tsconfig.spec.json` verbatim, lines 1-19)** — includes only `*.spec.ts`.

**Component (lib leaf — COPY `local-lib.component.ts` lines 8-15 shape, template-bearing so template type-check is exercised):**
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'consumer-generator-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class ConsumerGeneratorComponent {
  readonly label: string = 'angular-typechecker generator e2e';
}
```

**Spec (spec leaf — COPY `local-lib.component.spec.ts` lines 14-24 shape)** — inline-declared test globals so the fixture needs NO test-runner package under `types: ["node"]`:
```typescript
import { ConsumerGeneratorComponent } from './consumer-generator.component';

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

describe('ConsumerGeneratorComponent', () => {
  it('constructs with the expected label', () => {
    const component = new ConsumerGeneratorComponent();
    const label: string = component.label;
    expect(label).toBe('angular-typechecker generator e2e');
  });
});
```

**`package.json` (COPY `consumer-app/package.json` deps verbatim, lines 6-18)** — same dep set makes `npm install <tarball>` resolve. `private: true`, `license: "MIT"`:
```json
"dependencies": {
  "@angular/common": "22.0.4", "@angular/compiler": "22.0.4",
  "@angular/core": "22.0.4", "rxjs": "7.8.2", "zone.js": "0.16.0"
},
"devDependencies": {
  "@angular/compiler-cli": "22.0.4", "@nx/devkit": "23.0.1",
  "nx": "23.0.1", "typescript": "6.0.3"
}
```

**`nx.json` — COPY `consumer-app/nx.json` `namedInputs` (lines 3-13) but DELETE the entire `targetDefaults` block (D-02 — LOAD-BEARING):**
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
  }
}
```
> ANTI-PATTERN — do NOT copy `consumer-app/nx.json` lines 14-30 (its
> `targetDefaults["angular-typechecker:typecheck"]` block with `production` as
> the first input). Its presence would make `init`'s whole-entry `??=` SKIP
> seeding (vacuous GE2E-01(b)/GE2E-03), and its `production` first-input would
> under-hash the spec leaf. The new fixture MUST have NO such key.

**`project.json` — un-wired library. Base it on `consumer-app/project.json` (lines 1-15) but REMOVE the `targets` block entirely:**
```json
{
  "name": "consumer-generator",
  "$schema": "node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "src",
  "projectType": "library"
}
```

**NO lockfile.** `matrix-5types.int.spec.ts` lines 180-186 documents why: a stray
`pnpm-lock.yaml` hard-fails Nx's lockfile plugin under an `npm install` copy.
`consumer-workspace` ships one only because it also backs a pnpm spec; the
`consumer-app` fixture (the closer installable analog) ships none. Do not add one.

---

### `e2e/.../src/generator-e2e.int.spec.ts` (GE2E-01 + GE2E-02)

**Analog:** `matrix-5types.int.spec.ts` (primary — it already packs once, installs
into ONE shared tmp copy, and injects into BOTH a component and a spec) with the
`run()` verdict helper from `install-smoke.int.spec.ts`.

**Imports + hoisted constants (COPY `matrix-5types` lines 1-13, 33-43):**
```typescript
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(workspaceRoot, 'e2e', 'angular-typechecker-install-e2e', 'fixtures', 'consumer-generator');
```

**`buildCleanEnv()` (COPY `matrix-5types` / `install-smoke` lines 62-101 VERBATIM)** — strip NX runner vars + peer-override keys, set `NX_DAEMON=false`, `FORCE_COLOR=0`. This is the exact, unmodified block in all three e2e specs.

**`beforeAll` build + pack (COPY `install-smoke` lines 140-159 / `matrix` lines 152-171)** — `npx nx build angular-typechecker --skip-nx-cache` then `npm pack --json` from `distDir`; capture `tarballPath = join(distDir, packed[0].filename)`. **D-08: pack ONCE here and install ONCE into a shared tmp copy** (extend `matrix`'s shared-install `beforeAll` lines 176-218), then byte-restore config between scenarios (see `afterEach` below). Timeout `300000`.

**`run()` verdict helper (COPY `matrix-5types` lines 123-150)** — execSync-throws-on-nonzero caught to capture the injected-error exit + `stdout+stderr`. Parameterize by `cwd` + `target`; keep `--skip-nx-cache` (LOAD-BEARING per lines 125-131):
```typescript
function run(cwd: string, target: string): RunResult {
  try {
    const stdout = execSync(
      `npx nx run ${target} --output-style=static --skip-nx-cache`,
      { cwd, env, encoding: 'utf8' },
    );
    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`, code: execError.status ?? 1 };
  }
}
```

**Generate step (NEW operation — RESEARCH Finding 4 correction to CONTEXT D-04):**
```typescript
execSync('npx nx g angular-typechecker:configuration consumer-generator --skipFormat',
  { cwd: tmp, env, encoding: 'utf8' });
```
- Pass `--skipFormat` (schema has it — `configuration/schema.json` lines 26-30) so
  Prettier is a no-op (the fixture installs no Prettier). `configuration/generator.ts`
  lines 163-165 skips `formatFiles` when `schema.skipFormat`.
- Do NOT pass `--output-style=static` to `nx g` (that is a run flag; RESEARCH A2).

**GE2E-01(a) assert `project.json` (NEW assertion):** read tmp `project.json`,
assert exactly ONE target `typecheck`, `executor === 'angular-typechecker:typecheck'`,
`options.tsConfig` resolves to the solution `tsconfig.json`. The written shape is
`configuration/generator.ts` lines 156-160.

**GE2E-01(b) assert the `init`-seeded `nx.json` block — MATCH the SEEDED block from `init/generator.ts` lines 21-36, NOT the fixture nx.json blocks:**
```typescript
const nxJson = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8'));
const seeded = nxJson.targetDefaults['angular-typechecker:typecheck'];
expect(seeded.cache).toBe(true);
expect(seeded.outputs).toEqual([]);
expect(seeded.inputs[0]).toBe('default');   // never 'production' (WALK-02 landmine)
```
> LOAD-BEARING: the `init` generator seeds a block whose first input is `'default'`
> and which INCLUDES a `{workspaceRoot}/tsconfig.base.json` entry — this DIFFERS
> from the `consumer-app`/`consumer-workspace` fixture `nx.json` blocks (which have
> `'production'` first and no tsconfig.base.json line). Assert against the
> `init/generator.ts` `TYPECHECK_TARGET_DEFAULTS` shape, whose invariant is
> `inputs[0] === 'default'`.

**GE2E-02 clean run then two-leaf injection (COPY `matrix-5types` lines 335-380, distinct-code variant per Finding 3e):**
```typescript
const green = run(tmp, 'consumer-generator:typecheck');
expect(green.code).toBe(0);
// inject a class FIELD into the lib component (TS2322) AND a STATEMENT into the spec (distinct code)
// build injected lines via JSON.stringify (D-05, ASCII-only) -- matrix lines 257-258
const BROKEN_FIELD = `readonly broken: number = ${JSON.stringify('str')};`;
// ...writeFileSync both mutated sources...
const bad = run(tmp, 'consumer-generator:typecheck');
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain('TS2322');   // lib leaf
expect(bad.stdout).toContain('TS2345');   // spec leaf (distinct code, proves BOTH walked)
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
expect(bad.stdout).not.toContain('infrastructure error');
```
> Per Finding 3e / Pitfall 4: the two injected errors MUST carry DISTINCT code
> tokens. `matrix-5types` uses `BROKEN_FIELD` (class body) vs `BROKEN_STATEMENT`
> (function body) — both TS2322. Here the spec-leaf injection needs a DIFFERENT
> code (recommended `declare function needsNumber(n: number): void; needsNumber('str');`
> -> TS2345) so a single token in stdout cannot false-prove "both leaves walked".
> Assert full tokens (`TS2322`, not `2322`) per `matrix` lines 30-33.

**Config restore between scenarios under a shared install (COPY `matrix` `afterEach` lines 326-333 + per-row `finally` lines 374-378):** byte-restore the mutated
sources AND — because `init` seeds `nx.json` and `configuration` writes
`project.json` — restore those two files to their committed/un-seeded state before
any scenario that re-asserts seeding-from-absent (Pitfall 5).

---

### `e2e/.../src/nx-add-e2e.int.spec.ts` (GE2E-03; MAY fold into the file above)

**Analog:** same `install-smoke` / `matrix` harness; assertion is the copy-pasteable
recipe in RESEARCH Finding 1 (lines 120-149).

**Core (the deterministic offline stand-in — `npm install <tarball>` + the EXACT command `nx add`'s `runPluginInitGenerator` runs internally):**
```typescript
cpSync(fixtureDir, tmp, { recursive: true });
writeFileSync(join(tmp, '.npmrc'), '');
execSync(`npm install ${JSON.stringify(tarballPath)}`, {
  cwd: tmp,
  env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
  encoding: 'utf8',
});
// `nx add angular-typechecker` runs `nx g angular-typechecker:init` verbatim
// (Finding 1b: nx 23.0.1 configure-plugins.js hardcodes `g <plugin>:init`).
execSync('npx nx g angular-typechecker:init --skipFormat', { cwd: tmp, env, encoding: 'utf8' });
const nxJson = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8'));
const seeded = nxJson.targetDefaults['angular-typechecker:typecheck'];
expect(seeded).toBeDefined();
expect(seeded.cache).toBe(true);
expect(seeded.outputs).toEqual([]);
expect(seeded.inputs[0]).toBe('default');
```
> Document the `nx add` -> `nx g ...:init` equivalence in the spec header (Finding 1
> rationale): `nx add <bare-name>` always resolves `pkg@latest` from the registry
> (wrong artifact, needs network); the byte-identical internal command run against
> the installed tarball is the faithful, offline, board-aligned proof.

---

### `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01)

**Analog:** `release-hygiene.int.spec.ts` — the precedent for reading repo-root
files (`nx.json`, `.github/workflows/*.yml`) from a spec, workspace-root resolution
from the spec's location, and asserting YAML invariants with regex (no YAML parser).

**MUST be a plain `*.spec.ts`, NOT `*.int.spec.ts`** — the plugin's vitest glob is
`{src,tests}/**/*.{test,spec}.{...}` (`packages/angular-typechecker/vitest.config.mts`
line 14), so it auto-routes into the 6-cell `test` matrix; `*.int.spec.ts` is the
e2e project's glob. It is excluded from the tarball by `tsconfig.lib.json` line 20
(`src/**/*.spec.ts`).

**Workspace-root resolution (SAME 3-dirs-up depth as the e2e specs — `release-hygiene` lines 23-28):**
```typescript
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
```

**Enumeration (Finding 2a — glob is over-broad via the `scope:fixture` tag; use `readdirSync` of `e2e/` — zero Node-version question):**
```typescript
function enumerateE2eProjects(root: string): string[] {
  return readdirSync(join(root, 'e2e'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => JSON.parse(readFileSync(join(root, 'e2e', d.name, 'project.json'), 'utf8')).name as string)
    .sort();
}
```
> Verified: `e2e/` has exactly three subdirectories, each `.name` === its dir name:
> `angular-typechecker-cache-e2e`, `angular-typechecker-install-e2e`,
> `angular-typechecker-matrix-e2e`. Do NOT enumerate by the `scope:fixture` tag —
> three `libs/*` projects also carry it (would over-count 6 vs 3).

**`-p` extraction (Finding 2b — job-scoped + line-start `-p`, reusing the `release-hygiene` no-parser precedent).** In the live `ci.yml` the two `-p` lines are:
- line 116 (test job, mid-line): `- run: npx nx run-many -t typecheck-drift test -p angular-typechecker`
- lines 143-145 (e2e job, folded `>` scalar, `-p` at physical-line-start):
  `-p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`
```typescript
function extractE2ePList(ci: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((l) => /^  e2e:\s*$/.test(l));
  if (start === -1) throw new Error('GUARD-01: could not locate the `e2e:` job in ci.yml');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [a-z0-9-]+:\s*$/.test(lines[i])) { end = i; break; }  // digits allowed -> matches `fallow:` etc.
  }
  const pLine = lines.slice(start, end).find((l) => /^\s*-p\s+\S/.test(l));
  if (!pLine) throw new Error('GUARD-01: no `-p` project list found in the `e2e:` job');
  return pLine.trim().replace(/^-p\s+/, '').split(/\s+/).sort();
}
```
> Job-key regex MUST allow digits (`[a-z0-9-]+`) or it misses `e2e:` itself. The
> line-start `-p` discriminator (`/^\s*-p\s+\S/`) uniquely selects the folded e2e
> continuation and never the mid-line test-job `-p`.

**Bidirectional `every` set-equality with located messages (Finding 2d — COPY the RESEARCH Code Examples block lines 435-451):**
```typescript
it('covers every e2e/* project (no forgotten -p entry -> no silent skip)', () => {
  for (const p of graph) {
    expect(pList, `e2e/${p} is missing from the ci.yml e2e job -p list`).toContain(p);
  }
});
it('lists no stale/non-e2e project', () => {
  for (const p of pList) {
    expect(graph, `"${p}" in the -p list is not an e2e/* project`).toContain(p);
  }
});
it('is an exact set match', () => { expect(pList).toEqual(graph); });
```

**Deliberate-RED proof (D-12, MANDATORY — not a committed test):** transiently add
`e2e/phantom-e2e/project.json` (`{"name":"phantom-e2e"}`) OR drop one `-p` entry ->
run the guard -> confirm the LOCATED RED message -> restore. Record the outcome in
the phase SUMMARY (same rigor as Phase 12's tripwire deliberate-RED).

---

### `e2e/.../src/tarball-audit.int.spec.ts` (MODIFY, optional D-13)

**Analog:** itself. Extend the `REQUIRED_FILES` positive set (lines 41-49) with the
five shipped generator paths (Finding 5). Add ONLY to the array; the existing gates
and leak guards (lines 220-252) run unchanged.
```typescript
const REQUIRED_FILES = [
  'executors.json',
  'src/executors/typecheck/schema.json',
  'src/executors/typecheck/executor.js',
  'src/index.js',
  'src/index.d.ts',
  'README.md',
  'LICENSE',
  // Phase 15 D-13 additions (verified shipped via project.json assets + files allowlist):
  'generators.json',
  'src/generators/configuration/generator.js',
  'src/generators/configuration/schema.json',
  'src/generators/init/generator.js',
  'src/generators/init/schema.json',
];
```
> Verified the leak guards (lines 226-233: `/\.spec\./`, `/tsconfig\.spec/`,
> `/(libs|fixtures|e2e)\//`, `/typecheck-consumer/`) do NOT false-positive on
> `src/generators/*/generator.js` or `schema.json`. `generators.json` ships via
> the `project.json` build asset glob (lines 32-36) + the `package.json` `files`
> allowlist (lines 35-41); the `schema.json` files ship via the `**/!(*.ts)` asset
> glob; the `.spec.ts` generator tests are excluded by `tsconfig.lib.json`.
> CAVEAT (do not silently expand scope): D-13 is belt-and-suspenders, NOT one of
> the four named requirements — the GE2E scenarios already empirically prove the
> generators ship. Planner MAY include or drop it.

## Shared Patterns

### Workspace-root resolution from a spec's location
**Source:** every e2e spec + `release-hygiene.int.spec.ts` lines 23-28.
**Apply to:** ALL four new specs (identical depth — 3 dirs up — for both the e2e specs and the in-plugin guard).
```typescript
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
```

### `buildCleanEnv()` (nested-nx env isolation + peer honesty)
**Source:** `matrix-5types.int.spec.ts` / `install-smoke.int.spec.ts` / `tarball-audit.int.spec.ts` lines 62-101 (byte-identical across all three).
**Apply to:** `generator-e2e.int.spec.ts` + `nx-add-e2e.int.spec.ts` (NOT the guard — it runs no nested nx).
```typescript
const NX_RUNNER_ENV_KEYS = [
  'NX_SKIP_NX_CACHE', 'NX_TASK_HASH', 'NX_INVOCATION_ROOT_PID',
  'NX_FORKED_TASK_EXECUTOR', 'NX_TASK_TARGET_PROJECT', 'NX_TASK_TARGET_TARGET',
  'NX_CLI_SET', 'NX_TERMINAL_CAPTURE_STDERR',
];
function buildCleanEnv(): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };
  for (const key of NX_RUNNER_ENV_KEYS) { delete cleaned[key]; }
  delete cleaned['npm_config_legacy_peer_deps'];
  delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];
  return { ...cleaned, NX_DAEMON: 'false', FORCE_COLOR: '0' };
}
```

### Pack + tmp-install-from-tarball honesty harness
**Source:** `install-smoke.int.spec.ts` lines 140-208 (`beforeAll` build/pack + tmp install with empty `.npmrc` + non-existent `npm_config_userconfig`).
**Apply to:** both GE2E specs. Do NOT add a peer-override flag (B-03: a real consumer ERESOLVE must surface, not be masked).

### `run()` execSync-catch verdict helper + full-token assertion
**Source:** `matrix-5types.int.spec.ts` lines 123-150; assertion discipline lines 30-33, 369-373.
**Apply to:** `generator-e2e.int.spec.ts`. Keep `--skip-nx-cache`, `--output-style=static`; NEVER pipe `nx` through `head`/`rg`; assert full code tokens + `not.toMatch(/ERR_REQUIRE_ESM/)` + `not.toContain('infrastructure error')`.

### Read-repo-file + regex (no YAML parser)
**Source:** `release-hygiene.int.spec.ts` `stripCommentLines` lines 54-59 + the `readFileSync`+regex `it()` blocks.
**Apply to:** `ci-e2e-coverage-guard.spec.ts` (line-level invariants over `ci.yml`; a YAML dependency contradicts the established precedent).

### The UNSCOPED published id `angular-typechecker:typecheck`
**Source:** `install-smoke.int.spec.ts` lines 32-33; `configuration/generator.ts` line 24; `init/generator.ts` line 63.
**Apply to:** all GE2E assertions in the tmp workspace. The dev workspace-scoped `@angular-typechecker/...` key does NOT bind in a consumer install — assert the unscoped id.

## No Analog Found

None. Every file has an exact or near-exact in-repo analog. The only NEW behavior
is the operation each harness performs (generate + assert config, vs the existing
smoke/matrix run-and-assert-verdict), which the RESEARCH findings specify with
copy-pasteable recipes.

## Metadata

**Analog search scope:** `e2e/angular-typechecker-install-e2e/{src,fixtures}`,
`e2e/angular-typechecker-matrix-e2e/{src,fixtures}`,
`packages/angular-typechecker/{src/generators,project.json,package.json,tsconfig.lib.json,vitest.config.mts,generators.json}`,
`.github/workflows/ci.yml`, root `nx.json` seed source (via `init/generator.ts`).
**Files scanned:** 24 (4 spec analogs, 2 fixture families, 2 generators + 2 schemas, generators.json, 3 tsconfigs, 2 vitest configs, 2 project.json, plugin package.json, ci.yml, 2 fixture nx.json).
**Pattern extraction date:** 2026-07-02

## PATTERN MAPPING COMPLETE

**Phase:** 15 - Generator e2e + CI self-audit guard
**Files classified:** 5 (3 new specs, 1 new fixture workspace, 1 optional spec modification)
**Analogs found:** 5 / 5

### Coverage
- Files with exact analog: 4 (fixture composite, `generator-e2e`, `nx-add-e2e`, `tarball-audit` self)
- Files with role-match analog: 1 (`ci-e2e-coverage-guard` <- `release-hygiene` read-repo-files pattern)
- Files with no analog: 0

### Key Patterns Identified
- All heavy e2e specs COPY the `buildCleanEnv` + pack + tmp-install + `run()` verdict harness VERBATIM from `matrix-5types`/`install-smoke` — only the operation changes (generate/assert vs smoke-run).
- The new `consumer-generator` fixture is a COMPOSITE: multi-leaf solution tsconfig + component + spec from `local-lib`; installable flat package.json/nx.json from `consumer-app` — MINUS the `targetDefaults` key (D-02) and MINUS any lockfile.
- GE2E-01(b)/GE2E-03 assert against the `init`-SEEDED block (`init/generator.ts` `TYPECHECK_TARGET_DEFAULTS`, `inputs[0] === 'default'`), NOT the fixture nx.json blocks (which are `production`-first and must be absent from the fixture).
- GUARD-01 reuses `release-hygiene`'s read-repo-file + regex pattern as a plain in-plugin `*.spec.ts`; enumerate via `readdirSync('e2e')` (NOT the `scope:fixture` tag), extract the e2e-job `-p` job-scoped + line-start (NOT a global regex), assert bidirectional `every` with located messages, and run the mandatory deliberate-RED proof.

### File Created
`.planning/phases/15-generator-e2e-ci-self-audit-guard/15-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog file + line range directly in PLAN.md action sections.
