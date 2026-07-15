import { AppComponent } from '../app/app.component';

// Hermetic ENG-01 fixture (WR-03): the SPEC leaf, in a DIFFERENT directory `spec/`
// from the app leaf. It IMPORTS AppComponent (in `../app/`), so `app.component.ts`
// is a DEPENDENCY of this leaf's program but NOT one of its declared rootNames and
// NOT under this leaf's base dir. It carries its OWN planted TS2345, DISTINCT from
// the app leaf's TS2322.
//
// The cross-dir layout is the point: when the array `[appLeaf, specLeaf]` runs, the
// representative (first) leaf is the app leaf, so `finalize`'s base dir is `app/`.
// This spec file sits in `spec/` -- OUTSIDE `app/` -- so the base-containment clause
// cannot keep it. Only the COMBINED rootNamePaths union (which includes THIS leaf's
// declared `app.spec.ts`) keeps its diagnostic. If `handleMultiTsConfig` regressed
// to using only the first leaf's rootNames, this TS2345 would be dropped as an
// out-of-project dependency -- the mutation this fixture kills.
export const componentUnderTest: typeof AppComponent = AppComponent;

declare function expectNumber(value: number): void;

expectNumber('not a number'); // TS2345: string is not assignable to number
