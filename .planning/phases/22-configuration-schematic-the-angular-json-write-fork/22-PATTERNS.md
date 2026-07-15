# Phase 22: `configuration` schematic + the `angular.json` write-fork - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 7 (2 modified, 5 new)
**Analogs found:** 7 / 7 (every file has an in-repo analog; zero "no analog")

All paths below are workspace-relative under
`packages/angular-typechecker/` unless shown otherwise. The write-fork implementation shape,
`resolveTsConfigLeaves` helper, and the `collection.json` body are pre-specified in
`22-RESEARCH.md` (lines 133-185, 267-298, 203-216) -- treat that research as the design source
of truth; this map points the planner at the concrete in-repo code to COPY each pattern from.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/generators/configuration/generator.ts` (MODIFIED) | generator | file-I/O (virtual `Tree` JSON edit) + transform | itself (Nx branch verbatim) + `src/generators/init/generator.ts` | exact (self-mirror) |
| `src/schematics/configuration/schematic.ts` (NEW) | schematic (bridge re-export) | request-response (adapter) | `src/builders/typecheck/builder.ts` | exact |
| `collection.json` (NEW) | config (Angular schematics manifest) | n/a | `builders.json` + `generators.json` | exact |
| `package.json` (MODIFIED) | config (plugin manifest) | n/a | itself (Phase 21 `builders` field add) | exact |
| `project.json` (MODIFIED) | config (build target `assets`) | n/a | itself (`builders.json`/`generators.json` asset globs) | exact |
| `src/generators/configuration/configuration-angular-cli.spec.ts` (NEW) | test | n/a | `src/generators/configuration/configuration.spec.ts` | exact (role + substrate) |
| `src/schematics/configuration/nx-generators-surface-regression.spec.ts` (NEW) | test | n/a | `src/builders/typecheck/nx-surface-regression.spec.ts` | exact |

## Pattern Assignments

### `src/generators/configuration/generator.ts` (generator, file-I/O + transform) -- MODIFIED

**Analog:** itself. The Nx path stays BYTE-UNCHANGED as the else branch (ACS-02, Pitfall 5);
add an early `tree.exists('angular.json')` fork ABOVE it plus a NEW `resolveTsConfigLeaves`
helper alongside (never modifying) `resolveTsConfig`.

**Imports pattern (lines 1-13)** -- extend, do NOT rewrite. The fork needs `readJson`,
`updateJson`, `readProjectConfiguration`, `joinPathFragments`, `formatFiles` (all already
importable from `@nx/devkit`; only `updateJson` is net-new to the import list):
```typescript
import { isAbsolute } from 'node:path';

