# Research (folded from the --analyze pass) -- 260630-jnl

Trivial round: the assumptions-analyzer returned the exact mechanics. Copy-ready implementations
below; all verified against HEAD a1bcb80. No separate researcher spawned.

## #1 -- file-less Suggestion builder + de-tautologized S5c (infra-failure.spec.ts)

Add alongside the existing file-less builders (`errorDiagnostic` :52-61, `warningDiagnostic` :67-76):

```ts
// S5c: a file-less SUGGESTION diagnostic (category 2) -- retained in
// CoreResult.diagnostics but NEVER counted in errorCount/warningCount, so it makes
// diagnostics.length STRICTLY exceed errorCount+warningCount and breaks the MD-02
// `length - errorCount` tautology (a 2-element Error+Warning set could not).
function suggestionDiagnostic(code: number, message: string): ts.Diagnostic {
  return {
    category: 2, // ts.DiagnosticCategory.Suggestion
    code,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: message,
  } as ts.Diagnostic;
}
```

In the S5c test, feed a 3-element set and ADD the anti-tautology guard (keep the existing
`errorCount === 1` / `warningCount === 1` asserts):

```ts
diagnostics: ([errorDiagnostic(TS2322, 'Type string is not assignable to type number'), warningDiagnostic(6133, "'unused' is declared but its value is never read."), suggestionDiagnostic(6138, "'x' is declared but its value is never read.")],
  // ...
  expect(result.errorCount).toBe(1));
expect(result.warningCount).toBe(1);
// MD-02 anti-tautology: the Suggestion is retained but uncounted, so the explicit
// split is STRICTLY less than length. Under the buggy `length - errorCount`,
// warningCount would be 2 -> 1+2 === 3, NOT < 3 -> this FAILS as intended.
expect(result.errorCount + result.warningCount).toBeLessThan(result.diagnostics.length);
```

(Code 6138 is a real TS "declared but never read" suggestion code; only `.category` matters. Avoid
500 / `-99xxxx`.)

## #2 -- base-throw filter test (filter-diagnostics.spec.ts)

```ts
it('RES-03: a realpath that throws for the base only still KEEPS in-project files (isUnderDir undefined-dir branch)', () => {
  const realpath = (p: string): string => {
    if (p === '/ws/proj') {
      throw new Error('EACCES'); // base only
    }
    return p; // files resolve (identity)
  };

  const result = filterDiagnostics([diag('/ws/proj/src/a.ts')], {
    basePath: '/ws/proj',
    useCaseSensitiveFileNames: true,
    realpath,
    includeDeps: false,
  });

  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
```

Exercises filter-diagnostics.ts:188-190 (`canonicalBase === undefined` -> `isUnderDir` returns true
-> keep). The file canonicalizes normally so the line-100 `canonicalFile === undefined` short-circuit
does NOT fire -- this is the only path that reaches `isUnderDir` with an undefined dir.

## #3 -- program-undefined guard test, no 500 (infra-failure.spec.ts, D-06 describe)

```ts
it('#3: RE-THROWS a TypecheckInfrastructureError when performCompilation returns NO Program and NO 500', async () => {
  compilerCliStub.performCompilation.mockReturnValue({
    diagnostics: [],
    program: undefined,
  });

  const { runTypecheck, TypecheckInfrastructureError } = await import('./run-typecheck');

  await expect(runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' })).rejects.toBeInstanceOf(TypecheckInfrastructureError);

  await expect(runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' })).rejects.toThrow(/returned no Program/);
});
```

Verbatim guard message (run-typecheck.ts:266-271): "angular-typecheck: the Angular compiler returned
no Program (performCompilation produced neither a Program nor an UNKNOWN_ERROR_CODE diagnostic). This
is an infrastructure failure, not a type error." The `/returned no Program/` substring matches; do not
pin the full sentence. Empty `diagnostics` => the 500 scan finds nothing => execution reaches the
guard. Default beforeEach config supplies non-empty rootNames.

## #4 -- de-pin (compiler-cli-types.runtime.spec.ts:118)

Replace the `(run-typecheck.ts:265-267)` line pin with a symbol reference, e.g.
"the `getTsProgram().useCaseSensitiveFileNames()` read in `runTypecheck`". The real read is now at
:292-294; line 265 is the guard. The claimed `infra-failure.spec.ts:204` drift is REFUTED (prose, no
pin) -- no change there.

## #5 -- comment precision (run-typecheck.ts), cosmetic, surgical scope

- `:260`: "access in `finalize` below" -> "access in the `finalize` CALL ARGS below (within
  `runTypecheck`)" (deref runs at :292-294, in the call args, not the finalize body).
- `:255`: de-pin `perform_compile.d.ts:29` -> "the optional `program?` field of
  `PerformCompilationResult`". Leave the `compiler-cli-types.ts` perform_compile pins untouched (not
  flagged).

## RESEARCH COMPLETE
