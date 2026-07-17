# Phase 23: `init` schematic parity + first-party `ng-add` - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 10 (5 new, 5 modified)
**Analogs found:** 10 / 10 (every new/modified file has an exact in-repo analog)

All analogs live under `packages/angular-typechecker/`. Phase 23 writes almost no
new logic -- it CLONES the shipped `configuration` schematic layout, COMPOSES the
shipped `configurationGenerator`, and mirrors the shipped angular.json-seeded test
harness. There is one genuinely new composed generator (`ngAddGenerator`); everything
else is a thin re-export, an additive fork, or a manifest edit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `src/generators/ng-add/generator.ts` | generator | batch / orchestration (enumerate + compose per project) | `src/generators/configuration/generator.ts` (write-fork) + `src/generators/init/generator.ts` (default-export signature) | role+flow (composed) |
| NEW `src/generators/ng-add/schema.json` | config (schema) | n/a (static) | `src/generators/init/schema.json` (`skipFormat`) + `configuration/schema.json` (`project` w/ `$default`) | exact |
| NEW `src/generators/ng-add/schema.d.ts` | config (type) | n/a (static) | `src/generators/configuration/schema.d.ts` | exact |
| NEW `src/schematics/ng-add/schematic.ts` | schematic (adapter) | request-response (Rule) | `src/schematics/configuration/schematic.ts` | exact (composed target) |
| NEW `src/schematics/init/schematic.ts` | schematic (adapter) | request-response (Rule) | `src/schematics/configuration/schematic.ts` | exact |
| MOD `src/generators/init/generator.ts` | generator | config-edit + early-return fork | the `tree.exists('angular.json')` fork in `configuration/generator.ts` (L233-275) | exact (same pattern) |
| MOD `collection.json` | config (manifest) | n/a (static) | the existing `configuration` entry | exact |
| MOD `package.json` | config (manifest) | n/a (static) | the existing `peerDependencies` block (L50-53) | exact |
| MOD `eslint.config.mjs` | config | n/a (static) | the existing `@nx/dependency-checks` block (L66-88) | exact |
| NEW `src/generators/ng-add/ng-add.spec.ts` + `init/init-angular-cli.spec.ts` + static peer-dep spec; EXTEND `nx-generators-surface-regression.spec.ts` | test | n/a | `configuration-angular-cli.spec.ts`, `init.spec.ts`, `nx-generators-surface-regression.spec.ts` | exact |

## Pattern Assignments

### `src/schematics/init/schematic.ts` and `src/schematics/ng-add/schematic.ts` (schematic adapter, request-response)

**Analog:** `src/schematics/configuration/schematic.ts` (whole file, 19 lines)

The shipped analog is a ~2-line `convertNxGenerator` re-export with a doc comment. The
two new re-exports are byte-identical in shape -- only the imported generator changes.
`init` re-exports the EXISTING `initGenerator`; `ng-add` re-exports the NEW composed
`ngAddGenerator`.

Analog imports + re-export (`configuration/schematic.ts` L1-19):
```typescript
import { convertNxGenerator } from '@nx/devkit';

import configurationGenerator from '../../generators/configuration/generator';

/** ...doc comment explaining the thin re-export + Nx-invisibility... */
export default convertNxGenerator(configurationGenerator);
```

New files (per RESEARCH Code Examples L294-304):
```typescript
// src/schematics/init/schematic.ts
import { convertNxGenerator } from '@nx/devkit';
import initGenerator from '../../generators/init/generator';
export default convertNxGenerator(initGenerator);

// src/schematics/ng-add/schematic.ts
import { convertNxGenerator } from '@nx/devkit';
import ngAddGenerator from '../../generators/ng-add/generator';
export default convertNxGenerator(ngAddGenerator);
```

Keep the doc-comment discipline of the analog (explain: thin re-export, fork lives in
the generator, Nx-invisible via `generators ?? schematics`). No build-config change --
`tsconfig.lib.json`'s `include: ["src/**/*.ts"]` already covers `src/schematics/`.

---

### `src/generators/init/generator.ts` (generator, additive early-return fork) -- MODIFIED

