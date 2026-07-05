import { cpSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  run,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// REL-04 (highest-fidelity gate): the ONLY spec that exercises the REAL
// `nx release publish` command end-to-end. tarball-audit packs `npm pack` from
// dist and AUDITS the `.tgz` (publint/attw); install-smoke installs that `.tgz`
// by PATH -- neither goes through `nx release publish`, so they structurally
// cannot catch an nx-release-publish `packageRoot` regression (a reverted fix
// would pack the SOURCE root and ship raw `.ts`, and those specs would never
// notice).
//
// The publish itself now happens ONCE in the project's globalSetup
// (src/global-setup.ts), which stands up the first-party @nx/js Verdaccio
// local-registry, builds dist, mints a real token, strips provenance, and runs
// the actual `nx release publish --registry <local> --first-release`. This spec
// CONSUMES that published registry: it installs the package BY NAME into a fresh
// consumer, runs the documented init -> configuration -> typecheck flow green, and
// proves the installed tree ships compiled `.js` with a `.d.ts` (types ship) and
// ZERO `.ts` source / ZERO `.spec`. Runs SEQUENTIALLY on the main tree under the
// serialized vitest.config.mts (forks/singleFork/no-parallel/node env, 300000ms).
//
// SAFETY (load-bearing): globalSetup refuses to publish to any non-local registry
// before invoking `nx release publish`; this spec re-asserts the injected URL is
// local as documentation.

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

// The published, unscoped package name + the project the fixture exposes.
const PACKAGE_NAME = 'angular-typechecker';
const CONSUMER_PROJECT = 'consumer-generator';

// The three compiled runtime files that prove the tree ships JS, not source. If
// the packageRoot fix regresses, publish would pack `src/**/*.ts` and NONE of
// these `.js` would exist in the installed tree.
const REQUIRED_INSTALLED_JS = [
  join('src', 'index.js'),
  join('src', 'generators', 'init', 'generator.js'),
  join('src', 'executors', 'typecheck', 'executor.js'),
];

// stripAllNpmConfig is load-bearing here: an inherited npm_config_registry (incl.
// the one startLocalRegistry set in the parent process, which vitest workers
// inherit) would outrank the consumer .npmrc and retarget the install away from
// local Verdaccio.
const env = buildCleanEnv({ stripAllNpmConfig: true });

// Recursively collect POSIX-style relative file paths under a directory using
// readdirSync's recursive mode (R1: entry.parentPath is Node 20.12+; this repo
// targets Node 22+).
function walkInstalledFiles(root: string): string[] {
  return (
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        relative(root, join(entry.parentPath, entry.name)).replace(/\\/g, '/'),
      )
      // Exclude any nested node_modules: a transitive dep that failed to hoist
      // could ship its own raw .ts/.spec and trip the zero-.ts assertion below
      // even though angular-typechecker itself packed correctly.
      .filter((path) => !path.split('/').includes('node_modules'))
  );
}

describe('REL-04: nx release publish -> install-by-name -> typecheck ships compiled JS', () => {
  it('installs by name from local Verdaccio, runs init/configuration/typecheck green, and ships compiled JS + types with zero .ts source', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Documentation-level re-assert of the globalSetup SAFETY gate: the registry
    // the publish targeted (and this install reads from) MUST be local Verdaccio.
    expect(verdaccioUrl.startsWith('http://localhost:')).toBe(true);

    // Install BY NAME from Verdaccio into a fresh consumer (not by tarball path --
    // this is the registry round-trip install-smoke cannot do). The consumer
    // .npmrc points npm at Verdaccio (+ minted token); npm_config_userconfig -> a
    // nonexistent path so the user ~/.npmrc cannot reintroduce a peer override.
    const consumer = mkdtempSync(join(tmpdir(), 'atc-verdaccio-consumer-'));

    try {
      cpSync(fixtureDir, consumer, { recursive: true });

      writeVerdaccioNpmrc(consumer, verdaccioUrl, verdaccioToken);

      sh(`npm install --save-dev ${PACKAGE_NAME}`, {
        cwd: consumer,
        env: {
          ...env,
          npm_config_userconfig: join(consumer, '.npmrc.nonexistent'),
        },
      });

      const installedRoot = join(consumer, 'node_modules', PACKAGE_NAME);

      // Programmatic-API barrel-load smoke (README "Programmatic API"): require the
      // INSTALLED package and assert its public surface loads. This directly catches
      // the dangling-`main` / missing-`index.js` defect -- a broken tarball throws
      // MODULE_NOT_FOUND on require here. Angular-INDEPENDENT by design: requiring
      // the barrel does NOT load @angular/compiler-cli or typescript (both are
      // lazy-imported INSIDE runTypecheck), so this asserts only that the barrel
      // resolves and exports the documented shape -- it never calls runTypecheck().
      const installedApi = createRequire(import.meta.url)(installedRoot) as {
        runTypecheck?: unknown;
        TypecheckInfrastructureError?: unknown;
      };
      expect(typeof installedApi.runTypecheck).toBe('function');
      expect(typeof installedApi.TypecheckInfrastructureError).toBe('function');
      expect(
        () =>
          new (installedApi.TypecheckInfrastructureError as new (
            message: string,
          ) => unknown)('probe'),
      ).not.toThrow();

      // Documented flow: seed nx.json (init) -> wire the typecheck target
      // (configuration) -> run it. --skipFormat: the fixture installs no Prettier.
      sh('npx nx g angular-typechecker:init --skipFormat', {
        cwd: consumer,
        env,
      });
      sh(
        `npx nx g angular-typechecker:configuration ${CONSUMER_PROJECT} --skipFormat`,
        { cwd: consumer, env },
      );

      // (1) The type-check runs GREEN from the installed-by-name package. On
      //     failure, surface the captured nx stdout+stderr.
      const green = run(consumer, `${CONSUMER_PROJECT}:typecheck`, { env });
      expect(green.code, green.stdout).toBe(0);

      // (2) The installed tree carries the compiled runtime .js (index + the
      //     generator + the executor) -- proof the packageRoot fix shipped dist.
      for (const relativeJs of REQUIRED_INSTALLED_JS) {
        expect(existsSync(join(installedRoot, relativeJs))).toBe(true);
      }

      // (3) THE point: a recursive walk of the installed tree finds ZERO source
      //     `.ts` (excluding `.d.ts`) and ZERO `.spec.` files, and (M13) at least
      //     one `.d.ts` -- so types ship AND raw source does not. A reverted
      //     packageRoot would ship `src/**/*.ts` here and fail this assertion.
      const installedFiles = walkInstalledFiles(installedRoot);
      const tsSources = installedFiles.filter(
        (file) => file.endsWith('.ts') && !file.endsWith('.d.ts'),
      );
      const specFiles = installedFiles.filter((file) => /\.spec\./.test(file));
      const dtsFiles = installedFiles.filter((file) => file.endsWith('.d.ts'));

      expect(tsSources).toEqual([]);
      expect(specFiles).toEqual([]);
      expect(dtsFiles.length).toBeGreaterThan(0);
    } finally {
      removeTmpDir(consumer);
    }
  }, 300000);
});
