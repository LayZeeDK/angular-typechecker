import { Component } from '@angular/core';

// Hermetic ENG-01 fixture (Plan 21-02): the APP leaf. Co-located with
// app.component.spec.ts under one project dir (D-06). One planted TS2322 (a string
// is not assignable to number) proves the array-union surfaces this leaf's
// diagnostic. Nothing in the workspace imports it, and the fixtures live at the
// workspace root (outside packages/angular-typechecker/src), so the plugin build's
// `src/**/*.ts` include keeps it out of the build. Do NOT add @ts-nocheck -- the
// error IS the fixture input.
@Component({
  selector: 'multi-tsconfig-app',
  standalone: true,
  template: '',
})
export class AppComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number
}
