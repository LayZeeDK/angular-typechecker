import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import { run } from './main';

// VER-02 (CLI-02/CLI-03/EXIT-01/PKG-03) -- the REAL-cold-compiler end-to-end proof
// of the Wave-2 `run(argv, env)` core (Plan 26-02). Each case calls `run` IN-PROCESS
// (NO spawn, NO tarball, NO process.exit) against a committed top-level `fixtures/`
// tsconfig, driving the real `@angular/compiler-cli` through the CJS->ESM
// `await import()` bridge, and asserts on the returned `{ exitCode, stdout, stderr }`.
//
// This is the ONLY tier that can prove the correctness the unit stubs (Plan 26-02
// `main.spec.ts`) cannot fake: `run()` produces the SAME verdict + diagnostics as the
// Nx executor over real fixtures (the CLI-02 charter), a REAL coverage-incomplete run
// exits 1 (errorCount 0, success false), and a nonexistent tsconfig exits 2 through
// the D-06 realpath ENOENT guard rather than throwing.
//
// PATTERN (mirrors src/core/run-typecheck.integration.spec.ts): resolve
// `workspaceRoot` via `findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))`
// and build ABSOLUTE fixture tsconfig paths via `join(workspaceRoot, 'fixtures', ...)`.
// `run()` resolves a RELATIVE -c against `process.cwd()` (D-05), so absolute paths keep
// every case cwd-independent EXCEPT the one PKG-03 case that deliberately drives a
// relative -c from a chdir'd cwd.
//
// RENDERED-CODE DISCIPLINE: assertions here read the RENDERED report string (stdout),
// where `compiler-cli`'s `formatDiagnostics` prints the HUMAN code form -- `TS2322`
// for TypeScript, `NG8109` for Angular. The negative-encoding helper the core specs
// use (`NG(code) = -990000 - code`) applies only to the numeric `CoreResult.diagnostics`
// field, which `run()` does not expose -- so it is deliberately absent here.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const fixturesDir = join(workspaceRoot, 'fixtures');

function fixture(...segments: string[]): string {
  return join(fixturesDir, ...segments);
}

// Deterministic, ANSI-free stdout for the substring assertions: NO_COLOR wins the
// D-09/ARGS-05 precedence, so `renderReport` strips ANSI regardless of the runner's
// TTY. `run()` reads `env` ONLY for color detection, so a minimal env is safe.
const NO_COLOR_ENV = { NO_COLOR: '1' } satisfies NodeJS.ProcessEnv;

// Clean leaf: only `.ts` declared, zero diagnostics, no advisory (proven by
// not-type-checked.integration.spec.ts's negative control).
const cleanTsConfig = fixture('not-type-checked-clean', 'tsconfig.json');
// gate-b-error is the F1+F7 differentiator: a plain TS error (TS2322) AND a
// template/extended error (NG8109) in the SAME program (a single in-project leaf,
// so no advisory is emitted to stderr).
const gateBTsConfig = fixture('gate-b-error', 'tsconfig.app.json');
// A zero-root-names leaf (`files: []`, no references): as an ARRAY entry the core
// records a zero-root-names skip -> coverage-incomplete.
const emptyLeafTsConfig = fixture('solution-style-empty', 'tsconfig.json');
// A REPORTED in-project NG8xxx warning (NG8101, warningCount 1,
// suppressedInGraphWarningCount 0) -- clean with no gate, fails under --max-warnings 0.
const warningTsConfig = fixture('extended-v13', 'tsconfig.app.json');
// Two co-located leaves with a planted diagnostic EACH (TS2322 app, TS2345 spec).
const multiAppTsConfig = fixture('multi-tsconfig-array', 'tsconfig.app.json');
const multiSpecTsConfig = fixture('multi-tsconfig-array', 'tsconfig.spec.json');
// A solution tsconfig (`files: []` + references) whose leaves each carry a TS2322;
// as a SINGLE -c it must reference-walk both leaves (never a zero-root-names skip).
const solutionTsConfig = fixture('solution-style', 'tsconfig.json');
// A real file whose `extends` target does NOT exist -> the compiler folds a counted
// 5012 config error (a COMPLETED run), never an infra throw (COR-01 / MD-01).
const malformedTsConfig = fixture('config-broken', 'tsconfig.malformed.json');
// A path that resolves to NOTHING (the file is intentionally absent): ENOENT ->
// TypecheckInfrastructureError -> exit 2 through the D-06 realpath guard.
const nonexistentTsConfig = fixture(
  'config-broken',
  'tsconfig.does-not-exist.json',
);

