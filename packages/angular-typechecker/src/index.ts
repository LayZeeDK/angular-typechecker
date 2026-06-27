export { loadCompilerCli } from './core/compiler-loader';
export { gatherAllDiagnostics } from './core/gather-diagnostics';
export {
  runTypecheck,
  TypecheckInfrastructureError,
} from './core/run-typecheck';
export type { CoreOptions, CoreResult } from './core/run-typecheck';