import {
  formatFiles,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { ProjectConfiguration, Tree } from '@nx/devkit';

import initGenerator, { TYPECHECK_EXECUTOR_ID } from '../init/generator';
import type { ConfigurationGeneratorSchema } from './schema';
```

**Existing override-resolver to REUSE verbatim on the CLI branch (lines 22-43)** --
`resolveTsConfigLeaves` calls this exact helper for the `--tsConfig` short-circuit
(RESEARCH lines 277-279), wrapping its single result as `[resolved]`:
```typescript
function resolveTsConfigOverride(
  tree: Tree,
  projectRoot: string,
  tsConfig: string,
  project: string,
): string {
  if (isAbsolute(tsConfig)) {
    return tsConfig;
  }

  const overridePath = joinPathFragments(projectRoot, tsConfig);

  if (!tree.exists(overridePath)) {
    throw new Error(
      `--tsConfig "${tsConfig}" for project "${project}" resolves to ` +
        `"${overridePath}", which does not exist. Pass a path relative to the ` +
        `project root (or an absolute path).`,
    );
  }

  return overridePath;
}
```

**Core pattern to MIRROR (not modify) -- the flat-project projectType + existence-probe
discipline (lines 96-105):** the NEW `resolveTsConfigLeaves` clones this branch-3 shape
(`application -> tsconfig.app.json`, else `tsconfig.lib.json`, each `tree.exists`-probed) but
returns a filtered `string[]` and ALSO probes `<root>/tsconfig.spec.json`:
```typescript
  // 3. flat-project fallback -> leaf by projectType + existence probe.
  const leaf =
    projectConfig.projectType === 'application'
      ? 'tsconfig.app.json'
      : 'tsconfig.lib.json';
  const leafPath = joinPathFragments(root, leaf);

  if (tree.exists(leafPath)) {
    return leafPath;
  }
```
The exact `resolveTsConfigLeaves` body to add is in RESEARCH lines 267-298 (returns
`[buildLeaf, specLeaf].filter(tree.exists)`, emits the single available leaf, throws only on
an empty array -- edge case in CONTEXT lines 119-123 + RESEARCH 119-123).

**Nx-branch throw pattern to REUSE for the empty-array case (lines 119-122):** the "no
tsconfig resolved" located-error shape the new helper mirrors:
```typescript
  throw new Error(
    `Could not resolve a tsconfig for project "${schema.project}": no ` +
      `"${solution}" and no "${leafPath}". Pass --tsConfig explicitly.`,
  );
```

**Collision-by-id + idempotent-rewrite pattern to MIRROR onto the CLI branch (lines 148-192).**
This is the exact semantics D-05 says to reuse -- copy the shape, swap `executor`->`builder`,
swap `projectConfig.targets[targetName]` -> `project.architect[targetName]` inside `updateJson`,
and drop the `initGenerator` call (D-04):
```typescript
  const targetName = schema.targetName ?? 'typecheck';

  // GEN-04: reject explicit empty / whitespace-only name.
  if (targetName.trim() === '') {
    throw new Error(
      `--targetName for project "${schema.project}" must be a non-empty target ` +
        `name. Omit it to use the default "typecheck".`,
    );
  }

  // GEN-04 / D-09: collision by EXECUTOR (compare the UNSCOPED id). Non-ours -> throw.
  const existing = projectConfig.targets?.[targetName];

  if (existing && existing.executor !== TYPECHECK_EXECUTOR_ID) {
    throw new Error(
      `Project "${schema.project}" already has a "${targetName}" target using ` +
        `executor "${existing.executor}". Choose a different --targetName or ` +
        `remove the existing target.`,
    );
  }

  projectConfig.targets ??= {};
  // idempotent re-run: preserve user keys + extra options, re-assert only id + tsConfig.
  projectConfig.targets[targetName] = {
    ...existing,
    executor: TYPECHECK_EXECUTOR_ID,
    options: { ...existing?.options, tsConfig },
  };
  updateProjectConfiguration(tree, schema.project, projectConfig);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
```

**Target fork shape (CLI branch) -- from RESEARCH lines 146-178:** the CLI branch reads via
the `readProjectConfiguration` `angular.json` polyfill, resolves leaves, then `updateJson`s
`angular.json` at `projects.<p>.architect.<targetName>` with `builder` (not `executor`) =
`TYPECHECK_EXECUTOR_ID` and `options.tsConfig` = the leaf ARRAY. Two deltas vs the Nx mirror
above: (1) read the collision candidate defensively from `project.architect ?? project.targets`
(RESEARCH line 194 -- the `architect`/`targets` alias); (2) compare `existing.builder` not
`existing.executor`. The `targetName` default + empty-name reject should be HOISTED above the
fork so both branches share it (RESEARCH lines 140-144). The verified written shape is in
RESEARCH lines 301-317.

---

### `src/schematics/configuration/schematic.ts` (schematic bridge, request-response) -- NEW

**Analog:** `src/builders/typecheck/builder.ts` (a `convertNxExecutor` re-export; the
`configuration` schematic is the exact `convertNxGenerator` twin -- CONTEXT lines 256-259,
RESEARCH lines 217-223).

**Full analog to clone (builder.ts lines 1-21)** -- swap `convertNxExecutor`->`convertNxGenerator`,
`typecheckExecutor` (from `../../executors/typecheck/executor`) -> `configurationGenerator`
(from `../../generators/configuration/generator`):
```typescript
import { convertNxExecutor } from '@nx/devkit';

import typecheckExecutor from '../../executors/typecheck/executor';

/**
 * The Angular CLI builder (ACB-01) -- a thin `convertNxExecutor` re-export of the
 * SAME `typecheck` executor default export. ...
 */
export default convertNxExecutor(typecheckExecutor);
```
Target (RESEARCH lines 219-222), imports only `@nx/devkit` (already a dep, keeps
`@nx/dependency-checks` green) + the local generator; compiles CJS under `module: nodenext`
via the EXISTING `tsconfig.lib.json` `include: ["src/**/*.ts"]` (no build-config change):
```typescript
import { convertNxGenerator } from '@nx/devkit';

import configurationGenerator from '../../generators/configuration/generator';

export default convertNxGenerator(configurationGenerator);
```

---

### `collection.json` (Angular schematics manifest, config) -- NEW

**Analog:** `builders.json` (the Phase-21 sibling manifest) and `generators.json` (same
`factory`/`schema`/`description` entry shape).

**`builders.json` (full):**
```json
{
  "builders": {
    "typecheck": {
      "implementation": "./src/builders/typecheck/builder",
      "schema": "./src/builders/typecheck/schema.json",
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```

**`generators.json` (full) -- note the entry shape the collection copies (`factory` +
`schema` + `description`), and that the schematic REUSES the generator `schema.json` VERBATIM
(RESEARCH lines 227-228; no sanitized schematic schema needed, UNLIKE the Phase-21 builder):**
```json
{
  "$schema": "http://json-schema.org/schema",
  "name": "angular-typechecker",
  "version": "0.1",
  "generators": {
    "configuration": {
      "factory": "./src/generators/configuration/generator",
      "schema": "./src/generators/configuration/schema.json",
      "description": "Wire a typecheck target (executor angular-typechecker:typecheck) into a project."
    },
    "init": { "...": "..." }
  }
}
```
The exact `collection.json` body to write (schematics dialect -- `factory` points at
`./src/schematics/configuration/schematic`, `schema` REUSES
`./src/generators/configuration/schema.json`, only the `configuration` entry now, `init`/`ng-add`
are Phase 23) is in RESEARCH lines 204-216. The `$schema` at
`../../node_modules/@angular-devkit/schematics/collection-schema.json` is advisory -- omit if
absent (RESEARCH line 216, Assumption A3).

---

### `package.json` (plugin manifest, config) -- MODIFIED

**Analog:** itself -- how the `builders` field + `builders.json` `files` entry were added in
Phase 21. Two additive edits, NEW SIBLINGS never replacements (D-06).

**Fields block (lines 26-43)** -- add `"schematics": "./collection.json"` alongside
`executors`/`generators`/`builders`, and add `"collection.json"` to `files`:
```json
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "executors": "./executors.json",
  "generators": "./generators.json",
  "builders": "./builders.json",
  "exports": {
    ".": "./src/index.js",
    "./package.json": "./package.json"
  },
  "files": [
    "src",
    "executors.json",
    "generators.json",
    "builders.json",
    "README.md",
    "LICENSE"
  ],
```
Keep `generators` DECLARED and unchanged so Nx's `generators ?? schematics` precedence keeps
`collection.json` Nx-invisible (ACS-04 / RESEARCH line 191).

---

### `project.json` (build `assets` glob, config) -- MODIFIED

**Analog:** itself -- the existing `executors.json` / `generators.json` / `builders.json` asset
globs in the `build` target. Add a fourth glob copying `collection.json -> .` (Pitfall 4: without
it the tarball omits `collection.json` and `ng generate` fails post-publish).

**Existing asset globs to mirror (lines 27-41):**
```json
          {
            "input": "./packages/angular-typechecker",
            "glob": "executors.json",
            "output": "."
          },
          {
            "input": "./packages/angular-typechecker",
            "glob": "generators.json",
            "output": "."
          },
          {
            "input": "./packages/angular-typechecker",
            "glob": "builders.json",
            "output": "."
          },
```
Add an identical block with `"glob": "collection.json"`.

---

### `src/generators/configuration/configuration-angular-cli.spec.ts` (test) -- NEW

**Analog:** `src/generators/configuration/configuration.spec.ts` (the existing Nx-tree behavior
spec; it must STAY GREEN untouched -- ACS-02). Parallel it with an `angular.json`-SEEDED tree
(D-07, Pitfall 1: NOT bare `createTreeWithEmptyWorkspace`).

**Test-harness + import pattern (analog lines 1-25):** clone the `beforeEach`/`describe`/`it`
structure and the `readProjectConfiguration`/`writeJson` devkit-testing helpers, but SEED an
Angular CLI substrate. Pitfall 1 recipe (RESEARCH lines 233-234): start from
`createTreeWithEmptyWorkspace()` then `tree.delete('nx.json')` + `tree.write('angular.json', ...)`
+ write the tsconfig leaves; assert BOTH `tree.exists('angular.json') === true` AND
`tree.exists('nx.json') === false`. No `addProjectConfiguration` needed -- the polyfill reads the
project from `angular.json`.
```typescript
import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import configurationGenerator from './generator';
```

**Assertion + arrange pattern to MIRROR (analog lines 27-61, 249-317)** -- the exact idempotency,
collision-throw, override, and `targetName` cases to re-express against the `architect` target
with a leaf ARRAY (D-07 (b)):
```typescript
  it('wires a solution-tsconfig target and seeds targetDefaults via init (GEN-01/02/03/08)', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
      targets: {},
    });
    writeJson(tree, 'libs/my-lib/tsconfig.json', { files: [], include: [], references: [ /* ... */ ] });

    await configurationGenerator(tree, { project: 'my-lib' });

    const projectConfig = readProjectConfiguration(tree, 'my-lib');
    expect(projectConfig.targets?.typecheck).toEqual({
      executor: 'angular-typechecker:typecheck',
      options: { tsConfig: 'libs/my-lib/tsconfig.json' },
    });
  });
```
```typescript
  it('is idempotent for our own target -- rewrites, no duplicate (GEN-04)', async () => { /* ... */ });
  it('preserves user-added keys on our target during an idempotent re-run (GEN-04)', async () => { /* ... */ });
  it('throws on a non-ours same-named target instead of clobbering (GEN-04)', async () => {
    // targets: { typecheck: { executor: '@nx/js:tsc' } } -> rejects /already has a "typecheck" target/
  });
```
Required NEW cases (RESEARCH lines 375-383, the Wave-0 test map): CLI fork writes
`architect.typecheck = { builder, options.tsConfig: [buildLeaf, specLeaf] }`; idempotent re-run
preserves user keys; collision on a NON-ours `builder` throws; empty/whitespace `--targetName`
rejected; explicit `--tsConfig` override honored (as `[resolved]`); single-leaf edge emits
`[buildLeaf]`; no-leaf throws; NO stray `nx.json` (`expect(tree.exists('nx.json')).toBe(false)`);
COV-01 per-project scoping on a TWO-project (app + lib) seeded tree -- each target's array equals
EXACTLY that project's leaves, no cross-project bleed.

---

### `src/schematics/configuration/nx-generators-surface-regression.spec.ts` (test) -- NEW

**Analog:** `src/builders/typecheck/nx-surface-regression.spec.ts` (the `executors ?? builders`
regression). Clone it, swap `executors`->`generators`, `builders`->`schematics`,
`executors.json`->`generators.json`, and assert `generators.<name>.factory` instead of
`executors.<name>.implementation` (ACS-04, D-06).

**Full analog to clone (lines 1-55):**
```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface PluginManifest {
  executors?: string;
  builders?: string;
}

interface ExecutorsManifest {
  executors?: Record<string, { implementation?: string }>;
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as PluginManifest;
const executorsManifest = JSON.parse(
  readFileSync(join(packageRoot, 'executors.json'), 'utf8'),
) as ExecutorsManifest;

describe('Nx executors ?? builders surface regression (ACB-03 / T-21-08)', () => {
  it('keeps the executors field declared + unchanged so Nx resolves it before builders', () => {
    expect(manifest.executors).toBe('./executors.json');
  });

  it('declares the additive builders field alongside executors (never a replacement)', () => {
    expect(manifest.builders).toBe('./builders.json');
  });

  it('still declares the typecheck executor implementation (nx run <project>:typecheck stays resolvable)', () => {
    expect(executorsManifest.executors?.typecheck?.implementation).toBe(
      './src/executors/typecheck/executor',
    );
  });
});
```
Mirror as: assert `manifest.generators === './generators.json'`,
`manifest.schematics === './collection.json'`, and
`generatorsManifest.generators?.configuration?.factory === './src/generators/configuration/generator'`
(so `nx g angular-typechecker:configuration` stays resolvable via `generators`, never reads
`collection.json`). `packageRoot` from `..` x3 works identically from
`src/schematics/configuration/` (same 3-deep nesting as `src/builders/typecheck/`).

## Shared Patterns

### The shared executor/builder id (single source of truth)
**Source:** `src/generators/init/generator.ts` line 15
**Apply to:** the CLI branch of `generator.ts` (as the `builder` id) and both regression specs.
```typescript
export const TYPECHECK_EXECUTOR_ID = 'angular-typechecker:typecheck';
```
Same string on both branches (Nx `executor`, CLI `builder`) so the collision check is uniform
(CONTEXT lines 249-251). Import it, never re-literal it.

### Virtual-`Tree`-only probing (never `node:fs`)
**Source:** `resolveTsConfig` / `resolveTsConfigOverride` in `generator.ts` (lines 34, 88, 103)
**Apply to:** the NEW `resolveTsConfigLeaves` helper.
All existence checks use `tree.exists(path)`, all path joins use `joinPathFragments(root, leaf)`
so resolution works on `createTreeWithEmptyWorkspace` and the seeded `angular.json` tree
(Landmine 2 / RESEARCH line 115). Paths are WORKSPACE-root-relative because
`projectConfig.root` already is.

### Additive-only manifest siblings (never edit the Nx surface)
**Source:** D-06 + the `builders`/`builders.json` precedent (package.json lines 29-43,
project.json lines 27-41, `builders.json`)
**Apply to:** `package.json` (`schematics` field + `files` entry), `project.json` (asset glob),
`collection.json`. Nx reads `generators ?? schematics` and `executors ?? builders`, so the new
files are Nx-invisible as long as `generators`/`executors` stay declared and unchanged. Proven,
not assumed, by the surface-regression spec.

### Config-edit-only generator (no `generateFiles`, single `formatFiles`)
**Source:** `generator.ts` lines 190-192 + `init/generator.ts` lines 72-74
**Apply to:** the CLI branch. Edit JSON via devkit helpers only, then a single
`if (!schema.skipFormat) { await formatFiles(tree); }` at the end. The CLI branch SKIPS
`initGenerator` (D-04) -- no `nx.json`/`targetDefaults` analog off-Nx.

## No Analog Found

None. Every Phase-22 file has a direct in-repo analog. The single genuinely new logic
(`resolveTsConfigLeaves`, Approach A) is a leaf-array variant of the existing `resolveTsConfig`
branch-3 discipline and is fully specified in RESEARCH lines 267-298.

## Metadata

**Analog search scope:** `packages/angular-typechecker/` (generators, builders, schematics-to-be,
manifests, build config, specs). Nx-source facts (polyfill / `generators ?? schematics`
precedence) are pre-verified in RESEARCH against `node_modules/nx@23.0.1` -- not re-read here.
**Files scanned:** ~10 (Glob inventory of the package) + 8 read in full.
**Pattern extraction date:** 2026-07-10
