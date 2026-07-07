// Spike 010 -- vite-query detection advisory (pure-logic; reuses spike 009's fixture)
// Question: can the tool DETERMINISTICALLY detect Vite/Analog `?query` imports to emit an ADVISORY
// (like the .mdx notice) WITHOUT auto-suppressing, and with acceptable false-positive risk?
//
// Candidate detector keys PURELY on unresolved TS2307 whose module specifier contains a `?` query.
// Rationale: TypeScript/Node module specifiers NEVER contain `?`; a `?` means a bundler (Vite/webpack)
// query. So the detector is builder-agnostic, needs no Storybook/framework coupling (charter: no
// Storybook-specific machinery), and is SELF-GATING -- once ambient decls (vite/client) resolve the
// specifiers, the TS2307 vanish and the advisory goes silent automatically.
//
// Run: node .planning/spikes/010-vite-query-detection-advisory/harness.mjs   (from repo root)
import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const ts = tsDefault.default ?? tsDefault;
const HERE = dirname(fileURLToPath(import.meta.url));
// reuse spike 009's committed fixture (do not duplicate sources)
const FIX = join(HERE, '..', '009-vite-ambient-shim-resolves-query-imports', 'fixture');

// Known Vite query suffixes (from vite/client.d.ts) -- used only to LABEL confidence, not to gate.
const KNOWN = /\?(raw|url|inline|no-inline|worker|sharedworker)(&(inline|url|no-inline))*$/;

function compile(tsConfigFile) {
  const { options, rootNames } = ng.readConfiguration(join(FIX, tsConfigFile));
  const { diagnostics } = ng.performCompilation({ rootNames, options: { ...options, noEmit: true } });
  return diagnostics;
}

// The candidate detector. Returns the advisory payload (or null when nothing to advise).
function detectViteQueryImports(diagnostics) {
  const flagged = [];
  for (const d of diagnostics) {
    if (d.code !== 2307) {
      continue;
    }
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const m = /Cannot find module '([^']+)'/.exec(msg);
    const spec = m ? m[1] : null;
    if (spec && spec.includes('?')) {
      flagged.push({ spec, known: KNOWN.test(spec) });
    }
  }
  if (flagged.length === 0) {
    return null; // self-gating: no unresolved ?query -> no advisory
  }
  const specs = [...new Set(flagged.map((f) => f.spec))].sort();
  return {
    count: specs.length,
    specifiers: specs,
    allKnown: flagged.every((f) => f.known),
    message:
      `angular-typechecker: ${specs.length} unresolved import(s) use a bundler query suffix ` +
      `(e.g. ?raw/?url/?worker/?inline). These look like Vite/Analog imports; add ` +
      `"types": ["vite/client"] (or an ambient 'declare module' shim) to the checked tsconfig. ` +
      `This is ADVISORY -- the TS2307 diagnostics are NOT suppressed (a missing module can be real).`,
  };
}

const baseDiags = compile('tsconfig.baseline.json');
const viteDiags = compile('tsconfig.vite-client.json');

const baseAdvisory = detectViteQueryImports(baseDiags);
const viteAdvisory = detectViteQueryImports(viteDiags);

// what plain (non-?query) TS2307 exist in baseline -- must NOT be flagged (false-positive control)
const basePlainMissing = baseDiags
  .filter((d) => d.code === 2307)
  .map((d) => {
    const m = /Cannot find module '([^']+)'/.exec(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    return m ? m[1] : null;
  })
  .filter((s) => s && !s.includes('?'));

console.log('=== baseline advisory ===');
console.log(baseAdvisory ? JSON.stringify(baseAdvisory, null, 2) : '(none)');
console.log('\n=== vite-client advisory (expect none -- self-gated silent) ===');
console.log(viteAdvisory ? JSON.stringify(viteAdvisory, null, 2) : '(none)');
console.log('\nplain (non-?query) missing modules in baseline (must NOT be flagged):', basePlainMissing);

const A = [];
const chk = (id, cond, detail) => A.push({ id, pass: !!cond, detail });

chk('fires-on-baseline', baseAdvisory !== null, `advisory present on baseline = ${baseAdvisory !== null}`);
chk('flags-all-5-query', baseAdvisory && baseAdvisory.count === 5, `flagged ?query specifiers = ${baseAdvisory?.count} (expect 5)`);
chk('all-known-vite', baseAdvisory && baseAdvisory.allKnown === true, `all flagged match a known Vite suffix = ${baseAdvisory?.allKnown}`);
chk(
  'no-false-positive-plain',
  baseAdvisory && !baseAdvisory.specifiers.some((s) => s.includes('does-not-exist')),
  `plain missing './does-not-exist' NOT flagged = ${baseAdvisory && !baseAdvisory.specifiers.some((s) => s.includes('does-not-exist'))}`,
);
chk('plain-miss-still-diagnosed', basePlainMissing.includes('./does-not-exist'), `plain missing still a TS2307 (never suppressed) = ${basePlainMissing.includes('./does-not-exist')}`);
chk('self-gated-silent-when-resolved', viteAdvisory === null, `advisory silent once vite/client resolves the queries = ${viteAdvisory === null}`);

let allPass = true;
console.log('\n--- assertions ---');
for (const a of A) {
  console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
  if (!a.pass) allPass = false;
}
const verdict = allPass ? 'VALIDATED' : 'FAILED';
console.log(`\nVERDICT: ${verdict}`);

writeFileSync(
  join(HERE, 'forensic-log.json'),
  JSON.stringify(
    {
      spike: '010',
      environment: { angularCompilerCli: ng.VERSION?.full ?? 'unknown', typescript: ts.version, node: process.version },
      baselineAdvisory: baseAdvisory,
      viteClientAdvisory: viteAdvisory,
      basePlainMissing,
      assertions: A,
      verdict,
    },
    null,
    2,
  ) + '\n',
);
process.exit(allPass ? 0 : 1);
