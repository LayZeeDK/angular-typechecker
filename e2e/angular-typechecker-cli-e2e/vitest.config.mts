import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Dedicated, FULLY SERIALIZED standalone-CLI tarball-e2e config (VER-04, D-01).
// Each spec stands up the shared Verdaccio registry (globalSetup), installs the
// published package BY NAME into a throwaway consumer, and spawns the shipped
// `.bin` shim (execSync/spawnSync) to read the literal OS exit code. Under the
// default parallel `forks` pool, parallel workers would race on the one shared
// dist + the single loopback registry, so this project -- like the install-e2e
// analog it mirrors -- DIVERGES on EVERY serialization knob below, runs in the
// `node` environment (a spawn/install harness needs node, not jsdom), and uses an
// INSTALL-SIZED testTimeout because a real publish + install + run is slower than
// a bare `nx run` (timeouts >= 300000; main tree).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-cli-e2e',
  // nxViteTsPaths keeps tsconfig path resolution consistent with the rest of the
  // workspace under Vitest; the specs themselves use node built-ins + child_process
  // + @workspace/test-util, but the plugin is cloned verbatim for parity.
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-cli-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    // Stands up the Verdaccio local-registry, builds dist ONCE, mints a token, and
    // publishes ONCE; provides verdaccioUrl + verdaccioToken to the specs. Runs for
    // EVERY invocation (including a single selected spec), so the registry + dist are
    // always provisioned before any spec.
    globalSetup: ['./src/global-setup.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
  },
}));
