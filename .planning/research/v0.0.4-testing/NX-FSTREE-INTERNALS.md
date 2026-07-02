# Nx `Tree` / `FsTree` Internals (source mining for bespoke test helpers)

**Milestone:** v0.0.4 (target repo `angular-typechecker`, Nx 23.0.1 / Angular 22 / TS 6)
**Researched:** 2026-06-30
**Source of truth:** `nrwl/nx` clone read **read-only at tag `23.0.1`** via `git show 23.0.1:<path>` /
`git ls-tree -r --name-only 23.0.1`. The clone working tree is on `23.1.0-beta.4`; it was NOT
checked out or modified.
**Confidence:** HIGH (primary source = Nx's own source at the exact tag the target repo installs;
runtime resolution + shipped `.d.ts` cross-checked against the installed `nx@23.0.1` in the target repo).

> SCOPE NOTE: although the filename says FSTREE, this document covers the whole **`Tree` picture** at
> tag 23.0.1 -- the `Tree` interface (the contract), **all three** `Tree` implementations Nx ships
> (real-disk `FsTree`, the schematics->devkit adapter `DevkitTreeFromAngularDevkitTree`, and the
> devkit->schematics host bridge `NxScopedHost*`), the tree utilities, and the recurring tree-testing
> idioms across `@nx/*` packages. The deliverables for the bespoke `createFsTree()` / `flushFsTreeChanges()`
> helpers are at the end.

---

## 0. Bottom line for our helpers (read first)

- The only `Tree` implementation that touches the **real disk** is **`FsTree`** in
  `packages/nx/src/generators/tree.ts`. Our bespoke `createFsTree()` is just
  `new FsTree(tempDir, isVerbose)` rooted at a real temp dir; `flushFsTreeChanges()` is
  `flushChanges(tree.root, tree.listChanges())`. Nx's own `tree.spec.ts` is a copy-paste-grade
  template for the temp-dir setup/teardown.
- `FsTree`, `flushChanges`, `printChanges` are **internal** -- reachable ONLY via the deep import
  `nx/src/generators/tree`. The **public** `@nx/devkit` surface exposes only the `Tree` / `FileChange`
  **types** (plus `createTree` / `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`, which are
  **in-memory**). So our real-disk helper must deep-import and must be quarantined + drift-pinned.
- Confirmed in the installed `nx@23.0.1` in this repo (runtime + shipped `.d.ts`):
  `require('nx/src/generators/tree')` -> `{ FsTree, flushChanges, printChanges }`, resolving to
  `node_modules/nx/dist/src/generators/tree.js` (`.d.ts` beside it).
- `tree.ts`, the testing-utils, `devkit-testing-exports.ts`, `devkit-exports.ts`, and the
  schematics adapter are **byte-identical between `23.0.1` and `23.1.0-beta.4`** (verified
  `git diff 23.0.1 23.1.0-beta.4 --stat` -> empty). No drift in this window; the drift tripwire is
  insurance for the NEXT Nx upgrade, not for a 23.1 beta.

---

## 1. The `Tree` interface -- the contract every implementation satisfies

`packages/nx/src/generators/tree.ts@23.0.1` declares the interface (it is re-exported as a **type**
by `@nx/devkit`; see section 4). Full surface:

```ts
// packages/nx/src/generators/tree.ts @ 23.0.1
export interface TreeWriteOptions {
  mode?: Mode; // node:fs Mode -- e.g. '755' or 0o755
}

export interface Tree {
  root: string;                                              // workspace root; all paths relative to this
  read(filePath: string): Buffer | null;                     // overload 1
  read(filePath: string, encoding: BufferEncoding): string | null; // overload 2
  write(filePath: string, content: Buffer | string, options?: TreeWriteOptions): void;
  exists(filePath: string): boolean;
  delete(filePath: string): void;
  rename(from: string, to: string): void;
  isFile(filePath: string): boolean;
  children(dirPath: string): string[];
  listChanges(): FileChange[];
  changePermissions(filePath: string, mode: Mode): void;
}

export interface FileChange {
  path: string;                            // relative to workspace root
  type: 'CREATE' | 'DELETE' | 'UPDATE';
  content: Buffer | null;                  // null on DELETE
  options?: TreeWriteOptions;
}
```

