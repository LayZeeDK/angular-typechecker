import { type ChildProcess, execSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { get, request } from 'node:http';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '@workspace/test-util';

// REL-04 (highest-fidelity gate): the ONLY spec that exercises the REAL
// `nx release publish` command end-to-end. tarball-audit + install-smoke pack
// with `npm pack` from dist DIRECTLY and install the `.tgz` by PATH, so they
// structurally cannot catch an nx-release-publish `packageRoot` regression -- a
// reverted fix would pack the SOURCE root and ship raw `.ts`, and those specs
// would never notice. This spec stands up a local Verdaccio registry, runs the
// actual `nx release publish --registry <local>` (the packageRoot-driven path),
// installs the package BY NAME from that registry into a fresh consumer, runs the
// documented init -> configuration -> typecheck flow green, and proves the
// installed tree ships compiled `.js` with ZERO `.ts` source / ZERO `.spec`. Runs
// SEQUENTIALLY on the main tree under the serialized vitest.config.mts
// (forks/singleFork/no-parallel/node env, 300000ms) -- real publish/install +
// nested nx are worktree-hostile.
//
// SAFETY (load-bearing): the publish MUST target the local Verdaccio URL via
// `--registry`. A publish that reaches registry.npmjs.org is a real-world side
// effect and is forbidden -- an explicit assertion below refuses any non-local
// registry before invoking publish.

// Resolve the workspace root from this spec's location
// (e2e/angular-typechecker-install-e2e/src/<file>); findWorkspaceRoot() walks up
// to nx.json, so every path is cwd-independent (main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

const distDir = join(workspaceRoot, 'dist', 'packages', 'angular-typechecker');
const distManifestPath = join(distDir, 'package.json');
const fixtureDir = join(
  workspaceRoot,
  'e2e',
  'angular-typechecker-install-e2e',
  'fixtures',
  'consumer-generator',
);

// The published, unscoped package name + the project the fixture exposes.
const PACKAGE_NAME = 'angular-typechecker';
const CONSUMER_PROJECT = 'consumer-generator';

// The five compiled runtime files that prove the tree ships JS, not source. If
// the packageRoot fix regresses, publish would pack `src/**/*.ts` and NONE of
// these `.js` would exist in the installed tree.
const REQUIRED_INSTALLED_JS = [
  join('src', 'index.js'),
  join('src', 'generators', 'init', 'generator.js'),
  join('src', 'executors', 'typecheck', 'executor.js'),
];

// Same nested-nx env hygiene as the sibling install-e2e specs: the outer
// `nx run <install-e2e>:test` injects cache-defeating NX_* vars into this
// process; a naive `...process.env` would propagate them into the nested
// `nx build` / `nx release publish` / `nx g` and silently corrupt the run.
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

  // CRITICAL: this spec runs under `npx vitest`/`nx run ...:test`, and npm/npx
  // inject `npm_config_*` env vars (registry, userconfig, auth, legacy-peer-deps)
  // reflecting the DEV repo's config into this process. Those env vars OUTRANK a
  // project/user .npmrc (npm precedence: cli > env > project > user), so an
  // inherited `npm_config_registry=https://registry.npmjs.org/` would silently
  // redirect the nested publish + install away from local Verdaccio -- breaking
  // publish auth (token is for localhost) and installing the REAL published
  // package instead of our freshly built dist. Strip EVERY npm_config_* key so
  // the nested npm reads its registry + token solely from the .npmrc files this
  // spec writes and the --registry flag it passes. (Also covers D-20 honesty: the
  // inherited legacy-peer-deps override is stripped here too.)
  for (const key of Object.keys(cleaned)) {
    if (/^npm_config_/i.test(key)) {
      delete cleaned[key];
    }
  }

  // NX_DAEMON off so a stale daemon cannot serve an outdated graph; FORCE_COLOR=0
  // keeps tool output un-split by ANSI.
  return {
    ...cleaned,
    NX_DAEMON: 'false',
    FORCE_COLOR: '0',
  };
}

const env = buildCleanEnv();

interface RunResult {
  stdout: string;
  code: number;
}

