// Type-only re-export of the @angular/compiler-cli surface the core consumes.
//
// WHY THIS FILE EXISTS: under `module: nodenext` (the GATE A enabler that keeps
// the runtime dynamic load literal in the emitted .js), TypeScript treats
// @angular/compiler-cli's published `index.d.ts` as an ESM module. That barrel
// re-exports its members with EXTENSIONLESS relative paths
// (`export * from './src/transformers/api'`), which strict nodenext ESM
// resolution refuses to resolve (it only looks for a directory, never the
// sibling `api.d.ts`), so the `@angular/compiler-cli` namespace resolves EMPTY.
// (Confirmed via `tsc --traceResolution`: "Module './src/transformers/api' was
// not resolved.") The package's own deep declaration files DO resolve under
// nodenext, so we re-build the needed surface directly from them here, isolating
// the workaround to a single type-only module (erased at emit; zero runtime
// effect). Revisit if @angular/compiler-cli ships nodenext-clean typings.
import type {
  EmitFlags,
  Program,
} from '../../../../node_modules/@angular/compiler-cli/src/transformers/api';
import type {
  defaultGatherDiagnostics,
  ParsedConfiguration,
  performCompilation,
  readConfiguration,
} from '../../../../node_modules/@angular/compiler-cli/src/perform_compile';

export type { EmitFlags, ParsedConfiguration, Program };

/**
 * The structural type of the loaded @angular/compiler-cli namespace, assembled
 * from the package's deep declaration files (see file header for why the
 * barrel `index.d.ts` cannot be used under nodenext). Only the members the core
 * actually calls are declared; widen as the engine grows in Phase 2.
 */
export interface CompilerCli {
  readConfiguration: typeof readConfiguration;
  performCompilation: typeof performCompilation;
  defaultGatherDiagnostics: typeof defaultGatherDiagnostics;
  readonly EmitFlags: typeof EmitFlags;
}
