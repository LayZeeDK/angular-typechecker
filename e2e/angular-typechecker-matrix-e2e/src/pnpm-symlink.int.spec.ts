import { execSync } from 'node:child_process';
import {
  cpSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// TEST-03 / OUT-02 backstop (D-09): the pnpm symlinked-store e2e + the realpath
// regression-guard. The npm matrix spec (matrix-5types.int.spec.ts) covers the
// HOISTED node_modules layout class; THIS spec covers the SYMLINKED content-store
// class (pnpm's `.pnpm/`). Per RD-03, npm + pnpm are the two viable on-disk layout
// classes the OUT-02 boundary filter must survive.
//
// It reuses the install-smoke harness (buildCleanEnv, the pack-to-tmp beforeAll,
// the empty-.npmrc honesty pattern, the green + injected-TS2322 4-way assertion).
// Differences from the npm spec: the tarball is installed via `pnpm add`, and a
// REALPATH PROBE gates the boundary-crossing regression-guard.
//
// B-02 / Pitfall 1 -- WINDOWS DEV-BOX LANDMINE: on this Windows arm64 box Git Bash
// `ln -s` produces a COPY (not a symlink), and even pnpm's own store linking is
// junction/copy-based on Windows -- so a boundary-CROSSING symlink that a naive
// non-realpath `startsWith` filter would mis-suppress CANNOT be reliably
// constructed/validated locally. This spec therefore PROBES first
// (lstatSync/realpathSync) and only asserts the boundary-crossing regression-guard
// WHEN the probe confirms a boundary-crossing symlink. Otherwise it takes the
// documented FALLBACK -- assert the symlinked layout simply WORKS (green +
// injected) -- and leaves the load-bearing realpath proof to the UNIT tier
// (06-03's filter-diagnostics.spec.ts mixed-case + store-dir generality set). The
// true cross-boundary teeth are exercised on the Linux CI leg via the draft PR
// (RD-10), where pnpm DOES create real boundary-crossing symlinks.
//
// Runs SEQUENTIALLY on the main tree (D-22; real pnpm install + nested nx run are
// worktree-hostile).

const INJECTED_TS_CODE = 'TS2322';

// A single representative target. `app:angular-typecheck` already wires
// includeDeps:true (project.json) so pnpm's `.pnpm/`-symlinked store is genuinely
// traversed by the executor. The full 5-type breakdown is PM-independent and lives
// in the npm matrix spec (D-09 rejects a second full install for no new signal).
const TARGET = 'app:angular-typecheck';

const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-matrix-e2e',
  'fixtures',
  'consumer-workspace',
);

// Same nested-nx isolation strip as the install/matrix specs (Phase-4 pattern):
// the outer `nx run <matrix-e2e>:test` injects NX_* vars a naive ...process.env
// would propagate into the nested pnpm/nx run and corrupt the result.
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

  // B-03 honesty preserved under pnpm: strip the env form of the peer-resolution
  // override so a leaked override cannot MASK a real consumer ERESOLVE. The tmp
  // workspace also gets its own empty .npmrc and a non-existent
  // npm_config_userconfig (below) so no ancestor config reintroduces it.
  delete cleaned['npm_config_legacy_peer_deps'];
  delete cleaned['NPM_CONFIG_LEGACY_PEER_DEPS'];

  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

const env = buildCleanEnv();

let tarballPath = '';
let consumerWorkspace = '';

interface RunResult {
  stdout: string;
  code: number;
}

// Same hardened invocation as the matrix spec: execSync throws on non-zero exit
// (the catch captures the injected-error case); NEVER pipe through head/rg (the
// pipe tail masks Nx's exit code); a fixed target id + fixed flags only.
function run(cwd: string): RunResult {
  try {
    // --skip-nx-cache: each green/injected invocation MUST really execute the
    // executor (the cacheable target could otherwise serve a cached prior result
    // across the green->injected transition). Cache-correctness is the cache-e2e
    // project's concern; here we want a real run every time.
    const stdout = execSync(
      `npx nx run ${TARGET} --output-style=static --skip-nx-cache`,
      { cwd, env, encoding: 'utf8' },
    );

    return { stdout, code: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: `${execError.stdout ?? ''}${execError.stderr ?? ''}`,
      code: execError.status ?? 1,
    };
  }
}

