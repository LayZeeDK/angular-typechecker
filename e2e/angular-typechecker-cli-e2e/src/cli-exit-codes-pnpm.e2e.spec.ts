import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  assertShippedBinExitCodes,
  buildCleanEnv,
  commandSucceeds,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// VER-04 (pnpm): prove the SHIPPED standalone-CLI bins -- installed BY NAME from the
// local Verdaccio publish with pnpm (the symlinked node_modules layout) -- return the
// literal OS exit codes 0/1/2 through the real package-manager-generated `.bin` shim,
// for BOTH bin names (`angular-typechecker` and `atc`). This is the pnpm analogue of
// the npm baseline (cli-exit-codes.e2e.spec.ts) and fills the CLI x pnpm cell of the
// VER-04 PM matrix (D-03).
//
// The bin behavior is FROZEN (Phases 25-27); this spec only OBSERVES it end-to-end
// through the pnpm shim. Skips cleanly where pnpm is unavailable.
//
// WHY strictDepBuilds: false (a pnpm <-> install INTERACTION, NOT an angular-typechecker
// defect): pnpm 11's build-script gate (strictDepBuilds, default true) makes any
// `pnpm add`/`pnpm install` exit non-zero (ERR_PNPM_IGNORED_BUILDS) when a dependency
// carries an unapproved build/postinstall script. Installing angular-typechecker pulls
// `nx` transitively, whose postinstall the gate would flag (npm itself warns + skips it
// -- see the npm baseline's allow-scripts warning). pnpm reads this build-gate setting
// from pnpm-workspace.yaml (NOT .npmrc) in pnpm 11, mirroring the CI-authoritative
// ng-add-ng-run-pnpm posture: skip ALL build scripts (the SAFEST posture -- runs zero
// postinstall code, more restrictive than an allowBuilds allowlist). This e2e only needs
// the wiring + a `.bin` shim run, none of the native postinstall artifacts.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the shared
// globalSetup (build + publish ONCE); this spec CONSUMES that registry via inject() and
// installs by-name (NOT a packed .tgz -- sidesteps the Windows/MSYS tar drive-letter
// gotcha).

// keep in sync with ci.yml pnpm/action-setup version
const PNPM_VERSION = '11.9.0';

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

// stripAllNpmConfig strips the process-wide npm_config_registry the globalSetup set
// (which pnpm would otherwise honor over the fixture .npmrc) plus the NX_* runner vars.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Availability guard: probe pnpm reachability so a host without pnpm skips cleanly
// (CI provisions pnpm 11.9.0 on PATH via pnpm/action-setup).
const pnpmAvailable = commandSucceeds('pnpm --version', {
  cwd: workspaceRoot,
  env,
});

describe('VER-04 (pnpm): the shipped angular-typechecker / atc bins return literal 0/1/2 through the .bin shim', () => {
  it.skipIf(!pnpmAvailable)(
    'installs by name with pnpm and both bins return the expected exit codes',
    () => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      // Re-assert the globalSetup SAFETY invariant (D-02, T-28-02): this install reads
      // from local Verdaccio pinned to the numeric IPv4 loopback.
      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), 'atc-cli-pnpm-'));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });

        // The committed fixture ships an npm lockfile; drop it so pnpm-lock.yaml +
        // packageManager: pnpm become the authoritative package-manager signal.
        if (existsSync(join(tmp, 'package-lock.json'))) {
          rmSync(join(tmp, 'package-lock.json'), { force: true });
        }

        // strictDepBuilds: false disables pnpm 11's build-script gate (see the header
        // note). pnpm reads it from pnpm-workspace.yaml; `- '.'` makes the root the sole
        // workspace member (no name-collision concern here -- the CLI is nx-free and reads
        // a tsconfig path directly, so there is no angular.json project-name inference).
        writeFileSync(
          join(tmp, 'pnpm-workspace.yaml'),
          "packages:\n  - '.'\nstrictDepBuilds: false\n",
        );

        // Pin packageManager to pnpm 11 so pnpm self-routes to the gated major CI
        // provisions (a host PATH pnpm may be a 9.x shim); matches ng-add-ng-run-pnpm.
        const packageJsonPath = join(tmp, 'package.json');
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf8'),
        ) as { packageManager?: string };
        packageJson.packageManager = `pnpm@${PNPM_VERSION}`;
        writeFileSync(
          packageJsonPath,
          `${JSON.stringify(packageJson, null, 2)}\n`,
        );

        // Point pnpm at Verdaccio (registry + minted bearer via the nerf-dart auth line).
        // pnpm reads .npmrc natively; http localhost is fine for pnpm.
        writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

        // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot leak a
        // registry/peer override into the nested install (T-28-06).
        const pnpmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // Provision the fixture peers, then install the SHIPPED package BY NAME from the
        // local publish (D-02). With strictDepBuilds: false the build-script gate is
        // disabled, so these exit 0. `nx` comes in transitively; the standalone CLI never
        // loads it at runtime (proven by the nx-free-runtime probe).
        sh('pnpm install --prefer-offline', { cwd: tmp, env: pnpmEnv });
        sh('pnpm add -D angular-typechecker --prefer-offline', {
          cwd: tmp,
          env: pnpmEnv,
        });

        // Prove the shared shim exit-code contract (0 clean / 2 infra+usage / 1 planted
        // TS2322) for BOTH bin names through the pnpm symlinked .bin layout. The helper
        // restores the committed-clean fixture in its finally.
        assertShippedBinExitCodes(tmp, pnpmEnv);
      } finally {
        removeTmpDir(tmp);
      }
    },
    900000,
  );
});