Note: `overwrite()` and `lock()` are on the **`FsTree` class** but are NOT on the `Tree` interface.
A generator typed against `Tree` cannot call them; only code holding a concrete `FsTree` can.

---

## 2. Every `Tree` implementation in the monorepo (at tag 23.0.1)

`git grep -n "implements Tree" 23.0.1 -- packages/` finds exactly **two** classes; a third family
(`NxScopedHost*`) is the inverse bridge (a schematics `virtualFs.Host`, not a devkit `Tree`). All three
matter for us because v0.0.4 may later expose an Angular schematic.

### 2a. `FsTree` -- real-disk substrate (the one we use)
`packages/nx/src/generators/tree.ts@23.0.1`, `export class FsTree implements Tree`.

- **Backing store:** the REAL filesystem at `root`, PLUS an in-memory overlay
  `recordedChanges: { [path]: { content: Buffer|null; isDeleted: boolean; options? } }`. Reads check
  the overlay first, then fall through to `readFileSync(join(root, path))`. Writes/deletes only mutate
  the overlay -- **nothing hits disk until `flushChanges`**.
- **Constructor:** `constructor(readonly root: string, private readonly isVerbose: boolean, private readonly logOperationId?: string)`.
  - `root` -- absolute dir all paths resolve against (`join(this.root, path)`).
  - `isVerbose` -- when true, `read`/`write` failures `logger.error(e)` instead of swallowing.
  - `logOperationId` -- label printed by `assertUnlocked()` if the tree is mutated after `lock()`.
- **Method set (the drift-tripwire list):** `read` (2 overloads), `write`, `overwrite`, `delete`,
  `exists`, `rename`, `isFile`, `children`, `listChanges`, `changePermissions`, `lock`.
  Privates: `assertUnlocked`, `normalize`, `fsReadDir`, `fsIsFile`, `fsReadFile`, `fsExists`,
  `filesForDir`, `directChildrenOfDir`, `rp`.
- **How changes are recorded (behaviors our assertions can rely on):**
  - `write` is **idempotent vs disk**: if the file exists on disk and the new content `Buffer.equals`
    the on-disk bytes, the recorded change is DELETED (no-op) -- so "write same content" yields an
    empty `listChanges()`. (Verified by `tree.spec.ts` "should not record a change ..." cases.)
  - `write` resurrects ancestors: walks `dirname` chain and clears any `isDeleted` parent so writing
    into a previously-deleted dir un-deletes it.
  - `delete` cascades to every recorded descendant (`filesForDir`) AND prunes now-empty parent dirs
    recursively.
  - `rename` = copy-then-delete for files; recurses children for dirs (so a dir rename shows up as
    N CREATEs + N DELETEs in `listChanges`, never a single rename op -- see spec line ~325).
  - `changePermissions` records an `options.mode` UPDATE; throws on deleted / missing / non-file paths.
  - `lock()` flips `locked`; any subsequent mutating call throws `Tree changed after commit to disk.`
    (Production generators call `host.lock()` right before `flushChanges` -- see 5a.)
  - `listChanges()` classifies each recorded path against disk: `fsExists` -> `UPDATE`, else `CREATE`;
    `isDeleted && fsExists` -> `DELETE` (a delete of a never-on-disk file produces NO change entry).
  - `normalize()` strips the root and forward-slashes the path, so `'a'`, `'/a'`, `'./a'` are
    equivalent keys (spec "should normalize paths").

### 2b. `DevkitTreeFromAngularDevkitTree` -- schematics->devkit adapter (for Angular schematics)
`packages/devkit/src/utils/invoke-nx-generator.ts@23.0.1` (line ~95), `class DevkitTreeFromAngularDevkitTree implements Tree` (not exported).

- **Backing store:** wraps an `@angular-devkit/schematics` `Tree` (`this.tree`); delegates every op to
  it. NOT real-disk and NOT Nx's own overlay -- the schematics tree owns the state.
- **When Nx uses it:** inside `wrapAngularDevkitSchematic` / `invokeNxGenerator` -- i.e. when an
  **Angular DevKit schematic** runs and Nx needs to hand the schematic's tree to Nx-devkit utilities
  as a `Tree`. Directly relevant if `angular-typechecker` later ships an Angular schematic.
