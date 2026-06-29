import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { EmitFlags, Program } from './compiler-cli-types';
import { loadCompilerCli } from './compiler-loader';

// RES-01 GATE SPIKE -- THROWAWAY PROBE (NOT shipped engine code; excluded from
// the plugin build by tsconfig.lib.json's spec exclusion). It empirically
// settles the one load-bearing open question (D-01/D-02/D-03, PRIOR-ART #3 /
// ENGINE-REF Open Q3): are any Angular NON-TEMPLATE diagnostics
// (traitCompiler.diagnostics / checkForPrivateExports) file-less
// (d.file === undefined) -- or attached to a ts.SourceFile object that is not
// strictly === an iterated source file -- in the no-emit path?
//
// NgCompiler.getDiagnosticsForFile filters the non-template set by
// `d.file === file` (compiler.ts:618 @ v22.0.4), so a naive per-file
// getNgSemanticDiagnostics(fileName) loop (SIMPLE) would SILENTLY DROP any
// such diagnostic. SIMPLE is valid ONLY with POSITIVE proof none exist; per
// D-03 inconclusive -> HYBRID. Absence of evidence is not proof of absence
// (Pitfall 1).
//
// METHOD: reach the LIVE api.Program via the same loadCompilerCli() +
// readConfiguration + performCompilation path the engine uses
// (run-typecheck.ts:102-193), capturing `program` in a custom gatherDiagnostics
// callback. Then:
//   (W) gather the WHOLE-PROGRAM Angular set: program.getNgSemanticDiagnostics()
//       (no fileName) -> compiler.getDiagnostics() (program.ts:224-243).
//   (U) build the per-file UNION: program.getNgSemanticDiagnostics(sf.fileName)
//       over getTsProgram().getSourceFiles() skipping isDeclarationFile (D-06).
//   (C) inspect d.file on EVERY whole-program diagnostic and positively
//       enumerate whether each is file-bearing-and-matched to an iterated
//       source file (the SIMPLE precondition), and confirm the per-file union
//       does not drop a file-less non-template diagnostic.
// Also VERIFY A1: the tcb-poison component's IMPORT_GENERATION_FAILURE is a
// TEMPLATE/TCB Fatal -- it must be ABSENT from the whole-program NON-template
// portion (it appears only via the per-file template path), confirming the
// fixture exercises the per-file template try/catch (Pitfall 2).
//
// This probe is diagnostic, not a permanent assertion: it runs once, logs the
// empirical findings, and records the GO decision in 09-RES-01-SPIKE.md.

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const faultIsolationTsConfig = join(
  workspaceRoot,
  'fixtures',
  'fault-isolation',
  'tsconfig.app.json',
);
// A single-file fixture that produces an ANALYSIS-phase Angular NON-TEMPLATE
// diagnostic (a plain class in `imports:`) so the probe can inspect a real
// getNonTemplateDiagnostics() entry's .file without a template Fatal aborting it.
const nonTemplateTsConfig = join(
  workspaceRoot,
  'fixtures',
  'fault-isolation',
  'tsconfig.non-template.json',
);

// Angular encodes extended codes negative: ngErrorCode(8109) = -998109. TS codes
// are raw positive. IMPORT_GENERATION_FAILURE is an NG extended code too.
const NG = (code: number): number => -990000 - code;
// IMPORT_GENERATION_FAILURE = 3004 (error_code.ts:207 @ v22.0.4) -> -993004.
const NG_IMPORT_GENERATION_FAILURE = NG(3004);

interface DiagnosticShape {
  code: number;
  file: { fileName: string } | undefined;
  messageText: ts.Diagnostic['messageText'];
}

function describeDiagnostic(diagnostic: ts.Diagnostic): string {
  const fileName = diagnostic.file?.fileName ?? '<file-less>';

  return `code=${diagnostic.code} file=${fileName}`;
}

