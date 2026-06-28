import type { ExecutorContext } from '@nx/devkit';

import { describe, expect, it } from 'vitest';

import type { AngularTypecheckExecutorOptions } from './schema';
import { normalizeOptions } from './normalize-options';

// Minimal ExecutorContext literal: normalizeOptions reads ONLY `root`. The rest
// of the context surface is irrelevant to this pure mapper, so we cast a small
// literal rather than build a full graph context.
function contextWithRoot(root: string): ExecutorContext {
  return { root } as ExecutorContext;
}

describe('normalizeOptions (D-01/D-03)', () => {
  it('resolves a relative tsConfig workspace-root-relative via joinPathFragments (D-03)', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    // joinPathFragments emits POSIX separators and joins under the workspace root.
    expect(normalized.coreOptions.tsConfigPath).toBe(
      '/ws/libs/x/tsconfig.lib.json',
    );
    expect(normalized.coreOptions.tsConfigPath).not.toContain('\\');
  });

  it('passes an absolute tsConfig through unchanged (D-03)', () => {
    const absolute = '/abs/path/tsconfig.lib.json';
    const options: AngularTypecheckExecutorOptions = { tsConfig: absolute };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.coreOptions.tsConfigPath).toBe(absolute);
  });

  it('leaves maxWarnings undefined when absent -- NOT defaulted to 0 (EXE-05)', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.maxWarnings).toBeUndefined();
  });

  it('forwards a provided maxWarnings as-is', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
      maxWarnings: 0,
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.maxWarnings).toBe(0);
  });

  it('defaults failFast and includeDeps to false when absent (D-06)', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.failFast).toBe(false);
    expect(normalized.coreOptions.includeDeps).toBe(false);
  });

  it('forwards provided failFast and includeDeps', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
      failFast: true,
      includeDeps: true,
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.failFast).toBe(true);
    expect(normalized.coreOptions.includeDeps).toBe(true);
  });

  it('sets pathBase to the workspace root (D-08)', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.coreOptions.pathBase).toBe('/ws');
  });

  it('derives color from process.stdout.isTTY (D-04)', () => {
    const options: AngularTypecheckExecutorOptions = {
      tsConfig: 'libs/x/tsconfig.lib.json',
    };

    const normalized = normalizeOptions(options, contextWithRoot('/ws'));

    expect(normalized.color).toBe(process.stdout.isTTY === true);
  });
});
