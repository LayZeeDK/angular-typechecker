import { convertNxGenerator } from '@nx/devkit';

import initGenerator from '../../generators/init/generator';

/**
 * The Angular CLI `init` schematic (ACS-03) -- a thin `convertNxGenerator`
 * re-export of the SAME shared `init` generator default export. It writes NO
 * logic of its own: the `tree.exists('angular.json')` early-return fork lives in
 * the generator (Plan 01), so `ng generate angular-typechecker:init` runs the
 * exact same forked code path as `nx g angular-typechecker:init`. On an Angular
 * CLI workspace the fork seeds NO caching and creates NO stray `nx.json`.
 * `convertNxGenerator` (shipped in the already-pinned `@nx/devkit`) wraps it as an
 * `@angular-devkit/schematics` Rule so the Angular CLI schematics engine can
 * invoke it via `collection.json`.
 *
 * This collection.json is Nx-invisible: Nx resolves `generators ?? schematics`, so
 * the untouched `generators` field keeps `nx g`/`nx add` reading `generators.json`
 * -- proven, not assumed, by `nx-generators-surface-regression.spec.ts`.
 */
export default convertNxGenerator(initGenerator);
