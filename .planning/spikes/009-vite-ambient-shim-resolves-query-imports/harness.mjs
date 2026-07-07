// Spike 009 -- vite ambient-shim resolves query imports (hermetic leg)
// Runs the SAME story sources under three tsconfig variants via the REAL engine entry points
// (@angular/compiler-cli readConfiguration + performCompilation) and categorizes the diagnostics.
//
//   baseline     -- no ambient decls
//   hand-shim    -- a hand `declare module '*?raw'|'*?url'|'*?worker'` .d.ts (deliberately partial)
//   vite-client  -- `"types": ["vite/client"]` (the full query family)
//
// Question: does an ambient shim drop the Vite ?query TS2307 to zero WITHOUT masking a genuine
// missing module (no-false-pass)?  Run: node .planning/spikes/009-*/harness.mjs   (from repo root)
import * as ng from '@angular/compiler-cli';
import tsDefault from 'typescript';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const ts = tsDefault.default ?? tsDefault;
const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixture');

function classify(tsConfigPath) {
  const { options, rootNames, errors } = ng.readConfiguration(tsConfigPath);
  if (errors && errors.length) {
    // config-load errors are not what we measure; surface them but continue
    for (const e of errors) {
      console.log('  [config-error]', ts.flattenDiagnosticMessageText(e.messageText, '\n'));
    }
  }
  const { diagnostics } = ng.performCompilation({
    rootNames,
    options: { ...options, noEmit: true },
  });

  const ts2307 = { query: [], plain: [] };
  let ts2322 = 0;
  for (const d of diagnostics) {
    if (d.code === 2307) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const m = /Cannot find module '([^']+)'/.exec(msg);
      const spec = m ? m[1] : '<?>';
      (spec.includes('?') ? ts2307.query : ts2307.plain).push(spec);
    } else if (d.code === 2322) {
      ts2322 += 1;
    }
  }
  return { rootNames: rootNames.length, ts2307, ts2322 };
}

const variants = {
  baseline: 'tsconfig.baseline.json',
  'hand-shim': 'tsconfig.hand-shim.json',
  'vite-client': 'tsconfig.vite-client.json',
};

const results = {};
for (const [name, file] of Object.entries(variants)) {
  const r = classify(join(FIX, file));
  results[name] = r;
  console.log(`\n=== ${name} (${file}) ===`);
  console.log(`  rootNames: ${r.rootNames}`);
  console.log(`  TS2307 query (${r.ts2307.query.length}): ${r.ts2307.query.sort().join(', ') || '(none)'}`);
  console.log(`  TS2307 plain (${r.ts2307.plain.length}): ${r.ts2307.plain.sort().join(', ') || '(none)'}`);
  console.log(`  TS2322 misuse: ${r.ts2322}`);
}

// --- Assertions (strict; pinned by-hand expectations) ---
const A = [];
const chk = (id, cond, detail) => A.push({ id, pass: !!cond, detail });

chk('baseline-query-5', results.baseline.ts2307.query.length === 5, `baseline query TS2307 = ${results.baseline.ts2307.query.length} (expect 5)`);
chk('baseline-plain-1', results.baseline.ts2307.plain.length === 1, `baseline plain TS2307 = ${results.baseline.ts2307.plain.length} (expect 1: ./does-not-exist)`);
chk('baseline-no-ts2322', results.baseline.ts2322 === 0, `baseline TS2322 = ${results.baseline.ts2322} (expect 0: raw import is 'any' unresolved)`);

// hand shim covers ?raw/?url/?worker but NOT ?inline -> 1 residual query TS2307 (extra?inline)
chk('handshim-query-1', results['hand-shim'].ts2307.query.length === 1, `hand-shim query TS2307 = ${results['hand-shim'].ts2307.query.length} (expect 1: ./extra?inline undeclared)`);
chk('handshim-residual-is-inline', (results['hand-shim'].ts2307.query[0] || '').includes('?inline'), `hand-shim residual = ${results['hand-shim'].ts2307.query[0]} (expect ?inline)`);
chk('handshim-plain-still-1', results['hand-shim'].ts2307.plain.length === 1, `hand-shim plain TS2307 = ${results['hand-shim'].ts2307.plain.length} (expect 1: no-false-pass preserved)`);
chk('handshim-types-real', results['hand-shim'].ts2322 === 1, `hand-shim TS2322 = ${results['hand-shim'].ts2322} (expect 1: ?raw typed string, misuse still errors)`);

// vite/client covers the FULL query family -> 0 query TS2307, plain still fails
chk('viteclient-query-0', results['vite-client'].ts2307.query.length === 0, `vite-client query TS2307 = ${results['vite-client'].ts2307.query.length} (expect 0)`);
chk('viteclient-plain-still-1', results['vite-client'].ts2307.plain.length === 1, `vite-client plain TS2307 = ${results['vite-client'].ts2307.plain.length} (expect 1: ./does-not-exist STILL fails -- no-false-pass)`);
chk('viteclient-types-real', results['vite-client'].ts2322 === 1, `vite-client TS2322 = ${results['vite-client'].ts2322} (expect 1: real types, misuse still errors)`);

// blind spot: a ?raw import of a NONEXISTENT base (ghost.md?raw) is resolved by the wildcard in both
// shims -- neither can verify base existence through an ambient wildcard (documented limitation).
const ghostResolvedHand = !results['hand-shim'].ts2307.query.some((s) => s.includes('ghost'));
const ghostResolvedVite = !results['vite-client'].ts2307.query.some((s) => s.includes('ghost'));
chk('blindspot-ghost-resolved', ghostResolvedHand && ghostResolvedVite, `ghost.md?raw (missing base) resolved by wildcard in both shims = ${ghostResolvedHand && ghostResolvedVite} (documented blind spot)`);

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
      spike: '009',
      environment: {
        angularCompilerCli: ng.VERSION?.full ?? 'unknown',
        typescript: ts.version,
        node: process.version,
      },
      results,
      assertions: A,
      verdict,
    },
    null,
    2,
  ) + '\n',
);
process.exit(allPass ? 0 : 1);