// execSync throws on a non-zero exit -- so the catch is how we capture the exit
// code + diagnostic output of the nested nx run (matches install-smoke's run()).
function run(cwd: string, target: string): RunResult {
  try {
    const stdout = execSync(`npx nx run ${target} --output-style=static`, {
      cwd,
      env,
      encoding: 'utf8',
    });

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

// Best-effort recursive teardown of an OS-temp dir. On Windows a lingering nx
// subprocess (or a just-installed node_modules handle) can hold a dir open past
// execSync's return, so a bare recursive rmSync EPERMs. A failed removal of an
// OS-temp dir must NEVER fail a scenario whose assertions already ran (the CI e2e
// gate is Linux-only, where this never EPERMs). Swallow the residual error.
function removeTmpDir(dir: string): void {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch {
    // best-effort: a unique per-run OS-temp dir left behind is harmless.
  }
}

// Reserve a free ephemeral port by binding to :0, reading the assigned port, then
// releasing it -- far more robust than guessing a fixed port that a sibling
// process may already hold.
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('could not determine a free port'));

        return;
      }

      const { port } = address;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

// One readiness probe: GET the registry root; any HTTP response means Verdaccio
// is accepting connections. Polling the port is more robust on Windows than
// scraping the log for the address line (log level / ANSI / buffering vary).
function pingOnce(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = get(url, (response) => {
      response.resume();
      resolve(true);
    });

    request.on('error', () => {
      resolve(false);
    });

    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(
  url: string,
  isDead: () => boolean,
  getLog: () => string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isDead()) {
      throw new Error(`Verdaccio exited before becoming ready:\n${getLog()}`);
    }

    if (await pingOnce(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Verdaccio did not become ready at ${url} within ${timeoutMs}ms:\n${getLog()}`,
  );
}

// Module-level handles captured in beforeAll, consumed by the it() + afterAll.
let verdaccio: ChildProcess | undefined;
let verdaccioUrl = '';
// The npm nerf-dart auth prefix (`//host:port/`) for the .npmrc `_authToken` line.
let registryNerfDart = '';
// A REAL Verdaccio bearer token minted via the user-registration endpoint. An
// arbitrary/dummy token does NOT work: Verdaccio 6 rejects an unverifiable bearer
// with 401 (npm surfaces it as "requires you to be logged in") rather than
// falling back to anonymous -- verified against verdaccio@6.7.4. So we register a
// throwaway user and use the token the registry returns.
let registryToken = '';
let registryHome = '';

// The .npmrc body that points npm at Verdaccio + supplies the minted publish
// token (the `ci` user is in the `$all` publish group).
function verdaccioNpmrc(): string {
  return `registry=${verdaccioUrl}\n${registryNerfDart}:_authToken="${registryToken}"\n`;
}

// Mint a real bearer token by registering a throwaway user against Verdaccio's
// couchdb-compatible user endpoint (PUT /-/user/org.couchdb.user:<name>). The
// htpasswd plugin allows sign-up by default; the returned token authenticates as
// that user, which the `$all` publish group accepts.
function createRegistryToken(url: string): Promise<string> {
  const user = 'ci';
  const body = JSON.stringify({
    name: user,
    password: 'ci-password',
    email: 'ci@example.com',
    type: 'user',
    roles: [],
    date: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    const target = new URL(`-/user/org.couchdb.user:${user}`, url);
    const registration = request(
      target,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk.toString();
        });
        response.on('end', () => {
          if (response.statusCode !== 200 && response.statusCode !== 201) {
            reject(
              new Error(
                `Verdaccio user registration failed (${response.statusCode}): ${data}`,
              ),
            );

            return;
          }

          const token = (JSON.parse(data) as { token?: string }).token;

          if (typeof token !== 'string' || token.length === 0) {
            reject(new Error(`Verdaccio returned no token: ${data}`));

            return;
          }

          resolve(token);
        });
      },
    );

    registration.on('error', reject);
    registration.write(body);
    registration.end();
  });
}

