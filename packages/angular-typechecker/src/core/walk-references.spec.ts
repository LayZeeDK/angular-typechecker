import { dirname, resolve } from 'node:path';

import type ts from 'typescript';

import type {
  CompilerCli,
  ParsedConfiguration,
  PerformCompilationResult,
  Program,
} from './compiler-cli-types';

import { describe, expect, it, vi } from 'vitest';

import { walkReferences } from './walk-references';

// Pure unit tier for the solution-tsconfig reference walk (WALK-01 / D-01..D-05).
// NO real @angular/compiler-cli and NO cold compiler: walkReferences is driven
// against a hand-built `ng` stub (readConfiguration + performCompilation +
// UNKNOWN_ERROR_CODE) and the REAL `ts` module (for DiagnosticCategory + a
// case-sensitive, identity-realpath `sys`), mirroring the detectTemplateCheckAborted
// "synthesized input, no cold-compiler" pattern (run-typecheck.ts:470-473).
//
// PLATFORM NOTE: walkReferences resolves each `reference.path` against the
// solution directory via node's `resolve`, which is drive-prefixed + `\\` on
// Windows and `/`-rooted on POSIX. So the tests NEVER hardcode a leaf path --
// they compute the expected resolved leaf path with the SAME `resolve(solutionDir,
// ref.path)` the module uses (see `leaf()`), and key the `ng` stub on it. The
// stub `ts.sys` is forced case-SENSITIVE with an identity realpath so the walk's
// canonicalizer is a pure `\\`->`/` normalizer, keeping dedupe/boundary decisions
// exact and platform-independent.

const TS2322 = 2322;
const REFERENCE_NOT_FOUND = 90002;
const UNKNOWN_ERROR_CODE = 500;

// A cross-platform absolute solution tsconfig path (drive-prefixed on Windows).
const SOLUTION_TSCONFIG = resolve('/ws/solution/tsconfig.json');
const SOLUTION_DIR = dirname(SOLUTION_TSCONFIG);

// The absolute path walkReferences will compute for a reference whose `.path`
// is `relativePath` (relative to the solution directory) -- the SAME resolution
// the module performs, so the stub keys and the assertions match on any OS.
function leaf(relativePath: string): string {
  return resolve(SOLUTION_DIR, relativePath);
}

function diagnostic(code: number, fileName?: string): ts.Diagnostic {
  return {
    category: 1 /* ts.DiagnosticCategory.Error */,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: fileName === undefined ? undefined : 0,
    length: fileName === undefined ? undefined : 1,
    messageText: 'x',
  } as ts.Diagnostic;
}

// A minimal Program stub. Besides pushing `result.diagnostics` to the union,
// `gatherLeafInto` now iterates `program.getTsProgram().getSourceFiles()` for the
// OBS-01 `totalFilesCount` capture (Phase 30), so the stub exposes an empty
// source-file list -- these walk-routing unit tests do not assert the count (the
// real name-deduped count is proven in total-files-count.integration.spec.ts).
function performResult(
  diagnostics: readonly ts.Diagnostic[],
): PerformCompilationResult {
  return {
    diagnostics,
    program: {
      getTsProgram: () => ({ getSourceFiles: () => [] }),
    } as unknown as Program,
  };
}

interface LeafSpec {
  // The hand-built ParsedConfiguration readConfiguration returns for this leaf.
  parsed: ParsedConfiguration;
  // The diagnostics the leaf's performCompilation returns (raw, pre-filter).
  diagnostics: readonly ts.Diagnostic[];
  // PR47-F1: when true, this leaf's performCompilation returns NO Program
  // (`program: undefined`) plus its `diagnostics` -- an infra crash DURING Program
  // construction. Default (omitted) keeps a valid empty-source Program so every
  // existing test is byte-unchanged.
  crashProgram?: boolean;
}

function parsedConfig(
  project: string,
  rootNames: readonly string[],
  errors: readonly ts.Diagnostic[] = [],
  projectReferences?: readonly ts.ProjectReference[],
): ParsedConfiguration {
  return {
    project,
    options: { basePath: SOLUTION_DIR },
    rootNames,
    ...(projectReferences === undefined ? {} : { projectReferences }),
    emitFlags: 0 as ParsedConfiguration['emitFlags'],
    errors,
  };
}

