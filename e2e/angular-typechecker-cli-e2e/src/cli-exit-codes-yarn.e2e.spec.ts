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
  buildCleanEnv,
  commandSucceeds,
  findWorkspaceRoot,
  plant,
  removeTmpDir,
  runShim,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// VER-04 (yarn): prove the SHIPPED standalone-CLI bins -- installed BY NAME from the
// local Verdaccio publish with yarn 4 (corepack), in BOTH the flat layout (single
// package.json, no `workspaces` field) and the yarn-workspace layout (root
// `workspaces: ['projects/*']`, so yarn resolves through its node-modules workspace
// linker) -- return the literal OS exit codes 0/1/2 through the real
// package-manager-generated `.bin` shim, for BOTH bin names (`angular-typechecker`
// and `atc`). This is the yarn analogue of the npm baseline (cli-exit-codes.e2e.spec.ts)
// and fills the CLI x yarn x {flat, workspace} cells of the VER-04 PM matrix (D-03).
//
// The bin behavior is FROZEN (Phases 25-27); this spec only OBSERVES it end-to-end
// through the yarn shim. yarn 4 is delivered via corepack, pinned to one literal, and
// the cell skips cleanly where corepack yarn is unavailable.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the
// shared globalSetup (build + publish ONCE); this spec CONSUMES that registry via
// inject() and installs by-name (NOT a packed .tgz -- sidesteps the Windows/MSYS tar
// drive-letter gotcha).

const YARN_VERSION = '4.17.0';

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
// (which would otherwise outrank the tmp .npmrc). yarn 4 reads its registry from
// .yarnrc.yml, so the strip does not affect yarn's Verdaccio targeting (T-28-06).
const env = buildCleanEnv({ stripAllNpmConfig: true });

const isWin = process.platform === 'win32';

// Availability guard: yarn 4 is corepack-delivered, so probe ACTUAL provisioning of the
// pinned version (a host with corepack but no network to fetch it skips cleanly).
const corepackAvailable = commandSucceeds(
  `corepack yarn@${YARN_VERSION} --version`,
  { cwd: workspaceRoot, env },
);

// The clean committed anchor in the fixture component + the broken replacement: a
// `number` field assigned a string literal -> TS2322. Built with JSON.stringify
// (ASCII-only, no quote/apostrophe escaping hazard). Mirrors the npm baseline.
const COMPONENT_ANCHOR =
  "readonly label: string = 'angular-typechecker cli-consumer';";
const COMPONENT_INJECTION = `readonly broken: number = ${JSON.stringify(
  'str',
)};\n  ${COMPONENT_ANCHOR}`;
const PLANTED_CODE = 'TS2322';

