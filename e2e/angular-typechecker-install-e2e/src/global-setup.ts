import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import type { TestProject } from 'vitest/node';
import { buildCleanEnv, findWorkspaceRoot, sh } from '@workspace/test-util';

// Shared vitest globalSetup for the angular-typechecker-install-e2e project. It
// stands up the first-party @nx/js Verdaccio local-registry, builds dist ONCE,
// mints a REAL publish token, strips CI-only provenance, and publishes the built
// dist ONCE via the real `nx release publish` path -- then provides the registry
// URL + token to every spec (finding E1: one build + one publish shared across
// the specs, which is why the sibling specs drop their own per-spec builds).
//
// This adopts the canonical @nx/js `startLocalRegistry` runtime but DIVERGES from
// the nx.dev recipe's `releaseVersion({ specifier: '0.0.0-e2e' })` step, which
// mutates the source package.json version on disk -- forbidden on a release
// branch. We publish the real dist at its real version instead.
//
// The three load-bearing behaviors the default scaffold does not provide live in
// the committed `.verdaccio/config.yml` (angular-typechecker no-proxy block +
// auth.htpasswd) and here (the real token mint, since Verdaccio 6 401s the @nx/js
// dummy `secretVerdaccioToken`).

// The couchdb-compatible user-registration endpoint mints a real bearer token
// (the htpasswd plugin allows sign-up; the `$all` publish group accepts the
// returned token). A dummy/unverifiable bearer is 401-rejected by Verdaccio 6.
async function mintCiToken(registryUrl: string): Promise<string> {
  const user = 'ci';
  const response = await fetch(
    new URL(`-/user/org.couchdb.user:${user}`, registryUrl),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: user,
        password: 'ci-password',
        email: 'ci@example.com',
        type: 'user',
        roles: [],
        date: new Date().toISOString(),
      }),
      // Fail fast + loud if the registration stalls (registry mid-startup,
      // htpasswd write contention, a dropped connection). vitest globalSetup is
      // NOT bounded by testTimeout/hookTimeout, so without this the whole suite
      // would hang to the CI job wall-clock limit with no diagnostic.
      signal: AbortSignal.timeout(10000),
    },
  );

  if (response.status !== 200 && response.status !== 201) {
    const text = await response.text();

    throw new Error(
      `Verdaccio user registration failed (${response.status}): ${text}`,
    );
  }

  const body = (await response.json()) as { token?: string };

  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error(`Verdaccio returned no token: ${JSON.stringify(body)}`);
  }

  return body.token;
}

