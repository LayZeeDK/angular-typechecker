import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// PROOF-02 (local, GitHub-free half). Proves the REAL tools/ci/assert-code-scanning.mjs
// makes the right set-membership decision and FAILS LOUD (non-zero exit) when a
// family alert is missing or lands under the wrong category -- WITHOUT hitting
// GitHub. The actual SARIF -> Code Scanning ingestion assertion is real-CI-only
// (the 35-03 code-scanning-proof job); this spec is the fast, deterministic tripwire
// for the matcher + fail-loud path that the CI job depends on.
//
// It drives the real script as a SUBPROCESS (execFileSync) through the script's
// `ASSERT_ALERTS_FILE` env seam, feeding a canned alerts payload from a mkdtemp temp
// file. It does NOT import the `.mjs` by any mechanism: a pathToFileURL/file://
// dynamic import of a cross-project .mjs fails vitest's module runner (it cannot
// resolve a file URL outside this project's root), and a relative
// `../../../tools/ci/...` import fails @nx/enforce-module-boundaries at
// maxWarnings:0 (a required lint gate). So the spec imports ONLY node builtins +
// vitest + @workspace/test-util and asserts on the subprocess exit code + streams,
// exactly like merge-sarif.spec.ts / ci-e2e-coverage-guard.spec.ts.

const CATEGORY = 'angular-typecheck-proof';

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const assertScript = join(
  workspaceRoot,
  'tools',
  'ci',
  'assert-code-scanning.mjs',
);

interface ProofAlert {
  rule: { tags: string[]; severity: string };
  most_recent_instance: { category: string };
}

interface SubprocessResult {
  status: number;
  stdout: string;
  stderr: string;
}

type SubprocessError = Error & {
  status?: number | null;
  stdout?: string;
  stderr?: string;
};

// One Code Scanning alert in the shape the assert matcher reads: the family tag on
// rule.tags, the SARIF level on rule.severity, the upload category on
// most_recent_instance.category (defaults to the proof category).
function alert(
  tag: string,
  severity: string,
  category: string = CATEGORY,
): ProofAlert {
  return {
    rule: { tags: [tag], severity },
    most_recent_instance: { category },
  };
}

// The four (family tag, severity) tuples the CI assert requires, locked by the
// 35-01 drift-lock: typescript/error, template-type-check/error,
// extended-diagnostics/warning, tool/error.
function allFourFamilies(): ProofAlert[] {
  return [
    alert('typescript', 'error'),
    alert('template-type-check', 'error'),
    alert('extended-diagnostics', 'warning'),
    alert('tool', 'error'),
  ];
}

// Drive the real script through the ASSERT_ALERTS_FILE seam and normalize the exit
// code + streams (execFileSync throws on a non-zero exit; capture it so each test
// asserts on `status` directly instead of relying on a try/catch shape). PR_NUMBER
// / SARIF_ID are dummies -- the seam branch returns before touching them and never
// calls `gh`.
function runAssert(alerts: ProofAlert[]): SubprocessResult {
  const tempRoot = mkdtempSync(join(tmpdir(), 'assert-code-scanning-'));
  const alertsFile = join(tempRoot, 'alerts.json');

  try {
    writeFileSync(alertsFile, JSON.stringify(alerts));

    const stdout = execFileSync('node', [assertScript], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ASSERT_ALERTS_FILE: alertsFile,
        PR_NUMBER: '9999',
        SARIF_ID: 'unused-in-seam',
      },
    });

    return { status: 0, stdout, stderr: '' };
  } catch (caught) {
    const error = caught as SubprocessError;

    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

describe('PROOF-02: assert-code-scanning.mjs set-membership + fail-loud (local seam)', () => {
  it('GREEN: exits 0 when all four (family tag, severity) tuples are present under the proof category', () => {
    const result = runAssert(allFourFamilies());

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'all expected (family tag, severity) tuples',
    );
  });

  it('RED: exits non-zero naming the missing family when a family alert is absent (PROOF-02)', () => {
    // Drop the tool-family alert -> its tuple is unsatisfiable -> fail loud.
    const missingTool = allFourFamilies().filter(
      (proofAlert) => !proofAlert.rule.tags.includes('tool'),
    );

    const result = runAssert(missingTool);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tool/error');
  });

  it('category isolation: a right-tag/right-severity alert under a dogfood category does NOT satisfy the tuple (exits non-zero)', () => {
    // The tool alert has the correct tag + severity but a dogfood category, so the
    // client-side category filter drops it and the tool tuple stays missing --
    // proving the category filter is load-bearing, not cosmetic (Pattern 2).
    const wrongCategoryTool = [
      alert('typescript', 'error'),
      alert('template-type-check', 'error'),
      alert('extended-diagnostics', 'warning'),
      alert('tool', 'error', 'angular-typecheck/some-project'),
    ];

    const result = runAssert(wrongCategoryTool);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tool/error');
  });
});
