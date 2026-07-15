import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HostTree } from '@angular-devkit/schematics';
import type { SchematicContext } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  NO_ANGULAR_JSON_NOTICE,
  NO_CACHING_NOTICE,
} from '../../core/angular-cli-wiring';
import type { NgAddSchema } from './schema';
import ngAdd from './schematic';

// NGADD-01 coverage for the VANILLA (nx-free) ng-add schematic (24-06): the schematic
// is now a pure @angular-devkit/schematics Rule (no convertNxGenerator, no @nx/devkit),
// so it is exercised over a UnitTestTree(new HostTree()) seeded with angular.json +
// package.json + leaf tsconfigs. The Rule reads angular.json DIRECTLY, so assertions
// parse the on-disk `architect` map (with `builder`, not the Nx `executor` alias).
//
// The Rule is SYNCHRONOUS and touches only context.logger, so it is invoked directly
// with a context backed by the SchematicTestRunner's logger -- SchematicTestRunner's
// own `callRule` cannot capture logger output (it builds the context with a
// NullLogger when no parent is passed, and crashes if a parent logger is passed), so
// direct invocation is the faithful way to assert the info notices.

const collectionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'collection.json',
);

const APP_TARGET = {
  builder: 'angular-typechecker:typecheck',
  options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
};

const LIB_TARGET = {
  builder: 'angular-typechecker:typecheck',
  options: {
    tsConfig: [
      'projects/ngx-leaflet/tsconfig.lib.json',
      'projects/ngx-leaflet/tsconfig.spec.json',
    ],
  },
};

interface SeededProject {
  projectType?: 'application' | 'library';
  root: string;
  architect?: Record<string, unknown>;
}

