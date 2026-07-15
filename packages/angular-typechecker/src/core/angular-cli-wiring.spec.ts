import { describe, expect, it } from 'vitest';

import {
  NO_ANGULAR_JSON_NOTICE,
  NO_CACHING_NOTICE,
  TYPECHECK_EXECUTOR_ID,
  resolveTargetName,
  resolveTsConfigLeaves,
  resolveTsConfigOverride,
  wireTypecheckTarget,
} from './angular-cli-wiring';
import type { AngularJsonWorkspace } from './angular-cli-wiring';

// Pure unit coverage for the framework-agnostic wiring core (24-06). Every rung of
// leaf resolution + the targetName guard + collision-by-builder + the idempotent
// [build, spec] merge is exercised with plain data: an in-memory `exists` set and
// plain workspace objects -- NO Tree, NO devkit, NO schematics. This is the
// authoritative fast unit tier for the collision-critical decision logic that BOTH
// the vanilla ng-add schematic and the Nx configuration generator now share.

// exists callback backed by an in-memory set of workspace-relative paths.
function existsIn(paths: string[]): (path: string) => boolean {
  const set = new Set(paths);

  return (path) => set.has(path);
}

const existsAll = (): boolean => true;

describe('resolveTargetName', () => {
  it('defaults a missing name to "typecheck"', () => {
    expect(resolveTargetName(undefined, 'app')).toBe('typecheck');
  });

  it('passes an explicit name through', () => {
    expect(resolveTargetName('lint-types', 'app')).toBe('lint-types');
  });

  it('throws on an empty / whitespace-only name', () => {
    expect(() => resolveTargetName('   ', 'app')).toThrow(
      /must be a non-empty target name/,
    );
  });
});

describe('resolveTsConfigOverride', () => {
  it('joins a relative override to the project root and probes existence', () => {
    expect(
      resolveTsConfigOverride(
        'projects/lib',
        'tsconfig.custom.json',
        'lib',
        existsIn(['projects/lib/tsconfig.custom.json']),
      ),
    ).toBe('projects/lib/tsconfig.custom.json');
  });

  it('normalizes a backslash relative override to a forward-slash path', () => {
    expect(
      resolveTsConfigOverride(
        'projects/lib',
        'custom\\tsconfig.app.json',
        'lib',
        existsIn(['projects/lib/custom/tsconfig.app.json']),
      ),
    ).toBe('projects/lib/custom/tsconfig.app.json');
  });

  it('returns an absolute override verbatim without probing', () => {
    expect(
      resolveTsConfigOverride(
        'projects/lib',
        '/abs/x.json',
        'lib',
        existsIn([]),
      ),
    ).toBe('/abs/x.json');
  });

  it('throws a located error for a missing relative override', () => {
    expect(() =>
      resolveTsConfigOverride('', 'nope.json', 'app', existsIn([])),
    ).toThrow(
      /--tsConfig "nope.json" for project "app" resolves to "nope.json", which does not exist/,
    );
  });
});

