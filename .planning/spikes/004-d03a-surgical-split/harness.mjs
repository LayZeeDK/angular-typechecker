// Spike 004 -- D-03a surgical split.
//
// The shipped guard (run-typecheck.ts): `if (parsed.rootNames.length === 0)` -> synthesize ONE
// zero-rootNames Error and short-circuit (skip performCompilation). The surgical split keeps that
// exact trigger point but branches THREE ways when rootNames === 0:
//
//   references present AND >=1 survives the boundary guard  -> WALK the in-project leaves (001)
//   references present but NONE in-project (all out-of-proj) -> STILL synthesize the error (new msg)
//   no references (empty project)                            -> STILL synthesize the error (unchanged)
//
// And the rootNames > 0 direct-leaf path is UNTOUCHED. This spike proves each branch and shows the
// rewrite required for config-resolution.integration.spec.ts:124-130 (the solution-style-with-refs
// case flips from guard-error to walk).
//
// Run:  node .planning/spikes/004-d03a-surgical-split/harness.mjs

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';

const ts = tsDefault.default ?? tsDefault;
const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixture');

const ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001;

// ---- engine mirrors ----
function gatherAllDiagnostics(program) {
  const all = [];
  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());
  for (const sf of program.getTsProgram().getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    all.push(...program.getNgSemanticDiagnostics(sf.fileName));
  }
  all.push(...program.getTsProgram().getGlobalDiagnostics());
  return all;
}
function createCanonicalizer(o) {
  const cache = new Map();
  return (p) => {
    const c = cache.get(p);
    if (c !== undefined) return c;
    let r;
    try {
      r = o.realpath(p);
    } catch {
      return undefined;
    }
    const real = r.replace(/\\/g, '/');
    const canon = o.useCaseSensitiveFileNames ? real : real.toLowerCase();
    cache.set(p, canon);
    return canon;
  };
}
function isNodeModulesPath(f) {
  return f.split('/').includes('node_modules');
}
function isUnderDir(file, dir) {
  if (dir === undefined) return true;
  if (file === dir) return true;
  const d = dir.endsWith('/') ? dir : dir + '/';
  return file.startsWith(d);
}
function filterDiagnostics(diagnostics, options) {
  if (options.includeDeps)
    return { kept: [...diagnostics], suppressedCount: 0 };
  const canon = createCanonicalizer(options);
  const base = canon(options.basePath);
  const kept = [];
  let suppressedCount = 0;
  for (const d of diagnostics) {
    if (d.file === undefined || d.file.fileName === '') {
      kept.push(d);
      continue;
    }
    const cf = canon(d.file.fileName);
    if (cf === undefined) {
      kept.push(d);
      continue;
    }
    if (isNodeModulesPath(cf) || !isUnderDir(cf, base)) {
      suppressedCount++;
      continue;
    }
    kept.push(d);
  }
  return { kept, suppressedCount };
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
const caseSensitive = ts.sys.useCaseSensitiveFileNames;
const canonicalize = createCanonicalizer({
  useCaseSensitiveFileNames: caseSensitive,
  realpath: (p) => ts.sys.realpath?.(p) ?? p,
});

function resolveReferenceToConfigFile(referencePath) {
  const absolute = resolve(referencePath);
  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    return join(absolute, 'tsconfig.json');
  }
  return absolute;
}
function isInProjectReference(leafConfigPath, projectDir) {
  const cf = canonicalize(leafConfigPath);
  const base = canonicalize(projectDir);
  return cf !== undefined && base !== undefined && isUnderDir(cf, base);
}
function readAndCompile(tsConfigPath) {
  const parsed = ng.readConfiguration(tsConfigPath, {
    suppressOutputPathCheck: true,
  });
  if (parsed.rootNames.length === 0) {
    return { rootNames: 0, raw: [...parsed.errors] };
  }
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: overrideOptions(parsed.options),
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  return {
    rootNames: parsed.rootNames.length,
    raw: [...parsed.errors, ...result.diagnostics],
  };
}
function finalize(rawUnion, basePath) {
  const filtered = filterDiagnostics(rawUnion, {
    basePath,
    includeDeps: false,
    useCaseSensitiveFileNames: caseSensitive,
    realpath: (p) => ts.sys.realpath?.(p) ?? p,
  });
  const reported = ts.sortAndDeduplicateDiagnostics(filtered.kept);
  const errorCount = reported.filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  ).length;
  return { reported, errorCount };
}
function synthesize(messageText) {
  return {
    category: ts.DiagnosticCategory.Error,
    code: ZERO_ROOT_NAMES_DIAGNOSTIC_CODE,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText,
  };
}

