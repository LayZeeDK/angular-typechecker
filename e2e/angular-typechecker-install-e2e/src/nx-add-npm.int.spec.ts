import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  readTypecheckTargetDefault,
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// NX-ADD-NPM: the REAL `nx add angular-typechecker` on an npm workspace at local
// Verdaccio. This is DISTINCT from its two siblings:
//   - verdaccio-publish.int.spec.ts installs BY NAME (`npm install --save-dev
//     angular-typechecker`) then runs init/configuration/typecheck MANUALLY -- it
//     never invokes `nx add`.
//   - nx-add-e2e.int.spec.ts proves only the `nx g angular-typechecker:init`
//     SUBSTITUTE (tarball install + the internal init command) -- not `nx add`.
// So nx add's real package-manager orchestration (detectPackageManager -> `npm
// install -D angular-typechecker@latest` -> runPluginInitGenerator -> the internal
// `g angular-typechecker:init`) is exercised here for the first time on npm.
//
// npm has NO build-script approval gate, so the real `nx add` is expected to
// SUCCEED: the install resolves `angular-typechecker@latest` from Verdaccio (the
// freshly-published local dist) and init seeds the WALK-02 typecheck
// targetDefaults. Runs SEQUENTIALLY on the main tree under the serialized
// vitest.config.mts + the shared globalSetup (which builds + publishes dist once);
// this spec CONSUMES that registry via inject().

// Resolve the workspace root from this spec's location; findWorkspaceRoot() walks
// up to nx.json so every path is cwd-independent (main tree).
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

// stripAllNpmConfig is load-bearing: the shared globalSetup sets
// npm_config_registry process-wide (inherited by this singleFork worker) and it
// would outrank the fixture .npmrc and retarget the install away from local
// Verdaccio. Stripping every npm_config_* also drops any leaked legacy-peer-deps
// override so a real consumer ERESOLVE cannot be masked.
const env = buildCleanEnv({ stripAllNpmConfig: true });

describe('NX-ADD-NPM: real `nx add` on an npm workspace seeds the typecheck targetDefaults', () => {
  it('runs `npx nx add angular-typechecker` at local Verdaccio and init seeds the WALK-02 cache block', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Documentation-level re-assert of the globalSetup SAFETY gate: the registry
    // this install reads from MUST be local Verdaccio.
    expect(verdaccioUrl.startsWith('http://localhost:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-add-npm-'));

    try {
      cpSync(fixtureDir, tmp, { recursive: true });

      // Point npm at Verdaccio (registry + minted bearer via the nerf-dart auth
      // line), same shape as verdaccio-publish.int.spec.ts.
      writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

      // Seeded-from-absent BASELINE: the key must be undefined BEFORE `nx add`, so
      // the post-assert is non-vacuous (a pre-declared key would make init's
      // whole-entry ??= skip seeding and pass for the wrong reason).
      expect(readTypecheckTargetDefault(tmp)).toBeUndefined();

      // Provision the fixture's own deps + the nx binary + a package-lock.json (so
      // detectPackageManager -> npm). npm_config_userconfig -> a nonexistent path
      // so the user ~/.npmrc cannot reintroduce a peer override into the nested
      // install.
      const npmEnv = {
        ...env,
        npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
      };
      sh('npm install', { cwd: tmp, env: npmEnv });

      // The REAL command: nx add detects npm -> runs `npm install -D
      // angular-typechecker@latest` (resolved from Verdaccio; npm has no
      // build-script gate so it succeeds) -> runs the internal init generator.
      sh('npx nx add angular-typechecker', { cwd: tmp, env: npmEnv });

      // init SEEDED the key (absent -> present, WALK-02 shape). The 'default'-first
      // input is the load-bearing invariant: 'production' would exclude *.spec.ts
      // and under-hash the walked spec leaf (a stale PASS).
      const seeded = readTypecheckTargetDefault(tmp);
      expect(seeded).toBeDefined();
      expect(seeded?.cache).toBe(true);
      expect(seeded?.outputs).toEqual([]);
      expect(seeded?.inputs?.[0]).toBe('default');
    } finally {
      removeTmpDir(tmp);
    }
  }, 300000);
});
