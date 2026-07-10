import { Component } from '@angular/core';

// Hermetic ENG-01 fixture (WR-03): the APP leaf, in its OWN directory `app/`. One
// planted TS2322. Its sibling spec leaf lives in `../spec/` (a DIFFERENT directory)
// on purpose: the two leaves do NOT share a base directory, so `finalize`'s
// base-containment clause (filter-diagnostics.ts branch (c)) CANNOT rescue the
// spec leaf's file -- only the COMBINED rootNamePaths union keeps it. This isolates
// the combined-input-set-membership boundary the co-located `multi-tsconfig-array`
// fixture masks.
//
// OUT OF the plugin build: the fixtures live at the workspace root, kept out by the
// plugin tsconfig's `src/**/*.ts` include. Do NOT add @ts-nocheck -- the error IS
// the fixture input.
@Component({
  selector: 'cross-dir-app',
  standalone: true,
  template: '',
})
export class AppComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number
}
