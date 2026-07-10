import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GATE A static: prove the built artifacts retain a native dynamic `import()`
// of @angular/compiler-cli and never downlevel it to a `require()` call. This is
// the spike's criterion 1 (CONTEXT.md go/no-go checklist). It reads the BUILT
// `.js` from `dist/` (which is gitignored -- so `fs.readFileSync`, NEVER
// `git grep`, per CLAUDE.md / D-12) and asserts on its bytes.
//
// Per RESEARCH-ADDENDUM-WAVE3 Finding 2 the literal `import(` lives in CORE
// (`compiler-loader.js`), NOT in `executor.js` -- the `await import()` belongs to
// the core under the mandated core/adapter split (D-08); the executor is a thin
// `require()`-based delegate. So the POSITIVE assertion targets
// `core/compiler-loader.js`; the NEGATIVE (`no require() of compiler-cli`) is
// asserted on BOTH built files.
//
// Prerequisite: `nx build angular-typechecker` must have run first (the full
// suite command `nx build && nx test` enforces build-before-static-read).

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const workspaceRoot = findWorkspaceRoot(packageRoot);

interface BuildTarget {
  options: {
    outputPath: string;
  };
}

interface ProjectJson {
  targets: {
    build: BuildTarget;
  };
}

// Derive the dist root from `project.json` `build.options.outputPath`
// (= `dist/packages/angular-typechecker`) rather than hard-coding it
// (resolved research Open Q2 -- the path is owned by the build config).
const projectJson = JSON.parse(
  readFileSync(join(packageRoot, 'project.json'), 'utf8'),
) as ProjectJson;
const outputPath = projectJson.targets.build.options.outputPath;
const distRoot = join(workspaceRoot, outputPath);

const compilerLoaderJsPath = join(
  distRoot,
  'src',
  'core',
  'compiler-loader.js',
);
const executorJsPath = join(
  distRoot,
  'src',
  'executors',
  'typecheck',
  'executor.js',
);
const builderJsPath = join(
  distRoot,
  'src',
  'builders',
  'typecheck',
  'builder.js',
);

/**
 * Strips full-line `//` comments so that a `import(` or
 * `require('@angular/compiler-cli')` sitting inside a JSDoc/`//` comment cannot
 * false-pass (positive) or false-fail (negative) the regex. (The built
 * `executor.js` names `@angular/compiler-cli` only inside a JSDoc block -- a bare
 * substring check would false-fail; T-01-11.)
 */
function stripCommentLines(code: string): string {
  return code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

describe('GATE A static (built artifacts retain literal import() of @angular/compiler-cli)', () => {
  it('positive: built core/compiler-loader.js retains a literal import( (module: nodenext kept the dynamic load)', () => {
    const code = stripCommentLines(readFileSync(compilerLoaderJsPath, 'utf8'));

    expect(code).toMatch(/import\(/);
  });

  it('negative: built core/compiler-loader.js does NOT require() @angular/compiler-cli', () => {
    const code = stripCommentLines(readFileSync(compilerLoaderJsPath, 'utf8'));

    expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
  });

  it('negative: built executors/.../executor.js does NOT require() @angular/compiler-cli', () => {
    const code = stripCommentLines(readFileSync(executorJsPath, 'utf8'));

    expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
  });

  // GATE A' (ACB-02): the Angular CLI builder entry is `convertNxExecutor(executor)`.
  // The builder .js does NO import() of its own -- it reaches @angular/compiler-cli
  // through the SAME core/compiler-loader.js the executor uses (the positive import(
  // assertion above already covers that load site). So only the NEGATIVE assertion is
  // needed here: a build-graph drift that recompiled the reachable load site under
  // `module: commonjs` (re-introducing the v0.0.1 import()->require() downlevel) must
  // never leave a require() of the ESM compiler in the builder entry either.
  it('negative: built builders/.../builder.js does NOT require() @angular/compiler-cli', () => {
    const code = stripCommentLines(readFileSync(builderJsPath, 'utf8'));

    expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
  });
});
