import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ng from '@angular/compiler-cli';
import { bench, describe } from 'vitest';

// Spike 003 -- Vitest `bench` re-measurement of the reference-walk double-compile cost. [Q1]
// Rigorous stats (warmup + samples + p99 + RME) replacing the hand-rolled median-of-7 in
// harness.mjs. Same fixtures, same engine mirror. The node harness stays as the assertion-bearing
// correctness cross-check (both-clean + dep-double-compiled); this file is TIMING only.

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixture');

function gatherAllDiagnostics(program: any): readonly any[] {
  const all: any[] = [];
  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());
  for (const sourceFile of program.getTsProgram().getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    all.push(...program.getNgSemanticDiagnostics(sourceFile.fileName));
  }
  all.push(...program.getTsProgram().getGlobalDiagnostics());
  return all;
}

function overrideOptions(o: any): any {
  return {
    ...o,
    noEmit: true,
    composite: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    incremental: false,
    tsBuildInfoFile: undefined,
    sourceMap: undefined,
    inlineSourceMap: undefined,
    inlineSources: undefined,
    declarationDir: undefined,
    mapRoot: undefined,
    sourceRoot: undefined,
    diagnostics: false,
  };
}

function compile(tsConfigPath: string): void {
  const parsed = (ng as any).readConfiguration(tsConfigPath, {
    suppressOutputPathCheck: true,
  });
  (ng as any).performCompilation({
    rootNames: parsed.rootNames,
    options: overrideOptions(parsed.options),
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
}

const cfg = (name: string) => join(fixtureDir, name);
const OPTS = {
  iterations: 12,
  warmupIterations: 3,
  time: 0,
  warmupTime: 0,
} as const;

describe('reference-walk double-compile [Q1]', () => {
  bench(
    'floor (1 trivial component)',
    () => compile(cfg('tsconfig.floor.json')),
    OPTS,
  );
  bench('lib leaf', () => compile(cfg('tsconfig.lib.json')), OPTS);
  bench('spec leaf', () => compile(cfg('tsconfig.spec.json')), OPTS);
  bench('dep-only', () => compile(cfg('tsconfig.dep-only.json')), OPTS);
  bench(
    'combined (single program)',
    () => compile(cfg('tsconfig.combined.json')),
    OPTS,
  );
  bench(
    'WALK (lib + spec)',
    () => {
      compile(cfg('tsconfig.lib.json'));
      compile(cfg('tsconfig.spec.json'));
    },
    OPTS,
  );
});