**Analog:** the `tree.exists('angular.json')` write-fork already in
`src/generators/configuration/generator.ts` (L233-275) -- the "gate the Nx work out
explicitly, return early" discipline. Apply it at the TOP of `initGenerator`.

**Current `initGenerator` body to preserve BYTE-UNCHANGED** (`init/generator.ts` L61-75):
```typescript
export default async function initGenerator(
  tree: Tree,
  schema: InitGeneratorSchema,
): Promise<void> {
  const nxJson: NxJsonConfiguration = readNxJson(tree) ?? {};
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[TYPECHECK_EXECUTOR_ID] ??= TYPECHECK_TARGET_DEFAULTS;
  updateNxJson(tree, nxJson);

  if (!schema?.skipFormat) {
    await formatFiles(tree);
  }
}
```

**Fork to ADD** (before `readNxJson`, per RESEARCH Pattern 4 L202-214; D-04). The
analog fork's shape is `configuration/generator.ts` L238-275 (`if (tree.exists('angular.json')) { ...write...; if (!schema.skipFormat) await formatFiles(tree); return; }`):
```typescript
if (tree.exists('angular.json')) {
  // Angular CLI: no nx.json / targetDefaults / task cache to seed (ACS-03).
  logger.info(NO_CACHING_NOTICE);        // per D-06 (optional)
  if (!schema?.skipFormat) {
    await formatFiles(tree);
  }
  return;
}
// ...existing Nx branch, byte-unchanged...
```

**Import delta:** add `logger` to the `@nx/devkit` value import (currently
`import { formatFiles, readNxJson, updateNxJson } from '@nx/devkit';` at L1).

**`NO_CACHING_NOTICE` const:** export it from THIS file, co-located with
`TYPECHECK_EXECUTOR_ID` (RESEARCH Open Question 1 recommendation -- fewest files). It is
the single shared source both `initGenerator` (CLI fork) and `ngAddGenerator` import
(D-06 "wording lives in ONE place"). End-user wording is planner discretion -- no
internal ids (project memory: CHANGELOG/README/notice must be consumer-facing).

**Do NOT touch** `TYPECHECK_EXECUTOR_ID` (L15) or `TYPECHECK_TARGET_DEFAULTS` (L27-42) --
the Nx-only seed the CLI branch skips.

---

### `src/generators/ng-add/generator.ts` (generator, batch orchestration) -- NEW composed generator

This is the only file with genuinely new logic. Its structure is the `initGenerator`
default-export signature; its per-project write is DELEGATED (never re-implemented) to
`configurationGenerator`.

**Default-export signature** (mirror `init/generator.ts` L61-64):
```typescript
export default async function ngAddGenerator(
  tree: Tree,
  schema: NgAddGeneratorSchema,
): Promise<void> {
```

**Imports** (compose from `@nx/devkit` -- all present in the pinned `23.0.1`; use the
same helpers the analogs use, plus `getProjects` + `updateJson` + `logger`):
```typescript
import { formatFiles, getProjects, logger, updateJson } from '@nx/devkit';
import type { Tree } from '@nx/devkit';

import configurationGenerator from '../configuration/generator';
import { NO_CACHING_NOTICE } from '../init/generator';   // shared notice (D-06)
import type { NgAddGeneratorSchema } from './schema';
```

**Step 1 -- RF-02 no-`angular.json` guard** (mirror the `tree.exists('angular.json')`
gate from `configuration/generator.ts` L238, inverted -- return early when ABSENT):
absent -> defensive devDep-ensure + guidance only, no wiring, no `nx.json`.

**Step 2 -- defensive devDependency ensure** (RESEARCH Pattern 2 L173-186; uses the
same `updateJson` helper `configurationGenerator` uses at L242). Move any
`dependencies['angular-typechecker']` entry to `devDependencies`; return VOID (no
`GeneratorCallback` -- avoids a redundant `npm install` task):
```typescript
updateJson(tree, 'package.json', (pkg) => {
  const version = pkg.dependencies?.['angular-typechecker'];
  if (version) {
    delete pkg.dependencies['angular-typechecker'];
    pkg.devDependencies ??= {};
    pkg.devDependencies['angular-typechecker'] ??= version;
  }
  return pkg;
});
```

