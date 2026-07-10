import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Dedicated, FULLY SERIALIZED cache-correctness e2e config (D-14). The TEST-04
// gate shells out to the real `nx` CLI (execSync) and runs `runExecutor`
// in-process against the real project graph + cache. Under the default parallel
// `forks` pool, parallel workers would race on the shared cache/daemon and the
// single most important correctness gate would get .skip'd / flake. So this
// project DIVERGES from the plugin unit config (jsdom, parallel) on EVERY
// serialization knob below, runs in the `node` environment (not jsdom -- an
// execSync/runExecutor harness needs node), and uses a long testTimeout because
// a real performCompilation + project graph + `nx run` is slow (D-17 main tree).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-cache-e2e',
  // nxViteTsPaths resolves the `angular-typechecker` core barrel under Vitest so
  // the runExecutor parity oracle can import runTypecheck.
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-cache-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 180000,
    hookTimeout: 180000,
  },
}));
