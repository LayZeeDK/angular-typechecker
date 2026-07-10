import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// ACB-03 / T-21-08 Nx-surface regression contract: the additive `builders` field
// (Plan 01) MUST NOT change what Nx resolves. Nx reads
// `packageJson.executors ?? packageJson.builders` (source-verified in RESEARCH:
// nx `executor-utils.js` L76) and `generators ?? schematics`
// (`generator-utils.js` L57) -- so as long as `executors` stays declared and
// `executors.json` still declares the `typecheck` executor, Nx NEVER reads
// `builders.json` and `nx run <project>:typecheck` stays resolvable. This is the
// fast, deterministic static backstop to the live e2e/GUARD-01 resolve smoke: a
// pure package.json + executors.json read-and-assert (no Nx invocation, no
// compiler-cli load), so it runs in the fast `nx test` loop with no build.

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

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