**Step 3 -- compose the shared write-fork per in-scope project** (RESEARCH Pattern 3
L189-199; D-02/D-03). Enumerate via `getProjects(tree)` (Map<name, config>), filter on
`projectType`, delegate the write to `configurationGenerator` with `skipFormat: true`,
format ONCE at the end, print the notice ONCE:
```typescript
for (const [name, project] of getProjects(tree)) {
  if (project.projectType === 'application' || project.projectType === 'library') {
    await configurationGenerator(tree, { project: name, skipFormat: true });
  }
}
if (!schema.skipFormat) {
  await formatFiles(tree);
}
logger.info(NO_CACHING_NOTICE);   // ONCE
```

Idempotency, skip-existing, collision-by-builder-id, and RF-01 leaf-array resolution
are INHERITED from `configurationGenerator`'s CLI branch (L238-275) -- do not
re-implement any of it. `skipFormat: true` on each inner call matches how
`configurationGenerator` already calls `initGenerator(tree, { skipFormat: true })` at
its own L279 (format-once discipline).

**Anti-patterns (RESEARCH L216-220):** never `addDependenciesToPackageJson` for the
devDep move (cannot reclassify deps->devDeps, schedules a redundant install); never
return a `GeneratorCallback`; never register `ng-add` in `generators.json`.

**Optional `--project`** (RESEARCH Open Question 2): if `schema.project` is set, wire
only that one project (still via `configurationGenerator`); default + primary tested
case is auto-wire-ALL.

---

### `src/generators/ng-add/schema.json` + `schema.d.ts` (config) -- NEW

**Analogs:** `init/schema.json` (the `skipFormat` boolean + `cli: "nx"` + `$schema`/
`$id`/`title` header + `additionalProperties: false`) and `configuration/schema.json`
(the `project` string property WITH its `$default: { $source: "argv", index: 0 }`).

Header shape to clone (`init/schema.json` L1-8):
```jsonc
{
  "$schema": "http://json-schema.org/schema",
  "$id": "NgAddGeneratorSchema",
  "title": "angular-typechecker ng-add",
  "cli": "nx",
  "type": "object",
  "properties": { ... },
  "additionalProperties": false
}
```

Properties (RESEARCH Code Examples L306-321): minimal `project?` (string) + `skipFormat?`
(boolean, `default: false`). NOT `required` (default is auto-wire-all). Schematic schemas
natively accept `cli:"nx"`/`$default`/`$id` -- the sanitized-schema concern (Phase 21
Pitfall 7) applies ONLY to the Architect BUILDER schema, not here.

`schema.d.ts` (mirror `init/schema.d.ts` L1-3 / `configuration/schema.d.ts` L1-6):
```typescript
export interface NgAddGeneratorSchema {
  project?: string;
  skipFormat?: boolean;
}
```

---

### `collection.json` (manifest) -- MODIFIED

**Analog:** the single existing `configuration` entry (`collection.json` L4-8).

ADD two entries alongside it: `ng-add` and `init`, each with `factory:
./src/schematics/<name>/schematic` + `schema: ./src/generators/<name>/schema.json`
(exactly the shape of the `configuration` entry; RESEARCH Code Examples L269-291).
`ng-add`'s `schema` points at the NEW `./src/generators/ng-add/schema.json`; `init`'s
reuses the EXISTING `./src/generators/init/schema.json`.

```jsonc
"ng-add": {
  "factory": "./src/schematics/ng-add/schematic",
  "schema": "./src/generators/ng-add/schema.json",
  "description": "..."
},
"init": {
  "factory": "./src/schematics/init/schematic",
  "schema": "./src/generators/init/schema.json",
  "description": "..."
}
```

Additive + Nx-invisible (`generators ?? schematics`). Descriptions are end-user-facing.

---

### `package.json` (manifest) -- MODIFIED

**Analog:** the existing `peerDependencies` block (`package.json` L50-53).

Three additive edits (RESEARCH Standard Stack L82-94; D-07 + RF-01):
1. NEW top-level `"ng-add": { "save": "devDependencies" }` field (RF-01 Approach C --
   the idiomatic Angular-native install-placement lever; precedent
   `@angular-eslint/schematics`).
