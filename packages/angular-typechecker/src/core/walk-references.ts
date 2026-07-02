import { dirname, resolve } from 'node:path';

import type ts from 'typescript';

import type {
  CompilerCli,
  EmitFlags,
  ParsedConfiguration,
} from './compiler-cli-types';
import { createCanonicalizer, isUnderDir } from './filter-diagnostics';
import {
  EMIT_NEUTRALIZING_OPTIONS,
  gatherAllDiagnostics,
} from './gather-diagnostics';

/**
 * WALK-01 (Phase 13): the PURE core reference walk for a solution /
 * references-only `tsconfig.json`. It resolves the solution's DIRECT
 * `references[]` (one level -- D-03; `ParsedConfiguration.projectReferences` is a
 * flat `readonly ts.ProjectReference[]`, so a single-level walk is the data's
 * natural shape), canonicalizes + dedupes the resolved leaf paths and skips the
 * self-reference (D-04), applies the D-01 module-boundary guard (path-containment
 * under the solution tsconfig's directory, reusing the SAME `createCanonicalizer`
 * / `isUnderDir` the boundary filter ships), runs `performCompilation` per
 * surviving leaf with the SAME emit-neutralizing override block as the direct
 * path (run-typecheck.ts), UNIONs the RAW per-leaf gathered diagnostics, and
 * synthesizes a counted `90002` Error for a nonexistent leaf PATH (D-05
 * fold-and-count) so a broken reference is a deterministic non-zero verdict and
 * survivors still walk.
 *
 * PURE detection throughout: NO console, NO process, NO Nx devkit import (core
 * stays Nx-agnostic). The skipped/reclassified references are RECORDED on
 * `WalkResult.skippedReferences`
 * (mirroring the RES-02 `TemplateCheckAborted` field pattern); the Nx executor
 * adapter -- not this module -- renders the loud `logger.warn` notice.
 *
 * The walk NEVER filters or dedupes: it returns the RAW union. `runTypecheck`
 * feeds that union into the SINGLE existing `finalize` (one boundary-filter ->
 * `ts.sortAndDeduplicateDiagnostics` -> explicit category counts over the whole
 * union). A second dedupe/merge layer here would double-implement the merge and
 * misreconcile counts.
 */
export interface WalkResult {
  // The UNION of raw (pre-filter, pre-dedupe) diagnostics gathered across every
  // walked leaf, in walk order, PLUS any synthesized 90002 not-found
  // diagnostics. Fed straight into the single existing finalize() over the
  // union (L-1) -- NOT filtered or deduped here.
  rawDiagnostics: readonly ts.Diagnostic[];
  // Sum of `parsed.rootNames.length` across WALKED (surviving) leaves. A
  // skipped/broken leaf contributes 0 (L-3 / Pitfall 5).
  rootNamesCount: number;
  // References skipped (out-of-project / zero-root-names / self-reference /
  // duplicate) or reclassified (not-found -> 90002) during the walk. Empty array
  // when every reference walked cleanly; `runTypecheck` maps `[]` -> `undefined`
  // on `CoreResult` so the adapter's presence check is sufficient.
  skippedReferences: readonly SkippedReference[];
}

/**
 * A single skipped or reclassified reference edge, recorded during the walk.
 * PURE detection (no `console`/`process`), modelled on the RES-02
 * `TemplateCheckAborted` shape (run-typecheck.ts): a small named interface
 * carried on `CoreResult`; the executor adapter renders the notice. ADVISORY
 * only -- recording a skip NEVER changes the verdict (the boundary-skipped
 * leaf's own diagnostics simply never enter the union; a not-found leaf is a
 * counted `90002`).
 */
export interface SkippedReference {
  // The resolved absolute path of the referenced leaf tsconfig.
  referencePath: string;
  // Discriminator explaining why the reference was skipped or reclassified.
  // `self-reference` is the solution referencing ITSELF; `duplicate` is a leaf
  // listed more than once. Both are output-neutral (the leaf is never compiled
  // twice), but they are DISTINCT causes, so the advisory names each accurately
  // rather than folding a genuine duplicate under the misleading `self-reference`
  // label. Additive to the union (0.x semver); the executor renders the reason
  // string verbatim.
  reason:
    | 'out-of-project'
    | 'zero-root-names'
    | 'self-reference'
    | 'duplicate'
    | 'not-found';
}