- **Notable mappings:** `listChanges()` translates schematics `actions` (`c`/`o`/`d`/`r`) into
  `FileChange`s -- a rename `r` becomes a CREATE(to) + DELETE(from) pair (same shape as `FsTree.rename`).
  `write` -> `tree.create` or `tree.overwrite`. `changePermissions` is a **no-op + `logger.warn`**
  (Angular DevKit tree cannot change file modes). When wrapping a `UnitTestTree` whose root is `/`, it
  **patches the root to `/virtual`** (line ~108) to stop `getProjects()`/fast-glob from walking the
  real filesystem -- the same `/virtual` sentinel the in-memory testing utils use (section 3).

### 2c. `NxScopedHost` family -- devkit `Tree` -> schematics `virtualFs.Host` bridge
`packages/nx/src/adapter/ngcli-adapter.ts@23.0.1`:
- `export class NxScopedHost extends virtualFs.ScopedHost<any>` (line ~500) -- a `@angular-devkit/core`
  `virtualFs` host scoped to `root` over a `NodeJsSyncHost`; special-cases reads of `angular.json` to
  synthesize a merged workspace config from the Nx project graph.
- `export class NxScopedHostForBuilders extends NxScopedHost` (line ~754) -- used when running Angular
  builders (`runExecutor` adapter).
- `export class NxScopeHostUsedForWrappedSchematics extends NxScopedHost` (line ~806) -- **the key
  bridge**: constructed with a devkit `Tree` (`private readonly host: Tree`); overrides
  `read`/`exists`/`isDirectory`/`isFile`/`list` to consult the devkit `Tree`'s recorded changes FIRST
  (via `findMatchingFileChange(host, path)` over `host.listChanges()`), falling back to the scoped disk
  host. This is how Nx makes an Angular schematic write INTO an Nx `FsTree`. The orchestration that
  creates one: `generate()` / `runMigration()` build `new NxScopeHostUsedForWrappedSchematics(root, new FsTree(root, verbose, opId), graph)`
  (lines ~927, ~1023), run the schematic, then flush the FsTree.

> Takeaway for us: there is exactly ONE real-disk tree (`FsTree`). "In-memory tree" is NOT a separate
> class -- it is `FsTree` rooted at the non-existent `/virtual` (section 3). The two adapter families
> are bidirectional schematics<->devkit bridges, only relevant if/when we expose an Angular schematic.

---

## 3. Public in-memory testing utilities (`createTree` / `createTreeWithEmptyWorkspace`)

Both live under `packages/nx/src/generators/testing-utils/` and are re-exported by
`@nx/devkit/testing` (section 4). **Both return an `FsTree` rooted at `'/virtual'`** -- a path that
does not exist, so every disk fall-through read misses and the tree behaves as a pure in-memory overlay.

### `createTree()`  -- `create-tree.ts@23.0.1`
```ts
export function createTree(): Tree {
  const tree = new FsTree('/virtual', false);
  tree.write('.prettierrc', '{}'); // so formatFiles/prettier has a config
  return tree;
}
```
Bare in-memory tree; pre-seeds only `.prettierrc`.

### `createTreeWithEmptyWorkspace(opts?)` -- `create-tree-with-empty-workspace.ts@23.0.1`
```ts
export function createTreeWithEmptyWorkspace(
  opts = {} as { layout?: 'apps-libs' }
): Tree {
  const tree = new FsTree('/virtual', false);
  process.env.INIT_CWD = workspaceRoot; // prevents subdir path prefixing in tests
  return addCommonFiles(tree, opts.layout === 'apps-libs');
}
```
`addCommonFiles` pre-populates a minimal-but-real Nx workspace skeleton:
`.prettierrc` (`{ singleQuote: true }`), `package.json` (`@proj/source`, empty deps), `nx.json`
(`affected.defaultBase: 'main'`, `targetDefaults` build/lint cache), `tsconfig.base.json`
(`compilerOptions.paths: {}`), and -- only with `layout: 'apps-libs'` -- `apps/.gitignore` +
`libs/.gitignore`. The `{ layout?: 'apps-libs' }` option is the only public knob.
`createTreeWithEmptyV1Workspace` is a deprecated stub that throws.

> The `process.env.INIT_CWD = workspaceRoot` side effect is why these helpers are not perfectly pure.
> The companion `setCwd(path)` (`@nx/devkit/internal-testing-utils`,
> `artifact-name-and-directory-utils.ts@23.0.1` line ~176) sets `INIT_CWD = join(workspaceRoot, path)`
> and is used by generator specs that exercise CWD-relative path derivation.

