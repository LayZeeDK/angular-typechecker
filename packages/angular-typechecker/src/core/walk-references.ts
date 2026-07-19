import { dirname, resolve } from 'node:path';

import type ts from 'typescript';

import type { CompilerCli, ParsedConfiguration } from './compiler-cli-types';
import { detectUncheckedDeclaredFiles } from './detect-unchecked-declared';
import {
  REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE,
  synthesizeFilelessError,
} from './diagnostic-codes';
import { createCanonicalizer, isUnderDir } from './filter-diagnostics';
import { runNoEmitCompilation } from './gather-diagnostics';

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
  // The UNION of every SURVIVING leaf's DECLARED `readConfiguration().rootNames`
  // `.ts` paths (D-02) -- the raw declared set, NEVER
  // `program.getTsProgram().getRootFileNames()` (which adds a synthetic
  // `<root>.ngtypecheck.ts` shim per root that would corrupt the input set).
  // `run-typecheck.ts` (plan 17-03) builds the `inputTs` membership set from
  // this to route the input-set-membership boundary filter. A
  // skipped/out-of-project/zero-root-names/not-found leaf `continue`s before the
  // surviving-leaf tail, so it contributes ZERO paths here (T-17-06).
  rootNamePaths: readonly string[];
  // D-01 (Phase 18, T11): the UNION of every SURVIVING leaf's declared-but-
  // uncheckable files (`.mdx` always; `.tsx` when the resolved `jsx` is unset /
  // `None`). Aggregated in the SAME surviving-leaf tail as `rootNamePaths` (AFTER
  // every skip/not-found/zero-root-names `continue`), so a skipped/out-of-project
  // leaf contributes ZERO paths here (Pitfall 7). Deduped across leaves (IN-01) so
  // a file two surviving leaves both declare (overlapping `include` globs) is
  // surfaced once. Empty array when nothing is uncheckable; `runTypecheck` maps
  // `[]` -> `undefined` on `CoreResult`. ADVISORY only -- these paths NEVER change
  // the verdict.
  notTypeCheckedDeclaredFiles: readonly string[];
  // References skipped (out-of-project / zero-root-names / self-reference /
  // duplicate) or reclassified (not-found -> 90002) during the walk. Empty array
  // when every reference walked cleanly; `runTypecheck` maps `[]` -> `undefined`
  // on `CoreResult` so the adapter's presence check is sufficient.
  skippedReferences: readonly SkippedReference[];
  // OBS-01 (Phase 30, D-11): the count of DISTINCT non-declaration source files
  // across all walked (surviving) leaves -- `acc.sourceFileNames.size`, name-deduped
  // so a source shared by two leaves counts ONCE. `finalizeUnion` (run-typecheck.ts)
  // threads it onto CoreResult.totalFilesCount. 0 when no leaf survives.
  totalFilesCount: number;
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

/**
 * The mutable accumulator threaded through a per-leaf gather. Holds the four fields
 * every surviving leaf/entry contributes to: the RAW pre-filter diagnostics union,
 * the DECLARED rootName paths (the input-set membership basis), the declared-but-
 * uncheckable files, and the summed rootNames count. `rootNamesCount` is a number, so
 * it cannot be mutated through a separate binding -- carrying all four on ONE object
 * lets `gatherLeafInto` mutate them together.
 */
export interface LeafAccumulator {
  rawDiagnostics: ts.Diagnostic[];
  rootNamePaths: string[];
  notTypeCheckedDeclaredFiles: string[];
  rootNamesCount: number;
  // OBS-01 (Phase 30, D-11): the NON-declaration source-file names gathered across
  // every surviving leaf, deduped BY NAME. A source file compiled in two leaves
  // (e.g. a shared component both leaves import) is therefore counted ONCE.
  // `set.size` is threaded onto CoreResult.totalFilesCount via finalizeUnion. Dedupe
  // by NAME (a `fileName` string), NOT object identity: two leaves' Programs return
  // DISTINCT SourceFile objects for the same path, so an object-keyed Set would
  // double-count the shared file (RESEARCH A3).
  sourceFileNames: Set<string>;
}