// Builds a stub CompilerCli whose readConfiguration/performCompilation are keyed
// on the resolved leaf path. `performedPaths` records every path
// performCompilation ran for (in walk order), so a test can prove a
// boundary-skipped / not-found / zero-rootNames leaf was NEVER compiled.
function stubCompilerCli(leaves: Record<string, LeafSpec>): {
  ng: CompilerCli;
  performedPaths: string[];
} {
  const performedPaths: string[] = [];

  const readConfiguration = vi.fn((project: string): ParsedConfiguration => {
    const spec = leaves[project];

    if (spec === undefined) {
      throw new Error(`unexpected readConfiguration for ${project}`);
    }

    return spec.parsed;
  });

  const performCompilation = vi.fn(
    (options: { rootNames: readonly string[] }): PerformCompilationResult => {
      // Identify the leaf by its rootNames[0] -> its owning path (every leaf is
      // given a unique rootName under its own path).
      const match = Object.entries(leaves).find(
        ([, spec]) => spec.parsed.rootNames[0] === options.rootNames[0],
      );

      if (match === undefined) {
        throw new Error('unexpected performCompilation rootNames');
      }

      performedPaths.push(match[0]);

      const spec = match[1];

      if (spec.crashProgram === true) {
        // PR47-F1: an infra crash DURING Program construction -- NO Program plus
        // the raw diagnostics (including a 500). The shim types `program` as
        // non-optional (compiler-cli-types.ts), so cast to model the real
        // engine's OPTIONAL `program?` return.
        return {
          diagnostics: spec.diagnostics,
          program: undefined,
        } as unknown as PerformCompilationResult;
      }

      return performResult(spec.diagnostics);
    },
  );

  const ng = {
    readConfiguration,
    performCompilation,
    UNKNOWN_ERROR_CODE,
  } as unknown as CompilerCli;

  return { ng, performedPaths };
}

// The REAL typescript module, but with `sys` forced case-sensitive + identity
// realpath so canonicalization is a pure slash-normalizer in these tests.
function tsForWalk(
  realTs: typeof import('typescript'),
): typeof import('typescript') {
  return {
    ...realTs,
    sys: {
      ...realTs.sys,
      useCaseSensitiveFileNames: true,
      realpath: (filePath: string): string => filePath,
    },
  };
}

