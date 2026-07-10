import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import builderDefault from './builder';

// ACB-01 / T-21-09 thin-wrapper contract: the Angular CLI builder MUST be the
// thin `convertNxExecutor(typecheckExecutor)` re-export of the SAME executor
// default export -- it writes NO logic of its own, so its diagnostics + report +
// { success } are STRUCTURALLY IDENTICAL to the Nx executor (parity is structural
// because it IS that executor). This spec fails LOUDLY if a future edit forks the
// engine, wraps a different executor, or hand-writes an @angular-devkit/architect
// builder (forbidden by the ADDITIVE-ONLY charter / D-04).
//
// Two backstops:
//   (a) a SOURCE assertion over builder.ts bytes (catches a forked/re-authored
//       builder even if it still produces a valid builder), and
//   (b) a RUNTIME assertion that the default export is a genuine Architect
//       builder: `convertNxExecutor` -> `createBuilder` returns an OBJECT (not a
//       bare function) branded with the global
//       `Symbol.for('@angular-devkit/architect:builder')` === true and carrying a
//       `handler` function (the wrapped executor). It builds that object at
//       module-eval time WITHOUT running the engine, so the static import above
//       resolving cleanly proves importing it does NOT load
//       @angular/compiler-cli -- the spec stays in the fast `nx test` loop with no
//       build prerequisite.

const builderSourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'builder.ts',
);
const builderSource = readFileSync(builderSourcePath, 'utf8');

describe('builder.ts thin-wrapper parity (ACB-01 / T-21-09)', () => {
  it('imports convertNxExecutor from @nx/devkit', () => {
    expect(builderSource).toMatch(
      /import\s*\{\s*convertNxExecutor\s*\}\s*from\s*['"]@nx\/devkit['"]/,
    );
  });

  it('imports the typecheck executor default from ../../executors/typecheck/executor', () => {
    expect(builderSource).toMatch(
      /import\s+typecheckExecutor\s+from\s*['"]\.\.\/\.\.\/executors\/typecheck\/executor['"]/,
    );
  });

  it('default-exports exactly convertNxExecutor(typecheckExecutor) (no forked engine)', () => {
    expect(builderSource).toMatch(
      /export\s+default\s+convertNxExecutor\(\s*typecheckExecutor\s*\)/,
    );
  });

  it('resolves at runtime to a genuine Architect builder (brand + handler; no compiler-cli load)', () => {
    const builder = builderDefault as {
      handler?: unknown;
      [key: symbol]: unknown;
    };

    expect(typeof builder).toBe('object');
    expect(builder[Symbol.for('@angular-devkit/architect:builder')]).toBe(true);
    expect(typeof builder.handler).toBe('function');
  });
});