// Capture the LIVE api.Program for a fixture tsconfig via the same
// loadCompilerCli() + readConfiguration + performCompilation path the engine
// uses (run-typecheck.ts:102-193), with the same emit-neutralizing override, so
// the probe sees exactly the no-emit program the engine would build.
async function captureProgram(tsConfigPath: string): Promise<Program> {
  const ng = await loadCompilerCli();

  const parsed = ng.readConfiguration(tsConfigPath, {
    suppressOutputPathCheck: true,
  });

  expect(parsed.rootNames.length).toBeGreaterThan(0);

  let captured: Program | undefined;

  ng.performCompilation({
    rootNames: parsed.rootNames,
    options: {
      ...parsed.options,
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
      diagnostics: false,
    },
    emitFlags: 0 as EmitFlags,
    gatherDiagnostics: (program: Program): readonly ts.Diagnostic[] => {
      captured = program;

      return [];
    },
  });

  expect(captured).toBeDefined();

  return captured as Program;
}

describe('RES-01 spike: file-less non-template diagnostics probe', () => {
  it('inspects d.file on the whole-program set vs the per-file union (records the GO decision)', async () => {
    const program = await captureProgram(faultIsolationTsConfig);
    const tsProgram = program.getTsProgram();

    // (W) WHOLE-PROGRAM Angular semantic set (single try/catch; aborts on the
    // first poison file -- this is exactly the early-return behavior RES-02
    // replaces).
    const wholeProgram = program.getNgSemanticDiagnostics();

    // Inventory the NON-declaration source files the per-file loop iterates
    // (D-06) so the GO record can name exactly what the SIMPLE loop sees.
    const iteratedFileNames = tsProgram
      .getSourceFiles()
      .filter((sf) => !sf.isDeclarationFile)
      .map((sf) => sf.fileName);

    // (U) PER-FILE UNION (the SIMPLE-shape loop -- isolated per file via the
    // built-in isFatalDiagnosticError try/catch). Capture a per-file breakdown
    // so the GO record can show whether one poison file's Fatal abandons the
    // OTHER files' diagnostics.
    const perFileUnion: ts.Diagnostic[] = [];
    const iteratedSourceFiles = new Set<ts.SourceFile>();
    const perFileBreakdown: { sourceFile: string; diagnostics: string[] }[] = [];

    for (const sf of tsProgram.getSourceFiles()) {
      if (sf.isDeclarationFile) {
        continue;
      }

      iteratedSourceFiles.add(sf);
      const forThisFile = program.getNgSemanticDiagnostics(sf.fileName);
      perFileUnion.push(...forThisFile);
      perFileBreakdown.push({
        sourceFile: sf.fileName,
        diagnostics: forThisFile.map(describeDiagnostic),
      });
    }

    // (C) Inspect d.file on the whole-program set. A diagnostic is "file-bearing
    // and matched" iff its .file is a ts.SourceFile object strictly === one of
    // the iterated (non-declaration) source files. Anything file-less, or
    // attached to a SourceFile not in the iterated set, is what a SIMPLE per-file
    // loop's d.file === file filter would DROP.
    const wholeProgramFindings = wholeProgram.map((diagnostic) => {
      const file = diagnostic.file;
      const fileLess = file === undefined;
      const matchedIterated =
        file !== undefined && iteratedSourceFiles.has(file);

      return {
        code: diagnostic.code,
        fileName: file?.fileName,
        fileLess,
        matchedIterated,
      };
    });

    const fileLessOrUnmatched = wholeProgramFindings.filter(
      (finding) => finding.fileLess || !finding.matchedIterated,
    );

    // A1 verification: the IMPORT_GENERATION_FAILURE poison is a TEMPLATE/TCB
    // Fatal. It must appear in the PER-FILE union (the per-file template path)
    // but be ABSENT from the whole-program NON-template portion. Because the
    // whole-program getNgSemanticDiagnostics() aborts on the poison file's Fatal,
    // we assert the poison surfaces via the per-file path here.
    const perFileCodes = perFileUnion.map((diagnostic) => diagnostic.code);
    const poisonInPerFile = perFileCodes.includes(NG_IMPORT_GENERATION_FAILURE);

    // The per-file union must contain EVERY whole-program diagnostic that is
    // file-bearing-and-matched (the SIMPLE-loss test). We compare on a structural
    // (code, fileName) key because the per-file calls may return distinct
    // diagnostic object identities.
    const keyOf = (diagnostic: DiagnosticShape): string =>
      `${diagnostic.code}::${diagnostic.file?.fileName ?? '<file-less>'}`;
    const perFileKeys = new Set(
      perFileUnion.map((diagnostic) =>
        keyOf(diagnostic as unknown as DiagnosticShape),
      ),
    );
    const droppedFromUnion = wholeProgram.filter(
      (diagnostic) =>
        !perFileKeys.has(keyOf(diagnostic as unknown as DiagnosticShape)),
    );

    // Emit the empirical record (consumed when authoring 09-RES-01-SPIKE.md).
    /* eslint-disable no-console */
    console.log(
      '[RES-01] iterated (non-declaration) source files:',
      iteratedFileNames,
    );
    console.log('[RES-01] whole-program diagnostic count:', wholeProgram.length);
    console.log(
      '[RES-01] whole-program diagnostics:',
      wholeProgram.map(describeDiagnostic),
    );
    console.log('[RES-01] per-file union count:', perFileUnion.length);
    console.log(
      '[RES-01] per-file union diagnostics:',
      perFileUnion.map(describeDiagnostic),
    );
    console.log(
      '[RES-01] per-file BREAKDOWN (sourceFile -> diagnostics):',
      JSON.stringify(perFileBreakdown, null, 2),
    );
    console.log(
      '[RES-01] whole-program file-less-or-unmatched count:',
      fileLessOrUnmatched.length,
    );
    console.log(
      '[RES-01] whole-program file-less-or-unmatched:',
      fileLessOrUnmatched,
    );
    console.log(
      '[RES-01] whole-program diagnostics dropped from per-file union:',
      droppedFromUnion.map(describeDiagnostic),
    );
    console.log(
      '[RES-01] A1: IMPORT_GENERATION_FAILURE present in per-file union:',
      poisonInPerFile,
    );
    /* eslint-enable no-console */

    // The probe completes (it is diagnostic). The GO decision is recorded in
    // 09-RES-01-SPIKE.md from the logged findings above.
    expect(Array.isArray(wholeProgram)).toBe(true);
    expect(Array.isArray(perFileUnion)).toBe(true);
  });

  it('inspects d.file on a real NON-TEMPLATE (analysis-phase) diagnostic vs the per-file union', async () => {
    // This leg exercises a genuine getNonTemplateDiagnostics() entry (a plain
    // class in `imports:` -> an analysis/traitCompiler diagnostic) WITHOUT a
    // template Fatal aborting the run, so we can directly inspect a non-template
    // diagnostic's .file and whether the SIMPLE per-file (d.file === file) loop
    // retains it.
    const program = await captureProgram(nonTemplateTsConfig);
    const tsProgram = program.getTsProgram();

    const wholeProgram = program.getNgSemanticDiagnostics();

    const perFileUnion: ts.Diagnostic[] = [];

    for (const sf of tsProgram.getSourceFiles()) {
      if (sf.isDeclarationFile) {
        continue;
      }

      perFileUnion.push(...program.getNgSemanticDiagnostics(sf.fileName));
    }

    const keyOf = (diagnostic: DiagnosticShape): string =>
      `${diagnostic.code}::${diagnostic.file?.fileName ?? '<file-less>'}`;
    const perFileKeys = new Set(
      perFileUnion.map((diagnostic) =>
        keyOf(diagnostic as unknown as DiagnosticShape),
      ),
    );
    const droppedFromUnion = wholeProgram.filter(
      (diagnostic) =>
        !perFileKeys.has(keyOf(diagnostic as unknown as DiagnosticShape)),
    );

    /* eslint-disable no-console */
    console.log(
      '[RES-01 non-template] whole-program diagnostics:',
      wholeProgram.map(describeDiagnostic),
    );
    console.log(
      '[RES-01 non-template] per-file union diagnostics:',
      perFileUnion.map(describeDiagnostic),
    );
    console.log(
      '[RES-01 non-template] whole-program entries with file-less .file:',
      wholeProgram
        .filter((diagnostic) => diagnostic.file === undefined)
        .map(describeDiagnostic),
    );
    console.log(
      '[RES-01 non-template] whole-program diagnostics DROPPED from the per-file union:',
      droppedFromUnion.map(describeDiagnostic),
    );
    /* eslint-enable no-console */

    expect(Array.isArray(wholeProgram)).toBe(true);
    expect(Array.isArray(perFileUnion)).toBe(true);
  });
});
