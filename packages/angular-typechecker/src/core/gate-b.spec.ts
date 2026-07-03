import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

import type { EmitFlags } from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';
import { gatherAllDiagnostics } from './gather-diagnostics';
import { runTypecheck } from './run-typecheck';

// GATE B: prove the custom unconditional all-getter surfaces Angular template +
// extended (NG8xxx) diagnostics even when a co-located TypeScript error exists in
// the same program -- the behavior ngc's `defaultGatherDiagnostics` `&&`-chain
// provably suppresses (the load-bearing DIFFERENTIAL, D-16). Covers checklist
// items 2-6: positive, differential, breadth (app + lib), GATE A runtime guard,
// and a cold-run timing.
//
// Codes at a glance (RESEARCH-ADDENDUM-WAVE3 Finding 3):
//   - TS2322 = 2322          (raw; TypeScript codes are NOT offset)
//   - NG8109 = -998109       (Angular encodes extended codes negative:
//                             ngErrorCode(8109) = parseInt('-99' + 8109) = -998109;
//                             recover via Math.abs(c) - 990000 === 8109)
//   - NG8117 = -998117       (expected companion; UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION)
//   - UNKNOWN_ERROR_CODE = 500 (a masked ESM-load failure -- MUST be absent; T-01-10)
//
// The fixture is parsed ONCE per case; a FRESH `{ ...options, noEmit: true }` is
// spread into each `performCompilation` call so the differential never shares the
// mutated `noEmit` state of the positive run (resolved research Open Q1).

const TS2322 = 2322;
const NG8109 = -998109;
const UNKNOWN_ERROR_CODE = 500;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = findWorkspaceRoot(packageRoot);
const fixtureDir = join(workspaceRoot, 'fixtures', 'gate-b-error');

const appTsConfig = join(fixtureDir, 'tsconfig.app.json');
const libTsConfig = join(fixtureDir, 'tsconfig.lib.json');

/**
 * Runs `performCompilation` on a freshly-parsed config with the chosen gatherer
 * and returns the diagnostic codes. Both the all-getter and `defaultGatherDiagnostics`
 * are driven from the SAME parsed config but each gets its own spread `options`
 * object (no shared mutable `noEmit`). If the `await import()` of the ESM-only
 * compiler-cli failed with `ERR_REQUIRE_ESM`, this would reject -- so the awaited
 * resolution is itself the GATE A runtime proof.
 */
async function codesFor(
  tsConfigPath: string,
  useDefault: boolean,
): Promise<number[]> {
  const ng = await loadCompilerCli();
  const parsed = ng.readConfiguration(tsConfigPath);

  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, noEmit: true },
    emitFlags: 0 as EmitFlags,
    gatherDiagnostics: useDefault
      ? ng.defaultGatherDiagnostics
      : gatherAllDiagnostics,
  });

  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe.each([
  ['app tsconfig', appTsConfig],
  ['local-library tsconfig', libTsConfig],
])('GATE B (%s)', (_label, tsConfigPath) => {
  it('positive: the all-getter surfaces TS2322 AND NG8109 (-998109), with no UNKNOWN_ERROR_CODE 500', async () => {
    const allCodes = await codesFor(tsConfigPath, false);

    expect(allCodes).toContain(TS2322);
    expect(allCodes).toContain(NG8109);
    // Self-documenting recovery of the magic number's meaning: an extended NG
    // code stored negative recovers to its 4-digit ErrorCode via
    // Math.abs(c) - 990000 (here 998109 - 990000 === 8109).
    expect(allCodes.some((code) => Math.abs(code) - 990000 === 8109)).toBe(
      true,
    );
    // GATE A runtime guard: a masked ESM-load failure would surface as code 500.
    expect(allCodes).not.toContain(UNKNOWN_ERROR_CODE);
  });

  it('differential: ngc defaultGatherDiagnostics surfaces TS2322 but NOT NG8109 (the &&-chain short-circuit the all-getter overcomes)', async () => {
    const defaultCodes = await codesFor(tsConfigPath, true);

    expect(defaultCodes).toContain(TS2322);
    expect(defaultCodes).not.toContain(NG8109);
  });
});

describe('GATE B timing (cold-run wall-clock)', () => {
  it('records one cold-run durationMs from runTypecheck on the lib fixture (gate item 6)', async () => {
    const result = await runTypecheck({ tsConfigPath: libTsConfig });

    // Not a pass/fail threshold in Phase 1 -- surface the number so the SUMMARY
    // can quote it (CONTEXT.md deferred execution-detail). Deliberate test-timing
    // instrumentation: the D-11 core/** no-console ban targets core SOURCE purity,
    // not spec output, so this single line is exempted.
    // eslint-disable-next-line no-console -- deliberate GATE B timing surface
    console.log(`[GATE B timing] cold-run durationMs = ${result.durationMs}`);

    expect(result.durationMs).toBeGreaterThan(0);
    // D-01: CoreResult no longer exposes a public `codes` field; derive it from
    // the diagnostics array (L-8 reconcile -- the GATE B differential proof
    // itself is unchanged).
    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain(TS2322);
    expect(codes).toContain(NG8109);
  });
});
