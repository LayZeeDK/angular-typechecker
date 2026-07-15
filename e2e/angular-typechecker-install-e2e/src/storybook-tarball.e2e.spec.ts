import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, inject, it } from 'vitest';
import {
  buildCleanEnv,
  findWorkspaceRoot,
  removeTmpDir,
  run,
  sh,
  writeVerdaccioNpmrc,
} from '@workspace/test-util';

// SB-06 criterion 1 (NON-NEGOTIABLE): the SHIPPED artifact -- installed into a
// generator-shaped Storybook consumer via `nx add` + `nx g
// angular-typechecker:configuration` + `nx typecheck` -- catches a planted
// `*.stories.ts` type error. 0.0.1-0.1.0 shipped raw source and a local-build test
// would NOT have caught the packaging defect; only the installed published package
// proves it.
//
// INSTALL PATH (RESEARCH RQ3 Open-Q1, RESOLVED): the Verdaccio `nx add` path (NOT a
// direct `npm install <tgz>`). It is the most LITERAL rendering of criterion 1's
// "via `nx add`", and the project's global-setup already builds dist ONCE and
// publishes it to the local Verdaccio -- so `nx add angular-typechecker` resolves
// the freshly-published SHIPPED dist by name. The tarball alternative
// (generator-e2e.e2e.spec.ts) is equivalent but adds a per-spec `npm pack`; the
// `nx add` path reuses the already-published artifact and also proves `nx add`
// itself works on a Storybook workspace.
//
// This is a NEW spec FILE inside the existing `angular-typechecker-install-e2e`
// project -- NEVER a new e2e project. The three e2e projects race on the shared dist
// tarball; staying here inherits the serialized singleFork / fileParallelism:false
// harness (vitest.config.mts) and the one-build-one-publish global-setup.
//
// INSTALL HONESTY (D-02a / B-03): `@storybook/angular@10.4.6` is force-installed in
// a SEPARATE, EXPLICIT `--legacy-peer-deps` step (its peer cap Angular <22 / TS
// ^4.9||^5 makes the ERESOLVE real and documented -- D4). The angular-typechecker
// install carries NO peer-resolution override + a nonexistent npm_config_userconfig,
// so a real ERESOLVE on OUR published peers surfaces rather than being masked. The
// clean env uses stripAllNpmConfig so no inherited registry / legacy-peer-deps leaks.
//
// INSTALL ORDER (18-04 finding): angular-typechecker is installed BEFORE Storybook,
// into a Storybook-free tree. `nx add` forwards NO flags, so its `npm install -D
// angular-typechecker@latest` cannot carry `--legacy-peer-deps` (nor should it --
// B-03). If Storybook were installed FIRST, that override-free `nx add` would
// re-resolve the WHOLE tree and hit @storybook/angular's KNOWN, documented peer cap
// (@angular-devkit/build-angular >=18 <22 -> typescript >=5.9 <6.0, conflicting with
// TS 6.0.3) -- a FOREIGN conflict, not a conflict on OUR peers, yet it would abort
// `nx add`. Installing our package first checks OUR peers (@angular/compiler-cli
// @^22.0.0 + typescript >=6.0 <6.1 -- satisfied) against a clean tree (still B-03
// honest: a broken OWN peer range would ERESOLVE here), then Storybook is added last
// with its legitimate override absorbing its own foreign peer conflict.
//
// PLANTED-ERROR DISCIPLINE (generator-e2e): DISTINCT full code tokens (never bare
// 4-digit substrings, which false-PASS on an unrelated offset/hash), a DISTINCT code
// per layout (Layout A story = TS2322; Layout B story = TS2345; Layout B external
// template = NG8002), injected by replacing a committed clean anchor via
// JSON.stringify (ASCII-safe). Each planted run asserts: non-zero exit; the full
// token(s) in stdout; NO /ERR_REQUIRE_ESM/ (the CJS->ESM compiler-cli bridge survived
// packaging); NO 'infrastructure error' (the non-zero exit is a real diagnostic, not
// a crash). A CLEAN baseline is asserted to exit 0 FIRST -- proving a clean
// generator-shaped Storybook project passes AND that forced-SB10's node_modules
// .d.ts errors do not leak in-project.