describe('ng-add schematic (vanilla, Angular CLI auto-wire-all)', () => {
  let tree: UnitTestTree;
  let runner: SchematicTestRunner;
  let messages: string[];

  beforeEach(() => {
    tree = new UnitTestTree(new HostTree());
    tree.create('package.json', '{}');
    runner = new SchematicTestRunner('angular-typechecker', collectionPath);
    messages = [];
    runner.logger.subscribe((entry) => messages.push(entry.message));
  });

  function seedAngularJson(projects: Record<string, SeededProject>): void {
    tree.create('angular.json', JSON.stringify({ version: 1, projects }));
  }

  function leaf(path: string): void {
    tree.create(path, '{}');
  }

  function seedNgxLeaflet(): void {
    seedAngularJson({
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      'ngx-leaflet': { projectType: 'library', root: 'projects/ngx-leaflet' },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');
    leaf('projects/ngx-leaflet/tsconfig.lib.json');
    leaf('projects/ngx-leaflet/tsconfig.spec.json');
  }

  // The vanilla Rule is synchronous; invoke it directly with a logger-backed context.
  // `async` so a synchronous throw surfaces as a rejected promise for rejects.toThrow.
  async function run(options: NgAddSchema = {}): Promise<void> {
    const context = { logger: runner.logger } as unknown as SchematicContext;
    ngAdd(options)(tree, context);
  }

  function target(project: string): unknown {
    const workspace = JSON.parse(tree.readContent('angular.json')) as {
      projects: Record<string, { architect?: Record<string, unknown> }>;
    };

    return workspace.projects[project]?.architect?.['typecheck'];
  }

  it('auto-wires a typecheck target into EVERY application + library project (NGADD-01)', async () => {
    seedNgxLeaflet();

    await run();

    expect(target('ngx-leaflet-demo')).toEqual(APP_TARGET);
    expect(target('ngx-leaflet')).toEqual(LIB_TARGET);
  });

  it('restricts wiring to a single project when --project is set', async () => {
    seedNgxLeaflet();

    await run({ project: 'ngx-leaflet' });

    expect(target('ngx-leaflet')).toEqual(LIB_TARGET);
    expect(target('ngx-leaflet-demo')).toBeUndefined();
  });

  it('is idempotent across the whole workspace on a second run', async () => {
    seedNgxLeaflet();

    await run();
    await run();

    expect(target('ngx-leaflet-demo')).toEqual(APP_TARGET);
    expect(target('ngx-leaflet')).toEqual(LIB_TARGET);
  });

  it('re-asserts OUR target while preserving user options/configurations, and wires the untouched project fresh', async () => {
    seedAngularJson({
      'ngx-leaflet-demo': {
        projectType: 'application',
        root: '',
        architect: {
          typecheck: {
            builder: 'angular-typechecker:typecheck',
            options: {
              tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
              maxWarnings: 0,
            },
            configurations: { ci: { failFast: true } },
          },
        },
      },
      'ngx-leaflet': { projectType: 'library', root: 'projects/ngx-leaflet' },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');
    leaf('projects/ngx-leaflet/tsconfig.lib.json');
    leaf('projects/ngx-leaflet/tsconfig.spec.json');

    await run();

    expect(target('ngx-leaflet-demo')).toEqual({
      builder: 'angular-typechecker:typecheck',
      options: {
        tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
        maxWarnings: 0,
      },
      configurations: { ci: { failFast: true } },
    });
    expect(target('ngx-leaflet')).toEqual(LIB_TARGET);
  });

  it('throws on a same-named NON-ours target instead of clobbering (NGADD-01)', async () => {
    seedAngularJson({
      'ngx-leaflet-demo': {
        projectType: 'application',
        root: '',
        architect: {
          typecheck: { builder: '@angular-devkit/build-angular:something' },
        },
      },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');

    await expect(run()).rejects.toThrow(/already has a "typecheck" target/);
  });

  it('skips e2e/other project types (missing or non-app/library projectType)', async () => {
    seedAngularJson({
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      // Legacy e2e projects carry NO projectType field.
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');

    await run();

    expect(target('ngx-leaflet-demo')).toEqual(APP_TARGET);
    expect(target('ngx-leaflet-demo-e2e')).toBeUndefined();
  });

  it('moves a dependencies entry to devDependencies (RF-01 backstop)', async () => {
    seedNgxLeaflet();
    tree.overwrite(
      'package.json',
      JSON.stringify({ dependencies: { 'angular-typechecker': '0.2.0' } }),
    );

    await run();

    const pkg = JSON.parse(tree.readContent('package.json'));
    expect(pkg.dependencies?.['angular-typechecker']).toBeUndefined();
    expect(pkg.devDependencies?.['angular-typechecker']).toBe('0.2.0');
  });

  it('prints the no-caching notice exactly once on the main path', async () => {
    seedNgxLeaflet();

    await run();

    expect(messages.filter((m) => m === NO_CACHING_NOTICE)).toHaveLength(1);
  });

  it('throws when --project names a project that does not exist (WR-03)', async () => {
    seedNgxLeaflet();

    await expect(run({ project: 'does-not-exist' })).rejects.toThrow(
      /--project "does-not-exist" did not match an application or library project/,
    );
  });

  it('throws when --project names an e2e/non-app-library project (WR-03)', async () => {
    seedAngularJson({
      'ngx-leaflet-demo': { projectType: 'application', root: '' },
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');

    await expect(run({ project: 'ngx-leaflet-demo-e2e' })).rejects.toThrow(
      /--project "ngx-leaflet-demo-e2e" did not match an application or library project/,
    );
  });

  it('does NOT print the no-caching notice when auto-wire-all wires zero targets (IN-01)', async () => {
    seedAngularJson({
      'ngx-leaflet-demo-e2e': { root: 'e2e' },
    });

    await run();

    expect(messages).not.toContain(NO_CACHING_NOTICE);
  });

  it('bulk path skips-and-warns a non-resolvable project without aborting the workspace (B1)', async () => {
    seedAngularJson({
      'app-ok': { projectType: 'application', root: '' },
      'app-bad': { projectType: 'application', root: 'projects/app-bad' },
    });
    // Only app-ok has leaves; app-bad's projects/app-bad/tsconfig.* are absent, so
    // resolveTsConfigLeaves throws for it.
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');

    await run();

    // The resolvable project is wired; the non-resolvable one is skipped, not fatal.
    expect(target('app-ok')).toEqual(APP_TARGET);
    expect(target('app-bad')).toBeUndefined();
    // angular.json was still overwritten (partial wiring landed).
    expect(tree.exists('angular.json')).toBe(true);
    // A warn names the skipped project and routes to the configuration generator.
    const warned = messages.filter((m) => m.includes('app-bad'));
    expect(warned.length).toBeGreaterThan(0);
    expect(
      warned.some((m) => m.includes('angular-typechecker:configuration')),
    ).toBe(true);
    // No message misleads with the guidance for a flag ng-add lacks.
    expect(messages.some((m) => m.includes('Pass --tsConfig explicitly'))).toBe(
      false,
    );
  });

  it('throws an actionable, non-misleading error when --project cannot resolve leaves (B1)', async () => {
    seedAngularJson({
      'app-bad': { projectType: 'application', root: 'projects/app-bad' },
    });
    // No leaf files for app-bad, so resolveTsConfigLeaves throws.

    let caught: unknown;

    try {
      await run({ project: 'app-bad' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    // Points at the configuration command (which DOES accept --tsConfig)...
    expect((caught as Error).message).toContain(
      'angular-typechecker:configuration',
    );
    // ...and never names a flag ng-add lacks.
    expect((caught as Error).message).not.toContain(
      'Pass --tsConfig explicitly',
    );
  });

  it('auto-wires the ROOT app with the full [app, spec] array despite a pnpm-workspace name collision (collision-immune by construction)', async () => {
    seedAngularJson({
      'demo-app': { projectType: 'application', root: '' },
    });
    leaf('tsconfig.app.json');
    leaf('tsconfig.spec.json');
    // Root package.json name === the angular.json project name + a pnpm-workspace.yaml
    // covering the root: the exact shape that would let Nx infer a shadowing stub. The
    // vanilla path reads angular.json directly, so it is immune by construction.
    tree.overwrite('package.json', JSON.stringify({ name: 'demo-app' }));
    tree.create('pnpm-workspace.yaml', "packages:\n  - '.'\n");

    await run();

    expect(target('demo-app')).toEqual({
      builder: 'angular-typechecker:typecheck',
      options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
    });
  });
});

describe('ng-add schematic (RF-02 no-angular.json guard)', () => {
  let tree: UnitTestTree;
  let runner: SchematicTestRunner;
  let messages: string[];

  beforeEach(() => {
    tree = new UnitTestTree(new HostTree());
    runner = new SchematicTestRunner('angular-typechecker', collectionPath);
    messages = [];
    runner.logger.subscribe((entry) => messages.push(entry.message));
  });

  it('wires no target, ensures the devDependency, prints guidance, and creates no nx.json', async () => {
    tree.create(
      'package.json',
      JSON.stringify({ dependencies: { 'angular-typechecker': '0.2.0' } }),
    );

    const context = { logger: runner.logger } as unknown as SchematicContext;
    ngAdd({})(tree, context);

    // No angular.json -> nothing wired, no nx.json seeded.
    expect(tree.exists('angular.json')).toBe(false);
    expect(tree.exists('nx.json')).toBe(false);
    // devDependency still ensured.
    const pkg = JSON.parse(tree.readContent('package.json'));
    expect(pkg.dependencies?.['angular-typechecker']).toBeUndefined();
    expect(pkg.devDependencies?.['angular-typechecker']).toBe('0.2.0');
    // Guidance printed; the no-caching notice is NOT printed off the CLI path.
    expect(messages).toContain(NO_ANGULAR_JSON_NOTICE);
    expect(messages).not.toContain(NO_CACHING_NOTICE);
  });
});
