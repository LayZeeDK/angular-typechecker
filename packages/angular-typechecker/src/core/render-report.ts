import { loadCompilerCli } from './compiler-loader';
import { formatReport } from './format-report';
import { formatJsonReport } from './json-report';
import { loadTypescript } from './load-typescript';
import type { CoreResult } from './run-typecheck';

/**
 * The output format the seam dispatches on (FMT-01 / D-12). `human` is the shipped
 * colorized codeframe report; `json` is the zero-dependency machine payload
 * (`formatJsonReport`); `sarif` is the SARIF 2.1.0 machine payload
 * (`formatSarifReport`, REP-02), lazy-`import()`ed so its `node-sarif-builder`
 * dependency loads ONLY on the SARIF path.
 */
export type ReportFormat = 'human' | 'json' | 'sarif';

/**
 * Options for {@link renderReport}.
 *
 * - FMT-01/D-12: `format` selects the reporter; OPTIONAL, defaulting to `'human'`,
 *   so the shipped callers (main.ts, executor.ts) compile unchanged until 30-03
 *   threads a real value. Human output stays byte-identical to v0.2.2.
 * - D-08: `pathBase` is the relativization base for CI-annotation / machine paths.
 *   Unset => ABSOLUTE paths. The adapter fills it from `context.root`.
 * - D-04/D-10: `color` false => strip ANSI (CI / agents / pipes); true => keep it.
 *   HUMAN path ONLY -- machine formats are unconditionally plain regardless of it.
 * - EXE-03/D-04: `failFast` truncates the REPORTED (human) list at the first error.
 * - D-07: `maxWarnings`/`strict` are forwarded to `formatJsonReport` so its
 *   `summary.outcome`/`success` DELEGATE to `evaluateResult` (the sole verdict
 *   owner), never re-derive from counts. Human ignores them.
 */
export interface RenderOptions {
  format?: ReportFormat;
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
  maxWarnings?: number;
  strict?: boolean;
}

/**
 * The single render seam every adapter (CLI, executor, builder) reuses (D-02).
 * Dispatches on {@link RenderOptions.format} (D-12):
 *
 * - `json`: `formatJsonReport` over the full `CoreResult`. Loads `typescript`
 *   (already warm from `runTypecheck`) but NOT `@angular/compiler-cli` -- the
 *   machine path never pays for the heavy ESM peer.
 * - `sarif`: `formatSarifReport` over the full `CoreResult`, reached via a lazy
 *   `await import('./sarif-report.js')` (D-03) so `node-sarif-builder` (+ its
 *   transitive `fs-extra`) load ONLY on the SARIF path. The `.js` specifier is
 *   required for a relative dynamic import under `module: nodenext` (a CommonJS
 *   file preserves `import()` rather than downleveling to `require`). Like `json`,
 *   it loads `typescript` but NOT `@angular/compiler-cli`.
 * - `human` (default): loads the memoized `@angular/compiler-cli` and delegates to
 *   `formatReport`, byte-identical to v0.2.2.
 *
 * `CoreResult.diagnostics` are ALREADY sorted + deduped by `runTypecheck` (D-09);
 * this seam does not re-sort.
 *
 * @param result The full `CoreResult` (json reads the summary fields; human reads
 *   only `diagnostics`).
 * @param options See {@link RenderOptions}.
 */
export async function renderReport(
  result: CoreResult,
  options: RenderOptions,
): Promise<string> {
  const ts_ = await loadTypescript();

  switch (options.format ?? 'human') {
    case 'json': {
      return formatJsonReport(result, ts_, {
        pathBase: options.pathBase,
        maxWarnings: options.maxWarnings,
        strict: options.strict,
      });
    }

    case 'sarif': {
      // D-03: the SARIF renderer + node-sarif-builder are reached ONLY via this
      // lazy import, so the human / JSON / --help / CLI-boot paths never load them
      // (the 31-02 require-graph guard locks it). `ts_` is already loaded above and
      // `options.pathBase` is already threaded -- no adapter change is required.
      const { formatSarifReport } = await import('./sarif-report.js');

      return formatSarifReport(result, ts_, options.pathBase);
    }

    case 'human':
    default: {
      // D-12: the heavy ESM compiler-cli loads ONLY for the human branch.
      const ng = await loadCompilerCli();

      return formatReport(result.diagnostics, ng, ts_, {
        pathBase: options.pathBase,
        color: options.color,
        failFast: options.failFast,
      });
    }
  }
}
