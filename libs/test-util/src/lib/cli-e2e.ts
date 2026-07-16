import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

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

/**
 * Spawn the installed `.bin/<binName>` shim in `consumerDir` and capture its literal
 * exit code + combined output. Cross-platform: on Windows the shim is `<binName>.cmd`
 * and `shell: true` is REQUIRED (Node's CVE-2024-27980 fix refuses to spawn a .cmd
 * without a shell) -- safe here because `args` are FIXED (a tsconfig path + flags,
 * never user input). On POSIX the extensionless shim runs directly. `maxBuffer` is
 * 20 MB so a large diagnostic dump never ENOBUFS-truncates the tail `TSxxxx` code
 * (matches createNgRun / bin.ts is flush-safe by not calling process.exit).
 *
 * `binName` is intentionally the union `'angular-typechecker' | 'atc'`: the shipped
 * package maps BOTH names to one `./src/cli/bin.js`, and both must be exercised.
 */
export function runShim(
  consumerDir: string,
  binName: 'angular-typechecker' | 'atc',
  args: string[],
  env: NodeJS.ProcessEnv,
): ShimResult {
  const isWin = process.platform === 'win32';
  const shim = join(
    consumerDir,
    'node_modules',
    '.bin',
    isWin ? `${binName}.cmd` : binName,
  );

  const result = spawnSync(shim, args, {
    cwd: consumerDir,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: isWin,
  });

  return {
    code: result.status ?? 1,
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}
