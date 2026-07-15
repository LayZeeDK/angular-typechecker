// Spike 011 -- GATE A' (ACB-02): does the shipped CJS-executor-loads-ESM-
// @angular/compiler-cli-via-await-import() bridge SURVIVE convertNxExecutor + a
// REAL `ng run <project>:typecheck` (including convertNxExecutor's eager
// retrieveProjectConfigurationsWithAngularProjects project-graph prelude,
// nrwl/nx#19475) on-stack Angular 22, with NO ERR_REQUIRE_ESM?
//
// This is an ORCHESTRATOR (not a verbatim-engine .mjs like spikes 001-010): the
// gate MUST exercise the real convertNxExecutor + the real Architect loader + a
// real `ng run`, which an .mjs-only harness cannot trigger (it never runs the
// eager prelude -- Pitfall 1). So it drives real tooling against REAL plugin code:
//   1. nx build angular-typechecker              -> compiled CJS builder in dist
//   2. npm pack the built dist                   -> tarball (assert it carries the
//                                                   builder .js + schema + builders.json)
//   3. npm install the tarball into a REAL cloned Angular 22 angular.json workspace
//      (bluehalo/ngx-leaflet), on-stack, NO --legacy-peer-deps (record if it needs it)
//   4. hand-wire architect.typecheck on an app AND a library (ng g is Phase 22)
//   5. run `ng run <app>:typecheck` clean (baseline) + `ng run <lib>:typecheck` clean
//   6. plant ONE TS2322 in the app, re-run `ng run <app>:typecheck` (planted RED)
//   7. scan every run's output for ESM failure signatures (the NO-GO signals)
//   8. assert GO evidence: no ESM signatures anywhere; the clean control is GREEN;
//      the planted diagnostic surfaces RED; the library run reaches the compiler
//   9. write forensic-log.json + a [PASS]/[FAIL] list + VERDICT + exit(allPass?0:1)
//
// Record-only (per CONVENTIONS.md / D-02): the external clone and its node_modules
// are NEVER committed -- only this harness + README + forensic-log.json. The clone
// is referenced by absolute path (override with NGX_LEAFLET_CLONE) and reproduced
// from the repo URL + commit SHA below. All edits (angular.json, main.ts) + the
// installed tarball + the .nx/.angular caches are restored/removed in a finally
// block, pass or fail.
//
// Run (from the repo root):  node .planning/spikes/011-builder-ng-run-esm-bridge/harness.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const REPO = join(HERE, '..', '..', '..');

const CLONE =
  process.env.NGX_LEAFLET_CLONE ?? 'D:\\projects\\github\\bluehalo\\ngx-leaflet';
const CLONE_REPO_URL = 'https://github.com/bluehalo/ngx-leaflet';
const EXPECTED_SHA = '818e9ae55240b570397ede5a15cb4d466785abdc';

const NX_BIN = join(REPO, 'node_modules', 'nx', 'dist', 'bin', 'nx.js');
const NG_BIN = join(CLONE, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const DIST = join(REPO, 'dist', 'packages', 'angular-typechecker');

const APP = 'ngx-leaflet-demo';
const LIB = 'ngx-leaflet';
const APP_TSCONFIG = 'tsconfig.app.json';
const LIB_TSCONFIG = 'projects/ngx-leaflet/tsconfig.lib.json';
const MAIN_TS = join(CLONE, 'src', 'main.ts');
const ANGULAR_JSON = join(CLONE, 'angular.json');

const MAX_BUFFER = 64 * 1024 * 1024;

const ESM_SIGNATURES = [
  'ERR_REQUIRE_ESM',
  'require() of ES Module',
  'Cannot use import statement outside a module',
];

// A project-graph / daemon failure thrown by the eager prelude BEFORE our executor
// runs is the other NO-GO shape (nrwl/nx#19475). Recorded for forensics; the
// reached-compiler check below already fails the verdict when a run crashes in the
// prelude (non-zero exit with no diagnostic output).
const PRELUDE_SIGNATURES = [
  'Failed to process project graph',
  'retrieveProjectConfigurations',
  'Could not find project graph',
];

function nodeRun(scriptAbs, args, cwd, timeout) {
  const r = spawnSync(process.execPath, [scriptAbs, ...args], {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: MAX_BUFFER,
  });
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';

  return {
    status: r.status,
    stdout,
    stderr,
    combined: stdout + stderr,
    error: r.error ? String(r.error.message ?? r.error) : null,
  };
}

function sh(cmd, cwd, timeout) {
  const r = spawnSync(cmd, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: MAX_BUFFER,
    shell: true,
  });
  const stdout = r.stdout ?? '';
  const stderr = r.stderr ?? '';

  return {
    status: r.status,
    stdout,
    stderr,
    combined: stdout + stderr,
    error: r.error ? String(r.error.message ?? r.error) : null,
  };
}