describe('walkReferences', () => {
  it('unions two in-project leaves and SUMS their rootNames (WALK-01)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const appPath = leaf('./tsconfig.app.json');
    const specPath = leaf('./tsconfig.spec.json');
    const appSource = leaf('./app.ts');
    const specSource = leaf('./app.spec.ts');

    const { ng, performedPaths } = stubCompilerCli({
      [appPath]: {
        parsed: parsedConfig(appPath, [appSource]),
        diagnostics: [diagnostic(TS2322, appSource)],
      },
      [specPath]: {
        parsed: parsedConfig(specPath, [specSource]),
        diagnostics: [diagnostic(TS2322, specSource)],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    expect(performedPaths).toEqual([appPath, specPath]);
    expect(walk.rootNamesCount).toBe(2);
    expect(walk.skippedReferences).toEqual([]);

    // The UNION carries BOTH leaves' distinct diagnostics (proves both ran).
    const files = walk.rawDiagnostics.map((d) => d.file?.fileName);

    expect(files).toContain(appSource);
    expect(files).toContain(specSource);
    expect(walk.rawDiagnostics.filter((d) => d.code === TS2322)).toHaveLength(
      2,
    );
  });

  it('surfaces the UNION of two surviving leaves DECLARED rootNames on rootNamePaths (D-02)', async () => {
    const ts = tsForWalk(await import('typescript'));

    // Distinct rootNames arrays per leaf (the app leaf declares TWO roots) so the
    // assertion proves rootNamePaths is the declared-set UNION, not just a per-leaf
    // first element or a count.
    const appPath = leaf('./tsconfig.app.json');
    const specPath = leaf('./tsconfig.spec.json');
    const appMain = leaf('./app.ts');
    const appConfig = leaf('./app.config.ts');
    const specMain = leaf('./app.spec.ts');

    const { ng } = stubCompilerCli({
      [appPath]: {
        parsed: parsedConfig(appPath, [appMain, appConfig]),
        diagnostics: [],
      },
      [specPath]: {
        parsed: parsedConfig(specPath, [specMain]),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // rootNamePaths is the DECLARED rootNames union across BOTH surviving leaves,
    // in walk order; rootNamesCount stays consistent with it.
    expect(walk.rootNamePaths).toEqual([appMain, appConfig, specMain]);
    expect(walk.rootNamesCount).toBe(3);
  });

  it('accumulates rootNamePaths for SURVIVING leaves only -- skipped leaves contribute none (D-02 / T-17-06)', async () => {
    const ts = tsForWalk(await import('typescript'));

    // One surviving leaf mixed with a zero-root-names leaf and an out-of-project
    // reference. Both skipped leaves `continue` BEFORE the surviving-leaf tail, so
    // only the survivor's declared rootName may enter rootNamePaths.
    const appPath = leaf('./tsconfig.app.json');
    const appSource = leaf('./app.ts');
    const emptyPath = leaf('./tsconfig.empty.json');
    const oopPath = leaf('../other/tsconfig.lib.json');
    const oopSource = leaf('../other/lib.ts');

    const { ng } = stubCompilerCli({
      [appPath]: {
        parsed: parsedConfig(appPath, [appSource]),
        diagnostics: [],
      },
      [emptyPath]: {
        // zero-root-names -> skipped (reason 'zero-root-names').
        parsed: parsedConfig(emptyPath, []),
        diagnostics: [],
      },
      [oopPath]: {
        // resolved OUTSIDE the solution dir -> skipped (reason 'out-of-project').
        parsed: parsedConfig(oopPath, [oopSource]),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [
        { path: './tsconfig.app.json' },
        { path: './tsconfig.empty.json' },
        { path: '../other/tsconfig.lib.json' },
      ],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // ONLY the surviving leaf's declared rootName is surfaced; the zero-root-names
    // and out-of-project leaves contribute nothing.
    expect(walk.rootNamePaths).toEqual([appSource]);
    expect(walk.rootNamePaths).not.toContain(oopSource);
  });

  it('skips an out-of-project leaf without compiling it (D-01)', async () => {
    const ts = tsForWalk(await import('typescript'));

    // A leaf resolved OUTSIDE the solution directory (a sibling `../other`).
    const oopPath = leaf('../other/tsconfig.lib.json');
    const oopSource = leaf('../other/lib.ts');

    const { ng, performedPaths } = stubCompilerCli({
      [oopPath]: {
        parsed: parsedConfig(oopPath, [oopSource]),
        diagnostics: [diagnostic(TS2322, oopSource)],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: '../other/tsconfig.lib.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // The out-of-project leaf was NEVER compiled (its error never enters the
    // union); it is recorded reason:'out-of-project'.
    expect(performedPaths).toEqual([]);
    expect(walk.rootNamesCount).toBe(0);
    expect(walk.rawDiagnostics).toEqual([]);
    expect(walk.skippedReferences).toEqual([
      { referencePath: oopPath, reason: 'out-of-project' },
    ]);
  });

  it('synthesizes a COUNTED 90002 for a not-found leaf and still walks survivors (D-05 fold-and-count)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const goodPath = leaf('./tsconfig.app.json');
    const goodSource = leaf('./app.ts');
    const missingPath = leaf('./tsconfig.missing.json');

    const { ng, performedPaths } = stubCompilerCli({
      [goodPath]: {
        parsed: parsedConfig(goodPath, [goodSource]),
        diagnostics: [diagnostic(TS2322, goodSource)],
      },
      [missingPath]: {
        // A nonexistent PATH surfaces as a code-500 UNKNOWN_ERROR_CODE in
        // parsed.errors (ENOENT via readConfiguration's outer catch).
        parsed: parsedConfig(missingPath, [], [diagnostic(UNKNOWN_ERROR_CODE)]),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.app.json' }, { path: './tsconfig.missing.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // Survivor walked; the missing leaf was NOT compiled (contributes 0).
    expect(performedPaths).toEqual([goodPath]);
    expect(walk.rootNamesCount).toBe(1);

    const codes = walk.rawDiagnostics.map((d) => d.code);

    expect(codes.filter((c) => c === REFERENCE_NOT_FOUND)).toHaveLength(1);
    // Survivor proof: the good leaf's own diagnostic is STILL present.
    expect(codes).toContain(TS2322);
    expect(walk.skippedReferences).toEqual([
      { referencePath: missingPath, reason: 'not-found' },
    ]);

    // The synthesized 90002 is a file-less Error (never filtered, counted).
    const synthesized = walk.rawDiagnostics.find(
      (d) => d.code === REFERENCE_NOT_FOUND,
    );

    expect(synthesized?.category).toBe(ts.DiagnosticCategory.Error);
    expect(synthesized?.file).toBeUndefined();
    expect(synthesized?.start).toBeUndefined();
    expect(synthesized?.length).toBeUndefined();
  });

  it('detects the not-found 500 BY CODE ONLY, never by source/message text (D-05)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const missingPath = leaf('./tsconfig.missing.json');

    // A 500 error carrying an unrelated source/message: the reclassification
    // must fire on the CODE alone.
    const error500 = {
      ...diagnostic(UNKNOWN_ERROR_CODE),
      source: 'unrelated',
      messageText: 'something else entirely',
    } as ts.Diagnostic;

    const { ng } = stubCompilerCli({
      [missingPath]: {
        parsed: parsedConfig(missingPath, [], [error500]),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.missing.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    expect(walk.rawDiagnostics.map((d) => d.code)).toContain(
      REFERENCE_NOT_FOUND,
    );
    expect(walk.skippedReferences).toEqual([
      { referencePath: missingPath, reason: 'not-found' },
    ]);
  });

  it('pushes an EXISTING leaf config 500 to the union as infrastructure, NOT a not-found 90002 (S-7)', async () => {
    // A leaf whose PATH EXISTS but whose readConfiguration crashes (circular
    // `extends` RangeError, EACCES) surfaces a code-500 in parsed.errors. Unlike a
    // nonexistent PATH (ENOENT -> 90002 not-found), an existing-but-crashing leaf is
    // INFRASTRUCTURE: the raw 500 is unioned unchanged so runTypecheck re-throws it,
    // never mislabelled "not found" for a file that is present.
    const base = tsForWalk(await import('typescript'));
    const existingCrashPath = leaf('./tsconfig.circular.json');
    const ts = {
      ...base,
      sys: {
        ...base.sys,
        // The leaf FILE exists on disk; only its config resolution crashed.
        fileExists: (filePath: string): boolean =>
          filePath === existingCrashPath,
      },
    } as typeof import('typescript');

    const { ng, performedPaths } = stubCompilerCli({
      [existingCrashPath]: {
        parsed: parsedConfig(
          existingCrashPath,
          [],
          [diagnostic(UNKNOWN_ERROR_CODE)],
        ),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.circular.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    const codes = walk.rawDiagnostics.map((d) => d.code);

    // The raw 500 is in the union (runTypecheck's scan re-throws it) and it is
    // NEITHER reclassified to 90002 NOR recorded as a skip; the leaf never compiled.
    expect(codes).toContain(UNKNOWN_ERROR_CODE);
    expect(codes).not.toContain(REFERENCE_NOT_FOUND);
    expect(walk.skippedReferences).toEqual([]);
    expect(performedPaths).toEqual([]);
  });

  it('RESOLVES a surviving leaf whose performCompilation returns NO Program + a 500 -- 500 stays in the union, 0 authored files, no raw TypeError (PR47-F1)', async () => {
    const ts = tsForWalk(await import('typescript'));

    // A SURVIVING leaf that crashes DURING Program construction:
    // performCompilation returns { program: undefined } plus a raw 500. Before the
    // gatherLeafInto guard this threw a raw TypeError off the OBS-01 source-file
    // deref BEFORE the caller could re-classify the 500. The walk must RESOLVE with
    // the 500 in the union (handleSolutionWalk re-throws it as infrastructure) and
    // the crashed leaf must contribute 0 authored files.
    const crashPath = leaf('./tsconfig.app.json');
    const crashSource = leaf('./app.ts');

    const { ng, performedPaths } = stubCompilerCli({
      [crashPath]: {
        parsed: parsedConfig(crashPath, [crashSource]),
        diagnostics: [diagnostic(UNKNOWN_ERROR_CODE)],
        crashProgram: true,
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.app.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // The leaf ran and the walk RESOLVED (no raw TypeError).
    expect(performedPaths).toEqual([crashPath]);
    // The raw 500 is left in the union for the caller to re-throw as infrastructure.
    expect(walk.rawDiagnostics.map((d) => d.code)).toContain(UNKNOWN_ERROR_CODE);
    // The crashed leaf contributes 0 authored files (the deref never ran).
    expect(walk.totalFilesCount).toBe(0);
  });

  it('WALKS a leaf whose realpath throws instead of dropping it (boundary over-keep-safe, S-1)', async () => {
    // A throwing realpath makes canonicalLeaf undefined. The walk CANNOT prove the
    // leaf is out-of-project, so it WALKS it (over-keep-safe, matching the
    // filter-diagnostics RES-03 bias) rather than silently dropping it as
    // out-of-project -- the leaf's diagnostics are boundary-filtered downstream.
    const base = tsForWalk(await import('typescript'));
    const throwingPath = leaf('./tsconfig.throwing.json');
    const source = leaf('./throwing.ts');
    const ts = {
      ...base,
      sys: {
        ...base.sys,
        realpath: (filePath: string): string => {
          if (filePath === throwingPath) {
            throw new Error('EACCES');
          }

          return filePath;
        },
      },
    } as typeof import('typescript');

    const { ng, performedPaths } = stubCompilerCli({
      [throwingPath]: {
        parsed: parsedConfig(throwingPath, [source]),
        diagnostics: [diagnostic(TS2322, source)],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.throwing.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // The leaf was WALKED (compiled), NOT skipped as out-of-project.
    expect(performedPaths).toEqual([throwingPath]);
    expect(walk.rootNamesCount).toBe(1);
    expect(walk.rawDiagnostics.map((d) => d.code)).toContain(TS2322);
    expect(walk.skippedReferences).toEqual([]);
  });

  it('KEEPS a surviving leaf folded config error (parsed.errors) in the union, NOT reclassified (C-1 / MD-01 parity)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const badExtendsPath = leaf('./tsconfig.bad-extends.json');
    const source = leaf('./app.ts');
    const TS5012 = 5012;

    const { ng, performedPaths } = stubCompilerCli({
      [badExtendsPath]: {
        // A bad/typo'd `extends` TARGET folds as a config diagnostic (e.g. TS5012/
        // TS5083) on parsed.errors (NOT a 500), and the leaf STILL resolves with
        // rootNames and compiles. Modelling the error where it really lands --
        // parsed.errors, not performCompilation's output -- is the C-1 regression
        // guard: the surviving leaf's config error MUST be unioned (a missing base
        // silently weakens strict options, so dropping it is a false PASS).
        parsed: parsedConfig(badExtendsPath, [source], [diagnostic(TS5012)]),
        diagnostics: [diagnostic(TS2322, source)],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.bad-extends.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    expect(performedPaths).toEqual([badExtendsPath]);
    expect(walk.rootNamesCount).toBe(1);

    const codes = walk.rawDiagnostics.map((d) => d.code);

    // The parsed.errors TS5012 SURVIVES into the union (C-1 fix) alongside the
    // leaf's own performCompilation diagnostic ...
    expect(codes).toContain(TS5012);
    expect(codes).toContain(TS2322);
    // ... and it is NOT reclassified to a not-found 90002 and NOT skipped.
    expect(codes).not.toContain(REFERENCE_NOT_FOUND);
    expect(walk.skippedReferences).toEqual([]);
  });

  it('skips a zero-rootNames leaf and records the notice (D-03b)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const emptyPath = leaf('./tsconfig.empty.json');

    const { ng, performedPaths } = stubCompilerCli({
      [emptyPath]: {
        parsed: parsedConfig(emptyPath, []),
        diagnostics: [],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [{ path: './tsconfig.empty.json' }],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    expect(performedPaths).toEqual([]);
    expect(walk.rootNamesCount).toBe(0);
    expect(walk.rawDiagnostics).toEqual([]);
    expect(walk.skippedReferences).toEqual([
      { referencePath: emptyPath, reason: 'zero-root-names' },
    ]);
  });

  it('labels a self-reference and a duplicate leaf DISTINCTLY and compiles at most once (D-04)', async () => {
    const ts = tsForWalk(await import('typescript'));

    const appPath = leaf('./tsconfig.app.json');
    const appSource = leaf('./app.ts');
    const solutionSource = leaf('./solution.ts');

    const { ng, performedPaths } = stubCompilerCli({
      // A self-reference back to the solution would resolve here -- but it must
      // NEVER be compiled, so this entry proves the skip (its rootName is unique
      // so a stray compile would surface).
      [SOLUTION_TSCONFIG]: {
        parsed: parsedConfig(SOLUTION_TSCONFIG, [solutionSource]),
        diagnostics: [diagnostic(TS2322, solutionSource)],
      },
      [appPath]: {
        parsed: parsedConfig(appPath, [appSource]),
        diagnostics: [diagnostic(TS2322, appSource)],
      },
    });

    const solutionParsed = parsedConfig(
      SOLUTION_TSCONFIG,
      [],
      [],
      [
        { path: './tsconfig.json' }, // self-reference
        { path: './tsconfig.app.json' },
        { path: './tsconfig.app.json' }, // duplicate
      ],
    );

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    // The app leaf is compiled EXACTLY ONCE; the self-reference and the duplicate
    // edge are never compiled (output-neutral dedupe).
    expect(performedPaths).toEqual([appPath]);
    expect(walk.rootNamesCount).toBe(1);
    expect(walk.rawDiagnostics.filter((d) => d.code === TS2322)).toHaveLength(
      1,
    );
    // The self-reference and the repeated leaf are labelled DISTINCTLY (I-3): the
    // solution-referencing-itself edge is 'self-reference'; the second
    // ./tsconfig.app.json edge is 'duplicate', NOT a false 'self-reference'.
    expect(walk.skippedReferences).toEqual([
      { referencePath: SOLUTION_TSCONFIG, reason: 'self-reference' },
      { referencePath: appPath, reason: 'duplicate' },
    ]);
  });

  it('returns an empty walk for a solution with no references', async () => {
    const ts = tsForWalk(await import('typescript'));

    const { ng, performedPaths } = stubCompilerCli({});

    const solutionParsed = parsedConfig(SOLUTION_TSCONFIG, []);

    const walk = await walkReferences(
      ng,
      ts,
      solutionParsed,
      SOLUTION_TSCONFIG,
    );

    expect(performedPaths).toEqual([]);
    expect(walk.rootNamesCount).toBe(0);
    expect(walk.rawDiagnostics).toEqual([]);
    expect(walk.skippedReferences).toEqual([]);
  });

  // The reason discriminator space, proven tabular via it.each: each single-leaf
  // solution records exactly the expected reason. (The union / fold-and-count /
  // both-leaves-ran proofs above cover the multi-leaf interactions.)
  it.each([
    {
      label: 'out-of-project',
      refPath: '../other/tsconfig.lib.json',
      parsedFor: (p: string): ParsedConfiguration =>
        parsedConfig(p, [leaf('../other/lib.ts')]),
      expectedReason: 'out-of-project' as const,
    },
    {
      label: 'zero-root-names',
      refPath: './tsconfig.empty.json',
      parsedFor: (p: string): ParsedConfiguration => parsedConfig(p, []),
      expectedReason: 'zero-root-names' as const,
    },
    {
      label: 'not-found',
      refPath: './tsconfig.missing.json',
      parsedFor: (p: string): ParsedConfiguration =>
        parsedConfig(p, [], [diagnostic(UNKNOWN_ERROR_CODE)]),
      expectedReason: 'not-found' as const,
    },
  ])(
    'records reason:$label for the matching single-leaf solution',
    async ({ refPath, parsedFor, expectedReason }) => {
      const ts = tsForWalk(await import('typescript'));

      const leafPath = leaf(refPath);

      const { ng } = stubCompilerCli({
        [leafPath]: { parsed: parsedFor(leafPath), diagnostics: [] },
      });

      const solutionParsed = parsedConfig(
        SOLUTION_TSCONFIG,
        [],
        [],
        [{ path: refPath }],
      );

      const walk = await walkReferences(
        ng,
        ts,
        solutionParsed,
        SOLUTION_TSCONFIG,
      );

      expect(walk.skippedReferences).toEqual([
        { referencePath: leafPath, reason: expectedReason },
      ]);
    },
  );
});