describe('resolveTsConfigLeaves', () => {
  it('resolves the [app, spec] array for a root application', () => {
    expect(
      resolveTsConfigLeaves('', 'application', undefined, 'app', existsAll),
    ).toEqual(['tsconfig.app.json', 'tsconfig.spec.json']);
  });

  it('resolves the [lib, spec] array for a subdir library', () => {
    expect(
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        undefined,
        'lib',
        existsAll,
      ),
    ).toEqual([
      'projects/lib/tsconfig.lib.json',
      'projects/lib/tsconfig.spec.json',
    ]);
  });

  it('drops a missing spec leaf, keeping the single build leaf', () => {
    expect(
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        undefined,
        'lib',
        existsIn(['projects/lib/tsconfig.lib.json']),
      ),
    ).toEqual(['projects/lib/tsconfig.lib.json']);
  });

  it('throws a located error when no leaf exists', () => {
    expect(() =>
      resolveTsConfigLeaves(
        'projects/x',
        'library',
        undefined,
        'x',
        existsIn([]),
      ),
    ).toThrow(
      /Could not resolve a tsconfig for project "x": no ".*tsconfig.lib.json" and no ".*tsconfig.spec.json". Pass --tsConfig explicitly./,
    );
  });

  it('honors a relative --tsConfig override as a single-element array', () => {
    expect(
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        'tsconfig.custom.json',
        'lib',
        existsIn(['projects/lib/tsconfig.custom.json']),
      ),
    ).toEqual(['projects/lib/tsconfig.custom.json']);
  });

  it('normalizes a backslash relative --tsConfig override to a forward-slash path', () => {
    expect(
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        'custom\\tsconfig.app.json',
        'lib',
        existsIn(['projects/lib/custom/tsconfig.app.json']),
      ),
    ).toEqual(['projects/lib/custom/tsconfig.app.json']);
  });

  it('passes an absolute --tsConfig override through verbatim', () => {
    expect(
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        '/abs/tsconfig.custom.json',
        'lib',
        existsIn([]),
      ),
    ).toEqual(['/abs/tsconfig.custom.json']);
  });

  it('throws a located --tsConfig error for a missing relative override', () => {
    expect(() =>
      resolveTsConfigLeaves(
        'projects/lib',
        'library',
        'tsconfig.missing.json',
        'lib',
        existsIn([]),
      ),
    ).toThrow(
      /--tsConfig "tsconfig.missing.json" for project "lib" resolves to/,
    );
  });
});

describe('wireTypecheckTarget', () => {
  it('writes the builder + tsConfig on a fresh project', () => {
    const workspace: AngularJsonWorkspace = {
      version: 1,
      projects: { app: { projectType: 'application', root: '' } },
    };

    wireTypecheckTarget(workspace, 'app', 'typecheck', [
      'tsconfig.app.json',
      'tsconfig.spec.json',
    ]);

    expect(workspace.projects.app.architect?.typecheck).toEqual({
      builder: TYPECHECK_EXECUTOR_ID,
      options: { tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'] },
    });
  });

  it('re-asserts OUR target idempotently, preserving user options + configurations', () => {
    const workspace: AngularJsonWorkspace = {
      version: 1,
      projects: {
        app: {
          projectType: 'application',
          root: '',
          architect: {
            typecheck: {
              builder: TYPECHECK_EXECUTOR_ID,
              options: {
                tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
                maxWarnings: 0,
              },
              configurations: { ci: { failFast: true } },
            },
          },
        },
      },
    };

    wireTypecheckTarget(workspace, 'app', 'typecheck', [
      'tsconfig.app.json',
      'tsconfig.spec.json',
    ]);

    expect(workspace.projects.app.architect?.typecheck).toEqual({
      builder: TYPECHECK_EXECUTOR_ID,
      options: {
        tsConfig: ['tsconfig.app.json', 'tsconfig.spec.json'],
        maxWarnings: 0,
      },
      configurations: { ci: { failFast: true } },
    });
  });

  it('throws on a same-named NON-ours target instead of clobbering', () => {
    const workspace: AngularJsonWorkspace = {
      version: 1,
      projects: {
        app: {
          projectType: 'application',
          root: '',
          architect: {
            typecheck: { builder: '@angular-devkit/build-angular:something' },
          },
        },
      },
    };

    expect(() =>
      wireTypecheckTarget(workspace, 'app', 'typecheck', ['tsconfig.app.json']),
    ).toThrow(/already has a "typecheck" target/);
  });
});

describe('exported constants', () => {
  it('exposes the unscoped executor/builder id', () => {
    expect(TYPECHECK_EXECUTOR_ID).toBe('angular-typechecker:typecheck');
  });

  it('exposes the shared notices', () => {
    expect(NO_CACHING_NOTICE).toContain('angular-typechecker');
    expect(NO_ANGULAR_JSON_NOTICE).toContain('no angular.json found');
  });
});