function pkgVersion(pkgName) {
  try {
    const p = join(CLONE, 'node_modules', ...pkgName.split('/'), 'package.json');

    return JSON.parse(readFileSync(p, 'utf8')).version;
  } catch {
    return null;
  }
}

function esmHits(text) {
  return ESM_SIGNATURES.filter((s) => text.includes(s));
}

function preludeHits(text) {
  return PRELUDE_SIGNATURES.filter((s) => text.includes(s));
}

// Reached our engine (bridge survived): no ESM signature AND either a clean verdict
// (exit 0) or real diagnostic output (TS/NG codes) -- as opposed to a prelude crash
// (non-zero exit with neither).
function reachedCompiler(run) {
  if (esmHits(run.combined).length > 0) {
    return false;
  }

  if (run.status === 0) {
    return true;
  }

  return /error TS\d{3,5}|TS\d{3,5}:|NG\d{4}|Found \d+ error/i.test(run.combined);
}

function excerpt(text, n = 2000) {
  const t = text.trim();

  return t.length > n ? `${t.slice(0, n)}\n...[truncated ${t.length - n} chars]` : t;
}

function summarizeRun(label, project, tsConfig, run) {
  return {
    label,
    project,
    tsConfig,
    exitCode: run.status,
    spawnError: run.error,
    esmSignatures: esmHits(run.combined),
    preludeSignatures: preludeHits(run.combined),
    reachedCompiler: reachedCompiler(run),
    outputExcerpt: excerpt(run.combined),
  };
}

const results = [];