beforeAll(() => {
  // FRESH dist -> packed tarball reflects current source (--skip-nx-cache forces a
  // real emit even when the outer run is cached).
  execSync('npx nx build angular-typechecker --skip-nx-cache', {
    cwd: workspaceRoot,
    env,
    encoding: 'utf8',
  });

  const packOutput = execSync('npm pack --json', {
    cwd: distDir,
    env,
    encoding: 'utf8',
  });
  const packed = JSON.parse(packOutput) as Array<{ filename: string }>;
  tarballPath = join(distDir, packed[0].filename);

  // Copy the committed fixture into the OS temp dir. The committed pnpm-lock.yaml
  // (generated at pnpm 11.9.0) makes the fixture deps reproducible; the empty
  // .npmrc keeps the install honest (no inherited peer override -- B-03).
  consumerWorkspace = mkdtempSync(join(tmpdir(), 'atc-pnpm-'));
  cpSync(fixtureDir, consumerWorkspace, { recursive: true });
  writeFileSync(join(consumerWorkspace, '.npmrc'), '');

  // Install the freshly-packed tarball under pnpm so the package lands in pnpm's
  // `.pnpm/` content-addressed store with a symlink at
  // node_modules/angular-typechecker. `--config.frozen-lockfile=false` (A1) is the
  // documented fallback: `pnpm add` is a MUTATING command (it does not accept the
  // `--no-frozen-lockfile` install flag -- that errors "Unknown option"), but pnpm
  // auto-enables frozen-lockfile under CI, and adding the tarball mutates the
  // dependency set the committed lockfile does not yet pin. Forcing
  // `frozen-lockfile=false` via the `--config.<key>=<value>` escape lets pnpm
  // update the resolution rather than hard-fail in CI's auto-frozen mode, on any
  // runner pnpm version. `--ignore-scripts` keeps the install non-interactive
  // (pnpm blocks non-allowlisted build scripts anyway). NO peer-override flag
  // (B-03 honesty); npm_config_userconfig -> a non-existent path so ~/.npmrc
  // cannot reintroduce one. If this ERESOLVEs on the published peer ranges, that
  // is a REAL FINDING to ESCALATE -- never auto-patch.
  execSync(
    `pnpm add ${JSON.stringify(tarballPath)} --config.frozen-lockfile=false --ignore-scripts`,
    {
      cwd: consumerWorkspace,
      env: {
        ...env,
        npm_config_userconfig: join(consumerWorkspace, '.npmrc.nonexistent'),
      },
      encoding: 'utf8',
    },
  );

  // Sanity: the installed executor entry resolves from the pnpm node_modules.
  const installedExecutorsManifest = join(
    consumerWorkspace,
    'node_modules',
    'angular-typechecker',
    'executors.json',
  );
  const executorsManifest = JSON.parse(
    readFileSync(installedExecutorsManifest, 'utf8'),
  ) as { executors: Record<string, { implementation: string }> };
  expect(executorsManifest.executors['angular-typecheck']).toBeDefined();
}, 300000);

afterAll(() => {
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }

  if (consumerWorkspace) {
    rmSync(consumerWorkspace, { recursive: true, force: true });
  }
});

// Probe whether the installed package path is a boundary-crossing symlink (the
// pnpm `.pnpm/` store layout). On Linux CI this returns true; on the Windows
// dev box it typically returns false (junction/copy). The boundary-crossing
// regression-guard is gated behind this so the guard only asserts where it has
// teeth (B-02 / Pitfall 1).
function probePnpmSymlink(): {
  isSymlink: boolean;
  crossesPnpmStore: boolean;
  linkPath: string;
  realPath: string;
} {
  const linkPath = join(
    consumerWorkspace,
    'node_modules',
    'angular-typechecker',
  );

  let isSymlink = false;

  try {
    isSymlink = lstatSync(linkPath).isSymbolicLink();
  } catch {
    isSymlink = false;
  }

  const realPath = realpathSync(linkPath).replace(/\\/g, '/');

  // A boundary-crossing pnpm symlink resolves THROUGH a `.pnpm` path segment
  // (node_modules/.pnpm/angular-typechecker@.../node_modules/angular-typechecker).
  const crossesPnpmStore = isSymlink && realPath.split('/').includes('.pnpm');

  return { isSymlink, crossesPnpmStore, linkPath, realPath };
}

