// Phase-3 sibling-import fixture: the DEPENDENCY half. It lives OUTSIDE the
// main-lib leaf-tsconfig `basePath` (a sibling directory) and is pulled into the
// program only via a `paths` alias from main.component.ts. It carries a
// DELIBERATE TS2322 so a diagnostic lands on THIS out-of-project file -- the
// default boundary filter must suppress it (D-05/D-06), and `includeDeps: true`
// must surface it (D-07).
//
// OUT OF the plugin build: the fixtures live at the workspace root, kept out by
// tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck --
// the error IS the fixture input.
export const dependencyLabel: number = 'not a number'; // TS2322: string is not assignable to number

export function describeDependency(): string {
  return 'dependency';
}