const STORYBOOK_ANGULAR = '@storybook/angular@10.4.6';

// DISTINCT full code tokens per layout/leaf (Pitfall 6).
const LAYOUT_A_STORY_CODE = 'TS2322';
const LAYOUT_B_STORY_CODE = 'TS2345';
const EXTERNAL_TEMPLATE_CODE = 'NG8002';

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

// stripAllNpmConfig is load-bearing (same reasoning as nx-add-npm.e2e.spec.ts): the
// shared global-setup sets npm_config_registry process-wide (inherited by this
// singleFork worker) and it would outrank the fixture .npmrc, retargeting the install
// away from local Verdaccio. Stripping every npm_config_* also drops any leaked
// legacy-peer-deps so a real consumer ERESOLVE on OUR peers cannot be masked (B-03).
const env = buildCleanEnv({ stripAllNpmConfig: true });

/**
 * The shared per-run recipe: copy the fixture into a tmp workspace, install the
 * fixture deps, install angular-typechecker via `nx add` (NO override) into the
 * Storybook-free tree, THEN force-install Storybook (--legacy-peer-deps, SEPARATE
 * step) last, and wire the typecheck target on the named project. Returns nothing --
 * the caller runs the baseline + planted-error assertions. See the INSTALL ORDER note
 * in the file header for why our package is installed before Storybook.
 */
function installStorybookAndTypechecker(
  tmp: string,
  verdaccioUrl: string,
  verdaccioToken: string,
  project: string,
): void {
  // Point npm at Verdaccio (registry + minted bearer via the nerf-dart auth line).
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);

  // npm_config_userconfig -> a nonexistent path so the user ~/.npmrc cannot
  // reintroduce a peer-resolution override into any nested install (B-03).
  const npmEnv = {
    ...env,
    npm_config_userconfig: join(tmp, '.npmrc.nonexistent'),
  };

  // (1) Install the fixture's OWN deps first (no override, Storybook-free). Generates
  // package-lock.json so `nx add` detects npm, and gives OUR install a clean tree.
  sh('npm install --no-audit --no-fund --prefer-offline', {
    cwd: tmp,
    env: npmEnv,
  });

  // (2) Install the SHIPPED artifact with NO peer-resolution override (B-03): `nx
  // add` detects npm -> `npm install -D angular-typechecker@latest` (resolved from
  // Verdaccio) -> runs the internal init generator (seeds the typecheck
  // targetDefaults). OUR peers are honestly checked here against a Storybook-free
  // tree -- a real ERESOLVE on OUR published peers would surface HERE.
  sh('npx nx add angular-typechecker', { cwd: tmp, env: npmEnv });

  // (3) Force-install Storybook LAST as a SEPARATE explicit --legacy-peer-deps step
  // (D-02a). This is the ONLY place the override is legitimate (the SB10 peer cap is
  // real + documented, D4). Installed after our package so its foreign peer conflict
  // is never conflated with -- nor able to mask -- a conflict on OUR peers.
  sh(
    `npm install ${STORYBOOK_ANGULAR} --legacy-peer-deps --no-audit --no-fund --prefer-offline`,
    {
      cwd: tmp,
      env: npmEnv,
    },
  );

  // (4) Wire the ONE typecheck target on the project's solution tsconfig.json.
  // --skipFormat: the fixture installs no Prettier.
  sh(`npx nx g angular-typechecker:configuration ${project} --skipFormat`, {
    cwd: tmp,
    env: npmEnv,
  });
}

