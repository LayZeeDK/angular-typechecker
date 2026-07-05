// Spike 007 -- G3 + G4: forced @storybook/angular@10.4.6 on the OFFICIAL stack
// (Angular 22.0.4 / TS 6.0.3), peer-conflict-installed via --legacy-peer-deps.
//
//   G3: performCompilation runs with NO infra failure AND a clean story passes
//       clean (zero IN-PROJECT diagnostics). Tested twice: skipLibCheck:true
//       (realistic Angular default) and skipLibCheck:false (adversarial -- forces
//       SB10's .d.ts to be checked under TS6; proves any such errors are
//       node_modules-attributed and SUPPRESSED, never leaking in-project -- the D4
//       contingency).
//   G4: NG8xxx fire POSITIVELY on stories/aggregated components (a fixture goes
//       RED). broken-core => NG8002 core template error; broken-extended => an
//       NG81xx extended diagnostic promoted to ERROR via defaultCategory.
//
// Mirrors the real engine by copying its pure functions VERBATIM (per
// CONVENTIONS.md): EMIT_NEUTRALIZING_OPTIONS + runNoEmitCompilation +
// gatherAllDiagnostics (gather-diagnostics.ts), filterDiagnostics + canonicalizer
// (filter-diagnostics.ts), and finalize's sort/dedup + explicit category counts
// (run-typecheck.ts).
//
// Run FROM THE SCAFFOLD (so @storybook/angular + the pinned toolchain resolve):
//   node <scaffold>/harness.mjs
// Exits 0 iff all assertions pass; writes forensic-log.json.

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const ts = tsDefault.default ?? tsDefault;
const req = createRequire(import.meta.url);
const versions = {
  node: process.version,
  typescript: ts.version,
  '@angular/compiler-cli': req('@angular/compiler-cli/package.json').version,
  '@angular/core': req('@angular/core/package.json').version,
  '@storybook/angular': req('@storybook/angular/package.json').version,
  storybook: req('storybook/package.json').version,
  platform: process.platform,
};

// ---- engine functions copied VERBATIM from packages/angular-typechecker/src/core ----

const EMIT_NEUTRALIZING_OPTIONS = {
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

function runNoEmitCompilation(parsed) {
  return ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, ...EMIT_NEUTRALIZING_OPTIONS },
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
}

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
    const canonical = options.useCaseSensitiveFileNames ? real : real.toLowerCase();
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
  const dirWithSeparator = canonicalDir.endsWith('/') ? canonicalDir : canonicalDir + '/';
  return canonicalFile.startsWith(dirWithSeparator);
}

function filterDiagnostics(diagnostics, options) {
  if (options.includeDeps) {
    return { kept: [...diagnostics], suppressedCount: 0, suppressedNodeModules: 0 };
  }
  const canonicalize = createCanonicalizer(options);
  const canonicalBase = canonicalize(options.basePath);
  const kept = [];
  let suppressedCount = 0;
  let suppressedNodeModules = 0;
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
    const inNodeModules = isNodeModulesPath(canonicalFile);
    if (inNodeModules || !isUnderDir(canonicalFile, canonicalBase)) {
      suppressedCount++;
      if (inNodeModules) {
        suppressedNodeModules++;
      }
      continue;
    }
    kept.push(diagnostic);
  }
  return { kept, suppressedCount, suppressedNodeModules };
}

function resolveFilterBasePath(parsedBasePath, tsConfigPath) {
  if (parsedBasePath !== undefined && parsedBasePath !== '') {
    return parsedBasePath;
  }
  return dirname(tsConfigPath);
}

// ---- spike-specific run + assertions ----

// Angular encodes NG codes as ts.Diagnostic.code === -(990000 + ngNumber):
// NG8002 => -998002, NG3004 => -993004. Recover the NG number, or null.
function ngNumber(code) {
  if (code < 0 && -code > 990000 && -code < 1000000) {
    return -code - 990000;
  }
  return null;
}

function describe(diag) {
  return {
    code: diag.code,
    ng: ngNumber(diag.code),
    category: ts.DiagnosticCategory[diag.category],
    file: diag.file ? diag.file.fileName.replace(/\\/g, '/').split('/').slice(-2).join('/') : null,
    message: ts.flattenDiagnosticMessageText(diag.messageText, ' ').slice(0, 140),
  };
}

function runScenario(tsconfigAbs) {
  const parsed = ng.readConfiguration(tsconfigAbs, { suppressOutputPathCheck: true });
  const configErrors = [...parsed.errors];
  const out = { tsconfig: tsconfigAbs.replace(/\\/g, '/'), threw: null, infra: null };
  try {
    const comp = runNoEmitCompilation(parsed);
    if (comp.program === undefined) {
      throw new Error('performCompilation returned no Program');
    }
    const infra = comp.diagnostics.find((d) => d.code === ng.UNKNOWN_ERROR_CODE);
    out.infra = infra ? ts.flattenDiagnosticMessageText(infra.messageText, '\n') : null;

    const useCase = comp.program.getTsProgram().useCaseSensitiveFileNames();
    const raw = [...configErrors, ...comp.diagnostics];
    const filtered = filterDiagnostics(raw, {
      basePath: resolveFilterBasePath(parsed.options.basePath, tsconfigAbs),
      includeDeps: false,
      useCaseSensitiveFileNames: useCase,
      realpath: (p) => ts.sys.realpath?.(p) ?? p,
    });
    const reported = ts.sortAndDeduplicateDiagnostics(filtered.kept);
    out.rootNamesCount = parsed.rootNames.length;
    out.rawCount = raw.length;
    out.suppressedCount = filtered.suppressedCount;
    out.suppressedNodeModules = filtered.suppressedNodeModules;
    out.inProject = reported.map(describe);
    out.errorCount = reported.filter((d) => d.category === ts.DiagnosticCategory.Error).length;
    out.warningCount = reported.filter((d) => d.category === ts.DiagnosticCategory.Warning).length;
  } catch (e) {
    out.threw = String((e && e.stack) || e);
  }
  return out;
}