// Private synthesized-diagnostic code for the D-05 not-found reference (a
// sibling to run-typecheck.ts's `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE = 90001`).
// Chosen OUTSIDE the TypeScript code range (1xxx-9xxx / TS18xxx, all < 90000),
// OUTSIDE the Angular negative `-99xxxx` encoding, and OUTSIDE the `500`
// UNKNOWN_ERROR_CODE space, so it can never collide with a genuine TS or NG
// diagnostic (same rationale as 90001).
const REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE = 90002;

/**
 * Walks the solution tsconfig's direct references and returns the raw union +
 * summed rootNamesCount + the recorded skipped/reclassified references. See the
 * `WalkResult` doc for the full contract.
 */
export async function walkReferences(
  ng: CompilerCli,
  ts: typeof import('typescript'),
  solutionParsed: ParsedConfiguration,
  solutionTsConfigPath: string,
): Promise<WalkResult> {
  const references = solutionParsed.projectReferences ?? [];

  // D-01 / D-04: canonicalize with the SAME machinery the boundary filter ships
  // (realpath -> `\\`->`/` -> case-fold on a case-insensitive FS). Sourced from
  // `ts.sys` because the walk runs BEFORE any per-leaf Program exists; core
  // stays pure (`ts.sys` is not `process`/`console`).
  const canonicalize = createCanonicalizer({
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    realpath: (filePath: string): string =>
      ts.sys.realpath?.(filePath) ?? filePath,
  });

  const solutionDir = dirname(solutionTsConfigPath);
  const canonicalSolutionDir = canonicalize(solutionDir);
  const canonicalSolutionPath = canonicalize(solutionTsConfigPath);

  const rawDiagnostics: ts.Diagnostic[] = [];
  const skippedReferences: SkippedReference[] = [];
  const seenCanonicalLeaves = new Set<string>();
  let rootNamesCount = 0;

  for (const reference of references) {
    // Resolve the reference path against the solution directory to an absolute
    // leaf tsconfig path, then canonicalize for the self/dup + boundary checks.
    const leafPath = resolve(solutionDir, reference.path);
    const canonicalLeaf = canonicalize(leafPath);

    // D-04: skip the self-reference (canonical leaf equals the solution) and any
    // duplicate canonical leaf already seen. Both are output-neutral repeats of an
    // already-covered leaf (the union finalize dedupes diagnostics by value
    // anyway), so skipping here saves the redundant performCompilation per
    // repeated edge -- but they are DISTINCT causes, so each is labelled honestly:
    // a solution referencing ITSELF is `self-reference`; a leaf listed twice is
    // `duplicate`. Folding a genuine duplicate under `self-reference` would print a
    // false "self-referential" advisory for a config that is not self-referential.
    if (canonicalLeaf !== undefined && canonicalLeaf === canonicalSolutionPath) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'self-reference',
      });

      continue;
    }

    if (canonicalLeaf !== undefined && seenCanonicalLeaves.has(canonicalLeaf)) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'duplicate',
      });

      continue;
    }

    if (canonicalLeaf !== undefined) {
      seenCanonicalLeaves.add(canonicalLeaf);
    }

    // D-01: the module-boundary guard. If the resolved leaf is NOT under the
    // solution tsconfig's directory, SKIP it (never compile it) so an outsider's
    // sources never enter the union. Reuses `isUnderDir` verbatim. A `undefined`
    // canonicalLeaf (a throwing realpath) CANNOT prove the leaf is out-of-project,
    // so we DELIBERATELY skip this boundary check and WALK the leaf (over-keep-safe,
    // matching the RES-03 fail-safe bias in filter-diagnostics.ts) -- its own
    // diagnostics are still boundary-filtered against the solution basePath in
    // `finalize`, so an out-of-project source cannot leak. Guarding on
    // `canonicalLeaf !== undefined` is REQUIRED: `isUnderDir`'s over-keep branch
    // keys off an undefined DIR, not an undefined FILE, so passing the raw
    // (backslash, un-normalized) `leafPath` would fail `startsWith` the
    // forward-slashed `canonicalSolutionDir` on Windows and wrongly drop the leaf
    // as out-of-project.
    if (
      canonicalLeaf !== undefined &&
      !isUnderDir(canonicalLeaf, canonicalSolutionDir)
    ) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'out-of-project',
      });

      continue;
    }

    // Per-leaf config resolution. A code-500 UNKNOWN_ERROR_CODE in `parsed.errors`
    // comes from readConfiguration's outer catch (a nonexistent PATH's ENOENT, or
    // a genuine crash on an EXISTING file such as a circular `extends` RangeError).
    const parsed = ng.readConfiguration(leafPath);

    // D-05 (B3): detect the config 500 BY CODE ONLY (never `source`/message text),
    // then split the two causes by whether the leaf FILE exists on disk (still a
    // code-only test -- no message sniffing):
    //   - the leaf does NOT exist (ENOENT) -> a genuine not-found reference.
    //     Fold-and-count into a counted 90002 Error, record the skip, and CONTINUE
    //     (this leaf contributes 0 to rootNamesCount).
    //   - the leaf EXISTS but config resolution still crashed -> an INFRASTRUCTURE
    //     failure, exactly as on the direct single-leaf path (run-typecheck.ts).
    //     Push the raw 500 into the union UNCHANGED; `runTypecheck`'s post-walk
    //     union scan re-throws it as a TypecheckInfrastructureError (walk-references
    //     stays pure and free of the run-typecheck import cycle). It must NEVER be
    //     mislabelled "not found" for a file that is present.
    // A bad-`extends` TARGET yields a folded 5012 (NOT a 500) and is out of scope
    // here -- it flows through as a normal surviving-leaf diagnostic below.
    const configFailure = parsed.errors.find(
      (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
    );

    if (configFailure !== undefined) {
      if (ts.sys.fileExists(leafPath)) {
        rawDiagnostics.push(configFailure);

        continue;
      }

      rawDiagnostics.push(synthesizeReferenceNotFoundDiagnostic(ts, leafPath));
      skippedReferences.push({ referencePath: leafPath, reason: 'not-found' });

      continue;
    }

    // D-03b: a resolved leaf with no input files cannot become a silent
    // zero-diagnostic PASS. Record the skip-with-notice and contribute 0.
    if (parsed.rootNames.length === 0) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'zero-root-names',
      });

      continue;
    }

    // Surviving leaf: run performCompilation with the SAME emit-neutralizing
    // override as the direct path -- the shared EMIT_NEUTRALIZING_OPTIONS single
    // source of truth (gather-diagnostics.ts), spread AFTER `...parsed.options`
    // exactly as run-typecheck.ts does, so a leaf and its referencing solution
    // can never diverge.
    const result = ng.performCompilation({
      rootNames: parsed.rootNames,
      options: {
        ...parsed.options,
        ...EMIT_NEUTRALIZING_OPTIONS,
      },
      emitFlags: 0 as EmitFlags,
      gatherDiagnostics: gatherAllDiagnostics,
    });

    // MD-01 parity with the direct path (run-typecheck.ts prepends
    // `[...parsed.errors]`): a surviving leaf's OWN config-parse diagnostics (e.g.
    // a folded TS5012/TS5083 from a missing/typo'd `extends` base that silently
    // WEAKENS strict options) are first-class counted diagnostics, NEVER dropped.
    // Without this the walk could report a false PASS on a broken leaf that FAILS
    // when pointed at directly -- the exact "type-checker that lies" class. (The
    // code-500 infra case was handled above, so parsed.errors here carries only
    // genuine folded config diagnostics.)
    rawDiagnostics.push(...parsed.errors);
    rawDiagnostics.push(...result.diagnostics);
    rootNamesCount += parsed.rootNames.length;
  }

  return { rawDiagnostics, rootNamesCount, skippedReferences };
}

/**
 * Builds the D-05 not-found Error diagnostic for a nonexistent referenced leaf
 * PATH. Mirrors the file-less shape of run-typecheck.ts's
 * `synthesizeZeroRootNamesDiagnostic`: `file`/`start`/`length` undefined and
 * category `Error`, so the boundary filter never drops it (file-less
 * diagnostics are always kept) and `finalize` counts it as an Error. The
 * message names the resolved path so an agent/CI gets an actionable next step.
 */
function synthesizeReferenceNotFoundDiagnostic(
  ts: typeof import('typescript'),
  resolvedPath: string,
): ts.Diagnostic {
  return {
    category: ts.DiagnosticCategory.Error,
    code: REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText:
      'angular-typechecker: referenced tsconfig not found: ' + resolvedPath,
  };
}
