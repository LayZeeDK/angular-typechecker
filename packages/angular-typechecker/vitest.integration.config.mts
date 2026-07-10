import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Integration tier: the real-compiler specs (`*.integration.spec.ts`) that each
// run a cold `@angular/compiler-cli` `performCompilation` (ESM module load + a
// whole-program no-emit type-check). Kept in a SEPARATE target/config from the
// fast unit tier so `nx run-many -t test` stays fast; this config is NOT added to
// vitest.workspace.ts (whose glob only matches `vitest.config.*`), so the
// integration specs never double-run.
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/angular-typechecker-integration',
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'angular-typechecker:integration',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.integration.spec.ts'],
    // These cold-compiler specs can exceed the 5000ms default on slower hardware
    // (e.g. Windows arm64); raise the per-test + per-hook timeout to keep the
    // suite deterministic. This changes NO test semantics -- only the patience.
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default'],
    coverage: {
      reportsDirectory:
        '../../coverage/packages/angular-typechecker-integration',
      provider: 'v8' as const,
    },
  },
}));
