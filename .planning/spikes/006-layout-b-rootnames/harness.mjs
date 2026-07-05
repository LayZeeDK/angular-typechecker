// Spike 006 -- G2: do a centralized Storybook host's widened, cross-project
// `.storybook/tsconfig.json` `include` globs materialize the aggregated files
// as the leaf's `parsed.rootNames` (DECLARED inputs), on the OFFICIAL stack
// (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3)?
//
// Primary signal: `readConfiguration(leaf).rootNames` (the board's exact
// phrasing). Cross-check: the real `performCompilation` program's
// `getRootFileNames()` (the API the Phase-17 walk reads off `result.program`),
// plus that an import-only file is a SourceFile but NOT a root.
//
// Run: node .planning/spikes/006-layout-b-rootnames/harness.mjs
// Exits 0 iff every assertion passes; 1 otherwise. Writes forensic-log.json.

import { readConfiguration, performCompilation } from '@angular/compiler-cli';
import tsDefault from 'typescript';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ts = tsDefault.default ?? tsDefault;
const require = createRequire(import.meta.url);
const cliVersion = require('@angular/compiler-cli/package.json').version;
const coreVersion = require('@angular/core/package.json').version;

const HERE = import.meta.dirname;
const FIX = join(HERE, 'fixture');
const leaf = join(FIX, 'storybook-host', '.storybook', 'tsconfig.json');

const files = {
  story: join(FIX, 'mylib', 'src', 'lib', 'my.stories.ts'), // declared by *.stories.ts glob
  comp: join(FIX, 'mylib', 'src', 'lib', 'my.component.ts'), // declared by *.component.ts glob
  main: join(FIX, 'storybook-host', '.storybook', 'main.ts'), // declared by "*.ts" glob
  helper: join(FIX, 'mylib', 'src', 'lib', 'untracked-helper.ts'), // import-only, no glob
};

// Boundary canonicalizer per CONVENTIONS.md: realpath -> slash -> case-fold.
function canon(p) {
  let r;
  try {
    r = (realpathSync.native ?? realpathSync)(p);
  } catch {
    r = p;
  }
  return r.replace(/\\/g, '/').toLowerCase();
}