---

## 4. Public re-export surface vs the internal deep import (the stable/unstable line)

| Symbol | Public via `@nx/devkit` / `@nx/devkit/testing`? | Path |
|---|---|---|
| `Tree` (type) | YES (type only) | `nx/src/devkit-exports.ts@23.0.1`: `export type { FileChange, Tree } from './generators/tree'` |
| `FileChange` (type) | YES (type only) | same line |
| `TreeWriteOptions` (type) | NO public re-export found | internal `nx/src/generators/tree` |
| `FsTree` (class) | **NO** | internal `nx/src/generators/tree` ONLY |
| `flushChanges` (fn) | **NO** | internal `nx/src/generators/tree` ONLY |
| `printChanges` (fn) | **NO** | internal `nx/src/generators/tree` ONLY |
| `createTree` | YES | `@nx/devkit/testing` -> `nx/src/devkit-testing-exports.ts@23.0.1` |
| `createTreeWithEmptyWorkspace` | YES | `@nx/devkit/testing` -> same |
| `generateFiles` / `formatFiles` / `visitNotIgnoredFiles` | YES | `packages/devkit/public-api.ts@23.0.1` |

How the barrels chain:
- `packages/devkit/index.ts@23.0.1` = `export * from 'nx/src/devkit-exports'; export * from './public-api';`
- `packages/devkit/testing.ts@23.0.1` = `export * from 'nx/src/devkit-testing-exports';`
- `nx/src/devkit-testing-exports.ts@23.0.1` re-exports `createTree`, `createTreeWithEmptyWorkspace`,
  `createTreeWithEmptyV1Workspace`.

`git grep -n -e flushChanges -e FsTree -e printChanges 23.0.1 -- packages/devkit/*.ts
packages/nx/src/devkit-exports.ts ...` returns **nothing** -> confirms these three are NOT in any
public barrel. The runtime cross-check in the installed `nx@23.0.1` confirms they are nonetheless
present on the deep-import module object.

---

## 5. Tree utilities (signatures + purpose), at tag 23.0.1

### 5a. `flushChanges(root, fileChanges)` -- the disk writer
`packages/nx/src/generators/tree.ts@23.0.1`:
```ts
export function flushChanges(root: string, fileChanges: FileChange[]): void {
  fileChanges.forEach((f) => {
    const fpath = join(root, f.path);
    if (f.type === 'CREATE') { mkdirSync(dirname(fpath), { recursive: true }); writeFileSync(fpath, f.content); if (f.options?.mode) chmodSync(fpath, f.options.mode); }
    else if (f.type === 'UPDATE') { writeFileSync(fpath, f.content); if (f.options?.mode) chmodSync(fpath, f.options.mode); }
    else if (f.type === 'DELETE') { rmSync(fpath, { recursive: true, force: true }); }
  });
}
```
Pure, stateless, synchronous. `CREATE` makes parent dirs recursively; `DELETE` is recursive+force.
It takes a `root` argument separately from the tree -- production code always passes `tree.root`
(or `workspaceRoot`).

### 5b. `printChanges(fileChanges, indent='')` -- colored CREATE/UPDATE/DELETE log (picocolors). Same file.

### 5c. The generator-to-disk lifecycle (canonical production usage)
`packages/nx/src/command-line/generate/generate.ts@23.0.1` (lines ~401-425) -- the exact pattern a
real-disk helper mirrors:
```ts
const host = new FsTree(workspaceRoot, args.verbose, `generating (${collection}:${name})`);
const task = await implementation(host, combinedOpts);
host.lock();
const changes = host.listChanges();
if (!opts.quiet) printChanges(changes);
if (!opts.dryRun) { flushChanges(workspaceRoot, changes); if (task) await task(); }
```
36 `new FsTree(...)` call sites exist across `packages/` (CLI generate/migrate/new/release, daemon
sync-generators, init, AI utils, ts-solution-setup, the ngcli adapter, etc.) -- all follow
`new FsTree(realRoot, verbose[, opId])` then `flushChanges(root, tree.listChanges())`. 13 `flushChanges`
call sites, all `flushChanges(<root>, <tree>.listChanges())`.

