import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Program } from './compiler-cli-types';
import { NG, ngCodeOf } from './diagnostic-codes';

// HARD-01 / D-04 -- the RUNTIME half of the two-pronged drift guard. The
// build-time type gate (compiler-cli-types.drift.ts, Plan 02) asserts the real
// `api.Program` stays assignable TO the hand-written shim, which catches a
// REMOVED / renamed / signature-changed getter LOUDLY -- but it is structurally
// BLIND to two failure modes:
//
//   1. A newly-ADDED upstream diagnostic getter. TypeScript width subtyping makes
//      a `real -> shim` probe correctly ignore additions (the shim is a deliberate
//      subset), so an Angular minor that adds a NEW `get...Diagnostics` getter the
//      gatherer should arguably call slides past the type gate unseen.
//   2. The NG error-code ENCODING arithmetic. `ngErrorCode(code)` is a RUNTIME
//      function (`parseInt('-99' + code)`); `diagnostic-codes.ts` reimplements it
//      as `NG(code) = -990000 - code`. No type check can prove the two still agree.
//
// This spec closes both blind spots against the REAL
// `await import('@angular/compiler-cli')` surface (the executor's actual load
// path -- allowed in the test tier). It builds a real `NgtscProgram` from an
// existing fixture with `gatherDiagnostics: () => []` so it introspects only the
// program SHAPE (no diagnostic gathering -- fast + deterministic), then asserts:
//
//   (a) SUBSET containment -- every gathered getter is present as a function on
//       the live program (a renamed/removed getter fails loudly here even though
//       the type gate already covers removals -- defense in depth at runtime).
//   (b) ADDITIONS review -- the runtime prototype's `get*Diagnostics` getters
//       contain NO name outside the frozen gathered set; a non-empty diff is the
//       "do we now miss diagnostics?" review signal the type gate cannot raise.
//   (c) ENCODING round-trip -- `NG(n) === cli.ngErrorCode(n)` and
//       `cli.UNKNOWN_ERROR_CODE === 500`, pinned against the imported `NG`/`ngCodeOf`.
//
// Anti-pattern (RESEARCH): do NOT assert prototype EQUALITY. The live
// `NgtscProgram` prototype carries runtime-only EXTRAS the shim never declares
// (`emitXi18n`, `getApiDocumentation`, `getEmittedSourceFiles`,
// `getIndexedComponents`, `getReuseTsProgram`) -- an equality check would
// false-positive. SUBSET containment for (a) and a filtered diff for (b) are the
// correct shapes.

// The FROZEN set of getters `gather-diagnostics.ts` CALLS on `api.Program`
// (`:62-77`): 6 diagnostic getters plus `getTsProgram` (whose `.getGlobalDiagnostics`
// the COR-02 reach-through at `:80` uses). `getNgStructuralDiagnostics` is included
// for HARD-04 coverage (deliberately retained no-op-tolerant getter). Mirror this
// EXACTLY -- a divergence from `gather-diagnostics.ts` is itself a drift to catch.
const GATHERED_GETTERS = [
  'getTsProgram',
  'getTsOptionDiagnostics',
  'getNgOptionDiagnostics',
  'getTsSyntacticDiagnostics',
  'getTsSemanticDiagnostics',
  'getNgStructuralDiagnostics',
  'getNgSemanticDiagnostics',
] as const;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

// RESEARCH Open Question 2: reuse an existing fixture (`ng-baseline`) with
// `gatherDiagnostics: () => []` so the program is built (returning a real
// `NgtscProgram`) but no diagnostics are gathered -- the spec introspects the
// shape only.
const ngBaselineTsConfig = join(
  workspaceRoot,
  'fixtures',
  'ng-baseline',
  'tsconfig.app.json',
);

