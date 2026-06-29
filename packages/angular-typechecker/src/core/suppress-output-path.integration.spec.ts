import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

// RES-04 / D-09 / SC4 -- real-compiler no-nuisance proof: an output-path
// overwrite-class diagnostic (TS5055 / "Cannot write file ... would overwrite
// input file" / "...overwritten by multiple input files") NEVER surfaces in the
// type-only (`noEmit:true` + `suppressOutputPathCheck:true`) flow.
//
// The companion `infra-failure.spec.ts` proves the PLACEMENT deterministically
// (the readConfiguration spy sees `{ suppressOutputPathCheck: true }` as the
// second arg, RESEARCH Open Q1 Option a). This spec proves the BEHAVIOR end to
// end against the real compiler: a fixture carrying the emit-option-collision
// shape reports NO output-path overwrite-class code.
//
// Fixture reuse: `composite-triangle` already carries `composite:true` +
// `declarationMap:true` + `emitDeclarationOnly:true` -- the closest in-repo
// emit-option-collision config that, WITHOUT the engine's emit neutralization,
// would drive output/emit option diagnostics. No new fixture is created.
//
// SAFE-UNDER-noEmit caveat (RESEARCH A3 / Pitfall 3): the output-path overwrite
// check is in TypeScript's `verifyCompilerOptions()` at the END of
// `createProgram`, gated by `!options.noEmit && !options.suppressOutputPathCheck`
// (typescript.js:129892). The engine's emit-neutralizing override sets
// `noEmit:true`, which is the PRIMARY suppressor; `suppressOutputPathCheck` is
// the `@angular/build`-parity belt. So the nuisance is inert in this flow by
// design -- the assertion below is the absence-under-suppression evidence for
// SC4 ("verified safe under noEmit:true"). The deterministic placement proof
// (Option a) lives in `infra-failure.spec.ts`; this spec does NOT temporarily
// unset `noEmit` (probe Option b is rejected in favor of the deterministic
// Option a).
//
// TS codes are RAW (no NG() encoding) -- 5055 is a TypeScript code (Pitfall 4).

const TS5055 = 5055;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const compositeTriangleTsConfig = join(
  workspaceRoot,
  'fixtures',
  'composite-triangle',
  'tsconfig.json',
);

describe('suppressOutputPathCheck (RES-04 no-nuisance, real compiler)', () => {
  it('no TS5055 / output-path overwrite-class diagnostic surfaces in the no-emit type-only flow', async () => {
    const result = await runTypecheck({
      tsConfigPath: compositeTriangleTsConfig,
    });

    const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).not.toContain(TS5055);
  });
});