/**
 * WR-01: the SINGLE authored-source predicate, shared by both `totalFilesCount`
 * (OBS-01) capture sites -- this leaf loop (`gatherLeafInto`) and the direct-path
 * count (run-typecheck.ts). A source file counts as authored iff it is NOT a `.d.ts`
 * declaration file AND NOT an Angular-generated `.ngtypecheck.ts` TCB shim. The
 * compiler injects one `.ngtypecheck.ts` shim per component -- they are
 * non-declaration `.ts` files but NOT authored source, so counting them inflates the
 * "files checked" metric and drifts across Angular versions. (The bare
 * `!isDeclarationFile` parity in gather-diagnostics.ts is a DIFFERENT predicate for
 * DIAGNOSTIC iteration; this observability count wants authored files only.)
 *
 * Exported for reuse by run-typecheck.ts; NOT added to the public barrel (`index.ts`).
 */
export function isAuthoredSourceFile(sourceFile: ts.SourceFile): boolean {
  return (
    !sourceFile.isDeclarationFile &&
    !sourceFile.fileName.endsWith('.ngtypecheck.ts')
  );
}

/**
 * The SHARED per-surviving-leaf gather block, used by BOTH `walkReferences` (a
 * solution tsconfig's resolved leaves) and run-typecheck's `handleMultiTsConfig` (an
 * explicit tsConfig array). It runs the SAME no-emit whole-program compilation the
 * direct path uses -- `runNoEmitCompilation` (gather-diagnostics.ts) is the single
 * source of truth for the ENTIRE invocation (rootNames + emit-neutralized options +
 * emitFlags:0 + the all-getter), so a leaf, its referencing solution, and an array
 * entry can never diverge argument-by-argument -- then accumulates into `acc`:
 *   - MD-01 parity with the direct path (which prepends `[...parsed.errors]`): the
 *     leaf's OWN config-parse diagnostics (e.g. a folded TS5012/TS5083 from a
 *     missing/typo'd `extends` base that silently WEAKENS strict options) are
 *     first-class counted diagnostics, NEVER dropped -- else the walk could report a
 *     false PASS on a broken leaf that FAILS when pointed at directly (the exact
 *     "type-checker that lies" class). The infra-500 case is handled by the CALLER
 *     before this, so `parsed.errors` here carries only genuine folded diagnostics.
 *   - D-02: the leaf's DECLARED rootName paths (the exact
 *     `readConfiguration().rootNames` -- NEVER derived from a Program, so no
 *     `.ngtypecheck.ts` shim enters the input set). Both callers invoke this ONLY in
 *     the surviving-leaf tail, AFTER every skip/not-found/zero-root-names `continue`,
 *     so a non-surviving leaf contributes nothing (T-17-06 / Pitfall 7).
 *   - D-01 (Phase 18, T11): the leaf's declared-but-uncheckable files (`.mdx` always;
 *     `.tsx` when `jsx` is unset / `None`). `entryPath` is the leaf/entry tsconfig path.
 *
 * PURE (no `console`/`process`); it lives here so run-typecheck can import it without a
 * cycle (run-typecheck already imports `walkReferences`; walk-references imports
 * nothing from run-typecheck).
 */