### 5d. `visitNotIgnoredFiles(tree, dirPath=tree.root, visitor)` -- `packages/devkit/src/generators/visit-not-ignored-files.ts@23.0.1`. Recursively walks `tree.children`, skipping git-ignored paths (`getIgnoreObjectForTree`), calling `visitor(path)` per file. Public.

### 5e. `generateFiles(tree, srcFolder, target, substitutions, options?)` -- `packages/devkit/src/generators/generate-files.ts@23.0.1`. Renders an EJS-style file template tree from an absolute `srcFolder` into `target` (relative to `tree.root`) via `tree.write(computedPath, newContent)`. Public.

### 5f. `formatFiles(tree, options?)` -- `packages/devkit/src/generators/format-files.ts@23.0.1`. Reads `tree.listChanges()` (non-DELETE), runs Prettier on each, and `tree.write`s the formatted content back. Honors a `.prettierrc` recorded in the tree -- which is exactly why `createTree`/`createTreeWithEmptyWorkspace` seed `.prettierrc`. Public, async.

### 5g. `glob(tree, patterns)` / `globAsync(tree, patterns)` -- `packages/nx/src/generators/utils/glob.ts@23.0.1`. Glob over the tree (combines on-disk + recorded). 

### 5h. JSON + project-config tree utils -- `packages/nx/src/generators/utils/json.ts@23.0.1` (`readJson`, `writeJson`, `updateJson`) and `project-configuration.ts@23.0.1` (`addProjectConfiguration`, `updateProjectConfiguration`, `readProjectConfiguration`, `removeProjectConfiguration`, `getProjects`). These are how specs seed config into a tree and assert against it (section 6). All public via `@nx/devkit`.

---

## 6. Tree-testing techniques across `@nx/*` packages (recurring idioms)

### 6a. Nx's own `FsTree` spec -- the REAL-DISK template (our primary model)
`packages/nx/src/generators/tree.spec.ts@23.0.1`. Idiom:
```ts
import { dirSync } from 'tmp';
let dir: string; let tree: FsTree;
beforeEach(() => {
  dir = dirSync().name;                          // real temp dir
  mkdirSync(path.join(dir, 'parent/child'), { recursive: true });
  writeFileSync(path.join(dir, 'root-file.txt'), 'root content'); // seed on disk
  tree = new FsTree(dir, true);                  // isVerbose=true in the spec
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); }); // teardown
// ... mutate via tree.write/delete/rename ...
flushChanges(dir, tree.listChanges());            // commit
expect(readFileSync(path.join(dir, '...'), 'utf-8')).toEqual('...'); // assert ON DISK
```
Key assertion helper `s(changes)` stringifies `FileChange.content` (Buffer) before `toEqual`.
Permission assertions use `lstatSync(...).mode & octal(mode)`.

