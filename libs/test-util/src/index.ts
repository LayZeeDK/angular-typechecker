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
  writeVerdaccioNpmrc,
  type TypecheckTargetDefault,
} from './lib/e2e-fixture';