const results = [];
function assert(id, cond, detail) {
  const pass = !!cond;
  results.push({ id, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`);
}

// --- G2 primary: readConfiguration().rootNames ---
const parsed = readConfiguration(leaf);
const rootSet = new Set(parsed.rootNames.map(canon));
const parseErrors = (parsed.errors ?? []).filter(
  (d) => d.category === ts.DiagnosticCategory.Error,
);

const hasStory = rootSet.has(canon(files.story));
const hasComp = rootSet.has(canon(files.comp));
const hasMain = rootSet.has(canon(files.main));
const hasHelper = rootSet.has(canon(files.helper));

assert(
  'G2-a story-in-rootNames',
  hasStory,
  `cross-project ../../mylib story ${hasStory ? 'IS' : 'is NOT'} a declared rootName`,
);
assert(
  'G2-b component-in-rootNames',
  hasComp,
  `cross-project ../../mylib component ${hasComp ? 'IS' : 'is NOT'} a declared rootName`,
);
assert(
  'G2-c storybook-main-in-rootNames',
  hasMain,
  `local .storybook/main.ts (via "*.ts") ${hasMain ? 'IS' : 'is NOT'} a rootName`,
);
assert(
  'G2-d import-only-NOT-rootName',
  !hasHelper,
  `import-only untracked-helper.ts ${hasHelper ? 'IS (unexpected)' : 'is NOT'} a rootName`,
);
assert(
  'G2-e config-parse-clean',
  parseErrors.length === 0,
  `readConfiguration produced ${parseErrors.length} config-parse error(s)`,
);

// Strict multiset: declared rootNames are EXACTLY {story, comp, main}.
const expectedDeclared = [files.story, files.comp, files.main].map(canon).sort();
const actualDeclared = [...rootSet].sort();
const exactMatch =
  actualDeclared.length === expectedDeclared.length &&
  actualDeclared.every((p, i) => p === expectedDeclared[i]);
assert(
  'G2-h rootNames-exact-multiset',
  exactMatch,
  `parsed.rootNames == {story,component,main} exactly (got ${actualDeclared.length}: ${JSON.stringify(actualDeclared)})`,
);

// --- G2 cross-check: the real performCompilation program (Phase-17's API path) ---
// SURPRISE (compiler is source of truth): program.getTsProgram().getRootFileNames()
// is a SUPERSET of parsed.rootNames -- it adds one ngtsc `.ngtypecheck.ts` shim per
// declared root (the synthetic template-type-check-block file, in-memory, not on disk).
// So the correct relationship is declared subset-of program roots, extras == shims.
const compile = { ran: false, threw: null, rootFileNames: [], sourceFileCount: 0, extras: [] };
try {
  const { program } = performCompilation({
    rootNames: parsed.rootNames,
    options: parsed.options,
  });
  const tsProgram = program.getTsProgram();
  const progRoots = new Set(tsProgram.getRootFileNames().map(canon));
  const progSources = new Set(tsProgram.getSourceFiles().map((sf) => canon(sf.fileName)));
  compile.ran = true;
  compile.rootFileNames = [...progRoots];
  compile.sourceFileCount = progSources.size;

  // Every DECLARED rootName is a program root (the property the SB-02 keep-rule needs).
  const declaredSubset = [...rootSet].every((p) => progRoots.has(p));
  assert(
    'G2-f declared-rootNames-are-program-roots',
    declaredSubset,
    `all ${rootSet.size} declared parsed.rootNames appear in program.getRootFileNames() (${progRoots.size} total)`,
  );

  // The program-root extras are EXACTLY the ngtsc `.ngtypecheck.ts` shims of the roots.
  const extras = [...progRoots].filter((p) => !rootSet.has(p));
  compile.extras = extras;
  const expectedShims = new Set([...rootSet].map((p) => p.replace(/\.ts$/i, '.ngtypecheck.ts')));
  const extrasAreShims =
    extras.length === expectedShims.size && extras.every((p) => expectedShims.has(p));
  assert(
    'G2-f2 program-root-extras-are-ngtypecheck-shims',
    extrasAreShims,
    `${extras.length} extra program root(s) are all <root>.ngtypecheck.ts shims (synthetic, no real declared file leaks in)`,
  );

  const helperSrc = progSources.has(canon(files.helper));
  const helperRoot = progRoots.has(canon(files.helper));
  assert(
    'G2-g import-only-is-sourcefile-not-root',
    helperSrc && !helperRoot,
    `helper present as SourceFile=${helperSrc}, as root=${helperRoot} (expected true/false)`,
  );
} catch (e) {
  compile.threw = String((e && e.stack) || e);
  assert('G2-f declared-rootNames-are-program-roots', false, `performCompilation threw (infra): ${e}`);
  assert('G2-f2 program-root-extras-are-ngtypecheck-shims', false, 'skipped: performCompilation threw');
  assert('G2-g import-only-is-sourcefile-not-root', false, 'skipped: performCompilation threw');
}

const allPass = results.every((r) => r.pass);
const verdict = allPass ? 'VALIDATED -- G2 = YES' : 'FAILED';

const forensic = {
  spike: '006-layout-b-rootnames',
  gate: 'G2',
  question:
    "Do a Layout-B host's widened cross-project `.storybook/tsconfig.json` include globs materialize as the leaf's parsed.rootNames (declared inputs) on the official stack?",
  environment: {
    node: process.version,
    typescript: ts.version,
    '@angular/compiler-cli': cliVersion,
    '@angular/core': coreVersion,
    platform: process.platform,
  },
  leafTsconfig: canon(leaf),
  parsedRootNames: parsed.rootNames.map(canon),
  expected: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, canon(v)])),
  compile,
  assertions: results,
  verdict,
};
writeFileSync(join(HERE, 'forensic-log.json'), JSON.stringify(forensic, null, 2));

console.log(`\nVERDICT: ${verdict}`);
process.exit(allPass ? 0 : 1);
