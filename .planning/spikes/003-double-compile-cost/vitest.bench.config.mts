import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Standalone bench config for spike 003 -- deliberately isolated from the workspace
// vitest config (node environment, no nx plugins, no jsdom). Run with:
//   npx vitest bench --config .planning/spikes/003-double-compile-cost/vitest.bench.config.mts --run
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  test: {
    environment: 'node',
    benchmark: {
      include: ['**/*.bench.mts'],
    },
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
