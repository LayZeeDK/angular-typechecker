import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// PROOF-02 (local, GitHub-free half). Proves the REAL tools/ci/assert-code-scanning.mjs
// makes the right EXACT-SET decision (D-03: a missing tuple, an EXTRA tuple, or a
// right-code-wrong-file attribution all fail), FAILS LOUD (non-zero exit) when it
// does, and selects the right alerts for the D-01 dismissal -- WITHOUT hitting
// GitHub. The actual SARIF -> Code Scanning ingestion assertion (and the real
// dismissal PATCH) is real-CI-only (the code-scanning-red-proof job); this spec is
// the fast, deterministic tripwire for the matcher, the fail-loud path, and the
// dismissal scope discipline the CI job depends on.
//
// It drives the real script as a SUBPROCESS (execFileSync) through the script's
// `ASSERT_ALERTS_FILE` env seam, feeding a canned alerts payload from a mkdtemp temp
// file. The seam never spawns `gh`, so the dismissal is a printed DRY-RUN (the alert
// numbers that WOULD be PATCHed) rather than a real mutation. It does NOT import the
// `.mjs` by any mechanism: a pathToFileURL/file:// dynamic import of a cross-project
// .mjs fails vitest's module runner (it cannot resolve a file URL outside this
// project's root), and a relative `../../../tools/ci/...` import fails
// @nx/enforce-module-boundaries at maxWarnings:0 (a required lint gate). So the spec
// imports ONLY node builtins + vitest + @workspace/test-util and asserts on the
// subprocess exit code + streams, exactly like merge-sarif.spec.ts /
// ci-e2e-coverage-guard.spec.ts.

const CATEGORY = 'angular-typecheck-proof';
const FIXTURE = 'tools/sarif-proof-fixture';

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
  number: number;
  rule: { id: string };
  most_recent_instance: {
    category: string;
    state: string;
    location: { path: string };
  };
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

// One Code Scanning alert in the shape the assert matcher reads: the diagnostic code
// on rule.id, the file path on most_recent_instance.location.path, the upload
// category on most_recent_instance.category (defaults to the proof category), and
// the per-instance state the D-01 dismissal selection reads (NEVER the top-level
// `state`, which GitHub reports as null for a PR-only alert).
function alert(
  number: number,
  ruleId: string,
  path: string,
  {
    category = CATEGORY,
    state = 'open',
  }: { category?: string; state?: string } = {},
): ProofAlert {
  return {
    number,
    rule: { id: ruleId },
    most_recent_instance: { category, state, location: { path } },
  };
}

// The four (rule id, file path) tuples the CI assert requires EXACTLY (D-03). The
// four codes + families are locked by the 35-01 drift-lock integration spec; the
// paths -- including ATC90002 at the fixture's SOLUTION tsconfig.json (phase 35-04's
// region-less whole-file fallback, NOT an absent location) -- are locked here.
function allFourTuples(): ProofAlert[] {
  return [
    alert(1, 'TS2322', `${FIXTURE}/type-error.ts`),
    alert(2, 'NG8002', `${FIXTURE}/proof.component.html`),
    alert(3, 'NG8101', `${FIXTURE}/proof.component.html`),
    alert(4, 'ATC90002', `${FIXTURE}/tsconfig.json`),
  ];
}

