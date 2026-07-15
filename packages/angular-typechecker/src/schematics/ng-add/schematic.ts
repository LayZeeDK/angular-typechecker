import type { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

import {
  NO_ANGULAR_JSON_NOTICE,
  NO_CACHING_NOTICE,
  resolveTsConfigLeaves,
  wireTypecheckTarget,
} from '../../core/angular-cli-wiring';
import type { AngularJsonWorkspace } from '../../core/angular-cli-wiring';
import type { NgAddSchema } from './schema';

// The UNSCOPED published package name -- the key `ng add` installs into package.json.
const PACKAGE_NAME = 'angular-typechecker';

/**
 * The first-party Angular CLI `ng-add` schematic (NGADD-01): `ng add
 * angular-typechecker`.
 *
 * VANILLA Angular schematics Rule -- it NEVER loads the Nx devkit or nx runtime
 * (its `@angular-devkit/schematics` imports are TYPE-ONLY, erased at compile, so the
 * compiled schematic.js requires ONLY the pure first-party core). This is the
 * load-bearing 24-06/Option C fix: the Angular CLI's post-install
 * `createSchematic('ng-add')` probe (and the schematic's execution) no longer pull
 * in nx's transitive `ora -> log-symbols -> chalk` chain, which throws
 * `chalk.blue is not a function` under yarn 4's last-in-wins hoist -- so `ng add`
 * auto-wires every project on the FIRST run under yarn (npm/pnpm already worked).
 * Reading angular.json DIRECTLY is also collision-immune (no Nx inference stub -> the
 * ACV-01 pnpm-workspace shadow defect cannot arise). Leaf resolution + collision +
 * the idempotent merge are the shared framework-agnostic core (extract, not
 * duplicate) -- the SAME code the Nx `configuration` generator uses.
 *
 * `ng-add` lives in `collection.json` ONLY -- never `generators.json`. Nx `nx add`
 * runs `<pkg>:init` (resolved via `generators ?? schematics`), so the surface stays
 * unchanged (Pitfall 5); the surface-regression spec proves it.
 */
export default function ngAdd(options: NgAddSchema): Rule {
  return (tree: Tree, context: SchematicContext): Tree => {
    // 1. RF-01 devDependency ensure: if `ng add` placed angular-typechecker in
    // dependencies, move it to devDependencies (a type-checker is dev tooling).
    const packageJson = tree.read('package.json');

    if (packageJson) {
      const pkg = JSON.parse(packageJson.toString('utf-8'));
      const version = pkg.dependencies?.[PACKAGE_NAME];

      if (version) {
        delete pkg.dependencies[PACKAGE_NAME];
        pkg.devDependencies ??= {};
        pkg.devDependencies[PACKAGE_NAME] ??= version;
        tree.overwrite('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
      }
    }

    // 2. RF-02 guard: without angular.json this is not an Angular CLI workspace --
    // print guidance and return, wiring no targets and seeding no nx.json. `tree.read`
    // returns null for a missing file, so this both detects "no angular.json" and
    // yields the buffer for the parse below (no non-null assertion needed).
    const angularJson = tree.read('angular.json');

    if (!angularJson) {
      context.logger.info(NO_ANGULAR_JSON_NOTICE);

      return tree;
    }

    // 3. Parse angular.json ONCE and wire every in-scope application/library project.
    // root/projectType are read STRAIGHT from angular.json -- collision-immune (ACV-01).
    const workspace = JSON.parse(
      angularJson.toString('utf-8'),
    ) as AngularJsonWorkspace;

    let wired = 0;

    for (const [name, project] of Object.entries(workspace.projects)) {
      if (options.project && name !== options.project) {
        continue;
      }

      if (
        project.projectType !== 'application' &&
        project.projectType !== 'library'
      ) {
        continue;
      }

      // Only LEAF RESOLUTION is caught here. A genuine target collision
      // (wireTypecheckTarget throwing) is a clash, not a resolution failure, so it
      // still aborts on BOTH paths (bulk + --project) -- left outside this try.
      let leaves: string[];

      try {
        leaves = resolveTsConfigLeaves(
          project.root ?? '',
          project.projectType,
          undefined,
          name,
          (p) => tree.exists(p),
        );
      } catch {
        // ng-add has NO --tsConfig flag, so never surface the core "Pass --tsConfig
        // explicitly" guidance here -- route the user to the configuration generator,
        // which DOES accept --tsConfig.
        const route =
          `Wire it explicitly with: ng generate ` +
          `angular-typechecker:configuration ${name} --tsConfig <path>`;

        if (options.project) {
          // An explicit --project that matched this app/library project but failed
          // leaf resolution is a user error -- fail loudly (before the WR-03 guard).
          throw new Error(
            `angular-typechecker: could not resolve a tsconfig for project ` +
              `"${name}". ${route}`,
          );
        }

        // Bulk path: partial wiring beats aborting the whole workspace. Warn,
        // skip this project (do NOT increment `wired`), and keep going.
        context.logger.warn(
          `angular-typechecker: skipping project "${name}" -- could not ` +
            `resolve a tsconfig for it. ${route}`,
        );

        continue;
      }

      wireTypecheckTarget(workspace, name, 'typecheck', leaves);
      wired++;
    }

    // 4. WR-03: a `--project` that matched no application/library project (a typo, or
    // an e2e/other project) is a user error -- fail loudly.
    if (options.project && wired === 0) {
      throw new Error(
        `--project "${options.project}" did not match an application or library ` +
          `project. Omit --project to wire every application + library project.`,
      );
    }

    // 5. IN-01: nothing wired (an angular.json with only e2e/other projects, no
    // --project) -- do not overwrite, do not misreport with the notice.
    if (wired === 0) {
      return tree;
    }

    // 6. Persist the whole workspace object (preserves every unmodeled key) and print
    // the shared no-caching notice ONCE. options.skipFormat is accepted for schema
    // parity but is a no-op on the vanilla path -- there is no devkit Prettier pass;
    // the target SHAPE, not whitespace, is what the specs + e2e assert.
    tree.overwrite('angular.json', `${JSON.stringify(workspace, null, 2)}\n`);
    context.logger.info(NO_CACHING_NOTICE);

    return tree;
  };
}
