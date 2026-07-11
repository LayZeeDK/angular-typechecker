import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Dedicated, FULLY SERIALIZED Angular CLI scaffolded-workspace e2e config (ACV-02).
// This project shells the REAL Angular CLI toolchain (execSync): `ng add
// angular-typechecker` -> plant per-leaf errors -> `ng run <project>:typecheck`
// against a committed, pinned Angular 22 fixture, installed from the local
// Verdaccio registry the shared globalSetup stands up. It mirrors
// angular-typechecker-install-e2e's Verdaccio + tarball machinery, keeping the
// `ng`/@angular/cli harness SEPARATE from the Nx `nx` harness (CONTEXT D-03). Under
// the default parallel `forks` pool, parallel workers would race on the shared dist
// tarball the globalSetup publishes; so every serialization knob below is
// load-bearing, the environment is `node` (an execSync/ng harness needs node, not
// jsdom), and the testTimeout is INSTALL-SIZED because a real `npm install` + `ng
// add` + `ng run` is multi-minute (timeouts >= 300000).
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/e2e/angular-typechecker-ng-cli-e2e',
  // nxViteTsPaths keeps tsconfig path resolution consistent with the rest of the
  // workspace under Vitest; the specs themselves only use node built-ins +
  // execSync, but the plugin is cloned verbatim for parity.
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin([])],
  test: {
    name: 'angular-typechecker-ng-cli-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    // Stands up the Verdaccio local-registry, builds dist ONCE, mints a token, and
    // publishes ONCE (finding E1); provides verdaccioUrl + verdaccioToken to the
    // specs. Runs for EVERY invocation (including a single selected spec), so the
    // registry + dist are always provisioned before any spec.
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
