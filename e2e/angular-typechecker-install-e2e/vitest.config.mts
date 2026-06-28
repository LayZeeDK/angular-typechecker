import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Dedicated, FULLY SERIALIZED packaging-audit e2e config (D-21). The PKG-02
// audit gate shells out to the real toolchain (execSync): `nx build` ->
// `npm pack` -> `publint`/`attw` against the produced `.tgz`. Under the default
// parallel `forks` pool, parallel workers would race on the shared dist dir +
// the packed `.tgz` filename and the audit would flake. So this project, like
// the Phase-4 cache-e2e analog, DIVERGES from the plugin unit config on EVERY
// serialization knob below, runs in the `node` environment (an execSync/pack
// harness needs node, not jsdom), and uses an INSTALL-SIZED testTimeout because
// a real `nx build` + `npm pack` + `attw`/`publint` resolution is slower than a
// bare `nx run` (D-21: timeouts >= 300000; main tree, D-22).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-install-e2e',
  // nxViteTsPaths keeps tsconfig path resolution consistent with the rest of the
  // workspace under Vitest; the audit spec itself only uses node built-ins +
  // execSync, but the plugin is cloned verbatim for parity.
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-install-e2e',
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