beforeAll(async () => {
  // 1. Reserve a free port and derive the local registry URL up front (we chose
  //    the port, so we never scrape it back out of the log).
  const port = await findFreePort();
  verdaccioUrl = `http://localhost:${port}/`;
  registryNerfDart = `//localhost:${port}/`;

  // 2. Fresh per-run home holding the config + a fresh `storage` dir. Fresh
  //    storage is load-bearing: it guarantees `angular-typechecker` is NOT
  //    already present, so the publish is a clean first publish (no
  //    same-version EPUBLISHCONFLICT from a prior run).
  registryHome = mkdtempSync(join(tmpdir(), 'atc-verdaccio-'));
  mkdirSync(join(registryHome, 'storage'), { recursive: true });

  // 3. Minimal Verdaccio config. `angular-typechecker` is served ONLY from local
  //    storage (NO proxy) so `npm view` / install never fall through to the real
  //    npmjs copy of the live 0.1.0 -- the round-trip must exercise OUR freshly
  //    built dist. Everything ELSE proxies npmjs so the consumer's Angular / Nx /
  //    TS deps still resolve. `$all` publish accepts the dummy token as anonymous.
  //    `storage` is relative -> resolved against this config file's directory.
  const configPath = join(registryHome, 'config.yaml');
  const config = [
    'storage: ./storage',
    'auth:',
    '  htpasswd:',
    '    file: ./htpasswd',
    'uplinks:',
    '  npmjs:',
    '    url: https://registry.npmjs.org/',
    '    cache: true',
    '    maxage: 30m',
    'packages:',
    "  'angular-typechecker':",
    '    access: $all',
    '    publish: $all',
    '    unpublish: $all',
    "  '**':",
    '    access: $all',
    '    publish: $all',
    '    unpublish: $all',
    '    proxy: npmjs',
    'log: { type: stdout, format: pretty, level: http }',
    '',
  ].join('\n');
  writeFileSync(configPath, config);

  // 4. Spawn Verdaccio as a DIRECT node child (resolve its bin, run it under this
  //    same node). A direct node child is killable via child.kill() -- unlike an
  //    `npx verdaccio` cmd shim on Windows, which orphans the node grandchild.
  const require = createRequire(import.meta.url);
  const verdaccioBin = require.resolve('verdaccio/bin/verdaccio');

  let verdaccioLog = '';
  let exited = false;

  verdaccio = spawn(
    process.execPath,
    [verdaccioBin, '--config', configPath, '--listen', String(port)],
    { cwd: registryHome, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  verdaccio.stdout?.on('data', (chunk) => {
    verdaccioLog += chunk.toString();
  });
  verdaccio.stderr?.on('data', (chunk) => {
    verdaccioLog += chunk.toString();
  });
  verdaccio.on('exit', () => {
    exited = true;
  });

  await waitForServer(
    verdaccioUrl,
    () => exited,
    () => verdaccioLog,
    60000,
  );

  // 5. Mint a real publish token (see createRegistryToken: a dummy token is
  //    rejected 401 by Verdaccio 6, not treated as anonymous).
  registryToken = await createRegistryToken(verdaccioUrl);

  // 6. Build FRESH dist so the published artifact reflects current source
  //    (--skip-nx-cache forces a real emit even when the outer run is cached).
  execSync('npx nx build angular-typechecker --skip-nx-cache', {
    cwd: workspaceRoot,
    env,
    encoding: 'utf8',
  });
}, 300000);

afterAll(() => {
  // Kill Verdaccio (best-effort: a single-process node child dies on SIGTERM; on
  // Windows a residual is harmless -- the OS reclaims the port + temp dirs).
  if (verdaccio) {
    try {
      verdaccio.kill();
    } catch {
      // best-effort.
    }
  }

  if (registryHome) {
    removeTmpDir(registryHome);
  }
});

describe('REL-04: nx release publish -> install-by-name -> typecheck ships compiled JS', () => {
  it('publishes to local Verdaccio, installs by name, runs init/configuration/typecheck green, and ships zero .ts source', () => {
    // Load-bearing SAFETY gate: never let the real `nx release publish` reach
    // registry.npmjs.org. Refuse anything that is not the local Verdaccio URL.
    expect(verdaccioUrl.startsWith('http://localhost:')).toBe(true);

    // The dist manifest carries `publishConfig.provenance: true` for the CI OIDC
    // release job. Provenance generation only works inside a supported CI with
    // id-token OIDC, so it would ABORT this local publish. Neutralize it on the
    // dist artifact (gitignored, rebuilt each run) -- provenance is a CI concern,
    // orthogonal to what this round-trip proves (compiled-JS packaging).
    const distManifest = JSON.parse(readFileSync(distManifestPath, 'utf8')) as {
      publishConfig?: { provenance?: boolean };
    };

    if (distManifest.publishConfig) {
      distManifest.publishConfig.provenance = false;
    }

    writeFileSync(
      distManifestPath,
      `${JSON.stringify(distManifest, null, 2)}\n`,
    );

    // Publish via the REAL nx path. `nx release publish` reads the
    // nx-release-publish target's options.packageRoot (dist/packages/...) and
    // runs `npm publish <packageRoot> --registry <verdaccio>`. --first-release
    // skips the pre-publish `npm view` (nothing is published yet). The publish
    // .npmrc (registry + dummy token) is supplied via npm_config_userconfig so
    // the repo .npmrc is not consulted; --registry is MANDATORY (SAFETY above).
    const publishNpmrc = join(registryHome, 'publish.npmrc');
    writeFileSync(publishNpmrc, verdaccioNpmrc());

    try {
      execSync(
        `npx nx release publish --registry ${verdaccioUrl} --first-release`,
        {
          cwd: workspaceRoot,
          env: { ...env, npm_config_userconfig: publishNpmrc },
          encoding: 'utf8',
        },
      );
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };

      throw new Error(
        `nx release publish failed:\n${execError.stdout ?? ''}\n${execError.stderr ?? ''}`,
      );
    }

    // Install BY NAME from Verdaccio into a fresh consumer (not by tarball path --
    // this is the registry round-trip install-smoke cannot do). The consumer
    // .npmrc points npm at Verdaccio (+ dummy token); npm_config_userconfig ->
    // a nonexistent path so the user ~/.npmrc cannot reintroduce a peer override.
    const consumer = mkdtempSync(join(tmpdir(), 'atc-verdaccio-consumer-'));

    try {
      cpSync(fixtureDir, consumer, { recursive: true });
      writeFileSync(join(consumer, '.npmrc'), verdaccioNpmrc());

      execSync(`npm install --save-dev ${PACKAGE_NAME}`, {
        cwd: consumer,
        env: {
          ...env,
          npm_config_userconfig: join(consumer, '.npmrc.nonexistent'),
        },
        encoding: 'utf8',
      });

      // Documented flow: seed nx.json (init) -> wire the typecheck target
      // (configuration) -> run it. --skipFormat: the fixture installs no Prettier.
      execSync('npx nx g angular-typechecker:init --skipFormat', {
        cwd: consumer,
        env,
        encoding: 'utf8',
      });
      execSync(
        `npx nx g angular-typechecker:configuration ${CONSUMER_PROJECT} --skipFormat`,
        { cwd: consumer, env, encoding: 'utf8' },
      );

      // (1) The type-check runs GREEN from the installed-by-name package.
      const green = run(consumer, `${CONSUMER_PROJECT}:typecheck`);
      expect(green.code).toBe(0);

      // (2) The installed tree carries the compiled runtime .js (index + the
      //     generator + the executor) -- proof the packageRoot fix shipped dist.
      const installedRoot = join(consumer, 'node_modules', PACKAGE_NAME);

      for (const relativeJs of REQUIRED_INSTALLED_JS) {
        expect(existsSync(join(installedRoot, relativeJs))).toBe(true);
      }

      // (3) THE point: a recursive walk of the installed tree finds ZERO source
      //     `.ts` (excluding `.d.ts`) and ZERO `.spec.` files. A reverted
      //     packageRoot would ship `src/**/*.ts` here and fail this assertion.
      const installedFiles = walkFiles(installedRoot);
      const tsSources = installedFiles.filter(
        (file) => file.endsWith('.ts') && !file.endsWith('.d.ts'),
      );
      const specFiles = installedFiles.filter((file) => /\.spec\./.test(file));

      expect(tsSources).toEqual([]);
      expect(specFiles).toEqual([]);
    } finally {
      removeTmpDir(consumer);
    }
  }, 300000);
});

// Recursively collect POSIX-style relative file paths under a directory.
function walkFiles(root: string, base: string = root): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(full, base));
    } else {
      files.push(relative(base, full).replace(/\\/g, '/'));
    }
  }

  return files;
}
