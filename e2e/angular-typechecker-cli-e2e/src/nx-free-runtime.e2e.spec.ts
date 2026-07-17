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
  removeTmpDir,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// VER-04 SC-3 (D-07): the RUNTIME complement to Phase 27's STATIC dist require-graph
// walk (packages/angular-typechecker/src/cli/bin-static.spec.ts). After a real install
// + a real type-check run of the INSTALLED bin, prove:
//   (1) the runtime require cache never reaches @nx/* or nx/ -- the standalone CLI drags
//       no Nx module at RUN time (the 24-06 chalk-chain / yarn-hoist crash class stays
//       dead), even though `nx` is present in node_modules (transitive dependency); and
//   (2) the captured output never matches /ERR_REQUIRE_ESM/ -- the CJS->ESM
//       `await import('@angular/compiler-cli')` bridge survived install un-downleveled.
//
// The static walk (Phase 27) can only see `require()` specifiers in the shipped .js; this
// spec observes the FINAL runtime module graph AFTER `await import()` completes -- what
// static analysis cannot see. Per RESEARCH Open Question 2, the require-cache probe runs
// the installed bin directly via `node -r <hook> <bin.js>` (the .bin shim path is proven
// separately by the exit-code specs); a preload hook dumps the require cache on process
// exit.
//
// Runs SEQUENTIALLY on the main tree under the serialized vitest.config.mts + the shared
// globalSetup (build + publish ONCE); installs by-name from local Verdaccio (D-02).

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

// stripAllNpmConfig is load-bearing: the globalSetup sets npm_config_registry
// process-wide and it would outrank the tmp .npmrc (T-28-06).
const env = buildCleanEnv({ stripAllNpmConfig: true });

// The preload hook (dropped as a .cjs beside the consumer): on process exit it filters
// require.cache for any key resolving under a node_modules @nx/*/nx/ path and writes the
// matches (JSON) to ATC_CACHE_OUT. String.raw keeps the `[\\/]` character class (matches
// a Windows backslash OR a POSIX slash in the cached module path) byte-exact in the
// emitted .cjs. NX pattern mirrors bin-static.spec.ts's require-graph classifier.
const REQUIRE_CACHE_HOOK = String.raw`process.on('exit', () => {
  const nx = Object.keys(require.cache).filter((k) =>
    /node_modules[\\/](@nx[\\/]|nx[\\/])/.test(k),
  );
  require('node:fs').writeFileSync(process.env.ATC_CACHE_OUT, JSON.stringify(nx));
});
`;

describe('VER-04 SC-3 (D-07): the INSTALLED bin loads no @nx/*/nx/ at run time and never emits ERR_REQUIRE_ESM', () => {
  it('runs a real type-check via node -r hook bin.js: require.cache reaches no nx + output is ERR_REQUIRE_ESM-free', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Re-assert the globalSetup SAFETY invariant (D-02, T-28-02): this install reads from
    // local Verdaccio pinned to the numeric IPv4 loopback.
    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-cli-nxfree-'));

    try {
      cpSync(fixtureDir, tmp, { recursive: true });

      // Point npm at Verdaccio (registry + minted bearer). Written to the tmp copy only.
      writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

      // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot leak a
      // registry/peer override into the nested install (T-28-06).
      const npmEnv = {
        ...env,
        npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
      };

      // Provision the fixture's Angular 22 peers then install the SHIPPED package BY NAME
      // from the local publish (D-02). `nx` arrives transitively -- present in
      // node_modules but NEVER loaded by the standalone CLI at run time (the claim proven
      // below).
      sh('npm install --no-audit --no-fund --prefer-offline', {
        cwd: tmp,
        env: npmEnv,
      });
      sh(
        'npm install angular-typechecker --no-audit --no-fund --prefer-offline',
        { cwd: tmp, env: npmEnv },
      );

      // The installed bin: node_modules/angular-typechecker/src/cli/bin.js (matches the
      // shipped two-name bin map). Sanity-check it materialized before probing it.
      const installedBin = join(
        tmp,
        'node_modules',
        'angular-typechecker',
        'src',
        'cli',
        'bin.js',
      );
      expect(existsSync(installedBin), installedBin).toBe(true);

      // Drop the preload hook + choose the require-cache dump target.
      const hookPath = join(tmp, 'dump-require-cache.cjs');
      writeFileSync(hookPath, REQUIRE_CACHE_HOOK);
      const cacheOut = join(tmp, 'nx-cache.json');

      // Run the INSTALLED bin directly with the hook preloaded (this executes the full
      // CLI: parse -> resolve -> `await import('@angular/compiler-cli')` -> type-check ->
      // report). The clean fixture exits 0; wrap in try/catch anyway so a non-zero exit
      // still lets the exit hook flush and the assertions read the dumped cache.
      let runOutput = '';
      let threw = false;

      try {
        runOutput = execSync(
          `node -r "${hookPath}" "${installedBin}" -c tsconfig.json`,
          {
            cwd: tmp,
            env: { ...npmEnv, ATC_CACHE_OUT: cacheOut },
            encoding: 'utf8',
            maxBuffer: 20 * 1024 * 1024,
          },
        );
      } catch (error) {
        threw = true;
        const execError = error as { stdout?: string; stderr?: string };
        runOutput = `${execError.stdout ?? ''}${execError.stderr ?? ''}`;
      }

      // A real type-check of the clean fixture completes with exit 0 -- so the CJS->ESM
      // `await import()` bridge genuinely ran (not an early crash before compiler load).
      expect(threw, runOutput).toBe(false);

      // (2) ESM bridge survived install un-downleveled: no ERR_REQUIRE_ESM in the output.
      expect(runOutput).not.toMatch(/ERR_REQUIRE_ESM/);

      // (1) The runtime require graph never reaches @nx/* or nx/ (D-07). This is the
      // RUNTIME half Phase 27's D-10 static walk deferred.
      const loadedNx = JSON.parse(readFileSync(cacheOut, 'utf8')) as string[];
      expect(
        loadedNx,
        `installed bin loaded nx module(s) at run time: ${loadedNx.join(', ')}`,
      ).toEqual([]);
    } finally {
      removeTmpDir(tmp);
    }
  }, 600000);
});