const HERE = import.meta.dirname;
const FIX = join(HERE, 'fixture');

const scenarios = {
  cleanSkipLib: runScenario(join(FIX, 'clean', 'tsconfig.skiplib.json')),
  cleanLibCheck: runScenario(join(FIX, 'clean', 'tsconfig.libcheck.json')),
  brokenCore: runScenario(join(FIX, 'broken-core', 'tsconfig.json')),
  brokenExtended: runScenario(join(FIX, 'broken-extended', 'tsconfig.json')),
};

const results = [];
function assert(id, cond, detail) {
  const pass = !!cond;
  results.push({ id, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`);
}

// G3 -- realistic default (skipLibCheck: true)
const cs = scenarios.cleanSkipLib;
assert('G3-a1 no-infra-failure (skipLibCheck)', cs.threw === null && cs.infra === null,
  cs.threw ? `threw: ${cs.threw.split('\n')[0]}` : cs.infra ? `infra: ${cs.infra}` : 'performCompilation ran, no UNKNOWN_ERROR_CODE 500');
assert('G3-a2 clean-story-clean (skipLibCheck)', cs.threw === null && cs.inProject && cs.inProject.length === 0,
  cs.inProject ? `${cs.inProject.length} in-project diagnostic(s); ${cs.suppressedNodeModules} node_modules suppressed` : 'scenario threw');

// G3 -- adversarial (skipLibCheck: false): SB10 .d.ts errors, if any, must be node_modules-attributed + suppressed
const cl = scenarios.cleanLibCheck;
assert('G3-b1 no-infra-failure (libCheck)', cl.threw === null && cl.infra === null,
  cl.threw ? `threw: ${cl.threw.split('\n')[0]}` : cl.infra ? `infra: ${cl.infra}` : 'performCompilation ran, no UNKNOWN_ERROR_CODE 500');
assert('G3-b2 no-in-project-leak (libCheck)', cl.threw === null && cl.inProject && cl.inProject.length === 0,
  cl.inProject ? `${cl.inProject.length} in-project diagnostic(s); ${cl.suppressedCount} suppressed (${cl.suppressedNodeModules} node_modules) -- SB10 .d.ts noise stays out-of-project` : 'scenario threw');

// G4 -- core NG8xxx fires POSITIVELY (RED)
const bc = scenarios.brokenCore;
const bcNg = (bc.inProject || []).filter((d) => d.ng !== null && d.ng >= 8000 && d.ng <= 8099 && d.category === 'Error');
assert('G4-core NG80xx-error-fires', bcNg.length > 0,
  bc.inProject ? `in-project NG80xx errors: ${JSON.stringify(bcNg.map((d) => 'NG' + d.ng))}` : 'scenario threw');

// G4 -- extended NG81xx fires POSITIVELY, promoted to ERROR
const be = scenarios.brokenExtended;
const beNg = (be.inProject || []).filter((d) => d.ng !== null && ((d.ng >= 8100 && d.ng <= 8199) || d.ng === 8011 || d.ng === 8021));
const beNgErr = beNg.filter((d) => d.category === 'Error');
assert('G4-ext NG81xx-extended-fires', beNg.length > 0,
  be.inProject ? `in-project extended diags: ${JSON.stringify(beNg.map((d) => 'NG' + d.ng + '/' + d.category))}` : 'scenario threw');
assert('G4-ext promoted-to-error', beNgErr.length > 0,
  `extendedDiagnostics.defaultCategory:"error" promoted ${beNgErr.length} extended diag(s) to Error (RED)`);

const allPass = results.every((r) => r.pass);
const verdict = allPass
  ? 'VALIDATED -- G3 = YES (forced SB10 compiles, clean stays clean) & G4 = YES (NG8xxx fire RED)'
  : 'FAILED';

writeFileSync(join(HERE, 'forensic-log.json'), JSON.stringify({
  spike: '007-forced-sb10-compile-ng8xxx',
  gates: ['G3', 'G4'],
  environment: versions,
  install: 'npm install --legacy-peer-deps (ERESOLVE: @storybook/angular@10.4.6 peer @angular-devkit/build-angular >=18 <22 -> @21.2.18 peer @angular/compiler-cli@^21 vs official 22.0.4)',
  scenarios,
  assertions: results,
  verdict,
}, null, 2));

console.log(`\nVERDICT: ${verdict}`);
process.exit(allPass ? 0 : 1);