describe('SB-06 criterion 1: the SHIPPED tarball catches a planted Storybook story error', () => {
  it('Layout A (per-project scaffold): clean baseline passes; a planted story TS2322 FAILS through nx add + configuration + typecheck', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    // Documentation-level re-assert of the global-setup SAFETY gate: this install
    // reads ONLY from local Verdaccio (pinned to the numeric IPv4 loopback).
    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-sb-a-'));

    try {
      cpSync(fixtureDir('consumer-storybook-a'), tmp, { recursive: true });
      installStorybookAndTypechecker(
        tmp,
        verdaccioUrl,
        verdaccioToken,
        'consumer-storybook-a',
      );

      // CLEAN baseline: exit 0. Proves a clean generator-shaped Storybook project
      // passes AND that forced-SB10's node_modules .d.ts errors are suppressed (never
      // leak in-project).
      const green = run(tmp, 'consumer-storybook-a:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(green.code).toBe(0);

      // Plant the TS2322 into the story's clean anchor line (string -> number-typed
      // `count`). JSON.stringify keeps the injected line ASCII-safe.
      const storyPath = join(tmp, 'src', 'button.stories.ts');
      const original = readFileSync(storyPath, 'utf8');
      const injected = original.replace(
        '  count: 3,',
        `  count: ${JSON.stringify('not-a-number')},`,
      );
      expect(injected).not.toBe(original);
      writeFileSync(storyPath, injected);

      // The SHIPPED walk type-checked the story surface and FAILS: non-zero exit, the
      // full TS2322 token in stdout, NO ERR_REQUIRE_ESM (the CJS->ESM compiler-cli
      // bridge survived packaging), NO 'infrastructure error' (a real diagnostic, not
      // a crash).
      const bad = run(tmp, 'consumer-storybook-a:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(LAYOUT_A_STORY_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      removeTmpDir(tmp);
    }
  }, 300000);

  it('Layout B (centralized host): clean baseline passes; a planted aggregated TS2345 AND an external-template NG8002 FAIL', () => {
    const verdaccioUrl = inject('verdaccioUrl');
    const verdaccioToken = inject('verdaccioToken');

    expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);

    const tmp = mkdtempSync(join(tmpdir(), 'atc-sb-b-'));

    try {
      cpSync(fixtureDir('consumer-storybook-b'), tmp, { recursive: true });
      installStorybookAndTypechecker(
        tmp,
        verdaccioUrl,
        verdaccioToken,
        'storybook-host',
      );

      // CLEAN baseline: exit 0. The clean centralized host -- incl. its aggregated
      // out-of-host-dir story/component reached through the widened `.storybook`
      // include -- passes, and forced-SB10 .d.ts errors do not leak.
      const green = run(tmp, 'storybook-host:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(green.code).toBe(0);

      // Plant the aggregated story TS2345 (string -> the `order: number` parameter).
      const storyPath = join(tmp, 'aggregated-ui', 'card.stories.ts');
      const storyOriginal = readFileSync(storyPath, 'utf8');
      const storyInjected = storyOriginal.replace(
        'export const primary: Story = story(3);',
        `export const primary: Story = story(${JSON.stringify('three')});`,
      );
      expect(storyInjected).not.toBe(storyOriginal);
      writeFileSync(storyPath, storyInjected);

      // Plant the external-template NG8002 kill-shot: an unknown property binding on
      // the aggregated component's EXTERNAL `.html`. `.html` is never a rootName, so a
      // naive rootNames/directory filter would SILENTLY DROP it (the milestone's
      // motivating false pass). Branch 4a keeps it via the .html diagnostic's
      // relatedInformation owner (the in-input-set component .ts).
      const templatePath = join(tmp, 'aggregated-ui', 'card.component.html');
      const templateOriginal = readFileSync(templatePath, 'utf8');
      const templateInjected = templateOriginal.replace(
        '<p>{{ title }}</p>',
        '<div [nonExistentProp]="title"></div>',
      );
      expect(templateInjected).not.toBe(templateOriginal);
      writeFileSync(templatePath, templateInjected);

      // The SHIPPED walk type-checked the aggregated cross-project surface AND the
      // external template and FAILS: non-zero exit, BOTH distinct tokens (TS2345 +
      // NG8002) in stdout, NO ERR_REQUIRE_ESM, NO 'infrastructure error'.
      const bad = run(tmp, 'storybook-host:typecheck', {
        env,
        skipNxCache: true,
      });
      expect(bad.code).not.toBe(0);
      expect(bad.stdout).toContain(LAYOUT_B_STORY_CODE);
      expect(bad.stdout).toContain(EXTERNAL_TEMPLATE_CODE);
      expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(bad.stdout).not.toContain('infrastructure error');
    } finally {
      removeTmpDir(tmp);
    }
  }, 300000);
});
