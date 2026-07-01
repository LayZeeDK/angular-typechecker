// Spike 002 -- module-boundary guard.
//
// Two boundaries must be shown to be DISTINCT and COMPOSABLE:
//   (WALK boundary, NEW)       which referenced tsconfigs become leaves. An out-of-project
//                              reference (../outsider/tsconfig.lib.json) must be SKIPPED, and
//                              includeDeps=true must NOT resurrect it (it governs imported
//                              SOURCES, not REFERENCES).
//   (DIAGNOSTIC boundary, OLD) which imported dep-source diagnostics get reported. Governed by
//                              the EXISTING filter-diagnostics (basePath = project dir) +
//                              includeDeps -- UNCHANGED by the walk.
//
// Fixture: solution project/tsconfig.json references [./tsconfig.lib.json (in),
// ../outsider/tsconfig.lib.json (out)]. The in-project leaf's consumer imports an in-project
// path-mapped dep (@in/dep, error) and an out-of-project one (@ext/dep, error). outsider has
// its own error.
//
// Run:  node .planning/spikes/002-module-boundary-guard/harness.mjs

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';

const ts = tsDefault.default ?? tsDefault;

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixture');
const projectDir = join(fixtureDir, 'project');
const solutionTsConfig = join(projectDir, 'tsconfig.json');

// ---- engine mirrors (verbatim from gather-diagnostics.ts / filter-diagnostics.ts / run-typecheck.ts) ----
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

