import type { Logger } from './logger';
import type { CoreResult } from './run-typecheck';
import type { SkippedReference } from './walk-references';

/**
 * The reusable advisory-notice seam (CLI-04). It renders the core's PURE
 * structured advisory fields (templateCheckAborted / skippedReferences / the split
 * suppressed counts / notTypeCheckedDeclaredFiles / bundlerQueryImports) as loud
 * `Logger` notices, moved VERBATIM out of the Nx executor so the Phase-26 CLI can
 * drive the same output without importing `executor.ts` (which drags
 * `@nx/devkit`/`chalk` -- the 24-06 crash class) or re-duplicating five message
 * helpers.
 *
 * PURE (D-11 / eslint `src/core`): the module performs NO I/O of its own --
 * no `console`, no `process`, no `nx`/`@nx/*`/`@angular-devkit/*` import (its only
 * imports are type-only + core-internal). The caller owns the concrete sink and
 * injects it as `Logger`; the detection(core)-vs-rendering(adapter) split holds
 * because this module takes no sink of its own.
 *
 * All are additive signalling that NEVER touch the verdict (`evaluateResult` owns
 * it). Each helper self-gates on its own guard, so a clean run emits nothing.
 */
export function emitAdvisoryNotices(result: CoreResult, logger: Logger): void {
  // D-05: preserve the exact current emission order -- the byte-identical
  // requirement rests on order + strings. Mirrors the former executor call site.
  warnTemplateCheckAborted(result, logger);
  warnSkippedReferences(result, logger);
  warnSuppressed(result, logger);
  warnNotTypeChecked(result, logger);
  warnBundlerQueryImports(result, logger);
}

/**
 * RES-02 (reframe; 09-RES-02-DECISION.md): when the core reports a TCB-generation
 * Fatal (`result.templateCheckAborted`), emit a LOUD `logger.warn` (distinct from
 * the infra `logger.error`) naming the offending file -- so the incompleteness
 * (surviving files' Angular template/extended NG8xxx diagnostics are suppressed
 * until that Fatal is fixed) is NEVER silent. The verdict is untouched: the Fatal
 * is still a counted type error, and the infra-vs-type path (D-05) is unchanged --
 * this is additive signalling, not a reclassification. Fires only when the core
 * flagged a TCB-generation Fatal -- never on clean / ordinarily-erroring runs.
 */
function warnTemplateCheckAborted(result: CoreResult, logger: Logger): void {
  if (result.templateCheckAborted === undefined) {
    return;
  }

  const offendingFile =
    result.templateCheckAborted.fileName ?? 'an unknown file';

  logger.warn(
    `angular-typechecker: a fatal template-compilation error (e.g. in ${offendingFile}) ` +
      `(NG3004 IMPORT_GENERATION_FAILURE) aborted Angular template type-check-block ` +
      `generation. Surviving files' Angular template/extended (NG8xxx) diagnostics ` +
      `may be SUPPRESSED until it is fixed -- this run's template check is ` +
      `INCOMPLETE, so its coverage is incomplete and the verdict is NOT clean. ` +
      `Fix all reported NG3004 diagnostics and re-run typecheck.`,
  );
}

/**
 * D-02 (Phase 13, L-4): surface the loud skipped-reference notice. Fires when the
 * core recorded at least one tsconfig skipped (out-of-project / zero-root-names /
 * self-reference) or reclassified (not-found -> 90002) -- either during a
 * solution-tsconfig reference walk OR as a directly-listed entry of a `tsConfig`
 * array (ENG-01: the array path records a zero-root-names skip for an empty leaf,
 * where no reference walk happened). The message stays provenance-neutral so it is
 * accurate for both sources. One logger.warn per reference. Core sets
 * skippedReferences only when non-empty (never []), so the optional-chained length
 * check alone is sufficient.
 */
function warnSkippedReferences(result: CoreResult, logger: Logger): void {
  if (!result.skippedReferences?.length) {
    return;
  }

  for (const skipped of result.skippedReferences) {
    logger.warn(
      `angular-typechecker: tsconfig '${skipped.referencePath}' was skipped ` +
        `or reclassified (reason: ${skipped.reason}). ` +
        skippedReferenceVerdictNote(skipped.reason),
    );
  }
}

/**
 * The verdict-note tail of a skipped-reference notice. A `not-found` reference is
 * folded into the report as a COUNTED 90002 Error that FAILS the verdict, so its
 * notice must NOT claim to be advisory-only (the C4 inaccuracy). A `zero-root-names`
 * reference no longer claims "verdict unchanged" either: under input-set membership
 * (Phase 17), if a sibling leaf was checked, this leaf's transitively-imported
 * files can be dropped by the project boundary and counted as suppressedInGraph -- a
 * coverage-incomplete (non-clean) verdict. Every OTHER reason (out-of-project /
 * self-reference / duplicate) still excludes the leaf's own diagnostics WITHOUT
 * changing the verdict, so that advisory wording holds.
 */
function skippedReferenceVerdictNote(
  reason: SkippedReference['reason'],
): string {
  if (reason === 'not-found') {
    return (
      `It is reported as a counted error (90002) that FAILS the type-check -- ` +
      `restore the referenced tsconfig or remove the stale reference.`
    );
  }

  if (reason === 'zero-root-names') {
    return (
      `If a sibling leaf was checked, this leaf's transitively-imported files ` +
      `may have been dropped by the project boundary -- contributing to a ` +
      `coverage-incomplete (non-clean) verdict. See the coverage-incomplete notice.`
    );
  }

  return `This notice is advisory only -- the type-check verdict is unchanged.`;
}

