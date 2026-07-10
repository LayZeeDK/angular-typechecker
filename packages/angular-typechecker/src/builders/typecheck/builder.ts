import { convertNxExecutor } from '@nx/devkit';

import typecheckExecutor from '../../executors/typecheck/executor';

/**
 * The Angular CLI builder (ACB-01) -- a thin `convertNxExecutor` re-export of the
 * SAME `typecheck` executor default export. It writes NO logic of its own: parity
 * with the Nx executor is STRUCTURAL because it IS that executor (same core, same
 * report to the same stdout, same `{ success }`). `convertNxExecutor` (shipped in
 * the already-pinned `@nx/devkit`) wraps it as an `@angular-devkit/architect`
 * builder so an `angular.json` `architect`/`targets` entry runs it via
 * `ng run <project>:typecheck`.
 *
 * The CJS->ESM `await import('@angular/compiler-cli')` bridge lives UNCHANGED in
 * `core/compiler-loader.ts`; the builder never re-transforms it. GATE A' (spike
 * 011) proves the bridge survives `convertNxExecutor` + a real `ng run` (including
 * the wrapper's eager `retrieveProjectConfigurationsWithAngularProjects` prelude),
 * and `gate-a-static.spec.ts` asserts the built `builder.js` never
 * `require()`s `@angular/compiler-cli`.
 */
export default convertNxExecutor(typecheckExecutor);
