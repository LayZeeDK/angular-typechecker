import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  commandSucceeds,
  expectSeededTypecheckTargetDefault,
  findWorkspaceRoot,
  readTypecheckTargetDefault,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// NX-ADD-PNPM: the REAL `nx add angular-typechecker` on a pnpm 11 workspace at
// local Verdaccio -- NOT the `nx g angular-typechecker:init` substitute. Like the
// npm and yarn specs, this asserts the SUCCESS path: nx add resolves the package,
// its child install exits 0, and init seeds the typecheck targetDefaults.
//
// WHY A WORKAROUND IS NEEDED ON pnpm (a pnpm <-> nx-add INTERACTION, NOT an
// angular-typechecker defect):
//   Out of the box, `nx add angular-typechecker` FAILS on a build-hardened pnpm
//   workspace. nx add runs a hardcoded child `pnpm add -Dw angular-typechecker@latest`
//   and forwards NO flags. pnpm 11's build-script gate (strictDepBuilds, default
//   true) makes ANY `pnpm add`/`pnpm install` exit non-zero
//   (ERR_PNPM_IGNORED_BUILDS) while the workspace carries a dependency with an
//   unapproved build script -- here nx itself (nx@23.0.1 has a postinstall). nx add
//   treats that non-zero exit as an install failure and aborts BEFORE init. This is
//   a pnpm gate interacting with nx-add's fixed command, NOT a problem with
//   angular-typechecker, which ships ZERO install/build scripts of its own.
//
// THE WORKAROUND APPLIED HERE (the recommended, security-preserving one):
//   Approve the workspace's build-script dependency via `allowBuilds` in
//   pnpm-workspace.yaml -- exactly what `pnpm approve-builds` writes on pnpm 11.
//   A plain `pnpm install` on this fixture flags precisely `nx@23.0.1` (observed on
//   pnpm 11.9.0), so `allowBuilds: { nx: true }` enumerates that one flagged dep. It
//   satisfies BOTH the provisioning `pnpm install` AND nx add's child `pnpm add`
//   (both then exit 0), so the real `nx add` succeeds and init runs -- proving the
//   package installs + inits correctly on pnpm once the PM's own gate is satisfied.
//
// pnpm version facts (pnpm.io/settings, pnpm 11.x):
//   - `allowBuilds` is a `{ <pkg>: true }` MAP and is the pnpm 11 approval key.
//   - `onlyBuiltDependencies` was the pnpm 10 key (a LIST) and was REMOVED in pnpm
//     11; a stale `onlyBuiltDependencies` carried from a pnpm 10 config is IGNORED
//     on pnpm 11 (which is why partial pnpm-10 allowlists in the wild did not stop
//     the failure).
//   - `--ignore-scripts` (or `strictDepBuilds: false`) is an alternative, but only
//     for the DIRECT install+init path: it CANNOT be passed through `nx add` (nx add
//     forwards no flags), so it does not fix the `nx add` one-liner.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the
// shared globalSetup (which builds + publishes dist once); consumes that registry
// via inject(). Skips cleanly when pnpm is unavailable, and ASSERTS the effective
// pnpm is 11 at runtime (the build-script gate it exercises exists only on pnpm 11,
// so a <11 host must fail loudly rather than pass with the workaround untested).

// keep in sync with ci.yml pnpm/action-setup version
const PNPM_VERSION = '11.9.0';

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
// set (which pnpm would otherwise honor over the fixture .npmrc) plus the NX_*
// runner vars.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Availability guard: probe pnpm reachability so a host without pnpm skips cleanly
// (CI provisions pnpm 11.9.0 on PATH via pnpm/action-setup).
const pnpmAvailable = commandSucceeds('pnpm --version', {
  cwd: workspaceRoot,
  env,
});

describe('NX-ADD-PNPM: real `nx add` on a pnpm 11 workspace seeds the typecheck targetDefaults', () => {
  it.skipIf(!pnpmAvailable)(
    'runs `npx nx add angular-typechecker` (pnpm build-gate satisfied) and init seeds the WALK-02 cache block',
    () => {
      const verdaccioUrl = inject('verdaccioUrl');
      const verdaccioToken = inject('verdaccioToken');

      expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

      const tmp = mkdtempSync(join(tmpdir(), 'atc-add-pnpm-'));

      try {
        cpSync(fixtureDir, tmp, { recursive: true });

        // Make it a REAL pnpm 11 workspace (so nx uses `pnpm add -Dw`), WITH the
        // build-approval workaround: `allowBuilds` approves nx's postinstall (the
        // one build-script dep this fixture flags), so both `pnpm install` and nx
        // add's child `pnpm add` exit 0.
        writeFileSync(
          join(tmp, 'pnpm-workspace.yaml'),
          "packages:\n  - '.'\nallowBuilds:\n  nx: true\n",
        );

        // Pin packageManager to pnpm 11 so pnpm self-routes to the gated major (the
        // host PATH pnpm may be a 9.x shim, which has NO gate); this also matches
        // CI's pnpm/action-setup version exactly.
        const packageJsonPath = join(tmp, 'package.json');
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, 'utf8'),
        ) as {
          packageManager?: string;
        };
        packageJson.packageManager = `pnpm@${PNPM_VERSION}`;
        writeFileSync(
          packageJsonPath,
          `${JSON.stringify(packageJson, null, 2)}\n`,
        );

        // Point pnpm at Verdaccio (registry + minted bearer via the nerf-dart auth
        // line). pnpm reads .npmrc natively; http localhost is fine for pnpm.
        writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

        const pnpmEnv = {
          ...env,
          npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
        };

        // Seeded-from-absent BASELINE: the key must be undefined BEFORE `nx add`, so
        // the post-assert is non-vacuous (a pre-declared key would make init's
        // whole-entry ??= skip seeding and pass for the wrong reason).
        expect(readTypecheckTargetDefault(tmp)).toBeUndefined();

        // Provision the tree + the nx binary + a pnpm-lock.yaml (so
        // detectPackageManager -> pnpm). With allowBuilds satisfying the gate this
        // exits 0.
        sh('pnpm install', { cwd: tmp, env: pnpmEnv });

        // Assert the EFFECTIVE pnpm the tmp workspace resolves to is pnpm 11 -- the
        // major whose build-script gate this spec exists to exercise. A host whose
        // effective pnpm is <11 (gate never fires) would otherwise PASS with the
        // workaround untested (a false green); this fails loudly instead.
        const pnpmVersion = sh('pnpm --version', {
          cwd: tmp,
          env: pnpmEnv,
        }).trim();
        expect(
          Number(pnpmVersion.split('.')[0]),
          `nx-add-pnpm must run under pnpm 11 to exercise the build-script gate (got ${pnpmVersion}); enable corepack so the packageManager pin routes, or install pnpm 11`,
        ).toBe(11);

        // The REAL command: nx detects pnpm -> `pnpm add -Dw
        // angular-typechecker@latest` (resolved from Verdaccio; the build gate is
        // satisfied so it exits 0) -> runs the internal init generator. Invoked via
        // `npx nx add` (matches the npm spec; with the gate satisfied `pnpm exec nx
        // add` would work too, but npx sidesteps pnpm exec's pre-flight deps-status
        // check entirely).
        sh('npx nx add angular-typechecker', { cwd: tmp, env: pnpmEnv });

        // init SEEDED the key (absent -> present, WALK-02 shape).
        expectSeededTypecheckTargetDefault(tmp);
      } finally {
        removeTmpDir(tmp);
      }
    },
    300000,
  );
});
