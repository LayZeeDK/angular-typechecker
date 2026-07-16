import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  plant,
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

const isWin = process.platform === 'win32';

// The clean committed anchor in the fixture component + the broken replacement: a
// `number` field assigned a string literal -> TS2322. Built with JSON.stringify
// (ASCII-only, no quote/apostrophe escaping hazard).
const COMPONENT_ANCHOR =
  "readonly label: string = 'angular-typechecker cli-consumer';";
const COMPONENT_INJECTION = `readonly broken: number = ${JSON.stringify(
  'str',
)};\n  ${COMPONENT_ANCHOR}`;
const PLANTED_CODE = 'TS2322';

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
      sh('npm install angular-typechecker --no-audit --no-fund --prefer-offline', {
        cwd: tmp,
        env: npmEnv,
      });

      // Shim-resolution assertion (D-03): the PM linked BOTH bin names into .bin.
      const shimSuffix = isWin ? '.cmd' : '';
      expect(
        existsSync(
          join(tmp, 'node_modules', '.bin', `angular-typechecker${shimSuffix}`),
        ),
      ).toBe(true);
      expect(
        existsSync(join(tmp, 'node_modules', '.bin', `atc${shimSuffix}`)),
      ).toBe(true);

      // exit 0 -- clean fixture, BOTH bin names + the safe npx path.
      const atClean = runShim(
        tmp,
        'angular-typechecker',
        ['-c', 'tsconfig.json'],
        npmEnv,
      );
      expect(atClean.code, atClean.stdout).toBe(0);
      const atcClean = runShim(tmp, 'atc', ['-c', 'tsconfig.json'], npmEnv);
      expect(atcClean.code, atcClean.stdout).toBe(0);
      expect(runNpx(['-c', 'tsconfig.json'], tmp, npmEnv).code).toBe(0);

      // exit 2 -- infrastructure (a nonexistent tsconfig), BOTH bin names. This
      // literal exit 2 is the headline net-new surface (the Nx/ng {success} harness
      // only ever proves 0/1).
      const atInfra = runShim(
        tmp,
        'angular-typechecker',
        ['-c', 'does-not-exist.json'],
        npmEnv,
      );
      expect(atInfra.code, atInfra.stdout).toBe(2);
      const atcInfra = runShim(
        tmp,
        'atc',
        ['-c', 'does-not-exist.json'],
        npmEnv,
      );
      expect(atcInfra.code, atcInfra.stdout).toBe(2);
      expect(runNpx(['-c', 'does-not-exist.json'], tmp, npmEnv).code).toBe(2);

      // exit 2 -- usage: an unknown flag (`-p`/`--project` is deliberately
      // unregistered, so `--nonsense` is an unknown-flag usage error) AND a missing
      // required `-c`. Both surface as usage errors on the atc bin.
      const atcUnknownFlag = runShim(tmp, 'atc', ['--nonsense'], npmEnv);
      expect(atcUnknownFlag.code, atcUnknownFlag.stdout).toBe(2);
      const atcMissingC = runShim(tmp, 'atc', [], npmEnv);
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
          npmEnv,
        );
        expect(atRed.code, atRed.stdout).toBe(1);
        expect(atRed.stdout).toContain(PLANTED_CODE);
        expect(atRed.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(atRed.stdout).not.toContain('infrastructure error');

        const atcRed = runShim(tmp, 'atc', ['-c', 'tsconfig.json'], npmEnv);
        expect(atcRed.code, atcRed.stdout).toBe(1);
        expect(atcRed.stdout).toContain(PLANTED_CODE);
        expect(atcRed.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(atcRed.stdout).not.toContain('infrastructure error');
      } finally {
        writeFileSync(componentPath, original);
      }
    } finally {
      removeTmpDir(tmp);
    }
  }, 600000);
});