export default async function ({ provide }: TestProject) {
  const root = findWorkspaceRoot(__dirname);

  // The setup-verdaccio generator put the local-registry target on the root project,
  // whose name is the root package.json name. Derive the target id from that name
  // (append the target) rather than hardcoding it -- this tracks a rename and, since
  // the derived id is assembled from parts, carries no banned contiguous
  // `<scope>/source:<target>` literal for the scoped-name regression guard to flag.
  const rootProjectName = (
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name: string;
    }
  ).name;

  // startLocalRegistry forks `nx` (not an `npx` cmd shim) and resolves readiness
  // by scraping the "http://<listenAddress>:PORT" line out of stdout (log.level:
  // http in config.yml keeps that line printing). clearStorage wipes the storage
  // dir -- including the htpasswd under it -- so every run gets a deterministic
  // fresh ci-user sign-up (no cross-run EPUBLISHCONFLICT / htpasswd idempotency
  // ambiguity).
  //
  // listenAddress '127.0.0.1' is LOAD-BEARING (fixes the nx-add-yarn ECONNREFUSED
  // flake): the local-registry target pins verdaccio's bind to the numeric IPv4
  // loopback (project.json), and this pins the scrape + the provided verdaccioUrl
  // to the SAME numeric literal. A numeric-IP registry URL means every client
  // (npm/pnpm/yarn) skips DNS and connects to exactly 127.0.0.1 -- removing the
  // dual-stack `localhost` (::1 vs 127.0.0.1) family race that intermittently made
  // yarn 4's fetch phase hit a family verdaccio was not listening on. Must match
  // the target's listenAddress so the readiness scrape (`http://127.0.0.1:`) fires.
  const stop = await startLocalRegistry({
    localRegistryTarget: `${rootProjectName}:local-registry`,
    storage: './tmp/local-registry/storage',
    verbose: false,
    clearStorage: true,
    listenAddress: '127.0.0.1',
  });

  try {
    // startLocalRegistry sets process.env.npm_config_registry to the local URL.
    const registryUrl = process.env.npm_config_registry ?? '';

    // Load-bearing SAFETY gate: never let the real `nx release publish` reach
    // registry.npmjs.org. A publish there is a real-world side effect and is
    // forbidden. Refuse any non-local registry before touching publish. The
    // registry is pinned to the numeric IPv4 loopback (see listenAddress above).
    if (!registryUrl.startsWith('http://127.0.0.1:')) {
      throw new Error(
        `refusing to publish to non-local registry: ${registryUrl}`,
      );
    }

    // Strip EVERY npm_config_* key (stripAllNpmConfig) so the nested `nx release
    // publish` + install read the registry + token SOLELY from the --registry flag
    // and the publish .npmrc we write -- not an inherited npm_config_registry (incl.
    // the one startLocalRegistry just set, which outranks --registry).
    const env = buildCleanEnv({ stripAllNpmConfig: true });

    if (Object.keys(env).some((key) => /^npm_config_/i.test(key))) {
      throw new Error(
        'buildCleanEnv left an npm_config_* key in the publish env',
      );
    }

    // Mint a REAL token (behavior 2) and build FRESH dist ONCE (finding E1).
    const token = await mintCiToken(registryUrl);
    sh('npx nx build angular-typechecker --skip-nx-cache', { cwd: root, env });

    // The dist manifest carries publishConfig.provenance:true for the CI OIDC
    // release job. Provenance generation only works inside a supported CI with
    // id-token OIDC, so it would ABORT this local publish. Neutralize it on the
    // gitignored, rebuilt-each-run dist artifact -- provenance is a CI concern,
    // orthogonal to what this round-trip proves (compiled-JS packaging).
    const distManifestPath = join(
      root,
      'dist',
      'packages',
      'angular-typechecker',
      'package.json',
    );
    const manifest = JSON.parse(readFileSync(distManifestPath, 'utf8')) as {
      publishConfig?: { provenance?: boolean };
    };

    if (manifest.publishConfig) {
      manifest.publishConfig.provenance = false;
    }

    writeFileSync(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    // Publish ONCE via the REAL nx path (nx-release-publish reads packageRoot =
    // dist/packages/...). The publish .npmrc (registry + minted token) is supplied
    // via npm_config_userconfig so the repo/user .npmrc is not consulted;
    // --registry is MANDATORY (SAFETY above). --first-release skips the pre-publish
    // `npm view` (nothing is published yet).
    //
    // --excludeTaskDependencies is LOAD-BEARING here: nx-release-publish now
    // dependsOn ["build"] (M14). Without this flag the publish would re-run build
    // -- a cache HIT that RE-MATERIALIZES dist from the cache and CLOBBERS the
    // provenance strip above (re-introducing publishConfig.provenance:true, which
    // aborts a non-CI publish). The explicit build above already produced dist, so
    // we skip the dependent build and publish the stripped dist we just prepared.
    const nerfDart = `//${new URL(registryUrl).host}/`;
    const publishNpmrc = join(root, 'tmp', 'local-registry', 'publish.npmrc');
    mkdirSync(dirname(publishNpmrc), { recursive: true });
    writeFileSync(
      publishNpmrc,
      `registry=${registryUrl}\n${nerfDart}:_authToken="${token}"\n`,
    );
    sh(
      `npx nx release publish --registry ${registryUrl} --first-release --excludeTaskDependencies`,
      {
        cwd: root,
        env: { ...env, npm_config_userconfig: publishNpmrc },
      },
    );

    provide('verdaccioUrl', registryUrl);
    provide('verdaccioToken', token);
  } catch (error) {
    // On any setup failure, stop the registry so a failed run does not orphan the
    // forked nx/verdaccio process, then rethrow to fail the suite loudly.
    stop();

    throw error;
  }

  return () => {
    stop();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    verdaccioUrl: string;
    verdaccioToken: string;
  }
}
