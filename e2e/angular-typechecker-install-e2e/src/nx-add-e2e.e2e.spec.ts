import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildCleanEnv,
  expectSeededTypecheckTargetDefault,
  findWorkspaceRoot,
  readTypecheckTargetDefault,
  removeTmpDir,
  sh,
} from '@workspace/test-util';

// GE2E-03 (Phase 15): prove `nx add angular-typechecker`'s install-time init path
// seeds the nx.json targetDefaults FROM ABSENT against the freshly-packed tarball.
//
// WHY THIS IS THE FAITHFUL OFFLINE PROOF, NOT A SHORTCUT (Finding 1, traced
// against nx 23.0.1 source): `nx add <bare-name>` splits the specifier on the last
// `@`, resolving `angular-typechecker@latest` from the REGISTRY -- it would install
// the REAL published version (wrong artifact) and needs network, so it cannot
// target the local tarball under test. But `nx add`'s init step is
// `configure-plugins.js` `runPluginInitGenerator`, which constructs the command
// VERBATIM as `g <plugin>:init` (a hardcoded `<plugin>:init`, discovered purely via
// the installed package's `generators` field -- no `ng-add` alias needed). So the
// deterministic, offline, board-aligned proof of GEN-09 is: place the package
// exactly as `nx add`'s installPackage step would (here from the local tarball) and
// run the byte-identical internal command `npx nx g angular-typechecker:init`. We
// do NOT ship an Angular-CLI `ng add` surface (GEN-FUT-02 stays deferred). Runs
// SEQUENTIALLY on the main tree (D-22); real npm pack/install + nested nx are
// worktree-hostile.

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so every path
// is cwd-independent (D-17 main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-generator',
);

// Nested-nx isolation + B-03 honesty: the shared buildCleanEnv strips the outer
// runner's NX_* vars, sets NX_DAEMON=false + FORCE_COLOR=0, and
// (stripAllNpmConfig) strips EVERY npm_config_* -- REQUIRED because the shared
// globalSetup's startLocalRegistry sets npm_config_registry process-wide
// (inherited by this singleFork worker); an inherited registry would outrank the
// tmp .npmrc and resolve the consumer install through Verdaccio's proxy instead
// of npmjs. Stripping all npm_config_* also drops the legacy-peer-deps override
// so a leaked one cannot MASK a real consumer ERESOLVE (B-03 honesty).
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';
// A per-spec OS-temp dir the tarball is packed INTO so dist stays read-only during
// e2e and no sibling e2e project shares the tarball path.
let packDest = '';

beforeAll(() => {
  // dist is built ONCE upstream by the e2e target's dependsOn (read-only during
  // e2e); pack it into a per-spec OS-temp dir so no sibling e2e project shares the
  // tarball path. `npm pack --json --pack-destination <dir>` writes the .tgz into
  // <dir> (the EXACT artifact `nx release publish` ships) and reports the bare
  // filename; cwd stays distDir so pack reads the dist package.
  packDest = mkdtempSync(join(tmpdir(), 'atc-pack-nxadd-'));
  const packOutput = execSync(
    `npm pack --json --pack-destination "${packDest}"`,
    {
      cwd: distDir,
      env,
      encoding: 'utf8',
    },
  );
  const packed = JSON.parse(packOutput) as Array<{ filename: string }>;
  tarballPath = join(packDest, packed[0].filename);
}, 300000);

afterAll(() => {
  // Remove the per-spec pack dir (the .tgz lives under it) so each run leaks no
  // artifact (WR-02). force:true keeps teardown non-fatal if it is already gone.
  if (packDest) {
    rmSync(packDest, { recursive: true, force: true });
  }
});

describe("GE2E-03: nx add's init path seeds nx.json targetDefaults from absent", () => {
  it('installs the tarball, runs the internal `nx g angular-typechecker:init`, and seeds the WALK-02 cache block', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'atc-add-'));

    try {
      // Fresh tmp copy of the un-wired consumer-generator fixture (its nx.json has
      // NO angular-typechecker:typecheck targetDefaults key -- D-02).
      cpSync(fixtureDir, tmp, { recursive: true });
      writeFileSync(join(tmp, '.npmrc'), '');

      // Seeded-from-absent BASELINE: the key must be undefined BEFORE init, so the
      // post-init assertion is non-vacuous (Pitfall 5 -- a pre-declared key would
      // make init's whole-entry ??= skip seeding and pass for the wrong reason).
      expect(readTypecheckTargetDefault(tmp)).toBeUndefined();

      // Place the package exactly as `nx add`'s installPackage step would after a
      // registry fetch -- here from the local tarball (deterministic + offline for
      // the package under test; the fixture's Angular/Nx/TS deps still resolve from
      // the registry, like every existing install-e2e spec). NO peer-override flag
      // (B-03): a real ERESOLVE must surface, not be masked.
      sh(
        `npm install ${JSON.stringify(tarballPath)} --no-audit --no-fund --prefer-offline`,
        {
          cwd: tmp,
          env: {
            ...env,
            npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
          },
        },
      );

      // Run the SAME init generator `nx add`'s runPluginInitGenerator constructs
      // (`g <plugin>:init`). This resolves the installed package's generators.json
      // `init` entry -- the load-bearing half of GEN-09. --skipFormat: the fixture
      // installs no Prettier.
      sh('npx nx g angular-typechecker:init --skipFormat', {
        cwd: tmp,
        env,
      });

      // init SEEDED the key (absent -> present, WALK-02 shape).
      expectSeededTypecheckTargetDefault(tmp);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
