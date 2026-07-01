// Spike 001 -- reference-walk aggregation proof.
//
// Points at the hermetic solution `tsconfig.json` (files:[], references:[lib, spec]),
// resolves the leaf tsconfigs from `parsed.projectReferences`, runs `performCompilation`
// per leaf with the REAL engine's emit-neutralizing override + `gatherAllDiagnostics`,
// unions the raw diagnostics, then runs the REAL `finalize` pipeline (filter -> sort ->
// dedupe -> explicit category counts) over the union.
//
// It proves three things against the real @angular/compiler-cli@22.0.4 + typescript@6.0.3:
//   (A) COMPLETENESS -- the aggregated set is the exact set-union of what each leaf
//       reports individually (nothing lost; the spec-only TS2322 -- unreachable from the
//       lib leaf -- is present).
//   (B) DEDUPE       -- the shared source (widget.component.ts) produces its diagnostics
//       in BOTH leaf Programs (different SourceFile OBJECTS), and the union collapses them
//       to one by VALUE identity (file.path+start+length+code+message).
//   (C) COUNTS       -- errorCount/warningCount are counted explicitly on the POST-dedupe
//       set and match the by-hand expectation (no double-count of the overlap).
//
// Run:  node .planning/spikes/001-reference-walk-aggregation/harness.mjs
// Exits 0 on all-pass, 1 on any failed assertion. Writes forensic JSON to ./forensic-log.json.

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';

const ts = tsDefault.default ?? tsDefault;

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixture');
const solutionTsConfig = join(fixtureDir, 'tsconfig.json');

// ---------------------------------------------------------------------------
// Verbatim copy of the engine's unconditional all-getter (gather-diagnostics.ts).
// ---------------------------------------------------------------------------
function gatherAllDiagnostics(program) {
  const all = [];

  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics());

  for (const sourceFile of program.getTsProgram().getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    all.push(...program.getNgSemanticDiagnostics(sourceFile.fileName));
  }

  all.push(...program.getTsProgram().getGlobalDiagnostics());

  return all;
}

// ---------------------------------------------------------------------------
// Verbatim copy of the engine's project-boundary filter (filter-diagnostics.ts).
// ---------------------------------------------------------------------------
function filterDiagnostics(diagnostics, options) {
  if (options.includeDeps) {
    return { kept: [...diagnostics], suppressedCount: 0 };
  }

  const canonicalize = createCanonicalizer(options);
  const canonicalBase = canonicalize(options.basePath);

  const kept = [];
  let suppressedCount = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.file === undefined || diagnostic.file.fileName === '') {
      kept.push(diagnostic);

      continue;
    }

    const canonicalFile = canonicalize(diagnostic.file.fileName);

    if (canonicalFile === undefined) {
      kept.push(diagnostic);

      continue;
    }

    if (
      isNodeModulesPath(canonicalFile) ||
      !isUnderDir(canonicalFile, canonicalBase)
    ) {
      suppressedCount++;

      continue;
    }

    kept.push(diagnostic);
  }

  return { kept, suppressedCount };
}

function createCanonicalizer(options) {
  const cache = new Map();

  return (filePath) => {
    const cached = cache.get(filePath);

    if (cached !== undefined) {
      return cached;
    }

    let resolved;

    try {
      resolved = options.realpath(filePath);
    } catch {
      return undefined;
    }

    const real = resolved.replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames
      ? real
      : real.toLowerCase();

    cache.set(filePath, canonical);

    return canonical;
  };
}

function isNodeModulesPath(canonicalFile) {
  return canonicalFile.split('/').includes('node_modules');
}

function isUnderDir(canonicalFile, canonicalDir) {
  if (canonicalDir === undefined) {
    return true;
  }

  if (canonicalFile === canonicalDir) {
    return true;
  }

  const dirWithSeparator = canonicalDir.endsWith('/')
    ? canonicalDir
    : canonicalDir + '/';

  return canonicalFile.startsWith(dirWithSeparator);
}

