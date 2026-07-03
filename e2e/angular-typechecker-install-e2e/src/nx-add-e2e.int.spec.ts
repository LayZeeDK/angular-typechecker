import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// GE2E-03 (Phase 15): prove `nx add angular-typechecker`'s install-time init path
// seeds the nx.json targetDefaults FROM ABSENT against the freshly-packed tarball.
//
// WHY THIS IS THE FAITHFUL OFFLINE PROOF, NOT A SHORTCUT (Finding 1, traced
// against nx 23.0.1 source): `nx add <bare-name>` splits the specifier on the last
// `@`, resolving `angular-typechecker@latest` from the REGISTRY -- it would install
// the REAL published version (wrong artifact) and needs network, so it cannot
// target the local tarball under test. But `nx add`'s init step is
// `configure-plugins.js` `runPluginInitGenerator`, which constructs the command
// VERBATIM as `g <plugin>:init` (a hardcoded `<plugin>:init`, discovered purely via
// the installed package's `generators` field -- no `ng-add` alias needed). So the
// deterministic, offline, board-aligned proof of GEN-09 is: place the package
// exactly as `nx add`'s installPackage step would (here from the local tarball) and
// run the byte-identical internal command `npx nx g angular-typechecker:init`. We
// do NOT ship an Angular-CLI `ng add` surface (GEN-FUT-02 stays deferred). Runs
// SEQUENTIALLY on the main tree (D-22); real npm pack/install + nested nx are
// worktree-hostile.

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up to nx.json, so so every path
// is cwd-independent (D-17 main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-generator',
);

// CRITICAL (nested-nx isolation): this spec runs UNDER `nx run
// <install-e2e>:test`, so the outer Nx runner injects env vars into this process
// that a naive `...process.env` would propagate into the nested `nx g` /
// `npm install` and silently corrupt the run. Strip them so the nested run is a
// clean top-level invocation regardless of how the outer test was invoked.
const NX_RUNNER_ENV_KEYS = [
  'NX_SKIP_NX_CACHE',
  'NX_TASK_HASH',
  'NX_INVOCATION_ROOT_PID',
  'NX_FORKED_TASK_EXECUTOR',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_CLI_SET',
  'NX_TERMINAL_CAPTURE_STDERR',
];

function buildCleanEnv(): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...process.env };

  for (const key of NX_RUNNER_ENV_KEYS) {
    delete cleaned[key];
  }

  // D-20 honesty: a leaked peer-resolution override (via env or an inherited
  // .npmrc) would MASK a real consumer ERESOLVE on the published peer ranges
  // (B-03). Strip the env form here; the tmp workspace also gets its own empty
  // .npmrc (below) so no ancestor .npmrc is consulted, and we set
  // npm_config_userconfig to a non-existent path so the user-level ~/.npmrc
  // cannot reintroduce it.
  delete cleaned['npm_config_legacy_peer_deps'];
  delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];

  // NX_DAEMON off so a stale daemon cannot serve an outdated graph; FORCE_COLOR=0
  // keeps output un-split by ANSI.
  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

const env = buildCleanEnv();

// Best-effort teardown of a per-scenario tmp workspace. On Windows a lingering
// nx subprocess (or a just-installed node_modules handle) can hold the tmp dir
// open past execSync's return, so a bare recursive rmSync EPERMs on the directory
// root -- a lock Node's linear-backoff (maxRetries/retryDelay) may not outwait. A
// failed removal of an OS-temp dir must NEVER fail a scenario whose assertions
// already ran (the CI e2e gate is Linux-only, where recursive rmSync never EPERMs;
// this only manifests in Windows-local dev). Swallow the residual error; the OS
// reclaims the temp dir.
function removeTmpWorkspace(tmp: string): void {
  try {
    rmSync(tmp, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // best-effort: an OS-temp dir left behind is harmless (unique per mkdtempSync).
  }
}

// Absolute path to the freshly-packed tarball, captured in beforeAll.
let tarballPath = '';

beforeAll(() => {
  // Build a FRESH dist so the packed tarball reflects current source.
  // --skip-nx-cache forces a real emit even when the outer run is cached.
  // Per-file build+pack (D-08 acceptable fallback) keeps isolation parity with the
  // existing install-e2e specs.
  execSync('npx nx build angular-typechecker --skip-nx-cache', {
    cwd: workspaceRoot,
    env,
    encoding: 'utf8',
  });

  // npm pack --json from the dist dir produces the EXACT artifact `nx release
  // publish` ships and writes the .tgz on disk. Capture its absolute path.
  const packOutput = execSync('npm pack --json', {
    cwd: distDir,
    env,
    encoding: 'utf8',
  });
  const packed = JSON.parse(packOutput) as Array<{ filename: string }>;
  tarballPath = join(distDir, packed[0].filename);
}, 300000);

afterAll(() => {
  // Remove the packed .tgz so each run does not leak an artifact under dist
  // (WR-02). force:true keeps teardown non-fatal if it is already gone.
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
});

describe("GE2E-03: nx add's init path seeds nx.json targetDefaults from absent", () => {
  it('installs the tarball, runs the internal `nx g angular-typechecker:init`, and seeds the WALK-02 cache block', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'atc-add-'));

    try {
      // Fresh tmp copy of the un-wired consumer-generator fixture (its nx.json has
      // NO angular-typechecker:typecheck targetDefaults key -- D-02).
      cpSync(fixtureDir, tmp, { recursive: true });
      writeFileSync(join(tmp, '.npmrc'), '');

      // Seeded-from-absent BASELINE: the key must be undefined BEFORE init, so the
      // post-init assertion is non-vacuous (Pitfall 5 -- a pre-declared key would
      // make init's whole-entry ??= skip seeding and pass for the wrong reason).
      const before = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8')) as {
        targetDefaults?: Record<string, unknown>;
      };
      expect(
        before.targetDefaults?.['angular-typechecker:typecheck'],
      ).toBeUndefined();

      // Place the package exactly as `nx add`'s installPackage step would after a
      // registry fetch -- here from the local tarball (deterministic + offline for
      // the package under test; the fixture's Angular/Nx/TS deps still resolve from
      // the registry, like every existing install-e2e spec). NO peer-override flag
      // (B-03): a real ERESOLVE must surface, not be masked.
      execSync(`npm install ${JSON.stringify(tarballPath)}`, {
        cwd: tmp,
        env: { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') },
        encoding: 'utf8',
      });

      // Run the SAME init generator `nx add`'s runPluginInitGenerator constructs
      // (`g <plugin>:init`). This resolves the installed package's generators.json
      // `init` entry -- the load-bearing half of GEN-09. --skipFormat: the fixture
      // installs no Prettier.
      execSync('npx nx g angular-typechecker:init --skipFormat', {
        cwd: tmp,
        env,
        encoding: 'utf8',
      });

      // init SEEDED the key (absent -> present, WALK-02 shape). The 'default'-first
      // input is the load-bearing invariant: 'production' would exclude *.spec.ts
      // and under-hash the walked spec leaf (a stale PASS).
      const nxJson = JSON.parse(readFileSync(join(tmp, 'nx.json'), 'utf8')) as {
        targetDefaults?: Record<
          string,
          { cache?: boolean; outputs?: unknown[]; inputs?: unknown[] }
        >;
      };
      const seeded = nxJson.targetDefaults?.['angular-typechecker:typecheck'];
      expect(seeded).toBeDefined();
      expect(seeded?.cache).toBe(true);
      expect(seeded?.outputs).toEqual([]);
      expect(seeded?.inputs?.[0]).toBe('default');
    } finally {
      removeTmpWorkspace(tmp);
    }
  });
});
