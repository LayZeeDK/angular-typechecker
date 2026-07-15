import { AppComponent } from './app.component';

// Builder-over-BuilderContext fixture (Phase 24): the SPEC leaf. It IMPORTS
// AppComponent so both leaves sit in one dependency graph -- app.component.ts is a
// rootName of the app leaf and a dependency of the spec leaf's program, so the
// combined input-set boundary keeps it. The spec carries its OWN planted TS2345 (a
// wrong-type argument), DISTINCT from the app leaf's TS2322, so the two-element
// tsConfig array run over [app, spec] surfaces both leaves' diagnostics.
export const componentUnderTest: typeof AppComponent = AppComponent;

declare function expectNumber(value: number): void;

expectNumber('not a number'); // TS2345: string is not assignable to number
