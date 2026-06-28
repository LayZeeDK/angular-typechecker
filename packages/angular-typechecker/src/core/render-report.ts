import type ts from 'typescript';

import { loadCompilerCli } from './compiler-loader';
import { formatReport } from './format-report';
import type { CoreResult } from './run-typecheck';

/**
 * Options for {@link renderReport} (mirror of {@link FormatOptions}; the values
 * are forwarded verbatim to `formatReport`).
 *
 * - D-08: `pathBase` is the relativization base for CI annotation paths. Unset =>
 *   ABSOLUTE paths. The Phase-4 adapter fills it from `context.root`.
 * - D-04/D-10: `color` false => strip ANSI (CI / agents / pipes); true => keep
 *   it. The adapter passes `process.stdout.isTTY` so the core stays free of
 *   `process` (Phase-3 D-11).
 * - EXE-03/D-04: `failFast` truncates the REPORTED list at the first error. This
 *   is a REPORTING concern only -- never a gather short-circuit.
 */
export interface RenderOptions {
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
}

// D-02 anti-leak: `loadTypescript` is duplicated here as a MODULE-PRIVATE memo
// (copied verbatim from run-typecheck.ts) so the `ts` load stays inside core and
// is NEVER barrel-exported. Each `import('typescript')` resolves the same module
// instance, so the second memo is a near-free cache miss once.
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

/**
 * The single render seam every adapter (the executor now; the CLI / builder
 * later) reuses (D-02, compile-blocker). It loads the memoized
 * `@angular/compiler-cli` (`loadCompilerCli`) + the private `typescript`
 * (`loadTypescript`) and delegates to the injected-surface `formatReport`.
 *
 * This seam exists because `formatReport` REQUIRES injected `ng`/`ts` that
 * `runTypecheck` does NOT return, and `loadTypescript` is NOT exported from the
 * barrel -- so the adapter cannot call `formatReport` directly without either
 * re-coupling rendering into the engine (a `formatted` field on `CoreResult`) or
 * leaking module-loading orchestration. Keeping the CJS->ESM module loading here,
 * where the loaders live, is the D-02 resolution.
 *
 * `CoreResult.diagnostics` are ALREADY sorted + deduped by `runTypecheck` (D-09);
 * this seam does not re-sort.
 *
 * @param result A `CoreResult` (only `diagnostics` is read).
 * @param options See {@link RenderOptions}.
 */
export async function renderReport(
  result: Pick<CoreResult, 'diagnostics'>,
  options: RenderOptions,
): Promise<string> {
  const ng = await loadCompilerCli();
  const ts_ = await loadTypescript();

  return formatReport(result.diagnostics, ng, ts_, {
    pathBase: options.pathBase,
    color: options.color,
    failFast: options.failFast,
  });
}
