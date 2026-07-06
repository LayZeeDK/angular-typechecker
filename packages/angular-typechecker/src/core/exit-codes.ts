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
// (it owns its process, like `ngc`) and is the ONLY consumer. The Nx executor does
// NOT call `toExitCode` -- it maps the run to Nx's `{ success }` -> 0/1 contract via
// `evaluateResult` (D-08). So `toExitCode` currently has no live consumer; it is
// the deliberate COR-04 scaffold for the deferred CLI (and a future Angular CLI
// builder could reuse it), which is why the one exit-code policy lives in `core/`.
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
 * `errorCount > 0` (genuine type errors) OR `suppressedInGraphErrorCount > 0`
 * (coverage-incomplete: a first-party in-graph error was dropped, SB-04 / D-06),
 * else `0` (clean). Coverage-incomplete REUSES `1` (Open Question 2 resolution: a
 * distinct code is not worth breaking ngc parity). Pure -- no process side
 * effects; the adapters own `process.exit`. `suppressedInGraphErrorCount` is
 * optional here so the pure unit tier keeps its minimal-literal idiom; an absent
 * count reads as `0` (nothing suppressed).
 */
export function toExitCode(
  input:
    | (Pick<CoreResult, 'errorCount'> &
        Partial<Pick<CoreResult, 'suppressedInGraphErrorCount'>>)
    | TypecheckInfrastructureError,
): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) {
    return 2;
  }

  if (input.errorCount > 0) {
    return 1;
  }

  // ponytail: coverage-incomplete maps to 1 for the suppressed-in-graph-ERROR
  // trigger only. The maxWarnings-gated suppressed-WARNING case and the
  // templateCheckAborted / zero-root-names coverage triggers are already enforced
  // by the LIVE `evaluateResult` path (the Nx executor's sole verdict). Mirror
  // them here when the deferred CLI gains a live consumer + a maxWarnings option
  // (`toExitCode` has neither today, so adding them now would be dead code).
  if ((input.suppressedInGraphErrorCount ?? 0) > 0) {
    return 1;
  }

  return 0;
}