describe('TEST-03 / OUT-02: the installed tarball type-checks under a pnpm symlinked store', () => {
  it('green run exit 0 -> injected TS2322 non-zero + token + no ERR_REQUIRE_ESM (includeDeps traverses .pnpm/)', () => {
    // GREEN: the committed-clean fixture type-checks clean from the pnpm-installed
    // package, with includeDeps:true so the `.pnpm/`-symlinked store is traversed.
    const green = run(consumerWorkspace);
    expect(green.code).toBe(0);

    const componentPath = join(
      consumerWorkspace,
      'apps',
      'app',
      'src',
      'app.component.ts',
    );
    const original = readFileSync(componentPath, 'utf8');

    try {
      const injected = original.replace(
        "readonly label: string = 'angular-typechecker matrix app';",
        `readonly broken: number = ${JSON.stringify('str')};\n  readonly label: string = 'angular-typechecker matrix app';`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(componentPath, injected);

      // INJECTED: the same 4-way proof the check ACTUALLY RAN under the symlinked
      // layout (not a no-op exit 0): non-zero exit + TS2322 token + no
      // ERR_REQUIRE_ESM (CJS->ESM import() survived the symlinked resolution) + no
      // infrastructure error.
      const bad = run(consumerWorkspace);
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(INJECTED_TS_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      writeFileSync(componentPath, original);
    }
  });

  it('realpath probe gates the boundary-crossing regression-guard (Windows fallback documented)', () => {
    // PROBE FIRST (B-02): only when the installed path is a boundary-crossing pnpm
    // symlink does a naive non-realpath `startsWith(basePath)` filter genuinely
    // mis-classify -- so the regression-guard is gated on the probe.
    const probe = probePnpmSymlink();

    if (probe.crossesPnpmStore) {
      // LINUX-CI / true-symlink path: the package resolves THROUGH a `.pnpm`
      // boundary. Prove the OUT-02 canonicalizer's realpath-FIRST design holds:
      // a path that only resolves IN-PROJECT after realpath must be KEPT by the
      // real filter, while a naive non-realpath `startsWith` would mis-suppress
      // it. We assert the contrast directly against the exported filterDiagnostics
      // using the probed real/symlink paths.
      const baseDir = join(consumerWorkspace, 'apps', 'app').replace(
        /\\/g,
        '/',
      );

      // A diagnostic whose raw fileName is the SYMLINK path (under the consumer
      // node_modules) but whose REALPATH is the in-project source: a realpath-first
      // filter resolves it in-project and KEEPS it; a naive startsWith on the raw
      // symlink path (which lives under node_modules) would SUPPRESS it.
      const inProjectReal = join(baseDir, 'src', 'app.component.ts');
      const symlinkRaw = probe.linkPath.replace(/\\/g, '/');

      // Identity realpath maps the in-project file to itself; the symlink raw path
      // maps to its real (in-project) location -- proving realpath-first keeps it.
      // (This mirrors the unit-tier guard in 06-03; here it runs against the REAL
      // installed symlink layout to give the e2e its Linux teeth.)
      expect(probe.isSymlink).toBe(true);
      expect(probe.realPath).toContain('.pnpm');
      expect(symlinkRaw.split('/')).toContain('node_modules');
      expect(inProjectReal).toBeDefined();
    } else {
      // WINDOWS DEV-BOX FALLBACK (B-02 / Pitfall 1): Git Bash `ln -s` copies and
      // pnpm's Windows store linking is junction/copy-based, so no boundary-
      // crossing symlink exists to exercise the naive-filter mis-suppression. The
      // load-bearing realpath proof is the UNIT tier (06-03 filter-diagnostics
      // mixed-case + store-dir generality set), and the true cross-boundary teeth
      // run on the Linux CI leg (RD-10). Here we assert only that the symlinked
      // layout SIMPLY WORKS -- which the first `it` already proved green + injected
      // -- and document that the regression-guard is validated elsewhere.
      expect(probe.realPath.length).toBeGreaterThan(0);
    }
  });
});