// ---------------------------------------------------------------------------
// The engine's emit-neutralizing override (run-typecheck.ts), verbatim.
// ---------------------------------------------------------------------------
function overrideOptions(parsedOptions) {
  return {
    ...parsedOptions,
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

// Human-readable value identity for logging (mirrors TS' diagnosticsEqualityComparer,
// which keys on file.path -- a string -- NOT the SourceFile object).
function identityKey(diagnostic) {
  const fileName = diagnostic.file ? diagnostic.file.fileName : '<file-less>';
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

  return `${fileName}|${diagnostic.start ?? -1}|${diagnostic.length ?? -1}|${diagnostic.code}|${message}`;
}

function categoryName(category) {
  return (
    ['Warning', 'Error', 'Suggestion', 'Message'][category] ?? String(category)
  );
}

// Resolve a ProjectReference's `path` (file or directory) to a concrete config file.
function resolveReferenceToConfigFile(referencePath) {
  const absolute = resolve(referencePath);

  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    return join(absolute, 'tsconfig.json');
  }

  return absolute;
}

// Run ONE leaf tsconfig through the real engine core; return the RAW gathered
// diagnostics (pre-filter, pre-dedup) plus timing + the ts Program for object-identity
// evidence.
function runLeaf(leafTsConfig) {
  const parseStart = performance.now();
  const parsed = ng.readConfiguration(leafTsConfig, {
    suppressOutputPathCheck: true,
  });
  const parseMs = performance.now() - parseStart;

  if (parsed.rootNames.length === 0) {
    return {
      leafTsConfig,
      rootNamesCount: 0,
      raw: [...parsed.errors],
      parseMs,
      compileMs: 0,
      tsProgram: undefined,
    };
  }

  const compileStart = performance.now();
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: overrideOptions(parsed.options),
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  const compileMs = performance.now() - compileStart;

  return {
    leafTsConfig,
    rootNamesCount: parsed.rootNames.length,
    raw: [...parsed.errors, ...result.diagnostics],
    parseMs,
    compileMs,
    tsProgram: result.program ? result.program.getTsProgram() : undefined,
  };
}

// The proposed reference-walk: single finalize over the union of all leaves.
function finalizeUnion(rawUnion, basePath, useCaseSensitiveFileNames) {
  const filtered = filterDiagnostics(rawUnion, {
    basePath,
    includeDeps: false,
    useCaseSensitiveFileNames,
    realpath: (p) => ts.sys.realpath?.(p) ?? p,
  });

  const reported = ts.sortAndDeduplicateDiagnostics(filtered.kept);

  const errorCount = reported.filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  ).length;
  const warningCount = reported.filter(
    (d) => d.category === ts.DiagnosticCategory.Warning,
  ).length;

  return {
    reported,
    errorCount,
    warningCount,
    suppressedCount: filtered.suppressedCount,
    keptPreDedup: filtered.kept.length,
  };
}

// ---------------------------------------------------------------------------
// Drive the spike.
// ---------------------------------------------------------------------------
const walkStart = performance.now();

const solutionParsed = ng.readConfiguration(solutionTsConfig, {
  suppressOutputPathCheck: true,
});

const references = (solutionParsed.projectReferences ?? []).map((ref) =>
  resolveReferenceToConfigFile(ref.path),
);

const leaves = references.map((leaf) => runLeaf(leaf));

const rawUnion = leaves.flatMap((leaf) => leaf.raw);
const projectBasePath = dirname(solutionTsConfig);
const caseSensitive =
  leaves
    .find((leaf) => leaf.tsProgram)
    ?.tsProgram.useCaseSensitiveFileNames() ?? ts.sys.useCaseSensitiveFileNames;

const walk = finalizeUnion(rawUnion, projectBasePath, caseSensitive);
const walkMs = performance.now() - walkStart;

// Ground truth: what each leaf reports INDIVIDUALLY (current engine, per-leaf finalize).
const perLeafReports = leaves.map((leaf) => {
  const finalized = finalizeUnion(leaf.raw, projectBasePath, caseSensitive);

  return {
    leaf: leaf.leafTsConfig,
    rootNamesCount: leaf.rootNamesCount,
    errorCount: finalized.errorCount,
    warningCount: finalized.warningCount,
    identities: finalized.reported.map(identityKey),
  };
});

// (A) COMPLETENESS: union of per-leaf identity SETS === walk identity SET.
const perLeafIdentityUnion = new Set(
  perLeafReports.flatMap((report) => report.identities),
);
const walkIdentities = walk.reported.map(identityKey);
const walkIdentitySet = new Set(walkIdentities);