describe('compiler-cli-types runtime drift (real NgtscProgram getter-set + NG encoding)', () => {
  // Build the real program ONCE for the shape-introspection tests. `cli` is the
  // live ESM namespace (the executor's `await import('@angular/compiler-cli')`
  // load path). `program` is the resulting `NgtscProgram`; the empty gatherer
  // keeps the build fast + deterministic (no diagnostic work).
  let cli: typeof import('@angular/compiler-cli');
  let program: Program;

  beforeAll(async () => {
    cli = await import('@angular/compiler-cli');

    const parsed = cli.readConfiguration(ngBaselineTsConfig, {
      suppressOutputPathCheck: true,
    });
    const result = cli.performCompilation({
      rootNames: parsed.rootNames,
      options: { ...parsed.options, noEmit: true },
      emitFlags: 0,
      gatherDiagnostics: () => [],
    });

    program = result.program;
  });

  it('(a) every gathered getter is present as a function on the real NgtscProgram (renamed/removed -> loud)', () => {
    // SUBSET containment, NOT prototype equality (the runtime prototype has
    // runtime-only extras the shim never declares). A renamed/removed gathered
    // getter makes `typeof` here `'undefined'` and fails loudly.
    for (const name of GATHERED_GETTERS) {
      expect(typeof (program as unknown as Record<string, unknown>)[name]).toBe(
        'function',
      );
    }

    // COR-02 reach-through: the global-diagnostics call (`gather-diagnostics.ts:80`)
    // lives on the wrapped `ts.Program`, not on `api.Program`. Cover it explicitly.
    expect(typeof program.getTsProgram().getGlobalDiagnostics).toBe('function');

    // WR-02 reach-through: the per-file loop (`gather-diagnostics.ts:80`) iterates
    // `getTsProgram().getSourceFiles()`. Also a `ts.Program` member -- cover it so
    // the asserted runtime call-surface mirrors the gatherer's full Program surface.
    expect(typeof program.getTsProgram().getSourceFiles).toBe('function');
  });

  it('(b) flags any NEW diagnostic getter for review (the additions blind-spot the type gate cannot see)', () => {
    // Enumerate the live prototype's OWN method names, keep only the diagnostic
    // getters (`/^get.*Diagnostics$/`) plus `getTsProgram` (the COR-02 reach-through
    // entry point), then diff against the frozen gathered set. Verified EMPTY at
    // Angular 22.0.4; a non-empty `added` is the "do we now miss diagnostics?"
    // review signal -- the additions blind-spot the build-time type gate cannot raise.
    const prototype = Object.getPrototypeOf(program) as object;
    const runtimeDiagnosticGetters = Object.getOwnPropertyNames(prototype)
      .filter(
        (name) =>
          name !== 'constructor' &&
          typeof (program as unknown as Record<string, unknown>)[name] ===
            'function',
      )
      .filter(
        (name) => /^get.*Diagnostics$/.test(name) || name === 'getTsProgram',
      );

    const added = runtimeDiagnosticGetters.filter(
      (name) => !(GATHERED_GETTERS as readonly string[]).includes(name),
    );

    expect(added).toEqual([]);
  });

  it('(c) mirrors the NG error-code encoding round-trip (runtime-semantic drift the type gate cannot catch)', async () => {
    // The encoding assertions need only the namespace, not a built program.
    const runtimeCli = await import('@angular/compiler-cli');

    // `NG(n) === ngErrorCode(n)` for the canonical 4-digit NG codes the engine
    // depends on (8001/8109 extended template codes; 3004 the RES-02 TCB Fatal).
    expect(NG(8001)).toBe(runtimeCli.ngErrorCode(8001)); // -998001
    expect(NG(8109)).toBe(runtimeCli.ngErrorCode(8109)); // -998109
    expect(NG(3004)).toBe(runtimeCli.ngErrorCode(3004)); // -993004 (RES-02 TCB fatal)

    // Inverse round-trip: recover the human 4-digit code from the negative encoding.
    expect(ngCodeOf(runtimeCli.ngErrorCode(8109))).toBe(8109);

    // The infrastructure-failure sentinel the shim hard-codes (= 500) and the
    // run-typecheck infra detector compares against MUST match the real value.
    expect(runtimeCli.UNKNOWN_ERROR_CODE).toBe(500);
  });
});