// ---- THE SURGICAL SPLIT ----
function runWithSplit(entryTsConfig) {
  const parsed = ng.readConfiguration(entryTsConfig, {
    suppressOutputPathCheck: true,
  });
  const projectDir = dirname(entryTsConfig);

  // Untouched normal path: a leaf with input files compiles directly.
  if (parsed.rootNames.length > 0) {
    const { raw } = readAndCompile(entryTsConfig);
    const { reported, errorCount } = finalize(raw, projectDir);
    return {
      mode: 'compile-direct',
      rootNamesCount: parsed.rootNames.length,
      reported,
      errorCount,
    };
  }

  // rootNames === 0 -> the D-03a split.
  const references = parsed.projectReferences ?? [];

  if (references.length === 0) {
    const guard = synthesize(
      'angular-typechecker: the resolved tsconfig has no input files (empty project). ' +
        'Point the tsConfig option at a leaf tsconfig that includes source files, e.g. ' +
        'tsconfig.app.json, tsconfig.lib.json, or tsconfig.spec.json.',
    );
    return {
      mode: 'guard-error:empty-project',
      rootNamesCount: 0,
      reported: [guard],
      errorCount: 1,
    };
  }

  const resolved = references.map((r) => resolveReferenceToConfigFile(r.path));
  const inProject = resolved.filter((leaf) =>
    isInProjectReference(leaf, projectDir),
  );

  if (inProject.length === 0) {
    const guard = synthesize(
      'angular-typechecker: the resolved tsconfig is solution-style but NONE of its ' +
        `${references.length} project reference(s) resolve to an in-project leaf (all are ` +
        'out-of-project). Point the tsConfig option at an in-project leaf, or verify the ' +
        'project boundary.',
    );
    return {
      mode: 'guard-error:references-none-in-project',
      rootNamesCount: 0,
      reported: [guard],
      errorCount: 1,
    };
  }

  // WALK the in-project leaves and aggregate (spike 001 pipeline).
  const perLeaf = inProject.map(readAndCompile);
  const rawUnion = perLeaf.flatMap((l) => l.raw);
  const { reported, errorCount } = finalize(rawUnion, projectDir);
  const rootNamesCount = perLeaf.reduce((n, l) => n + l.rootNames, 0);
  return {
    mode: 'walk',
    rootNamesCount,
    reported,
    errorCount,
    walkedLeaves: inProject.length,
  };
}

// The SHIPPED guard: always errors when rootNames === 0 (no split). Used to show the regression
// the rewrite fixes for the with-refs case.
function currentEngineMode(entryTsConfig) {
  const parsed = ng.readConfiguration(entryTsConfig, {
    suppressOutputPathCheck: true,
  });
  return parsed.rootNames.length === 0 ? 'guard-error' : 'compile-direct';
}

function hasErrorInFile(reported, suffix) {
  return reported.some(
    (d) =>
      d.file &&
      d.file.fileName.replace(/\\/g, '/').endsWith(suffix) &&
      d.category === ts.DiagnosticCategory.Error,
  );
}
function codes(reported) {
  return reported.map((d) => d.code);
}

// ---- scenarios ----
const withRefs = join(fixtureDir, 'with-refs', 'tsconfig.json');
const oopRefs = join(fixtureDir, 'oop-refs', 'tsconfig.json');
const empty = join(fixtureDir, 'empty', 'tsconfig.json');
const directLeaf = join(fixtureDir, 'with-refs', 'tsconfig.lib.json');

const rWith = runWithSplit(withRefs);
const rOop = runWithSplit(oopRefs);
const rEmpty = runWithSplit(empty);
const rDirect = runWithSplit(directLeaf);

const noTs18003 = [rWith, rOop, rEmpty, rDirect].every(
  (r) => !codes(r.reported).includes(18003),
);

