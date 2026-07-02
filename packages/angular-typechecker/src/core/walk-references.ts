import { dirname, resolve } from 'node:path';

import type ts from 'typescript';

import type {
  CompilerCli,
  EmitFlags,
  ParsedConfiguration,
} from './compiler-cli-types';
import { createCanonicalizer, isUnderDir } from './filter-diagnostics';
import { gatherAllDiagnostics } from './gather-diagnostics';

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
  // References skipped (out-of-project / zero-root-names / self-reference) or
  // reclassified (not-found -> 90002) during the walk. Empty array when every
  // reference walked cleanly; `runTypecheck` maps `[]` -> `undefined` on
  // `CoreResult` so the adapter's presence check is sufficient.
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
  reason: 'out-of-project' | 'zero-root-names' | 'self-reference' | 'not-found';
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
    // duplicate canonical leaf already seen. BOTH cases are DELIBERATELY folded
    // under the self-reference reason: the true self-reference and a repeated
    // (duplicate) in-project leaf are output-neutral repeats of an
    // already-covered leaf (the union finalize dedupes diagnostics by value
    // anyway), so a single advisory label suffices and skipping here saves the
    // redundant performCompilation per repeated edge. The public
    // SkippedReference.reason union INTENTIONALLY omits a distinct duplicate
    // member to keep the exported type stable pre-1.0 -- the label is
    // advisory-only on a leaf that is never compiled, so the extra precision
    // would widen a shipped public type for no runtime benefit.
    if (
      canonicalLeaf !== undefined &&
      (canonicalLeaf === canonicalSolutionPath ||
        seenCanonicalLeaves.has(canonicalLeaf))
    ) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'self-reference',
      });

      continue;
    }

    if (canonicalLeaf !== undefined) {
      seenCanonicalLeaves.add(canonicalLeaf);
    }

    // D-01: the module-boundary guard. If the resolved leaf is NOT under the
    // solution tsconfig's directory, SKIP it (never compile it) so an outsider's
    // sources never enter the union. Reuses `isUnderDir` verbatim. A `undefined`
    // canonicalLeaf (a throwing realpath) is treated by `isUnderDir` as
    // over-keep-safe, so the leaf is walked -- never silently dropped.
    if (!isUnderDir(canonicalLeaf ?? leafPath, canonicalSolutionDir)) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'out-of-project',
      });

      continue;
    }

    // Per-leaf config resolution. A NONEXISTENT PATH surfaces as a code-500
    // UNKNOWN_ERROR_CODE in `parsed.errors` (ENOENT via readConfiguration's
    // outer catch).
    const parsed = ng.readConfiguration(leafPath);

    // D-05 (B3 fold-and-count): detect the not-found 500 BY CODE ONLY (never
    // `source`/message text) and RECLASSIFY it into a counted 90002 Error, then
    // CONTINUE to the next leaf (this leaf contributes 0 to rootNamesCount). A
    // bad-`extends` TARGET yields a folded 5012 (NOT a 500) and is out of scope
    // for D-05 -- it would flow through as a normal leaf diagnostic.
    const notFound = parsed.errors.find(
      (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
    );

    if (notFound !== undefined) {
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
    // override block as the direct path (run-typecheck.ts) and push the RAW
    // gathered diagnostics (never filtered per-leaf -- Pitfall 2) to the union.
    const result = ng.performCompilation({
      rootNames: parsed.rootNames,
      options: {
        ...parsed.options,
        // ---- D-05 emit-neutralizing override (verbatim from run-typecheck.ts) ----
        noEmit: true,
        composite: false,
        declaration: false,
        declarationMap: false,
        emitDeclarationOnly: false,
        incremental: false,
        tsBuildInfoFile: undefined,
        sourceMap: undefined,
        inlineSourceMap: undefined,
        inlineSources: undefined,
        declarationDir: undefined,
        mapRoot: undefined,
        sourceRoot: undefined,
        // ---- D-02: suppress the "Time for diagnostics" Message ----
        diagnostics: false,
      },
      emitFlags: 0 as EmitFlags,
      gatherDiagnostics: gatherAllDiagnostics,
    });

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
