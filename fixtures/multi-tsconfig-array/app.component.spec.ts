import { AppComponent } from './app.component';

// Hermetic ENG-01 fixture (Plan 21-02): the SPEC leaf. It IMPORTS AppComponent so
// both leaves sit in one dependency graph -- app.component.ts is a rootName of the
// app leaf and a dependency of the spec leaf's program, so the combined-input-set
// boundary must keep it (running the spec leaf ALONE would suppress it as out of the
// spec leaf's input set). The spec carries its OWN planted TS2345 (a wrong-type
// argument), DISTINCT from the app leaf's TS2322, so the union proof shows BOTH
// leaves' diagnostics surface.
export const componentUnderTest: typeof AppComponent = AppComponent;

declare function expectNumber(value: number): void;

expectNumber('not a number'); // TS2345: string is not assignable to number