const assertions = [
  {
    id: 'S1-with-refs-walks',
    pass:
      rWith.mode === 'walk' &&
      rWith.rootNamesCount > 0 &&
      hasErrorInFile(rWith.reported, 'with-refs/src/broken.component.ts') &&
      !codes(rWith.reported).includes(ZERO_ROOT_NAMES_DIAGNOSTIC_CODE),
    detail: `mode=${rWith.mode} rootNames=${rWith.rootNamesCount} err=${rWith.errorCount} (walks the in-project leaf; guard NOT synthesized)`,
  },
  {
    id: 'S1b-with-refs-was-guard-error-in-shipped-engine',
    pass: currentEngineMode(withRefs) === 'guard-error',
    detail:
      'the SHIPPED engine returns guard-error here -> this is the config-resolution.integration.spec.ts:124-130 rewrite',
  },
  {
    id: 'S2-oop-refs-still-errors',
    pass:
      rOop.mode === 'guard-error:references-none-in-project' &&
      rOop.errorCount === 1 &&
      !hasErrorInFile(rOop.reported, 'outsider/src/outsider.component.ts'),
    detail: `mode=${rOop.mode} err=${rOop.errorCount} (outsider NEVER walked)`,
  },
  {
    id: 'S3-empty-still-errors',
    pass:
      rEmpty.mode === 'guard-error:empty-project' && rEmpty.errorCount === 1,
    detail: `mode=${rEmpty.mode} err=${rEmpty.errorCount} (unchanged D-03a behavior)`,
  },
  {
    id: 'S4-direct-leaf-untouched',
    pass:
      rDirect.mode === 'compile-direct' &&
      rDirect.rootNamesCount > 0 &&
      hasErrorInFile(rDirect.reported, 'with-refs/src/broken.component.ts'),
    detail: `mode=${rDirect.mode} rootNames=${rDirect.rootNamesCount} err=${rDirect.errorCount} (rootNames>0 path unchanged)`,
  },
  {
    id: 'S5-no-branch-gates-on-ts18003',
    pass: noTs18003,
    detail:
      'D-03a / L-2 preserved: no branch depends on TS18003 (references-suppressed "No inputs")',
  },
];
const allPass = assertions.every((a) => a.pass);

const summarize = (r) => ({
  mode: r.mode,
  rootNamesCount: r.rootNamesCount,
  errorCount: r.errorCount,
  codes: codes(r.reported),
});
const forensic = {
  spike: '004-d03a-surgical-split',
  environment: { node: process.version, typescript: ts.version },
  scenarios: {
    'with-refs (solution, in-project ref)': summarize(rWith),
    'oop-refs (solution, out-of-project ref only)': summarize(rOop),
    'empty (no files, no references)': summarize(rEmpty),
    'direct-leaf (rootNames > 0)': summarize(rDirect),
  },
  shippedEngineOnWithRefs: currentEngineMode(withRefs),
  decisionTree: [
    'rootNames > 0                                   -> compile-direct (UNCHANGED)',
    'rootNames === 0 && references present && >=1 in-project -> WALK',
    'rootNames === 0 && references present && 0 in-project   -> guard-error (references-none-in-project, NEW msg)',
    'rootNames === 0 && no references                -> guard-error (empty-project, UNCHANGED)',
  ],
  specRewrite:
    'config-resolution.integration.spec.ts:124-130 asserts the solution-style fixture returns ' +
    'rootNamesCount:0 + errorCount:1. Under the split, a solution config whose references resolve ' +
    'IN-project WALKS instead. Rewrite: (a) point that block at the WALK outcome (rootNamesCount>0, ' +
    'reports the leaf diagnostics -- so give the fixture leaf a known error), AND (b) add/keep a ' +
    'references-LESS empty fixture asserting the guard STILL fires. The "not TS18003" assertion is ' +
    'unchanged.',
  assertions,
  verdict: allPass ? 'VALIDATED' : 'FAILED',
};

writeFileSync(
  join(here, 'forensic-log.json'),
  JSON.stringify(forensic, null, 2),
);

console.log('=== Spike 004: D-03a surgical split ===');
console.log(`env: node ${process.version} | ts ${ts.version}`);
for (const [name, r] of Object.entries(forensic.scenarios)) {
  console.log(
    `  ${name}\n     -> mode=${r.mode} rootNames=${r.rootNamesCount} err=${r.errorCount} codes=${JSON.stringify(r.codes)}`,
  );
}
console.log(
  `  shipped engine on with-refs: ${forensic.shippedEngineOnWithRefs} (the regression the rewrite addresses)`,
);
console.log('--- assertions ---');
for (const a of assertions)
  console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
console.log(`\nVERDICT: ${forensic.verdict}`);

process.exit(allPass ? 0 : 1);