const missingFromWalk = [...perLeafIdentityUnion].filter(
  (id) => !walkIdentitySet.has(id),
);
const extraInWalk = [...walkIdentitySet].filter(
  (id) => !perLeafIdentityUnion.has(id),
);

// (B) DEDUPE: the union pre-dedup carried duplicates; the walk removed them.
const rawUnionInProject = rawUnion.filter((d) => {
  const canonicalize = createCanonicalizer({
    useCaseSensitiveFileNames: caseSensitive,
    realpath: (p) => ts.sys.realpath?.(p) ?? p,
  });
  const base = canonicalize(projectBasePath);
  if (d.file === undefined || d.file.fileName === '') return true;
  const cf = canonicalize(d.file.fileName);
  if (cf === undefined) return true;
  return !isNodeModulesPath(cf) && isUnderDir(cf, base);
});
const duplicatesCollapsed = rawUnionInProject.length - walk.reported.length;
const walkHasNoDupes = walkIdentities.length === walkIdentitySet.size;

// (B-evidence) Same shared file across two leaves: different OBJECT, same path.
const widgetFile = 'widget.component.ts';
const libProgram = leaves[0]?.tsProgram;
const specProgram = leaves[1]?.tsProgram;
const libWidgetSf = libProgram
  ?.getSourceFiles()
  .find((sf) => sf.fileName.endsWith(widgetFile));
const specWidgetSf = specProgram
  ?.getSourceFiles()
  .find((sf) => sf.fileName.endsWith(widgetFile));
const sharedObjectEvidence = {
  libHasWidget: Boolean(libWidgetSf),
  specHasWidget: Boolean(specWidgetSf),
  differentObjects:
    Boolean(libWidgetSf) &&
    Boolean(specWidgetSf) &&
    libWidgetSf !== specWidgetSf,
  samePath:
    Boolean(libWidgetSf) &&
    Boolean(specWidgetSf) &&
    libWidgetSf.path === specWidgetSf.path,
  sameFileName:
    Boolean(libWidgetSf) &&
    Boolean(specWidgetSf) &&
    libWidgetSf.fileName === specWidgetSf.fileName,
};

// (A-detail) The spec-only diagnostic must be present in the walk.
const specOnlyPresent = walkIdentities.some(
  (id) => id.includes('widget.component.spec.ts') && id.includes('|2322|'),
);

// (C) COUNTS: by-hand expectation, corrected after the first run.
//   SURPRISE (documented): an un-invoked signal getter in a TEXT INTERPOLATION
//   co-fires TWO extended warnings -- NG8117 (uninvoked-function-in-text-interpolation)
//   AND NG8109 (uninvoked-function) -- not one. Both are legitimate and both dedupe
//   correctly across the two leaves.
//   Shared widget.component.ts: 1 TS2322 (Error) + NG8117 (Warning) + NG8109 (Warning) -- ONCE after dedup.
//   Spec-only widget.component.spec.ts: 1 TS2322 (Error).
//   => errorCount 2, warningCount 2. Pin the EXACT deduped code+category multiset.
const NG = (code) => -990000 - code;
const EXPECTED_ERRORS = 2;
const EXPECTED_WARNINGS = 2;
const expectedReportedSet = [
  `Error:2322`,
  `Error:2322`,
  `Warning:${NG(8109)}`,
  `Warning:${NG(8117)}`,
].sort();
const actualReportedSet = walk.reported
  .map((d) => `${categoryName(d.category)}:${d.code}`)
  .sort();
const reportedSetMatch =
  JSON.stringify(expectedReportedSet) === JSON.stringify(actualReportedSet);
const countsMatch =
  walk.errorCount === EXPECTED_ERRORS &&
  walk.warningCount === EXPECTED_WARNINGS &&
  reportedSetMatch;

