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
// Accepts a custom script body so a test can exercise a stub shape other than
// the default STUB_BIN (e.g. a doc that parses but contributes zero runs).
function writeStubBin(root: string, script: string = STUB_BIN): void {
  const binDir = join(
    root,
    'dist',
    'packages',
    'angular-typechecker',
    'src',
    'cli',
  );
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, 'bin.js'), script);
}

// A second stub: the FIRST-discovered project (alphabetically) parses to valid
// JSON with a non-empty envelope but a ZERO-length `runs` array (as opposed to
// empty stdout) -- the "doc parses but contributes no run" path inside
// mergeSarifRuns's `if (!run) continue;` branch, distinct from the CLI-level
// empty-stdout skip the other two tests already prove.
const NO_RUN_FIRST_STUB = `const args = process.argv.slice(2);

if (args.some((arg) => arg.includes('aaa-no-run'))) {
  process.stdout.write(
    JSON.stringify({
      version: 'no-run-version',
      $schema: 'no-run-schema',
      runs: [],
    }),
  );
} else {
  process.stdout.write(
    JSON.stringify({
      version: 'has-run-version',
      $schema: 'has-run-schema',
      runs: [
        { tool: { driver: { name: 'angular-typechecker' } }, results: [] },
      ],
    }),
  );
}
`;

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

  it('preserves the envelope from the first entry that contributes a run, not merely the first entry discovered', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'merge-sarif-envelope-order-'));

    try {
      // 'aaa-no-run' sorts BEFORE 'zzz-has-run' in discovery's alphabetical
      // order, but its doc parses to valid JSON with a ZERO-length `runs`
      // array -- it must contribute NEITHER a run NOR the envelope. A merge
      // implementation that grabbed the envelope from the first ENTRY
      // (regardless of whether that entry had a run) rather than the first
      // VALID run would leak 'no-run-version'/'no-run-schema' here.
      writeConsumer(tempRoot, 'aaa-no-run');
      writeConsumer(tempRoot, 'zzz-has-run');
      writeStubBin(tempRoot, NO_RUN_FIRST_STUB);

      execFileSync('node', [mergeScript], { cwd: tempRoot, encoding: 'utf8' });

      const merged = JSON.parse(
        readFileSync(join(tempRoot, 'angular-typechecker.sarif'), 'utf8'),
      ) as {
        version: string;
        $schema: string;
        runs: { automationDetails?: { id?: string } }[];
      };

      expect(merged.runs).toHaveLength(1);
      expect(merged.runs[0].automationDetails?.id).toBe(
        'angular-typecheck/zzz-has-run',
      );
      expect(merged.version).toBe('has-run-version');
      expect(merged.$schema).toBe('has-run-schema');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
