export interface TypecheckExecutorOptions {
  tsConfig: string;
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
  strict?: boolean;
}
