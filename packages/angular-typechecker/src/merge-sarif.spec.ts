import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// MULTI-01 merge-shape guard (D-02). Proves the REAL tools/ci/merge-sarif.mjs
// assembles the per-project single-run SARIF files into ONE multi-run file whose
// runs each carry `automationDetails.id = angular-typecheck/<project>`, preserves
// the `{ version, $schema }` envelope from the first valid run, skips a project
// that produces empty stdout, and writes NOTHING when zero runs are collected.
//
// It drives the real CLI as a SUBPROCESS (execFileSync) against a hermetic
// mkdtempSync temp workspace -- fixture `apps/*/project.json` files the real
// discovery finds, plus a stub `dist/.../cli/bin.js` the merge spawns. It does NOT
// import `mergeSarifRuns` or any tools/ci module by any mechanism: a
// pathToFileURL/file:// dynamic import of a cross-project .mjs fails vitest's
// module runner (it cannot resolve a file URL outside this project's root), and a
// relative `../../../tools/ci/...` import fails @nx/enforce-module-boundaries at
// maxWarnings:0 (a required format-lint gate). So the spec imports ONLY node
// builtins + vitest + @workspace/test-util, exactly like ci-e2e-coverage-guard's
// B3 test, and asserts on the file the CLI writes.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const mergeScript = join(workspaceRoot, 'tools', 'ci', 'merge-sarif.mjs');

// A stub for the shipped CLI. It prints a canned single-run SARIF to stdout,
// EXCEPT it prints nothing (empty stdout, the exit-2 analogue) when any argument
// names a `proj-empty` project -- proving the per-project skip.
const STUB_BIN = `const args = process.argv.slice(2);

if (args.some((arg) => arg.includes('proj-empty'))) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    version: '2.1.0',
    $schema: 'x',
    runs: [{ tool: { driver: { name: 'angular-typechecker' } }, results: [] }],
  }),
);
`;

// Write a fixture consumer the real discovery finds (executor target + a tsConfig
// whose leaf path carries the project name, so the stub can key on `proj-empty`).
function writeConsumer(root: string, name: string): void {
  const dir = join(root, 'apps', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'project.json'),
    JSON.stringify({
      name,
      targets: {
        typecheck: {
          executor: 'angular-typechecker:typecheck',
          options: { tsConfig: `apps/${name}/tsconfig.json` },
        },
      },
    }),
  );
}

// Write the stub CLI where merge-sarif.mjs spawns it (relative to the temp cwd).
function writeStubBin(root: string): void {
  const binDir = join(
    root,
    'dist',
    'packages',
    'angular-typechecker',
    'src',
    'cli',
  );
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, 'bin.js'), STUB_BIN);
}

describe('MULTI-01: merge-sarif.mjs assembles a multi-run SARIF', () => {
  it('merges one run per non-empty consumer, stamps angular-typecheck/<name>, skips the empty project, preserves the envelope', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'merge-sarif-'));

    try {
      writeConsumer(tempRoot, 'proj-a');
      writeConsumer(tempRoot, 'proj-b');
      writeConsumer(tempRoot, 'proj-empty');
      writeStubBin(tempRoot);

      execFileSync('node', [mergeScript], { cwd: tempRoot, encoding: 'utf8' });

      const merged = JSON.parse(
        readFileSync(join(tempRoot, 'angular-typechecker.sarif'), 'utf8'),
      ) as {
        version: string;
        $schema: string;
        runs: { automationDetails?: { id?: string } }[];
      };

      // proj-empty emitted empty stdout -> only proj-a + proj-b are merged.
      expect(merged.runs).toHaveLength(2);
      expect(merged.runs.map((run) => run.automationDetails?.id)).toEqual([
        'angular-typecheck/proj-a',
        'angular-typecheck/proj-b',
      ]);
      // Envelope preserved from the first valid run.
      expect(merged.version).toBe('2.1.0');
      expect(merged.$schema).toBe('x');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('writes NO output file when every consumer produces empty stdout (zero runs)', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'merge-sarif-empty-'));

    try {
      // Every consumer name carries the proj-empty marker, so the stub emits empty
      // stdout for all of them -> zero collected runs -> mergeSarifRuns returns
      // null -> the CLI writes NO file, so the job's `[ -s ]` guard skips upload.
      writeConsumer(tempRoot, 'proj-empty-a');
      writeConsumer(tempRoot, 'proj-empty-b');
      writeStubBin(tempRoot);

      execFileSync('node', [mergeScript], { cwd: tempRoot, encoding: 'utf8' });

      expect(existsSync(join(tempRoot, 'angular-typechecker.sarif'))).toBe(
        false,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
