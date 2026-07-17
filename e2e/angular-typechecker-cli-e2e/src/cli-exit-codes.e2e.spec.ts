import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  assertShippedBinExitCodes,
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  runShim,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// VER-04 (npm baseline): prove the SHIPPED standalone-CLI bins -- installed BY NAME
// from the local Verdaccio publish with npm -- return the literal OS exit codes
// 0/1/2 through the real package-manager-generated `.bin` shim, for BOTH bin names
// (`angular-typechecker` and `atc`) plus the safe `npx angular-typechecker` path.
// The net-new surface vs the existing Nx/ng `{success}` (0/1) harness is (1) literal
// exit 2 -- infrastructure (a nonexistent tsconfig) AND usage (an unknown flag /
// missing required -c) -- and (2) the `.bin` shim path itself (never `node bin.js`).
// The bin behavior is FROZEN (Phases 25-27); this spec only OBSERVES it end-to-end.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the
// shared globalSetup (which builds dist + publishes to local Verdaccio ONCE); this
// spec CONSUMES that registry via inject() and installs by-name (NOT a packed .tgz --
// sidesteps the Windows tar drive-letter gotcha).

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-cli-e2e',
  'fixtures',
  'cli-consumer',
);

// stripAllNpmConfig is load-bearing: the shared globalSetup sets npm_config_registry
// process-wide (inherited by this singleFork worker) and it would outrank the tmp
// .npmrc and retarget the install away from local Verdaccio (T-28-06).
const env = buildCleanEnv({ stripAllNpmConfig: true });

// The SAFE npx invocation: `npx angular-typechecker` resolves the locally installed
// bin (the package name matches a bin name), so it never fetches anything. The `atc`
// alias is NEVER driven through npx (that would fetch the unrelated published
// atc@0.0.6 -- a supply-chain hazard, T-28-03; the `atc` bin is exercised only via
// its installed `.bin` shim, by path, through runShim). execSync throws on a non-zero
// exit, so read error.status in the catch to distinguish 0 from 2 (fixed command + args).
function runNpx(
  args: string[],
  cwd: string,
  runEnv: NodeJS.ProcessEnv,
): { code: number; stdout: string } {
  try {
    const stdout = execSync(`npx angular-typechecker ${args.join(' ')}`, {
      cwd,
      env: runEnv,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}

describe('VER-04 (npm): the shipped angular-typechecker / atc bins return literal 0/1/2 through the .bin shim', () => {
  it('installs by name from Verdaccio and both bins + npx angular-typechecker return the expected exit codes', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Re-assert the globalSetup SAFETY invariant (D-02, T-28-02): this install reads
    // from local Verdaccio pinned to the numeric IPv4 loopback.
    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-cli-npm-'));

    try {
      cpSync(fixtureDir, tmp, { recursive: true });

      // Point npm at Verdaccio (registry + minted bearer). Written to the tmp copy
      // ONLY -- never committed into the fixture.
      writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

      // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot leak
      // a registry / peer override into the nested install (T-28-06).
      const npmEnv = {
        ...env,
        npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
      };

      // Provision the fixture's Angular 22 peers (from the committed lockfile, via
      // Verdaccio's npmjs uplink) then install the SHIPPED package BY NAME from the
      // local publish (D-02).
      sh('npm install --no-audit --no-fund --prefer-offline', {
        cwd: tmp,
        env: npmEnv,
      });
      sh(
        'npm install angular-typechecker --no-audit --no-fund --prefer-offline',
        {
          cwd: tmp,
          env: npmEnv,
        },
      );

      // Prove the shared shim exit-code contract (0 clean / 2 infra+usage / 1 planted
      // TS2322) for BOTH bin names. The helper restores the committed-clean fixture in
      // its finally, so the npm-only extras below run against a clean tree again.
      assertShippedBinExitCodes(tmp, npmEnv);

      // npm-only extras (kept inline). The safe `npx angular-typechecker` path for the
      // clean (0) and infrastructure (2) cases: `npx angular-typechecker` resolves the
      // locally installed bin (never fetching), whereas `atc` is never driven through
      // npx (that would fetch the unrelated published atc@0.0.6, a supply-chain hazard).
      expect(runNpx(['-c', 'tsconfig.json'], tmp, npmEnv).code).toBe(0);
      expect(runNpx(['-c', 'does-not-exist.json'], tmp, npmEnv).code).toBe(2);

      // exit 0 -- multi-tsConfig UNION: two or more `-c` inputs take run()'s
      // string[] union path (a single `-c` takes the string / solution-walk path).
      // This exercises the fixture's clean SECOND leaf (tsconfig.spec.json ->
      // app.component.spec.ts) through the SHIPPED shim -- the union path is
      // otherwise only covered in-process (VER-01/VER-02, Phase 26), never
      // end-to-end through the real `.bin` shim.
      const atUnion = runShim(
        tmp,
        'angular-typechecker',
        ['-c', 'tsconfig.json', '-c', 'tsconfig.spec.json'],
        npmEnv,
      );
      expect(atUnion.code, atUnion.stdout).toBe(0);
    } finally {
      removeTmpDir(tmp);
    }
  }, 600000);
});
