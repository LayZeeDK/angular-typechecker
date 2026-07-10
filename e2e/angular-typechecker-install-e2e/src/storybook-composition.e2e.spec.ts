import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  run,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// SB-08 Composition (D-04/D-05/D-06): Storybook Composition ships as a supported
// TOPOLOGY with ZERO engine code. Composition is a multi-project topology, not a
// tsconfig layout: each composed project AND the host are ordinary per-project
// Layout-A projects, and the host's `.storybook/main.ts` `refs` object is
// type-checked as plain TypeScript. Coverage = per-project `typecheck` + Nx graph
// fan-out; the graph edge (`implicitDependencies` on the host), NEVER the ref URL,
// is the source of truth (URL resolution was REJECTED in D-04).
//
// This is a NEW spec FILE inside the existing `angular-typechecker-install-e2e`
// project -- NEVER a new e2e project. The three e2e projects race on the shared dist
// tarball; staying here inherits the serialized singleFork / fileParallelism:false
// harness (vitest.config.mts) and the one-build-one-publish global-setup.
//
// INSTALL ORDER + HONESTY (B-03, Pitfall 3, mirroring storybook-tarball.e2e.spec.ts):
// fixture `npm install` -> `nx add angular-typechecker` (NO peer override; resolves
// the SHIPPED tarball from Verdaccio and the `angular-typechecker:typecheck` executor
// the fixture targets reference) -> `npm install @storybook/angular@10.4.6
// --legacy-peer-deps` as a SEPARATE step (so the host + composed `.storybook/main.ts`
// type-check against real Storybook types). Unlike the tarball spec there is NO `nx g
// configuration` step: the Composition fixture PRE-COMMITS the per-project typecheck
// targets (each lib) and the host's `dependsOn:["^typecheck"]` fan-out target.
//
// PLANTED-ERROR DISCIPLINE: a DISTINCT full code token (TS2322), injected by replacing
// a committed clean anchor via JSON.stringify (ASCII-safe), with plant-then-restore so
// the shared tmp is clean between scenarios. A CLEAN baseline is asserted to exit 0
// FIRST -- proving a clean composed set passes AND that forced-SB10's node_modules
// .d.ts errors do not leak in-project. Each planted run also asserts NO
// /ERR_REQUIRE_ESM/ (the CJS->ESM compiler-cli bridge survived packaging) and NO
// 'infrastructure error' (the non-zero exit is a real diagnostic, not a crash).

const STORYBOOK_ANGULAR = '@storybook/angular@10.4.6';

// A broken composed story assigns a string to the number-typed `count` -> TS2322.
const LAYOUT_A_STORY_CODE = 'TS2322';

// Resolve the workspace root from this spec's location; findWorkspaceRoot() walks up
// to nx.json so every path is cwd-independent (main tree).
const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);

function fixtureDir(name: string): string {
  return join(
    workspaceRoot,
    'e2e',
    'angular-typechecker-install-e2e',
    'fixtures',
    name,
  );
}

// stripAllNpmConfig is load-bearing (same reasoning as storybook-tarball.e2e.spec.ts):
// the shared global-setup sets npm_config_registry process-wide and it would outrank
// the fixture .npmrc, retargeting the install away from local Verdaccio. Stripping
// every npm_config_* also drops any leaked legacy-peer-deps so a real consumer
// ERESOLVE on OUR peers cannot be masked (B-03).
const env = buildCleanEnv({ stripAllNpmConfig: true });

/**
 * Copy the Composition fixture into `tmp` and install: the fixture deps, then the
 * SHIPPED angular-typechecker via `nx add` (NO override, into a Storybook-free tree),
 * then `@storybook/angular@10.4.6 --legacy-peer-deps` LAST as a SEPARATE step. No `nx
 * g configuration` -- the fixture pre-commits the per-project typecheck targets and
 * the host's `dependsOn:["^typecheck"]` fan-out target.
 */
