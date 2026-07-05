import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  sh,
} from '@workspace/test-util';

// NX-ADD-YARN: the REAL `nx add angular-typechecker` on a yarn 4 (berry) workspace
// at local Verdaccio -- NOT the `nx g angular-typechecker:init` substitute. yarn 4
// runs build scripts by default (no pnpm-style gate), so the real `nx add` is
// expected to SUCCEED: nx detects yarn berry -> `yarn add -D angular-typechecker`
// (no @latest suffix; berry resolves the dist-tag) -> on success runs the internal
// `g angular-typechecker:init`, which seeds the WALK-02 typecheck targetDefaults.
//
// yarn 4 is delivered via corepack (NOT the `yarn` npm dist-tag, which is classic
// 1.x). corepack is required, and `corepack enable` is what puts the bare `yarn`
// shim on PATH so nx add's child `yarn add` resolves. A per-fixture cache
// (cacheFolder + enableGlobalCache:false) proves the LOCAL published dist is used,
// not a globally-cached npmjs copy. Runs SEQUENTIALLY on the main tree under the
// serialized vitest.config.mts + the shared globalSetup; consumes that registry
// via inject(). Skips cleanly when corepack/yarn is unavailable.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-generator',
);

// stripAllNpmConfig strips the process-wide npm_config_registry the globalSetup
// set plus the NX_* runner vars. yarn 4 reads its registry from .yarnrc.yml, not
// npm config, but the strip keeps the nested nx invocations clean.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Availability guard: yarn 4 is corepack-delivered, so probe corepack.
function isAvailable(command: string): boolean {
  try {
    sh(command, { cwd: workspaceRoot, env });

    return true;
  } catch {
    return false;
  }
}

const corepackAvailable = isAvailable('corepack --version');

describe('NX-ADD-YARN: real `nx add` on a yarn 4 workspace seeds the typecheck targetDefaults', () => {
  it.skipIf(!corepackAvailable)(
    'runs `corepack yarn nx add angular-typechecker` at local Verdaccio and init seeds the WALK-02 cache block',
    () => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      expect(verdaccioUrl.startsWith('http://localhost:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), 'atc-add-yarn-'));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });

        // Make it a REAL yarn 4 workspace (corepack routes to the pinned version).
        const packageJsonPath = join(tmp, 'package.json');
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf8'),
        ) as { packageManager?: string };
        packageJson.packageManager = 'yarn@4.17.0';
        writeFileSync(
          packageJsonPath,
          `${JSON.stringify(packageJson, null, 2)}\n`,
        );

        // yarn 4 auth + http gate + freshness gate + local-dist cache purity (all
        // load-bearing):
        // nodeLinker node-modules (a real tree for the nx executor + require());
        // npmRegistryServer/npmAuthToken (yarn 4 auth form, NOT .npmrc);
        // unsafeHttpWhitelist localhost (yarn 4 blocks http by default -> YN0081);
        // npmMinimalAgeGate 0 (OBSERVED: yarn 4 defaults to 1440 minutes and
        //   QUARANTINES the seconds-old Verdaccio-published version -> YN0016
        //   "version for tag latest is quarantined"; 0 lifts the age gate for this
        //   local test registry);
        // enableImmutableInstalls false (yarn auto-enables immutable under CI env);
        // per-fixture cache so the LOCAL published dist is used, not a cached copy.
        const yarnrc = [
          'nodeLinker: node-modules',
          `npmRegistryServer: "${verdaccioUrl}"`,
          `npmAuthToken: "${verdaccioToken}"`,
          'unsafeHttpWhitelist:',
          '  - localhost',
          'npmMinimalAgeGate: 0',
          'enableTelemetry: false',
          'enableImmutableInstalls: false',
          'cacheFolder: ./.yarn/cache',
          'enableGlobalCache: false',
          '',
        ].join('\n');
        writeFileSync(join(tmp, '.yarnrc.yml'), yarnrc);

        // Seeded-from-absent BASELINE (parity with the npm spec): the key must be
        // undefined BEFORE `nx add` so the post-assert is non-vacuous.
        const before = JSON.parse(
          readFileSync(join(tmp, 'nx.json'), 'utf8'),
        ) as {
          targetDefaults?: Record<string, unknown>;
        };
        expect(
          before.targetDefaults?.['angular-typechecker:typecheck'],
        ).toBeUndefined();

        // Put the bare `yarn` shim on PATH (corepack's sanctioned install) so nx
        // add's child `yarn add` resolves, then provision node_modules + the nx
        // binary + yarn.lock (so detectPackageManager -> yarn).
        // NOTE (hygiene): `corepack enable` is a MACHINE-GLOBAL mutation -- it
        // installs the yarn/pnpm shims into the active Node bin dir and there is
        // no `corepack disable` teardown. Harmless + expected on an ephemeral CI
        // runner; on a local dev machine it leaves corepack enabled afterward. We
        // deliberately do NOT `corepack disable` in a finally -- that would clobber
        // a developer's pre-existing corepack setup, a worse side effect than
        // leaving it on.
        sh('corepack enable', { cwd: tmp, env });
        sh('corepack yarn install', { cwd: tmp, env });

        // The REAL command: nx detects yarn berry -> `yarn add -D
        // angular-typechecker` -> resolves the dist-tag from Verdaccio -> init.
        sh('corepack yarn nx add angular-typechecker', {
          cwd: tmp,
          env,
        });

        // init SEEDED the key (absent -> present, WALK-02 shape).
        const nxJson = JSON.parse(
          readFileSync(join(tmp, 'nx.json'), 'utf8'),
        ) as {
          targetDefaults?: Record<
            string,
            { cache?: boolean; outputs?: unknown[]; inputs?: unknown[] }
          >;
        };
        const seeded = nxJson.targetDefaults?.['angular-typechecker:typecheck'];
        expect(seeded).toBeDefined();
        expect(seeded?.cache).toBe(true);
        expect(seeded?.outputs).toEqual([]);
        expect(seeded?.inputs?.[0]).toBe('default');
      } finally {
        removeTmpDir(tmp);
      }
    },
    300000,
  );
});
