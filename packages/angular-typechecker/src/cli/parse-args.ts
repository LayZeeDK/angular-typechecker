import { parseArgs } from 'node:util';

/**
 * The nx-free arg-parsing + validation seam for the standalone CLI (Phase 26,
 * ARGS-01..04). A pure transform from raw `argv` to a discriminated result the
 * load-bearing `run()` (Plan 26-02) consumes without re-parsing.
 *
 * It imports ONLY `node:util` + the package.json manifest (for `--version`) --
 * never the Nx devkit, never the `nx` runtime, never the barrel one dir up, and
 * never an executor/builder module (D-15, the nx-free CLI boundary; enforced by the
 * `src/cli/**` ESLint import-ban, respected here by construction). See 26-CONTEXT.md
 * D-08/D-10/D-11/D-12/D-14.
 */

// D-10: the version is read from the REAL manifest at the published-layout
// path (compiled `src/cli/parse-args.js` -> `../../package.json` is two dirs up,
// the package root). CJS JSON `require` works under `module: nodenext` because
// the package is `type: commonjs`. A unit test drift-locks the emitted value to
// the manifest so it can never go stale.
const packageManifest = require('../../package.json') as { version: string };

export interface ParsedOptions {
  readonly kind: 'options';
  // The RAW repeatable `--tsConfig` values (ARGS-02). A readonly array -- run()
  // only maps over it; the single-vs-array COLLAPSE (ARGS-03) happens there when it
  // builds CoreOptions.
  readonly tsConfig: readonly string[];
  readonly maxWarnings?: number;
  readonly failFast: boolean;
  readonly includeDeps: boolean;
  readonly strict: boolean;
  // FMT-01 / CLIX-02 (D-08/D-09/D-10): the machine-output selector + the two
  // human-path stream/color knobs. `format` defaults to 'human'; `quiet` gates the
  // stderr advisory chatter ONLY (never the payload/verdict); `color` is the
  // explicit --color/--no-color override (undefined = no flag, fall back to env).
  readonly format: 'human' | 'json' | 'sarif';
  readonly quiet: boolean;
  readonly color?: boolean;
}

export interface ParsedHelp {
  readonly kind: 'help';
  readonly text: string;
}

export interface ParsedVersion {
  readonly kind: 'version';
  readonly text: string;
}

export interface ParsedUsageError {
  readonly kind: 'usageError';
  readonly message: string;
}

/**
 * The discriminated result run() switches on: a valid options set, a help/version
 * short-circuit (text destined for stdout, exit 0), or a usage error (message
 * destined for stderr, exit 2).
 */
export type ParseResult =
  | ParsedOptions
  | ParsedHelp
  | ParsedVersion
  | ParsedUsageError;

// D-11: the synopsis MUST present the canonical uninstalled invocation as
// `npx angular-typechecker` and MUST NEVER say `npx atc` (atc@0.0.6 is an
// unrelated published package -- a supply-chain hazard; `atc` is only a local
// post-install PATH shorthand). Minimal here (flag list + the 0/1/2 exit-code
// line); the full prose lives in the package README (DOC-01).
const HELP_TEXT = `Usage: npx angular-typechecker -c <tsconfig> [options]

Run the complete Angular type-check (TypeScript + template type-check + extended
NG8xxx diagnostics), no emit, without building the app or running the tests.

Options:
  -c, --tsConfig <path>   Path to a tsconfig to check (repeatable; required). A
                          single solution tsconfig is reference-walked; two or
                          more are union-checked.
      --max-warnings <n>  Fail the run if the warning count exceeds n (a
                          non-negative integer; 0 fails on any warning).
      --fail-fast         Report diagnostics only up to the first error (output
                          brevity; all diagnostics are still gathered).
      --include-deps      Include out-of-project / node_modules diagnostics.
      --strict            Fail on dropped in-graph warnings (verdict only).
      --format <fmt>      Output format: human (default) is the colorized
                          codeframe report; json and sarif are the
                          machine-readable payloads.
      --quiet             Silence advisory notices on stderr (never the report
                          or the exit code).
      --color             Force ANSI color on the human report, overriding
                          NO_COLOR / FORCE_COLOR / TTY.
      --no-color          Disable ANSI color on the human report.
  -h, --help              Print this help and exit.
      --version           Print the version and exit.

Exit codes: 0 clean / 1 verdict-fail / 2 infrastructure-or-usage.
`;