function createCanonicalizer(options) {
  const cache = new Map();
  return (filePath) => {
    const cached = cache.get(filePath);
    if (cached !== undefined) return cached;
    let resolved;
    try {
      resolved = options.realpath(filePath);
    } catch {
      return undefined;
    }
    const real = resolved.replace(/\\/g, '/');
    const canonical = options.useCaseSensitiveFileNames ? real : real.toLowerCase();
    cache.set(filePath, canonical);
    return canonical;
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
  if (options.includeDeps) return { kept: [...diagnostics], suppressedCount: 0 };
  const canonicalize = createCanonicalizer(options);
  const canonicalBase = canonicalize(options.basePath);
  const kept = [];
  let suppressedCount = 0;
  for (const d of diagnostics) {
    if (d.file === undefined || d.file.fileName === '') {
      kept.push(d);
      continue;
    }
    const cf = canonicalize(d.file.fileName);
    if (cf === undefined) {
      kept.push(d);
      continue;
    }
    if (isNodeModulesPath(cf) || !isUnderDir(cf, canonicalBase)) {
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

// THE WALK BOUNDARY GUARD: a referenced leaf is in-project iff its resolved config
// path is under the project dir (dirname of the solution tsconfig). This mirrors the
// diagnostic filter's basePath choice (D-05/D-06): path-containment, canonicalized.
function isInProjectReference(leafConfigPath) {
  const cf = canonicalize(leafConfigPath);
  const base = canonicalize(projectDir);
  if (cf === undefined || base === undefined) return false;
  return isUnderDir(cf, base);
}

function runLeaf(leafTsConfig) {
  const parsed = ng.readConfiguration(leafTsConfig, { suppressOutputPathCheck: true });
  if (parsed.rootNames.length === 0) return [...parsed.errors];
  const result = ng.performCompilation({
    rootNames: parsed.rootNames,
    options: overrideOptions(parsed.options),
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
  return [...parsed.errors, ...result.diagnostics];
}

function finalizeUnion(rawUnion, includeDeps) {
  const filtered = filterDiagnostics(rawUnion, {
    basePath: projectDir,
    includeDeps,
    useCaseSensitiveFileNames: caseSensitive,
    realpath: (p) => ts.sys.realpath?.(p) ?? p,
  });
  const reported = ts.sortAndDeduplicateDiagnostics(filtered.kept);
  const errorCount = reported.filter((d) => d.category === ts.DiagnosticCategory.Error).length;
  return { reported, errorCount, suppressedCount: filtered.suppressedCount };
}

function hasErrorInFile(reported, fileSuffix) {
  return reported.some(
    (d) =>
      d.file &&
      d.file.fileName.replace(/\\/g, '/').endsWith(fileSuffix) &&
      d.category === ts.DiagnosticCategory.Error,
  );
}

// ---- drive ----
const solutionParsed = ng.readConfiguration(solutionTsConfig, { suppressOutputPathCheck: true });
const allReferences = (solutionParsed.projectReferences ?? []).map((r) =>
  resolveReferenceToConfigFile(r.path),
);

const walked = allReferences.filter(isInProjectReference);
const skipped = allReferences.filter((r) => !isInProjectReference(r));

// GUARDED walk: only in-project leaves.
const guardedRaw = walked.flatMap(runLeaf);
const guardedDefault = finalizeUnion(guardedRaw, false);
const guardedIncludeDeps = finalizeUnion(guardedRaw, true);

// NO-GUARD baseline: walk EVERY reference (including outsider) -- to prove the guard
// is what suppresses the out-of-project reference (esp. under includeDeps=true).
const noGuardRaw = allReferences.flatMap(runLeaf);
const noGuardIncludeDeps = finalizeUnion(noGuardRaw, true);

const IN = 'indep/src/index.ts';
const EXT = 'external-dep/src/index.ts';
const OUT = 'outsider/src/outsider.component.ts';

const assertions = [
  {
    id: 'M1a-guard-skips-out-of-project-reference',
    pass: skipped.length === 1 && skipped[0].replace(/\\/g, '/').endsWith('outsider/tsconfig.lib.json') && walked.length === 1,
    detail: `walked=${walked.length} skipped=${JSON.stringify(skipped.map((s) => s.replace(fixtureDir, '<fx>')))}`,
  },
  {
    id: 'M1b-outsider-absent-default',
    pass: !hasErrorInFile(guardedDefault.reported, OUT),
    detail: 'outsider error absent under guarded includeDeps=false',
  },
  {
    id: 'M1c-outsider-absent-even-with-includeDeps',
    pass: !hasErrorInFile(guardedIncludeDeps.reported, OUT),
    detail: 'CRUX: includeDeps=true does NOT resurrect the out-of-project REFERENCE (guard skipped its leaf)',
  },
  {
    id: 'M1d-no-guard-baseline-would-leak-outsider',
    pass: hasErrorInFile(noGuardIncludeDeps.reported, OUT),
    detail: 'contrast: WITHOUT the guard, walking every reference + includeDeps=true DOES leak the outsider error -- so the guard is load-bearing',
  },
  {
    id: 'M2a-external-dep-suppressed-default',
    pass: !hasErrorInFile(guardedDefault.reported, EXT) && guardedDefault.suppressedCount >= 1,
    detail: `external dep source suppressed by existing filter (suppressedCount=${guardedDefault.suppressedCount})`,
  },
  {
    id: 'M2b-external-dep-kept-with-includeDeps',
    pass: hasErrorInFile(guardedIncludeDeps.reported, EXT),
    detail: 'external dep source KEPT with includeDeps=true -- existing behavior UNCHANGED',
  },
  {
    id: 'M2c-in-project-dep-reported-default',
    pass: hasErrorInFile(guardedDefault.reported, IN),
    detail: 'local path-mapped dep source (under project) reported by default -- existing behavior UNCHANGED',
  },
];

const allPass = assertions.every((a) => a.pass);

const rel = (p) => p.replace(fixtureDir, '<fx>').replace(/\\/g, '/');
const forensic = {
  spike: '002-module-boundary-guard',
  environment: { node: process.version, typescript: ts.version },
  solutionTsConfig: rel(solutionTsConfig),
  projectDir: rel(projectDir),
  allReferences: allReferences.map(rel),
  walked: walked.map(rel),
  skipped: skipped.map(rel),
  guardedDefault: {
    errorCount: guardedDefault.errorCount,
    suppressedCount: guardedDefault.suppressedCount,
    files: guardedDefault.reported.filter((d) => d.file).map((d) => rel(d.file.fileName)),
  },
  guardedIncludeDeps: {
    errorCount: guardedIncludeDeps.errorCount,
    files: guardedIncludeDeps.reported.filter((d) => d.file).map((d) => rel(d.file.fileName)),
  },
  noGuardIncludeDeps: {
    errorCount: noGuardIncludeDeps.errorCount,
    files: noGuardIncludeDeps.reported.filter((d) => d.file).map((d) => rel(d.file.fileName)),
  },
  assertions,
  verdict: allPass ? 'VALIDATED' : 'FAILED',
};

writeFileSync(join(here, 'forensic-log.json'), JSON.stringify(forensic, null, 2));

console.log('=== Spike 002: module-boundary guard ===');
console.log(`env: node ${process.version} | ts ${ts.version}`);
console.log(`references: ${allReferences.length} -> walked ${walked.length}, skipped ${skipped.length}`);
console.log(`  walked : ${forensic.walked.join(', ')}`);
console.log(`  skipped: ${forensic.skipped.join(', ')}`);
console.log('--- guarded, includeDeps=false (default) ---');
console.log(`  errorCount=${guardedDefault.errorCount} suppressed=${guardedDefault.suppressedCount} files=${JSON.stringify(forensic.guardedDefault.files)}`);
console.log('--- guarded, includeDeps=true ---');
console.log(`  errorCount=${guardedIncludeDeps.errorCount} files=${JSON.stringify(forensic.guardedIncludeDeps.files)}`);
console.log('--- NO-GUARD baseline, includeDeps=true ---');
console.log(`  errorCount=${noGuardIncludeDeps.errorCount} files=${JSON.stringify(forensic.noGuardIncludeDeps.files)}`);
console.log('--- assertions ---');
for (const a of assertions) console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
console.log(`\nVERDICT: ${forensic.verdict}`);

process.exit(allPass ? 0 : 1);
