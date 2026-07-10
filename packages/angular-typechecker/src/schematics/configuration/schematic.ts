import { convertNxGenerator } from '@nx/devkit';

import configurationGenerator from '../../generators/configuration/generator';

/**
 * The Angular CLI `configuration` schematic (ACS-04) -- a thin `convertNxGenerator`
 * re-export of the SAME shared `configuration` generator default export. It writes
 * NO logic of its own: the `angular.json` write-fork lives in the generator (Plan
 * 01), so `ng generate angular-typechecker:configuration <project>` runs the exact
 * same code path as `nx g angular-typechecker:configuration`. `convertNxGenerator`
 * (shipped in the already-pinned `@nx/devkit`) wraps it as an
 * `@angular-devkit/schematics` Rule so the Angular CLI schematics engine can invoke
 * it via `collection.json`.
 *
 * This collection.json is Nx-invisible: Nx resolves `generators ?? schematics`, so
 * the untouched `generators` field keeps `nx g` reading `generators.json` -- proven,
 * not assumed, by `nx-generators-surface-regression.spec.ts`.
 */
export default convertNxGenerator(configurationGenerator);
