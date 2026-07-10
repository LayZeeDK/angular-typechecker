import { convertNxGenerator } from '@nx/devkit';

import ngAddGenerator from '../../generators/ng-add/generator';

/**
 * The Angular CLI `ng-add` schematic (NGADD-01) -- a thin `convertNxGenerator`
 * re-export of the composed `ngAddGenerator`. It writes NO logic of its own: the
 * enumerate-filter-compose orchestration lives in the generator, so `ng add
 * angular-typechecker` runs the exact same code as an Nx invocation of the
 * generator would. `convertNxGenerator` (shipped in the already-pinned
 * `@nx/devkit`) wraps it as an `@angular-devkit/schematics` Rule so the Angular
 * CLI schematics engine can invoke it via `collection.json` under the reserved
 * `ng-add` name.
 *
 * `ng-add` lives in `collection.json` ONLY -- never `generators.json`. Nx `nx add`
 * runs `<pkg>:init` (resolved via `generators ?? schematics`), so registering
 * `ng-add` as an Nx generator would change the `nx add` surface (Pitfall 5). The
 * surface-regression spec proves `ng-add` is absent from `generators.json`.
 */
export default convertNxGenerator(ngAddGenerator);
