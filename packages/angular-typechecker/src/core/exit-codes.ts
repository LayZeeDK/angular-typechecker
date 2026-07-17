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
// effects. The standalone CLI is the live consumer and owns the exit code (it owns
// its process, like `ngc`): `src/cli/main.ts` calls `toExitCode` in its
// infrastructure-error catch, and `src/cli/bin.ts` applies the result via
// `process.exitCode =` (NOT `process.exit()`, to stay flush-safe on large buffered
// output). The Nx executor and the `convertNxExecutor`-derived Angular CLI builder
// do NOT call `toExitCode` -- they map the run to Nx's `{ success }` -> 0/1 contract
// via `evaluateResult` (D-08). This one COR-04 exit-code policy lives in `core/` so
// the single place that owns 0/1/2 is shared and framework-agnostic.
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
 *
 * This is the pure ngc-parity error/infra/clean policy ONLY. It deliberately does
 * NOT re-derive the coverage-incomplete / warnings-exceeded verdict from raw
 * counts: that verdict lives in ONE place, `evaluateResult`, which the Nx executor
 * already uses. A second, PARTIAL copy here would silently diverge -- a
 * `templateCheckAborted`- or `zero-root-names`-only run is `coverage-incomplete`
 * (success:false) in `evaluateResult` but reads clean from raw counts alone. The
 * standalone CLI (`src/cli/main.ts`) therefore maps `evaluateResult(...)`'s `success`
 * to the 0/1 split and reserves `toExitCode` for the infrastructure `2`, NOT
 * re-computing the verdict here; keeping `toExitCode` verdict-free avoids that fork.
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
