// Phase 15 GE2E fixture: a LIB-ONLY leaf source of the un-wired multi-leaf
// consumer-generator workspace (D-01). tsconfig.lib.json's `src/**/*.ts` include
// makes this a rootName in the LIB leaf program, while tsconfig.spec.json (include:
// *.spec.ts / *.test.ts only) EXCLUDES it AND no *.spec.ts imports it -- so it is
// never pulled into the spec-leaf program transitively. Committed CLEAN; the
// generator-e2e spec injects a deliberate TS2322 (flipping this const's declared
// type to `number` while keeping its string value) into a per-run TMP copy so the
// TS2322 can ONLY come from the lib reference being independently walked (WR-01).
// This proves the solution tsconfig's lib leaf was walked WITHOUT leaking through
// the spec leaf's import graph the way an injection into the imported component
// would.
export const consumerGeneratorLibOnly: string = 'ok';