2. ADD two OPTIONAL peers to the EXISTING `peerDependencies` block:
   `"@angular-devkit/architect": "^0.2200.0"` (the `0.22xx.x` scheme, NOT `22.x`) and
   `"rxjs": "^7.8.0"`.
3. NEW `"peerDependenciesMeta": { "@angular-devkit/architect": { "optional": true },
   "rxjs": { "optional": true } }`.

Current block to extend:
```jsonc
"peerDependencies": {
  "@angular/compiler-cli": "^22.0.0",
  "typescript": ">=6.0.0 <6.1.0"
}
```

Do NOT touch `executors`/`generators`/`builders`/`schematics`/`files`/`dependencies`.
`files` already ships `src` + `collection.json`, so the new schematic dirs need no
`files` edit. Do NOT declare `nx` (flows in transitively via `@nx/devkit`'s peer;
accept + document the `.nx/` consequence).

---

### `eslint.config.mjs` (config) -- MODIFIED

**Analog:** the existing `@nx/dependency-checks` block (`eslint.config.mjs` L66-88),
which already sets `checkVersionMismatches: false` + `ignoredFiles`.

ADD an `ignoredDependencies: ['@angular-devkit/architect', 'rxjs']` array to that SAME
rule-options object (ACP-01 lever; RESEARCH Pitfall 4 L254-258). This short-circuits the
`reportObsoleteDependency` check BEFORE it fires for the two peers, which the plugin's
own `src/` never imports (the `require()`s live inside `@nx/devkit`).

```javascript
'@nx/dependency-checks': [
  'error',
  {
    checkVersionMismatches: false,
    ignoredDependencies: ['@angular-devkit/architect', 'rxjs'],   // NEW (ACP-01)
    ignoredFiles: [ /* unchanged */ ],
  },
],
```

**CRITICAL (project memory + RESEARCH L419):** add `ignoredDependencies` BY HAND. Never
run `eslint --fix` blindly on the manifest -- `checkVersionMismatches: false` guards the
public peer ranges from being rewritten to installed exacts. Verify green with
`npx nx lint angular-typechecker` (a required CI check, `maxWarnings: 0`).

---

### Tests (test) -- NEW + EXTEND

**Analog 1 -- `configuration-angular-cli.spec.ts`** (the angular.json-seeded Tree harness,
whole file 248 lines). Reuse its exact substrate helpers for BOTH new specs:
```typescript
tree = createTreeWithEmptyWorkspace();
tree.delete('nx.json');                     // beforeEach (L57-60)

function writeAngularJson(tree, projects) {  // L23-28
  writeJson(tree, 'angular.json', { version: 1, projects });
}
function writeLeaf(tree, path) {             // L30-32
  writeJson(tree, path, { compilerOptions: {} });
}
function assertCliSubstrate(tree) {          // L34-37 -- assert BOTH branches
  expect(tree.exists('angular.json')).toBe(true);
  expect(tree.exists('nx.json')).toBe(false);
}
// seedNgxLeafletWorkspace (L42-52): app root "" + lib projects/ngx-leaflet, each
// with its build + spec leaf -- mirrors the real bluehalo/ngx-leaflet substrate.
```
Read-back assertion pattern (L62-74): `readProjectConfiguration(tree, name).targets?.typecheck`
`.toEqual({ executor: 'angular-typechecker:typecheck', options: { tsConfig: [...] } })`
(the polyfill normalizes architect->targets / builder->executor on read).

