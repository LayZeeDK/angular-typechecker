// Spike 008 -- G1 + G5: external-template diagnostic attribution + ownership signal.
//
//   G1 (branch selector): a component with an EXTERNAL templateUrl .html carrying
//       a real NG8002 (core) AND an NG8102 (extended). Inspect diagnostic.file.fileName:
//       do template diagnostics attribute to the component .ts or to the .html?
//         .ts  -> D2(d) branch: keep-rule (c) already covers them (component .ts is a
//                 rootName); ship (a)-(c) + a .html-attribution tripwire.
//         .html-> D2(d) branch: needs (d); G5 then decides 4a vs 4b.
//   G5 (only decisive if G1 == .html): can an owning-component->external-template map
//       be built from a STABLE PUBLIC signal (e.g. relatedInformation back to the
//       component .ts) WITHOUT ngtsc internals? PASS -> ship 4a; FAIL -> ship 4b fallback.
//
// Storybook-free: pure @angular/compiler-cli behavior on the official stack (the
// workspace's 22.0.4). Copies the engine's gatherer VERBATIM.
//
// Run: node .planning/spikes/008-external-template-attribution/harness.mjs

import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ts = tsDefault.default ?? tsDefault;
const req = createRequire(import.meta.url);
const versions = {
  node: process.version,
  typescript: ts.version,
  '@angular/compiler-cli': req('@angular/compiler-cli/package.json').version,
  '@angular/core': req('@angular/core/package.json').version,
  platform: process.platform,
};

// ---- engine functions copied VERBATIM (gather-diagnostics.ts) ----
const EMIT_NEUTRALIZING_OPTIONS = {
  noEmit: true, composite: false, declaration: false, declarationMap: false,
  emitDeclarationOnly: false, incremental: false, tsBuildInfoFile: undefined,
  sourceMap: undefined, inlineSourceMap: undefined, inlineSources: undefined,
  declarationDir: undefined, mapRoot: undefined, sourceRoot: undefined, diagnostics: false,
};

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

function runNoEmitCompilation(parsed) {
  return ng.performCompilation({
    rootNames: parsed.rootNames,
    options: { ...parsed.options, ...EMIT_NEUTRALIZING_OPTIONS },
    emitFlags: 0,
    gatherDiagnostics: gatherAllDiagnostics,
  });
}

// ---- spike ----
function ngNumber(code) {
  if (code < 0 && -code > 990000 && -code < 1000000) {
    return -code - 990000;
  }
  return null;
}
function ext(p) {
  if (!p) {
    return null;
  }
  const s = p.replace(/\\/g, '/');
  return s.endsWith('.html') ? 'html' : s.endsWith('.ts') ? 'ts' : 'other';
}
function base(p) {
  return p ? p.replace(/\\/g, '/').split('/').slice(-1)[0] : null;
}

const HERE = import.meta.dirname;
const tsconfig = join(HERE, 'fixture', 'tsconfig.json');

const parsed = ng.readConfiguration(tsconfig, { suppressOutputPathCheck: true });
const comp = runNoEmitCompilation(parsed);
const diags = ts.sortAndDeduplicateDiagnostics(comp.diagnostics);

// Only the template (NG8xxx) diagnostics on our fixture matter for attribution.
const ngDiags = diags
  .filter((d) => ngNumber(d.code) !== null && ngNumber(d.code) >= 8000)
  .map((d) => ({
    ng: 'NG' + ngNumber(d.code),
    category: ts.DiagnosticCategory[d.category],
    attributedTo: ext(d.file?.fileName),
    file: base(d.file?.fileName),
    relatedInformation: (d.relatedInformation ?? []).map((r) => ({
      file: base(r.file?.fileName),
      attributedTo: ext(r.file?.fileName),
      message: ts.flattenDiagnosticMessageText(r.messageText, ' ').slice(0, 80),
    })),
    message: ts.flattenDiagnosticMessageText(d.messageText, ' ').slice(0, 120),
  }));

const results = [];
function assert(id, cond, detail) {
  const pass = !!cond;
  results.push({ id, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`);
}

// 008-a: external-template diagnostics fire at all (proves external templates are checked).
assert('008-a external-template-checked', ngDiags.length > 0,
  `${ngDiags.length} NG8xxx template diagnostic(s) on the external template: ${JSON.stringify(ngDiags.map((d) => d.ng))}`);

// 008-b (G1): attribution is unambiguous (all template diags attribute to one file kind).
const attrs = [...new Set(ngDiags.map((d) => d.attributedTo))];
const g1 = attrs.length === 1 ? attrs[0] : 'mixed';
assert('008-b G1-attribution-unambiguous', attrs.length === 1,
  `template diagnostics attribute to: ${JSON.stringify(attrs)} => G1 = ${g1}`);

// 008-c (G5): only decisive if G1 == html. Can we map the .html diag back to the
// owning component .ts via a STABLE public signal (relatedInformation)?
let g5 = 'n/a (G1 != html; ownership map not needed)';
if (g1 === 'html') {
  const withTsRelated = ngDiags.filter((d) =>
    d.relatedInformation.some((r) => r.attributedTo === 'ts'));
  g5 = withTsRelated.length === ngDiags.length && ngDiags.length > 0 ? 'PASS (4a)' : 'FAIL (4b fallback)';
  assert('008-c G5-ownership-signal', withTsRelated.length === ngDiags.length,
    `${withTsRelated.length}/${ngDiags.length} .html diagnostics carry relatedInformation back to a .ts => G5 = ${g5}`);
} else {
  console.log(`[INFO] 008-c G5: ${g5}`);
}

const recommendedBranch =
  g1 === 'ts'
    ? 'D2(d) = ship (a)-(c) only + .html-attribution tripwire (keep-rule (c) covers component-.ts-attributed template diags). Confidence HIGH.'
    : g1 === 'html'
      ? (g5.startsWith('PASS')
          ? 'D2(d) 4a = owning-component->external-template map via relatedInformation (exact + isolation-correct).'
          : 'D2(d) 4b = keep every non-node_modules external-template diagnostic (never a false pass; over-report is the safe direction).')
      : 'MIXED attribution -- treat as the strict superset: 4b fallback.';

const allPass = results.every((r) => r.pass);
const verdict = `${allPass ? 'VALIDATED' : 'FAILED'} -- G1 = ${g1}; G5 = ${g5}`;

writeFileSync(join(HERE, 'forensic-log.json'), JSON.stringify({
  spike: '008-external-template-attribution',
  gates: ['G1', 'G5'],
  environment: versions,
  ngDiagnostics: ngDiags,
  g1, g5, recommendedBranch,
  assertions: results,
  verdict,
}, null, 2));

console.log(`\nG1 = ${g1} | G5 = ${g5}`);
console.log(`Recommended Phase-17 branch: ${recommendedBranch}`);
console.log(`\nVERDICT: ${verdict}`);
process.exit(allPass ? 0 : 1);
