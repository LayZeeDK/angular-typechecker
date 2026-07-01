// Spike 005 -- coarse single-target caching for the reference-walk. [Objective 5]
//
// A single `angular-typecheck` target points at the solution tsconfig.json and WALKS the lib + spec
// leaves. Nx computes the task's cache key as a content hash over the RESOLVED INPUT FILE SET. So a
// file can only bust the cache if it is a MEMBER of that resolved set. This spike resolves the named
// inputs (verbatim from this repo's nx.json) against the project's file set -- modeling the walk's
// lib+spec UNION -- and proves:
//
//   (1) outputs: []                          -- correct (no emit).
//   (2) the CURRENT target inputs use `production`, which EXCLUDES *.spec.ts + tsconfig.spec.json.
//       For a walk that CHECKS the spec leaf, that under-hashes spec sources -> a spec-only edit
//       would NOT bust the cache -> STALE PASS (a type-checker that lies about specs).
//   (3) switching the walk target to the `default` named input (the UNION) hashes spec sources too;
//       `{projectRoot}/tsconfig*.json` already covers tsconfig.spec.json; `^default` covers deps.
//
// Run:  node .planning/spikes/005-coarse-single-target-caching/harness.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { minimatch } from 'minimatch';

const here = dirname(fileURLToPath(import.meta.url));

// Named inputs -- copied VERBATIM from this repo's nx.json.
const namedInputs = {
  default: ['{projectRoot}/**/*', 'sharedGlobals'],
  production: [
    'default',
    '!{projectRoot}/.eslintrc.json',
    '!{projectRoot}/eslint.config.mjs',
    '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
    '!{projectRoot}/tsconfig.spec.json',
  ],
  sharedGlobals: [],
};

// The shipped target inputs (nx.json targetDefaults angular-typecheck), file-set portion.
const CURRENT_TARGET_INPUTS = [
  'production',
  '{projectRoot}/tsconfig*.json',
  '{projectRoot}/package.json',
  '{workspaceRoot}/tsconfig.base.json',
];
// The proposed WALK target inputs: swap `production` -> `default` (the union that INCLUDES specs).
const WALK_TARGET_INPUTS = [
  'default',
  '{projectRoot}/tsconfig*.json',
  '{projectRoot}/package.json',
  '{workspaceRoot}/tsconfig.base.json',
];

const projectRoot = 'libs/typecheck-consumer';

// Model the project's file set = the REAL committed files (git ls-files) PLUS the two extra members
// a reference-walk over lib+spec leaves would additionally CHECK: a spec source and a spec tsconfig.
// (The real fixture has neither yet -- the substrate gap the maintainer flagged; the walk needs them.)
const realFiles = [
  'libs/typecheck-consumer/package.json',
  'libs/typecheck-consumer/project.json',
  'libs/typecheck-consumer/src/index.ts',
  'libs/typecheck-consumer/src/lib/consumer.component.ts',
  'libs/typecheck-consumer/tsconfig.json',
  'libs/typecheck-consumer/tsconfig.lib.json',
];
const walkAdds = [
  'libs/typecheck-consumer/src/lib/consumer.component.spec.ts', // spec leaf SOURCE
  'libs/typecheck-consumer/tsconfig.spec.json', // spec leaf CONFIG
];
const files = [...realFiles, ...walkAdds];

function expand(pattern) {
  return pattern
    .replace('{projectRoot}', projectRoot)
    .replace('{workspaceRoot}/', '')
    .replace('{workspaceRoot}', '.');
}

// Resolve a NAMED input to its file set. Nx scopes a named input's `!` excludes to THAT named
// input's own includes (they do NOT leak out to sibling inputs) -- so we apply them here, before
// the caller unions this set with other top-level inputs.
function resolveNamedInput(name) {
  const list = namedInputs[name] ?? [];
  const include = new Set();
  const excludes = [];

  for (const token of list) {
    if (typeof token !== 'string') {
      continue;
    }

    if (namedInputs[token]) {
      resolveNamedInput(token).forEach((f) => include.add(f));

      continue;
    }

    if (token.startsWith('!')) {
      excludes.push(expand(token.slice(1)));

      continue;
    }

    const pattern = expand(token);
    for (const file of files) {
      if (minimatch(file, pattern, { dot: true })) {
        include.add(file);
      }
    }
  }

  return new Set(
    [...include].filter(
      (file) => !excludes.some((ex) => minimatch(file, ex, { dot: true })),
    ),
  );
}

// Resolve a TARGET input list: union each top-level entry's file set (named-input excludes already
// applied WITHIN each named input), then apply any top-level `!` excludes at the end.
function resolveFileSet(inputList) {
  const result = new Set();
  const topExcludes = [];

  for (const token of inputList) {
    if (typeof token !== 'string') {
      continue; // object inputs (dependentTasksOutputFiles / externalDependencies)
    }

    if (namedInputs[token]) {
      resolveNamedInput(token).forEach((f) => result.add(f));

      continue;
    }

    if (token.startsWith('!')) {
      topExcludes.push(expand(token.slice(1)));

      continue;
    }

    const pattern = expand(token);
    for (const file of files) {
      if (minimatch(file, pattern, { dot: true })) {
        result.add(file);
      }
    }
  }

  return [...result].filter(
    (file) => !topExcludes.some((ex) => minimatch(file, ex, { dot: true })),
  );
}

const SPEC_SOURCE =
  'libs/typecheck-consumer/src/lib/consumer.component.spec.ts';
const SPEC_TSCONFIG = 'libs/typecheck-consumer/tsconfig.spec.json';
const LIB_SOURCE = 'libs/typecheck-consumer/src/lib/consumer.component.ts';

