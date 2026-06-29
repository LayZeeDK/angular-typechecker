// COR-02 fixture (Plan 08-02, D-04). A GLOBAL / location-less TypeScript
// diagnostic fixture: the leaf tsconfig sets `noLib: true` + `types: []` so the
// standard library declarations (which define the `Array` global type) are NOT
// loaded. Referencing the `Array` global below therefore makes the compiler
// emit a RAW TS2318 "Cannot find global type 'Array'" -- a diagnostic that the
// per-file `getTsSemanticDiagnostics` path NEVER emits; only
// `getTsProgram().getGlobalDiagnostics()` surfaces it (the COR-02 seventh
// getter). The TS2318 set is file-less, so the boundary filter always keeps it.
//
// This fixture deliberately does NOT extend tsconfig.base.json -- the global
// type loss must be REAL (a base config would re-introduce the lib types and
// the global diagnostic would vanish). OUT OF the project graph; kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the
// fixtures live at the workspace root, not under the package). Do NOT add a
// type-check-suppression directive -- the global error IS the fixture input.
export function makeNumbers(): number[] {
  return [1, 2, 3]; // uses the `Array` global -> TS2318 (no lib loaded)
}
