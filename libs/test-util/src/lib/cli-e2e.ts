import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

import { plant } from './ng-cli-e2e';
import { validateSarif } from './validate-sarif';

// Shared building block for the standalone-CLI tarball-e2e specs
// (angular-typechecker-cli-e2e). Derived from ng-cli-e2e.ts's createNgRun: where
// that runner drives `ng run <target>` through execSync, runShim drives the
// package-manager-generated `.bin` shim of the SHIPPED CLI and reads the literal
// OS exit code. The shim -- not `node .../bin.js` -- is the surface under test
// (VER-04, D-03): a consumer only ever sees the PM-linked shim after install.

export interface ShimResult {
  // The literal OS process exit code the shipped bin set (0 clean / 1 verdict-fail
  // / 2 infrastructure-or-usage). spawnSync returns it as `status` WITHOUT throwing,
  // so 1 vs 2 is a direct assertion (unlike execSync, which throws on any non-zero).
  readonly code: number;
  // Combined stdout + stderr, so a diagnostic CODE assertion (toContain('TS2322'))
  // and the ERR_REQUIRE_ESM / infrastructure-error guards see the full output.
  readonly stdout: string;
}

export interface ShimResultSplit {
  readonly code: number;
  // SEPARATE streams (never concatenated). The `--format json|sarif` stdout-purity
  // proof (VER-03) parses ONLY `.stdout`: the shipped bin writes the machine payload
  // to stdout and every advisory notice to stderr, so a stream-merged `stdout` (see
  // {@link runShim}) would glue advisory chatter onto the payload and break
  // `JSON.parse` / `validateSarif`.
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Spawn the installed `.bin/<binName>` shim in `consumerDir` ONCE and return the raw
 * spawnSync result. Shared by {@link runShim} (stream-merged) and {@link runShimSplit}
 * (streams kept separate) so the spawn options are declared in exactly one place.
 * Cross-platform: on Windows the shim is `<binName>.cmd` and `shell: true` is REQUIRED
 * (Node's CVE-2024-27980 fix refuses to spawn a .cmd without a shell) -- safe here
 * because `args` are FIXED (a tsconfig path + flags, never user input). On POSIX the
 * extensionless shim runs directly. `maxBuffer` is 20 MB so a large diagnostic dump
 * never ENOBUFS-truncates the tail `TSxxxx` code.
 *
 * `binName` is intentionally the union `'angular-typechecker' | 'atc'`: the shipped
 * package maps BOTH names to one `./src/cli/bin.js`, and both must be exercised.
 * `label` names the caller in the spawn-failure message.
 */
function spawnShim(
  label: string,
  consumerDir: string,
  binName: 'angular-typechecker' | 'atc',
  args: string[],
  env: NodeJS.ProcessEnv,
): SpawnSyncReturns<string> {
  const isWin = process.platform === 'win32';
  const shim = join(
    consumerDir,
    'node_modules',
    '.bin',
    isWin ? `${binName}.cmd` : binName,
  );

  // On Windows `shell: true` passes the command through cmd.exe, which splits the
  // command line on spaces -- an absolute shim path under a temp dir containing a
  // space would break unless quoted (WR-01). The fixed `args` are relative tsconfig
  // paths + flags (never spaces), so only the shim path itself needs quoting.
  const command = isWin ? `"${shim}"` : shim;

  const result = spawnSync(command, args, {
    cwd: consumerDir,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: isWin,
  });

  // A spawn FAILURE (the shim is missing/unexecutable, or the launcher itself
  // could not start) sets `result.error` with `status === null`. Never fold that
  // into a verdict-shaped code: this harness exists to prove the SHIPPED bin runs,
  // so a broken bin must fail LOUDLY here, not masquerade as exit 1 (a real
  // type-error verdict) with empty output.
  if (result.error) {
    throw new Error(
      `${label}: failed to spawn '${command}': ${result.error.message}`,
    );
  }

  return result;
}

/**
 * Spawn the shipped shim and return its exit code + STREAM-MERGED output. The merged
 * `stdout` is correct for the exit-code + diagnostic-CODE (toContain('TS2322')) +
 * ERR_REQUIRE_ESM / infrastructure-error assertions, which want the full output; use
 * {@link runShimSplit} when the machine payload must be parsed in isolation.
 */
export function runShim(
  consumerDir: string,
  binName: 'angular-typechecker' | 'atc',
  args: string[],
  env: NodeJS.ProcessEnv,
): ShimResult {
  const result = spawnShim('runShim', consumerDir, binName, args, env);

  return {
    // `?? 2` (never 1): a null status with no error means the process was killed
    // by a signal -- infrastructure-class for a type-checker, not a type-error.
    code: result.status ?? 2,
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

/**
 * Spawn the shipped shim and return its exit code with `stdout` and `stderr` kept
 * SEPARATE. `spawnSync` already separates the streams (runShim merely concatenates
 * them), so this exposes them for the `--format json|sarif` stdout-purity proof:
 * `JSON.parse(runShimSplit(...).stdout)` / `validateSarif(runShimSplit(...).stdout)`
 * succeed because the shipped bin writes the machine payload to stdout and advisory
 * notices to stderr, where the stream-merged {@link runShim} would fail.
 */
export function runShimSplit(
  consumerDir: string,
  binName: 'angular-typechecker' | 'atc',
  args: string[],
  env: NodeJS.ProcessEnv,
): ShimResultSplit {
  const result = spawnShim('runShimSplit', consumerDir, binName, args, env);

  return {
    code: result.status ?? 2,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// The clean committed anchor in the fixture component + the broken replacement: a
// `number` field assigned a string literal -> TS2322. Built with JSON.stringify
// (ASCII-only, no quote/apostrophe escaping hazard).
const COMPONENT_ANCHOR =
  "readonly label: string = 'angular-typechecker cli-consumer';";
const COMPONENT_INJECTION = `readonly broken: number = ${JSON.stringify(
  'str',
)};\n  ${COMPONENT_ANCHOR}`;
const PLANTED_CODE = 'TS2322';

/**
 * The shared VER-04 shim exit-code contract, exercised identically by all three CLI
 * package-manager e2e specs (npm / pnpm / yarn). Given a `cli-consumer` fixture already
 * installed in `tmp`, it drives the SHIPPED `.bin` shims and asserts the literal OS exit
 * codes: 0 (clean), 2 (infrastructure -- a nonexistent tsconfig -- AND usage -- an unknown
 * flag / missing required `-c`), and 1 (a planted TS2322 verdict). Both bin names
 * (`angular-typechecker` and `atc`) are exercised, and every RED run also proves the
 * CJS->ESM compiler-cli bridge survived install (no ERR_REQUIRE_ESM / infrastructure error).
 *
 * `env` is the package-manager-specific process env each spec builds (npm/pnpm/yarn differ
 * only there). The planted source is restored in a `finally`, so the fixture is committed-
 * clean again on return -- a caller may safely run its own extras (e.g. the npm baseline's
 * `npx` + multi-tsConfig UNION assertions) after this helper.
 */
export function assertShippedBinExitCodes(
  tmp: string,
  env: NodeJS.ProcessEnv,
): void {
  // Shim-resolution assertion (D-03): the PM linked BOTH bin names into .bin.
  const shimSuffix = process.platform === 'win32' ? '.cmd' : '';
  expect(
    existsSync(
      join(tmp, 'node_modules', '.bin', `angular-typechecker${shimSuffix}`),
    ),
  ).toBe(true);
  expect(
    existsSync(join(tmp, 'node_modules', '.bin', `atc${shimSuffix}`)),
  ).toBe(true);

  // exit 0 -- clean fixture, BOTH bin names.
  const atClean = runShim(
    tmp,
    'angular-typechecker',
    ['-c', 'tsconfig.json'],
    env,
  );
  expect(atClean.code, atClean.stdout).toBe(0);
  const atcClean = runShim(tmp, 'atc', ['-c', 'tsconfig.json'], env);
  expect(atcClean.code, atcClean.stdout).toBe(0);

  // exit 2 -- infrastructure (a nonexistent tsconfig), BOTH bin names. This literal
  // exit 2 is the headline net-new surface (the Nx/ng {success} harness only ever
  // proves 0/1).
  const atInfra = runShim(
    tmp,
    'angular-typechecker',
    ['-c', 'does-not-exist.json'],
    env,
  );
  expect(atInfra.code, atInfra.stdout).toBe(2);
  const atcInfra = runShim(tmp, 'atc', ['-c', 'does-not-exist.json'], env);
  expect(atcInfra.code, atcInfra.stdout).toBe(2);

  // exit 2 -- usage: an unknown flag (`-p`/`--project` is deliberately unregistered,
  // so `--nonsense` is an unknown-flag usage error) AND a missing required `-c`.
  const atcUnknownFlag = runShim(tmp, 'atc', ['--nonsense'], env);
  expect(atcUnknownFlag.code, atcUnknownFlag.stdout).toBe(2);
  const atcMissingC = runShim(tmp, 'atc', [], env);
  expect(atcMissingC.code, atcMissingC.stdout).toBe(2);

  // exit 1 -- a planted diagnostic CODE (TS2322). Assert the CODE, never message
  // text; every RED run also proves the CJS->ESM compiler-cli bridge survived
  // install (no ERR_REQUIRE_ESM) and the non-zero exit is a real diagnostic (no
  // 'infrastructure error'). Restore the committed-clean source in finally.
  const componentPath = join(tmp, 'src', 'app.component.ts');
  const original = readFileSync(componentPath, 'utf8');

  try {
    plant(componentPath, COMPONENT_ANCHOR, COMPONENT_INJECTION);

    const atRed = runShim(
      tmp,
      'angular-typechecker',
      ['-c', 'tsconfig.json'],
      env,
    );
    expect(atRed.code, atRed.stdout).toBe(1);
    expect(atRed.stdout).toContain(PLANTED_CODE);
    expect(atRed.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
    expect(atRed.stdout).not.toContain('infrastructure error');

    const atcRed = runShim(tmp, 'atc', ['-c', 'tsconfig.json'], env);
    expect(atcRed.code, atcRed.stdout).toBe(1);
    expect(atcRed.stdout).toContain(PLANTED_CODE);
    expect(atcRed.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
    expect(atcRed.stdout).not.toContain('infrastructure error');
  } finally {
    writeFileSync(componentPath, original);
  }
}

// The three output formats the shipped CLI accepts (`--format <value>`, default
// `human`). Exit-code PARITY across them for the same input is VER-03's cardinal
// anti-false-pass: a reporter must never change the verdict.
const FORMATS = ['human', 'json', 'sarif'] as const;

// The advisory-notice prefix every `emitAdvisoryNotices` message carries. It belongs
// on stderr (the shipped bin routes notices to stderr and the machine payload to
// stdout), so its presence INSIDE a parsed `--format json|sarif` payload would mean a
// stream leaked. The JSON/SARIF payloads name the tool as `"angular-typechecker"`
// (no trailing colon), so this colon-suffixed token discriminates the notice prefix
// from the legitimate tool name. Exported so the `ng run` / Nx executor e2e adapters
// assert the same payload-purity needle.
export const ADVISORY_NOTICE_PREFIX = 'angular-typechecker:';

/**
 * VER-03 (standalone-CLI adapter): over the already-installed `cli-consumer` fixture,
 * prove the SHIPPED bin emits a parseable JSON + schema-valid SARIF payload with PURE
 * stdout, and returns the IDENTICAL literal exit code across `--format human|json|sarif`
 * for the same input -- both the clean run (0) and a planted TS2322 (1). Reuses the
 * `runShimSplit` stream-split (parse ONLY `.stdout`) and the shared `validateSarif`
 * dev-only 2.1.0 validator (`@workspace/test-util`, created in 32-01).
 *
 * The planted source is restored in a `finally`, so the fixture is committed-clean on
 * return (mirrors {@link assertShippedBinExitCodes}); call this ALONGSIDE that helper,
 * do not fork it.
 */
export function assertMachineFormatParity(
  tmp: string,
  env: NodeJS.ProcessEnv,
): void {
  // CLEAN fixture: exit-code parity 0 across all three formats; the machine payloads
  // parse cleanly from stdout ALONE (purity) and the SARIF is schema-valid.
  for (const format of FORMATS) {
    const clean = runShimSplit(
      tmp,
      'angular-typechecker',
      ['-c', 'tsconfig.json', '--format', format],
      env,
    );
    expect(clean.code, `clean --format ${format}: ${clean.stderr}`).toBe(0);

    if (format === 'json') {
      // stdout-purity: parses from `.stdout` alone (the stream-merged runShim would
      // fail here if any advisory chatter were present on stderr).
      expect(() => JSON.parse(clean.stdout) as unknown).not.toThrow();
      expect(clean.stdout).not.toContain(ADVISORY_NOTICE_PREFIX);
    }

    if (format === 'sarif') {
      const { valid, errors } = validateSarif(clean.stdout);
      expect(valid, errors).toBe(true);
      expect(clean.stdout).not.toContain(ADVISORY_NOTICE_PREFIX);
    }
  }

  // PLANTED TS2322: exit-code parity 1 across all three formats (the anti-false-pass
  // -- a machine format must never mask a verdict-fail), and the payloads still
  // parse/validate with a `success: false` verdict carried as DATA.
  const componentPath = join(tmp, 'src', 'app.component.ts');
  const original = readFileSync(componentPath, 'utf8');

  try {
    plant(componentPath, COMPONENT_ANCHOR, COMPONENT_INJECTION);

    for (const format of FORMATS) {
      const red = runShimSplit(
        tmp,
        'angular-typechecker',
        ['-c', 'tsconfig.json', '--format', format],
        env,
      );
      expect(red.code, `planted --format ${format}: ${red.stderr}`).toBe(1);

      if (format === 'json') {
        const payload = JSON.parse(red.stdout) as {
          summary: { success: boolean };
        };
        expect(payload.summary.success).toBe(false);
        expect(red.stdout).not.toContain(ADVISORY_NOTICE_PREFIX);
      }

      if (format === 'sarif') {
        const { valid, errors } = validateSarif(red.stdout);
        expect(valid, errors).toBe(true);
        expect(red.stdout).not.toContain(ADVISORY_NOTICE_PREFIX);
      }
    }
  } finally {
    writeFileSync(componentPath, original);
  }
}