export function gatherLeafInto(
  acc: LeafAccumulator,
  ng: CompilerCli,
  ts: typeof import('typescript'),
  parsed: ParsedConfiguration,
  entryPath: string,
): void {
  const result = runNoEmitCompilation(ng, parsed);

  acc.rawDiagnostics.push(...parsed.errors);
  acc.rawDiagnostics.push(...result.diagnostics);
  acc.rootNamesCount += parsed.rootNames.length;
  acc.rootNamePaths.push(...parsed.rootNames);
  acc.notTypeCheckedDeclaredFiles.push(
    ...detectUncheckedDeclaredFiles(ts, parsed, entryPath),
  );

  // OBS-01 (Phase 30, D-11): accumulate this leaf's authored source files by NAME off
  // the live Program (the authored-source rule -- skip `.d.ts` + `.ngtypecheck.ts`
  // shims -- lives in isAuthoredSourceFile), so `lib.d.ts` and node_modules types are
  // excluded. The Set dedupes across leaves, so a source file both leaves compile is
  // counted once. `result.program` is live here exactly as it is for the direct path
  // (the caller re-throws any per-leaf infra-500 over the union afterwards).
  for (const sourceFile of result.program.getTsProgram().getSourceFiles()) {
    if (!isAuthoredSourceFile(sourceFile)) {
      continue;
    }

    acc.sourceFileNames.add(sourceFile.fileName);
  }
}

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

  // The four gather fields live in ONE LeafAccumulator so the surviving-leaf gather
  // block is the SHARED gatherLeafInto helper (also used by run-typecheck's
  // handleMultiTsConfig). skippedReferences + seenCanonicalLeaves are walk-only, so
  // they stay separate locals.
  const acc: LeafAccumulator = {
    rawDiagnostics: [],
    rootNamePaths: [],
    notTypeCheckedDeclaredFiles: [],
    rootNamesCount: 0,
    sourceFileNames: new Set(),
  };
  const skippedReferences: SkippedReference[] = [];
  const seenCanonicalLeaves = new Set<string>();

  for (const reference of references) {
    // Resolve the reference path against the solution directory to an absolute
    // leaf tsconfig path, then canonicalize for the self/dup + boundary checks.
    const leafPath = resolve(solutionDir, reference.path);
    const canonicalLeaf = canonicalize(leafPath);

    // A canonicalized leaf (realpath succeeded) is checked for self-reference,
    // duplication, and the module boundary. A `undefined` canonicalLeaf (a throwing
    // realpath) CANNOT prove any of those, so the whole block is skipped and the leaf
    // is WALKED (over-keep-safe, matching the RES-03 fail-safe bias in
    // filter-diagnostics.ts) -- its own diagnostics are still boundary-filtered
    // against the solution basePath in `finalize`, so an out-of-project source cannot
    // leak. Hoisting the single `canonicalLeaf !== undefined` guard here (rather than
    // repeating it on each check) is what makes that fall-through explicit.
    if (canonicalLeaf !== undefined) {
      // D-04: skip the self-reference (canonical leaf equals the solution) and any
      // duplicate already seen -- both are output-neutral repeats of an
      // already-covered leaf, but DISTINCT causes, so each is labelled honestly (a
      // solution referencing ITSELF is `self-reference`; a leaf listed twice is
      // `duplicate`), never folding a duplicate under a false "self-reference".
      if (canonicalLeaf === canonicalSolutionPath) {
        skippedReferences.push({
          referencePath: leafPath,
          reason: 'self-reference',
        });

        continue;
      }

      if (seenCanonicalLeaves.has(canonicalLeaf)) {
        skippedReferences.push({
          referencePath: leafPath,
          reason: 'duplicate',
        });

        continue;
      }

      seenCanonicalLeaves.add(canonicalLeaf);

      // D-01: the module-boundary guard. If the resolved leaf is NOT under the
      // solution tsconfig's directory, SKIP it (never compile it) so an outsider's
      // sources never enter the union. Reuses `isUnderDir` verbatim. (The Windows
      // raw-backslash trap the old per-check guard warned about cannot occur here:
      // this branch runs only for a defined, slash-normalized canonicalLeaf.)
      if (!isUnderDir(canonicalLeaf, canonicalSolutionDir)) {
        skippedReferences.push({
          referencePath: leafPath,
          reason: 'out-of-project',
        });

        continue;
      }
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
        acc.rawDiagnostics.push(configFailure);

        continue;
      }

      acc.rawDiagnostics.push(
        synthesizeReferenceNotFoundDiagnostic(ts, leafPath),
      );
      skippedReferences.push({ referencePath: leafPath, reason: 'not-found' });

      continue;
    }

    // D-06 (DECISION, supersedes the earlier D-03b advisory-only treatment): a
    // resolved leaf with no input files contributes 0 and is recorded here with
    // reason 'zero-root-names'. It is NOT advisory-only for the verdict --
    // evaluateResult (17-04) folds a zero-rootNames first-party leaf into a
    // non-clean coverage-incomplete outcome, so a leaf that legitimately matches
    // no files yet (e.g. a spec leaf before any *.spec.ts exists) surfaces as
    // INCOMPLETE COVERAGE rather than a silent PASS. This stays asymmetric with the
    // direct single-leaf path (a hard 90001 error there vs the distinct
    // coverage-incomplete outcome here), but both now fail the verdict. Mitigations
    // still apply -- the loud per-reference logger.warn (executor) surfaces the
    // skip, a SIBLING leaf's real errors also fail, and if EVERY leaf is skipped the
    // none-in-project 90001 guard fires (run-typecheck.ts), so an all-empty
    // solution is never a silent PASS.
    //
    // LIMITATION (C7): the walk is single-level (D-03). A referenced leaf that is
    // ITSELF a solution/references-only tsconfig has zero root names of its own, so
    // it lands HERE (reason 'zero-root-names') and its INNER projects are NOT
    // walked. Nested-solution recursion is out of scope for v0.1.0; point the target
    // at the inner leaves (or their own solution) to type-check them today.
    if (parsed.rootNames.length === 0) {
      skippedReferences.push({
        referencePath: leafPath,
        reason: 'zero-root-names',
      });

      continue;
    }

    // Surviving leaf: accumulate the RAW union via the SHARED gatherLeafInto helper
    // (the identical per-surviving-leaf block run-typecheck's handleMultiTsConfig also
    // uses -- runNoEmitCompilation + MD-01 parse-error parity + declared rootName
    // paths + declared-but-uncheckable files). Called ONLY here, in the surviving-leaf
    // tail AFTER every skip/not-found/zero-root-names `continue`, so a non-surviving
    // leaf contributes nothing (T-17-06 / Pitfall 7).
    gatherLeafInto(acc, ng, ts, parsed, leafPath);
  }

  return {
    rawDiagnostics: acc.rawDiagnostics,
    rootNamesCount: acc.rootNamesCount,
    skippedReferences,
    rootNamePaths: acc.rootNamePaths,
    // IN-01: dedupe the cross-leaf union so an `.mdx`/`.tsx` declared by two
    // surviving leaves (overlapping `include` globs) is surfaced ONCE, not repeated
    // in the executor's advisory (which joins this set verbatim). The diagnostics
    // union stays raw -- `finalize` owns diagnostic dedupe -- this is the advisory
    // display set only.
    notTypeCheckedDeclaredFiles: [...new Set(acc.notTypeCheckedDeclaredFiles)],
    // OBS-01 (Phase 30, D-11): the name-deduped non-declaration source-file count
    // across every surviving leaf (a source shared by two leaves counts once).
    totalFilesCount: acc.sourceFileNames.size,
  };
}

/**
 * Builds the D-05 not-found Error diagnostic for a nonexistent referenced leaf
 * PATH via the shared `synthesizeFilelessError` factory (diagnostic-codes.ts): a
 * file-less, category-`Error` diagnostic the boundary filter never drops (file-less
 * diagnostics are always kept) and `finalize` counts. The message names the
 * resolved path so an agent/CI gets an actionable next step.
 */
function synthesizeReferenceNotFoundDiagnostic(
  ts: typeof import('typescript'),
  resolvedPath: string,
): ts.Diagnostic {
  return synthesizeFilelessError(
    ts,
    REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE,
    'angular-typechecker: referenced tsconfig not found: ' + resolvedPath,
  );
}