function installComposition(
  tmp: string,
  verdaccioUrl: string,
  verdaccioToken: string,
): void {
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

  // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
  // reintroduce a peer-resolution override into any nested install (B-03).
  const npmEnv = {
    ...env,
    npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
  };

  // (1) Fixture's OWN deps first (no override, Storybook-free). Generates
  // package-lock.json so `nx add` detects npm and gives OUR install a clean tree.
  sh('npm install', { cwd: tmp, env: npmEnv });

  // (2) The SHIPPED artifact with NO peer-resolution override (B-03): `nx add`
  // detects npm -> installs angular-typechecker@latest from Verdaccio -> runs the
  // init generator (seeds the typecheck targetDefaults). OUR peers are honestly
  // checked here against a Storybook-free tree.
  sh('npx nx add angular-typechecker', { cwd: tmp, env: npmEnv });

  // (3) Force-install Storybook LAST as a SEPARATE --legacy-peer-deps step (the SB10
  // peer cap on Angular 22 / TS 6 is real + documented). Installed after our package
  // so its foreign peer conflict is never conflated with a conflict on OUR peers.
  sh(`npm install ${STORYBOOK_ANGULAR} --legacy-peer-deps`, {
    cwd: tmp,
    env: npmEnv,
  });
}

describe('SB-08 Composition: per-project typecheck + dependsOn:["^typecheck"] fan-out catch a broken composed story and a mistyped host refs entry', () => {
  let tmp: string;

  beforeAll(() => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Documentation-level re-assert of the global-setup SAFETY gate: this install
    // reads ONLY from local Verdaccio (pinned to the numeric IPv4 loopback).
    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    tmp = mkdtempSync(join(tmpdir(), 'atc-sb-comp-'));
    cpSync(fixtureDir('consumer-storybook-composition'), tmp, {
      recursive: true,
    });
    installComposition(tmp, verdaccioUrl, verdaccioToken);
  }, 300000);

  afterAll(() => {
    if (tmp) {
      removeTmpDir(tmp);
    }
  });

  it('clean baseline: storybook-host:typecheck fans out over the clean composed set and exits 0', () => {
    // The host's dependsOn:["^typecheck"] runs lib-buttons + lib-cards typecheck
    // FIRST (both clean), then the host's own -- so exit 0 proves the WHOLE composed
    // set passes AND that forced-SB10 .d.ts errors never leak in-project.
    const green = run(tmp, 'storybook-host:typecheck', {
      env,
      skipNxCache: true,
    });

    expect(green.code).toBe(0);
  }, 300000);

  it('broken composed story: lib-buttons OWN typecheck FAILS (TS2322) AND the host dependsOn:["^typecheck"] fan-out FAILS', () => {
    const storyPath = join(tmp, 'lib-buttons', 'src', 'button.stories.ts');
    const original = readFileSync(storyPath, 'utf8');

    try {
      // Plant the TS2322 into the story's clean anchor (string -> number-typed
      // `count`). JSON.stringify keeps the injected line ASCII-safe.
      const injected = original.replace(
        '  count: 3,',
        `  count: ${JSON.stringify('not-a-number')},`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(storyPath, injected);

      // The composed lib's OWN typecheck target catches it: non-zero exit, the full
      // TS2322 token, no crash.
      const own = run(tmp, 'lib-buttons:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(own.code).not.toBe(0);
      expect(own.stdout).toContain(LAYOUT_A_STORY_CODE);
      expect(own.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(own.stdout).not.toContain('infrastructure error');

      // The host's dependsOn:["^typecheck"] fans out to the broken upstream lib, so
      // running the host's typecheck ALSO fails -- the D-05 recipe covers the set.
      const fanout = run(tmp, 'storybook-host:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(fanout.code).not.toBe(0);
      expect(fanout.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(fanout.stdout).not.toContain('infrastructure error');
    } finally {
      writeFileSync(storyPath, original);
    }
  }, 300000);

  it('mistyped host refs: a numeric `url` makes storybook-host:typecheck FAIL on an ordinary TS diagnostic', () => {
    const hostMainPath = join(tmp, 'storybook-host', '.storybook', 'main.ts');
    const original = readFileSync(hostMainPath, 'utf8');

    try {
      // Rewrite a refs entry's string `url` to a number -- an ordinary TypeScript
      // error on the host's own main.ts (the refs object is plain TS config).
      const injected = original.replace(
        "url: 'http://localhost:7008'",
        'url: 123',
      );
      expect(injected).not.toBe(original);
      writeFileSync(hostMainPath, injected);

      const badRefs = run(tmp, 'storybook-host:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(badRefs.code).not.toBe(0);
      expect(badRefs.stdout).toMatch(/TS\d{3,}/);
      expect(badRefs.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(badRefs.stdout).not.toContain('infrastructure error');
    } finally {
      writeFileSync(hostMainPath, original);
    }
  }, 300000);
});