- NEW `src/generators/ng-add/ng-add.spec.ts` -- covers NGADD-01: auto-wire-ALL
  app+library projects (assert each project's `typecheck` target + leaf array),
  idempotent re-run of OUR target, throw on same-named NON-ours target (reuse L171-190),
  skip e2e/other project types (seed a project with missing/other `projectType`, assert
  NO target -- Pitfall 3), RF-02 no-`angular.json` guard (no wiring, no `nx.json`,
  devDep-ensure only), devDep move deps->devDeps, notice printed ONCE (`vi.spyOn` on
  `logger.info`).
- NEW `src/generators/init/init-angular-cli.spec.ts` (or extend `init.spec.ts`) --
  covers ACS-03: on an `angular.json`-seeded tree the fork seeds NO caching + creates NO
  stray `nx.json` (reuse `assertCliSubstrate`). The existing `init.spec.ts` Nx-branch
  cases (L13-68) stay UNCHANGED (the fork only ADDS an angular.json branch).

**Analog 2 -- `nx-generators-surface-regression.spec.ts`** (static package.json +
generators.json read-and-assert, whole file 55 lines). EXTEND it:
- assert `collection.json` now declares `ng-add` + `init` factories (read collection.json
  the same way it reads generators.json at L37-39);
- assert `generators.json` STILL declares `init` (nx add unchanged -- Pitfall 5);
- keep the existing `generators === './generators.json'` / `schematics === './collection.json'`
  assertions (L42-54).

**Analog 3 -- static manifest read (same file's pattern, L18-39)** for a NEW static spec
asserting `package.json` `ng-add.save === 'devDependencies'`, both optional peers present,
and `peerDependenciesMeta.<dep>.optional === true` (ACP-01 + RF-01). Use the
`readFileSync(join(packageRoot, 'package.json'))` + `JSON.parse` idiom from L18-39.

All Phase 23 specs are FAST tier (Tree-based, no real `@angular/compiler-cli`).

## Shared Patterns

### Compose, never re-implement (the write-fork)
**Source:** `src/generators/configuration/generator.ts` L238-275 (the CLI branch:
collision-by-builder-id, idempotent rewrite preserving user keys, `resolveTsConfigLeaves`
RF-01 leaf array).
**Apply to:** `ngAddGenerator` -- call `configurationGenerator(tree, { project, skipFormat: true })`
per in-scope project; inherit all of the above for free. (Also the precedent for how
`configurationGenerator` itself composes `initGenerator(tree, { skipFormat: true })` at L279.)

### Additive `tree.exists('angular.json')` fork + return early
**Source:** `src/generators/configuration/generator.ts` L238-275.
**Apply to:** the `initGenerator` fork (D-04) and the `ngAddGenerator` RF-02 guard. Gate
the branch explicitly + `return` rather than relying on an incidental no-op.

### `convertNxGenerator` thin re-export
**Source:** `src/schematics/configuration/schematic.ts` (whole file).
**Apply to:** `src/schematics/init/schematic.ts` + `src/schematics/ng-add/schematic.ts`.

### Format-once discipline
**Source:** `configuration/generator.ts` L279 (`initGenerator(tree, { skipFormat: true })`)
+ L270-272 / L312-314 (single trailing `formatFiles`).
**Apply to:** `ngAddGenerator` -- `skipFormat: true` on every inner `configurationGenerator`
call, one `formatFiles(tree)` at the end.

### angular.json-seeded Tree test substrate
**Source:** `src/generators/configuration/configuration-angular-cli.spec.ts` L23-60
(`createTreeWithEmptyWorkspace` + `tree.delete('nx.json')` + `writeAngularJson`/`writeLeaf`/
`assertCliSubstrate` helpers).
**Apply to:** `ng-add.spec.ts` + `init-angular-cli.spec.ts`.

### Static manifest read-and-assert regression
**Source:** `src/schematics/configuration/nx-generators-surface-regression.spec.ts` L18-54.
**Apply to:** the extended surface-regression spec + the new static peer-dep spec.

### `@nx/dependency-checks` hand-edited `ignoredDependencies` (no `eslint --fix`)
**Source:** `eslint.config.mjs` L66-88 (existing `checkVersionMismatches: false`).
**Apply to:** ACP-01 -- add `ignoredDependencies: ['@angular-devkit/architect', 'rxjs']`.

## No Analog Found

None. Every new/modified file for this phase has an exact or near-exact in-repo analog
(the `configuration` schematic + generator + tests shipped in Phases 21-22 are a direct
template for the `init`/`ng-add` parity work). The only genuinely new LOGIC is
`ngAddGenerator`'s enumerate-filter-compose loop, and even that is assembled entirely
from shipped pieces (`getProjects` + `configurationGenerator` + `logger.info`).

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/{generators,schematics}/`,
`collection.json`, `generators.json`, `package.json`, `eslint.config.mjs`.
**Files scanned:** 12 tracked (5 generators/schemas, 1 schematic, 4 manifests/config, 3 spec analogs read in full).
**Pattern extraction date:** 2026-07-10
