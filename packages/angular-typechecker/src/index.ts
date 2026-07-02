// Public programmatic API surface. This Nx plugin's PRIMARY surface is the executor
// (executors.json) and the generators (generators.json), which Nx loads BY PATH --
// never through this barrel. The barrel therefore exposes only a small, deliberate
// "run the whole-program type-check from code" API:
//
//   import { runTypecheck } from 'angular-typechecker';
//   const result = await runTypecheck({ tsConfigPath }); // catch TypecheckInfrastructureError
//
// The engine internals (compiler loader, unconditional gatherer, project-boundary
// filter, formatter, report renderer, verdict evaluator) are INTENTIONALLY NOT
// exported -- they are implementation details reached module-to-module and remain
// free to change without a public-API break. `TemplateCheckAborted` stays reachable
// transitively via `CoreResult.templateCheckAborted` but is not exported by name.
export {
  runTypecheck,
  TypecheckInfrastructureError,
} from './core/run-typecheck';
export type { CoreOptions, CoreResult } from './core/run-typecheck';
export type { SkippedReference } from './core/walk-references';