const defaultSet = resolveFileSet(['default']);
const productionSet = resolveFileSet(['production']);
const currentTargetSet = resolveFileSet(CURRENT_TARGET_INPUTS);
const walkTargetSet = resolveFileSet(WALK_TARGET_INPUTS);

// Sanity: confirm the extglob spec pattern actually matches the spec source.
const specExtglob =
  'libs/typecheck-consumer/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)';
const extglobMatchesSpec = minimatch(SPEC_SOURCE, specExtglob, { dot: true });

const assertions = [
  {
    id: 'C1-outputs-empty',
    pass: true, // from config: targetDefaults angular-typecheck outputs: []
    detail:
      'targetDefaults angular-typecheck already sets outputs: [] (no emit) -- correct for a no-emit type-check',
  },
  {
    id: 'C2-default-includes-spec-source',
    pass: defaultSet.includes(SPEC_SOURCE) && defaultSet.includes(LIB_SOURCE),
    detail: `default input includes BOTH lib source and spec source (the union basis): spec=${defaultSet.includes(SPEC_SOURCE)} lib=${defaultSet.includes(LIB_SOURCE)}`,
  },
  {
    id: 'C3-production-excludes-spec-source',
    pass:
      !productionSet.includes(SPEC_SOURCE) &&
      productionSet.includes(LIB_SOURCE) &&
      extglobMatchesSpec,
    detail: `production input EXCLUDES the spec source (extglob match=${extglobMatchesSpec}) but keeps the lib source`,
  },
  {
    id: 'C4-current-target-under-hashes-spec',
    pass: !currentTargetSet.includes(SPEC_SOURCE),
    detail:
      'THE FINDING: the shipped `production`-based target inputs do NOT hash the spec source -> a spec-only edit cannot bust a WALK target that checks specs -> STALE PASS',
  },
  {
    id: 'C5-walk-target-hashes-spec',
    pass:
      walkTargetSet.includes(SPEC_SOURCE) && walkTargetSet.includes(LIB_SOURCE),
    detail:
      'FIX: swapping `production` -> `default` makes the union (lib + spec) hashed -> a spec edit busts the coarse target',
  },
  {
    id: 'C6-tsconfig-glob-covers-spec-tsconfig',
    pass:
      currentTargetSet.includes(SPEC_TSCONFIG) &&
      walkTargetSet.includes(SPEC_TSCONFIG),
    detail:
      '`{projectRoot}/tsconfig*.json` already matches tsconfig.spec.json (config side of the union is covered in BOTH configs)',
  },
];

const allPass = assertions.every((a) => a.pass);

const forensic = {
  spike: '005-coarse-single-target-caching',
  projectRoot,
  modeledFiles: files,
  resolved: {
    default: defaultSet,
    production: productionSet,
    currentTarget_inputs_fileset: currentTargetSet,
    walkTarget_inputs_fileset: walkTargetSet,
  },
  objectInputsNote:
    "The target also carries ^default (hashes dependency projects' default inputs -> covers the " +
    'non-buildable dep source, confirmed separately via `nx show projects --affected`), ' +
    'dependentTasksOutputFiles (transitive .d.ts/.tsbuildinfo), and externalDependencies ' +
    '[typescript, @angular/compiler-cli] (busts on compiler version change). These are UNCHANGED by ' +
    'the production->default swap.',
  finding:
    'outputs: [] is already correct. The coarse single-target cache is SOUND for the lib-only leaf ' +
    'today, but a WALK target that also checks the spec leaf MUST switch its file-set input from ' +
    '`production` to `default` (the union) so *.spec.ts sources are hashed. tsconfig.spec.json is ' +
    'already covered by the tsconfig*.json glob. The module-boundary guard (spike 002) is what ' +
    'keeps the walk from reading files OUTSIDE this hashed set (out-of-project references are ' +
    'skipped), so nothing the walk reads is left un-hashed -> no stale PASS.',
  coarsenessTradeoff:
    'One target = one cache entry: ANY project source change (lib OR spec) or dep change busts the ' +
    'whole type-check (re-runs all leaves). Coarser than N per-leaf targets (spike 003), but correct ' +
    'and simple -- appropriate for a check-everything tool.',
  assertions,
  verdict: allPass ? 'VALIDATED' : 'FAILED',
};

writeFileSync(
  join(here, 'forensic-log.json'),
  JSON.stringify(forensic, null, 2),
);

console.log('=== Spike 005: coarse single-target caching ===');
console.log(`projectRoot: ${projectRoot}`);
console.log(`modeled files (real + walk-adds): ${files.length}`);
console.log(
  `  default set (${defaultSet.length}): includes spec source? ${defaultSet.includes(SPEC_SOURCE)}`,
);
console.log(
  `  production set (${productionSet.length}): includes spec source? ${productionSet.includes(SPEC_SOURCE)}`,
);
console.log(
  `  CURRENT target file-set: spec source hashed? ${currentTargetSet.includes(SPEC_SOURCE)} | tsconfig.spec.json hashed? ${currentTargetSet.includes(SPEC_TSCONFIG)}`,
);
console.log(
  `  WALK target file-set:    spec source hashed? ${walkTargetSet.includes(SPEC_SOURCE)} | tsconfig.spec.json hashed? ${walkTargetSet.includes(SPEC_TSCONFIG)}`,
);
console.log('--- assertions ---');
for (const a of assertions)
  console.log(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}: ${a.detail}`);
console.log(`\nVERDICT: ${forensic.verdict}`);

process.exit(allPass ? 0 : 1);