/**
 * SB-04 (17-RESEARCH Pitfall 5; storybook-input-set-boundary step 3): surface the
 * two split suppressed counts LOUDLY from the PURE structured CoreResult fields --
 * CI gates on the exit code and agents on the verdict, but a human needs the notice
 * too. The counts are NOT recomputed here -- they are read straight off the
 * structured result. Both fire only when > 0, so a clean host stays silent.
 *
 * Expected node_modules suppressions are a quiet INFO -- NEVER verdict-affecting
 * (dependency isolation) -- pass `includeDeps` to fold them back in.
 *
 * D-07 / T-17-12 / T-17-13: a dropped FIRST-PARTY (in-graph) diagnostic is the
 * milestone's core correctness signal -- LOUD WARN. It names the dropped files
 * (from the pure `suppressedInGraphFiles`) ONLY, NEVER the dependency's error text,
 * so content isolation (criterion 3) holds while the coverage loss is never silent.
 * The verdict itself is decided by evaluateResult (17-04).
 */
function warnSuppressed(result: CoreResult, logger: Logger): void {
  if (result.suppressedThirdParty > 0) {
    logger.info(
      `angular-typechecker: ${result.suppressedThirdParty} node_modules diagnostic(s) ` +
        `suppressed (expected; pass includeDeps to include them).`,
    );
  }

  if (
    result.suppressedInGraphErrorCount > 0 ||
    result.suppressedInGraphWarningCount > 0
  ) {
    logger.warn(
      `angular-typechecker: this run's coverage is INCOMPLETE -- ` +
        `${result.suppressedInGraphErrorCount} error(s) and ` +
        `${result.suppressedInGraphWarningCount} warning(s) on first-party files were ` +
        `dropped by the project boundary. In-graph errors force a non-clean ` +
        `(coverage-incomplete) verdict; dropped in-graph warnings count toward ` +
        `maxWarnings just like reported warnings (and fail unconditionally under ` +
        `strict), so with no maxWarnings and no strict they are advisory only. A real ` +
        `diagnostic on a checked file may have been suppressed. Dropped file(s): ` +
        `${result.suppressedInGraphFiles.join(', ')}.`,
    );
  }
}

/**
 * D-01 (Phase 18, T11): surface the loud "not type-checked" advisory for
 * declared-but-uncheckable files. `.mdx` is NEVER type-checked; JSX in a `.tsx` is
 * only checked when compilerOptions.jsx is set (a `.tsx` with no JSX is still fully
 * checked). Names the consumer's OWN declared files (from the pure
 * notTypeCheckedDeclaredFiles) ONLY, never dependency error text -- the isolation
 * rule mirrors suppressedInGraphFiles. Core sets the field only when non-empty
 * (mapping [] -> undefined), so the optional-chained length check is sufficient.
 * ADVISORY ONLY: the verdict is unchanged (evaluateResult never reads this field).
 */
function warnNotTypeChecked(result: CoreResult, logger: Logger): void {
  if (!result.notTypeCheckedDeclaredFiles?.length) {
    return;
  }

  logger.warn(
    `angular-typechecker: ${result.notTypeCheckedDeclaredFiles.length} declared file(s) may not ` +
      `be fully type-checked -- .mdx is never type-checked, and JSX in a .tsx is only checked ` +
      `when compilerOptions.jsx is set (a .tsx with no JSX is still fully checked; JSX under an ` +
      `unset jsx reports TS17004). This is ADVISORY: the verdict is unchanged. ` +
      `File(s): ${result.notTypeCheckedDeclaredFiles.join(', ')}.`,
  );
}

/**
 * SB-09 D-04 (Phase 20): surface the loud bundler-query-import advisory. An
 * unresolved TS2307 whose module specifier contains a bundler (Vite/Analog) query
 * suffix (e.g. ?raw/?url/?worker/?inline) looks like a Vite/Analog import the
 * consumer can resolve with `"types": ["vite/client"]`. Names the consumer's OWN
 * specifiers (from the pure bundlerQueryImports, read off the POST-boundary-filter
 * kept set) ONLY, never dependency error text -- the isolation rule mirrors
 * notTypeCheckedDeclaredFiles / suppressedInGraphFiles. Core sets the field only
 * when non-empty (mapping [] -> undefined), so the optional-chained length check is
 * sufficient (self-gating -- D-03). ADVISORY ONLY: the verdict is unchanged and the
 * TS2307 are NOT suppressed -- a missing module can be a real bug (evaluateResult
 * never reads this field).
 */
function warnBundlerQueryImports(result: CoreResult, logger: Logger): void {
  if (!result.bundlerQueryImports?.length) {
    return;
  }

  logger.warn(
    `angular-typechecker: ${result.bundlerQueryImports.length} unresolved import(s) use a bundler ` +
      `query suffix (e.g. ?raw/?url/?worker/?inline) -- these look like Vite/Analog imports. Add ` +
      `"types": ["vite/client"] to the checked tsconfig (or an ambient 'declare module' shim) to ` +
      `resolve them. This is ADVISORY: the TS2307 are NOT suppressed (a missing module can be a ` +
      `real bug). Specifier(s): ${result.bundlerQueryImports.join(', ')}.`,
  );
}
