# Phase 27: Bin shell + cross-platform packaging - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 8 (2 create, 5 modify, 1 create-doc)
**Analogs found:** 7 / 8 (`.gitattributes` is net-new -- no repo analog)

Every analog in this phase lives INSIDE this package -- there is no external
pattern to import. This phase is glue and guards over shipped machinery (the
Phase-26 `run()` core). The trap is re-implementing an existing seam; each file
below has one concrete file to mirror.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/angular-typechecker/src/cli/bin.ts` | cli-entry / thin adapter | request-response (process boundary, stream I/O) | `src/cli/main.ts` (contract, imports) + `src/executors/typecheck/executor.ts` (compose-then-return + catch/re-throw) | exact (contract pre-specified in `main.ts` docstring) |
| `packages/angular-typechecker/src/cli/bin-static.spec.ts` | test (static, `test` tier) | file-I/O (reads built `dist/.../bin.js`) | `src/executors/typecheck/gate-a-static.spec.ts` | exact (same role + data flow; differs only by 2-dirs-up vs 3) |
| `packages/angular-typechecker/package.json` | config (manifest) | n/a | existing `executors`/`generators`/`builders` fields (same file, lines 29-32) | exact |
| `packages/angular-typechecker/tsconfig.lib.json` | config (build tsconfig) | n/a | its own `compilerOptions` block (lines 3-7) | exact |
| repo-root `.gitattributes` | config (VCS) | n/a | NONE (net-new) | no analog |
| `packages/angular-typechecker/eslint.config.mjs` | config (lint) | n/a | the `**/src/core/**/*.ts` block in the SAME file (lines 16-64) | exact (mirror minus `no-console`/`process.exit`) |
| `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` | test (e2e tarball) | file-I/O + process (pack + extract + read) | its own existing describe/it blocks (same file, lines 161-225) | exact |
| `.planning/phases/27-.../27-ADDITIVE-AUDIT.md` | doc | n/a | `.planning/milestones/v0.2.1-phases/24-.../24-ADDITIVE-AUDIT.md` | exact |

## Pattern Assignments

### `src/cli/bin.ts` (cli-entry / thin adapter, request-response)

**Analogs:** `src/cli/main.ts` (the `run()` it wraps; docstring specifies the shell verbatim) + `src/executors/typecheck/executor.ts` (the sibling adapter's compose-then-return + `catch`/re-throw shape).

**The contract is already spelled out** in `src/cli/main.ts` lines 37-39:

```
* PURITY (EXIT-02): run() NEVER calls process.exit and NEVER writes a stream.
* It returns { exitCode, stdout, stderr }; bin.ts (Phase 27) is the ONLY tier
* that writes those strings and exits the process.
```

And the re-throw contract in `src/cli/main.ts` lines 182-184:

```typescript
// Any OTHER error is RE-THROWN: bin.ts (Phase 27) maps an unknown failure to 2.
// run() never swallows an unknown failure and reports a clean/typed verdict.
throw error;
```

**RunResult shape to destructure** (`src/cli/main.ts` lines 41-45):

```typescript
export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}
```

**Imports pattern** -- mirror `main.ts`'s nx-free relative-import style (`main.ts` lines 1-14 import only `node:*` + `../core/*` + `./*` CLI seams). `bin.ts` imports exactly ONE module:

```typescript
#!/usr/bin/env node
import { run } from './main';
```

**Core pattern (the flush-safe shell, D-01/D-02/D-03)** -- from RESEARCH.md lines 238-266 (this SUPERSEDES the older ARCHITECTURE.md draft that used `process.exit`; use `process.exitCode`):

```typescript
run(process.argv.slice(2))
  .then(({ exitCode, stdout, stderr }) => {
    if (stdout) {
      process.stdout.write(stdout);
    }

    if (stderr) {
      process.stderr.write(stderr);
    }

    // D-02: set the code and RETURN. The event loop drains the writes above, then
    // the process exits with this code. NEVER process.exit(code) here -- it would
    // truncate a piped stdout tail (Pitfall 6).
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    // D-03: run() re-throws any non-TypecheckInfrastructureError; an unknown crash
    // is infrastructure-class for a type-checker -> exit 2, never 0/1.
    process.stderr.write(
      String((error as { stack?: string })?.stack ?? error) + '\n',
    );
    process.exitCode = 2;
  });
```

**Error-handling shape to mirror** -- the sibling adapter `src/executors/typecheck/executor.ts` lines 71-81 shows the same `TypecheckInfrastructureError`-caught / everything-else-re-thrown split at the adapter boundary. `bin.ts` is the terminal `.catch` that the executor's `throw error` (and `main.ts`'s) lands in.

**Load-bearing rules (do NOT deviate):**
- Top-level `await` is ILLEGAL here (`package.json` `type: commonjs` + `module: nodenext`). Use `.then/.catch` (above) or an async IIFE. RESEARCH.md lines 233-236.
- NEVER `process.exit(code)` -- it truncates a piped stdout tail that CI + the e2e `execSync` capture need. Use `process.exitCode = code` + natural drain. D-02, RESEARCH.md lines 225-231.
- Add NO logic beyond wiring (D-01). `bin.ts` is ~15 lines.
- Blank lines around control flow / returns (CLAUDE.md JS/TS rule) -- already applied above.

---

### `src/cli/bin-static.spec.ts` (test, file-I/O static read, `test` tier)

**Analog:** `src/executors/typecheck/gate-a-static.spec.ts` -- copy its dist-read scaffolding VERBATIM.

**Imports + workspace-root pattern** (`gate-a-static.spec.ts` lines 1-6):

```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';
```

**packageRoot / distRoot derivation (THE one difference: 2 dirs up, not 3).** `gate-a-static.spec.ts` lines 24-51 walks UP 3 (`'..','..','..'`) because it sits at `src/executors/typecheck/`. `bin-static.spec.ts` sits at `src/cli/` so it walks UP **2**:

```typescript
// gate-a-static.spec.ts lines 24-51 (adapt: '..', '..' only)
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); // src/cli -> src -> packageRoot
const workspaceRoot = findWorkspaceRoot(packageRoot);
const projectJson = JSON.parse(
  readFileSync(join(packageRoot, 'project.json'), 'utf8'),
) as ProjectJson;
const outputPath = projectJson.targets.build.options.outputPath;
const distRoot = join(workspaceRoot, outputPath);
const binJsPath = join(distRoot, 'src', 'cli', 'bin.js');
```

Reuse the `BuildTarget` / `ProjectJson` interfaces verbatim (`gate-a-static.spec.ts` lines 32-42). Derive `distRoot` from `project.json` `build.options.outputPath` -- do NOT hard-code `dist/...`.

**stripCommentLines helper (copy verbatim)** (`gate-a-static.spec.ts` lines 81-86):

```typescript
function stripCommentLines(code: string): string {
  return code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}
```

**Assertion family (a) -- shebang first-line byte-check** (RESEARCH.md lines 372-378). Assert `content.split('\n')[0] === '#!/usr/bin/env node'` (a trailing `\r` makes it `'#!/usr/bin/env node\r'` and fails equality) plus an explicit `expect(firstLine).not.toContain('\r')`.

**Assertion family (b) -- static transitive nx-free require walk** (RESEARCH.md lines 380-410). Built CJS require shape confirmed (double-quoted, extensionless, relative):

```javascript
// dist/.../src/cli/main.js (actual built output, confirmed 2026-07-16)
const run_typecheck_1 = require("../core/run-typecheck");   // relative -> follow
const console_logger_1 = require("./console-logger");        // relative -> follow
const tslib_1 = require("tslib");                            // bare -> check, do not follow
const node_fs_1 = require("node:fs");                        // builtin -> check, do not follow
```

Walk design (Claude's discretion on exact regex):
1. Start at built `bin.js`; keep a `visited` set of absolute paths.
2. Per file: `stripCommentLines`, then extract every specifier via `/require\(\s*["']([^"']+)["']\s*\)/g`.
3. Assert no specifier matches `/^(@nx\/|nx\/|nx$)/` (matches `@nx/devkit`, `nx`, `nx/...`; NOT `node:*`, `tslib`, `typescript`, `@angular/*`). Fail with the offending file + specifier.
4. Follow only relative specifiers (`.`-prefixed): resolve `join(dirname(file), spec + '.js')`, recurse if unvisited. Bare/builtin specifiers are checked, not followed. `@angular/compiler-cli` never appears (reached via `await import()`), so no special-casing.

**Assertion shape to mirror** (`gate-a-static.spec.ts` lines 88-99): `readFileSync(path, 'utf8')` -> `stripCommentLines` -> `expect(code).toMatch/.not.toMatch`.

**Wiring:** rides the `test` tier automatically -- Vitest glob `{src,tests}/**/*.{test,spec}...` picks it up and `test` has `dependsOn: ["build"]` (`project.json` lines 101-103), so dist is built before the read. NO `project.json` change. This is dist/static/test-tier ONLY; the runtime `require.cache` probe on the INSTALLED bin is Phase 28.

---

### `package.json` -- add the `bin` field (config, D-04/D-05)

**Analog:** the existing single-target manifest fields at lines 29-32 (`executors`/`generators`/`builders`/`schematics` all `./...` compiled-JSON paths). Add `bin` in the same style, pointing at compiled `.js` (consistent with `main: ./src/index.js` at line 27 -- NEVER `.ts`):

```jsonc
"bin": {
  "angular-typechecker": "./src/cli/bin.js",
  "atc": "./src/cli/bin.js"
}
```

**Do NOT touch:**
- `version` STAYS `0.2.1` (line 3) -- the bump is the human-gated Release-PR flow, not a phase edit.
- `files` (lines 40-48) needs NO change -- `bin.js` emits under `src/`, already whitelisted at line 41.
- `@nx/js:tsc` copies the manifest verbatim into `dist/`; `nx-release-publish` packs from `packageRoot: dist/packages/angular-typechecker` (`project.json` lines 58-62). The tarball audit (D-11) is the standing proof `bin` survived.

---

### `tsconfig.lib.json` -- add `newLine: "lf"` (config, D-06)

**Analog:** its own `compilerOptions` block (lines 3-7). Add one key:

```jsonc
"compilerOptions": {
  "outDir": "../../dist/out-tsc",
  "declaration": true,
  "types": ["node"],
  "newLine": "lf"
}
```

This is the build/ship tsconfig (excludes `*.spec.ts`/`*.drift.ts` at lines 9-23, includes `src/**/*.ts` at line 8 -- so `bin.ts` is emitted, `bin-static.spec.ts` is not). Deterministic LF emit across hosts (this repo builds on Windows arm64 where an unset `newLine` can emit CRLF and break the shebang on Linux/macOS CI). Dist-only (gitignored) -- does NOT affect the ADD-01 public-surface audit. `newLine` is currently absent from every tsconfig in the repo (fresh key).

---

### `.gitattributes` (repo root) -- NEW, no analog (config, D-07)

No `.gitattributes` exists in the repo. Net-new, deliberately NARROW (NOT a repo-wide `* text=auto eol=lf` renormalization -- that churns the committed `ng-cli-workspace` fixture + lockfiles). From RESEARCH.md lines 315-320:

```gitattributes
# .gitattributes (repo root) -- D-07 narrow LF guard on TypeScript source.
# newLine:lf in tsconfig.lib.json is the primary emit guard; this is belt-and-suspenders
# on the SOURCE. Deliberately NOT a repo-wide `* text=auto` (would churn committed fixtures).
*.ts text eol=lf
```

Claude's-discretion latitude (D-07): a bin-only path rule is acceptable if the planner prefers even narrower. REVERSIBLE.

---

### `eslint.config.mjs` -- add the `src/cli/**` import-ban block (config, D-09)

**Analog:** the `**/src/core/**/*.ts` block in the SAME file (lines 16-64). MIRROR its `no-restricted-imports` `paths`/`patterns`, but OMIT the core block's `no-console` (line 54) and `no-restricted-properties: process.exit` (lines 55-63) -- `bin.ts` legitimately writes streams + sets the exit code.

**Core block to mirror** (`eslint.config.mjs` lines 16-53, the import-ban half):

```javascript
files: ['**/src/core/**/*.ts'],
rules: {
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      paths: [
        { name: 'nx', message: '...' },
        { name: '@nx/devkit', message: '...' },
        { name: '@angular-devkit/architect', message: '...' },
        { name: 'yargs', message: '...' },
      ],
      patterns: [
        { group: ['@nx/*'], message: '...' },
        { group: ['@angular-devkit/*'], message: '...' },
      ],
    },
  ],
  // core block ALSO has 'no-console' + 'no-restricted-properties' process.exit -- OMIT these for cli/**
},
```

**New `cli/**` block** (RESEARCH.md lines 434-460) -- add as a new config object AFTER the core block, BEFORE the `**/*.json` block (which starts at line 66):

```javascript
{
  files: ['**/src/cli/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'nx', message: 'cli/ must be nx-free (D-09).' },
          { name: '@nx/devkit', message: 'cli/ must not import @nx/devkit (D-09).' },
          { name: '@angular-devkit/architect', message: 'cli/ must not import the Angular CLI architect (D-09).' },
        ],
        patterns: [
          { group: ['@nx/*'], message: 'cli/ must not import any @nx/* package (D-09).' },
          { group: ['@angular-devkit/*'], message: 'cli/ must not import any @angular-devkit/* package (D-09).' },
          // Optional (Claude's discretion): also ban the adapter modules + the barrel.
          { group: ['**/executors/**', '**/builders/**', '**/generators/**', '**/schematics/**'],
            message: 'cli/ is a thin adapter over core/**, not over another adapter (D-09).' },
          { group: ['../index', '../index.js'], message: 'cli/ imports core modules directly, not the public barrel (D-09).' },
        ],
      },
    ],
    // NO no-console, NO no-restricted-properties process.exit -- bin.ts writes streams + sets exit.
  },
},
```

**Will not break existing code** (RESEARCH.md lines 463-470, verified): the shipped `src/cli/*.ts` (`main.ts`, `parse-args.ts`, `console-logger.ts`) import only `node:*`, `../core/*` (by relative path, not the barrel), `./parse-args`, `./console-logger`, and type-only `../core/logger` -- none hit the bans. `bin.ts` imports only `./main`. `bin-static.spec.ts` imports `node:fs`/`node:path`/`node:url`/`vitest`/`@workspace/test-util` -- all clear.

---

### `tarball-audit.e2e.spec.ts` -- extend with the bin audit (test, e2e, D-11)

**Analog:** the existing describe/it blocks in the SAME spec (lines 161-225). EXTEND -- do NOT create a new spec. Reuse the existing pack/extract scaffolding (`beforeAll` lines 114-151 packs fresh dist via `npm pack --json --pack-destination`, records `filePaths`, extracts into `extractDir/package`).

**(1) Add `src/cli/bin.js` to `REQUIRED_FILES`** (lines 34-52 -- the positive file-set the "ships the required published files" `it` at lines 192-196 iterates). This asserts the compiled bin ships. The leak guard (lines 198-205) excludes `.spec.`, so `bin-static.spec.ts` never leaks (also excluded by `tsconfig.lib.json`).

**(2) Extend the `TarballManifest` interface** (currently lines 81-83, `scripts?` only) with `bin?: Record<string, string>`:

```typescript
interface TarballManifest {
  scripts?: Record<string, string>;
  bin?: Record<string, string>;
}
```

**(3) Add a new describe/it block** -- name it distinctly (the existing `describe('PKG-02: ...')` at line 161 is a v0.2.0 id collision; use e.g. `CLI-01/PKG-01: the packed tarball ships a runnable bin`). Mirror the existing manifest-read pattern from the install-scripts `it` (lines 215-224):

```typescript
const manifestPath = join(extractDir, 'package', 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as TarballManifest;
```

Assert:
- `manifest.bin?.['angular-typechecker'] === './src/cli/bin.js'` AND `manifest.bin?.['atc'] === './src/cli/bin.js'` (both names -> one compiled entry).
- `filePaths` contains `src/cli/bin.js` (mirror the `expect(filePaths).toContain(required)` pattern at line 194).
- Read `extractDir/package/src/cli/bin.js`; assert `content.split('\n')[0] === '#!/usr/bin/env node'` + `.not.toContain('\r')` (published-artifact half of the shebang guard; VER-03 is the dist half).

**(4) publint bin coverage is automatic** once `bin` exists -- the existing `npx publint "<tgz>" --strict` assertion (lines 162-172) already runs against the `.tgz`, and publint's `bin` rule requires the referenced file to start with a shebang. Keep the assertion; it now covers the bin.

**Windows tar gotcha already handled** (lines 89-99, 141-150): relative `-C` under `cwd=packDest`. No new harness work.

---

### `27-ADDITIVE-AUDIT.md` (doc, ADD-01, D-12)

**Analog:** `.planning/milestones/v0.2.1-phases/24-.../24-ADDITIVE-AUDIT.md`. Mirror its section structure exactly, retargeting the baseline tag `angular-typechecker@0.2.0` -> `angular-typechecker@0.2.1`:

1. **Verdict** paragraph ("ADDITIVE-ONLY HOLDS ... v0.3.0 is NOT triggered") -- model lines 8-16.
2. **Guard cross-check map** table (barrel drift tripwire + existing nx-surface / schema-parity regression specs, all present + green) -- model lines 18-38.
3. **Git-diff verdict per audited path** table (UNCHANGED / WIDEN-ONLY / net-new) -- model lines 40-59. Diff commands: RESEARCH.md lines 531-541 (baseline `angular-typechecker@0.2.1`, per-path).
4. **New-file additions** table (`src/cli/bin.ts`, `src/cli/bin-static.spec.ts`, the `bin` field) -- model lines 61-72; confirm net-new via `git cat-file -e angular-typechecker@0.2.1:packages/angular-typechecker/src/cli/bin.ts`.
5. **ADD-01 disposition** paragraph -- model lines 74-83.

Barrel-drift leg: `src/index.drift.ts` (locks the 5 exports `runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference`) runs via the `typecheck` target's `tsc --noEmit -p .../tsconfig.drift.json` (`project.json` line 94). Confirm green in the phase's `nx typecheck` run.

## Shared Patterns

### Thin-adapter charter (detection[core] / rendering[adapter])

**Sources:** `src/cli/main.ts` (the `run()` core; lines 16-45 docstring), `src/executors/typecheck/executor.ts` (the Nx adapter; lines 40-82).
**Apply to:** `src/cli/bin.ts`.

`bin.ts` is the THIRD thin adapter's OS shell over the ONE `run()` core -- never a re-implementation. The Nx executor + Angular CLI builder are the other two. The adapter composes the core then returns (executor) or writes+exits (bin); the core stays pure. `bin.ts` adds ZERO logic beyond wiring (write two strings, set exit code, catch unknown -> 2).

### nx-free `src/cli/**` import boundary

**Sources:** `eslint.config.mjs` lines 16-64 (the `core/**` block to mirror), `src/cli/main.ts` lines 1-14 (the nx-free relative-import style).
**Apply to:** `bin.ts` (import only `./main`), the lint block, and the `bin-static.spec.ts` static walk.

The `core/**` lint boundary is why the CLI import graph never reaches nx (the 24-06 chalk-chain / yarn-hoist crash class). `cli/**` extends the same discipline: lint fails at author time (D-09), the static require walk proves the BUILT graph (D-10).

### GATE A build invariant (`module: nodenext` keeps `await import()` un-downleveled)

**Sources:** `tsconfig.json` lines 3-8 (`module`/`moduleResolution: nodenext`), `src/core/compiler-loader.ts` lines 16-20 (the sole `await import('@angular/compiler-cli')`), `src/executors/typecheck/gate-a-static.spec.ts` lines 88-99 (the standing positive assertion).
**Apply to:** `bin.ts` (inherits `tsconfig.lib.json` -> `tsconfig.json` `nodenext`; NO separate bin tsconfig, D-08).

`bin.js` reaches the ESM compiler transitively through `core/compiler-loader.ts` via `await import()`, NOT `require()`. Sharing `tsconfig.lib.json` keeps that un-downleveled (no `ERR_REQUIRE_ESM`). This is ALREADY proven for `compiler-loader.js` by the existing GATE A positive assertion -- `bin.js` inherits it, no new tsconfig work. `package.json` stays `type: commonjs`.

### Dist-read static spec scaffolding

**Source:** `src/executors/typecheck/gate-a-static.spec.ts` lines 24-86 (`packageRoot`/`workspaceRoot`/`distRoot` from `project.json` `build.options.outputPath`; `stripCommentLines`; `fs.readFileSync`; positive/negative regex).
**Apply to:** `bin-static.spec.ts` (2 dirs up, not 3).

Read BUILT `.js` from `dist/` (gitignored) via `fs.readFileSync`, NEVER `git grep` (CLAUDE.md). `test` tier `dependsOn: ["build"]` guarantees the dist exists.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| repo-root `.gitattributes` | config (VCS) | n/a | No `.gitattributes` exists in the repo today (verified absent). Net-new; use the RESEARCH.md excerpt (`*.ts text eol=lf`) -- a 1-line file. |

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/cli/`, `packages/angular-typechecker/src/executors/typecheck/`, `packages/angular-typechecker/src/core/`, `packages/angular-typechecker/` (config roots), `e2e/angular-typechecker-install-e2e/src/`, `.planning/milestones/v0.2.1-phases/24-.../`.
**Files scanned (read this session):** `src/cli/main.ts`, `src/executors/typecheck/gate-a-static.spec.ts`, `src/executors/typecheck/executor.ts`, `eslint.config.mjs`, `package.json`, `tsconfig.lib.json`, `tsconfig.json`, `src/core/compiler-loader.ts`, `src/index.drift.ts`, `project.json`, `e2e/.../tarball-audit.e2e.spec.ts`, `24-ADDITIVE-AUDIT.md`.
**Pattern extraction date:** 2026-07-16
