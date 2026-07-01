// Spike 003 -- double-compile cost of a local non-buildable lib dep across leaves. [Q1]
//
// The reference-walk runs performCompilation ONCE PER LEAF. A local non-buildable dep whose
// SOURCE is imported by the consumer is pulled into both the lib leaf and the spec leaf, so it is
// type-checked TWICE. This benchmarks that redundancy against the single-program lower bound.
//
// Measured (median of K iterations, after a warmup):
//   t_lib      performCompilation(tsconfig.lib.json)      -- parse + compile
//   t_spec     performCompilation(tsconfig.spec.json)
//   t_depOnly  performCompilation(tsconfig.dep-only.json) -- the dep's STANDALONE weight
//   t_combined performCompilation(tsconfig.combined.json) -- lib+spec in ONE program (the ideal)
//   t_walk = t_lib + t_spec
//   tax    = t_walk - t_combined      (the walk's redundancy vs one program)
//
// Run:  node .planning/spikes/003-double-compile-cost/harness.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';

const ts = tsDefault.default ?? tsDefault;

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixture');
const ITERATIONS = 7;

function gatherAllDiagnostics(program) {
  const all = [];
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
function overrideOptions(o) {
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

function timeCompile(tsConfigPath) {
  const parseStart = performance.now();
  const parsed = ng.readConfiguration(tsConfigPath, {
    suppressOutputPathCheck: true,
  });
  const parseMs = performance.now() - parseStart;

  const compileStart = performance.now();
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: overrideOptions(parsed.options),
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  const compileMs = performance.now() - compileStart;

  const errorCount = result.diagnostics.filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  ).length;

  const depSourceFiles = result.program
    .getTsProgram()
    .getSourceFiles()
    .filter(
      (sf) =>
        !sf.isDeclarationFile &&
        sf.fileName.replace(/\\/g, '/').includes('/dep/src/'),
    ).length;

  return {
    parseMs,
    compileMs,
    totalMs: parseMs + compileMs,
    errorCount,
    rootNames: parsed.rootNames.length,
    depSourceFiles,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const min = (xs) => Math.min(...xs);
const r1 = (x) => Number(x.toFixed(1));

const lib = join(fixtureDir, 'tsconfig.lib.json');
const spec = join(fixtureDir, 'tsconfig.spec.json');
const depOnly = join(fixtureDir, 'tsconfig.dep-only.json');
const combined = join(fixtureDir, 'tsconfig.combined.json');
const floor = join(fixtureDir, 'tsconfig.floor.json');

// Warmup: loads @angular/core .d.ts + TS lib into OS cache, memoizes nothing extra but
// stabilizes the first-compile cliff so the measured iterations reflect steady state.
timeCompile(lib);
timeCompile(spec);

const samples = { lib: [], spec: [], depOnly: [], combined: [], floor: [] };
const meta = {
  lib: null,
  spec: null,
  depOnly: null,
  combined: null,
  floor: null,
};
for (let i = 0; i < ITERATIONS; i++) {
  const l = timeCompile(lib);
  const s = timeCompile(spec);
  const d = timeCompile(depOnly);
  const c = timeCompile(combined);
  const f = timeCompile(floor);
  samples.lib.push(l.totalMs);
  samples.spec.push(s.totalMs);
  samples.depOnly.push(d.totalMs);
  samples.combined.push(c.totalMs);
  samples.floor.push(f.totalMs);
  meta.lib = l;
  meta.spec = s;
  meta.depOnly = d;
  meta.combined = c;
  meta.floor = f;
}

const medLib = median(samples.lib);
const medSpec = median(samples.spec);
const medDep = median(samples.depOnly);
const medCombined = median(samples.combined);
const medFloor = median(samples.floor);
const medWalk = medLib + medSpec;
const tax = medWalk - medCombined;
const taxPct = (tax / medCombined) * 100;
// Recover the dep's MARGINAL type-check cost by subtracting the fixed per-compile floor.
const depMarginal = medDep - medFloor;
const fixedFloorPct = (medFloor / medDep) * 100;

// Validity: walk and combined must both be clean (equal diagnostic verdicts), and the dep
// source must be present in BOTH the lib and spec programs (double-compile confirmed).
const depInLib = meta.lib.depSourceFiles;
const depInSpec = meta.spec.depSourceFiles;
const depInCombined = meta.combined.depSourceFiles;

const assertions = [
  {
    id: 'V1-both-clean',
    pass:
      meta.lib.errorCount === 0 &&
      meta.spec.errorCount === 0 &&
      meta.combined.errorCount === 0,
    detail: `lib err=${meta.lib.errorCount} spec err=${meta.spec.errorCount} combined err=${meta.combined.errorCount}`,
  },
  {
    id: 'V2-dep-double-compiled',
    pass: depInLib >= 1 && depInSpec >= 1,
    detail: `dep source files in lib program=${depInLib}, in spec program=${depInSpec} (present in BOTH -> compiled twice)`,
  },
  {
    id: 'V3-tax-is-bounded',
    pass: taxPct < 150,
    detail: `walk redundancy tax = ${r1(taxPct)}% of the single-program cost (sanity bound < 150%)`,
  },
];
const allPass = assertions.every((a) => a.pass);

const forensic = {
  spike: '003-double-compile-cost',
  environment: { node: process.version, typescript: ts.version },
  iterations: ITERATIONS,
  medianMs: {
    fixedFloor: r1(medFloor),
    lib: r1(medLib),
    spec: r1(medSpec),
    depOnly: r1(medDep),
    combined_single_program: r1(medCombined),
    walk_lib_plus_spec: r1(medWalk),
  },
  minMs: {
    floor: r1(min(samples.floor)),
    lib: r1(min(samples.lib)),
    spec: r1(min(samples.spec)),
    depOnly: r1(min(samples.depOnly)),
    combined: r1(min(samples.combined)),
  },
  redundancy: {
    taxMs: r1(tax),
    taxPct: r1(taxPct),
    interpretation:
      'tax = extra wall-clock the reference-walk pays over one combined program: a second ' +
      'program init + re-checking the shared consumer+dep sources in the spec leaf. It scales ' +
      'with the NUMBER of leaves (~one fixed compile per extra leaf), not with dep size.',
    fixedFloorMs: r1(medFloor),
    fixedFloorPctOfDepOnly: r1(fixedFloorPct),
    depMarginalMs: r1(depMarginal),
    depDoubleCompileNote:
      'the dep is compiled in BOTH leaves. Its MARGINAL type-check cost is (depOnly - floor) = ' +
      `${r1(depMarginal)} ms; paid twice in the walk, so PURE dep redundancy is ~${r1(depMarginal)} ms. ` +
      `The dominant cost is the fixed per-compile floor (${r1(medFloor)} ms, ~${r1(fixedFloorPct)}% of ` +
      'a dep-only compile) -- so at THIS scale the double-compile penalty is fixed-overhead-bound, ' +
      'not dep-size-bound. At PROJECT.md scale (~15s ngc) the marginal term dominates and the ' +
      'deferred incremental-reuse synergy matters more.',
    notExtraVsMultiTarget:
      'CRITICAL FRAMING: N leaves cost ~N compiles whether the engine WALKS references behind one ' +
      'target OR the generator wires N separate targets. The walk adds no compile work vs the ' +
      'multi-target alternative; it trades finer per-leaf caching for one coarse target (see spike 005).',
  },
  depSourceFilesInProgram: {
    lib: depInLib,
    spec: depInSpec,
    combined: depInCombined,
  },
  deferredSynergy:
    'project references + NgtscProgram incremental declaration-reuse (per-file NgtscProgram ' +
    'migration, already DEFERRED in PROJECT.md) could compile the dep once and reuse its emitted ' +
    'declarations across leaves, collapsing the tax toward zero. Out of scope for the first ' +
    'reference-walk cut; the walk is correct (Approach A), just not incrementally optimal.',
  perfSummaryFromProjectMd:
    'PROJECT.md baseline: standalone ngc --noEmit ~15s vs full esbuild build ~36s at scale. This ' +
    'fixture is tiny; treat the RATIO (tax%), not the absolute ms, as the signal.',
  assertions,
  verdict: allPass ? 'VALIDATED' : 'FAILED',
};

writeFileSync(
  join(here, 'forensic-log.json'),
  JSON.stringify(forensic, null, 2),
);

console.log('=== Spike 003: double-compile cost [Q1] ===');
console.log(
  `env: node ${process.version} | ts ${ts.version} | iterations ${ITERATIONS} (median)`,
);
console.log('--- median wall-clock (parse + compile), ms ---');
console.log(
  `  fixed floor      : ${r1(medFloor)}   (1 trivial component -- pure per-compile overhead)`,
);
console.log(`  lib leaf         : ${r1(medLib)}`);
console.log(`  spec leaf        : ${r1(medSpec)}`);
console.log(
  `  dep-only         : ${r1(medDep)}   (dep marginal = ${r1(depMarginal)} above floor)`,
);
console.log(`  combined (1 prog): ${r1(medCombined)}`);
console.log(`  WALK (lib+spec)  : ${r1(medWalk)}`);
console.log(`  ---`);
console.log(
  `  redundancy tax   : ${r1(tax)} ms  (${r1(taxPct)}% over the single-program cost)`,
);
console.log(
  `  fixed floor is ${r1(fixedFloorPct)}% of a dep-only compile -> double-compile is fixed-overhead-bound at this scale`,
);
console.log(
  `  dep source files in program: lib=${depInLib} spec=${depInSpec} combined=${depInCombined}`,
);
console.log('--- assertions ---');
for (const a of assertions)
  console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
console.log('\nDEFERRED synergy:', forensic.deferredSynergy);
console.log(`\nVERDICT: ${forensic.verdict}`);

process.exit(allPass ? 0 : 1);
