export { findWorkspaceRoot } from './lib/find-workspace-root';
export {
  buildCleanEnv,
  commandSucceeds,
  run,
  sh,
  removeTmpDir,
  type RunResult,
} from './lib/e2e-process';
export {
  expectSeededTypecheckTargetDefault,
  readTypecheckTargetDefault,
  resetVerdaccioPublishState,
  writeVerdaccioNpmrc,
  type TypecheckTargetDefault,
} from './lib/e2e-fixture';
export {
  createVerdaccioGlobalSetup,
  type VerdaccioGlobalSetupOptions,
} from './lib/verdaccio-global-setup';
export {
  APP_COMPONENT_ANCHOR,
  APP_COMPONENT_CODE,
  APP_COMPONENT_INJECTION,
  APP_PROJECT,
  APP_SPEC_CODE,
  APP_SPEC_INJECTION,
  LIB_COMPONENT_ANCHOR,
  LIB_COMPONENT_CODE,
  LIB_COMPONENT_INJECTION,
  LIB_PROJECT,
  assertPerProjectScoping,
  createNgRun,
  plant,
  typecheckTarget,
  type PerProjectScopingArgs,
  type TypecheckArchitectTarget,
} from './lib/ng-cli-e2e';
export {
  assertShippedBinExitCodes,
  runShim,
  type ShimResult,
} from './lib/cli-e2e';