function assert(id, cond, detail) {
  const pass = !!cond;
  results.push({ id, pass, detail });
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${id}: ${detail}`);
}

// --- backups (restored in finally) ---
const backups = {};

function backup(path) {
  backups[path] = existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function restore(path) {
  if (!(path in backups)) {
    return;
  }

  if (backups[path] === null) {
    rmSync(path, { force: true });

    return;
  }

  writeFileSync(path, backups[path]);
}

function safeRemove(path) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // best-effort teardown
  }
}

const forensic = {
  spike: '011-builder-ng-run-esm-bridge',
  gates: ["GATE-A'"],
  validates:
    'the CJS-executor-loads-ESM-@angular/compiler-cli-via-await-import() bridge survives convertNxExecutor + a real ng run on-stack Angular 22 (no ERR_REQUIRE_ESM incl. the eager project-graph prelude)',
  clone: { repoUrl: CLONE_REPO_URL, expectedSha: EXPECTED_SHA, actualSha: null, path: CLONE },
  environment: {},
  tarball: {},
  install: {},
  runs: {},
  esmSignaturesScanned: ESM_SIGNATURES,
  cloneGitStatusAfter: null,
};

let tgzAbs = null;
let installedNodeModules = [];

try {
  // 1. Substrate present + at the pinned SHA.
  assert(
    'clone-present',
    existsSync(CLONE) && existsSync(ANGULAR_JSON),
    existsSync(ANGULAR_JSON) ? `clone + angular.json at ${CLONE}` : `MISSING clone/angular.json at ${CLONE}`,
  );

  const sha = sh('git rev-parse HEAD', CLONE, 30000);
  const actualSha = (sha.stdout || '').trim();
  forensic.clone.actualSha = actualSha;
  assert(
    'clone-sha',
    actualSha === EXPECTED_SHA,
    `actual ${actualSha || '(unknown)'} vs expected ${EXPECTED_SHA}`,
  );

  // Provision the clone's node_modules if absent (idempotent; the reproduction step).
  if (!existsSync(NG_BIN)) {
    console.log('[info] clone node_modules absent -> npm ci (one-time, network)...');
    const ci = sh('npm ci --no-audit --no-fund', CLONE, 600000);

    if (ci.status !== 0) {
      throw new Error(`npm ci in the clone failed (exit ${ci.status}): ${excerpt(ci.combined, 800)}`);
    }
  }

  forensic.environment = {
    node: process.version,
    npm: (sh('npm --version', REPO, 30000).stdout || '').trim(),
    platform: process.platform,
    '@angular/cli': pkgVersion('@angular/cli'),
    '@angular/core': pkgVersion('@angular/core'),
    '@angular/compiler-cli': pkgVersion('@angular/compiler-cli'),
    typescript: pkgVersion('typescript'),
  };

  // 2. Build the candidate builder into dist.
  const build = nodeRun(NX_BIN, ['build', 'angular-typechecker'], REPO, 300000);
  assert('build-ok', build.status === 0, build.status === 0 ? 'nx build angular-typechecker exit 0' : `nx build failed (exit ${build.status})`);

  // 3. Pack the BUILT dist (npm pack --json creates the tgz AND lists its contents).
  const packRaw = sh('npm pack --json', DIST, 120000);
  let packInfo = null;

  try {
    const jsonStart = packRaw.stdout.indexOf('[');
    packInfo = JSON.parse(packRaw.stdout.slice(jsonStart))[0];
  } catch {
    packInfo = null;
  }

  const packedPaths = (packInfo?.files ?? []).map((f) => f.path.replace(/\\/g, '/'));
  const tgzName = packInfo?.filename;
  tgzAbs = tgzName ? join(DIST, tgzName) : null;
  forensic.tarball = { filename: tgzName, fileCount: packedPaths.length };

  const hasBuilderJs = packedPaths.some((p) => p.endsWith('src/builders/typecheck/builder.js'));
  const hasBuilderSchema = packedPaths.some((p) => p.endsWith('src/builders/typecheck/schema.json'));
  const hasBuildersJson = packedPaths.some((p) => p === 'builders.json' || p.endsWith('/builders.json'));
  assert('tarball-builder-js', hasBuilderJs, hasBuilderJs ? 'tarball carries src/builders/typecheck/builder.js' : 'tarball MISSING builder.js');
  assert('tarball-builder-schema', hasBuilderSchema, hasBuilderSchema ? 'tarball carries the builder schema.json' : 'tarball MISSING builder schema.json');
  assert('tarball-builders-json', hasBuildersJson, hasBuildersJson ? 'tarball carries builders.json' : 'tarball MISSING builders.json');

  if (!tgzAbs || !existsSync(tgzAbs)) {
    throw new Error('npm pack did not produce a tarball -- cannot install into the clone');
  }

  // Back up everything the harness will touch (restored in finally).
  backup(ANGULAR_JSON);
  backup(MAIN_TS);
  backup(join(CLONE, 'package.json'));
  backup(join(CLONE, 'package-lock.json'));

  // 4. Install the tarball into the clone. On-stack -> NO --legacy-peer-deps first;
  //    only if that fails do we retry with the flag and RECORD it as a finding.
  const tgzArg = tgzAbs.replace(/\\/g, '/');
  let install = sh(`npm install "${tgzArg}" --no-save --no-audit --no-fund`, CLONE, 300000);
  let neededLegacyPeerDeps = false;

  if (install.status !== 0) {
    neededLegacyPeerDeps = true;
    install = sh(`npm install "${tgzArg}" --no-save --no-audit --no-fund --legacy-peer-deps`, CLONE, 300000);
  }

  forensic.install = {
    command: `npm install <tarball> --no-save (${neededLegacyPeerDeps ? 'RETRIED with --legacy-peer-deps' : 'clean, no --legacy-peer-deps'})`,
    neededLegacyPeerDeps,
    exitCode: install.status,
    outputExcerpt: excerpt(install.combined, 1200),
  };
  assert('install-ok', install.status === 0, install.status === 0 ? `tarball installed (${neededLegacyPeerDeps ? 'needed --legacy-peer-deps' : 'no --legacy-peer-deps'})` : `install failed (exit ${install.status})`);
  assert('install-no-legacy-peer-deps', neededLegacyPeerDeps === false, neededLegacyPeerDeps ? 'FINDING: on-stack install REQUIRED --legacy-peer-deps' : 'on-stack install was clean (no --legacy-peer-deps)');

  const installedPkg = join(CLONE, 'node_modules', 'angular-typechecker');
  assert('installed-present', existsSync(installedPkg), existsSync(installedPkg) ? 'node_modules/angular-typechecker present in the clone' : 'angular-typechecker NOT installed');

  // Track the transitively-installed trees for teardown (Pitfall 4 -- nx drags in).
  installedNodeModules = [
    installedPkg,
    join(CLONE, 'node_modules', 'nx'),
    join(CLONE, 'node_modules', '@nx'),
    join(CLONE, '.nx'),
    join(CLONE, '.angular'),
  ];

  // 5. Wire architect.typecheck on the app AND the library (hand-edit; ng g is Phase 22).
  const angular = JSON.parse(readFileSync(ANGULAR_JSON, 'utf8'));
  angular.projects[APP].architect.typecheck = {
    builder: 'angular-typechecker:typecheck',
    options: { tsConfig: APP_TSCONFIG },
  };
  angular.projects[LIB].architect.typecheck = {
    builder: 'angular-typechecker:typecheck',
    options: { tsConfig: LIB_TSCONFIG },
  };
  writeFileSync(ANGULAR_JSON, `${JSON.stringify(angular, null, 2)}\n`);

  // 6a. Clean baseline: app (pre-plant) + library. Both should reach the compiler.
  const appBaseline = nodeRun(NG_BIN, ['run', `${APP}:typecheck`], CLONE, 300000);
  const libRun = nodeRun(NG_BIN, ['run', `${LIB}:typecheck`], CLONE, 300000);

  // 6b. Plant ONE known diagnostic (TS2322) in the app, then re-run just the app.
  const planted =
    `${backups[MAIN_TS]}\n` +
    `\n// angular-typechecker GATE A' planted diagnostic (spike 011) -- restored after the run\n` +
    `const __angularTypecheckerGateAPlanted: number = 'gate-a-planted-type-error';\n` +
    `void __angularTypecheckerGateAPlanted;\n`;
  writeFileSync(MAIN_TS, planted);
  const appPlanted = nodeRun(NG_BIN, ['run', `${APP}:typecheck`], CLONE, 300000);
  restore(MAIN_TS);

  forensic.runs = {
    appBaseline: summarizeRun('app clean baseline', APP, APP_TSCONFIG, appBaseline),
    libClean: summarizeRun('library clean', LIB, LIB_TSCONFIG, libRun),
    appPlanted: summarizeRun('app planted (TS2322)', APP, APP_TSCONFIG, appPlanted),
  };

  // 7 + 8. Assertions: ESM-clean everywhere; clean control GREEN; planted RED; lib reached.
  const allRuns = [
    ['app-baseline', appBaseline],
    ['lib-clean', libRun],
    ['app-planted', appPlanted],
  ];

  for (const [label, run] of allRuns) {
    const hits = esmHits(run.combined);
    assert(`no-esm-${label}`, hits.length === 0, hits.length === 0 ? `no ESM failure signature in ${label} output` : `ESM signature(s) in ${label}: ${JSON.stringify(hits)}`);
  }

  assert(
    'app-baseline-green',
    appBaseline.status === 0,
    appBaseline.status === 0 ? 'clean control (app, pre-plant) GREEN via ng run (exit 0)' : `app baseline NOT green (exit ${appBaseline.status})`,
  );

  assert(
    'app-planted-red',
    appPlanted.status !== 0 && /TS2322/.test(appPlanted.combined),
    appPlanted.status !== 0 && /TS2322/.test(appPlanted.combined)
      ? `planted TS2322 surfaced RED via ng run (exit ${appPlanted.status})`
      : `planted diagnostic did NOT surface as expected (exit ${appPlanted.status}, TS2322 present: ${/TS2322/.test(appPlanted.combined)})`,
  );

  assert(
    'lib-reached-compiler',
    reachedCompiler(libRun),
    reachedCompiler(libRun)
      ? `library ng run reached the compiler (exit ${libRun.status}) -- bridge survived for a library project`
      : `library ng run did NOT reach the compiler (exit ${libRun.status}) -- possible prelude/bridge failure`,
  );
} catch (fatal) {
  assert('harness-fatal', false, `harness threw: ${String(fatal && fatal.stack ? fatal.stack.split('\n')[0] : fatal)}`);
} finally {
  // Record-only teardown: restore tracked files + remove installed/cache artifacts.
  restore(ANGULAR_JSON);
  restore(MAIN_TS);
  restore(join(CLONE, 'package.json'));
  restore(join(CLONE, 'package-lock.json'));

  for (const p of installedNodeModules) {
    safeRemove(p);
  }

  if (tgzAbs) {
    safeRemove(tgzAbs);
  }

  const gitStatus = sh('git status --short', CLONE, 30000);
  forensic.cloneGitStatusAfter = (gitStatus.stdout || '').trim() || '(clean)';
}

const allPass = results.length > 0 && results.every((r) => r.pass);
const verdict = allPass
  ? "GO -- the CJS->ESM await import() bridge SURVIVES convertNxExecutor + a real `ng run` on-stack Angular 22 (no ERR_REQUIRE_ESM, incl. the eager project-graph prelude); the planted diagnostic surfaces RED and the clean control is GREEN"
  : 'NO-GO -- see the failed assertion(s) above and forensic-log.json';

forensic.assertions = results;
forensic.verdict = verdict.startsWith('GO') ? 'GO' : 'NO-GO';
forensic.verdictDetail = verdict;

writeFileSync(join(HERE, 'forensic-log.json'), `${JSON.stringify(forensic, null, 2)}\n`);

console.log(`\nVERDICT: ${forensic.verdict}`);
console.log(verdict);
process.exit(allPass ? 0 : 1);
