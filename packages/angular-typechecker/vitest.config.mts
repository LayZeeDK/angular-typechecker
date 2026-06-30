import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/angular-typechecker',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'angular-typechecker',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // The real-compiler integration specs (`*.integration.spec.ts`) each run a
    // cold `@angular/compiler-cli` `performCompilation` (ESM module load + a
    // whole-program no-emit type-check). Under Vitest's parallel pool on slower
    // hardware (e.g. Windows arm64) a single cold run can exceed the 5000ms
    // default `testTimeout`, producing a NON-deterministic (rotating) timeout
    // flake -- the suite's only instability, surfaced while gating COR-02. These
    // are legitimately long-running tests, so raise the per-test + per-hook
    // timeout (exactly what Vitest's timeout message recommends) to make the
    // suite deterministic. This changes NO test semantics -- only the patience.
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/angular-typechecker',
      provider: 'v8' as const,
    }
  },
}));