### 6b. The dominant idiom -- IN-MEMORY via `createTreeWithEmptyWorkspace` (452 spec files import it)
Representative (`packages/js/src/generators/library/library.spec.ts@23.0.1`,
`packages/plugin/src/generators/executor/executor.spec.ts@23.0.1`):
```ts
import 'nx/src/internal-testing-utils/mock-project-graph'; // mock graph FIRST (side-effect import)
import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
let tree: Tree;
beforeEach(() => { tree = createTreeWithEmptyWorkspace(); tree.write('/.gitignore', ''); });
it('...', async () => {
  await someGenerator(tree, opts);                 // run generator against in-memory tree
  expect(tree.exists('my-lib/tsconfig.lib.json')).toBeTruthy();   // assert
  const json = readJson(tree, 'my-lib/tsconfig.lib.json');        // assert config
});
```
Recurring sub-idioms:
- `import 'nx/src/internal-testing-utils/mock-project-graph';` as the FIRST import (side-effecting
  mock so generators that read the project graph don't hit the real workspace).
- `setCwd('')` (`@nx/devkit/internal-testing-utils`) when the generator derives paths from CWD.
- Seed config with `addProjectConfiguration(tree, name, {...})` (see `packages/nest/.../testing.ts`:
  `createTreeWithNestApplication` wraps exactly this).
- NO flush, NO teardown -- the in-memory tree is GC'd; assertions read the tree directly
  (`tree.exists`, `tree.read`, `readJson(tree, ...)`, `readProjectConfiguration(tree, ...)`).
- Plugin-specific test-tree builders live in `packages/<pkg>/src/generators/utils/testing.ts`
  (only `nest` and `angular` ship one at 23.0.1). `angular`'s builds a full lib via real generators
  (`libraryGenerator`, `componentGenerator`) then `tree.write`s extra fixtures.

> NONE of Nx's `@nx/*` generator specs flush to real disk -- only the low-level `tree.spec.ts` does.
> That is the divide: unit specs use the in-memory `/virtual` tree; the real-disk path is reserved for
> the CLI itself and for testing `FsTree`/`flushChanges` themselves. Our bespoke `createFsTree()` puts
> us in the SECOND camp deliberately (see tradeoffs, section 9).

---

## 7. Deliverable: `createFsTree()` + `flushFsTreeChanges()` real-disk sketches

Uses ONLY the confirmed `nx@23.0.1` deep-import surface (`FsTree`, `flushChanges`). Mirrors Nx's
`tree.spec.ts` setup/teardown and the production `generate.ts` lifecycle.

```ts
// test-helpers/fs-tree.ts  (Vitest; CJS-friendly deep import)
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// INTERNAL Nx deep import -- quarantined (see section 8). Types come from @nx/devkit.
import { FsTree, flushChanges } from 'nx/src/generators/tree';
import type { Tree } from '@nx/devkit';

export interface CreateFsTreeResult {
  tree: Tree;          // hand this to the generator (typed as the public Tree)
  root: string;        // the real temp dir
  cleanup(): void;     // rmSync the temp dir
}

/**
 * Real-disk Tree rooted at a fresh temp dir. Seed files are written to disk so the
 * generator's reads (e.g. tsconfig.base.json) resolve from disk, exactly like a real workspace.
 */
export function createFsTree(
  seed: Record<string, string> = {},
  options: { isVerbose?: boolean } = {}
): CreateFsTreeResult {
  const root = mkdtempSync(join(tmpdir(), 'angular-typechecker-fstree-'));
  for (const [rel, content] of Object.entries(seed)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  // Constructor: new FsTree(root, isVerbose, logOperationId?) -- pinned signature.
  const tree = new FsTree(root, options.isVerbose ?? false) as unknown as Tree;
  return {
    tree,
    root,
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

/**
 * Commit the tree's recorded changes to real disk. Mirrors production:
 *   host.lock(); flushChanges(host.root, host.listChanges());
 * Lock first so any post-flush mutation throws loudly (matches Nx generate.ts).
 */
export function flushFsTreeChanges(tree: Tree): void {
  // tree is really an FsTree; lock() exists on the class, not the interface.
  (tree as unknown as FsTree).lock();
  flushChanges(tree.root, tree.listChanges());
}
```

Usage in a generator spec:
```ts
const { tree, root, cleanup } = createFsTree({
  'nx.json': JSON.stringify({ ... }),
  'tsconfig.base.json': JSON.stringify({ compilerOptions: { paths: {} } }),
  'my-app/project.json': JSON.stringify({ ... }),
});
try {
  await typecheckConfigurationGenerator(tree, { project: 'my-app' });
  flushFsTreeChanges(tree);
  // assert on REAL disk:
  expect(readFileSync(join(root, 'my-app/tsconfig.typecheck.json'), 'utf-8')).toContain('...');
} finally {
  cleanup();
}
```

Notes:
- `mkdtempSync` (Node built-in) avoids a `tmp` dependency; Nx's spec uses `tmp`'s `dirSync()` but the
  semantics are identical (a unique real dir). Either is fine; built-in keeps deps minimal.
- If a generator calls `formatFiles`, seed a `.prettierrc` (Prettier config) -- same reason
  `createTree*` seed it.
- Do NOT pass `isVerbose: true` in CI unless you want `logger.error` noise on intentional read misses;
  Nx's spec sets it true ONLY because it mutes `console.error` first.
- `flushFsTreeChanges` calls `lock()` to match production and to catch a generator that mutates after
  returning. If a test needs to flush, inspect disk, then mutate+flush again, drop the `lock()` (the
  helper would otherwise throw on the second flush).

---

## 8. Quarantine + drift-tripwire (the deep import is internal/unstable)

`nx/src/generators/tree` is NOT a public entry point. It works today (verified runtime + shipped
`.d.ts` at `nx@23.0.1`), but an Nx upgrade can move/rename/restructure it with no semver guarantee.
Two defenses:

### 8a. ESLint quarantine
- Confine the deep import to ONE module (e.g. `test-helpers/fs-tree.ts`). Forbid
  `nx/src/**` imports everywhere else via `no-restricted-imports` (Nx's own codebase guards these with
  `@typescript-eslint/no-restricted-imports` -- see the eslint-disable in `devkit/testing.ts`).
- Because the helper is test-only, also keep it OUT of the published `tsconfig.lib.json` include and
  out of the `files` whitelist (it must never ship in the plugin tarball).

### 8b. Build-time drift assertion (fail loudly on Nx upgrade)
Pin the exact contract this research verified against `nx@23.0.1`'s shipped
`node_modules/nx/dist/src/generators/tree.d.ts`. A small `*.spec.ts` (runs in `nx test`) is the
cheapest tripwire:

```ts
import { FsTree, flushChanges, printChanges } from 'nx/src/generators/tree';

it('nx FsTree deep-import contract is unchanged (pin to 23.0.1)', () => {
  // 1) the three internal symbols still resolve
  expect(typeof FsTree).toBe('function');
  expect(typeof flushChanges).toBe('function');
  expect(typeof printChanges).toBe('function');

  // 2) constructor arity: (root, isVerbose, logOperationId?) === 2 required params (Node counts non-defaulted)
  expect(FsTree.length).toBe(2);

  // 3) flushChanges arity: (root, fileChanges) === 2
  expect(flushChanges.length).toBe(2);

  // 4) the FsTree method set we depend on still exists
  const methods = ['read','write','overwrite','delete','exists','rename','isFile','children','listChanges','changePermissions','lock'];
  for (const m of methods) {
    expect(typeof (FsTree.prototype as any)[m]).toBe('function');
  }

  // 5) round-trip behavior pin: write -> listChanges -> flush -> disk (smoke)
  // (use a temp dir; assert listChanges() shape { path, type:'CREATE', content } as Nx documents)
});
```

What to pin (and why): **the `FsTree` constructor signature** (`(root, isVerbose, logOperationId?)`),
**the `flushChanges(root, fileChanges)` signature**, and **the `FsTree` method set** listed above. If a
future Nx renames `flushChanges`, drops `lock()`, or changes the constructor, this spec goes red on
`nx test` immediately -- a loud, located failure instead of a silent runtime break. (Optionally add a
type-level pin: `const _c: (root: string, isVerbose: boolean, op?: string) => FsTree = (r,v,o)=>new FsTree(r,v,o);`
so a `.d.ts` shape change fails `tsc`/`nx build` too.) Confirmed stable across `23.0.1 ->
23.1.0-beta.4` (zero diff), so the tripwire is for the NEXT minor/major, not 23.1.

---

## 9. Real-disk (`FsTree` at temp dir) vs in-memory (`createTreeWithEmptyWorkspace`) tradeoffs

| Dimension | Real-disk `createFsTree()` (our helper) | In-memory `createTreeWithEmptyWorkspace()` |
|---|---|---|
| Public/stable API | NO -- deep import `nx/src/generators/tree` (quarantine + tripwire) | YES -- `@nx/devkit/testing` |
| Backing store | real temp dir + recorded overlay; reads fall through to disk | `FsTree('/virtual')` -- overlay only; disk reads always miss |
| Setup cost | `mkdtemp` + seed writes + teardown `rmSync` (slower, real I/O) | in-process, no I/O, no teardown (faster) |
| Fidelity to production | HIGH -- exercises real `flushChanges` -> real files; can run the actual Angular compiler / `ngc`-style read against flushed files | LOWER -- nothing on disk unless flushed; tools that `statSync`/read the real FS see nothing |
| What it proves | the generator's output as it would land on a developer's disk | the generator's recorded CHANGES (config correctness) without disk |
| Assertion style | `flush` then `readFileSync`/run a real type-check over the temp workspace | `tree.exists` / `readJson(tree, ...)` directly, no flush |
| Cleanup hazard | must `rmSync` the temp dir (use `try/finally`) | none |
| Concurrency | each test owns a unique `mkdtemp` dir -> safe in parallel | fully isolated per `createTree*` call |

**Recommendation for `typecheck-configuration` generator tests:**
- Use the **in-memory** `createTreeWithEmptyWorkspace()` for the bulk of unit specs that assert the
  generator records the right files/config (fast, public API, matches all 452 Nx generator specs).
- Use the **bespoke real-disk `createFsTree()`** specifically for the tests whose VALUE is that the
  emitted tsconfig is actually consumable on disk -- e.g. flush the generated `tsconfig.typecheck.json`
  to a temp workspace and then run the real Angular type-check against it. For a type-checking tool,
  proving "the generated config produces a real, runnable, correct type-check on disk" is exactly the
  end-to-end fidelity in-memory cannot give -- which justifies the quarantined deep import for that
  tier only.
- Keep both helpers test-only and excluded from the published tarball.

---

## Sources (all `nrwl/nx` @ tag `23.0.1`, read-only via `git show`)

- `packages/nx/src/generators/tree.ts` -- HIGH -- `Tree`/`FileChange`/`TreeWriteOptions` interfaces, `FsTree` class (full impl), `flushChanges`, `printChanges`.
- `packages/nx/src/generators/tree.spec.ts` -- HIGH -- real-disk temp-dir setup/teardown + flush + assert idiom.
- `packages/nx/src/generators/testing-utils/create-tree.ts`, `create-tree-with-empty-workspace.ts` -- HIGH -- in-memory `FsTree('/virtual')`, scaffolding, `{ layout?: 'apps-libs' }` option.
- `packages/nx/src/devkit-exports.ts` (`export type { FileChange, Tree }`), `packages/nx/src/devkit-testing-exports.ts` (`createTree`, `createTreeWithEmptyWorkspace`) -- HIGH -- public type/testing surface.
- `packages/devkit/index.ts`, `packages/devkit/testing.ts`, `packages/devkit/public-api.ts`, `packages/devkit/internal-testing-utils.ts` -- HIGH -- barrel chaining; confirms `FsTree`/`flushChanges`/`printChanges` are NOT public.
- `packages/devkit/src/utils/invoke-nx-generator.ts` -- HIGH -- `DevkitTreeFromAngularDevkitTree implements Tree` (schematics->devkit adapter, `/virtual` UnitTestTree patch).
- `packages/nx/src/adapter/ngcli-adapter.ts` -- HIGH -- `NxScopedHost` / `NxScopedHostForBuilders` / `NxScopeHostUsedForWrappedSchematics` (devkit Tree -> schematics host bridge); `new FsTree(root, verbose, opId)` schematic-wrapping flow; `findMatchingFileChange`.
- `packages/nx/src/command-line/generate/generate.ts` -- HIGH -- canonical `new FsTree -> impl(host) -> lock -> listChanges -> printChanges -> flushChanges` lifecycle.
- `packages/devkit/src/generators/visit-not-ignored-files.ts`, `generate-files.ts`, `format-files.ts` -- HIGH -- `visitNotIgnoredFiles` / `generateFiles` / `formatFiles` signatures + Tree interaction.
- `packages/nx/src/generators/utils/glob.ts`, `json.ts`, `project-configuration.ts` -- HIGH -- `glob`/`globAsync`; `readJson`/`writeJson`/`updateJson`; `addProjectConfiguration`/`getProjects`/etc.
- `packages/devkit/src/generators/artifact-name-and-directory-utils.ts` -- HIGH -- `setCwd` (`INIT_CWD`).
- `packages/js/src/generators/library/library.spec.ts`, `packages/plugin/src/generators/executor/executor.spec.ts`, `packages/nest/src/generators/utils/testing.ts`, `packages/angular/src/generators/utils/testing.ts` -- HIGH -- in-memory generator-spec idioms + plugin test-tree builders.
- `git grep -n "new FsTree(" / "flushChanges(" / "implements Tree" 23.0.1 -- packages/` -- HIGH -- 36 FsTree instantiations, 13 flushChanges call sites, exactly 2 `implements Tree` classes.
- `git diff 23.0.1 23.1.0-beta.4 -- <tree paths>` -- HIGH -- zero drift across `tree.ts`, testing-utils, devkit-testing/exports, invoke-nx-generator in this window.
- Installed `nx@23.0.1` in target repo: `require('nx/src/generators/tree')` -> `{ FsTree, flushChanges, printChanges }` resolving to `node_modules/nx/dist/src/generators/tree.js`; shipped `tree.d.ts` matches source. -- HIGH -- runtime + shipped-types cross-check.
```