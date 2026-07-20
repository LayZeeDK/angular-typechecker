import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// VER-04 / D-03 static guard: prove the lazy `await import()` firewall keeps
// `node-sarif-builder` (and its transitive `fs-extra`) OFF the human / JSON /
// `--help` / CLI-boot require graph. `renderReport`'s `sarif` branch reaches the
// reporter ONLY via `await import('./sarif-report.js')` -- a dynamic `import(...)`,
// never a `require(...)` -- so a static require-graph walk from the shared
// `render-report.js` seam AND the CLI-boot `bin.js` never enters `sarif-report.js`
// and never reaches the SARIF dependency. A regression to a top-level
// `import ... from 'node-sarif-builder'` (which WOULD drag the dep + its
// transitive `fs-extra` onto every non-SARIF startup) compiles to
// `require("node-sarif-builder")` and fails this spec loudly -- the VER-04 lock on
// 31-01's supply-chain / startup-leanness win (T-31-05).
//
// This reads the BUILT `.js` from `dist/` (gitignored -- so `fs.readFileSync`,
// NEVER `git grep`, per CLAUDE.md / D-12) and asserts on its bytes. It is
// STATIC/test-tier ONLY (no runtime module-graph probe here).
//
// Prerequisite: `nx build angular-typechecker` must have run first. The `test`
// target has `dependsOn: ["build"]`, so `nx test` builds dist before this read.

// `sarif-require-graph.spec.ts` sits at `src/core/`, so packageRoot is TWO dirs up
// (src/core -> src -> packageRoot) -- the same depth as `bin-static.spec.ts` at
// `src/cli/`.
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

// The two entry points that MUST stay off the SARIF dependency: the shared
// `render-report.js` seam (all three formats pass through it) and the CLI-boot
// `bin.js` (explicit `--help` / startup proof).
const renderReportJsPath = join(distRoot, 'src', 'core', 'render-report.js');
const binJsPath = join(distRoot, 'src', 'cli', 'bin.js');

// The SARIF dependency + its top-level transitive require. Catching `fs-extra`
// (node-sarif-builder's own top-level `require`) proves the WHOLE chain stays off
// the boot path even if node-sarif-builder were ever statically pulled in.
const FORBIDDEN_SPECIFIER = /^(node-sarif-builder|fs-extra)$/;
// The built CJS emit uses double-quoted, extensionless, relative requires, e.g.
// `const main_1 = require("./main");`. This matches `require(...)` ONLY -- never
// the dynamic `import(...)` that defers `sarif-report.js`, which is exactly the
// firewall being proven.
const REQUIRE_SPECIFIER = /require\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Strips full-line `//` / `*` / `/*` comments so a `require("node-sarif-builder")`
 * sitting inside a JSDoc block cannot false-fail the assertion. Copied verbatim
 * from `bin-static.spec.ts`.
 */
function stripCommentLines(code: string): string {
  return code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

/**
 * Static transitive walk from a built entry `.js`: reads each reachable built
 * `.js`, checks every `require()` specifier against the forbidden SARIF pattern,
 * and FOLLOWS only relative specifiers (resolving `spec + '.js'` beside the
 * current file). Bare/builtin specifiers (`tslib`, `node:*`, `typescript`) are
 * checked but not followed. Because `render-report.js` reaches `sarif-report.js`
 * via `await import(...)`, not `require(...)`, the walk never enters it and
 * `node-sarif-builder`/`fs-extra` never appear. Returns every offending
 * `file -> specifier`.
 */
function collectSarifRequires(entryFile: string): string[] {
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
      if (FORBIDDEN_SPECIFIER.test(specifier)) {
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

describe('sarif-require-graph (the lazy import() firewall keeps node-sarif-builder off the human/JSON/boot paths, VER-04/D-03)', () => {
  it('require graph from render-report.js (the shared seam) never reaches node-sarif-builder or fs-extra', () => {
    const violations = collectSarifRequires(renderReportJsPath);

    expect(violations).toEqual([]);
  });

  it('require graph from bin.js (CLI boot) never reaches node-sarif-builder or fs-extra', () => {
    const violations = collectSarifRequires(binJsPath);

    expect(violations).toEqual([]);
  });

  it('positive control: render-report.js reaches the reporter via a lazy dynamic import (laziness is PRESENT, not merely absent)', () => {
    // The compiled CJS preserves the dynamic `import()` (module: nodenext) and
    // emits the relative specifier with the source's single quotes + the
    // mandatory `.js` extension: `yield import('./sarif-report.js')`. Strip
    // comments first so this control proves the REAL statement, not the JSDoc
    // mention of it. "No violation" above therefore means "lazy", not "the module
    // was deleted / no longer referenced".
    const code = stripCommentLines(readFileSync(renderReportJsPath, 'utf8'));

    expect(code).toContain("import('./sarif-report.js')");
  });
});