// Make the tmp copy a real yarn 4 workspace at local Verdaccio. `layout: 'workspace'`
// adds the root `workspaces: ['projects/*']` field so yarn treats it as a workspace
// root and links through its node-modules workspace resolver (the cli-consumer ships
// no `projects/` members, but the layout still exercises the workspace linker path).
function setupYarnWorkspace(
  tmp: string,
  verdaccioUrl: string,
  verdaccioToken: string,
  layout: 'flat' | 'workspace',
): void {
  // The committed fixture ships an npm lockfile; drop it so yarn.lock +
  // packageManager: yarn become the authoritative package-manager signal.
  if (existsSync(join(tmp, 'package-lock.json'))) {
    rmSync(join(tmp, 'package-lock.json'), { force: true });
  }

  const packageJsonPath = join(tmp, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    packageManager?: string;
    workspaces?: string[];
  };
  packageJson.packageManager = `yarn@${YARN_VERSION}`;

  if (layout === 'workspace') {
    packageJson.workspaces = ['projects/*'];
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  // yarn 4 config (mirrors ng-add-ng-run-yarn.e2e.spec.ts, all load-bearing):
  // nodeLinker node-modules (real tree for the .bin shim + require()); npmRegistryServer
  // / npmAuthToken (yarn 4 auth form); unsafeHttpWhitelist 127.0.0.1 (yarn blocks http by
  // default); npmMinimalAgeGate 0 (yarn quarantines the seconds-old Verdaccio publish
  // otherwise); enableImmutableInstalls false (yarn auto-enables immutable under CI env);
  // per-fixture cacheFolder + enableGlobalCache false so the LOCAL published dist is used;
  // enableMirror false is LOAD-BEARING (the CLI-YARN root cause) -- with the default
  // enableMirror: true, yarn serves a package from the global mirror BY LOCATOR without
  // re-verifying against the resolved registry, so a stale public-npm same-version copy
  // could shadow the fresh Verdaccio dist. Disabling the mirror forces a fresh download.
  const yarnrc = [
    'nodeLinker: node-modules',
    `npmRegistryServer: "${verdaccioUrl}"`,
    `npmAuthToken: "${verdaccioToken}"`,
    'unsafeHttpWhitelist:',
    '  - 127.0.0.1',
    'npmMinimalAgeGate: 0',
    'enableTelemetry: false',
    'enableImmutableInstalls: false',
    'cacheFolder: ./.yarn/cache',
    'enableGlobalCache: false',
    'enableMirror: false',
    '',
  ].join('\n');
  writeFileSync(join(tmp, '.yarnrc.yml'), yarnrc);

  // yarn's registry comes from .yarnrc.yml, but write the Verdaccio .npmrc too so any
  // npm-based metadata read stays pinned to the local registry (never committed into
  // the fixture -- tmp copy only).
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
}

describe('VER-04 (yarn): the shipped angular-typechecker / atc bins return literal 0/1/2 through the .bin shim', () => {
  it.skipIf(!corepackAvailable).each(['flat', 'workspace'] as const)(
    'installs by name with yarn 4 and both bins return the expected exit codes -- %s layout',
    (layout) => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      // Re-assert the globalSetup SAFETY invariant (D-02, T-28-02): this install reads
      // from local Verdaccio pinned to the numeric IPv4 loopback.
      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), `atc-cli-yarn-${layout}-`));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });
        setupYarnWorkspace(tmp, verdaccioUrl, verdaccioToken, layout);

        // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot leak a
        // registry/peer override into any npm-based metadata read (T-28-06).
        const npmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // corepack enable puts the pinned yarn shim on PATH; install the fixture deps
        // (real yarn.lock via the node-modules linker), then install the SHIPPED package
        // BY NAME from Verdaccio (D-02). `nx` comes in transitively (Plan 24-04's direct
        // dependency); the standalone CLI never loads it at runtime (proven by the
        // nx-free-runtime probe).
        sh('corepack enable', { cwd: tmp, env: npmEnv });
        sh('corepack yarn install', { cwd: tmp, env: npmEnv });
        sh('corepack yarn add -D angular-typechecker', {
          cwd: tmp,
          env: npmEnv,
        });

        // Shim-resolution assertion (D-03): the yarn node-modules linker linked BOTH bin
        // names into .bin.
        const shimSuffix = isWin ? '.cmd' : '';
        expect(
          existsSync(
            join(
              tmp,
              'node_modules',
              '.bin',
              `angular-typechecker${shimSuffix}`,
            ),
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
          npmEnv,
        );
        expect(atClean.code, atClean.stdout).toBe(0);
        const atcClean = runShim(tmp, 'atc', ['-c', 'tsconfig.json'], npmEnv);
        expect(atcClean.code, atcClean.stdout).toBe(0);

        // exit 2 -- infrastructure (a nonexistent tsconfig), BOTH bin names. This literal
        // exit 2 is the headline net-new surface (the Nx/ng {success} harness only ever
        // proves 0/1).
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

        // exit 2 -- usage: an unknown flag (`-p`/`--project` is deliberately unregistered,
        // so `--nonsense` is an unknown-flag usage error) AND a missing required `-c`.
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
    },
    900000,
  );
});
