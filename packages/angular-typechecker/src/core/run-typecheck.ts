import type ts from 'typescript';

import type { EmitFlags } from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';

export interface CoreOptions {
  tsConfigPath: string;
}

export interface CoreResult {
  diagnostics: readonly ts.Diagnostic[];
  codes: number[];
  errorCount: number;
  warningCount: number;
  durationMs: number;
}

/**
 * Runs the complete Angular whole-program type-check for a single tsconfig with
 * no emit, gathering all diagnostic phases unconditionally, and returns a
 * structured result. The config is parsed ONCE and spread into a FRESH `options`
 * object so that a second `performCompilation` call (e.g. the GATE B
 * differential in Plan 04) never shares the mutated `noEmit` state of the first
 * (resolved research Open Question 1). No filtering of out-of-project diagnostics
 * is applied (deferred to Phase 3, D-10).
 */
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const ng = await loadCompilerCli();
  const ts = await loadTypescript();

  const parsed = ng.readConfiguration(options.tsConfigPath);

  const start = performance.now();
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },
    emitFlags: 0 as EmitFlags,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  const durationMs = performance.now() - start;

  const errorCount = result.diagnostics.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length;

  return {
    diagnostics: result.diagnostics,
    codes: result.diagnostics.map((diagnostic) => diagnostic.code),
    errorCount,
    warningCount: result.diagnostics.length - errorCount,
    durationMs,
  };
}

let cachedTypescript: typeof ts | undefined;

async function loadTypescript(): Promise<typeof ts> {
  if (cachedTypescript === undefined) {
    const loaded = (await import('typescript')) as typeof ts & {
      default?: typeof ts;
    };
    cachedTypescript = loaded.default ?? loaded;
  }

  return cachedTypescript;
}
