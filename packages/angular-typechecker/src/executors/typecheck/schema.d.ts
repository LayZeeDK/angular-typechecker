export interface TypecheckExecutorOptions {
  // ENG-01 (D-06): a single tsconfig path, OR a non-empty array of leaf paths whose
  // per-entry diagnostics are UNIONed and filtered over the combined declared input
  // set. Additive: a bare string keeps the pre-ENG-01 behavior byte-for-byte.
  tsConfig: string | string[];
  includeDeps?: boolean;
  maxWarnings?: number;
  failFast?: boolean;
  strict?: boolean;
}
