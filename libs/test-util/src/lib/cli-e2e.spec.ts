import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runShim } from './cli-e2e';

// The tarball-e2e specs exercise runShim's happy paths against real published
// bins; the one behavior worth unit-locking here is the FAIL-LOUD contract: a
// spawn failure must throw, never return a verdict-shaped code that a red-path
// assertion (code === 1) would mistake for a genuine type-error verdict.
describe('runShim (fail-loud on a spawn failure)', () => {
  // POSIX only: with shell:false, spawning a nonexistent extensionless shim
  // yields an ENOENT `result.error` (status null). On Windows the shim runs
  // through cmd.exe (shell:true -- the CVE-2024-27980 requirement), which returns
  // exit 1 for a missing command WITHOUT setting result.error, so the
  // spawn-failure branch cannot be provoked the same way there.
  it.skipIf(process.platform === 'win32')(
    'throws instead of returning code 1 when the shim cannot be spawned',
    () => {
      const emptyConsumer = mkdtempSync(join(tmpdir(), 'runshim-nobin-'));

      try {
        expect(() =>
          runShim(emptyConsumer, 'atc', ['-c', 'tsconfig.json'], process.env),
        ).toThrow(/failed to spawn/);
      } finally {
        rmSync(emptyConsumer, { recursive: true, force: true });
      }
    },
  );
});
