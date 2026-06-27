import { describe, expect, it } from 'vitest';

import { loadCompilerCli } from './compiler-loader';

describe('loadCompilerCli', () => {
  it('loads the ESM @angular/compiler-cli namespace without ERR_REQUIRE_ESM (GATE A runtime path)', async () => {
    const ng = await loadCompilerCli();

    expect(typeof ng.performCompilation).toBe('function');
    expect(typeof ng.readConfiguration).toBe('function');
    expect(typeof ng.defaultGatherDiagnostics).toBe('function');
  });

  it('memoizes the module so a second call returns the same reference', async () => {
    const first = await loadCompilerCli();
    const second = await loadCompilerCli();

    expect(second).toBe(first);
  });
});
