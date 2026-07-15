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
