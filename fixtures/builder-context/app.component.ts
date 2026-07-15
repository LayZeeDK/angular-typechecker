import { Component } from '@angular/core';

// Builder-over-BuilderContext fixture (Phase 24, ACV-03 gap-fill): the APP leaf.
// Co-located with app.component.spec.ts under one project dir. One planted TS2322
// (a string is not assignable to number) makes the [tsconfig.app.json,
// tsconfig.spec.json] run FAIL, so the builder's BuilderOutput.success === false
// (matching the Nx executor's { success: false }). The fixtures live at the
// workspace root (outside packages/angular-typechecker/src), so the plugin build's
// `src/**/*.ts` include keeps them out of the build. Do NOT add @ts-nocheck -- the
// error IS the fixture input.
@Component({
  selector: 'builder-context-app',
  standalone: true,
  template: '',
})
export class AppComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number
}
