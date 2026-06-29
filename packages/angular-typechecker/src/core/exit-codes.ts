// The pure, framework-agnostic exit-code POLICY for a type-check run
// (COR-04 / D-07). It is the exit-code sibling of `evaluate-result.ts`'s
// `{ success }` verdict: the single source of truth that classifies a run as
// clean / type-error / infrastructure-failure, ngc-parallel
// (`@angular/compiler-cli`'s `exitCodeFromResult`).
//
// EXIT-CODE CONTRACT (ngc parity):
//   - 2 = infrastructure failure: the compiler failed to RUN (a config-resolution
//     crash or an internal `createProgram`/host/getter crash), surfaced as a
//     `TypecheckInfrastructureError`. NEVER collapsed into clean/type-error.
//   - 1 = type errors: `errorCount > 0` on a run that otherwise completed.
//   - 0 = clean: the run completed with no errors.
//
// PURITY (D-07 / eslint `**/src/core/**`): this policy performs NO process side
// effects. The deferred standalone CLI surface owns `process.exit(toExitCode(...))`
// (it owns its process, like `ngc`); the Nx executor stays bound to Nx's
// `{ success }` -> 0/1 contract (D-08) and consumes this only for classification.
// One definition, three consumers (Nx executor now, Angular CLI builder + CLI
// later) -- which is why it lives in `core/`.
//
// LAYERING: `toExitCode` is a leaf consumed by the adapters. `run-typecheck.ts`
// must NOT import this module -- the engine stays unaware of the exit policy and
// no import cycle is introduced.
import type { CoreResult } from './run-typecheck';
import { TypecheckInfrastructureError } from './run-typecheck';

/**
 * Maps a completed type-check result OR a thrown infrastructure error to the
 * literal ngc-parallel exit code (COR-04 / D-07): `2` for a
 * `TypecheckInfrastructureError` (the compiler failed to run), `1` when
 * `errorCount > 0` (genuine type errors), else `0` (clean). Pure -- no process
 * side effects; the adapters own `process.exit`.
 */
export function toExitCode(
  input: Pick<CoreResult, 'errorCount'> | TypecheckInfrastructureError,
): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) {
    return 2;
  }

  if (input.errorCount > 0) {
    return 1;
  }

  return 0;
}
