import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Dedicated, FULLY SERIALIZED e2e config (D-08/D-21), cloned VERBATIM from the
// install-e2e analog -- only `name` + `cacheDir` differ. The 5-type matrix spec
// shells out to the real toolchain (execSync): `nx build` -> `npm pack` -> one
// `npm install` of the tarball -> `nx run <target>` per project type. Under the
// default parallel `forks` pool, parallel workers would race on the shared dist
// dir + the packed `.tgz` filename and the e2e would flake. So this project, like
// the install-e2e/cache-e2e analogs, DIVERGES from the plugin unit config on
// EVERY serialization knob below, runs in the `node` environment (an
// execSync/pack/install harness needs node, not jsdom), and uses an INSTALL-SIZED
// testTimeout because a real `nx build` + `npm pack` + `npm install` + 5 `nx run`s
// is slow (D-21: timeouts >= 300000; main tree, D-22).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-matrix-e2e',
  // nxViteTsPaths keeps tsconfig path resolution consistent with the rest of the
  // workspace under Vitest; the matrix spec itself only uses node built-ins +
  // execSync, but the plugin is cloned verbatim for parity.
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-matrix-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
  },
}));
