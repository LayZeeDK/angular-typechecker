import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// VER-03 static guard: prove the BUILT `bin.js` survives `@nx/js:tsc` with (a) a
// deterministic LF `#!/usr/bin/env node` shebang (a CRLF from the Windows arm64
// build host would break it on Linux/macOS with `env: 'node\r': No such file or
// directory`) and (b) an nx-free `require` graph -- the standalone CLI must never
// drag `@nx/*`/`nx` transitively (the 24-06 chalk-chain / yarn-hoist crash class).
//
// This reads the BUILT `.js` from `dist/` (gitignored -- so `fs.readFileSync`,
// NEVER `git grep`, per CLAUDE.md / D-12) and asserts on its bytes. It is
// STATIC/test-tier ONLY: the RUNTIME `require.cache` module-graph probe on the
// INSTALLED bin is Phase 28 (VER-04).
//
// Prerequisite: `nx build angular-typechecker` must have run first. The `test`
// target has `dependsOn: ["build"]`, so `nx test` builds dist before this read.

// `bin-static.spec.ts` sits at `src/cli/`, so packageRoot is TWO dirs up
// (src/cli -> src -> packageRoot) -- NOT three like `gate-a-static.spec.ts`
// (which sits at `src/executors/typecheck/`).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
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
// (= `dist/packages/angular-typechecker`) rather than hard-coding it -- the path
// is owned by the build config.
const projectJson = JSON.parse(
  readFileSync(join(packageRoot, 'project.json'), 'utf8'),
) as ProjectJson;
const outputPath = projectJson.targets.build.options.outputPath;
const distRoot = join(workspaceRoot, outputPath);

const binJsPath = join(distRoot, 'src', 'cli', 'bin.js');

// An nx specifier: `@nx/devkit`, bare `nx`, or `nx/...`. Does NOT match `node:*`,
// `tslib`, `typescript`, or `@angular/*` (the legitimate leaf dependencies).
const NX_SPECIFIER = /^(@nx\/|nx\/|nx$)/;
// The built CJS emit uses double-quoted, extensionless, relative requires, e.g.
// `const main_1 = require("./main");` / `require("../core/run-typecheck");`.
const REQUIRE_SPECIFIER = /require\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Strips full-line `//` / `*` / `/*` comments so a `require("@nx/...")` sitting
 * inside a JSDoc block cannot false-fail the nx-free assertion. Copied verbatim
 * from `gate-a-static.spec.ts`.
 */
function stripCommentLines(code: string): string {
  return code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

/**
 * Static transitive walk from the built `bin.js`: reads each reachable built
 * `.js`, checks every `require()` specifier against the nx pattern, and FOLLOWS
 * only relative specifiers (resolving `spec + '.js'` beside the current file).
 * Bare/builtin specifiers (`tslib`, `node:*`, `typescript`) are checked but not
 * followed. `@angular/compiler-cli` never appears (it is reached via `await
 * import()`, not `require`). Returns every offending `file -> specifier`.
 */
function collectNxRequires(entryFile: string): string[] {
  const violations: string[] = [];
  const visited = new Set<string>();

  function walk(file: string): void {
    if (visited.has(file)) {
      return;
    }

    visited.add(file);

    const code = stripCommentLines(readFileSync(file, 'utf8'));
    const specifiers = [...code.matchAll(REQUIRE_SPECIFIER)].map(
      (match) => match[1],
    );

    for (const specifier of specifiers) {
      if (NX_SPECIFIER.test(specifier)) {
        violations.push(`${file} -> require("${specifier}")`);
      }

      if (specifier.startsWith('.')) {
        const resolved = join(dirname(file), `${specifier}.js`);

        if (existsSync(resolved)) {
          walk(resolved);
        }
      }
    }
  }

  walk(entryFile);

  return violations;
}

describe('bin-static (built bin.js keeps an LF shebang + an nx-free require graph, VER-03)', () => {
  it('first line is exactly #!/usr/bin/env node with no carriage return', () => {
    const firstLine = readFileSync(binJsPath, 'utf8').split('\n')[0];

    expect(firstLine).toBe('#!/usr/bin/env node');
    expect(firstLine).not.toContain('\r');
  });

  it('require graph from bin.js never reaches @nx/* or nx', () => {
    const violations = collectNxRequires(binJsPath);

    expect(violations).toEqual([]);
  });
});