/**
 * Parses standalone-CLI `argv` into a {@link ParseResult} (ARGS-01..04). Pure: no
 * I/O beyond the module-load manifest read, no stream writes, no process exit.
 *
 * - `-c x` / `--tsConfig x` -> tsConfig ['x']; `-c a -c b` -> ['a','b'] (repeatable).
 * - `--help`/`-h` -> help; `--version` -> version (both stdout-bound, exit 0).
 * - Unknown flag (e.g. `-p` / `--project` / `--nonsense`) or a missing option
 *   value -> usageError (strict parseArgs throws; caught, D-14).
 * - Missing required `--tsConfig` -> usageError (parseArgs does NOT enforce
 *   required; checked explicitly).
 * - `--max-warnings` non-negative-integer only; else usageError (D-08).
 */
export function parseCliArgs(argv: string[]): ParseResult {
  // parseArgs is the ONLY statement here that throws (D-14: strict mode throws
  // ERR_PARSE_ARGS_* on an unknown flag or a missing option value). The
  // help/version short-circuits and the validation checks only RETURN, so
  // keeping them inside the try changes no semantics and lets `values` stay
  // fully typed from parseArgs inference (avoids an implicit-any intermediate).
  try {
    const { values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      // Pitfall 9 / D-10: allowNegative lets `--no-color` set color:false under
      // strict mode -- without it strict parseArgs throws
      // ERR_PARSE_ARGS_UNKNOWN_OPTION on `--no-color`. Added in Node 22.4.0; the
      // engines floor is 22.22.3, so it is available on every supported Node.
      allowNegative: true,
      options: {
        // D-12: short is `c` (for --tsConfig), NEVER `p` -- `-p`/`--project`
        // is deliberately NOT registered (it would collide with Angular CLI /
        // Nx workspace PROJECT selection) and must surface as an unknown-flag
        // usage error.
        tsConfig: { type: 'string', short: 'c', multiple: true },
        'max-warnings': { type: 'string' },
        // FMT-01 / CLIX-02: --format <human|json|sarif>, --quiet, and
        // --color/--no-color (the latter via allowNegative above).
        format: { type: 'string' },
        quiet: { type: 'boolean' },
        color: { type: 'boolean' },
        'fail-fast': { type: 'boolean' },
        'include-deps': { type: 'boolean' },
        strict: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean' },
      },
    });

    if (values.help === true) {
      return { kind: 'help', text: HELP_TEXT };
    }

    if (values.version === true) {
      return { kind: 'version', text: packageManifest.version + '\n' };
    }

    const tsConfig = values.tsConfig;

    if (tsConfig === undefined || tsConfig.length === 0) {
      return {
        kind: 'usageError',
        message:
          'angular-typechecker: missing required --tsConfig (-c) option. Pass at least one tsconfig path.',
      };
    }

    let maxWarnings: number | undefined;
    const rawMaxWarnings = values['max-warnings'];

    if (rawMaxWarnings !== undefined) {
      // D-08: accept ONLY a plain non-negative decimal integer. Guard the RAW
      // string with /^\d+$/ BEFORE Number(): a bare Number() coercion is too
      // lenient -- it also accepts '' -> 0 (a silent flip to the strictest gate),
      // '1e3' -> 1000, '0x10' -> 16, and ' 5 ' -> 5, none of which are "a
      // non-negative integer" the help text promises. `--max-warnings 0` stays valid.
      if (!/^\d+$/.test(rawMaxWarnings)) {
        return {
          kind: 'usageError',
          message: `angular-typechecker: --max-warnings expects a non-negative integer, got "${rawMaxWarnings}".`,
        };
      }

      maxWarnings = Number(rawMaxWarnings);
    }

    // FMT-01 (D-08): validate --format against the enum, mirroring the
    // --max-warnings guard. An out-of-enum value is a usage error (exit 2). The
    // cast in the return is safe by construction -- this guard rejects everything
    // that is not one of the three members (undefined defaults to 'human').
    const rawFormat = values.format;

    if (
      rawFormat !== undefined &&
      !['human', 'json', 'sarif'].includes(rawFormat)
    ) {
      return {
        kind: 'usageError',
        message: `angular-typechecker: --format expects one of human, json, sarif, got "${rawFormat}".`,
      };
    }

    return {
      kind: 'options',
      tsConfig,
      maxWarnings,
      format: (rawFormat ?? 'human') as 'human' | 'json' | 'sarif',
      quiet: values.quiet ?? false,
      color: values.color,
      failFast: values['fail-fast'] ?? false,
      includeDeps: values['include-deps'] ?? false,
      strict: values.strict ?? false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      kind: 'usageError',
      message: `angular-typechecker: ${message}`,
    };
  }
}