const assertions = [
  {
    id: 'A1-completeness-no-loss',
    pass: missingFromWalk.length === 0,
    detail: `identities present per-leaf but missing from walk: ${JSON.stringify(missingFromWalk)}`,
  },
  {
    id: 'A2-completeness-no-phantom',
    pass: extraInWalk.length === 0,
    detail: `identities in walk not produced by any leaf: ${JSON.stringify(extraInWalk)}`,
  },
  {
    id: 'A3-spec-only-present',
    pass: specOnlyPresent,
    detail:
      'spec-only TS2322 (reachable only via the spec leaf) is in the aggregated set',
  },
  {
    id: 'B1-dedupe-collapsed-overlap',
    pass: duplicatesCollapsed > 0,
    detail: `in-project diagnostics collapsed by dedupe: ${duplicatesCollapsed} (pre-dedup ${rawUnionInProject.length} -> ${walk.reported.length})`,
  },
  {
    id: 'B2-walk-set-has-no-dupes',
    pass: walkHasNoDupes,
    detail: `walk reported ${walkIdentities.length}, unique ${walkIdentitySet.size}`,
  },
  {
    id: 'B3-cross-program-value-dedupe',
    pass:
      sharedObjectEvidence.differentObjects &&
      sharedObjectEvidence.samePath &&
      sharedObjectEvidence.sameFileName,
    detail: `shared widget.component.ts: ${JSON.stringify(sharedObjectEvidence)} (object identity would NOT dedupe; value identity does)`,
  },
  {
    id: 'C1-explicit-counts',
    pass: countsMatch,
    detail: `errorCount ${walk.errorCount} (exp ${EXPECTED_ERRORS}), warningCount ${walk.warningCount} (exp ${EXPECTED_WARNINGS}); reported set ${JSON.stringify(actualReportedSet)} exp ${JSON.stringify(expectedReportedSet)}`,
  },
];

const allPass = assertions.every((a) => a.pass);

const forensic = {
  spike: '001-reference-walk-aggregation',
  environment: {
    node: process.version,
    typescript: ts.version,
    compilerCliUnknownErrorCode: ng.UNKNOWN_ERROR_CODE,
  },
  solutionTsConfig,
  resolvedReferences: references,
  perLeaf: perLeafReports.map((r, i) => ({
    ...r,
    parseMs: Number(leaves[i].parseMs.toFixed(1)),
    compileMs: Number(leaves[i].compileMs.toFixed(1)),
  })),
  union: {
    rawUnionCount: rawUnion.length,
    inProjectPreDedup: rawUnionInProject.length,
    walkReportedCount: walk.reported.length,
    duplicatesCollapsed,
    suppressedCount: walk.suppressedCount,
    errorCount: walk.errorCount,
    warningCount: walk.warningCount,
  },
  sharedObjectEvidence,
  walkReported: walk.reported.map((d) => ({
    file: d.file
      ? d.file.fileName.replace(fixtureDir.replace(/\\/g, '/'), '<fixture>')
      : '<file-less>',
    code: d.code,
    category: categoryName(d.category),
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n').slice(0, 90),
  })),
  timing: { walkMs: Number(walkMs.toFixed(1)) },
  assertions,
  verdict: allPass ? 'VALIDATED' : 'FAILED',
};

writeFileSync(
  join(here, 'forensic-log.json'),
  JSON.stringify(forensic, null, 2),
);

// Human summary.
console.log('=== Spike 001: reference-walk aggregation ===');
console.log(
  `env: node ${process.version} | ts ${ts.version} | @angular/compiler-cli 22.0.4`,
);
console.log(`solution: ${solutionTsConfig}`);
console.log(`resolved leaves: ${references.length}`);
for (const r of perLeafReports) {
  console.log(
    `  leaf ${r.leaf.replace(fixtureDir, '<fixture>')}: rootNames=${r.rootNamesCount} err=${r.errorCount} warn=${r.warningCount} diags=${r.identities.length}`,
  );
}
console.log('--- aggregated (walk) ---');
console.log(
  `  in-project pre-dedup=${rawUnionInProject.length} -> reported=${walk.reported.length} (collapsed ${duplicatesCollapsed}) err=${walk.errorCount} warn=${walk.warningCount} suppressed=${walk.suppressedCount}`,
);
for (const d of forensic.walkReported) {
  console.log(`    [${d.category}] ${d.code} ${d.file} :: ${d.message}`);
}
console.log('--- shared-file cross-Program evidence ---');
console.log(`  ${JSON.stringify(sharedObjectEvidence)}`);
console.log('--- assertions ---');
for (const a of assertions) {
  console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
}
console.log(`\nVERDICT: ${forensic.verdict}`);
console.log(`forensic log: ${join(here, 'forensic-log.json')}`);

process.exit(allPass ? 0 : 1);