// Rebuild one alert of the canned set with an overridden field, leaving the rest
// byte-identical -- keeps every "one thing differs" case a one-liner.
function replace(
  alerts: ProofAlert[],
  ruleId: string,
  changes: { path?: string; category?: string; state?: string },
): ProofAlert[] {
  return alerts.map((proofAlert) =>
    proofAlert.rule.id === ruleId
      ? alert(
          proofAlert.number,
          ruleId,
          changes.path ?? proofAlert.most_recent_instance.location.path,
          {
            category:
              changes.category ?? proofAlert.most_recent_instance.category,
            state: changes.state ?? proofAlert.most_recent_instance.state,
          },
        )
      : proofAlert,
  );
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

describe('PROOF-02: assert-code-scanning.mjs exact-set + fail-loud + dismissal scope (local seam)', () => {
  it('GREEN: exits 0 when EXACTLY the four (rule id, file path) tuples are present under the proof category', () => {
    const result = runAssert(allFourTuples());

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'all expected (rule id, file path) tuples present',
    );
  });

  it('GREEN: accepts the trailing-slash category form upload-sarif synthesizes from the category input (CR-01)', () => {
    // upload-sarif appends a trailing '/' to the synthesized automationDetails.id
    // when the category input has no slash, so GitHub can report
    // most_recent_instance.category as `angular-typecheck-proof/`. categoryMatches
    // must accept it, else the proof permanently false-REDs in real CI.
    const result = runAssert(
      allFourTuples().map((proofAlert) =>
        alert(
          proofAlert.number,
          proofAlert.rule.id,
          proofAlert.most_recent_instance.location.path,
          { category: `${CATEGORY}/` },
        ),
      ),
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'all expected (rule id, file path) tuples present',
    );
  });

  it('GREEN path pins ATC90002 at the fixture tsconfig.json -- a file-less ATC90002 goes RED', () => {
    // Phase 35-04 gives file-less SARIF results a region-less WHOLE-FILE fallback
    // location, so the live API reports ATC90002 at
    // tools/sarif-proof-fixture/tsconfig.json line 1. Expecting an ABSENT location
    // would fail permanently -- this locks the corrected D-03 path by proving a
    // genuinely location-less ATC90002 no longer satisfies the tuple. (The positive
    // half is the GREEN test above, whose canned set carries that exact path.)
    const locationLessAtc = {
      number: 4,
      rule: { id: 'ATC90002' },
      most_recent_instance: { category: CATEGORY, state: 'open' },
    } as unknown as ProofAlert;

    const result = runAssert([
      ...allFourTuples().filter(
        (proofAlert) => proofAlert.rule.id !== 'ATC90002',
      ),
      locationLessAtc,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`ATC90002@${FIXTURE}/tsconfig.json`);
  });

  it('RED: exits non-zero naming the MISSING tuple when an expected alert is absent (PROOF-02)', () => {
    // Drop the tool-family alert -> its tuple is unsatisfiable -> fail loud.
    const result = runAssert(
      allFourTuples().filter((proofAlert) => proofAlert.rule.id !== 'ATC90002'),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing expected');
    expect(result.stderr).toContain(`ATC90002@${FIXTURE}/tsconfig.json`);
  });

  it('RED: exits non-zero naming an EXTRA alert that leaked into the proof tool (D-03 second direction)', () => {
    // All four expected tuples are present, but a fifth diagnostic appeared under
    // the proof tool -- the fixture (or the reporter) grew an unexpected alert.
    const result = runAssert([
      ...allFourTuples(),
      alert(5, 'TS2345', `${FIXTURE}/type-error.ts`),
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EXTRA');
    expect(result.stderr).toContain(`TS2345@${FIXTURE}/type-error.ts`);
  });

  it('RED: exits non-zero when a rule id lands on the WRONG file (counts as both missing and extra)', () => {
    const result = runAssert(
      replace(allFourTuples(), 'NG8002', {
        path: `${FIXTURE}/type-error.ts`,
      }),
    );

    expect(result.status).toBe(1);
    // The missing direction fires first, naming the tuple at its EXPECTED path.
    expect(result.stderr).toContain(`NG8002@${FIXTURE}/proof.component.html`);
  });

  it('D-01 ordering: a FAILING assert prints NO dismissal dry-run line at all', () => {
    // Structural proof that dismissal is unreachable on a throw: the dry-run print
    // (the seam's stand-in for the real PATCH loop) lives strictly after the assert,
    // so a RED run must carry no trace of it on stdout.
    const result = runAssert(
      allFourTuples().filter((proofAlert) => proofAlert.rule.id !== 'TS2322'),
    );

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('would dismiss');
  });

  it('D-01 selection: only OPEN alerts are dismissed -- an already-dismissed alert is skipped (idempotence)', () => {
    // Dismissal is global and permanent, so a re-run sees dismissed alerts and must
    // not re-PATCH them. The selection reads most_recent_instance.state (the
    // top-level `state` is null for a PR-only alert).
    const result = runAssert(
      replace(allFourTuples(), 'NG8101', { state: 'dismissed' }),
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('would dismiss alerts 1, 2, 4');
  });

  it('D-01 scope: an alert under a dogfood category is dropped before the dismissal selection is computed', () => {
    // A dogfood-category alert must never enter the PATCH list -- the client-side
    // category filter runs BEFORE both the exact-set check and the selection, so
    // alert 99 is invisible to each (Pattern 2).
    const result = runAssert([
      ...allFourTuples(),
      alert(99, 'TS2322', 'packages/angular-typechecker/src/core/gather.ts', {
        category: 'angular-typecheck/angular-typechecker',
      }),
    ]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('would dismiss alerts 1, 2, 3, 4');
    expect(result.stdout).not.toContain('99');
  });

  it('category isolation: a right-code/right-path alert under a dogfood category does NOT satisfy the tuple (exits non-zero)', () => {
    // The ATC90002 alert has the correct rule id + path but a dogfood category, so
    // the client-side category filter drops it and its tuple stays missing --
    // proving the category filter is load-bearing, not cosmetic (Pattern 2).
    const result = runAssert(
      replace(allFourTuples(), 'ATC90002', {
        category: 'angular-typecheck/some-project',
      }),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`ATC90002@${FIXTURE}/tsconfig.json`);
  });
});