describe('run() VER-02: clean fixture -> exit 0', () => {
  it('returns exitCode 0 with no buffered notices on a fully-checked clean leaf', async () => {
    const result = await run(['-c', cleanTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(0);
    // A clean run stays silent: no advisory notice reaches stderr.
    expect(result.stderr).toBe('');
  });
});

describe('run() VER-02 + CLI-03: planted TS error -> exit 1, code in stdout (report), never stderr', () => {
  it('surfaces the planted TS2322 in stdout and routes NOTHING to stderr (report->stdout, notices->stderr)', async () => {
    const result = await run(['-c', gateBTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(1);
    // The diagnostic code lands in the report (stdout, CLI-03)...
    expect(result.stdout).toContain('TS2322');
    // ...and NEVER in the buffered-notice stream (stderr, CLI-03 routing / T-26-04).
    expect(result.stderr).not.toContain('TS2322');
  });
});

describe('run() VER-02: planted template / NG8xxx error -> exit 1, NG code in stdout', () => {
  it('surfaces the template NG8109 (rendered human form) in the stdout report', async () => {
    const result = await run(['-c', gateBTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(1);
    // compiler-cli's formatDiagnostics renders the Angular code as the human `NG8109`
    // (never the internal negative-encoded -998109).
    expect(result.stdout).toContain('NG8109');
  });
});

describe('run() VER-02: REAL coverage-incomplete (errorCount 0, success false) -> exit 1', () => {
  it('exits 1 on a zero-root-names leaf unioned with a clean leaf -- a verdict no unit stub can fake', async () => {
    // A single -c would COLLAPSE to a string and reference-walk (surfacing the
    // 90001 guard as a COUNTED error -> type-error). Passing the empty leaf as ONE
    // entry of a TWO-entry ARRAY (with a clean sibling) exercises the real
    // ARRAY-path zero-root-names SKIP: errorCount stays 0, the skip forces the
    // coverage-incomplete verdict (evaluateResult.success === false), and the run
    // exits 1 -- the anti-false-pass floor the unit tier can only stub.
    const result = await run(
      ['-c', cleanTsConfig, '-c', emptyLeafTsConfig],
      NO_COLOR_ENV,
    );

    expect(result.exitCode).toBe(1);
    // The loud coverage-incomplete signal is buffered to stderr (the empty leaf's
    // zero-root-names skip advisory) -- proving this is the coverage-incomplete
    // verdict path, not a counted type error.
    expect(result.stderr).toContain('zero-root-names');
  });
});

describe('run() VER-02: warning-gate fixtures (--max-warnings / --strict)', () => {
  it('a REPORTED NG8xxx warning alone (no gate) does NOT fail -> exit 0', async () => {
    // Establishes the fixture is a WARNING (not an error): with no gate, warnings
    // never fail on their own, so the SAME fixture that fails below exits 0 here.
    const result = await run(['-c', warningTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(0);
  });

  it('--max-warnings 0 on the reported-warning fixture -> exit 1 (warnings gate)', async () => {
    const result = await run(
      ['-c', warningTsConfig, '--max-warnings', '0'],
      NO_COLOR_ENV,
    );

    expect(result.exitCode).toBe(1);
  });

  it('--strict WITH --max-warnings 0 on the SAME reported-warning fixture -> exit 1', async () => {
    // CORRECTED per plan: --strict ALONE fails only on a DROPPED in-graph warning
    // (suppressedInGraphWarningCount > 0), which this fixture (a plain reported
    // NG8101, suppressedInGraphWarningCount 0) does not have -- so --strict alone
    // would leave it clean. The reported-warning verdict-fail is driven here by
    // COMBINING --strict with --max-warnings 0 (the warnings gate). The assert
    // exitCode 1 is NOT weakened.
    const result = await run(
      ['-c', warningTsConfig, '--strict', '--max-warnings', '0'],
      NO_COLOR_ENV,
    );

    expect(result.exitCode).toBe(1);
  });
});

describe('run() VER-02 / ARGS-03: multi -c union vs single -c solution-walk', () => {
  it('TWO -c entries UNION both leaves diagnostics (TS2322 app + TS2345 spec) -> exit 1', async () => {
    const result = await run(
      ['-c', multiAppTsConfig, '-c', multiSpecTsConfig],
      NO_COLOR_ENV,
    );

    expect(result.exitCode).toBe(1);
    // The union surfaces BOTH leaves' planted diagnostics in one report.
    expect(result.stdout).toContain('TS2322');
    expect(result.stdout).toContain('TS2345');
  });

  it('a SINGLE -c solution tsconfig reference-walks its leaves (never a zero-root-names skip) -> exit 1', async () => {
    // The single-vs-array collapse (ARGS-03 / D-13): a single -c is handed to the
    // core as a STRING, so a `files: []` solution tsconfig reference-WALKS its leaves
    // rather than being treated as a one-element array (which would record a
    // zero-root-names skip). Proof: BOTH the app and the spec leaf files surface
    // their planted TS2322 -- the spec-file error is reachable ONLY through the spec
    // leaf (a build never compiles specs), the named build differentiator.
    const result = await run(['-c', solutionTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('error.component.ts');
    expect(result.stdout).toContain('error.component.spec.ts');
    // The walk ran, so NO zero-root-names skip was recorded (contrast the empty-leaf
    // array case above) -- proving the collapse routed to solution-walk, not a
    // one-element-array leaf.
    expect(result.stderr).not.toContain('zero-root-names');
  });
});

describe('run() VER-02 / D-06: config-resolution failures -> the two-step exit compose', () => {
  it('a malformed tsconfig (broken `extends`) folds a COUNTED config error -> exit 1, NOT an infra exit 2', async () => {
    // DEVIATION from the plan (documented in SUMMARY): the plan expected exit 2 for
    // tsconfig.malformed.json, but a broken `extends` TARGET is folded by the compiler
    // into a COUNTED 5012 config error on a COMPLETED run (locked by
    // config-resolution.integration.spec.ts) -- it does NOT throw a
    // TypecheckInfrastructureError, so run()'s completed-run branch returns
    // evaluateResult(...).success ? 0 : 1 = 1. Only a nonexistent PATH (ENOENT) is an
    // infra exit 2 (asserted below). This is the COR-01/MD-01 distinction, proven
    // end-to-end.
    const result = await run(['-c', malformedTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(1);
    // The unresolvable extends target is named in the report -- the malformed config
    // is never silently clean.
    expect(result.stdout).toContain('tsconfig.does-not-exist.json');
  });

  it('a NONEXISTENT tsconfig path -> exit 2 via the realpath ENOENT guard (never an uncaught throw)', async () => {
    // T-26-02: the file at nonexistentTsConfig does NOT exist. `realpathSync.native`
    // throws ENOENT; run() falls through to the plain resolved path, the core raises
    // its canonical TypecheckInfrastructureError, and run() maps it to exit 2 -- never
    // an uncaught throw out of run().
    const result = await run(['-c', nonexistentTsConfig], NO_COLOR_ENV);

    expect(result.exitCode).toBe(2);
    // The infra-catch message routes to stderr (the compiler failed to RUN).
    expect(result.stderr).toContain('the Angular compiler failed to run');
    // A usage/infra failure produces no report.
    expect(result.stdout).toBe('');
  });
});

describe('run() VER-02 / PKG-03: a relative -c from a non-root cwd yields the same verdict', () => {
  it('a relative -c resolved against a chdir cwd matches the canonical absolute-path verdict', async () => {
    const absolute = await run(['-c', gateBTsConfig], NO_COLOR_ENV);

    const originalCwd = process.cwd();
    let relative;

    try {
      // Resolve the SAME fixture via a relative -c from the fixtures/ directory
      // (run() joins a relative path against process.cwd(), D-05).
      process.chdir(fixturesDir);

      relative = await run(
        ['-c', join('gate-b-error', 'tsconfig.app.json')],
        NO_COLOR_ENV,
      );
    } finally {
      // Restore the cwd regardless of the assertion outcome (no cross-test leak).
      process.chdir(originalCwd);
    }

    // Path normalization / the realpath guard make the two resolutions equivalent:
    // the relative-from-cwd verdict equals the canonical absolute-path verdict.
    expect(relative.exitCode).toBe(absolute.exitCode);
    expect(relative.exitCode).toBe(1);
  });
});
